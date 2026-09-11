// lib/platform/growthMeasured.js
//
// The forecast's rates, MEASURED from what the pipeline records — with the
// owner's assumptions handed in so each rate can fall back to one until its
// floor is met (lib/platform/growthModel.js explains the floors and why a
// missing rate is refused rather than guessed).
//
// Where each number comes from, because a forecast is only as honest as the
// rows behind it:
//
//   reach        SalesCallAttempt, direction "out", dispositioned. Reached is
//                whatever lib/sales/calls/dispositions.js marks `reached` —
//                derived, never a hardcoded list, so a new disposition cannot
//                silently fall on the wrong side.
//   signup       SalesAttribution rows (a company that signed up through a
//                rep's link) over reached conversations.
//   conversion   Subscriptions whose trial has ENDED: billingStartedAt set is
//                a conversion, the rest are not. "On trial" is
//                billingStartedAt == null, per the schema's own note — status
//                alone cannot tell a converted trial from a live one.
//   churn        Per full calendar month: paying at the month's start, and
//                how many of those cancelled inside it. Months with fewer
//                than FLOORS.churnBase paying do not count as observations.
//   referral     Per full month: companies that arrived with a referral code,
//                over paying at the month's start — the viral coefficient.
//   organic      Per full month: companies with no rep link and no referral
//                code. The mean over observed full months.
//
// Demo companies are excluded everywhere: they are seeded, and a seeded
// signup measuring the funnel would be the funnel measuring itself.
//
// Full calendar months only, UTC, and never the current one: a month that is
// six days old has a churn rate of nothing yet, and including it would drag
// every average toward zero for the first three weeks of every month.

import { db } from "@/lib/db";
import { DISPOSITIONS } from "@/lib/sales/calls/dispositions";
import { rate, monthsRate, monthlyCount, monthLabel, FLOORS } from "@/lib/platform/growthModel";

export const MONTHS_BACK = 6;

function monthStartUtc(now, offset = 0) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

/**
 * @param {object} p
 * @param {object} p.assumptions  the PlatformGrowthAssumptions row (or defaults)
 * @param {Date}   [p.now]
 */
export async function measureGrowth({ assumptions = {}, now = new Date() } = {}) {
  const reachedCodes = Object.entries(DISPOSITIONS)
    .filter(([, d]) => d && d.reached)
    .map(([code]) => code);

  const demo = await db.company.findMany({ where: { isDemo: true }, select: { id: true } });
  const demoIds = demo.map((c) => c.id);
  const notDemo = demoIds.length ? { companyId: { notIn: demoIds } } : {};
  const notDemoCompany = demoIds.length ? { id: { notIn: demoIds } } : {};

  // The last MONTHS_BACK FULL months, oldest first. Month -1 is last month.
  const months = [];
  for (let i = MONTHS_BACK; i >= 1; i -= 1) {
    months.push({ start: monthStartUtc(now, -i), end: monthStartUtc(now, -i + 1), label: monthLabel(now, -i) });
  }
  const sinceStart = months[0].start;
  // The running month, kept OUT of every rate (see the header) but shown:
  // the dialling started this month, and a table of finished months that
  // hides the only month with any dials in it reads as a table of nothing.
  const current = { start: monthStartUtc(now, 0), end: monthStartUtc(now, 1), label: monthLabel(now, 0) };
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [
    dispositioned,
    reached,
    attributions,
    trialsEnded,
    trialsConverted,
    payingNow,
    trialingNow,
    repsActive,
    prospects,
    dialsLast30,
    companiesSince,
    paidSubs,
    firstCompany,
    monthDials,
    monthReached,
    currentDials,
    currentReached,
  ] = await Promise.all([
    db.salesCallAttempt.count({ where: { direction: "out", disposition: { not: null } } }),
    db.salesCallAttempt.count({ where: { direction: "out", disposition: { in: reachedCodes } } }),
    db.salesAttribution.findMany({ where: notDemo, select: { companyId: true, capturedAt: true } }),
    db.subscription.count({ where: { ...notDemo, trialEndsAt: { lt: now } } }),
    db.subscription.count({ where: { ...notDemo, trialEndsAt: { lt: now }, billingStartedAt: { not: null } } }),
    db.subscription.count({ where: { ...notDemo, billingStartedAt: { not: null }, canceledAt: null, status: { in: ["active", "past_due"] } } }),
    db.subscription.count({ where: { ...notDemo, billingStartedAt: null, status: "trialing", OR: [{ trialEndsAt: null }, { trialEndsAt: { gte: now } }] } }),
    db.salesRep.count({ where: { active: true } }),
    db.prospect.count(),
    db.salesCallAttempt.count({ where: { direction: "out", dialledAt: { gte: thirtyDaysAgo } } }),
    db.company.findMany({
      where: { ...notDemoCompany, createdAt: { gte: sinceStart } },
      select: { id: true, createdAt: true, referredByCode: true },
    }),
    db.subscription.findMany({ where: { ...notDemo, billingStartedAt: { not: null } }, select: { billingStartedAt: true, canceledAt: true } }),
    db.company.findFirst({ where: notDemoCompany, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    Promise.all(months.map((m) => db.salesCallAttempt.count({ where: { direction: "out", dialledAt: { gte: m.start, lt: m.end } } }))),
    Promise.all(months.map((m) => db.salesCallAttempt.count({ where: { direction: "out", disposition: { in: reachedCodes }, dialledAt: { gte: m.start, lt: m.end } } }))),
    db.salesCallAttempt.count({ where: { direction: "out", dialledAt: { gte: current.start, lt: current.end } } }),
    db.salesCallAttempt.count({ where: { direction: "out", disposition: { in: reachedCodes }, dialledAt: { gte: current.start, lt: current.end } } }),
  ]);

  const viaRep = new Set(attributions.map((a) => a.companyId));

  // Per-month buckets, built once in JS from the rows above — the six months
  // of companies and the paid subscriptions are small tables at this stage,
  // and one pass is easier to hold to the rules than twelve more queries.
  const bucket = (m, dials, reachedCount) => {
    const created = companiesSince.filter((c) => c.createdAt >= m.start && c.createdAt < m.end);
    const referral = created.filter((c) => c.referredByCode).length;
    const rep = created.filter((c) => !c.referredByCode && viaRep.has(c.id)).length;
    const organic = created.length - referral - rep;
    const payingAtStart = paidSubs.filter(
      (s) => s.billingStartedAt < m.start && (!s.canceledAt || s.canceledAt >= m.start),
    ).length;
    const churned = paidSubs.filter((s) => s.canceledAt && s.canceledAt >= m.start && s.canceledAt < m.end).length;
    return { label: m.label, dials, reached: reachedCount, signups: { rep, referral, organic, total: created.length }, payingAtStart, churned };
  };
  const byMonth = months.map((m, i) => bucket(m, monthDials[i], monthReached[i]));
  // Not in `byMonth`, so nothing downstream can average it in by accident.
  const currentMonth = { ...bucket(current, currentDials, currentReached), partial: true, dayOfMonth: now.getUTCDate() };

  // Observed full months: since the first real company arrived, capped at the
  // window. Zero while the first month is still running.
  let observedMonths = 0;
  if (firstCompany) {
    const firstMonth = monthStartUtc(firstCompany.createdAt, 1); // first FULL month after arrival
    observedMonths = months.filter((m) => m.start >= firstMonth).length;
  }
  const observed = byMonth.slice(byMonth.length - observedMonths);

  const churnMonths = observed.filter((m) => m.payingAtStart >= FLOORS.churnBase);
  const referralMonths = observed.filter((m) => m.payingAtStart >= FLOORS.referralBase);
  const sum = (rows, f) => rows.reduce((a, r) => a + f(r), 0);

  const rates = {
    reach: rate({ hit: reached, of: dispositioned, floor: FLOORS.reach, assumed: assumptions.reach ?? null }),
    signup: rate({ hit: attributions.length, of: reached, floor: FLOORS.signup, assumed: assumptions.signup ?? null }),
    conversion: rate({ hit: trialsConverted, of: trialsEnded, floor: FLOORS.conversion, assumed: assumptions.conversion ?? null }),
    churn: monthsRate({
      hit: sum(churnMonths, (m) => m.churned),
      of: sum(churnMonths, (m) => m.payingAtStart),
      months: churnMonths.length,
      floorMonths: FLOORS.churnMonths,
      assumed: assumptions.churn ?? null,
    }),
    referral: monthsRate({
      hit: sum(referralMonths, (m) => m.signups.referral),
      of: sum(referralMonths, (m) => m.payingAtStart),
      months: referralMonths.length,
      floorMonths: FLOORS.referralMonths,
      assumed: assumptions.referral ?? null,
      max: 10,
    }),
  };
  const organic = monthlyCount({
    total: sum(observed, (m) => m.signups.organic),
    months: observedMonths,
    floorMonths: FLOORS.organicMonths,
    assumed: assumptions.organic ?? null,
  });

  return {
    rates,
    organic,
    starting: { paying: payingNow, trialing: trialingNow },
    repsActive,
    listSize: prospects > 0 ? prospects : null,
    actuals: {
      dialsLast30,
      dialsPerDayLast30: Math.round((dialsLast30 / 30) * 10) / 10,
      observedMonths,
      byMonth,
      // The first month that counts as an observation — the first FULL month
      // after the first real company arrived. Months before it are not zero
      // observations; they are before FieldQuo existed, and the table starts
      // here rather than printing them.
      firstObservedMonth: observedMonths > 0 ? observed[0].label : null,
      // The month the first real company arrived. Shown (its signups
      // happened) but not an observation: a month that began with no product
      // to churn from has no rate in it.
      launchMonth: firstCompany ? monthLabel(firstCompany.createdAt, 0) : null,
      currentMonth,
      reachedCodes,
    },
  };
}
