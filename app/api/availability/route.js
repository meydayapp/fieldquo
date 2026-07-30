// app/api/availability/route.js
//
// Bookable hours — when a client may book this person. Public: the booking
// calendar and the tenant website read it. Distinct from WorkingHours (their
// shift); see the header of /app/settings/availability for why both exist.
//
// ── Someone else's hours ────────────────────────────────────────────────────
//
// This used to read and write `member.userId` and nothing else, so there was NO
// WAY for an owner to set their team's bookable hours — not from the schedule
// page, not from settings, not at all. In a field-service company the boss
// usually sets the schedule, and a crew member who never signs in would never
// become bookable, which quietly keeps them off the booking page forever.
//
// A target user is now accepted, gated the same way /api/working-hours already
// gates it: your own always; anyone else's needs `user:view` to read and
// `user:manage` to write. The target must be an active member of the SAME
// company — checked against the database, never taken on trust from the body,
// or this becomes a way to write another tenant's schedule.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";
import { ensureConsultationEventType } from "@/lib/booking/bookableMembers";

/**
 * Resolve whose schedule this request is about.
 *
 * @returns { userId } or { error, status }
 */
async function resolveTarget(member, requested, permission) {
  if (!requested || requested === member.userId) return { userId: member.userId };

  if (!can(member.role, permission)) {
    return {
      error: "You can only change your own hours.",
      status: 403,
    };
  }

  const target = await db.member.findFirst({
    where: { companyId: member.companyId, userId: requested, active: true },
    select: { userId: true },
  });
  if (!target) {
    // Same message whether they're in another company or don't exist: a
    // different one would confirm which user ids are real.
    return { error: "That person isn't on your team.", status: 404 };
  }
  return { userId: target.userId };
}

// GET — bookable hours for the signed-in user, or ?userId= for a teammate
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requested = new URL(request.url).searchParams.get("userId");
  const target = await resolveTarget(member, requested, "user:view");
  if (target.error)
    return NextResponse.json({ error: target.error }, { status: target.status });

  const schedules = await db.availabilitySchedule.findMany({
    where: { userId: target.userId },
    orderBy: { dayOfWeek: "asc" },
  });

  // Still a bare array: /app/settings/work-areas and the appointments page both
  // call this expecting Array.isArray(data). Wrapping it in an object to carry
  // the userId back would break both — the same trap noted in
  // /api/settings/members.
  return NextResponse.json(schedules);
}

// PATCH — replace bookable hours
// body: { schedules: [{ dayOfWeek, startTime, endTime, timezone }], userId? }
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member?.userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { schedules } = body;
  if (!Array.isArray(schedules)) {
    return NextResponse.json(
      { error: "schedules array required" },
      { status: 400 },
    );
  }

  const target = await resolveTarget(member, body?.userId, "user:manage");
  if (target.error)
    return NextResponse.json({ error: target.error }, { status: target.status });

  const userId = target.userId;

  await db.availabilitySchedule.deleteMany({ where: { userId } });

  if (schedules.length > 0) {
    await db.availabilitySchedule.createMany({
      data: schedules.map((s) => ({
        userId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        timezone: s.timezone || "America/Toronto",
      })),
    });

    // Setting availability is how a member says "book me" — so make them
    // bookable now by ensuring their consultation event exists.
    //
    // Gated on the TARGET's role, not the caller's. An owner setting a
    // field-only member's hours must not turn that member into a public
    // estimator just because the owner could quote; the check has to be about
    // the person being made bookable. Best-effort — never fail the save.
    const targetMember = await db.member.findFirst({
      where: { companyId: member.companyId, userId },
      select: { role: true, user: { select: { name: true } } },
    });
    if (targetMember && can(targetMember.role, "quote:create")) {
      try {
        await ensureConsultationEventType(
          member.companyId,
          userId,
          targetMember.user?.name,
        );
      } catch (err) {
        console.error("[availability] ensure consultation event failed:", err?.message);
      }
    }
  }

  const updated = await db.availabilitySchedule.findMany({
    where: { userId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json(updated);
}
