// app/api/platform/companies/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

// Next 16: params is a Promise and must be awaited. Reading params.id
// synchronously resolves to undefined, which turns every lookup on this route
// into a 404 that looks like missing data rather than a bug.
export async function GET(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const company = await db.company.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      members: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      // Client and quote counts only — not the records themselves. Aggregates
      // give support the context they need without putting every homeowner's
      // name and address in front of staff by default.
      // ── Every number here is billed to FieldQuo ────────────────────────
      //
      // Numbers are provisioned on FieldQuo's own Retell account and charged
      // to FieldQuo monthly, whether or not the tenant's prepaid balance ever
      // covers them. The company's own settings screen shows its numbers and
      // even warns "don't buy another one, this one is already being charged
      // for" — and nothing showed the same thing to the person actually paying.
      //
      // Big painter Inc is carrying two numbers stuck in `provisioning` and
      // one in `porting`: rent going out against lines nothing can answer on.
      // That was invisible from this console.
      voiceNumbers: {
        select: {
          id: true,
          e164: true,
          source: true,
          numberType: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { quotes: true, invoices: true, jobs: true, clients: true },
      },
    },
  });

  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(company);
}

export async function PATCH(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { onboardingStatus, name } = body;

  // Suspending a company cuts off a paying customer's access — a heavier
  // action than renaming, and gated accordingly. Support can do neither.
  const needed =
    onboardingStatus === "churned" || onboardingStatus === "suspended"
      ? "company:suspend"
      : "company:manage";

  try {
    requirePlatformPermission(admin.role, needed);
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const existing = await db.company.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.company.update({
    where: { id },
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
      targetCompanyId: id,
      // Record what it was as well as what it became — an audit entry saying
      // only "status changed to churned" can't answer "changed from what?".
      details: { ...body, previousStatus: existing.onboardingStatus },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;

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

  const existing = await db.company.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Suspend, don't hard-delete — a company with real client/financial data shouldn't
  // be one DELETE call away from gone. If you genuinely need permanent deletion later,
  // that should be a deliberate, separate, harder-to-trigger operation.
  await db.company.update({
    where: { id },
    data: { onboardingStatus: "churned" },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "company_deletion_requested",
      targetCompanyId: id,
      details: { previousStatus: existing.onboardingStatus },
    },
  });

  return NextResponse.json({
    success: true,
    note: "Company marked as churned, not deleted. Contact engineering for permanent deletion.",
  });
}
