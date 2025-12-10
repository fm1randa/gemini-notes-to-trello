/**
 * Google Apps Script: Gemini Notes to Trello Action Items
 * 
 * Automatically creates Trello cards from action items assigned to you
 * in Google Meet's Gemini Notes documents.
 * 
 * @author Generated for Filipe
 * @version 1.0.0
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Gets configuration from Script Properties.
 * All sensitive data is stored securely in Script Properties.
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Trello API credentials
    TRELLO_API_KEY: props.getProperty('TRELLO_API_KEY'),
    TRELLO_TOKEN: props.getProperty('TRELLO_TOKEN'),

    // Trello board/list configuration
    TRELLO_BOARD_ID: props.getProperty('TRELLO_BOARD_ID'),
    TRELLO_LIST_ID: props.getProperty('TRELLO_LIST_ID'),

    // Gemini API key for rewriting action items
    GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY'),

    // Name pattern to match for action items (supports regex)
    NAME_PATTERN: props.getProperty('NAME_PATTERN') || 'Filipe Miranda Pereira',

    // Email for error notifications
    NOTIFICATION_EMAIL: props.getProperty('NOTIFICATION_EMAIL') || Session.getActiveUser().getEmail(),

    // Hours to look back for new documents (default: 2 hours for hourly trigger overlap)
    LOOKBACK_HOURS: parseInt(props.getProperty('LOOKBACK_HOURS') || '2', 10)
  };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Main function to be called by time-based trigger.
 * Scans for new Gemini Notes and creates Trello cards for action items.
 */
function processGeminiNotes() {
  const config = getConfig();
  
  // Validate configuration
  if (!validateConfig(config)) {
    return;
  }
  
  const startTime = new Date();
  Logger.log(`Starting Gemini Notes scan at ${startTime.toISOString()}`);
  
  try {
    // Find new Gemini Notes documents
    const geminiDocs = findGeminiNotesDocs(config.LOOKBACK_HOURS);
    Logger.log(`Found ${geminiDocs.length} Gemini Notes document(s) to process`);
    
    let totalCardsCreated = 0;
    let errors = [];
    
    for (const doc of geminiDocs) {
      try {
        const cardsCreated = processDocument(doc, config);
        totalCardsCreated += cardsCreated;
        markDocumentAsProcessed(doc.getId());
      } catch (docError) {
        const errorMsg = `Error processing document "${doc.getName()}": ${docError.message}`;
        Logger.log(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    // Send error notification if any critical errors occurred
    if (errors.length > 0) {
      sendErrorNotification(errors, config.NOTIFICATION_EMAIL);
    }
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    Logger.log(`Completed in ${duration}s. Created ${totalCardsCreated} card(s). Errors: ${errors.length}`);
    
  } catch (error) {
    Logger.log(`Critical error: ${error.message}`);
    sendErrorNotification([`Critical error: ${error.message}\n${error.stack}`], config.NOTIFICATION_EMAIL);
  }
}

// ============================================================================
// GEMINI NOTES DETECTION
// ============================================================================

/**
 * Finds Gemini Notes documents created within the lookback period.
 * 
 * Gemini Notes are identified by:
 * 1. Document title pattern: "Meeting notes - [Meeting Title]" or similar
 * 2. Created by Google Meet (application metadata)
 * 3. Located in "Meet Recordings" folder or has specific metadata
 * 
 * @param {number} lookbackHours - Hours to look back for new documents
 * @returns {GoogleAppsScript.Drive.File[]} Array of Gemini Notes files
 */
function findGeminiNotesDocs(lookbackHours) {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - lookbackHours);
  const cutoffStr = cutoffTime.toISOString();
  
  // Search query for Gemini Notes documents (Brazilian Portuguese)
  // Gemini Notes are Google Docs that end with " - Anotações do Gemini"
  // DriveApp.searchFiles() uses Drive API v2 query syntax
  const queries = [
    // Search for "Gemini" in the title (more reliable than special characters)
    `mimeType = 'application/vnd.google-apps.document' and title contains 'Gemini' and modifiedDate >= '${cutoffStr.split('T')[0]}'`
  ];
  
  const processedIds = getProcessedDocumentIds();
  const foundDocs = [];
  const seenIds = new Set();
  
  for (const query of queries) {
    try {
      const files = DriveApp.searchFiles(query);
      
      while (files.hasNext()) {
        const file = files.next();
        const fileId = file.getId();
        
        // Skip already processed or duplicate files
        if (processedIds.has(fileId) || seenIds.has(fileId)) {
          continue;
        }
        
        // Verify this looks like a Gemini Notes document
        if (isGeminiNotesDocument(file)) {
          foundDocs.push(file);
          seenIds.add(fileId);
        }
      }
    } catch (searchError) {
      Logger.log(`Search query failed: ${searchError.message}`);
    }
  }
  
  return foundDocs;
}

/**
 * Validates whether a file is a genuine Gemini Notes document.
 * 
 * @param {GoogleAppsScript.Drive.File} file - The file to validate
 * @returns {boolean} True if this appears to be a Gemini Notes document
 */
function isGeminiNotesDocument(file) {
  const name = file.getName();

  // Check if document name ends with " - Anotações do Gemini"
  const geminiPattern = /\s*-\s*Anotações do Gemini$/i;

  // The naming pattern alone is sufficient to identify Gemini Notes
  // since this is a unique pattern used only by Google Meet
  return geminiPattern.test(name);
}

// ============================================================================
// DOCUMENT PROCESSING
// ============================================================================

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
      
      // Respect Trello API rate limits (10 requests per second)
      Utilities.sleep(150);
      
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
  // Documents end with " - Anotações do Gemini", so remove that suffix
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
    new RegExp(`action(?:\\s*item)?[:\\s]+${name}\\s*[-–—:]\\s*(.+?)(?:\\.|$)`, 'gi'),
    // "@Filipe do something" or "@Filipe: do something"
    new RegExp(`@${name}[:\\s]+(.+?)(?:\\.|$)`, 'gi'),
    // "[ ] Filipe: do something" (checkbox format)
    new RegExp(`\\[\\s*\\]\\s*${name}[:\\s]+(.+?)(?:\\.|$)`, 'gi'),
    // "- Filipe: do something" (bullet point format)
    new RegExp(`^\\s*[-•*]\\s*${name}[:\\s]+(.+?)(?:\\.|$)`, 'gim'),
    // "Filipe - do something" (simple dash format)
    new RegExp(`${name}\\s*[-–—]\\s*(.+?)(?:\\.|$)`, 'gi')
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
  
  // Second pass: Look for items in "Próximas etapas sugeridas" section (Brazilian Portuguese)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    // Check if we're entering/exiting action items section (Portuguese terms)
    if (line.includes('próximas etapas sugeridas') || line.includes('próximas etapas')) {
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
          lines[i].replace(nameRegex, '').replace(/^[\s\-•*:]+/, '').trim()
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
    .replace(/^[\s\-•*:]+/, '')  // Remove leading bullets/dashes
    .replace(/[\s\-•*:]+$/, '')  // Remove trailing bullets/dashes
    .replace(/\s+/g, ' ')         // Normalize whitespace
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

// ============================================================================
// TRELLO INTEGRATION
// ============================================================================

/**
 * Rewrites an action item in the imperative mood using Gemini API.
 *
 * @param {string} task - The original action item text
 * @param {string} apiKey - Gemini API key
 * @returns {string} The rewritten action item in imperative mood
 */
function rewriteActionItemWithGemini(task, apiKey) {
  if (!apiKey) {
    Logger.log('Gemini API key not configured, using original task');
    return task;
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

  const prompt = `Reescreva o seguinte item de ação no modo imperativo em português brasileiro.
Mantenha conciso e acionável. Retorne APENAS o texto reescrito, nada mais.
Não adicione aspas ou qualquer outra formatação.

Regras importantes:
- Se houver outras pessoas mencionadas além de mim, mantenha a referência a elas (ex: "com o Fulano" ou "junto com Fulano")
- Remova meu nome do início, mas mantenha o contexto de colaboração
- Sempre responda em português brasileiro

Exemplos:
- "Filipe vai enviar o relatório" -> "Enviar o relatório"
- "Filipe e João vão revisar o código" -> "Revisar o código com o João"
- "Filipe, Maria e Pedro irão agendar a reunião" -> "Agendar a reunião com Maria e Pedro"

Item de ação: "${task}"`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 100
    }
  };

  try {
    const response = UrlFetchApp.fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log(`Gemini API error: ${response.getContentText()}`);
      return task;
    }

    const result = JSON.parse(response.getContentText());
    const rewrittenTask = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (rewrittenTask) {
      Logger.log(`Rewritten: "${task}" -> "${rewrittenTask}"`);
      return rewrittenTask;
    }

    return task;
  } catch (error) {
    Logger.log(`Error calling Gemini API: ${error.message}`);
    return task;
  }
}

/**
 * Creates a Trello card for an action item.
 *
 * @param {Object} actionItem - The action item object
 * @param {Object} config - Configuration object
 */
function createTrelloCard(actionItem, config) {
  const url = 'https://api.trello.com/1/cards';

  // Rewrite the action item in imperative mood using Gemini
  const rewrittenTask = rewriteActionItemWithGemini(actionItem.task, config.GEMINI_API_KEY);

  // Format card name
  const cardName = rewrittenTask.length > 100
    ? rewrittenTask.substring(0, 97) + '...'
    : rewrittenTask;
  
  // Format card description with meeting context
  const description = formatCardDescription(actionItem);
  
  // Build request parameters
  const params = {
    key: config.TRELLO_API_KEY,
    token: config.TRELLO_TOKEN,
    idList: config.TRELLO_LIST_ID,
    name: cardName,
    desc: description,
    pos: 'top'
  };
  
  // Add due date if extracted
  if (actionItem.dueDate) {
    params.due = actionItem.dueDate.toISOString();
  }
  
  // Make API request
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(params),
    muteHttpExceptions: true
  });
  
  const responseCode = response.getResponseCode();
  
  if (responseCode === 429) {
    // Rate limited - wait and retry once
    Logger.log('Rate limited by Trello API, waiting 10 seconds...');
    Utilities.sleep(10000);
    const retryResponse = UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(params),
      muteHttpExceptions: true
    });
    if (retryResponse.getResponseCode() !== 200) {
      throw new Error(`Trello API error after retry: ${retryResponse.getContentText()}`);
    }
  } else if (responseCode !== 200) {
    throw new Error(`Trello API error (${responseCode}): ${response.getContentText()}`);
  }
  
  Logger.log(`Created card: ${cardName}`);
}

/**
 * Formats the card description with meeting context.
 * 
 * @param {Object} actionItem - Action item object
 * @returns {string} Formatted description
 */
function formatCardDescription(actionItem) {
  const lines = [
    `**Meeting:** ${actionItem.meetingTitle}`,
    `**Date:** ${formatDate(actionItem.meetingDate)}`,
    '',
    '---',
    '',
    `**Source Document:** ${actionItem.documentUrl}`,
    '',
    '---',
    '',
    '*Auto-generated from Gemini Notes*'
  ];
  
  return lines.join('\n');
}

/**
 * Checks if a similar card already exists in Trello.
 * 
 * @param {Object} actionItem - Action item to check
 * @param {Object} config - Configuration object
 * @returns {boolean} True if duplicate exists
 */
function isDuplicateCard(actionItem, config) {
  const url = `https://api.trello.com/1/lists/${config.TRELLO_LIST_ID}/cards`;
  
  try {
    const response = UrlFetchApp.fetch(url + `?key=${config.TRELLO_API_KEY}&token=${config.TRELLO_TOKEN}`, {
      method: 'GET',
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      // If we can't check, assume no duplicate to avoid blocking
      return false;
    }
    
    const cards = JSON.parse(response.getContentText());
    const taskNormalized = actionItem.task.toLowerCase().substring(0, 50);
    
    return cards.some(card => {
      const cardName = card.name.toLowerCase();
      return cardName.includes(taskNormalized) || taskNormalized.includes(cardName.substring(0, 50));
    });
    
  } catch (error) {
    Logger.log(`Error checking for duplicates: ${error.message}`);
    return false;
  }
}

// ============================================================================
// TRACKING & PERSISTENCE
// ============================================================================

/**
 * Gets the set of already processed document IDs.
 * 
 * @returns {Set<string>} Set of processed document IDs
 */
function getProcessedDocumentIds() {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('PROCESSED_DOC_IDS');
  
  if (!stored) {
    return new Set();
  }
  
  try {
    const ids = JSON.parse(stored);
    
    // Clean up old entries (keep last 500)
    if (ids.length > 500) {
      ids.splice(0, ids.length - 500);
      props.setProperty('PROCESSED_DOC_IDS', JSON.stringify(ids));
    }
    
    return new Set(ids);
  } catch (e) {
    return new Set();
  }
}

/**
 * Marks a document as processed.
 * 
 * @param {string} docId - Document ID to mark as processed
 */
function markDocumentAsProcessed(docId) {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty('PROCESSED_DOC_IDS');
  
  let ids = [];
  try {
    ids = stored ? JSON.parse(stored) : [];
  } catch (e) {
    ids = [];
  }
  
  ids.push(docId);
  props.setProperty('PROCESSED_DOC_IDS', JSON.stringify(ids));
}

/**
 * Clears the processed documents history.
 * Run this manually if you need to reprocess documents.
 */
function clearProcessedHistory() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_DOC_IDS');
  Logger.log('Processed document history cleared');
}

// ============================================================================
// ERROR HANDLING & NOTIFICATIONS
// ============================================================================

/**
 * Validates the configuration and logs any issues.
 * 
 * @param {Object} config - Configuration object
 * @returns {boolean} True if configuration is valid
 */
function validateConfig(config) {
  const required = ['TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_BOARD_ID', 'TRELLO_LIST_ID'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    Logger.log(`Missing required configuration: ${missing.join(', ')}`);
    Logger.log('Run setupConfiguration() to configure the script');
    return false;
  }
  
  return true;
}

/**
 * Sends email notification for critical errors.
 * 
 * @param {string[]} errors - Array of error messages
 * @param {string} email - Email address to notify
 */
function sendErrorNotification(errors, email) {
  if (!email) {
    Logger.log('No notification email configured');
    return;
  }
  
  const subject = '⚠️ Gemini Notes to Trello - Errors Detected';
  const body = [
    'The Gemini Notes to Trello script encountered errors:',
    '',
    errors.map((e, i) => `${i + 1}. ${e}`).join('\n\n'),
    '',
    '---',
    `Timestamp: ${new Date().toISOString()}`,
    'Check the Apps Script execution logs for more details.'
  ].join('\n');
  
  try {
    MailApp.sendEmail(email, subject, body);
    Logger.log(`Error notification sent to ${email}`);
  } catch (mailError) {
    Logger.log(`Failed to send notification: ${mailError.message}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

// ============================================================================
// SETUP & CONFIGURATION HELPERS
// ============================================================================

/**
 * Interactive setup function - run this first to configure the script.
 * Opens a dialog to guide through configuration.
 */
function setupConfiguration() {
  const ui = SpreadsheetApp.getUi ? SpreadsheetApp.getUi() : null;
  const props = PropertiesService.getScriptProperties();
  
  // Log instructions since we might not have a UI
  Logger.log('=== Gemini Notes to Trello Setup ===');
  Logger.log('');
  Logger.log('To configure the script, set the following Script Properties:');
  Logger.log('(Go to Project Settings > Script Properties)');
  Logger.log('');
  Logger.log('Required:');
  Logger.log('  TRELLO_API_KEY    - Your Trello API key');
  Logger.log('  TRELLO_TOKEN      - Your Trello auth token');
  Logger.log('  TRELLO_BOARD_ID   - Target board ID');
  Logger.log('  TRELLO_LIST_ID    - Target list ID');
  Logger.log('');
  Logger.log('Optional:');
  Logger.log('  NAME_PATTERN      - Name to match (default: "Filipe")');
  Logger.log('  NOTIFICATION_EMAIL - Email for error alerts');
  Logger.log('  LOOKBACK_HOURS    - Hours to look back (default: 2)');
  Logger.log('');
  Logger.log('Run showCurrentConfig() to see current settings');
}

/**
 * Shows the current configuration (without exposing sensitive values).
 */
function showCurrentConfig() {
  const config = getConfig();
  
  Logger.log('=== Current Configuration ===');
  Logger.log(`TRELLO_API_KEY: ${config.TRELLO_API_KEY ? '✓ Set' : '✗ Not set'}`);
  Logger.log(`TRELLO_TOKEN: ${config.TRELLO_TOKEN ? '✓ Set' : '✗ Not set'}`);
  Logger.log(`TRELLO_BOARD_ID: ${config.TRELLO_BOARD_ID || '✗ Not set'}`);
  Logger.log(`TRELLO_LIST_ID: ${config.TRELLO_LIST_ID || '✗ Not set'}`);
  Logger.log(`NAME_PATTERN: ${config.NAME_PATTERN}`);
  Logger.log(`NOTIFICATION_EMAIL: ${config.NOTIFICATION_EMAIL}`);
  Logger.log(`LOOKBACK_HOURS: ${config.LOOKBACK_HOURS}`);
}

/**
 * Helper to set a single configuration value.
 * 
 * @param {string} key - Property key
 * @param {string} value - Property value
 */
function setConfigValue(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
  Logger.log(`Set ${key} successfully`);
}

/**
 * Quick setup for Trello credentials.
 * Replace the placeholder values and run this function.
 */
function quickSetupTrello() {
  const props = PropertiesService.getScriptProperties();
  
  // ⚠️ REPLACE THESE VALUES before running
  props.setProperty('TRELLO_API_KEY', 'YOUR_API_KEY_HERE');
  props.setProperty('TRELLO_TOKEN', 'YOUR_TOKEN_HERE');
  props.setProperty('TRELLO_BOARD_ID', 'YOUR_BOARD_ID_HERE');
  props.setProperty('TRELLO_LIST_ID', 'YOUR_LIST_ID_HERE');
  
  // Optional: customize name pattern
  props.setProperty('NAME_PATTERN', 'Filipe');
  
  Logger.log('Configuration saved. Run showCurrentConfig() to verify.');
}

/**
 * Creates the time-based trigger to run hourly.
 */
function createHourlyTrigger() {
  // Remove existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'processGeminiNotes') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  
  // Create new hourly trigger
  ScriptApp.newTrigger('processGeminiNotes')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('Hourly trigger created successfully');
}

/**
 * Removes the scheduled trigger.
 */
function removeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'processGeminiNotes') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  }
  
  Logger.log(`Removed ${removed} trigger(s)`);
}

/**
 * Test function - processes documents without creating cards.
 * Useful for testing the document detection and parsing.
 */
function testDocumentDetection() {
  const config = getConfig();
  
  Logger.log('=== Test Mode: Document Detection ===');
  Logger.log(`Looking for documents in last ${config.LOOKBACK_HOURS} hours...`);
  Logger.log(`Searching for action items for: ${config.NAME_PATTERN}`);
  Logger.log('');
  
  // Temporarily extend lookback for testing
  const testLookback = 168; // 1 week
  const geminiDocs = findGeminiNotesDocs(testLookback);
  
  Logger.log(`Found ${geminiDocs.length} Gemini Notes document(s):`);
  
  for (const doc of geminiDocs) {
    Logger.log(`\n--- ${doc.getName()} ---`);
    Logger.log(`Created: ${doc.getDateCreated()}`);
    Logger.log(`URL: ${doc.getUrl()}`);

    try {
      const text = getDocumentText(doc.getId());
      const meetingInfo = extractMeetingInfo(doc, text);
      const actionItems = extractActionItems(text, config.NAME_PATTERN, meetingInfo);

      Logger.log(`Meeting: ${meetingInfo.title}`);
      Logger.log(`Action items found: ${actionItems.length}`);

      for (const item of actionItems) {
        Logger.log(`  - ${item.task}`);
        if (item.dueDate) {
          Logger.log(`    Due: ${formatDate(item.dueDate)}`);
        }
      }
    } catch (e) {
      Logger.log(`Error processing: ${e.message}`);
    }
  }
}

/**
 * Test function - tries to create a test card in Trello.
 * Useful for verifying Trello integration.
 */
function testTrelloConnection() {
  const config = getConfig();
  
  if (!validateConfig(config)) {
    Logger.log('Configuration invalid - cannot test Trello connection');
    return;
  }
  
  Logger.log('Testing Trello connection...');
  
  // Test API by fetching board info
  const url = `https://api.trello.com/1/boards/${config.TRELLO_BOARD_ID}?key=${config.TRELLO_API_KEY}&token=${config.TRELLO_TOKEN}`;
  
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (response.getResponseCode() === 200) {
      const board = JSON.parse(response.getContentText());
      Logger.log(`✓ Successfully connected to board: ${board.name}`);
      
      // Test list access
      const listUrl = `https://api.trello.com/1/lists/${config.TRELLO_LIST_ID}?key=${config.TRELLO_API_KEY}&token=${config.TRELLO_TOKEN}`;
      const listResponse = UrlFetchApp.fetch(listUrl, { muteHttpExceptions: true });
      
      if (listResponse.getResponseCode() === 200) {
        const list = JSON.parse(listResponse.getContentText());
        Logger.log(`✓ Successfully connected to list: ${list.name}`);
      } else {
        Logger.log(`✗ Cannot access list: ${listResponse.getContentText()}`);
      }
    } else {
      Logger.log(`✗ Cannot access board: ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`✗ Connection error: ${error.message}`);
  }
}

/**
 * Test function - verifies Gemini API connection and action item rewriting.
 */
function testGeminiConnection() {
  const config = getConfig();

  Logger.log('=== Testing Gemini API Connection ===');

  if (!config.GEMINI_API_KEY) {
    Logger.log('GEMINI_API_KEY not configured in Script Properties');
    Logger.log('Get an API key from: https://aistudio.google.com/apikey');
    return;
  }

  Logger.log('API key found, testing connection...');

  const testTasks = [
    'Filipe Miranda Pereira vai enviar o relatório até sexta-feira',
    'Filipe Miranda Pereira deve agendar a reunião com o cliente',
    'Filipe Miranda Pereira e Oberdan Santos irão revisar o código do projeto',
    'Filipe Miranda Pereira, Maria e Pedro vão definir os responsáveis pelas tarefas'
  ];

  for (const task of testTasks) {
    Logger.log(`\nOriginal: "${task}"`);
    const rewritten = rewriteActionItemWithGemini(task, config.GEMINI_API_KEY);
    Logger.log(`Rewritten: "${rewritten}"`);
  }

  Logger.log('\n=== Gemini API test complete ===');
}
