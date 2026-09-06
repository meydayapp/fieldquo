// app/api/payments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { formatAppMoney } from "@/lib/format/money";
import { resolveInvoiceChaseTask } from "@/lib/tasks/autoCreate";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import { latestInFamily, familyPayments } from "@/lib/invoices/family";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── The toggle gated the write and not the read ────────────────────────
  //
  // POST below requires the `payments` toggle to RECORD one. GET required
  // nothing, so a Worker with payments off received every payment in the
  // company — amount, method, and the invoice it belongs to. A toggle that
  // stops you writing a thing but hands you all of it to read is not a
  // boundary, and the owner who switched it off would reasonably think it was.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireToggle(full, "payments", "see payments");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("invoiceId");

  const payments = await db.payment.findMany({
    where: {
      invoice: { companyId: member.companyId },
      ...(invoiceId && { invoiceId }),
    },
    include: { invoice: { select: { invoiceNumber: true, total: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(payments);
}

// Records a manual payment (cash, e-transfer, cheque) — Stripe payments are recorded
// via the checkout webhook instead, not through this endpoint, since those need the
// stripePaymentIntentId set and shouldn't be enterable by hand.
// app/api/payments/route.js — POST handler, replace the totals section
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Recording a payment is the highest-trust action in the app — it marks
  // money as received. Gated on the dedicated `payments` toggle rather than
  // an invoice level, since the two are independent: someone who edits
  // invoices isn't automatically someone who should confirm cash arrived.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "payments", "record payments");
  } catch (err) {
    const { body: errBody, status } = permissionErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const body = await request.json();
  const { invoiceId, amount, method, notes, date } = body;

  if (!invoiceId || !amount || !method) {
    return NextResponse.json(
      { error: "invoiceId, amount, and method are required" },
      { status: 400 },
    );
  }
  // Recording money received is the highest-trust action in the app — a negative
  // amount is truthy and would have passed, quietly INCREASING the balance due.
  if (!(Number(amount) > 0)) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 },
    );
  }

  // Tenancy first: the named id has to be this company's. Then the LATEST
  // version of that invoice and the whole family's payments — a cash payment
  // typed against v1 after the office amended it to v2 is money against v2's
  // total, and the balance has to count what was already paid on v1. See
  // lib/invoices/family.js.
  const scoped = await db.invoice.findFirst({
    where: { id: invoiceId, companyId: member.companyId },
    select: { id: true },
  });
  if (!scoped)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const invoice = await latestInFamily(db, scoped.id, {
    // company only for the billing currency in the error message below.
    // Invoice has no currency column of its own — reading invoice.currency
    // would be undefined and silently format an American contractor's
    // outstanding balance as Canadian dollars.
    include: { company: { select: { currency: true } } },
  });
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  // ── One transaction, one lock per invoice ──────────────────────────────
  //
  // Read the family, check the cap, write the row, update the cache: four
  // steps that used to run outside any transaction, so two identical POSTs
  // fired together (a double-click, a retried request) both read "nothing
  // paid yet", both passed the cap, and both landed — the QA rerun proved
  // it with two rows three milliseconds apart. A transaction alone does not
  // serialise two readers; the advisory lock does, keyed on the invoice, and
  // it releases with the transaction. Inside it, a payment of the same
  // amount and method recorded within the last fifteen seconds is refused as
  // the duplicate it almost certainly is — a genuine second $10 cash payment
  // fifteen seconds after the first is rarer than a double-click, and the
  // sentence tells the user which one happened.
  const outcome = await db.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.id}))`;
  const familyRows = await familyPayments(tx, invoice.id);

  // ── The stated cap has to be a real one ────────────────────────────────
  //
  // The form says "Amount (up to $2100.00)" and the server accepted $5,000
  // against a $2,100 invoice. The invoice flipped to paid, the totals block
  // rendered "Paid -$5000.00" and "Balance Due $0.00", and the $2,900 excess
  // simply left the ledger — Math.max(0, …) below floors amountDue, so nothing
  // downstream can tell an over-applied invoice from a settled one.
  //
  // Refused rather than silently clamped: clamping would record a $5,000
  // payment as $2,100 and lose the difference just as completely, while
  // looking deliberate. If a client genuinely overpays, that is a credit, and
  // a credit is a feature with a decision behind it — not something to invent
  // inside a validation branch.
  //
  // Tolerance matches isPaid below: half a cent, so float residue on an
  // instalment plan can't refuse the final legitimate payment.
  // Net of any Stripe refund already recorded against this invoice — see
  // lib/invoices/computeInvoiceState.js. A gross sum of Payment.amount here
  // would understate `outstanding` after a partial refund: the money came
  // back out, so it is owed again, and this cap must not let a client's own
  // portal say otherwise.
  const before = computeInvoiceState({
    total: invoice.total,
    payments: familyRows,
    priorStatus: invoice.status,
  });
  const outstanding = Number(invoice.total) - before.amountPaid;
  if (Number(amount) - outstanding > 0.005) {
    return {
      refused: {
        status: 400,
        error:
          outstanding > 0
            ? `That's more than the ${formatAppMoney(outstanding, invoice.company?.currency)} still owing on this invoice.`
            : "This invoice is already paid in full.",
      },
    };
  }
  const DUPLICATE_WINDOW_MS = 15_000;
  const justRecorded = familyRows.find(
    (p) =>
      Math.abs(Number(p.amount) - Number(amount)) < 0.005 &&
      p.method === method &&
      p.createdAt &&
      Date.now() - new Date(p.createdAt).getTime() < DUPLICATE_WINDOW_MS,
  );
  if (justRecorded) {
    return {
      refused: {
        status: 409,
        error: `A ${method} payment of ${formatAppMoney(Number(amount), invoice.company?.currency)} was recorded on this invoice a moment ago. Refresh to see it; record another only if it really is a second payment.`,
      },
    };
  }

  const payment = await tx.payment.create({
    data: {
      // Against the current document, so a later amendment finds it in the
      // family and the idempotency of Stripe rows is untouched (this is a cash
      // row with no intent id).
      invoiceId: invoice.id,
      amount,
      method,
      notes: notes || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  const after = computeInvoiceState({
    total: invoice.total,
    payments: [...familyRows, { amount: Number(amount), refundedAmount: 0, disputeStatus: null }],
    priorStatus: invoice.status,
  });

  // Scoped by companyId as well as id — `invoice` is the latest version of a
  // family whose root was matched { id, companyId } above; the write is held
  // to the tenant directly, not through that chain (check:tenant-scope).
  await tx.invoice.update({
    where: { id: invoice.id, companyId: member.companyId },
    data: {
      amountPaid: after.amountPaid,
      amountDue: after.amountDue,
      amountRefunded: after.amountRefunded,
      status: after.status,
      paidDate: after.isPaid ? new Date() : invoice.paidDate,
    },
  });
  return { payment, after };
  });
  if (outcome.refused) {
    return NextResponse.json({ error: outcome.refused.error }, { status: outcome.refused.status });
  }
  const { payment, after } = outcome;

  // Settled → the "follow up payment" reminder the send route raised has been
  // answered. Only on isPaid: a deposit is not a reason to stop chasing the
  // rest, and closing it early would take the invoice off the to-do list while
  // most of the money was still outstanding.
  if (after.isPaid) await resolveInvoiceChaseTask(invoice.id);

  await recordActivity(member, {
    action: "payment.recorded",
    entityType: "payment",
    entityId: payment.id,
    summary: `Recorded a ${method} payment of ${amount} on invoice ${invoice.invoiceNumber || invoiceId}`,
    metadata: { invoiceId, amount, method, isPaid: after.isPaid },
  });

  return NextResponse.json(payment, { status: 201 });
}
