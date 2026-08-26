// app/api/marketing-spend/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.marketingSpend.findFirst({
    where: { id: _params.id, companyId: member.companyId },
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
    where: { id: _params.id },
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
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.marketingSpend.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.marketingSpend.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
