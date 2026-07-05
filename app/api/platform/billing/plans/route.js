// app/api/platform/billing/plans/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  return NextResponse.json(plans);
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

  if (!name || priceMonthly === undefined) {
    return NextResponse.json(
      { error: "name and priceMonthly are required" },
      { status: 400 },
    );
  }

  const plan = await db.plan.create({
    data: {
      name,
      priceMonthly,
      stripePriceId: stripePriceId || null,
      maxUsers: maxUsers ?? null,
      maxQuotesPerMonth: maxQuotesPerMonth ?? null,
      aiCopilotEnabled: !!aiCopilotEnabled,
      features: features || null,
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
