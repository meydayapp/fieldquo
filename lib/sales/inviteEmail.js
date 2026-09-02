// lib/sales/inviteEmail.js
//
// "You've been added to the FieldQuo sales team" — the one place that builds
// and sends it, and the only place that knows whether the send happened.
//
// ══ Why FieldQuo's own branding is CORRECT here ═══════════════════════════
//
// AGENTS.md's white-label rule is about what a HOMEOWNER sees: a quote, an
// invoice, a booking page, the From line on a client email. A stranger
// comparing three contractors must not be able to tell that two of them run the
// same software.
//
// This email is FieldQuo writing to its own new employee. There is no
// contractor in the story and nothing to white-label — the sender IS FieldQuo,
// and dressing it as anything else would be the actual dishonesty. It is the
// same class as lib/email/teamInvite.js's platform-sender fix and
// lib/billing/notify.js: FieldQuo's own mail, from FieldQuo's own domain.
//
// ══ Which sender, and why not sendEmail's default ═════════════════════════
//
// getPlatformFrom(). lib/email/teamInvite.js's header records what happens
// otherwise: sendEmail falls back to `EMAIL_FROM || onboarding@resend.dev`,
// EMAIL_FROM is not set on the deployment, and Resend refuses sandbox mail
// addressed to anyone but the account owner. A refused send is an API error
// rather than an email, so it never appears in the Resend dashboard either —
// the invitation looks sent from every angle except the recipient's inbox.
//
// So the outcome is RETURNED, not swallowed, and the route reports it. A screen
// that says "invite sent" when nothing was sent is the dead control AGENTS.md's
// first rule is about, wearing a green tick.

import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { getAppOrigin } from "@/lib/appUrl";
import { INVITE_TTL_DAYS } from "./invite";

// Measured, not chosen by eye — the same figures lib/email/inviteEmail.js
// records. #9ca3af is 2.54:1 on a white card against a 4.5:1 requirement, and
// it was being used for the "copy and paste this link" line, which is the one
// line a reader needs precisely when something has already gone wrong. #595f6b
// is 6.41:1 on the card.
const FAINT = "#595f6b";
const INK = "#1a1917";
const BRAND = "#ff5a00";

function inviteHTML({ name, acceptUrl, inviterEmail }) {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi,";
  return `
<div style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND};margin-bottom:20px;">FieldQuo</div>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};">You've been added to the FieldQuo sales team</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK};">${greeting}</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK};">
      ${escapeHtml(inviterEmail || "A FieldQuo superadmin")} has set up your sales portal account.
      Choose a password below and you're in.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${INK};">
      The portal shows the companies credited to you and where each one is in its
      first months. It is read-only — attribution and commission are recorded by
      FieldQuo's own systems.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${acceptUrl}" style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:8px;">Set your password</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${FAINT};">
      This link works once and expires in ${INVITE_TTL_DAYS} days.
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${FAINT};">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${FAINT};word-break:break-all;">${acceptUrl}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:${FAINT};">
      If you weren't expecting this, you can ignore this email.
    </p>
  </div>
</div>`.trim();
}

// The invitee's own name and the inviter's address are the only interpolated
// values, and both come from a superadmin's keyboard rather than from a
// stranger — but an email is not a place to find out that assumption was
// wrong, and the cost of escaping is nothing.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends one rep invitation.
 *
 * Never throws — a Resend hiccup must not take down the route that just created
 * the SalesRep row. The outcome comes back so the screen can say what actually
 * happened, including "the account exists but no email went out, here is why".
 *
 * @returns `{ sent: boolean, error?: string, id?: string|null }`
 */
export async function sendSalesInviteEmail({
  request,
  to,
  name,
  token,
  inviterEmail,
}) {
  if (!token) return { sent: false, error: "The invitation has no token to link to." };

  // A link built from `undefined` is worse than no email — the person clicks
  // it, lands nowhere, and nobody finds out. getAppOrigin throws a message
  // naming the variable to set; that message is the one worth showing.
  let origin;
  try {
    origin = getAppOrigin(request);
  } catch (err) {
    return { sent: false, error: err.message };
  }

  const acceptUrl = `${origin}/sales/invite/${encodeURIComponent(token)}`;

  try {
    const from = await getPlatformFrom();
    const result = await sendEmail({
      from,
      to,
      subject: "Set up your FieldQuo sales portal account",
      html: inviteHTML({ name, acceptUrl, inviterEmail }),
      // Plain-text alternative, same reason as every other send in the product:
      // HTML-only mail scores worse with corporate filters, and an invitation
      // in a junk folder is an invitation nobody got.
      text:
        `${inviterEmail || "A FieldQuo superadmin"} has set up your FieldQuo sales portal account.\n\n` +
        `Set your password: ${acceptUrl}\n\n` +
        `This link works once and expires in ${INVITE_TTL_DAYS} days.\n\n` +
        `If you weren't expecting this, you can ignore this email.`,
    });

    if (result?.error) {
      // sendEmail has already written this to the platform error log.
      const message =
        typeof result.error === "string"
          ? result.error
          : result.error?.message || "Resend rejected the message.";
      return { sent: false, error: `Email provider refused the send: ${message}` };
    }
    if (result?.skipped) {
      return {
        sent: false,
        error:
          "Email isn't configured on this deployment (RESEND_API_KEY is missing), so no invitation was sent. Use Resend invite once it is.",
      };
    }
    return { sent: true, id: result?.id || null };
  } catch (err) {
    return {
      sent: false,
      error: err?.message || "The invitation email could not be sent.",
    };
  }
}
