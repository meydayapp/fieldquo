// lib/payroll/buildPayRun.js
//
// Assembles a pay run from real data, then hands the arithmetic to the pure
// engine in computePayRun.js. This file does the I/O; that file does the maths.
// Keeping them apart is what makes the maths testable.
//
// ── Only APPROVED time is paid ──────────────────────────────────────────────
//
// Pending time is someone's unverified claim. Paying it would make approval
// decorative and turn every timesheet dispute into a clawback. Rejected time
// obviously isn't paid. So the query filters to `approved` and the UI says how
// many pending hours were left out — silence there would look like missing pay.
//
// ── FieldQuo does not pay anyone ────────────────────────────────────────────
//
// The output is "here is what you owe each person". The company pays through
// its own bank or payroll provider. Nothing in here moves money, and the run's
// `paid` state records a human confirming they paid it elsewhere.
//
// ── Paid leave is an earning, not missing hours ──────────────────────────────
//
// Someone on holiday clocks no time, so without this they'd appear as a week of
// zero hours and get paid nothing — for leave the company already agreed to pay.
// Approved paid leave overlapping the period is added as a named earning line,
// priced at days × their own hours-per-working-day × rate, so the payslip shows
// "Vacation — 5 days" rather than an unexplained adjustment.

import { db } from "@/lib/db";
import { computePayRun, weeksBetween, PAY_FREQUENCIES } from "./computePayRun";
import { paidLeaveForPeriod } from "@/lib/leave/balances";
import { leaveEarning } from "@/lib/leave/accrual";

/**
 * A worker's effective wage rate for payroll.
 *
 * Their own Worker.hourlyRate when it's set, else the labour cost recorded
 * against their Member (laborCostByUser: userId → cost). This exists because
 * the New-User / edit-member screen writes Member.laborCostPerHour and never
 * Worker.hourlyRate — so a rate set there reached job costing but never a
 * payslip, and someone showed up on a pay run at $0.
 *
 * READ-side only: it never writes, so it can't clobber an explicit hourlyRate,
 * and it deliberately ignores overhead salaries (workerId:null), which the
 * overhead screen defines as business costs, not pay.
 *
 * @returns a finite rate, or null when neither source has one (a $0 wage line
 *          would be a silent wrong number; null lets the caller flag it).
 */
export function effectiveWageRate(worker, laborCostByUser) {
  if (worker?.hourlyRate != null) {
    const own = Number(worker.hourlyRate);
    return Number.isFinite(own) ? own : null;
  }
  const fromMember = worker?.userId ? laborCostByUser?.get?.(worker.userId) : undefined;
  return fromMember != null && Number.isFinite(Number(fromMember)) ? Number(fromMember) : null;
}


/**
 * Gather everything needed for a period and compute it.
 *
 * @returns { lines, grossTotal, deductionTotal, netTotal, warnings, meta }
 */
export async function buildPayRun({
  companyId,
  periodStart,
  periodEnd,
  region = "CA",
  frequency = "biweekly",
  otThresholdWeekly,
  // Per-worker manual adjustments keyed by workerId:
  //   { [workerId]: [{ label, amount, kind }] }
  adjustmentsByWorker = {},
  includeWorkerIds = null,
}) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const [workers, components, members] = await Promise.all([
    db.worker.findMany({
      where: {
        companyId,
        active: true,
        ...(includeWorkerIds?.length ? { id: { in: includeWorkerIds } } : {}),
      },
      select: {
        id: true,
        userId: true,
        name: true,
        type: true,
        hourlyRate: true,
        salaries: {
          where: { active: true },
          select: { amount: true, frequency: true },
        },
        salaryComponents: {
          select: {
            amount: true,
            percent: true,
            component: {
              select: {
                name: true,
                kind: true,
                calculation: true,
                amount: true,
                percent: true,
                slabs: true,
                active: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    // Company-wide components (statutory usually) apply to everyone.
    db.salaryComponent.findMany({
      where: { companyId, active: true, appliesToAll: true },
      select: {
        name: true,
        kind: true,
        calculation: true,
        amount: true,
        percent: true,
        slabs: true,
      },
    }),
    // Members' labour cost, as a FALLBACK pay rate — see below. The New-User /
    // edit-member path writes Member.laborCostPerHour and never touches
    // Worker.hourlyRate, so a rate set there used to reach job costing but never
    // a payslip. Read here so it does.
    db.member.findMany({
      where: { companyId, laborCostPerHour: { not: null } },
      select: { userId: true, laborCostPerHour: true },
    }),
  ]);

  // userId → laborCostPerHour, to back-fill a worker with no explicit pay rate.
  const laborCostByUser = new Map(
    members.filter((m) => m.userId).map((m) => [m.userId, Number(m.laborCostPerHour)]),
  );

  const rateFor = (w) => effectiveWageRate(w, laborCostByUser);

  const workerIds = workers.map((w) => w.id);

  // Approved hours in the period, plus a count of what was left out so the UI
  // can say so rather than quietly underpaying.
  const [approved, pending] = await Promise.all([
    db.timeEntry.groupBy({
      by: ["workerId"],
      where: {
        workerId: { in: workerIds },
        status: "approved",
        clockIn: { gte: start, lte: end },
      },
      _sum: { hours: true },
    }),
    db.timeEntry.groupBy({
      by: ["workerId"],
      where: {
        workerId: { in: workerIds },
        status: "pending",
        clockIn: { gte: start, lte: end },
      },
      _sum: { hours: true },
    }),
  ]);

  const approvedHours = new Map(approved.map((r) => [r.workerId, Number(r._sum.hours || 0)]));
  const pendingHours = new Map(pending.map((r) => [r.workerId, Number(r._sum.hours || 0)]));

  // ── Hours somebody approved for themselves ─────────────────────────────
  //
  // Whether self-approval should be allowed at all is a segregation-of-duties
  // question and the owner's, not this file's — a sole trader is the only
  // person who can approve their own hours, so it is deliberately not blocked.
  // What was wrong is that the marker stopped at the Timesheets screen: the
  // pay run treated `status: "approved"` as uniform, so the one place the
  // hours turn into money never mentioned that nobody else had checked them.
  //
  // A separate read rather than folding it into the groupBy above: that sum is
  // what people are paid from, and it is not worth re-deriving in JS to save a
  // query. Failure here must not stop payroll, so it degrades to "no marker".
  const selfApprovedHours = new Map();
  const workerUserId = new Map(workers.map((w) => [w.id, w.userId]));
  const approvedRows = await db.timeEntry
    .findMany({
      where: {
        workerId: { in: workerIds },
        status: "approved",
        clockIn: { gte: start, lte: end },
        approvedById: { not: null },
      },
      select: { workerId: true, hours: true, approvedById: true },
    })
    .catch((err) => {
      console.error("[payroll] self-approval lookup failed:", err?.message);
      return [];
    });
  for (const row of approvedRows) {
    const ownUserId = workerUserId.get(row.workerId);
    if (!ownUserId || row.approvedById !== ownUserId) continue;
    selfApprovedHours.set(
      row.workerId,
      (selfApprovedHours.get(row.workerId) || 0) + Number(row.hours || 0),
    );
  }

  // Approved paid leave in this period. Wrapped: a company with no leave
  // policies set up must still be able to run payroll.
  const leaveByWorker = await paidLeaveForPeriod({
    companyId,
    periodStart: start,
    periodEnd: end,
  }).catch((err) => {
    console.error("[payroll] paid-leave lookup failed:", err?.message);
    return {};
  });

  const weeks = weeksBetween(start, end);
  const perYear = PAY_FREQUENCIES[frequency]?.perYear || 26;

  const payload = workers.map((w) => {
    // Company-wide components first, then the worker's own (which may override
    // an amount/percent for that person).
    const deductions = [];
    const adjustments = [...(adjustmentsByWorker[w.id] || [])];

    const pushComponent = (c, override = {}) => {
      if (!c || c.active === false) return;
      const amount = override.amount ?? c.amount;
      const percent = override.percent ?? c.percent;
      const entry = { label: c.name };
      if (c.calculation === "slabs" && Array.isArray(c.slabs) && c.slabs.length) {
        entry.slabs = c.slabs;
        entry.perYear = perYear;
      } else if (c.calculation === "percent" && percent != null) {
        entry.percent = Number(percent);
      } else if (amount != null) {
        entry.amount = Number(amount);
      } else {
        return;
      }
      // An "earning" component is an adjustment, not a deduction — routing it
      // to the wrong list would subtract someone's allowance from their pay.
      if (c.kind === "earning") {
        adjustments.push({ label: c.name, amount: entry.amount ?? 0, kind: "earning" });
      } else {
        deductions.push(entry);
      }
    };

    for (const c of components) pushComponent(c);
    for (const a of w.salaryComponents || []) {
      pushComponent(a.component, { amount: a.amount, percent: a.percent });
    }

    // Salary for this period, converted from however it's stored.
    const salary = (w.salaries || [])[0];
    let salaryPerPeriod = 0;
    if (salary) {
      const amount = Number(salary.amount || 0);
      const annual =
        salary.frequency === "weekly"
          ? amount * 52
          : salary.frequency === "monthly"
            ? amount * 12
            : salary.frequency === "yearly"
              ? amount
              : 0; // one_time salaries aren't a recurring wage
      salaryPerPeriod = annual > 0 ? annual / perYear : 0;
    }

    // Paid leave. Salaried people are already paid for the period, so adding an
    // earning on top would pay them twice for the same days — the leave is
    // recorded against their balance and simply not re-priced here.
    const rate = rateFor(w);
    const leave = leaveByWorker[w.id];
    if (leave?.days && !salaryPerPeriod && rate != null) {
      const amount = leaveEarning({
        paidDays: leave.days,
        hourlyRate: rate,
        // Their own working day, falling back to 8 only when no shifts are set.
        hoursPerWorkingDay: leave.hoursPerDay || 8,
      });
      if (amount > 0) {
        const labels = [...new Set(leave.entries.map((e) => e.policy))].join(", ");
        adjustments.push({
          label: `${labels} — ${leave.days} day${leave.days === 1 ? "" : "s"}`,
          amount,
          kind: "earning",
        });
      }
    }

    return {
      worker: {
        id: w.id,
        name: w.name,
        type: w.type,
        hourlyRate: rate,
      },
      totalHours: approvedHours.get(w.id) || 0,
      salaryPerPeriod,
      deductions,
      adjustments,
      perYear,
    };
  });

  const computed = computePayRun({
    workers: payload,
    region,
    weeks,
    frequency,
    ...(otThresholdWeekly != null ? { otThresholdWeekly } : {}),
  });

  // Anyone with pending time in this period, so the run can say what it excluded.
  const excluded = workers
    .map((w) => ({ workerId: w.id, name: w.name, pendingHours: pendingHours.get(w.id) || 0 }))
    .filter((x) => x.pendingHours > 0);

  return {
    ...computed,
    meta: {
      periodStart: start,
      periodEnd: end,
      weeks: Math.round(weeks * 100) / 100,
      frequency,
      region,
      workerCount: payload.length,
      // Named plainly: unapproved time is NOT in these numbers.
      excludedPendingTime: excluded,
      // And the reverse: time that IS in these numbers, approved by the person
      // who worked it. Not an error and not blocked — see the note by the
      // lookup above — but the run is where it stops being a timesheet and
      // starts being money, so it is the last place it can still be checked.
      selfApprovedTime: workers
        .map((w) => ({
          workerId: w.id,
          name: w.name,
          hours: selfApprovedHours.get(w.id) || 0,
        }))
        .filter((x) => x.hours > 0),
      // So the run can say whose pay includes leave, and how much.
      paidLeave: Object.entries(leaveByWorker).map(([workerId, l]) => ({
        workerId,
        name: workers.find((w) => w.id === workerId)?.name || null,
        days: l.days,
        policies: [...new Set(l.entries.map((e) => e.policy))],
      })),
      statutoryConfigured: components.some((c) => c.kind === "deduction"),
    },
  };
}
