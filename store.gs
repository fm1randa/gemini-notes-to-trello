/**
 * Store module for Gemini Notes to Trello
 *
 * Handles persistence of processed document IDs to avoid
 * reprocessing the same documents.
 */

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
