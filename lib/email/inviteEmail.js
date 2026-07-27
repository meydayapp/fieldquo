// lib/email/inviteEmail.js
// Branded HTML for a team invitation. Kept simple and inline-styled for email
// client compatibility.

export function inviteEmailHTML({ orgName, inviterName, role, acceptUrl }) {
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : "team member";
  return `
  <!DOCTYPE html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
      <div style="max-width:560px;margin:0 auto;padding:0;">
        <div style="background:#111827;color:#ffffff;padding:32px 30px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;">You're invited to join ${orgName}</h1>
          <p style="margin:8px 0 0 0;opacity:0.85;font-size:14px;">on FieldQuo</p>
        </div>
        <div style="background:#ffffff;padding:32px 30px;">
          <p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;">
            ${inviterName} has invited you to join <strong>${orgName}</strong> as a
            <strong>${roleLabel}</strong>.
          </p>
          <p style="font-size:14px;line-height:1.7;color:#4b5563;margin:0 0 28px 0;">
            Click below to set up your login and get started. This invite is tied
            to your email address.
          </p>
          <div style="text-align:center;margin:0 0 28px 0;">
            <a href="${acceptUrl}"
              style="display:inline-block;padding:14px 36px;background:#111827;color:#ffffff !important;
                     text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
              Accept invitation
            </a>
          </div>
          <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${acceptUrl}" style="color:#6b7280;">${acceptUrl}</a>
          </p>
        </div>
        <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">
          <p style="margin:0;">If you weren't expecting this, you can ignore this email.</p>
        </div>
      </div>
    </body>
  </html>`;
}
