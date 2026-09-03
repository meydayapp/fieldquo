// app/api/clients/[id]/equipment/[equipmentId]/services/route.js
//
// A visit to one piece of a customer's equipment.
//
// ══ `underWarranty` is the reason this table exists ════════════════════════
//
// A list of dates is a log. "Twice on us, once billed" is a sales
// conversation, a renewal argument, and the evidence a manufacturer asks for.
// So the flag is asked for explicitly on the form rather than inferred from
// whether an invoice exists — a covered visit and an unbilled one are not the
// same thing, and guessing would put a claim in the record nobody made.
//
// ══ Why there is no GET, and no PATCH or DELETE ════════════════════════════
//
// No GET: the parent route already returns every visit with its equipment,
// sorted, and a second read endpoint would be a second sort order to keep in
// step.
//
// No edit and no delete: this is an append-only log, the same shape and for
// the same reason as `ChangeOrder` (see app/components/jobs/ChangeOrders.js) —
// it records something that happened at a customer's address, and a
// manufacturer reading it back wants a history, not a version of one. A wrong
// entry gets a corrected one that says so. The escape hatch for a record
// created entirely by mistake is deleting the EQUIPMENT, which cascades, needs
// the delete rung of the ladder, and logs how many visits went with it.
//
// This is a deliberate absence, so nothing renders a delete control for a
// visit. Create-only by design, not unfinished.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireEquipmentWrite } from "@/lib/equipment/access";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { EQUIPMENT_SELECT, decorateEquipment, parseServiceBody } from "@/lib/equipment/payload";
import { recordActivity } from "@/lib/activity/log";

// Next 16: params is a Promise.
export async function POST(request, { params }) {
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

  // ClientEquipmentService carries no companyId of its own — it hangs off the
  // equipment, the way JobVisit hangs off Job. So the tenant proof is this
  // lookup, and every write below keys off the id it returns.
  const equipment = await db.clientEquipment.findFirst({
    where: { id: equipmentId, clientId: id, companyId: member.companyId },
    select: { id: true, name: true, clientId: true },
  });
  if (!equipment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseServiceBody(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const jobId = parsed.data.jobId || null;
  const badLink = await ownedIdsRefusal(NextResponse, db, member.companyId, { jobId });
  if (badLink) return badLink;

  await db.clientEquipmentService.create({
    data: { ...parsed.data, equipmentId: equipment.id },
    select: { id: true },
  });

  await recordActivity(member, {
    action: "client.equipment_serviced",
    entityType: "client",
    entityId: equipment.clientId,
    summary: `Logged a service visit on ${equipment.name}`,
    metadata: {
      equipmentId: equipment.id,
      underWarranty: parsed.data.underWarranty,
    },
  });

  // The whole equipment row comes back, not just the new visit: the panel
  // shows a history summary ("3 visits, 2 covered") beside the list, and
  // returning only the visit would leave the browser to recompute a summary
  // the server already owns.
  const refreshed = await db.clientEquipment.findFirst({
    where: { id: equipment.id, companyId: member.companyId },
    select: EQUIPMENT_SELECT,
  });
  return NextResponse.json(decorateEquipment(refreshed, new Date()), { status: 201 });
}
