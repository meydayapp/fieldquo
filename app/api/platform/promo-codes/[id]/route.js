// app/api/platform/promo-codes/[id]/route.js
//
// PATCH — revoke a promo code, or put a revoked one back.
//
// ── Why this route exists ──────────────────────────────────────────────────
//
// It didn't. A generated code offered exactly two controls, "Copy code" and
// "Copy signup link", and DELETE and PATCH both 404'd. The model has carried
// an `active` boolean since it was written and nothing in the product could
// flip it — so a code granting free months, once out, could never be
// withdrawn. A mistyped rewardMonths was permanent.
//
// QA found this the hard way: testing label enforcement left a real,
// unredeemed, unrevokable code granting three free months live in production.
//
// ── Revoke, not delete ─────────────────────────────────────────────────────
//
// Setting active=false rather than removing the row, because the redemptions
// table points at it. Deleting a code that somebody already redeemed would
// orphan the record of why their account has free months on it — and "why is
// this company not being billed" is exactly the question the row answers.
//
// lib/platform/promoCodes.js already refuses an inactive code at redemption
// (`if (!promo.active) return { ok: false, reason: "inactive" }`), so this
// takes effect the moment it is saved. No second enforcement point to add.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function PATCH(request, { params }) {
  // Next 16: params is a Promise.
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

  const body = await request.json().catch(() => ({}));
  const active = body?.active;
  if (typeof active !== "boolean") {
    return NextResponse.json(
      { error: "Send { active: true } or { active: false }." },
      { status: 400 },
    );
  }

  const existing = await db.platformPromoCode.findUnique({
    where: { id },
    select: { id: true, code: true, active: true, redeemedCount: true, label: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "That code doesn't exist." }, { status: 404 });
  }

  const promo = await db.platformPromoCode.update({
    where: { id },
    data: { active },
    select: {
      id: true, code: true, label: true, kind: true, rewardMonths: true,
      maxRedemptions: true, redeemedCount: true, expiresAt: true,
      active: true, createdAt: true,
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: active ? "promo_code_reinstated" : "promo_code_revoked",
      details: {
        promoCodeId: promo.id,
        code: promo.code,
        label: promo.label,
        // Whether anyone had already used it. Revoking a code with
        // redemptions doesn't claw those back, and the log should make that
        // obvious to whoever reads it later.
        redeemedCount: existing.redeemedCount,
      },
    },
  });

  return NextResponse.json(promo);
}
