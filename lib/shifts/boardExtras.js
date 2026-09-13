// lib/shifts/boardExtras.js
//
// What GET /api/shifts returns BESIDE the shifts for the three things built
// on 2026-09-13 — the labour-cost line, the attendance chips and the holiday
// band — plus what the worker's own schedule screen needs (who else is on
// the job). A module of its own so the route's two branches each gain one
// spread and nothing else: that file is edited by more than one hand and a
// small hunk survives a merge where a large one does not.
//
// Every read is company-scoped. The rates leave the server ONLY for a caller
// canSeeAllPay says may see other people's pay (lib/permissions/enforce.js)
// — the same gate the timesheet and the Workers tab already stand behind —
// and a caller without it gets hours, never money, and `payVisible: false`
// so the screen can say why the line is absent rather than print zero.

import { db } from "@/lib/db";
import { canSeeAllPay, loadEnforceableMember } from "@/lib/permissions/enforce";
import { DEFAULT_OT_THRESHOLD_WEEKLY } from "@/lib/payroll/computePayRun";
import { effectiveHolidayRegion, resolveLeaveRules } from "@/lib/leave/rules";
import { holidaysBetween } from "@/lib/leave/statutoryHolidays";

/** ISO calendar day of an instant in a zone. */
function ymdIn(instant, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
  } catch {
    return new Date(instant).toISOString().slice(0, 10);
  }
}

/**
 * The company's statutory holidays and blackout ranges touching a range, in
 * the shape the board and the time-off Team view both draw:
 * [{ date, observed, name, key }] and [{ from, to, label }].
 */
export async function calendarMarks(companyId, from, to) {
  if (!from || !to || isNaN(from) || isNaN(to)) return { holidays: [], blackouts: [], holidayRegion: null };
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { country: true, province: true, leaveRules: true },
  });
  const rules = resolveLeaveRules(company?.leaveRules);
  const region = effectiveHolidayRegion(rules, company);
  const holidays = region.country ? holidaysBetween({ ...region, from, to }) : [];
  const lo = new Date(from).toISOString().slice(0, 10);
  const hi = new Date(to).toISOString().slice(0, 10);
  const blackouts = rules.blackouts.filter((b) => b.from <= hi && b.to >= lo);
  return { holidays, blackouts, holidayRegion: region.country ? region : null };
}

/**
 * The manager branch's extras.
 *
 * @param {object} p
 * @param {object} p.member       from memberOrRefusal
 * @param {Array}  p.workers      the active workers already loaded
 * @param {Array}  p.shifts       the shifts already loaded for the range
 * @param {Date|null} p.fromDate
 * @param {Date|null} p.toDate
 * @param {URLSearchParams} p.searchParams  `weekFrom` / `weekTo` for the week's hours
 */
export async function managerExtras({ member, workers, shifts, fromDate, toDate, searchParams }) {
  const companyId = member.companyId;
  const weekFrom = searchParams?.get("weekFrom") ? new Date(searchParams.get("weekFrom")) : null;
  const weekTo = searchParams?.get("weekTo") ? new Date(searchParams.get("weekTo")) : null;
  const weekOk = weekFrom && weekTo && !isNaN(weekFrom) && !isNaN(weekTo) && weekTo > weekFrom;
  const shiftIds = (shifts || []).map((s) => s.id);

  const [full, weekShifts, attendanceRows, marks, self] = await Promise.all([
    loadEnforceableMember(db, member.id),
    // Every shift of the week, draft or not — the cost is shown BEFORE
    // publishing, which is the point. Minimal shape: the arithmetic
    // (lib/shifts/labourCost.js) needs times and unpaid breaks, nothing else.
    weekOk
      ? db.shift.findMany({
          where: { companyId, start: { lte: weekTo }, end: { gte: weekFrom } },
          select: {
            id: true,
            workerId: true,
            start: true,
            end: true,
            published: true,
            breaks: { select: { start: true, end: true, paid: true } },
          },
        })
      : [],
    shiftIds.length
      ? db.shiftAttendance.findMany({
          where: { companyId, shiftId: { in: shiftIds } },
          select: { shiftId: true, status: true, final: true, lateMinutes: true, earlyMinutes: true, firstPunchAt: true },
        })
      : [],
    calendarMarks(companyId, fromDate, toDate),
    // The caller's own worker row, so a manager opening My schedule can find
    // their own shifts in the company-wide list.
    member.userId
      ? db.worker.findFirst({ where: { companyId, userId: member.userId }, select: { id: true, name: true, title: true } })
      : null,
  ]);

  const payVisible = canSeeAllPay(full);
  let rates = null;
  if (payVisible) {
    const rows = await db.worker.findMany({
      where: { companyId, id: { in: (workers || []).map((w) => w.id) } },
      select: { id: true, hourlyRate: true },
    });
    rates = {};
    for (const r of rows) rates[r.id] = r.hourlyRate == null ? null : Number(r.hourlyRate);
  }

  return {
    self,
    weekShifts,
    attendance: attendanceRows,
    payVisible,
    rates,
    // The threshold payroll splits overtime at when a run does not override
    // it (lib/payroll/computePayRun.js). Stated in the payload so the screen
    // can say "over 40 h" rather than "overtime" and be checked against the
    // number a pay run will actually use.
    otThresholdWeekly: DEFAULT_OT_THRESHOLD_WEEKLY,
    ...marks,
  };
}

/**
 * The worker branch's extras: who else is on the same job that day for each
 * of their shifts (names only — a crew member on the Dubois kitchen may
 * know who is there with them; nothing else about the colleague travels),
 * and the same holidays the board bands.
 */
export async function workerExtras({ companyId, worker, shifts, fromDate, toDate }) {
  const withJob = (shifts || []).filter((s) => s.job?.id || s.jobId);
  let coworkers = {};
  if (withJob.length) {
    const company = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
    const tz = company?.timezone || "America/Toronto";
    const jobIds = [...new Set(withJob.map((s) => s.job?.id || s.jobId))];
    const lo = new Date(Math.min(...withJob.map((s) => new Date(s.start).getTime())) - 36 * 3_600_000);
    const hi = new Date(Math.max(...withJob.map((s) => new Date(s.end).getTime())) + 36 * 3_600_000);
    const others = await db.shift.findMany({
      where: {
        companyId,
        published: true,
        jobId: { in: jobIds },
        workerId: { not: worker.id },
        start: { lte: hi },
        end: { gte: lo },
      },
      select: { jobId: true, start: true, worker: { select: { name: true } } },
    });
    for (const s of withJob) {
      const jobId = s.job?.id || s.jobId;
      const day = ymdIn(s.start, tz);
      const names = [
        ...new Set(
          others
            .filter((o) => o.jobId === jobId && o.worker?.name && ymdIn(o.start, tz) === day)
            .map((o) => o.worker.name),
        ),
      ].sort();
      if (names.length) coworkers[s.id] = names;
    }
  }
  const marks = await calendarMarks(companyId, fromDate, toDate);
  return { coworkers, holidays: marks.holidays };
}
