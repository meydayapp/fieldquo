// app/api/event-types/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const eventTypes = await db.eventType.findMany({
    where: { companyId: member.companyId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(eventTypes);
}

// An event type is a public-facing object: it appears on /book, and its
// feeCents/promoFeeCents are what a homeowner is charged to hold a slot. It had
// no role gate, so any employee could add a bookable service — or price one —
// on the company's public booking page. "user:manage" is the same bar the
// booking-page settings screen sits behind.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins and supervisors can change booking types" },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const { name, durationMinutes, bufferBefore, bufferAfter, location, userId } =
    body;

  if (!name || !durationMinutes) {
    return NextResponse.json(
      { error: "name and durationMinutes are required" },
      { status: 400 },
    );
  }

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const existing = await db.eventType.findUnique({
    where: { companyId_slug: { companyId: member.companyId, slug } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An event type with a similar name already exists" },
      { status: 409 },
    );
  }

  // `userId` names WHOSE calendar this event type books. Unchecked, it could
  // name a user in another company — and /api/booking/[slug]/members renders
  // the assigned person on the public booking page, so the leak lands on a
  // client-facing surface.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { userId });
  if (notOurs) return notOurs;

  const eventType = await db.eventType.create({
    data: {
      companyId: member.companyId,
      userId: userId || member.userId,
      name,
      slug,
      durationMinutes,
      bufferBefore: bufferBefore || 0,
      bufferAfter: bufferAfter || 0,
      location: location || null,
    },
  });

  return NextResponse.json(eventType, { status: 201 });
}
