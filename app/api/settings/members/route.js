// app/api/settings/members/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { checkUserLimit } from "@/lib/platform/planLimits";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await db.member.findMany({
    where: { companyId: member.companyId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

// Invites a new team member via Better Auth's organization plugin — this sends the
// actual invite email; the user becomes a Member once they accept.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can invite team members" },
      { status: 403 },
    );
  }

  const limitCheck = await checkUserLimit(member.companyId);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Plan limit reached: ${limitCheck.currentCount}/${limitCheck.limit} users. Upgrade to invite more.`,
      },
      { status: 402 },
    );
  }

  const { email, role } = await request.json();
  if (!email)
    return NextResponse.json({ error: "email is required" }, { status: 400 });

  if (!["admin", "supervisor", "employee"].includes(role)) {
    return NextResponse.json(
      { error: "role must be admin, supervisor, or employee" },
      { status: 400 },
    );
  }

  const invite = await auth.api.createInvitation({
    body: { email, role, organizationId: member.companyId },
    headers: request.headers,
  });

  return NextResponse.json(invite, { status: 201 });
}

// Change an existing member's role, or deactivate them
export async function PATCH(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can manage team members" },
      { status: 403 },
    );
  }

  const { userId, role, active } = await request.json();
  if (!userId)
    return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const target = await db.member.findUnique({
    where: { userId_companyId: { userId, companyId: member.companyId } },
  });
  if (!target)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.role === "owner" && role && role !== "owner") {
    return NextResponse.json(
      { error: "The owner's role can't be changed here" },
      { status: 400 },
    );
  }

  const updated = await db.member.update({
    where: { userId_companyId: { userId, companyId: member.companyId } },
    data: {
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
    },
  });

  return NextResponse.json(updated);
}
