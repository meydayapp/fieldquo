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
import { DEFAULT_TRIAL_CAP, resolveAiCap, AI_CAP_SELECT, blendedMicrosPerMillion } from "@/lib/ai/usage";

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

  // The last 30 days, for the measured blended rate — what a million tokens
  // has actually cost across every company's calls. /platform/billing/plans
  // converts each plan's token cap to dollars with it, so the dollar
  // allowance a superadmin types is compared against a real figure, not a
  // guess about the model mix.
  const blendedSince = new Date(Date.now() - 30 * 86400000);
  const [current, previous, companies, featureSplit, blendedSum] = await Promise.all([
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
        onboardingStatus: true,
        // The same select getAiCap reads, so this table and the gate resolve
        // a company's cap with one function (resolveAiCap) — this route used
        // to restate the chain inline, and the copy is the one that rots.
        ...AI_CAP_SELECT,
      },
    }),
    db.aiUsage.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: thisMonth } },
      _sum: { totalTokens: true, costMicros: true },
      _count: true,
    }),
    db.aiUsage.aggregate({
      where: { createdAt: { gte: blendedSince }, paidFromWallet: false },
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
      const resolved = resolveAiCap(c);
      const effectiveCap = resolved.cap;
      // Measured in the cap's own unit: dollars (micros) against a dollar
      // allowance, tokens against a token cap.
      const measured = resolved.unit === "dollars" ? u._sum.costMicros || 0 : u._sum.totalTokens || 0;

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
        planAllowanceCents: c?.subscription?.plan?.aiMonthlyAllowanceCents ?? null,
        effectiveCap,
        capUnit: resolved.unit,
        capSource: resolved.source,
        // null cap = unlimited, so percentage is meaningless there.
        percentUsed:
          effectiveCap && effectiveCap > 0
            ? Math.round((measured / effectiveCap) * 100)
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
    blended: {
      since: blendedSince,
      tokens: blendedSum?._sum?.totalTokens || 0,
      costMicros: blendedSum?._sum?.costMicros || 0,
      calls: blendedSum?._count || 0,
      // Null with no usage — the plans page then says "no usage to measure"
      // rather than converting at an invented rate.
      microsPerMillion: blendedMicrosPerMillion({
        tokens: blendedSum?._sum?.totalTokens,
        costMicros: blendedSum?._sum?.costMicros,
      }),
    },
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
