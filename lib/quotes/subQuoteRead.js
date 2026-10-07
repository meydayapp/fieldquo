// lib/quotes/subQuoteRead.js
//
// The two model calls behind "Upload a sub's quote" — through lib/ai/
// provider.js's complete(), the only door to a model vendor. Shaped exactly
// like lib/receipts/extract.js extractReceipt: no database, no quota here;
// the route meters (meterFor before, record after) and decides what to say.
//
// See lib/quotes/subQuoteUpload.js for why every figure comes back as a
// printed string and nothing returned here is ever used unconfirmed.
import { complete, isAiConfigured } from "@/lib/ai/provider";
import {
  SUB_QUOTE_SCHEMA,
  SUB_QUOTE_SYSTEM,
  SUB_QUOTE_LINES_SCHEMA,
  SUB_QUOTE_LINES_SYSTEM,
  normaliseSubQuoteReading,
  normaliseSubQuoteLines,
} from "@/lib/quotes/subQuoteUpload";

/** Photos of one quote read in one call — a receipt's cap, for the same reason. */
export const MAX_SUB_QUOTE_PHOTOS = 4;

function inputs({ imageUrls, pdf }) {
  const images = (Array.isArray(imageUrls) ? imageUrls : []).filter(Boolean).slice(0, MAX_SUB_QUOTE_PHOTOS);
  const files = pdf?.base64 ? [{ filename: pdf.filename, mimeType: "application/pdf", base64: pdf.base64 }] : [];
  return { images, files };
}

/**
 * The simple read: sub, trade, total, tax, valid-until. Standard model —
 * transcription, not judgement (the receipt reader's reasoning).
 *
 * @returns {{ ok: true, data }} or {{ ok: false, reason, message }}
 */
export async function readSubQuote({ imageUrls, pdf, onUsage } = {}) {
  if (!isAiConfigured()) return { ok: false, reason: "unconfigured", message: "AI is not configured on this deployment." };
  const { images, files } = inputs({ imageUrls, pdf });
  if (!images.length && !files.length) return { ok: false, reason: "no_image", message: "No file was given." };
  const result = await complete({
    system: SUB_QUOTE_SYSTEM,
    prompt: "Transcribe this subcontractor's quote into the schema. Copy what is printed; calculate nothing.",
    images,
    maxImages: MAX_SUB_QUOTE_PHOTOS,
    files,
    imageDetail: "high",
    maxTokens: 3000,
    schema: SUB_QUOTE_SCHEMA,
    schemaName: "sub_quote_reading",
    onUsage,
  });
  if (!result.ok) return result;
  return { ok: true, data: normaliseSubQuoteReading(result.data) };
}

/**
 * The deep read: every priced line. The best tier — a dense multi-page
 * quote is where the standard model drops lines — and a larger answer.
 */
export async function readSubQuoteLines({ imageUrls, pdf, onUsage } = {}) {
  if (!isAiConfigured()) return { ok: false, reason: "unconfigured", message: "AI is not configured on this deployment." };
  const { images, files } = inputs({ imageUrls, pdf });
  if (!images.length && !files.length) return { ok: false, reason: "no_image", message: "No file was given." };
  const result = await complete({
    system: SUB_QUOTE_LINES_SYSTEM,
    prompt: "Transcribe every priced line of this quote into the schema. Copy what is printed; calculate nothing.",
    images,
    maxImages: MAX_SUB_QUOTE_PHOTOS,
    files,
    tier: "best",
    imageDetail: "high",
    maxTokens: 12000,
    schema: SUB_QUOTE_LINES_SCHEMA,
    schemaName: "sub_quote_lines",
    onUsage,
  });
  if (!result.ok) return result;
  return { ok: true, data: normaliseSubQuoteLines(result.data) };
}
