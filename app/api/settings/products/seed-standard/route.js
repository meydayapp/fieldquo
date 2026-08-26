// app/api/settings/products/seed-standard/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { seedStandardAddOns } from "@/lib/products/seedStandardAddOns";

// Lets an existing company pull in the standard add-on products for a category
// they already have (new companies get these at signup). Owner/admin only —
// it writes to the shared Products & Services catalog.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { categoryId } = await request.json();
  if (!categoryId) {
    return NextResponse.json(
      { error: "categoryId is required" },
      { status: 400 },
    );
  }

  // Must be a system category or one this company owns — never seed against
  // another company's custom category.
  const category = await db.serviceCategory.findFirst({
    where: {
      id: categoryId,
      OR: [{ isSystem: true }, { companyId: member.companyId }],
    },
    select: { id: true, key: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  // `linked` is items the company already had under another trade that now
  // also serve this one — the usual outcome for a cabinet shop, since the same
  // hinges and handles are sold on refinishing and refacing both. Returned
  // separately because reporting it as "0 added" is what made this look broken.
  const { created, linked } = await seedStandardAddOns({
    companyId: member.companyId,
    categoryId: category.id,
    categoryKey: category.key,
  });

  return NextResponse.json({ created, linked });
}
