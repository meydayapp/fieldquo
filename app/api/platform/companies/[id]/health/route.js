// app/api/platform/companies/[id]/health/route.js
//
// Support's first read on a company: a health score and the signals behind it.
// Read-only and company:view gated — the platform console looks at everything
// and changes nothing (non-negotiable #3).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { companyHealth } from "@/lib/platform/companyHealth";

export async function GET(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const health = await companyHealth(id);
  if (!health) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(health);
}
