// app/api/cron/sales-retention/route.js
//
// Milestone 3: the rep's company is still a paying customer after the window.
//
// ══ Why a nightly sweep and not a per-company timer ════════════════════════
//
// Every existing time-based money decision in this codebase is a nightly cron
// that sweeps eligible rows — grace-warning, renewal-reminders, voice-rent,
// crew-line-rent. A per-company scheduled job would be a second scheduling
// mechanism whose failures look nothing like the eighteen that already exist,
// and the row count here is tiny.
//
// ══ Why it re-derives instead of trusting a flag ═══════════════════════════
//
// Nothing marks a company "due". The sweep asks which attributed companies have
// no retention entry yet, then re-reads the subscription. That means a company
// whose circumstances changed since yesterday — cancelled, refunded, disputed,
// or converted from trial — is judged on today's facts, and a run that dies
// halfway simply resumes tomorrow with no half-written state.
//
// ══ Why the input set is ATTRIBUTIONS and not milestone-2 rows ═════════════
//
// It used to read `milestone: first_payment, status: earned` — the ledger row
// milestone 2 writes. That made a payout depend on another payout having
// happened, and milestone 2 could not fire at all (its rule wanted a
// subscription_create invoice with money on it, which this account never
// produces — see qualifiesForBillingCycle). So the sweep's input set was empty
// and milestone 3 had never paid anybody.
//
// Milestone 2 now fires on a billing-cycle boundary, free or paid, which fixes
// the emptiness — but chaining one milestone off another is the fault, not the
// filter. The clock is Subscription.createdAt and the conditions are read from
// the Subscription, so the honest input set is "companies a rep brought in".
// A company that reaches sixty days without ever reaching a cycle boundary
// (a long referral-extended trial) is now considered and held on its status,
// rather than being invisible.
//
// ══ Why a failure here is quiet and a failure to record is loud ════════════
//
// A missed milestone is recoverable: tomorrow's run finds it again, because
// nothing about "is this row old enough and unpaid" is consumed by looking.
// That is the property worth protecting, and it is why nothing below marks
// anything as attempted.
import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import {
  MILESTONES,
  commissionRef,
  earnMilestone,
  qualifiesForRetention,
} from "@/lib/sales/commission";

const BATCH = 200;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();

  // Every attributed company that has not yet produced a retention entry.
  // Read as a batch rather than a cursor, matching the other crons: the set is
  // small, and a batch makes "considered" mean what it says.
  //
  // Two narrowings happen in the query rather than in the loop, and neither can
  // exclude a company the loop would have paid:
  //
  //  * `none: { milestone: retention }` — with no status filter, deliberately.
  //    A REVERSED retention entry must not be re-earned; the ledger keeps the
  //    earning and its reversal as a pair, and re-paying it would make that
  //    pair a lie. earnMilestone's unique ref would refuse it anyway, but a
  //    sweep that tries every night and is refused every night reads as broken.
  //  * a subscription that exists and is not `canceled`. qualifiesForRetention
  //    rejects both on its own (`no_subscription_start`, `canceled`), but they
  //    would sit in a fixed-size batch forever — churn is permanent and
  //    attributions are not deleted, so eventually the 200 oldest rows would
  //    all be dead ones and companies that CAN qualify would never be looked
  //    at. That failure is silent and it is somebody's money. `is:` on a
  //    to-one relation also excludes a null one, which is the right answer for
  //    the handful of tenants that have no Subscription row at all: no
  //    subscription is no clock, permanently, not a gap to fill.
  //
  // Ordered by capture date so the oldest — the ones closest to their window —
  // are considered first, and a young company can never crowd out an old one.
  const attributions = await db.salesAttribution.findMany({
    where: {
      company: {
        salesCommissionEntries: { none: { milestone: MILESTONES.RETENTION } },
        subscription: { is: { status: { not: "canceled" } } },
      },
    },
    select: { companyId: true, salesRepId: true },
    orderBy: { capturedAt: "asc" },
    take: BATCH,
  });

  const counts = { considered: attributions.length, earned: 0, held: 0, skipped: 0, failed: 0 };
  const reasons = {};
  const tally = (r) => {
    reasons[r] = (reasons[r] || 0) + 1;
  };

  for (const attributed of attributions) {
    try {
      // Re-asked inside the loop as well as in the query above. The query is a
      // narrowing; this is the guard, and it is read fresh because a run can
      // take minutes and a retention entry can land from a re-run in between.
      const already = await db.salesCommissionEntry.findFirst({
        where: { companyId: attributed.companyId, ref: commissionRef(attributed.companyId, MILESTONES.RETENTION) },
        select: { id: true },
      });
      if (already) {
        counts.skipped++;
        tally("already_earned");
        continue;
      }

      const [subscription, rep] = await Promise.all([
        db.subscription.findUnique({
          where: { companyId: attributed.companyId },
          select: {
            status: true,
            canceledAt: true,
            refundedAt: true,
            refundedAmountCents: true,
            disputeStatus: true,
            // The clock for this milestone. createdAt is the row written at
            // checkout.session.completed — TRIAL START, not first charge —
            // which is what "still subscribed after 60 days (including
            // trial)" means. Anchoring on the first payment instead would pay
            // roughly a trial-length late.
            createdAt: true,
          },
        }),
        db.salesRep.findUnique({
          where: { id: attributed.salesRepId },
          select: { commissionPlan: { select: { retentionDays: true } } },
        }),
      ]);

      const verdict = qualifiesForRetention({
        subscriptionStartedAt: subscription?.createdAt || null,
        // No first-payment condition any more. It claimed a company sixty days
        // in has necessarily been charged, which referral months made false —
        // and the live subscription STATUS below answers the same question
        // better, from Stripe's own view rather than from our ledger.
        subscription,
        // The plan's own window, not a constant. 60 is a policy, and a rep
        // hired under different terms keeps the terms they were hired under.
        retentionDays: rep?.commissionPlan?.retentionDays ?? 60,
        now,
      });

      if (!verdict.qualifies) {
        // An open dispute is HELD rather than denied — it may be won, and
        // tomorrow's sweep will ask again. Counted separately so a growing
        // held figure is visible rather than hiding inside "skipped".
        if (verdict.holdUntilResolved) {
          counts.held++;
        } else {
          counts.skipped++;
        }
        tally(verdict.reason);
        continue;
      }

      const entry = await earnMilestone({
        companyId: attributed.companyId,
        milestone: MILESTONES.RETENTION,
        // No Stripe event here: nothing happened at Stripe. The milestone is
        // the ABSENCE of anything happening for sixty days, so the honest
        // timestamp is when we checked.
        occurredAt: now,
      });
      if (entry) {
        counts.earned++;
      } else {
        // earnMilestone returns null when there is no attribution or no
        // commission plan. Neither is an error — but neither is silent, or a
        // rep would wonder why a milestone never landed.
        counts.skipped++;
        tally("no_attribution_or_plan");
      }
    } catch (err) {
      counts.failed++;
      await recordError({
        area: "cron:sales-retention",
        message: `Retention milestone failed for company ${attributed.companyId}: ${err?.message}`,
        companyId: attributed.companyId,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, ...counts, reasons });
}
