// app/api/overhead/fixed-costs/[id]/route.js
//
// Removing a recurring fixed cost. A list with no way to remove a mis-typed
// $20,000 rent would be worse than no list: the typo silently raises the price
// floor on every quote the company writes afterwards.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage fixed costs" },
      { status: 403 },
    );
  }

  // isOverhead + recurring in the WHERE, not just companyId. /api/expenses/[id]
  // gates deletion on "you recorded it yourself" for ordinary receipts; this
  // route is deliberately broader (any owner/admin may remove a company
  // commitment), so it must not become a way to delete a colleague's fuel
  // receipt by id.
  const existing = await db.expense.findFirst({
    where: {
      id: _params.id,
      companyId: member.companyId,
      isOverhead: true,
      recurring: true,
    },
    select: { id: true, category: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.expense.delete({ where: { id: existing.id } });

  await recordActivity(member, {
    action: "settings.fixed_cost_removed",
    entityType: "settings",
    summary: `Removed fixed cost ${existing.category}`,
    metadata: { name: existing.category },
  });

  return NextResponse.json({ success: true });
}
