// lib/fleet/vehicle.js
//
// Joining a van's fleet record to the Asset it hangs off, and the two rules
// that join keeps getting wrong.
//
// ══ Why VehicleDetail does not replace Asset ═══════════════════════════════
//
// A van is already an `Asset` with `category: "vehicle"`. That row is what the
// depreciation schedule charges against overhead and what raises the company's
// price floor (lib/accounting/depreciation.js → lib/analytics/burnRate.js →
// lib/analytics/minimumPrice.js). Replacing it would break job costing for
// every company that owns a truck.
//
// What `Asset` cannot answer is any fleet question — which van, what mileage,
// when is it due, who has it — so `VehicleDetail` sits beside it, keyed by
// `assetId`, and the depreciation is untouched.
//
// ══ The join has no foreign key, and that is not an oversight ══════════════
//
// `VehicleDetail.assetId` is `String @unique` with NO Prisma relation, so
// Postgres will not cascade and will not stop an Asset being deleted out from
// under a detail row. DELETE /api/assets/[id] exists (it is how a mistyped
// $600,000 truck comes back out of the register) and knows nothing about
// fleet, so ORPHANS WILL HAPPEN.
//
// The orphan is not junk. "This plate's insurance lapsed" is still a true and
// useful sentence about a real van after somebody deleted the wrong accounting
// row, and silently dropping the row would make an expiry disappear from the
// list that exists to surface expiries. So `joinVehicles` keeps it, marks it
// `assetMissing`, and the screen offers a working Delete for the fleet record
// itself. Nothing here deletes anything on its own.
//
// ══ Null odometer is not zero ══════════════════════════════════════════════
//
// `odometerKm` is nullable and 0 is a legitimate reading (a van collected from
// the dealer this morning). Coercing null to 0 would report a brand-new van
// and an unrecorded one identically, and — worse — would make a
// `nextServiceDueKm` of 10,000 look 10,000 km away on a van that has actually
// done 90,000. `odometerReading` is the only sanctioned way to read it.

/** The name to show for a van, in the order a contractor would recognise it. */
export function vehicleLabel(row) {
  const candidates = [
    row?.asset?.name,
    row?.makeModel,
    row?.plate,
    row?.vin,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  // No name anywhere. Null rather than an invented "Vehicle 1" — the caller
  // renders its own translated placeholder, and a fabricated name here would
  // travel into a maintenance log and look like something somebody typed.
  return null;
}

/**
 * The odometer, honestly.
 *
 * @returns {{ km: number|null, readAt: Date|null, known: boolean }}
 *
 * `known` is false for null, undefined, a non-number and a negative — a van
 * cannot have done -5 km, so that is a corrupt value, and a corrupt value is
 * an absence of information rather than a reading. 0 is known.
 */
export function odometerReading(vehicle) {
  const raw = vehicle?.odometerKm;
  const known =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0;
  const readAtRaw = vehicle?.odometerAtUtc;
  const readAt = readAtRaw ? new Date(readAtRaw) : null;
  return {
    km: known ? Math.floor(raw) : null,
    readAt: readAt && !Number.isNaN(readAt.getTime()) ? readAt : null,
    known,
  };
}

/**
 * Should a maintenance entry move the odometer, and to what?
 *
 * Logging "serviced at 84,000 km" IS an odometer reading, and making somebody
 * type it twice is how the two end up disagreeing. But a log entered late for
 * a service done in March must not wind a van's mileage BACKWARDS, so the
 * entry only wins when it is at least as recent as the reading already on
 * file, or when there is no reading at all.
 *
 * Returns null when nothing should change — the caller then leaves both
 * columns alone rather than writing a value it inferred.
 *
 * @param vehicle  the current row
 * @param entry    { odometerKm, performedAt }
 * @returns {{ odometerKm: number, odometerAtUtc: Date }|null}
 */
export function odometerFromMaintenance(vehicle, entry) {
  const km = entry?.odometerKm;
  if (typeof km !== "number" || !Number.isFinite(km) || km < 0) return null;

  const performedAt = entry?.performedAt ? new Date(entry.performedAt) : null;
  if (!performedAt || Number.isNaN(performedAt.getTime())) return null;

  const current = odometerReading(vehicle);
  // No reading on file: any dated entry is better than nothing.
  if (!current.known) {
    return { odometerKm: Math.floor(km), odometerAtUtc: performedAt };
  }
  // A reading exists but nobody recorded WHEN. Refuse rather than guess which
  // is newer — an unknown read date is exactly the case where "probably fine"
  // silently rewrites a real number.
  if (!current.readAt) return null;
  if (performedAt < current.readAt) return null;

  return { odometerKm: Math.floor(km), odometerAtUtc: performedAt };
}

/**
 * Fleet rows: every vehicle Asset, plus every VehicleDetail, joined.
 *
 * Three kinds of row come out, and all three are real:
 *
 *   1. asset + detail        — a van somebody has filled in
 *   2. asset, detail: null   — a vehicle in the register with no fleet record
 *                              yet. Kept so the screen can offer "add details"
 *                              for it instead of pretending the van isn't
 *                              there.
 *   3. detail, asset: null   — the orphan above. `assetMissing: true`.
 *
 * @param assets   Asset rows the caller decided are vehicles
 * @param details  VehicleDetail rows for the same company
 */
export function joinVehicles({ assets = [], details = [] } = {}) {
  const byAssetId = new Map();
  for (const d of details) if (d?.assetId) byAssetId.set(d.assetId, d);

  const rows = [];
  const claimed = new Set();

  for (const asset of assets || []) {
    if (!asset?.id) continue;
    const detail = byAssetId.get(asset.id) || null;
    if (detail) claimed.add(detail.id);
    rows.push(buildRow({ asset, detail }));
  }

  for (const detail of details || []) {
    if (!detail?.id || claimed.has(detail.id)) continue;
    rows.push(buildRow({ asset: null, detail }));
  }

  return rows;
}

function buildRow({ asset, detail }) {
  const row = {
    // The FLEET record's id — null when there isn't one yet. Deliberately not
    // falling back to the asset's id: a screen that PATCHes an asset id onto
    // /api/fleet/[id] would 404, and a control that 404s is the dead control
    // AGENTS.md forbids. Null is what tells the UI to POST instead of PATCH.
    id: detail?.id || null,
    assetId: detail?.assetId || asset?.id || null,
    asset: asset || null,
    assetMissing: !asset && !!detail,
    hasDetail: !!detail,

    vin: detail?.vin ?? null,
    plate: detail?.plate ?? null,
    makeModel: detail?.makeModel ?? null,
    year: detail?.year ?? null,
    odometerKm: detail?.odometerKm ?? null,
    odometerAtUtc: detail?.odometerAtUtc ?? null,
    assignedToUserId: detail?.assignedToUserId ?? null,
    insuranceExpiresAt: detail?.insuranceExpiresAt ?? null,
    registrationExpiresAt: detail?.registrationExpiresAt ?? null,
    nextServiceDueKm: detail?.nextServiceDueKm ?? null,
    nextServiceDueAt: detail?.nextServiceDueAt ?? null,
  };
  row.name = vehicleLabel(row);
  return row;
}

/**
 * The cost half of a fleet row, removed.
 *
 * A van's purchase price, book value and monthly depreciation are the
 * company's cost basis (lib/permissions/costBasis.js) — the same numbers a
 * Dispatcher was found reading off the Overhead screen. Everything else on the
 * row is operational: a plate, an odometer, an insurance date. So the read
 * gate lets an operations person in and this strips the money, rather than
 * refusing the whole screen to anyone who cannot see what the van cost.
 *
 * Strips rather than nulls: a `cost: null` beside a "$—" is indistinguishable
 * from a van whose price nobody entered, and inventing that ambiguity is the
 * "absence of a statement is not a statement" failure in reverse.
 */
export function stripVehicleCost(row) {
  if (!row) return row;
  if (!row.asset) return row;
  const {
    cost,
    salvageValue,
    bookValue,
    monthlyDepreciation,
    accumulatedDepreciation,
    debtId,
    debt,
    ...rest
  } = row.asset;
  return { ...row, asset: rest };
}
