// lib/trial/phoneVerifyBilling.js
//
// What verifying the trial's mobile costs the company, and from which wallet.
//
// ══ The owner's decision (2026-10-04) ═══════════════════════════════════════
//
// The three Twilio charges a verification can run up — the code texted from
// FieldQuo's own number (US$0.0083 a segment), Twilio Verify for a US mobile
// while our number cannot text the US (US$0.05 per successful verification,
// plus the same ~US$0.0083 per text it sends), and the Lookup that refuses
// VoIP and landlines (US$0.008) — are charged to the company's PHONE & TEXT
// credit: the "voice" wallet in lib/voice/credits.js that crew texts,
// business-number texts and calls, and the AI receptionist's minutes draw
// from. Never the AI wallet. The kind below is not in credits.js's AI_KINDS,
// so poolForKind sends it to the voice wallet — that list is the one place a
// wallet is decided, and this file does not get to choose.
//
// ══ The price: cost × 2, with the text floor ════════════════════════════════
//
// lib/phoneUsage/pricing.js's rule (owner, 2026-10-03), so a verification
// text costs exactly what any other text costs:
//
//   code text, our number   floor 2¢ at once; settled to Twilio's own price
//                           × 2 by the hourly cron (enqueueUsage) — 0.83¢ ×
//                           2 = 1.66¢, so the 2¢ floor stands for a plain
//                           one-segment code
//   Verify, per text sent   2¢ — the same ~0.83¢ channel fee, the same floor.
//                           No message SID comes back from Verify, so there
//                           is no record to settle against and the floor IS
//                           the charge
//   Verify, on success      5¢ × 2 = 10¢, charged once, when the code is right
//   Lookup                  0.8¢ × 2 = 1.6¢ → 2¢ (rounded UP to the cent, as
//                           every phone charge is); charged when FieldQuo
//                           actually asks Twilio — a number already looked up
//                           in the last 30 days is reused and costs nothing,
//                           and a Lookup that REFUSES the number is still
//                           charged, because Twilio charged for it
//
// Worked: a Canadian mobile, first time → 2¢ Lookup + 2¢ text = 4¢. A resend
// → 2¢. A US mobile through Verify → 2¢ + 2¢ + 10¢ = 14¢.
//
// ══ Checked before anything is spent ═══════════════════════════════════════
//
// The whole send is priced first — the Lookup if one will be needed, the text,
// and Verify's success fee on that path — and a balance below it refuses with
// reasonKey "no_phone_credit" before Twilio is asked anything. The screen turns
// that into a phone & text credit top-up (it returns to the verify page). A
// debit never checks the balance (credits.js debitCredit): a resend racing a
// top-up can take a balance a few cents under zero, which the next top-up
// covers, rather than a code that was sent and not charged.

import { chargeCentsFor, floorCents } from "@/lib/phoneUsage/pricing";

/** The ledger kind. Voice wallet — see the header. */
export const PHONE_VERIFY_KIND = "phone_verification";

/** Twilio's list prices (checked 2026-10-03), in micros of a US dollar. */
export const TWILIO_SMS_SEGMENT_MICROS = 8_300;
export const TWILIO_VERIFY_SUCCESS_MICROS = 50_000;
export const TWILIO_LOOKUP_MICROS = 8_000;

/** cost × 2, rounded up to the cent. PURE. */
function doubled(micros) {
  return Math.ceil((micros * 2) / 10_000);
}

/** What each piece is charged, in cents. PURE. */
export const PHONE_VERIFY_CHARGES = Object.freeze({
  // The floor now; settlement tops up to Twilio's price × 2 if that is more.
  text: chargeCentsFor({ resource: "message", units: 1, hasMedia: false, providerCostMicros: null }),
  // Verify's channel text: no record to settle, so max(floor, list × 2).
  verifyText: Math.max(floorCents({ resource: "message", units: 1 }), doubled(TWILIO_SMS_SEGMENT_MICROS)),
  verifySuccess: doubled(TWILIO_VERIFY_SUCCESS_MICROS),
  lookup: doubled(TWILIO_LOOKUP_MICROS),
});

/**
 * What one send needs on the balance before it may start. PURE.
 *
 * @param lookupNeeded  true when no stored line type can be reused
 * @param sender        "sms" (our number) | "verify"
 */
export function sendNeedCents({ lookupNeeded = true, sender = "sms" } = {}) {
  const c = PHONE_VERIFY_CHARGES;
  return (lookupNeeded ? c.lookup : 0) + (sender === "verify" ? c.verifyText + c.verifySuccess : c.text);
}

/** The verdict for one send. PURE. */
export function sendCreditVerdict({ balanceCents, lookupNeeded, sender }) {
  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;
  const needCents = sendNeedCents({ lookupNeeded, sender });
  const ok = balance >= needCents;
  return { ok, needCents, balanceCents: balance, shortfallCents: ok ? 0 : needCents - balance };
}

/** The statement line for each charge — read by a person reconciling. */
export function chargeNote(kind, masked) {
  const n = masked ? ` ${masked}` : "";
  switch (kind) {
    case "lookup":
      return `Phone verification — number check${n} (${PHONE_VERIFY_CHARGES.lookup}¢)`;
    case "text":
      return `Phone verification — code texted to${n} (${PHONE_VERIFY_CHARGES.text}¢)`;
    case "verifyText":
      return `Phone verification — code texted to${n} by Twilio Verify (${PHONE_VERIFY_CHARGES.verifyText}¢)`;
    case "verifySuccess":
      return `Phone verification — confirmed by Twilio Verify${n} (${PHONE_VERIFY_CHARGES.verifySuccess}¢)`;
    default:
      return "Phone verification";
  }
}
