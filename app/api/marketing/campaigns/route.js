// app/api/marketing/campaigns/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

// List this company's marketing campaigns with a lightweight stop summary
// (counts by status) for the hub cards — the full stop list is only loaded on
// the campaign detail page.
//
// ── The read was open and the payload is the ad budget ─────────────────────
//
// POST below, PATCH and DELETE on [id], the stop-add route and the send route
// all gate on `user:manage`. This GET gated on nothing but "is a member of
// this company", and it returns `budget` and `recipientCount` for EVERY
// campaign — what the company spends on advertising and how wide it reaches.
// That is the owner's number, and Crew (role `employee`) read all of it.
//
// The coarse axis rather than the grid, because that is the axis this whole
// feature area already uses — the marketing routes ask `can(role, …)`, not
// hasLevel, and inventing a second answer for the read half of a file whose
// writes ask the first one is how the two drift apart.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Non-negotiable #3: the platform console views everything and edits
  // nothing. A support session's role is "viewer", which holds no permission at
  // all, so gating this read on user:manage alone would blind the console to a
  // campaign it is being asked about — and this route ANSWERED it before today.
  // Deliberately on the GET only: POST below has no such branch, and
  // getCurrentMember refuses every write from an impersonation session anyway.
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch (err) {
      return NextResponse.json(
        { error: "Only owners, admins, or supervisors can see marketing campaigns" },
        { status: err.status || 403 },
      );
    }
  }

  const campaigns = await db.marketingCampaign.findMany({
    where: { companyId: member.companyId },
    orderBy: { createdAt: "desc" },
    include: {
      assignedTo: { select: { id: true, name: true } },
      stops: { select: { status: true } },
      template: { select: { id: true, name: true } },
    },
  });

  const shaped = campaigns.map((c) => {
    const total = c.stops.length;
    const done = c.stops.filter(
      (s) => s.status !== "pending" && s.status !== "skipped",
    ).length;
    const spoke = c.stops.filter((s) => s.status === "spoke").length;
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      assignedTo: c.assignedTo,
      budget: c.budget,
      externalUrl: c.externalUrl,
      stopCount: total,
      visitedCount: done,
      spokeCount: spoke,
      template: c.template,
      sentAt: c.sentAt,
      recipientCount: c.recipientCount,
      createdAt: c.createdAt,
    };
  });

  return NextResponse.json(shaped);
}

// Create a campaign. Marketing management is an owner/admin/supervisor concern
// — reuse the existing user:manage gate rather than inventing a new permission
// string that no role grants yet.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can manage marketing" },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const { name, type, assignedToId, budget, externalUrl, notes, templateId } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const allowedTypes = ["pamphlet", "meta_ads", "email", "other"];
  const resolvedType = allowedTypes.includes(type) ? type : "pamphlet";

  if (resolvedType === "email" && !templateId) {
    return NextResponse.json(
      { error: "An email campaign needs a template — pick one or create one in Email Templates first." },
      { status: 400 },
    );
  }

  // Both ids come off the request and both are read straight back by the
  // `include` below — the assignee as a person's name, the template as a
  // document template's name. Neither was proved to belong to this company.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    assignedToId,
    ...(resolvedType === "email" && { templateId }),
  });
  if (notOurs) return notOurs;

  try {
    const campaign = await db.marketingCampaign.create({
      data: {
        companyId: member.companyId,
        name: name.trim(),
        type: resolvedType,
        assignedToId: assignedToId || null,
        budget: budget != null && budget !== "" ? Number(budget) : null,
        externalUrl: externalUrl || null,
        notes: notes || null,
        templateId: resolvedType === "email" ? templateId : null,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    // The MarketingCampaign table won't exist until `npx prisma db push` is
    // run after the schema change — surface that as JSON instead of an empty
    // 500 that reads as "Unexpected end of JSON input" on the client.
    console.error("[campaigns POST]", err);
    return NextResponse.json(
      {
        error:
          "Could not create campaign. If you just changed the schema, run `npx prisma db push` and restart the dev server.",
        detail: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 },
    );
  }
}
