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
import { removeImport, ImportError } from "@/lib/quotes/importQuote";
import { recordActivity } from "@/lib/activity/log";

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
