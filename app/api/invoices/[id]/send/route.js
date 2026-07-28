// app/api/invoices/[id]/send/route.js
//
// Actually emails the invoice to the client.
//
// ── The same bug as quotes, in the same shape ───────────────────────────────
//
// The invoice page's "Send" called PATCH { status: "sent" }. It changed a word
// on screen, then hid itself because the status was no longer draft, and
// nothing was ever sent. `Invoice.sentAt` recorded an intention rather than an
// event — a distinction that stops being academic the first time a client says
// "I never got an invoice" and the company points at a timestamp.
//
// ── Why this links to the portal, not to a PDF ──────────────────────────────
//
// The client portal shows what's owed, what's been paid, and mints a fresh
// Stripe checkout session at the moment they press Pay. A raw Stripe link
// expires in 24 hours; an attached PDF can't take a payment at all. Same
// reasoning as request-payment, which this deliberately mirrors so the two
// emails a client receives about one invoice behave identically.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { sendEmail, SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { ensurePortalToken, portalUrl } from "@/lib/clientPortal";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function POST(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "send invoices");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    include: { client: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = invoice.client?.email?.trim();
  if (!to) {
    return NextResponse.json(
      {
        error: `${invoice.client?.name || "This client"} has no email address on file. Add one on their client record, then send.`,
      },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      ...SENDER_SELECT,
      logoUrl: true,
      brandColor: true,
      phone: true,
      paymentTerms: true,
      paymentMethods: true,
      defaultLanguage: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
    },
  });

  const token = await ensurePortalToken(db, invoice.clientId, member.companyId);
  if (!token) {
    return NextResponse.json(
      { error: "Couldn't create a portal link for this client." },
      { status: 500 },
    );
  }

  // Whether the Pay button in the email will actually work. Said plainly in
  // the email rather than shown as a button that 500s on tap.
  const canTakeCard = Boolean(
    company?.stripeAccountId && company?.stripeChargesEnabled,
  );

  const { from, replyTo } = await resolveSender(company || {}, member.companyId);
  const { subject, html, text } = buildInvoiceEmail({
    invoice,
    client: invoice.client,
    company: company || {},
    url: portalUrl(token, request),
    canTakeCard,
    language: resolveClientLanguage({
      document: invoice,
      client: invoice.client,
      company,
    }),
  });

  const result = await sendEmail({ to, subject, html, text, from, replyTo });

  if (result?.skipped) {
    return NextResponse.json(
      {
        error:
          "Email isn't configured on this deployment yet — RESEND_API_KEY is missing, so nothing was sent.",
      },
      { status: 503 },
    );
  }

  if (result?.error) {
    const message =
      typeof result.error === "string"
        ? result.error
        : result.error?.message || "Send failed";
    return NextResponse.json(
      {
        error: /not verified|testing emails|can only send/i.test(message)
          ? "Resend only delivers to your own account address until a sending domain is verified. Set one up under Settings → Email Domain."
          : `The email couldn't be sent. ${message}`,
      },
      { status: 502 },
    );
  }

  // Only after the send is accepted.
  const updated = await db.invoice.update({
    where: { id: invoice.id },
    data: {
      sentAt: new Date(),
      sentToEmail: to,
      // Don't drag a paid or overdue invoice back to "sent" because someone
      // emailed a copy of it.
      ...(invoice.status === "draft" ? { status: "sent" } : {}),
    },
    select: { status: true, sentAt: true, sentToEmail: true },
  });

  return NextResponse.json({ ...updated, to, messageId: result?.id || null });
}
