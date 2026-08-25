// app/api/invoices/[id]/credit-visit-fee/route.js
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
import { resolveInvoiceChaseTask } from "@/lib/tasks/autoCreate";

// Credit a paid booking/visit fee (the client already paid it at booking time,
// via Stripe Connect) onto an invoice — the John-the-Plumber model, where the
// $79 visit is refunded onto the job if the client goes ahead. Recorded as a
// `visit_credit` payment so it flows through the SAME balance recompute as every
// other payment, and the booking is stamped with feeCreditedInvoiceId so the
// same fee can't be credited twice or onto two invoices.
//
// It's the contractor's call, per John's model — sometimes the consultation
// stands on its own — so this is a manual, reversible toggle, not automatic.

// Which paid booking fees belong to this invoice's client, and whether one is
// already credited here. Matching is by the client's email (a Booking has no FK
// to Client — it's created from a public form) scoped to THIS company, so one
// tenant can never credit another's fee.
function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

async function creditState(invoice) {
  const email = normEmail(invoice.client?.email);
  if (!email) return { eligible: [], applied: [] };

  const bookings = await db.booking.findMany({
    where: {
      eventType: { companyId: invoice.companyId },
      feePaidCents: { gt: 0 },
    },
    include: { eventType: { select: { name: true } } },
    orderBy: { startTime: "desc" },
  });

  const mine = bookings.filter((b) => normEmail(b.clientEmail) === email);
  const toRow = (b) => ({
    bookingId: b.id,
    feePaidCents: b.feePaidCents,
    feeCurrency: b.feeCurrency || invoice.company?.currency || "USD",
    eventName: b.eventType?.name || "Visit",
    startTime: b.startTime,
  });

  return {
    // Not yet credited anywhere.
    eligible: mine.filter((b) => !b.feeCreditedInvoiceId).map(toRow),
    // Already credited onto THIS invoice (so the toggle can be switched off).
    applied: mine.filter((b) => b.feeCreditedInvoiceId === invoice.id).map(toRow),
  };
}

async function loadInvoice(id, companyId) {
  return db.invoice.findFirst({
    where: { id, companyId },
    include: {
      payments: true,
      client: { select: { email: true } },
      company: { select: { currency: true } },
    },
  });
}

// Recompute amountPaid / amountDue / status from ALL payments — identical to the
// manual-payment and Stripe-webhook paths, so a credit can move an invoice to
// paid (or back out of it) exactly as a cash payment would.
async function recomputeInvoice(invoiceId) {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!inv) return;
  const totalPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
  const amountDue = Math.max(0, Number(inv.total) - totalPaid);
  const isPaid = amountDue <= 0.005;
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: totalPaid,
      amountDue,
      status: isPaid ? "paid" : inv.status === "paid" ? "sent" : inv.status,
      paidDate: isPaid ? inv.paidDate || new Date() : null,
    },
  });

  // A credit that clears the balance settles the invoice as completely as cash
  // does, so it closes the chase task the same way. Removing a credit is NOT
  // the mirror image: this reopens nothing, because a task somebody already
  // ticked off is their judgement and a recompute should not overrule it — the
  // banner on the invoice will say the balance is owed again either way.
  if (isPaid) await resolveInvoiceChaseTask(invoiceId);
}

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await loadInvoice(id, member.companyId);
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  return NextResponse.json(await creditState(invoice));
}

export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Same gate as recording a payment — this moves money on the invoice.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "payments", "credit a visit fee");
  } catch (err) {
    const { body: errBody, status } = permissionErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }

  const { id } = await params;
  const { bookingId, apply } = await request.json();
  if (!bookingId)
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });

  const invoice = await loadInvoice(id, member.companyId);
  if (!invoice)
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const booking = await db.booking.findFirst({
    where: { id: bookingId, eventType: { companyId: member.companyId } },
    include: { eventType: { select: { name: true } } },
  });
  // Belongs to this company AND to this invoice's client — never credit a fee a
  // different client paid.
  if (
    !booking ||
    !booking.feePaidCents ||
    normEmail(booking.clientEmail) !== normEmail(invoice.client?.email)
  ) {
    return NextResponse.json(
      { error: "No matching paid visit fee for this client." },
      { status: 404 },
    );
  }

  const tag = `visit-credit:${booking.id}`;

  if (apply) {
    if (booking.feeCreditedInvoiceId) {
      return NextResponse.json(
        {
          error:
            booking.feeCreditedInvoiceId === invoice.id
              ? "This visit fee is already credited to this invoice."
              : "This visit fee was already credited to another invoice.",
        },
        { status: 409 },
      );
    }
    await db.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: booking.feePaidCents / 100,
        method: "visit_credit",
        notes: tag,
      },
    });
    await db.booking.update({
      where: { id: booking.id },
      data: { feeCreditedInvoiceId: invoice.id },
    });
    await recomputeInvoice(invoice.id);
    await recordActivity(member, {
      action: "invoice.visitFeeCredited",
      entityType: "invoice",
      entityId: invoice.id,
      summary: `Credited ${booking.eventType?.name || "visit"} fee of ${(booking.feePaidCents / 100).toFixed(2)} to invoice ${invoice.invoiceNumber}`,
      metadata: { bookingId: booking.id, amountCents: booking.feePaidCents },
    });
  } else {
    if (booking.feeCreditedInvoiceId !== invoice.id) {
      return NextResponse.json(
        { error: "This visit fee isn't credited to this invoice." },
        { status: 409 },
      );
    }
    // Remove the exact credit payment we created (tagged with the booking id, so
    // an identically-sized cash payment is never deleted by mistake).
    await db.payment.deleteMany({
      where: { invoiceId: invoice.id, method: "visit_credit", notes: tag },
    });
    await db.booking.update({
      where: { id: booking.id },
      data: { feeCreditedInvoiceId: null },
    });
    await recomputeInvoice(invoice.id);
    await recordActivity(member, {
      action: "invoice.visitFeeCreditRemoved",
      entityType: "invoice",
      entityId: invoice.id,
      summary: `Removed visit fee credit from invoice ${invoice.invoiceNumber}`,
      metadata: { bookingId: booking.id, amountCents: booking.feePaidCents },
    });
  }

  const refreshed = await loadInvoice(id, member.companyId);
  return NextResponse.json(await creditState(refreshed));
}
