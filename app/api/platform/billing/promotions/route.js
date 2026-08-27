// app/api/platform/billing/promotions/route.js
//
// Platform-console CRUD for PlatformPromotion — the dated, switchable discount
// that lib/pricing/ladder.js applies through priceFor().
//
// Gated exactly like the plans routes it sits beside: getCurrentPlatformAdmin
// for the session, then requirePlatformPermission(..., "plan:manage"), which
// superadmin holds via "*". Nothing here is protected by a hidden button.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { parsePromotionFields } from "@/lib/billing/promotionFields";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Newest first. Not "live ones first": an expired promotion that is still
  // switched on is exactly what an operator has come here to find, and sorting
  // it to the bottom is how it stays unnoticed.
  const promotions = await db.platformPromotion.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(promotions);
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "plan:manage");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { data, error } = parsePromotionFields(body, { partial: false });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const promotion = await db.platformPromotion.create({
    data: { ...data, createdByAdminId: admin.id },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "promotion_created",
      details: {
        promotionId: promotion.id,
        label: promotion.label,
        // The two facts that decide what it costs FieldQuo, together, because
        // "30" means nothing without knowing whether it is percent or dollars.
        discountKind: promotion.discountKind,
        discountValue: String(promotion.discountValue),
        durationMonths: promotion.durationMonths,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        tierKeys: promotion.tierKeys,
        currencies: promotion.currencies,
        // Whether it started discounting the moment it was saved.
        active: promotion.active,
      },
    },
  });

  return NextResponse.json(promotion, { status: 201 });
}
