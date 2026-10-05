// app/api/cron/appointment-outcomes/route.js
//
// Once a day: "Did this visit happen?" — to the person each visit is assigned
// to (else whoever booked it), for every appointment whose time passed in the
// last week with no outcome recorded (lib/appointments/outcome.js). The
// answer is one tap on the calendar row the notification opens; it feeds the
// no-show rate and the adjusted close rate the agency metrics report.
//
// One ask per visit, ever: a NotificationEvent of this type for the
// appointment is the record that it was asked, so no new column carries the
// guard and a second run the same day (a retry, an overlapping deploy) asks
// nobody twice. A visit nobody could be asked (no assignee, no booker, or
// the person is no longer a member) writes no event, so it is tried again
// the next day while it is inside the week — and the calendar row offers the
// buttons whatever happens here.
//
// In-app and push only. Nothing goes to the client.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { OPEN_STATUSES, dueForNudge, nudgeRecipient, nudgeWindow, visitWhen } from "@/lib/appointments/outcome";

const TYPE = "appointment.outcomeNeeded";
/** Bounds one run; a company with more open past visits is asked next day. */
const MAX_PER_RUN = 2000;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const candidates = await db.appointment.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, scheduledAt: nudgeWindow(now) },
    select: {
      id: true,
      companyId: true,
      status: true,
      scheduledAt: true,
      assignedToId: true,
      createdById: true,
      client: { select: { name: true } },
      company: { select: { timezone: true, defaultLanguage: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: MAX_PER_RUN,
  });
  if (!candidates.length) return NextResponse.json({ ok: true, asked: 0, candidates: 0 });

  const askedRows = await db.notificationEvent.findMany({
    where: { type: TYPE, entityId: { in: candidates.map((a) => a.id) } },
    select: { entityId: true },
  });
  const asked = new Set(askedRows.map((r) => r.entityId));
  const due = dueForNudge(candidates, { now, asked });

  const userIds = [...new Set(due.map(nudgeRecipient).filter(Boolean))];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, language: true } }) : [];
  const languageOf = new Map(users.map((u) => [u.id, u.language]));

  let delivered = 0;
  for (const appt of due) {
    const to = nudgeRecipient(appt);
    const result = await notifyEvent({
      companyId: appt.companyId,
      type: TYPE,
      entityId: appt.id,
      params: {
        clientName: appt.client?.name || "",
        when: visitWhen(appt.scheduledAt, {
          language: languageOf.get(to) || appt.company?.defaultLanguage || "en",
          timeZone: appt.company?.timezone || "America/Toronto",
        }),
      },
      recipientUserIds: [to],
    }).catch((err) => {
      console.error("[appointment-outcomes] notify failed:", appt.id, err?.message);
      return null;
    });
    if (result?.delivered) delivered += 1;
  }

  return NextResponse.json({ ok: true, candidates: candidates.length, due: due.length, asked: delivered });
}
