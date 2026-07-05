// app/api/quotes/[id]/convert/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "quote:convert");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const quote = await db.quote.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: { scopeGroups: true },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quote.status !== "accepted") {
    return NextResponse.json(
      { error: "Only accepted quotes can be converted to an invoice" },
      { status: 400 },
    );
  }

  const existingInvoice = await db.invoice.findFirst({
    where: { quoteId: quote.id, parentInvoiceId: null },
  });
  if (existingInvoice) {
    return NextResponse.json(
      {
        error: "This quote already has an invoice",
        invoiceId: existingInvoice.id,
      },
      { status: 409 },
    );
  }

  const lastInvoice = await db.invoice.findFirst({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });
  const nextNumber = getNextInvoiceNumber(lastInvoice?.invoiceNumber);

  const invoice = await db.invoice.create({
    data: {
      companyId: member.companyId,
      invoiceNumber: nextNumber,
      clientId: quote.clientId,
      quoteId: quote.id,
      createdById: member.userId,
      lineItems: quote.lineItems,
      subtotal: quote.subtotal,
      discount: quote.discount,
      tax: quote.tax,
      total: quote.total,
      language: quote.language,
    },
    include: { client: true },
  });

  return NextResponse.json(invoice, { status: 201 });
}

function getNextInvoiceNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `INV-${year}-0001`;
  const match = lastNumber.match(/(\d+)$/);
  const nextSeq = match
    ? String(Number(match[1]) + 1).padStart(4, "0")
    : "0001";
  return `INV-${year}-${nextSeq}`;
}
