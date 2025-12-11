/**
 * Test module for Trello API integration
 *
 * Tests the connection to Trello API and verifies board/list access.
 */

/**
 * Test function - tries to access Trello board and list.
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
      Logger.log(`Successfully connected to board: ${board.name}`);

      // Test list access
      const listUrl = `https://api.trello.com/1/lists/${config.TRELLO_LIST_ID}?key=${config.TRELLO_API_KEY}&token=${config.TRELLO_TOKEN}`;
      const listResponse = UrlFetchApp.fetch(listUrl, { muteHttpExceptions: true });

      if (listResponse.getResponseCode() === 200) {
        const list = JSON.parse(listResponse.getContentText());
        Logger.log(`Successfully connected to list: ${list.name}`);
      } else {
        Logger.log(`Cannot access list: ${listResponse.getContentText()}`);
      }
    } else {
      Logger.log(`Cannot access board: ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`Connection error: ${error.message}`);
  }
}
