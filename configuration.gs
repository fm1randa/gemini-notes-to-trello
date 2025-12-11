/**
 * Configuration module for Gemini Notes to Trello
 *
 * Handles loading, validation, and setup of script configuration
 * stored in Google Apps Script Properties.
 */

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
 * Interactive setup function - run this first to configure the script.
 * Opens a dialog to guide through configuration.
 */
function setupConfiguration() {
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

  // Replace these values before running
  props.setProperty('TRELLO_API_KEY', 'YOUR_API_KEY_HERE');
  props.setProperty('TRELLO_TOKEN', 'YOUR_TOKEN_HERE');
  props.setProperty('TRELLO_BOARD_ID', 'YOUR_BOARD_ID_HERE');
  props.setProperty('TRELLO_LIST_ID', 'YOUR_LIST_ID_HERE');

  // Optional: customize name pattern
  props.setProperty('NAME_PATTERN', 'Filipe');

  Logger.log('Configuration saved. Run showCurrentConfig() to verify.');
}
