// app/api/cron/time-clock-watch/route.js
//
// Every fifteen minutes (vercel.json), two questions the time clock cannot
// ask itself:
//
//   1. Is anybody still clocked in who plainly is not on site any more?
//      An open TimeEntry whose published shift ended more than thirty
//      minutes ago — or, with no shift behind it, one open for fourteen
//      hours — gets the worker a push, "Still clocked in?", and their
//      manager a note. ONCE per entry (TimeEntry.overrunNotifiedAt). The
//      entry is never closed here: whether the person left at 16:00 or
//      worked until 19:00 is a pay decision, and only a person makes it,
//      on the timesheet.
//
//   2. Did each person on today's published shifts turn up? For every
//      published shift that started in the last day and does not yet have a
//      FINAL verdict, the worker's punches around it are read and
//      lib/shifts/attendance.js decides: on time, late, no-show, early out.
//      The verdict is written to ShiftAttendance (upsert — recomputed each
//      run until final), and a no-show tells the manager, once.
//
// Same CRON_SECRET gate as every other cron. No new environment variable.
//
// ── Cost ─────────────────────────────────────────────────────────────────────
//
// 96 invocations a day, each a handful of indexed reads: the open entries
// (there are never many), the published shifts of the last 36 hours, the
// punches around them. Bounded at 500 entries and 2,000 shifts a run so a
// runaway tenant cannot make the job time out; a run that hits the cap
// simply continues next quarter-hour.
//
// ── Whose manager ────────────────────────────────────────────────────────────
//
// lib/org/reportingLine.js: the first person up the chain who has a login.
// A company with no org chart (most of them) has no chain, and the note goes
// to everyone with user:manage — the same fallback "leave.requested" makes,
// for the same reason: a no-show nobody is told about is the failure this
// exists to remove.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { managementChain } from "@/lib/org/reportingLine";
import { attendanceFor, forgottenClockOut, shiftForEntry, PUNCH_WINDOW_MS } from "@/lib/shifts/attendance";
import { describeShiftWhen } from "@/lib/shifts/shiftNotify";

const MAX_OPEN_ENTRIES = 500;
const MAX_SHIFTS = 2000;
const LOOKBACK_MS = 36 * 3_600_000;

function timeIn(instant, language, timeZone) {
  try {
    return new Intl.DateTimeFormat(language || "en", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(instant));
  } catch {
    return new Date(instant).toISOString().slice(11, 16);
  }
}

/** Per company: language, zone, and the worker map the reporting line walks. */
async function companyContext(companyId, cache) {
  if (cache.has(companyId)) return cache.get(companyId);
  const [company, workers] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true, timezone: true } }),
    db.worker.findMany({ where: { companyId }, select: { id: true, name: true, userId: true, managerId: true } }),
  ]);
  const byId = {};
  for (const w of workers) byId[w.id] = w;
  const ctx = {
    language: company?.defaultLanguage || "en",
    timeZone: company?.timezone || "America/Toronto",
    byId,
  };
  cache.set(companyId, ctx);
  return ctx;
}

/** The first manager up the chain with a login, as [userId], or undefined for the whole audience. */
function managerRecipients(workerId, byId) {
  const { chain } = managementChain(workerId, byId);
  for (const id of chain) {
    const uid = byId[id]?.userId;
    if (uid) return [uid];
  }
  return undefined;
}

async function watchOpenEntries(now, cache) {
  const open = await db.timeEntry.findMany({
    where: { clockOut: null, overrunNotifiedAt: null },
    take: MAX_OPEN_ENTRIES,
    orderBy: { clockIn: "asc" },
    select: {
      id: true,
      workerId: true,
      clockIn: true,
      worker: { select: { id: true, name: true, userId: true, companyId: true } },
    },
  });
  let asked = 0;
  if (!open.length) return { open: 0, asked };

  // The published shifts these entries could belong to, per company.
  const byCompany = new Map();
  for (const e of open) {
    if (!e.worker) continue;
    if (!byCompany.has(e.worker.companyId)) byCompany.set(e.worker.companyId, []);
    byCompany.get(e.worker.companyId).push(e);
  }
  for (const [companyId, entries] of byCompany) {
    const ctx = await companyContext(companyId, cache);
    const earliest = Math.min(...entries.map((e) => new Date(e.clockIn).getTime()));
    const shifts = await db.shift.findMany({
      where: {
        companyId,
        published: true,
        workerId: { in: entries.map((e) => e.workerId) },
        start: { lte: new Date(now.getTime() + PUNCH_WINDOW_MS) },
        end: { gte: new Date(earliest - PUNCH_WINDOW_MS) },
      },
      select: { id: true, workerId: true, start: true, end: true },
    });
    for (const entry of entries) {
      const shift = shiftForEntry(entry, shifts);
      const { forgotten } = forgottenClockOut({ entry, shift, now });
      if (!forgotten) continue;
      const since = timeIn(entry.clockIn, ctx.language, ctx.timeZone);
      // The mark first, so a crash between the two sends cannot re-ask.
      await db.timeEntry.update({ where: { id: entry.id }, data: { overrunNotifiedAt: now } });
      asked += 1;
      if (entry.worker.userId) {
        await notifyEvent({
          companyId,
          type: "timeclock.stillClockedIn",
          entityId: entry.id,
          params: { since },
          recipientUserIds: [entry.worker.userId],
        });
      }
      await notifyEvent({
        companyId,
        type: "timeclock.stillClockedInManager",
        entityId: entry.id,
        params: { workerName: entry.worker.name || "", since },
        recipientUserIds: managerRecipients(entry.workerId, ctx.byId),
      });
    }
  }
  return { open: open.length, asked };
}

async function watchAttendance(now, cache) {
  const shifts = await db.shift.findMany({
    where: {
      published: true,
      workerId: { not: null },
      start: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: now },
      OR: [{ attendance: null }, { attendance: { final: false } }],
    },
    take: MAX_SHIFTS,
    orderBy: { start: "asc" },
    select: {
      id: true,
      companyId: true,
      workerId: true,
      start: true,
      end: true,
      attendance: { select: { status: true, noShowNotifiedAt: true } },
      worker: { select: { name: true, userId: true } },
    },
  });
  let written = 0;
  let noShows = 0;
  if (!shifts.length) return { shifts: 0, written, noShows };

  const byCompany = new Map();
  for (const s of shifts) {
    if (!byCompany.has(s.companyId)) byCompany.set(s.companyId, []);
    byCompany.get(s.companyId).push(s);
  }
  for (const [companyId, list] of byCompany) {
    const ctx = await companyContext(companyId, cache);
    const earliest = Math.min(...list.map((s) => new Date(s.start).getTime()));
    const entries = await db.timeEntry.findMany({
      where: {
        workerId: { in: [...new Set(list.map((s) => s.workerId))] },
        clockIn: { gte: new Date(earliest - PUNCH_WINDOW_MS) },
      },
      select: { workerId: true, clockIn: true, clockOut: true },
    });
    for (const shift of list) {
      const verdict = attendanceFor({ shift, entries, now });
      if (verdict.status === "pending") continue;
      await db.shiftAttendance.upsert({
        where: { shiftId: shift.id },
        create: {
          companyId,
          shiftId: shift.id,
          workerId: shift.workerId,
          status: verdict.status,
          final: verdict.final,
          firstPunchAt: verdict.firstPunchAt,
          lastPunchOutAt: verdict.lastPunchOutAt,
          lateMinutes: verdict.lateMinutes,
          earlyMinutes: verdict.earlyMinutes,
          computedAt: now,
        },
        update: {
          status: verdict.status,
          final: verdict.final,
          firstPunchAt: verdict.firstPunchAt,
          lastPunchOutAt: verdict.lastPunchOutAt,
          lateMinutes: verdict.lateMinutes,
          earlyMinutes: verdict.earlyMinutes,
          computedAt: now,
        },
      });
      written += 1;
      if (verdict.status === "no_show" && !shift.attendance?.noShowNotifiedAt) {
        await db.shiftAttendance.update({ where: { shiftId: shift.id }, data: { noShowNotifiedAt: now } });
        noShows += 1;
        await notifyEvent({
          companyId,
          type: "attendance.noShow",
          entityId: shift.id,
          params: {
            workerName: shift.worker?.name || "",
            when: describeShiftWhen({ start: shift.start, end: shift.end, language: ctx.language, timeZone: ctx.timeZone }),
          },
          recipientUserIds: managerRecipients(shift.workerId, ctx.byId),
        });
      }
    }
  }
  return { shifts: shifts.length, written, noShows };
}

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const cache = new Map();
  const clock = await watchOpenEntries(now, cache);
  const attendance = await watchAttendance(now, cache);
  return NextResponse.json({ ok: true, at: now.toISOString(), clock, attendance });
}
