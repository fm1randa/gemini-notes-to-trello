/**
 * Trello Service module for Gemini Notes to Trello
 *
 * Handles integration with Trello API for creating and
 * managing cards.
 */

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

  // Use the full rewritten task as card name
  const cardName = rewrittenTask;

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
