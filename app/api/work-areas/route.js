// app/api/work-areas/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can, requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workAreas = await db.workArea.findMany({
    where: { companyId: member.companyId },
    include: {
      assignments: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { tasks: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(workAreas);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "workarea:assign");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const { name, description, userIds } = body;

  if (!name)
    return NextResponse.json({ error: "name is required" }, { status: 400 });

  const workArea = await db.workArea.create({
    data: {
      companyId: member.companyId,
      name,
      description: description || null,
      ...(userIds?.length && {
        assignments: { create: userIds.map((userId) => ({ userId })) },
      }),
    },
    include: {
      assignments: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(workArea, { status: 201 });
}

// Reassigning who's on a work area — separate from PATCH-on-name since it's a
// different permission concern (workarea:assign specifically)
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workAreaId, userIds } = await request.json();
  if (!workAreaId || !Array.isArray(userIds)) {
    return NextResponse.json(
      { error: "workAreaId and userIds array are required" },
      { status: 400 },
    );
  }

  try {
    requirePermission(member.role, "workarea:assign");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const existing = await db.workArea.findFirst({
    where: { id: workAreaId, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction([
    db.workAreaAssignment.deleteMany({ where: { workAreaId } }),
    ...(userIds.length
      ? [
          db.workAreaAssignment.createMany({
            data: userIds.map((userId) => ({ workAreaId, userId })),
          }),
        ]
      : []),
  ]);

  const updated = await db.workArea.findUnique({
    where: { id: workAreaId },
    include: {
      assignments: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(updated);
}
