// app/api/materials/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const materials = await db.material.findMany({
    where: { companyId: member.companyId },
    include: {
      priceEntries: { orderBy: { date: "desc" }, take: 1 }, // latest price for list view
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(materials);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, unit, category, currentAvgCost, reorderThreshold } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const material = await db.material.create({
    data: {
      companyId: member.companyId,
      name,
      unit: unit || null,
      category: category || null,
      currentAvgCost: currentAvgCost ?? null,
      reorderThreshold: reorderThreshold ?? null,
    },
  });

  return NextResponse.json(material, { status: 201 });
}
