// app/api/time-clock/week/route.js
//
// "This week" for the person asking — the figure on the crew's home with a
// link to their timesheet. Their OWN time only, resolved from the session the
// way /api/time-clock resolves the worker, so there is no id to swap.
//
// Two numbers, both from the rows payroll reads:
//   hours      paid hours — closed entries' booked `hours`, plus the open
//              one live (lib/timeclock/todayHours.js, the same function the
//              clock's "Today" uses, over the week's rows instead of the day's)
//   trackedMs  everything on the clock this week, breaks included, from the
//              Time Log's segments clipped to the week
//
// Hours only — never a rate or an amount. A crew member's home carries no
// money (lib/dashboard/crewHome.js), and this adds none.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { todayHoursFrom } from "@/lib/timeclock/todayHours";
import { entrySegments, segmentTotals, weekStartInZone } from "@/lib/timeclock/segments";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { canUseTimeClock, CLOCK_REFUSAL } from "@/lib/timeclock/access";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!canUseTimeClock(await loadEnforceableMember(db, member.id))) {
    return NextResponse.json({ error: CLOCK_REFUSAL }, { status: 403 });
  }

  const [worker, company] = await Promise.all([
    db.worker.findFirst({
      where: { companyId: member.companyId, userId: member.userId },
      select: { id: true },
    }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: { timezone: true, weekStartsOn: true },
    }),
  ]);
  // No Worker row is "nothing to count", said as such — not a zero, which
  // would read as a week not worked.
  if (!worker) return NextResponse.json({ hasWorker: false, hours: null, trackedMs: null });

  const timezone = company?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const from = weekStartInZone(now, timezone, company?.weekStartsOn ?? 0);
  if (!from) return NextResponse.json({ error: "Couldn't work out this week." }, { status: 500 });

  const entries = await db.timeEntry.findMany({
    where: {
      workerId: worker.id,
      clockIn: { lte: now },
      OR: [{ clockOut: null }, { clockOut: { gt: from } }],
    },
    select: {
      id: true,
      clockIn: true,
      clockOut: true,
      hours: true,
      activity: true,
      paid: true,
      jobId: true,
      breaks: { select: { start: true, end: true, kind: true, paid: true } },
    },
  });

  // Paid hours by the payroll rule: an entry belongs to the week it STARTED
  // in, as on the timesheet and in a pay run.
  const hours = todayHoursFrom(
    entries.filter((e) => new Date(e.clockIn) >= from),
    now,
  );
  // On-the-clock time, clipped to the week, so a Sunday-night shift is split
  // the way the Time Log draws it.
  const { trackedMs } = segmentTotals(entries.flatMap((e) => entrySegments(e, { from, to: now, now })));

  return NextResponse.json({
    hasWorker: true,
    from: from.toISOString(),
    hours,
    trackedMs,
  });
}
