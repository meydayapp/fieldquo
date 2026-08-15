// app/api/marketing/campaigns/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

async function loadOwned(companyId, id) {
  const campaign = await db.marketingCampaign.findUnique({ where: { id } });
  if (!campaign || campaign.companyId !== companyId) return null;
  return campaign;
}

// Full campaign incl. stops already in route order (sortOrder is maintained by
// the stops route's nearest-neighbor pass on every add).
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const campaign = await db.marketingCampaign.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      stops: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignedTo: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
      },
      template: { select: { id: true, name: true, type: true } },
    },
  });

  if (!campaign || campaign.companyId !== member.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(campaign);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
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

  const existing = await loadOwned(member.companyId, id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { name, type, status, assignedToId, budget, externalUrl, notes, templateId } = body;

  const updated = await db.marketingCampaign.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
      ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
      ...(budget !== undefined && {
        budget: budget != null && budget !== "" ? Number(budget) : null,
      }),
      ...(externalUrl !== undefined && { externalUrl: externalUrl || null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(templateId !== undefined && { templateId: templateId || null }),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
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

  const existing = await loadOwned(member.companyId, id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.marketingCampaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
