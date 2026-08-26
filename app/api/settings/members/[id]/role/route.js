// app/api/settings/members/[id]/role/route.js
//
// Change a team member's role and granular permissions.
//
// Deliberately its own route rather than part of the general member PATCH.
// Role changes are the privilege-escalation surface — keeping them isolated
// means the escalation rules live in one place that's easy to audit, instead
// of being one branch inside a handler that also edits phone numbers.
//
// Uses "user:manage" as the entry gate, which supervisors already hold, then
// applies the hierarchy rules in lib/permissions/roleManagement.js on top.
// The coarse permission answers "may you manage people at all"; the rules
// answer "which people, and to what".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import {
  assignableRoles,
  clampPermissions,
  validateRoleChange,
} from "@/lib/permissions/roleManagement";

export async function PATCH(request, { params }) {
  const { id } = await params;

  const { member: actor, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(actor.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "You don't have permission to manage team members." },
      { status: 403 },
    );
  }

  const target = await db.member.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      companyId: true,
      permissions: true,
      user: { select: { name: true, email: true } },
    },
  });

  // Same 404 for "doesn't exist" and "belongs to another company" — telling
  // the caller a member id is real but not theirs leaks across tenants.
  if (!target || target.companyId !== actor.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { role: nextRole, permissions: requestedPermissions } = await request
    .json()
    .catch(() => ({}));

  const ownerCount = await db.member.count({
    where: { companyId: actor.companyId, role: "owner", active: true },
  });

  const actorMember = await db.member.findUnique({
    where: { id: actor.id },
    select: { id: true, role: true, permissions: true },
  });

  const check = validateRoleChange({
    actor: actorMember,
    target,
    nextRole,
    ownerCount,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  // Clamp the granular grid to what the actor themselves holds. A supervisor
  // with view-only quotes cannot hand out edit access, regardless of what the
  // client sends.
  const permissions =
    requestedPermissions === undefined
      ? undefined
      : clampPermissions(
          actorMember.role,
          actorMember.permissions,
          requestedPermissions,
        );

  const updated = await db.member.update({
    where: { id },
    data: {
      ...(nextRole !== undefined && { role: nextRole }),
      ...(permissions !== undefined && { permissions }),
    },
    select: {
      id: true,
      role: true,
      permissions: true,
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    member: updated,
    // Whether the request was reduced on the way through. The UI shows this
    // rather than silently saving something narrower than what was ticked —
    // an admin who thinks they granted access and didn't is worse off than
    // one who was told no.
    clamped:
      requestedPermissions !== undefined &&
      JSON.stringify(permissions) !== JSON.stringify(requestedPermissions),
  });
}

/** Which roles the caller may assign, for populating the UI. */
export async function GET(request) {
  const { member: actor, response } = await memberOrRefusal(request);
  if (response) return response;

  const actorMember = await db.member.findUnique({
    where: { id: actor.id },
    select: { role: true, permissions: true },
  });

  return NextResponse.json({
    assignableRoles: assignableRoles(actorMember?.role),
    yourRole: actorMember?.role,
    yourPermissions: actorMember?.permissions || null,
  });
}
