// app/api/platform/billing/subscriptions/route.js
//
// Every subscription, with the derived signals that make it actionable:
// which trials are about to lapse, which are already past, and which
// companies are paying but haven't linked Stripe.
//
// ══ And the trials that have no Subscription row at all ══════════════════
//
// Since 38d3308d signup takes no card: a new company is on its thirty-day
// trial (Company.trialEndsAt) with NO Subscription row until the owner picks
// a plan from the banner. The owner looked for new signups here, in the
// Trialing tab, and found none — correct by the old query, wrong by the
// product. So the card-free trials (lib/signup/abandoned.js
// cardFreeTrialWhere) are returned too:
//
//   · as rows, status "trialing", `noPlan: true`, in the All and Trialing
//     views — marked "No card · no plan yet" on the screen, never priced
//     (no plan, no MRR);
//   · as `freeTrials`, the read-only "Free trials without a plan (N)" list
//     with owner, signup date, days left and country, whatever tab is open.
//
// Their days left come from lib/billing/access.js trialAccessFor, the same
// function behind the company's own banner. Nothing here writes anything.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { cardFreeTrialWhere } from "@/lib/signup/abandoned";
import { trialAccessFor } from "@/lib/billing/access";

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

  const trialCompanies = await db.company.findMany({
    where: { isDemo: false, ...cardFreeTrialWhere() },
    select: {
      id: true,
      name: true,
      email: true,
      country: true,
      createdAt: true,
      trialEndsAt: true,
      onboardingStatus: true,
      members: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const freeTrials = trialCompanies.map((c) => {
    const t = trialAccessFor(c, new Date(now));
    return {
      companyId: c.id,
      companyName: c.name,
      ownerName: c.members[0]?.user?.name || null,
      ownerEmail: c.members[0]?.user?.email || c.email || null,
      country: c.country || null,
      signedUpAt: c.createdAt,
      trialEndsAt: c.trialEndsAt,
      // "full" = inside the thirty days; "readonly" / "locked" = past them.
      level: t?.level || null,
      daysLeft: t?.level === "full" ? t.daysLeft : 0,
    };
  });

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

  // The card-free trials as rows of the Trialing view: only those still
  // inside their thirty days are "trialing"; one past them has no status a
  // Subscription could carry and stays in `freeTrials` alone.
  const noPlanRows =
    !status || status === "trialing"
      ? freeTrials
          .filter((f) => f.level === "full")
          .map((f) => ({
            id: `trial:${f.companyId}`,
            status: "trialing",
            noPlan: true,
            planName: "No plan yet",
            priceMonthly: 0,
            companyId: f.companyId,
            companyName: f.companyName,
            companyEmail: f.ownerEmail,
            onboardingStatus: null,
            currentPeriodEnd: null,
            trialEndsAt: f.trialEndsAt,
            trialDaysLeft: f.daysLeft,
            since: f.signedUpAt,
            // Nothing to bill yet, and nothing wrong about that: the plan is
            // chosen from the banner before the trial ends.
            billable: false,
          }))
      : [];
  rows.push(...noPlanRows);
  rows.sort((a, b) => new Date(b.since) - new Date(a.since));

  const mrr = rows
    .filter((r) => r.status === "active")
    .reduce((sum, r) => sum + r.priceMonthly, 0);

  return NextResponse.json({
    rows,
    freeTrials,
    summary: {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      trialing: rows.filter((r) => r.status === "trialing").length,
      // Of which: on the card-free trial, no plan chosen yet.
      trialingNoPlan: noPlanRows.length,
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
