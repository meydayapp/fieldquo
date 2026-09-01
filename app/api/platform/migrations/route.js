// app/api/platform/migrations/route.js
//
// The platform console's list of every company's migration requests. Any
// platform admin may see this — same "every role should be able to see what
// was done" reasoning app/api/platform/audit-log/route.js gives — but only a
// superadmin can act on one (quote, write, cancel), enforced at each of those
// routes individually.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const rows = await db.migrationRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const companyIds = [...new Set(rows.map((r) => r.companyId))];
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const companyById = Object.fromEntries(companies.map((c) => [c.id, c]));

  return NextResponse.json({
    requests: rows.map((r) => ({ ...r, company: companyById[r.companyId] || null })),
  });
}
