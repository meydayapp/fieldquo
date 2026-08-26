// app/api/work-areas/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can, requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

// The ids in `userIds` arrive from a browser and are written straight into a
// join table, so they get checked against this company's roster first — same
// rule as assigning a lead owner (app/api/leads/[id]/route.js). Without it a
// hand-posted request attaches a user from another tenant to a work area, and
// from then on they appear in the assignment list of a company they've never
// heard of. Rejects rather than silently dropping: quietly assigning three of
// the four people you picked is the kind of control that looks like it worked.
async function assertCompanyUsers(companyId, userIds) {
  const found = await db.member.findMany({
    where: { companyId, userId: { in: userIds } },
    select: { userId: true },
  });
  const ok = new Set(found.map((m) => m.userId));
  return userIds.filter((id) => !ok.has(id));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  if (userIds?.length) {
    const strangers = await assertCompanyUsers(member.companyId, userIds);
    if (strangers.length)
      return NextResponse.json(
        { error: "Some of those people aren't on your team." },
        { status: 400 },
      );
  }

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
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  if (userIds.length) {
    const strangers = await assertCompanyUsers(member.companyId, userIds);
    if (strangers.length)
      return NextResponse.json(
        { error: "Some of those people aren't on your team." },
        { status: 400 },
      );
  }

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
