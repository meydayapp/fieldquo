// app/api/platform/migrations/[id]/complete/route.js
//
// The superadmin declares the import finished. Closes the write path for
// good (canWrite() only accepts `paid`/`in_progress`) — a migration marked
// completed cannot be written into again even by the same superadmin;
// starting a NEW MigrationRequest is the honest way to bring in more later.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { canComplete, describeStatus } from "@/lib/migrations/state";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "migration:write");
  } catch {
    return bad("Only a superadmin can close out a migration.", 403);
  }

  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({ where: { id } });
  if (!migration) return bad("Not found", 404);

  if (!canComplete(migration.status)) {
    return bad(
      `This migration is ${describeStatus(migration.status)} — it can't be marked completed from there.`,
      409,
    );
  }

  const updated = await db.migrationRequest.update({
    where: { id },
    data: { status: "completed", completedAt: new Date() },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "migration_completed",
      targetCompanyId: migration.companyId,
      details: { migrationRequestId: id },
    },
  });

  return NextResponse.json({ request: updated });
}
