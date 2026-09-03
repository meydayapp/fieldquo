// app/api/clients/[id]/equipment/[equipmentId]/route.js
//
// Editing and removing one piece of a customer's equipment.
//
// ══ Why DELETE exists at all ═══════════════════════════════════════════════
//
// The service history under a warranty is evidence, and evidence is not
// something to make disposable. But equipment gets replaced, and a furnace
// that was ripped out in 2024 sitting on a renewal call list forever is a call
// that wastes a customer's time and the contractor's credibility — the exact
// opposite of what this feature is for.
//
// So the row can go, at the ladder's own delete rung (full_edit_delete, one
// level above edit), and the services cascade with it because they describe a
// thing that is no longer there. Nothing here soft-deletes: a hidden row that
// still exists would keep its warranty date in the company's tally and quietly
// make that number wrong.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  requireEquipmentWrite,
  requireEquipmentDelete,
} from "@/lib/equipment/access";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { EQUIPMENT_SELECT, decorateEquipment, parseEquipmentBody } from "@/lib/equipment/payload";
import { recordActivity } from "@/lib/activity/log";

// Next 16: params is a Promise.
export async function PATCH(request, { params }) {
  const { id, equipmentId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireEquipmentWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Scoped by companyId AND by the client in the path, so a correct equipment
  // id under the wrong client is a 404 rather than a silent cross-client edit.
  const existing = await db.clientEquipment.findFirst({
    where: { id: equipmentId, clientId: id, companyId: member.companyId },
    select: { id: true, name: true, clientId: true, warrantyEndsAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseEquipmentBody(body, { creating: false });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const installedByJobId = parsed.data.installedByJobId || null;
  const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    jobId: installedByJobId,
  });
  if (badLink) return badLink;

  const updated = await db.clientEquipment.update({
    where: { id: existing.id },
    data: parsed.data,
    select: EQUIPMENT_SELECT,
  });

  await recordActivity(member, {
    action: "client.equipment_updated",
    entityType: "client",
    entityId: existing.clientId,
    summary: `Updated equipment ${updated.name}`,
    metadata: {
      equipmentId: existing.id,
      // Both booleans, never the dates themselves. Whether a warranty is on
      // file changing from false to true is the event worth being able to find
      // later; the date is on the row.
      warrantyWasRecorded: existing.warrantyEndsAt !== null,
      warrantyNowRecorded: updated.warrantyEndsAt !== null,
    },
  });

  return NextResponse.json(decorateEquipment(updated, new Date()));
}

export async function DELETE(request, { params }) {
  const { id, equipmentId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireEquipmentDelete(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.clientEquipment.findFirst({
    where: { id: equipmentId, clientId: id, companyId: member.companyId },
    select: { id: true, name: true, clientId: true, _count: { select: { services: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.clientEquipment.delete({ where: { id: existing.id } });

  await recordActivity(member, {
    action: "client.equipment_removed",
    entityType: "client",
    entityId: existing.clientId,
    summary: `Removed equipment ${existing.name}`,
    // The number of service visits that went with it. A count in the trail is
    // the difference between "they deleted an empty stub" and "they deleted
    // eleven years of history", and only one of those needs a conversation.
    metadata: { equipmentId: existing.id, servicesRemoved: existing._count.services },
  });

  return NextResponse.json({ success: true });
}
