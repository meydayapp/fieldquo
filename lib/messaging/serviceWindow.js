// lib/messaging/serviceWindow.js
//
// WhatsApp's 24-hour customer service window, as a pure function.
//
// ══ What Meta's own docs say ═══════════════════════════════════════════════
//
// developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages,
// read 2026-09-08:
//
//   "When a WhatsApp user messages you or calls you, a 24-hour timer called a
//    customer service window starts."
//
//   Inside it: any service message type, freely, with no approval.
//   Outside it: "you can only send pre-approved template messages."
//
// The window RESETS every time the customer writes again — it is measured from
// their LAST message, not their first. And a send that breaks the rule is not
// silently dropped: Meta answers with error 131047, "More than 24 hours have
// passed since the recipient last replied to the sender number", and tells you
// to send a template instead.
//
// ══ Why this is computed here rather than left to Meta ═════════════════════
//
// Because 131047 arrives AFTER a contractor has typed an answer and pressed
// Send. The message is written, the bubble appears, and then it fails — which
// is the exact "control that appears to work" AGENTS.md forbids, delivered by
// a third party. Knowing the answer beforehand means the composer can say the
// window has closed, say what CAN be sent instead, and refuse a free-text send
// with a reason of our own (`service_window_closed`) rather than a translated
// Meta error.
//
// Meta's verdict is still the one that counts. This function is the FIRST of
// two gates, not a replacement for the second: lib/messaging/whatsappSend.js
// still classifies a 131047 that comes back anyway (clock skew, a message we
// never received, a window that closed between the check and the call), and
// records it with the same reason so both paths read identically in a thread.
//
// ══ Pure, and taking `now` as an argument ══════════════════════════════════
//
// Every guard in this file is a way to message a homeowner illegally or to
// stop a contractor messaging one legally, and both are worth executing rather
// than reading. A function that read the clock itself could not be tested at
// the boundary, which is the case most likely to be wrong — so `now` is passed
// in, exactly as lib/aiEmployee/decide.js takes `businessHoursOpen` rather
// than computing it.

import { SERVICE_WINDOW_PLATFORMS } from "./platforms";

/** 24 hours, in milliseconds. Meta's number, not a tunable of ours. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Meta's error code for "you sent free text outside the window". Named so the
 * send path and this file agree about what it means without either quoting a
 * bare number at a reader.
 */
export const RE_ENGAGEMENT_ERROR_CODE = 131047;

/**
 * Is the customer service window open on this thread, and until when?
 *
 * @param {Date|string|number|null} lastInboundAt  MessageThread.lastInboundAt —
 *        when the CUSTOMER last wrote. Null when they never have.
 * @param {Date} [now]
 *
 * @returns {{ open: boolean, closesAt: Date|null, msRemaining: number|null,
 *             reason: string|null }}
 *
 *   open         may free text be sent right now
 *   closesAt     when the window shuts, or null when there is no window to
 *                shut because nobody ever opened one
 *   msRemaining  how long is left, floored at 0. Null when there is no window.
 *   reason       why it is closed: "never_opened" | "expired", or null when
 *                it is open. Two different sentences on the screen, because
 *                they are two different situations — one needs the customer to
 *                write first, the other needs a template.
 */
export function serviceWindowState(lastInboundAt, now = new Date()) {
  const last = toDate(lastInboundAt);
  const at = toDate(now) || new Date();

  // ── No inbound ever is CLOSED, and this is the load-bearing default ─────
  //
  // Null here means "we hold no record of this person writing to us". Reading
  // that as open would let the very first outbound message on a brand-new
  // thread go out as free text — the one case Meta refuses outright, because a
  // business-initiated conversation is precisely what templates exist for.
  // Absence of a statement is not a statement (AGENTS.md failure class 5), and
  // here the safe reading of the silence is "closed".
  if (!last) {
    return { open: false, closesAt: null, msRemaining: null, reason: "never_opened" };
  }

  const closesAt = new Date(last.getTime() + SERVICE_WINDOW_MS);
  const msRemaining = closesAt.getTime() - at.getTime();

  // ── The boundary, and which side of it 24:00:00.000 falls on ────────────
  //
  // Meta's rule is "more than 24 hours have passed". At EXACTLY 24 hours, not
  // more than 24 hours have passed, so the window is still open — but only
  // just, and a message sent on that millisecond is racing the network. This
  // returns open, because that is what the rule says and inventing a safety
  // margin here would refuse sends Meta would have accepted; the margin
  // belongs in what the SCREEN says, which warns while msRemaining is small.
  if (msRemaining < 0) {
    return { open: false, closesAt, msRemaining: 0, reason: "expired" };
  }

  return { open: true, closesAt, msRemaining, reason: null };
}

/**
 * May this outbound message leave, given the platform and the window?
 *
 * THE function the send path calls. Returns null when the send may proceed,
 * and a refusal `{ reason, message }` when it may not — the same shape
 * lib/messaging/messageKinds.js's sendRefusalReason returns, so the two read
 * alike at the call site.
 *
 * @param platform      the channel's platform
 * @param lastInboundAt the thread's column
 * @param kind          "text" | "template"
 * @param now
 */
export function serviceWindowRefusal({ platform, lastInboundAt, kind = "text", now = new Date() }) {
  // Platforms with no window of ours to compute are not refused by this
  // function. Facebook and Instagram have Meta's own version of the rule and
  // metaSend.js sends `messaging_type: "RESPONSE"` for it; pretending to
  // enforce it here would be a second, disagreeing answer.
  if (!needsServiceWindow(platform)) return null;

  // A template is the thing that is ALLOWED outside the window, so it is never
  // refused by it. It has its own refusals (unknown name, not approved, wrong
  // parameter count) and those live with the template, in
  // lib/messaging/templates.js.
  if (kind === "template") return null;

  const state = serviceWindowState(lastInboundAt, now);
  if (state.open) return null;

  return {
    reason: "service_window_closed",
    // Two sentences, because the two reasons need two different actions from
    // the contractor. Both name the template as the way through — a refusal
    // that only says no is a dead end with a polite face on it.
    message:
      state.reason === "never_opened"
        ? "This person has not messaged you on WhatsApp, so WhatsApp will not carry a typed message to them. An approved template is the only thing that may start a conversation."
        : "More than 24 hours have passed since they last wrote, so WhatsApp will not carry a typed message. An approved template can reopen the conversation.",
    detail: state.reason,
    closesAt: state.closesAt,
  };
}

/**
 * Does this platform have a window FieldQuo computes?
 *
 * Re-exported through lib/messaging/platforms.js's list rather than testing
 * for the string "whatsapp" here, so there is one place that knows.
 */
export function needsServiceWindow(platform) {
  return SERVICE_WINDOW_PLATFORMS.includes(platform);
}

/**
 * What the composer shows: the state, plus how it should be said.
 *
 * @returns {{ open, closesAt, msRemaining, reason,
 *             blockKey: string|null, warnKey: string|null, hours: number|null }}
 *
 * `blockKey` disables the Reply box with a sentence on it. `warnKey` is the
 * softer one: the window is open but closing within the hour, which is the
 * thing a contractor most needs told BEFORE they start typing a long answer.
 *
 * Keys, not sentences — the page translates them, and
 * scripts/check-translations.mjs sees them as ordinary string literals in nine
 * languages. Same contract as lib/messaging/composerState.js.
 */
export function serviceWindowNotice({ platform, lastInboundAt, now = new Date() }) {
  if (!needsServiceWindow(platform)) {
    return { open: true, closesAt: null, msRemaining: null, reason: null, blockKey: null, warnKey: null, hours: null };
  }

  const state = serviceWindowState(lastInboundAt, now);
  if (!state.open) {
    return {
      ...state,
      blockKey:
        state.reason === "never_opened"
          ? "app.messages.window.neverOpened"
          : "app.messages.window.closed",
      warnKey: null,
      hours: null,
    };
  }

  // Whole hours remaining, rounded DOWN. "2 hours left" when 2 h 59 m remain
  // is a lie in the contractor's favour and would be fine; "3 hours left" when
  // 2 h 1 m remain is a lie in the other direction, and that is the one that
  // gets a message refused.
  const hours = Math.floor(state.msRemaining / (60 * 60 * 1000));
  return {
    ...state,
    blockKey: null,
    warnKey: hours < 1 ? "app.messages.window.closingSoon" : null,
    hours,
  };
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
