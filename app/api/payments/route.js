// app/api/payments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

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
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Auto-mark the invoice paid once payments cover the total
  const totalPaid =
    invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) +
    Number(amount);

  if (totalPaid >= Number(invoice.total) && invoice.status !== "paid") {
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "paid" },
    });
  }

  return NextResponse.json(payment, { status: 201 });
}
