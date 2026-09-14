// lib/sales/signupProgressPoll.js
//
// When the rep's signup stepper asks the server again, and when it stops.
//
// ══ Why this is its own file ══════════════════════════════════════════════
//
// lib/sales/signupProgress.js owns the row and imports node:crypto for the
// token, so the browser bundle cannot take it. The decision below is the
// panel's, and it is pure so scripts/check-signup-progress.mjs executes it
// rather than arguing with a regex about a setInterval.
//
// ══ The loop that spun ════════════════════════════════════════════════════
//
// The stepper mounts unconditionally — the console's current card and the
// lead panel both draw it, and it renders nothing until a link has been
// texted (the route answers 404 for "no row" and "not yours" alike, on
// purpose). Its poll, though, was armed on MOUNT rather than on an ANSWER:
// ten seconds, every mount, for a lead that had no row and would never
// grow one on its own. The live network log showed the route 404ing ten
// times a minute on a lead nobody had texted. Polling a 404 is asking a
// question whose answer cannot change until the rep does something — and
// when they do (SignupLinkSms sends), the send says so through
// SIGNUP_LINK_SENT_EVENT and the panel asks once more.
//
// ══ The rule ══════════════════════════════════════════════════════════════
//
//   404, or an answer with no row   → stop. Nothing to watch.
//   a row, signup complete          → stop. A finished signup does not change.
//   a row, not complete             → ask again, no sooner than thirty seconds
//                                     even if the server asks for less.
//
// Thirty seconds is the floor because the console has a thirty-second window
// re-ask already and two mounts of this panel share a screen; a prospect
// typing their company name is not a change the rep needs within ten.

/** The panel never asks more often than this, whatever the server says. */
export const MIN_PANEL_POLL_MS = 30 * 1000;

/**
 * Dispatched on window by SignupLinkSms after a send the server accepted,
 * with `{ detail: { leadId } }`. Every mounted stepper for that lead asks
 * the route once more; one that finds a row starts polling it.
 */
export const SIGNUP_LINK_SENT_EVENT = "fieldquo:signup-link-sent";

/**
 * The delay before the next read, or null to stop.
 *
 * @param status   the HTTP status of the answer just received (0 when the
 *                 fetch itself failed)
 * @param progress the progress the panel now holds — the body's on a good
 *                 answer, the previous one on a transient failure, null
 *                 when there is none
 * @param pollMs   the cadence the server suggested, when it did
 * @returns {number|null}
 */
export function nextSignupPollMs({ status, progress, pollMs }) {
  if (status === 404) return null;
  if (!progress) return null;
  if (progress.completed) return null;
  const asked = Number(pollMs);
  return Math.max(MIN_PANEL_POLL_MS, Number.isFinite(asked) && asked > 0 ? asked : 0);
}

/** Tell every mounted stepper for this lead that a link just went out. */
export function announceSignupLinkSent(leadId) {
  if (typeof window === "undefined" || !leadId) return;
  window.dispatchEvent(new CustomEvent(SIGNUP_LINK_SENT_EVENT, { detail: { leadId } }));
}
