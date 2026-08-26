// app/api/event-types/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

// Same gate as POST on the collection route, and for the same reason: this
// handler writes feeCents/promoFeeCents, which is the amount a homeowner is
// asked for on the public booking page. Neither handler had a role check.
function manageGate(member) {
  try {
    requirePermission(member.role, "user:manage");
    return null;
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins and supervisors can change booking types" },
      { status: err.status || 403 },
    );
  }
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const denied = manageGate(member);
  if (denied) return denied;

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

  // Same tenant check the create does — reassigning the calendar is the one
  // field here that names somebody who might not be on this team.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    ...(userId !== undefined && { userId }),
  });
  if (notOurs) return notOurs;

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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const denied = manageGate(member);
  if (denied) return denied;

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
