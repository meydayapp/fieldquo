// Executes lib/booking/travel.js against real geography and hostile input.
import { readFileSync } from "node:fs";

import {
  hasPoint, haversineKm, estimateTravel, travelMinutes, reachable, describeTravel, travelLegs,
} from "@/lib/booking/travel";
import { routeLegs, isOnRoute, OFF_ROUTE_STATUSES } from "@/lib/schedule/routeLegs";
import { zonedDayKey } from "@/lib/booking/travel";
import { dayKey } from "@/lib/calendar/monthGrid";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

// Real places, so the distances can be checked against something outside this file.
const MTL_DOWNTOWN = { lat: 45.5019, lng: -73.5674 };
const MTL_WEST = { lat: 45.4581, lng: -73.6392 };   // NDG, ~7 km west
const LAVAL = { lat: 45.6066, lng: -73.7124 };      // ~17 km north
const TORONTO = { lat: 43.6532, lng: -79.3832 };    // ~505 km — different day
const QUEBEC_CITY = { lat: 46.8139, lng: -71.2080 }; // ~233 km

const at = (h, m = 0) => new Date(Date.UTC(2026, 6, 30, h, m));
const reachableAt17 = (travel) => reachable({ previousEnd: at(17), slotStart: at(18), travel }).ok;

console.log("\nPoint validation");
ok("real point accepted", hasPoint(MTL_DOWNTOWN));
ok("null refused", !hasPoint(null));
ok("undefined refused", !hasPoint(undefined));
ok("{} refused", !hasPoint({}));
ok("null island (0,0) refused — that's a failed geocode", !hasPoint({ lat: 0, lng: 0 }));
ok("lat 91 refused", !hasPoint({ lat: 91, lng: 0 }));
ok("lng -181 refused", !hasPoint({ lat: 45, lng: -181 }));
ok("NaN refused", !hasPoint({ lat: NaN, lng: -73 }));
ok("strings accepted (Prisma Decimal arrives as one)", hasPoint({ lat: "45.5", lng: "-73.5" }));
ok("empty strings refused", !hasPoint({ lat: "", lng: "" }));

console.log("\nDistance sanity, against known geography");
const d = haversineKm(MTL_DOWNTOWN, MTL_WEST);
ok(`downtown MTL -> NDG is 6-9 km (${d?.toFixed(1)})`, d > 6 && d < 9, d);
const dl = haversineKm(MTL_DOWNTOWN, LAVAL);
ok(`downtown MTL -> Laval is 14-20 km (${dl?.toFixed(1)})`, dl > 14 && dl < 20, dl);
const dt = haversineKm(MTL_DOWNTOWN, TORONTO);
ok(`MTL -> Toronto is 490-520 km (${dt?.toFixed(0)})`, dt > 490 && dt < 520, dt);
ok("same point is 0 km", haversineKm(MTL_WEST, MTL_WEST) === 0);
ok("symmetric", Math.abs(haversineKm(MTL_WEST, LAVAL) - haversineKm(LAVAL, MTL_WEST)) < 1e-9);
ok("missing end -> null, not 0", haversineKm(MTL_WEST, null) === null);

console.log("\nOffline estimate");
const e = estimateTravel(MTL_DOWNTOWN, MTL_WEST);
ok(`crosstown ~7km reads 15-25 min (${e?.minutes})`, e.minutes >= 15 && e.minutes <= 25, e);
ok("labelled an estimate, never a driving time", e.source === "estimate");
ok("reports km too", e.km > 0);
const same = estimateTravel(MTL_WEST, MTL_WEST);
ok("same address = 0 min, not a padded minimum", same.minutes === 0, same);
// No distance cut-off: a long trip must produce a long travel time, because
// null would mean "unknown" and unknown never filters.
ok("Toronto answers with hours, not null", estimateTravel(MTL_DOWNTOWN, TORONTO)?.minutes > 600);
ok("Quebec City answers", estimateTravel(MTL_DOWNTOWN, QUEBEC_CITY)?.minutes > 300);
ok("MTL 5pm -> Toronto 6pm is REFUSED (the case a cut-off used to let through)",
  reachableAt17(estimateTravel(MTL_DOWNTOWN, TORONTO).minutes) === false);
ok("no coordinates -> null", estimateTravel(null, MTL_WEST) === null);

console.log("\nThe reachability rule");
ok("5pm end, 6pm start, 30 min travel -> fine",
  reachable({ previousEnd: at(17), slotStart: at(18), travel: 30 }).ok === true);
ok("5pm end, 5:15 start, 30 min travel -> refused",
  reachable({ previousEnd: at(17), slotStart: at(17, 15), travel: 30 }).ok === false);
ok("...and says how short it is (15 min)",
  reachable({ previousEnd: at(17), slotStart: at(17, 15), travel: 30 }).shortBy === 15,
  reachable({ previousEnd: at(17), slotStart: at(17, 15), travel: 30 }));
ok("exactly enough time -> fine (not off by one)",
  reachable({ previousEnd: at(17), slotStart: at(17, 30), travel: 30 }).ok === true);
ok("one minute short -> refused",
  reachable({ previousEnd: at(17), slotStart: at(17, 29), travel: 30 }).ok === false);
ok("buffer is added on top",
  reachable({ previousEnd: at(17), slotStart: at(17, 30), travel: 30, buffer: 10 }).ok === false);
ok("buffer satisfied",
  reachable({ previousEnd: at(17), slotStart: at(17, 40), travel: 30, buffer: 10 }).ok === true);
ok("negative buffer can't create time",
  reachable({ previousEnd: at(17), slotStart: at(17, 10), travel: 30, buffer: -60 }).ok === false);

console.log("\nUnknown travel must NEVER hide a slot");
for (const t of [null, undefined, NaN, "abc"]) {
  const r = reachable({ previousEnd: at(17), slotStart: at(17, 1), travel: t });
  ok(`travel=${String(t)} -> allowed, and flagged unknown`, r.ok === true && r.known === false, r);
}
ok("known travel is flagged known",
  reachable({ previousEnd: at(17), slotStart: at(19), travel: 30 }).known === true);
ok("zero travel is KNOWN, not unknown (same address)",
  reachable({ previousEnd: at(17), slotStart: at(17), travel: 0 }).known === true);

console.log("\nWording carries the source");
ok("driving reads as a drive", describeTravel({ minutes: 25, source: "driving" }) === "25 min drive");
ok("estimate is hedged", describeTravel({ minutes: 25, source: "estimate" }) === "about 25 min drive");
ok("estimate and measurement never read the same",
  describeTravel({ minutes: 25, source: "driving" }) !== describeTravel({ minutes: 25, source: "estimate" }));
ok("over an hour", describeTravel({ minutes: 70, source: "driving" }) === "1 h 10 drive");
ok("exactly an hour", describeTravel({ minutes: 60, source: "driving" }) === "1 h drive");
ok("french", describeTravel({ minutes: 25, source: "driving" }, "fr") === "25 min de route");
ok("french hedges too", describeTravel({ minutes: 25, source: "estimate" }, "fr").startsWith("environ"));
ok("null in, null out", describeTravel(null) === null);

console.log("\ntravelMinutes: degrades, never throws");
const nope = async () => { throw new Error("network down"); };
ok("no key -> offline estimate", (await travelMinutes(MTL_DOWNTOWN, MTL_WEST)).source === "estimate");
ok("key + dead network -> estimate, no throw",
  (await travelMinutes(MTL_DOWNTOWN, MTL_WEST, { key: "k", fetchImpl: nope })).source === "estimate");
ok("key + 500 -> estimate",
  (await travelMinutes(MTL_DOWNTOWN, MTL_WEST, { key: "k", fetchImpl: async () => ({ ok: false }) })).source === "estimate");
ok("key + ZERO_RESULTS -> estimate",
  (await travelMinutes(MTL_DOWNTOWN, MTL_WEST, {
    key: "k",
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: "OK", rows: [{ elements: [{ status: "ZERO_RESULTS" }] }] }) }),
  })).source === "estimate");
ok("no coordinates -> null even with a key",
  (await travelMinutes(null, MTL_WEST, { key: "k" })) === null);

const good = {
  ok: true,
  json: async () => ({ status: "OK", rows: [{ elements: [{ status: "OK", duration: { value: 1500 }, distance: { value: 9200 } }] }] }),
};
// `async () => good`, not `good` — fetchImpl is a FUNCTION. Passing the
// response object made it throw, which the catch turned into a fallback.
const real = await travelMinutes(MTL_DOWNTOWN, MTL_WEST, { key: "k", fetchImpl: async () => good });
ok("a real answer is used", real.minutes === 25 && real.km === 9.2, real);
ok("...and labelled driving", real.source === "driving");

console.log("\nThe scenario from the brief");
// "a meeting that ends at 5pm and the next cannot be at 6pm if it's across
// town" — with a genuinely long crosstown haul, 5pm -> 5:30 must fail.
const crosstown = estimateTravel(MTL_WEST, LAVAL);
console.log(`  (NDG -> Laval estimates ${crosstown.minutes} min over ${crosstown.km} km)`);
ok("5:00 finish -> 5:30 across town is refused",
  reachable({ previousEnd: at(17), slotStart: at(17, 30), travel: crosstown.minutes }).ok === false);
ok("5:00 finish -> 6:30 across town is fine",
  reachable({ previousEnd: at(17), slotStart: at(18, 30), travel: crosstown.minutes }).ok === true);

console.log("\nTravel legs across a day");
const iso = (h, m = 0) => new Date(Date.UTC(2026, 6, 30, h, m)).toISOString();
const stops = [
  { id: "a", at: iso(9), endAt: iso(10), ...{ latitude: MTL_DOWNTOWN.lat, longitude: MTL_DOWNTOWN.lng } },
  { id: "b", at: iso(10, 20), endAt: iso(11, 20), latitude: MTL_WEST.lat, longitude: MTL_WEST.lng },
  { id: "c", at: iso(13), endAt: iso(14), latitude: LAVAL.lat, longitude: LAVAL.lng },
  { id: "d", at: iso(14, 5), endAt: iso(15), latitude: MTL_DOWNTOWN.lat, longitude: MTL_DOWNTOWN.lng },
];
const legs = travelLegs(stops);
ok("first stop of the day has no leg", legs[0].travel === null);
ok("second stop gets a drive", legs[1].travel?.minutes > 0, legs[1]);
// A 20-minute gap against a 19-minute drive has a minute of slack. Real, so
// not flagged — the check has to sit on the right side of the boundary or it
// cries wolf on every schedule and gets ignored.
ok("20 min gap vs 19 min drive is NOT flagged", legs[1].tight === false, legs[1]);
ok("...but 15 min gap vs the same drive IS", travelLegs([
  stops[0],
  { ...stops[1], at: iso(10, 15) },
])[1].tight === true);
ok("11:20 finish -> 13:00 in Laval is fine", legs[2].tight === false, legs[2]);
ok("14:00 finish -> 14:05 back downtown is tight", legs[3].tight === true, legs[3]);
ok("tight legs say how short", legs[3].shortBy > 0, legs[3]);
ok("gap is reported", legs[1].gapMinutes === 20, legs[1]);

const nextDay = travelLegs([
  { id: "x", at: iso(16), endAt: iso(17), latitude: MTL_DOWNTOWN.lat, longitude: MTL_DOWNTOWN.lng },
  { id: "y", at: new Date(Date.UTC(2026, 6, 31, 9)).toISOString(), endAt: null, latitude: TORONTO.lat, longitude: TORONTO.lng },
]);
ok("overnight is not a drive", nextDay[1].travel === null, nextDay[1]);

const noCoords = travelLegs([
  { id: "p", at: iso(9), endAt: iso(10) },
  { id: "q", at: iso(10, 1), endAt: iso(11) },
]);
ok("no coordinates -> no travel, and never 'tight'", noCoords[1].travel === null && noCoords[1].tight === false, noCoords[1]);

const noEnd = travelLegs([
  { id: "p", at: iso(9), latitude: MTL_DOWNTOWN.lat, longitude: MTL_DOWNTOWN.lng },
  { id: "q", at: iso(9, 5), latitude: LAVAL.lat, longitude: LAVAL.lng },
]);
ok("unknown end time -> shows the drive but passes no verdict",
  noEnd[1].travel !== null && noEnd[1].tight === false, noEnd[1]);

ok("empty list -> empty", travelLegs([]).length === 0);
ok("undefined -> empty, not a crash", travelLegs().length === 0);

// ══ The calendar's own chain: who is driving where ═════════════════════════
//
// travelLegs above is correct in isolation. What shipped broken was the
// CHAIN the calendar handed it: every entry for a person, cancelled rows
// included. A cancelled visit is a row on the calendar and nobody's drive,
// and counting it as a stop absorbed the warning that belonged to the real
// visit behind it — see lib/schedule/routeLegs.js.
//
// These assertions execute routeLegs, not a copy of its logic, which is the
// whole reason the chain was moved out of app/app/appointments/page.js.
console.log("\nThe route chain: cancelled rows are nobody's drive");

const GATINEAU = { lat: 45.395672, lng: -75.841613 };
const CARLETON_PLACE = { lat: 45.143823, lng: -76.157409 };

/** A calendar entry, shaped the way lib/schedule/jobVisits.js merges them. */
const entry = (id, { at, endAt = null, status = "scheduled", who = "van-1", point = null, name = null, kind = "appointment" }) => ({
  kind,
  id,
  assignedToId: who,
  scheduledAt: at,
  status,
  client: name ? { name } : null,
  booking: endAt ? { endTime: endAt } : null,
  latitude: point?.lat ?? null,
  longitude: point?.lng ?? null,
});

// ── The live case, exactly ────────────────────────────────────────────────
// TrueFinish Cabinets, 2026-11-09, all three on one person:
//   20:00Z completed  Joel Reardon, Gatineau, ends 21:00Z
//   22:00Z CANCELLED  Joel Reardon, Carleton Place
//   22:00Z completed  Peter,        Carleton Place
// The 1 h 35 drive from Gatineau belongs to PETER's visit. It was printed on
// the cancelled one, and Peter's read "about 0 min drive" because the
// cancelled row at the same address was standing in front of it.
const nov9 = (h, m = 0) => new Date(Date.UTC(2026, 10, 9, h, m)).toISOString();
const liveDay = [
  entry("joel-1500", { at: nov9(20), endAt: nov9(21), status: "completed", point: GATINEAU, name: "Joel Reardon" }),
  entry("joel-CANCELLED-1700", { at: nov9(22), status: "cancelled", point: CARLETON_PLACE, name: "Joel Reardon" }),
  entry("peter-1700", { at: nov9(22), status: "completed", point: CARLETON_PLACE, name: "Peter" }),
];
const live = routeLegs(liveDay);
ok("the cancelled visit gets NO leg at all", live.get("joel-CANCELLED-1700") === undefined, live.get("joel-CANCELLED-1700"));
ok("the real visit gets the drive", live.get("peter-1700")?.travel?.minutes > 90, live.get("peter-1700"));
ok("...and it is the 1 h 35 the cancelled row was wearing",
  live.get("peter-1700")?.travel?.minutes === 95, live.get("peter-1700"));
ok("...with the 60 min gap", live.get("peter-1700")?.gapMinutes === 60, live.get("peter-1700"));
ok("...flagged tight, 35 short", live.get("peter-1700")?.tight === true && live.get("peter-1700")?.shortBy === 35, live.get("peter-1700"));
ok("the real visit no longer reads 'about 0 min' off the cancelled stop",
  live.get("peter-1700")?.travel?.minutes !== 0, live.get("peter-1700"));
ok("the first stop of the day still has no leg", live.get("joel-1500")?.travel === null, live.get("joel-1500"));
// The second half of the bug: the cancelled row must not be a PREDECESSOR
// either. Removing it from the map while still chaining through it would hide
// the warning and look fixed.
ok("the drive is measured from Gatineau, not from the cancelled stop's address",
  live.get("peter-1700")?.fromName === "Joel Reardon" && live.get("peter-1700")?.fromEndAt === nov9(21),
  live.get("peter-1700"));

// ── The whole off-route vocabulary, not just the word in the bug report ───
ok("OFF_ROUTE_STATUSES holds cancelled", OFF_ROUTE_STATUSES.includes("cancelled"));
ok("...and the JobVisit 'canceled' spelling, which is really in the table", OFF_ROUTE_STATUSES.includes("canceled"));
ok("...and rescheduled — its new time is its own row", OFF_ROUTE_STATUSES.includes("rescheduled"));
for (const off of OFF_ROUTE_STATUSES) {
  const day = [
    entry("first", { at: nov9(20), endAt: nov9(21), point: GATINEAU }),
    entry("off", { at: nov9(22), status: off, point: CARLETON_PLACE }),
    entry("real", { at: nov9(22), point: CARLETON_PLACE }),
  ];
  const legs2 = routeLegs(day);
  ok(`status "${off}" is not a stop, and not a predecessor`,
    legs2.get("off") === undefined && legs2.get("real")?.shortBy === 35, { off: legs2.get("off"), real: legs2.get("real") });
  ok(`status "${off}" answers isOnRoute false`, isOnRoute({ status: off }) === false);
}
// The exclusion must not be a blanket "anything that isn't scheduled". Drop
// too much and the chain breaks the other way: a finished day stops being
// measurable, and a visit the van DID drive to stops counting as a stop.
for (const on of ["scheduled", "needs_supervisor", "completed", "no_show", "confirmed", "pending_payment", "on_the_way", "in_progress"]) {
  ok(`status "${on}" stays on the route`, isOnRoute({ status: on }) === true);
  const legs3 = routeLegs([
    entry("first", { at: nov9(20), endAt: nov9(21), point: GATINEAU }),
    entry("second", { at: nov9(22), status: on, point: CARLETON_PLACE }),
  ]);
  ok(`...and "${on}" still gets its drive`, legs3.get("second")?.shortBy === 35, legs3.get("second"));
}
ok("a missing status is the default, which is on the route", isOnRoute({ status: null }) === true);
ok("an unknown status is NOT silently dropped from the chain", isOnRoute({ status: "halfway_there" }) === true);
ok("a Google busy block is time, not a place", isOnRoute({ kind: "busy", status: null }) === false);
ok("nothing at all is not a stop", isOnRoute(null) === false && isOnRoute(undefined) === false);

// ── What the warning names ───────────────────────────────────────────────
const named = routeLegs([
  entry("a", { at: nov9(20), endAt: nov9(21), point: GATINEAU, name: "Joel Reardon" }),
  entry("b", { at: nov9(22), point: CARLETON_PLACE, name: "Peter" }),
]);
ok("a leg says which visit it leaves from", named.get("b")?.fromName === "Joel Reardon", named.get("b"));
ok("...and when that visit ends — the moment the drive starts", named.get("b")?.fromEndAt === nov9(21), named.get("b"));
ok("the first stop of a day names nothing to come from",
  named.get("a")?.fromName === null && named.get("a")?.fromEndAt === null, named.get("a"));
// Absence is not a statement (AGENTS.md #5). A predecessor with no name must
// produce no name, not "Unknown" or the word "client".
const nameless = routeLegs([
  entry("a", { at: nov9(20), endAt: nov9(21), point: GATINEAU }),
  entry("b", { at: nov9(22), point: CARLETON_PLACE }),
]);
ok("an unnamed predecessor yields no name, not an invented one", nameless.get("b")?.fromName === null, nameless.get("b"));
// And a predecessor whose finish is unknown must not have one guessed: that
// is also the only case with no gap and no verdict.
const openEnded = routeLegs([
  entry("a", { at: nov9(20), point: GATINEAU, name: "Joel Reardon" }),
  entry("b", { at: nov9(22), point: CARLETON_PLACE, name: "Peter" }),
]);
ok("unknown finish -> the drive, no end time, no gap, no verdict",
  openEnded.get("b")?.travel !== null &&
    openEnded.get("b")?.fromEndAt === null &&
    openEnded.get("b")?.gapMinutes === null &&
    openEnded.get("b")?.tight === false,
  openEnded.get("b"));

// ── One person's day, not the company's ──────────────────────────────────
const twoPeople = routeLegs([
  entry("painter-am", { at: nov9(20), endAt: nov9(21), point: GATINEAU, who: "painter" }),
  entry("plumber-pm", { at: nov9(22), point: CARLETON_PLACE, who: "plumber" }),
]);
ok("a plumber is not driving from a painter's last job",
  twoPeople.get("plumber-pm")?.travel === null, twoPeople.get("plumber-pm"));
const unassigned = routeLegs([
  entry("mine", { at: nov9(20), endAt: nov9(21), point: GATINEAU }),
  { kind: "appointment", id: "nobodys", assignedToId: null, scheduledAt: nov9(22), status: "scheduled", client: null, booking: null, latitude: CARLETON_PLACE.lat, longitude: CARLETON_PLACE.lng },
]);
ok("nobody is not a person with a van", unassigned.get("nobodys") === undefined, unassigned.get("nobodys"));
ok("...and an unassigned row is not a predecessor either", unassigned.size === 1, [...unassigned.keys()]);

// ── Guards ───────────────────────────────────────────────────────────────
ok("empty list -> empty map", routeLegs([]).size === 0);
ok("undefined -> empty map, not a crash", routeLegs().size === 0);
ok("a day of nothing but cancelled rows yields nothing, and does not throw",
  routeLegs([
    entry("x", { at: nov9(20), endAt: nov9(21), status: "cancelled", point: GATINEAU }),
    entry("y", { at: nov9(22), status: "cancelled", point: CARLETON_PLACE }),
  ]).size === 0);
// The mutation guard: if the exclusion ever drops EVERY stop, every assertion
// above about a leg landing somewhere goes with it — so assert the chain
// still produces one at all.
ok("a day of real visits still produces legs (the exclusion is not a blanket)",
  routeLegs(liveDay).size === 2, [...routeLegs(liveDay).keys()]);

// ══ What the calendar does with the leg ════════════════════════════════════
//
// The two decisions above this are pure and executed. The two below live in
// the page's JSX and can only be read, so they are read — a regression here
// is the same bug coming back with a different shape.
console.log("\nThe calendar's travel line");
const page = readFileSync(
  new URL("../app/app/appointments/page.js", import.meta.url),
  "utf8",
);
ok("the calendar uses the shared chain, not a second copy of it",
  /from "@\/lib\/schedule\/routeLegs"/.test(page) && /routeLegs\(appointments/.test(page));
ok("...and no longer keeps a local one that would rot apart from this check",
  !/function legsByAppointment/.test(page));
// The warning names the stop it leaves from. Without this the line read "60
// min gap" on a list whose visual order is not one person's day, and the
// owner read it as comparing two visits a week apart.
// The FRAGMENT, not just the field name: `leg.fromName` also appears as the
// guard on the time clause, so a check for the identifier alone passed with
// the name itself deleted from the sentence.
ok("the line names which visit the drive leaves from",
  /from \$\{leg\.fromName\}/.test(page));
ok("...and when that visit ends", /leg\.fromEndAt \?/.test(page) && /ends \$\{localeDateTime\(fromEnd/.test(page));
// A travel warning about a trip that already happened is noise: there is
// nothing left to rearrange, and an unactionable alarm teaches people to
// ignore the actionable ones. The grey drive line stays; the amber does not.
ok("the amber alarm is raised only about a visit still to come",
  /leg\.tight && upcoming/.test(page) && /startAt\.getTime\(\) >= nowMs/.test(page));
ok("...and the amber, the icon and the 'short' figure all answer the SAME question",
  (page.match(/\bwarn\b/g) || []).length >= 4, (page.match(/\bwarn\b/g) || []).length);

// ── Whose day is it ────────────────────────────────────────────────────────
//
// The reported bug: "about 25 min drive from Julie Retar" printed under a
// Wednesday appointment, for a visit made on the Tuesday evening. The day was
// being read in UTC while the schedule prints and buckets in the reader's own
// zone, so every stop after 7pm Eastern had already become tomorrow.
//
// The fixtures below are pinned to named zones rather than built with
// Date.UTC, because the UTC-built ones above pass under the bug: a check that
// agrees with the code's own assumption proves nothing. Each case here fails
// if the day is read in UTC, from a machine in ANY zone — including the
// UTC one a build runs on.
console.log("\nThe day boundary is the reader's, not UTC's");

const stop = (id, iso, point) => ({ id, at: iso, latitude: point.lat, longitude: point.lng });

// 2026-11-10 19:00 and 2026-11-11 09:00 in Toronto. One UTC day (the 11th),
// two Eastern days — the owner's exact case.
const torontoOvernight = travelLegs(
  [
    stop("tue-eve", "2026-11-11T00:00:00.000Z", MTL_DOWNTOWN),
    stop("wed-morning", "2026-11-11T14:00:00.000Z", MTL_WEST),
  ],
  { timeZone: "America/Toronto" },
);
ok("Tuesday 7pm -> Wednesday 9am Eastern is not a drive, though it is one UTC day",
  torontoOvernight[1].travel === null, torontoOvernight[1]);

// The same failure east of Greenwich, where it bites in the morning instead:
// 23:00 and 09:00 next day in Sydney, both inside UTC's 11th.
const sydneyOvernight = travelLegs(
  [
    stop("wed-night", "2026-11-11T12:00:00.000Z", MTL_DOWNTOWN),
    stop("thu-morning", "2026-11-11T22:00:00.000Z", MTL_WEST),
  ],
  { timeZone: "Australia/Sydney" },
);
ok("23:00 -> 09:00 next morning in Sydney is not a drive either",
  sydneyOvernight[1].travel === null, sydneyOvernight[1]);

// And the other direction, which the UTC rule got wrong by SILENCE: two stops
// two hours apart on one Eastern evening, straddling UTC midnight.
const sameEvening = travelLegs(
  [
    stop("six", "2026-11-10T23:00:00.000Z", MTL_DOWNTOWN),
    stop("eight", "2026-11-11T01:00:00.000Z", MTL_WEST),
  ],
  { timeZone: "America/Toronto" },
);
ok("6pm -> 8pm on one Eastern evening IS a drive, though UTC midnight falls between",
  sameEvening[1].travel?.minutes > 0, sameEvening[1]);

// Called the way the schedule calls it — no zone — the day is the machine's
// own, which is the day on the reader's screen. Built with local parts so the
// pair is an evening and the next morning wherever this runs.
const localPair = travelLegs([
  { id: "eve", at: new Date(2026, 10, 10, 19, 0).toISOString(), latitude: MTL_DOWNTOWN.lat, longitude: MTL_DOWNTOWN.lng },
  { id: "morn", at: new Date(2026, 10, 11, 9, 0).toISOString(), latitude: MTL_WEST.lat, longitude: MTL_WEST.lng },
]);
ok("with no zone named, the runtime's own evening -> next morning is not a drive",
  localPair[1].travel === null, localPair[1]);

// The two spellings of "which day is this" must not drift apart: zonedDayKey
// in the runtime's zone has to be dayKey, instant for instant.
const runtimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let keysAgree = true;
for (let h = 0; h < 24 * 400; h += 7) {
  const d = new Date(Date.UTC(2026, 0, 1) + h * 3600_000);
  if (zonedDayKey(d, runtimeZone) !== dayKey(d)) { keysAgree = false; break; }
}
ok(`zonedDayKey in ${runtimeZone} is dayKey, across 400 days of instants`, keysAgree);

// Absence stays absence: a date nothing can read earns no claim, and two of
// them must not compare equal to each other.
const unreadable = travelLegs([
  stop("bad-1", "not a date", MTL_DOWNTOWN),
  stop("bad-2", "also not a date", MTL_WEST),
]);
ok("unreadable dates -> no drive, not a drive between two NaNs",
  unreadable[1].travel === null, unreadable[1]);

const unknownZone = travelLegs(
  [stop("a", "2026-11-11T14:00:00.000Z", MTL_DOWNTOWN), stop("b", "2026-11-11T15:00:00.000Z", MTL_WEST)],
  { timeZone: "Mars/Olympus_Mons" },
);
ok("a zone nothing recognises -> no drive, rather than one read in the wrong day",
  unknownZone[1].travel === null, unknownZone[1]);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
