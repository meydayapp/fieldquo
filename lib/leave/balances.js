// lib/leave/balances.js
//
// The database side of leave: consuming a balance when leave is approved,
// releasing it when an approval is reversed, and topping up accruals.
//
// Kept out of the route files because three routes need it (submit with
// auto-approve, review, and the accrual refresh) and a copy-pasted version of
// balance arithmetic is exactly the kind of duplication that rots.
//
// ── Why `remaining` is never stored ─────────────────────────────────────────
//
// Only accrued / used / carried-in are columns. Remaining is computed by
// remainingBalance() every time it's shown. A stored remainder has to be kept
// in step with every request, approval, reversal and accrual, and the first
// time one of those paths forgets, the number on screen is wrong with nothing
// to reconcile it against.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { accrueForPolicy } from "@/lib/leave/accrual";
import {
  accrueFromHours,
  buildRateAt,
  openingTakenFor,
  workedHoursOfEntry,
} from "@/lib/leave/hourAccrual";

/** Money-accruing policies (percent_of_gross) and unpaid leave hold no day balance. */
function tracksDays(policy = {}) {
  return policy.paid !== false && policy.accrualMethod !== "percent_of_gross";
}

/**
 * Mark days as used. Called when a request becomes approved — never when it's
 * merely submitted, because a pending request is reserved (subtracted at read
 * time via `pendingDays`) rather than spent.
 */
export async function consumeBalance({ policy, workerId, year, days }) {
  if (!tracksDays(policy) || !days) return null;
  return db.leaveBalance.upsert({
    where: { policyId_workerId_year: { policyId: policy.id, workerId, year } },
    create: { policyId: policy.id, workerId, year, usedDays: days },
    update: { usedDays: { increment: days } },
  });
}

/**
 * Give days back — an approved request that gets cancelled.
 *
 * Clamped at zero. Going negative would mean a request was released twice, and
 * a negative `usedDays` reads as extra entitlement, which is the wrong way for
 * a bug to fail.
 */
export async function releaseBalance({ policy, workerId, year, days }) {
  if (!tracksDays(policy) || !days) return null;
  const existing = await db.leaveBalance.findUnique({
    where: { policyId_workerId_year: { policyId: policy.id, workerId, year } },
  });
  if (!existing) return null;
  const next = Math.max(0, Number(existing.usedDays) - Number(days));
  return db.leaveBalance.update({
    where: { id: existing.id },
    data: { usedDays: next },
  });
}

/**
 * Pay periods elapsed in `year` up to `asOf`, counting from `from` if the person
 * started mid-year.
 *
 * Counting from 1 January for a July hire would credit them six months they
 * weren't employed for.
 */
function periodsElapsed({ year, asOf, from, periodsPerYear }) {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);
  const yearLen = yearEnd - yearStart;

  const begin = Math.max(yearStart, from ? from.getTime() : yearStart);
  const now = Math.min(yearEnd, Math.max(begin, asOf.getTime()));
  return ((now - begin) / yearLen) * periodsPerYear;
}

/**
 * Share of the year this person is employed for — how much of an annual
 * allotment they've earned.
 *
 * Measured from their start date to YEAR END, not to today. A July hire is
 * entitled to roughly half the year's holiday from the day they arrive; a figure
 * that creeps up week by week would mean their entitlement isn't knowable until
 * December, and they couldn't book a September holiday against it.
 */
function fractionOfYearEmployed({ year, from }) {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);
  if (!from) return 1;
  const begin = Math.max(yearStart, Math.min(yearEnd, from.getTime()));
  return (yearEnd - begin) / (yearEnd - yearStart);
}

/**
 * Recompute accrued entitlement for every active worker against every active
 * policy, for one year.
 *
 * Idempotent by design — it SETS accrued rather than incrementing it, so it can
 * be run on every page load without inflating anyone's balance. `usedDays` and
 * `carriedInDays` are never touched here; those are owned by approvals and by
 * the year-end roll respectively.
 *
 * @param periodsPerYear  the company's pay frequency, for per_period policies
 * @param maxAgeMs        skip if the newest balance was written more recently.
 *                        A ten-person crew on four policies is forty upserts;
 *                        doing that on every page load hammers Neon for numbers
 *                        that move once a fortnight. Pass 0 to force.
 */
export async function refreshAccruals({
  companyId,
  year,
  asOf,
  periodsPerYear = 26,
  maxAgeMs = 6 * 60 * 60 * 1000,
} = {}) {
  if (!companyId || !year) return { updated: 0 };

  const [policies, workers] = await Promise.all([
    // Not the unpaid fallback (lib/leave/unpaidFallback.js): it keeps no
    // balance, and a card for it beside the company's own would read as a
    // policy the owner set up.
    db.leavePolicy.findMany({ where: { companyId, active: true, systemUnpaid: false } }),
    db.worker.findMany({
      where: { companyId, active: true },
      // hiredOn, deliberately NOT createdAt — see the field comment in the
      // schema. createdAt is when the row appeared, which for a backfilled
      // worker is today, and pro-rating on it would gut a long-serving
      // employee's entitlement.
      select: { id: true, hiredOn: true, userId: true },
    }),
  ]);
  if (!policies.length || !workers.length) return { updated: 0 };

  if (maxAgeMs > 0) {
    // Freshness is judged on the OLDEST row, not the newest: approving leave
    // touches one balance, and using that as the signal would mask every other
    // balance going stale. The count check catches a new policy or a new hire,
    // whose rows don't exist yet — an age check alone would skip them and the
    // new policy would show a permanent zero.
    const expected = policies.length * workers.length;
    const [actual, oldest] = await Promise.all([
      db.leaveBalance.count({ where: { year, policy: { companyId } } }),
      db.leaveBalance.findFirst({
        where: { year, policy: { companyId } },
        orderBy: { updatedAt: "asc" },
        select: { updatedAt: true },
      }),
    ]);
    if (
      actual >= expected &&
      oldest &&
      Date.now() - oldest.updatedAt.getTime() < maxAgeMs
    ) {
      return { updated: 0, skipped: "fresh" };
    }
  }

  const at = asOf instanceof Date ? asOf : new Date();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const workerIds = workers.map((w) => w.id);

  // Year-to-date gross per worker, needed only if a percent_of_gross policy
  // exists. Skipped otherwise — most companies have none, and this is the only
  // query here that scans payroll.
  let grossByWorker = {};
  if (policies.some((p) => p.accrualMethod === "percent_of_gross")) {
    const lines = await db.payRunLine.groupBy({
      by: ["workerId"],
      where: {
        payRun: {
          companyId,
          status: { in: ["approved", "paid"] },
          periodStart: { gte: yearStart },
          periodEnd: { lt: yearEnd },
        },
      },
      _sum: { gross: true },
    });
    grossByWorker = lines.reduce((acc, l) => {
      acc[l.workerId] = Number(l._sum.gross || 0);
      return acc;
    }, {});
  }

  // ── The opening balance — newest row per person wins ────────────────────
  //
  // LeaveOpeningBalance is append-only; the older rows are the audit trail.
  // Read for every policy (leave taken before FieldQuo comes off any paid
  // balance), and for per_hours_worked also the hours worked before FieldQuo.
  const openingRows = await db.leaveOpeningBalance.findMany({
    where: { companyId, year, workerId: { in: workerIds } },
    orderBy: { createdAt: "desc" },
    select: { workerId: true, hoursWorked: true, throughDate: true, taken: true },
  });
  const openingByWorker = {};
  for (const o of openingRows) if (!openingByWorker[o.workerId]) openingByWorker[o.workerId] = o;

  // ── Hours worked, for per_hours_worked policies ─────────────────────────
  //
  // APPROVED entries in the calendar year (UTC, like the rest of leave), every
  // activity, through workedHoursOfEntry — see lib/leave/hourAccrual.js for
  // why an unpaid drive still counts as worked. Loaded only when such a policy
  // exists, so a company on fixed days pays nothing for this.
  const hourPolicies = policies.filter((p) => p.accrualMethod === "per_hours_worked");
  const entriesByWorker = {};
  const overridesByKey = {};
  const shiftsByUser = {};
  if (hourPolicies.length) {
    const userIds = workers.map((w) => w.userId).filter(Boolean);
    const [entries, overrides, shifts] = await Promise.all([
      db.timeEntry.findMany({
        where: {
          workerId: { in: workerIds },
          status: "approved",
          clockIn: { gte: yearStart, lt: yearEnd },
        },
        select: {
          workerId: true,
          clockIn: true,
          clockOut: true,
          hours: true,
          paid: true,
          breaks: { select: { start: true, end: true, paid: true } },
        },
      }),
      db.leaveAccrualOverride.findMany({
        where: { companyId, workerId: { in: workerIds } },
        select: {
          workerId: true,
          policyId: true,
          effectiveFrom: true,
          hoursEarned: true,
          perHoursWorked: true,
          createdAt: true,
        },
      }),
      userIds.length
        ? db.workingHours.findMany({
            where: { companyId, userId: { in: userIds } },
            select: { userId: true, startTime: true, endTime: true },
          })
        : [],
    ]);
    for (const e of entries) {
      (entriesByWorker[e.workerId] ||= []).push({ at: e.clockIn, hours: workedHoursOfEntry(e) });
    }
    for (const o of overrides) (overridesByKey[`${o.workerId}|${o.policyId}`] ||= []).push(o);
    for (const r of shifts) (shiftsByUser[r.userId] ||= []).push(r);
  }

  let updated = 0;
  for (const policy of policies) {
    for (const worker of workers) {
      const opening = openingByWorker[worker.id] || null;
      const openingUsedDays = openingTakenFor(opening, policy.id);

      let accruedDays = 0;
      let accruedAmount = 0;
      let accruedHours = 0;
      let accrualBasis = null;

      if (policy.accrualMethod === "per_hours_worked") {
        // A day off is the person's own working day when their shifts say
        // what it is, else the length the policy states. Never an invented 8.
        const ownDay = worker.userId ? hoursPerWorkingDay(shiftsByUser[worker.userId] || []) : null;
        const policyDay = Number(policy.hoursPerDay) > 0 ? Number(policy.hoursPerDay) : null;
        const hoursPerDay = ownDay ?? policyDay;
        const result = accrueFromHours({
          entries: entriesByWorker[worker.id] || [],
          opening,
          rateAt: buildRateAt({
            policy,
            overrides: overridesByKey[`${worker.id}|${policy.id}`] || [],
          }),
          capHours: policy.accrualYearlyCapHours == null ? null : Number(policy.accrualYearlyCapHours),
          hoursPerDay,
          year,
        });
        accruedHours = result.accruedHours;
        // Null only when neither the person nor the policy says how long a
        // day is (a policy saved before the route required it). Zero days,
        // with the basis saying why, rather than days at a guessed length.
        accruedDays = result.accruedDays ?? 0;
        accrualBasis = {
          ...result.basis,
          hoursPerDaySource: ownDay != null ? "working_hours" : policyDay != null ? "policy" : null,
          calculatedAt: at.toISOString(),
        };
      } else {
        // Someone who started in September hasn't earned a full year of holiday —
        // but only if we KNOW they started in September. With no hire date on
        // record we grant the full allotment: absence of a start date is not a
        // statement that they started today, and guessing would quietly cut a
        // long-serving employee's entitlement.
        const startedThisYear =
          worker.hiredOn && worker.hiredOn.getUTCFullYear() === year;
        const from = startedThisYear ? worker.hiredOn : null;

        ({ accruedDays, accruedAmount } = accrueForPolicy({
          policy,
          periodsElapsed: periodsElapsed({ year, asOf: at, from, periodsPerYear }),
          periodsPerYear,
          grossEarnedYtd: grossByWorker[worker.id] || 0,
          fractionOfYearEmployed: fractionOfYearEmployed({ year, from }),
          proRate: Boolean(from),
        }));
      }

      // accrualBasis is written as SQL NULL (Prisma.DbNull) for the day-based methods —
      // Prisma refuses a bare `null` on a Json column, and an old basis left
      // behind after a policy switched method would explain a number it no
      // longer produced.
      const data = {
        accruedDays,
        accruedAmount,
        accruedHours,
        openingUsedDays,
        accrualBasis: accrualBasis ?? Prisma.DbNull,
      };
      await db.leaveBalance.upsert({
        where: {
          policyId_workerId_year: { policyId: policy.id, workerId: worker.id, year },
        },
        create: { policyId: policy.id, workerId: worker.id, year, ...data },
        update: data,
      });
      updated += 1;
    }
  }
  return { updated };
}

/**
 * Roll unused days into the following year, capped by policy.
 *
 * Not called automatically — a year-end roll that runs itself on the first page
 * load of January is the kind of silent, unrepeatable mutation that's very hard
 * to explain to a company later. It's exposed so the settings screen can offer
 * it as a deliberate action.
 */
export async function rollYear({ companyId, fromYear }) {
  const { carryoverDays, remainingBalance } = await import("@/lib/leave/accrual");
  const balances = await db.leaveBalance.findMany({
    where: { year: fromYear, policy: { companyId } },
    include: { policy: true },
  });

  let rolled = 0;
  for (const b of balances) {
    if (b.policy.accrualMethod === "percent_of_gross") continue;
    const { remainingDays } = remainingBalance(b);
    const carry = carryoverDays(remainingDays, b.policy);
    if (!carry) continue;
    await db.leaveBalance.upsert({
      where: {
        policyId_workerId_year: {
          policyId: b.policyId,
          workerId: b.workerId,
          year: fromYear + 1,
        },
      },
      create: {
        policyId: b.policyId,
        workerId: b.workerId,
        year: fromYear + 1,
        carriedInDays: carry,
      },
      update: { carriedInDays: carry },
    });
    rolled += 1;
  }
  return { rolled };
}

/** Minutes since midnight for "08:30". Returns null on anything unparseable. */
function minutesOfDay(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/**
 * A person's average hours per scheduled working day, from their shifts.
 *
 * Someone on four 10-hour days loses 10 hours when they take a day off, not 8 —
 * paying 8 would quietly short them a quarter of the day. Returns null when
 * nothing is configured, so the caller decides the fallback rather than
 * inheriting an invented one.
 */
export function hoursPerWorkingDay(rows = []) {
  const spans = rows
    .map((r) => {
      const a = minutesOfDay(r.startTime);
      const b = minutesOfDay(r.endTime);
      if (a == null || b == null || b <= a) return null;
      return (b - a) / 60;
    })
    .filter((h) => h != null);
  if (!spans.length) return null;
  return Math.round((spans.reduce((s, h) => s + h, 0) / spans.length) * 100) / 100;
}

/**
 * Approved PAID leave overlapping a pay period, per worker — so paid leave
 * reaches payroll as an earning instead of showing up as a week of missing
 * hours.
 *
 * A request spanning the period boundary is counted by its working days INSIDE
 * the window, not all-or-nothing: a two-week holiday straddling two runs must
 * not be paid twice, nor dropped from both.
 */
export async function paidLeaveForPeriod({ companyId, periodStart, periodEnd }) {
  const { countWorkingDays } = await import("@/lib/leave/accrual");
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const requests = await db.leaveRequest.findMany({
    where: {
      companyId,
      status: "approved",
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: {
      policy: { select: { name: true, paid: true, accrualMethod: true, hoursPerDay: true } },
      worker: { select: { id: true, userId: true } },
    },
  });
  if (!requests.length) return {};

  // One query for every shift row involved, rather than one per request — a
  // fortnight of a ten-person crew is otherwise dozens of round trips to Neon.
  const userIds = [...new Set(requests.map((r) => r.worker.userId).filter(Boolean))];
  const shiftRows = userIds.length
    ? await db.workingHours.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, dayOfWeek: true, startTime: true, endTime: true },
      })
    : [];
  const shiftsByUser = shiftRows.reduce((acc, r) => {
    (acc[r.userId] = acc[r.userId] || []).push(r);
    return acc;
  }, {});

  const byWorker = {};
  for (const r of requests) {
    if (r.policy.paid === false) continue;

    // Clip to the period, then recount working days in the clipped window.
    const from = r.startDate > start ? r.startDate : start;
    const to = r.endDate < end ? r.endDate : end;

    const shifts = shiftsByUser[r.worker.userId] || [];
    let days = countWorkingDays(from, to, {
      workingDays: shifts.map((x) => x.dayOfWeek),
    });
    // A half day stays a half day however it's clipped.
    if (r.halfDay && days === 1) days = 0.5;
    if (!days) continue;

    // The person's own working day when their shifts say it; else the day
    // length an hours-based policy states (the same figure its earned hours
    // were turned into days with, so a day earned is a day paid). Null leaves
    // the pay run's long-standing fallback in charge for the day-based
    // policies, which never stated one.
    const policyDay = Number(r.policy.hoursPerDay) > 0 ? Number(r.policy.hoursPerDay) : null;
    byWorker[r.worker.id] = byWorker[r.worker.id] || {
      days: 0,
      hoursPerDay: hoursPerWorkingDay(shifts) ?? policyDay,
      entries: [],
    };
    if (byWorker[r.worker.id].hoursPerDay == null && policyDay != null) {
      byWorker[r.worker.id].hoursPerDay = policyDay;
    }
    byWorker[r.worker.id].days += days;
    byWorker[r.worker.id].entries.push({
      requestId: r.id,
      policy: r.policy.name,
      days,
    });
  }
  return byWorker;
}
