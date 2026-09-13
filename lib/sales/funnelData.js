// lib/sales/funnelData.js
//
// The db half of lib/sales/funnelStages.js: read the rows for a month, hand
// them to the pure module, hand back one funnel per rep.
//
// ══ One loader for both screens ═══════════════════════════════════════════
//
// /api/platform/sales/funnel (every rep, superadmin and admin) and
// /api/sales/funnel (the rep's own card) both call loadRepFunnels() and
// differ only in `repIds`. A second loader for the rep's card would be the
// copy that rots (AGENTS.md failure class 4) — and the two screens showing a
// rep two different "agreed" counts for the same month is the one thing this
// feature must not do. The rep's own route passes its own id and nothing
// else, and the check asserts a rep's payload holds one funnel, theirs.
//
// ══ The retention verdict is decided HERE, with the sweep's own predicate ═
//
// qualifiesForRetention() in lib/sales/commission.js is what pays the
// retention milestone, so it is what says "retained" on this screen — same
// inputs the nightly sweep hands it (app/api/cron/sales-retention):
// Subscription.createdAt as the clock (trial start), the live status, the
// refund and dispute columns, and the rep's plan's own window when they have
// one. Restating the rule here would be the second copy; passing the verdict
// into the pure module as a list of ids is what lets the check execute the
// stage arithmetic without a database.

import { db } from "@/lib/db";
import { qualifiesForRetention } from "@/lib/sales/commission";
import {
  buildRepFunnel,
  fieldquoReferences,
  isMonthKey,
  monthBounds,
  monthKeyOf,
  stageCounts,
} from "@/lib/sales/funnelStages";

/** The one shape of a rep's link — the same string the send path puts in the body. */
const LINK_MARK = "/signup?sales=";

/**
 * @param {object} p
 * @param {string[]|null} p.repIds  null = every rep; a list returns only those (the references still use every rep)
 * @param {string} p.monthKey       "YYYY-MM"; defaults to the current UTC month
 * @param {Date} [p.now]
 * @returns {{ monthKey, funnels: object[], generatedAt }}
 */
export async function loadRepFunnels({ repIds = null, monthKey = null, now = new Date() } = {}) {
  const key = isMonthKey(monthKey) ? monthKey : monthKeyOf(now);
  const bounds = monthBounds(key);
  const reps = await db.salesRep.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      active: true,
      startedAt: true,
      acceptedAt: true,
      invitedAt: true,
      commissionPlan: { select: { retentionDays: true } },
    },
  });
  const ids = reps.map((r) => r.id);
  if (!ids.length) return { monthKey: key, funnels: [], generatedAt: now.toISOString() };

  const [attempts, linkSends, attributions] = await Promise.all([
    db.salesCallAttempt.findMany({
      where: { salesRepId: { in: ids }, direction: "out", dialledAt: { gte: bounds.start, lt: bounds.end } },
      select: { salesRepId: true, direction: true, dialledAt: true, disposition: true, leadId: true, prospectId: true, toE164: true },
    }),
    db.salesSmsMessage.findMany({
      where: {
        salesRepId: { in: ids },
        direction: "out",
        sentAt: { gte: bounds.start, lt: bounds.end },
        body: { contains: LINK_MARK },
      },
      select: { salesRepId: true, leadId: true, sentAt: true },
    }),
    db.salesAttribution.findMany({
      where: { salesRepId: { in: ids }, capturedAt: { gte: bounds.start, lt: bounds.end } },
      select: { salesRepId: true, companyId: true, capturedAt: true },
    }),
  ]);

  const companyIds = [...new Set(attributions.map((a) => a.companyId))];
  const [companies, subscriptions] = companyIds.length
    ? await Promise.all([
        db.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, stripeChargesEnabled: true, isDemo: true },
        }),
        db.subscription.findMany({
          where: { companyId: { in: companyIds } },
          select: {
            companyId: true,
            billingStartedAt: true,
            createdAt: true,
            status: true,
            canceledAt: true,
            refundedAt: true,
            refundedAmountCents: true,
            disputeStatus: true,
          },
        }),
      ])
    : [[], []];

  const subByCompany = new Map(subscriptions.map((s) => [s.companyId, s]));
  const byRep = (rows) => {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.salesRepId)) m.set(r.salesRepId, []);
      m.get(r.salesRepId).push(r);
    }
    return m;
  };
  const attemptsByRep = byRep(attempts);
  const sendsByRep = byRep(linkSends);
  const attributionsByRep = byRep(attributions);

  const counts = reps.map((rep) => {
    const mine = attributionsByRep.get(rep.id) || [];
    const retentionDays = rep.commissionPlan?.retentionDays ?? 60;
    const retainedCompanyIds = mine
      .map((a) => a.companyId)
      .filter((id) => {
        const s = subByCompany.get(id);
        if (!s) return false;
        return qualifiesForRetention({ subscriptionStartedAt: s.createdAt, subscription: s, retentionDays, now }).qualifies;
      });
    return stageCounts({
      attempts: attemptsByRep.get(rep.id) || [],
      linkSends: sendsByRep.get(rep.id) || [],
      attributions: mine,
      companies,
      subscriptions,
      retainedCompanyIds,
      monthKey: key,
    });
  });

  // FieldQuo's own figures are over EVERY rep's month, whichever reps were
  // asked for: a rep's card compares them to the floor, not to themselves.
  // That is why the rows above are read for every rep even when one was
  // asked for — FieldQuo's own volumes are small, and the alternative was a
  // second, narrower read whose reference silently differed from the
  // console's.
  const references = fieldquoReferences(counts);
  const wanted = Array.isArray(repIds) ? new Set(repIds) : null;

  const funnels = reps
    .map((rep, i) => (wanted && !wanted.has(rep.id) ? null : buildRepFunnel({ rep, counts: counts[i], monthKey: key, references })))
    .filter(Boolean);
  return { monthKey: key, funnels, generatedAt: now.toISOString() };
}
