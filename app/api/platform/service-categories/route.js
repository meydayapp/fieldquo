// app/api/platform/service-categories/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

// Manages the GLOBAL catalog every company's Settings → Services page pulls from.
// This is not company data — it's the shared seed list (cabinet_refinishing,
// flooring, etc.) that companies then enable/price individually via
// CompanyServiceCategory.
export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await db.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // This edits a table every company reads. Support shouldn't be able to add
  // a service category that appears in every tenant's onboarding.
  try {
    requirePlatformPermission(admin.role, "service_category:manage");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const { key, label, description, icon, sortOrder } = body;

  if (!key || !label) {
    return NextResponse.json(
      { error: "key and label are required" },
      { status: 400 },
    );
  }

  // Keys are referenced in code (seedStandardAddOns, quote types), so they
  // must be stable, lowercase and underscore-separated. Rejecting here beats
  // discovering a mismatched key when a company's add-ons don't seed.
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return NextResponse.json(
      {
        error:
          "Key must be lowercase letters, numbers and underscores, starting with a letter (e.g. cabinet_refinishing).",
      },
      { status: 400 },
    );
  }

  const existing = await db.serviceCategory.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json(
      { error: `A category with key "${key}" already exists.` },
      { status: 409 },
    );
  }

  const category = await db.serviceCategory.create({
    data: {
      key,
      label,
      description: description || null,
      icon: icon || null,
      sortOrder: sortOrder ?? 0,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
