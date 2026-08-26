// app/api/marketing-spend/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const platform = searchParams.get("platform");

  const entries = await db.marketingSpend.findMany({
    where: {
      companyId: member.companyId,
      ...(platform && { platform }),
      ...(from && to && { date: { gte: new Date(from), lte: new Date(to) } }),
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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

  if (!platform || amount === undefined) {
    return NextResponse.json(
      { error: "platform and amount are required" },
      { status: 400 },
    );
  }

  const entry = await db.marketingSpend.create({
    data: {
      companyId: member.companyId,
      platform,
      campaignName: campaignName || null,
      amount,
      impressions: impressions ?? null,
      clicks: clicks ?? null,
      leads: leads || 0,
      conversions: conversions ?? null,
      date: date ? new Date(date) : new Date(),
      notes: notes || null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
