// app/api/quotes/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function GET(request, { params }) {
  // Next 16: params is a Promise. Read synchronously it's undefined, so every
  // lookup on this route returned "not found".
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: {
      client: true,
      scopeGroups: {
        include: { category: true },
        orderBy: { sortOrder: "asc" },
      },
      addOns: { orderBy: { sortOrder: "asc" } },
      invoices: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });

  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(quote);
}

// Quotes are edited directly, not versioned — unlike invoices, there's no signed
// commitment yet before acceptance, so a straight PATCH is the right model.
export async function PATCH(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "edit quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
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
    // Whether tax applies at all, as opposed to the tax AMOUNT.
    //
    // This was read in two places and written in none: the edit page restored
    // the checkbox from it and the public quote route consulted it, but no route
    // ever stored it, so it sat at its schema default of `true` forever. A
    // contractor who unticked "Apply tax", saved, and reopened the quote found
    // the box ticked again — and the next edit silently put the tax back on a
    // price they had deliberately set without it.
    taxEnabled,
    notes,
    processNotes,
    validUntil,
    scopeGroups,
  } = body;

  const updated = await db.quote.update({
    where: { id },
    data: {
      ...(status !== undefined && {
        status,
        ...(status === "sent" && { sentAt: new Date() }),
      }),
      ...(subtotal !== undefined && { subtotal }),
      ...(discount !== undefined && { discount }),
      ...(tax !== undefined && { tax }),
      ...(total !== undefined && { total }),
      ...(taxEnabled !== undefined && { taxEnabled: Boolean(taxEnabled) }),
      ...(notes !== undefined && { notes }),
      ...(processNotes !== undefined && { processNotes }),
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
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete is a distinct level above edit — someone trusted to revise a quote
  // isn't automatically trusted to make it disappear.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit_delete", "delete quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
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

  await db.quote.delete({ where: { id } });
  await recordActivity(member, {
    action: "quote.deleted",
    entityType: "quote",
    entityId: id,
    summary: `Deleted quote ${existing.quoteNumber}`,
    metadata: { total: existing.total },
  });
  return NextResponse.json({ success: true });
}
