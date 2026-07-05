// app/api/availability/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// GET — the current user's own weekly availability
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schedules = await db.availabilitySchedule.findMany({
    where: { userId: member.userId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json(schedules);
}

// PATCH — replace the current user's weekly availability
// body: { schedules: [{ dayOfWeek: 1, startTime: "08:00", endTime: "17:00", timezone: "America/Toronto" }] }
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { schedules } = await request.json();
  if (!Array.isArray(schedules)) {
    return NextResponse.json(
      { error: "schedules array required" },
      { status: 400 },
    );
  }

  await db.availabilitySchedule.deleteMany({
    where: { userId: member.userId },
  });

  if (schedules.length > 0) {
    await db.availabilitySchedule.createMany({
      data: schedules.map((s) => ({
        userId: member.userId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone || "America/Toronto",
      })),
    });
  }

  const updated = await db.availabilitySchedule.findMany({
    where: { userId: member.userId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json(updated);
}
