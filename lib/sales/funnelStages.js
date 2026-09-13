// lib/sales/funnelStages.js
//
// A rep's funnel for one month — nine stages from a dial to a company still
// paying at sixty days — and the bands a ramped rep is measured against.
//
// ══ The owner's process, and why the stages are where they are ════════════
//
// Reps in the Philippines dial 150–200 trade contractors a day. The rep does
// NOT take a card: the company enters it on the self-serve signup through the
// rep's link (one month free, card required, then auto-billed). So the rep's
// controllable output ends at "agreed on the call" — they said yes and have
// the link — and everything after it is the company acting. The two derived
// stages the owner named, "agreed on the call" and "signup completed", sit
// either side of that line on purpose. A funnel that went straight from
// "conversation" to "signup" would blame a rep for a contractor who agreed
// and then never opened the link, and credit a rep whose lead signed up
// three weeks after a call they logged as "not interested".
//
// ══ Pure. Every row arrives as an argument ════════════════════════════════
//
// No `@/lib/db`, no clock unless `now` is handed in. lib/sales/performance.js
// makes the argument and it holds here with more force: the benchmark rule
// below (see BENCHMARKS) is the kind of thing that is wrong in the one branch
// nobody opened, and scripts/check-sales-funnel.mjs executes every branch —
// a rep under 200 dials, a rep over it, a signup whose card was never
// entered, a company that activated and then charged back — against fixture
// rows rather than reading the code and nodding.
//
// ══ Where each stage's rows come from ═════════════════════════════════════
//
//   dials            SalesCallAttempt, direction "out", this rep, dialledAt in
//                    the month. A press of the call button, not a connection
//                    — dispositions.js explains why over-counting is the
//                    only safe direction.
//   answered         …with a disposition whose `reached` flag is true. Derived
//                    from DISPOSITIONS, never a hardcoded list, so a new
//                    outcome cannot land on the wrong side by omission.
//   ownerReached     reached, minus `gatekeeper` — the one reached outcome
//                    whose own hint says "the pitch has not happened".
//   conversation     the pitch was heard: CONVERSATION_CODES. `do_not_call`
//                    and `not_a_fit` are owner-reached but not conversations
//                    — one is a refusal to be pitched, the other a business
//                    we do not sell to.
//   agreed           distinct businesses who agreed on the call: an
//                    `agreed_link_sent` disposition, OR a signup-link text
//                    the rep sent (SalesSmsMessage, direction "out", body
//                    carrying the rep's link). Both, deduplicated by lead,
//                    because the send route writes the disposition on the
//                    open attempt when there is one (lib/sales/agreedOnCall.js)
//                    and a link texted between calls has no attempt to write
//                    to. Counting either alone under-counts.
//   signupCompleted  SalesAttribution for this rep, capturedAt in the month,
//                    whose company holds a Subscription row. The Subscription
//                    row is written by the checkout webhook and by the
//                    reconcile, and only then — lib/signup/abandoned.js's
//                    whole argument is that it is the one true "the card was
//                    entered". An attribution WITHOUT one is the abandoned
//                    signup the owner asked to see, and is reported beside
//                    the stage rather than folded into it.
//   activated        …and Company.stripeChargesEnabled — the commission
//                    stage, the same predicate qualifiesForActivation() uses.
//   firstPayment     …and Subscription.billingStartedAt set — the moment real
//                    money first arrived, from Stripe's own timestamp.
//   retained         …and the retention predicate holds at `now`
//                    (lib/sales/commission.js qualifiesForRetention: sixty
//                    days from subscription start, status active, no refund,
//                    no lost or open dispute). The loader evaluates it and
//                    passes the verdict in as `retainedCompanyIds`, because
//                    the predicate lives in a module that imports the
//                    database and this one may not.
//
// The stages are counted in two units and the page says which: the call
// stages count ATTEMPTS (a business rung three times is three dials, three
// chances to answer), the signup stages count COMPANIES. `agreed` is the
// hinge and counts businesses, because one contractor agrees once however
// many calls it took. Every conversion percentage is stage ÷ previous stage,
// which means the agreed → signup step divides companies by businesses; that
// is the honest ratio (of those who said yes, how many finished) and the
// only one the owner can act on.
//
// ══ The benchmark, and the rule that keeps it from becoming a lie ═════════
//
// Beside each conversion is a reference figure. Until the rep has
// BENCHMARK_MIN_DIALS dials in the month, the reference is the published
// B2B cold-calling benchmark and is labelled as such — "benchmark, B2B cold
// calling — not FieldQuo's own". From that point it is FieldQuo's OWN
// measured figure over every rep's dials in the month, with the sample
// printed. The label travels WITH the number in the same object
// (`reference.kind`), and the check asserts a benchmark is never returned
// with kind "fieldquo" and a FieldQuo figure never with kind "benchmark".
// The screen prints `reference.label` and does not compose its own.
//
// Read 2026-09-13: Belkins (175k dials — 9.9% connect per dial, 24.5% per
// prospect over ~3 attempts, 58% of connects become conversations, 4.6% of
// conversations book a next step); First Page Sage (card-required trials →
// 48.8% make a first payment); ChartMogul (card-required trial-to-paid
// median ~30%, top quartile 50–60%); Bridge Group (SDR ramp 3.0 months).
// Where a stage has no published figure the reference is null and the
// screen prints nothing — a dash would read as "zero".
//
// ══ Bands and ramp ════════════════════════════════════════════════════════
//
// Per ramped rep per month: card trials 10 minimum / 15 target / 20 strong;
// agreed on the call 12 / 18 / 24. The Bridge Group's 3.0-month SDR ramp is
// applied as a factor by the rep's start month — ×0.5 in the month they
// started, ×0.75 the next, ×1.0 from the third — and every band is
// multiplied by it. A rep with no start date is treated as ramped: absence
// of a statement is not a statement (AGENTS.md failure class 5), and the
// generous direction here is the one that shows the rep the full bar, not a
// discount nobody granted.

import { DISPOSITIONS } from "./calls/dispositions";

/** The dials a rep needs in the month before FieldQuo's own figure replaces the benchmark. */
export const BENCHMARK_MIN_DIALS = 200;

/** The label every benchmark reference carries. The screen prints this, never its own. */
export const BENCHMARK_LABEL = "benchmark, B2B cold calling — not FieldQuo's own";

/**
 * The published references, keyed by the stage they lead INTO. A value is the
 * conversion from the previous stage; null is "no published figure".
 */
export const BENCHMARKS = Object.freeze({
  answered: { value: 0.099, source: "Belkins, 175k dials: 9.9% connect per dial" },
  // Belkins reports connects, not who answered; owner-reached has no
  // published figure and is not padded with one.
  ownerReached: null,
  conversation: { value: 0.58, source: "Belkins: 58% of connects become conversations" },
  agreed: { value: 0.046, source: "Belkins: 4.6% of conversations book a next step" },
  // The self-serve step is FieldQuo's own process; there is no published
  // figure for "agreed on a call, then completed a card-required signup
  // alone". The growth model assumes 60% when the rep stays on the line and
  // says so there; this funnel does not restate an assumption as a benchmark.
  signupCompleted: null,
  activated: null,
  firstPayment: { value: 0.488, source: "First Page Sage: card-required trials → 48.8% make a first payment" },
  retained: null,
});

/**
 * The stages, in order. `unit` is what is counted; `label` is what a screen
 * prints (the rep's own card resolves `labelKey` through the catalogue and
 * falls back to `label`).
 */
export const STAGES = Object.freeze([
  { key: "dials", label: "Dials", unit: "attempts", labelKey: "app.salesFunnel.stage.dials" },
  { key: "answered", label: "Answered", unit: "attempts", labelKey: "app.salesFunnel.stage.answered" },
  { key: "ownerReached", label: "Owner reached", unit: "attempts", labelKey: "app.salesFunnel.stage.ownerReached" },
  { key: "conversation", label: "Real conversation", unit: "attempts", labelKey: "app.salesFunnel.stage.conversation" },
  { key: "agreed", label: "Agreed on the call", unit: "businesses", labelKey: "app.salesFunnel.stage.agreed" },
  { key: "signupCompleted", label: "Signup completed with card", unit: "companies", labelKey: "app.salesFunnel.stage.signupCompleted" },
  { key: "activated", label: "Activated", unit: "companies", labelKey: "app.salesFunnel.stage.activated" },
  { key: "firstPayment", label: "First payment", unit: "companies", labelKey: "app.salesFunnel.stage.firstPayment" },
  { key: "retained", label: "Retained at 60 days", unit: "companies", labelKey: "app.salesFunnel.stage.retained" },
]);

export const STAGE_KEYS = Object.freeze(STAGES.map((s) => s.key));

/** The reached codes, derived — never a list typed here. */
export const REACHED_CODES = Object.freeze(
  Object.values(DISPOSITIONS).filter((d) => d.reached).map((d) => d.code),
);

/** Reached, minus the one outcome that says the owner was not the person. */
export const OWNER_REACHED_CODES = Object.freeze(REACHED_CODES.filter((c) => c !== "gatekeeper"));

/** The pitch was heard. See the header for why do_not_call and not_a_fit are out. */
export const CONVERSATION_CODES = Object.freeze(
  ["callback", "reached_interested", "agreed_link_sent", "reached_not_interested"].filter((c) => Object.hasOwn(DISPOSITIONS, c)),
);

/** The disposition that IS the agreed stage. */
export const AGREED_CODE = "agreed_link_sent";

/** The bands, per ramped rep per month. */
export const BANDS = Object.freeze({
  signupCompleted: Object.freeze({ minimum: 10, target: 15, strong: 20 }),
  agreed: Object.freeze({ minimum: 12, target: 18, strong: 24 }),
});

/** Ramp factors by month of tenure: the start month, the next, then ramped. */
export const RAMP_FACTORS = Object.freeze([0.5, 0.75, 1]);

export const BAND_ORDER = Object.freeze(["minimum", "target", "strong"]);

function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** "YYYY-MM" in UTC, or null for anything that is not a date. */
export function monthKeyOf(value) {
  const d = when(value);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Is this a "YYYY-MM" the funnel can read? Total. */
export function isMonthKey(value) {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

/** The UTC bounds of a month key: [start, end). Null for a bad key. */
export function monthBounds(monthKey) {
  if (!isMonthKey(monthKey)) return null;
  const [y, m] = monthKey.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)), key: monthKey };
}

/** The month key `offset` months from `monthKey`. */
export function shiftMonth(monthKey, offset) {
  const b = monthBounds(monthKey);
  if (!b) return null;
  const d = new Date(Date.UTC(b.start.getUTCFullYear(), b.start.getUTCMonth() + (Number(offset) || 0), 1));
  return monthKeyOf(d);
}

/** Whole months from the start month to the target month, 0 for the same month. Negative before the start. */
export function monthsBetween(fromKey, toKey) {
  const a = monthBounds(fromKey);
  const b = monthBounds(toKey);
  if (!a || !b) return null;
  return (b.start.getUTCFullYear() - a.start.getUTCFullYear()) * 12 + (b.start.getUTCMonth() - a.start.getUTCMonth());
}

/**
 * The ramp factor for a rep in a month.
 *
 * `startedAt` is SalesRep.startedAt, falling back to acceptedAt, falling
 * back to invitedAt — the earliest honest "they began". Null → ramped (see
 * the header). A month BEFORE the start month is also ramped rather than
 * zero: there is nothing to measure there and a 0× band would print a
 * target of 0 as if it were met.
 */
export function rampFactor({ startedAt = null, acceptedAt = null, invitedAt = null } = {}, monthKey) {
  const start = when(startedAt) || when(acceptedAt) || when(invitedAt);
  if (!start || !isMonthKey(monthKey)) return { factor: 1, tenureMonth: null, ramped: true };
  const tenure = monthsBetween(monthKeyOf(start), monthKey);
  if (tenure === null || tenure < 0) return { factor: 1, tenureMonth: null, ramped: true };
  const idx = Math.min(tenure, RAMP_FACTORS.length - 1);
  return { factor: RAMP_FACTORS[idx], tenureMonth: tenure + 1, ramped: idx === RAMP_FACTORS.length - 1 };
}

/**
 * The bands for one stage with the ramp applied, and where a count sits
 * against them. Bands are rounded to whole counts — a target of 7.5 trials
 * is not a number a rep can hit — always UP, so a half-ramped rep is asked
 * for 8, not 7 (the cheaper rounding would let 7 read as "target met" on a
 * band the owner set at 15).
 */
export function bandsFor(stageKey, factor, count) {
  const base = BANDS[stageKey];
  if (!base) return null;
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const scaled = Object.fromEntries(BAND_ORDER.map((k) => [k, Math.ceil(base[k] * f)]));
  const n = Number.isFinite(count) && count >= 0 ? count : 0;
  let reached = null;
  for (const k of BAND_ORDER) if (n >= scaled[k]) reached = k;
  return {
    base,
    factor: f,
    bands: scaled,
    count: n,
    reached,
    // Percent of the TARGET band, capped at the strong band's share so the
    // bar has an end; the screen draws the three ticks from `bands`.
    percentOfTarget: scaled.target > 0 ? Math.min(scaled.strong / scaled.target, n / scaled.target) : 0,
    remainingToTarget: Math.max(0, scaled.target - n),
  };
}

/**
 * A conversion between two consecutive stages: the ratio, the counts, and
 * the reference beside it with its label.
 *
 * @param fieldquo  { value, sampleDials } | null — FieldQuo's own measured
 *                  figure for this step over every rep in the month, or
 *                  null when it cannot be computed.
 * @param dials     the rep's own dials this month, which decides whether
 *                  the benchmark or FieldQuo's figure is the reference.
 */
export function conversionFor(stageKey, hit, of, { fieldquo = null, dials = 0 } = {}) {
  const k = Number.isFinite(hit) && hit >= 0 ? hit : 0;
  const n = Number.isFinite(of) && of >= 0 ? of : 0;
  const value = n > 0 ? k / n : null;
  const useOwn = Number.isFinite(dials) && dials >= BENCHMARK_MIN_DIALS && fieldquo && Number.isFinite(fieldquo.value);
  let reference = null;
  if (useOwn) {
    reference = {
      kind: "fieldquo",
      value: fieldquo.value,
      label: `FieldQuo's own, measured from ${Number(fieldquo.sampleDials) || 0} dials this month`,
      sampleDials: Number(fieldquo.sampleDials) || 0,
      source: null,
    };
  } else if (BENCHMARKS[stageKey]) {
    reference = {
      kind: "benchmark",
      value: BENCHMARKS[stageKey].value,
      label: BENCHMARK_LABEL,
      sampleDials: null,
      source: BENCHMARKS[stageKey].source,
    };
  }
  return { value, hit: k, of: n, reference, benchmarkUntilDials: useOwn ? null : BENCHMARK_MIN_DIALS };
}

/** A stable key for "which business" an attempt is about — lead, else prospect, else the number. */
function businessKeyOf(row) {
  if (row?.leadId) return `lead:${row.leadId}`;
  if (row?.prospectId) return `prospect:${row.prospectId}`;
  if (row?.toE164) return `phone:${row.toE164}`;
  return null;
}

/**
 * The stage counts for one rep in one month, from rows the loader has
 * already scoped to that rep.
 *
 * @param p.attempts       SalesCallAttempt rows: { direction, dialledAt, disposition, leadId, prospectId, toE164 }
 * @param p.linkSends      SalesSmsMessage rows the rep sent carrying the signup link: { leadId, sentAt }
 * @param p.attributions   SalesAttribution rows for the rep: { companyId, capturedAt }
 * @param p.companies      { id, stripeChargesEnabled, isDemo }
 * @param p.subscriptions  { companyId, billingStartedAt }
 * @param p.retainedCompanyIds  companies qualifiesForRetention() says yes to, at `now`
 * @param p.monthKey       "YYYY-MM"
 */
export function stageCounts({
  attempts = [],
  linkSends = [],
  attributions = [],
  companies = [],
  subscriptions = [],
  retainedCompanyIds = [],
  monthKey,
} = {}) {
  const bounds = monthBounds(monthKey);
  if (!bounds) throw new TypeError(`funnelStages: "${String(monthKey)}" is not a YYYY-MM month`);
  const inMonth = (at) => {
    const d = when(at);
    return Boolean(d) && d >= bounds.start && d < bounds.end;
  };

  const dialsRows = (Array.isArray(attempts) ? attempts : []).filter(
    (a) => a && (a.direction || "out") === "out" && inMonth(a.dialledAt),
  );
  const reached = new Set(REACHED_CODES);
  const owner = new Set(OWNER_REACHED_CODES);
  const convo = new Set(CONVERSATION_CODES);

  const answeredRows = dialsRows.filter((a) => reached.has(a.disposition));
  const ownerRows = dialsRows.filter((a) => owner.has(a.disposition));
  const convoRows = dialsRows.filter((a) => convo.has(a.disposition));

  const agreedKeys = new Set();
  for (const a of dialsRows) {
    if (a.disposition !== AGREED_CODE) continue;
    const k = businessKeyOf(a);
    if (k) agreedKeys.add(k);
  }
  for (const s of Array.isArray(linkSends) ? linkSends : []) {
    if (!s?.leadId || !inMonth(s.sentAt)) continue;
    agreedKeys.add(`lead:${s.leadId}`);
  }

  const byCompany = new Map((Array.isArray(companies) ? companies : []).filter((c) => c?.id).map((c) => [c.id, c]));
  const subByCompany = new Map((Array.isArray(subscriptions) ? subscriptions : []).filter((s) => s?.companyId).map((s) => [s.companyId, s]));
  const retained = new Set(Array.isArray(retainedCompanyIds) ? retainedCompanyIds : []);

  // One company counts once, whatever the attribution table holds; demo
  // companies are seeded and never a sale.
  const attributed = [];
  const seen = new Set();
  for (const a of Array.isArray(attributions) ? attributions : []) {
    if (!a?.companyId || seen.has(a.companyId) || !inMonth(a.capturedAt)) continue;
    if (byCompany.get(a.companyId)?.isDemo) continue;
    seen.add(a.companyId);
    attributed.push(a.companyId);
  }
  const completed = attributed.filter((id) => subByCompany.has(id));
  const abandoned = attributed.filter((id) => !subByCompany.has(id));
  const activated = completed.filter((id) => Boolean(byCompany.get(id)?.stripeChargesEnabled));
  const firstPayment = activated.filter((id) => Boolean(when(subByCompany.get(id)?.billingStartedAt)));
  const retainedIds = firstPayment.filter((id) => retained.has(id));

  return {
    monthKey,
    counts: {
      dials: dialsRows.length,
      answered: answeredRows.length,
      ownerReached: ownerRows.length,
      conversation: convoRows.length,
      agreed: agreedKeys.size,
      signupCompleted: completed.length,
      activated: activated.length,
      firstPayment: firstPayment.length,
      retained: retainedIds.length,
    },
    // Named beside the stage rather than folded in: an attribution with no
    // Subscription is a signup that was started and not finished.
    abandonedSignups: abandoned.length,
    dispositioned: dialsRows.filter((a) => Boolean(a.disposition)).length,
    companyIds: { attributed, completed, activated, firstPayment, retained: retainedIds },
  };
}

/**
 * FieldQuo's own step conversions over EVERY rep's counts in the month — the
 * reference a rep past BENCHMARK_MIN_DIALS is compared to. Null per step
 * when the denominator is 0.
 */
export function fieldquoReferences(allCounts = []) {
  const rows = Array.isArray(allCounts) ? allCounts : [];
  const sum = (k) => rows.reduce((a, c) => a + (Number(c?.counts?.[k]) || 0), 0);
  const dials = sum("dials");
  const out = {};
  for (let i = 1; i < STAGES.length; i += 1) {
    const to = STAGES[i].key;
    const from = STAGES[i - 1].key;
    const n = sum(from);
    out[to] = n > 0 ? { value: sum(to) / n, sampleDials: dials } : null;
  }
  return out;
}

/**
 * One rep's funnel, laid out for a screen: every stage with its count, the
 * conversion from the stage before with the reference beside it, the two
 * quota bars, and the ramp.
 */
export function buildRepFunnel({ rep, counts, monthKey, references = null }) {
  if (!counts || !counts.counts) throw new TypeError("funnelStages: counts are required");
  const c = counts.counts;
  const ramp = rampFactor(rep || {}, monthKey);
  const stages = STAGES.map((s, i) => {
    const prev = i > 0 ? STAGES[i - 1].key : null;
    const conversion = prev
      ? conversionFor(s.key, c[s.key], c[prev], { fieldquo: references?.[s.key] || null, dials: c.dials })
      : null;
    return { key: s.key, label: s.label, labelKey: s.labelKey, unit: s.unit, count: c[s.key], conversion, from: prev };
  });
  return {
    rep: rep ? { id: rep.id, name: rep.name, code: rep.code || null, active: rep.active !== false } : null,
    monthKey,
    stages,
    abandonedSignups: counts.abandonedSignups,
    dispositioned: counts.dispositioned,
    ramp,
    quotas: {
      signupCompleted: bandsFor("signupCompleted", ramp.factor, c.signupCompleted),
      agreed: bandsFor("agreed", ramp.factor, c.agreed),
    },
    benchmark: { minDials: BENCHMARK_MIN_DIALS, label: BENCHMARK_LABEL, usingOwn: c.dials >= BENCHMARK_MIN_DIALS },
  };
}

/**
 * The CSV export: one row per rep per stage. RFC 4180 quoting, a header row,
 * and the reference kind spelled out so a spreadsheet cannot mistake the
 * benchmark for a measurement.
 */
export function funnelCsv(funnels = []) {
  const q = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const pct = (v) => (typeof v === "number" && Number.isFinite(v) ? (v * 100).toFixed(1) : "");
  const rows = [[
    "month", "rep", "rep_code", "stage", "unit", "count", "conversion_from_previous_pct",
    "reference_kind", "reference_pct", "reference_label", "ramp_factor", "quota_minimum", "quota_target", "quota_strong",
  ]];
  for (const f of Array.isArray(funnels) ? funnels : []) {
    for (const s of f.stages) {
      const quota = f.quotas?.[s.key] || null;
      rows.push([
        f.monthKey, f.rep?.name || "", f.rep?.code || "", s.key, s.unit, s.count,
        pct(s.conversion?.value), s.conversion?.reference?.kind || "", pct(s.conversion?.reference?.value),
        s.conversion?.reference?.label || "", f.ramp?.factor ?? "",
        quota ? quota.bands.minimum : "", quota ? quota.bands.target : "", quota ? quota.bands.strong : "",
      ]);
    }
  }
  return rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}
