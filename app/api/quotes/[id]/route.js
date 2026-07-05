// app/api/quotes/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await db.quote.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: {
      client: true,
      scopeGroups: {
        include: { category: true },
        orderBy: { sortOrder: "asc" },
      },
      invoices: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quote);
}

// Quotes are edited directly, not versioned — unlike invoices, there's no signed
// commitment yet before acceptance, so a straight PATCH is the right model.
export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.quote.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    status,
    subtotal,
    discount,
    tax,
    total,
    notes,
    validUntil,
    scopeGroups,
  } = body;

  const updated = await db.quote.update({
    where: { id: params.id },
    data: {
      ...(status !== undefined && {
        status,
        ...(status === "sent" && { sentAt: new Date() }),
      }),
      ...(subtotal !== undefined && { subtotal }),
      ...(discount !== undefined && { discount }),
      ...(tax !== undefined && { tax }),
      ...(total !== undefined && { total }),
      ...(notes !== undefined && { notes }),
      ...(validUntil !== undefined && {
        validUntil: validUntil ? new Date(validUntil) : null,
      }),
      ...(scopeGroups && {
        scopeGroups: {
          deleteMany: {},
          create: scopeGroups.map((g, i) => ({
            categoryId: g.categoryId,
            label: g.label || null,
            lineItems: g.lineItems || null,
            subtotal: g.subtotal || 0,
            sortOrder: i,
          })),
        },
      }),
    },
    include: { client: true, scopeGroups: { include: { category: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.quote.findFirst({
    where: { id: params.id, companyId: member.companyId },
    include: { invoices: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.invoices.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete a quote that has an invoice" },
      { status: 400 },
    );
  }

  await db.quote.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
