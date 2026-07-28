// app/api/platform/billing/plans/[id]/route.js
//
// Edit and retire individual plans. Separate from the collection route so
// PATCH/DELETE aren't reachable without an id.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

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

  const existing = await db.plan.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    name,
    priceMonthly,
    stripePriceId,
    maxUsers,
    maxQuotesPerMonth,
    aiCopilotEnabled,
    features,
  } = body;

  const plan = await db.plan.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(priceMonthly !== undefined && { priceMonthly }),
      ...(stripePriceId !== undefined && { stripePriceId: stripePriceId || null }),
      ...(maxUsers !== undefined && { maxUsers }),
      ...(maxQuotesPerMonth !== undefined && { maxQuotesPerMonth }),
      ...(aiCopilotEnabled !== undefined && {
        aiCopilotEnabled: !!aiCopilotEnabled,
      }),
      ...(features !== undefined && { features }),
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "plan_updated",
      details: {
        planId: id,
        name: plan.name,
        // Price changes affect what existing subscribers are billed, so the
        // before value is the one you'll want when someone asks why their
        // invoice changed.
        previousPrice: String(existing.priceMonthly),
        newPrice: String(plan.priceMonthly),
      },
    },
  });

  return NextResponse.json(plan);
}

export async function DELETE(request, { params }) {
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

  // Refuse to delete a plan anyone is on. Subscription.planId is a required
  // relation, so deleting would either orphan or cascade — and cascading here
  // would silently cancel paying customers' subscriptions.
  const inUse = await db.subscription.count({ where: { planId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      {
        error: `${inUse} ${inUse === 1 ? "company is" : "companies are"} on this plan. Move them to another plan first.`,
      },
      { status: 409 },
    );
  }

  const plan = await db.plan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.plan.delete({ where: { id } });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "plan_deleted",
      details: { planId: id, name: plan.name },
    },
  });

  return NextResponse.json({ ok: true });
}
