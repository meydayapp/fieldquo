// app/api/marketing/campaigns/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can, requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

async function loadOwned(companyId, id) {
  const campaign = await db.marketingCampaign.findUnique({ where: { id } });
  if (!campaign || campaign.companyId !== companyId) return null;
  return campaign;
}

// Full campaign incl. stops already in route order (sortOrder is maintained by
// the stops route's nearest-neighbor pass on every add).
//
// ── Redacted, not refused — and that is not the same answer as the list ────
//
// The list route now REFUSES a member without `user:manage`, because the hub
// is every campaign's budget at once and nobody below a supervisor needs it.
// Doing the same here would contradict a decision the neighbouring file states
// outright: app/api/marketing/stops/[id]/route.js PATCH is "deliberately open
// to any active member: distribution is fieldwork, and the person walking the
// route is often an employee without user:manage". Refusing this read takes
// the addresses away from the person at the door — enforce.js's own rule, that
// a gate can be a 403 and a read restriction cannot.
//
// So the money goes and the route stays. `budget` is the ad spend the list
// gate exists to withhold; `notes` is the manager's private brief on the
// campaign, which travels with it.
//
// What this does NOT do is give a crew member a way to REACH this page — the
// list is their only entry point and it now refuses them. Whether the product
// wants a "my pamphlet routes" surface is a product decision, not one to make
// inside a redaction.
const CAMPAIGN_MANAGER_FIELDS = ["budget", "notes"];

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

  // The platform console reads the whole row — same carve-out, same reason
  // as the list route. Redacting the budget from FieldQuo's own support view
  // would hide the number support is usually being asked about.
  if (!member.impersonation && !can(member.role, "user:manage")) {
    const shaped = { ...campaign };
    for (const field of CAMPAIGN_MANAGER_FIELDS) delete shaped[field];
    // Marked so a UI can say "hidden by your access level" rather than render
    // an empty budget, which reads as a campaign nobody has funded yet.
    // Absence and restriction are different statements — see redactClient.
    shaped.restricted = true;
    return NextResponse.json(shaped);
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

  // The campaign itself was company-scoped by loadOwned; the two ids being
  // written onto it were not, and both come back through the `include`.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    ...(assignedToId !== undefined && { assignedToId }),
    ...(templateId !== undefined && { templateId }),
  });
  if (notOurs) return notOurs;

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
