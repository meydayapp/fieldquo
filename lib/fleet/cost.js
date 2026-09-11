// lib/fleet/cost.js
//
// What one van costs to keep on the road, from rows the loader already
// fetched. Pure: no database, no clock — `asOf` is passed in, so
// scripts/check-fleet-cost.mjs can pin it.
//
// ══ Three costs, one total ═════════════════════════════════════════════════
//
// A van costs money three ways and the product held each in a different
// table: fuel, tolls and the like as `Expense` rows pinned by `assetId`;
// garage bills as `VehicleMaintenance.costCents`; and the wearing-out of the
// thing itself as the depreciation charge lib/accounting/depreciation.js
// already computes for the price floor. "What does this van cost us" is the
// sum of the three, and a screen that showed one of them under a heading
// saying "cost" would be answering a smaller question than it asked.
//
// Depreciation is taken from the SHIPPED maths — accumulated charge at the end
// of the window minus accumulated charge at its start — so the figure here
// cannot disagree with the one the company's price floor was built from.
// A second copy of the straight-line rule would be the copy that rots.
//
// ══ Cost per kilometre, and the 30-day rule ════════════════════════════════
//
// The honest cost per km is cost incurred BETWEEN two odometer readings,
// divided by the kilometres between them. Not "this year's cost over this
// year's mileage": the mileage for the year is not known unless two readings
// happen to bracket it, and estimating it from a single reading is the guess
// this file refuses to make.
//
// So the figure needs two readings, and they need to be far enough apart to
// mean something. Thirty days is the floor, for two reasons:
//
//   1. The costs are monthly-shaped. A fuel-card statement, a toll account and
//      the depreciation charge each land about once a month. Two readings a
//      week apart divide one tank of fuel by one week's driving and report
//      the van at four times its real cost — or, if the statement hasn't
//      landed, at zero.
//   2. The common pair IS a close pair. Logging a service moves the odometer
//      (lib/fleet/vehicle.js `odometerFromMaintenance`), so the moment a van
//      has two readings at all, they are often the same reading twice, or a
//      reading and a correction typed a day later. Requiring a month between
//      them is what keeps that pair from producing a number.
//
// Thirty is also the same window lib/expiry/window.js uses for "due soon",
// so there is one meaning of "about a month" on this screen rather than two.
//
// Below the floor the answer is NULL with a reason, never a projection. A
// screen printing "$0.61/km" from readings six days apart would be padding
// absent data (AGENTS.md failure class #5) with a decimal point on it.
//
// ══ Null is not zero ═══════════════════════════════════════════════════════
//
// A total of 0 is a claim — "this van cost nothing". It is only made when the
// rows say so. A van whose Asset row was deleted has no depreciation to
// compute, so its depreciation, total and cost per km are null and the
// expense figures stand alone; summing what is known and calling it the total
// would be a smaller number wearing a bigger label.
import { assetCharge } from "@/lib/accounting/depreciation";
import { toDate } from "@/lib/expiry/window";
import { odometerReading } from "./vehicle";

/** The least time two odometer readings may be apart to yield a cost per km. */
export const COST_PER_KM_MIN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The two windows every figure here is measured over.
 *
 * `monthStart`..`monthEnd`  — the calendar month `asOf` falls in, UTC, end
 *                             exclusive. The whole month, not "up to today":
 *                             the expense screen's own month total counts a
 *                             bill dated the 28th when viewed on the 25th, and
 *                             this figure must match it.
 * `yearStart`..`monthEnd`   — "the last 12 months": from this calendar date a
 *                             year ago, midnight UTC, INCLUSIVE, to the end of
 *                             the current month. So an expense dated exactly
 *                             one year ago today counts; one dated the day
 *                             before does not.
 */
export function costWindow(asOf) {
  const now = toDate(asOf) || new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return {
    asOf: now,
    monthStart: new Date(Date.UTC(y, m, 1)),
    monthEnd: new Date(Date.UTC(y, m + 1, 1)),
    yearStart: new Date(Date.UTC(y - 1, m, d)),
  };
}

/** Inclusive start, exclusive end. */
const within = (date, start, end) => {
  const t = toDate(date);
  return !!t && t >= start && t < end;
};

/** Prisma Decimal, number or string → number; anything else → 0 for a sum. */
const amount = (v) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sumExpenses = (rows, start, end) =>
  round2(
    (Array.isArray(rows) ? rows : [])
      .filter((e) => e && within(e.date, start, end))
      .reduce((s, e) => s + amount(e.amount), 0),
  );

const sumMaintenance = (rows, start, end) =>
  round2(
    (Array.isArray(rows) ? rows : [])
      .filter((m) => m && within(m.performedAt, start, end))
      // Null cost is "invoice not in yet" (lib/fleet/payload.js) and adds
      // nothing — which is the same as adding 0 for a sum, but not the same
      // claim, so it is filtered rather than coerced.
      .filter((m) => typeof m.costCents === "number" && Number.isFinite(m.costCents))
      .reduce((s, m) => s + m.costCents / 100, 0),
  );

/**
 * Depreciation charged between two instants, from the shipped schedule.
 *
 * `assetCharge` clamps at disposal and at the end of the useful life on its
 * own, so a van sold in March charges nothing for April here either.
 */
function depreciationBetween(asset, start, end) {
  if (!asset) return null;
  const before = assetCharge(asset, start).accumulated;
  const after = assetCharge(asset, end).accumulated;
  return round2(Math.max(0, after - before));
}

/**
 * Every dated odometer reading on file for a van, oldest first.
 *
 * The fleet record's own reading plus every maintenance entry that recorded
 * one. `odometerReading` decides what counts as a reading (null, negative and
 * non-numeric do not; 0 does), and an undated reading is dropped: with no
 * date it cannot be placed in time, and a span cannot be measured from it.
 */
export function odometerReadings(vehicle, maintenance) {
  const out = [];
  const own = odometerReading(vehicle);
  if (own.known && own.readAt) out.push({ km: own.km, at: own.readAt });
  for (const m of Array.isArray(maintenance) ? maintenance : []) {
    const r = odometerReading({ odometerKm: m?.odometerKm, odometerAtUtc: m?.performedAt });
    if (r.known && r.readAt) out.push({ km: r.km, at: r.readAt });
  }
  return out.sort((a, b) => a.at - b.at || a.km - b.km);
}

/**
 * Cost per kilometre between the oldest and newest readings, or null and why.
 *
 * @returns {{ value: object|null, reason: string|null }}
 *
 * Reasons, each a separate sentence on the card rather than one "n/a":
 *   needs_two_readings  fewer than two dated readings exist
 *   readings_too_close  the oldest and newest are under COST_PER_KM_MIN_DAYS apart
 *   no_distance         the newest reading is not above the oldest
 *   asset_missing       no Asset row, so no depreciation to put in the numerator
 */
export function costPerKm({ asset, vehicle, expenses, maintenance }) {
  const readings = odometerReadings(vehicle, maintenance);
  if (readings.length < 2) return { value: null, reason: "needs_two_readings" };

  const first = readings[0];
  const last = readings[readings.length - 1];
  const days = (last.at - first.at) / DAY_MS;
  if (days < COST_PER_KM_MIN_DAYS) return { value: null, reason: "readings_too_close" };

  const km = last.km - first.km;
  if (km <= 0) return { value: null, reason: "no_distance" };

  if (!asset) return { value: null, reason: "asset_missing" };

  // The span is inclusive at both ends: the service that recorded the last
  // reading was paid for on that day.
  const end = new Date(last.at.getTime() + 1);
  const cost = round2(
    sumExpenses(expenses, first.at, end) +
      sumMaintenance(maintenance, first.at, end) +
      depreciationBetween(asset, first.at, last.at),
  );

  return {
    value: {
      perKm: Math.round((cost / km) * 10000) / 10000,
      cost,
      km,
      days: Math.floor(days),
      from: first.at,
      to: last.at,
    },
    reason: null,
  };
}

/**
 * The cost block for one van.
 *
 * @param asset        the Asset row (may be null for an orphan)
 * @param vehicle      the VehicleDetail row (may be null for a bare asset)
 * @param expenses     Expense rows pinned to this asset — any date; the
 *                     windows are applied here
 * @param maintenance  VehicleMaintenance rows for this vehicle — any date
 * @param asOf         pinned for tests; defaults to now
 */
export function vehicleCostSummary({ asset, vehicle, expenses, maintenance, asOf } = {}) {
  const w = costWindow(asOf);

  const expensesThisMonth = sumExpenses(expenses, w.monthStart, w.monthEnd);
  const expensesLast12Months = sumExpenses(expenses, w.yearStart, w.monthEnd);
  const maintenanceLast12Months = sumMaintenance(maintenance, w.yearStart, w.monthEnd);
  const depreciationLast12Months = depreciationBetween(asset, w.yearStart, w.asOf);

  const totalLast12Months =
    depreciationLast12Months === null
      ? null
      : round2(expensesLast12Months + maintenanceLast12Months + depreciationLast12Months);

  const perKm = costPerKm({ asset, vehicle, expenses, maintenance });

  return {
    expensesThisMonth,
    expensesLast12Months,
    maintenanceLast12Months,
    depreciationLast12Months,
    totalLast12Months,
    costPerKm: perKm.value,
    costPerKmReason: perKm.reason,
    window: {
      monthStart: w.monthStart,
      monthEnd: w.monthEnd,
      yearStart: w.yearStart,
      asOf: w.asOf,
    },
  };
}
