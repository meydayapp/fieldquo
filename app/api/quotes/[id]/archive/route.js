// app/api/quotes/[id]/archive/route.js
//
// POST { archived: true | false } → sets or clears Quote.archivedAt.
//
// Archiving is a filing act, not a decision about the quote: the status is
// untouched, nothing is emailed, nothing is deleted. The list hides archived
// quotes unless asked (GET /api/quotes?archived=1) and the detail page says
// so and offers the way back. Same rung as editing a quote — someone at
// view_only can read the list and cannot reshape it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "archive quotes");
  if (denied) return denied;

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, quoteNumber: true, archivedAt: true },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const archived = body?.archived !== false;
  const updated = await db.quote.update({
    where: { id: quote.id },
    data: { archivedAt: archived ? new Date() : null },
    select: { id: true, archivedAt: true },
  });

  await recordActivity(member, {
    action: archived ? "quote.archived" : "quote.unarchived",
    entityType: "quote",
    entityId: quote.id,
    summary: `Quote ${quote.quoteNumber} ${archived ? "archived" : "restored from the archive"}`,
  });

  return NextResponse.json(updated);
}
