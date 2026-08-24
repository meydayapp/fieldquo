// lib/costing/actualJobCost.js
//
// What a job ACTUALLY cost, against what it was estimated to cost.
//
// ── The gap this fills ─────────────────────────────────────────────────────
//
// The quote side of costing is good: estimateQuoteCost works out materials,
// labour hours, overhead and margin, and the quote screen shows all of it.
// Then the job happens, expenses get tagged to it, crews log hours against it
// — and none of that appeared anywhere on the job. QA recorded a $125.50
// materials expense against a job, watched it show up in Expense Tracking, and
// found the job itself had no cost section at all.
//
// So a contractor could see what they THOUGHT a job would cost and never what
// it did. "Did this one make money" is the question the whole feature exists
// to answer, and it was the half that was missing.
//
// ── Rules ──────────────────────────────────────────────────────────────────
//
//   * Only APPROVED hours count as cost. Pending hours are a claim, not a
//     payroll liability, and counting them would make every job look worse
//     until someone got round to the timesheets. They are reported separately
//     so the number isn't silently incomplete either.
//
//   * A worker with no rate contributes hours and no cost, and is COUNTED. An
//     unrated worker silently costing nothing is how a job shows a fake profit.
//
//   * Nothing is estimated, extrapolated or annualised. This is a sum of things
//     that actually happened.
//
//   * No estimate and no actuals means no comparison — not a 0% variance. A
//     job with nothing recorded has not come in on budget.

import { crewHoursPool } from "@/lib/costing/crew";
import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// Finite-safe both ways — 1e308 survives `num` and dies at the ×100.
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

/**
 * Actual spend on one job.
 *
 * @param {object[]} expenses     rows tagged to this job: { category, amount }
 * @param {object[]} timeEntries  rows for this job: { hours, status, worker }
 */
export function actualJobCost(expenses = [], timeEntries = []) {
  const exp = Array.isArray(expenses) ? expenses : [];
  const entries = Array.isArray(timeEntries) ? timeEntries : [];

  const byCategory = new Map();
  let expenseTotal = 0;
  for (const e of exp) {
    const amount = num(e?.amount);
    if (!amount) continue;
    const key = e?.category || "other";
    byCategory.set(key, round2((byCategory.get(key) || 0) + amount));
    expenseTotal += amount;
  }

  let approvedHours = 0;
  let pendingHours = 0;
  let labourCost = 0;
  let unratedHours = 0;
  const workersSeen = new Set();

  for (const t of entries) {
    const hours = num(t?.hours);
    if (!hours) continue;
    if (t?.status !== "approved") {
      pendingHours += hours;
      continue;
    }
    approvedHours += hours;
    if (t?.workerId) workersSeen.add(t.workerId);
    const rate = t?.worker?.hourlyRate;
    // Explicitly null-checked before Number(): Number(null) is 0, which would
    // turn "we don't know this person's rate" into "this person is free".
    if (rate === null || rate === undefined || rate === "") {
      unratedHours += hours;
      continue;
    }
    labourCost += hours * num(rate);
  }

  return {
    expenses: {
      total: round2(expenseTotal),
      byCategory: [...byCategory.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    },
    labour: {
      approvedHours: round2(approvedHours),
      pendingHours: round2(pendingHours),
      cost: round2(labourCost),
      // Hours from people with no rate on file. Surfaced rather than folded
      // into the total as zero, because a job showing profit only because
      // nobody priced the crew is the worst kind of wrong number.
      unratedHours: round2(unratedHours),
      workers: workersSeen.size,
    },
    total: round2(expenseTotal + labourCost),
    // True when the total is knowably short. The UI says so instead of
    // presenting a partial figure as final.
    incomplete: pendingHours > 0 || unratedHours > 0,
  };
}

/**
 * Estimated vs actual vs invoiced.
 *
 * Every field is null when the input for it is absent. A caller must be able
 * to tell "nothing spent yet" from "we don't know", and a zero cannot.
 */
export function compareJobCost({ estimatedCost, actualCost, revenue } = {}) {
  const est = estimatedCost == null ? null : round2(estimatedCost);
  const act = actualCost == null ? null : round2(actualCost);
  const rev = revenue == null ? null : round2(revenue);

  const variance = est === null || act === null ? null : round2(act - est);
  // Percentage against the ESTIMATE, which is the thing being tested. A zero
  // estimate has no percentage — dividing by it would produce Infinity and
  // render as a number.
  const variancePct =
    variance === null || !est ? null : Math.round((variance / est) * 1000) / 10;

  const profit = rev === null || act === null ? null : round2(rev - act);
  const marginPct =
    profit === null || !rev ? null : Math.round((profit / rev) * 1000) / 10;

  return {
    estimatedCost: est,
    actualCost: act,
    revenue: rev,
    variance,
    variancePct,
    profit,
    marginPct,
    // Over budget is worth flagging; on or under budget is not an alert.
    // Null-safe: unknown is not "over".
    overBudget: variance !== null && variance > 0,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Invoice costing — the same crew arithmetic, pointed at work that happened
// ───────────────────────────────────────────────────────────────────────────
//
// The owner's ask: "some jobs may take more time than others so while creating
// the quote or invoice the billable hours should be able to be edited,
// especially in an invoice."
//
// On a quote the hours are a PREDICTION and the crew shares a pool the recipe
// worked out. On an invoice they are a FACT, one per person, and the pool is
// whatever they add up to — see crewHoursPool. Everything after that (blended
// rate, unrated flagging, overhead, margin, the signal colours) is identical,
// so this reuses estimateQuoteCost with an empty scope-group list rather than
// growing a second copy of the same formula that nobody would remember to fix.

/// Hard ceilings, taken from the column widths in prisma/schema.prisma —
/// Decimal(12,2) for money, Decimal(10,2) for hours. Anything past these would
/// throw on write, so it is caught at the boundary instead of at the database.
const MAX_MONEY = 9_999_999_999.99;
const MAX_HOURS = 99_999_999.99;

/// Refuse, don't clamp.
///
/// The tempting version is `Math.min(n, max)`, and it is wrong: a ten-billion
/// dollar materials line on a painting contractor's invoice is a typo or a
/// paste, and rewriting it as the largest number the column happens to hold
/// invents a figure the user never typed and then presents it as theirs.
/// Zero is visible — the panel shows $0 and the margin is obviously wrong, so
/// somebody fixes it. $9,999,999,999.99 looks deliberate.
///
/// Negatives and non-finite values go the same way. `num` already turns
/// Infinity and NaN into 0; the ceiling check catches 1e308, which is finite
/// right up until something multiplies it.
const sane = (v, max) => {
  const n = num(v);
  if (n <= 0 || n > max) return 0;
  return round2(n);
};

/**
 * The browser → database boundary for an invoice's cost panel.
 *
 * Everything here arrives as whatever a text input produced, so nothing is
 * trusted: names are trimmed and length-capped, rates and hours past what the
 * columns can hold are refused rather than clamped, and the derived money is
 * NOT read from the
 * request at all — the caller recomputes it from these rows. FieldQuo's rule
 * that the browser never sends money amounts is about client-facing pricing,
 * but the same discipline is free here and removes the question entirely.
 *
 * `hours: null` is preserved rather than coerced to 0. On an invoice it means
 * "nobody has logged time for this person yet", which is a different statement
 * from "they worked no hours", and crewLabourCost reads the two differently.
 */
export function normaliseInvoiceCosting(input) {
  if (!input || typeof input !== "object") return null;

  const rawCrew = Array.isArray(input.crew) ? input.crew : [];
  const crew = rawCrew
    .filter((m) => m && typeof m === "object")
    .slice(0, 50) // a field-service crew is not fifty people; this is an abuse stop
    .map((m) => ({
      id: typeof m.id === "string" ? m.id.slice(0, 64) : null,
      name: String(m.name ?? "")
        .trim()
        .slice(0, 120),
      rate: sane(m.rate, MAX_MONEY),
      hours:
        m.hours === null ||
        m.hours === undefined ||
        m.hours === "" ||
        !Number.isFinite(Number(m.hours))
          ? null
          : sane(m.hours, MAX_HOURS),
    }));

  return {
    crew,
    materialCost: sane(input.materialCost, MAX_MONEY),
    // A percentage, and only consulted when the company has no real
    // cost-per-job figure. 1000% is already absurd; past that it is a typo.
    overheadPct: Math.min(num(input.overheadPct) > 0 ? round2(input.overheadPct) : 0, 1000),
    note: String(input.note ?? "")
      .trim()
      .slice(0, 500),
  };
}

/**
 * What an invoice's job cost, and what is left of the invoice after it.
 *
 * @param {object}  p
 * @param {Array}   p.crew          [{ name, rate, hours }] — hours are actual
 * @param {number}  p.materialCost  materials bought for this job
 * @param {number}  p.overheadPct   fallback overhead as a % of the price
 * @param {number?} p.overheadPerJob the company's real overhead per job, when
 *                                   known; it wins over the percentage
 * @param {number}  p.price         the invoice subtotal, pre-tax
 * @returns the same shape estimateQuoteCost returns, so CostMarginPanel needs
 *          no second rendering path.
 */
export function invoiceCostSummary({
  crew = [],
  materialCost = 0,
  overheadPct = 0,
  overheadPerJob = null,
  price = 0,
  marginTargetPct = 30,
} = {}) {
  const list = Array.isArray(crew) ? crew.filter(Boolean) : [];
  return estimateQuoteCost({
    // No recipes on an invoice. An invoice is a flat list of work already
    // done — there is no scope group to predict materials or hours from, and
    // pretending otherwise would put a prediction on a document of record.
    scopeGroups: [],
    crew: list,
    // The pool IS the crew's hours, so every member has explicit hours and
    // nothing is left to share. That keeps the "Labour — N hrs" headline equal
    // to the sum of the rows above it; deriving the pool the other way round
    // let the two disagree the moment somebody typed over a seeded figure.
    manualLabourHours: crewHoursPool(list),
    manualMaterialCost: materialCost,
    price,
    overheadPerJob,
    overheadPctOfPrice: overheadPct,
    marginTargetPct,
  });
}

/**
 * Seed an invoice's crew from a job's timesheets.
 *
 * ── Seed, don't start blank ────────────────────────────────────────────────
 *
 * The hours already exist. Crews clock in against the job, the office approves
 * them, and asking someone to retype the same numbers onto the invoice is both
 * work and an invitation to get it wrong — the invoice would then disagree
 * with payroll about the same day's labour. So the crew arrives pre-filled and
 * the user corrects it, which is the direction of travel the owner asked for:
 * the hours are editable *because* jobs run long, not because they are unknown.
 *
 * ── Approved only ─────────────────────────────────────────────────────────
 *
 * Same rule as actualJobCost above: a pending entry is a claim, not a payroll
 * liability. Seeding from claims would put an unreviewed number on an invoice.
 * Pending hours are reported separately so the panel can say the seed is short
 * rather than quietly presenting a partial figure as the job's labour.
 *
 * ── Seeded once, then never again ─────────────────────────────────────────
 *
 * Whoever calls this must only use it when the invoice has no saved costing
 * row. Re-seeding on every load would silently overwrite a corrected 6.5 with
 * the timesheet's 8 the next time the page opened — a control that appears to
 * work and doesn't.
 *
 * @param {object[]} timeEntries [{ hours, status, workerId, worker:{name,hourlyRate} }]
 */
export function crewFromTimeEntries(timeEntries = []) {
  const entries = Array.isArray(timeEntries) ? timeEntries : [];
  const byWorker = new Map();
  let pendingHours = 0;

  for (const t of entries) {
    const hours = num(t?.hours);
    if (!hours || hours <= 0) continue;
    if (t?.status !== "approved") {
      pendingHours += hours;
      continue;
    }
    const key = t?.workerId || t?.worker?.id || `unknown:${byWorker.size}`;
    const existing = byWorker.get(key);
    if (existing) {
      existing.hours = round2(existing.hours + hours);
      continue;
    }
    const rate = t?.worker?.hourlyRate;
    byWorker.set(key, {
      id: t?.workerId || null,
      name: t?.worker?.name || "Crew member",
      // Null-checked before Number(): Number(null) is 0, which would turn "we
      // don't know this person's rate" into "this person is free" — and the
      // panel flags a 0 rate, so the distinction survives on screen.
      rate:
        rate === null || rate === undefined || rate === ""
          ? 0
          : round2(num(rate)),
      hours: round2(hours),
    });
  }

  return {
    crew: [...byWorker.values()],
    approvedHours: round2(
      [...byWorker.values()].reduce((s, m) => s + m.hours, 0),
    ),
    // Not seeded, but named, so the panel can say the timesheets aren't
    // finished rather than letting the number look complete.
    pendingHours: round2(pendingHours),
  };
}
