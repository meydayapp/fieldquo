// app/api/public/change-orders/[token]/pay/route.js
//
// "Pay $X now" on the change-order page, after the client approved and
// signed. Token-only, like the page — a stranger with the link.
//
// The body is ignored. Nothing the browser sends can name an amount, an
// invoice or a payment method (AGENTS.md #5): the change order is billed from
// its own row onto its own invoice (lib/jobs/changeOrderPayment.js — the
// rule for WHICH invoice is argued there), and the client is sent to that
// invoice's page in their portal, where the Pay button goes through the one
// shared pay route (POST /api/portal/[token]/pay). Whatever that path
// charges — card fee, bank debit, a client card surcharge — applies here
// because this route never builds a checkout itself.
//
// Once: billing is idempotent per change order (locked, re-read, linked with
// a predicate). A second tap is handed the same invoice.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordActivity } from "@/lib/activity/log";
import { changeOrderSummary } from "@/lib/jobs/changeOrderValue";
import { addendumMoney, quoteTaxRate, changeOrderLabel } from "@/lib/jobs/changeOrderAddendum";
import { payNowState } from "@/lib/quotes/importOptions";
import { billChangeOrderForPayment } from "@/lib/jobs/changeOrderPayment";
import { ensurePortalToken, portalInvoiceUrl } from "@/lib/clientPortal";

const SELECT = {
  id: true,
  jobId: true,
  seq: true,
  createdAt: true,
  priceDelta: true,
  status: true,
  invoiceId: true,
  invoice: {
    select: { id: true, invoiceNumber: true, status: true, sentAt: true, total: true, amountPaid: true, lineItems: true },
  },
  job: {
    select: {
      id: true,
      companyId: true,
      clientId: true,
      quote: {
        select: { acceptedTotal: true, total: true, subtotal: true, acceptedSubtotal: true, tax: true, acceptedTax: true, discount: true },
      },
      company: { select: { stripeAccountId: true, stripeChargesEnabled: true, isDemo: true } },
    },
  },
};

export async function POST(request, { params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  if (!token || typeof token !== "string" || token.length > 128)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const co = await db.changeOrder.findUnique({ where: { shareToken: token }, select: SELECT });
  if (!co || !co.job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The offer, re-decided here from the rows — the page that rendered the
  // button is a snapshot, and hiding a button is not access control.
  const quote = co.job.quote;
  let money = null;
  if (quote) {
    const siblings = await db.changeOrder.findMany({
      where: { jobId: co.jobId, NOT: { id: co.id } },
      select: { priceDelta: true, status: true, invoiceId: true },
    });
    money = addendumMoney({
      quoteTotal: Number(quote.acceptedTotal ?? quote.total),
      priorApproved: changeOrderSummary(siblings).approvedTotal,
      delta: Number(co.priceDelta),
      taxRate: quoteTaxRate(quote),
    });
  }
  const state = payNowState({ changeOrder: co, company: co.job.company, invoice: co.invoice || null, money });

  // A change billed onto the job's own (issued, unpaid) invoice has no amount
  // of its own to collect — but the client can still be shown that invoice.
  const openShared = !state.offer && state.reason === "on_invoice";
  if (!state.offer && !openShared) {
    return NextResponse.json({ error: "This change can't be paid online right now.", reason: state.reason }, { status: 409 });
  }

  let invoiceId = co.invoiceId;
  let created = false;
  if (!invoiceId) {
    const billed = await billChangeOrderForPayment(db, { changeOrderId: co.id });
    if (!billed.ok) {
      return NextResponse.json({ error: "This change can't be paid online right now.", reason: billed.reason }, { status: 409 });
    }
    invoiceId = billed.invoiceId;
    created = billed.created;
  }

  if (created) {
    const all = await db.changeOrder.findMany({ where: { jobId: co.jobId }, select: { id: true, seq: true, createdAt: true } });
    await recordActivity(
      { companyId: co.job.companyId },
      {
        action: "change_order.billed_for_payment",
        entityType: "job",
        entityId: co.jobId,
        actorName: "Client (approval link)",
        summary: `Change order ${changeOrderLabel(co, all)} invoiced for the client to pay on approval`,
        metadata: { changeOrderId: co.id, invoiceId },
      },
    );
  }

  const portalToken = await ensurePortalToken(db, co.job.clientId, co.job.companyId);
  if (!portalToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ payUrl: portalInvoiceUrl(portalToken, invoiceId, request) });
}
