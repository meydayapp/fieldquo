// app/api/marketing/contact/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Public — FieldQuo's own sales/demo-request lead, distinct from a tenant company's
// LeadRequest. Stored on PlatformAdmin's side conceptually, but since there's no
// dedicated model for it yet, this just emails you directly rather than writing to
// a table nothing reads from.
export async function POST(request) {
  const body = await request.json();
  const { email, name, message, source } = body;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  await resend.emails.send({
    from: "FieldQuo <hello@fieldquo.com>",
    to: process.env.SALES_NOTIFICATION_EMAIL || "emilio@fieldquo.com",
    subject: `New demo request${name ? ` from ${name}` : ""}`,
    html: `
      <p><strong>Email:</strong> ${email}</p>
      ${name ? `<p><strong>Name:</strong> ${name}</p>` : ""}
      ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
      <p><strong>Source:</strong> ${source || "unknown"}</p>
    `,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
