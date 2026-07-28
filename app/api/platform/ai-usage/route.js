// app/api/platform/ai-usage/route.js
//
// What FieldQuo is spending on AI, per company.
//
// GET   — this month's usage across all companies, biggest first
// PATCH — set or clear a company's monthly token cap
//
// Ordering by tokens descending is the whole point: the question this page
// answers is "who is running up the bill", and that company should be the
// first row, not something you have to sort for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { DEFAULT_TRIAL_CAP } from "@/lib/ai/usage";

function startOfMonth(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thisMonth = startOfMonth();
  const lastMonth = startOfMonth(-1);

  const [current, previous, companies, featureSplit] = await Promise.all([
    db.aiUsage.groupBy({
      by: ["companyId"],
      where: { createdAt: { gte: thisMonth } },
      _sum: { totalTokens: true, costMicros: true },
      _count: true,
    }),
    // Last month is what makes a spike legible. 400k tokens means nothing on
    // its own; 400k against 20k last month is a story.
    db.aiUsage.groupBy({
      by: ["companyId"],
      where: { createdAt: { gte: lastMonth, lt: thisMonth } },
      _sum: { totalTokens: true },
    }),
    db.company.findMany({
      select: {
        id: true,
        name: true,
        aiMonthlyTokenCap: true,
        onboardingStatus: true,
        subscription: {
          select: { plan: { select: { name: true, aiMonthlyTokenCap: true } } },
        },
      },
    }),
    db.aiUsage.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: thisMonth } },
      _sum: { totalTokens: true, costMicros: true },
      _count: true,
    }),
  ]);

  const byId = new Map(companies.map((c) => [c.id, c]));
  const prevById = new Map(
    previous.map((p) => [p.companyId, p._sum.totalTokens || 0]),
  );

  const rows = current
    .map((u) => {
      const c = byId.get(u.companyId);
      const planCap = c?.subscription?.plan?.aiMonthlyTokenCap;
      const effectiveCap =
        c?.aiMonthlyTokenCap ?? planCap ?? DEFAULT_TRIAL_CAP;

      return {
        companyId: u.companyId,
        name: c?.name || "(deleted company)",
        status: c?.onboardingStatus,
        planName: c?.subscription?.plan?.name || null,
        tokens: u._sum.totalTokens || 0,
        costMicros: u._sum.costMicros || 0,
        calls: u._count,
        lastMonthTokens: prevById.get(u.companyId) || 0,
        companyCap: c?.aiMonthlyTokenCap ?? null,
        planCap: planCap ?? null,
        effectiveCap,
        // null cap = unlimited, so percentage is meaningless there.
        percentUsed:
          effectiveCap && effectiveCap > 0
            ? Math.round(((u._sum.totalTokens || 0) / effectiveCap) * 100)
            : null,
      };
    })
    .sort((a, b) => b.tokens - a.tokens);

  return NextResponse.json({
    periodStart: thisMonth,
    totals: {
      tokens: rows.reduce((s, r) => s + r.tokens, 0),
      costMicros: rows.reduce((s, r) => s + r.costMicros, 0),
      calls: rows.reduce((s, r) => s + r.calls, 0),
      companies: rows.length,
    },
    byFeature: featureSplit
      .map((f) => ({
        feature: f.feature,
        tokens: f._sum.totalTokens || 0,
        costMicros: f._sum.costMicros || 0,
        calls: f._count,
      }))
      .sort((a, b) => b.tokens - a.tokens),
    rows,
    defaultCap: DEFAULT_TRIAL_CAP,
  });
}

export async function PATCH(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Raising a cap costs FieldQuo real money, so this is superadmin-only —
  // the same bar as anything else that spends.
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can change AI limits." },
      { status: 403 },
    );
  }

  const { companyId, cap } = await request.json().catch(() => ({}));
  if (!companyId)
    return NextResponse.json({ error: "companyId required" }, { status: 400 });

  // Three meanings, all reachable:
  //   null      -> follow the plan
  //   0         -> no AI for this company
  //   a number  -> this specific allowance
  const value =
    cap === null || cap === "" ? null : Math.max(0, Math.floor(Number(cap)));

  if (value !== null && !Number.isFinite(value)) {
    return NextResponse.json({ error: "cap must be a number" }, { status: 400 });
  }

  const updated = await db.company.update({
    where: { id: companyId },
    data: { aiMonthlyTokenCap: value },
    select: { id: true, name: true, aiMonthlyTokenCap: true },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "ai_cap_changed",
      targetCompanyId: companyId,
      details: { cap: value },
    },
  });

  return NextResponse.json(updated);
}
