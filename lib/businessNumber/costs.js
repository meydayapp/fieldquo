// lib/businessNumber/costs.js
//
// What bringing a number costs the company, said before they start. PURE.
//
// ══ The same wallet, the same prices, as every other number ═════════════════
//
// Companies pay for phone things from ONE prepaid balance (lib/voice/credits.js
// — "the phone balance" on Settings → AI credit): a number's first month is
// taken up front and each month after by a cron, crew texts are metered per
// message, receptionist calls per minute. A brought number follows that model
// exactly, and reuses the existing prices rather than inventing a second
// opinion about what a phone number or a text is worth — the reasoning
// CREW_LINE_MONTHLY_CENTS already gives ("two prices for one commodity is the
// kind of thing that drifts apart").
//
//   rental    CREW_LINE_MONTHLY_CENTS ($4.00/month) — the local-number price.
//   texts     CREW_SMS_CENTS per segment (2¢), CREW_MMS_CENTS per photo (5¢),
//             in AND out — lib/crew/messaging.js holds the reasoning and the
//             Twilio rates those were set against.
//   calls     BUSINESS_CALL_CENTS_PER_MINUTE (below) — NEW, because nothing in
//             the product forwarded or bridged a plain call before. Only on a
//             PORTED number: a hosted number's calls never touch FieldQuo.
//   port fee  none from FieldQuo. Twilio: no fee for US ports (its support
//             article "How much does it cost to port my number to Twilio");
//             a Canadian port fee is not published — see PORT_FEE_NOTE.
//
// ══ What it costs FieldQuo (Twilio list prices, checked 2026-10-03) ══════════
//
//   hosted number (bring-your-own)   $0.50/month   twilio.com/en-us/sms/pricing/us
//   local number (a ported one)      $1.15/month   twilio.com/en-us/voice/pricing/ca + /us
//   SMS segment, in or out           $0.0083 + carrier fees (CA outbound up to
//                                    $0.0087 Bell; CA INBOUND carrier fees are
//                                    now listed at up to $0.0323 Bell/Virgin,
//                                    which makes an inbound Bell text cost
//                                    ~4.1¢ against a 2¢ price — flagged in the
//                                    report as a margin to revisit, not
//                                    silently repriced here)
//   inbound call minute (local)      $0.0085
//   outbound call minute (US/CA)     $0.0140
//   a forwarded minute = in + out  = 2.25¢;  a bridged minute = out + out = 2.8¢
//
// The call price is a PRICING decision the owner has not made, so it is
// env-overridable and stated on screen before anything is charged, the same
// discipline CREW_SMS_CENTS keeps.

import { CREW_LINE_MONTHLY_CENTS } from "@/lib/voice/credits";
import { TEXT_FLOOR_CENTS as CREW_SMS_CENTS, PHOTO_FLOOR_CENTS as CREW_MMS_CENTS, CALL_FLOOR_CENTS_PER_MINUTE, MARKUP } from "@/lib/phoneUsage/pricing";

/**
 * Per connected minute of a forwarded or bridged call (both legs together) —
 * the FLOOR. Since 2026-10-03 every text and call is billed at Twilio's actual
 * price × 2 with these flat prices as the minimum (lib/phoneUsage/pricing.js,
 * which owns the numbers; lib/phoneUsage/settle.js tops the floor up).
 */
export const BUSINESS_CALL_CENTS_PER_MINUTE = CALL_FLOOR_CENTS_PER_MINUTE;

/** The monthly rental. One constant, shared with the crew line. */
export const BROUGHT_NUMBER_MONTHLY_CENTS = CREW_LINE_MONTHLY_CENTS;

export const TEXT_CENTS = CREW_SMS_CENTS;
export const PHOTO_CENTS = CREW_MMS_CENTS;

/** FieldQuo's port fee. Zero, and a number so the screen prints "$0.00". */
export const PORT_FEE_CENTS = 0;

export const PORT_FEE_NOTE = {
  US: "Twilio charges no fee to port a US number.",
  CA: "FieldQuo charges nothing to move it. Twilio does not publish a Canadian port fee; if it charges one, we'll tell you before filing — nothing is filed without your say-so.",
};

/** Segments in an SMS body (GSM-7 160/153, UCS-2 70/67). PURE. */
export function smsSegments(body) {
  const text = String(body || "");
  if (!text) return 1;
  // eslint-disable-next-line no-control-regex
  const gsm = /^[\u0000-\u007F£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà€^{}\\[~\]|]*$/.test(text);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const length = [...text].length;
  return length <= single ? 1 : Math.ceil(length / multi);
}

/** One text's price. Capped at ten segments, like the crew meter. */
export function textCents({ body = "", hasMedia = false } = {}) {
  if (hasMedia) return PHOTO_CENTS;
  return Math.min(10, smsSegments(body)) * TEXT_CENTS;
}

/** One call's price, rounded UP to the minute with a one-minute floor once connected. */
export function callCents(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return 0;
  return Math.ceil(s / 60) * BUSINESS_CALL_CENTS_PER_MINUTE;
}

/**
 * The monthly estimate the screen shows before anybody starts. PURE.
 *
 * @param path         hosted_sms | port
 * @param textsIn      texts received a month (the company's own last 30 days when known)
 * @param textsOut     texts sent a month
 * @param callMinutes  connected call minutes a month (port only)
 */
export function monthlyEstimate({ path, textsIn = 0, textsOut = 0, callMinutes = 0 } = {}) {
  const n = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : 0);
  const rentCents = BROUGHT_NUMBER_MONTHLY_CENTS;
  const textCentsTotal = (n(textsIn) + n(textsOut)) * TEXT_CENTS;
  const callCentsTotal = path === "port" ? n(callMinutes) * BUSINESS_CALL_CENTS_PER_MINUTE : 0;
  return {
    path,
    rentCents,
    textCents: textCentsTotal,
    callCents: callCentsTotal,
    totalCents: rentCents + textCentsTotal + callCentsTotal,
    upfrontCents: rentCents + PORT_FEE_CENTS,
    // Texts and calls are billed at the carrier's price × MARKUP with these
    // rates as the MINIMUM, so the estimate is a floor: a month heavy in
    // texts from carriers with higher fees costs more. The screen says so.
    isMinimum: true,
    rates: {
      markup: MARKUP,
      rentCents,
      textCents: TEXT_CENTS,
      photoCents: PHOTO_CENTS,
      callCentsPerMinute: path === "port" ? BUSINESS_CALL_CENTS_PER_MINUTE : null,
      portFeeCents: path === "port" ? PORT_FEE_CENTS : null,
    },
    inputs: { textsIn: n(textsIn), textsOut: n(textsOut), callMinutes: path === "port" ? n(callMinutes) : 0 },
  };
}

/** The example volumes used when the company has no history to estimate from. */
export const EXAMPLE_VOLUMES = Object.freeze({ textsIn: 150, textsOut: 150, callMinutes: 300 });
