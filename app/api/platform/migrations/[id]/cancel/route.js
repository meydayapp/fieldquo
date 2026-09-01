// app/api/platform/migrations/[id]/cancel/route.js
//
// Superadmin cancel — the WIDE door, reachable from `paid` and `in_progress`
// as well as everything the company's own cancel route can reach. This is
// what makes "a migration for a company that has since cancelled" a real,
// exercised state rather than a hypothetical: cancel this from `paid`, and
// the write routes (canWrite() in lib/migrations/state.js) refuse immediately
// on the next call, even though a moment earlier they would have succeeded.
//
// Superadmin-only ("migration:cancel"). Does NOT issue a Stripe refund —
// see docs/MIGRATION-SERVICE.md for why that's explicitly out of scope here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { canCancel, describeStatus } from "@/lib/migrations/state";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "migration:cancel");
  } catch {
    return bad("Only a superadmin can cancel a migration.", 403);
  }

  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration) return bad("Not found", 404);

  if (!canCancel(migration.status)) {
    return bad(
      `This migration is already ${describeStatus(migration.status)} and can't be cancelled.`,
      409,
    );
  }

  const body = await request.json().catch(() => ({}));

  const updated = await db.migrationRequest.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledById: admin.id,
      cancelReason: String(body?.reason || "").trim().slice(0, 2000) || null,
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "migration_cancelled",
      targetCompanyId: migration.companyId,
      details: { migrationRequestId: id, fromStatus: migration.status, reason: updated.cancelReason },
    },
  });

  return NextResponse.json({ request: updated });
}
