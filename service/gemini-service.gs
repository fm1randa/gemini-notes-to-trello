/**
 * Gemini Service module for Gemini Notes to Trello
 *
 * Handles integration with Google's Gemini API for rewriting
 * action items in imperative mood.
 */

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

  const prompt = `Reescreva o seguinte item de acao no modo imperativo em portugues brasileiro.
Mantenha conciso e acionavel. Retorne APENAS o texto reescrito, nada mais.
Nao adicione aspas ou qualquer outra formatacao.

Regras importantes:
- Se houver outras pessoas mencionadas alem de mim, mantenha a referencia a elas (ex: "com o Fulano" ou "junto com Fulano")
- Remova meu nome do inicio, mas mantenha o contexto de colaboracao
- Sempre responda em portugues brasileiro

Exemplos:
- "Filipe vai enviar o relatorio" -> "Enviar o relatorio"
- "Filipe e Joao vao revisar o codigo" -> "Revisar o codigo com o Joao"
- "Filipe, Maria e Pedro irao agendar a reuniao" -> "Agendar a reuniao com Maria e Pedro"

Item de acao: "${task}"`;

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

    const responseCode = response.getResponseCode();

    if (responseCode === 429) {
      // Rate limited - extract retry delay from response
      const errorData = JSON.parse(response.getContentText());
      const retryDelay = errorData.error?.details?.find(
        detail => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
      )?.retryDelay;

      // Parse delay (format: "39s") or default to 10 seconds
      const waitSeconds = retryDelay
        ? parseInt(retryDelay.replace('s', ''))
        : 10;

      Logger.log(`Rate limited by Gemini API, waiting ${waitSeconds} seconds...`);
      Utilities.sleep(waitSeconds * 1000);

      const retryResponse = UrlFetchApp.fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (retryResponse.getResponseCode() !== 200) {
        Logger.log(`Gemini API error after retry: ${retryResponse.getContentText()}`);
        return task;
      }

      const retryResult = JSON.parse(retryResponse.getContentText());
      const rewrittenTask = retryResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (rewrittenTask) {
        Logger.log(`Rewritten: "${task}" -> "${rewrittenTask}"`);
        return rewrittenTask;
      }

      return task;
    } else if (responseCode !== 200) {
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
