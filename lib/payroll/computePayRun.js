// lib/payroll/computePayRun.js
//
// The payroll arithmetic. Pure — no I/O, no Prisma, no dates from the system
// clock — so it can be unit-tested against hostile input, which is the only
// responsible way to ship code that decides what someone gets paid.
//
// ── What this calculates, and what it deliberately does not ─────────────────
//
// CALCULATES: gross pay from data FieldQuo owns and can be right about —
// approved hours split into regular/overtime, hourly rate, salary divided over
// the period, plus adjustments a human typed in.
//
// DOES NOT CALCULATE: statutory deductions. No CPP/EI tables, no FICA
// percentages, no PAYE/NI bands. Those change every year in every jurisdiction
// (and mid-year in some), employer contributions differ from employee ones, and
// a wrong withholding bills the EMPLOYER for the penalty. Hand-rolled tax
// tables would be the single most dangerous code in this product.
//
// Instead: deductions are supplied per worker (a fixed amount or a percentage
// the company's accountant gave them), FieldQuo does the arithmetic, and the
// payslip labels them as supplied rather than computed. That's an honest
// division of responsibility — we're right about the maths, they own the rates.
//
// Region only selects LABELS (CPP/EI vs FICA vs NI) so a payslip reads
// correctly to its reader. It never implies FieldQuo calculated or remitted.

const OVERTIME_MULTIPLIER = 1.5;

// Weekly hours after which time counts as overtime. 40 is the common default in
// Canada (varies by province: 40 ON/AB, 40 BC) and the US federal FLSA rule.
// Overridable per run because a company on a provincial 44-hour threshold must
// not be silently paid at 40.
const DEFAULT_OT_THRESHOLD_WEEKLY = 40;

export const PAY_FREQUENCIES = {
  weekly: { label: "Weekly", perYear: 52 },
  biweekly: { label: "Every 2 weeks", perYear: 26 },
  semimonthly: { label: "Twice a month", perYear: 24 },
  monthly: { label: "Monthly", perYear: 12 },
};

// Deduction labels per region. Labels ONLY — see the header.
export const REGION_LABELS = {
  CA: { statutory: ["Income tax", "CPP", "EI"], slipName: "T4-style payslip" },
  US: { statutory: ["Federal income tax", "Social Security", "Medicare"], slipName: "W-2-style payslip" },
  UK: { statutory: ["PAYE income tax", "National Insurance"], slipName: "UK payslip" },
};

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Money rounding, to the cent, half-up. Payroll cannot use floating point
// output directly: 0.1 + 0.2 problems become a payslip that's a penny out and
// a bookkeeper who doesn't trust the system.
function money(n) {
  const v = num(n);
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function hours(n) {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Split total hours into regular and overtime.
 *
 * `weeks` matters: a two-week period with a 40-hour weekly threshold allows 80
 * regular hours, not 40. Passing the wrong number of weeks is how a fortnightly
 * run pays half the period at time-and-a-half.
 */
export function splitOvertime(totalHours, { weeks = 1, thresholdWeekly = DEFAULT_OT_THRESHOLD_WEEKLY } = {}) {
  const total = Math.max(0, hours(totalHours));
  const cap = Math.max(0, num(thresholdWeekly)) * Math.max(1, num(weeks, 1));
  const regular = Math.min(total, cap);
  return { regularHours: hours(regular), overtimeHours: hours(total - regular) };
}

/**
 * One worker's pay line.
 *
 * @param {object} p
 * @param {object} p.worker        { id, name, type, hourlyRate }
 * @param {number} p.totalHours    approved hours in the period
 * @param {number} [p.weeks]       weeks in the period (overtime cap)
 * @param {number} [p.otThresholdWeekly]
 * @param {number} [p.salaryPerPeriod]  for salaried workers, already divided
 * @param {Array}  [p.adjustments] [{ label, amount, kind: "earning"|"deduction" }]
 * @param {Array}  [p.deductions]  [{ label, amount } | { label, percent }] — supplied, not computed
 */
export function computeWorkerLine({
  // `= {}` does NOT catch an explicit null, and a null worker reaching payroll
  // arithmetic must degrade to a zero line rather than throw mid-run.
  worker: workerArg,
  totalHours = 0,
  weeks = 1,
  otThresholdWeekly = DEFAULT_OT_THRESHOLD_WEEKLY,
  salaryPerPeriod = 0,
  adjustments = [],
  deductions = [],
} = {}) {
  const worker = workerArg || {};
  const rate = Math.max(0, num(worker.hourlyRate));
  const { regularHours, overtimeHours } = splitOvertime(totalHours, {
    weeks,
    thresholdWeekly: otThresholdWeekly,
  });

  const items = [];
  let gross = 0;

  // Hourly earnings
  if (rate > 0 && regularHours > 0) {
    const amount = money(regularHours * rate);
    items.push({ label: `Regular hours (${regularHours} × ${rate})`, amount, kind: "earning", source: "hours" });
    gross += amount;
  }
  if (rate > 0 && overtimeHours > 0) {
    const otRate = money(rate * OVERTIME_MULTIPLIER);
    const amount = money(overtimeHours * otRate);
    items.push({ label: `Overtime (${overtimeHours} × ${otRate})`, amount, kind: "earning", source: "hours" });
    gross += amount;
  }

  // Salary for the period (a worker can be salaried AND log hours for costing;
  // only pay the salary — paying both would double-pay them).
  const salary = Math.max(0, num(salaryPerPeriod));
  if (salary > 0) {
    items.push({ label: "Salary", amount: money(salary), kind: "earning", source: "salary" });
    gross += money(salary);
  }

  // Manual adjustments. Earnings add to gross; deductions are handled below so
  // they can't accidentally inflate gross.
  const manualDeductions = [];
  for (const a of Array.isArray(adjustments) ? adjustments : []) {
    const amount = money(Math.abs(num(a?.amount)));
    if (!amount || !a?.label) continue;
    if (a.kind === "deduction") {
      manualDeductions.push({ label: String(a.label), amount });
    } else {
      items.push({ label: String(a.label), amount, kind: "earning", source: "manual" });
      gross += amount;
    }
  }

  gross = money(gross);

  // Deductions. Percentages resolve against GROSS — after all earnings are
  // known, never against a running subtotal, so order of entry can't change
  // someone's take-home.
  let deductionTotal = 0;
  const allDeductions = [
    ...(Array.isArray(deductions) ? deductions : []),
    ...manualDeductions,
  ];
  for (const d of allDeductions) {
    if (!d?.label) continue;
    let amount;
    if (d.percent != null) {
      const pctRaw = num(d.percent);
      // Cap at 100%: a typo of 1500 must not produce a negative payslip.
      const pct = Math.min(100, Math.max(0, pctRaw));
      amount = money((gross * pct) / 100);
      items.push({ label: `${d.label} (${pct}%)`, amount, kind: "deduction", source: "supplied" });
    } else {
      amount = money(Math.abs(num(d.amount)));
      if (!amount) continue;
      items.push({ label: String(d.label), amount, kind: "deduction", source: "supplied" });
    }
    deductionTotal += amount;
  }
  deductionTotal = money(deductionTotal);

  // Never produce a negative payslip. If supplied deductions exceed gross,
  // clamp and flag it — that's a data-entry error a human must see, not a
  // number to quietly pay out.
  let net = money(gross - deductionTotal);
  const overDeducted = net < 0;
  if (overDeducted) {
    net = 0;
  }

  return {
    workerId: worker.id || null,
    workerName: worker.name || "Worker",
    workerType: worker.type || "contractor",
    hourlyRate: rate || null,
    regularHours,
    overtimeHours,
    items,
    gross,
    deductions: deductionTotal,
    net,
    // Surfaced so the UI can refuse to approve a run containing one.
    overDeducted,
  };
}

/**
 * A whole run. Returns lines plus totals, all rounded consistently.
 */
export function computePayRun({ workers = [], region = "CA", weeks = 1, otThresholdWeekly } = {}) {
  const lines = workers.map((w) =>
    computeWorkerLine({
      ...w,
      weeks,
      ...(otThresholdWeekly != null ? { otThresholdWeekly } : {}),
    }),
  );

  const grossTotal = money(lines.reduce((s, l) => s + l.gross, 0));
  const deductionTotal = money(lines.reduce((s, l) => s + l.deductions, 0));
  const netTotal = money(lines.reduce((s, l) => s + l.net, 0));

  return {
    region: REGION_LABELS[region] ? region : "CA",
    lines,
    grossTotal,
    deductionTotal,
    netTotal,
    // Any line a human has to look at before this run can be approved.
    warnings: lines.filter((l) => l.overDeducted).map((l) => ({
      workerName: l.workerName,
      message: "Deductions exceed gross pay — check the amounts.",
    })),
  };
}

/** Weeks in a period, for the overtime cap. Pure; takes explicit dates. */
export function weeksBetween(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  return Math.max(1, days / 7);
}
