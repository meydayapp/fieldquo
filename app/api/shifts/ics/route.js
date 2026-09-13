// app/api/shifts/ics/route.js
//
// The signed-in worker's OWN published shifts for the next fourteen days, as
// an .ics file — "Add to calendar" on /app/me/schedule. Their own rows only,
// resolved from the session the way /api/time-clock resolves the worker;
// there is no workerId parameter to ask for somebody else's week.
//
// Fourteen days, published only: the same window and the same rule the
// schedule screen shows, so the phone's calendar never carries a draft the
// manager has not committed to. Re-downloading replaces by UID
// (lib/calendar/ics.js buildIcsCalendar), so a moved shift moves.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { placeOf } from "@/lib/shifts/shiftNotify";

const DAYS = 14;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const [worker, company] = await Promise.all([
    db.worker.findFirst({
      where: { companyId: member.companyId, userId: member.userId },
      select: { id: true, name: true },
    }),
    db.company.findUnique({ where: { id: member.companyId }, select: { name: true } }),
  ]);
  if (!worker) {
    return NextResponse.json({ error: "You're not set up as a worker yet." }, { status: 404 });
  }

  const now = new Date();
  const to = new Date(now.getTime() + DAYS * 86_400_000);
  const shifts = await db.shift.findMany({
    where: { companyId: member.companyId, workerId: worker.id, published: true, end: { gte: now }, start: { lte: to } },
    orderBy: { start: "asc" },
    select: {
      id: true,
      start: true,
      end: true,
      note: true,
      job: { select: { title: true, siteAddress: true, siteCity: true, client: { select: { name: true } } } },
      breaks: { select: { start: true, end: true, kind: true }, orderBy: { start: "asc" } },
    },
  });

  const companyName = company?.name || "Work";
  const ics = buildIcsCalendar({
    calendarName: `${companyName} — shifts`,
    events: shifts.map((s) => {
      const place = placeOf(s.job);
      const breaks = (s.breaks || [])
        .map((b) => `${b.kind === "lunch" ? "Lunch" : "Break"} ${new Date(b.start).toISOString().slice(11, 16)}–${new Date(b.end).toISOString().slice(11, 16)} UTC`)
        .join(", ");
      return {
        uid: `shift-${s.id}@fieldquo`,
        start: s.start,
        end: s.end,
        summary: place ? `${companyName}: ${place}` : `${companyName}: shift`,
        description: [s.job?.title, s.note, breaks].filter(Boolean).join("\n"),
        location: [s.job?.siteAddress, s.job?.siteCity].filter(Boolean).join(", ") || undefined,
      };
    }),
    dtstamp: now,
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="shifts_${now.toISOString().slice(0, 10)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
