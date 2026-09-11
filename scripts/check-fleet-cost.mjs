// scripts/check-fleet-cost.mjs
//
//   npm run check:fleet-cost
//
// What a van costs, and who may know. Executed against the shipped modules.
//
// ══ The rules this file exists for ═════════════════════════════════════════
//
//   1. COST PER KM NEEDS TWO READINGS, THIRTY DAYS APART. One reading is a
//      point, not a distance; two readings a week apart divide one tank of
//      fuel by one week of driving. Below the floor the answer is null with a
//      reason — never a projection (lib/fleet/cost.js says why thirty).
//   2. THE WINDOW HAS AN EDGE. "Last 12 months" starts on this calendar date
//      a year ago, midnight UTC, inclusive. An expense one millisecond before
//      that is not in it. A total that drifts by a day is a total nobody can
//      reconcile against a statement.
//   3. A DISPATCHER'S PAYLOAD CARRIES NO COST FIELD AT ALL. Not a nulled one
//      — none. `stripVehicleCost` removes the row-level block and the expense
//      list as well as the Asset's own money columns, and lib/fleet/load.js
//      never fetches the rows for a member who could not see them.
//   4. THE PAPER MOVES THE COLUMN, AND THE NEWEST PAPER WINS. Filing an
//      insurance policy with an expiry date updates
//      VehicleDetail.insuranceExpiresAt; the newest by UPLOAD date decides,
//      not the latest expiry, and a document without a date says nothing.
//
// ══ Every date is pinned ═══════════════════════════════════════════════════
//
// A check that reads the wall clock passes in September and fails in October,
// and then gets deleted. NOW is fixed and every fixture is relative to it.
//
// Mutation-tested; the session report records which break each assertion
// was confirmed to catch.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import {
  COST_PER_KM_MIN_DAYS,
  costWindow,
  costPerKm,
  odometerReadings,
  vehicleCostSummary,
} from "@/lib/fleet/cost";
import {
  EXPIRY_COLUMN_BY_KIND,
  VEHICLE_DOCUMENT_KINDS,
  VEHICLE_MONEY_KINDS,
  expiryFromDocuments,
  expiryColumnsToWrite,
  parseVehicleDocumentBody,
  visibleVehicleDocuments,
  canSeeVehicleDocumentKind,
} from "@/lib/fleet/documents";
import { stripVehicleCost } from "@/lib/fleet/vehicle";
import { loadFleet } from "@/lib/fleet/load";
import { assetCharge } from "@/lib/accounting/depreciation";
import { PERMISSION_PRESETS } from "@/lib/permissions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const section = (title) => console.log(`\n${title}\n`);

// A Tuesday in the middle of a month, at noon, so "this month" and "a year
// ago today" are both unambiguous and neither sits on a boundary by accident.
const NOW = new Date("2026-09-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (n) => new Date(NOW.getTime() + n * DAY);
const near = (a, b, eps = 0.005) => Math.abs(a - b) <= eps;

// ═══════════════════════════════════════════════════════════════════════════
section("1. The two windows, and their edges");
// ═══════════════════════════════════════════════════════════════════════════

const W = costWindow(NOW);
ok(
  "this month is the calendar month, UTC, end exclusive",
  W.monthStart.toISOString() === "2026-09-01T00:00:00.000Z" &&
    W.monthEnd.toISOString() === "2026-10-01T00:00:00.000Z",
  W,
);
ok(
  "the 12-month window starts on this date a year ago, at midnight UTC",
  W.yearStart.toISOString() === "2025-09-15T00:00:00.000Z",
  W.yearStart,
);
ok("a hostile asOf falls back to a real clock rather than NaN", !Number.isNaN(costWindow("never").asOf.getTime()));

// No asset, no readings: the sums stand on their own.
const edge = (date) =>
  vehicleCostSummary({
    asset: null,
    vehicle: null,
    expenses: [{ amount: 100, date }],
    maintenance: [],
    asOf: NOW,
  });
ok(
  "an expense dated exactly at the window start is IN the last 12 months",
  edge(new Date("2025-09-15T00:00:00.000Z")).expensesLast12Months === 100,
);
ok(
  "an expense one millisecond before the window start is OUT",
  edge(new Date("2025-09-14T23:59:59.999Z")).expensesLast12Months === 0,
);
ok(
  "an expense on the last day of this month counts for this month AND the year",
  (() => {
    const r = edge(new Date("2026-09-30T23:59:59.000Z"));
    return r.expensesThisMonth === 100 && r.expensesLast12Months === 100;
  })(),
);
ok(
  "an expense on the 1st of next month is in neither window",
  (() => {
    const r = edge(new Date("2026-10-01T00:00:00.000Z"));
    return r.expensesThisMonth === 0 && r.expensesLast12Months === 0;
  })(),
);
ok(
  "an expense on the 1st of THIS month is in this month",
  edge(new Date("2026-09-01T00:00:00.000Z")).expensesThisMonth === 100,
);
ok(
  "last month's fuel is in the year but not the month",
  (() => {
    const r = edge(at(-20));
    return r.expensesThisMonth === 0 && r.expensesLast12Months === 100;
  })(),
);
ok(
  "a Prisma Decimal (string amount) is summed, not concatenated",
  vehicleCostSummary({
    expenses: [
      { amount: "412.80", date: at(-1) },
      { amount: "0.20", date: at(-2) },
    ],
    asOf: NOW,
  }).expensesThisMonth === 413,
);
ok(
  "an undated or unparseable expense counts for nothing",
  vehicleCostSummary({
    expenses: [{ amount: 50, date: null }, { amount: 50, date: "soon" }],
    asOf: NOW,
  }).expensesLast12Months === 0,
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. The maintenance total, and null cost is not free");
// ═══════════════════════════════════════════════════════════════════════════

const maintenanceOnly = vehicleCostSummary({
  maintenance: [
    { costCents: 12345, performedAt: at(-10) },
    { costCents: null, performedAt: at(-11) }, // invoice not in yet
    { costCents: 99900, performedAt: at(-400) }, // last year's tyres
  ],
  asOf: NOW,
});
ok(
  "maintenance is summed from cents into the company's units over 12 months only",
  maintenanceOnly.maintenanceLast12Months === 123.45,
  maintenanceOnly.maintenanceLast12Months,
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Depreciation comes from the shipped schedule, over the window");
// ═══════════════════════════════════════════════════════════════════════════

// $48,000 van, $8,000 salvage, 60 months: $666.67 a month. In service long
// enough that the whole window is charged.
const VAN = {
  id: "asset-van",
  name: "White Transit",
  category: "vehicle",
  cost: 48000,
  salvageValue: 8000,
  inServiceDate: at(-900),
  usefulLifeMonths: 60,
  disposedOn: null,
  active: true,
};
const depOnly = vehicleCostSummary({ asset: VAN, asOf: NOW });
const expectedDep =
  assetCharge(VAN, NOW).accumulated - assetCharge(VAN, W.yearStart).accumulated;
ok(
  "12-month depreciation is accumulated(now) − accumulated(a year ago) from assetCharge",
  near(depOnly.depreciationLast12Months, Math.round(expectedDep * 100) / 100),
  { got: depOnly.depreciationLast12Months, expected: expectedDep },
);
ok(
  "…which is about twelve monthly charges for a van mid-life",
  near(depOnly.depreciationLast12Months, 8000, 700),
  depOnly.depreciationLast12Months,
);
ok(
  "with no asset, depreciation and the total are NULL, not 0",
  (() => {
    const r = vehicleCostSummary({ asset: null, expenses: [{ amount: 10, date: at(-1) }], asOf: NOW });
    return r.depreciationLast12Months === null && r.totalLast12Months === null && r.expensesLast12Months === 10;
  })(),
);
ok(
  "an incomplete asset (no useful life) charges 0 — the register's own answer — and the total is a number",
  (() => {
    const r = vehicleCostSummary({
      asset: { ...VAN, usefulLifeMonths: null },
      expenses: [{ amount: 10, date: at(-1) }],
      asOf: NOW,
    });
    return r.depreciationLast12Months === 0 && r.totalLast12Months === 10;
  })(),
);
ok(
  "the total is the three parts added, rounded to cents",
  (() => {
    const r = vehicleCostSummary({
      asset: VAN,
      expenses: [{ amount: 100.1, date: at(-1) }],
      maintenance: [{ costCents: 2005, performedAt: at(-2) }],
      asOf: NOW,
    });
    return near(r.totalLast12Months, 100.1 + 20.05 + r.depreciationLast12Months, 0.011);
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Cost per km — two readings, thirty days, or nothing");
// ═══════════════════════════════════════════════════════════════════════════

ok("the floor is thirty days, the same 'about a month' as the due-soon window", COST_PER_KM_MIN_DAYS === 30);

const DETAIL = { odometerKm: 90000, odometerAtUtc: at(0) };

ok(
  "one reading: null, 'needs_two_readings'",
  (() => {
    const r = costPerKm({ asset: VAN, vehicle: DETAIL, expenses: [], maintenance: [] });
    return r.value === null && r.reason === "needs_two_readings";
  })(),
);
ok(
  "no readings at all: the same reason, not a crash",
  costPerKm({ asset: VAN, vehicle: { odometerKm: null }, expenses: [], maintenance: [] }).reason ===
    "needs_two_readings",
);
ok(
  "an UNDATED reading does not count as one — it cannot be placed in time",
  odometerReadings({ odometerKm: 1000, odometerAtUtc: null }, [
    { odometerKm: 2000, performedAt: at(-40) },
  ]).length === 1,
);
ok(
  "readings 29 days apart: null, 'readings_too_close'",
  (() => {
    const r = costPerKm({
      asset: VAN,
      vehicle: DETAIL,
      expenses: [],
      maintenance: [{ odometerKm: 88000, performedAt: at(-29), costCents: null }],
    });
    return r.value === null && r.reason === "readings_too_close";
  })(),
);
ok(
  "readings exactly 30 days apart: a number",
  (() => {
    const r = costPerKm({
      asset: VAN,
      vehicle: DETAIL,
      expenses: [],
      maintenance: [{ odometerKm: 88000, performedAt: at(-30), costCents: null }],
    });
    return r.value !== null && r.reason === null && r.value.km === 2000 && r.value.days === 30;
  })(),
);
ok(
  "readings that go backwards: null, 'no_distance' — a negative cost per km is not a cost",
  (() => {
    const r = costPerKm({
      asset: VAN,
      vehicle: DETAIL,
      expenses: [],
      maintenance: [{ odometerKm: 95000, performedAt: at(-60), costCents: null }],
    });
    return r.value === null && r.reason === "no_distance";
  })(),
);
ok(
  "two readings but no asset: null, 'asset_missing' — depreciation is unknowable",
  costPerKm({
    asset: null,
    vehicle: DETAIL,
    expenses: [],
    maintenance: [{ odometerKm: 80000, performedAt: at(-100), costCents: null }],
  }).reason === "asset_missing",
);

// THE figure. 10,000 km between a service at 80,000 km 100 days ago and
// today's reading of 90,000 km. Fuel of $1,500 inside the span, $400 before
// it (must not count), one $300 repair on the day of the first reading (must
// count — inclusive), and the depreciation between the two dates.
const span = costPerKm({
  asset: VAN,
  vehicle: DETAIL,
  expenses: [
    { amount: 1500, date: at(-50) },
    { amount: 400, date: at(-101) },
  ],
  maintenance: [
    { odometerKm: 80000, performedAt: at(-100), costCents: 30000 },
    { odometerKm: null, performedAt: at(-30), costCents: 5000 }, // no reading, still a cost
  ],
});
const spanDep = assetCharge(VAN, at(0)).accumulated - assetCharge(VAN, at(-100)).accumulated;
const spanCost = Math.round((1500 + 300 + 50 + spanDep) * 100) / 100;
ok(
  "cost per km = (fuel + repairs + depreciation between the readings) / km between them",
  span.value !== null &&
    span.value.km === 10000 &&
    span.value.days === 100 &&
    near(span.value.cost, spanCost, 0.011) &&
    near(span.value.perKm, spanCost / 10000, 0.0001),
  { got: span.value, expected: { cost: spanCost, perKm: spanCost / 10000 } },
);
ok(
  "an expense dated before the first reading is not in the numerator",
  span.value && !near(span.value.cost, spanCost + 400, 0.011),
);
ok(
  "the oldest and newest readings are used even when the newest is a maintenance entry",
  (() => {
    const r = costPerKm({
      asset: VAN,
      vehicle: { odometerKm: 85000, odometerAtUtc: at(-50) },
      expenses: [],
      maintenance: [
        { odometerKm: 80000, performedAt: at(-100), costCents: null },
        { odometerKm: 91000, performedAt: at(-1), costCents: null },
      ],
    });
    return r.value?.km === 11000 && r.value?.days === 99;
  })(),
);
ok(
  "the summary carries the per-km figure and reason side by side",
  (() => {
    const r = vehicleCostSummary({
      asset: VAN,
      vehicle: DETAIL,
      expenses: [],
      maintenance: [{ odometerKm: 88000, performedAt: at(-29), costCents: null }],
      asOf: NOW,
    });
    return r.costPerKm === null && r.costPerKmReason === "readings_too_close";
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. A dispatcher's payload carries none of it");
// ═══════════════════════════════════════════════════════════════════════════

const PRICED_ROW = {
  id: "veh-1",
  assetId: "asset-van",
  plate: "ABC 123",
  odometerKm: 90000,
  asset: { id: "asset-van", name: "White Transit", cost: 48000, bookValue: 20000, monthlyDepreciation: 666.67 },
  cost: { expensesThisMonth: 10, totalLast12Months: 9000, costPerKm: { perKm: 0.6 } },
  expenses: [{ id: "e1", amount: 10, category: "Fuel", date: at(-1) }],
};
const stripped = stripVehicleCost(PRICED_ROW);
ok(
  "stripVehicleCost removes the row-level cost block and the expense list — not nulls them",
  !("cost" in stripped) && !("expenses" in stripped),
  Object.keys(stripped),
);
ok(
  "…and still removes the Asset's own money columns",
  !!stripped.asset && !("cost" in stripped.asset) && !("bookValue" in stripped.asset) && !("monthlyDepreciation" in stripped.asset),
  stripped.asset,
);
ok(
  "…and keeps the plate, the odometer and the asset's name",
  stripped.plate === "ABC 123" && stripped.odometerKm === 90000 && stripped.asset.name === "White Transit",
);
ok(
  "an ORPHAN row (no asset) is stripped of its cost block too — the early return no longer skips it",
  (() => {
    const r = stripVehicleCost({ ...PRICED_ROW, asset: null });
    return !("cost" in r) && !("expenses" in r) && r.asset === null;
  })(),
);
ok("stripVehicleCost tolerates null", stripVehicleCost(null) === null);

// End to end through the loader, with a Prisma double.
const DISPATCHER = { role: "supervisor", permissions: PERMISSION_PRESETS.dispatcher.values };
const MANAGER = { role: "supervisor", permissions: PERMISSION_PRESETS.manager.values };
const MEMBER = { companyId: "co-1" };

const DETAIL_ROW = {
  id: "veh-1",
  assetId: "asset-van",
  plate: "ABC 123",
  odometerKm: 90000,
  odometerAtUtc: at(0),
  insuranceExpiresAt: at(100),
};

function fakeDb(log) {
  return {
    vehicleDetail: { findMany: async () => [DETAIL_ROW] },
    asset: { findMany: async () => [VAN] },
    member: { findMany: async () => [] },
    expense: {
      findMany: async () => {
        log.push("expense");
        return [
          { id: "e1", assetId: "asset-van", category: "Fuel", amount: "80.00", date: at(-1), notes: null, vendorName: "Shell" },
          { id: "e2", assetId: "asset-van", category: "Fuel", amount: "70.00", date: at(-400), notes: null, vendorName: null },
        ];
      },
    },
    vehicleMaintenance: {
      findMany: async () => {
        log.push("maintenance");
        return [{ vehicleId: "veh-1", costCents: 30000, performedAt: at(-100), odometerKm: 80000 }];
      },
    },
  };
}

const managerReads = [];
const asManager = await loadFleet({ db: fakeDb(managerReads), member: MEMBER, full: MANAGER, asOf: NOW });
const dispatcherReads = [];
const asDispatcher = await loadFleet({ db: fakeDb(dispatcherReads), member: MEMBER, full: DISPATCHER, asOf: NOW });

const mVan = asManager.vehicles.find((v) => v.id === "veh-1");
const dVan = asDispatcher.vehicles.find((v) => v.id === "veh-1");

ok(
  "the manager's row carries the cost block, with the month's fuel and a cost per km",
  asManager.canSeeCost === true &&
    mVan?.cost?.expensesThisMonth === 80 &&
    mVan?.cost?.costPerKm?.km === 10000 &&
    typeof mVan?.cost?.totalLast12Months === "number",
  mVan?.cost,
);
ok(
  "the manager's expense list is the last 12 months only, amounts as numbers",
  Array.isArray(mVan?.expenses) && mVan.expenses.length === 1 && mVan.expenses[0].amount === 80,
  mVan?.expenses,
);
ok(
  "the dispatcher's row has NO cost block and NO expense list — not nulled ones",
  asDispatcher.canSeeCost === false && !!dVan && !("cost" in dVan) && !("expenses" in dVan),
  dVan && Object.keys(dVan),
);
ok(
  "the loader never even READ the expense or maintenance rows for the dispatcher",
  dispatcherReads.length === 0 && managerReads.includes("expense") && managerReads.includes("maintenance"),
  { dispatcherReads, managerReads },
);
ok(
  "the dispatcher still gets the plate and the insurance state",
  dVan?.plate === "ABC 123" && dVan?.attention?.state === "ok",
);

// ═══════════════════════════════════════════════════════════════════════════
section("6. Documents — the newest paper moves the column");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "insurance and registration are the two kinds that feed a column",
  EXPIRY_COLUMN_BY_KIND.insurance === "insuranceExpiresAt" &&
    EXPIRY_COLUMN_BY_KIND.registration === "registrationExpiresAt" &&
    Object.keys(EXPIRY_COLUMN_BY_KIND).length === 2,
);

const DOCS = [
  // Older upload, LATER expiry — the cancelled long policy.
  { id: "d1", kind: "insurance", expiresAt: at(400), uploadedAt: at(-30) },
  // Newer upload, earlier expiry — the current short one. Must win.
  { id: "d2", kind: "insurance", expiresAt: at(120), uploadedAt: at(-1) },
  // Newest of all, but no date: says nothing.
  { id: "d3", kind: "insurance", expiresAt: null, uploadedAt: at(0) },
  // A photo with a date on it is still a photo.
  { id: "d4", kind: "photo", expiresAt: at(10), uploadedAt: at(0) },
  { id: "d5", kind: "registration", expiresAt: at(200), uploadedAt: at(-5) },
];
const implied = expiryFromDocuments(DOCS);
ok(
  "the NEWEST insurance document by upload date wins, not the latest expiry",
  implied.insuranceExpiresAt?.getTime() === at(120).getTime(),
  implied,
);
ok(
  "a document without a date does not override the one before it",
  implied.insuranceExpiresAt?.getTime() !== undefined && implied.insuranceExpiresAt.getTime() !== at(0).getTime(),
);
ok("registration feeds its own column", implied.registrationExpiresAt?.getTime() === at(200).getTime());
ok("a photo's date feeds nothing", Object.keys(implied).length === 2);
ok("no documents imply nothing — no key, not a null", Object.keys(expiryFromDocuments([])).length === 0);
ok(
  "only registration docs → only the registration key, insurance left absent",
  (() => {
    const r = expiryFromDocuments([DOCS[4]]);
    return "registrationExpiresAt" in r && !("insuranceExpiresAt" in r);
  })(),
);
ok(
  "the newest-by-upload rule survives the list arriving in any order",
  expiryFromDocuments([...DOCS].reverse()).insuranceExpiresAt?.getTime() === at(120).getTime(),
);

ok(
  "expiryColumnsToWrite writes only the columns that would CHANGE",
  (() => {
    const vehicle = { insuranceExpiresAt: at(120), registrationExpiresAt: at(50) };
    const data = expiryColumnsToWrite(vehicle, DOCS);
    return data && Object.keys(data).join() === "registrationExpiresAt" && data.registrationExpiresAt.getTime() === at(200).getTime();
  })(),
);
ok(
  "…and returns null when nothing moves, so the route can say expiryUpdated: false honestly",
  expiryColumnsToWrite({ insuranceExpiresAt: at(120), registrationExpiresAt: at(200) }, DOCS) === null,
);
ok(
  "…and fills a column that was never set",
  expiryColumnsToWrite({ insuranceExpiresAt: null, registrationExpiresAt: null }, DOCS)?.insuranceExpiresAt?.getTime() === at(120).getTime(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("7. Documents — the body, and the bill of sale behind the cost gate");
// ═══════════════════════════════════════════════════════════════════════════

const URL_OK = "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/companies/co-1/x.pdf";
ok(
  "a good body parses with its date",
  (() => {
    const r = parseVehicleDocumentBody({ kind: "insurance", url: URL_OK, name: " Policy ", expiresAt: "2027-03-01", sizeBytes: 1234 }, { cloudName: "demo" });
    return r.data && r.data.kind === "insurance" && r.data.name === "Policy" && r.data.expiresAt instanceof Date && r.data.sizeBytes === 1234;
  })(),
  parseVehicleDocumentBody({ kind: "insurance", url: URL_OK, expiresAt: "2027-03-01" }, { cloudName: "demo" }),
);
ok("a blank kind files as other", parseVehicleDocumentBody({ url: URL_OK }, { cloudName: "demo" }).data?.kind === "other");
ok(
  "a wrong kind is refused, not filed as other",
  !!parseVehicleDocumentBody({ kind: "warranty", url: URL_OK }, { cloudName: "demo" }).error,
);
ok(
  "a URL off another host is refused",
  !!parseVehicleDocumentBody({ kind: "photo", url: "https://evil.example/x.jpg" }, { cloudName: "demo" }).error,
);
ok(
  "a URL on the right host but another cloud is refused",
  !!parseVehicleDocumentBody({ kind: "photo", url: "https://res.cloudinary.com/other/image/upload/x.jpg" }, { cloudName: "demo" }).error,
);
ok(
  "an unparseable expiry is refused; a blank one is null",
  !!parseVehicleDocumentBody({ kind: "insurance", url: URL_OK, expiresAt: "soon" }, { cloudName: "demo" }).error &&
    parseVehicleDocumentBody({ kind: "insurance", url: URL_OK, expiresAt: "" }, { cloudName: "demo" }).data?.expiresAt === null,
);
ok("a 0-byte size is stored as null, never 0", parseVehicleDocumentBody({ url: URL_OK, sizeBytes: 0 }, {}).data?.sizeBytes === null);

ok("every kind in the picker is one the server accepts", VEHICLE_DOCUMENT_KINDS.every((k) => !parseVehicleDocumentBody({ kind: k, url: URL_OK }, {}).error));
ok("the bill of sale is the one money kind", [...VEHICLE_MONEY_KINDS].join() === "purchase");
ok(
  "without the cost gate the bill of sale is neither shown nor fileable; a photo is both",
  !canSeeVehicleDocumentKind("purchase", { canSeeCost: false }) &&
    canSeeVehicleDocumentKind("purchase", { canSeeCost: true }) &&
    canSeeVehicleDocumentKind("photo", { canSeeCost: false }),
);
ok(
  "visibleVehicleDocuments withholds a COUNT, not a list",
  (() => {
    const r = visibleVehicleDocuments(
      [{ kind: "purchase" }, { kind: "photo" }, { kind: "insurance" }],
      { canSeeCost: false },
    );
    return r.documents.length === 2 && r.hiddenCount === 1;
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("8. The routes, by source — what execution cannot reach");
// ═══════════════════════════════════════════════════════════════════════════

const read = (p) => readFileSync(join(ROOT, p), "utf8");

{
  const src = read("app/api/fleet/[id]/documents/route.js");
  const txStart = src.indexOf("$transaction");
  const txBody = txStart >= 0 ? src.slice(txStart) : "";
  ok(
    "POST /api/fleet/[id]/documents writes the expiry column INSIDE the same transaction as the row",
    txStart >= 0 &&
      txBody.includes("expiryColumnsToWrite") &&
      txBody.includes("tx.vehicleDetail.update") &&
      txBody.indexOf("tx.assetDocument.create") < txBody.indexOf("tx.vehicleDetail.update"),
  );
  ok(
    "…and refuses a money kind on the way in with canSeeVehicleDocumentKind",
    src.includes("canSeeVehicleDocumentKind(parsed.data.kind"),
  );
  ok(
    "…and returns the whole fleet, the way every fleet write does",
    src.includes("fleet: await loadFleet("),
  );
  ok(
    "GET filters on the server with visibleVehicleDocuments before answering",
    src.includes("visibleVehicleDocuments(rows"),
  );
}

{
  const src = read("app/api/expenses/route.js");
  ok(
    "POST /api/expenses proves assetId belongs to the caller's company before writing it",
    src.includes("ownedIdsRefusal(NextResponse, db, member.companyId, {\n    assetId") &&
      src.indexOf("ownedIdsRefusal") < src.indexOf("db.expense.create"),
  );
  ok("…and writes it", /assetId:\s*assetId \|\| null/.test(src));
}
{
  const src = read("app/api/expenses/[id]/route.js");
  ok(
    "PATCH /api/expenses/[id] proves assetId the same way",
    src.includes("ownedIdsRefusal") && src.indexOf("ownedIdsRefusal(NextResponse") < src.indexOf("db.expense.update"),
  );
}
{
  const src = read("app/app/settings/expense-tracking/page.js");
  ok(
    "the Add Expense modal sends assetId and draws the picker only when the company has vehicles",
    src.includes("assetId: form.assetId || null") && src.includes("vehicles && vehicles.length > 0 &&"),
  );
}
{
  const src = read("app/components/fleet/VehicleCard.js");
  ok(
    "the card mounts the cost block only when the row carries one",
    src.includes("canSeeCost && row.cost &&"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("");
if (fails.length) {
  console.log(`FAILED — ${fails.length} of ${pass + fails.length}`);
  for (const f of fails) console.log(`  ✗ ${f}`);
} else {
  console.log(`PASSED — ${pass}/${pass} assertions`);
}
process.exit(fails.length ? 1 : 0);
