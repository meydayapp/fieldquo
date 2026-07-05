// app/api/invoices/[id]/checkout-link/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { createInvoiceCheckoutSession } from "@/lib/stripe";

export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await db.invoice.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: { client: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  if (!company.stripeAccountId || !company.stripeChargesEnabled) {
    return NextResponse.json(
      {
        error:
          "This company hasn't finished connecting Stripe yet — set that up in Settings → Payments",
      },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const session = await createInvoiceCheckoutSession({
    invoice,
    company,
    successUrl: `${baseUrl}/app/invoices/${invoice.id}?paid=true`,
    cancelUrl: `${baseUrl}/app/invoices/${invoice.id}`,
  });

  await db.invoice.update({
    where: { id: invoice.id },
    data: { stripeCheckoutUrl: session.url },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
