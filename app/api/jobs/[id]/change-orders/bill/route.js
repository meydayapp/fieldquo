// app/api/jobs/[id]/change-orders/bill/route.js
//
// Put this job's approved, unbilled change orders onto its invoice.
//
// ── The product decision this route encodes ────────────────────────────────
//
// Should an approved change order appear on the invoice AUTOMATICALLY, or only
// when somebody says so? This is the explicit version, deliberately, and the
// job page shows the unbilled total loudly so "explicit" cannot quietly become
// "never" — which is what happens today, and is how a contractor ends up
// eating $3,000 of agreed work.
//
// The argument for explicit: an invoice is a document a homeowner reads and
// pays. Money appearing on it because a row was written somewhere else is the
// exact "money moved by surprise" this codebase refuses. The argument for
// automatic is real too — it is the safer failure for the CONTRACTOR — and it
// is a product decision, not one to take silently in a route. See the report
// and docs/CALLBACKS-AND-CHANGE-ORDERS.md.
//
// ── Draft invoices only, and why the refusal is honest rather than a stub ──
//
// A DRAFT invoice has not been sent. Adding lines to it changes nothing the
// client has seen, and it is fully reversible — delete the draft, or the
// SetNull on ChangeOrder.invoiceId hands the change orders straight back.
//
// A SENT invoice is a different act: PATCH /api/invoices/[id] answers an edit
// to a sent invoice by snapshotting a whole new VERSION row, carrying costing,
// photos and the changeLog forward. Re-implementing that here would be a second
// copy of the amendment rule (AGENTS.md failure class #4) sitting on the money
// path, and the first copy is the one everyone maintains. So this route refuses
// with a reason the screen prints — "this invoice has been sent, amend it from
// the invoice page" — rather than shipping a button that half-works. GET below
// returns the same reason, so the button is never rendered as available in the
// first place.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { resolveJobInvoice } from "@/lib/invoices/jobLink";
import { billChangeOrders, changeOrderSummary } from "@/lib/jobs/changeOrderValue";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";

const INVOICE_SELECT = {
  id: true,
  invoiceNumber: true,
  status: true,
  lineItems: true,
  subtotal: true,
  discount: true,
  tax: true,
  taxEnabled: true,
  total: true,
};

/**
 * The rows both verbs need, AFTER each has passed its own gate.
 *
 * Deliberately does NOT contain the permission check. The gate is repeated
 * inside GET and POST below, exactly as the sibling change-orders route
 * repeats it — scripts/check-crew-access.mjs reads each exported handler's own
 * body looking for one, and it is right to: a gate you have to follow a helper
 * call to find is a gate a reviewer misses, and this route changes what a
 * homeowner owes.
 */
async function load(member, full, jobId) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, quoteId: true },
  });
  if (!job)
    return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const changeOrders = await db.changeOrder.findMany({
    where: { jobId: job.id },
    select: { id: true, description: true, priceDelta: true, status: true, invoiceId: true },
  });

  const invoice = await resolveJobInvoice(db, job, member.companyId, INVOICE_SELECT);

  return { member, job, changeOrders, invoice };
}

/**
 * What would happen if the button were pressed — so the screen can render the
 * truth instead of a button that finds out on click.
 */
function billingState({ invoice, changeOrders }) {
  const summary = changeOrderSummary(changeOrders);
  const unbilled = { count: summary.unbilledCount, total: summary.unbilledTotal };

  if (summary.unbilledCount === 0)
    return { canBill: false, reason: "nothing_to_bill", unbilled, invoice: null };

  const shape = invoice
    ? { id: invoice.id, invoiceNumber: invoice.invoiceNumber, status: invoice.status }
    : null;

  if (!invoice) return { canBill: false, reason: "no_invoice", unbilled, invoice: null };
  if (invoice.status !== "draft")
    return { canBill: false, reason: "invoice_sent", unbilled, invoice: shape };

  const preview = billChangeOrders({ invoice, changeOrders });
  if (!preview.ok)
    return { canBill: false, reason: preview.reason, unbilled, invoice: shape };

  return {
    canBill: true,
    reason: null,
    unbilled,
    invoice: shape,
    // The exact numbers the confirmation has to state before anyone agrees to
    // move them.
    preview: { added: preview.added, newTotal: preview.total },
  };
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_only", "see change-order billing");
    // Reading this answers with money — the unbilled total and the invoice
    // total it would become. Same toggle the log form itself is gated on.
    requireToggle(full, "showPricing", "see change-order billing");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const loaded = await load(member, full, id);
  if (loaded.response) return loaded.response;
  return NextResponse.json(billingState(loaded));
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    // A higher bar than GET: reading what WOULD be billed is not permission to
    // change what a client owes.
    requireLevel(full, "jobs", "view_create_edit", "bill a change order");
    requireToggle(full, "showPricing", "bill a change order");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const loaded = await load(member, full, id);
  if (loaded.response) return loaded.response;

  const { invoice } = loaded;
  const state = billingState(loaded);
  if (!state.canBill) {
    // 409, not 400: the request was well-formed and the answer is about the
    // state of the invoice, which is what the screen has to explain.
    return NextResponse.json({ error: state.reason, ...state }, { status: 409 });
  }

  const result = await db.$transaction(async (tx) => {
    // Re-read inside the transaction and re-decide from scratch. The GET that
    // rendered the button is a snapshot; between it and this click the invoice
    // could have been sent, or another tab could have billed the same change
    // orders. Trusting the earlier read is how the same $3,000 lands on a
    // document twice.
    const fresh = await tx.invoice.findFirst({
      where: { id: invoice.id, companyId: loaded.member.companyId },
      select: INVOICE_SELECT,
    });
    if (!fresh || fresh.status !== "draft") return { error: "invoice_sent" };

    const freshOrders = await tx.changeOrder.findMany({
      where: { jobId: loaded.job.id },
      select: { id: true, description: true, priceDelta: true, status: true, invoiceId: true },
    });

    const billed = billChangeOrders({ invoice: fresh, changeOrders: freshOrders });
    if (!billed.ok) return { error: billed.reason };

    const payments = await tx.payment.findMany({
      where: { invoiceId: fresh.id },
      select: { amount: true, refundedAmount: true, disputeStatus: true },
    });
    // The one place that answers "what does this invoice's money say" — the
    // balance is re-derived rather than adjusted by the delta, so a draft that
    // already carries a deposit payment stays correct.
    const money = computeInvoiceState({
      total: billed.total,
      payments,
      priorStatus: fresh.status,
    });

    const updated = await tx.invoice.update({
      where: { id: fresh.id },
      data: {
        lineItems: billed.lineItems,
        subtotal: billed.subtotal,
        tax: billed.tax,
        total: billed.total,
        amountPaid: money.amountPaid,
        amountDue: money.amountDue,
        status: money.status,
      },
      select: { id: true, invoiceNumber: true, status: true, total: true, amountDue: true },
    });

    // Same transaction as the line items, deliberately: a change order marked
    // billed against an invoice that never got the line, or a line on an
    // invoice for a change order still showing as owed, are both worse than
    // failing outright.
    await tx.changeOrder.updateMany({
      where: { id: { in: billed.changeOrderIds } },
      data: { invoiceId: fresh.id },
    });

    return { invoice: updated, added: billed.added, billed: billed.changeOrderIds.length };
  });

  if (result.error)
    return NextResponse.json({ error: result.error }, { status: 409 });

  return NextResponse.json(result);
}
