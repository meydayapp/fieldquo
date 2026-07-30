// app/api/working-hours/route.js
//
// A person's internal shift — when they're on the clock. Distinct from
// /api/availability, which is when clients may BOOK them.
//
// GET  — your own (or a teammate's, with team-schedule permission)
// PUT  — replace your own week; owners/admins may set anyone's, because the
//        shift is the company's call in a way a booking window isn't.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

function validRows(schedules) {
  if (!Array.isArray(schedules)) return null;
  const seen = new Set();
  const out = [];
  for (const s of schedules) {
    const day = Number(s?.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) return null;
    if (seen.has(day)) return null; // one shift per day — see the model comment
    if (!/^\d{2}:\d{2}$/.test(s?.startTime || "") || !/^\d{2}:\d{2}$/.test(s?.endTime || "")) {
      return null;
    }
    // An end before the start is a typo, not an overnight shift — refuse it
    // rather than storing something that reads as a negative day.
    if (s.endTime <= s.startTime) return null;
    seen.add(day);
    out.push({
      dayOfWeek: day,
      startTime: s.startTime,
      endTime: s.endTime,
      timezone: s.timezone || "America/Toronto",
    });
  }
  return out;
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("userId");

  // Reading someone else's shift needs team visibility.
  let userId = member.userId;
  if (requested && requested !== member.userId) {
    if (!can(member.role, "user:view")) {
      return NextResponse.json(
        { error: "You can only see your own working hours." },
        { status: 403 },
      );
    }
    // Must be a teammate, not any user id in the database.
    const teammate = await db.member.findFirst({
      where: { companyId: member.companyId, userId: requested, active: true },
      select: { userId: true },
    });
    if (!teammate) return NextResponse.json({ error: "Not found" }, { status: 404 });
    userId = requested;
  }

  const workingHours = await db.workingHours.findMany({
    where: { userId },
    orderBy: { dayOfWeek: "asc" },
  });
  return NextResponse.json({ userId, workingHours });
}

export async function PUT(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const rows = validRows(body?.schedules);
  if (rows === null) {
    return NextResponse.json(
      { error: "Check the hours — each day needs a start before its end, and one shift per day." },
      { status: 400 },
    );
  }

  let userId = member.userId;
  if (body?.userId && body.userId !== member.userId) {
    // Setting someone else's shift is a management action.
    if (!can(member.role, "user:manage")) {
      return NextResponse.json(
        { error: "Only an owner or admin can set someone else's working hours." },
        { status: 403 },
      );
    }
    const teammate = await db.member.findFirst({
      where: { companyId: member.companyId, userId: body.userId, active: true },
      select: { userId: true },
    });
    if (!teammate) return NextResponse.json({ error: "Not found" }, { status: 404 });
    userId = body.userId;
  }

  // Replace the week wholesale — a partial patch would leave yesterday's
  // deleted day still in the table.
  await db.$transaction([
    db.workingHours.deleteMany({ where: { userId } }),
    ...(rows.length
      ? [
          db.workingHours.createMany({
            data: rows.map((r) => ({ ...r, userId, companyId: member.companyId })),
          }),
        ]
      : []),
  ]);

  const workingHours = await db.workingHours.findMany({
    where: { userId },
    orderBy: { dayOfWeek: "asc" },
  });
  return NextResponse.json({ userId, workingHours });
}
