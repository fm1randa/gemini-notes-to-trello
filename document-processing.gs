/**
 * Document Processing module for Gemini Notes to Trello
 *
 * Handles parsing of Gemini Notes documents and extraction
 * of action items assigned to specific users.
 */

/**
 * Gets the text content of a Google Doc using Drive export.
 * This is more reliable than DocumentApp.openById() which can fail in some contexts.
 *
 * @param {string} fileId - The document ID
 * @returns {string} The document text content
 */
function getDocumentText(fileId) {
  const url = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  const response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`Failed to export document: ${response.getContentText()}`);
  }

  return response.getContentText();
}

/**
 * Processes a single Gemini Notes document and creates Trello cards.
 *
 * @param {GoogleAppsScript.Drive.File} file - The Gemini Notes file
 * @param {Object} config - Configuration object
 * @returns {number} Number of cards created
 */
function processDocument(file, config) {
  Logger.log(`Processing: ${file.getName()}`);

  const text = getDocumentText(file.getId());

  // Extract meeting metadata
  const meetingInfo = extractMeetingInfo(file, text);

  // Extract action items assigned to the configured name
  const actionItems = extractActionItems(text, config.NAME_PATTERN, meetingInfo);
  Logger.log(`Found ${actionItems.length} action item(s) for ${config.NAME_PATTERN}`);

  let cardsCreated = 0;

  for (const item of actionItems) {
    try {
      // Check for duplicates before creating
      if (isDuplicateCard(item, config)) {
        Logger.log(`Skipping duplicate: ${item.task.substring(0, 50)}...`);
        continue;
      }

      createTrelloCard(item, config);
      cardsCreated++;

      // Respect Trello and Gemini API rate limits
      const ONE_MINUTE_MILLIS = 1 * 60 * 1000;
      Utilities.sleep(ONE_MINUTE_MILLIS);

    } catch (cardError) {
      Logger.log(`Failed to create card: ${cardError.message}`);
      // Continue with other items
    }
  }

  return cardsCreated;
}

/**
 * Extracts meeting information from document name and content.
 *
 * @param {GoogleAppsScript.Drive.File} file - The document file
 * @param {string} text - Document text content
 * @returns {Object} Meeting information
 */
function extractMeetingInfo(file, text) {
  const name = file.getName();
  const created = file.getDateCreated();

  // Try to extract meeting title from document name (Brazilian Portuguese pattern)
  // Documents end with " - Anotacoes do Gemini", so remove that suffix
  let meetingTitle = name
    .replace(/\s*-\s*Anotações do Gemini$/i, '')
    .replace(/\s*\(\d+.*\)$/, '') // Remove trailing date/time in parentheses
    .trim();

  // Try to extract date from content
  let meetingDate = created;
  const datePatterns = [
    /(?:date|meeting date)[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsed = new Date(match[1]);
      if (!isNaN(parsed.getTime())) {
        meetingDate = parsed;
        break;
      }
    }
  }

  return {
    title: meetingTitle || 'Untitled Meeting',
    date: meetingDate,
    documentUrl: file.getUrl()
  };
}

/**
 * Extracts action items assigned to the specified person.
 *
 * Handles various formats:
 * - "Filipe will..."
 * - "Filipe to..."
 * - "Action: Filipe - ..."
 * - "@Filipe: ..."
 * - "[ ] Filipe: ..."
 * - Bullet points under "Action Items" section
 *
 * @param {string} text - Document text
 * @param {string} namePattern - Name to search for
 * @param {Object} meetingInfo - Meeting context information
 * @returns {Object[]} Array of action item objects
 */
function extractActionItems(text, namePattern, meetingInfo) {
  const actionItems = [];
  const name = escapeRegExp(namePattern);

  // Split into lines for processing
  const lines = text.split('\n');

  // Track if we're in an "Action Items" section
  let inActionSection = false;

  // Patterns that indicate an action item for the person
  const actionPatterns = [
    // "Filipe will do something"
    new RegExp(`${name}\\s+will\\s+(.+?)(?:\\.|$)`, 'gi'),
    // "Filipe to do something"
    new RegExp(`${name}\\s+to\\s+(.+?)(?:\\.|$)`, 'gi'),
    // "Action: Filipe - do something" or "Action item: Filipe - ..."
    new RegExp(`action(?:\\s*item)?[:\\s]+${name}\\s*[-\u2013\u2014:]\\s*(.+?)(?:\\.|$)`, 'gi'),
    // "@Filipe do something" or "@Filipe: do something"
    new RegExp(`@${name}[:\\s]+(.+?)(?:\\.|$)`, 'gi'),
    // "[ ] Filipe: do something" (checkbox format)
    new RegExp(`\\[\\s*\\]\\s*${name}[:\\s]+(.+?)(?:\\.|$)`, 'gi'),
    // "- Filipe: do something" (bullet point format)
    new RegExp(`^\\s*[-\u2022*]\\s*${name}[:\\s]+(.+?)(?:\\.|$)`, 'gim'),
    // "Filipe - do something" (simple dash format)
    new RegExp(`${name}\\s*[-\u2013\u2014]\\s*(.+?)(?:\\.|$)`, 'gi')
  ];

  // First pass: Find action items using patterns
  for (const pattern of actionPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const task = cleanTaskDescription(match[1]);
      if (task && task.length > 5) { // Ignore very short matches
        actionItems.push({
          task: task,
          dueDate: extractDueDate(match[0] + ' ' + getContextAfter(text, match.index, 100)),
          meetingTitle: meetingInfo.title,
          meetingDate: meetingInfo.date,
          documentUrl: meetingInfo.documentUrl,
          rawText: match[0]
        });
      }
    }
  }

  // Second pass: Look for items in "Proximas etapas sugeridas" section (Brazilian Portuguese)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    // Check if we're entering/exiting action items section (Portuguese terms)
    if (line.includes('proximas etapas sugeridas') || line.includes('proximas etapas')) {
      inActionSection = true;
      continue;
    }

    // Exit section on new major heading
    if (inActionSection && /^[A-Z][^a-z]*$/.test(lines[i].trim()) && lines[i].trim().length > 3) {
      inActionSection = false;
      continue;
    }

    // Look for name mentions in action section
    if (inActionSection) {
      const nameRegex = new RegExp(name, 'i');
      if (nameRegex.test(lines[i])) {
        const task = cleanTaskDescription(
          lines[i].replace(nameRegex, '').replace(/^[\s\-\u2022*:]+/, '').trim()
        );
        if (task && task.length > 5 && !isDuplicateTask(task, actionItems)) {
          actionItems.push({
            task: task,
            dueDate: extractDueDate(lines[i] + ' ' + (lines[i + 1] || '')),
            meetingTitle: meetingInfo.title,
            meetingDate: meetingInfo.date,
            documentUrl: meetingInfo.documentUrl,
            rawText: lines[i]
          });
        }
      }
    }
  }

  // Remove duplicates based on task similarity
  return deduplicateActionItems(actionItems);
}

/**
 * Extracts due date from text if mentioned.
 *
 * @param {string} text - Text to search for due date
 * @returns {Date|null} Extracted due date or null
 */
function extractDueDate(text) {
  const dueDatePatterns = [
    // "by Friday", "by Monday", etc.
    /by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    // "by January 15", "by Jan 15", etc.
    /by\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
    // "due: January 15" or "due date: Jan 15"
    /due(?:\s*date)?[:\s]+(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
    // "by end of week", "by EOD", "by end of day"
    /by\s+(end of (?:week|day)|eow|eod)/i,
    // "by 1/15" or "by 01/15/2024"
    /by\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    // "deadline: ..."
    /deadline[:\s]+(.+?)(?:\.|,|$)/i
  ];

  for (const pattern of dueDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseDueDateString(match[1]);
    }
  }

  return null;
}

/**
 * Parses a due date string into a Date object.
 *
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null} Parsed date or null
 */
function parseDueDateString(dateStr) {
  const normalized = dateStr.toLowerCase().trim();
  const today = new Date();

  // Handle relative dates
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = dayNames.indexOf(normalized);
  if (dayIndex !== -1) {
    const targetDate = new Date(today);
    const daysUntil = (dayIndex - today.getDay() + 7) % 7 || 7;
    targetDate.setDate(today.getDate() + daysUntil);
    return targetDate;
  }

  // Handle "end of week" / "eow"
  if (normalized.includes('end of week') || normalized === 'eow') {
    const friday = new Date(today);
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    friday.setDate(today.getDate() + daysUntilFriday);
    return friday;
  }

  // Handle "end of day" / "eod"
  if (normalized.includes('end of day') || normalized === 'eod') {
    return today;
  }

  // Try standard date parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    // If no year specified and date is in the past, assume next year
    if (!dateStr.match(/\d{4}/) && parsed < today) {
      parsed.setFullYear(parsed.getFullYear() + 1);
    }
    return parsed;
  }

  return null;
}

/**
 * Cleans up extracted task description.
 *
 * @param {string} task - Raw task text
 * @returns {string} Cleaned task description
 */
function cleanTaskDescription(task) {
  return task
    .replace(/^[\s\-\u2022*:]+/, '')  // Remove leading bullets/dashes
    .replace(/[\s\-\u2022*:]+$/, '')  // Remove trailing bullets/dashes
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();
}

/**
 * Gets context text after a match position.
 *
 * @param {string} text - Full text
 * @param {number} position - Position in text
 * @param {number} length - Characters to extract
 * @returns {string} Context text
 */
function getContextAfter(text, position, length) {
  return text.substring(position, Math.min(position + length, text.length));
}

/**
 * Checks if a task already exists in the action items array.
 *
 * @param {string} task - Task to check
 * @param {Object[]} items - Existing action items
 * @returns {boolean} True if duplicate
 */
function isDuplicateTask(task, items) {
  const normalizedTask = task.toLowerCase().replace(/\s+/g, ' ');
  return items.some(item => {
    const existing = item.task.toLowerCase().replace(/\s+/g, ' ');
    return existing === normalizedTask ||
           existing.includes(normalizedTask) ||
           normalizedTask.includes(existing);
  });
}

/**
 * Removes duplicate action items based on task similarity.
 *
 * @param {Object[]} items - Action items array
 * @returns {Object[]} Deduplicated array
 */
function deduplicateActionItems(items) {
  const unique = [];

  for (const item of items) {
    if (!isDuplicateTask(item.task, unique)) {
      unique.push(item);
    }
  }

  return unique;
}

/**
 * Escapes special regex characters in a string.
 *
 * @param {string} string - String to escape
 * @returns {string} Escaped string safe for regex
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Formats a date for display.
 *
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return 'Unknown';
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMMM d, yyyy');
}
