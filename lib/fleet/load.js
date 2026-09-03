// lib/fleet/load.js
//
// The fleet payload, built once.
//
// Every fleet endpoint answers with the WHOLE fleet, not just the row it
// touched. That is deliberate: the due-and-expiring list is the feature, it is
// derived from every van at once, and a create or an odometer update changes
// it. A route that returned only the row it wrote would leave the browser to
// recompute that list from a second copy of the rules — and the copy is the
// one that rots (AGENTS.md failure class #4).
//
// It lives here rather than in a route module because three routes need it and
// a Next 16 route file may only export handlers.
import { canSeeVehicleCost, canWriteFleet } from "./access";
import { canWriteCostBasis } from "@/lib/permissions/costBasis";
import { joinVehicles, stripVehicleCost } from "./vehicle";
import { fleetDueSoon, fleetTally, vehicleAttention } from "./expiry";
import { FLEET_ASSET_SELECT, VEHICLE_SELECT } from "./payload";
import { assetCharge } from "@/lib/accounting/depreciation";

/**
 * @param db      the Prisma client
 * @param member  from getCurrentMember() — companyId comes from here, never
 *                from the request
 * @param full    the grid-enforceable member (loadEnforceableMember)
 * @param asOf    pinned for tests; defaults to now
 */
export async function loadFleet({ db, member, full, asOf = new Date() }) {
  const seeCost = canSeeVehicleCost(full);

  const details = await db.vehicleDetail.findMany({
    where: { companyId: member.companyId },
    select: VEHICLE_SELECT,
    orderBy: { createdAt: "asc" },
  });

  // Both halves: assets the register calls vehicles, AND any asset a fleet row
  // already points at. The second clause matters for a van entered before
  // `category` existed — it is free text and nullable and nothing backfilled
  // it, so an existing detail row is itself evidence somebody considers this a
  // van.
  const assetIds = details.map((d) => d.assetId).filter(Boolean);
  const assets = await db.asset.findMany({
    where: {
      companyId: member.companyId,
      OR: [{ category: "vehicle" }, { id: { in: assetIds } }],
    },
    select: FLEET_ASSET_SELECT,
    orderBy: { createdAt: "asc" },
  });

  const rows = joinVehicles({ assets, details }).map((row) => {
    const priced =
      row.asset && seeCost
        ? { ...row, asset: { ...row.asset, ...chargeFields(row.asset, asOf) } }
        : row;
    const decorated = seeCost ? priced : stripVehicleCost(priced);
    // Every van carries its own four expiry states, so a detail panel never
    // has to ask a second endpoint what its badge should say.
    return { ...decorated, attention: vehicleAttention(decorated, { asOf }) };
  });

  // Who has the van. Resolved here rather than sent as a bare user id no
  // browser can render — and only from THIS company's membership, so an
  // assignment pointing anywhere else resolves to null rather than to a name.
  const members = await db.member.findMany({
    where: { companyId: member.companyId },
    select: { userId: true, active: true, user: { select: { name: true, email: true } } },
  });
  const drivers = members.map((m) => ({
    userId: m.userId,
    name: m.user?.name || m.user?.email || null,
    active: m.active,
  }));
  const driverName = new Map(drivers.map((d) => [d.userId, d.name]));

  const vehicles = rows.map((row) => ({
    ...row,
    assignedToName: row.assignedToUserId
      ? driverName.get(row.assignedToUserId) || null
      : null,
  }));

  return {
    vehicles,
    // The same shape and the same sort as the equipment warranty call list —
    // the two screens do the same job and are meant to feel like it.
    dueSoon: fleetDueSoon(vehicles, { asOf }).map((r) => ({
      vehicleId: r.vehicle.id,
      assetId: r.vehicle.assetId,
      name: r.vehicle.name,
      plate: r.vehicle.plate,
      state: r.state,
      reasons: r.reasons,
    })),
    tally: fleetTally(vehicles, { asOf }),
    drivers,
    canSeeCost: seeCost,
    canEdit: canWriteFleet(full),
    // Whether to offer "add a vehicle to the register" or to say who to ask.
    // Answered by the server because the answer is a permission, and a button
    // drawn on a guess is the dead control AGENTS.md forbids.
    canManageAssets: canWriteCostBasis(full, "fixedCosts"),
  };
}

/**
 * Depreciation, from the shipped maths.
 *
 * Not a second copy: /api/assets computes the same three numbers with the same
 * function, and a screen explaining a cost must not disagree with the figure
 * the company's price floor was built from.
 */
function chargeFields(asset, asOf) {
  const charge = assetCharge(asset, asOf);
  return {
    monthlyDepreciation: Math.round(charge.monthly * 100) / 100,
    bookValue: Math.round(charge.bookValue * 100) / 100,
    chargeable: charge.chargeable,
    chargeReason: charge.reason,
  };
}
