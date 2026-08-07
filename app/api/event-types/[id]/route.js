// app/api/event-types/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.eventType.findFirst({
    where: { id: _params.id, companyId: member.companyId },
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
    feeCents,
    promoFeeCents,
    promoActive,
  } = body;

  // Fees are non-negative integer cents; 0 is stored as null ("free") so the
  // booking page has one clear signal for "no charge". Clamped, not trusted.
  const cleanCents = (v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 100000000) : null;
  };

  const updated = await db.eventType.update({
    where: { id: _params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(durationMinutes !== undefined && { durationMinutes }),
      ...(bufferBefore !== undefined && { bufferBefore }),
      ...(bufferAfter !== undefined && { bufferAfter }),
      ...(location !== undefined && { location }),
      ...(active !== undefined && { active }),
      ...(userId !== undefined && { userId }),
      ...(cleanCents(feeCents) !== undefined && { feeCents: cleanCents(feeCents) }),
      ...(cleanCents(promoFeeCents) !== undefined && {
        promoFeeCents: cleanCents(promoFeeCents),
      }),
      ...(promoActive !== undefined && { promoActive: Boolean(promoActive) }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.eventType.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const futureBookings = await db.booking.count({
    where: {
      eventTypeId: _params.id,
      status: "confirmed",
      startTime: { gte: new Date() },
    },
  });

  if (futureBookings > 0) {
    // Deactivate instead of delete — don't orphan a client's upcoming booking
    await db.eventType.update({
      where: { id: _params.id },
      data: { active: false },
    });
    return NextResponse.json({
      success: true,
      deactivated: true,
      note: `Has ${futureBookings} upcoming booking(s) — deactivated instead of deleted`,
    });
  }

  await db.eventType.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true, deleted: true });
}
