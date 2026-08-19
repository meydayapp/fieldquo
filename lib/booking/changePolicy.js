// lib/booking/changePolicy.js
//
// Whether a client may still cancel or move a visit they booked, and whether a
// visit fee they already paid comes back when they do.
//
// ══ Two windows, because they answer two different questions ════════════════
//
// It is tempting to have one cutoff. It doesn't survive contact with how
// contractors actually work:
//
//   changeNoticeHours   how much warning the CREW needs. Inside it, the day is
//                       already planned and the van is loaded, so self-serve
//                       cancelling stops and the client has to ring.
//   refundCutoffHours   how much warning the MONEY needs. A deposit exists
//                       partly to make a no-show expensive, so a company may
//                       well let someone cancel at 24 hours and still keep the
//                       fee unless they gave 48.
//
// So refundCutoffHours is allowed to be LONGER than changeNoticeHours, and
// that combination is the interesting one rather than a mistake: "you can move
// it up to a day before, but the deposit is only returned with two days'
// notice." When it isn't set, it falls back to the change window, which
// collapses to the simple behaviour a company that never opened the setting
// would expect.
//
// ══ Refunds are OFF unless the company said otherwise ═══════════════════════
//
// `refundVisitFeeOnCancel` defaults false. A visit fee is the contractor's
// money the moment it is taken, and a public link that returns it on demand is
// a control that spends someone else's money because nobody chose a default.
// Off means the cancel still works — the slot is freed, the contractor is told
// — and the screen says plainly that the fee is not automatically returned.
//
// ══ Pure ═══════════════════════════════════════════════════════════════════
//
// No database, no Stripe, no clock of its own — `now` is passed in so the same
// decision can be replayed in a test and by the route that acts on it. Every
// function returns a REASON as well as a verdict, because every one of these
// refusals has to be explained on a screen to a stranger who cannot ask anyone.

/** Hours between `now` and the visit. Negative once it has started. */
export function hoursUntil(startTime, now) {
  const start = new Date(startTime).getTime();
  const at = new Date(now).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(at)) return null;
  return (start - at) / 3_600_000;
}

/**
 * The company's change window, in hours.
 *
 * Absent, non-numeric or negative resolves to 24 rather than 0. Zero would mean
 * "cancellable until the moment the van arrives", which no contractor asked
 * for, and a malformed setting must not be read as the most permissive one.
 */
export function changeNoticeHours(company) {
  // Null-checked BEFORE Number(), because Number(null) is 0 — finite, and the
  // most permissive value there is. Without this an unset column reads as
  // "cancellable until the van pulls up", which is precisely the reading this
  // function exists to prevent. Same trap as an absent budget ceiling.
  const raw = company?.bookingChangeNoticeHours;
  if (raw == null || raw === "") return 24;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : 24;
}

/**
 * The refund window, in hours. Falls back to the change window when unset —
 * NOT to zero, which would refund a cancellation made an hour beforehand.
 */
export function refundCutoffHours(company) {
  // Same null-before-Number rule: an unset cutoff must fall back to the change
  // window, not to zero, which would refund a cancellation made minutes before.
  const raw = company?.refundCutoffHours;
  if (raw == null || raw === "") return changeNoticeHours(company);
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 ? v : changeNoticeHours(company);
}

/**
 * May this booking still be changed by the client?
 *
 * @returns {{ allowed: boolean, reason: string, hoursLeft: number|null }}
 *   reason is a STABLE KEY, never a sentence — the wording is per-language and
 *   belongs to the page, and a key can be tested.
 */
export function canClientChange(booking, company, now = new Date()) {
  if (!booking) return { allowed: false, reason: "not_found", hoursLeft: null };

  // A cancelled booking is already in its final state; a completed one has
  // happened. Neither is a scheduling question any more.
  if (booking.status === "cancelled") {
    return { allowed: false, reason: "already_cancelled", hoursLeft: null };
  }
  if (booking.status === "completed") {
    return { allowed: false, reason: "already_happened", hoursLeft: null };
  }
  // A slot held while checkout is open is not theirs yet. Letting it be
  // rescheduled would move a booking that may never be paid for.
  if (booking.status === "pending_payment") {
    return { allowed: false, reason: "awaiting_payment", hoursLeft: null };
  }

  const hoursLeft = hoursUntil(booking.startTime, now);
  if (hoursLeft === null) return { allowed: false, reason: "not_found", hoursLeft: null };
  if (hoursLeft <= 0) return { allowed: false, reason: "already_happened", hoursLeft };

  const notice = changeNoticeHours(company);
  if (hoursLeft < notice) {
    return { allowed: false, reason: "too_late", hoursLeft };
  }
  return { allowed: true, reason: "ok", hoursLeft };
}

/**
 * Does the visit fee come back if they cancel right now?
 *
 * Deliberately independent of canClientChange: a contractor cancelling on the
 * client's behalf from the back office asks the same money question, and the
 * answer must not depend on which door the cancellation came through.
 *
 * @returns {{ refund: boolean, reason: string, amountCents: number }}
 */
export function refundOnCancel(booking, company, now = new Date()) {
  const paid = Number(booking?.feePaidCents) || 0;

  // Nothing was taken, so there is nothing to decide. Reported as its own
  // reason rather than "policy_off" so a screen doesn't tell someone their fee
  // is non-refundable when they never paid one.
  if (paid <= 0) return { refund: false, reason: "nothing_paid", amountCents: 0 };

  if (!company?.refundVisitFeeOnCancel) {
    return { refund: false, reason: "policy_off", amountCents: paid };
  }

  // Already refunded once. The public link is holdable by anyone the client
  // forwarded it to, so this has to be answerable from the row itself rather
  // than trusted to be called once.
  if (booking?.feeRefundedAt) {
    return { refund: false, reason: "already_refunded", amountCents: paid };
  }

  const hoursLeft = hoursUntil(booking.startTime, now);
  if (hoursLeft === null || hoursLeft <= 0) {
    return { refund: false, reason: "already_happened", amountCents: paid };
  }

  const cutoff = refundCutoffHours(company);
  if (hoursLeft < cutoff) {
    return { refund: false, reason: "inside_cutoff", amountCents: paid };
  }

  // Only ever the amount actually captured. Never eventType.feeCents, which is
  // today's price list — a company that raised its fee since would otherwise
  // refund more than it ever took.
  return { refund: true, reason: "ok", amountCents: paid };
}
