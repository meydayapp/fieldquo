// lib/email/resend.js
//
// Thin wrapper around Resend. Requires `npm install resend` and RESEND_API_KEY
// in .env. If the key is missing, sends are skipped (logged) rather than
// throwing, so local dev without email configured still works.
//
// IMPORTANT — sender address: Resend only sends from a DOMAIN you've verified
// in the Resend dashboard. You cannot send "from" a gmail.com address (nobody
// can — you don't own the domain). Until you verify a domain, this uses
// Resend's shared `onboarding@resend.dev` sender, which in test mode only
// delivers to the email on your own Resend account. Set EMAIL_FROM once a
// domain is verified (e.g. "FieldQuo <team@fieldquo.com>"). Replies go to
// EMAIL_REPLY_TO regardless, so you can route replies to your Gmail today.

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const DEFAULT_FROM = process.env.EMAIL_FROM || "FieldQuo <onboarding@resend.dev>";
const DEFAULT_REPLY_TO =
  process.env.EMAIL_REPLY_TO || "emilio.daniel.boves@gmail.com";

export async function sendEmail({ to, subject, html, replyTo, from }) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping email to ${to} ("${subject}")`,
    );
    return { skipped: true };
  }

  try {
    const result = await resend.emails.send({
      from: from || DEFAULT_FROM,
      to,
      subject,
      html,
      replyTo: replyTo || DEFAULT_REPLY_TO,
    });
    if (result.error) {
      console.error("[email] Resend error:", result.error);
      return { error: result.error };
    }
    return { id: result.data?.id };
  } catch (err) {
    console.error("[email] send failed:", err.message);
    return { error: err.message };
  }
}
