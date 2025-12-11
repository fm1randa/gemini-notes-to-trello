/**
 * Notes Finder module for Gemini Notes to Trello
 *
 * Handles detection and discovery of Gemini Notes documents
 * in Google Drive.
 */

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
  // Gemini Notes are Google Docs that end with " - Anotacoes do Gemini"
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

  // Check if document name ends with " - Anotacoes do Gemini"
  const geminiPattern = /\s*-\s*Anotações do Gemini$/i;

  // The naming pattern alone is sufficient to identify Gemini Notes
  // since this is a unique pattern used only by Google Meet
  return geminiPattern.test(name);
}
