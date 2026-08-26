// lib/sms/twilioClient.js
import twilio from "twilio";
import { lazyClient } from "@/lib/lazyClient";
import { systemSmsNumber } from "@/lib/sms/systemNumber";

// Two supported credential styles:
//
//   1. API key (preferred) — TWILIO_API_KEY_SID (starts "SK") plus
//      TWILIO_API_KEY_SECRET. An API key authenticates as itself, so the
//      account it acts on must be passed separately via `accountSid`; miss
//      that and every call fails with a confusing auth error. Keys can be
//      revoked individually without rotating the account's auth token.
//   2. Account SID + auth token — the account's master credentials. Works,
//      but there's only one of them and revoking it breaks everything else
//      using it.
//
// Either way TWILIO_ACCOUNT_SID (starts "AC") is required.
//
// Lazy — see lib/lazyClient.js. twilio() throws on empty credentials, and at
// module scope that fails `next build` rather than the SMS call itself.
const client = lazyClient(() => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;

  if (keySid && keySecret) {
    return twilio(keySid, keySecret, { accountSid });
  }
  return twilio(accountSid, process.env.TWILIO_AUTH_TOKEN);
});

// The REST client itself, for the handful of callers that manage the ACCOUNT
// rather than send a message — the crew inbox reads and sets a number's SMS
// webhook (lib/crew/line.js). Exported rather than re-created there so there is
// one place that knows how these credentials are assembled; a second `twilio()`
// call elsewhere is how the API-key-vs-auth-token subtlety above gets lost.
export { client as twilioRest };

/**
 * Can we talk to Twilio's API at all?
 *
 * Note what this does NOT cover: verifying an inbound webhook signature needs
 * the account's AUTH TOKEN specifically (the signature is an HMAC keyed on it),
 * and an API key cannot stand in. So a deployment can be perfectly able to send
 * SMS and manage numbers while being unable to accept a single inbound one. The
 * two are checked separately on purpose — see crewSignatureConfigured().
 */
export function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      (process.env.TWILIO_AUTH_TOKEN ||
        (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET)),
  );
}

// Twilio requires E.164 format (+15145551234). This does a best-effort normalize for
// North American numbers only — if you onboard companies outside NA, this needs a real
// phone-parsing library (libphonenumber-js) instead of the naive regex below.
export function toE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;

  return null; // couldn't confidently normalize — caller should handle null
}

// `from` lets a caller send from a company's OWN provisioned SMS number instead
// of FieldQuo's shared one — the white-label path. It must be a number the
// Twilio account actually controls (bought or hosted); you cannot put a
// contractor's personal cell here, because carriers block sending "from" a
// number you don't own (A2P anti-spoofing). Callers pass the company number
// when it exists and is SMS-capable; otherwise it falls back to the shared
// system number, and the message body already carries the company name so the
// recipient still knows who it's from.
export async function sendSms({ to, body, from }) {
  const formatted = toE164(to);

  if (!formatted) {
    throw new Error(`Could not normalize phone number for SMS: "${to}"`);
  }

  // A bought number wins over a configured one — see lib/sms/systemNumber.js
  // for why configuration cannot be trusted to name a number we own.
  const fromNumber = from || (await systemSmsNumber());
  if (!fromNumber) {
    throw new Error(
      "No SMS 'from' number: FieldQuo holds no system number and TWILIO_PHONE_NUMBER is unset",
    );
  }

  try {
    const message = await client.messages.create({
      to: formatted,
      from: fromNumber,
      body,
    });
    return { success: true, sid: message.sid };
  } catch (err) {
    // Twilio throws on invalid numbers, opted-out recipients, etc. — don't let an SMS
    // failure blow up a request that also does other work (e.g. marking a job complete).
    // Callers should catch this and decide whether to surface it or just log it.
    console.error("SMS send failed:", err.message);
    return { success: false, error: err.message };
  }
}
