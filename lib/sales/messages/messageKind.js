// lib/sales/messages/messageKind.js
//
// What KIND of text an outbound row is — the chip beside the bubble.
//
// A rep reading a conversation sees their own words, the engine's day-1
// check-in, the signup link and a milestone nudge as four identical blue
// bubbles. The owner's rule is that every text sent to a company ends up in
// this thread; the chip is what lets a rep tell, without re-reading each one,
// which of them was the link, which was the day-7 check-in and which was a
// reply they typed.
//
// Decided from the row and nothing else: the check-in draft the message was
// sent from (SalesCheckIn.sentMessageId points back at the row, and the
// draft's dedupeKey says which touchpoint it was), and failing that the one
// shape a rep's link takes in a body. A plain reply is `reply` — carried so
// a check can assert it, drawn as no chip, for the reason the triage chip
// draws nothing on `fine`: a chip on every ordinary line is a list full of
// chips, and the exceptions are what need to stand out.
//
// Pure. Executed by scripts/check-sales-messages.mjs.

import { describeDraftKey } from "../checkin/plan";
import { touchpointLabelKey } from "../checkin/touchpointLabel";

/** The one shape of a rep's link (lib/sales/repStats.js signupLinkFor). */
export const SIGNUP_LINK_MARK = "/signup?sales=";

export const KIND_SIGNUP_LINK = "signup_link";
export const KIND_CHECKIN = "checkin";
export const KIND_SIGNUP_NUDGE = "signup_nudge";
export const KIND_FOLLOW_UP = "follow_up";
export const KIND_REPLY = "reply";

/** Every key outboundKind() can return in `labelKey`. Asserted against the catalogue. */
export const MESSAGE_KIND_LABEL_KEYS = Object.freeze([
  "app.salesText.cannedSignupTitle",
  "app.salesCheckin.touchpoint.day",
  "app.salesCheckin.touchpoint.retention",
  "app.salesCheckin.touchpoint.signup",
  "app.salesCheckin.touchpoint.engine",
  "app.salesCheckin.touchpoint.manual",
  "app.salesText.kindReply",
]);

/**
 * @param row  `{ direction, body, checkIn?: { dedupeKey, origin } | null }`
 *   — a SalesSmsMessage with its `checkIn` relation, or a demo check-in row
 *   handed in with its own `dedupeKey`/`origin` as `checkIn`.
 * @returns `{ kind, labelKey, params }` for an outbound row; null for an
 *   inbound one — the other side's texts have no kind of ours.
 */
export function outboundKind(row) {
  if (!row || row.direction === "in") return null;
  const checkIn = row.checkIn || null;
  if (checkIn) {
    const described = describeDraftKey(checkIn.dedupeKey);
    if (described.kind === "signup") {
      return { kind: KIND_SIGNUP_NUDGE, labelKey: "app.salesCheckin.touchpoint.signup", params: {} };
    }
    if (described.kind === "scheduled" || described.kind === "demo") {
      const labelKey = touchpointLabelKey(described);
      return {
        kind: KIND_CHECKIN,
        labelKey,
        params: labelKey === "app.salesCheckin.touchpoint.day" ? { day: described.touchpoint } : {},
      };
    }
    if (described.kind === "engine" || checkIn.origin === "engine") {
      return { kind: KIND_CHECKIN, labelKey: "app.salesCheckin.touchpoint.engine", params: {} };
    }
    return { kind: KIND_FOLLOW_UP, labelKey: "app.salesCheckin.touchpoint.manual", params: {} };
  }
  if (String(row.body || "").includes(SIGNUP_LINK_MARK)) {
    return { kind: KIND_SIGNUP_LINK, labelKey: "app.salesText.cannedSignupTitle", params: {} };
  }
  return { kind: KIND_REPLY, labelKey: "app.salesText.kindReply", params: {} };
}
