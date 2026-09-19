/**
 * AI Assist client for Khata Ledger — receipt OCR and natural-language entry
 * parsing.
 *
 * The actual Gemini calls happen on the backend (see backend/src/services/
 * aiService.js): the API key must never be shipped inside the app bundle,
 * where it would be trivially extractable from the APK. This module only
 * prepares the request (e.g. File -> base64) and calls our own API.
 */
import { apiClient } from './apiClient';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:<mime>;base64,<...>
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * OCR a receipt/invoice. Accepts either a File/Blob (from the camera or file
 * picker) or an already-encoded base64/data-URL string.
 * Returns the parsed fields, or null if AI assist is unavailable — callers
 * are expected to fall back to manual entry in that case.
 */
export async function parseInvoiceImage(fileOrBase64, mimeType) {
  try {
    let base64Data = fileOrBase64;
    let resolvedMimeType = mimeType;

    if (fileOrBase64 instanceof Blob) {
      base64Data = await fileToBase64(fileOrBase64);
      resolvedMimeType = fileOrBase64.type || 'image/jpeg';
    }

    const res = await apiClient.parseInvoiceImage(base64Data, resolvedMimeType || 'image/jpeg');
    return res.data || null;
  } catch (err) {
    console.warn('Invoice OCR unavailable, falling back to manual entry:', err.message);
    return null;
  }
}

/**
 * Parse a spoken/typed transaction description. Returns null if AI assist is
 * unavailable — callers fall back to the local rule-based parser in that case.
 */
export async function parseNaturalLanguagePrompt(spokenText, existingParties = []) {
  try {
    const partyNames = existingParties.map((p) => p.name).filter(Boolean);
    const res = await apiClient.parseNaturalLanguagePrompt(spokenText, partyNames);
    return res.data || null;
  } catch (err) {
    console.warn('AI text parsing unavailable, falling back to local NLP parser:', err.message);
    return null;
  }
}

/**
 * Transcribe a recorded voice note via Gemini. This is the fallback speech
 * path for platforms without the Web Speech API (the Android WebView this
 * app ships in has no SpeechRecognition global at all).
 * Returns the transcript string, or null if AI assist is unavailable/failed —
 * callers must surface that as an explicit error to the user rather than
 * silently doing nothing.
 */
export async function transcribeAudio(audioBlob, languageCode = 'en-IN') {
  const base64Data = await fileToBase64(audioBlob);
  const res = await apiClient.transcribeAudio(base64Data, audioBlob.type || 'audio/webm', languageCode);
  return res.data?.transcript || '';
}
