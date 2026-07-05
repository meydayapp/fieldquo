// app/api/platform/companies/[id]/impersonate/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import {
  startImpersonation,
  endImpersonation,
} from "@/lib/platform/impersonate";

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({ where: { id: params.id } });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { reason } = await request.json().catch(() => ({}));

  const token = await startImpersonation({
    platformAdminId: admin.id,
    companyId: params.id,
    reason: reason || null,
  });

  const response = NextResponse.json({
    success: true,
    companyName: company.name,
  });

  response.cookies.set("impersonation-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 60, // matches IMPERSONATION_DURATION in lib/platform/impersonate.js
    path: "/",
  });

  return response;
}

export async function DELETE(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await endImpersonation({ platformAdminId: admin.id, companyId: params.id });

  const response = NextResponse.json({ success: true });
  response.cookies.set("impersonation-token", "", { maxAge: 0, path: "/" });
  return response;
}
