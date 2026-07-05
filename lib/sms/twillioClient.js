// lib/sms/twilioClient.js
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

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

export async function sendSms({ to, body }) {
  const formatted = toE164(to);

  if (!formatted) {
    throw new Error(`Could not normalize phone number for SMS: "${to}"`);
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    throw new Error("TWILIO_PHONE_NUMBER is not configured");
  }

  try {
    const message = await client.messages.create({
      to: formatted,
      from: process.env.TWILIO_PHONE_NUMBER,
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
