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
import { senderFor, SENDER_SELECT } from "@/lib/email/resend";
import { ensurePortalToken, portalUrl } from "@/lib/clientPortal";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));

const money = (n) =>
  Number(n || 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

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
  const accent = company?.brandColor || "#bd9d60";
  const { from, replyTo } = senderFor(company || {});
  const body = await request.json().catch(() => ({}));
  const note = String(body?.note || "").trim();

  await resend.emails.send({
    from,
    replyTo,
    to: invoice.client.email,
    subject: `${money(balance)} due — invoice ${invoice.invoiceNumber}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2d2520">
        ${
          company?.logoUrl
            ? `<img src="${company.logoUrl}" alt="${company.name}" style="height:40px;margin-bottom:20px" />`
            : `<div style="font-size:18px;font-weight:bold;margin-bottom:20px">${company?.name || ""}</div>`
        }
        <p>Hi ${invoice.client.name},</p>
        <p>
          Invoice <strong>${invoice.invoiceNumber}</strong> has a balance of
          <strong>${money(balance)}</strong>${
            Number(invoice.amountPaid || 0) > 0
              ? ` (${money(invoice.amountPaid)} already received — thank you)`
              : ""
          }.
        </p>
        ${note ? `<p>${note.replace(/</g, "&lt;")}</p>` : ""}
        <p style="margin:28px 0">
          <a href="${url}" style="background:${accent};color:#2d2520;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold;display:inline-block">
            ${canTakeCard ? "View and pay online" : "View your invoice"}
          </a>
        </p>
        ${
          canTakeCard
            ? ""
            : `<p style="font-size:13px;color:#6b6257">Please get in touch to arrange payment.</p>`
        }
        <p style="font-size:13px;color:#6b6257">
          Questions? Just reply to this email${company?.phone ? ` or call ${company.phone}` : ""}.
        </p>
      </div>
    `,
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
