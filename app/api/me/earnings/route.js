// app/api/me/earnings/route.js
//
// The Earnings tab: the caller's own hours per pay period, the unpaid break
// minutes that came off them, and — only when lib/payroll/ownPayGate.js
// says they may see their own pay — a GROSS estimate at their rate with
// overtime split by lib/payroll/computePayRun.js's splitOvertime. Nothing
// here is a payslip: deductions are supplied per run by the company, and
// the payslips themselves come from /api/payroll/my-payslips once a run is
// approved. ?period=0 is the current period, 1 the one before, and so on.
//
// Scoped by identity, like my-payslips: the Worker row is resolved from
// the session and there is no parameter that names anybody else.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { canSeeOwnPay } from "@/lib/payroll/ownPayGate";
import { resolvePayCycle, payPeriodFor, isoDay, describePayCycle } from "@/lib/payroll/payCycle";
import { splitOvertime, weeksBetween } from "@/lib/payroll/computePayRun";
import { entryHours, unpaidBreakMs } from "@/lib/timeclock/entryHours";

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const DAY = 86_400_000;
const endOfDay = (d) => new Date(new Date(d).getTime() + DAY - 1);

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [full, company, worker] = await Promise.all([
    loadEnforceableMember(db, member.id),
    db.company.findUnique({ where: { id: member.companyId }, select: { payCycle: true, currency: true } }),
    db.worker.findFirst({
      where: { companyId: member.companyId, userId: member.userId },
      select: { id: true, name: true, type: true, hourlyRate: true },
    }),
  ]);
  const seesPay = canSeeOwnPay(full);
  if (!worker) return NextResponse.json({ worker: null, seesPay, periods: [] });

  const cycle = resolvePayCycle(company?.payCycle);
  const back = Math.max(0, Math.min(12, Number(new URL(request.url).searchParams.get("period")) || 0));
  // Walk back `back` periods from today by stepping to the day before each start.
  let period = payPeriodFor(new Date(), cycle);
  for (let i = 0; i < back && period; i++) period = payPeriodFor(new Date(period.start.getTime() - DAY), cycle);
  if (!period) return NextResponse.json({ error: "Couldn't work out the pay period." }, { status: 500 });

  const now = new Date();
  const entries = await db.timeEntry.findMany({
    where: { workerId: worker.id, clockIn: { gte: period.start, lte: endOfDay(period.end) } },
    orderBy: { clockIn: "asc" },
    select: {
      id: true, clockIn: true, clockOut: true, hours: true, status: true,
      job: { select: { id: true, title: true, client: { select: { name: true } } } },
      breaks: { select: { start: true, end: true, kind: true, paid: true }, orderBy: { start: "asc" } },
    },
  });

  let approvedHours = 0;
  let pendingHours = 0;
  let unpaidBreakMinutes = 0;
  const days = {};
  for (const e of entries) {
    const hours = e.clockOut ? round2(e.hours ?? entryHours(e.clockIn, e.clockOut, e.breaks)) : round2(entryHours(e.clockIn, now, e.breaks));
    const breakMin = Math.round(unpaidBreakMs(e.breaks, e.clockIn, e.clockOut || now) / 60_000);
    unpaidBreakMinutes += breakMin;
    if (e.status === "approved") approvedHours += hours;
    else if (e.status !== "rejected") pendingHours += hours;
    const key = isoDay(new Date(e.clockIn));
    (days[key] ||= { date: key, entries: [], hours: 0 }).entries.push({
      id: e.id,
      clockIn: e.clockIn,
      clockOut: e.clockOut,
      hours,
      status: e.status,
      unpaidBreakMinutes: breakMin,
      job: e.job ? { id: e.job.id, title: e.job.title, client: e.job.client?.name || null } : null,
    });
    days[key].hours = round2(days[key].hours + hours);
  }
  const totalHours = round2(approvedHours + pendingHours);
  const weeks = weeksBetween(isoDay(period.start), isoDay(period.end));
  const split = splitOvertime(totalHours, { weeks });
  const rate = worker.hourlyRate == null ? null : Number(worker.hourlyRate);
  // Time-and-a-half, the same multiplier lib/payroll/computePayRun.js pays
  // (OVERTIME_MULTIPLIER there). Read from that module once it exports the
  // constant — a parallel change is doing so — rather than restated here
  // forever; until then the two are the same number by inspection.
  const OT = 1.5;

  // A payslip for this exact period, once a run exists.
  const line = await db.payRunLine.findFirst({
    where: {
      workerId: worker.id,
      payRun: { companyId: member.companyId, status: { in: ["approved", "paid"] }, periodStart: { lte: endOfDay(period.start) }, periodEnd: { gte: period.start } },
    },
    select: { id: true, payRun: { select: { id: true, status: true, periodStart: true, periodEnd: true } } },
  });

  return NextResponse.json({
    worker: { id: worker.id, name: worker.name, type: worker.type },
    seesPay,
    cycle: { ...cycle, description: describePayCycle(cycle) },
    period: {
      index: back,
      start: isoDay(period.start),
      end: isoDay(period.end),
      payDate: isoDay(period.payDate),
      frequency: period.frequency,
      alignsToWeeks: period.alignsToWeeks,
    },
    hours: {
      approved: round2(approvedHours),
      pending: round2(pendingHours),
      total: totalHours,
      regular: split.regularHours,
      overtime: split.overtimeHours,
      unpaidBreakMinutes,
    },
    // Present only when they may see pay. Null inside when there is no rate
    // — "we can't work this out" is a true statement; $0 is a false one.
    ...(seesPay
      ? {
          estimate:
            rate == null
              ? null
              : {
                  currency: company?.currency || null,
                  hourlyRate: rate,
                  regular: round2(split.regularHours * rate),
                  overtime: round2(split.overtimeHours * rate * OT),
                  gross: round2(split.regularHours * rate + split.overtimeHours * rate * OT),
                  basis: "gross",
                },
        }
      : {}),
    days: Object.values(days).sort((a, b) => (a.date < b.date ? 1 : -1)),
    payslip: line ? { lineId: line.id, runId: line.payRun.id, status: line.payRun.status, href: `/app/payroll/${line.payRun.id}` } : null,
  });
}
