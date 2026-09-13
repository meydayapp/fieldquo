// app/api/portal/[token]/pay/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createInvoiceCheckoutSession } from "@/lib/stripe";
import { latestInFamily, refreshFamilyLedger } from "@/lib/invoices/family";
import { getAppOrigin } from "@/lib/appUrl";
import { companyBankDebitMethod } from "@/lib/stripe/bankDebit";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  // stageId is a HINT at which JobPaymentStage this checkout is for — never
  // an amount. The amount below is always re-derived from that row (or,
  // absent one, from the invoice's own balance) — non-negotiable #5, the
  // browser never sends money amounts.
  // A homeowner on a flaky mobile connection can deliver a truncated body;
  // an unguarded parse throws and Next returns a bodyless 500, which reads to
  // the payer as "the site is broken" mid-payment. Fail as a clean 400 they
  // can retry — same shape as /api/sales/notes.
  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json(
      { error: "We couldn't read that request. Please try again." },
      { status: 400 },
    );
  // `method` names HOW the client wants to pay — "card" (default) or "bank"
  // — never what it costs. Resolved below against what the company can
  // actually take; anything else is refused rather than passed to Stripe.
  const { invoiceId, stageId, method: requestedMethod = "card" } = body;
  if (requestedMethod !== "card" && requestedMethod !== "bank") {
    return NextResponse.json({ error: "Unknown payment method" }, { status: 400 });
  }
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

  // ── Charge the CURRENT document, from the family's real balance ──────────
  //
  // The id the client clicked may be a version the office has since amended.
  // Resolve to the latest, and refuse if that latest was never issued — an
  // unsent amendment supersedes the old bill, so neither is payable until the
  // office sends it. Then refresh the balance from every payment in the family
  // BEFORE any amount reaches Stripe: createInvoiceCheckoutSession reads
  // invoice.amountPaid off the row, and a version amended before this rule
  // existed carries a stale cache. See lib/invoices/family.js.
  const currentRow = await latestInFamily(db, invoice.id, {
    select: { id: true, sentAt: true, status: true },
  });
  if (
    currentRow &&
    currentRow.id !== invoice.id &&
    !(currentRow.sentAt || currentRow.status !== "draft")
  ) {
    return NextResponse.json(
      { error: "This invoice has been updated — please refresh the page." },
      { status: 409 },
    );
  }
  await refreshFamilyLedger(db, invoice.id);
  const current = await latestInFamily(db, invoice.id, { include: { client: true } });
  if (!current)
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

  // "Pay from bank account" is only offered when Stripe has activated the
  // capability on THIS account and the company bills in that currency —
  // the same rule the portal uses to render the button, re-checked here
  // because hiding a button is not access control.
  const bankMethod = companyBankDebitMethod(company);
  if (requestedMethod === "bank" && !bankMethod) {
    return NextResponse.json(
      { error: "This company can't take bank payments online yet" },
      { status: 400 },
    );
  }
  const method = requestedMethod === "bank" ? bankMethod : "card";

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
      // companyId, not just invoiceId — belt and braces the same way the
      // invoice lookup above is scoped to client.id rather than trusting
      // invoiceId alone. scripts/check-tenant-scope.mjs requires a by-id
      // lookup on a tenant model to be company-scoped directly, not only
      // provably-so through a chain of other scoped lookups.
      where: {
        id: stageId,
        companyId: client.companyId,
        invoiceId: current.id,
        status: "requested",
      },
      select: { amountCents: true },
    });
    if (stage) amountCents = stage.amountCents;
  }

  const session = await createInvoiceCheckoutSession({
    invoice: current,
    company,
    // A bank debit is not "paid" on return — it clears in 3–5 business days
    // — so the portal is told which kind of return this is and says
    // "pending", not "received".
    successUrl: `${baseUrl}/portal/${_params.token}?paid=${method === "card" ? "true" : "bank"}`,
    cancelUrl: `${baseUrl}/portal/${_params.token}`,
    amountCents,
    method,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
