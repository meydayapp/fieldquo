// scripts/check-location-stamps.mjs
//
//   npm run check:location-stamps
//
// Position stamps: where the phone was when somebody tapped clock in, clock
// out, on my way or complete — and the "2.1 km away" flag a timesheet builds
// on them. This product does NOT track; it asks once, at the tap, with
// permission, and a refused permission never blocks the tap.
//
// ══ WHAT THIS EXECUTES ═════════════════════════════════════════════════════
//
//   · lib/geo/distance.js — haversine against a known pair (Toronto → Ottawa,
//     ~352 km) and the verdict on every branch, including the one that
//     matters most: an accuracy circle wider than the fence is "unknown",
//     never "away".
//   · lib/location/stamps.js — the pure validator, against out-of-range
//     coordinates, a negative accuracy and a phone clock three hours off.
//   · lib/geo/geocodeJob.js — resolveJobCoordinates with an injected geocoder,
//     so every refusal (no address, no result, APPROXIMATE, a throw, a hang)
//     is exercised without a key and without Google.
//
// ══ WHAT THIS ASSERTS ABOUT SOURCE, AND WHY ════════════════════════════════
//
//   (a) The visit PATCH and the clock POST record their stamp AFTER their own
//       write, through the helper that never throws, and nothing on the path
//       before that write reads `stamp` — so a request without one, or with
//       garbage in it, cannot fail. A route that validated the stamp up front
//       would turn a refused permission into a refused clock-in.
//   (b) The timesheet renders a chip for all three verdicts. A screen that
//       drew "away" and nothing else would make "unknown" look like "fine".
//   (c) No `watchPosition` in app/ or lib/. Not a style rule: a browser cannot
//       track, and one call to watchPosition is the product starting to
//       pretend it can.
//
// Source assertions are scoped by brace matching to ONE function where the
// claim is about ordering, because `indexOf(a) < indexOf(b)` false-passes
// when `a` is absent (-1 is less than everything).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { haversineM, stampVerdict, formatDistanceM, ON_SITE_THRESHOLD_M } from "@/lib/geo/distance";
import { validateStamp, distanceToSite, AT_TOLERANCE_MS, STAMP_KINDS } from "@/lib/location/stamps";
import { resolveJobCoordinates, siteAddressChanged, normaliseSiteAddress } from "@/lib/geo/geocodeJob";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
const ok = (cond, name, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `   got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (title) => console.log(`\n── ${title} ${"─".repeat(Math.max(0, 66 - title.length))}`);

const read = (p) => readFileSync(p, "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** The body of `name(` … matching close brace, or "" when absent. */
function fnBody(src, name) {
  const at = src.indexOf(name);
  if (at < 0) return "";
  // Past the parameter list first — `PATCH(request, { params })` has a brace
  // of its own, and the first version of this helper returned `{ params }`
  // as the body of every route and failed twelve assertions at once.
  const paren = src.indexOf("(", at);
  let pd = 0;
  let close = paren;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") pd++;
    else if (src[i] === ")" && --pd === 0) {
      close = i;
      break;
    }
  }
  const open = src.indexOf("{", close);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  return "";
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs|ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Haversine against known ground");

const TORONTO = { latitude: 43.6532, longitude: -79.3832 };
const OTTAWA = { latitude: 45.4215, longitude: -75.6972 };
const to = haversineM(TORONTO, OTTAWA);
ok(Math.abs(to - 352_000) / 352_000 < 0.01, "Toronto → Ottawa is 352 km ±1%", Math.round(to));
ok(haversineM(TORONTO, TORONTO) === 0, "a point to itself is 0, not NaN");
ok(Math.abs(haversineM(TORONTO, OTTAWA) - haversineM(OTTAWA, TORONTO)) < 1e-6, "symmetric");
ok(haversineM({ lat: 43.6532, lng: -79.3832 }, OTTAWA) === to, "accepts lat/lng as well as latitude/longitude");
ok(haversineM(null, OTTAWA) === null, "a missing end is null, never 0");
ok(haversineM({ latitude: "x", longitude: 1 }, OTTAWA) === null, "a non-numeric end is null");
// 1 metre north at Toronto's latitude ≈ 0.000009° of latitude.
const oneM = haversineM(TORONTO, { latitude: 43.6532 + 0.000009, longitude: -79.3832 });
ok(oneM > 0.9 && oneM < 1.1, "resolves a single metre", oneM);
// A pair straddling the antimeridian — the flat-earth shortcut gets this wrong.
const anti = haversineM({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 });
ok(anti > 22_000 && anti < 22_500, "across the antimeridian is ~22 km, not ~40,000", Math.round(anti));
// Antipodes are half the circumference (π·R ≈ 20,015 km). The one place the
// arcsine matters: without it the formula tops out at 2R ≈ 12,742 km, and
// every short-range assertion above still passes — mutation-tested.
const antipode = haversineM({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 });
ok(Math.abs(antipode - Math.PI * 6371008.8) < 1, "antipodes are π·R apart — the arcsine is there", Math.round(antipode));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The verdict, every branch");

ok(ON_SITE_THRESHOLD_M === 250, "threshold is 250 m (a constant, by decision — see distance.js)");
ok(stampVerdict({ distanceToSiteM: 12, accuracyM: 8 }) === "on_site", "12 m, 8 m accuracy → on_site");
ok(stampVerdict({ distanceToSiteM: 250, accuracyM: 8 }) === "on_site", "exactly the threshold → on_site (inclusive)");
ok(stampVerdict({ distanceToSiteM: 251, accuracyM: 8 }) === "away", "251 m → away");
ok(stampVerdict({ distanceToSiteM: 2100, accuracyM: 20 }) === "away", "2.1 km → away");
ok(stampVerdict({ distanceToSiteM: 2100, accuracyM: 1500 }) === "unknown", "2.1 km with a 1,500 m accuracy circle → unknown, NOT away");
ok(stampVerdict({ distanceToSiteM: 12, accuracyM: 1500 }) === "unknown", "12 m with a 1,500 m circle → unknown, NOT on_site either");
ok(stampVerdict({ distanceToSiteM: 12, accuracyM: 250 }) === "on_site", "accuracy exactly the threshold is still evidence");
ok(stampVerdict({ distanceToSiteM: 12, accuracyM: null }) === "on_site", "no accuracy figure → judged on distance alone");
ok(stampVerdict({ distanceToSiteM: null, accuracyM: 5 }) === "unknown", "no distance (job never geocoded) → unknown");
ok(stampVerdict({}) === "unknown", "no stamp at all → unknown");
ok(stampVerdict() === "unknown", "undefined → unknown");
ok(stampVerdict({ distanceToSiteM: NaN }) === "unknown", "NaN → unknown");
ok(stampVerdict({ distanceToSiteM: -5 }) === "unknown", "negative → unknown");
ok(stampVerdict({ distanceToSiteM: 400, accuracyM: 5, thresholdM: 500 }) === "on_site", "threshold is overridable per call");
ok(formatDistanceM(12.4) === "12 m", "12.4 → \"12 m\"");
ok(formatDistanceM(999.6) === "1.0 km", "999.6 rounds into km, not \"1000 m\"");
ok(formatDistanceM(2100) === "2.1 km", "2100 → \"2.1 km\"");
ok(formatDistanceM(null) === null, "null → null");

// ═══════════════════════════════════════════════════════════════════════════
section("3. Validation refuses what a phone must not be allowed to say");

const NOW = new Date("2026-09-10T15:00:00.000Z");
const good = { latitude: 45.4215, longitude: -75.6972, accuracyM: 12, at: "2026-09-10T14:59:30.000Z" };
const v = validateStamp(good, { now: NOW });
ok(v.ok === true, "a sane stamp passes", v);
ok(v.ok && v.value.accuracyM === 12 && v.value.at instanceof Date, "cleaned value carries accuracy and a Date");
ok(validateStamp({ ...good, latitude: 91 }, { now: NOW }).reason === "latitude_out_of_range", "lat 91 refused");
ok(validateStamp({ ...good, latitude: -90.0001 }, { now: NOW }).reason === "latitude_out_of_range", "lat -90.0001 refused");
ok(validateStamp({ ...good, longitude: 181 }, { now: NOW }).reason === "longitude_out_of_range", "lng 181 refused");
ok(validateStamp({ ...good, longitude: -180 }, { now: NOW }).ok, "lng -180 is the edge and passes");
ok(validateStamp({ ...good, accuracyM: -1 }, { now: NOW }).reason === "accuracy_invalid", "accuracy −1 refused");
ok(validateStamp({ ...good, accuracyM: "wide" }, { now: NOW }).reason === "accuracy_invalid", "accuracy \"wide\" refused");
ok(validateStamp({ ...good, accuracyM: undefined }, { now: NOW }).ok && validateStamp({ ...good, accuracyM: undefined }, { now: NOW }).value.accuracyM === null, "no accuracy → stored null, not refused");
const threeHoursOff = { ...good, at: new Date(NOW.getTime() - 3 * 3600 * 1000).toISOString() };
ok(validateStamp(threeHoursOff, { now: NOW }).reason === "at_out_of_window", "`at` three hours off refused");
const future = { ...good, at: new Date(NOW.getTime() + 20 * 60 * 1000).toISOString() };
ok(validateStamp(future, { now: NOW }).reason === "at_out_of_window", "`at` twenty minutes in the future refused");
const edge = { ...good, at: new Date(NOW.getTime() - AT_TOLERANCE_MS).toISOString() };
ok(validateStamp(edge, { now: NOW }).ok, "`at` exactly fifteen minutes off passes");
ok(validateStamp({ ...good, at: "yesterday-ish" }, { now: NOW }).reason === "at_invalid", "unparseable `at` refused");
ok(validateStamp({ ...good, at: undefined }, { now: NOW }).reason === "at_invalid", "missing `at` refused");
ok(validateStamp(null, { now: NOW }).reason === "not_an_object", "null refused, no throw");
ok(validateStamp("45,-75", { now: NOW }).reason === "not_an_object", "a string refused, no throw");
ok(validateStamp([45, -75], { now: NOW }).reason === "not_an_object", "an array refused, no throw");
ok(validateStamp({ ...good, latitude: 45.12345678 }, { now: NOW }).value.latitude === 45.123457, "latitude rounded to six decimals");
ok(STAMP_KINDS.has("clock_in") && STAMP_KINDS.has("completed") && !STAMP_KINDS.has("in_progress"), "kinds match the visit vocabulary the UI can send");

// distance at write time
ok(distanceToSite(good, { latitude: "45.4215", longitude: "-75.6972" }) === 0, "distance against a Decimal-as-string job coordinate");
ok(distanceToSite(good, { latitude: null, longitude: null }) === null, "job with no coordinates → null distance");
ok(distanceToSite(good, null) === null, "no job → null distance");
ok(distanceToSite(good, TORONTO) > 351_000, "Ottawa stamp against a Toronto job → ~352 km");

// ═══════════════════════════════════════════════════════════════════════════
section("4. Geocoding: absence is not padded");

const HIT = { lat: 45.4215, lng: -75.6972, locationType: "ROOFTOP" };
{
  const r = await resolveJobCoordinates("24 Sussex Dr, Ottawa", { geocode: async () => HIT, now: NOW });
  ok(r.latitude === 45.4215 && r.longitude === -75.6972 && r.geocodedAt === NOW, "a rooftop hit is written with a stamp", r);
}
{
  const r = await resolveJobCoordinates("   ", { geocode: async () => HIT, now: NOW });
  ok(r.latitude === null && r.geocodedAt === null && r.reason === "no_address", "blank address → nulls, geocoder never asked");
}
{
  let asked = 0;
  await resolveJobCoordinates(null, { geocode: async () => { asked++; return HIT; }, now: NOW });
  ok(asked === 0, "null address makes zero calls");
}
{
  const r = await resolveJobCoordinates("Somewhere", { geocode: async () => null, now: NOW });
  ok(r.latitude === null && r.reason === "no_result", "no result → nulls");
}
{
  const r = await resolveJobCoordinates("Ottawa", { geocode: async () => ({ ...HIT, locationType: "APPROXIMATE" }), now: NOW });
  ok(r.latitude === null && r.reason === "too_coarse", "APPROXIMATE (a town centroid) → nulls, not a pin");
}
{
  const r = await resolveJobCoordinates("x", { geocode: async () => ({ ...HIT, locationType: "RANGE_INTERPOLATED" }), now: NOW });
  ok(r.latitude !== null, "RANGE_INTERPOLATED (street-level) is accepted");
}
{
  const r = await resolveJobCoordinates("x", { geocode: async () => ({ lat: 45.4215, lng: -75.6972 }), now: NOW });
  ok(r.latitude !== null, "a hit with no locationType label is accepted (absence is not coarseness)");
}
{
  const r = await resolveJobCoordinates("x", { geocode: async () => { throw new Error("boom"); }, now: NOW });
  ok(r.latitude === null && r.reason === "threw", "a throwing geocoder → nulls, no throw out");
}
{
  const r = await resolveJobCoordinates("x", { geocode: async () => ({ lat: "n/a", lng: 1 }), now: NOW });
  ok(r.latitude === null, "a non-numeric hit → nulls");
}
ok(siteAddressChanged("12 Main St", "12 Main St ") === false, "trailing whitespace is not a change (no Google call)");
ok(siteAddressChanged("12 Main St", "12  Main St") === false, "doubled inner whitespace is not a change");
ok(siteAddressChanged(null, "") === false, "null → empty is not a change");
ok(siteAddressChanged(null, "12 Main St") === true, "null → an address is a change");
ok(siteAddressChanged("12 Main St", "14 Main St") === true, "a different number is a change");
ok(normaliseSiteAddress("") === null && normaliseSiteAddress(undefined) === null, "empty normalises to null");

// ═══════════════════════════════════════════════════════════════════════════
section("5. Source: the tap succeeds with or without a stamp");

const VISIT_ROUTE = strip(read("app/api/jobs/[id]/visits/[visitId]/route.js"));
{
  const patch = fnBody(VISIT_ROUTE, "export async function PATCH");
  ok(patch.length > 0, "visit PATCH found");
  const write = patch.indexOf("db.jobVisit.update(");
  const record = patch.indexOf("recordStampIfPresent(");
  ok(write > 0 && record > write, "visit PATCH records the stamp AFTER db.jobVisit.update, not before", { write, record });
  const before = patch.slice(0, write);
  ok(!/validateStamp|recordStamp\(/.test(before), "nothing before the visit write validates or records a stamp");
  // `stamp` is destructured before the write, but only READ after it.
  const usesBefore = (before.match(/\bstamp\b/g) || []).length;
  ok(usesBefore === 1, "`stamp` appears exactly once before the write — the destructure, nothing else", usesBefore);
  const after = patch.slice(record);
  ok(/stamp != null/.test(patch.slice(write, record + 40)) || /stamp != null/.test(patch), "the stamp block is gated on `stamp != null` — absent is a no-op", null);
  ok(/try\s*\{[\s\S]*recordStampIfPresent[\s\S]*\}\s*catch/.test(patch), "the stamp block sits inside its own try/catch");
  ok(!/if\s*\(\s*![\w.]*stamp[\w.]*\s*\)\s*return/.test(patch), "no early return keyed on a missing stamp");
  // The row, plus one `notice` field saying whether the client was written to
  // (the office move/cancel actions) — every column of `updated` still comes
  // back, so the checklist and the job page read the same shape they did.
  ok(after.includes("NextResponse.json({ ...updated, notice })"), "the response is still the `updated` visit row (spread, plus `notice`)");
}

const CLOCK_ROUTE = strip(read("app/api/time-clock/route.js"));
{
  const post = fnBody(CLOCK_ROUTE, "export async function POST");
  ok(post.length > 0, "clock POST found");
  const creates = [...post.matchAll(/db\.timeEntry\.(create|update)\(/g)].map((m) => m.index);
  const records = [...post.matchAll(/recordStampIfPresent\(/g)].map((m) => m.index);
  ok(records.length >= 3, "clock in, clock out and switch each record", records.length);
  ok(records.every((r) => creates.some((c) => c < r)), "every recordStampIfPresent follows a timeEntry write");
  const firstWrite = Math.min(...creates);
  ok(!/validateStamp|recordStamp/.test(post.slice(0, firstWrite)), "nothing before the first entry write touches a stamp");
  ok(!/if\s*\(\s*![\w.?]*stamp[\w.]*\s*\)\s*return/.test(post), "no early return keyed on a missing stamp in the clock route");
  ok(post.includes("NextResponse.json({ ok: true, open: entry })") && post.includes("NextResponse.json({ ok: true, entry })"), "clock in / out responses are the shapes they were");
}

const STAMPS = strip(read("lib/location/stamps.js"));
{
  const rec = fnBody(STAMPS, "export async function recordStamp");
  ok(/try\s*\{[\s\S]*locationStamp\.create[\s\S]*\}\s*catch/.test(rec), "recordStamp wraps the database write in try/catch");
  ok(/if\s*\(\s*args\?\.stamp == null\s*\)\s*return/.test(fnBody(STAMPS, "export async function recordStampIfPresent")), "recordStampIfPresent returns before any work when the stamp is absent");
  ok(/await db\.job\.findFirst\(\{\s*where:\s*\{\s*id:\s*jobId,\s*companyId/.test(rec), "the job's coordinates are read scoped to the company, never trusted from the body");
}

// Both clients: the stamp is captured at the tap and attached only when present.
// VisitStatus is a wrapper now; the tap lives in the shared EntryActions,
// which asks the phone only for the crew's own taps (`crew && kind === "visit"`).
const VISIT_UI = strip(read("app/components/schedule/EntryActions.js"));
ok(/captureStamp\(\)/.test(VISIT_UI) && /\.\.\.\(stamp && \{ stamp \}\)/.test(VISIT_UI), "EntryActions attaches `stamp` only when it got one");
ok(/crew && kind === "visit" \? await captureStamp\(\) : null/.test(VISIT_UI), "…and only asks the phone for a crew member's own visit tap");
ok(/patch\(\{\s*status:\s*to/.test(VISIT_UI), "EntryActions still sends { status } first — the shape check:visit-status greps for");
ok(/EntryActions/.test(strip(read("app/components/jobs/VisitStatus.js"))), "VisitStatus renders EntryActions with crew set");
const CLOCK_UI = strip(read("app/app/clock/page.js"));
ok(/captureStamp\(\)/.test(CLOCK_UI) && /\.\.\.\(stamp && \{ stamp \}\)/.test(CLOCK_UI), "clock screen attaches `stamp` only when it got one");
ok(/locationState === "prompt"/.test(CLOCK_UI) && /app\.clock\.locationNotice/.test(CLOCK_UI), "clock screen explains BEFORE the browser asks, in the prompt state only");

const CAPTURE = strip(read("lib/location/capture.js"));
ok(/getCurrentPosition\(/.test(CAPTURE), "capture uses getCurrentPosition");
ok(/timeout:\s*CAPTURE_TIMEOUT_MS/.test(CAPTURE) && /CAPTURE_TIMEOUT_MS = 8000/.test(CAPTURE), "8-second timeout");
ok(/maximumAge:\s*CAPTURE_MAX_AGE_MS/.test(CAPTURE) && /CAPTURE_MAX_AGE_MS = 30000/.test(CAPTURE), "maximumAge 30 s");
ok(/sessionStorage/.test(CAPTURE) && /err\.code === 1/.test(CAPTURE), "a refusal (code 1) is remembered in sessionStorage — no second prompt this session");
ok(/!navigator\.geolocation\) return Promise\.resolve\(null\)/.test(CAPTURE), "feature-detected: no geolocation object → null");
ok(!/\bthrow\b/.test(CAPTURE), "capture.js never throws");

// ═══════════════════════════════════════════════════════════════════════════
section("6. Source: the timesheet renders all three verdicts, and the legend");

const TIMESHEET = strip(read("app/app/settings/team/timesheets/page.js"));
{
  const chip = fnBody(TIMESHEET, "function StampChip");
  ok(chip.length > 0, "StampChip exists");
  ok(/stampVerdict\(/.test(chip), "the chip asks lib/geo/distance.js for the verdict rather than comparing numbers itself");
  for (const verdict of ["on_site", "away", "unknown"]) {
    ok(chip.includes(`data-verdict="${verdict}"`), `renders a chip for "${verdict}"`);
  }
  ok(/app\.timesheets\.onSite/.test(chip) && /app\.timesheets\.awayBy/.test(chip) && /app\.timesheets\.stampUnknown/.test(chip), "all three states are translated keys");
  ok(/title=\{t\("app\.timesheets\.stampUnknown"\)\}/.test(chip), "unknown carries a title explaining why");
  ok(/AlertTriangle/.test(chip.slice(chip.indexOf('data-verdict="away"') - 400, chip.indexOf('data-verdict="away"'))) || /AlertTriangle/.test(chip), "away is flagged with an icon");
  ok(/kind="clock_in"/.test(TIMESHEET) && /kind="clock_out"/.test(TIMESHEET), "both punches get a chip");
  ok(/app\.timesheets\.stampLegend/.test(TIMESHEET), "the legend is rendered");
  // Approval stays a human decision: the approve button is not gated on a verdict.
  const approveBtn = TIMESHEET.slice(TIMESHEET.indexOf("onClick={() => approve(e.id)}") - 300, TIMESHEET.indexOf("onClick={() => approve(e.id)}") + 200);
  ok(!/verdict|locationStamps/.test(approveBtn), "the Approve button is not gated or disabled by any verdict");
}

// The list and the PATCH both ship stamps, so approving does not lose the chip.
const ENTRIES_LIST = strip(read("app/api/time-entries/route.js"));
const ENTRIES_ONE = strip(read("app/api/time-entries/[id]/route.js"));
ok(/locationStamps:\s*\{/.test(fnBody(ENTRIES_LIST, "export async function GET")), "GET /api/time-entries includes locationStamps");
ok(/locationStamps:\s*\{/.test(fnBody(ENTRIES_ONE, "export async function PATCH")), "PATCH /api/time-entries/[id] includes locationStamps (the row the screen swaps in)");
ok(!/latitude|longitude/.test(ENTRIES_LIST.slice(ENTRIES_LIST.indexOf("locationStamps"), ENTRIES_LIST.indexOf("locationStamps") + 300)), "the timesheet payload carries the distance, never the raw point");

// Job page: the line renders for both kinds and nothing when absent.
const JOB_PAGE = strip(read("app/app/jobs/[id]/JobDetail.js"));
ok(/app\.job\.arrivedFrom/.test(JOB_PAGE) && /app\.job\.completedFrom/.test(JOB_PAGE), "job page prints the arrived / completed line");
ok(/\(v\.locationStamps \|\| \[\]\)/.test(JOB_PAGE), "job page tolerates a visit with no stamps");
const JOB_ROUTE = strip(read("app/api/jobs/[id]/route.js"));
ok(/locationStamps:\s*\{/.test(fnBody(JOB_ROUTE, "export async function GET")), "GET /api/jobs/[id] ships each visit's stamps");

// Geocode is wired: on create and on address change, never on read.
const CREATE_JOB = strip(read("lib/jobs/createJob.js"));
ok(/geocodeJob\(db, job\)/.test(CREATE_JOB) && /siteAddress: normaliseSiteAddress\(siteAddress\)/.test(CREATE_JOB), "createJob writes siteAddress and geocodes it");
{
  const patch = fnBody(JOB_ROUTE, "export async function PATCH");
  ok(/siteAddressChanged\(existing\.siteAddress, siteAddress\)/.test(patch), "job PATCH compares the address before geocoding");
  ok(/addressChanging && updated\.siteAddress/.test(patch) && /geocodeJob\(db, updated\)/.test(patch), "job PATCH geocodes only on a change");
  ok(/latitude: null,\s*longitude: null,\s*geocodedAt: null/.test(patch), "a changed address clears the old pin in the same write");
  const get = fnBody(JOB_ROUTE, "export async function GET");
  ok(!/geocode/i.test(get), "GET never geocodes");
}
const GEOCODE = strip(read("lib/geo/geocodeJob.js"));
ok(/from "@\/lib\/measure\/roofMeasurement"/.test(GEOCODE), "geocodeJob reuses the one Google client");
ok(!/maps\.googleapis\.com/.test(GEOCODE), "geocodeJob does not construct its own Google URL");

// ═══════════════════════════════════════════════════════════════════════════
section("7. This product does not track");

{
  const offenders = [];
  for (const f of [...walk("app"), ...walk("lib")]) {
    const src = strip(read(f));
    if (/\bwatchPosition\b/.test(src)) offenders.push(f);
  }
  ok(offenders.length === 0, "no watchPosition anywhere in app/ or lib/", offenders);
  // The marketing competitor tables may say "GPS tracking" about other
  // products; the app's own strings must not claim it.
  const claims = [];
  for (const f of walk("app").filter((p) => !p.includes("/marketing/") && !p.includes("/i18n/"))) {
    const src = read(f);
    if (/we track your|tracks your location|live location|real-time location/i.test(src)) claims.push(f);
  }
  ok(claims.length === 0, "no app screen claims live or real-time location", claims);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Every key, every language");

const KEYS = [
  "app.clock.locationNotice",
  "app.timesheets.stampIn",
  "app.timesheets.stampOut",
  "app.timesheets.onSite",
  "app.timesheets.onSiteTitle",
  "app.timesheets.awayBy",
  "app.timesheets.awayTitle",
  "app.timesheets.stampUnknown",
  "app.timesheets.stampLegend",
  "app.job.siteAddress",
  "app.job.siteNotPinned",
  "app.job.arrivedFrom",
  "app.job.completedFrom",
  "app.job.stampNoDistance",
  "app.jobEdit.siteAddressHint",
  "app.jobNew.siteAddressPlaceholder",
];
for (const code of Object.keys(APP_MESSAGES)) {
  const missing = KEYS.filter((k) => !APP_MESSAGES[code][k]);
  ok(missing.length === 0, `${code}: all ${KEYS.length} keys present`, missing);
}
for (const code of Object.keys(APP_MESSAGES)) {
  ok(/\{distance\}/.test(APP_MESSAGES[code]["app.timesheets.awayBy"]) && /\{distance\}/.test(APP_MESSAGES[code]["app.job.arrivedFrom"]), `${code}: distance placeholders survive translation`);
}
{
  const notice = APP_MESSAGES.en["app.clock.locationNotice"];
  ok(/once/.test(notice) && /permission/.test(notice) && /background/.test(notice), "the English notice says: once, with permission, nothing in the background");
  const legend = APP_MESSAGES.en["app.timesheets.stampLegend"];
  ok(/only/.test(legend) && /tracked/.test(legend), "the English legend says only-at-tap and not-tracked");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
