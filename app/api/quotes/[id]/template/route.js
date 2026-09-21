// app/api/quotes/[id]/template/route.js
//
// POST { name } → a QuoteTemplate saved from THIS quote's groups, notes and
// process notes (lib/quotes/quoteTemplates.js). The quote is untouched. The
// "Save as template" item on the quote page's Send… menu lands here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { templateFromQuote } from "@/lib/quotes/quoteTemplates";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "save quote templates");
  if (denied) return denied;

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: { scopeGroups: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const built = templateFromQuote(quote, { name: body?.name, userId: member.userId });
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

  const row = await db.quoteTemplate.create({
    data: { ...built.data, companyId: member.companyId },
    select: { id: true, name: true, language: true, createdAt: true },
  });

  await recordActivity(member, {
    action: "quote.template_saved",
    entityType: "quote",
    entityId: quote.id,
    summary: `Quote ${quote.quoteNumber} saved as template "${row.name}"`,
    metadata: { templateId: row.id },
  });

  return NextResponse.json(row, { status: 201 });
}
