// Executes lib/booking/travel.js against real geography and hostile input.
import {
  hasPoint, haversineKm, estimateTravel, travelMinutes, reachable, describeTravel, travelLegs,
} from "@/lib/booking/travel";

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

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
