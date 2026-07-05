// app/api/event-types/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eventTypes = await db.eventType.findMany({
    where: { companyId: member.companyId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(eventTypes);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
