// app/api/portal/[token]/pay/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createInvoiceCheckoutSession } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { invoiceId } = await request.json();
  if (!invoiceId)
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 },
    );

  const client = await db.client.findUnique({
    where: { portalToken: _params.token },
  });
  if (!client)
    return NextResponse.json(
      { error: "Portal link not found" },
      { status: 404 },
    );

  // Critical: verify the invoice actually belongs to THIS client's token — otherwise
  // any portal token could pay any invoice by guessing IDs.
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, clientId: client.id },
    include: { client: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: client.companyId },
  });
  if (!company.stripeAccountId || !company.stripeChargesEnabled) {
    return NextResponse.json(
      { error: "This company can't accept online payments yet" },
      { status: 400 },
    );
  }

  const baseUrl = getAppOrigin(request);

  const session = await createInvoiceCheckoutSession({
    invoice,
    company,
    successUrl: `${baseUrl}/portal/${_params.token}?paid=true`,
    cancelUrl: `${baseUrl}/portal/${_params.token}`,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
