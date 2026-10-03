// app/api/time-clock/log/route.js
//
// The Time Log: one company day, per person, as a timeline of segments —
// Visit 07:02–09:40, Driving 09:40–10:05, Lunch 12:00–12:30 … — with the
// day's total. Read-only; every number here comes from the same TimeEntry and
// TimeEntryBreak rows payroll reads, cut into segments by
// lib/timeclock/segments.js.
//
// ── Who sees whom ──────────────────────────────────────────────────────────
//
// The same split GET /api/time-entries makes, through the same dial:
// `timeTracking` at view_record_edit_all sees everyone; anyone below sees
// their own rows only. A filter, not a gate — a crew member asking gets their
// own day, never a 403 and never a colleague's. No pay rate is selected, so
// there is nothing for redactPayList to strip.
//
// ── Whose day ──────────────────────────────────────────────────────────────
//
// The company's (Company.timezone), for the reason the clock gives: a
// server-local day puts a 7am punch on the wrong date for every company west
// of Greenwich. Segments are clipped to the day, so a night shift shows on
// both dates it touched.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { resolveTimeActivities } from "@/lib/timeclock/activities";
import { buildDayLog, dayBoundsForDate, isoDayInZone, shiftIsoDay } from "@/lib/timeclock/segments";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { timezone: true, timeActivities: true },
  });
  const timezone = company?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const today = isoDayInZone(now, timezone);

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || today;
  const bounds = dayBoundsForDate(date, timezone);
  if (!bounds) {
    return NextResponse.json({ error: "date must be a real YYYY-MM-DD day." }, { status: 400 });
  }

  const full = await loadEnforceableMember(db, member.id);
  const seesEveryone = hasLevel(full, "timeTracking", "view_record_edit_all");
  const me = await db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true },
  });

  const base = {
    date,
    today,
    prev: shiftIsoDay(date, -1),
    // No tomorrow: nothing has been worked there yet, and an arrow to an
    // empty future is a control that shows nothing.
    next: date < today ? shiftIsoDay(date, 1) : null,
    timezone,
    scope: seesEveryone ? "all" : "own",
    activities: resolveTimeActivities(company?.timeActivities),
  };

  // Somebody with no Worker row and no view of anyone else's has no log.
  if (!seesEveryone && !me) {
    return NextResponse.json({ ...base, people: [], hasWorker: false });
  }

  const entries = await db.timeEntry.findMany({
    where: {
      worker: {
        companyId: member.companyId,
        ...(seesEveryone ? {} : { userId: member.userId }),
      },
      // Anything that overlaps the day: started before it ends, and not
      // finished before it starts (an entry still open counts as unfinished).
      clockIn: { lt: bounds.next },
      OR: [{ clockOut: null }, { clockOut: { gt: bounds.start } }],
    },
    orderBy: { clockIn: "asc" },
    select: {
      id: true,
      workerId: true,
      clockIn: true,
      clockOut: true,
      activity: true,
      paid: true,
      status: true,
      jobId: true,
      job: { select: { id: true, title: true } },
      task: { select: { id: true, title: true } },
      breaks: {
        orderBy: { start: "asc" },
        select: { id: true, start: true, end: true, kind: true, paid: true },
      },
    },
  });

  const workerIds = [...new Set(entries.map((e) => e.workerId))];
  const workers = workerIds.length
    ? await db.worker.findMany({
        where: { id: { in: workerIds }, companyId: member.companyId },
        select: { id: true, name: true },
      })
    : [];

  return NextResponse.json({
    ...base,
    hasWorker: Boolean(me),
    people: buildDayLog({ entries, workers, meWorkerId: me?.id || null, bounds, now }),
  });
}
