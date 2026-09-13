// lib/leave/limits.js
//
// The database half of lib/leave/rules.js: load the company's limits, read
// who else is off, and judge one request against blackouts, the cap and the
// holiday calendar. Called by POST /api/leave (when somebody asks) and by the
// approve path of PATCH /api/leave/[id] (when it becomes real — other leave
// may have been approved in between, which is the same reason the balance
// is re-checked there).

import { db } from "@/lib/db";
import { blackoutRefusal, concurrentRefusal, effectiveHolidayRegion, othersOffDuring, resolveLeaveRules } from "@/lib/leave/rules";
import { holidayDays, holidaysBetween } from "@/lib/leave/statutoryHolidays";

/** The company's rules and the region its calendar follows. */
export async function loadLeaveLimits(companyId) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { country: true, province: true, leaveRules: true },
  });
  const rules = resolveLeaveRules(company?.leaveRules);
  const region = effectiveHolidayRegion(rules, company);
  return { rules, region: region.country ? region : null };
}

/**
 * APPROVED leave of OTHER workers overlapping a range — the rows the cap
 * counts and the detail modal lists. Names only.
 */
export async function othersApprovedDuring({ companyId, workerId, startDate, endDate }) {
  const rows = await db.leaveRequest.findMany({
    where: {
      companyId,
      status: "approved",
      ...(workerId ? { workerId: { not: workerId } } : {}),
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) },
    },
    select: {
      workerId: true,
      startDate: true,
      endDate: true,
      status: true,
      worker: { select: { name: true } },
      policy: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    workerId: r.workerId,
    workerName: r.worker?.name || "",
    policyName: r.policy?.name || "",
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
  }));
}

/**
 * Everything the rules say about one request.
 *
 * @returns {{ refusal: null|{reason,message,...}, othersOff: Array, holidays: string[] }}
 *   `holidays` are the observed days inside the range, for countWorkingDays.
 */
export async function judgeLeaveRequest({ companyId, workerId, startDate, endDate }) {
  const { rules, region } = await loadLeaveLimits(companyId);
  const blackout = blackoutRefusal(rules, startDate, endDate);
  const others = await othersApprovedDuring({ companyId, workerId, startDate, endDate });
  const concurrent = blackout ? null : concurrentRefusal(rules, others, startDate, endDate);
  const holidays = region ? holidayDays(holidaysBetween({ ...region, from: startDate, to: endDate })) : [];
  return {
    refusal: blackout || concurrent || null,
    othersOff: othersOffDuring(others, startDate, endDate).map((o) => {
      const src = others.find((r) => r.workerId === o.workerId);
      return { ...o, policyName: src?.policyName || "" };
    }),
    holidays,
    rules,
  };
}
