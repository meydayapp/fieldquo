// app/api/fleet/[id]/maintenance/[logId]/route.js
//
// Removing one maintenance entry.
//
// ══ Why this exists when the equipment service log has no delete ═══════════
//
// A customer's equipment service history is evidence: a manufacturer reads it
// back when a warranty claim is made, so it is append-only and the only way
// out is deleting the equipment itself. A company's own van log is
// bookkeeping. A mistyped $4,000 tyre bill sits in the maintenance total
// forever otherwise, and nobody outside the company will ever be asked to
// believe it.
//
// ══ What it does NOT undo ══════════════════════════════════════════════════
//
// The odometer. If the entry moved the van's mileage on the way in, deleting
// it does not wind it back — the reading was still taken, the van really has
// done those kilometres, and reversing it would set the mileage to a number
// that was true in March using an edit made in June. The screen says so before
// the delete rather than quietly leaving a figure nothing explains.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireFleetWrite } from "@/lib/fleet/access";
import { recordActivity } from "@/lib/activity/log";

// Next 16: params is a Promise.
export async function DELETE(request, { params }) {
  const { id, logId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // The tenant proof: VehicleMaintenance carries no companyId, so the vehicle
  // is loaded scoped first and the entry is matched against the id it returns.
  const vehicle = await db.vehicleDetail.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, plate: true },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entry = await db.vehicleMaintenance.findFirst({
    where: { id: logId, vehicleId: vehicle.id },
    select: { id: true, kind: true, costCents: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.vehicleMaintenance.delete({ where: { id: entry.id } });

  await recordActivity(member, {
    action: "fleet.maintenance_removed",
    entityType: "settings",
    entityId: vehicle.id,
    summary: `Removed a ${entry.kind} entry from a vehicle's log${vehicle.plate ? ` (${vehicle.plate})` : ""}`,
    metadata: { vehicleId: vehicle.id, maintenanceId: entry.id, costCents: entry.costCents },
  });

  return NextResponse.json({ success: true });
}
