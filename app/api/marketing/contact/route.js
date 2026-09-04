// app/api/marketing/contact/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
// Through the shared sender. There is no tenant here — this is FieldQuo's own
// sales inbox, not a company's mail — so no companyId is passed and the demo
// interception in lib/email/resend.js correctly never fires. It still goes
// through sendEmail because that file is now the only place a Resend client
// exists, and an exception "just for this one" is how the other thirteen
// started.
import { sendEmail } from "@/lib/email/resend";

// Public — FieldQuo's own sales/demo-request lead, distinct from a tenant company's
// LeadRequest. Stored on PlatformAdmin's side conceptually, but since there's no
// dedicated model for it yet, this just emails you directly rather than writing to
// a table nothing reads from.
/**
 * Every field here is typed by an anonymous stranger and then interpolated
 * into an HTML email, so it is escaped rather than trusted.
 *
 * Not theoretical, and not only about scripts: the body of this mail is a
 * lead, read by a person deciding whether to ring somebody back. A message
 * containing `<a href="…">Click to view the full enquiry</a>` renders as a
 * working link inside what looks like our own notification, and the reader has
 * no way to tell our markup from the sender's. Escaping is what keeps the
 * envelope ours and the contents theirs.
 */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function POST(request) {
  const body = await request.json();
  const { email, name, message, source } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const result = await sendEmail({
    from: "FieldQuo <hello@fieldquo.com>",
    // The subject is a header rather than markup, so it is stripped of the
    // characters that would let a name split it into two headers instead of
    // being HTML-escaped into something a mail client shows literally.
    subject: `New demo request${name ? ` from ${String(name).replace(/[\r\n]+/g, " ").trim()}` : ""}`,
    to: process.env.SALES_NOTIFICATION_EMAIL || "emilio@fieldquo.com",
    html: `
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${name ? `<p><strong>Name:</strong> ${escapeHtml(name)}</p>` : ""}
      ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ""}
      <p><strong>Source:</strong> ${escapeHtml(source || "unknown")}</p>
    `,
  });

  // sendEmail returns its failures rather than throwing, so the 500 the old
  // `resend.emails.send()` produced on a bad key has to be produced here. A
  // silent `success: true` on a lead that reached nobody is the exact failure
  // class AGENTS.md names: a control that appears to work and doesn't.
  if (result?.error) {
    const message =
      typeof result.error === "string" ? result.error : result.error?.message || "Send failed";
    return NextResponse.json(
      { error: `Couldn't pass that on — ${message}. Email hello@fieldquo.com directly.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
