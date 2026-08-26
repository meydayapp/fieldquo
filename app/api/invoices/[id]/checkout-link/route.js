// app/api/invoices/[id]/checkout-link/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { createInvoiceCheckoutSession } from "@/lib/stripe";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── Minting a checkout session is taking a payment ──────────────────────
  //
  // This handler had no permission check of any kind: a session was enough to
  // open a Stripe Checkout on the company's connected account and stamp the
  // URL onto the invoice. Nothing in the app calls it — it is an orphan left
  // over from before the client portal minted sessions on click — and an
  // orphan is not proof nothing reaches it, so it is gated rather than
  // deleted, exactly like the templates CRUD beside it.
  //
  // Same pair the service-plan setup route asks for: the invoices level to
  // touch the invoice, and the `payments` toggle to collect against it. A
  // Dispatcher holds the first and not the second, which is the split the
  // preset describes.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "invoices", "view_create_edit", "bill this invoice");
    requireToggle(full, "payments", "take a payment on an invoice");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const invoice = await db.invoice.findFirst({
    where: { id: _params.id, companyId: member.companyId },
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

  const baseUrl = getAppOrigin(request);

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
