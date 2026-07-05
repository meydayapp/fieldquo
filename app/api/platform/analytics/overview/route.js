// app/api/platform/analytics/overview/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalCompanies,
    activeCompanies,
    trialCompanies,
    churnedThisMonth,
    activeSubscriptions,
    quotesThisMonth,
    jobsThisMonth,
  ] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { onboardingStatus: "active" } }),
    db.company.count({
      where: { onboardingStatus: "pending", trialEndsAt: { gte: now } },
    }),
    db.company.count({
      where: { onboardingStatus: "churned", updatedAt: { gte: startOfMonth } },
    }),
    db.subscription.findMany({
      where: { status: "active" },
      include: { plan: { select: { priceMonthly: true } } },
    }),
    db.quote.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.job.count({ where: { createdAt: { gte: startOfMonth } } }),
  ]);

  const mrr = activeSubscriptions.reduce(
    (sum, s) => sum + Number(s.plan.priceMonthly),
    0,
  );

  return NextResponse.json({
    mrr: Math.round(mrr * 100) / 100,
    activeSubscriptionCount: activeSubscriptions.length,
    totalCompanies,
    activeCompanies,
    trialCompanies,
    churnedThisMonth,
    quotesThisMonth,
    jobsThisMonth,
  });
}
