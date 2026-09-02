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
// Nothing marks a company "due". The sweep asks the ledger which first-payment
// entries are old enough and have no retention entry yet, then re-reads the
// subscription. That means a company whose circumstances changed since
// yesterday — cancelled, refunded, disputed — is judged on today's facts, and
// a run that dies halfway simply resumes tomorrow with no half-written state.
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

  // Every first-payment entry that has not yet produced a retention entry.
  // Read as a batch rather than a cursor, matching the other crons: the set is
  // small, and a batch makes "considered" mean what it says.
  const firstPayments = await db.salesCommissionEntry.findMany({
    where: { milestone: MILESTONES.FIRST_PAYMENT, status: "earned" },
    select: { companyId: true, salesRepId: true, occurredAt: true },
    orderBy: { occurredAt: "asc" },
    take: BATCH,
  });

  const counts = { considered: firstPayments.length, earned: 0, held: 0, skipped: 0, failed: 0 };
  const reasons = {};
  const tally = (r) => {
    reasons[r] = (reasons[r] || 0) + 1;
  };

  for (const fp of firstPayments) {
    try {
      const already = await db.salesCommissionEntry.findFirst({
        where: { companyId: fp.companyId, ref: commissionRef(fp.companyId, MILESTONES.RETENTION) },
        select: { id: true },
      });
      if (already) {
        counts.skipped++;
        tally("already_earned");
        continue;
      }

      const [subscription, rep] = await Promise.all([
        db.subscription.findUnique({
          where: { companyId: fp.companyId },
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
          where: { id: fp.salesRepId },
          select: { commissionPlan: { select: { retentionDays: true } } },
        }),
      ]);

      const verdict = qualifiesForRetention({
        subscriptionStartedAt: subscription?.createdAt || null,
        // Still required, but as a condition rather than the clock: sixty days
        // in on a one-month trial means they have been charged.
        firstPaymentAt: fp.occurredAt,
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
        companyId: fp.companyId,
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
        message: `Retention milestone failed for company ${fp.companyId}: ${err?.message}`,
        companyId: fp.companyId,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, ...counts, reasons });
}
