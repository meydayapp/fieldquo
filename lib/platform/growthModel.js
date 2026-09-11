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
// Pure. No database, no clock unless `now` is handed in.
// scripts/check-growth-model.mjs executes it against hostile input.

export const MILESTONES = Object.freeze([100, 1_000, 10_000, 100_000, 1_000_000]);
export const HORIZON_MONTHS = 60;

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
});

export const RATE_KEYS = Object.freeze(["reach", "signup", "conversion", "churn", "referral"]);

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
 * @param {object} p.rates               { reach, signup, conversion, churn, referral } — rate() results
 * @param {object} [p.organic]           monthlyCount() result; omitted = zero organic
 * @param {number} [p.trialMonths=1]     signups pay only after the trial ends
 * @param {number} [p.startingPaying=0]
 * @param {number} [p.startingTrialing=0] signups already inside a trial today
 * @param {number} [p.listSize]          prospects loaded; null when unknown
 * @param {number} [p.horizonMonths]
 * @param {Date}   [p.now]
 *
 * Throws a TypeError (with `.missing`) naming every rate whose basis is
 * `none` — see the header for why it does not guess.
 */
export function project({
  reps,
  dialsPerRepPerDay,
  workingDaysPerMonth,
  rates,
  organic = null,
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
  const missing = RATE_KEYS.filter((k) => !rates[k] || rates[k].basis === "none" || !finite(rates[k].value) || rates[k].value < 0);
  if (organic && (organic.basis === "none" || !finite(organic.value) || organic.value < 0)) missing.push("organic");
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

  const reach = rates.reach.value;
  const signup = rates.signup.value;
  const conversion = rates.conversion.value;
  const churn = Math.min(1, rates.churn.value);
  const referral = rates.referral.value;
  const organicPerMonth = organic ? organic.value : 0;

  const dials = reps * dialsPerRepPerDay * workingDaysPerMonth;
  const reached = dials * reach;
  const dialSignups = reached * signup;
  const baseSignups = dialSignups + organicPerMonth;
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
  let paying = p0;
  let cum = { signups: 0, dial: 0, organic: 0, referral: 0, dials: 0 };
  let listExhaustedAt = null;

  for (let m = 0; m <= horizon; m += 1) {
    if (m > 0) {
      const remaining = list === null ? Infinity : Math.max(0, list - cum.dials);
      const dialsThisMonth = Math.min(dials, remaining);
      if (list !== null && listExhaustedAt === null && dialsThisMonth < dials) listExhaustedAt = m;
      const fromDial = dialsThisMonth * reach * signup;
      const fromReferral = paying * referral;
      const fromOrganic = organicPerMonth;
      const signupsThisMonth = fromDial + fromOrganic + fromReferral;
      cum = {
        signups: cum.signups + signupsThisMonth,
        dial: cum.dial + fromDial,
        organic: cum.organic + fromOrganic,
        referral: cum.referral + fromReferral,
        dials: cum.dials + dialsThisMonth,
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
      signupsBySource: { dial: Math.round(cum.dial), organic: Math.round(cum.organic), referral: Math.round(cum.referral) },
      cumulativeDials: Math.round(cum.dials),
    });
  }

  const milestones = MILESTONES.map((target) => {
    const hit = series.find((s) => s.paying >= target) || null;
    // Reachable at all: under the ceiling (with a margin, since the curve only
    // approaches it), or no ceiling. Inside the horizon it is reachable by
    // construction. A reachable milestone past the horizon is said to be
    // beyond it rather than nulled into "never": the horizon is a display
    // choice, the ceiling is not.
    const reachable = hit ? true : ceiling === null ? true : target < ceiling * 0.98;
    return { target, month: hit ? hit.month : null, label: hit ? hit.label : null, reachable, beyondHorizon: !hit && reachable };
  });

  return {
    inputs: { reps, dialsPerRepPerDay, workingDaysPerMonth, trialMonths: tm, startingPaying: p0, startingTrialing: t0, listSize: list, horizonMonths: horizon },
    rates,
    organic: organic || null,
    monthly: {
      dials: Math.round(dials),
      reached: Math.round(reached),
      signups: { dial: r1(dialSignups), organic: r1(organicPerMonth), referralPerPaying: referral, total: r1(baseSignups) },
      payingAdds: r1(baseAdds),
    },
    ceiling: ceiling === null ? null : Math.round(ceiling),
    viral,
    listRunwayMonths: list === null || dials === 0 ? null : r1(list / dials),
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
  { key: "referral", label: "Referred signups per paying subscriber, per month", kind: "rate", max: 10, floor: FLOORS.referralMonths, floorOf: `months with ≥${FLOORS.referralBase} paying` },
  { key: "organic", label: "Signups a month from nowhere in particular", kind: "monthlyCount", floor: FLOORS.organicMonths, floorOf: "observed months" },
]);
