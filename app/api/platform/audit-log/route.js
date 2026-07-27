// app/api/platform/audit-log/route.js
//
// Read-only view of PlatformAuditLog: which staff member did what, to which
// company, when.
//
// Deliberately has no POST, PATCH or DELETE. Audit rows are written as a side
// effect of the actions they record (see the company and impersonate routes),
// and an audit trail an admin can edit isn't an audit trail. If a row is
// wrong, the fix is to record a correcting action, not to rewrite history.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

const PAGE_SIZE = 50;

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // No permission gate beyond being a platform admin. Every role — including
  // support — should be able to see what was done and by whom, including
  // their own actions. Restricting visibility of an audit log to senior staff
  // defeats most of its purpose.

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const companyId = searchParams.get("companyId");
  const adminId = searchParams.get("adminId");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const where = {
    ...(action && { action }),
    ...(companyId && { targetCompanyId: companyId }),
    ...(adminId && { platformAdminId: adminId }),
  };

  const [rows, total, actions, admins] = await Promise.all([
    db.platformAuditLog.findMany({
      where,
      include: {
        platformAdmin: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.platformAuditLog.count({ where }),
    // Distinct action values, so the filter dropdown reflects what has
    // actually happened rather than a hardcoded list that drifts as new
    // actions get logged.
    db.platformAuditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    db.platformAdmin.findMany({
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    }),
  ]);

  // Target company names in one query rather than a join per row — the
  // relation is a loose id, not a foreign key, so Prisma can't include it.
  const companyIds = [
    ...new Set(rows.map((r) => r.targetCompanyId).filter(Boolean)),
  ];
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return NextResponse.json({
    rows: rows.map((r) => ({
      ...r,
      targetCompanyName: r.targetCompanyId
        ? nameById[r.targetCompanyId] || "(deleted company)"
        : null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    filters: {
      actions: actions.map((a) => a.action),
      admins,
    },
  });
}
