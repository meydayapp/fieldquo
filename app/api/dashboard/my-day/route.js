// app/api/dashboard/my-day/route.js
//
// "My day" — the /app home for crew (who gets it: lib/dashboard/crewHome.js
// isCrewHome). The person's own schedule for today and the next seven days,
// the next stop with directions, the clock, and each visit's photo and
// checklist progress.
//
// Built on the employee home's own reads (lib/me/timeline.js timelineFor —
// the same visits, shifts, appointments and tasks /app/me shows, scoped the
// same way), then passed through shapeMyDay, which rebuilds every item from a
// whitelist. So the pay estimate lib/me/home.js adds for a worker allowed to
// see their own pay never reaches this screen, and neither does anything the
// timeline grows later. No money, no company numbers.
//
// Every member may ask — it is only ever their own day. Read-only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { timelineFor, nextUp } from "@/lib/me/timeline";
import { openBreak } from "@/lib/timeclock/entryHours";
import { dayWindow, localDate } from "@/lib/receipts/time";
import { shapeMyDay } from "@/lib/dashboard/crewHome";

const DAY = 86_400_000;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const now = new Date();

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { timezone: true } });
  const today = dayWindow(localDate(now, company?.timezone), company?.timezone);
  const from = today?.start || new Date(now.getTime() - 12 * 3_600_000);
  const todayEnd = today?.end || new Date(from.getTime() + DAY);
  const to = new Date(todayEnd.getTime() + 7 * DAY);

  const worker = member.userId
    ? await db.worker.findFirst({
        where: { companyId: member.companyId, userId: member.userId },
        select: { id: true, name: true, title: true, userId: true, active: true, type: true },
      })
    : null;
  const user = member.userId ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true } }) : null;

  const items = await timelineFor(member, from, to, { worker });
  const next = nextUp(items.filter((i) => i.kind !== "open"), now);

  // Photos and checklist progress for the visits on the list — read from the
  // visits themselves, narrowed to this company and to the ids the timeline
  // (already scoped to this person) returned.
  const visitIds = items.filter((i) => i.kind === "visit").map((i) => i.id);
  const visitRows = visitIds.length
    ? await db.jobVisit.findMany({
        where: { id: { in: visitIds }, job: { companyId: member.companyId } },
        select: { id: true, photos: true, checklistItems: true },
      })
    : [];
  const visitExtras = {};
  for (const v of visitRows) {
    const list = Array.isArray(v.checklistItems) ? v.checklistItems : [];
    visitExtras[v.id] = {
      photos: Array.isArray(v.photos) ? v.photos.length : 0,
      checklistDone: list.filter((i) => i && i.done === true).length,
      checklistTotal: list.length,
    };
  }

  const open = worker
    ? await db.timeEntry.findFirst({
        where: { workerId: worker.id, clockOut: null },
        orderBy: { clockIn: "desc" },
        select: { clockIn: true, breaks: { select: { start: true, end: true, kind: true, paid: true } } },
      })
    : null;

  return NextResponse.json(
    shapeMyDay({
      items,
      nextId: next?.id || null,
      todayEnd,
      clock: { onRoster: Boolean(worker), open: open ? { clockIn: open.clockIn, onBreak: Boolean(openBreak(open.breaks)) } : null },
      visitExtras,
      name: user?.name || worker?.name || null,
    }),
  );
}
