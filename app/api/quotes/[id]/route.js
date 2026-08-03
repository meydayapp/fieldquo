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
import {
  reconcileScopeGroups,
  reconcileImportsForQuote,
} from "@/lib/quotes/importQuote";

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

  // Which scope groups came from an import — the editor renders these read-only
  // (the received cost is fixed; the markup is edited from the quote page). The
  // targetLineId of each import is the scope group id it created.
  const imports = await db.quoteImport.findMany({
    where: { targetQuoteId: id },
    select: { targetLineId: true },
  });
  const importedGroupIds = imports.map((i) => i.targetLineId);

  return NextResponse.json({ ...quote, importedGroupIds });
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

  // Line-item edits are only valid while the quote is open. Editing scope groups
  // on a decided (accepted/declined) quote would rewrite what was agreed and —
  // through reconcileImportsForQuote below — could delete a subcontractor cost
  // already materialised into a job expense, silently corrupting job costing.
  // Status-only changes (accept/decline/send) carry no scopeGroups and are fine.
  if (scopeGroups && !["draft", "sent"].includes(existing.status)) {
    return NextResponse.json(
      { error: "This quote is already decided — its line items can't be changed." },
      { status: 400 },
    );
  }

  const scalarData = {
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
  };

  // Scope groups are reconciled by id rather than wiped and recreated: an editor
  // save used to regenerate every group id, which silently orphaned a
  // QuoteImport's targetLineId (breaking its Remove control). Preserving ids
  // keeps the linkage valid, and reconcileImportsForQuote then drops any import
  // whose group the GC deleted — so a removed subcontractor line can't leave a
  // dangling "imported" state on the sub's side. One transaction so a partial
  // write can't leave groups and imports disagreeing.
  const updated = await db.$transaction(async (tx) => {
    await tx.quote.update({ where: { id }, data: scalarData });
    if (scopeGroups) {
      await reconcileScopeGroups(tx, id, scopeGroups);
      await reconcileImportsForQuote(tx, id);
    }
    return tx.quote.findUnique({
      where: { id },
      include: { client: true, scopeGroups: { include: { category: true } } },
    });
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
