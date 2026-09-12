// lib/platform/growthModel.js
//
// FieldQuo's own subscriber forecast — a CAPACITY model, not a trend line.
//
// ══ Why not a regression ═══════════════════════════════════════════════════
//
// The company launches with zero subscribers and a plan: twenty closers, each
// dialling 100–200 numbers a day. A curve fitted to history needs history; at
// zero it would draw a confident line through nothing, and at fifty it would
// draw one through noise. The owner's own targets — 100, 1,000, 10,000,
// 100,000, 1,000,000 — are questions about CAPACITY: how many dials, how many
// of those answer, how many of those sign up, how many of those pay, how many
// of those leave, and how many more arrive on their own or bring a friend.
// That is arithmetic on a handful of rates, and every one of them is a thing
// the pipeline records: dials and dispositions (SalesCallAttempt), signups by
// rep link (SalesAttribution), signups by referral code (Company.referredByCode),
// signups by neither (organic), trials ending and subscriptions cancelling.
//
// So this file does three honest things and refuses a fourth:
//
//   1. Every rate carries its BASIS. `measured` once the pipeline has enough
//      of the right rows to make a percentage mean something (the floors
//      below); `assumed` — typed by the owner, shown as such — until then.
//      The page says which is which beside every figure. Measured replaces
//      assumed on its own, the week the floor is crossed; nobody flips a
//      switch, and nobody can leave an assumption standing over real data.
//   2. Three SOURCES of signups, kept apart: the dialler (reps × dials ×
//      rates), organic (a monthly count that owes nothing to either), and
//      referral (a coefficient per paying subscriber per month — each paying
//      company brings k more, which is how a referral programme compounds).
//      Folding them into one "signups" figure would hide which one the
//      business is actually running on.
//   3. Churn puts a CEILING on the business. With A paying adds a month from
//      dialling and organic, churn c, referral k and conversion v, the paying
//      stock converges on A / (c − k·v) and never passes it. When k·v ≥ c —
//      referrals outrun churn — there is no ceiling, and the page says
//      "viral" in those words rather than drawing a line that goes up
//      forever without saying why. A straight line reaches every milestone
//      eventually; this model says which milestones the current numbers can
//      reach at all, which is the one thing the owner needs a forecast for.
//   4. It refuses to run with a rate it does not have. A rate with no
//      measurement and no assumption is `none`, and project() throws naming
//      it rather than picking 0 or 0.5. The route turns that into "type these
//      numbers", which is the honest state of a forecast on launch day.
//
// ══ What the first version left out, and why it read as vague ═════════════
//
// The owner: "it says 9,764 signups by 2031-09 but only 361 paying … I think
// this fails to account for more marketing campaigns and going over older
// leads — how can Jobber have 100,000 contractors". He was right about the
// arithmetic: ONE prospect list, dialled once, and when it ran out in month
// ~15 the signups stopped and churn compounded the paying base down toward
// nothing. That is what a fixed list does; it is not a forecast of a business
// that keeps finding contractors to ring. Four things the business does that
// the model did not, each now a rate with the same basis machinery as the
// rest — measured when the pipeline has the rows, typed until then, and an
// honest 0 when neither (they are all ADDITIVE, like referral and organic;
// none of them can stop the forecast):
//
//   refill      prospects ADDED a month — discovery crawls, licence registers,
//               campaigns (lib/sales/discovery/*). The dial engine draws on
//               list + refill × months and never runs dry while refill > 0.
//   redial      the RE-DIAL POOL. A prospect dialled without a signup is not
//               gone: lib/sales/retryRules.js exhausts a row after its rule's
//               attempts (4 no-answers, 3 voicemails, 6 busy — the last
//               outcome's ceiling) and a superadmin's recycle puts it back in
//               the pool with the count at zero. The model assumes that
//               recycle every RETRY_RETURN_MONTHS and works the returned rows
//               with whatever dial capacity the fresh list did not use, at
//               the REPEAT yield: `redial` is signups per dispositioned
//               repeat dial, measured on the pipeline's own repeat attempts,
//               and is expected to sit well under a first dial's
//               reach × signup. The same list is worked more than once; each
//               pass yields less; nothing is invented.
//   marketing   signups a month from paid campaigns. A count, like organic,
//               with a second way to type it — spend a month ÷ cost per
//               signup — for an owner who knows the budget and the CPA but
//               not the count. Whichever is filled is used; the count wins
//               when both are.
//   referral, organic   unchanged (an honest 0 until measured or typed); the
//               form now shows the typical range in the hint and saves
//               nothing the owner did not type.
//
// The ceiling gains an explanation: WHICH rate limits it. Churn against the
// adds a month while the dialling continues at capacity; the LIST when the
// fresh list runs out and refill and re-dial cannot replace it, so the curve
// peaks and decays below the churn ceiling; referral when it outruns churn.
// The old fixed-list result is reproduced exactly when all four are 0 —
// scripts/check-growth-model.mjs asserts it.
//
// Pure. No database, no clock unless `now` is handed in. The one import is
// the retry rules' attempt ceiling, quoted in words on the page, so the
// re-dial explanation cannot drift from the pool that actually runs.
// scripts/check-growth-model.mjs executes it against hostile input.

import { RETRY_MAX_ATTEMPTS } from "@/lib/sales/retryRules";

export const MILESTONES = Object.freeze([100, 1_000, 10_000, 100_000, 1_000_000]);
export const HORIZON_MONTHS = 60;
/** Quoted on the page beside the re-dial rate: the most attempts any retry rule allows before a row leaves the pool. */
export { RETRY_MAX_ATTEMPTS };

/**
 * Sample floors. Below these a percentage is a coin toss dressed as a metric,
 * and the model keeps using the owner's assumption instead. Same order of
 * magnitude as the tenant KPI dashboard's own win-rate floor
 * (lib/analytics/kpis.js), for the same reason.
 *
 *   reach        dispositioned dials → someone answered         (200 dials)
 *   signup       reached conversations → a company signed up    (50 reached)
 *   conversion   trials that have ENDED → paying                (20 ended trials)
 *   churn        paying at a month's start → cancelled in it    (3 months with ≥20 paying)
 *   referral     paying at a month's start → referred signups   (3 months with ≥20 paying)
 *   organic      signups with no rep link and no referral code  (3 observed months)
 *   refill       prospects added, per observed month            (3 observed months)
 *   redial       dispositioned REPEAT dials → a later signup     (1,000 repeat dials)
 *   marketing    signups a month attributed to a campaign       (3 observed months)
 *
 * The re-dial floor is in dials, not conversations, because the rate is a
 * yield per dial (reach and signup folded together — a repeat attempt that
 * is not answered is the commonest outcome and belongs in the denominator).
 * At a fresh yield near 0.75% (15% reach × 5% signup), 200 dials would hold
 * one or two signups; 1,000 is the fewest at which the figure is a rate.
 */
export const FLOORS = Object.freeze({
  reach: 200,
  signup: 50,
  conversion: 20,
  churnMonths: 3,
  churnBase: 20,
  referralMonths: 3,
  referralBase: 20,
  organicMonths: 3,
  refillMonths: 3,
  redial: 1000,
  marketingMonths: 3,
});

/**
 * How long a prospect dialled without a signup stays OUT of the pool before
 * the model dials it again.
 *
 * lib/sales/retryRules.js sets the exhaustion — a row leaves the pool once
 * its last outcome's rule has spent its attempts (RETRY_MAX_ATTEMPTS is the
 * highest of them) — and recycleData() is how it comes back: a superadmin's
 * decision on /platform/sales/retry-pool, with no clock of its own. The
 * model needs a clock, so it assumes a QUARTERLY recycle: three months is
 * long enough that a business that did not answer in four parts of the day
 * has changed something (a season, a hire, a phone), and short enough that
 * a 900,000-row list is worked again inside the horizon. The page says this
 * is assumed. A recycle that actually happens on a different cadence does
 * not change the measured `redial` yield, only when it lands.
 */
export const RETRY_RETURN_MONTHS = 3;

export const RATE_KEYS = Object.freeze(["reach", "signup", "conversion", "churn", "referral", "redial"]);
/** The rates without which nothing can be drawn — see project() for why referral and redial are not among them. */
export const FUNNEL_RATE_KEYS = Object.freeze(["reach", "signup", "conversion", "churn"]);
/** The monthly counts (monthlyCount() results), each an additive signup or prospect source. */
export const COUNT_KEYS = Object.freeze(["organic", "refill", "marketing"]);

function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function within(v, max) {
  return finite(v) && v >= 0 && v <= max ? v : null;
}

/**
 * The blend: how much of the answer is the measurement.
 *
 * ══ Why a blend and not a switch ══════════════════════════════════════════
 *
 * This used to be a cliff: the owner's assumption up to the floor, then the
 * measurement, whole, the moment the floor was met. At 199 dispositioned
 * dials the reach rate was 15% because that is what was typed; at 200 it was
 * whatever those 200 happened to say, noise included, and the forecast jumped
 * with it. The owner asked for the obvious alternative — combine the real data
 * with the estimate until there is enough real data to stand alone.
 *
 * The floor is now the WEIGHT of the assumption, in observations: the
 * assumption counts as `floor` rows that came out at the assumed rate, and
 * the measurement counts as the rows it actually has. So
 *
 *     value = (floor × assumed + n × measured) / (floor + n)
 *
 * At n = 0 that is the assumption. At n = floor it is half and half. At
 * n = 9 × floor the assumption is a tenth of the answer, which is where the
 * basis is called "measured". It never jumps, and every extra row moves it
 * toward what is happening. (A statistician would call the assumption a prior
 * worth `floor` observations; the owner calls it "closer to the actual
 * numbers", which is the same thing.)
 *
 * No assumption and fewer than `floor` rows is still NONE: there is nothing to
 * blend with, and a dozen rows on their own are not a rate. No assumption at
 * or past the floor is the measurement alone, as before.
 */
export const MEASURED_WEIGHT = 0.9;

function withBasis({ measured, n, floor, assumed, remaining }) {
  if (measured === null || n <= 0) {
    if (assumed !== null) {
      return { value: assumed, basis: "assumed", sampleSize: n, floor, remaining, measured, assumed, measuredWeight: 0 };
    }
    return { value: null, basis: "none", sampleSize: n, floor, remaining, measured, assumed: null, measuredWeight: 0 };
  }
  if (assumed === null) {
    if (n >= floor) {
      return { value: measured, basis: "measured", sampleSize: n, floor, remaining: 0, measured, assumed: null, measuredWeight: 1 };
    }
    return { value: null, basis: "none", sampleSize: n, floor, remaining, measured, assumed: null, measuredWeight: 0 };
  }
  const measuredWeight = n / (floor + n);
  const value = (floor * assumed + n * measured) / (floor + n);
  return {
    value,
    basis: measuredWeight >= MEASURED_WEIGHT ? "measured" : "blended",
    sampleSize: n,
    floor,
    remaining,
    measured,
    assumed,
    measuredWeight,
  };
}

/**
 * One rate with its basis.
 *
 * @param hit      numerator observed
 * @param of       denominator observed
 * @param floor    the weight of the assumption, in rows — see withBasis()
 * @param assumed  the owner's number, 0..max, or null
 * @param max      1 for a probability; the referral coefficient may exceed 1
 *                 (each paying company bringing more than one), so it passes
 *                 a larger bound rather than being clamped into a lie
 * @returns {{ value, basis: "measured"|"blended"|"assumed"|"none", sampleSize,
 *             floor, remaining, measured, assumed, measuredWeight }}
 *
 * `measured` is returned whatever the basis, so the page can show "so far 3
 * of 12" beside the blend — the owner should see the number forming.
 * `remaining` is the rows until the measurement outweighs the assumption.
 */
export function rate({ hit = 0, of = 0, floor, assumed = null, max = 1 } = {}) {
  const h = finite(hit) && hit >= 0 ? hit : 0;
  const o = finite(of) && of >= 0 ? of : 0;
  const f = finite(floor) && floor > 0 ? floor : 1;
  const cap = finite(max) && max > 0 ? max : 1;
  const a = within(assumed, cap);
  const measured = o > 0 ? Math.min(cap, h / o) : null;
  return withBasis({ measured, n: o, floor: f, assumed: a, remaining: Math.max(0, f - o) });
}

/**
 * A rate whose SAMPLE is months, not rows — churn and referral. Each month
 * contributes its numerator and denominator (cancelled / paying at start;
 * referred signups / paying at start), but the weight is in months, because
 * three cancellations in one month with 21 subscribers is one observation,
 * not twenty-one.
 */
export function monthsRate({ hit = 0, of = 0, months = 0, floorMonths, assumed = null, max = 1 } = {}) {
  const h = finite(hit) && hit >= 0 ? hit : 0;
  const o = finite(of) && of >= 0 ? of : 0;
  const m = finite(months) && months >= 0 ? months : 0;
  const f = finite(floorMonths) && floorMonths > 0 ? floorMonths : 1;
  const cap = finite(max) && max > 0 ? max : 1;
  const a = within(assumed, cap);
  const measured = o > 0 ? Math.min(cap, h / o) : null;
  return withBasis({ measured, n: m, floor: f, assumed: a, remaining: Math.max(0, f - m) });
}

/**
 * A monthly COUNT with its basis — organic signups. The mean over the
 * observed months, blended with the owner's number by the same rule.
 * Shaped like rate() so the page treats both alike.
 */
export function monthlyCount({ total = 0, months = 0, floorMonths, assumed = null } = {}) {
  const t = finite(total) && total >= 0 ? total : 0;
  const m = finite(months) && months >= 0 ? months : 0;
  const f = finite(floorMonths) && floorMonths > 0 ? floorMonths : 1;
  const a = finite(assumed) && assumed >= 0 ? assumed : null;
  const measured = m > 0 ? t / m : null;
  return withBasis({ measured, n: m, floor: f, assumed: a, remaining: Math.max(0, f - m) });
}

/**
 * The month `index` months after `now`, as "YYYY-MM" in UTC. Month 0 is the
 * current month. Calendar months, not 30-day blocks — a forecast that said
 * "month 12" and meant 360 days would drift a week a year against the
 * calendar the owner reads it on.
 */
export function monthLabel(now, index) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + index, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * The projection.
 *
 * @param {object} p
 * @param {number} p.reps                closers dialling
 * @param {number} p.dialsPerRepPerDay
 * @param {number} p.workingDaysPerMonth
 * @param {object} p.rates               { reach, signup, conversion, churn, referral, redial } — rate() results
 * @param {object} [p.organic]           monthlyCount() result; omitted = zero organic
 * @param {object} [p.refill]            monthlyCount() result — prospects added a month; omitted = the list is all there is
 * @param {object} [p.marketing]         monthlyCount() result — campaign signups a month; omitted = zero
 * @param {number} [p.trialMonths=1]     signups pay only after the trial ends
 * @param {number} [p.startingPaying=0]
 * @param {number} [p.startingTrialing=0] signups already inside a trial today
 * @param {number} [p.listSize]          prospects loaded; null when unknown
 * @param {number} [p.horizonMonths]
 * @param {Date}   [p.now]
 *
 * Throws a TypeError (with `.missing`) naming every FUNNEL rate whose basis
 * is `none` — see the header for why it does not guess, and why the additive
 * sources (referral, redial, organic, refill, marketing) count as 0 instead.
 */
export function project({
  reps,
  dialsPerRepPerDay,
  workingDaysPerMonth,
  rates,
  organic = null,
  refill = null,
  marketing = null,
  trialMonths = 1,
  startingPaying = 0,
  startingTrialing = 0,
  listSize = null,
  horizonMonths = HORIZON_MONTHS,
  now = new Date(),
} = {}) {
  for (const [name, v] of Object.entries({ reps, dialsPerRepPerDay, workingDaysPerMonth })) {
    if (!finite(v) || v < 0) throw new TypeError(`growthModel: ${name} must be a number ≥ 0, got ${JSON.stringify(v)}`);
  }
  if (!rates || typeof rates !== "object") throw new TypeError("growthModel: rates are required");
  // Only the FUNNEL rates can stop the forecast. Referral and organic are
  // additive sources on top of the dialling: before launch there is no
  // paying subscriber to refer anyone and no month to count organic signups
  // in, and refusing to draw the whole plan because those two are unmeasured
  // withheld the forecast for a week while the closers were dialling. An
  // unmeasured, untyped referral or organic is the one number that is
  // honestly known today — zero — and is drawn as such, labelled "not yet",
  // so the chart shows the dialling plan and grows the day the first
  // referral or organic signup is counted. A funnel rate has no such honest
  // zero (0% reach would mean "nobody ever answers"), so those still refuse.
  // Refill, re-dial and marketing are additive in the same way and take the
  // same 0.
  const missing = FUNNEL_RATE_KEYS.filter((k) => !rates[k] || rates[k].basis === "none" || !finite(rates[k].value) || rates[k].value < 0);
  if (missing.length) {
    const err = new TypeError(`growthModel: no measurement and no assumption for ${missing.join(", ")}`);
    err.missing = missing;
    throw err;
  }
  const tm = finite(trialMonths) && trialMonths >= 0 ? Math.floor(trialMonths) : 1;
  const horizon = finite(horizonMonths) && horizonMonths > 0 ? Math.min(240, Math.floor(horizonMonths)) : HORIZON_MONTHS;
  const p0 = finite(startingPaying) && startingPaying >= 0 ? startingPaying : 0;
  const t0 = finite(startingTrialing) && startingTrialing >= 0 ? startingTrialing : 0;
  const list = finite(listSize) && listSize > 0 ? listSize : null;
  const at = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();

  const additive = (r) => (finite(r?.value) && r.value >= 0 ? r.value : 0);
  const reach = rates.reach.value;
  const signup = rates.signup.value;
  const conversion = rates.conversion.value;
  const churn = Math.min(1, rates.churn.value);
  const referral = additive(rates.referral);
  const redial = Math.min(1, additive(rates.redial));
  const organicPerMonth = additive(organic);
  const refillPerMonth = additive(refill);
  const marketingPerMonth = additive(marketing);

  const dials = reps * dialsPerRepPerDay * workingDaysPerMonth;
  const reached = dials * reach;
  const freshYield = reach * signup;
  const dialSignups = dials * freshYield;
  const baseSignups = dialSignups + organicPerMonth + marketingPerMonth;
  const baseAdds = baseSignups * conversion;

  // Steady state. Paying stock P: P' = P(1 − c) + (base + k·P)·v, which
  // converges on base·v / (c − k·v) when c > k·v. Otherwise referrals alone
  // outrun churn and there is no ceiling — "viral", said as such.
  const drain = churn - referral * conversion;
  const viral = drain <= 0 && (referral > 0 || churn === 0);
  const ceiling = drain > 0 ? baseAdds / drain : null;

  const series = [];
  // Signups in flight, one slot per month of trial remaining; shift() is the
  // cohort finishing this month. Those already trialing today are spread
  // evenly across the trial length.
  const pipeline = new Array(Math.max(tm, 0)).fill(tm > 0 ? t0 / tm : 0);
  // The re-dial pool, one slot per month of the return interval: prospects
  // dialled without a signup this month are dialable again in
  // RETRY_RETURN_MONTHS. shift() is the cohort coming back; `poolReady` is
  // what has come back and not yet been re-dialled. Only kept when the
  // repeat yield is above 0 — at 0 a repeat dial signs nobody up and the
  // closers would not be pointed at it, so the fixed-list arithmetic is
  // reproduced exactly rather than spending capacity on nothing.
  const returning = new Array(RETRY_RETURN_MONTHS).fill(0);
  let poolReady = 0;
  let paying = p0;
  let cum = { signups: 0, dial: 0, redial: 0, organic: 0, marketing: 0, referral: 0, dials: 0, freshDials: 0 };
  let listExhaustedAt = null;

  for (let m = 0; m <= horizon; m += 1) {
    let thisMonth = { dial: 0, redial: 0, organic: 0, marketing: 0, referral: 0, total: 0, freshDials: 0, redialDials: 0 };
    if (m > 0) {
      // The fresh list: what was loaded plus what discovery adds each month,
      // less what has been dialled. Refill lands at the start of the month
      // it is counted in, so month 1 draws on list + refill.
      const available = list === null ? Infinity : Math.max(0, list + refillPerMonth * m - cum.freshDials);
      const freshDials = Math.min(dials, available);
      if (list !== null && listExhaustedAt === null && freshDials < dials) listExhaustedAt = m;
      // Whatever capacity the fresh list left over goes to the returned rows.
      let redialDials = 0;
      if (redial > 0) {
        poolReady += returning.shift();
        redialDials = Math.min(dials - freshDials, poolReady);
        poolReady -= redialDials;
      }
      const fromDial = freshDials * freshYield;
      const fromRedial = redialDials * redial;
      const fromReferral = paying * referral;
      const fromOrganic = organicPerMonth;
      const fromMarketing = marketingPerMonth;
      const signupsThisMonth = fromDial + fromRedial + fromOrganic + fromMarketing + fromReferral;
      if (redial > 0) {
        // Everyone dialled this month who did not sign up — fresh or repeat —
        // comes back after the return interval. A repeat pass yields the
        // repeat rate again: the list is worked as many times as the horizon
        // allows, each pass at the measured repeat yield, never at the fresh
        // one.
        returning.push(freshDials - fromDial + (redialDials - fromRedial));
      }
      cum = {
        signups: cum.signups + signupsThisMonth,
        dial: cum.dial + fromDial,
        redial: cum.redial + fromRedial,
        organic: cum.organic + fromOrganic,
        marketing: cum.marketing + fromMarketing,
        referral: cum.referral + fromReferral,
        dials: cum.dials + freshDials + redialDials,
        freshDials: cum.freshDials + freshDials,
      };
      thisMonth = {
        dial: r1(fromDial),
        redial: r1(fromRedial),
        organic: r1(fromOrganic),
        marketing: r1(fromMarketing),
        referral: r1(fromReferral),
        total: r1(signupsThisMonth),
        freshDials: Math.round(freshDials),
        redialDials: Math.round(redialDials),
      };
      let finishing;
      if (tm === 0) finishing = signupsThisMonth;
      else {
        finishing = pipeline.shift();
        pipeline.push(signupsThisMonth);
      }
      paying = paying * (1 - churn) + finishing * conversion;
    }
    const trialing = pipeline.reduce((a, b) => a + b, 0);
    series.push({
      month: m,
      label: monthLabel(at, m),
      paying: Math.round(paying),
      trialing: Math.round(trialing),
      cumulativeSignups: Math.round(cum.signups),
      signupsBySource: {
        dial: Math.round(cum.dial),
        redial: Math.round(cum.redial),
        organic: Math.round(cum.organic),
        marketing: Math.round(cum.marketing),
        referral: Math.round(cum.referral),
      },
      // This month alone, by source — the projection card reads these.
      signups: thisMonth,
      cumulativeDials: Math.round(cum.dials),
      cumulativeFreshDials: Math.round(cum.freshDials),
    });
  }

  // ── The long run, and which rate is the limit ──────────────────────────
  //
  // `ceiling` is the churn ceiling AT THESE RATES with the dialling running
  // at capacity — the number the milestones are judged against, kept as it
  // was. But a finite list does not run at capacity forever: once it is
  // exhausted the fresh dials fall to the refill rate and the re-dial pool
  // fills what it can, so the paying stock settles LOWER than the churn
  // ceiling (at 0 refill and 0 re-dial, toward nothing). That lower number is
  // the long run, and when it sits under the churn ceiling the limit on the
  // business is the list, not churn — which is the sentence the owner was
  // missing when the chart went down and the page still said "ceiling
  // 3,780". The pool's throughput in the long run is the whole list coming
  // round once per return interval, capped by the capacity the fresh list
  // does not use.
  const longRunFresh = list === null ? dials : Math.min(dials, refillPerMonth);
  const longRunPool = redial > 0 && list !== null ? Math.min(dials - longRunFresh, (list + refillPerMonth * horizon) / RETRY_RETURN_MONTHS) : 0;
  const longRunSignups = longRunFresh * freshYield + longRunPool * redial + organicPerMonth + marketingPerMonth;
  const longRunAdds = longRunSignups * conversion;
  const longRunPaying = drain > 0 ? longRunAdds / drain : null;
  const peak = series.reduce((best, s) => (s.paying > best.paying ? s : best), series[0]);
  const limitedBy = viral
    ? "referral"
    : ceiling !== null && longRunPaying !== null && longRunPaying < ceiling * 0.98
      ? "list"
      : "churn";
  const zeroSources = [
    ["refill", refillPerMonth === 0 && list !== null],
    ["redial", redial === 0],
    ["marketing", marketingPerMonth === 0],
    ["referral", referral === 0],
    ["organic", organicPerMonth === 0],
  ].filter(([, z]) => z).map(([k]) => k);

  const milestones = MILESTONES.map((target) => {
    const hit = series.find((s) => s.paying >= target) || null;
    // Reachable at all: under the ceiling (with a margin, since the curve only
    // approaches it), or no ceiling. Inside the horizon it is reachable by
    // construction. A reachable milestone past the horizon is said to be
    // beyond it rather than nulled into "never": the horizon is a display
    // choice, the ceiling is not. But a curve that has already peaked and is
    // falling at the horizon is not on its way anywhere — the list ran out —
    // and a milestone above the peak is then not reachable at these rates,
    // whatever the churn ceiling says.
    const falling = peak.month < series.length - 1 && series[series.length - 1].paying < peak.paying;
    const reachable = hit ? true : falling ? false : ceiling === null ? true : target < ceiling * 0.98;
    return { target, month: hit ? hit.month : null, label: hit ? hit.label : null, reachable, beyondHorizon: !hit && reachable };
  });

  return {
    inputs: { reps, dialsPerRepPerDay, workingDaysPerMonth, trialMonths: tm, startingPaying: p0, startingTrialing: t0, listSize: list, horizonMonths: horizon },
    rates,
    organic: organic || null,
    refill: refill || null,
    marketing: marketing || null,
    monthly: {
      dials: Math.round(dials),
      reached: Math.round(reached),
      signups: { dial: r1(dialSignups), organic: r1(organicPerMonth), marketing: r1(marketingPerMonth), referralPerPaying: referral, total: r1(baseSignups) },
      payingAdds: r1(baseAdds),
      refill: r1(refillPerMonth),
      // Yield per dial, fresh against repeat — the two numbers the re-dial
      // row on the page puts side by side.
      freshYield,
      redialYield: redial,
    },
    ceiling: ceiling === null ? null : Math.round(ceiling),
    viral,
    // Why the ceiling is where it is, in the model's own terms: which rate
    // binds, the churn and adds it was set against, the long run once the
    // list is exhausted, and which additive sources are still 0.
    ceilingBy: {
      limitedBy,
      churn,
      addsPerMonth: r1(baseAdds),
      longRun: {
        freshDials: Math.round(longRunFresh),
        redialDials: Math.round(longRunPool),
        signups: r1(longRunSignups),
        adds: r1(longRunAdds),
        paying: longRunPaying === null ? null : Math.round(longRunPaying),
      },
      peak: { month: peak.month, label: peak.label, paying: peak.paying },
      zeroSources,
      returnMonths: RETRY_RETURN_MONTHS,
      maxAttempts: RETRY_MAX_ATTEMPTS,
    },
    // Months of fresh dialling before the list runs out; null when the list
    // is unknown, nothing is dialled, or refill keeps pace with the dialling
    // (it never runs out).
    listRunwayMonths: list === null || dials === 0 || refillPerMonth >= dials ? null : r1(list / (dials - refillPerMonth)),
    listExhaustedAt,
    series,
    milestones,
  };
}

/**
 * What the owner can type, in the order the funnel runs. The route uses it to
 * say which are missing; the page lays the form out from it.
 */
export const ASSUMPTION_FIELDS = Object.freeze([
  { key: "reps", label: "Closers dialling", kind: "count", default: 20 },
  { key: "dialsPerRepPerDay", label: "Dials per closer per day", kind: "count", default: 150 },
  { key: "workingDaysPerMonth", label: "Working days a month", kind: "count", default: 21 },
  { key: "reach", label: "Dials that reach a person", kind: "rate", floor: FLOORS.reach, floorOf: "dispositioned dials" },
  { key: "signup", label: "Conversations that become a signup", kind: "rate", floor: FLOORS.signup, floorOf: "reached conversations" },
  { key: "conversion", label: "Trials that convert to paying", kind: "rate", floor: FLOORS.conversion, floorOf: "ended trials" },
  { key: "churn", label: "Paying subscribers who leave each month", kind: "rate", floor: FLOORS.churnMonths, floorOf: `months with ≥${FLOORS.churnBase} paying` },
  // The hints below are typical ranges, in words, for an owner typing a
  // number before launch. They are hint text and nothing else: the default
  // value is EMPTY, nothing is saved unless typed, and a saved number is
  // shown as "Assumed" until the pipeline measures it. Padding an empty
  // field with a "typical" figure would be a guess wearing a measurement's
  // clothes (AGENTS.md failure class #5).
  {
    key: "referral", label: "Referred signups per paying subscriber, per month", kind: "rate", max: 10, floor: FLOORS.referralMonths, floorOf: `months with ≥${FLOORS.referralBase} paying`,
    hint: "Blank counts as 0. Small-business software with a referral reward typically sees 0.01–0.05 per paying subscriber a month; above 0.1 is unusual.",
  },
  {
    key: "organic", label: "Signups a month from nowhere in particular", kind: "monthlyCount", floor: FLOORS.organicMonths, floorOf: "observed months",
    hint: "Blank counts as 0. Before the site ranks for anything this is typically 0–5 a month; a site that ranks and an app-store listing bring tens.",
  },
  {
    key: "refill", label: "Prospects added to the list a month", kind: "monthlyCount", floor: FLOORS.refillMonths, floorOf: "observed months",
    hint: "Blank counts as 0 — the list is dialled once and runs out. Discovery crawls, licence registers and campaign imports all count; measured from Prospect rows created after launch.",
  },
  {
    key: "redial", label: "Repeat dials that become a signup", kind: "rate", floor: FLOORS.redial, floorOf: "dispositioned repeat dials",
    hint: `Blank counts as 0 — nobody is rung twice. Signups per dial on a repeat attempt, well under a first dial's reach × signup. A row leaves the pool after its rule's attempts (at most ${RETRY_MAX_ATTEMPTS}) and the model assumes it is recycled ${RETRY_RETURN_MONTHS} months later.`,
  },
  {
    key: "marketing", label: "Marketing signups a month", kind: "monthlyCount", floor: FLOORS.marketingMonths, floorOf: "observed months",
    hint: "Blank counts as 0, unless spend and cost per signup are both filled — then it is spend ÷ cost per signup. Measured from signups that redeemed an influencer code; paid-ad signups are not attributed yet and land in organic.",
  },
  { key: "marketingSpend", label: "Marketing spend a month", kind: "money", hint: "Optional. Used only with cost per signup, and only when the count above is blank." },
  { key: "marketingCostPerSignup", label: "Cost per marketing signup", kind: "money", hint: "Optional. Small-business SaaS paid acquisition commonly lands between $50 and $300 a signup." },
]);

/**
 * The marketing count the owner has effectively typed: the count when
 * given, else spend ÷ cost per signup when both are given, else null.
 * Pure, so the route and the check both use it.
 */
export function marketingAssumption({ marketing = null, marketingSpend = null, marketingCostPerSignup = null } = {}) {
  if (finite(marketing) && marketing >= 0) return marketing;
  if (finite(marketingSpend) && marketingSpend >= 0 && finite(marketingCostPerSignup) && marketingCostPerSignup > 0) {
    return marketingSpend / marketingCostPerSignup;
  }
  return null;
}
