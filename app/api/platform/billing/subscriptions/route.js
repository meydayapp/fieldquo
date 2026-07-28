// app/api/platform/billing/subscriptions/route.js
//
// Every subscription, with the derived signals that make it actionable:
// which trials are about to lapse, which are already past, and which
// companies are paying but haven't linked Stripe.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "analytics:view");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const subscriptions = await db.subscription.findMany({
    where: { ...(status && { status }) },
    include: {
      plan: { select: { name: true, priceMonthly: true } },
      company: {
        select: {
          id: true,
          name: true,
          email: true,
          onboardingStatus: true,
          stripeChargesEnabled: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const DAY = 86400000;

  const rows = subscriptions.map((s) => {
    const trialEnds = s.trialEndsAt ? new Date(s.trialEndsAt).getTime() : null;
    const trialDaysLeft =
      trialEnds === null ? null : Math.ceil((trialEnds - now) / DAY);

    return {
      id: s.id,
      status: s.status,
      planName: s.plan?.name || "—",
      priceMonthly: Number(s.plan?.priceMonthly || 0),
      companyId: s.company?.id,
      companyName: s.company?.name || "—",
      companyEmail: s.company?.email,
      onboardingStatus: s.company?.onboardingStatus,
      currentPeriodEnd: s.currentPeriodEnd,
      trialEndsAt: s.trialEndsAt,
      trialDaysLeft,
      since: s.createdAt,
      // A subscription with no Stripe id can't actually bill. Usually means
      // the company was created manually and never completed checkout — the
      // kind of thing that goes unnoticed until you wonder why MRR doesn't
      // match the bank.
      billable: Boolean(s.stripeSubscriptionId),
    };
  });

  const mrr = rows
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + r.priceMonthly, 0);

  return NextResponse.json({
    rows,
    summary: {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      trialing: rows.filter((r) => r.status === "trialing").length,
      mrr,
      // The two lists worth acting on today.
      expiringSoon: rows.filter(
        (r) => r.trialDaysLeft !== null && r.trialDaysLeft >= 0 && r.trialDaysLeft <= 7,
      ).length,
      unbillable: rows.filter((r) => r.status === "active" && !r.billable)
        .length,
    },
  });
}
