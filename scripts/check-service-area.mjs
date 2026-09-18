// scripts/check-service-area.mjs
//
//   npm run check:service-area
//
// The company service area, executed: lib/company/serviceArea.js is the one
// rule both public flows ask "is this address inside?", and this file runs it
// against the cases that matter rather than reading it — inside and outside a
// radius, a postal prefix overriding the circle, a company that never said,
// and an address nothing could be measured from, which must come back as
// "don't know" and never as "outside".
//
// Then the two things that cannot be executed and have to be read off the
// source: the copy tables carry every key in all three languages with no
// English left in fr/es, and the public route never hands the company's own
// coordinates to a browser.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkServiceArea,
  serviceAreaConfigured,
  normalisePostalPrefixes,
  cleanRadiusKm,
  postalCodeFromAddress,
  serviceAreaSentence,
  outsideServiceAreaSentence,
  serviceAreaCopy,
  distanceKm,
  SERVICE_AREA_COPY,
} from "../lib/company/serviceArea.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
/** Source with comments removed — a comment MENTIONING a field is not a select of it. */
const code = (p) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let checks = 0;
let failures = 0;
const ok = (cond, label, detail) => {
  if (typeof cond === "string") throw new TypeError(`ok() called label-first: ${JSON.stringify(cond)}`);
  if (typeof label !== "string") throw new TypeError("ok() needs a string label second");
  checks++;
  if (!cond) failures++;
  console.log(
    (cond ? "  ok   " : "  FAIL ") + label + (cond || detail === undefined ? "" : `  — ${JSON.stringify(detail).slice(0, 300)}`),
  );
};
const section = (t) => console.log(`\n${t}\n`);

// Ottawa's Parliament Hill as the base; the other points are real places at
// known distances so the radius verdicts are about geography, not fixtures.
const OTTAWA = { latitude: 45.4236, longitude: -75.7009, city: "Ottawa", name: "Northline Roofing" };
const KANATA = { lat: 45.3088, lng: -75.8983 }; // ~20 km west
const KINGSTON = { lat: 44.2312, lng: -76.486 }; // ~145 km south-west
const MONTREAL = { lat: 45.5017, lng: -73.5673 }; // ~167 km east

// ═══════════════════════════════════════════════════════════════════════════
section("1. Inside and outside a radius");

{
  const company = { ...OTTAWA, serviceRadiusKm: 40, servicePostalPrefixes: [] };
  ok(serviceAreaConfigured(company), "a radius with a base is a configured area");
  const near = checkServiceArea(company, KANATA);
  ok(near.configured && near.inside === true, "Kanata is inside 40 km of Ottawa", near);
  ok(near.distanceKm > 15 && near.distanceKm < 25, "…at roughly 20 km", near);
  const far = checkServiceArea(company, KINGSTON);
  ok(far.inside === false, "Kingston is outside 40 km of Ottawa", far);
  ok(far.distanceKm > 140 && far.distanceKm < 150, "…at roughly 145 km, one decimal", far);
  ok(String(far.distanceKm).replace(/^-?\d+\.?/, "").length <= 1, "distance is rounded to one decimal", far);
  // The edge: a point at exactly the radius is inside (<=), one metre past is not.
  const d = distanceKm(OTTAWA, KANATA);
  const edge = { ...OTTAWA, serviceRadiusKm: Math.ceil(d), servicePostalPrefixes: [] };
  ok(checkServiceArea(edge, KANATA).inside === true, "a radius rounded up to the distance is inside");
  const short = { ...OTTAWA, serviceRadiusKm: Math.floor(d), servicePostalPrefixes: [] };
  ok(checkServiceArea(short, KANATA).inside === false, "…and rounded down is outside");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. A postal prefix overrides the circle");

{
  const company = { ...OTTAWA, serviceRadiusKm: 40, servicePostalPrefixes: ["K7L"] }; // Kingston prefix
  const byPostal = checkServiceArea(company, { ...KINGSTON, postalCode: "K7L 2Z6" });
  ok(byPostal.inside === true, "Kingston, 145 km out but on the K7L list, is inside", byPostal);
  ok(byPostal.byPostal === true, "…and the verdict says it was the prefix", byPostal);
  const noPostal = checkServiceArea(company, KINGSTON);
  ok(noPostal.inside === false, "the same pin with no postal code is outside", noPostal);
  const wrongPostal = checkServiceArea(company, { ...KINGSTON, postalCode: "H2X 1Y4" });
  ok(wrongPostal.inside === false && wrongPostal.byPostal === false, "a prefix that does not match does not rescue it", wrongPostal);
  // Inside the circle but off the list is still inside: ANY test passing wins.
  const inCircle = checkServiceArea(company, { ...KANATA, postalCode: "K2K 1X3" });
  ok(inCircle.inside === true && inCircle.byPostal === false, "inside the radius with a non-listed prefix is still inside", inCircle);
  // Prefix-only company, no base: the postal code decides alone.
  const prefixOnly = { name: "X", serviceRadiusKm: null, servicePostalPrefixes: ["K1", "K2"] };
  ok(serviceAreaConfigured(prefixOnly), "prefixes alone configure an area");
  ok(checkServiceArea(prefixOnly, { postalCode: "k1a 0b1" }).inside === true, "lower-case, spaced postal code matches a prefix");
  ok(checkServiceArea(prefixOnly, { postalCode: "M5V 1A1" }).inside === false, "…and a Toronto code does not");
  ok(checkServiceArea(prefixOnly, KANATA).inside === null, "a pin with no postal code against a prefix-only area is unknown, not outside");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. No area → configured:false; unknown point → inside:null");

{
  for (const [label, company] of [
    ["null company", null],
    ["empty object", {}],
    ["radius but no base", { serviceRadiusKm: 25, servicePostalPrefixes: [] }],
    ["base but no radius", { ...OTTAWA, serviceRadiusKm: null, servicePostalPrefixes: [] }],
    ["radius 0", { ...OTTAWA, serviceRadiusKm: 0, servicePostalPrefixes: [] }],
    ["prefixes all too short", { serviceRadiusKm: null, servicePostalPrefixes: ["K", "1"] }],
  ]) {
    const v = checkServiceArea(company, KANATA);
    ok(v.configured === false && v.inside === null, `${label} → configured:false, inside:null`, v);
    ok(serviceAreaSentence(company, "en") === null, `${label} → no sentence`);
  }
  const company = { ...OTTAWA, serviceRadiusKm: 40, servicePostalPrefixes: [] };
  const unknown = checkServiceArea(company, {});
  ok(unknown.configured === true && unknown.inside === null && unknown.distanceKm === null, "no pin, no postal code → inside:null", unknown);
  ok(checkServiceArea(company, { lat: NaN, lng: "x" }).inside === null, "a non-numeric pin is unknown, not outside");
  ok(checkServiceArea(company, { lat: null, lng: null, postalCode: "" }).inside === null, "THE BUG THIS CAUGHT: a null pin is unknown — Number(null) is 0, and (0, 0) is a real place 8,000 km away that used to answer 'outside'");
  ok(checkServiceArea(company, { lat: "", lng: "" }).inside === null, "an empty-string pin is unknown too");
  ok(distanceKm(OTTAWA, { lat: 0, lng: 0 }) > 7000, "…while a genuine (0, 0) is still measured");
  // The base side has the same trap: a company whose latitude is null must
  // not be 'configured' by a radius alone.
  ok(!serviceAreaConfigured({ latitude: null, longitude: null, serviceRadiusKm: 25, servicePostalPrefixes: [] }), "null base coordinates do not configure a radius area");
  ok(!serviceAreaConfigured({ latitude: "", longitude: "", serviceRadiusKm: 25, servicePostalPrefixes: [] }), "empty-string base coordinates do not either");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Normalisation");

{
  ok(JSON.stringify(normalisePostalPrefixes("k1a, K1A 0B1 ; k2p\n K1A")) === '["K1A","K1A0B1","K2P"]', "string list: upper-cased, spaces stripped, de-duplicated, order kept", normalisePostalPrefixes("k1a, K1A 0B1 ; k2p\n K1A"));
  ok(JSON.stringify(normalisePostalPrefixes([" 902 ", "9", "ABCDEFGH", 12345])) === '["902","12345"]', "array: too short and too long dropped, numbers coerced", normalisePostalPrefixes([" 902 ", "9", "ABCDEFGH", 12345]));
  ok(normalisePostalPrefixes(null).length === 0 && normalisePostalPrefixes(undefined).length === 0 && normalisePostalPrefixes(42).length === 0, "null / undefined / a number → []");
  ok(normalisePostalPrefixes(Array.from({ length: 80 }, (_, i) => `P${i}`)).length === 50, "capped at 50");
  ok(normalisePostalPrefixes("<b>k1a</b>")[0] === "BK1AB", "markup cannot survive: only A–Z and 0–9 are kept");

  ok(cleanRadiusKm("25") === 25 && cleanRadiusKm(25.4) === 25 && cleanRadiusKm(25.6) === 26, "radius: strings and decimals become whole km");
  ok(cleanRadiusKm("") === null && cleanRadiusKm(null) === null && cleanRadiusKm(undefined) === null, "radius: empty / null / undefined → null (clears)");
  ok(cleanRadiusKm(0) === null && cleanRadiusKm(-5) === null && cleanRadiusKm("abc") === null, "radius: 0, negative and text → null");
  ok(cleanRadiusKm(99999) === 2000, "radius: capped at 2000 km");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. postalCodeFromAddress — CA, US, none");

{
  ok(postalCodeFromAddress("917 Littlerock St, Ottawa, ON K1A 0B1, Canada") === "K1A0B1", "Canadian code with a space");
  ok(postalCodeFromAddress("12 Main St, Kanata, ON k2k1x3") === "K2K1X3", "Canadian code without a space, lower case");
  ok(postalCodeFromAddress("1600 Pennsylvania Ave NW, Washington, DC 20500, USA") === "20500", "US ZIP before a comma");
  ok(postalCodeFromAddress("100 Main St, Beverly Hills, CA 90210-1234") === "90210", "US ZIP+4 at the end → 5 digits");
  ok(postalCodeFromAddress("90210 Something Rd, Springfield") === null, "a five-digit HOUSE NUMBER is not a ZIP");
  ok(postalCodeFromAddress("12 Main St, Springfield") === null, "no code → null");
  ok(postalCodeFromAddress("") === null && postalCodeFromAddress(null) === null && postalCodeFromAddress(undefined) === null, "empty / null / undefined → null");
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The sentences, in three languages, with no English in fr/es");

{
  const keys = Object.keys(SERVICE_AREA_COPY.en);
  ok(keys.length >= 4, "the copy table has its four entries", keys);
  for (const lang of ["fr", "es"]) {
    const missing = keys.filter((k) => !(k in SERVICE_AREA_COPY[lang]));
    ok(missing.length === 0, `${lang} carries every key`, missing);
    const same = keys.filter((k) => {
      const a = SERVICE_AREA_COPY.en[k];
      const b = SERVICE_AREA_COPY[lang][k];
      if (typeof a === "function") return a(25, "Ottawa", "X") === b(25, "Ottawa", "X") || a("Co", 25, "Ottawa") === b("Co", 25, "Ottawa");
      return a === b;
    });
    ok(same.length === 0, `${lang} has no English string copied through`, same);
  }
  const company = { ...OTTAWA, serviceRadiusKm: 25, servicePostalPrefixes: [] };
  ok(serviceAreaSentence(company, "en") === "We serve within 25 km of Ottawa.", "EN sentence", serviceAreaSentence(company, "en"));
  ok(/25 km autour de Ottawa/.test(serviceAreaSentence(company, "fr")), "FR sentence carries the radius and city", serviceAreaSentence(company, "fr"));
  ok(/25 km alrededor de Ottawa/.test(serviceAreaSentence(company, "es")), "ES sentence carries the radius and city", serviceAreaSentence(company, "es"));
  ok(/our base/.test(serviceAreaSentence({ ...company, city: "" }, "en")), "no city → 'our base', not an empty name");
  const prefixOnly = { serviceRadiusKm: null, servicePostalPrefixes: ["K1A", "K2P"] };
  ok(/K1A, K2P/.test(serviceAreaSentence(prefixOnly, "en")), "prefix-only area lists its prefixes", serviceAreaSentence(prefixOnly, "en"));
  const outside = outsideServiceAreaSentence(company, "en");
  ok(/Northline Roofing/.test(outside) && /25 km around Ottawa/.test(outside) && /still send/.test(outside), "outside line names the company, radius, city, and says the request still goes", outside);
  const outsideNoRadius = outsideServiceAreaSentence(prefixOnly, "en");
  ok(!/km/.test(outsideNoRadius), "outside line for a prefix-only area prints no radius");
  ok(serviceAreaCopy("FR-CA").outsideBadge === SERVICE_AREA_COPY.fr.outsideBadge, "language codes are cut to two letters");
  ok(serviceAreaCopy("de").outsideBadge === SERVICE_AREA_COPY.en.outsideBadge, "an unknown language falls back to English");
  ok(serviceAreaCopy("__proto__") === SERVICE_AREA_COPY.en, "a prototype key falls back to English rather than reaching Object.prototype");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The public route never returns the base coordinates");

{
  const ROUTE = "app/api/service-area/[companySlug]/route.js";
  const src = code(ROUTE);
  ok(src.length > 0, `${ROUTE} exists`);
  // Every NextResponse.json({...}) literal in the file, with its keys.
  const responses = [...src.matchAll(/NextResponse\.json\(\s*\{([\s\S]*?)\}\s*(?:,\s*\{[^}]*\}\s*)?\)/g)].map((m) => m[1]);
  ok(responses.length >= 3, "found the route's JSON responses", responses.length);
  const leaks = responses.filter((body) => /\b(latitude|longitude)\b/.test(body));
  ok(leaks.length === 0, "no response body names latitude or longitude", leaks);
  ok(!/NextResponse\.json\(\s*company\b/.test(src) && !/NextResponse\.json\(\s*verdict\b/.test(src), "no response returns the company row or the verdict object whole");
  ok(!/\.\.\.company/.test(src) && !/\.\.\.verdict/.test(src), "neither is spread into a response");
  ok(/rateLimit\(request,\s*"service-area"/.test(src), "rate-limited under its own key");
  ok(/configured:\s*false/.test(src) && /configured:\s*true/.test(src), "both configured shapes are present");
  ok(/inside:\s*verdict\.inside/.test(src) && /radiusKm/.test(src) && /city/.test(src) && /distanceKm/.test(src), "the configured shape carries inside / radiusKm / city / distanceKm");
  ok(/postalCodeFromAddress\(hit\?\.formattedAddress \|\| address\)/.test(src), "the postal code is read from the geocoder's formatted address, falling back to the raw text");
  ok(/serviceAreaConfigured\(company\)/.test(src), "the route asks the rule module whether an area exists, not its own copy of the test");

  // The settings API, which does return them to the OWNER, must read and
  // write both service-area columns — a field written and never read, or
  // the reverse, is the recurring failure AGENTS.md lists first.
  const settings = code("app/api/settings/business-info/route.js");
  ok(/serviceRadiusKm:\s*true/.test(settings) && /servicePostalPrefixes:\s*true/.test(settings), "settings GET selects both columns");
  ok(/serviceRadiusKm:\s*cleanRadius\.value/.test(settings) && /servicePostalPrefixes:\s*cleanPrefixes/.test(settings), "settings PATCH writes both columns");
  ok(/normalisePostalPrefixes\(servicePostalPrefixes\)/.test(settings), "…prefixes normalised through the rule module on save");
  ok(/backfillCoordinates\(member\.companyId,\s*updated\)/.test(settings), "…and saving a radius with no coordinates geocodes the base");
  const page = code("app/app/settings/company/page.js");
  ok(/serviceRadiusKm:\s*form\.serviceRadiusKm === "" \? null/.test(page), "the settings page sends null for an emptied radius, so clearing clears");
  ok(/servicePostalPrefixes:\s*normalisePostalPrefixes\(form\.servicePostalPrefixes\)/.test(page), "…and [] for an emptied prefix list");
  ok(/serviceAreaSentence\(/.test(page), "…and previews the same sentence the public pages print");
  const schema = read("prisma/schema.prisma");
  ok(/serviceRadiusKm\s+Int\?/.test(schema) && /servicePostalPrefixes\s+String\[\]\s+@default\(\[\]\)/.test(schema), "the two columns exist on Company");
}

console.log(`\n${checks} checks, ${failures} failed\n`);
process.exit(failures ? 1 : 0);
