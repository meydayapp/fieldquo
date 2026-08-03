// app/api/quotes/[id]/imports/[importId]/route.js
//
// Remove an imported subcontractor cost from the viewer's own quote — the
// inverse of the import. Used to drop a losing bid (and, by importing another,
// swap in the one the GC wants to move forward with). Only the importing company
// can do this, and only while the quote is still open.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { removeImport, updateImportMarkup, ImportError } from "@/lib/quotes/importQuote";
import { recordActivity } from "@/lib/activity/log";

// Change the markup on an imported cost. The received cost stays fixed; only the
// GC's markup (their profit/overhead) moves, rescaling the client price.
export async function PATCH(request, { params }) {
  const { id, importId } = await params;

  const member = await getCurrentMember(request);
  if (!member || !member.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { markupPercent } = await request.json().catch(() => ({}));
  if (markupPercent === undefined)
    return NextResponse.json({ error: "markupPercent is required" }, { status: 400 });

  const targetCompany = await db.company.findUnique({
    where: { id: member.companyId },
    select: { taxRate: true },
  });

  try {
    const result = await updateImportMarkup({
      db,
      member,
      quoteId: id,
      importId,
      markupPercent,
      targetCompany,
    });
    await recordActivity(member, {
      action: "quote.cost_markup_changed",
      entityType: "quote",
      entityId: id,
      summary: `Changed a subcontractor cost markup to ${result.markupPercent}%`,
      metadata: { importId, markupPercent: result.markupPercent },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ImportError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[update import markup] failed:", err);
    return NextResponse.json(
      { error: "Couldn't update the markup. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const { id, importId } = await params;

  const member = await getCurrentMember(request);
  if (!member || !member.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetCompany = await db.company.findUnique({
    where: { id: member.companyId },
    select: { taxRate: true },
  });

  try {
    const result = await removeImport({
      db,
      member,
      quoteId: id,
      importId,
      targetCompany,
    });

    await recordActivity(member, {
      action: "quote.cost_removed",
      entityType: "quote",
      entityId: id,
      summary: "Removed an imported subcontractor cost",
      metadata: { importId },
    });

    return NextResponse.json({ ok: true, targetTotal: result.targetTotal });
  } catch (err) {
    if (err instanceof ImportError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[remove import] failed:", err);
    return NextResponse.json(
      { error: "Couldn't remove that cost. Please try again." },
      { status: 500 },
    );
  }
}
