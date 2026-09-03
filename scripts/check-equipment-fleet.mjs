// scripts/check-equipment-fleet.mjs
//
//   npm run check:equipment-fleet
//
// Two features, one rule, executed.
//
// ══ The rule ═══════════════════════════════════════════════════════════════
//
//   AN ABSENT DATE IS "unknown". IT IS NEVER "expired".
//
// `ClientEquipment.warrantyEndsAt` is nullable, and a blank rendered as "out
// of warranty" is a claim nobody made. On a customer it turns a renewal call
// into an insult; on a van the mirror image is worse — an unrecorded odometer
// read as 0 makes a vehicle that is 6,000 km overdue for a service look 84,000
// km away from one.
//
// Everything below runs the SHIPPED modules. A regex over lib/expiry/window.js
// proves the word "unknown" is in the file. It does not prove that
// `expiryState(null)` returns it, that a `soonDays` of NaN doesn't quietly
// make every future date read as expired, or that a vehicle whose Asset row
// was deleted still surfaces its lapsed insurance instead of vanishing. Those
// are behaviour, and behaviour is only provable by calling it — which is how
// most of the real bugs in this repo were found (AGENTS.md, "How to verify").
//
// ══ Every date here is pinned ══════════════════════════════════════════════
//
// A check that reads the wall clock passes in August and fails in September,
// and then gets deleted. `NOW` is fixed and every fixture is expressed
// relative to it.
//
// ══ The two string assertions, and why they are string assertions ══════════
//
// Section 9 reads source text, and only where behaviour cannot reach: JSX
// cannot be executed here (nothing in the alias-loader run parses it), and
// `odometerReading`'s promise is about an absence — that no zero-coercion
// exists — which no single call can demonstrate. Both are scoped to ONE
// brace-matched function body, so an unrelated edit elsewhere in the file
// cannot satisfy or break them.
//
// Mutation-tested; see the session report for which break each assertion was
// confirmed to catch.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import {
  EXPIRY_STATES,
  DEFAULT_SOON_DAYS,
  expiryState,
  needsAttention,
  urgencyRank,
  worstState,
  byUrgency,
  daysUntil,
  toDate,
} from "@/lib/expiry/window";
import {
  warrantyState,
  isOutOfWarranty,
  isWarrantyUnknown,
  withWarranty,
  expiringWarranties,
  warrantyTally,
  WARRANTY_SOON_DAYS,
} from "@/lib/equipment/warranty";
import { summariseServices, sortServices } from "@/lib/equipment/history";
import {
  parseEquipmentBody,
  parseServiceBody,
  decorateEquipment,
} from "@/lib/equipment/payload";
import {
  canReadEquipment,
  canWriteEquipment,
  canDeleteEquipment,
  requireEquipmentRead,
} from "@/lib/equipment/access";
import {
  odometerReading,
  odometerFromMaintenance,
  joinVehicles,
  stripVehicleCost,
  vehicleLabel,
} from "@/lib/fleet/vehicle";
import {
  serviceDueByKm,
  vehicleExpiries,
  vehicleAttention,
  fleetDueSoon,
  fleetTally,
} from "@/lib/fleet/expiry";
import { parseVehicleBody, parseMaintenanceBody } from "@/lib/fleet/payload";
import {
  canReadFleet,
  canWriteFleet,
  canSeeVehicleCost,
  requireFleetRead,
} from "@/lib/fleet/access";
import { loadFleet } from "@/lib/fleet/load";
import { PERMISSION_PRESETS } from "@/lib/permissions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const section = (title) => console.log(`\n${title}\n`);

const NOW = new Date("2026-09-02T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
/** A date `n` days from NOW. Negative is the past. */
const at = (n) => new Date(NOW.getTime() + n * DAY);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The shared window — a missing date is never a lapsed one");
// ═══════════════════════════════════════════════════════════════════════════

// THE assertion this whole file exists for, in its most literal form.
for (const [name, value] of [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["unparseable text", "sometime next year"],
  ["NaN", NaN],
  ["an object", {}],
]) {
  const s = expiryState(value, { asOf: NOW });
  ok(
    `expiryState(${name}) is UNKNOWN and is NOT expired`,
    s.state === EXPIRY_STATES.UNKNOWN && s.state !== EXPIRY_STATES.EXPIRED,
    s,
  );
  ok(
    `expiryState(${name}) reports no day count rather than 0`,
    s.daysRemaining === null && s.known === false,
    s,
  );
}

ok(
  "a date 400 days out is ok",
  expiryState(at(400), { asOf: NOW }).state === EXPIRY_STATES.OK,
  expiryState(at(400), { asOf: NOW }),
);
ok(
  "exactly at the window edge (30 days) is due_soon",
  expiryState(at(30), { asOf: NOW, soonDays: 30 }).state === EXPIRY_STATES.DUE_SOON,
);
ok(
  "one day past the window (31 days) is still ok",
  expiryState(at(31), { asOf: NOW, soonDays: 30 }).state === EXPIRY_STATES.OK,
);
// The last covered day is still a covered day — an insurance certificate does
// not lapse over lunch on the day it is printed to expire.
ok(
  "expiring TODAY is due_soon, not expired",
  expiryState(at(0), { asOf: NOW }).state === EXPIRY_STATES.DUE_SOON &&
    expiryState(at(0), { asOf: NOW }).daysRemaining === 0,
  expiryState(at(0), { asOf: NOW }),
);
ok(
  "yesterday is expired",
  expiryState(at(-1), { asOf: NOW }).state === EXPIRY_STATES.EXPIRED &&
    expiryState(at(-1), { asOf: NOW }).daysRemaining === -1,
);
// Same calendar day, different clock times, must not change the answer.
ok(
  "the state is day-based, not millisecond-based",
  expiryState(new Date("2026-09-02T00:00:01Z"), { asOf: NOW }).daysRemaining === 0 &&
    expiryState(new Date("2026-09-02T23:59:59Z"), { asOf: NOW }).daysRemaining === 0,
);

// A hostile window must not silently make everything ok (Infinity) or make
// every comparison false (NaN), which would empty the call list with no
// explanation.
for (const [name, soonDays] of [
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["negative", -5],
  ["a string", "soon"],
])
  ok(
    `a ${name} window falls back to the ${DEFAULT_SOON_DAYS}-day default`,
    expiryState(at(20), { asOf: NOW, soonDays }).state === EXPIRY_STATES.DUE_SOON &&
      expiryState(at(200), { asOf: NOW, soonDays }).state === EXPIRY_STATES.OK,
    { soonDays, twenty: expiryState(at(20), { asOf: NOW, soonDays }) },
  );

ok("needsAttention is true for expired and due_soon only",
  needsAttention(EXPIRY_STATES.EXPIRED) &&
    needsAttention(EXPIRY_STATES.DUE_SOON) &&
    !needsAttention(EXPIRY_STATES.OK) &&
    !needsAttention(EXPIRY_STATES.UNKNOWN));

// Unknown sorts LAST. Putting gaps in the record above genuinely lapsed
// insurance would bury the thing with a same-day consequence.
ok(
  "urgency order is expired < due_soon < ok < unknown",
  urgencyRank(EXPIRY_STATES.EXPIRED) < urgencyRank(EXPIRY_STATES.DUE_SOON) &&
    urgencyRank(EXPIRY_STATES.DUE_SOON) < urgencyRank(EXPIRY_STATES.OK) &&
    urgencyRank(EXPIRY_STATES.OK) < urgencyRank(EXPIRY_STATES.UNKNOWN),
);
ok(
  "worstState: a real state always beats unknown",
  worstState([EXPIRY_STATES.UNKNOWN, EXPIRY_STATES.EXPIRED]) === EXPIRY_STATES.EXPIRED &&
    worstState([EXPIRY_STATES.UNKNOWN, EXPIRY_STATES.OK]) === EXPIRY_STATES.OK,
);
ok("worstState of nothing is unknown, not ok", worstState([]) === EXPIRY_STATES.UNKNOWN);
ok("worstState tolerates junk", worstState(null) === EXPIRY_STATES.UNKNOWN);

ok("byUrgency puts expired first and unknown last", (() => {
  const rows = [
    { id: "unknown", state: EXPIRY_STATES.UNKNOWN, endsAt: null },
    { id: "ok", state: EXPIRY_STATES.OK, endsAt: at(300) },
    { id: "expired", state: EXPIRY_STATES.EXPIRED, endsAt: at(-10) },
    { id: "soon", state: EXPIRY_STATES.DUE_SOON, endsAt: at(5) },
  ];
  return byUrgency(rows).map((r) => r.id).join(",") === "expired,soon,ok,unknown";
})(), byUrgency([
  { id: "unknown", state: EXPIRY_STATES.UNKNOWN, endsAt: null },
  { id: "ok", state: EXPIRY_STATES.OK, endsAt: at(300) },
  { id: "expired", state: EXPIRY_STATES.EXPIRED, endsAt: at(-10) },
  { id: "soon", state: EXPIRY_STATES.DUE_SOON, endsAt: at(5) },
]).map((r) => r.id));

ok("daysUntil(null) is null, not 0", daysUntil(null, NOW) === null);
ok("toDate('') is null, not the epoch", toDate("") === null);
ok("toDate(0) is null — a numeric zero is not a date somebody typed", toDate(0) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Client equipment warranties — the three fixtures from the brief");
// ═══════════════════════════════════════════════════════════════════════════

const BLANK_WARRANTY = {
  id: "eq-blank",
  clientId: "c1",
  name: "Furnace, no paperwork",
  warrantyEndsAt: null,
};
const EXPIRING_IN_30 = {
  id: "eq-soon",
  clientId: "c2",
  name: "Boiler",
  warrantyEndsAt: at(30),
};
const ALREADY_EXPIRED = {
  id: "eq-gone",
  clientId: "c3",
  name: "Water heater",
  warrantyEndsAt: at(-400),
};
const IN_WARRANTY = {
  id: "eq-fine",
  clientId: "c4",
  name: "Heat pump",
  warrantyEndsAt: at(900),
};

// ── The single most important assertion in this file ──────────────────────
ok(
  "a NULL warrantyEndsAt does NOT read as expired",
  warrantyState(BLANK_WARRANTY, { asOf: NOW }).state !== EXPIRY_STATES.EXPIRED,
  warrantyState(BLANK_WARRANTY, { asOf: NOW }),
);
ok(
  "a NULL warrantyEndsAt reads as unknown",
  warrantyState(BLANK_WARRANTY, { asOf: NOW }).state === EXPIRY_STATES.UNKNOWN,
);
ok("isOutOfWarranty is FALSE for a blank date", isOutOfWarranty(BLANK_WARRANTY, { asOf: NOW }) === false);
ok("isWarrantyUnknown is TRUE for a blank date", isWarrantyUnknown(BLANK_WARRANTY, { asOf: NOW }) === true);
// The same, for a row that never had the column at all.
ok(
  "equipment with no warranty field whatsoever is unknown, not expired",
  warrantyState({ id: "x", name: "y" }, { asOf: NOW }).state === EXPIRY_STATES.UNKNOWN &&
    isOutOfWarranty({}, { asOf: NOW }) === false &&
    isOutOfWarranty(null, { asOf: NOW }) === false,
);

ok(
  "a warranty ending in 30 days is due_soon",
  warrantyState(EXPIRING_IN_30, { asOf: NOW }).state === EXPIRY_STATES.DUE_SOON,
  warrantyState(EXPIRING_IN_30, { asOf: NOW }),
);
ok(
  "an already-lapsed warranty is expired",
  warrantyState(ALREADY_EXPIRED, { asOf: NOW }).state === EXPIRY_STATES.EXPIRED,
);
ok(
  "the equipment window is 60 days, wider than the shared 30 — a renewal is a sale",
  WARRANTY_SOON_DAYS === 60 &&
    warrantyState({ warrantyEndsAt: at(45) }, { asOf: NOW }).state === EXPIRY_STATES.DUE_SOON,
);

// ── The call list ─────────────────────────────────────────────────────────
const BOOK = [IN_WARRANTY, BLANK_WARRANTY, EXPIRING_IN_30, ALREADY_EXPIRED];
const CALL_LIST = expiringWarranties(BOOK, { asOf: NOW });

ok(
  "the call list holds exactly the expired and the expiring",
  CALL_LIST.map((r) => r.id).join(",") === "eq-gone,eq-soon",
  CALL_LIST.map((r) => r.id),
);
// The commercial rule and the honesty rule at once: a blank has no expiry to
// be soon, and padding the list with it would bury the two real calls.
ok(
  "the blank-warranty row is NOT on the call list",
  !CALL_LIST.some((r) => r.id === "eq-blank"),
);
ok(
  "the in-warranty row is not on it either",
  !CALL_LIST.some((r) => r.id === "eq-fine"),
);
ok(
  "already expired sorts before expiring soon",
  CALL_LIST[0].id === "eq-gone",
);
ok(
  "every row on the list carries the state it was selected for",
  CALL_LIST.every((r) => needsAttention(r.warranty.state)),
);

const TALLY = warrantyTally(BOOK, { asOf: NOW });
ok(
  "the tally reports unknown as its own number, never as expired",
  TALLY.expired === 1 && TALLY.dueSoon === 1 && TALLY.ok === 1 && TALLY.unknown === 1 && TALLY.total === 4,
  TALLY,
);
ok("an empty book tallies to zeroes without throwing", warrantyTally([]).total === 0);
ok("a junk book tallies without throwing", warrantyTally(null).total === 0);
ok("expiringWarranties(null) is an empty list, not a throw", expiringWarranties(null).length === 0);
ok("withWarranty(null) is null", withWarranty(null) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Service history — the visit that was covered rather than billed");
// ═══════════════════════════════════════════════════════════════════════════

const VISITS = [
  { id: "s1", servicedAt: at(-800), description: "Install", underWarranty: false },
  { id: "s2", servicedAt: at(-400), description: "Annual service", underWarranty: true },
  { id: "s3", servicedAt: at(-30), description: "Ignitor replaced", underWarranty: true },
];
const HISTORY = summariseServices(VISITS);

ok(
  "a visit marked under warranty is counted as covered, not billed",
  HISTORY.count === 3 && HISTORY.underWarranty === 2 && HISTORY.billed === 1,
  HISTORY,
);
ok(
  "the most recent visit is the latest date",
  HISTORY.lastServicedAt.getTime() === at(-30).getTime(),
);
// underWarranty is a non-null Boolean whose false means BILLED. Anything that
// is not literally `true` must not be counted as covered — a truthy string
// from a hand-written request would otherwise invent a warranty claim.
ok(
  "only a literal true counts as covered",
  summariseServices([
    { servicedAt: at(-1), underWarranty: "yes" },
    { servicedAt: at(-2), underWarranty: 1 },
    { servicedAt: at(-3), underWarranty: true },
  ]).underWarranty === 1,
);
ok(
  "no visits at all reports null, not a date and not 'never'",
  summariseServices([]).lastServicedAt === null && summariseServices([]).count === 0,
);
ok(
  "a row loaded without its services include summarises to zero, not a throw",
  summariseServices(undefined).count === 0 && summariseServices(null).count === 0,
);
ok(
  "an UNDATED visit still counts but never becomes the most recent",
  (() => {
    const s = summariseServices([
      { id: "a", servicedAt: null, underWarranty: false },
      { id: "b", servicedAt: at(-100), underWarranty: false },
    ]);
    return s.count === 2 && s.lastServicedAt.getTime() === at(-100).getTime();
  })(),
);
ok(
  "sortServices is newest first with undated last",
  sortServices([
    { id: "old", servicedAt: at(-800) },
    { id: "undated", servicedAt: null },
    { id: "new", servicedAt: at(-30) },
  ])
    .map((r) => r.id)
    .join(",") === "new,old,undated",
);

// decorateEquipment is what the API actually returns — the whole shape, once.
const DECORATED = decorateEquipment({ ...EXPIRING_IN_30, services: VISITS }, NOW);
ok(
  "the API payload carries the computed state, so no browser has to decide what a null means",
  DECORATED.warranty.state === EXPIRY_STATES.DUE_SOON &&
    DECORATED.history.underWarranty === 2 &&
    DECORATED.services[0].id === "s3",
  { state: DECORATED.warranty.state, history: DECORATED.history },
);
ok(
  "a blank warranty survives decoration as unknown",
  decorateEquipment({ ...BLANK_WARRANTY, services: [] }, NOW).warranty.state ===
    EXPIRY_STATES.UNKNOWN,
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. The odometer — null is unknown, 0 is a reading");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "a NULL odometer is unknown, and km comes back null rather than 0",
  (() => {
    const r = odometerReading({ odometerKm: null });
    return r.known === false && r.km === null;
  })(),
  odometerReading({ odometerKm: null }),
);
ok(
  "a ZERO odometer is a real reading — a van collected this morning",
  (() => {
    const r = odometerReading({ odometerKm: 0 });
    return r.known === true && r.km === 0;
  })(),
  odometerReading({ odometerKm: 0 }),
);
for (const [name, value] of [
  ["undefined", undefined],
  ["a negative", -5],
  ["a string", "84000"],
  ["NaN", NaN],
])
  ok(
    `${name} mileage is unknown, not a number`,
    odometerReading({ odometerKm: value }).known === false &&
      odometerReading({ odometerKm: value }).km === null,
  );
ok("odometerReading(null) does not throw", odometerReading(null).known === false);
ok(
  "a reading with no read date reports readAt null",
  odometerReading({ odometerKm: 84000 }).readAt === null,
);

// ── Service due by distance ───────────────────────────────────────────────
ok(
  "due at 90,000 km with NO odometer is unknown — never 90,000 km to go",
  (() => {
    const s = serviceDueByKm({ nextServiceDueKm: 90000, odometerKm: null });
    return s.state === EXPIRY_STATES.UNKNOWN && s.remainingKm === null;
  })(),
  serviceDueByKm({ nextServiceDueKm: 90000, odometerKm: null }),
);
ok(
  "an odometer with no target is unknown too",
  serviceDueByKm({ odometerKm: 84000 }).state === EXPIRY_STATES.UNKNOWN,
);
ok(
  "odometer 0 against a 10,000 km target counts down properly",
  (() => {
    const s = serviceDueByKm({ odometerKm: 0, nextServiceDueKm: 10000 });
    return s.state === EXPIRY_STATES.OK && s.remainingKm === 10000;
  })(),
  serviceDueByKm({ odometerKm: 0, nextServiceDueKm: 10000 }),
);
ok(
  "300 km short of the target is due_soon",
  serviceDueByKm({ odometerKm: 89700, nextServiceDueKm: 90000 }).state ===
    EXPIRY_STATES.DUE_SOON,
);
ok(
  "past the target is expired, with a negative remainder",
  (() => {
    const s = serviceDueByKm({ odometerKm: 91000, nextServiceDueKm: 90000 });
    return s.state === EXPIRY_STATES.EXPIRED && s.remainingKm === -1000;
  })(),
);

// ── A maintenance entry as an odometer reading ────────────────────────────
ok(
  "a dated entry sets the odometer when nothing was on file",
  (() => {
    const r = odometerFromMaintenance(
      { odometerKm: null, odometerAtUtc: null },
      { odometerKm: 84000, performedAt: at(-2) },
    );
    return r && r.odometerKm === 84000 && r.odometerAtUtc.getTime() === at(-2).getTime();
  })(),
);
ok(
  "a NEWER entry moves the odometer forward",
  odometerFromMaintenance(
    { odometerKm: 80000, odometerAtUtc: at(-90) },
    { odometerKm: 84000, performedAt: at(-2) },
  )?.odometerKm === 84000,
);
ok(
  "an OLDER entry does NOT wind the odometer backwards",
  odometerFromMaintenance(
    { odometerKm: 84000, odometerAtUtc: at(-2) },
    { odometerKm: 80000, performedAt: at(-90) },
  ) === null,
);
ok(
  "a reading with no recorded date is left alone rather than guessed at",
  odometerFromMaintenance(
    { odometerKm: 84000, odometerAtUtc: null },
    { odometerKm: 90000, performedAt: at(-1) },
  ) === null,
);
ok(
  "an entry with no mileage changes nothing",
  odometerFromMaintenance({ odometerKm: null }, { performedAt: at(-1) }) === null,
);
ok(
  "an entry with a mileage but no date changes nothing",
  odometerFromMaintenance({ odometerKm: null }, { odometerKm: 84000 }) === null,
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. Vehicles — the four expiries, and the one whose Asset was deleted");
// ═══════════════════════════════════════════════════════════════════════════

const ASSET_VAN = {
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
const ASSET_SPARE = {
  id: "asset-spare",
  name: "Old pickup",
  category: "vehicle",
  cost: 12000,
  salvageValue: 0,
  inServiceDate: at(-2000),
  usefulLifeMonths: 60,
  disposedOn: null,
  active: true,
};

const DETAIL_VAN = {
  id: "veh-1",
  assetId: "asset-van",
  plate: "ABC 123",
  makeModel: "Ford Transit",
  year: 2021,
  odometerKm: 84000,
  odometerAtUtc: at(-3),
  assignedToUserId: "user-1",
  // The brief's "an expiry in the past".
  insuranceExpiresAt: at(-9),
  registrationExpiresAt: at(200),
  nextServiceDueKm: 90000,
  nextServiceDueAt: null,
};
// The brief's "a vehicle with a null odometer (not 0)".
const DETAIL_BLANK = {
  id: "veh-2",
  assetId: "asset-blank",
  plate: null,
  makeModel: null,
  odometerKm: null,
  odometerAtUtc: null,
  insuranceExpiresAt: null,
  registrationExpiresAt: null,
  nextServiceDueKm: 90000,
  nextServiceDueAt: null,
};
// The brief's "a vehicle whose Asset was deleted" — VehicleDetail.assetId
// carries no foreign key, so DELETE /api/assets/[id] leaves this behind.
const DETAIL_ORPHAN = {
  id: "veh-3",
  assetId: "asset-deleted",
  plate: "ORP 999",
  makeModel: "Old Sprinter",
  odometerKm: 210000,
  odometerAtUtc: at(-40),
  insuranceExpiresAt: at(-2),
  registrationExpiresAt: null,
  nextServiceDueKm: null,
  nextServiceDueAt: null,
};

const JOINED = joinVehicles({
  assets: [ASSET_VAN, ASSET_SPARE],
  details: [DETAIL_VAN, DETAIL_BLANK, DETAIL_ORPHAN],
});

ok("every asset and every detail row is represented once", JOINED.length === 4, JOINED.map((r) => r.id || r.assetId));
ok(
  "the van joins to its asset",
  (() => {
    const row = JOINED.find((r) => r.id === "veh-1");
    return !!row && row.asset?.id === "asset-van" && row.hasDetail === true && row.assetMissing === false;
  })(),
);
ok(
  "an asset with no fleet record is kept, with a NULL fleet id so the screen posts instead of patching",
  (() => {
    const row = JOINED.find((r) => r.assetId === "asset-spare");
    return !!row && row.hasDetail === false && row.id === null;
  })(),
  JOINED.find((r) => r.assetId === "asset-spare"),
);

// ── The orphan ────────────────────────────────────────────────────────────
const ORPHAN_ROW = JOINED.find((r) => r.id === "veh-3");
ok(
  "a vehicle whose Asset was deleted is STILL LISTED — its lapsed insurance is a real fact",
  !!ORPHAN_ROW,
  JOINED.map((r) => r.id),
);
// Optional chaining throughout: when the orphan is dropped by a future edit
// these must report a FAILED ASSERTION, not crash the run on `undefined.name`
// — a check that dies is a check whose output nobody reads.
ok(
  "the orphan is marked assetMissing rather than silently carrying a null asset",
  ORPHAN_ROW?.assetMissing === true && ORPHAN_ROW?.asset === null,
  ORPHAN_ROW,
);
ok(
  "the orphan keeps a usable name from its own columns",
  ORPHAN_ROW?.name === "Old Sprinter",
  ORPHAN_ROW?.name,
);
ok(
  "the orphan's lapsed insurance still raises attention",
  vehicleAttention(ORPHAN_ROW, { asOf: NOW }).state === EXPIRY_STATES.EXPIRED,
);
ok(
  "a row with nothing to name itself by reports null, not an invented 'Vehicle 1'",
  vehicleLabel({}) === null && vehicleLabel({ plate: "  " }) === null,
);

// ── Four expiries, always four ────────────────────────────────────────────
const VAN_EXPIRIES = vehicleExpiries(DETAIL_VAN, { asOf: NOW });
ok(
  "every van reports all four expiries, unknown ones included",
  VAN_EXPIRIES.length === 4 &&
    VAN_EXPIRIES.map((e) => e.kind).join(",") === "insurance,registration,service,serviceKm",
  VAN_EXPIRIES.map((e) => `${e.kind}:${e.state}`),
);
ok(
  "the past insurance date is expired and the future registration is ok",
  VAN_EXPIRIES.find((e) => e.kind === "insurance").state === EXPIRY_STATES.EXPIRED &&
    VAN_EXPIRIES.find((e) => e.kind === "registration").state === EXPIRY_STATES.OK,
);
ok(
  "an unset service date is unknown, not overdue",
  VAN_EXPIRIES.find((e) => e.kind === "service").state === EXPIRY_STATES.UNKNOWN,
);

const BLANK_ATTENTION = vehicleAttention(DETAIL_BLANK, { asOf: NOW });
ok(
  "a van with nothing recorded is UNKNOWN, not overdue on everything",
  BLANK_ATTENTION.state === EXPIRY_STATES.UNKNOWN && BLANK_ATTENTION.reasons.length === 0,
  BLANK_ATTENTION.expiries.map((e) => `${e.kind}:${e.state}`),
);
ok(
  "a van with one lapsed item and three blanks reads as lapsed, not unknown",
  vehicleAttention(DETAIL_VAN, { asOf: NOW }).state === EXPIRY_STATES.EXPIRED,
);
ok(
  "the reasons name what is actually wrong",
  vehicleAttention(DETAIL_VAN, { asOf: NOW }).reasons.map((r) => r.kind).join(",") ===
    "insurance",
  vehicleAttention(DETAIL_VAN, { asOf: NOW }).reasons.map((r) => r.kind),
);

// ── The fleet call list ───────────────────────────────────────────────────
const FLEET_ROWS = JOINED;
const DUE = fleetDueSoon(FLEET_ROWS, { asOf: NOW });
ok(
  "the fleet call list holds exactly the two vans with something lapsed",
  DUE.map((r) => r.vehicle.id).sort().join(",") === "veh-1,veh-3",
  DUE.map((r) => r.vehicle.id),
);
ok(
  "the all-blank van is NOT on the call list",
  !DUE.some((r) => r.vehicle.id === "veh-2"),
);
ok(
  "the asset with no fleet record is not on it either — there is nothing to be due",
  !DUE.some((r) => r.vehicle.assetId === "asset-spare"),
);
ok(
  "the most recently lapsed sorts by date, soonest-expired first",
  DUE[0]?.vehicle.id === "veh-1" && DUE[1]?.vehicle.id === "veh-3",
  DUE.map((r) => [r.vehicle.id, r.reasons.map((x) => x.kind)]),
);

const FLEET_TALLY = fleetTally(FLEET_ROWS, { asOf: NOW });
ok(
  "the fleet tally counts unknown separately, the same way the warranty tally does",
  FLEET_TALLY.expired === 2 && FLEET_TALLY.unknown === 2 && FLEET_TALLY.total === 4,
  FLEET_TALLY,
);
ok("fleetDueSoon(null) is empty, not a throw", fleetDueSoon(null).length === 0);
ok("fleetTally(null) is zeroes", fleetTally(null).total === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("6. Bodies off the wire — a blank clears, junk refuses, nothing defaults");
// ═══════════════════════════════════════════════════════════════════════════

ok(
  "creating without a name is refused",
  !!parseEquipmentBody({}, { creating: true }).error,
);
ok(
  "an absent warranty key leaves the column completely alone",
  !("warrantyEndsAt" in parseEquipmentBody({ name: "Furnace" }, { creating: true }).data),
);
ok(
  "a PRESENT and blank warranty date clears it to null — a mistyped date is recoverable",
  parseEquipmentBody({ name: "F", warrantyEndsAt: "" }, { creating: true }).data
    .warrantyEndsAt === null &&
    parseEquipmentBody({ name: "F", warrantyEndsAt: null }, { creating: true }).data
      .warrantyEndsAt === null,
);
ok(
  "an unparseable warranty date is REFUSED, never silently defaulted to today",
  (() => {
    const r = parseEquipmentBody({ name: "F", warrantyEndsAt: "next spring" }, { creating: true });
    return !!r.error && r.data === undefined;
  })(),
  parseEquipmentBody({ name: "F", warrantyEndsAt: "next spring" }, { creating: true }),
);
ok(
  "an edit that changes nothing is refused rather than writing an empty update",
  !!parseEquipmentBody({}, { creating: false }).error,
);
ok(
  "a blank name on edit is refused — the row must keep a name",
  !!parseEquipmentBody({ name: "   " }, { creating: false }).error,
);
ok(
  "a non-string field is nulled rather than coerced into '[object Object]'",
  parseEquipmentBody({ name: "F", manufacturer: { evil: true } }, { creating: true }).data
    .manufacturer === null,
);

ok(
  "a service visit needs a description and a date — neither is defaulted",
  !!parseServiceBody({ servicedAt: "2026-01-01" }).error &&
    !!parseServiceBody({ description: "Serviced" }).error,
);
ok(
  "underWarranty is strict: only a literal true records a covered visit",
  parseServiceBody({ description: "x", servicedAt: "2026-01-01", underWarranty: "true" }).data
    .underWarranty === false &&
    parseServiceBody({ description: "x", servicedAt: "2026-01-01", underWarranty: true }).data
      .underWarranty === true,
);

ok(
  "a blank odometer clears BOTH the reading and its date",
  (() => {
    const d = parseVehicleBody({ odometerKm: "" }, { creating: false }).data;
    return d.odometerKm === null && d.odometerAtUtc === null;
  })(),
  parseVehicleBody({ odometerKm: "" }, { creating: false }),
);
ok(
  "an odometer of 0 is accepted and stamped with a read date",
  (() => {
    const d = parseVehicleBody({ odometerKm: 0 }, { creating: true }).data;
    return d.odometerKm === 0 && d.odometerAtUtc instanceof Date;
  })(),
);
for (const bad of ["84,000", "84000km", -1, 1.5, {}])
  ok(
    `an odometer of ${JSON.stringify(bad)} is refused, not rounded or zeroed`,
    !!parseVehicleBody({ odometerKm: bad }, { creating: true }).error,
    parseVehicleBody({ odometerKm: bad }, { creating: true }),
  );
ok(
  "a blank insurance date clears it rather than being ignored",
  parseVehicleBody({ insuranceExpiresAt: "" }, { creating: false }).data
    .insuranceExpiresAt === null,
);
ok(
  "an unparseable insurance date is refused",
  !!parseVehicleBody({ insuranceExpiresAt: "soon" }, { creating: false }).error,
);
ok(
  "a nonsense model year is refused rather than stored",
  !!parseVehicleBody({ year: 1200 }, { creating: true }).error &&
    !!parseVehicleBody({ year: 3000 }, { creating: true }).error,
);
ok(
  "an empty PATCH is refused",
  !!parseVehicleBody({}, { creating: false }).error,
);
ok(
  "an empty POST is allowed — a van can be added with only its asset link",
  !parseVehicleBody({}, { creating: true }).error,
);

ok(
  "a maintenance entry needs a kind on the server's own list",
  !!parseMaintenanceBody({ description: "x", performedAt: "2026-01-01", kind: "sabotage" })
    .error,
);
ok(
  "a maintenance cost left blank stays NULL — 0 would say it was free",
  (() => {
    const d = parseMaintenanceBody({
      kind: "repair",
      description: "x",
      performedAt: "2026-01-01",
    }).data;
    return d.costCents === null && d.odometerKm === null;
  })(),
);
ok(
  "a maintenance cost of 0 is accepted when it is actually typed",
  parseMaintenanceBody({
    kind: "repair",
    description: "x",
    performedAt: "2026-01-01",
    costCents: 0,
  }).data.costCents === 0,
);

// ═══════════════════════════════════════════════════════════════════════════
section("7. Who gets in, and who sees what the van cost");
// ═══════════════════════════════════════════════════════════════════════════

const CREW = { role: "employee", permissions: PERMISSION_PRESETS.worker.values };
const ESTIMATOR = { role: "employee", permissions: PERMISSION_PRESETS.estimator.values };
const DISPATCHER = { role: "supervisor", permissions: PERMISSION_PRESETS.dispatcher.values };
const MANAGER = { role: "supervisor", permissions: PERMISSION_PRESETS.manager.values };
const OWNER = { role: "owner", permissions: null };

ok("Crew cannot read client equipment — an address is not the installed base",
  canReadEquipment(CREW) === false && canWriteEquipment(CREW) === false);
ok("an Estimator reads and writes client equipment", canReadEquipment(ESTIMATOR) && canWriteEquipment(ESTIMATOR));
ok("an Estimator cannot DELETE equipment — the delete rung is one above edit",
  canDeleteEquipment(ESTIMATOR) === false);
ok("a Manager can delete it", canDeleteEquipment(MANAGER) === true);
ok("an owner holds everything", canReadEquipment(OWNER) && canDeleteEquipment(OWNER));
ok("the equipment refusal is a 403, never a 500", (() => {
  try {
    requireEquipmentRead(CREW);
    return false;
  } catch (err) {
    return err.status === 403 && typeof err.message === "string" && err.message.length > 0;
  }
})());

ok("Crew cannot open the fleet screen", canReadFleet(CREW) === false);
ok("an Estimator cannot either — a van is a company record, not a quoting tool",
  canReadFleet(ESTIMATOR) === false);
ok("a Dispatcher can — the person deciding which van goes out", canReadFleet(DISPATCHER) === true);
// The two-gate design, asserted as a pair rather than described.
ok(
  "a Dispatcher sees the fleet WITHOUT seeing what the van cost",
  canReadFleet(DISPATCHER) === true && canSeeVehicleCost(DISPATCHER) === false,
);
ok("a Manager sees the cost too", canSeeVehicleCost(MANAGER) === true);
ok("an owner sees the cost", canSeeVehicleCost(OWNER) === true);
// The bug lib/permissions/costBasis.js exists to prevent: a write that
// succeeds where the read refuses.
ok(
  "write ⇒ read for every preset on the fleet gate",
  [CREW, ESTIMATOR, DISPATCHER, MANAGER, OWNER].every(
    (m) => !canWriteFleet(m) || canReadFleet(m),
  ),
);
ok("the fleet refusal is a 403, never a 500", (() => {
  try {
    requireFleetRead(CREW);
    return false;
  } catch (err) {
    return err.status === 403;
  }
})());
ok("a null member is refused rather than throwing", canReadFleet(null) === false && canReadEquipment(null) === false);

ok(
  "stripVehicleCost removes the money and keeps the operations",
  (() => {
    const row = { id: "v", plate: "ABC", asset: { id: "a", name: "Van", cost: 48000, bookValue: 30000, debtId: "d1" } };
    const stripped = stripVehicleCost(row);
    return (
      stripped.plate === "ABC" &&
      stripped.asset.name === "Van" &&
      !("cost" in stripped.asset) &&
      !("bookValue" in stripped.asset) &&
      !("debtId" in stripped.asset)
    );
  })(),
);
ok("stripVehicleCost tolerates an orphan with no asset", stripVehicleCost({ asset: null }).asset === null);

// ═══════════════════════════════════════════════════════════════════════════
section("8. The whole fleet payload, built the way the route builds it");
// ═══════════════════════════════════════════════════════════════════════════

// A Prisma double covering exactly the three reads loadFleet makes. Enough to
// prove the join, the cost gate and the due list end to end — which is what
// "the expiring-soon list" means once it has been through a real handler.
function fakeDb() {
  return {
    vehicleDetail: {
      findMany: async () => [DETAIL_VAN, DETAIL_BLANK, DETAIL_ORPHAN],
    },
    asset: {
      // The route's OR clause is what keeps an asset with a detail row in the
      // list even when its category was never set; the double honours both
      // halves so the assertion below is about the real filter.
      findMany: async ({ where }) => {
        const ids = where.OR.find((c) => c.id)?.id?.in || [];
        return [ASSET_VAN, ASSET_SPARE].filter(
          (a) => a.category === "vehicle" || ids.includes(a.id),
        );
      },
    },
    member: {
      findMany: async () => [
        { userId: "user-1", active: true, user: { name: "Marc", email: "m@x.ca" } },
        { userId: "user-2", active: false, user: { name: null, email: "old@x.ca" } },
      ],
    },
  };
}

const MEMBER = { companyId: "co-1" };
const asManager = await loadFleet({ db: fakeDb(), member: MEMBER, full: MANAGER, asOf: NOW });
const asDispatcher = await loadFleet({ db: fakeDb(), member: MEMBER, full: DISPATCHER, asOf: NOW });

ok("the payload lists every van and every un-recorded vehicle asset", asManager.vehicles.length === 4);
ok(
  "the due-soon list is the two with something lapsed, most urgent first",
  asManager.dueSoon.map((r) => r.vehicleId).join(",") === "veh-1,veh-3",
  asManager.dueSoon.map((r) => [r.vehicleId, r.state]),
);
ok(
  "each due row names WHY, so the screen never shows a red dot with no reason",
  asManager.dueSoon.every((r) => r.reasons.length > 0),
);
ok(
  "the driver's name is resolved from this company's own membership",
  asManager.vehicles.find((v) => v.id === "veh-1")?.assignedToName === "Marc",
);
ok(
  "an unassigned van reports a null driver rather than an empty string",
  asManager.vehicles.find((v) => v.id === "veh-2")?.assignedToName === null,
);
ok(
  "a manager's payload carries the cost and a computed book value",
  (() => {
    const van = asManager.vehicles.find((v) => v.id === "veh-1");
    return (
      asManager.canSeeCost === true &&
      Number(van?.asset?.cost) === 48000 &&
      typeof van?.asset?.bookValue === "number" &&
      van.asset.bookValue < 48000
    );
  })(),
  asManager.vehicles.find((v) => v.id === "veh-1")?.asset,
);
// The whole point of the second gate.
ok(
  "a dispatcher's payload has NO cost field at all — not a nulled one",
  (() => {
    const van = asDispatcher.vehicles.find((v) => v.id === "veh-1");
    return (
      asDispatcher.canSeeCost === false &&
      !!van?.asset &&
      !("cost" in van.asset) &&
      !("bookValue" in van.asset) &&
      !("monthlyDepreciation" in van.asset)
    );
  })(),
  asDispatcher.vehicles.find((v) => v.id === "veh-1")?.asset,
);
ok(
  "a dispatcher still gets the plate, the odometer and the lapsed insurance",
  (() => {
    const van = asDispatcher.vehicles.find((v) => v.id === "veh-1");
    return (
      van?.plate === "ABC 123" &&
      van?.odometerKm === 84000 &&
      van?.attention.state === EXPIRY_STATES.EXPIRED
    );
  })(),
);
ok(
  "the dispatcher's due-soon list is identical to the manager's — money is not what makes a van due",
  JSON.stringify(asDispatcher.dueSoon.map((r) => [r.vehicleId, r.state])) ===
    JSON.stringify(asManager.dueSoon.map((r) => [r.vehicleId, r.state])),
);
ok(
  "the payload says whether the person may add a vehicle to the register, so no button is drawn on a guess",
  asManager.canManageAssets === true && asDispatcher.canManageAssets === false,
  { manager: asManager.canManageAssets, dispatcher: asDispatcher.canManageAssets },
);
ok(
  "the orphan survives the whole payload with its flag intact",
  asManager.vehicles.find((v) => v.id === "veh-3")?.assetMissing === true,
);

// ═══════════════════════════════════════════════════════════════════════════
section("9. Two source rules, each scoped to ONE brace-matched function");
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The body of `name`, from its declaration to the matching close brace.
 *
 * Brace-matched rather than regex-delimited so a rule about one function
 * cannot be satisfied — or broken — by an edit somewhere else in the file.
 * Strings and comments are not stripped, which is fine: both rules below look
 * for the presence or absence of code tokens that would be odd to write inside
 * a string, and the alternative (a parser) is not installed.
 */
function functionBody(file, name) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const decl = new RegExp(
    `(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=\\s*(?:async\\s*)?\\(`,
  ).exec(src);
  if (!decl) return null;

  // Walk the PARAMETER LIST first. A destructured parameter object opens a
  // brace before the body does — `function EquipmentRow({ row, open, … })` —
  // and taking the first `{` after the name captured the parameters and called
  // it the body. Both rules below then passed against six lines of argument
  // names, which is a check certifying a file it never read.
  let i = decl.index + decl[0].length - 1;
  let parens = 0;
  for (; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) break;
    }
  }
  const open = src.indexOf("{", i);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

const ODOMETER_BODY = functionBody("lib/fleet/vehicle.js", "odometerReading");
ok("odometerReading's body was located", !!ODOMETER_BODY);
// The promise here is about an ABSENCE — that nothing coerces an unrecorded
// mileage into a number — and no single call can demonstrate the absence of a
// pattern. It is the one rule in this feature that a future edit could break
// while every behavioural assertion above still passed, because `?? 0` would
// only surface on a shape nobody thought to fixture.
ok(
  "odometerReading contains no zero-coercion of an unknown mileage",
  !!ODOMETER_BODY &&
    !/\|\|\s*0\b/.test(ODOMETER_BODY) &&
    !/\?\?\s*0\b/.test(ODOMETER_BODY) &&
    !/Number\s*\(/.test(ODOMETER_BODY),
  ODOMETER_BODY,
);

// JSX cannot be executed in this run, so the panel's rendering rule is read
// rather than run — scoped to the one component that renders a warranty badge.
const ROW_BODY = functionBody("app/components/clients/ClientEquipment.js", "EquipmentRow");
ok("EquipmentRow's body was located", !!ROW_BODY);
ok(
  "EquipmentRow has a distinct branch for an unknown warranty",
  !!ROW_BODY &&
    /warranty\.state === "unknown"/.test(ROW_BODY) &&
    /app\.equipment\.warrantyUnknown/.test(ROW_BODY) &&
    /app\.equipment\.badgeUnknown/.test(ROW_BODY),
  ROW_BODY ? ROW_BODY.slice(0, 400) : null,
);
ok(
  "EquipmentRow never labels an unrecorded warranty with the expired copy",
  !!ROW_BODY &&
    // The expired string must appear only inside a branch that tested for
    // "expired" — i.e. it is never the fallback an unknown state falls into.
    ROW_BODY.indexOf('warranty.state === "expired"') <
      ROW_BODY.indexOf("app.equipment.badgeExpired"),
);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
