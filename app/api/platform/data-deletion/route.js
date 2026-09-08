// app/api/platform/data-deletion/route.js
//
// The register of data-deletion requests, for the platform console.
//
// Superadmin only — "data_deletion:manage" is in SUPERADMIN_ONLY_PERMISSIONS
// (lib/platform/permissions.js). Reading, not just completing, is gated:
// every row is a stranger's name, email and free text, and the audience for
// that is the one person who is going to carry the deletion out.
//
// Reads FieldQuo's own table. Nothing here touches a company's records.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { DATA_DELETION_STATUSES } from "@/lib/dataDeletion/requests";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "data_deletion:manage");
  } catch {
    return NextResponse.json(
      { error: "Only a superadmin can see data deletion requests." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  if (status && !DATA_DELETION_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const [rows, counts] = await Promise.all([
    db.dataDeletionRequest.findMany({
      where: status ? { status } : {},
      // Oldest first for the open queue — the one nearest its 30-business-day
      // promise is the one to do next — newest first otherwise.
      orderBy: { receivedAt: status === "received" ? "asc" : "desc" },
      take: 200,
    }),
    db.dataDeletionRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  return NextResponse.json({
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}
