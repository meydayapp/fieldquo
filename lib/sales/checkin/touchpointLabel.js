// lib/sales/checkin/touchpointLabel.js
//
// The catalogue key for "which draft is this" — day-1, day-7, the milestone
// approach, a signup nudge, a follow-up — for a screen listing drafts of
// every origin side by side (the Today card, the texts banner).
//
// Its own tiny module rather than a function in plan.js: app/sales/page.js
// is a client component, and plan.js pulls in the scheduling window and the
// phone normaliser, neither of which a card that prints five labels needs
// in the browser. Pure, no imports, executable by the check.
//
// Keyed, not worded: the sentence is the catalogue's, in the rep's own
// language, and the English travels there — never here.

/** Every key touchpointLabelKey() can return. Asserted against the catalogue. */
export const TOUCHPOINT_LABEL_KEYS = Object.freeze([
  "app.salesCheckin.touchpoint.day",
  "app.salesCheckin.touchpoint.retention",
  "app.salesCheckin.touchpoint.signup",
  "app.salesCheckin.touchpoint.linksent",
  "app.salesCheckin.touchpoint.engine",
  "app.salesCheckin.touchpoint.manual",
]);

/**
 * @param item  `{ kind, touchpoint }` as lib/sales/checkin/waiting.js emits
 *              it (plan.js describeDraftKey): kind one of scheduled | demo |
 *              signup | engine | manual; touchpoint a day number,
 *              "retention", "2h" / "24h", or null.
 * @returns the key. The day key takes `{ day }`; the rest take nothing.
 */
export function touchpointLabelKey(item) {
  const kind = item?.kind;
  const touchpoint = item?.touchpoint;
  if (kind === "scheduled" || kind === "demo") {
    if (touchpoint === "retention") return "app.salesCheckin.touchpoint.retention";
    if (Number.isInteger(touchpoint) && touchpoint > 0) return "app.salesCheckin.touchpoint.day";
  }
  if (kind === "signup") return "app.salesCheckin.touchpoint.signup";
  if (kind === "linksent") return "app.salesCheckin.touchpoint.linksent";
  if (kind === "engine") return "app.salesCheckin.touchpoint.engine";
  return "app.salesCheckin.touchpoint.manual";
}
