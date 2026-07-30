// app/api/team/quick-add/route.js — only the invitation block changes
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission, presetPermissionsFor } from "@/lib/permissions";
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
    permissions,
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

  const cleanEmail = String(email).trim().toLowerCase();

  // Refuse duplicates before creating anything. Without this, adding the same
  // person twice produced a second Worker row (so they appeared twice in
  // payroll and timesheets) and a second invitation.
  const [existingMember, existingWorker, pendingInvite] = await Promise.all([
    db.member.findFirst({
      where: { companyId: member.companyId, user: { email: cleanEmail } },
      select: { id: true, active: true },
    }),
    db.worker.findFirst({
      where: { companyId: member.companyId, email: cleanEmail },
      select: { id: true },
    }),
    db.invitation.findFirst({
      where: { organizationId: member.authOrgId, email: cleanEmail, status: "pending" },
      select: { id: true },
    }),
  ]);

  if (existingMember) {
    return NextResponse.json(
      { error: "Someone with that email is already on your team." },
      { status: 409 },
    );
  }
  if (existingWorker) {
    return NextResponse.json(
      { error: "You already have a team member with that email address." },
      { status: 409 },
    );
  }
  if (pendingInvite) {
    return NextResponse.json(
      { error: "That email already has an invitation waiting. Resend it from Manage Team instead." },
      { status: 409 },
    );
  }

  const worker = await db.worker.create({
    data: {
      companyId: member.companyId,
      name: `${firstName} ${lastName}`.trim(),
      email: cleanEmail,
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
    // Pass FieldQuo's REAL role, not a Better Auth "admin"/"member" mapping.
    //
    // This was a live bug: the accept flow writes `Member.role =
    // invitation.role`, so mapping supervisor/employee down to "member" created
    // a Member whose role isn't in PERMISSIONS at all — `can()` then returned
    // false for everything and the person could do nothing after accepting.
    // organizationId must be the Better Auth org id, not Company.id.
    invite = await auth.api.createInvitation({
      body: { email: cleanEmail, role, organizationId: member.authOrgId },
      headers: request.headers,
    });
  } catch (err) {
    // The invite is the whole point — a Worker row with no way to sign in is a
    // half-created teammate. Roll it back rather than leaving an orphan that
    // shows up in payroll for someone who can't log in.
    await db.worker.delete({ where: { id: worker.id } }).catch(() => {});
    return NextResponse.json(
      { error: err.message || "Could not send the invitation. Nothing was created." },
      { status: 502 },
    );
  }

  // Carry the granular permission grid to the Member row that gets created on
  // accept — same mechanism /api/settings/members uses. Without this, quick-add
  // produced a member with no permissions saved at all.
  await db.pendingTeamProfile.upsert({
    where: { companyId_email: { companyId: member.companyId, email: cleanEmail } },
    create: {
      companyId: member.companyId,
      email: cleanEmail,
      name: `${firstName} ${lastName}`.trim(),
      phone: phone || null,
      address: address || null,
      city: city || null,
      province: province || null,
      laborCostPerHour: hourlyRate ? Number(hourlyRate) : null,
      permissions: permissions || presetPermissionsFor(role),
    },
    update: {
      name: `${firstName} ${lastName}`.trim(),
      phone: phone || null,
      permissions: permissions || presetPermissionsFor(role),
    },
  });

  return NextResponse.json({ worker, invite }, { status: 201 });
}
