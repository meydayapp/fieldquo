// app/api/portal/[token]/pay/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createInvoiceCheckoutSession } from "@/lib/stripe";

export async function POST(request, { params }) {
  const { invoiceId } = await request.json();
  if (!invoiceId)
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 },
    );

  const client = await db.client.findUnique({
    where: { portalToken: params.token },
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const session = await createInvoiceCheckoutSession({
    invoice,
    company,
    successUrl: `${baseUrl}/portal/${params.token}?paid=true`,
    cancelUrl: `${baseUrl}/portal/${params.token}`,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
