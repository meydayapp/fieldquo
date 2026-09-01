// app/api/platform/migrations/[id]/writes/clients/route.js
//
// The sanctioned write, primitive #1: a superadmin creates a Client row
// inside the company's own tenant, entered by hand from whatever the company
// handed over (a QuickBooks contact list, a paper ledger). Gated on
// "migration:write" (superadmin only) AND on the state machine, re-checked
// fresh inside lib/migrations/writes.js's own transaction — the permission
// check here is a fast, cheap first refusal; the one that actually matters is
// the one that can't be raced.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { writeMigratedClient } from "@/lib/migrations/writes";
import { db } from "@/lib/db";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request, { params }) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  try {
    requirePlatformPermission(admin.role, "migration:write");
  } catch {
    return bad("Only a superadmin can write into a company's account.", 403);
  }

  const { id } = await params;
  const migration = await db.migrationRequest.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  });
  if (!migration) return bad("Not found", 404);

  const input = await request.json().catch(() => ({}));

  try {
    const client = await writeMigratedClient({
      migrationRequestId: migration.id,
      companyId: migration.companyId,
      platformAdminId: admin.id,
      input,
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    return bad(err.message, err.status || 500);
  }
}
