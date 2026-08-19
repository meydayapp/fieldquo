// app/api/invoices/[id]/request-payment/route.js
//
// Emails the client a link to pay what's still owed on an invoice.
//
// The link goes to the client portal, not to a raw Stripe URL. Two reasons:
// a Stripe Checkout session expires after 24 hours, so a raw link in an inbox
// goes dead by the next morning; and the portal is where the client can see
// what they're paying for before they pay it. The portal mints a fresh
// checkout session at the moment they click Pay.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { lazyClient } from "@/lib/lazyClient";
import { getCurrentMember } from "@/lib/currentMember";
import { SENDER_SELECT } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { ensurePortalToken, portalUrl } from "@/lib/clientPortal";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

export async function POST(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Asking a client for money on the company's behalf is not a view-only act.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "request payment");
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

  if (!invoice.client?.email) {
    return NextResponse.json(
      {
        error: `${invoice.client?.name || "This client"} has no email address on file. Add one on their client record first.`,
      },
      { status: 400 },
    );
  }

  const balance =
    Number(invoice.total || 0) - Number(invoice.amountPaid || 0);

  if (balance <= 0) {
    return NextResponse.json(
      { error: "This invoice is already paid in full." },
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

  // Say so plainly rather than sending an email whose only button 500s.
  const canTakeCard = Boolean(
    company?.stripeAccountId && company?.stripeChargesEnabled,
  );

  const token = await ensurePortalToken(db, invoice.clientId, member.companyId);
  if (!token) {
    return NextResponse.json(
      { error: "Couldn't create a portal link for this client." },
      { status: 500 },
    );
  }

  const url = portalUrl(token, request);
  const { from, replyTo } = await resolveSender(company || {}, member.companyId);
  const body = await request.json().catch(() => ({}));
  const note = String(body?.note || "").trim();

  // Was a second, hand-rolled English template with its own layout and a
  // hardcoded dark button colour that vanished on a dark brand. A client
  // chasing one invoice would receive two emails that looked like they came
  // from different companies. Same builder now, in the client's language,
  // with `kind: "reminder"` changing only the framing.
  const { subject, html, text } = buildInvoiceEmail({
    invoice,
    client: invoice.client,
    company: company || {},
    url,
    canTakeCard,
    note,
    kind: "reminder",
    language: resolveClientLanguage({
      document: invoice,
      client: invoice.client,
      company,
    }),
  });

  await resend.emails.send({
    from,
    replyTo,
    to: invoice.client.email,
    subject,
    html,
    text,
  });

  // ── Chasing payment IS issuing the invoice ────────────────────────────────
  //
  // This route emailed the client a real link to pay and then recorded nothing
  // at all — no status, no sentAt. That was survivable while the portal showed
  // every invoice, and stops being survivable the moment it doesn't: the portal
  // now hides drafts (a draft is the contractor still deciding the figure, and
  // accepted quotes mint one automatically), so a payment request on a draft
  // sent the client to a page where their invoice did not exist. "Nothing
  // outstanding", under the contractor's logo, minutes after being asked to pay.
  //
  // Written only AFTER Resend accepts, for the same reason the send route does
  // it that way: sentAt is a record that something happened, not that somebody
  // intended it.
  //
  // Two deliberate narrowings, both copied from the send route's hard-won
  // shape. A paid or overdue invoice is not dragged back to "sent" because
  // someone chased it. And sentAt is stamped only when it is EMPTY — this
  // route is the reminder path, so overwriting would march the issue date
  // forward with every chase and lose when the client was first billed.
  await db.invoice.update({
    where: { id: invoice.id },
    data: {
      ...(invoice.sentAt ? {} : { sentAt: new Date(), sentToEmail: invoice.client.email }),
      ...(invoice.status === "draft" ? { status: "sent" } : {}),
    },
  });

  return NextResponse.json({
    sent: true,
    to: invoice.client.email,
    balance,
    portalUrl: url,
    // The UI warns when this is false — the client will get an email they
    // can't act on, which is worth knowing before you hit send.
    onlinePaymentsEnabled: canTakeCard,
  });
}
