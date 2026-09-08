// lib/messaging/waiting.js
//
// "This person has been waiting four hours" — as a column, not as a scan.
//
// ══ Why the columns exist ══════════════════════════════════════════════════
//
// Taken from Chatwoot, which keeps `first_reply_created_at` and
// `waiting_since` on the conversation rather than deriving them. The reason is
// not performance, it is REACH: a number you can only get by walking every
// message of every thread is a number that appears once a month in a report,
// and "somebody wrote three hours ago and nobody has answered" is worth
// nothing once a month. It has to be on the list, now, next to their name.
//
// ══ One function, both writers ═════════════════════════════════════════════
//
// The stamps are set in two completely separate places — the webhook
// (lib/messaging/ingest.js, a homeowner's message arriving) and the reply
// route (a contractor answering). Those are the two halves of the same clock,
// and this repo's failure class #4 is what happens when a rule is written
// twice: the copy is the one that rots. So both call responseStamps(), which
// is pure, takes the thread's current stamps and the new message, and returns
// the Prisma `data` patch to apply — including an EMPTY object, which is a
// legitimate answer meaning "this message changes nothing about the clock".
//
// ══ The rules, and why each one is not the obvious thing ═══════════════════
//
//   * A NOTE never clears `waitingSince`. Writing "she's fussy about the trim"
//     is not answering her. Chatwoot has the same carve-out (`&& !private`),
//     and without it the inbox would quietly stop showing the oldest unanswered
//     enquiry the moment somebody made a note on it.
//   * A FAILED send never clears it and never stamps `firstReplyAt`. The
//     message was recorded so the screen could say it failed; treating it as a
//     reply would report a response the homeowner never received — the same
//     rule lib/messaging/monthlyReview.js already applies when measuring.
//   * `firstReplyAt` is stamped only when there is a question to answer. An
//     outbound message on a thread with no inbound yet is not a reply to
//     anything, and stamping it would produce a negative gap later.
//   * `firstInboundAt` moves BACKWARDS if a late delivery turns out to be
//     older. Meta re-delivers for hours, out of order; the first inbound is
//     the earliest one seen, not the first one that happened to arrive.

import { isDeliveredReply } from "./messageKinds";

const ms = (value) => {
  if (value === null || value === undefined) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : null;
};

/**
 * @param {object} thread   the row's CURRENT stamps: { firstInboundAt,
 *                          firstReplyAt, waitingSince }
 * @param {object} message  the message just written: { direction, private,
 *                          failedReason, sentAt }
 * @returns {object} a Prisma `data` patch. `{}` when nothing changes — never
 *                   null, so a caller can spread it unconditionally.
 */
export function responseStamps({ thread = {}, message = {} } = {}) {
  const at = ms(message.sentAt);
  if (at === null) return {};

  const patch = {};

  if (message.direction === "in") {
    const firstIn = ms(thread.firstInboundAt);
    // Earliest wins — see the header on out-of-order re-delivery.
    if (firstIn === null || at < firstIn) patch.firstInboundAt = new Date(at);
    // Only if nobody is already waiting: waitingSince is the moment the
    // SILENCE started, so a second unanswered message must not reset it and
    // make a two-day-old enquiry look fresh.
    if (ms(thread.waitingSince) === null) patch.waitingSince = new Date(at);
    return patch;
  }

  // A note, a system line, or a send that failed: the clock does not move.
  if (!isDeliveredReply(message)) return {};

  // A real reply went out. Whatever they were waiting for, they have it.
  if (ms(thread.waitingSince) !== null) patch.waitingSince = null;

  const firstIn = ms(thread.firstInboundAt);
  // No question yet, so this is not an answer to one.
  if (firstIn === null) return patch;
  // A reply that predates the question is not the reply to it.
  if (at < firstIn) return patch;
  if (ms(thread.firstReplyAt) === null) patch.firstReplyAt = new Date(at);

  return patch;
}

/**
 * How long somebody has been waiting, as an i18n key and a count.
 *
 * Returns null when nobody is waiting — NOT a zero and not "0 min". The inbox
 * renders nothing for a null, which is the difference between "we have
 * answered" and "they have been waiting no time at all".
 *
 * Under a minute reads as "just now": rounding 40 seconds to "0 min" is the
 * same shape of lie the review's formatMinutes was written to avoid.
 */
export function waitedLabel(waitingSince, now = new Date()) {
  const since = ms(waitingSince);
  const at = ms(now);
  if (since === null || at === null) return null;
  const minutes = (at - since) / 60000;
  // A clock skew between the server that stamped it and the browser reading it
  // can put this slightly in the future. "Just now" is honest for that; a
  // negative duration is not.
  if (minutes < 1) return { key: "app.messages.waiting.justNow", params: {} };
  if (minutes < 60) return { key: "app.messages.waiting.minutes", params: { count: Math.round(minutes) } };
  if (minutes < 60 * 24) {
    return { key: "app.messages.waiting.hours", params: { count: Math.round(minutes / 60) } };
  }
  return { key: "app.messages.waiting.days", params: { count: Math.round(minutes / (60 * 24)) } };
}

/**
 * Is this thread worth flagging on the list?
 *
 * Only for a thread that is actually somebody's turn. A resolved or snoozed
 * conversation with a stale `waitingSince` is not "waiting" — it was dealt
 * with, or deliberately parked, and painting an urgent badge on it teaches
 * people to ignore the badge.
 */
export function isWaiting(thread = {}) {
  if (!thread.waitingSince) return false;
  return thread.status === "open" || thread.status === "pending";
}
