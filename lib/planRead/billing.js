// lib/planRead/billing.js
//
// What a drawing read costs the company, before and after — from its AI
// credit (the "ai" wallet, lib/voice/credits.js), at the pay-as-you-go rule
// every wallet-paid AI feature uses: vendor cost × PAY_AS_YOU_GO_MULTIPLIER
// (lib/ai/imageEconomics.js chatChargeCents).
//
// ══ Shown, held, settled ═══════════════════════════════════════════════════
//
// A read's cost depends on the set — 4 sheets or 40, scanned or vector, a
// spreadsheet or not — so it is not a flat price like the photo deep read's
// 25¢. Instead:
//
//   1. BEFORE: estimateRead() states a ceiling from the actual counts, and the
//      screen shows it in credits before the button is pressed.
//   2. START: that ceiling is HELD — debited under one ref — the photo deep
//      read's "reserve first, vendor second" (lib/voice/spendGate.js).
//   3. END: the read is charged what its calls actually cost, never more than
//      was held, and the difference goes back under the reservation's refund
//      ref. A read that fails is refunded in full, exactly as the photo deep
//      read refunds a read that didn't happen.
//
// The estimate is deliberately a ceiling (HEADROOM on top of the expected
// tokens): "up to 180 credits, you're charged what it uses" is a promise that
// can be kept; an average that is exceeded half the time is not.
//
// ══ Token assumptions — measure, then edit here ════════════════════════════
//
// Image tokens are lib/ai/imageEconomics.js photoTokens() at "high" (2,500
// patches × the family multiplier); MINI_IMAGE_MULTIPLIER is the mini
// models' larger multiplier. Text tokens are characters ÷ 4. Every real call
// is recorded on PlanRead.usage (prompt, cached, completion tokens per step)
// and as an AiUsage row, so these constants can be checked against what the
// vendor actually counted and corrected in one place.

import { estimateCostMicros } from "@/lib/ai/usage";
import { chatChargeCents } from "@/lib/ai/imageEconomics";
import { AI_MODEL, AI_BEST_MODEL } from "@/lib/ai/provider";

export const IMAGES_PER_SHEET = 5;
const HIGH_PATCHES = 2500;
const MINI_IMAGE_MULTIPLIER = 1.62;
const BEST_IMAGE_MULTIPLIER = 1.2;
export const MAX_PHOTOS = 10;
export const HEADROOM = 1.25;

/** Models per step, by tier name so the vendor can change in provider.js. */
export const READ_MODELS = Object.freeze({
  sheet: AI_MODEL,
  photos: AI_BEST_MODEL,
  synthesis: AI_BEST_MODEL,
});

/** Expected tokens per call. See the header. */
export const READ_TOKENS = Object.freeze({
  sheet: Object.freeze({
    image: Math.ceil(HIGH_PATCHES * MINI_IMAGE_MULTIPLIER) * IMAGES_PER_SHEET,
    text: 5_800,
    completion: 3_000,
  }),
  photos: Object.freeze({
    perPhoto: Math.ceil(HIGH_PATCHES * BEST_IMAGE_MULTIPLIER),
    text: 1_800,
    completion: 6_000,
  }),
  synthesis: Object.freeze({
    base: 7_000,
    perSheet: 600,
    perPhoto: 150,
    perExcelChar: 0.25,
    maxExcelChars: 12_000,
    completion: 14_000,
  }),
});

/**
 * The ceiling, in cents (= credits), for a read of this set. Pure.
 *
 * @param {{ sheets: number, photos: number, excelChars: number,
 *           sheetsAlreadyRead?: number }} counts — sheets already read are
 *   not read again (a retry after a failure only pays for what is left).
 */
export function estimateRead({ sheets = 0, photos = 0, excelChars = 0, sheetsAlreadyRead = 0, photosAlreadyRead = false } = {}) {
  const toRead = Math.max(0, sheets - sheetsAlreadyRead);
  const usePhotos = Math.min(MAX_PHOTOS, Math.max(0, photos));
  const t = READ_TOKENS;
  const sheetMicros =
    toRead *
    estimateCostMicros({ model: READ_MODELS.sheet, promptTokens: t.sheet.image + t.sheet.text, completionTokens: t.sheet.completion });
  const photoMicros =
    usePhotos && !photosAlreadyRead
      ? estimateCostMicros({
          model: READ_MODELS.photos,
          promptTokens: usePhotos * t.photos.perPhoto + t.photos.text,
          completionTokens: t.photos.completion,
        })
      : 0;
  const synthPrompt =
    t.synthesis.base +
    sheets * t.synthesis.perSheet +
    usePhotos * t.synthesis.perPhoto +
    Math.min(t.synthesis.maxExcelChars, Math.max(0, excelChars)) * t.synthesis.perExcelChar;
  const synthMicros = estimateCostMicros({ model: READ_MODELS.synthesis, promptTokens: Math.ceil(synthPrompt), completionTokens: t.synthesis.completion });
  const vendorMicros = sheetMicros + photoMicros + synthMicros;
  return {
    cents: Math.max(1, Math.ceil(chatChargeCents(vendorMicros) * HEADROOM)),
    expectedCents: Math.max(1, chatChargeCents(vendorMicros)),
    vendorMicros,
    breakdown: { sheetMicros, photoMicros, synthMicros, sheetsToRead: toRead, photos: usePhotos },
  };
}

/** One call's usage folded into the read's running totals. Pure. */
export function addUsage(total, usage, step) {
  const t = total && typeof total === "object" ? JSON.parse(JSON.stringify(total)) : {};
  const u = usage || {};
  const micros = estimateCostMicros({
    model: u.model,
    promptTokens: Number(u.promptTokens) || 0,
    completionTokens: Number(u.completionTokens) || 0,
    cachedTokens: Number(u.cachedTokens) || 0,
  });
  const bump = (o) => {
    o.promptTokens = (o.promptTokens || 0) + (Number(u.promptTokens) || 0);
    o.cachedTokens = (o.cachedTokens || 0) + (Number(u.cachedTokens) || 0);
    o.completionTokens = (o.completionTokens || 0) + (Number(u.completionTokens) || 0);
    o.images = (o.images || 0) + (Number(u.imageCount) || 0);
    o.calls = (o.calls || 0) + 1;
    o.vendorMicros = (o.vendorMicros || 0) + micros;
  };
  bump(t);
  t.byStep = t.byStep || {};
  t.byStep[step] = t.byStep[step] || {};
  bump(t.byStep[step]);
  // This RUN's spend — what settlement charges. Reset when a run starts.
  t.run = t.run || {};
  bump(t.run);
  return t;
}

/** What a finished run is charged: actual × multiplier, never above the hold. Pure. */
export function settlement({ reservedCents, runVendorMicros }) {
  const held = Math.max(0, Math.round(Number(reservedCents) || 0));
  const actual = chatChargeCents(Math.max(0, Number(runVendorMicros) || 0));
  const charged = Math.min(held, actual);
  return { chargedCents: charged, refundCents: held - charged, actualCents: actual };
}
