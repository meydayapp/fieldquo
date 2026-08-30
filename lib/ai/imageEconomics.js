// lib/ai/imageEconomics.js
//
// What an AI image costs us, and what a company pays for it.
//
// ══ Why a file, and why it imports nothing ═════════════════════════════════
//
// The same reason lib/voice/credits.js states CENTS_PER_MINUTE with its cost
// basis written beside it: a price with no recorded reasoning is a price nobody
// can safely change. Six months from now the only way to know whether $0.25 is
// still right is to be able to read what it was 2x of.
//
// Pure, no imports, no database — so every figure below can be executed against
// hostile input by scripts/check-image-economics.mjs rather than reasoned about.
//
// ══ The cost basis ═════════════════════════════════════════════════════════
//
// From OpenAI's published rates (developers.openai.com/api/docs/pricing),
// read 2026-08-30. Prices drift; lib/ai/usage.js's own table carries the same
// warning and it is a fair one. Re-check before moving anything here.
//
//   gpt-5.6-sol     $4.00 / 1M input     $20.00 / 1M output
//   gpt-image-1    $10.00 / 1M image-in  $40.00 / 1M image-out
//
// ══ detail is a COST CEILING, not a quality preference ═════════════════════
//
// This is the single most important fact in this file, and it is not obvious
// from the parameter's name.
//
//   detail: "high"      capped at 2048x2048 and 2,500 patches. At the 1.2x
//                       token multiplier that is at most 3,000 tokens, so
//                       AT MOST $0.012 per photograph, whatever the camera.
//   detail: "original"  NO patch budget on this model. A 48MP phone photo
//                       measured 57,154 tokens — $0.229 for ONE image, 19x the
//                       capped price, and it scales with whichever phone the
//                       estimator happens to own.
//
// So the paid vision pass runs at "high". That is not a downgrade from
// "original": it is the difference between a feature with a knowable price and
// one where a contractor's bill depends on their handset. The free pass on the
// quote review stays at "low" (lib/ai/provider.js), which is flatter and
// cheaper still, and cannot resolve a hairline crack — which is precisely why
// there is something to sell here.

/** Per-1M-token rates, in dollars. The numbers every estimate below rests on. */
export const VENDOR_RATES = {
  visionInput: 4.0, // gpt-5.6-sol, standard tier
  visionOutput: 20.0,
  imageInput: 10.0, // gpt-image-1, image tokens in (a reference photo)
  imageOutput: 40.0, // ...and out (the generated picture)
};

/**
 * Tokens one photograph costs at a given detail, and what that is in dollars.
 *
 * 32x32 patches, ceil on each axis, times a 1.2 multiplier for the GPT-5.x
 * family. "high" clamps to 2,500 patches BEFORE the multiplier; "original" does
 * not clamp at all on this model, which is the whole point of the warning above.
 */
export function photoTokens(width, height, detail = "high") {
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));
  if (!w || !h) return 0;
  const patches = Math.ceil(w / 32) * Math.ceil(h / 32);
  const capped = detail === "original" ? patches : Math.min(patches, 2500);
  return Math.ceil(capped * 1.2);
}

/** Dollars for that photograph. */
export function photoCostDollars(width, height, detail = "high") {
  return (photoTokens(width, height, detail) * VENDOR_RATES.visionInput) / 1_000_000;
}

// ── What we charge ─────────────────────────────────────────────────────────
//
// Approved by the owner on 2026-08-30 at a stated ~50% gross margin on
// pay-as-you-go. Margin, not markup — the same way the voice side is reasoned
// about (35c/min against a ~16c cost is "a ~55% gross margin"), so a 50% margin
// means the price is 2x the cost.

/**
 * One paid vision pass over a quote: up to 8 photographs at detail "high",
 * plus the quote itself and the notes written back.
 *
 * Cost at the cap: 8 x $0.012 (photos) + ~$0.016 (the quote as text) + ~$0.024
 * (notes out) = ~$0.134. Priced flat at $0.25 rather than per photograph, on
 * purpose: a per-photo meter teaches an estimator to upload fewer photographs,
 * which is exactly backwards for a feature whose whole value is seeing more.
 * The margin therefore floats — ~46% on a quote with eight photos, ~65% on one
 * with four — and averages out above the target across real quotes.
 */
export const VISION_PASS_CENTS = 25;

/** The cap the flat price is calculated against. Charge the same, see no more. */
export const VISION_MAX_PHOTOS = 8;

/**
 * One generated marketing image, with or without a reference photograph.
 *
 * Cost ~$0.06 with a reference (a 1024x1024 medium generation at ~$0.042, plus
 * ~$0.018 for a reference resized to 1536x1152 before it is sent). Priced at 2x.
 *
 * ── One generation per creative, not one per aspect ratio ─────────────────
 *
 * A campaign wants the same advert as a square, a story and a landscape. The
 * expensive way is to generate three pictures; the right way is to generate one
 * and let the editor lay it out three times, which is what an editor is FOR.
 * Three generations of one idea also produce three DIFFERENT pictures, so the
 * costly path is the one that breaks the campaign.
 */
export const IMAGE_GENERATION_CENTS = 12;

// ── Bundles ────────────────────────────────────────────────────────────────
//
// A monthly allowance at ~30% margin instead of ~50%: a company that commits up
// front pays less per image than one that does not, which is the only honest
// reason to ask anyone to commit. One shared pool across vision AND generation,
// deliberately — a contractor who has paid for "AI" and is then told this
// particular AI needs a different wallet feels cheated, and is right to.
//
// Credits, not dollars, because the two features cost different amounts and a
// dollar balance would have to be re-explained every time either price moves.

/** 1 credit = 1 cent of pay-as-you-go value. Generation 12, vision 25. */
export const CREDITS_PER_CENT = 1;

/**
 * What one credit costs US, in dollars.
 *
 * A generation is 12 credits and costs ~$0.06, so a credit costs ~$0.005. This
 * was first written as 0.0006 — a slipped decimal that reported every bundle at
 * a 92% margin instead of ~30%, and it survived being read twice. It only fell
 * over when the numbers were EXECUTED, which is why the check script prints
 * them rather than asserting a boolean: a margin that looks too good is the one
 * nobody questions.
 */
export const COST_PER_CREDIT_DOLLARS = 0.005;

export const BUNDLES = [
  { key: "starter", priceCents: 3000, credits: 4000 },
  { key: "busy", priceCents: 5000, credits: 7000 },
  { key: "agency", priceCents: 8000, credits: 11500 },
];

/** What one action costs the balance, in credits. */
export const CREDIT_COST = {
  image_generation: IMAGE_GENERATION_CENTS * CREDITS_PER_CENT,
  image_vision: VISION_PASS_CENTS * CREDITS_PER_CENT,
};

/**
 * The margin a bundle actually earns, so the console can show it and a check
 * script can assert it never silently goes upside down.
 *
 * Returns null rather than a number when the bundle is unknown — an invented
 * margin for a tier that does not exist is worse than no answer.
 */
export function bundleMargin(key, { costPerCredit = COST_PER_CREDIT_DOLLARS } = {}) {
  const bundle = BUNDLES.find((b) => b.key === key);
  if (!bundle) return null;
  const costDollars = bundle.credits * costPerCredit;
  const revenueDollars = bundle.priceCents / 100;
  if (!(revenueDollars > 0)) return null;
  return (revenueDollars - costDollars) / revenueDollars;
}
