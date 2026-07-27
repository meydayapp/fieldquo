// app/admin/lib/email/templates.js
//
// One-off transactional emails that aren't driven by a company's editable
// DocumentTemplate blocks. Anything a company should be able to reword
// belongs in Settings > Email Templates instead — this file is for mail with
// fixed, functional content.
//
// This module was previously empty while booking/[companySlug]/confirm
// imported from it, which broke the production build. Dev never noticed,
// because Next only compiles a route once something requests it.

import { sendEmail, senderFor } from "@/lib/email/resend";

function formatWhen(startTime, timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timezone && { timeZone: timezone }),
      timeZoneName: "short",
    }).format(new Date(startTime));
  } catch {
    // An invalid timezone string shouldn't cost someone their confirmation
    // email — fall back to the raw date rather than throwing.
    return new Date(startTime).toString();
  }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Confirms a booking made through a company's public booking page.
 *
 * @param {object}  params
 * @param {string}  params.to            client's email
 * @param {string}  params.companyName
 * @param {string}  params.clientName
 * @param {string}  params.eventTypeName e.g. "On-site estimate"
 * @param {Date}    params.startTime
 * @param {string} [params.location]
 * @param {string} [params.timezone]     IANA zone for display
 * @param {object} [params.company]      full Company row, when available, so
 *                                       the mail sends from a verified domain
 */
export async function sendBookingConfirmationEmail({
  to,
  companyName,
  clientName,
  eventTypeName,
  startTime,
  location,
  timezone,
  company,
}) {
  const when = formatWhen(startTime, timezone);

  const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:24px 12px;background:#F8F4EF;font-family:Arial,Helvetica,sans-serif;color:#2d2520;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #eadfd4;border-radius:10px;overflow:hidden;">
          <tr><td style="background:#1A1917;padding:22px 30px;">
            <span style="color:#bd9d60;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">${esc(companyName)}</span>
          </td></tr>
          <tr><td style="padding:30px;">
            <h1 style="margin:0 0 12px;font-size:25px;line-height:1.3;font-weight:700;color:#2d2520;">You&rsquo;re booked in</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#6b5d52;">
              Hi ${esc(clientName)},<br/><br/>
              Your ${esc(eventTypeName)} with ${esc(companyName)} is confirmed.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;background:#F8F4EF;border:1px solid #eadfd4;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;font-size:13px;color:#6b5d52;">When</td>
                <td style="padding:14px 16px;font-size:15px;color:#2d2520;font-weight:700;text-align:right;">${esc(when)}</td>
              </tr>
              ${
                location
                  ? `<tr>
                <td style="padding:14px 16px;border-top:1px solid #eadfd4;font-size:13px;color:#6b5d52;">Where</td>
                <td style="padding:14px 16px;border-top:1px solid #eadfd4;font-size:15px;color:#2d2520;font-weight:700;text-align:right;">${esc(location)}</td>
              </tr>`
                  : ""
              }
            </table>
            <p style="margin:0;font-size:15px;line-height:1.75;color:#6b5d52;">
              Need to change or cancel? Just reply to this email.
            </p>
          </td></tr>
          <tr><td style="background:#F8F4EF;border-top:1px solid #eadfd4;padding:20px 30px;font-size:11px;line-height:1.6;color:#6b5d52;">
            ${esc(companyName)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return sendEmail({
    to,
    subject: `Confirmed: ${eventTypeName} with ${companyName}`,
    html,
    // Uses the company's verified domain when the full row is passed, and
    // otherwise the shared sender under the company's display name.
    ...senderFor(company || { name: companyName }),
  });
}
