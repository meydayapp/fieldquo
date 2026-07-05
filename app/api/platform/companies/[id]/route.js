// app/api/platform/companies/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: params.id },
    include: {
      subscription: { include: { plan: true } },
      members: { include: { user: { select: { name: true, email: true } } } },
      _count: { select: { quotes: true, invoices: true, jobs: true } },
    },
  });

  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.company.findUnique({ where: { id: params.id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { onboardingStatus, name } = body;

  const updated = await db.company.update({
    where: { id: params.id },
    data: {
      ...(onboardingStatus !== undefined && { onboardingStatus }),
      ...(name !== undefined && { name }),
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action:
        onboardingStatus === "suspended"
          ? "company_suspended"
          : "company_updated",
      targetCompanyId: params.id,
      details: body,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:suspend");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const existing = await db.company.findUnique({ where: { id: params.id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Suspend, don't hard-delete — a company with real client/financial data shouldn't
  // be one DELETE call away from gone. If you genuinely need permanent deletion later,
  // that should be a deliberate, separate, harder-to-trigger operation.
  await db.company.update({
    where: { id: params.id },
    data: { onboardingStatus: "churned" },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "company_deletion_requested",
      targetCompanyId: params.id,
    },
  });

  return NextResponse.json({
    success: true,
    note: "Company marked as churned, not deleted. Contact engineering for permanent deletion.",
  });
}
