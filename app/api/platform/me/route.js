// app/api/platform/me/route.js
//
// The signed-in platform admin's own identity and role.
//
// Needed because the JWT payload isn't readable client-side (httpOnly cookie),
// so a screen that wants to know "am I a superadmin?" has to ask. Returns the
// permission list too, so UI can hide controls the API would reject rather
// than showing buttons that 403.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { PLATFORM_PERMISSIONS } from "@/lib/platform/permissions";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Re-read from the database rather than trusting the token alone. A role
  // change or deactivation shouldn't wait for a 12-hour JWT to expire before
  // it takes effect.
  const current = await db.platformAdmin.findUnique({
    where: { id: admin.id },
    select: { id: true, email: true, role: true, active: true },
  });

  if (!current || !current.active) {
    return NextResponse.json(
      { error: "Account is no longer active" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ...current,
    permissions: PLATFORM_PERMISSIONS[current.role] || [],
  });
}
