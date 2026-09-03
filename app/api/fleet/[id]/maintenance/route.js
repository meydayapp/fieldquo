// app/api/fleet/[id]/maintenance/route.js
//
// What has been done to one van, and when.
//
// ══ Why a service entry can move the odometer ══════════════════════════════
//
// "Serviced at 84,000 km" IS an odometer reading. Making somebody type it into
// two fields is how the two end up disagreeing, and the service-due-by-
// distance figure is computed from the odometer — so a stale one is a van that
// looks 6,000 km from its service when it is overdue.
//
// The rule is in lib/fleet/vehicle.js `odometerFromMaintenance`, executed by
// scripts/check-equipment-fleet.mjs, and it refuses in the two cases where
// applying it would be a guess: an entry OLDER than the reading already on
// file (logging March's service in June must not wind the van backwards), and
// a reading with no date against it (nothing to compare, so nothing to
// conclude). In both, the odometer is left exactly as it was.
//
// ══ Why the log is append-only ═════════════════════════════════════════════
//
// Same reasoning as `ChangeOrder` and the equipment service history: this
// records something that happened to a physical vehicle. A wrong entry gets a
// corrected one beside it — except for a whole entry created by mistake, which
// DELETE next door removes, because unlike a customer-facing service history
// nobody is going to make a warranty claim on a company's own van log and a
// mistyped $4,000 tyre bill would otherwise sit in the maintenance total
// forever.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireFleetRead, requireFleetWrite } from "@/lib/fleet/access";
import { odometerFromMaintenance } from "@/lib/fleet/vehicle";
import { parseMaintenanceBody } from "@/lib/fleet/payload";
import { recordActivity } from "@/lib/activity/log";

const LOG_SELECT = {
  id: true,
  kind: true,
  description: true,
  odometerKm: true,
  costCents: true,
  supplierId: true,
  performedAt: true,
  createdAt: true,
};

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // VehicleMaintenance has no companyId of its own — it hangs off the vehicle,
  // the way JobVisit hangs off Job. This scoped lookup is the tenant proof, and
  // the read below keys off the id it returns.
  const vehicle = await db.vehicleDetail.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const log = await db.vehicleMaintenance.findMany({
    where: { vehicleId: vehicle.id },
    select: LOG_SELECT,
    orderBy: [{ performedAt: "desc" }, { id: "desc" }],
  });

  return NextResponse.json({ maintenance: log });
}

export async function POST(request, { params }) {
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

  const vehicle = await db.vehicleDetail.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, plate: true, odometerKm: true, odometerAtUtc: true },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseMaintenanceBody(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const odometer = odometerFromMaintenance(vehicle, parsed.data);

  // One transaction: the log entry and the odometer it implies land together
  // or not at all. A half-applied pair would leave a mileage nothing explains.
  const created = await db.$transaction(async (tx) => {
    const row = await tx.vehicleMaintenance.create({
      data: { ...parsed.data, vehicleId: vehicle.id },
      select: LOG_SELECT,
    });
    if (odometer) {
      await tx.vehicleDetail.update({ where: { id: vehicle.id }, data: odometer });
    }
    return row;
  });

  await recordActivity(member, {
    action: "fleet.maintenance_logged",
    entityType: "settings",
    entityId: vehicle.id,
    summary: `Logged ${parsed.data.kind} on a vehicle${vehicle.plate ? ` (${vehicle.plate})` : ""}`,
    metadata: {
      vehicleId: vehicle.id,
      maintenanceId: created.id,
      // Whether the odometer moved, so "why does this van say 84,000" has an
      // answer that is not a guess.
      odometerUpdated: !!odometer,
    },
  });

  return NextResponse.json({ maintenance: created, odometerUpdated: !!odometer }, { status: 201 });
}
