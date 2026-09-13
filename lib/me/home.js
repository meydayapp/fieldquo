// lib/me/home.js
//
// What the employee home shows, computed server-side: the worker's Home
// (next up, today's hours, shout-outs) and the manager's Home (the report
// tiles, team status, what needs review, what needs dispatching).
//
// ── Money is gated at the source ───────────────────────────────────────────
//
// A worker's "est. earnings for this shift" line exists in the payload only
// when lib/payroll/ownPayGate.js says they may see their own pay; otherwise
// the key is absent — not null, not zero — so the screen has nothing to
// render a placeholder for. The manager's Wages tile likewise exists only
// for canSeeAllPay (lib/permissions/enforce.js), the same gate the rota's
// labour-cost line uses, so a dispatcher without payroll access sees Paid
// hours and no dollar figure anywhere.
//
// Estimates are ESTIMATES and say so: hours net of unpaid breaks × the
// person's hourly rate, no overtime, no deductions — the pay run computes
// those. A salaried worker or one with no rate gets no figure, never $0.
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { canSeeAllPay, hasLevel, loadEnforceableMember } from "@/lib/permissions/enforce";
import { canSeeOwnPay } from "@/lib/payroll/ownPayGate";
import { scheduledMinutes } from "@/lib/shifts/coverage";
import { entryHours, openBreak, unpaidBreakMs } from "@/lib/timeclock/entryHours";
import { timelineFor, nextUp, siteOf } from "@/lib/me/timeline";

const WORKER = { id: true, name: true, title: true, userId: true, active: true, hourlyRate: true, type: true };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY = 86_400_000;

/** Local day bounds in the company's zone are the browser's job; the server uses UTC day windows around `now`. */
function dayWindow(now, timeZone) {
  // Resolve "today" in the company's zone, then take the instants for its
  // midnight-to-midnight. Intl gives the parts; a Date built from them in
  // that zone is found by offsetting.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year").value);
  const m = Number(parts.find((p) => p.type === "month").value);
  const d = Number(parts.find((p) => p.type === "day").value);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // Offset of the zone at that instant.
  const zoned = new Date(guess.toLocaleString("en-US", { timeZone }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = zoned.getTime() - utc.getTime();
  const start = new Date(guess.getTime() - offset);
  return { start, end: new Date(start.getTime() + DAY), ymd: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

async function companyOf(member) {
  const row = await db.company.findUnique({
    where: { id: member.companyId },
    select: { name: true, timezone: true, defaultLanguage: true, weekStartsOn: true, shiftSwapsNeedApproval: true, availabilityNeedsApproval: true },
  });
  return {
    name: row?.name || "",
    timeZone: row?.timezone || "America/Toronto",
    weekStartsOn: Number.isInteger(row?.weekStartsOn) ? row.weekStartsOn : 0,
    shiftSwapsNeedApproval: row?.shiftSwapsNeedApproval !== false,
    availabilityNeedsApproval: row?.availabilityNeedsApproval !== false,
  };
}

/** Hours net of unpaid breaks × rate, or null when there is no rate. Pure. */
export function estimateForShift(shift, rate) {
  if (rate == null || !Number.isFinite(Number(rate))) return null;
  const minutes = scheduledMinutes([shift], shift.start, shift.end);
  return { hours: round2(minutes / 60), amount: round2((minutes / 60) * Number(rate)) };
}

// ── The worker's Home ───────────────────────────────────────────────────────

export async function workerHome(member, now = new Date()) {
  const company = await companyOf(member);
  const full = await loadEnforceableMember(db, member.id);
  const seesPay = canSeeOwnPay(full);
  const worker = member.userId
    ? await db.worker.findFirst({ where: { companyId: member.companyId, userId: member.userId }, select: WORKER })
    : null;
  const user = member.userId
    ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true, image: true } })
    : null;
  const today = dayWindow(now, company.timeZone);
  const horizon = new Date(today.start.getTime() + 14 * DAY);

  const items = await timelineFor(member, today.start, horizon, { worker });
  const next = nextUp(items, now);

  // Co-workers on the same job that day — the avatars beside the next shift.
  let coworkers = [];
  if (next && next.kind === "shift" && next.job?.id) {
    const dayStart = new Date(new Date(next.start).getTime());
    dayStart.setUTCHours(0, 0, 0, 0);
    const rows = await db.shift.findMany({
      where: {
        companyId: member.companyId,
        jobId: next.job.id,
        published: true,
        workerId: { not: worker?.id || "" },
        start: { gte: new Date(dayStart.getTime() - DAY), lte: new Date(dayStart.getTime() + 2 * DAY) },
      },
      select: { workerId: true, start: true, end: true, worker: { select: { id: true, name: true, title: true, user: { select: { image: true } } } } },
    });
    const sameDay = rows.filter((r) => r.worker && new Date(r.start) < new Date(next.end) && new Date(r.end) > new Date(next.start));
    const seen = new Set();
    for (const r of sameDay) {
      if (seen.has(r.worker.id)) continue;
      seen.add(r.worker.id);
      coworkers.push({ id: r.worker.id, name: r.worker.name, title: r.worker.title, image: r.worker.user?.image || null });
    }
  }

  // Today on the clock: the entries, the open one, the estimate.
  const entries = worker
    ? await db.timeEntry.findMany({
        where: { workerId: worker.id, clockIn: { gte: today.start, lt: today.end } },
        orderBy: { clockIn: "asc" },
        select: {
          id: true, clockIn: true, clockOut: true, hours: true, status: true,
          job: { select: { id: true, title: true, client: { select: { name: true } } } },
          breaks: { select: { start: true, end: true, kind: true, paid: true }, orderBy: { start: "asc" } },
        },
      })
    : [];
  const open = entries.find((e) => !e.clockOut) || null;
  let hoursToday = 0;
  for (const e of entries) {
    hoursToday += e.clockOut ? Number(e.hours ?? entryHours(e.clockIn, e.clockOut, e.breaks)) : entryHours(e.clockIn, now, e.breaks);
  }
  hoursToday = round2(hoursToday);
  const rate = worker?.hourlyRate == null ? null : Number(worker.hourlyRate);

  const [shoutOuts, pendingRequests, pendingAvailability] = await Promise.all([
    db.shoutOut.findMany({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, message: true, createdAt: true,
        fromMember: { select: { user: { select: { name: true, image: true } } } },
        toWorker: { select: { id: true, name: true } },
      },
    }),
    worker
      ? db.shiftRequest.count({
          where: { companyId: member.companyId, status: { in: ["pending_peer", "pending_manager"] }, OR: [{ fromWorkerId: worker.id }, { toWorkerId: worker.id }] },
        })
      : 0,
    worker ? db.availabilityRequest.count({ where: { workerId: worker.id, status: "pending" } }) : 0,
  ]);

  return {
    me: {
      name: user?.name || worker?.name || "",
      image: user?.image || null,
      title: worker?.title || null,
      workerId: worker?.id || null,
      onRoster: Boolean(worker),
      quoter: can(member.role, "quote:create"),
    },
    company: { name: company.name, timeZone: company.timeZone, weekStartsOn: company.weekStartsOn },
    today: { ymd: today.ymd, start: today.start, end: today.end },
    next: next
      ? {
          ...next,
          coworkers,
          ...(seesPay && next.kind === "shift" && rate != null ? { estimate: estimateForShift(next, rate) } : {}),
        }
      : null,
    // Everything else in the next fortnight, for the "Coming up" list.
    upcoming: items.filter((i) => i !== next && i.kind !== "event").slice(0, 8),
    eventsToday: items.filter((i) => i.kind === "event" && new Date(i.start) < today.end && new Date(i.start) >= new Date(today.start.getTime() - DAY)),
    clock: {
      entries: entries.map((e) => ({
        id: e.id,
        clockIn: e.clockIn,
        clockOut: e.clockOut,
        hours: e.clockOut ? round2(e.hours ?? entryHours(e.clockIn, e.clockOut, e.breaks)) : null,
        status: e.status,
        job: e.job ? { id: e.job.id, title: e.job.title, client: e.job.client?.name || null } : null,
        onBreak: !e.clockOut && Boolean(openBreak(e.breaks)),
        unpaidBreakMinutes: Math.round(unpaidBreakMs(e.breaks, e.clockIn, e.clockOut || now) / 60_000),
      })),
      open: open ? { id: open.id, clockIn: open.clockIn, onBreak: Boolean(openBreak(open.breaks)) } : null,
      hoursToday,
      ...(seesPay && rate != null && entries.length ? { earnedToday: round2(hoursToday * rate) } : {}),
    },
    shoutOuts: shoutOuts.map((s) => ({
      id: s.id,
      message: s.message,
      createdAt: s.createdAt,
      from: { name: s.fromMember?.user?.name || null, image: s.fromMember?.user?.image || null },
      to: { workerId: s.toWorker?.id || null, name: s.toWorker?.name || null },
      forMe: Boolean(worker && s.toWorker?.id === worker.id),
    })),
    counts: { pendingRequests, pendingAvailability },
    seesPay,
  };
}

// ── The manager's Home ──────────────────────────────────────────────────────

/** Pure: a person's state at `now` from today's shifts and time entries. */
export function teamState({ shifts = [], entries = [], now, lateAfterMin = 10 } = {}) {
  const t = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  const open = entries.find((e) => !e.clockOut) || null;
  if (open) return openBreak(open.breaks) ? "on_break" : "clocked_in";
  const closed = entries.filter((e) => e.clockOut);
  const current = shifts.find((s) => new Date(s.start).getTime() <= t && new Date(s.end).getTime() > t) || null;
  if (current) {
    if (closed.length) return "clocked_out";
    return new Date(current.start).getTime() + lateAfterMin * 60_000 < t ? "late" : "scheduled";
  }
  const later = shifts.find((s) => new Date(s.start).getTime() > t);
  if (later) return "scheduled";
  if (closed.length) return "clocked_out";
  const earlier = shifts.find((s) => new Date(s.end).getTime() <= t);
  if (earlier && !closed.length) return "no_show";
  return "off";
}

export const TEAM_STATES = Object.freeze(["clocked_in", "on_break", "late", "scheduled", "clocked_out", "no_show", "off"]);

export async function managerHome(member, { period = "today", now = new Date() } = {}) {
  const company = await companyOf(member);
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "schedule", "edit_all")) return { error: "Not a manager.", status: 403 };
  const seesWages = canSeeAllPay(full);
  const today = dayWindow(now, company.timeZone);
  const range =
    period === "week"
      ? (() => {
          const dow = new Date(today.start.getTime() + 12 * 3_600_000).getUTCDay();
          const back = (dow - company.weekStartsOn + 7) % 7;
          const start = new Date(today.start.getTime() - back * DAY);
          return { start, end: new Date(start.getTime() + 7 * DAY) };
        })()
      : { start: today.start, end: today.end };

  const user = member.userId ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true } }) : null;

  const workers = await db.worker.findMany({
    where: { companyId: member.companyId, active: true },
    orderBy: { name: "asc" },
    select: { ...WORKER, user: { select: { image: true } } },
  });
  const workerIds = workers.map((w) => w.id);
  const userIds = workers.map((w) => w.userId).filter(Boolean);

  const [periodEntries, todayShifts, todayEntries, visitsToday, leaveToday, revenueRows, leavePending, swapsPending, availPending, timesheetsPending, draftsToday, eventsToday] =
    await Promise.all([
      db.timeEntry.findMany({
        where: { workerId: { in: workerIds }, clockIn: { gte: range.start, lt: range.end }, status: "approved" },
        select: { workerId: true, hours: true },
      }),
      db.shift.findMany({
        where: { companyId: member.companyId, start: { lt: today.end }, end: { gt: today.start } },
        orderBy: { start: "asc" },
        select: {
          id: true, workerId: true, start: true, end: true, published: true, label: true,
          job: { select: { id: true, title: true, siteAddress: true, siteCity: true, client: { select: { name: true } } } },
          breaks: { select: { start: true, end: true, kind: true, paid: true } },
        },
      }),
      db.timeEntry.findMany({
        where: { workerId: { in: workerIds }, OR: [{ clockOut: null }, { clockIn: { gte: today.start, lt: today.end } }] },
        orderBy: { clockIn: "asc" },
        select: {
          id: true, workerId: true, clockIn: true, clockOut: true, hours: true,
          job: { select: { id: true, title: true, siteAddress: true, siteCity: true, client: { select: { name: true } } } },
          breaks: { select: { start: true, end: true, kind: true, paid: true } },
        },
      }),
      db.jobVisit.findMany({
        where: { job: { companyId: member.companyId }, scheduledAt: { gte: today.start, lt: today.end }, status: { notIn: ["cancelled", "canceled", "completed"] } },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true, jobId: true, scheduledAt: true, status: true, assignedToId: true,
          assignedTo: { select: { name: true } },
          job: { select: { id: true, title: true, siteAddress: true, siteCity: true, client: { select: { name: true } } } },
        },
      }),
      db.leaveRequest.findMany({
        where: { companyId: member.companyId, status: "approved", startDate: { lte: today.end }, endDate: { gte: today.start } },
        select: { workerId: true },
      }),
      db.payment.findMany({
        where: { invoice: { companyId: member.companyId }, date: { gte: range.start, lt: range.end } },
        select: { amount: true },
      }),
      db.leaveRequest.findMany({
        where: { companyId: member.companyId, status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, startDate: true, endDate: true, days: true, halfDay: true, reason: true, worker: { select: { id: true, name: true } }, policy: { select: { name: true } } },
      }),
      db.shiftRequest.findMany({
        where: { companyId: member.companyId, status: "pending_manager" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: {
          id: true, kind: true, note: true, createdAt: true,
          fromWorker: { select: { name: true } }, toWorker: { select: { name: true } },
          shift: { select: { start: true, end: true, job: { select: { title: true, client: { select: { name: true } } } } } },
        },
      }),
      db.availabilityRequest.findMany({
        where: { companyId: member.companyId, status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, effectiveFrom: true, days: true, desiredHoursPerWeek: true, note: true, worker: { select: { name: true } } },
      }),
      db.timeEntry.findMany({
        where: { workerId: { in: workerIds }, status: "pending", clockOut: { not: null } },
        orderBy: { clockIn: "desc" },
        take: 20,
        select: { id: true, clockIn: true, clockOut: true, hours: true, worker: { select: { id: true, name: true } }, job: { select: { title: true } } },
      }),
      db.shift.count({ where: { companyId: member.companyId, published: false, start: { lt: today.end }, end: { gt: today.start } } }),
      db.scheduleEvent.findMany({ where: { companyId: member.companyId, date: { gte: new Date(today.start.getTime() - DAY), lt: today.end } }, select: { id: true, title: true, description: true } }),
    ]);

  // ── Report tiles ────────────────────────────────────────────────────────
  const rateOf = new Map(workers.map((w) => [w.id, w.hourlyRate == null ? null : Number(w.hourlyRate)]));
  let paidHours = 0;
  let wages = 0;
  let unpriced = 0;
  for (const e of periodEntries) {
    const h = Number(e.hours) || 0;
    paidHours += h;
    const r = rateOf.get(e.workerId);
    if (r == null) unpriced += 1;
    else wages += h * r;
  }
  const revenue = revenueRows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const report = {
    period,
    from: range.start,
    to: range.end,
    paidHours: round2(paidHours),
    ...(seesWages
      ? {
          wages: round2(wages),
          unpricedEntries: unpriced,
          revenue: round2(revenue),
          // Null when there is no revenue to divide by — "— add revenue",
          // never 0%. Also null without wages: no numerator is not zero.
          labourPct: revenue > 0 && (wages > 0 || paidHours === 0) ? round2((wages / revenue) * 100) : null,
        }
      : {}),
  };

  // ── Team status: one row per person, where they are ────────────────────
  const shiftsBy = {};
  for (const s of todayShifts) if (s.workerId) (shiftsBy[s.workerId] ||= []).push(s);
  const entriesBy = {};
  for (const e of todayEntries) (entriesBy[e.workerId] ||= []).push(e);
  const outIds = new Set(leaveToday.map((l) => l.workerId));
  const inProgressVisitByUser = {};
  for (const v of visitsToday) if (v.assignedToId && (v.status === "in_progress" || v.status === "on_the_way")) inProgressVisitByUser[v.assignedToId] ||= v;

  const team = workers.map((w) => {
    const shifts = shiftsBy[w.id] || [];
    const entries = entriesBy[w.id] || [];
    const state = outIds.has(w.id) && !entries.some((e) => !e.clockOut) ? "off" : teamState({ shifts, entries, now });
    const open = entries.find((e) => !e.clockOut) || null;
    const visit = w.userId ? inProgressVisitByUser[w.userId] : null;
    const whereJob = open?.job || visit?.job || (state === "scheduled" || state === "late" ? shifts[0]?.job : null) || null;
    return {
      id: w.id,
      name: w.name,
      title: w.title,
      image: w.user?.image || null,
      hasLogin: Boolean(w.userId),
      state,
      out: outIds.has(w.id),
      shift: shifts[0] ? { start: shifts[0].start, end: shifts[0].end, published: shifts[0].published, label: shifts[0].label } : null,
      clockIn: open?.clockIn || entries[0]?.clockIn || null,
      clockOut: open ? null : entries.length ? entries[entries.length - 1].clockOut : null,
      where: whereJob ? { title: whereJob.title, client: whereJob.client?.name || null, address: siteOf(whereJob) } : null,
    };
  });
  const counts = {};
  for (const s of TEAM_STATES) counts[s] = 0;
  for (const r of team) counts[r.state] += 1;

  // ── Dispatch: today's visits with nobody, or somebody who is out/no-show ─
  const workerByUser = new Map(workers.filter((w) => w.userId).map((w) => [w.userId, w.id]));
  const stateByWorker = new Map(team.map((r) => [r.id, r.state]));
  const dispatch = visitsToday
    .map((v) => {
      const wid = v.assignedToId ? workerByUser.get(v.assignedToId) : null;
      const st = wid ? stateByWorker.get(wid) : null;
      const reason = !v.assignedToId ? "unassigned" : outIds.has(wid) ? "out" : st === "no_show" ? "no_show" : null;
      return reason
        ? { id: v.id, jobId: v.jobId, scheduledAt: v.scheduledAt, status: v.status, reason, assignee: v.assignedTo?.name || null, client: v.job?.client?.name || null, title: v.job?.title || null, address: siteOf(v.job) }
        : null;
    })
    .filter(Boolean);

  // ── Needs review ────────────────────────────────────────────────────────
  const needsReview = {
    timeOff: leavePending.map((l) => ({ id: l.id, worker: l.worker?.name || "", policy: l.policy?.name || "", startDate: l.startDate, endDate: l.endDate, days: Number(l.days), halfDay: l.halfDay, reason: l.reason })),
    swaps: swapsPending.map((r) => ({ id: r.id, kind: r.kind, note: r.note, from: r.fromWorker?.name || null, to: r.toWorker?.name || null, start: r.shift?.start, end: r.shift?.end, client: r.shift?.job?.client?.name || null })),
    availability: availPending.map((r) => ({ id: r.id, worker: r.worker?.name || "", effectiveFrom: r.effectiveFrom, days: r.days, desired: r.desiredHoursPerWeek == null ? null : Number(r.desiredHoursPerWeek), note: r.note })),
    timesheets: timesheetsPending.map((e) => ({ id: e.id, worker: e.worker?.name || "", workerId: e.worker?.id, clockIn: e.clockIn, clockOut: e.clockOut, hours: e.hours == null ? null : Number(e.hours), job: e.job?.title || null })),
  };

  return {
    me: { name: user?.name || "" },
    company: { name: company.name, timeZone: company.timeZone },
    today: { ymd: today.ymd, draftsToday, shiftsToday: todayShifts.filter((s) => s.workerId).length, openToday: todayShifts.filter((s) => !s.workerId).length },
    report,
    seesWages,
    team,
    counts,
    dispatch,
    needsReview,
    eventsToday,
    hasQuoters: workers.length > 0,
  };
}
