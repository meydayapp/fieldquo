// app/api/payments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { formatAppMoney } from "@/lib/format/money";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, companyId: member.companyId },
    // company only for the billing currency in the error message below.
    // Invoice has no currency column of its own — reading invoice.currency
    // would be undefined and silently format an American contractor's
    // outstanding balance as Canadian dollars.
    include: { payments: true, company: { select: { currency: true } } },
  });
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

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
  const alreadyPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = Number(invoice.total) - alreadyPaid;
  if (Number(amount) - outstanding > 0.005) {
    return NextResponse.json(
      {
        error:
          outstanding > 0
            ? `That's more than the ${formatAppMoney(outstanding, invoice.company?.currency)} still owing on this invoice.`
            : "This invoice is already paid in full.",
      },
      { status: 400 },
    );
  }

  const payment = await db.payment.create({
    data: {
      invoiceId,
      amount,
      method,
      notes: notes || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  const totalPaid = alreadyPaid + Number(amount);
  const amountDue = Math.max(0, Number(invoice.total) - totalPaid);
  // Half a cent, not zero — the same threshold every other balance recompute
  // uses (the Stripe webhook, credit-visit-fee). Summing Decimals through
  // Number leaves float residue, so an invoice paid off in instalments could
  // land on 0.0000000001 owing and never be marked paid, and the difference
  // between the two rules showed up as one path marking it and the other not.
  const isPaid = amountDue <= 0.005;

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: totalPaid,
      amountDue,
      status: isPaid ? "paid" : invoice.status,
      paidDate: isPaid ? new Date() : invoice.paidDate,
    },
  });

  await recordActivity(member, {
    action: "payment.recorded",
    entityType: "payment",
    entityId: payment.id,
    summary: `Recorded a ${method} payment of ${amount} on invoice ${invoice.invoiceNumber || invoiceId}`,
    metadata: { invoiceId, amount, method, isPaid },
  });

  return NextResponse.json(payment, { status: 201 });
}
