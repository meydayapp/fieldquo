// app/api/invoices/[id]/checkout-link/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { latestInFamily, refreshFamilyLedger } from "@/lib/invoices/family";
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

  // The CURRENT document, with its balance refreshed from the family's
  // payments before the amount reaches Stripe — see portal/[token]/pay and
  // lib/invoices/family.js. A link minted on v1 charges v2's balance.
  await refreshFamilyLedger(db, invoice.id);
  const current = await latestInFamily(db, invoice.id, { include: { client: true } });
  if (!current)
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
    invoice: current,
    company,
    successUrl: `${baseUrl}/app/invoices/${current.id}?paid=true`,
    cancelUrl: `${baseUrl}/app/invoices/${current.id}`,
  });

  // Scoped by companyId as well as id: `current` is the latest version of a
  // family whose root was matched { id, companyId } above, but the write is
  // held to the tenant directly rather than through that chain — a version
  // that somehow belonged elsewhere is a "not found", never a cross-tenant
  // write. (check:tenant-scope's rule, and the reason it exists.)
  await db.invoice.update({
    where: { id: current.id, companyId: member.companyId },
    data: { stripeCheckoutUrl: session.url },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
