// app/api/clients/[id]/equipment/route.js
//
// The equipment installed at one client's property, and its warranty.
//
// ══ Not Asset ══════════════════════════════════════════════════════════════
//
// `Asset` is the CONTRACTOR's own van and spray rig, and it carries
// depreciation into job costing and the price floor. This is the CUSTOMER's
// furnace. They are different tables for a reason, and a homeowner's boiler
// must never reach lib/accounting/depreciation.js.
//
// ══ The one rule that reaches a customer ═══════════════════════════════════
//
// `warrantyEndsAt` is nullable and NULL MEANS UNKNOWN. Nothing in this route
// defaults it, and the payload carries the computed state
// (lib/equipment/warranty.js) rather than leaving a browser to decide what a
// blank means — because two browsers deciding separately is how one of them
// ends up printing "out of warranty" on a record nobody filled in.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireEquipmentRead, requireEquipmentWrite } from "@/lib/equipment/access";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { warrantyTally } from "@/lib/equipment/warranty";
import {
  EQUIPMENT_SELECT,
  decorateEquipment,
  parseEquipmentBody,
} from "@/lib/equipment/payload";
import { recordActivity } from "@/lib/activity/log";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireEquipmentRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // The client is loaded scoped rather than trusted from the path: a 404 for
  // another tenant's client id is the whole tenant boundary on this route.
  const client = await db.client.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.clientEquipment.findMany({
    where: { companyId: member.companyId, clientId: client.id },
    select: EQUIPMENT_SELECT,
    orderBy: [{ createdAt: "desc" }],
  });

  const asOf = new Date();
  return NextResponse.json({
    equipment: rows.map((row) => decorateEquipment(row, asOf)),
    // Reported beside the list so "12 pieces, 9 with no warranty date on file"
    // is visible as a data-entry problem rather than silently rendering as
    // nine rows that look fine.
    tally: warrantyTally(rows, { asOf }),
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireEquipmentWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const client = await db.client.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, name: true },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseEquipmentBody(body, { creating: true });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // The job that installed it has to be ours. Proved through the shared table
  // as `jobId` — same model, same rule, since the column holds a Job id.
  const installedByJobId = parsed.data.installedByJobId || null;
  const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    jobId: installedByJobId,
  });
  if (badLink) return badLink;

  const created = await db.clientEquipment.create({
    data: {
      companyId: member.companyId,
      clientId: client.id,
      ...parsed.data,
    },
    select: EQUIPMENT_SELECT,
  });

  await recordActivity(member, {
    action: "client.equipment_added",
    entityType: "client",
    entityId: client.id,
    summary: `Added equipment ${created.name} for ${client.name}`,
    metadata: {
      equipmentId: created.id,
      // Logged as a boolean, not a date: what the trail needs to record is
      // whether anybody stated a warranty at all, since that is the fact
      // deciding whether this row is ever worth a phone call.
      warrantyRecorded: created.warrantyEndsAt !== null,
    },
  });

  return NextResponse.json(decorateEquipment(created, new Date()), { status: 201 });
}
