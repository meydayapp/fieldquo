// lib/quotes/reviewGate.js
//
// "Save what is on screen, then review it" — the one rule, in one place.
//
// ── Why this exists at all ──────────────────────────────────────────────────
//
// The AI review and the paid deep photo read both read the SAVED quote out of
// the database (app/api/quotes/[id]/review/route.js does a `findFirst`; the
// vision route counts `clientPhotos` off the same row). On a create that is
// guaranteed: "Save & review" saves and only then routes to the edit page with
// ?review=1. On an EDIT nothing guaranteed it, and the result was a panel
// scoring a document nobody was looking at — Q-2026-0026 came back 42/100 with
// "No expiry date", "No line items", "No photos" while four thumbnails and a
// priced $5,122 section were on the same screen, because all of that was still
// unsaved browser state.
//
// The obvious alternative — POST the editor's state to the review route and
// review it in memory — was rejected. The review is STORED on the quote
// (Quote.aiReview) and read back by whoever opens it next, so a review of
// something that was never saved would be a filed statement about a document
// that does not exist. Saving first is also what the estimator wanted anyway:
// they are about to send it.
//
// ── Fail closed ─────────────────────────────────────────────────────────────
//
// If the save does not land, NOTHING runs. A review that quietly falls back to
// the stored row is the worst of the three outcomes: it spends a model call,
// files a score, and describes the wrong version of the quote — which is
// exactly the hour this cost. `ok: false` carries the reason instead, for the
// caller to say out loud.
//
// PURE and I/O-free: it is handed two functions and decides the order and the
// stop. That is what lets scripts/check-quote-review-freshness.mjs execute the
// rule — a failed save really does not produce a review — without a browser.

/**
 * @param save  optional `async () => ({ ok: boolean, error?: string })`. Absent
 *              means there is nothing unsaved to persist (the quote page, or
 *              the auto-review that arrives on ?review=1 straight after a save
 *              — re-saving there would be a second write for one click).
 * @param run   `async () => any` — the review or the deep read itself.
 * @returns     `{ ok: true, result }`, or `{ ok: false, reason: "save_failed",
 *              error }` with `run` never called.
 */
export async function runAfterSave({ save, run }) {
  if (typeof save === "function") {
    // A save that throws is a save that did not happen. Treated as a refusal
    // rather than propagated: the caller's job is to say why nothing ran, and
    // an exception out of a click handler is a spinner that never stops.
    let saved;
    try {
      saved = await save();
    } catch (err) {
      saved = { ok: false, error: err?.message || "" };
    }
    if (!saved || saved.ok !== true) {
      return { ok: false, reason: "save_failed", error: saved?.error || "" };
    }
  }
  return { ok: true, result: await run() };
}
