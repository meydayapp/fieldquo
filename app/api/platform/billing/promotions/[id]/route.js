// app/api/platform/billing/promotions/[id]/route.js
//
// Edit and toggle one promotion. Separate from the collection route so PATCH
// isn't reachable without an id — same shape as the plans routes.
//
// There is no DELETE, on purpose. A promotion is the reason a company is
// paying less than the sticker price, so it is the answer to "why is this
// invoice $90.30?" months after it ended. Deleting the row destroys that
// answer and saves nothing; switching it off is what the toggle is for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { parsePromotionFields } from "@/lib/billing/promotionFields";
import { promotionIsLive } from "@/lib/pricing/ladder";

export async function PATCH(request, { params }) {
  const { id } = await params;

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

  const existing = await db.platformPromotion.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { data, error } = parsePromotionFields(body, {
    partial: true,
    existing,
  });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const promotion = await db.platformPromotion.update({ where: { id }, data });

  // Whether this edit turned a discount ON or OFF is the fact somebody will be
  // looking for, and it is not recoverable from the field values alone — a row
  // can go from active to active and still stop running because the end date
  // moved. Asked of promotionIsLive rather than derived here, so the log and
  // the pricing engine cannot disagree.
  const wasLive = promotionIsLive(existing);
  const isLive = promotionIsLive(promotion);

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "promotion_updated",
      details: {
        promotionId: id,
        label: promotion.label,
        // Only the fields this request actually sent, so a toggle reads as a
        // toggle in the log rather than as an eleven-field rewrite.
        changed: Object.keys(data),
        previousActive: existing.active,
        newActive: promotion.active,
        previousEndsAt: existing.endsAt,
        newEndsAt: promotion.endsAt,
        previousDiscount: `${existing.discountKind} ${String(existing.discountValue)}`,
        newDiscount: `${promotion.discountKind} ${String(promotion.discountValue)}`,
        wasRunning: wasLive,
        nowRunning: isLive,
      },
    },
  });

  return NextResponse.json(promotion);
}
