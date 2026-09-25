// lib/sms/deliveryStatus.js
//
// What happened to a text after Twilio accepted it — the pure half.
//
// No imports, no database, no environment: the status callback route, the
// reconcile cron, the screens and scripts/check-sms-delivery.mjs all read the
// SAME ordering and the SAME code→reason table from here. Two copies of "which
// status beats which" is how a late webhook ends up un-delivering a text on one
// path and not the other.
//
// The store (lib/sms/deliveryStore.js) and the send (lib/sms/twilioClient.js)
// are the impure halves.

// ── The order a text moves through ─────────────────────────────────────────
//
// Twilio's own lifecycle, plus two of ours:
//   pending      — our row exists, Twilio has not answered the create call yet
//   unconfirmed  — the create call never came back with a SID (the function
//                  died mid-send); closed by the reconcile cron so a row cannot
//                  sit "pending" for ever looking like it might still go.
//
// Twilio documents that callbacks can arrive OUT OF ORDER — a "sent" after a
// "delivered" is normal on a busy account — so the rank, not arrival time,
// decides. A terminal status is final: the first carrier verdict wins and a
// later, contradictory one is ignored. The alternative (last write wins) lets
// a retried "sent" webhook turn a delivered confirmation back into "sent".
const RANK = {
  pending: 0,
  accepted: 1,
  scheduled: 1,
  queued: 2,
  sending: 3,
  sent: 4,
  delivered: 5,
  undelivered: 5,
  failed: 5,
  canceled: 5,
  unconfirmed: 5,
  // WhatsApp-only in Twilio's vocabulary; harmless to know. The one move
  // allowed out of a terminal state: delivered → read.
  read: 6,
};

export const SMS_STATUSES = Object.keys(RANK);

/** Delivery failed for good — the recipient did not get it. */
export const FAILED_STATUSES = ["undelivered", "failed", "canceled", "unconfirmed"];

/** Still in flight: what the reconcile cron looks at. */
export const IN_FLIGHT_STATUSES = ["accepted", "scheduled", "queued", "sending", "sent"];

/** Twilio's status word, lower-cased and checked; null for anything unknown. */
export function normaliseStatus(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(RANK, s) ? s : null;
}

export function isTerminal(status) {
  const s = normaliseStatus(status);
  return s != null && RANK[s] >= 5;
}

/**
 * May a row at `from` move to `to`?
 *
 * Forward only; a failure is final; delivered may only become read. Equal rank
 * is not a move (queued → queued is a duplicate webhook, and accepted →
 * scheduled is not news).
 */
export function canAdvance(from, to) {
  const a = normaliseStatus(from);
  const b = normaliseStatus(to);
  if (!b) return false;
  if (!a) return true; // an unreadable stored value is replaced by a real one
  if (FAILED_STATUSES.includes(a)) return false;
  if (a === "delivered") return b === "read";
  return RANK[b] > RANK[a];
}

/**
 * Every stored status from which `to` is an advance — the WHERE clause of the
 * conditional update that makes the write idempotent and race-safe: two
 * webhooks landing together cannot both "win", because the second one's
 * update matches no row.
 */
export function statusesThatMayAdvanceTo(to) {
  return SMS_STATUSES.filter((from) => canAdvance(from, to));
}

/** Twilio sends ErrorCode as a string; store an integer or nothing. */
export function normaliseErrorCode(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).trim());
  return Number.isInteger(n) && n > 0 && n < 1e6 ? n : null;
}

// ── What a person is told ──────────────────────────────────────────────────
//
// The codes that actually happen to a contractor's texts, each with a reason a
// contractor can act on. English here is the PLATFORM console's copy (the
// console is English-only) and the fallback; /app screens translate the same
// codes through app.sms.reason.<code> in app/i18n/appMessages.js — a code with
// no key there falls back to app.sms.reason.other, never to this English.
//
// Sources: Twilio's error dictionary (twilio.com/docs/api/errors). 30034 is
// the one the owner is living with — US carriers drop texts from a number
// that is not registered for A2P 10DLC, and Twilio still answers 201.
export const SMS_REASONS = {
  30034: "Carriers blocked it: this number isn't registered for business texting (A2P 10DLC) yet.",
  30032: "Carriers blocked it: this toll-free number isn't verified for texting yet.",
  30003: "The phone was unreachable — switched off, out of coverage or no longer in service.",
  30004: "The recipient's carrier or phone blocked it.",
  30005: "That number doesn't exist or is no longer in service.",
  30006: "That number is a landline or can't receive texts.",
  30007: "The carrier filtered it as spam.",
  30008: "The carrier couldn't deliver it and didn't say why.",
  30024: "Carriers blocked it: the sending number's registration isn't complete.",
  21610: "This person replied STOP, so the carrier won't deliver texts from this number.",
  21211: "That phone number isn't valid.",
  21614: "That number can't receive texts (usually a landline).",
  21408: "Texting to that country isn't switched on for this account.",
  21606: "The sending number can't send texts.",
};

/** The i18n key for a code on an /app screen. */
export function reasonKey(errorCode) {
  const code = normaliseErrorCode(errorCode);
  return code && SMS_REASONS[code] ? `app.sms.reason.${code}` : "app.sms.reason.other";
}

/** English, for the platform console. Never invents a cause for an unknown code. */
export function reasonText(errorCode, errorMessage = null) {
  const code = normaliseErrorCode(errorCode);
  if (code && SMS_REASONS[code]) return SMS_REASONS[code];
  if (errorMessage) return String(errorMessage).slice(0, 300);
  return code ? `Twilio error ${code}.` : "The carrier didn't say why.";
}

/**
 * The one-word verdict every screen draws from.
 *
 *   delivered — the carrier confirmed the phone got it
 *   failed    — it did not arrive, and won't
 *   sent      — handed to the carrier; no delivery receipt (yet). Some
 *               carriers never send one, so this is NOT dressed up as delivered
 *   pending   — still at Twilio
 *
 * Absence of a receipt is not a receipt: "sent" stays "sent".
 */
export function deliveryVerdict({ status } = {}) {
  const s = normaliseStatus(status);
  if (s === "delivered" || s === "read") return "delivered";
  if (s && FAILED_STATUSES.includes(s)) return "failed";
  if (s === "sent") return "sent";
  return "pending";
}

/** "•••• 1234" — the only form a recipient's number takes on any screen. */
export function maskPhone(e164) {
  const digits = String(e164 ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "••••";
}

// ── Why a text was sent ────────────────────────────────────────────────────
//
// Every sendSms() caller names one of these. Unknown values are stored as
// "other" rather than refused — a new send path that forgot to register its
// purpose must still be TRACKED, which matters more than its label.
export const SMS_PURPOSES = [
  "booking_confirmation",
  "appointment_reminder",
  "visit_reminder",
  "on_my_way",
  "thread_reply",
  "change_order",
  "referral_invite",
  "opt_out_confirmation",
  "crew_reply",
  "crew_test",
  "photo_mention",
  "sales_signup_link",
  "sales_reply",
  "other",
];

export function normalisePurpose(value) {
  const p = String(value ?? "").trim();
  return SMS_PURPOSES.includes(p) ? p : "other";
}

// ── Which rows the reconcile cron asks Twilio about ────────────────────────
//
// A row is asked about when:
//   · it has a SID (nothing to look up otherwise),
//   · it is still in flight,
//   · it was sent more than RECONCILE_AFTER_MS ago — a callback normally
//     lands within seconds; half an hour of silence means it isn't coming,
//   · it was sent less than RECONCILE_GIVE_UP_MS ago — a text still "sent"
//     after three days is a carrier that doesn't return receipts, and asking
//     again every hour would only spend API calls,
//   · and it has not been asked in the last RECONCILE_EVERY_MS.
export const RECONCILE_AFTER_MS = 30 * 60 * 1000;
export const RECONCILE_GIVE_UP_MS = 72 * 60 * 60 * 1000;
export const RECONCILE_EVERY_MS = 55 * 60 * 1000;

/** The same rule as reconcileWhere, for one row — what the check executes. */
export function needsReconcile(row, now = new Date()) {
  if (!row || !row.sid) return false;
  if (!IN_FLIGHT_STATUSES.includes(normaliseStatus(row.status))) return false;
  const sent = new Date(row.sentAt).getTime();
  const t = now.getTime();
  if (!Number.isFinite(sent)) return false;
  if (t - sent < RECONCILE_AFTER_MS) return false;
  if (t - sent > RECONCILE_GIVE_UP_MS) return false;
  if (row.reconciledAt && t - new Date(row.reconciledAt).getTime() < RECONCILE_EVERY_MS) return false;
  return true;
}

/** Prisma WHERE for needsReconcile — kept beside it so the two cannot drift. */
export function reconcileWhere(now = new Date()) {
  const t = now.getTime();
  return {
    sid: { not: null },
    status: { in: IN_FLIGHT_STATUSES },
    sentAt: { lt: new Date(t - RECONCILE_AFTER_MS), gt: new Date(t - RECONCILE_GIVE_UP_MS) },
    OR: [{ reconciledAt: null }, { reconciledAt: { lt: new Date(t - RECONCILE_EVERY_MS) } }],
  };
}

/** A row whose send never returned a SID, old enough to stop waiting for. */
export function lostSendWhere(now = new Date()) {
  return { sid: null, status: "pending", sentAt: { lt: new Date(now.getTime() - RECONCILE_AFTER_MS) } };
}
