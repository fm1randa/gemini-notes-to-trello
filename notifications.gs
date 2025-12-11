/**
 * Notifications module for Gemini Notes to Trello
 *
 * Handles email notifications for errors and alerts.
 */

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

  const subject = 'Gemini Notes to Trello - Errors Detected';
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
