// app/api/settings/products/seed-services/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { seedServicesForTrade } from "@/lib/products/seedServices";

// "Add missing services for my trade" on Settings > Services.
//
// An existing company — one that signed up before the trade seeds existed, or
// that switched a trade on before its seed did — pulls in every service the
// trade ships that it does not already hold. Idempotent by Product.seedKey:
// a row the company renamed or repriced is left exactly as it is, and the
// count says what happened. New companies get the same rows at signup
// (app/api/companies/route.js) and on enabling a trade (service-categories
// PATCH); this is the door for everyone else.
//
// Owner/admin only — it writes to the shared Products & Services catalogue,
// same gate as seed-standard next door.
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
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }

  // A system category only: a company's own custom quote type has no seed
  // (its key is custom_<cuid>), and seeding against another tenant's custom
  // category must be impossible rather than merely unlikely.
  const category = await db.serviceCategory.findFirst({
    where: { id: categoryId, OR: [{ isSystem: true }, { companyId: member.companyId }] },
    select: { id: true, key: true },
  });
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const result = await seedServicesForTrade({
    companyId: member.companyId,
    categoryId: category.id,
    categoryKey: category.key,
  });

  return NextResponse.json(result);
}
