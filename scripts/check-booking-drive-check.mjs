// scripts/check-booking-drive-check.mjs
//
// Booking drive times: the calendar is offline, Google is asked only when a
// time is booked, and a time Google says can't be made is refused with the
// next one — never silently booked (owner-approved cost saver, 2026-10-03).
//
//   npm run check:booking-drive-check
import { readFileSync } from "node:fs";
import {
  judgeSlotTravel,
  drivingMinutes,
  verifySlotTravel,
  nextVerifiedSlot,
  travelRefusal,
  clearDriveCache,
  NEXT_SLOT_CHECKS,
} from "@/lib/booking/verifyTravel";
import { slotNeighbours, estimateTravel } from "@/lib/booking/travel";

let pass = 0;
let fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const MTL = { lat: 45.5019, lng: -73.5674 };
const NDG = { lat: 45.4581, lng: -73.6392 };
const LAVAL = { lat: 45.6066, lng: -73.7124 };
const at = (h, m = 0) => new Date(Date.UTC(2026, 10, 10, h, m));
const range = (h1, h2, point) => ({ start: at(h1), end: at(h2), point });
const fixed = (minutes, source = "driving") => async () => ({ minutes, source });

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n1. The judgement around one time");
{
  const ranges = [range(13, 14, NDG), range(17, 18, LAVAL)];
  const { before, after } = slotNeighbours(ranges, at(15), at(16));
  ok("neighbours: the visit before and the visit after", before === ranges[0] && after === ranges[1]);
  ok("no ranges → no neighbours, no throw", (() => { const n = slotNeighbours(null, at(1), at(2)); return !n.before && !n.after; })());

  const fine = await judgeSlotTravel({ ranges, start: at(15), end: at(16), destination: MTL, drive: fixed(30) });
  ok("a 30-minute drive into a 60-minute gap, both legs: bookable", fine.ok && fine.legs.length === 2);
  const tight = await judgeSlotTravel({ ranges, start: at(14, 20), end: at(15, 20), destination: MTL, drive: fixed(30) });
  ok("a 30-minute drive into a 20-minute gap: refused, 10 short on the way in", !tight.ok && tight.legs[0].leg === "in" && tight.legs[0].shortBy === 10, tight);
  const outTight = await judgeSlotTravel({ ranges, start: at(15, 45), end: at(16, 45), destination: MTL, drive: fixed(30) });
  ok("…and the leg OUT is checked too (16:45 → 17:00 with a 30-minute drive)", !outTight.ok && outTight.legs.find((l) => l.leg === "out")?.ok === false);
  const buffered = await judgeSlotTravel({ ranges, start: at(14, 35), end: at(15, 0), destination: MTL, travelBuffer: 10, drive: fixed(30) });
  ok("the company's travel buffer is added (30 + 10 into a 35-minute gap)", !buffered.ok);
  const bufBefore = await judgeSlotTravel({ ranges, start: at(14, 45), end: at(15, 45), bufferBefore: 20, destination: MTL, drive: fixed(30) });
  ok("the event's own bufferBefore narrows the gap like on the calendar", !bufBefore.ok);
  const unknown = await judgeSlotTravel({ ranges, start: at(14, 5), end: at(15, 5), destination: MTL, drive: async () => null });
  ok("unknown drive NEVER refuses (no key, Google down, no coordinates)", unknown.ok);
  const noPoint = await judgeSlotTravel({ ranges: [range(13, 14, null)], start: at(14), end: at(15), destination: MTL, drive: async () => { throw new Error("must not be asked"); } });
  ok("a neighbour with no address is not driven from (and Google is not asked)", noPoint.ok && noPoint.legs.length === 0);
  const empty = await judgeSlotTravel({ ranges: [], start: at(9), end: at(10), destination: MTL, drive: async () => { throw new Error("must not be asked"); } });
  ok("an empty day costs nothing and passes", empty.ok);
  const noDest = await judgeSlotTravel({ ranges, start: at(14), end: at(15), destination: { lat: 0, lng: 0 }, drive: async () => { throw new Error("no"); } });
  ok("no usable destination (0,0 / failed geocode) → passes, never asks", noDest.ok);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n2. Google: two elements, cached, and only when it answers");
{
  clearDriveCache();
  let calls = 0;
  const google = async (url) => {
    calls++;
    ok(`  request ${calls} asks for ONE origin and ONE destination`, /origins=[-\d.]+,[-\d.]+&destinations=[-\d.]+,[-\d.]+&/.test(url));
    return { ok: true, json: async () => ({ status: "OK", rows: [{ elements: [{ status: "OK", duration: { value: 1500 }, distance: { value: 9000 } }] }] }) };
  };
  const a = await drivingMinutes(NDG, MTL, { mapsKey: "k", fetchImpl: google, now: 1_000 });
  const b = await drivingMinutes(NDG, MTL, { mapsKey: "k", fetchImpl: google, now: 2_000 });
  ok("Google's 25 minutes, then the same answer from the cache", a.minutes === 25 && a.source === "driving" && b.minutes === 25 && b.cached === true && calls === 1, { calls });
  await drivingMinutes(MTL, NDG, { mapsKey: "k", fetchImpl: google, now: 3_000 });
  ok("the reverse direction is its own element (one-way streets)", calls === 2);
  await drivingMinutes(NDG, MTL, { mapsKey: "k", fetchImpl: google, now: 1_000 + 7 * 3600_000 });
  ok("the cache expires (six hours)", calls === 3);
  clearDriveCache();
  let down = 0;
  const failing = async () => { down++; return { ok: false }; };
  const f1 = await drivingMinutes(NDG, MTL, { mapsKey: "k", fetchImpl: failing });
  const f2 = await drivingMinutes(NDG, MTL, { mapsKey: "k", fetchImpl: failing });
  ok("Google down → the estimate, NOT cached (the next call still tries Google)", f1.source === "estimate" && f2.source === "estimate" && down === 2);
  const nokey = await drivingMinutes(NDG, MTL, { mapsKey: null, fetchImpl: async () => { throw new Error("must not fetch"); } });
  ok("no server key → the estimate, no request", nokey.source === "estimate");
  ok("no coordinates → null", (await drivingMinutes(null, MTL, { mapsKey: "k" })) === null);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n3. Against the calendar's own busy time");
{
  clearDriveCache();
  let asked = null;
  const deps = {
    loadBusyRanges: async (args) => { asked = args; return [range(13, 14, NDG)]; },
    mapsKey: "k",
    fetchImpl: async () => ({ ok: true, json: async () => ({ status: "OK", rows: [{ elements: [{ status: "OK", duration: { value: 3600 }, distance: { value: 40000 } }] }] }) }),
  };
  const v = await verifySlotTravel({ eventType: { userId: "u", bufferBefore: 0, bufferAfter: 0 }, start: at(14, 30), end: at(15, 30), destination: MTL, deps });
  ok("Google's 60-minute drive refuses a 14:30 start after a 14:00 finish", !v.ok && v.legs[0].minutes === 60);
  ok("…reading busy time a day either side, like the calendar", asked && asked.busyFrom.getTime() === at(14, 30).getTime() - 86400000 && asked.busyTo.getTime() === at(14, 30).getTime() + 2 * 86400000);
  const est = estimateTravel(NDG, MTL).minutes;
  ok(`…where the offline estimate (${est} min) would have offered it — exactly the case Google is paid to catch`, est <= 30);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n4. The next time that passes the same check");
{
  clearDriveCache();
  const offered = { "2026-11-10": [at(14, 30).toISOString(), at(15, 0).toISOString(), at(16, 0).toISOString()] };
  let checks = 0;
  const deps = {
    computeAvailableSlots: async () => offered,
    loadBusyRanges: async () => [range(13, 14, NDG)],
    mapsKey: "k",
    fetchImpl: async () => { checks++; return { ok: true, json: async () => ({ status: "OK", rows: [{ elements: [{ status: "OK", duration: { value: 3600 }, distance: { value: 40000 } }] }] }) }; },
  };
  const next = await nextVerifiedSlot({ eventType: { userId: "u", durationMinutes: 60 }, after: at(14, 0), destination: MTL, deps });
  ok("14:30 fails Google, 15:00 passes → 15:00 is offered", next === at(15, 0).toISOString(), next);
  ok("…and the cache meant one Google element for the two checks of the same leg", checks === 1, { checks });
  const later = await nextVerifiedSlot({ eventType: { userId: "u", durationMinutes: 60 }, after: at(14, 0), minStart: at(15, 30), destination: MTL, deps });
  ok("a notice window (minStart) skips earlier times", later === at(16, 0).toISOString(), later);
  clearDriveCache();
  const hour = async () => ({ ok: true, json: async () => ({ status: "OK", rows: [{ elements: [{ status: "OK", duration: { value: 3600 } }] }] }) });
  const tenStarts = { d: Array.from({ length: 10 }, (_, i) => at(10, i).toISOString()) };
  const never = await nextVerifiedSlot({
    eventType: { userId: "u", durationMinutes: 60 },
    after: at(9),
    destination: MTL,
    // A visit ending 10:00, an hour's drive away: 10:00–10:09 can't be made.
    deps: { computeAvailableSlots: async () => tenStarts, loadBusyRanges: async () => [range(9, 10, NDG)], mapsKey: "k", fetchImpl: hour },
  });
  ok("nothing passes → null (the page says 'pick another time')", never === null, never);
  let count = 0;
  await nextVerifiedSlot({
    eventType: { userId: "u", durationMinutes: 60 },
    after: at(9),
    destination: MTL,
    deps: { computeAvailableSlots: async () => tenStarts, loadBusyRanges: async () => { count++; return [range(9, 10, NDG)]; }, mapsKey: "k", fetchImpl: hour },
  });
  ok(`at most ${NEXT_SLOT_CHECKS} times are checked with Google per refusal`, count === NEXT_SLOT_CHECKS, count);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n5. What the booker reads");
ok("en/fr/es, with and without a next time", ["en", "fr", "es"].every((l) => travelRefusal(l, "x") !== travelRefusal(l, null)) && /pick another time/i.test(travelRefusal("en", null)));
ok("an unknown language falls back to English", travelRefusal("xx", null) === travelRefusal("en", null) && travelRefusal(undefined, "x") === travelRefusal("en", "x"));
ok("FR is French", /Nous ne pouvons pas/.test(travelRefusal("FR", null)));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n6. Wiring");
const avail = code("lib/booking/computeAvailability.js");
ok("the calendar no longer asks Google: no travelMinutes, no Maps key", !/travelMinutes|serverMapsKey|distancematrix/.test(avail) && /estimateTravel\(/.test(avail));
ok("…and the saving is explained where it happens", /US\$105/.test(raw("lib/booking/computeAvailability.js")) && /one cent/.test(raw("lib/booking/verifyTravel.js")));
ok("calendar and booking check share one neighbour rule and one busy-time loader", /slotNeighbours\(/.test(avail) && /export async function loadBusyRanges/.test(avail) && /loadBusyRanges/.test(code("lib/booking/verifyTravel.js")));
const confirm = code("app/api/booking/[companySlug]/confirm/route.js");
const iVerify = confirm.indexOf("verifySlotTravel(");
ok("confirm: the Google check runs after the conflict check…", iVerify > confirm.indexOf("const conflict = await db.booking.findFirst"));
ok("…and BEFORE anything is written (client, booking)", iVerify > 0 && iVerify < confirm.indexOf("db.client.create") && iVerify < confirm.indexOf("db.booking.create"));
ok("…geocoding the address once, not twice", (confirm.match(/geocodeAddress\(/g) || []).length === 1);
ok("…only when the company has the travel check on", /if \(visitPoint && company\.travelCheckEnabled\)/.test(confirm));
ok("…refusing 409 travel_infeasible with nextSlot", /reason: "travel_infeasible"/.test(confirm) && /nextSlot,/.test(confirm) && /status: 409/.test(confirm));
const flow = code("app/book/[companySlug]/BookingFlow.js");
ok("the booking page selects the next time and lets the visitor confirm it", /data\?\.reason === "travel_infeasible"/.test(flow) && /setChosen\(next\)/.test(flow));
ok("…and counts it as offered so the Confirm button is not disabled by its own guard", /setOffered\(\(o\)/.test(flow));
const resched = code("app/api/visit/[token]/reschedule/route.js");
ok("a reschedule gets the same check, after the grid check and before the move", resched.indexOf("verifySlotTravel(") > resched.indexOf("slotIsOffered(offered") && resched.indexOf("verifySlotTravel(") < resched.indexOf("db.booking.update"));
ok("…honouring the notice window for the next time", /minStart: new Date\(now\.getTime\(\) \+ changeNoticeHours\(company\)/.test(resched));
ok("the visit page translates the refusal and selects the next time", /travel_infeasible/.test(code("lib/booking/visitCopy.js")) && /setPicked\(typeof err\.data\?\.nextSlot === "string"/.test(code("app/visit/[token]/VisitManager.js")));
const visitCopy = raw("lib/i18n/clientDocCopy.js");
ok("travelNext/travelNone exist in all eight client languages", (visitCopy.match(/^ {6}travelNext: /gm) || []).length === 8 && (visitCopy.match(/^ {6}travelNone: /gm) || []).length === 8);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
