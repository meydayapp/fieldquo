// app/api/settings/checklists/seed/route.js
//
// "Add the starter checklists for my trades" on Settings → Checklists.
//
// The same installer signup and switching a trade on already run
// (lib/checklists/seedTemplates.js, called from seedServicesForTrade), for a
// company whose trades were switched on before the per-trade lists existed.
// Idempotent by seed key: pressing it twice adds nothing the second time, and
// a list the company has already edited or deleted-and-rewritten under its
// own name is never touched.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { seedChecklistTemplatesForTrade } from "@/lib/checklists/seedTemplates";

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same three roles the template routes let write (../route.js).
  if (!["owner", "admin", "supervisor"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners, admins and supervisors can change checklists." },
      { status: 403 },
    );
  }

  const enabled = await db.companyServiceCategory.findMany({
    where: { companyId: member.companyId, enabled: true },
    select: { categoryId: true, category: { select: { key: true } } },
  });

  let created = 0;
  let skipped = 0;
  for (const row of enabled) {
    const result = await seedChecklistTemplatesForTrade({
      companyId: member.companyId,
      categoryId: row.categoryId,
      categoryKey: row.category?.key,
    });
    created += result.created;
    skipped += result.skipped;
  }

  return NextResponse.json({ created, skipped, trades: enabled.length });
}
