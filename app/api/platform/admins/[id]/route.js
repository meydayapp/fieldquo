// app/api/platform/admins/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can manage platform team members" },
      { status: 403 },
    );
  }

  if (_params.id === admin.id) {
    return NextResponse.json(
      { error: "You can't change your own role or deactivate yourself" },
      { status: 400 },
    );
  }

  const existing = await db.platformAdmin.findUnique({
    where: { id: _params.id },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, active } = await request.json();

  if (role && !["support", "admin", "superadmin"].includes(role)) {
    return NextResponse.json(
      { error: "role must be support, admin, or superadmin" },
      { status: 400 },
    );
  }

  const updated = await db.platformAdmin.update({
    where: { id: _params.id },
    data: {
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
    },
    select: { id: true, email: true, role: true, active: true },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action:
        active === false
          ? "platform_admin_deactivated"
          : "platform_admin_updated",
      details: { targetAdminId: _params.id, changes: { role, active } },
    },
  });

  return NextResponse.json(updated);
}
