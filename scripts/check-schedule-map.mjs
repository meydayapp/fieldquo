// scripts/check-schedule-map.mjs
//
//   npm run check:schedule-map
//
// The day map: every stop numbered 1, 2, 3 PER PERSON in time order, one
// colour per person measured against its label, unassigned grey with "?",
// rows with no coordinates kept in the list, the caller's scope taken from
// the calendar feed and nowhere else, appointment geocoding under the job's
// refusal rules, and the work-area polygon written only behind
// workarea:assign.
//
// ══ Why the route is executed ══════════════════════════════════════════════
//
// The owner's brief was that the admin sees everyone, an estimator sees only
// their own calendar, and Crew see their own jobs' stops with no client
// contact beyond the address — "read from the existing permission and
// scoping helpers, never a new rule". The way to prove a route has no rule
// of its own is to run it as each of those people against a scripted
// database and read what comes back, which is what section 6 does, with the
// same fixture shapes scripts/check-crew-calendar.mjs uses on the calendar
// route. A grep for `loadScheduleFeed` would prove the call exists; it would
// not prove the rows are the same.
//
// Every assertion here was watched to fail under mutation when written
// (per-company numbering, a hardcoded colour, a dropped unlocated row, a
// polygon PUT with the permission check removed).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { contrastRatio } from "@/lib/brand/colour";
import {
  PIN_PALETTE,
  UNASSIGNED_FILL,
  assignColours,
  buildMapStops,
  mapCentre,
  paletteContrast,
  hashId,
} from "@/lib/schedule/mapStops";
import {
  resolveAppointmentCoordinates,
  needsGeocode,
  locationChanged,
  appointmentAddress,
} from "@/lib/geo/geocodeAppointment";
import { resolveJobCoordinates } from "@/lib/geo/geocodeJob";
import { normalisePolygon, readPolygon, MAX_VERTICES } from "@/lib/workAreas/polygon";
import { parseDay, dayBoundsFor, GEOCODE_BACKFILL_CAP } from "@/lib/schedule/mapDay";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

// No key: the route's backfill must never reach Google from a check.
delete process.env.GOOGLE_MAPS_SERVER_KEY;
delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail !== undefined ? `  (${JSON.stringify(detail)})` : ""}`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. Colours: distinct on the day, measured against the label\n");

for (const p of paletteContrast()) {
  ok(`${p.fill} carries ${p.ink} at ${p.ratio.toFixed(2)}:1 ≥ 4.5`, p.ratio >= 4.5);
}
ok("the unassigned grey is not in the person palette", !PIN_PALETTE.includes(UNASSIGNED_FILL));
ok("hashId is deterministic", hashId("u_marc") === hashId("u_marc") && hashId("u_marc") !== hashId("u_ana"));

const twelve = Array.from({ length: 12 }, (_, i) => `user_${i}`);
const twelveColours = assignColours(twelve);
ok(
  "twelve people get twelve different fills",
  new Set([...twelveColours.values()].map((c) => c.fill)).size === 12,
);
ok(
  "the same set again gets the same fills (deterministic)",
  [...assignColours([...twelve].reverse()).entries()].every(([id, c]) => twelveColours.get(id).fill === c.fill),
);
// Two ids that hash to the same slot: the second walks to a free one.
const a = "u_a";
let b = "u_b";
for (let i = 0; i < 100000; i++) {
  if (hashId(`u_b${i}`) % PIN_PALETTE.length === hashId(a) % PIN_PALETTE.length) {
    b = `u_b${i}`;
    break;
  }
}
const pair = assignColours([a, b]);
ok("a hash collision resolves to two fills, not one", pair.get(a).fill !== pair.get(b).fill);
ok(
  "a thirteenth person wraps rather than crashing — stated, not hidden",
  assignColours([...twelve, "user_12"]).size === 13,
);
ok("every fill's ink measures ≥ 4.5:1 on it", [...twelveColours.values()].every((c) => contrastRatio(c.fill, c.ink) >= 4.5));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Numbering: 1, 2, 3 per person, in time order, never per company\n");

const at = (h, m = 0) => new Date(Date.UTC(2026, 8, 21, h, m)).toISOString();
const entry = (id, kind, assignedToId, name, hour, extra = {}) => ({
  kind,
  id,
  scheduledAt: at(hour),
  status: "scheduled",
  assignedToId,
  assignedTo: assignedToId ? { id: assignedToId, name } : null,
  client: { id: `c_${id}`, name: `Client ${id}`, address: `${id} Main St` },
  location: null,
  latitude: 45.5,
  longitude: -73.6,
  ...extra,
});

// Interleaved on purpose: Marc 8, Ana 9, Marc 10, unassigned 11, Ana 13,
// Marc 14. Per-company numbering would give Ana "2" and "5".
const day = [
  entry("m1", "visit", "u_marc", "Marc", 8, { jobId: "job_1", title: "Repaint 14 Elm" }),
  entry("a1", "appointment", "u_ana", "Ana", 9, { quote: { id: "q1", quoteNumber: "Q-1042" } }),
  entry("m2", "appointment", "u_marc", "Marc", 10, { latitude: null, longitude: null }),
  entry("x1", "appointment", null, null, 11),
  entry("a2", "visit", "u_ana", "Ana", 13, { jobId: "job_2", title: "Deck stain" }),
  entry("m3", "booking", "u_marc", "Marc", 14, { title: "Estimate visit" }),
  entry("c1", "appointment", "u_ana", "Ana", 15, { status: "cancelled" }),
];
const built = buildMapStops(day);
const seq = Object.fromEntries(built.stops.map((s) => [s.id, s.label]));
ok("Marc's stops are 1, 2, 3 in time order", seq.m1 === "1" && seq.m2 === "2" && seq.m3 === "3");
ok("Ana's stops are 1, 2 — her own sequence, not the company's", seq.a1 === "1" && seq.a2 === "2");
ok("the unassigned stop is '?'", seq.x1 === "?");
ok("…and grey", built.stops.find((s) => s.id === "x1").fill === UNASSIGNED_FILL);
ok("the list is in time order across everyone", built.stops.map((s) => s.id).join(",") === "m1,a1,m2,x1,a2,m3");
ok("Marc's three stops share one fill", new Set(built.stops.filter((s) => s.assigneeId === "u_marc").map((s) => s.fill)).size === 1);
ok("…and Ana's differs from it", built.stops.find((s) => s.id === "a1").fill !== built.stops.find((s) => s.id === "m1").fill);
ok("a cancelled row is left off and counted", built.cancelled === 1 && !built.stops.some((s) => s.id === "c1"));
ok("the row with no coordinates is STILL in the list", built.stops.some((s) => s.id === "m2"));
ok("…flagged as not located, still numbered", built.stops.find((s) => s.id === "m2").located === false && seq.m2 === "2");
ok("…and counted", built.unlocated === 1);
ok("a visit says what it is: the job's title, linking to the job",
  built.stops.find((s) => s.id === "m1").title === "Repaint 14 Elm" && built.stops.find((s) => s.id === "m1").href === "/app/jobs/job_1");
ok("an appointment about a quote is 'Site visit · Q-1042'",
  built.stops.find((s) => s.id === "a1").what === "site_visit" && built.stops.find((s) => s.id === "a1").ref === "Q-1042" && built.stops.find((s) => s.id === "a1").href === "/app/quotes/q1");
// Two stops at one address (m1 and the fixture's x1 share 45.5/-73.6 with
// every other located row) are fanned apart for display; the truth stays.
const coincident = built.stops.filter((s) => s.located);
ok("coincident stops are fanned apart on the map",
  new Set(coincident.map((s) => `${s.pinLat},${s.pinLng}`)).size === coincident.length);
ok("…by about 20 m, never more", coincident.every((s) => Math.abs(s.pinLat - s.lat) < 0.0003 && Math.abs(s.pinLng - s.lng) < 0.0005));
ok("…while lat/lng stay the true point", coincident.every((s) => s.lat === 45.5 && s.lng === -73.6));
ok("Decimal-shaped coordinates (strings) are read as numbers",
  buildMapStops([entry("d1", "appointment", "u_x", "X", 8, { latitude: "45.500000", longitude: "-73.600000" })]).stops[0].located === true);
ok("garbage entries are dropped, not crashed on",
  buildMapStops([null, {}, { scheduledAt: "nope" }, 7]).stops.length === 0);

// Grouped by work area instead of by person: two people on one area share a colour.
const areaOf = { u_marc: "wa_north", u_ana: "wa_north" };
const grouped = buildMapStops(day, { groupOf: (e) => (e.assignedToId ? areaOf[e.assignedToId] : null) });
ok("grouped by work area, Marc and Ana share the area's colour",
  grouped.stops.find((s) => s.id === "m1").fill === grouped.stops.find((s) => s.id === "a1").fill);
ok("…while numbering stays per person", grouped.stops.find((s) => s.id === "a2").label === "2");
ok("a work area with no stop today still gets its colour, for its polygon",
  buildMapStops(day, { groupOf: () => null, groups: ["wa_quiet"] }).groups.has("wa_quiet"));
ok("the centre is the company's address when it has one",
  mapCentre({ latitude: "45.1", longitude: "-73.1" }, built.stops)?.source === "company");
ok("…the stops' mean when it has not", mapCentre({}, built.stops)?.source === "stops");
ok("…and nothing when neither — no guessed city", mapCentre({}, []) === null);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Appointment geocoding mirrors the job's refusal rules\n");

const hit = (locationType) => async () => ({ lat: 45.50123456, lng: -73.59876543, locationType });
const nulls = (r) => r.latitude === null && r.longitude === null;

const noAddr = await resolveAppointmentCoordinates({ location: "  ", client: { address: null } }, { geocode: hit("ROOFTOP") });
ok("no address → nulls, and NOT stamped (nothing was tried)", nulls(noAddr) && noAddr.geocodedAt === null && noAddr.reason === "no_address");
const coarse = await resolveAppointmentCoordinates({ location: "Laval" }, { geocode: hit("APPROXIMATE") });
ok("APPROXIMATE → nulls, the job's rule", nulls(coarse) && coarse.reason === "too_coarse");
ok("…but stamped, so the backfill does not ask again tomorrow", coarse.geocodedAt instanceof Date);
const threw = await resolveAppointmentCoordinates({ location: "1 Rue" }, { geocode: async () => { throw new Error("boom"); } });
ok("a throwing geocoder → nulls, never a crash", nulls(threw) && threw.reason === "threw");
const none = await resolveAppointmentCoordinates({ location: "1 Rue" }, { geocode: async () => null });
ok("no result → nulls", nulls(none) && none.reason === "no_result");
const good = await resolveAppointmentCoordinates({ location: "1 Rue" }, { geocode: hit("RANGE_INTERPOLATED") });
ok("a placed address → six decimals, like a job", good.latitude === 45.501235 && good.longitude === -73.598765 && good.geocodedAt instanceof Date);
const jobGood = await resolveJobCoordinates("1 Rue", { geocode: hit("RANGE_INTERPOLATED") });
ok("…the SAME numbers the job wrapper writes", jobGood.latitude === good.latitude && jobGood.longitude === good.longitude);
ok("the typed location wins over the client's address",
  appointmentAddress({ location: "9 Oak", client: { address: "14 Elm" } }) === "9 Oak");
ok("…and the client's address is the fallback",
  appointmentAddress({ location: null, client: { address: "14 Elm" } }) === "14 Elm");
ok("a location change is compared normalised",
  !locationChanged("14  Elm St ", "14 Elm St") && locationChanged("14 Elm St", "15 Elm St") && locationChanged(null, "x") && !locationChanged("", null));

ok("needsGeocode: an address, no coordinates, never tried → yes",
  needsGeocode({ location: "1 Rue", latitude: null, longitude: null, geocodedAt: null }));
ok("…already placed → no",
  !needsGeocode({ location: "1 Rue", latitude: 45, longitude: -73, geocodedAt: null }));
ok("…tried and refused → no (stamped)",
  !needsGeocode({ location: "1 Rue", latitude: null, longitude: null, geocodedAt: new Date() }));
ok("…no address anywhere → no",
  !needsGeocode({ location: null, client: { address: "" }, latitude: null, longitude: null, geocodedAt: null }));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. The day, in the company's zone\n");

ok("2026-09-31 is not a day", parseDay("2026-09-31") === null);
ok("2026-2-3 is not the format", parseDay("2026-2-3") === null);
ok("garbage is not a day", parseDay("x") === null && parseDay(null) === null && parseDay("2026-13-01") === null);
const tor = dayBoundsFor(parseDay("2026-09-19"), "America/Toronto");
ok("Toronto's 19th runs 04:00Z to 04:00Z next day", tor.from.toISOString() === "2026-09-19T04:00:00.000Z" && tor.to.toISOString() === "2026-09-20T04:00:00.000Z");
const ny = dayBoundsFor(parseDay("2026-12-31"), "America/Toronto");
ok("…and the 31st ends on 1 January, not the 32nd", ny.to.toISOString() === "2027-01-01T05:00:00.000Z");
ok("the backfill cap is small and positive", Number.isInteger(GEOCODE_BACKFILL_CAP) && GEOCODE_BACKFILL_CAP > 0 && GEOCODE_BACKFILL_CAP <= 20);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The polygon sanitiser against hostile input\n");

ok("null clears", normalisePolygon(null).ok && normalisePolygon(null).polygon === null);
ok("not a list → refused", !normalisePolygon("x").ok && !normalisePolygon({}).ok && !normalisePolygon(undefined).ok);
ok("two points → refused (a line is not a zone)", !normalisePolygon([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }]).ok);
ok("a non-numeric point → refused", !normalisePolygon([{ lat: "a", lng: 1 }, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }]).ok);
ok("a point off the world → refused", !normalisePolygon([{ lat: 91, lng: 1 }, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }]).ok);
ok("too many points → refused", !normalisePolygon(Array.from({ length: MAX_VERTICES + 1 }, () => ({ lat: 1, lng: 1 }))).ok);
const ring = normalisePolygon([{ lat: 45.1234567, lng: -73.1 }, { lat: 45.2, lng: -73.2 }, { lat: 45.3, lng: -73.3 }, { lat: 45.1234567, lng: -73.1 }]);
ok("a closed ring drops its repeated last vertex and rounds to six decimals",
  ring.ok && ring.polygon.length === 3 && ring.polygon[0].lat === 45.123457);
ok("readPolygon tolerates an old row holding rubbish", readPolygon("rubbish") === null && readPolygon(null) === null);
ok("…and returns a good one", Array.isArray(readPolygon(ring.polygon)) && readPolygon(ring.polygon).length === 3);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. GET /api/schedule/map and PUT …/polygon, EXECUTED as each role\n");

const crewValues = PERMISSION_PRESETS.worker.values;
const dispValues = PERMISSION_PRESETS.dispatcher.values;
const estValues = PERMISSION_PRESETS.estimator.values;
ok("Crew still see only their own schedule", crewValues.schedule === "view_complete_own" && PRESET_TO_ROLE.worker === "employee");
ok("an Estimator too", estValues.schedule === "view_complete_own");
ok("a Dispatcher sees everyone's", dispValues.schedule === "edit_all");

const { register } = await import("node:module");

globalThis.__FQ_ROWS = { member: [], appointment: [], jobVisit: [], booking: [], company: [], workArea: [] };
const RELATIONS = new Set(["client", "assignedTo", "booking", "job", "visits", "eventType", "user", "quote", "invoice", "assignments"]);

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "OR") {
      if (!cond.some((branch) => matchWhere(row, branch))) return false;
      continue;
    }
    if (key === "AND") {
      if (!cond.every((branch) => matchWhere(row, branch))) return false;
      continue;
    }
    if (key.includes("_") && cond && typeof cond === "object" && !(key in row)) {
      if (!matchWhere(row, cond)) return false;
      continue;
    }
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("some" in cond) {
        if (!Array.isArray(value) || !value.some((v) => matchWhere(v, cond.some))) return false;
        continue;
      }
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      // Date ranges — the one operator this route adds to the calendar's.
      if ("gte" in cond || "lt" in cond) {
        const t = new Date(value).getTime();
        if (Number.isNaN(t)) return false;
        if ("gte" in cond && t < new Date(cond.gte).getTime()) return false;
        if ("lt" in cond && t >= new Date(cond.lt).getTime()) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}
function projectRelation(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => projectRow(v, spec));
  if (value == null) return null;
  return projectRow(value, spec);
}
function projectRow(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) if (!RELATIONS.has(key)) out[key] = value;
  for (const [key, sub] of Object.entries(spec.include || {})) out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
  return out;
}
const writes = [];
function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findMany(args = {}) { return all().filter((r) => matchWhere(r, args.where)).map((r) => projectRow(r, args)); },
    async findFirst(args = {}) { const h = all().find((r) => matchWhere(r, args.where)); return h ? projectRow(h, args) : null; },
    async findUnique(args = {}) { const h = all().find((r) => matchWhere(r, args.where)); return h ? projectRow(h, args) : null; },
    async update(args = {}) {
      const h = all().find((r) => matchWhere(r, args.where));
      if (!h) throw new Error(`dbStub: no ${name} row to update`);
      writes.push({ model: name, id: h.id, data: args.data });
      Object.assign(h, args.data);
      return projectRow(h, args);
    },
  };
}
globalThis.__FQ_DB = new Proxy(
  { member: stubModel("member"), appointment: stubModel("appointment"), jobVisit: stubModel("jobVisit"), booking: stubModel("booking"), company: stubModel("company"), workArea: stubModel("workArea") },
  { get(t, p) { if (p in t) return t[p]; throw new Error(`dbStub: db.${String(p)} is not scripted in this check`); } },
);
globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = { "@/lib/db": "fq-stub:db", "@/lib/currentMember": "fq-stub:member", "next/server": "fq-stub:next" };
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") return { format: "module", shortCircuit: true, source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  if (url === "fq-stub:member") return { format: "module", shortCircuit: true, source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  if (url === "fq-stub:next") return { format: "module", shortCircuit: true, source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const mapRoute = await import("@/app/api/schedule/map/route.js");
const polygonRoute = await import("@/app/api/work-areas/[id]/polygon/route.js");
const { Prisma } = await import("@prisma/client");

// ── Fixtures: one day in Toronto, one row the day after ─────────────────────
const STRANGER = { id: "c_theirs", name: "Bea Nowak", address: "9 Oak Ave", email: "bea@example.com", phone: "+15145550199", notes: "Rear entrance only.", portalToken: "tok_bea" };
const MINE = { id: "c_mine", name: "Ana Ruiz", address: "14 Elm St", email: "ana@example.com", phone: "+15145550100", notes: "Gate code 4417.", portalToken: "tok_ana" };
const T = (h) => new Date(Date.UTC(2026, 8, 21, h)); // 21 Sep 2026, UTC hours (Toronto = UTC-4)

const jobRef = (id, title, client, visits, coords = {}) => ({ id, companyId: "co", archivedAt: null, title, client, visits, latitude: null, longitude: null, siteLatitude: null, siteLongitude: null, ...coords });
const MY_JOB = jobRef("job_mine", "Repaint 14 Elm St", MINE, [{ assignedToId: "u_crew" }], { latitude: "45.500000", longitude: "-73.600000" });
const THEIR_JOB = jobRef("job_theirs", "Deck stain, 9 Oak Ave", STRANGER, [{ assignedToId: "u_other" }, { assignedToId: null }], { siteLatitude: "45.510000", siteLongitude: "-73.610000" });
const visitRow = (id, job, assignedToId, name, when) => ({ id, jobId: job.id, scheduledAt: when, status: "scheduled", notes: null, assignedToId, assignedTo: assignedToId ? { id: assignedToId, name } : null, job });
globalThis.__FQ_ROWS.jobVisit = [
  visitRow("v_mine", MY_JOB, "u_crew", "Dani", T(12)),
  visitRow("v_open", MY_JOB, null, null, T(13)),
  visitRow("v_theirs", THEIR_JOB, "u_other", "Sam", T(14)),
  visitRow("v_stranger", THEIR_JOB, null, null, T(15)),
  visitRow("v_tomorrow", MY_JOB, "u_crew", "Dani", T(26)), // 22 Sep 02:00Z = 21 Sep 22:00 Toronto → ON the day
  visitRow("v_next", MY_JOB, "u_crew", "Dani", T(28)), // 22 Sep 04:00Z = 22 Sep 00:00 Toronto → off the day
];
const apptRow = (id, assignedToId, name, client, when, extra = {}) => ({
  id, companyId: "co", clientId: client.id, scheduledAt: when, location: null, status: "scheduled", requiresSupervisor: false, createdById: "u_disp",
  assignedToId, assignedTo: assignedToId ? { id: assignedToId, name } : null, client, booking: null, quote: null, job: null, invoice: null,
  latitude: null, longitude: null, geocodedAt: null, ...extra,
});
globalThis.__FQ_ROWS.appointment = [
  apptRow("a_mine", "u_crew", "Dani", MINE, T(16), { latitude: "45.520000", longitude: "-73.620000", geocodedAt: new Date("2026-09-01") }),
  apptRow("a_theirs", "u_other", "Sam", STRANGER, T(17), { location: "9 Oak Ave" }), // never tried: the backfill's target
  apptRow("a_open", null, null, MINE, T(18)), // no location, but the client has an address: never tried → backfilled too
  apptRow("a_tried", "u_est", "Eve", MINE, T(19), { geocodedAt: new Date("2026-09-02") }), // tried, refused: not retried
  apptRow("a_yesterday", "u_crew", "Dani", MINE, T(2)), // 20 Sep 22:00 Toronto → off the day
];
const bookingRow = (id, ownerId, ownerName, clientName, address, when) => ({
  id, appointmentId: null, status: "confirmed", startTime: when, endTime: new Date(when.getTime() + 3600000), clientName, address, mode: "visit",
  latitude: "45.530000", longitude: "-73.630000",
  eventType: { companyId: "co", name: "Estimate visit", userId: ownerId, user: ownerId ? { id: ownerId, name: ownerName } : null },
});
globalThis.__FQ_ROWS.booking = [
  bookingRow("bk_mine", "u_crew", "Dani", "Mr Lalonde", "77 Pine Rd", T(20)),
  bookingRow("bk_theirs", "u_other", "Sam", "Mrs Tran", "3 Cedar Cres", T(21)),
  bookingRow("bk_company", null, null, "Ms Okafor", "412 Rue Sainte-Catherine", T(22)),
];
const memberRow = (id, userId, role, permissions) => ({ id, userId, companyId: "co", role, permissions });
globalThis.__FQ_ROWS.member = [
  memberRow("m_owner", "u_owner", "owner", {}),
  memberRow("m_crew", "u_crew", "employee", { ...crewValues }),
  memberRow("m_est", "u_est", "employee", { ...estValues }),
  memberRow("m_other", "u_other", "employee", { ...crewValues }),
  memberRow("m_foreign", "u_foreign", "owner", {}),
];
globalThis.__FQ_ROWS.member.find((m) => m.id === "m_foreign").companyId = "other_co";
globalThis.__FQ_ROWS.company = [
  { id: "co", timezone: "America/Toronto", address: "1 Rue Principale", city: "Laval", province: "QC", postalCode: "H7A 1A1", latitude: "45.570000", longitude: "-73.690000" },
  { id: "other_co", timezone: "America/Toronto", address: null, city: null, province: null, postalCode: null, latitude: null, longitude: null },
];
globalThis.__FQ_ROWS.workArea = [
  { id: "wa_north", companyId: "co", name: "North", description: null, polygon: null, assignments: [] },
  { id: "wa_far", companyId: "other_co", name: "Elsewhere", description: null, polygon: null, assignments: [] },
];

const asMember = (id) => {
  const row = globalThis.__FQ_ROWS.member.find((m) => m.id === id);
  globalThis.__FQ_SESSION = { id: row.id, userId: row.userId, companyId: row.companyId, role: row.role };
};
const req = (url, body) => ({ url, json: async () => body || {} });
const DAY = "http://local/api/schedule/map?day=2026-09-21";
const idsOf = (res) => res.body.entries.map((e) => e.id);
const SECRETS = ["9 Oak Ave", "Bea Nowak", "412 Rue Sainte-Catherine", "Ms Okafor", "+15145550100", "ana@example.com", "Gate code", "tok_ana"];
function leaksIn(value, path = "") {
  const found = [];
  if (Array.isArray(value)) { value.forEach((v, i) => found.push(...leaksIn(v, `${path}[${i}]`))); return found; }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) found.push(...leaksIn(v, path ? `${path}.${k}` : k));
    return found;
  }
  if (typeof value === "string" && SECRETS.some((s) => value.includes(s))) found.push(`${path} (${value})`);
  return found;
}

console.log("\n  — the day —");
asMember("m_owner");
ok("a day that is not a day → 400", (await mapRoute.GET(req("http://local/api/schedule/map?day=2026-09-31"))).status === 400);
ok("no day → 400", (await mapRoute.GET(req("http://local/api/schedule/map"))).status === 400);
const ownerFeed = await mapRoute.GET(req(DAY));
const ownerIds = idsOf(ownerFeed);
ok("the owner is answered (200)", ownerFeed.status === 200);
ok("the day is the company's: a 22:00 Toronto visit is ON the 21st", ownerIds.includes("v_tomorrow"));
ok("…and a 02:00 Toronto visit the next morning is not", !ownerIds.includes("v_next"));
ok("…nor yesterday evening's appointment", !ownerIds.includes("a_yesterday"));
ok("the centre is the company's own address", ownerFeed.body.centre?.lat === 45.57 && ownerFeed.body.centre?.lng === -73.69);
ok("the response names the company's timezone", ownerFeed.body.timezone === "America/Toronto");

console.log("\n  — the owner sees everyone —");
ok("every visit on the day", ["v_mine", "v_open", "v_theirs", "v_stranger", "v_tomorrow"].every((id) => ownerIds.includes(id)));
ok("every appointment on the day", ["a_mine", "a_theirs", "a_open", "a_tried"].every((id) => ownerIds.includes(id)));
ok("every booking on the day, the company-wide one included", ["bk_mine", "bk_theirs", "bk_company"].every((id) => ownerIds.includes(id)));
const ownerBuilt = buildMapStops(ownerFeed.body.entries);
ok("a visit carries its JOB's coordinates onto the map", ownerBuilt.stops.find((s) => s.id === "v_mine").located === true);
ok("…the site pair first, when the job has one", ownerBuilt.stops.find((s) => s.id === "v_theirs").lat === 45.51);
ok("Dani's day is numbered 1..4 in time order (visit, appointment, booking, late visit)",
  ["v_mine", "a_mine", "bk_mine", "v_tomorrow"].map((id) => ownerBuilt.stops.find((s) => s.id === id).label).join("") === "1234");
ok("Sam's starts again at 1", ownerBuilt.stops.find((s) => s.id === "v_theirs").label === "1");

console.log("\n  — the backfill —");
ok("exactly the never-tried rows with an address were sent to the geocoder", ownerFeed.body.geocoded.tried === 2 && ownerFeed.body.geocoded.remaining === 0);
const tried = writes.filter((w) => w.model === "appointment");
ok("…the typed location (a_theirs) and the client-address fallback (a_open)", tried.map((w) => w.id).sort().join() === "a_open,a_theirs");
ok("…which, with no key, were stamped with nulls — placed 0, never a guess",
  ownerFeed.body.geocoded.placed === 0 && tried.every((w) => w.data.latitude === null && w.data.geocodedAt instanceof Date));
ok("a row tried before was not tried again", !tried.some((w) => w.id === "a_tried"));
ok("a row already placed was not touched", !tried.some((w) => w.id === "a_mine"));
writes.length = 0;
const again = await mapRoute.GET(req(DAY));
ok("a second load of the same day asks Google nothing", again.body.geocoded.tried === 0 && writes.length === 0);
ok("the never-placed row is STILL in the feed for the list", idsOf(again).includes("a_theirs"));

console.log("\n  — the estimator sees their own calendar —");
asMember("m_est");
const estFeed = await mapRoute.GET(req(DAY));
const estIds = idsOf(estFeed);
ok("their own appointment", estIds.includes("a_tried"));
ok("an unassigned appointment — the calendar shows it, so the map does", estIds.includes("a_open"));
ok("not a colleague's appointment", !estIds.includes("a_mine") && !estIds.includes("a_theirs"));
ok("an unassigned visit on ANY job — an estimator keeps the whole job board", estIds.includes("v_open") && estIds.includes("v_stranger"));
ok("not a colleague's visit", !estIds.includes("v_mine") && !estIds.includes("v_theirs"));
ok("no bookings through other people's pages", !estIds.includes("bk_mine") && !estIds.includes("bk_company"));
const estCalendarIds = ownerIds; // the calendar feed is the same function; the crew check pins it row by row

console.log("\n  — Crew see their own jobs' stops, with no client contact —");
asMember("m_crew");
writes.length = 0;
const crewFeed = await mapRoute.GET(req(DAY));
const crewIds = idsOf(crewFeed);
ok("their own visit, appointment and booking", ["v_mine", "a_mine", "bk_mine", "v_tomorrow"].every((id) => crewIds.includes(id)));
ok("an unassigned visit on a job they ARE on", crewIds.includes("v_open"));
ok("not an unassigned visit on a stranger's job", !crewIds.includes("v_stranger"));
ok("not a colleague's rows", !crewIds.includes("v_theirs") && !crewIds.includes("a_theirs") && !crewIds.includes("bk_theirs"));
ok("not the company-wide booking", !crewIds.includes("bk_company"));
ok("an unassigned appointment stays, as on the calendar", crewIds.includes("a_open"));
const crewLeaks = leaksIn(crewFeed.body);
ok("no stranger's name or address, and no contact detail of their own client, anywhere in the payload", crewLeaks.length === 0, crewLeaks);
const crewAppt = crewFeed.body.entries.find((e) => e.id === "a_mine");
ok("their client is name and address only", crewAppt.client?.name === "Ana Ruiz" && crewAppt.client?.address === "14 Elm St" && !("phone" in crewAppt.client) && !("email" in crewAppt.client));
ok("the crew load never geocoded a stranger's row", !writes.some((w) => w.model === "appointment" && w.id === "a_theirs"));
const crewBuilt = buildMapStops(crewFeed.body.entries);
ok("a crew stop's popover fields are what the row carries: client name, address, no more",
  Object.keys(crewBuilt.stops.find((s) => s.id === "a_mine")).every((k) => !["phone", "email", "notes"].includes(k)));

console.log("\n  — a company with no address has no centre, not a guessed one —");
asMember("m_foreign");
const farFeed = await mapRoute.GET(req(DAY));
ok("centre is null", farFeed.status === 200 && farFeed.body.centre === null);
ok("…and nothing was written to the company row", !writes.some((w) => w.model === "company"));

console.log("\n  — PUT /api/work-areas/[id]/polygon —");
const ctx = (id) => ({ params: Promise.resolve({ id }) });
const tri = [{ lat: 45.5, lng: -73.6 }, { lat: 45.6, lng: -73.6 }, { lat: 45.6, lng: -73.5 }];
asMember("m_crew");
const crewPut = await polygonRoute.PUT(req("http://local/x", { polygon: tri }), ctx("wa_north"));
ok("Crew may not draw (403)", crewPut.status === 403);
ok("…and nothing was written", globalThis.__FQ_ROWS.workArea[0].polygon === null);
asMember("m_est");
ok("an Estimator may not either", (await polygonRoute.PUT(req("http://local/x", { polygon: tri }), ctx("wa_north"))).status === 403);
asMember("m_owner");
ok("another company's area → 404", (await polygonRoute.PUT(req("http://local/x", { polygon: tri }), ctx("wa_far"))).status === 404);
ok("two points → 400", (await polygonRoute.PUT(req("http://local/x", { polygon: tri.slice(0, 2) }), ctx("wa_north"))).status === 400);
ok("a string → 400", (await polygonRoute.PUT(req("http://local/x", { polygon: "x" }), ctx("wa_north"))).status === 400);
const drawn = await polygonRoute.PUT(req("http://local/x", { polygon: [...tri, tri[0]] }), ctx("wa_north"));
ok("the owner's triangle is written, ring closed and rounded", drawn.status === 200 && Array.isArray(globalThis.__FQ_ROWS.workArea[0].polygon) && globalThis.__FQ_ROWS.workArea[0].polygon.length === 3);
ok("…and comes back on the row for the page", Array.isArray(drawn.body.polygon) && drawn.body.polygon.length === 3);
const cleared = await polygonRoute.PUT(req("http://local/x", { polygon: null }), ctx("wa_north"));
ok("null clears it with Prisma.DbNull, never a bare null", cleared.status === 200 && writes.some((w) => w.model === "workArea" && w.data.polygon === Prisma.DbNull));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The wiring\n");

const page = read("app/app/appointments/page.js");
const view = read("app/components/schedule/DayMapView.js");
const map = read("app/components/schedule/ScheduleMap.js");
const wa = read("app/app/settings/work-areas/page.js");
const auto = read("app/components/AddressAutocomplete.js");
const feed = read("lib/schedule/feed.js");
const schema = read("prisma/schema.prisma");

// `?view=` gained a fourth value ("cards", the week as a board of cards),
// so the param is read once into rawView and mapped; "map" still selects
// the map and nothing else does.
ok(
  "the calendar reads ?view=map and renders the map view for it",
  /const rawView = searchParams\?\.get\("view"\);/.test(page) &&
    /const view = rawView === "map" \? "map" :/.test(page) &&
    /\{view === "map" && \(\s*<DayMapView day=\{mapDay\}/.test(page),
);
ok("…the month grid and list are NOT rendered under the map view", /view === "map" \? null : \(<>/.test(page));
ok("the map chunk is a dynamic import with ssr:false — it loads only on the map view", /dynamic\(\(\) => import\("@\/app\/components\/schedule\/ScheduleMap"\), \{\s*ssr: false/.test(view));
ok("…and the calendar page itself never imports the map statically", !/from "@\/app\/components\/schedule\/ScheduleMap"/.test(page));
ok("on a phone the map is not mounted until shown", /\(wide \|\| mapOpen\) && mapNode/.test(view));
ok("the map view fetches the day route", /\/api\/schedule\/map\?day=/.test(view));
ok("markers are diffed against a held map, not rebuilt", /markersRef = useRef\(new Map\(\)\)/.test(map) && /let marker = held\.get\(k\)/.test(map) && /marker\.setMap\(null\)/.test(map));
ok("one InfoWindow, reused", (map.match(/new g\.InfoWindow\(/g) || []).length === 1);
ok("the map and the address field share ONE libraries list", /MAPS_LIBRARIES/.test(map) && /MAPS_LIBRARIES as libraries/.test(auto));
// DrawingManager was removed from the Maps JS API at 3.65 (constructing one
// throws, with a message saying so); a zone is drawn with an editable
// Polygon and map clicks, which needs no library beyond the shared list.
ok("zone drawing is an editable polygon, not the removed DrawingManager", /new g\.Polygon\(\{[^}]*editable: true/.test(map) && !/DrawingManager\(/.test(map) && !/importLibrary/.test(map));
ok("…and the shared libraries list still asks for nothing but places", /\["places"\]/.test(read("lib/maps/libraries.js").replace(/\/\/.*$/gm, "")));
ok("the Finish button appears only once there are three corners", /drawingCount >= 3 && \(/.test(wa));
ok("the unlocated row is said, not dropped", /app\.map\.noLocation/.test(view) && /data-located=/.test(view));
ok("the work-areas page calls the polygon route with its literal path", /\/api\/work-areas\/\$\{encodeURIComponent\(workAreaId\)\}\/polygon/.test(wa));
ok("…offers drawing only behind workarea:assign", /const drawing = canAssign\s*\?/.test(wa));
ok("…colours the day by work area", /groupOf=\{groupOf\}/.test(wa) && /legend=\{legend\}/.test(wa));
ok("…and says the polygon is only a picture for now", /app\.setWorkAreas\.mapExplain/.test(wa));
ok("the schema says nothing else reads the polygon yet", /polygon\s+Json\?/.test(schema) && /Read ONLY by\s*\/\/\/ the Settings → Work areas map today/.test(schema));
ok("the feed is the calendar's queries with a range and nothing else new", /within && \{ scheduledAt: within \}/.test(feed) && /within && \{ startTime: within \}/.test(feed) && (feed.match(/ownFilter\(/g) || []).length === 3);
// The GET now decorates the feed with SMS delivery receipts before
// answering (attachCalendarTexts), so the call is assigned rather than
// returned inline. Still three arguments: no range.
ok(
  "GET /api/appointments passes no range — it gets what it always got",
  /const feed = await loadScheduleFeed\(db, member, full\);/.test(read("app/api/appointments/route.js")) &&
    !/loadScheduleFeed\(db, member, full,/.test(read("app/api/appointments/route.js")),
);
ok("the appointment POST geocodes through the shared wrapper", /geocodeAppointment\(db, appointment\)/.test(read("app/api/appointments/route.js")));
ok("…and the PATCH only on a location CHANGE", /locationChanged\(existing\.location, body\.location\)/.test(read("app/api/appointments/[id]/route.js")));

console.log("\n8. Nine languages\n");
const KEYS = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.map.") || k.startsWith("app.setWorkAreas.map") || /^app\.setWorkAreas\.(draw|redraw|clearZone|drawingCancel|drawingHint|finishZone|zoneDrawn|zoneNotDrawn)$/.test(k));
ok("the map has its keys", KEYS.length >= 36, KEYS.length);
for (const code of Object.keys(APP_MESSAGES)) {
  const missing = KEYS.filter((k) => !(k in APP_MESSAGES[code]));
  ok(`${code}: every map key`, missing.length === 0, missing);
}
for (const k of KEYS) {
  const enVars = (APP_MESSAGES.en[k].match(/\{[a-z]+\}/g) || []).sort().join(",");
  const off = Object.keys(APP_MESSAGES).filter((c) => ((APP_MESSAGES[c][k] || "").match(/\{[a-z]+\}/g) || []).sort().join(",") !== enVars);
  if (off.length) ok(`${k}: the placeholders match English`, false, off);
}
ok("every used key exists in English", [...new Set([...view, ...wa, ...page].join("").match(/"app\.(map|setWorkAreas)\.[A-Za-z.]+"/g) || [])].every((q) => JSON.parse(q) in APP_MESSAGES.en));

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
