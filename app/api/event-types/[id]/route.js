// app/api/event-types/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.eventType.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    name,
    durationMinutes,
    bufferBefore,
    bufferAfter,
    location,
    active,
    userId,
  } = body;

  const updated = await db.eventType.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(durationMinutes !== undefined && { durationMinutes }),
      ...(bufferBefore !== undefined && { bufferBefore }),
      ...(bufferAfter !== undefined && { bufferAfter }),
      ...(location !== undefined && { location }),
      ...(active !== undefined && { active }),
      ...(userId !== undefined && { userId }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.eventType.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const futureBookings = await db.booking.count({
    where: {
      eventTypeId: params.id,
      status: "confirmed",
      startTime: { gte: new Date() },
    },
  });

  if (futureBookings > 0) {
    // Deactivate instead of delete — don't orphan a client's upcoming booking
    await db.eventType.update({
      where: { id: params.id },
      data: { active: false },
    });
    return NextResponse.json({
      success: true,
      deactivated: true,
      note: `Has ${futureBookings} upcoming booking(s) — deactivated instead of deleted`,
    });
  }

  await db.eventType.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true, deleted: true });
}
