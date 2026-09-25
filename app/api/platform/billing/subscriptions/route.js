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
//
// ══ 2026-09-25: the summary is the book, not the tab ═══════════════════════
//
// The four tiles were computed from the rows of whichever tab was open, so
// clicking "Active" turned "Trialing: 5" into "Trialing: 0", and "MRR" was
// the sum of every active plan price — a different number from the home
// page's "Collectable MRR" under the same three letters. The tiles now come
// from the same classified book the home page counts with
// (lib/platform/trialCounting.js loadSubscriberBook): the same Trialing, the
// same Paying, the same MRR, whatever tab is open. The tab filters the TABLE.
// Demo companies' rows are left out here as everywhere else.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { cardFreeTrialWhere } from "@/lib/signup/abandoned";
import { trialAccessFor } from "@/lib/billing/access";
import { loadSubscriberBook, outlookSubscriptions } from "@/lib/platform/trialCounting";
import { isTrialingBucket } from "@/lib/platform/subscriberBuckets";
import { buildRevenueOutlook } from "@/lib/platform/revenueOutlook";
import { stripeMirrorFreshness } from "@/lib/platform/webhookHealth";

const DAY = 86400000;

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

  const nowDate = new Date();
  const now = nowDate.getTime();

  const [book, trialCompanies, stripeMirror] = await Promise.all([
    loadSubscriberBook(db, { now: nowDate }),
    // The owner's name and email for the free-trial list — the one thing the
    // book does not carry.
    db.company.findMany({
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
    }),
    stripeMirrorFreshness().catch((err) => {
      console.error("[platform/subscriptions] mirror freshness unavailable:", err?.message);
      return null;
    }),
  ]);

  const freeTrials = trialCompanies.map((c) => {
    const t = trialAccessFor(c, nowDate);
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

  const customers = book.companies.filter((c) => c.bucket !== "demo");

  // One row per real company holding a Subscription, newest first.
  const allRows = customers
    .filter((c) => c.subscription)
    .map((c) => {
      const s = c.subscription;
      const trialEnds = s.trialEndsAt ? new Date(s.trialEndsAt).getTime() : null;
      const trialDaysLeft =
        trialEnds === null ? null : Math.ceil((trialEnds - now) / DAY);
      return {
        id: s.id,
        status: s.status,
        bucket: c.bucket,
        planName: s.plan?.name || "—",
        priceMonthly: Number(s.plan?.priceMonthly || 0),
        companyId: c.id,
        companyName: c.name || "—",
        companyEmail: c.email,
        onboardingStatus: c.onboardingStatus,
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

  // The card-free trials still inside their thirty days — the Trialing·no
  // plan bucket — as rows of the Trialing view. One past its thirty days has
  // no status a Subscription could carry and stays in `freeTrials` alone.
  const noPlanRows = customers
    .filter((c) => c.bucket === "trial_no_plan")
    .map((c) => {
      const t = trialAccessFor(c, nowDate);
      const owner = freeTrials.find((f) => f.companyId === c.id);
      return {
        id: `trial:${c.id}`,
        status: "trialing",
        bucket: c.bucket,
        noPlan: true,
        planName: "No plan yet",
        priceMonthly: 0,
        companyId: c.id,
        companyName: c.name,
        companyEmail: owner?.ownerEmail || c.email || null,
        onboardingStatus: null,
        currentPeriodEnd: null,
        trialEndsAt: c.trialEndsAt,
        trialDaysLeft: t?.daysLeft ?? null,
        since: c.createdAt,
        // Nothing to bill yet, and nothing wrong about that: the plan is
        // chosen from the banner before the trial ends.
        billable: false,
      };
    });

  const everyRow = [...allRows, ...noPlanRows].sort((a, b) => new Date(b.since) - new Date(a.since));
  // The tab filters the TABLE only.
  const rows = status ? everyRow.filter((r) => r.status === status) : everyRow;

  // The same money the home page prints: the revenue outlook over the Paying
  // and Trialing-with-a-plan buckets. "MRR" here was the sum of every active
  // plan price, including subscriptions Stripe cannot charge.
  const outlook = buildRevenueOutlook(outlookSubscriptions(book.companies), nowDate);
  const { tally } = book;

  return NextResponse.json({
    rows,
    freeTrials,
    stripeMirror,
    countedAt: book.at,
    summary: {
      total: everyRow.length,
      active: tally.counts.paying,
      pastDue: tally.counts.past_due,
      trialing: tally.trialing.total,
      trialingWithPlan: tally.trialing.withPlan,
      // Of which: on the card-free trial, no plan chosen yet.
      trialingNoPlan: tally.trialing.noPlan,
      mrr: outlook.collectableMrr,
      mrrOnPaper: outlook.nominalMrr,
      collectableCount: outlook.collectableCount,
      // The two lists worth acting on today — over the whole book.
      expiringSoon: everyRow.filter(
        (r) => isTrialingBucket(r.bucket) && r.trialDaysLeft !== null && r.trialDaysLeft >= 0 && r.trialDaysLeft <= 7,
      ).length,
      unbillable: allRows.filter((r) => r.bucket === "paying" && !r.billable).length,
    },
  });
}
