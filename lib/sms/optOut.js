// lib/sms/optOut.js
//
// "May we text this number, for this company" — the SMS equivalent of
// lib/voice/outbound.js's mayCall, and deliberately a SEPARATE mechanism from
// it. See the SmsOptOut model's doc comment in prisma/schema.prisma for why:
// CallConsent.optedOutAt is intentionally permanent ("always wins... never
// deleted"), which is right for a voice opt-out under TCPA but wrong for SMS
// STOP/START — carriers expect START to genuinely reverse a STOP, in real
// time, on the same channel.
//
// maySms() checks BOTH tables, though: a number that opted out of CALLS is
// refused SMS too (the safer reading of "leave me alone" is the broad one),
// but opting back into SMS here never touches CallConsent — so a START reply
// can't silently restore call consent that was deliberately made one-way.
import { db } from "@/lib/db";
import { toE164 } from "./twilioClient";

/**
 * @returns {boolean} true if this number should NOT be texted for this
 *          company. false for an unparseable number too — callers already
 *          guard "no valid phone" separately (toE164 returning null), and
 *          this function answering "not opted out" for a number it can't even
 *          identify would be misleading if read on its own.
 */
export async function maySms({ companyId, phone }) {
  const e164 = toE164(phone);
  if (!companyId || !e164) return false;

  const [smsRow, callOptOut] = await Promise.all([
    db.smsOptOut.findUnique({
      where: { companyId_e164: { companyId, e164 } },
      select: { optedOut: true },
    }),
    db.callConsent.findFirst({
      where: { companyId, e164, optedOutAt: { not: null } },
      select: { id: true },
    }),
  ]);

  return !(smsRow?.optedOut || callOptOut);
}

/** STOP (or one of its siblings). Idempotent — a second STOP just re-confirms. */
export async function recordSmsOptOut({ companyId, phone, body }) {
  const e164 = toE164(phone);
  if (!companyId || !e164) return null;
  return db.smsOptOut.upsert({
    where: { companyId_e164: { companyId, e164 } },
    update: { optedOut: true, lastMessageBody: body || null },
    create: { companyId, e164, optedOut: true, lastMessageBody: body || null },
  });
}

/** START or UNSTOP. Only reverses the SMS-channel flag — see the file header. */
export async function recordSmsOptIn({ companyId, phone, body }) {
  const e164 = toE164(phone);
  if (!companyId || !e164) return null;
  return db.smsOptOut.upsert({
    where: { companyId_e164: { companyId, e164 } },
    update: { optedOut: false, lastMessageBody: body || null },
    create: { companyId, e164, optedOut: false, lastMessageBody: body || null },
  });
}
