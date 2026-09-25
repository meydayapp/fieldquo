// lib/messaging/ownSend.js
//
// The send for FieldQuo's own two channels — the site chat widget and the
// shared SMS number. Reached only through lib/messaging/send.js's
// sendOnChannel, which is the one router every reply goes through.
//
// ══ Web chat: the Message row IS the transport ═════════════════════════════
//
// There is no third party to hand the text to. The visitor's widget polls
// /api/chat/<slug> and reads the thread's outbound messages, so "sending" a
// web-chat message is writing the row the caller writes anyway after this
// returns. This function therefore does nothing but mint the id — and it is
// still a function here, on purpose: the reply route, the AI employee's
// deliver and any later caller all ask sendOnChannel, and a platform that
// short-circuited that router would be the one that quietly stopped obeying
// its refusals (private notes, kinds it cannot carry).
//
// ══ SMS: the system number, with the opt-out checked first ═════════════════
//
// lib/sms/twilioClient.js's sendSms does NOT check consent — every caller is
// responsible (its header says so). This is a caller. maySms() is asked
// before every send, so a STOP recorded by /api/sms/inbound silences the AI
// employee and the human reply alike, from the same table.

import { sendSms } from "@/lib/sms/twilioClient";
import { maySms } from "@/lib/sms/optOut";
import { systemSmsNumber } from "@/lib/sms/systemNumber";

/** Web chat. Always succeeds; the caller stores the row. */
export async function sendWebChatMessage({ text }) {
  if (!String(text || "").trim()) return { ok: false, reason: "empty" };
  return { ok: true, externalId: `web:${crypto.randomUUID()}` };
}

/**
 * SMS from the shared system number.
 *
 * @param channel              the company's "sms" MessagingChannel row —
 *                             companyId comes from it, never from the caller
 * @param recipientExternalId  the customer's E.164 phone (the thread's
 *                             participantExternalId)
 */
export async function sendSmsChatMessage({ channel, recipientExternalId, text }) {
  const companyId = channel?.companyId || null;
  const to = String(recipientExternalId || "").trim();
  if (!companyId || !to) return { ok: false, reason: "no_recipient" };

  // Greyed out on the settings page until FieldQuo holds one; refused by
  // name here so a caller that got past the screen still cannot send from a
  // number that does not exist.
  const from = await systemSmsNumber();
  if (!from) return { ok: false, reason: "no_system_number", message: "FieldQuo has no SMS number yet." };

  if (!(await maySms({ companyId, phone: to }))) {
    return { ok: false, reason: "opted_out", message: "This number has texted STOP." };
  }

  try {
    // purpose "thread_reply" is what lets the status callback write the
    // text's fate back onto this reply's Message row (lib/sms/deliveryStore.js
    // mirrorOntoMessage) — the SID returned below becomes its externalId.
    const sent = await sendSms({ to, from, body: String(text || "").slice(0, 1600), companyId, purpose: "thread_reply" });
    if (!sent?.success) return { ok: false, reason: "sms_failed", message: sent?.error || "Twilio refused the text." };
    return { ok: true, externalId: sent.sid || `sms:${crypto.randomUUID()}`, simulated: Boolean(sent.simulated) };
  } catch (err) {
    return { ok: false, reason: "sms_failed", message: err?.message || "Twilio refused the text." };
  }
}
