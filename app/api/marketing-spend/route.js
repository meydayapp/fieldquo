// app/api/marketing-spend/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

// What a contractor spends on advertising is the same class of number
// app/api/marketing/campaigns/route.js already gates on `user:manage` — its
// own header explains why the coarse role axis, not the grid, is what this
// whole feature area asks. This route had NO check beyond "is a member of
// this company" until now, which is the same "hiding a button is not access
// control" gap AGENTS.md names: nothing hid a create/delete control here
// because no screen existed yet, but the route itself was open the whole
// time.
const MARKETING_PLATFORMS = ["facebook", "google", "tiktok", "pamphlet", "referral", "other"];

function requireMarketingManage(member) {
  requirePermission(member.role, "user:manage");
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManage(member);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can see marketing spend" },
      { status: err.status || 403 },
    );
  }

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

  try {
    requireMarketingManage(member);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can log marketing spend" },
      { status: err.status || 403 },
    );
  }

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

  if (!platform || !MARKETING_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "A valid platform is required" }, { status: 400 });
  }
  const numAmount = Number(amount);
  if (amount === undefined || amount === null || !Number.isFinite(numAmount) || numAmount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }
  const parsedDate = date ? new Date(date) : new Date();
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const entry = await db.marketingSpend.create({
    data: {
      companyId: member.companyId,
      platform,
      campaignName: campaignName || null,
      amount: numAmount,
      impressions: impressions ?? null,
      clicks: clicks ?? null,
      leads: leads || 0,
      conversions: conversions ?? null,
      date: parsedDate,
      notes: notes || null,
      // Every entry through THIS route is a human typing it in — the sync in
      // app/api/meta-ads/sync/route.js is the only writer of source:
      // "meta_api", and it never calls this route.
      source: "manual",
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
