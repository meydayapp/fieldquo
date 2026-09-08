// lib/platform/planChange.js
//
// WHEN a plan change takes effect: now, or at the end of what they already
// paid for.
//
// ══ The owner's decision ═══════════════════════════════════════════════════
//
// 2026-09-08: "When someone changes their plan the change should be made on
// the next billing cycle; if it's a year then only after the year ends."
//
// Read literally that covers every change. The split shipped is narrower and
// deliberate: a DOWNGRADE, or a switch between monthly and yearly at the same
// or a lower tier, waits for the period to end — nothing is refunded, credited
// or charged until then, and the company keeps the seats it paid for. An
// UPGRADE applies immediately and is prorated, because a shop that just hired
// two estimators needs the seats today, and making them wait until the 1st to
// write a quote is a lost sale for them and for us.
//
// That split lives behind UPGRADE_TIMING below so the owner's fuller reading
// ("everything at period end") is a one-word change, checked by
// scripts/check-plan-change.mjs, and not a hunt through a route and a page.
//
// ══ Rank, never name ═══════════════════════════════════════════════════════
//
// "Is this an upgrade?" is a question about ORDER, and plan names carry none:
// "Crew" sorts before "Solo" alphabetically and after it commercially. The
// order is read from the seat ladder's tier keys (lib/pricing/ladder.js), with
// the platform console's sortOrder for plans off the ladder, and the monthly
// price as the last resort for two bespoke rows that have neither — a company
// moving from a negotiated CA$90 row to Crew at CA$169 is paying more, which
// is what "upgrade" means to the person being charged.
//
// Pure, so the whole table of pairings is executed by the check rather than
// reasoned about.

import { SEAT_LADDER } from "@/lib/pricing/ladder";
import { isBillingInterval, DEFAULT_INTERVAL } from "@/lib/billing/interval";

/**
 * When an UPGRADE takes effect. "now" — immediate and prorated, today's
 * behaviour. Flip to "period_end" to make every change wait for the period to
 * end, which is the literal reading of the owner's decision quoted above;
 * nothing else needs to move, the route and the page both branch on
 * `applies`.
 */
export const UPGRADE_TIMING = "now";

/** Downgrades and cadence changes always wait. Not a knob — the decision. */
const DEFERRED_TIMING = "period_end";

const TIER_RANK = Object.fromEntries(SEAT_LADDER.map((t, i) => [t.tierKey, i + 1]));

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Where two plans sit relative to each other. Returns -1, 0 or 1 (next is
 * lower, equal, higher than current), always comparing like with like: both
 * on the ladder, else both by sortOrder, else both by monthly price.
 */
export function comparePlanRank(currentPlan, nextPlan) {
  const ladder = [currentPlan, nextPlan].map((p) => TIER_RANK[p?.tierKey] ?? null);
  if (ladder[0] !== null && ladder[1] !== null) return Math.sign(ladder[1] - ladder[0]);

  const order = [currentPlan, nextPlan].map((p) => {
    const n = num(p?.sortOrder);
    return n !== null && n > 0 ? n : null;
  });
  if (order[0] !== null && order[1] !== null) return Math.sign(order[1] - order[0]);

  const price = [currentPlan, nextPlan].map((p) => num(p?.priceMonthly) ?? 0);
  return Math.sign(price[1] - price[0]);
}

/**
 * Classify a change of plan and/or cadence.
 *
 * @returns {{ kind: "upgrade"|"downgrade"|"cadence"|"same", applies: "now"|"period_end" }}
 */
export function classifyPlanChange({ currentPlan, currentInterval, nextPlan, nextInterval }) {
  const from = isBillingInterval(currentInterval) ? currentInterval : DEFAULT_INTERVAL;
  const to = isBillingInterval(nextInterval) ? nextInterval : DEFAULT_INTERVAL;

  const sameTier =
    currentPlan && nextPlan && currentPlan.id !== undefined && currentPlan.id === nextPlan.id
      ? true
      : comparePlanRank(currentPlan, nextPlan) === 0;

  if (sameTier) {
    if (from === to) return { kind: "same", applies: "now" };
    return { kind: "cadence", applies: DEFERRED_TIMING };
  }
  if (comparePlanRank(currentPlan, nextPlan) > 0) {
    return { kind: "upgrade", applies: UPGRADE_TIMING };
  }
  return { kind: "downgrade", applies: DEFERRED_TIMING };
}

/**
 * Did a scheduled change just LAND on the live Stripe subscription?
 *
 * The schedule's second phase carries planId/billingInterval in its metadata,
 * and Stripe copies phase metadata onto the subscription when the phase is
 * entered — so the customer.subscription.updated whose metadata.planId differs
 * from what the row says is the moment the switch actually happened. That is
 * when the row's planId moves and the "your plan changed" note goes out; not
 * when the change was scheduled, because at that point nothing had changed.
 *
 * With no pending change on the row, a differing metadata planId is a change
 * made in the Stripe dashboard by hand, and is honoured for the same reason
 * the cadence is read from the live price: Stripe is the authority. With a
 * pending change, only the plan we scheduled is accepted — anything else is
 * noise from a partially-applied phase, and it must not move the row.
 *
 * Pure; the check runs it against every combination.
 *
 * @returns {{ planId: string, billingInterval: string|undefined }|null}
 */
export function landedPlanChange(row, metadata) {
  const metaPlanId = metadata?.planId || null;
  if (!metaPlanId || !row) return null;
  if (metaPlanId === row.planId) return null;
  if (row.pendingPlanId && metaPlanId !== row.pendingPlanId) return null;
  return {
    planId: metaPlanId,
    billingInterval: isBillingInterval(metadata?.billingInterval) ? metadata.billingInterval : undefined,
  };
}

/** The four columns a pending change occupies, all cleared together. */
export const CLEAR_PENDING = Object.freeze({
  pendingPlanId: null,
  pendingBillingInterval: null,
  pendingEffectiveAt: null,
  stripeScheduleId: null,
});
