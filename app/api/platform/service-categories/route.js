// app/api/platform/service-categories/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

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

  const body = await request.json();
  const { key, label, description, icon, sortOrder } = body;

  if (!key || !label) {
    return NextResponse.json(
      { error: "key and label are required" },
      { status: 400 },
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
