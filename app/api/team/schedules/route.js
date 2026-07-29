// app/api/team/schedules/route.js
//
// The manager's view of the whole team's calendar — each member's weekly
// availability plus what's actually booked. Gated on user:view, so an owner,
// admin or supervisor sees everyone; an employee can't pull their colleagues'
// schedules here (they manage their own at Settings → Availability).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!can(member.role, "user:view")) {
    return NextResponse.json(
      { error: "Only a supervisor, admin or owner can see the team's schedule." },
      { status: 403 },
    );
  }

  const members = await db.member.findMany({
    where: { companyId: member.companyId, active: true },
    select: { id: true, role: true, userId: true, user: { select: { name: true } } },
  });

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const team = [];
  for (const m of members) {
    if (!m.userId) continue;

    const [availability, bookings, appointments] = await Promise.all([
      db.availabilitySchedule.findMany({
        where: { userId: m.userId },
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, startTime: true, endTime: true },
      }),
      db.booking.findMany({
        where: {
          eventType: { userId: m.userId },
          status: "confirmed",
          startTime: { gte: now, lte: horizon },
        },
        orderBy: { startTime: "asc" },
        select: { startTime: true, clientName: true },
      }),
      db.appointment.findMany({
        where: {
          assignedToId: m.userId,
          status: { in: ["scheduled", "needs_supervisor"] },
          scheduledAt: { gte: now, lte: horizon },
        },
        orderBy: { scheduledAt: "asc" },
        select: { scheduledAt: true, notes: true, client: { select: { name: true } } },
      }),
    ]);

    const upcoming = [
      ...bookings.map((b) => ({ when: b.startTime, label: b.clientName, kind: "booking" })),
      ...appointments.map((a) => ({ when: a.scheduledAt, label: a.client?.name || a.notes || "Appointment", kind: "appointment" })),
    ].sort((x, y) => new Date(x.when) - new Date(y.when));

    team.push({
      name: m.user?.name || "Team member",
      role: m.role,
      hasAvailability: availability.length > 0,
      availability,
      upcoming,
    });
  }

  // Members with availability first, then by name — the bookable people are
  // what a manager is usually here to check.
  team.sort((a, b) => {
    if (a.hasAvailability !== b.hasAvailability) return a.hasAvailability ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ team });
}
