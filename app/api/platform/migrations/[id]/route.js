// app/api/platform/migrations/[id]/route.js
//
// One migration request, from the platform side — the company, the
// consultation, the quote, the documents the company uploaded, and the full
// MigrationWrite audit trail of what has been written into their tenant so
// far. Read-only; every state change has its own route.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function GET(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      writes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!migration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const company = await db.company.findUnique({
    where: { id: migration.companyId },
    select: { id: true, name: true, slug: true, email: true, phone: true, currency: true },
  });

  // Names for the plain-string actor columns (requestedById, respondedById,
  // quotedById, hostAdminId, cancelledById, and each write's platformAdminId)
  // — resolved in a couple of batched queries rather than a join per row,
  // same pattern app/api/platform/audit-log/route.js uses for target company
  // names.
  const userIds = [migration.requestedById, migration.respondedById, migration.cancelledById].filter(Boolean);
  const adminIds = [
    migration.hostAdminId,
    migration.quotedById,
    migration.cancelledById,
    ...migration.writes.map((w) => w.platformAdminId),
  ].filter(Boolean);

  const [users, admins] = await Promise.all([
    userIds.length
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [],
    adminIds.length
      ? db.platformAdmin.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })
      : [],
  ]);
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const adminById = Object.fromEntries(admins.map((a) => [a.id, a]));

  return NextResponse.json({
    request: migration,
    company,
    people: { users: userById, admins: adminById },
  });
}
