// app/api/settings/appointment-reminders/route.js
//
// Reads and sets Company.appointmentReminderHours — how many hours before an
// appointment the client gets a reminder text, or null for OFF. The reminder
// cron (app/api/cron/appointment-reminders) does nothing until this is set, so
// this is the only control that turns the feature on. Owners/admins only,
// because it commits the company to per-message SMS spend.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// The lead times offered. A closed set, not free input: a reminder "0.25 hours
// before" is useless, and an arbitrary integer invites one. Null = off.
const ALLOWED = [null, 2, 24, 48];

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { appointmentReminderHours: true },
  });
  return NextResponse.json({ hours: company?.appointmentReminderHours ?? null });
}

export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json(
      { error: "Only owners and admins can change reminder settings." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const raw = body?.hours;
  const hours = raw === null || raw === undefined ? null : Number(raw);

  if (!ALLOWED.includes(hours)) {
    return NextResponse.json(
      { error: "Pick a reminder lead time from the offered options." },
      { status: 400 },
    );
  }

  await db.company.update({
    where: { id: member.companyId },
    data: { appointmentReminderHours: hours },
  });

  return NextResponse.json({ hours });
}
