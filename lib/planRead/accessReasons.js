// lib/planRead/accessReasons.js
//
// Why an access line costs nothing or is left out — asked ONCE, one tap,
// when the estimator removes an access line or sets it to $0 (the owner,
// 2026-10-05: "maybe they don't need it because they already own it, who
// knows"). Shown on the line and in the review panel, so whoever reviews the
// quote later sees why there is no rental cost. Office-only.
//
// Pure.

export const ACCESS_REASONS = Object.freeze(["owned", "client_provides", "not_needed", "included_elsewhere"]);

const LABELS = Object.freeze({
  owned: "we own it",
  client_provides: "the client provides it",
  not_needed: "not needed",
  included_elsewhere: "included elsewhere",
});

export function accessReasonLabel(key) {
  return Object.hasOwn(LABELS, key) ? LABELS[key] : null;
}
