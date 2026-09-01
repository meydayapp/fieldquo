// app/api/marketing-spend/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

// Same gate as the collection route beside this one — see its header.
function requireMarketingManage(member) {
  requirePermission(member.role, "user:manage");
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManage(member);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can edit marketing spend" },
      { status: err.status || 403 },
    );
  }

  const existing = await db.marketingSpend.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A row the Meta sync wrote gets overwritten by the SAME externalId on its
  // next run (app/api/meta-ads/sync/route.js upserts on it) — a hand-edit
  // here would look like it saved and then silently revert on the next
  // sync, which is exactly the "control that appears to work and doesn't"
  // AGENTS.md is written against. Refused with a real explanation instead;
  // DELETE below stays open, because removing a row is not silently undone.
  if (existing.source === "meta_api") {
    return NextResponse.json(
      {
        error:
          "This entry was imported from Meta and is kept in sync automatically — editing it here wouldn't stick past the next sync. Delete it if you don't want it, or change the campaign in Meta Ads Manager.",
      },
      { status: 409 },
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

  const data = {};
  if (platform !== undefined) data.platform = platform;
  if (campaignName !== undefined) data.campaignName = campaignName;
  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }
    data.amount = numAmount;
  }
  if (impressions !== undefined) data.impressions = impressions;
  if (clicks !== undefined) data.clicks = clicks;
  if (leads !== undefined) data.leads = leads;
  if (conversions !== undefined) data.conversions = conversions;
  if (date !== undefined) {
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    data.date = parsedDate;
  }
  if (notes !== undefined) data.notes = notes;

  const updated = await db.marketingSpend.update({
    where: { id: _params.id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManage(member);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can delete marketing spend" },
      { status: err.status || 403 },
    );
  }

  const existing = await db.marketingSpend.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.marketingSpend.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
