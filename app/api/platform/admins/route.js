// app/api/platform/admins/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admins = await db.platformAdmin.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(admins);
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can add platform team members" },
      { status: 403 },
    );
  }

  const { email, password, role } = await request.json();

  if (!email || !password || !role) {
    return NextResponse.json(
      { error: "email, password, and role are required" },
      { status: 400 },
    );
  }
  if (!["support", "admin", "superadmin"].includes(role)) {
    return NextResponse.json(
      { error: "role must be support, admin, or superadmin" },
      { status: 400 },
    );
  }
  if (password.length < 12) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 12 characters — this account can touch every company's data",
      },
      { status: 400 },
    );
  }

  const existing = await db.platformAdmin.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newAdmin = await db.platformAdmin.create({
    data: { email: email.toLowerCase(), passwordHash, role, active: true },
    select: { id: true, email: true, role: true, active: true },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "platform_admin_created",
      details: { newAdminEmail: newAdmin.email, role: newAdmin.role },
    },
  });

  return NextResponse.json(newAdmin, { status: 201 });
}
