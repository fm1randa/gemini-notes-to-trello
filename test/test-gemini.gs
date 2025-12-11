/**
 * Test module for Gemini API integration
 *
 * Tests the connection to Gemini API and action item rewriting functionality.
 */

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
    'Filipe Miranda Pereira vai enviar o relatorio ate sexta-feira',
    'Filipe Miranda Pereira deve agendar a reuniao com o cliente',
    'Filipe Miranda Pereira e Oberdan Santos irao revisar o codigo do projeto',
    'Filipe Miranda Pereira, Maria e Pedro vao definir os responsaveis pelas tarefas'
  ];

  for (const task of testTasks) {
    Logger.log(`\nOriginal: "${task}"`);
    const rewritten = rewriteActionItemWithGemini(task, config.GEMINI_API_KEY);
    Logger.log(`Rewritten: "${rewritten}"`);
  }

  Logger.log('\n=== Gemini API test complete ===');
}
