/**
 * Server-side proxy for Gemini AI calls.
 *
 * The API key must never reach the client: Vite inlines any VITE_-prefixed
 * env var into the shipped JS bundle in plain text, so a key handed to the
 * frontend is trivially extractable from the APK and can be used to run up
 * billing on this project's Gemini quota. Every request the app makes to
 * Gemini goes through here instead, gated by our own authenticateToken.
 */

const MODELS_TO_TRY = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

function getApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function cleanJsonText(rawText) {
  if (!rawText) return null;
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.warn('Failed to parse Gemini JSON response:', cleaned.slice(0, 200));
    return null;
  }
}

async function callGemini(apiKey, model, parts) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini ${model} responded with HTTP ${response.status}`);
  }

  const json = await response.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text;
}

/** OCR a receipt/invoice image. Returns null if no key is configured or every model fails. */
async function parseInvoiceImage(base64Data, mimeType = 'image/jpeg') {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not configured on the server — invoice OCR is disabled.');
    return null;
  }

  const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const promptText = `Analyze this bill/receipt/invoice image carefully. Extract and return a single valid JSON object ONLY with the following exact keys:
- vendorName (string): Vendor or store or business name
- invoiceNumber (string): Invoice or bill number
- totalAmount (number): Total monetary amount
- gstAmount (number): GST or tax amount (0 if not specified)
- category (string): Must be one of ['INVOICE', 'SUPPLIES', 'LOGISTICS', 'DINING', 'UTILITIES', 'GENERAL']
- type (string): Must be 'GAVE' if this is an expense/payable, or 'GOT' if income/receivable.

Do NOT include any markdown code blocks, backticks, or explanatory text. Return ONLY JSON.`;

  for (const model of MODELS_TO_TRY) {
    try {
      const text = await callGemini(apiKey, model, [
        { text: promptText },
        { inline_data: { mime_type: mimeType, data: rawBase64 } }
      ]);
      const parsed = cleanJsonText(text);
      if (parsed && (parsed.vendorName || parsed.totalAmount)) return parsed;
    } catch (err) {
      console.warn(`Gemini Vision model ${model} failed:`, err.message);
    }
  }

  return null;
}

/** Parse a spoken/typed transaction description into structured fields. */
async function parseNaturalLanguagePrompt(spokenText, existingPartyNames = []) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not configured on the server — NLP parsing is disabled.');
    return null;
  }

  const partyListString = existingPartyNames.join(', ');
  const promptText = `Analyze this spoken financial transaction prompt: "${spokenText}".
Known party list in user database: [${partyListString}]

Extract and return a single valid JSON object ONLY with the following exact keys:
- amount (number): Numerical amount mentioned in rupees/currency
- partyName (string): The customer, supplier, or party mentioned. Match to known party list if applicable, or extract name.
- type (string): 'GAVE' (for expense, payment sent, debit) or 'GOT' (for income, payment received, credit). Default to 'GAVE' if paid/given.
- paymentMode (string): One of ['CASH', 'UPI', 'CARD', 'Bank', 'Cheque']. Default to 'UPI' if not specified.
- category (string): One of ['DINING', 'SUPPLIES', 'LOGISTICS', 'UTILITIES', 'SALARY', 'GENERAL'].
- notes (string): Clean concise description of the transaction.

Do NOT include any markdown code blocks, backticks, or explanatory text. Return ONLY JSON.`;

  for (const model of MODELS_TO_TRY) {
    try {
      const text = await callGemini(apiKey, model, [{ text: promptText }]);
      const parsed = cleanJsonText(text);
      if (parsed && (parsed.amount || parsed.partyName)) return parsed;
    } catch (err) {
      console.warn(`Gemini Text model ${model} failed:`, err.message);
    }
  }

  return null;
}

/**
 * Transcribe a short voice note into plain text. Used as the fallback speech
 * path on platforms without the Web Speech API (notably the Android WebView
 * this app ships in) — the client records audio with MediaRecorder and hands
 * it here instead of running recognition on-device.
 */
async function transcribeAudio(base64Data, mimeType = 'audio/webm', languageCode = 'en-IN') {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not configured on the server — voice transcription is disabled.');
    return null;
  }

  const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const languageHint = languageCode.startsWith('hi') ? 'Hindi or Hinglish (Hindi written in Latin script)' : 'English';
  const promptText = `Transcribe this short voice recording of a financial transaction. The speaker is most likely using ${languageHint}. Return ONLY the plain transcript text, verbatim, with no translation, no markdown, no quotes, and no extra commentary. If the recording contains no discernible speech, return an empty string.`;

  for (const model of MODELS_TO_TRY) {
    try {
      const text = await callGemini(apiKey, model, [
        { text: promptText },
        { inline_data: { mime_type: mimeType, data: rawBase64 } }
      ]);
      const transcript = (text || '').trim();
      if (transcript) return transcript;
    } catch (err) {
      console.warn(`Gemini Audio model ${model} failed:`, err.message);
    }
  }

  return null;
}

module.exports = {
  isConfigured: () => !!getApiKey(),
  parseInvoiceImage,
  parseNaturalLanguagePrompt,
  transcribeAudio
};
