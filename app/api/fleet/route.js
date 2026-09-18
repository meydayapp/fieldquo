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
// ══ The one write that DOES create the asset ═══════════════════════════════
//
// The owner opened /app/fleet, saw no Add button, and did not know vans are
// born in Settings → Overhead. So POST accepts `newAsset` beside `assetId`:
// the asset (category "vehicle") and its fleet record are created in ONE
// transaction, through the register's own parser and writer
// (lib/assets/create.js) — the cost-basis rules are not restated here — and
// behind BOTH gates: the fleet gate that opens this screen AND the cost-basis
// write gate the register itself sits behind. A member who may edit vans but
// may not write the cost basis gets the same "ask an owner" sentence as
// before; `canManageAssets` in the payload is what decides which the screen
// draws, and the server refuses the write regardless of what was drawn.
//
// The purchase price is OPTIONAL on this door and nowhere else. A blank is
// stored as 0 and reported as `no_cost_recorded` (never "fully depreciated")
// until somebody adds it — the card offers that. See create.js's header.
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
import { requireCostBasisWrite } from "@/lib/permissions/costBasis";
import { parseAssetBody, createAssetRow, assetAddedActivity } from "@/lib/assets/create";

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
  const newAsset = body?.newAsset && typeof body.newAsset === "object" ? body.newAsset : null;
  const assetId = typeof body?.assetId === "string" ? body.assetId : "";
  if (!assetId && !newAsset)
    return NextResponse.json(
      { error: "Pick which vehicle in the register this is, or add a new one." },
      { status: 400 },
    );
  if (assetId && newAsset)
    return NextResponse.json(
      { error: "Either pick a vehicle from the register or add a new one — not both." },
      { status: 400 },
    );

  let assetData = null;
  if (newAsset) {
    // The register's own gate, on top of the fleet gate above. Creating an
    // asset moves the price floor, and this door must not be a way round the
    // rule that only a cost-basis writer may do that.
    try {
      requireCostBasisWrite(full, "fixedCosts");
    } catch (err) {
      const { body: refused, status } = permissionErrorResponse(err);
      return NextResponse.json(refused, { status });
    }
    // Pinned: a van added from the fleet screen is a vehicle whatever the
    // body says, or it would not appear on the screen it was added from.
    const parsedAsset = parseAssetBody({ ...newAsset, category: "vehicle" }, { costOptional: true });
    if (parsedAsset.error) return NextResponse.json({ error: parsedAsset.error }, { status: 400 });
    const badDebt = await ownedIdsRefusal(NextResponse, db, member.companyId, {
      debtId: parsedAsset.data.debtId,
    });
    if (badDebt) return badDebt;
    assetData = parsedAsset.data;
  } else {
    // The asset has to be ours. Without this a hand-written POST would attach a
    // fleet record — and, through it, a driver assignment — to another tenant's
    // truck, and the payload below names that asset.
    const badAsset = await ownedIdsRefusal(NextResponse, db, member.companyId, { assetId });
    if (badAsset) return badAsset;
  }

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
  if (assetId) {
    const already = await db.vehicleDetail.findFirst({
      where: { assetId, companyId: member.companyId },
      select: { id: true },
    });
    if (already)
      return NextResponse.json(
        { error: "That vehicle already has a fleet record." },
        { status: 409 },
      );
  }

  // One transaction: a van that exists in the register with no fleet record,
  // because the second insert failed, is exactly the half-state this door was
  // built to stop the owner landing in by hand.
  const { asset, created } = await db.$transaction(async (tx) => {
    const createdAsset = assetData
      ? await createAssetRow(tx, { companyId: member.companyId, data: assetData })
      : null;
    const detail = await tx.vehicleDetail.create({
      data: {
        companyId: member.companyId,
        assetId: createdAsset ? createdAsset.id : assetId,
        ...parsed.data,
      },
      select: { id: true, plate: true, assetId: true },
    });
    return { asset: createdAsset, created: detail };
  });

  // Two trail rows for the combined door, because two things happened: the
  // register gained a row (the same event Settings → Overhead logs) and the
  // fleet gained a van. Logged after the transaction so a rolled-back write
  // never leaves a trail saying it succeeded.
  if (asset) await recordActivity(member, assetAddedActivity(asset, { via: "fleet" }));
  await recordActivity(member, {
    action: "fleet.vehicle_added",
    entityType: "settings",
    entityId: created.id,
    summary: `Added fleet details for a vehicle${created.plate ? ` (${created.plate})` : ""}`,
    metadata: { vehicleId: created.id, assetId: created.assetId, createdAsset: !!asset },
  });

  return NextResponse.json(await loadFleet({ db, member, full }), { status: 201 });
}
