// lib/sales/performance.js
//
// The numbers a superadmin looks at on a Monday morning, and the ones this
// build refuses to print.
//
// ══ Pure. Every row arrives as an argument ════════════════════════════════
//
// No `@/lib/db` import anywhere in this file, for the reason
// lib/analytics/kpis.js gives in the same words: it is what lets
// scripts/check-sales-admin.mjs execute every branch — a rep with three
// signups, a ledger containing a reversal, a rep who has left — without a
// database and without a fixture nobody maintains. The route does the reading.
//
// ══ What is REUSED, and why nothing here re-derives it ════════════════════
//
//   bucketSignups   lib/sales/repStats.js — day/week/total in UTC, Monday
//                   weeks, matching the payout batch week. A second bucketer
//                   here would disagree with the rep's own portal about what
//                   "this week" means, and the rep would be right to believe
//                   theirs.
//   balanceCents /  lib/sales/commission.js — a balance is SUMMED from rows,
//   splitPayable    never stored. A reversal is a negative row and falls out
//                   of the sum with no special case, which is the entire
//                   reason the ledger has that shape.
//   RATE_FLOOR /    lib/analytics/kpis.js — imported rather than restated, so
//   COUNT_FLOOR     the floor that gates a contractor's win rate is literally
//                   the same integer that gates a rep's conversion rate.
//
// ══ The floor is the difference between a leaderboard and a lie ═══════════
//
// A rep with three signups and three conversions has a 100% conversion rate
// and would top any table sorted by it — above a rep with forty signups and
// twenty-eight. lib/analytics/winLoss.js's argument for RATE_FLOOR applies
// unchanged: below ten decided outcomes, one of them flipping moves the rate
// by more than ten points, which is a bigger swing than anyone would act on.
//
// So below the floor there is no percentage. There is "3 of 4", which is
// honest at any n, plus how many more are needed. The screen must never
// compute a percentage from `sampleSize` and `hit` to fill the gap; the values
// are there so it can print the fraction, not so it can divide them.
//
// ══ A figure that cannot be computed is NOT_TRACKED, never zero ═══════════
//
// Same list shape as lib/analytics/kpis.js's NOT_TRACKED: a key, a label, and
// the actual reason. AGENTS.md failure class 5 — absence of a statement is not
// a statement — is the whole of it. A rep's cost is not in this database, so
// cost per acquisition is not a zero and not a dash: it is a named gap with the
// missing input named.
import { RATE_FLOOR, COUNT_FLOOR } from "@/lib/analytics/kpis";
import { bucketSignups } from "./repStats";
import { balanceCents, splitPayable, MILESTONE_ORDER, MILESTONE_LABELS } from "./commission";

/** The lead statuses SalesLead.status is documented to hold, in pipeline order. */
export const LEAD_STATUSES = ["new", "contacted", "demoed", "signed", "lost"];

export const LEAD_STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  demoed: "Demoed",
  signed: "Signed",
  lost: "Lost",
};

/**
 * A rate, or the counts that stand in for one.
 *
 * `value` is a percentage or null; `hit` and `sampleSize` are always present so
 * a screen can print "3 of 4" whether or not the rate exists. `floor` and
 * `remaining` say how many more are needed, taken from the constant rather than
 * typed — kpis.js's REASONS header explains why the number lives in the
 * envelope rather than inside a sentence.
 */
export function rate(hit, of, { floor = RATE_FLOOR } = {}) {
  const n = Number(of) || 0;
  const k = Number(hit) || 0;
  const suppressed = (reason, sampleSize, remaining) => ({
    value: null,
    hit: reason === "none_yet" ? 0 : k,
    sampleSize,
    floor,
    remaining,
    reason,
    // The sentence travels WITH the number, the way kpis.js attaches
    // `reasonText` to its envelope and for the same reason: a screen must be
    // able to render any suppressed rate without carrying its own copy of this
    // wording, which would drift from this one. It also keeps the page from
    // importing this module into a client bundle purely to look a string up.
    statement: rateStatement({ reason, hit: k, sampleSize, floor, remaining }),
  });

  if (n <= 0) return suppressed("none_yet", 0, floor);
  if (n < floor) return suppressed("below_floor", n, floor - n);

  return {
    value: Math.round((k / n) * 1000) / 10,
    hit: k,
    sampleSize: n,
    floor,
    remaining: 0,
    reason: null,
    statement: null,
  };
}

/** English for a `rate()` that has no percentage. Null when it has one. */
export function rateStatement(r) {
  if (!r || r.reason === null || r.reason === undefined) return null;
  if (r.reason === "none_yet") {
    return `Nothing to measure yet — ${r.floor} are needed before a percentage means anything.`;
  }
  return `${r.hit} of ${r.sampleSize}. ${r.remaining} more and this becomes a percentage.`;
}

const inRange = (at, from, to) => {
  if (!at) return false;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
};

/**
 * Commission for one rep, summed from the ledger and split four ways.
 *
 * `earnedCents` is the gross of the positive rows and `reversedCents` the
 * absolute of the negatives — printed separately rather than netted, because
 * "earned $1,250, of which $650 was taken back" and "earned $600" are the same
 * number and different sentences. `balanceCents` is the net and is what is
 * actually owed.
 *
 * `paidCents` sums the rows sitting in a batch marked paid. Note the asymmetry
 * that follows from SalesPayoutBatch's own comment: `totalCentsAtClose` is a
 * record of what was owed when the batch closed and is explicitly NOT the
 * figure paid from, so it is not read here — a reversal landing after the close
 * has to reduce this figure rather than be papered over by a cached total.
 */
export function commissionForRep(entries, batchesById = new Map()) {
  const rows = Array.isArray(entries) ? entries : [];
  const positives = rows.filter((e) => (Number(e?.amountCents) || 0) > 0);
  const negatives = rows.filter((e) => (Number(e?.amountCents) || 0) < 0);
  const { payableCents, batchedCents } = splitPayable(rows);

  const paidCents = balanceCents(
    rows.filter((e) => e.payoutBatchId && batchesById.get(e.payoutBatchId)?.status === "paid"),
  );

  return {
    earnedCents: balanceCents(positives),
    reversedCents: Math.abs(balanceCents(negatives)),
    balanceCents: balanceCents(rows),
    payableCents,
    batchedCents,
    paidCents,
    // Owed is what the ledger nets to minus what has actually been paid out.
    // Not `payableCents`: a row can sit in a batch that has closed and not yet
    // been paid, which is owed money that is no longer "payable now".
    owedCents: balanceCents(rows) - paidCents,
    reversalCount: negatives.length,
  };
}

/**
 * Which companies reached which milestone, from the ledger.
 *
 * Net per (company, milestone), so a reversal removes a company from the stage
 * it was taken back out of — the same arithmetic balanceCents does, applied per
 * company instead of per rep. A milestone that was earned and then reversed is
 * NOT "reached": the retention reward exists to count customers who stuck, and
 * one who charged back did not.
 */
export function milestoneCompanies(entries) {
  const net = new Map(); // `${companyId}:${milestone}` -> cents
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e?.companyId || !e?.milestone) continue;
    const key = `${e.companyId}:${e.milestone}`;
    net.set(key, (net.get(key) || 0) + (Number(e.amountCents) || 0));
  }
  const out = {};
  for (const milestone of MILESTONE_ORDER) out[milestone] = new Set();
  for (const [key, cents] of net) {
    if (cents <= 0) continue;
    const at = key.lastIndexOf(":");
    const companyId = key.slice(0, at);
    const milestone = key.slice(at + 1);
    if (out[milestone]) out[milestone].add(companyId);
  }
  return out;
}

/**
 * The acquisition funnel, and the caveat it has to carry.
 *
 * Stage 1 is a FACT about the company (Stripe has enabled charges — the same
 * predicate qualifiesForActivation() uses), not a ledger row, because it is
 * knowable without one. Stages 2 and 3 have no other record: nothing in the
 * schema marks "this company's first payment landed" except the commission
 * entry itself.
 *
 * Which is exactly why `incomplete` exists here. earnMilestone() writes nothing
 * for a rep with no commission plan — deliberately, since paying an invented
 * figure is worse than paying late — so every company brought in by an
 * unplanned rep is invisible to stages 2 and 3. That is a real, quantifiable
 * distortion and the funnel names it rather than reporting a smaller number as
 * though it were the number.
 */
export function buildFunnel({ attributions = [], companies = [], entries = [], unplannedRepIds = [] } = {}) {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const attributed = attributions.map((a) => a.companyId).filter(Boolean);
  const reached = milestoneCompanies(entries);

  const unplanned = new Set(unplannedRepIds);
  const blindCompanies = attributions.filter((a) => unplanned.has(a.salesRepId)).length;

  const activated = attributed.filter((id) => Boolean(byId.get(id)?.stripeChargesEnabled));

  const stages = [
    {
      key: "attributed",
      label: "Brought in",
      count: attributed.length,
      source: "fact",
      incomplete: false,
      reason: null,
    },
    {
      key: "activation",
      label: MILESTONE_LABELS.activation,
      count: activated.length,
      // Stripe's own verification, read off the Company row. Independent of
      // whether anyone was ever paid a commission for it.
      source: "fact",
      incomplete: false,
      reason: null,
    },
    {
      key: "first_payment",
      label: MILESTONE_LABELS.first_payment,
      count: reached.first_payment.size,
      source: "ledger",
      incomplete: blindCompanies > 0,
      reason: blindCompanies > 0 ? "unplanned_reps" : null,
    },
    {
      key: "retention",
      label: MILESTONE_LABELS.retention,
      count: reached.retention.size,
      source: "ledger",
      incomplete: blindCompanies > 0,
      reason: blindCompanies > 0 ? "unplanned_reps" : null,
    },
  ];

  return {
    stages,
    blindCompanies,
    // A conversion from "brought in" to "still paying" is a percentage and gets
    // the same floor everything else does.
    activationRate: rate(activated.length, attributed.length),
    retentionRate: rate(reached.retention.size, attributed.length),
    incompleteReason:
      blindCompanies > 0
        ? `${blindCompanies} attributed ${blindCompanies === 1 ? "company is" : "companies are"} ` +
          "invisible to the payment stages: the rep who brought them in has no " +
          "commission plan, so no ledger row was ever written. Assign a plan and " +
          "the stages fill in from the next milestone onwards."
        : null,
  };
}

/** Lead counts by status, plus the two derived questions worth asking of them. */
export function buildLeadPipeline(leads = []) {
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
  let unknownStatus = 0;
  for (const lead of leads) {
    const status = String(lead?.status || "");
    if (status in counts) counts[status] += 1;
    else unknownStatus += 1;
  }
  const total = leads.length;
  const decided = counts.signed + counts.lost;

  return {
    total,
    counts,
    unknownStatus,
    byStatus: LEAD_STATUSES.map((s) => ({
      key: s,
      label: LEAD_STATUS_LABELS[s],
      count: counts[s],
    })),
    // Of the leads that reached an outcome, how many signed. Deliberately over
    // DECIDED leads rather than over all of them: a pipeline full of untouched
    // "new" rows would drag a win rate toward zero and say nothing about the
    // reps' actual hit rate — the same denominator lib/analytics/winLoss.js
    // chooses, for the same reason.
    winRate: rate(counts.signed, decided),
    // How many of the leads a rep entered actually became a company. This one
    // IS over every lead: converting a lead is the job, and an untouched lead
    // is a failure to do it rather than an absent measurement.
    conversionRate: rate(leads.filter((l) => l?.convertedCompanyId).length, total),
  };
}

/**
 * One row per rep, ranked.
 *
 * ── The ranking is the answer to "what would he look at first" ────────────
 *
 * Signups this week, descending. Not commission (it lags by up to sixty days
 * and answers a finance question, not a Monday question), not total signups (a
 * rep hired in March outranks everyone forever and the table stops being
 * about this week), not conversion rate (most reps sit under the floor and
 * have no rate at all, so sorting by it sorts by nulls).
 *
 * Ties break on this month, then total, then name — so the order is stable
 * across reloads rather than reshuffling on whatever the database returned
 * first.
 *
 * ── A deactivated rep stays in the table ─────────────────────────────────
 *
 * With their history intact and their status shown. SalesRep's own schema
 * comment — "their attributions and their ledger are history, and history does
 * not stop being true" — and lib/sales/commission.js's departedRepStillEarns()
 * both say it. Hiding them would also silently change every total on this page
 * the day somebody leaves, which is the worse half: the funnel would drop
 * companies FieldQuo really did acquire.
 */
export function buildRepRows({
  reps = [],
  attributions = [],
  entries = [],
  batches = [],
  leads = [],
  from = null,
  to = null,
  now = new Date(),
} = {}) {
  const batchesById = new Map(batches.map((b) => [b.id, b]));

  const attributionsByRep = new Map();
  for (const a of attributions) {
    if (!a?.salesRepId) continue;
    if (!attributionsByRep.has(a.salesRepId)) attributionsByRep.set(a.salesRepId, []);
    attributionsByRep.get(a.salesRepId).push(a);
  }
  const entriesByRep = new Map();
  for (const e of entries) {
    if (!e?.salesRepId) continue;
    if (!entriesByRep.has(e.salesRepId)) entriesByRep.set(e.salesRepId, []);
    entriesByRep.get(e.salesRepId).push(e);
  }
  const leadsByRep = new Map();
  for (const l of leads) {
    if (!l?.salesRepId) continue;
    if (!leadsByRep.has(l.salesRepId)) leadsByRep.set(l.salesRepId, []);
    leadsByRep.get(l.salesRepId).push(l);
  }

  const rows = reps.map((rep) => {
    const mine = attributionsByRep.get(rep.id) || [];
    const myEntries = entriesByRep.get(rep.id) || [];
    const myLeads = leadsByRep.get(rep.id) || [];

    const buckets = bucketSignups(mine.map((a) => a.capturedAt), now);
    const inPeriod = mine.filter((a) => inRange(a.capturedAt, from, to)).length;
    const reached = milestoneCompanies(myEntries);

    return {
      id: rep.id,
      name: rep.name,
      code: rep.code,
      active: Boolean(rep.active),
      endedAt: rep.endedAt || null,
      acceptedAt: rep.acceptedAt || null,
      hasCommissionPlan: Boolean(rep.commissionPlanId),
      signups: {
        today: buckets.today,
        thisWeek: buckets.thisWeek,
        total: buckets.total,
        inPeriod,
      },
      milestones: Object.fromEntries(
        MILESTONE_ORDER.map((m) => [m, reached[m]?.size || 0]),
      ),
      commission: commissionForRep(myEntries, batchesById),
      leads: buildLeadPipeline(myLeads),
    };
  });

  rows.sort(
    (a, b) =>
      b.signups.thisWeek - a.signups.thisWeek ||
      b.signups.inPeriod - a.signups.inPeriod ||
      b.signups.total - a.signups.total ||
      String(a.name).localeCompare(String(b.name)),
  );
  return rows;
}

/**
 * What this dashboard deliberately does not print, and the missing input.
 *
 * Same shape and same discipline as lib/analytics/kpis.js's NOT_TRACKED. Every
 * one of these is a figure a sales dashboard is normally expected to carry; a
 * zero or a dash in its place would read as a measurement.
 */
export const NOT_TRACKED = [
  {
    key: "costPerAcquisition",
    label: "Cost per acquisition",
    reason:
      "Nothing in this database holds what a rep costs. SalesCommissionPlan is what FieldQuo pays PER SALE, not salary, tooling or the hours behind an unsold call — so a CAC built from it would be the commission figure wearing a different name, and it would make an expensive rep look identical to a cheap one.",
  },
  {
    key: "callsAndTalkTime",
    label: "Calls made, talk time, connect rate",
    reason:
      "There is no human calling path yet. PlatformVoiceCall records FieldQuo's own AI receptionist, and docs/sales-intel/AUDIT-telephony.md establishes that Twilio has no Voice wiring in this repo at all — no SDK, no calls.create, no access tokens. Counting receptionist minutes as rep activity would attribute a robot's work to a person.",
  },
  {
    key: "timeToClose",
    label: "Time from first touch to signup",
    reason:
      "SalesLead.createdAt is when a REP TYPED the lead in, which is usually after the first conversation and sometimes days after it. SalesAttributionTouch records a second rep touching an already-attributed company, not a first touch. Measuring from a data-entry timestamp would produce a number that improves when reps get slower at paperwork.",
  },
  {
    key: "pipelineValue",
    label: "Pipeline value",
    reason:
      "A SalesLead carries no deal size, and it could not: what a contractor will pay is their plan price, which is not chosen until signup. Multiplying open leads by an average plan would be an invented forecast, which is what §18 of the spec rules out — deterministic rules first, no invented conversion probabilities before there is data.",
  },
];

/**
 * The whole page, in one object.
 *
 * `headline` is what a person reads without scrolling, and its order is the
 * order of the questions: how many did we sell this week, how many this
 * period, what do we owe.
 */
export function buildSalesPerformance({
  reps = [],
  attributions = [],
  entries = [],
  batches = [],
  leads = [],
  companies = [],
  from = null,
  to = null,
  now = new Date(),
} = {}) {
  const unplannedRepIds = reps.filter((r) => !r.commissionPlanId).map((r) => r.id);
  const rows = buildRepRows({ reps, attributions, entries, batches, leads, from, to, now });
  const funnel = buildFunnel({ attributions, companies, entries, unplannedRepIds });
  const pipeline = buildLeadPipeline(leads);

  const allSignups = bucketSignups(attributions.map((a) => a.capturedAt), now);
  const owedCents = rows.reduce((sum, r) => sum + r.commission.owedCents, 0);
  const paidCents = rows.reduce((sum, r) => sum + r.commission.paidCents, 0);
  const reversedCents = rows.reduce((sum, r) => sum + r.commission.reversedCents, 0);

  return {
    period: { from, to },
    headline: {
      signupsThisWeek: allSignups.thisWeek,
      signupsToday: allSignups.today,
      signupsInPeriod: attributions.filter((a) => inRange(a.capturedAt, from, to)).length,
      signupsTotal: allSignups.total,
      weekStartsAt: allSignups.weekStartsAt,
      dayStartsAt: allSignups.dayStartsAt,
      owedCents,
      paidCents,
      reversedCents,
      activeReps: reps.filter((r) => r.active).length,
      repsWithoutPlan: unplannedRepIds.length,
    },
    reps: rows,
    funnel,
    pipeline,
    notTracked: NOT_TRACKED,
    floors: { rate: RATE_FLOOR, count: COUNT_FLOOR },
  };
}
