// lib/payments/receiptState.js
//
// What a payment row's receipt columns MEAN — for the invoice page (which
// shows "Sent ✓ date / Failed (reason) / Not sent"), the retry cron and
// lib/payments/sendReceipt.js, so the three cannot disagree. Pure and free of
// server imports: the page bundles it.
//
// The columns are on Payment (prisma/schema.prisma, "The client's receipt for
// THIS payment"). The rules in one place:
//
//   * receiptAttempts 0 = nobody ever tried. A payment recorded before
//     receipts existed, or with the box unticked. The cron never touches it;
//     only a person pressing "Send receipt" sends it.
//   * A failed attempt is retried by the cron after a backoff, at most
//     RECEIPT_MAX_ATTEMPTS attempts in all and only within
//     RECEIPT_RETRY_WINDOW_MS of the first, then it stops and reads "Failed".
//   * no_client_email is final: retrying cannot invent an address. Once one
//     is added, a person presses Send.

import { AUTO_MESSAGE_HOLD, isClientHold } from "@/lib/clients/autoMessages";

export const RECEIPT_MAX_ATTEMPTS = 5;
export const RECEIPT_RETRY_WINDOW_MS = 48 * 60 * 60 * 1000;
// The wait after attempt N before attempt N+1 (index = attempts made). The
// cron runs hourly, so in practice: ~1h, ~2h, ~6h, ~12h after the first —
// all five inside the 48-hour window, the last of them about a day in.
export const RECEIPT_BACKOFF_MS = Object.freeze([0, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000, 12 * 3_600_000]);
// A claim held this long belongs to a sender that died mid-flight (a
// serverless function frozen after its response). It may be taken over.
export const RECEIPT_CLAIM_STALE_MS = 10 * 60_000;
// A resend inside this window of the last send is the double press it almost
// certainly is — the same reasoning, and nearly the same window, as the
// duplicate-payment guard in app/api/payments/route.js.
export const RECEIPT_RESEND_GUARD_MS = 60_000;

/**
 * Written instead of a send when the client has "No automatic emails or
 * texts" on, or is marked Do not contact (lib/clients/autoMessages.js — the
 * gate's own codes, imported so the two cannot drift; that module imports
 * nothing, so the page still bundles this one), and the receipt was
 * automatic. Not a failure: nothing was attempted, and only a person's Send
 * receipt sends it.
 */
export const RECEIPT_HELD_BACK = AUTO_MESSAGE_HOLD.SWITCH;
export const RECEIPT_HELD_DO_NOT_CONTACT = AUTO_MESSAGE_HOLD.DO_NOT_CONTACT;

/** Failure codes no retry can fix. */
export const RECEIPT_FINAL_ERRORS = Object.freeze(["no_client_email", RECEIPT_HELD_BACK, RECEIPT_HELD_DO_NOT_CONTACT]);

const ms = (v) => (v ? new Date(v).getTime() : NaN);

export function isFinalReceiptError(code) {
  const c = String(code || "");
  return RECEIPT_FINAL_ERRORS.some((f) => c === f || c.startsWith(`${f}:`));
}

/** When the cron may try this payment again, or null when it never will. */
export function nextReceiptRetryAt(p, now = new Date()) {
  if (!p || p.kind === "refund" || p.receiptSentAt) return null;
  const attempts = Number(p.receiptAttempts) || 0;
  if (attempts < 1 || attempts >= RECEIPT_MAX_ATTEMPTS) return null;
  if (isFinalReceiptError(p.receiptLastError)) return null;
  const first = ms(p.receiptFirstAttemptAt);
  const last = ms(p.receiptLastAttemptAt);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  const due = last + (RECEIPT_BACKOFF_MS[attempts] ?? RECEIPT_BACKOFF_MS[RECEIPT_BACKOFF_MS.length - 1]);
  // The window closes for the attempt that would land after it AND for one
  // that is merely overdue past it (the cron was down): the cron's query
  // stops looking at 48 hours, so the row must stop promising a retry too.
  const closes = first + RECEIPT_RETRY_WINDOW_MS;
  if (due > closes || new Date(now).getTime() > closes) return null;
  return new Date(due);
}

/** Is this payment due a retry right now? */
export function receiptRetryDue(p, now = new Date()) {
  const next = nextReceiptRetryAt(p, now);
  if (!next) return false;
  if (p.receiptClaimedAt && new Date(now).getTime() - ms(p.receiptClaimedAt) < RECEIPT_CLAIM_STALE_MS) return false;
  return next.getTime() <= new Date(now).getTime();
}

/**
 * The state the payment row shows.
 *
 * @returns {{ state: "refund"|"sent"|"sending"|"held"|"retrying"|"failed"|"no_email"|"not_sent",
 *             at: Date|null, to: string|null, error: string|null, attempts: number, nextAt: Date|null }}
 */
export function receiptStatus(p, now = new Date()) {
  const attempts = Number(p?.receiptAttempts) || 0;
  const base = { at: null, to: null, error: null, attempts, nextAt: null };
  if (!p || p.kind === "refund" || p.refundOfPaymentId) return { ...base, state: "refund" };
  if (p.receiptSentAt) return { ...base, state: "sent", at: new Date(p.receiptSentAt), to: p.receiptSentTo || null };
  if (p.receiptClaimedAt && new Date(now).getTime() - ms(p.receiptClaimedAt) < RECEIPT_CLAIM_STALE_MS) {
    return { ...base, state: "sending" };
  }
  const error = p.receiptLastError || null;
  // Held back by the client's switch or Do not contact — said as that, not as
  // "not sent" (which reads as nobody tried) nor as a failure (nothing
  // failed). `error` carries which one, for the sentence.
  if (isClientHold(error)) return { ...base, state: "held", error };
  if (attempts === 0) return { ...base, state: "not_sent" };
  if (isFinalReceiptError(error)) return { ...base, state: "no_email", error, at: p.receiptLastAttemptAt ? new Date(p.receiptLastAttemptAt) : null };
  const nextAt = nextReceiptRetryAt(p, now);
  return {
    ...base,
    state: nextAt ? "retrying" : "failed",
    error,
    at: p.receiptLastAttemptAt ? new Date(p.receiptLastAttemptAt) : null,
    nextAt,
  };
}
