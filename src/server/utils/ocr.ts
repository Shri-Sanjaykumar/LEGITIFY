// ==============================================================================
// MULTI-TIER OCR EXTRACTION UTILITY
// ==============================================================================
import { GoogleGenAI } from '@google/genai';
import { createWorker } from 'tesseract.js';

let tesseractWorker: any = null;

async function getWorker() {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker('eng');
  }
  return tesseractWorker;
}

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const isPdf = mimeType === 'application/pdf' || (buffer.length > 4 && buffer.toString('utf-8', 0, 4) === '%PDF');

  // Tier 1: Local Tesseract.js WASM OCR (For image formats: PNG, JPEG, WEBP, BMP)
  if (!isPdf) {
    try {
      const worker = await getWorker();
      const ret = await worker.recognize(buffer);
      if (ret.data?.text && ret.data.text.trim().length > 10) {
        console.log(`[OCR] Tesseract extracted ${ret.data.text.length} characters successfully.`);
        return ret.data.text.trim();
      }
    } catch (err) {
      console.warn('[OCR] Local Tesseract attempt failed, trying fallback...', err);
    }
  }

  // Tier 2: Gemini 1.5 Flash Vision (Supports Images & PDFs natively)
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (apiKey && !apiKey.includes('your-')) {
    try {
      const client = new GoogleGenAI({ apiKey });
      const base64Data = buffer.toString('base64');
      const normalizedMime = isPdf ? 'application/pdf' : (mimeType === 'image/jpg' ? 'image/jpeg' : mimeType);

      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime || 'image/jpeg',
                  data: base64Data,
                },
              },
              {
                text: "Extract and transcribe ALL visible text, conversation messages, company names, disclaimers, warnings, URLs, and recruiter claims in this image verbatim. Do not summarize.",
              },
            ],
          },
        ],
      });

      const extracted = response.text?.trim() || '';
      if (extracted.length > 5) {
        return extracted;
      }
    } catch (err) {
      console.warn('[OCR] Gemini vision fallback error:', err);
    }
  }

  // Tier 3: Printable string scanner fallback
  const rawStr = buffer.toString('utf-8');
  const printable = rawStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return printable.length > 20 ? printable : "";
}
