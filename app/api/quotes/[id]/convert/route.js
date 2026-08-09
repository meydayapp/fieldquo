// app/api/quotes/[id]/convert/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
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
    where: { id: _params.id, companyId: member.companyId },
    include: {
      scopeGroups: { orderBy: { sortOrder: "asc" } },
      // Only the ones the client actually ticked. An offered-but-declined
      // extra must never reach the invoice.
      addOns: { where: { selected: true }, orderBy: { sortOrder: "asc" } },
    },
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

  // Flattened from the scope groups, NOT from quote.lineItems.
  //
  // That top-level column is only populated by the older single-list quote
  // path; every quote built through the scope-group builder leaves it null.
  // Reading it here meant those invoices were created with no line items at
  // all — a total with nothing itemised behind it, which is exactly the
  // document a client disputes. The group label is prefixed so a flattened
  // invoice still reads like the quote it came from.
  const scopeItems = quote.scopeGroups.flatMap((g) => {
    const items = Array.isArray(g.lineItems) ? g.lineItems : [];
    return items.map((li) => ({
      ...li,
      description: g.label ? `${g.label}: ${li.description}` : li.description,
    }));
  });

  const addOnItems = quote.addOns.map((a) => ({
    description: a.description,
    quantity: 1,
    amount: Number(a.amount),
  }));

  const lineItems = [
    ...(scopeItems.length ? scopeItems : Array.isArray(quote.lineItems) ? quote.lineItems : []),
    ...addOnItems,
  ];

  // acceptedTotal is what the client agreed to, extras included. It's set the
  // moment they approve, so preferring it here is what makes the invoice match
  // the number on the page they clicked. Falling back to the quote's own total
  // covers quotes accepted before this existed, and ones marked accepted by
  // hand in the office rather than through the client link.
  const useAccepted = quote.acceptedTotal !== null;

  const invoice = await db.invoice.create({
    data: {
      companyId: member.companyId,
      invoiceNumber: nextNumber,
      clientId: quote.clientId,
      quoteId: quote.id,
      createdById: member.userId,
      lineItems,
      subtotal: useAccepted ? quote.acceptedSubtotal : quote.subtotal,
      discount: quote.discount,
      tax: useAccepted ? quote.acceptedTax : quote.tax,
      total: useAccepted ? quote.acceptedTotal : quote.total,
      // Seed the balance owing (see invoices/route.js) so it's correct before
      // any payment rather than defaulting to 0 = "looks fully paid".
      amountDue: useAccepted ? quote.acceptedTotal : quote.total,
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
