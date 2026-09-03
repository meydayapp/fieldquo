// app/api/fleet/[id]/route.js
//
// One van's fleet record: edit it, or take it off the fleet screen.
//
// ══ What DELETE deletes, and what it deliberately does not ═════════════════
//
// It removes the `VehicleDetail` — the plate, the odometer, the renewal dates
// — and NOTHING ELSE. The `Asset` stays, still depreciating, still in the
// overhead the price floor is built from. Deleting a truck's accounting row
// from a fleet screen would be a destructive operation labelled as a cosmetic
// one (AGENTS.md failure class #7), and it would silently lower every quote
// the company writes afterwards.
//
// It exists for one case that WILL happen: `VehicleDetail.assetId` carries no
// Prisma relation, so DELETE /api/assets/[id] can remove the Asset out from
// under a fleet row and leave an orphan. The fleet screen shows those orphans
// rather than hiding them (an insurance date is still a fact about a real
// van), which means it also has to offer a way to clear one up.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireFleetWrite } from "@/lib/fleet/access";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { loadFleet } from "@/lib/fleet/load";
import { parseVehicleBody } from "@/lib/fleet/payload";
import { recordActivity } from "@/lib/activity/log";

// Next 16: params is a Promise.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.vehicleDetail.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, plate: true, assetId: true, odometerKm: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseVehicleBody(body, { creating: false });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const assignedToUserId = parsed.data.assignedToUserId || null;
  const badDriver = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    userId: assignedToUserId,
  });
  if (badDriver) return badDriver;

  await db.vehicleDetail.update({ where: { id: existing.id }, data: parsed.data });

  await recordActivity(member, {
    action: "fleet.vehicle_updated",
    entityType: "settings",
    entityId: existing.id,
    summary: `Updated vehicle${existing.plate ? ` ${existing.plate}` : ""}`,
    // Which FIELDS moved, never their values: a driver assignment and an
    // insurance date are both on the row already, and a log that copies them
    // is a second place they can disagree.
    metadata: { vehicleId: existing.id, changed: Object.keys(parsed.data) },
  });

  return NextResponse.json(await loadFleet({ db, member, full }));
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const existing = await db.vehicleDetail.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      plate: true,
      assetId: true,
      _count: { select: { maintenance: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The maintenance log cascades with it (schema: onDelete Cascade), so the
  // count goes in the trail — "removed an empty stub" and "removed four years
  // of servicing" are different events and only one needs a conversation.
  await db.vehicleDetail.delete({ where: { id: existing.id } });

  await recordActivity(member, {
    action: "fleet.vehicle_removed",
    entityType: "settings",
    entityId: existing.id,
    summary: `Removed the fleet record for a vehicle${existing.plate ? ` (${existing.plate})` : ""} — the asset itself was kept`,
    metadata: {
      vehicleId: existing.id,
      assetId: existing.assetId,
      maintenanceRemoved: existing._count.maintenance,
    },
  });

  return NextResponse.json(await loadFleet({ db, member, full }));
}
