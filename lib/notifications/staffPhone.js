// lib/notifications/staffPhone.js
//
// Which number a staff alert text goes to — the owner, 2026-11-08: "the
// system should know the employees number and the owners number."
//
// It did, and it was not looking. sendStaffTexts read Member.phone and
// refused `no_phone` when it was empty, which for an OWNER is a number
// FieldQuo already holds, already normalised, and already proved textable.
//
// ══ Why a verified trial phone is the right fallback ══════════════════════
//
// A card-free trial verifies a mobile by SMS code before it may spend
// FieldQuo's money (lib/trial/phoneVerify.js, owner-approved 2026-10-03,
// and card-free is the signup since 2026-09-24). An `approved`
// PhoneVerification row therefore means something stronger than any carrier
// lookup: a text was sent to that number and a human read the code out of
// it. So `lineType` is deliberately NOT consulted here — a row that says
// "unknown" still carries proof of delivery, which is the only property
// this code needs.
//
// ══ Why NOT Company.phone ═════════════════════════════════════════════════
//
// Company.phone is the business line printed on the quote. TrueFinish's is
// 819-238-7263 — a business number. A text to a landline is accepted by
// Twilio and then silently discarded by the carrier, so falling back to it
// would turn "no_phone", which is honest and visible, into a text that
// reports success and reaches nobody. That is the defect class this
// codebase is swept for. lib/sales/checkin/materialise.js does walk
// Company.phone, and it is FieldQuo texting a CONTRACTOR it has no other
// handle on — a different trade-off with a human watching the result.
//
// ══ Why attribution is per user, not per company ══════════════════════════
//
// Company.trialPhoneE164 holds the number but not whose it is.
// PhoneVerification.userId does. Reading the company column would text the
// founder's mobile to alert a dispatcher — one person's cell standing in for
// another's is worse than no text at all. A row with a null userId cannot be
// attributed and is skipped.

import { toE164 } from "@/lib/sms/twilioClient";

/**
 * The verified mobile each of `userIds` proved for this company, newest
 * first. One query, not one per member: this is called just above a loop
 * over every recipient.
 *
 * @returns {Promise<Map<string, string>>} userId → E.164
 */
export async function verifiedPhonesFor(prisma, { companyId, userIds = [] } = {}) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const out = new Map();
  if (!companyId || !ids.length) return out;
  const rows = await prisma.phoneVerification
    .findMany({
      where: { companyId, userId: { in: ids }, status: "approved" },
      select: { userId: true, e164: true, verifiedAt: true },
      orderBy: { verifiedAt: "desc" },
    })
    .catch(() => []);
  for (const r of rows) {
    // Newest wins: the list is already sorted, so the first row for a user
    // is their latest verification and later ones are ignored.
    if (!r.userId || out.has(r.userId)) continue;
    const e164 = toE164(r.e164 || "");
    if (e164) out.set(r.userId, e164);
  }
  return out;
}

/**
 * The number to text this member, and where it came from. PURE, so
 * scripts/check-staff-alert-from.mjs runs every branch.
 *
 * `source` is recorded on the StaffAlertText row: "member" when they typed
 * it, "verified" when FieldQuo already held it. Worth distinguishing because
 * a company seeing alerts arrive at a number nobody entered in Settings →
 * Team deserves to be able to find out why.
 *
 * @returns {{ e164: string|null, source: "member"|"verified"|null }}
 */
export function staffPhoneFor(member, verified = new Map()) {
  const own = toE164(member?.phone || "");
  if (own) return { e164: own, source: "member" };
  const fallback = member?.userId ? verified.get(member.userId) || null : null;
  if (fallback) return { e164: fallback, source: "verified" };
  return { e164: null, source: null };
}
