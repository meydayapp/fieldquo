// app/api/platform/companies/[id]/impersonate/route.js
//
// Starts and ends a read-only support session. Superadmin only — enforced in
// startImpersonation rather than here, so the check can't be bypassed by
// another route that forgets it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import {
  startImpersonation,
  endImpersonation,
  IMPERSONATION_COOKIE,
  IMPERSONATION_DURATION_SECONDS,
} from "@/lib/platform/impersonate";

export async function POST(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { reason } = await request.json().catch(() => ({}));

  // This can fail for several actionable reasons — a missing signing secret,
  // a non-superadmin, a deactivated account. Returning JSON rather than
  // letting it become a 500 HTML page is what makes the message legible in
  // the browser instead of a parser complaint.
  let token;
  try {
    token = await startImpersonation({
      platformAdminId: admin.id,
      companyId: id,
      reason: reason || null,
    });
  } catch (err) {
    console.error("[impersonate] failed to start:", err);
    return NextResponse.json(
      { error: err.message || "Couldn't start a support session." },
      { status: err.status || 500 },
    );
  }

  const response = NextResponse.json({
    success: true,
    companyName: company.name,
    mode: "read_only",
    expiresInSeconds: IMPERSONATION_DURATION_SECONDS,
  });

  response.cookies.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: IMPERSONATION_DURATION_SECONDS,
    path: "/",
  });

  return response;
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Best-effort audit write — clearing the cookie has to succeed regardless,
  // or an admin could get stuck inside a session they can't leave.
  try {
    await endImpersonation({ platformAdminId: admin.id, companyId: id });
  } catch (err) {
    console.error("[impersonate] failed to log end:", err);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(IMPERSONATION_COOKIE, "", { maxAge: 0, path: "/" });
  return response;
}
