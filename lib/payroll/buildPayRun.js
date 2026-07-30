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

  const [workers, components] = await Promise.all([
    db.worker.findMany({
      where: {
        companyId,
        active: true,
        ...(includeWorkerIds?.length ? { id: { in: includeWorkerIds } } : {}),
      },
      select: {
        id: true,
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
  ]);

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
    const leave = leaveByWorker[w.id];
    if (leave?.days && !salaryPerPeriod && w.hourlyRate != null) {
      const amount = leaveEarning({
        paidDays: leave.days,
        hourlyRate: Number(w.hourlyRate),
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
        hourlyRate: w.hourlyRate == null ? null : Number(w.hourlyRate),
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
