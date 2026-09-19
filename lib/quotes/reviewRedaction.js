// lib/quotes/reviewRedaction.js
//
// What a stored quote review may say to the person reading it.
//
// ── Why the review is stored whole and stripped on the way out ─────────────
//
// The review is computed once (POST /api/quotes/[id]/review) and stored on
// Quote.aiReview so reopening the quote is free. Since 2026-09-19 it carries
// two INTERNAL findings — the margin against the company's target and the
// margin history predicts — and both contain cost figures. The person who
// pressed Review may hold job costing; the colleague who reopens the quote
// tomorrow may not, and the stored object cannot know who will read it.
//
// So the object keeps everything and BOTH handlers on the route pass it
// through here with the reader's own permission grid. The alternative —
// only computing the findings when the poster holds the toggle — would
// have let a poster without it strip the finding for everyone, and a poster
// with it leak the finding to everyone. Stripping per reader is the only
// version where "who may see cost" is answered about the reader.
//
// The gate is the one the Cost & margin block uses: the jobCosting toggle
// (lib/permissions/enforce.js hasToggle). Not a new permission — the same
// one, so a person who can see the block can see the finding about it and
// nobody else can.
//
// PURE and small on purpose, so scripts/check-quote-price-check.mjs can
// prove a redacted review carries no cost field at all rather than trusting
// a regex over the route.

/** The review keys that carry cost figures. Everything else is client-safe. */
export const INTERNAL_REVIEW_KEYS = ["margin", "actuals"];

/**
 * @param review   the stored review object (or null)
 * @param p.mayCost  does this reader hold the jobCosting toggle?
 * @param p.mayWrite { recipe: bool, book: bool } — may this reader press an
 *                 "Update my costing" offer? (the calibration route's rule,
 *                 re-stated per reader so a button never 403s)
 * @returns a copy safe to send to this reader; never mutates the input
 */
export function redactReview(review, { mayCost = false, mayWrite = { recipe: false, book: false } } = {}) {
  if (!review || typeof review !== "object") return review ?? null;
  const out = { ...review };
  if (!mayCost) {
    for (const k of INTERNAL_REVIEW_KEYS) delete out[k];
    return out;
  }
  if (out.actuals && Array.isArray(out.actuals.offers)) {
    out.actuals = {
      ...out.actuals,
      offers: out.actuals.offers.map((o) => ({
        ...o,
        mayApply: Boolean(o?.store && mayWrite?.[o.store]),
      })),
    };
  }
  return out;
}
