// app/api/platform/errors/route.js
//
// The failures support needs to see. GET lists unresolved errors (newest
// first); PATCH marks one resolved so the list stays a to-do rather than an
// archive.
//
// Filterable by area and company. `?resolved=1` shows the archive.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");
  const companyId = searchParams.get("companyId");
  const resolved = searchParams.get("resolved") === "1";
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

  const where = {
    ...(area ? { area } : {}),
    ...(companyId ? { companyId } : {}),
    ...(resolved ? { NOT: { resolvedAt: null } } : { resolvedAt: null }),
  };

  const [errors, areas, unresolvedCount] = await Promise.all([
    db.platformErrorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    // Only areas that actually have unresolved errors — a filter listing areas
    // with nothing in them is noise.
    db.platformErrorLog.groupBy({
      by: ["area"],
      where: { resolvedAt: null },
      _count: true,
    }),
    db.platformErrorLog.count({ where: { resolvedAt: null } }),
  ]);

  // Company names for the rows that have one, resolved in a single query.
  const companyIds = [...new Set(errors.map((e) => e.companyId).filter(Boolean))];
  const companies = companyIds.length
    ? await db.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(companies.map((c) => [c.id, c.name]));

  return NextResponse.json({
    unresolvedCount,
    areas: areas.map((a) => ({ area: a.area, count: a._count })),
    errors: errors.map((e) => ({ ...e, companyName: nameById.get(e.companyId) || null })),
  });
}

// Acknowledge. Writes who cleared it, so "who decided this was fine" has an
// answer. Superadmin-scoped write since it changes the shared support queue.
export async function PATCH(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((i) => typeof i === "string") : [];
  if (!ids.length) {
    return NextResponse.json({ error: "No error ids given" }, { status: 400 });
  }

  await db.platformErrorLog.updateMany({
    where: { id: { in: ids } },
    data: { resolvedAt: new Date(), resolvedBy: admin.id || admin.email || "platform" },
  });

  return NextResponse.json({ ok: true, resolved: ids.length });
}
