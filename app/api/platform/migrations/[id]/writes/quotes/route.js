// app/api/platform/migrations/[id]/writes/quotes/route.js
//
// The sanctioned write, primitive #2: a superadmin records a historical Quote
// inside the company's own tenant — see lib/migrations/writes.js for exactly
// what this does and does not create (no scope groups, no costing, `draft`
// status, never sent to a client).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { writeMigratedQuote } from "@/lib/migrations/writes";
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
    const quote = await writeMigratedQuote({
      migrationRequestId: migration.id,
      companyId: migration.companyId,
      platformAdminId: admin.id,
      input,
    });
    return NextResponse.json({ quote }, { status: 201 });
  } catch (err) {
    return bad(err.message, err.status || 500);
  }
}
