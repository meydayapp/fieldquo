// app/api/quote-templates/route.js
//
// GET → the company's quote templates, newest first, each with its groups
//       resolved to { category } so the builder can open one without a
//       second request. Readable by anyone who can build a quote.
//
// Creating one is POST /api/quotes/[id]/template — a template is always
// saved FROM a quote (lib/quotes/quoteTemplates.js on what it carries).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { templateToBuilder } from "@/lib/quotes/quoteTemplates";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "use quote templates");
  if (denied) return denied;

  const rows = await db.quoteTemplate.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
  });
  const ids = new Set();
  for (const r of rows) for (const g of Array.isArray(r.scopeGroups) ? r.scopeGroups : []) if (g?.categoryId) ids.add(g.categoryId);
  const categories = ids.size
    ? await db.serviceCategory.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, key: true, label: true, unit: true, defaultRate: true, customFields: true },
      })
    : [];
  const byId = new Map(categories.map((c) => [c.id, c]));

  return NextResponse.json(
    rows.map((r) => ({
      ...templateToBuilder(r, byId),
      createdAt: r.createdAt,
      sourceQuoteId: r.sourceQuoteId,
    })),
  );
}
