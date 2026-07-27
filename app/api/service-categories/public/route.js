// app/api/service-categories/public/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public — signup needs the raw catalog before any Company/Member exists yet.
export async function GET() {
  const categories = await db.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true, label: true, icon: true },
  });
  return NextResponse.json(categories);
}
