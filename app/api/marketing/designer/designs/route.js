// app/api/marketing/designer/designs/route.js
//
// List and create MarketingDesign rows — the CRUD half of "make the Marketing
// Designer reachable". Distinct from app/api/designer/templates (the free,
// global starter shelf) and app/api/marketing/designer/images (the paid AI
// actions): this is a company's own saved advert, tied to the campaign it
// advertises.
//
// Gated on the "marketing_designer" feature — see lib/features/registry.js's
// entry, whose apiPrefixes now cover this route alongside the two AI-costing
// ones. Turning the feature off must stop a company from creating MORE
// designs the same way it stops the AI actions; it must never touch a design
// already saved (AGENTS.md: turning a feature off never deletes anything).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

// Same gate as every other marketing-management route (campaigns, stops,
// send) — reusing user:manage rather than inventing a second permission
// string for one more screen in the same feature area.
function requireMarketingManager(role) {
  requirePermission(role, "user:manage");
}

const DESIGN_LIST_SELECT = {
  id: true,
  name: true,
  campaignId: true,
  createdAt: true,
  updatedAt: true,
  layouts: {
    select: { ratioKey: true, width: true, height: true, updatedAt: true },
  },
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManager(member.role);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can see the marketing designer" },
      { status: err.status || 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");

  // Scoped by companyId directly (MarketingDesign carries its own), plus the
  // optional campaignId filter the designer index page uses to show one
  // campaign's designs. campaignId alone would leak another tenant's rows if
  // it were ever trusted without the companyId alongside it.
  const designs = await db.marketingDesign.findMany({
    where: {
      companyId: member.companyId,
      ...(campaignId && { campaignId }),
    },
    orderBy: { updatedAt: "desc" },
    select: DESIGN_LIST_SELECT,
  });

  return NextResponse.json({ designs });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManager(member.role);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  // Proves campaignId belongs to this company — the same call also doubles
  // as the ownership check scripts/check-tenant-scope.mjs looks for: a
  // companyId-scoped lookup on the tainted campaignId, in this same handler,
  // before it is written onto the new row below.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { campaignId });
  if (notOurs) return notOurs;

  const design = await db.marketingDesign.create({
    data: {
      companyId: member.companyId,
      campaignId,
      name,
    },
    select: DESIGN_LIST_SELECT,
  });

  return NextResponse.json(design, { status: 201 });
}
