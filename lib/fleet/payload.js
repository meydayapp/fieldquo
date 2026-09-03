// lib/fleet/payload.js
//
// Reading a van's fleet record off a request, and the columns a screen needs.
//
// Shared between POST /api/fleet and PATCH /api/fleet/[id] for the reason
// lib/equipment/payload.js is shared: a Next 16 route module may only export
// handlers, and two copies of "what does a blank odometer mean" is how one of
// them ends up answering zero.
//
// ══ The rule every field here follows ══════════════════════════════════════
//
//   ABSENT key  → leave the column alone.
//   PRESENT and blank → NULL, i.e. "we no longer claim to know".
//
// Which is what makes it possible to take back a wrong VIN or a wrong renewal
// date. Nothing in here substitutes a default for a blank: an invented
// odometer reading is an invented service interval, and an invented insurance
// date is a van somebody thinks is legal.

/** The Asset columns the fleet screen shows when the member may see them. */
export const FLEET_ASSET_SELECT = {
  id: true,
  name: true,
  category: true,
  cost: true,
  salvageValue: true,
  inServiceDate: true,
  usefulLifeMonths: true,
  disposedOn: true,
  active: true,
  debtId: true,
};

export const VEHICLE_SELECT = {
  id: true,
  assetId: true,
  vin: true,
  plate: true,
  makeModel: true,
  year: true,
  odometerKm: true,
  odometerAtUtc: true,
  assignedToUserId: true,
  insuranceExpiresAt: true,
  registrationExpiresAt: true,
  nextServiceDueKm: true,
  nextServiceDueAt: true,
  createdAt: true,
  updatedAt: true,
};

export const MAINTENANCE_KINDS = Object.freeze([
  "service",
  "repair",
  "tyres",
  "inspection",
  "other",
]);

/** The earliest year worth accepting, and the latest. */
const MIN_YEAR = 1900;
// Next calendar year, because a van bought in November can be a next-model-year
// vehicle. Computed from the clock rather than hardcoded so this does not quietly
// start refusing correct input in 2031.
const maxYear = () => new Date().getUTCFullYear() + 1;

/**
 * Read a vehicle create/update body.
 *
 * @returns {{ data }} or {{ error }}
 */
export function parseVehicleBody(body, { creating = false } = {}) {
  const data = {};

  const text = (key, max = 120) => {
    if (body?.[key] === undefined) return undefined;
    const v = body[key];
    if (v === null) return null;
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  };

  for (const key of ["vin", "plate", "makeModel"]) {
    const value = text(key);
    if (value !== undefined) data[key] = value;
  }

  if (body?.year !== undefined) {
    if (body.year === null || body.year === "") data.year = null;
    else {
      const year = Number(body.year);
      if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear())
        return { error: `That model year doesn't look right — ${MIN_YEAR} to ${maxYear()}.` };
      data.year = year;
    }
  }

  // ── The odometer, and the date it was read ──────────────────────────────
  //
  // The two move together or not at all. A mileage with no read date is a
  // number that ages invisibly — six months later it still says 84,000 and
  // nobody can tell whether that was Tuesday or last winter — and the service
  // interval is computed from it. So clearing one clears both, and setting one
  // stamps the other.
  if (body?.odometerKm !== undefined) {
    if (body.odometerKm === null || body.odometerKm === "") {
      data.odometerKm = null;
      data.odometerAtUtc = null;
    } else {
      const km = Number(body.odometerKm);
      // 0 is accepted: a van collected from the dealer this morning has done
      // no kilometres, and that is a reading, not a blank.
      if (!Number.isInteger(km) || km < 0 || km > 5_000_000)
        return { error: "Enter the odometer in whole kilometres." };
      data.odometerKm = km;

      // Read TODAY unless the person says otherwise. This is not padding
      // absent data: they are typing the number off the dash as they enter it,
      // and the alternative (leaving the read date null) makes the reading
      // useless the moment it is saved.
      const when = body?.odometerAtUtc ? new Date(body.odometerAtUtc) : new Date();
      if (Number.isNaN(when.getTime())) return { error: "That date isn't a date." };
      data.odometerAtUtc = when;
    }
  }

  if (body?.assignedToUserId !== undefined) {
    data.assignedToUserId = body.assignedToUserId || null;
  }

  for (const key of [
    "insuranceExpiresAt",
    "registrationExpiresAt",
    "nextServiceDueAt",
  ]) {
    if (body?.[key] === undefined) continue;
    const raw = body[key];
    if (raw === null || raw === "") {
      data[key] = null;
      continue;
    }
    const when = new Date(raw);
    if (Number.isNaN(when.getTime())) return { error: "That date isn't a date." };
    data[key] = when;
  }

  if (body?.nextServiceDueKm !== undefined) {
    if (body.nextServiceDueKm === null || body.nextServiceDueKm === "")
      data.nextServiceDueKm = null;
    else {
      const km = Number(body.nextServiceDueKm);
      if (!Number.isInteger(km) || km < 0 || km > 5_000_000)
        return { error: "Enter the service interval in whole kilometres." };
      data.nextServiceDueKm = km;
    }
  }

  if (!creating && Object.keys(data).length === 0)
    return { error: "Nothing to change." };

  return { data };
}

/** Read one maintenance-log body. */
export function parseMaintenanceBody(body) {
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  if (!description) return { error: "Say what was done." };

  const kind = MAINTENANCE_KINDS.includes(body?.kind) ? body.kind : null;
  if (!kind)
    return { error: "Pick what kind of work it was." };

  if (!body?.performedAt) return { error: "When was it done?" };
  const performedAt = new Date(body.performedAt);
  if (Number.isNaN(performedAt.getTime()))
    return { error: "That date isn't a date." };

  const data = {
    kind,
    description: description.slice(0, 2000),
    performedAt,
    // Null, not zero. A repair with no cost recorded is a repair somebody
    // hasn't got the invoice for yet — writing 0 would say it was free.
    odometerKm: null,
    costCents: null,
    supplierId: body?.supplierId || null,
  };

  if (body?.odometerKm !== undefined && body.odometerKm !== null && body.odometerKm !== "") {
    const km = Number(body.odometerKm);
    if (!Number.isInteger(km) || km < 0 || km > 5_000_000)
      return { error: "Enter the odometer in whole kilometres." };
    data.odometerKm = km;
  }

  if (body?.costCents !== undefined && body.costCents !== null && body.costCents !== "") {
    const cents = Number(body.costCents);
    if (!Number.isInteger(cents) || cents < 0)
      return { error: "That cost doesn't look right." };
    data.costCents = cents;
  }

  return { data };
}
