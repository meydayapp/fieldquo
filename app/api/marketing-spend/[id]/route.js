// app/api/marketing-spend/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function PATCH(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.marketingSpend.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const {
    platform,
    campaignName,
    amount,
    impressions,
    clicks,
    leads,
    conversions,
    date,
    notes,
  } = body;

  const updated = await db.marketingSpend.update({
    where: { id: params.id },
    data: {
      ...(platform !== undefined && { platform }),
      ...(campaignName !== undefined && { campaignName }),
      ...(amount !== undefined && { amount }),
      ...(impressions !== undefined && { impressions }),
      ...(clicks !== undefined && { clicks }),
      ...(leads !== undefined && { leads }),
      ...(conversions !== undefined && { conversions }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(notes !== undefined && { notes }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.marketingSpend.findFirst({
    where: { id: params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.marketingSpend.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
