/**
 * Google Apps Script: Gemini Notes to Trello Action Items
 *
 * Automatically creates Trello cards from action items assigned to you
 * in Google Meet's Gemini Notes documents.
 *
 * @author Generated for Filipe
 * @version 1.0.0
 */

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
