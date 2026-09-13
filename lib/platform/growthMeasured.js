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
//   signup       Reached conversations → businesses that AGREED on the call
//                (the `agreed_link_sent` outcome, or a signup-link text —
//                keyed per business the way lib/sales/funnelStages.js keys
//                them). Until 2026-09-13 this was SalesAttribution rows over
//                reached; the attribution-and-card step is now `completion`
//                below, so the two multiply to what one rate used to claim.
//   conversion   Subscriptions whose trial has ENDED: billingStartedAt set is
//                a conversion, the rest are not. "On trial" is
//                billingStartedAt == null, per the schema's own note — status
//                alone cannot tell a converted trial from a live one.
//   churn        Per full calendar month: paying at the month's start, and
//                how many of those cancelled inside it. Months with fewer
//                than FLOORS.churnBase paying do not count as observations.
//   referral     Per full month: companies that arrived with a referral code,
//                over paying at the month's start — the viral coefficient.
//   organic      Per full month: companies with no rep link, no referral
//                code and no campaign code. The mean over observed full months.
//   refill       Per full month: Prospect rows CREATED in the month — what
//                discovery, the licence registers and the campaign imports
//                added to the list. The month the FIRST prospect row was
//                created is the list being loaded, not a month's refill —
//                560,731 rows landed in one September and would otherwise
//                read as a 187,000-a-month rate for the next three months —
//                so refill is observed only in the full months AFTER that
//                load month. `listSize` counts every row; `refill` only the
//                months since the load.
//   redial       SalesCallAttempt again, but REPEAT attempts only — a
//                dispositioned outbound dial on a prospect that already had
//                one — over how many of those were followed by that
//                prospect's lead converting (SalesLead.convertedCompanyId,
//                convertedAt after the repeat dial). The yield of ringing a
//                business a second time, in signups per dial. Attempt order
//                is by dialledAt per prospect, in SQL, because the question
//                is positional and 900,000 prospects' attempts are not a
//                thing to sort in JavaScript.
//   marketing    Per full month: companies that redeemed a PlatformPromoCode
//                of kind "influencer" — the one campaign attribution the
//                signup path records today. "tester" codes are not marketing.
//   ads          Per full month: companies whose SignupOrigin carries a PAID
//                utm tag — a paid medium (cpc, paid_social, …) or an ad
//                platform as source (lib/platform/signupFlags.js
//                isPaidAdSignup). Counted before marketing and organic, so an
//                ad signup is never also organic. Signups from before the
//                utm columns existed carry no tag and stay wherever they
//                were: an untagged link is unknown, not organic.
//   attempts     Dispositioned outbound dials with a prospect ÷ distinct
//                prospects among them — how many times a business is rung,
//                on average, over the pipeline's whole history. The floor is
//                in prospects.
//   completion   Businesses that agreed on the call (the `agreed_link_sent`
//                outcome, or a signup-link text — lib/sales/funnelStages.js
//                stageCounts, the SAME arithmetic the funnel page uses) →
//                attributed companies holding a Subscription row (the card
//                was entered). Whole history, floor in agreed businesses.
//
// Demo companies are excluded everywhere: they are seeded, and a seeded
// signup measuring the funnel would be the funnel measuring itself.
//
// Full calendar months only, UTC, and never the current one: a month that is
// six days old has a churn rate of nothing yet, and including it would drag
// every average toward zero for the first three weeks of every month.

import { db } from "@/lib/db";
import { DISPOSITIONS } from "@/lib/sales/calls/dispositions";
import { rate, monthsRate, monthlyCount, monthLabel, marketingAssumption, adsAssumption, FLOORS, DEFAULT_ATTEMPTS_PER_PROSPECT } from "@/lib/platform/growthModel";
import { isPaidAdSignup } from "@/lib/platform/signupFlags";
import { AGREED_CODE } from "@/lib/sales/funnelStages";

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
    prospectsByMonth,
    redialRows,
    firstProspect,
    attemptRows,
    agreedAttempts,
    linkSends,
    attributedWithCard,
    origins,
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
    // Prospects created per UTC calendar month since the window opened — one
    // pass over the table rather than a count per month. The month key is
    // built in SQL so it matches monthLabel() exactly ("YYYY-MM", UTC).
    db.$queryRaw`
      SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, count(*)::int AS added
      FROM "Prospect"
      WHERE "createdAt" >= ${sinceStart}
      GROUP BY 1
    `,
    // Repeat attempts and their later signups. `n` is the attempt's position
    // among the prospect's dispositioned outbound dials; n > 1 is a repeat.
    // A prospect converts once, so the numerator is distinct prospects — two
    // repeat dials before one signup are one signup, not two.
    db.$queryRaw`
      WITH d AS (
        SELECT "prospectId", "dialledAt",
               row_number() OVER (PARTITION BY "prospectId" ORDER BY "dialledAt", id) AS n
        FROM "SalesCallAttempt"
        WHERE direction = 'out' AND disposition IS NOT NULL AND "prospectId" IS NOT NULL
      )
      SELECT count(*)::int AS repeat_dials,
             count(DISTINCT d."prospectId") FILTER (WHERE EXISTS (
               SELECT 1 FROM "SalesLead" l
               JOIN "Company" c ON c.id = l."convertedCompanyId"
               WHERE l."prospectId" = d."prospectId" AND l."convertedAt" >= d."dialledAt" AND c."isDemo" = false
             ))::int AS repeat_signups
      FROM d
      WHERE n > 1
    `,
    db.prospect.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    // Attempts per prospect: dispositioned outbound dials with a prospect,
    // and how many distinct prospects they fall on.
    db.$queryRaw`
      SELECT count(*)::int AS dials, count(DISTINCT "prospectId")::int AS prospects
      FROM "SalesCallAttempt"
      WHERE direction = 'out' AND disposition IS NOT NULL AND "prospectId" IS NOT NULL
    `,
    // Businesses that agreed on the call, by outcome …
    db.salesCallAttempt.findMany({
      where: { direction: "out", disposition: AGREED_CODE },
      select: { leadId: true, prospectId: true, toE164: true },
    }),
    // … or by a signup-link text (the same LINK_MARK lib/sales/funnelData.js keys on).
    db.salesSmsMessage.findMany({ where: { direction: "out", body: { contains: "/signup?sales=" }, leadId: { not: null } }, select: { leadId: true } }),
    // Attributed companies that finished the card step. The Subscription
    // row is the one true "the card was entered" (lib/signup/abandoned.js).
    db.subscription.count({ where: { ...notDemo, company: { salesAttribution: { isNot: null } } } }),
    // Which signups in the window carried a paid utm tag.
    db.signupOrigin.findMany({
      where: { createdAt: { gte: sinceStart } },
      select: { companyId: true, utmSource: true, utmMedium: true },
    }),
  ]);
  // Companies that redeemed a campaign (influencer) code — the marketing
  // attribution. Looked up after the company rows so the IN list is the six
  // months' companies, not the whole table.
  const campaignRedemptions = companiesSince.length
    ? await db.platformPromoRedemption.findMany({
        where: { companyId: { in: companiesSince.map((c) => c.id) }, promoCode: { kind: "influencer" } },
        select: { companyId: true },
      })
    : [];
  const viaCampaign = new Set(campaignRedemptions.map((r) => r.companyId));
  const viaAds = new Set((origins || []).filter((o) => isPaidAdSignup(o)).map((o) => o.companyId));
  // Agreed businesses, one key per business — the funnel's own keying.
  const agreedKeys = new Set();
  for (const a of agreedAttempts || []) {
    const k = a.leadId ? `lead:${a.leadId}` : a.prospectId ? `prospect:${a.prospectId}` : a.toE164 ? `phone:${a.toE164}` : null;
    if (k) agreedKeys.add(k);
  }
  for (const m of linkSends || []) if (m.leadId) agreedKeys.add(`lead:${m.leadId}`);
  const agreedCount = agreedKeys.size;
  const attemptDials = Number(attemptRows?.[0]?.dials) || 0;
  const attemptProspects = Number(attemptRows?.[0]?.prospects) || 0;
  const addedByMonth = Object.fromEntries((prospectsByMonth || []).map((r) => [r.month, Number(r.added) || 0]));
  const repeatDials = Number(redialRows?.[0]?.repeat_dials) || 0;
  const repeatSignups = Number(redialRows?.[0]?.repeat_signups) || 0;

  const viaRep = new Set(attributions.map((a) => a.companyId));

  // Per-month buckets, built once in JS from the rows above — the six months
  // of companies and the paid subscriptions are small tables at this stage,
  // and one pass is easier to hold to the rules than twelve more queries.
  const bucket = (m, dials, reachedCount) => {
    const created = companiesSince.filter((c) => c.createdAt >= m.start && c.createdAt < m.end);
    // One door per company, in this order: a referral code says who sent
    // them; a rep link says who rang them; a campaign code says which advert
    // they saw; nothing at all is organic. Each company is counted once.
    const referral = created.filter((c) => c.referredByCode).length;
    const rep = created.filter((c) => !c.referredByCode && viaRep.has(c.id)).length;
    // A paid utm tag names the advert; it outranks an influencer code on the
    // same company because the tag is on the link that was clicked.
    const ads = created.filter((c) => !c.referredByCode && !viaRep.has(c.id) && viaAds.has(c.id)).length;
    const marketing = created.filter((c) => !c.referredByCode && !viaRep.has(c.id) && !viaAds.has(c.id) && viaCampaign.has(c.id)).length;
    const organic = created.length - referral - rep - ads - marketing;
    const payingAtStart = paidSubs.filter(
      (s) => s.billingStartedAt < m.start && (!s.canceledAt || s.canceledAt >= m.start),
    ).length;
    const churned = paidSubs.filter((s) => s.canceledAt && s.canceledAt >= m.start && s.canceledAt < m.end).length;
    return {
      label: m.label,
      dials,
      reached: reachedCount,
      signups: { rep, referral, ads, marketing, organic, total: created.length },
      prospectsAdded: addedByMonth[m.label] || 0,
      payingAtStart,
      churned,
    };
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
    signup: rate({ hit: agreedCount, of: reached, floor: FLOORS.signup, assumed: assumptions.signup ?? null }),
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
    redial: rate({ hit: repeatSignups, of: repeatDials, floor: FLOORS.redial, assumed: assumptions.redial ?? null }),
    // The plan's attempts per prospect: typed, else the model's default of
    // 3 (said as "assumed" — the route's DEFAULTS note covers it), blended
    // with the measured average once there are prospects to average.
    attempts: rate({ hit: attemptDials, of: attemptProspects, floor: FLOORS.attempts, assumed: assumptions.attemptsPerProspect ?? DEFAULT_ATTEMPTS_PER_PROSPECT, max: 20 }),
    completion: rate({ hit: attributedWithCard, of: agreedCount, floor: FLOORS.completion, assumed: assumptions.completion ?? null }),
  };
  const organic = monthlyCount({
    total: sum(observed, (m) => m.signups.organic),
    months: observedMonths,
    floorMonths: FLOORS.organicMonths,
    assumed: assumptions.organic ?? null,
  });
  // Refill is observed in the full months after the list was loaded (see
  // the header): the load month itself is the list.
  const listLoadMonth = firstProspect ? monthLabel(firstProspect.createdAt, 0) : null;
  const refillMonths = listLoadMonth ? observed.filter((m) => m.label > listLoadMonth) : [];
  const refill = monthlyCount({
    total: sum(refillMonths, (m) => m.prospectsAdded),
    months: refillMonths.length,
    floorMonths: FLOORS.refillMonths,
    assumed: assumptions.refill ?? null,
  });
  const marketing = monthlyCount({
    total: sum(observed, (m) => m.signups.marketing),
    months: observedMonths,
    floorMonths: FLOORS.marketingMonths,
    assumed: marketingAssumption(assumptions),
  });
  const ads = monthlyCount({
    total: sum(observed, (m) => m.signups.ads),
    months: observedMonths,
    floorMonths: FLOORS.adsMonths,
    assumed: adsAssumption(assumptions),
  });
  // What the typed spend implies per MEASURED trial — printed beside the
  // typed cost so the owner can see the two disagree. Null without both.
  const adsMeasuredPerMonth = observedMonths > 0 ? sum(observed, (m) => m.signups.ads) / observedMonths : null;
  const adsImpliedCostPerTrial =
    typeof assumptions.adSpend === "number" && assumptions.adSpend > 0 && adsMeasuredPerMonth ? assumptions.adSpend / adsMeasuredPerMonth : null;

  return {
    rates,
    organic,
    refill,
    marketing,
    ads,
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
      // The re-dial sample, so the page can say "3 of 1,240 repeat dials".
      repeatDials,
      repeatSignups,
      // The attempts and completion samples, in the same spirit.
      attemptDials,
      attemptProspects,
      agreedCount,
      attributedWithCard,
      adsImpliedCostPerTrial,
      // The month the list was loaded — its prospect count is the list, not
      // a refill, and the actuals table says so on that row.
      listLoadMonth,
    },
  };
}
