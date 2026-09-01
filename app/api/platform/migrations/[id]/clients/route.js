// app/api/platform/migrations/[id]/clients/route.js
//
// The company's own client list, for the "write a migrated quote" form's
// client picker — a READ of the company's data, which non-negotiable #3
// already permits any platform admin. Writing a NEW client goes through
// writes/clients (superadmin-only, logged); this route never creates
// anything.
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
    select: { companyId: true },
  });
  if (!migration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clients = await db.client.findMany({
    where: { companyId: migration.companyId },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  return NextResponse.json({ clients });
}
