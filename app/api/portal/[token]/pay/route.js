// app/api/portal/[token]/pay/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createInvoiceCheckoutSession } from "@/lib/stripe";
import { getAppOrigin } from "@/lib/appUrl";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  // stageId is a HINT at which JobPaymentStage this checkout is for — never
  // an amount. The amount below is always re-derived from that row (or,
  // absent one, from the invoice's own balance) — non-negotiable #5, the
  // browser never sends money amounts.
  const { invoiceId, stageId } = await request.json();
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
  // The status predicate is HERE, not just on the listing that feeds the page.
  // The portal stopped showing drafts, but a draft's id is guessable and this
  // endpoint mints a Stripe checkout session — so filtering the list alone
  // would be hiding a button, which is not access control. Same reasoning as
  // the clientId check above, one field along: a bill the contractor never
  // issued must not be chargeable, whoever holds the token.
  //
  // "Issued" matches the portal payload exactly: a stamped sentAt, or a status
  // past draft for one settled in person and marked paid without any email.
  const invoice = await db.invoice.findFirst({
    where: {
      id: invoiceId,
      clientId: client.id,
      OR: [{ sentAt: { not: null } }, { status: { not: "draft" } }],
    },
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

  // ── A stage's own share, re-derived here, never trusted from the browser ──
  //
  // stageId only NAMES which JobPaymentStage this checkout is for. The
  // amount comes from that row's own amountCents, looked up server-side, and
  // is refused unless the stage actually belongs to THIS invoice and is
  // still `requested` (not already fired-and-since-superseded, not another
  // invoice's stage guessed by id). Anything else falls through to the
  // ordinary full-balance checkout — the behaviour before this feature
  // existed, unchanged for every company with no structured schedule.
  let amountCents;
  if (stageId) {
    const stage = await db.jobPaymentStage.findFirst({
      where: { id: stageId, invoiceId: invoice.id, status: "requested" },
      select: { amountCents: true },
    });
    if (stage) amountCents = stage.amountCents;
  }

  const session = await createInvoiceCheckoutSession({
    invoice,
    company,
    successUrl: `${baseUrl}/portal/${_params.token}?paid=true`,
    cancelUrl: `${baseUrl}/portal/${_params.token}`,
    amountCents,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
