// app/api/team/quick-add/route.js — only the invitation block changes
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { checkUserLimit } from "@/lib/platform/planLimits";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can add employees" },
      { status: 403 },
    );
  }

  const limitCheck = await checkUserLimit(member.companyId);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Plan limit reached: ${limitCheck.currentCount}/${limitCheck.limit} licenses.`,
      },
      { status: 402 },
    );
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    province,
    role,
    workerType,
    hourlyRate,
  } = await request.json();

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: "First name, last name, and email are required" },
      { status: 400 },
    );
  }
  if (!["admin", "supervisor", "employee"].includes(role)) {
    return NextResponse.json(
      { error: "role must be admin, supervisor, or employee" },
      { status: 400 },
    );
  }

  const worker = await db.worker.create({
    data: {
      companyId: member.companyId,
      name: `${firstName} ${lastName}`.trim(),
      email,
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      type: workerType === "contractor" ? "contractor" : "employee",
      hourlyRate: hourlyRate ? Number(hourlyRate) : null,
    },
  });

  let invite = null;
  try {
    // Better Auth's org plugin only knows "admin"/"member" — FieldQuo's real
    // role (owner/admin/supervisor/employee) lives on the Member row above,
    // not here. organizationId must be the Better Auth org id, not Company.id.
    const betterAuthRole = role === "admin" ? "admin" : "member";

    invite = await auth.api.createInvitation({
      body: { email, role: betterAuthRole, organizationId: member.authOrgId },
      headers: request.headers,
    });
  } catch (err) {
    return NextResponse.json(
      { worker, inviteError: err.message || "Could not send invite email" },
      { status: 201 },
    );
  }

  return NextResponse.json({ worker, invite }, { status: 201 });
}
