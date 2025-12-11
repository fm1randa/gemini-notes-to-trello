/**
 * Test module for document detection and parsing
 *
 * Tests the Gemini Notes detection in Drive and action item extraction.
 */

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
