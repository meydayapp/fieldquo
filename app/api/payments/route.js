// app/api/payments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

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

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, companyId: member.companyId },
    include: { payments: true },
  });
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const payment = await db.payment.create({
    data: {
      invoiceId,
      amount,
      method,
      notes: notes || null,
      date: date ? new Date(date) : new Date(),
    },
  });

  const totalPaid =
    invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) +
    Number(amount);
  const amountDue = Math.max(0, Number(invoice.total) - totalPaid);
  const isPaid = amountDue === 0;

  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: totalPaid,
      amountDue,
      status: isPaid ? "paid" : invoice.status,
      paidDate: isPaid ? new Date() : invoice.paidDate,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}
