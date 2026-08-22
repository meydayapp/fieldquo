// app/api/platform/analytics/tenants/route.js
//
// GET — how the companies using FieldQuo are doing.
//
// Separate from /api/platform/analytics/overview on purpose. That route
// answers "how is FieldQuo doing"; mixing the two is what let $473,558 of
// CUSTOMERS' invoices read as FieldQuo revenue on the same screen.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { collectTenantAnalytics } from "@/lib/analytics/tenantData";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "analytics:view");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  // Optional window. All-time by default: with a handful of live companies,
  // a 30-day slice would report almost nothing and read as a broken page
  // rather than as a young business.
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days"));
  const since =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() - days * 86400000)
      : null;

  try {
    return NextResponse.json(await collectTenantAnalytics(db, { since }));
  } catch (err) {
    console.error("[analytics/tenants]", err);
    return NextResponse.json(
      { error: "Couldn't work out tenant analytics just now." },
      { status: 500 },
    );
  }
}
