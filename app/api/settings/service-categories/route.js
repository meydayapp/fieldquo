// app/api/settings/service-categories/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember"; // resolves session -> { companyId, role }

// GET — full catalog, merged with this company's settings (enabled/rate/unit)
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await db.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      companySettings: { where: { companyId: member.companyId } },
    },
  });

  const merged = categories.map((c) => {
    const setting = c.companySettings[0] || null;
    return {
      id: c.id,
      key: c.key,
      label: c.label,
      icon: c.icon,
      enabled: setting?.enabled ?? false,
      pricingModel: setting?.pricingModel ?? "flat",
      defaultRate: setting?.defaultRate ?? null,
      unit: setting?.unit ?? null,
    };
  });

  return NextResponse.json(merged);
}

// PATCH — bulk upsert company's category settings
// body: { categories: [{ categoryId, enabled, pricingModel, defaultRate, unit }] }
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners/admins can change settings" },
      { status: 403 },
    );
  }

  const { categories } = await request.json();
  if (!Array.isArray(categories)) {
    return NextResponse.json(
      { error: "categories array required" },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    categories.map((c) =>
      db.companyServiceCategory.upsert({
        where: {
          companyId_categoryId: {
            companyId: member.companyId,
            categoryId: c.categoryId,
          },
        },
        update: {
          enabled: c.enabled,
          pricingModel: c.pricingModel || "flat",
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
        },
        create: {
          companyId: member.companyId,
          categoryId: c.categoryId,
          enabled: c.enabled,
          pricingModel: c.pricingModel || "flat",
          defaultRate: c.defaultRate ?? null,
          unit: c.unit || null,
        },
      }),
    ),
  );

  return NextResponse.json({ success: true, updated: results.length });
}
