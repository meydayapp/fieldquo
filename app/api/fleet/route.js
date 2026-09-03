// app/api/fleet/route.js
//
// The vans: what is due, what is expiring, and who has each one.
//
// ══ Why this route does not own the vehicle ════════════════════════════════
//
// A van IS an `Asset` with `category: "vehicle"`, and that row is what feeds
// depreciation into the company's overhead and price floor. `VehicleDetail`
// hangs off it by `assetId` and adds the fleet columns Asset has no business
// carrying. So this endpoint READS the register and WRITES only the detail —
// creating or deleting the Asset itself stays with /api/assets, behind the
// cost-basis gate, where it moves the price floor and is supposed to be
// noticed.
//
// The consequence is real and the screen states it rather than hiding it: you
// cannot add a van here that is not already in the asset register. `canManageAssets`
// in the payload is what decides whether the screen offers the link to
// Settings → Overhead or names who to ask.
//
// ══ Two gates, on purpose ══════════════════════════════════════════════════
//
// `user:manage` opens the screen — a plate and an insurance renewal are
// operations, and the dispatcher deciding which van goes out on Thursday needs
// them. The cost columns come off unless the member ALSO passes the cost-basis
// read. lib/fleet/access.js explains why one stricter gate would have been the
// wrong trade.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireFleetRead, requireFleetWrite } from "@/lib/fleet/access";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { loadFleet } from "@/lib/fleet/load";
import { parseVehicleBody } from "@/lib/fleet/payload";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetRead(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  return NextResponse.json(await loadFleet({ db, member, full }));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireFleetWrite(full);
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const assetId = typeof body?.assetId === "string" ? body.assetId : "";
  if (!assetId)
    return NextResponse.json(
      { error: "Pick which vehicle in the register this is." },
      { status: 400 },
    );

  // The asset has to be ours. Without this a hand-written POST would attach a
  // fleet record — and, through it, a driver assignment — to another tenant's
  // truck, and the payload below names that asset.
  const badAsset = await ownedIdsRefusal(NextResponse, db, member.companyId, { assetId });
  if (badAsset) return badAsset;

  const parsed = parseVehicleBody(body, { creating: true });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // The driver has to be on this team. `assignedToUserId` holds a User id, so
  // it is proved against Member the way every other person-shaped foreign key
  // in this codebase is.
  const assignedToUserId = parsed.data.assignedToUserId || null;
  const badDriver = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    userId: assignedToUserId,
  });
  if (badDriver) return badDriver;

  // One fleet record per asset — `assetId` is @unique, and a duplicate would
  // otherwise arrive as a Prisma P2002 rendered to the person as "something
  // went wrong".
  const already = await db.vehicleDetail.findFirst({
    where: { assetId, companyId: member.companyId },
    select: { id: true },
  });
  if (already)
    return NextResponse.json(
      { error: "That vehicle already has a fleet record." },
      { status: 409 },
    );

  const created = await db.vehicleDetail.create({
    data: { companyId: member.companyId, assetId, ...parsed.data },
    select: { id: true, plate: true },
  });

  await recordActivity(member, {
    action: "fleet.vehicle_added",
    entityType: "settings",
    entityId: created.id,
    summary: `Added fleet details for a vehicle${created.plate ? ` (${created.plate})` : ""}`,
    metadata: { vehicleId: created.id, assetId },
  });

  return NextResponse.json(await loadFleet({ db, member, full }), { status: 201 });
}
