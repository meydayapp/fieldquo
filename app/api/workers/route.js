// app/api/workers/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const workers = await db.worker.findMany({
    where: { companyId: member.companyId, ...(type && { type }) },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(workers);
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can add workers" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, email, type, hourlyRate, userId } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 },
    );
  }
  if (!["contractor", "employee"].includes(type)) {
    return NextResponse.json(
      { error: "type must be contractor or employee" },
      { status: 400 },
    );
  }

  const worker = await db.worker.create({
    data: {
      companyId: member.companyId,
      userId: userId || null,
      name,
      email: email || null,
      type,
      hourlyRate: hourlyRate ?? null,
    },
  });

  return NextResponse.json(worker, { status: 201 });
}
