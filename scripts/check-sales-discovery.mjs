// scripts/check-sales-discovery.mjs
//
// Turning a directory listing into a prospect a rep can call. Prove it does
// not invent facts, does not lose businesses, does not sell to paint stores,
// and does not report a funnel that fails to add up.
//
//   npm run check:sales-discovery
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// Every guarantee here is a decision made about a hostile row, and no decision
// like that is visible by reading. "The phone is normalised" is a claim;
// "6137956277" and "+1 (613) 795-6277" resolving to one key, and a London
// number surviving intact, is a measurement. Same for the classifier, whose
// whole job is to be right about names nobody anticipated, and for the funnel,
// whose numbers have to reconcile or the dashboard lies.
//
// No database and no network. Everything that decides anything in
// lib/sales/discovery/ is pure and takes loaded rows — the shape
// lib/marketing/jobPhotoContext.js established — so the shipped functions run
// here directly rather than a copy of them.
//
// ══ The hostile inputs, and the real bug each one stands for ═══════════════
//
//   1. A retailer that looks like a contractor. Benjamin Moore arrives filed
//      as `painting` with NO alternate categories at all. No structural rule
//      can catch it, and a rep calling it wastes the call and stops trusting
//      the queue.
//   2. A row with no phone. 0.4% of the measured sample. It must not throw,
//      must not be dropped silently, and must not count as ready to call.
//   3. A bare-digit phone. 45% of the sample. Dedupe is keyed on E.164, so a
//      raw-string key would treat one business's two spellings as two
//      businesses.
//   4. An international number. `toE164`'s NANP shortcuts must not mangle
//      +44 20 7946 0958 into a Canadian number that rings a stranger.
//   5. Two rows that are the same business. The second is FLAGGED, never
//      merged: merging destroys provenance and a wrong merge is unrecoverable.
//   6. A null `operating_status`. Overture's is only ever `open` or NULL and
//      there is no closed flag, so nothing may read a null as "open".
//   7. An unmapped category. tradeKey stays null, the row is counted, and it
//      does NOT fall into the nearest-looking trade.
//   8. A name with markup in it. `<b>Acme &amp; Sons</b>` is what a rep reads
//      off the screen before dialling.
//
// Plus the trap that was found by running the real extractor against the real
// release rather than by reading: EVERY Overture row carries a derived
// `/properties/confidence` source stamped with the release build date, so
// "newest source update_time" reports today for a record last touched in 2015.
// That is asserted below, on a real row shape.
//
// Plus positional source rules, each scoped to ONE function extracted by brace
// matching — a guard string sitting elsewhere in the same file has manufactured
// a false pass in this repo five times.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLASSIFICATIONS,
  classifyBusiness,
  normaliseNameForMatch,
  RETAIL_BRANDS,
  AMBIGUOUS_ALTERNATES,
} from "@/lib/sales/discovery/classify";
import {
  DISCOVERY_TRADES,
  discoveryTradeKeys,
  duplicateSourceCategories,
  mappedSourceCategories,
  tradeForCategories,
  unknownCategoryKeys,
} from "@/lib/sales/discovery/trades";
import {
  cleanBusinessName,
  cleanWebsite,
  isCallReady,
  normaliseBusiness,
  sourceAgeDays,
  stalenessOf,
  STALE_AFTER_DAYS,
} from "@/lib/sales/discovery/normalise";
import {
  buildDedupeIndex,
  dedupeKeys,
  duplicateReason,
  cityKey,
  fuzzyKey,
  matchExisting,
  nameKey,
} from "@/lib/sales/discovery/dedupe";
import { campaignProgress, discoveryStopReason, funnelProblems, funnelRows } from "@/lib/sales/discovery/funnel";
import { planIngest, evidenceRows } from "@/lib/sales/discovery/ingest";
import { shapeProblems, registerDiscoveryProvider, __resetDiscoveryProvidersForTests } from "@/lib/sales/discovery/provider";
import { isReleaseName, newestRelease, parseReleaseListing, placesPathFor } from "@/lib/sales/discovery/overture/release";
import { manifestProblems, readSnapshot, SNAPSHOT_FORMAT, toDiscoveredBusiness } from "@/lib/sales/discovery/overture/snapshot";
import { inTerritory, overtureProvider, parseCursor } from "@/lib/sales/discovery/overture/provider";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";
import { haversineKm } from "@/lib/booking/travel";
import { TRADE_CATALOG } from "@/lib/trades/catalog";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== "" ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

/* ═══════════════════════════════════════════════════════════════════════════
   Source-reading helpers, proved before they are trusted
   ═══════════════════════════════════════════════════════════════════════════ */

/** Comments and string bodies blanked, so a rule cannot match prose. */
function mask(src) {
  const out = src.split("");
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") { out[i] = " "; i++; }
      continue;
    }
    if (c === "/" && d === "*") {
      out[i] = " "; out[i + 1] = " "; i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] !== "\n") out[i] = " "; i++; }
      if (i < n) { out[i] = " "; out[i + 1] = " "; i += 2; }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < n) {
        if (src[i] === "\\") { out[i] = " "; out[i + 1] = " "; i += 2; continue; }
        if (src[i] === quote) break;
        if (src[i] !== "\n") out[i] = " ";
        i++;
      }
      i++;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** Comments blanked, string bodies KEPT.
 *
 *  `mask` is right for structural rules — "is this inside a transaction" — and
 *  wrong for every rule about a literal, because it blanks the literal. Two
 *  helpers rather than one, because using the wrong one produces a rule that
 *  can never match, which passes as a NEGATIVE assertion and fails as a
 *  positive one. Both failure modes have happened in this repo. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** One function's source, signature to its matching closing brace.
 *
 *  The parameter list is skipped by counting PARENTHESES first. Jumping to the
 *  next "{" lands on a destructured parameter — nearly every function here
 *  takes one — and the brace count then closes on the signature instead of the
 *  body, which passes vacuously. */
function fnBody(src, name) {
  const masked = mask(src);
  const re = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = masked.match(re);
  if (!m) return null;
  let paren = 0;
  let i = m.index + m[0].length - 1;
  for (; i < masked.length; i++) {
    if (masked[i] === "(") paren++;
    else if (masked[i] === ")") { paren--; if (paren === 0) break; }
  }
  if (paren !== 0) return null;
  const open = masked.indexOf("{", i);
  if (open === -1) return null;
  let depth = 0;
  for (let j = open; j < masked.length; j++) {
    if (masked[j] === "{") depth++;
    else if (masked[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(m.index, j + 1);
    }
  }
  return null;
}

section("The extractor is trustworthy before anything is asserted with it");
{
  const sample =
    `function outer({ a, deps = {} } = {}) { const s = "} not a brace"; /* } */ if (a) { return 1; } return "MARKER"; }\n` +
    `function after() { return "GUARD"; }`;
  const body = fnBody(sample, "outer");
  ok("brace matcher ignores braces in strings and comments",
    body !== null && body.endsWith(`return "MARKER"; }`) && !body.includes("GUARD"));
  ok("brace matcher does not stop at a destructured parameter", body !== null && body.includes("MARKER"));
  ok("brace matcher returns null for a name that is not there", fnBody(sample, "nope") === null);
  ok("mask blanks a string body", !mask(`const x = "needle";`).includes("needle"));

  // stripComments is the OPPOSITE tool and has the opposite failure mode: if
  // it blanked strings, every literal rule below would silently stop matching
  // — and a rule that can never match passes as a negative assertion.
  ok("stripComments keeps a string body", stripComments(`const x = "needle";`).includes("needle"));
  ok("stripComments removes a line comment", !stripComments(`// needle\nconst x = 1;`).includes("needle"));
  ok("stripComments removes a block comment", !stripComments(`/* needle */ const x = 1;`).includes("needle"));
  ok("stripComments does not eat a URL's double slash",
    stripComments(`const u = "https://acme.com/x";`).includes("acme.com"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. Trade segmentation — the spine of a single-trade queue
   ═══════════════════════════════════════════════════════════════════════════ */

section("Trade map — every FieldQuo trade it names is a real one");
{
  ok("no discovery trade names a catalogue key the catalogue does not ship",
    unknownCategoryKeys().length === 0, JSON.stringify(unknownCategoryKeys()));
  ok("no source category is claimed by two trades",
    duplicateSourceCategories().length === 0, JSON.stringify(duplicateSourceCategories()));
  ok("every trade names at least one catalogue key and one source category",
    discoveryTradeKeys().every(
      (k) => DISCOVERY_TRADES[k].categoryKeys.length > 0 && DISCOVERY_TRADES[k].sourceCategories.length > 0,
    ));
  ok("painting covers BOTH painting quote types, which is why tradeKey is not a catalogue key",
    DISCOVERY_TRADES.painting.categoryKeys.includes("interior_painting") &&
      DISCOVERY_TRADES.painting.categoryKeys.includes("exterior_painting"));
  ok("every catalogue key named here exists in TRADE_CATALOG",
    discoveryTradeKeys().every((k) =>
      DISCOVERY_TRADES[k].categoryKeys.every((c) => Object.prototype.hasOwnProperty.call(TRADE_CATALOG, c))));
  // Shape only, and honestly so: existence in Overture's 2,118-row taxonomy
  // cannot be proved without the dataset. A category that does not exist
  // matches zero rows and looks exactly like a category with no businesses in
  // it — another agent lost four keys that way on this same dataset the same
  // day. trades.js records the verification and the query that redoes it.
  ok("every source category is a plausible taxonomy key (shape, not existence)",
    mappedSourceCategories().every((c) => /^[a-z][a-z0-9_]{2,63}$/.test(c)),
    JSON.stringify(mappedSourceCategories().filter((c) => !/^[a-z][a-z0-9_]{2,63}$/.test(c))));
  ok("no source category is capitalised, spaced or hyphenated — the three ways one gets mistyped",
    mappedSourceCategories().every((c) => c === c.toLowerCase() && !/[\s-]/.test(c)));
  ok("mappedSourceCategories is sorted and unique",
    JSON.stringify(mappedSourceCategories()) ===
      JSON.stringify([...new Set(mappedSourceCategories())].sort()));
}

section("HOSTILE: an unmapped category leaves tradeKey null rather than guessing");
{
  ok("a category nothing maps yields null",
    tradeForCategories({ primary: "tattoo_parlour", alternate: [] }).tradeKey === null);
  ok("no trade is invented from an unrecognised alternate either",
    tradeForCategories({ primary: "tattoo_parlour", alternate: ["nail_salon"] }).tradeKey === null);
  ok("the primary decides when it maps",
    tradeForCategories({ primary: "painting", alternate: ["roofing"] }).tradeKey === "painting");
  ok("an alternate is read only when the primary maps to nothing",
    tradeForCategories({ primary: "unknown_thing", alternate: ["roofing"] }).tradeKey === "roofing");
  ok("TWO alternates naming two trades yields null, not the first one",
    tradeForCategories({ primary: "unknown_thing", alternate: ["roofing", "plumbing"] }).tradeKey === null);
  ok("garbage input does not throw", tradeForCategories(null).tradeKey === null);
  ok("a non-string alternate is ignored rather than crashing",
    tradeForCategories({ primary: null, alternate: [null, 7, "roofing"] }).tradeKey === "roofing");
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. The classifier — contractor, retailer, or honestly unsure
   ═══════════════════════════════════════════════════════════════════════════ */

const painterHierarchy = ["services_and_business", "home_service", "painting"];
const shopHierarchy = ["shopping", "specialty_store", "hardware_home_and_garden_store", "paint_store"];

section("HOSTILE: a retailer that looks exactly like a contractor");
{
  // The real row, from the real release: primary category `painting`, taxonomy
  // home_service, NO alternates. Every structural rule says contractor.
  const benjaminMoore = classifyBusiness({
    name: "Benjamin Moore",
    categories: { primary: "painting", alternate: [] },
    taxonomyHierarchy: painterHierarchy,
  });
  ok("Benjamin Moore filed as `painting` with no alternates is still a retailer",
    benjaminMoore.classification === "retailer", benjaminMoore.reasons.join(";"));
  ok("...and it says WHY, in a sentence a human can act on",
    /benjamin moore/i.test(benjaminMoore.reason));

  for (const [name, expected] of [
    ["Dulux Canada", "retailer"],
    ["Betonel Ltee, Succursales", "retailer"],
    ["Sherwin-Williams Paint Store", "retailer"],
    ["PPG Industries", "retailer"],
    ["Sico Pro Ctr", "retailer"],
    ["Ferguson Plumbing Supply", "retailer"],
    ["Plumb Supply Company", "retailer"],
    ["Crescent Electric Supply Company", "retailer"],
    ["Beacon Roofing Supply Canada Co", "retailer"],
    ["J.P. Lumber, Inc.", "retailer"],
  ]) {
    const verdict = classifyBusiness({
      name,
      categories: { primary: "painting", alternate: [] },
      taxonomyHierarchy: painterHierarchy,
    });
    ok(`"${name}" is a ${expected}`, verdict.classification === expected, verdict.reasons.join(";"));
  }

  for (const name of [
    "Ottawa Painting Contractors",
    "CertaPro Painters",
    "Wow 1 Day Painting",
    "Moore Painting",
    "Corona Plumbing Heating and Cooling",
    "Homer's Painting",
  ]) {
    const verdict = classifyBusiness({
      name,
      categories: { primary: "painting", alternate: [] },
      taxonomyHierarchy: painterHierarchy,
    });
    ok(`"${name}" is NOT rejected as a retailer`, verdict.classification !== "retailer", verdict.reasons.join(";"));
  }
}

section("The brand list is word-bounded, so a contractor's name cannot collide");
{
  ok('"Corona Plumbing" does not match the brand "rona"',
    !normaliseNameForMatch("Corona Plumbing").split(" ").includes("rona"));
  ok('"Sherwin-Williams" flattens to the same words as "Sherwin Williams"',
    normaliseNameForMatch("Sherwin-Williams") === normaliseNameForMatch("Sherwin Williams"));
  ok("every brand entry flattens to something non-empty",
    RETAIL_BRANDS.every((b) => normaliseNameForMatch(b).length > 0));
  ok("home_improvement_store is deliberately NOT an ambiguity trigger — measured as noise",
    !AMBIGUOUS_ALTERNATES.includes("home_improvement_store"));
}

section("HOSTILE: evidence pointing both ways goes to review, never to a coin toss");
{
  const showroom = classifyBusiness({
    name: "Allwood Flooring",
    categories: { primary: "flooring_contractors", alternate: ["flooring_store", "retail"] },
    taxonomyHierarchy: ["services_and_business", "home_service", "flooring_contractors"],
  });
  ok("a flooring contractor with a showroom needs review", showroom.classification === "needs_review");

  const fence = classifyBusiness({
    name: "Whistle Stop Fence Co",
    categories: { primary: "fence_and_gate_sales_service", alternate: ["contractor", "building_supply_store"] },
    taxonomyHierarchy: ["services_and_business", "home_service", "fence_and_gate_sales_service"],
  });
  ok("a fence company that stocks panels is NOT rejected outright",
    fence.classification === "needs_review", fence.reasons.join(";"));

  const nothing = classifyBusiness({ name: "Acme", categories: {}, taxonomyHierarchy: [] });
  ok("a row with no signal at all needs review — absence is not a statement",
    nothing.classification === "needs_review" && nothing.reasons.includes("no_signal"));

  const nameless = classifyBusiness({
    name: "",
    categories: { primary: "painting", alternate: [] },
    taxonomyHierarchy: painterHierarchy,
  });
  ok("a nameless row needs review rather than being accepted on the taxonomy alone",
    nameless.classification === "needs_review" && nameless.reasons.includes("no_name"));

  ok("a shop by taxonomy with no contractor signal is a retailer",
    classifyBusiness({
      name: "Ormsby's Garden Centre",
      categories: { primary: "nursery_and_gardening", alternate: ["shopping", "landscaping"] },
      taxonomyHierarchy: ["shopping", "specialty_store", "nursery_and_gardening"],
    }).classification === "retailer");

  ok("a shop by taxonomy WITH a trade name goes to review instead",
    classifyBusiness({
      name: "Song Landscaping",
      categories: { primary: "nursery_and_gardening", alternate: ["landscaping", "gardener"] },
      taxonomyHierarchy: ["shopping", "specialty_store", "nursery_and_gardening"],
    }).classification === "needs_review");

  ok("every verdict is one of the three declared values",
    [showroom, fence, nothing, nameless].every((v) => CLASSIFICATIONS.includes(v.classification)));
  ok("hostile input does not throw", classifyBusiness(null).classification === "needs_review");
  ok("a non-array alternate does not throw",
    classifyBusiness({ name: "X", categories: { primary: "painting", alternate: "roofing" }, taxonomyHierarchy: painterHierarchy })
      .classification === "contractor");
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Normalisation — the phone, the domain, the name, the dates
   ═══════════════════════════════════════════════════════════════════════════ */

const base = {
  sourceRecordId: "gers:1",
  name: "Acme Painting",
  categories: { primary: "painting", alternate: [] },
  taxonomyHierarchy: painterHierarchy,
  phones: [],
  websites: [],
  emails: [],
  address: { line: "17 Aberdeen Street", city: "Ottawa", province: "ON", postalCode: "K1S 3J3", country: "CA" },
  latitude: 45.4,
  longitude: -75.7,
  operatingStatus: null,
  sourceConfidence: 0.0163,
  sourceDataset: "Microsoft",
  sourceUpdatedAt: "2015-09-08T00:00:00.000Z",
};
const context = { provider: "overture", release: "2026-08-19.0", tradeKey: "painting", classification: "contractor" };
const shaped = (over = {}) => normaliseBusiness({ ...base, ...over }, context);

section("HOSTILE: 45% of phones are bare digits and 54% are E.164 — one key either way");
{
  const bare = shaped({ phones: ["6137956277"] });
  const e164 = shaped({ phones: ["+16137956277"] });
  const messy = shaped({ phones: ["+1 (613) 795-6277"] });
  ok("a bare ten-digit phone normalises to E.164", bare.prospect.phoneE164 === "+16137956277");
  ok("an already-E.164 phone survives", e164.prospect.phoneE164 === "+16137956277");
  ok("a punctuated phone lands on the same key", messy.prospect.phoneE164 === "+16137956277");
  ok("all three spellings dedupe to ONE key",
    new Set([bare, e164, messy].map((s) => s.prospect.phoneE164)).size === 1);
}

section("HOSTILE: an international number is not mangled into a North American one");
{
  const london = shaped({ phones: ["+44 20 7946 0958"] });
  ok("a London number keeps its country code", london.prospect.phoneE164 === "+442079460958");
  ok("...and is not rewritten as +1", !london.prospect.phoneE164.startsWith("+1"));
  const nonsense = shaped({ phones: ["not a phone"] });
  ok("a value that is not a number becomes null rather than a key that matches everything",
    nonsense.prospect.phoneE164 === null);
}

section("HOSTILE: a row with no phone survives, and is not call-ready");
{
  const noPhone = shaped({ phones: [] });
  ok("no phone does not throw", noPhone.ok === true);
  ok("phoneE164 is null", noPhone.prospect.phoneE164 === null);
  ok("it is NOT counted as ready to call", isCallReady(noPhone.prospect) === false);
  ok("a phone plus a street address IS ready", isCallReady(shaped({ phones: ["6137956277"] }).prospect) === true);
  ok("a phone with no street address is NOT ready",
    isCallReady(shaped({ phones: ["6137956277"], address: { city: "Ottawa" } }).prospect) === false);
  ok("phones: null instead of an array does not throw", shaped({ phones: null }).ok === true);
}

section("HOSTILE: a name with markup in it");
{
  ok("tags are stripped and entities decoded",
    cleanBusinessName("<b>Acme &amp; Sons</b>") === "Acme & Sons");
  ok("a script tag does not survive into what a rep reads",
    !/script/i.test(cleanBusinessName("<script>alert(1)</script>Acme Painting") || ""));
  ok("a name that is nothing but markup becomes null, not an empty required column",
    cleanBusinessName("<b></b>   ") === null);
  ok("control characters are removed", cleanBusinessName("Acme\u0000\u001fPainting") === "Acme Painting");
  const marked = shaped({ name: "<b>Acme &amp; Sons</b>" });
  ok("the stored name is cleaned", marked.prospect.businessName === "Acme & Sons");
  ok("...and the SOURCE spelling is kept, because a dedupe argument needs it",
    marked.prospect.rawName === "<b>Acme &amp; Sons</b>");
  const nameless = shaped({ name: "<b></b>" });
  ok("an unusable name is a refusal, not an empty string",
    nameless.ok === false && nameless.problems.includes("no_name"));
}

section("Websites: a domain that can be a key, and a URL a human can click");
{
  ok("a bare domain gains a scheme", cleanWebsite("acme.com") === "https://acme.com");
  ok("www is stripped from the KEY but the URL is left alone",
    shaped({ websites: ["https://www.Acme.com/contact"] }).prospect.domain === "acme.com");
  ok("javascript: is refused outright", cleanWebsite("javascript:alert(1)") === null);
  ok("data: is refused outright", cleanWebsite("data:text/html,<h1>x") === null);
  ok("an IP address is refused — it is a key nothing would ever match",
    cleanWebsite("http://192.168.1.1/") === null);
  // The scheme guard only bites on a scheme WITH "//" — javascript: and data:
  // are already refused by the domain rule, so a check that only tried those
  // two passed with the guard deleted. Found by mutation testing.
  ok("a non-http scheme is refused", cleanWebsite("ftp://files.acme.com/x") === null);
  ok("...and so is any other", cleanWebsite("chrome-extension://acme.com/x") === null);
  ok("no website leaves hasWebsite NULL, never false",
    shaped({ websites: [] }).prospect.hasWebsite === null);
  ok("a website sets hasWebsite true",
    shaped({ websites: ["acme.com"] }).prospect.hasWebsite === true);
}

section("HOSTILE: a null operating_status is recorded as null, never read as open");
{
  ok("null stays null", shaped({ operatingStatus: null }).prospect.businessStatus === null);
  ok("an absent field stays null", shaped({ operatingStatus: undefined }).prospect.businessStatus === null);
  ok('"open" is carried verbatim', shaped({ operatingStatus: "open" }).prospect.businessStatus === "open");
  ok("an unexpected value is carried verbatim rather than coerced",
    shaped({ operatingStatus: "temporarily_closed" }).prospect.businessStatus === "temporarily_closed");
}

section("Freshness: a record whose age nobody knows is not a fresh record");
{
  const now = new Date("2026-09-02T00:00:00.000Z");
  ok("age is null when the source did not say", sourceAgeDays(null, now) === null);
  ok("staleness reports `unknown` rather than 0 days", stalenessOf(null, now).level === "unknown");
  ok("an eleven-year-old record is stale",
    stalenessOf(new Date("2015-09-08T00:00:00.000Z"), now).level === "stale");
  ok("a record from last month is fresh",
    stalenessOf(new Date("2026-08-10T00:00:00.000Z"), now).level === "fresh");
  ok("the boundary is two years", STALE_AFTER_DAYS === 730);
  ok("an unparseable date is unknown, not epoch", stalenessOf("not a date", now).level === "unknown");
  ok("the source's updatedAt is carried onto the prospect",
    shaped().prospect.sourceUpdatedAt instanceof Date);
  ok("a missing updatedAt becomes null, never now()",
    shaped({ sourceUpdatedAt: null }).prospect.sourceUpdatedAt === null);
}

section("Provenance: which source, which record, which release");
{
  const p = shaped({ phones: ["6137956277"] }).prospect;
  ok("the provider is stamped", p.sourceProvider === "overture");
  ok("the record id is stamped", p.sourceRecordId === "gers:1");
  ok("the RELEASE is stamped — provenance is unusable without it", p.sourceRelease === "2026-08-19.0");
  ok("the contributing dataset is stamped", p.sourceDataset === "Microsoft");
  ok("confidence is stored", p.sourceConfidence === 0.0163);
  ok("a row with no record id is refused rather than stored with no provenance",
    shaped({ sourceRecordId: "" }).ok === false);
}

section("Evidence: every ingested fact is citable back to a release");
{
  const s = shaped({ phones: ["6137956277"], websites: ["acme.com"], emails: ["hi@acme.com"] });
  const rows = evidenceRows({
    prospectId: "p1",
    facts: s.facts,
    provider: "overture",
    release: "2026-08-19.0",
    dataset: "Microsoft",
    sourceUrl: placesPathFor("2026-08-19.0"),
    observedAt: new Date("2026-09-02T00:00:00.000Z"),
  });
  ok("every ingested fact produced a row", rows.length === s.facts.length && rows.length >= 4);
  ok("the source is the provider", rows.every((r) => r.source === "overture"));
  ok("the DATASET travels with each fact", rows.every((r) => r.detector === "overture:Microsoft"));
  ok("the RELEASE is the detector version", rows.every((r) => r.detectorVersion === "2026-08-19.0"));
  ok("the sourceUrl points at the release's own places path",
    rows.every((r) => r.sourceUrl === "s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/"));
  const phoneFact = rows.find((r) => r.rawValue === "6137956277");
  ok("the phone fact keeps BOTH spellings — a normalised-only record is unreviewable",
    Boolean(phoneFact) && phoneFact.normalizedValue === "+16137956277");
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Deduplication — deterministic first, fuzzy after, and never a merge
   ═══════════════════════════════════════════════════════════════════════════ */

section("HOSTILE: two rows that are the same business");
{
  const held = {
    id: "existing",
    sourceProvider: "overture",
    sourceRecordId: "gers:1",
    phoneE164: "+16137956277",
    domain: "acme.com",
    businessName: "Acme Painting Inc.",
    city: "Ottawa",
  };
  const index = buildDedupeIndex([held]);

  const sameRecord = matchExisting(
    { sourceProvider: "overture", sourceRecordId: "gers:1", phoneE164: null },
    index,
  );
  ok("the SAME provider record is an update, not a duplicate and not an insert",
    sameRecord.action === "update" && sameRecord.via === "source_record");

  const samePhone = matchExisting(
    { sourceProvider: "overture", sourceRecordId: "gers:2", phoneE164: "6137956277" },
    index,
  );
  ok("a different record with the same phone is FLAGGED, never merged",
    samePhone.action === "flag" && samePhone.via === "phone" && samePhone.matchedId === "existing");

  const sameDomain = matchExisting(
    { sourceProvider: "overture", sourceRecordId: "gers:3", domain: "https://www.acme.com/contact" },
    index,
  );
  ok("a different record with the same domain is flagged",
    sameDomain.action === "flag" && sameDomain.via === "domain");

  const sameName = matchExisting(
    { sourceProvider: "overture", sourceRecordId: "gers:4", businessName: "The Acme Painting Company", city: "ottawa" },
    index,
  );
  ok("the same name in the same town is flagged — fuzzy, and LAST",
    sameName.action === "flag" && sameName.via === "name_locality");

  const otherCity = matchExisting(
    { sourceProvider: "overture", sourceRecordId: "gers:5", businessName: "Acme Painting", city: "Buffalo" },
    index,
  );
  ok("the same name in a DIFFERENT town is a new prospect, not a duplicate",
    otherCity.action === "insert");

  const fresh = matchExisting(
    { sourceProvider: "overture", sourceRecordId: "gers:6", businessName: "Zeta Roofing", city: "Ottawa" },
    index,
  );
  ok("an unrelated business inserts", fresh.action === "insert");

  const keys = dedupeKeys({
    sourceProvider: "overture",
    sourceRecordId: "gers:1",
    phoneE164: "6137956277",
    domain: "www.acme.com",
    businessName: "Acme Painting Inc.",
    city: "Ottawa",
  });
  ok("the deterministic keys come first, in the order the schema comment names",
    keys.map((k) => k.kind).join(",") === "source_record,phone,domain,name_locality");
  ok("nothing in the module merges — the only outcomes are insert, update and flag",
    ["insert", "update", "flag"].includes(fresh.action));
  ok("each flag reason is a sentence a human can act on",
    duplicateReason("phone").length > 10 && duplicateReason("domain") !== duplicateReason("phone"));
}

section("Name keys ignore noise words and word order, and refuse to be empty");
{
  ok("Inc/Ltd/The are dropped", nameKey("The Acme Painting Company Inc.") === nameKey("Acme Painting Ltd"));
  ok("word order does not matter", nameKey("Painting Acme") === nameKey("Acme Painting"));
  ok("a name of nothing but noise words is NULL, not an empty string that matches everything",
    nameKey("The Company Ltd") === null);
  ok("a fuzzy key needs a locality — otherwise every ABC Plumbing collides",
    fuzzyKey({ businessName: "Acme Painting", city: null }) === null);
  ok("markup does not defeat the key", nameKey("<b>Acme</b> Painting") === nameKey("Acme Painting"))
  // Accents FOLD, they do not split the word. Without an NFD pass the
  // [^a-z0-9] filter turns every accented letter into a space, and since the
  // words are then sorted the fragments come back reordered — "Québec" became
  // "bec qu" and "Rénovations Lévis" became "l novations r vis". No French
  // business name matched its own duplicate, which is most of Quebec, much of
  // New Brunswick and a good deal of eastern Ontario, live against the
  // Overture bank. Nothing covered nameKey at all, which is how it survived.
  ok(
    "accented and unaccented spellings are one business",
    nameKey("Québec Rénovations") === nameKey("Quebec Renovations"),
    nameKey("Québec Rénovations"),
  );
  ok(
    "an accent does not split a word into fragments",
    nameKey("Québec") === "quebec",
    nameKey("Québec"),
  );
  ok(
    "...and the noise-word rule still returns null rather than an empty key",
    nameKey("The Company Ltd") === null,
  );;

  // ── French, because RBQ is the biggest bank in this system ──────────────
  //
  // 54,264 Quebec businesses, named in French. The noise-word list was English
  // only, so "Ltée" and "Enr." counted as identity while "Ltd" and "Inc" did
  // not, and the elided articles the apostrophe leaves behind — the bare "l"
  // of "L'Entreprise", the bare "d" of "d'Émile" — counted as words. Two
  // spellings of one Quebec contractor scored as two contractors.
  ok(
    "Ltee and Enr are dropped exactly as Ltd and Inc are",
    nameKey("Rénovations Lévis Ltée") === nameKey("Renovations Levis Inc"),
    nameKey("Rénovations Lévis Ltée"),
  );
  ok(
    "the French article is noise, the same as 'The'",
    nameKey("Les Toitures Beauport") === nameKey("Toitures Beauport"),
  );
  ok(
    "an elided article does not survive as a one-letter word",
    nameKey("L'Atelier d'Émile") === nameKey("Atelier Émile") &&
      nameKey("L'Atelier d'Émile") === "atelier emile",
    nameKey("L'Atelier d'Émile"),
  );
  ok(
    "a French name of nothing but noise is NULL, like its English counterpart",
    nameKey("Les Entreprises Ltée") === null,
  );
  ok(
    "a French identity word is NOT dropped",
    nameKey("Toitures Beauport") !== null &&
      nameKey("Toitures Beauport") !== nameKey("Toitures Lévis"),
  );

  // ── The city half of the fuzzy key ─────────────────────────────────────
  //
  // The accent fix landed in nameKey and stopped there. `fuzzyKey` pasted the
  // city on raw and lowercased, so "Québec" and "Quebec" produced one name key
  // and then two different fuzzy keys — the pair still never met, which is the
  // whole point of the key. Every accented locality in the province was in
  // that state.
  ok(
    "an accented city and its unaccented spelling are one locality",
    fuzzyKey({ businessName: "Toitures Nord", city: "Québec" }) ===
      fuzzyKey({ businessName: "Toitures Nord", city: "Quebec" }),
    fuzzyKey({ businessName: "Toitures Nord", city: "Québec" }),
  );
  ok(
    "St- and Saint- are the same town, because the two registers disagree",
    cityKey("St-Jérôme") === cityKey("Saint-Jerome"),
    cityKey("St-Jérôme"),
  );
  ok(
    "Ste- expands too",
    cityKey("Ste-Foy") === cityKey("Sainte-Foy"),
  );
  ok(
    "hyphens and spaces are the same separator",
    cityKey("Trois-Rivières") === cityKey("Trois Rivieres"),
  );
  ok(
    "word ORDER still separates two localities that share words",
    cityKey("Saint-Jean-sur-Richelieu") !== cityKey("Richelieu sur Jean Saint"),
  );
  ok(
    "two genuinely different towns keep different keys",
    cityKey("Lévis") !== cityKey("Laval"),
  );
  ok(
    "a city of nothing but punctuation is NULL, not an empty key everything shares",
    cityKey("  -- ") === null && cityKey(null) === null,
  );
  ok(
    "...and a null city still refuses to build a fuzzy key",
    fuzzyKey({ businessName: "Toitures Nord", city: "  -- " }) === null,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The funnel — the numbers reconcile, or the screen says they do not
   ═══════════════════════════════════════════════════════════════════════════ */

section("A page of hostile rows: the outcomes AND the counters, together");
{
  const rows = [
    // 1. a retailer that looks like a contractor
    { ...base, sourceRecordId: "r1", name: "Benjamin Moore" },
    // 2. no phone
    { ...base, sourceRecordId: "r2", name: "Quiet Painting", phones: [] },
    // 3. a bare-digit phone
    { ...base, sourceRecordId: "r3", name: "Oasis Painting", phones: ["6137956277"] },
    // 4. an international number
    { ...base, sourceRecordId: "r4", name: "London Decorators", phones: ["+44 20 7946 0958"] },
    // 5. the same business again, under a different record id
    { ...base, sourceRecordId: "r5", name: "Oasis Painting Inc", phones: ["+1 613 795 6277"] },
    // 6. a null operating_status
    { ...base, sourceRecordId: "r6", name: "Silent Status Painting", phones: ["6135550001"], operatingStatus: null },
    // 7. an unmapped category
    { ...base, sourceRecordId: "r7", name: "Ink & Needle", categories: { primary: "tattoo_parlour", alternate: [] } },
    // 8. a name that is markup
    { ...base, sourceRecordId: "r8", name: "<b>Markup &amp; Sons Painting</b>", phones: ["6135550002"] },
    // 9. a different trade — a single-trade queue is the point
    { ...base, sourceRecordId: "r9", name: "Reliable Roofing", categories: { primary: "roofing", alternate: [] } },
    // 10. no record id at all
    { ...base, sourceRecordId: "", name: "Nameless Provenance" },
    // 11. a showroom — genuinely both
    {
      ...base,
      sourceRecordId: "r11",
      name: "Allwood Flooring Painting",
      categories: { primary: "painting", alternate: ["flooring_store", "retail"] },
      phones: ["6135550003"],
    },
    // 12. no website listed
    { ...base, sourceRecordId: "r12", name: "Offline Painting", phones: ["6135550004"], websites: [] },
  ];

  const index = buildDedupeIndex([]);
  const { plans, counters } = planIngest(
    rows,
    { provider: "overture", release: "2026-08-19.0", tradeKey: "painting", campaignId: "c1", territoryId: "t1" },
    index,
  );
  const byId = (id) => plans.find((p) => p.business?.sourceRecordId === id);

  ok("the retailer is rejected and NOT written", byId("r1").action === "skip" && byId("r1").reason === "retailer");
  ok("the phoneless row is still written", byId("r2").action === "insert");
  ok("the bare-digit phone became E.164", byId("r3").row.phoneE164 === "+16137956277");
  ok("the London number kept its country code", byId("r4").row.phoneE164 === "+442079460958");
  ok("the second copy of one business is written and FLAGGED, not merged away",
    byId("r5").action === "insert" && byId("r5").row.possibleDuplicateOfId === byId("r3").id);
  ok("...and it is flagged via the phone, the strongest deterministic key it shares",
    byId("r5").duplicateVia === "phone");
  ok("the null operating_status is stored as null", byId("r6").row.businessStatus === null);
  // INVERTED 2026-09-03, when the bank and the queue stopped being one
  // condition. The old assertion here read `action === "skip"`, which encoded
  // the behaviour the RBQ register made untenable: a row whose category maps
  // to no trade was thrown away entirely. It is now WRITTEN with a null trade
  // — and the half that must never change is asserted beside it, because that
  // is the half a rep feels: no trade key, so claimCandidateWhere() can never
  // hand it to anybody, and not counted as accepted.
  ok("the unmapped category is written to the bank rather than thrown away",
    byId("r7").action === "insert");
  ok("...with NO trade — never guessed into the nearest one",
    byId("r7").row.tradeKey === null);
  ok("...and it is not counted as accepted, so it cannot fill a campaign's target",
    counters.bankedCount === 1);
  ok("the markup name is cleaned before storage",
    byId("r8").row.businessName === "Markup & Sons Painting");
  ok("a different trade is skipped so the queue stays single-trade",
    byId("r9").action === "skip" && byId("r9").reason === "other_trade");
  ok("a row with no provenance is refused", byId("").action === "skip" && byId("").reason === "malformed");
  ok("the showroom is written but held OUT of the queue",
    byId("r11").action === "insert" && byId("r11").row.status === "needs_review");
  ok("...and it is not counted as accepted", byId("r11").verdict.classification === "needs_review");
  ok("the row with no website is accepted — no website is a signal, not a disqualifier",
    byId("r12").action === "insert" && byId("r12").row.status === "discovered");
  ok("...and hasWebsite is NULL rather than a false invented from an empty column",
    byId("r12").row.hasWebsite === null);

  ok("found counts every row the provider returned", counters.foundCount === rows.length);
  ok("THE FUNNEL RECONCILES", funnelProblems(counters).length === 0, JSON.stringify(counters));
  ok("exactly one row was rejected as a shop", counters.rejectedCount === 1);
  ok("exactly one row needs review", counters.needsReviewCount === 1);
  ok("three rows were unusable for this campaign", counters.unmappedCount === 3);
  ok("ready-to-call never exceeds accepted", counters.readyCount <= counters.acceptedCount);
  ok("no-website never exceeds accepted", counters.noWebsiteCount <= counters.acceptedCount);
  ok("every insert carries the campaign and the territory",
    plans.filter((p) => p.action === "insert").every((p) => p.row.campaignId === "c1" && p.row.territoryId === "t1"));
  ok("every insert carries the release",
    plans.filter((p) => p.action === "insert").every((p) => p.row.sourceRelease === "2026-08-19.0"));
}

section("The page dedupes against ITSELF — one snapshot, one business, twice");
{
  const twice = [
    { ...base, sourceRecordId: "a", name: "Twice Painting", phones: ["6135550009"] },
    { ...base, sourceRecordId: "b", name: "Twice Painting Inc", phones: ["613 555 0009"] },
  ];
  const { plans } = planIngest(twice, { provider: "overture", tradeKey: "painting" }, buildDedupeIndex([]));
  ok("the second is flagged against the first, inside one page",
    plans[1].action === "insert" && plans[1].row.possibleDuplicateOfId === plans[0].id);
}

section("The same source record twice is an UPDATE, and is counted as a duplicate");
{
  const held = [{ id: "old", sourceProvider: "overture", sourceRecordId: "gers:1", phoneE164: null, domain: null, businessName: "Acme Painting", city: "Ottawa" }];
  const { plans, counters } = planIngest(
    [{ ...base, sourceRecordId: "gers:1", phones: ["6135550010"] }],
    { provider: "overture", tradeKey: "painting" },
    buildDedupeIndex(held),
  );
  ok("it updates the row we already hold", plans[0].action === "update" && plans[0].id === "old");
  ok("it counts as a duplicate removed, not as accepted",
    counters.duplicateCount === 1 && counters.acceptedCount === 0);
  ok("the funnel still reconciles", funnelProblems(counters).length === 0);
}

section("The funnel's own arithmetic, and what it refuses to claim");
{
  const good = {
    foundCount: 100, unmappedCount: 10, duplicateCount: 5, rejectedCount: 4,
    needsReviewCount: 6, acceptedCount: 75, readyCount: 70, noWebsiteCount: 8,
  };
  ok("a consistent funnel has no problems", funnelProblems(good).length === 0);
  ok("a funnel whose stages do not sum is REPORTED",
    funnelProblems({ ...good, acceptedCount: 60 }).some((p) => /stages total/.test(p)));
  ok("more ready than accepted is reported", funnelProblems({ ...good, readyCount: 999 }).length > 0);
  ok("more no-website than accepted is reported", funnelProblems({ ...good, noWebsiteCount: 999 }).length > 0);

  const rows = funnelRows(good);
  const noWebsite = rows.find((r) => r.key === "noWebsite");
  ok("the no-website line says LISTED BY THE SOURCE, not 'has no website'",
    /listed by the source/i.test(noWebsite.label));
  ok("...and its note refuses the stronger claim outright",
    /only a crawl can make|not the same claim/i.test(noWebsite.note));
  ok("subsets are marked as subsets so a screen cannot subtract them",
    noWebsite.kind === "subset" && rows.find((r) => r.key === "ready").kind === "subset");
  ok("the six §56 stages are all present",
    ["found", "duplicates", "accepted", "noWebsite", "ready", "needsReview"].every((k) =>
      rows.some((r) => r.key === k)));
  ok("garbage counters do not throw", funnelRows(null).every((r) => r.value === 0));
  ok("a negative counter is floored rather than rendered",
    funnelRows({ foundCount: -5 }).find((r) => r.key === "found").value === 0);
}

section("Progress is measured against ACCEPTED, so paint stores never count");
{
  ok("62 of 100 is 62%", campaignProgress({ targetCount: 100, acceptedCount: 62 }).percent === 62);
  ok("over-target caps at 100%", campaignProgress({ targetCount: 100, acceptedCount: 500 }).percent === 100);
  ok("no target means no percentage, not 0%", campaignProgress({ targetCount: 0, acceptedCount: 5 }).percent === null);
}

section("Stopping: three different reasons, never one 'finished'");
{
  ok("target reached", discoveryStopReason({ status: "running", targetCount: 10, acceptedCount: 10 }, { nextCursor: "5" }) === "target_reached");
  ok("the source ran out — a DIFFERENT state from success",
    discoveryStopReason({ status: "running", targetCount: 100, acceptedCount: 3 }, { nextCursor: null }) === "source_ended");
  ok("a paused campaign stops even mid-page",
    discoveryStopReason({ status: "paused", targetCount: 100, acceptedCount: 3 }, { nextCursor: "5" }) === "paused");
  ok("a running campaign with more to read does not stop",
    discoveryStopReason({ status: "running", targetCount: 100, acceptedCount: 3 }, { nextCursor: "5" }) === null);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Overture: the release, the snapshot, and the trap in `sources`
   ═══════════════════════════════════════════════════════════════════════════ */

section("The current release is looked up, not hard-coded");
{
  const listing =
    `<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated>` +
    `<CommonPrefixes><Prefix>release/2026-07-22.0/</Prefix></CommonPrefixes>` +
    `<CommonPrefixes><Prefix>release/2026-08-19.0/</Prefix></CommonPrefixes></ListBucketResult>`;
  ok("the newest release wins", newestRelease(listing) === "2026-08-19.0");
  ok("releases come back sorted oldest first",
    JSON.stringify(parseReleaseListing(listing).releases) === JSON.stringify(["2026-07-22.0", "2026-08-19.0"]));

  const withBeta = listing.replace("</ListBucketResult>", "<CommonPrefixes><Prefix>release/2026-09-01.0-beta/</Prefix></CommonPrefixes></ListBucketResult>");
  ok("a beta prefix is REJECTED rather than chosen as newest", newestRelease(withBeta) === "2026-08-19.0");
  ok("...and the rejection is reported so nobody wonders why", parseReleaseListing(withBeta).rejected.length === 1);

  const truncated = listing.replace("<IsTruncated>false", "<IsTruncated>true");
  ok("a TRUNCATED listing yields null, not the newest of page one", newestRelease(truncated) === null);
  ok("an HTML error page yields null", newestRelease("<html><body>403</body></html>") === null);
  ok("an empty body yields null", newestRelease("") === null);
  ok("garbage does not throw", parseReleaseListing(null).releases.length === 0);

  ok("a release name is strict", isReleaseName("2026-08-19.0") && !isReleaseName("2026-08-19") && !isReleaseName("latest"));
  ok("the places path is built from the release",
    placesPathFor("2026-08-19.0") === "s3://overturemaps-us-west-2/release/2026-08-19.0/theme=places/type=place/");
  ok("a bad release yields no path", placesPathFor("latest") === null);
}

section("The snapshot manifest is checked at line 1, before a single row is read");
{
  const manifest = { fieldquoSnapshot: SNAPSHOT_FORMAT, provider: "overture", release: "2026-08-19.0", count: 2 };
  const body = [JSON.stringify(manifest), JSON.stringify({ id: "a" }), JSON.stringify({ id: "b" })].join("\n");
  const good = readSnapshot(body);
  ok("a good snapshot reads cleanly", good.problems.length === 0 && good.rows.length === 2);

  ok("a snapshot from an unknown format is refused",
    manifestProblems({ ...manifest, fieldquoSnapshot: 99 }).length === 1);
  ok("a snapshot for another provider is refused",
    manifestProblems({ ...manifest, provider: "google" }).length === 1);
  ok("a snapshot with no valid release is refused — provenance would be unusable",
    manifestProblems({ ...manifest, release: "latest" }).length === 1);
  ok("a manifest that is not an object is refused", manifestProblems("nope").length === 1);

  const truncated = readSnapshot([JSON.stringify(manifest), JSON.stringify({ id: "a" })].join("\n"));
  ok("A TRUNCATED DOWNLOAD IS CAUGHT — otherwise a half city looks like a small one",
    truncated.problems.some((p) => /truncated/i.test(p)));

  const oneBadRow = readSnapshot(
    [JSON.stringify({ ...manifest, count: 3 }), JSON.stringify({ id: "a" }), "{not json", JSON.stringify({ id: "c" })].join("\n"),
  );
  ok("one malformed row costs one business, not the whole file",
    oneBadRow.problems.length === 0 && oneBadRow.rows.length === 2 && oneBadRow.unreadable === 1);
  ok("an empty file is refused", readSnapshot("").problems.length === 1);
  ok("a first line that is not JSON is refused", readSnapshot("hello\n{}").problems.length === 1);
}

section("THE FRESHNESS TRAP: Overture stamps every row with its own build date");
{
  // The real shape, copied off the real release. The second entry is Overture's
  // own derived-property source and its update_time is the RELEASE BUILD DATE.
  const row = {
    id: "gers:x",
    name: "Eco Painting Plus",
    cat_primary: "painting",
    cat_alternate: [],
    tax_hierarchy: painterHierarchy,
    confidence: 0.966,
    operating_status: null,
    phones: ["6136272525"],
    websites: [],
    emails: [],
    addresses: [{ freeform: "A-2 36 flora", locality: "Ottawa", region: "ON", postcode: "K2P 1A7", country: "CA" }],
    sources: [
      { property: "", dataset: "Microsoft", record_id: "m1", update_time: "2015-09-08T00:00:00.000" },
      { property: "/properties/confidence", dataset: "Overture", record_id: null, update_time: "2026-08-14T19:46:07Z" },
    ],
    lat: 45.41,
    lon: -75.69,
  };
  const business = toDiscoveredBusiness(row, "2026-08-19.0");
  ok("an eleven-year-old record reports 2015, NOT the release build date",
    business.sourceUpdatedAt.startsWith("2015-09-08"), business.sourceUpdatedAt);
  ok("the dataset is the contributor, not 'Overture'", business.sourceDataset === "Microsoft");
  ok("...so the rep is warned it is stale",
    stalenessOf(new Date(business.sourceUpdatedAt), new Date("2026-09-02T00:00:00.000Z")).level === "stale");

  const twoRecords = toDiscoveredBusiness(
    { ...row, sources: [
      { property: "", dataset: "Microsoft", update_time: "2015-09-08T00:00:00.000" },
      { property: "", dataset: "meta", update_time: "2026-08-10T00:00:00.000Z" },
      { property: "/properties/confidence", dataset: "Overture", update_time: "2026-08-14T19:46:07Z" },
    ] },
    "2026-08-19.0",
  );
  ok("among REAL sources the newest still wins", twoRecords.sourceUpdatedAt.startsWith("2026-08-10"));
  ok("...and the dataset follows the newest real source", twoRecords.sourceDataset === "meta");

  const noTimes = toDiscoveredBusiness(
    { ...row, sources: [
      // The derived entry FIRST, deliberately: with it second, a fallback of
      // `sources[0]` still landed on the real contributor and the rule passed
      // with the filter removed. Found by mutation testing.
      { property: "/properties/confidence", dataset: "Overture", update_time: "2026-08-14T19:46:07Z" },
      { property: "", dataset: "Foursquare", record_id: "f1" },
    ] },
    "2026-08-19.0",
  );
  // The FALLBACK path, which the newest-source path hides. Without this the
  // dataset could fall back to sources[0] — Overture's own derived entry — and
  // every prospect would report its contributor as "Overture". Found by
  // mutation testing.
  ok("with no dated record source, the dataset still comes from a REAL contributor",
    noTimes.sourceDataset === "Foursquare");
  ok("...and the date stays null rather than borrowing the derived one",
    noTimes.sourceUpdatedAt === null);

  const onlyDerived = toDiscoveredBusiness(
    { ...row, sources: [{ property: "/properties/confidence", dataset: "Overture", update_time: "2026-08-14T19:46:07Z" }] },
    "2026-08-19.0",
  );
  ok("a row with ONLY a derived source reports null, never the build date",
    onlyDerived.sourceUpdatedAt === null);

  ok("a null operating_status survives the mapping as null", business.operatingStatus === null);
  ok("the row's confidence is carried", business.sourceConfidence === 0.966);
  ok("no sources at all does not throw",
    toDiscoveredBusiness({ ...row, sources: null }, "2026-08-19.0").sourceUpdatedAt === null);
  ok("no addresses at all does not throw",
    toDiscoveredBusiness({ ...row, addresses: null }, "2026-08-19.0").address.city === null);
}

section("The territory filter — every part optional, and a radius is all-or-nothing");
{
  const ottawa = { latitude: 45.4215, longitude: -75.6972, address: { city: "Ottawa", province: "ON", country: "CA" } };
  const toronto = { latitude: 43.6532, longitude: -79.3832, address: { city: "Toronto", province: "ON", country: "CA" } };
  const noCoords = { latitude: null, longitude: null, address: { city: "Ottawa", province: "ON", country: "CA" } };

  ok("no territory matches everything", inTerritory(ottawa, null, { haversineKm }));
  ok("a country-only territory matches", inTerritory(ottawa, { country: "CA" }, { haversineKm }));
  ok("a country-only territory excludes another country",
    !inTerritory(ottawa, { country: "US" }, { haversineKm }));
  ok("the city match is case-insensitive", inTerritory(ottawa, { city: "ottawa" }, { haversineKm }));
  ok("a radius keeps what is inside it",
    inTerritory(ottawa, { centerLat: 45.4215, centerLng: -75.6972, radiusKm: 25 }, { haversineKm }));
  ok("a radius drops what is outside it",
    !inTerritory(toronto, { centerLat: 45.4215, centerLng: -75.6972, radiusKm: 25 }, { haversineKm }));
  ok("a radius territory EXCLUDES a row with no coordinates — the conservative direction",
    !inTerritory(noCoords, { centerLat: 45.4215, centerLng: -75.6972, radiusKm: 25 }, { haversineKm }));
  // Asserted with NO distance function injected as well. With haversineKm
  // present, its own hasPoint() guard already returns null for a coordinate-
  // less row — so deleting the explicit guard here still passed. Found by
  // mutation testing.
  ok("...even with no distance function to fall back on",
    !inTerritory(noCoords, { centerLat: 45.4215, centerLng: -75.6972, radiusKm: 25 }, {}));
  ok("a city territory still keeps a row with no coordinates",
    inTerritory(noCoords, { city: "Ottawa" }, { haversineKm }));
  ok("a cursor that is not a number starts at zero rather than NaN", parseCursor("nonsense") === 0);
  ok("a negative cursor starts at zero", parseCursor("-5") === 0);
}

section("Provider config: a campaign that cannot run says so, and shows no Start");
{
  ok("no snapshot URL is refused", overtureProvider.describeConfig({}).ok === false);
  ok("...with a sentence naming the missing thing",
    /snapshot/i.test(overtureProvider.describeConfig({}).problems.join(" ")));
  ok("an s3:// URL is refused, because that is the obvious wrong paste",
    overtureProvider.describeConfig({ snapshotUrl: "s3://bucket/file.ndjson" }).ok === false);
  ok("a nonsense string is refused", overtureProvider.describeConfig({ snapshotUrl: "not a url" }).ok === false);
  ok("an https URL is accepted",
    overtureProvider.describeConfig({ snapshotUrl: "https://example.com/ottawa.ndjson" }).ok === true);
  ok("the summary never leaks a query string",
    !overtureProvider.describeConfig({ snapshotUrl: "https://example.com/x.ndjson?sig=SECRET" }).summary.includes("SECRET"));
}

section("The provider interface: another provider is addable without touching the pipeline");
{
  ok("overture is registered under its own key", getDiscoveryProvider("overture") === overtureProvider);
  ok("an unknown key returns null rather than a default", getDiscoveryProvider("google") === null);
  ok("...and null specifically, so the handler can refuse by name",
    getDiscoveryProvider(undefined) === null && getDiscoveryProvider("") === null);

  ok("shape problems are caught before ingest", shapeProblems({}).includes("no_source_record_id"));
  ok("a non-object is caught", shapeProblems(null).includes("not_an_object"));
  ok("a non-array phones list is caught", shapeProblems({ sourceRecordId: "x", phones: "555" }).includes("bad_phones"));
  ok("a well-formed row has no problems",
    shapeProblems({ sourceRecordId: "x", phones: [], websites: [], emails: [], taxonomyHierarchy: [] }).length === 0);

  // A second provider, registered and resolved, with nothing in the pipeline
  // changed. This is spec §62's requirement made into a measurement.
  const before = Boolean(getDiscoveryProvider("overture"));
  registerDiscoveryProvider({
    key: "fixture_directory",
    label: "Fixture",
    description: "test only",
    configFields: [],
    // Required since sources became a set: several can be ticked at once, so
    // each has to say what ticking it costs. scripts/check-campaign-sources.mjs
    // is where that requirement is asserted; here it is just satisfied.
    licence: { name: "Fixture licence", url: "https://example.test/licence", obligation: "test only" },
    describeConfig: () => ({ ok: true, problems: [], summary: "fixture" }),
    fetchPage: async () => ({ release: null, businesses: [], nextCursor: null }),
  });
  ok("a second provider registers and resolves", Boolean(getDiscoveryProvider("fixture_directory")) && before);
  let threw = false;
  try {
    registerDiscoveryProvider({
      key: "fixture_directory",
      label: "Fixture again",
      describeConfig: () => ({ ok: true, problems: [], summary: "" }),
      fetchPage: async () => ({}),
    });
  } catch {
    threw = true;
  }
  ok("a SECOND registration under one key throws — import order must not decide behaviour", threw);

  let missingMethod = false;
  try {
    registerDiscoveryProvider({ key: "half_built", label: "Half", describeConfig: () => ({ ok: true }) });
  } catch {
    missingMethod = true;
  }
  ok("a provider with no fetchPage is refused at registration", missingMethod);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. Source rules — each scoped to ONE brace-matched function
   ═══════════════════════════════════════════════════════════════════════════ */

section("classifyBusiness: retailer before contractor, ambiguity before contractor");
{
  const body = fnBody(read("lib/sales/discovery/classify.js"), "classifyBusiness");
  ok("classifyBusiness extracted", body !== null);
  if (body) {
    const code = stripComments(body);
    const retailerAt = code.indexOf('classification: "retailer"');
    const reviewAt = code.indexOf('classification: "needs_review"');
    const contractorAt = code.indexOf('classification: "contractor"');
    ok("a retailer verdict is reached before a contractor verdict", retailerAt >= 0 && retailerAt < contractorAt);
    ok("a needs_review verdict is reached before a contractor verdict", reviewAt >= 0 && reviewAt < contractorAt);
    ok("the LAST word is needs_review, never contractor",
      code.lastIndexOf('classification: "needs_review"') > code.lastIndexOf('classification: "contractor"'));
  }
}

section("normaliseBusiness: nothing invents a website, a status or a date");
{
  const body = fnBody(read("lib/sales/discovery/normalise.js"), "normaliseBusiness");
  ok("normaliseBusiness extracted", body !== null);
  if (body) {
    const code = mask(body);
    ok("hasWebsite is never set to a bare false", !/hasWebsite:\s*false/.test(code));
    ok("businessStatus is never defaulted to a string", !/businessStatus:\s*["'`]/.test(code));
    ok("sourceUpdatedAt is never new Date() with no argument", !/sourceUpdatedAt:\s*new Date\(\s*\)/.test(code));
    ok("it reuses the shared phone normaliser rather than a regex of its own",
      /normalisePhone\s*\(/.test(code) && !/replace\(\/\\D\//.test(code));
  }
  const file = mask(read("lib/sales/discovery/normalise.js"));
  ok("the module imports toE164's wrapper from suppressionRules, not a second copy",
    /from "@\/lib\/sales\/suppressionRules"/.test(read("lib/sales/discovery/normalise.js")));
  ok("no second phone normaliser is defined in this module",
    !/function\s+\w*[Tt]oE164/.test(file));
}

section("planIngest: confidence is stored and NEVER gated on");
{
  const body = fnBody(read("lib/sales/discovery/ingest.js"), "planIngest");
  ok("planIngest extracted", body !== null);
  if (body) {
    const code = mask(body);
    ok("nothing in the plan compares a confidence", !/[Cc]onfidence\s*[<>]/.test(code));
    ok("nothing filters on confidence at all", !/sourceConfidence\s*[<>=!]/.test(code));
    ok("the classifier decides before the row is shaped",
      code.indexOf("classifyBusiness") < code.indexOf("normaliseBusiness"));
    ok("a retailer is skipped rather than written",
      /classification === "retailer"[\s\S]{0,200}action: "skip"/.test(stripComments(body)));
  }
  const whole = mask(read("lib/sales/discovery/ingest.js"));
  ok("no WHERE clause anywhere in the ingest names confidence", !/sourceConfidence:\s*\{/.test(whole));
}

section("ingestPage: prospects, evidence and counters move together");
{
  const body = fnBody(read("lib/sales/discovery/ingest.js"), "ingestPage");
  ok("ingestPage extracted", body !== null);
  if (body) {
    const code = mask(body);
    ok("the writes are inside a transaction", /\$transaction\s*\(/.test(code));
    const tx = code.indexOf("$transaction");
    ok("the prospects are created inside it", code.indexOf("prospect.createMany") > tx);
    ok("the evidence is created inside it", code.indexOf("prospectEvidence.createMany") > tx);
    // On `tx`, not on `prisma`. "appears after the word $transaction" passed
    // with the update moved out of the callback entirely, because the string
    // was still later in the file. Found by mutation testing.
    ok("the counters move on the TRANSACTION client, not the outer one",
      /tx\.prospectCampaign\.update/.test(code) && !/prisma\.prospectCampaign\.update/.test(code.slice(tx)));
    ok("skipDuplicates is NOT used — it would count a row as accepted that was never written",
      !/skipDuplicates/.test(code));
    ok("the update path does not spread the whole shaped row over a human's correction",
      !/data:\s*\{\s*\.\.\.plan\.prospect/.test(code));
  }
}

section("incrementsFrom: counters move by increment, never by read-then-write");
{
  const body = fnBody(read("lib/sales/discovery/ingest.js"), "incrementsFrom");
  ok("incrementsFrom extracted", body !== null);
  if (body) {
    ok("it emits Prisma increments", /increment:/.test(mask(body)));
    ok("it never assigns a plain number", !/=\s*value\s*;/.test(mask(body)));
  }
}

section("runDiscoverBusinesses: the campaign's status is re-read at run time");
{
  const src = read("lib/sales/pipeline/handlers/discoverBusinesses.js");
  const body = fnBody(src, "runDiscoverBusinesses");
  ok("runDiscoverBusinesses extracted", body !== null);
  if (body) {
    const code = stripComments(body);
    ok("the campaign is loaded from the database, not read off the payload",
      /prospectCampaign\.findUnique/.test(code));
    ok("the status gate uses the loaded row", /RUNNABLE_STATUSES\.includes\(campaign\.status\)/.test(code));
    // Rewritten when a campaign gained a SET of sources. The three rules are
    // the same three decisions, asked of one source inside the loop rather
    // than of the campaign as a whole. Behaviour is asserted by execution in
    // scripts/check-campaign-sources.mjs; these stay positional, on the
    // shipped file, because a source rule catches the edit that deletes a
    // branch outright.
    ok("a source this build does not ship is BLOCKED, not retried for six hours",
      /if \(!provider\)[\s\S]{0,300}block\(/.test(code));
    ok("a transport failure keeps the cursor and counts against that source",
      /page\?\.error[\s\S]{0,400}failures:\s*count/.test(code));
    ok("...and a page on which NOTHING ran is retryable, as it was with one source",
      /!ingested && failures\.length[\s\S]{0,300}retry:\s*retryable/.test(code));
    ok("the next page is enqueued", /enqueuePipelineTask/.test(code));
    ok("...keyed on where EVERY source got to, so a double finish queues one task",
      /idempotencyKey:\s*`discover:\$\{campaign\.id\}:\$\{cursorFingerprint\(merged\)\}`/.test(code));
    ok("nothing reports done:true on an empty result without saying why",
      !/businesses\.length === 0[\s\S]{0,80}done:\s*true/.test(code));
  }
  ok("the handler is registered under DISCOVER_BUSINESSES", /registerHandler\("DISCOVER_BUSINESSES"/.test(stripComments(src)));
}

section("The handler is actually WIRED — a stage nobody imports never registers");
{
  const index = read("lib/sales/pipeline/handlers/index.js");
  ok("handlers/index.js imports the module", /import "\.\/discoverBusinesses";/.test(stripComments(index)));
  ok("...and names it in HANDLER_MODULES, so a check can see it", /"DISCOVER_BUSINESSES"/.test(index));
  const providers = read("lib/sales/discovery/providers.js");
  ok("providers.js imports the overture provider for its side effect",
    /import "\.\/overture\/provider";/.test(stripComments(providers)));
}

section("The Start button ENQUEUES — a status change alone is a dead control");
{
  const src = read("app/api/platform/sales/campaigns/[id]/route.js");
  const body = fnBody(src, "PATCH");
  ok("PATCH extracted", body !== null);
  if (body) {
    const code = stripComments(body);
    const startAt = code.indexOf('action === "start"');
    ok("there is a start branch", startAt >= 0);
    const running = code.indexOf('status: "running"', startAt);
    const enqueue = code.indexOf("enqueuePipelineTask", startAt);
    ok("STARTING ENQUEUES A TASK — not just a status column", enqueue > startAt);
    ok("...in the same transaction as the status change",
      running > startAt && Math.abs(enqueue - running) < 1200 && /\$transaction/.test(code.slice(startAt, enqueue)));
    // `>= 0` is load-bearing. Without it, DELETING the config check makes
    // indexOf return -1, and -1 is less than anything — so removing the guard
    // passed the rule that exists to require it. Found by mutation testing.
    const configAt = code.indexOf("startProblems", startAt);
    ok("a campaign whose sources cannot run is refused before the status moves",
      configAt >= 0 && configAt < running);
  }
  // Scoped to PATCH. Asserting over the whole file passed while PATCH read
  // params synchronously, because GET awaited its own copy — the exact
  // "a string elsewhere in the file" false pass this project has hit five
  // times. Found by mutation testing.
  ok("PATCH awaits params — it is a Promise in Next 16",
    body !== null && /const \{ id \} = await params;/.test(body));
  ok("GET awaits params too", /const \{ id \} = await params;/.test(fnBody(src, "GET") || ""));
}

section("The review route decides, and moves the counters with the row");
{
  const src = read("app/api/platform/sales/campaigns/[id]/review/route.js");
  const body = fnBody(src, "POST");
  ok("POST extracted", body !== null);
  if (body) {
    const code = stripComments(body);
    ok("it refuses a row somebody else already reviewed",
      /prospect\.status !== "needs_review"/.test(code));
    // BOTH branches. Guarding only the accept path still let two reviewers
    // both reject one row and decrement the counter twice, and the
    // single-occurrence rule passed on the surviving guard in the other
    // branch. Found by mutation testing.
    ok("BOTH updates are guarded on the status that was read, not on the id alone",
      (code.match(/where:\s*\{\s*id:\s*prospect\.id,\s*status:\s*"needs_review"\s*\}/g) || []).length === 2);
    // `\b` before the name: an unanchored match also matched a renamed
    // `__doNotContactAt`, so the field could be disabled without the rule
    // noticing. Found by mutation testing.
    ok("a rejection does NOT delete — it sets doNotContactAt, which survives every transition",
      /\bdoNotContactAt:/.test(code) && /\bdoNotContactReason:/.test(code) && !/prospect\.delete/.test(code));
    ok("the counters move in the same transaction as the row", /\$transaction/.test(code));
    ok("needsReviewCount decrements on both decisions",
      (code.match(/needsReviewCount:\s*\{\s*decrement:\s*1\s*\}/g) || []).length === 2);
  }
  ok("params is awaited", /const \{ id \} = await params;/.test(src));
}

section("The campaign screens render nothing that does not work");
{
  const list = read("app/platform/sales/campaigns/page.js");
  const detail = read("app/platform/sales/campaigns/[id]/page.js");
  // Nothing preticked and nothing preselected. The form is checkboxes now —
  // several sources at once — so the rule is about the initial SET being
  // empty, and about no box arriving checked by default.
  ok("the create form ticks no source by default — choosing one is choosing a licence",
    /discoverySources: \[\]/.test(list) && !/defaultChecked/.test(list) && !/defaultValue="overture"/.test(list));
  ok("the list says outright that a territory console is not built",
    /not built yet/.test(list));
  ok("the detail screen hides Start when a source cannot run, rather than failing on click",
    /startProblems\.length \? null : \(/.test(detail));
  ok("the detail screen surfaces a funnel that does not reconcile",
    /funnelProblems/.test(detail) && /do not reconcile/.test(detail));
  ok("both screens use fetchJson, so a failed request cannot be swallowed",
    /fetchJson/.test(list) && /fetchJson/.test(detail));
  ok("neither screen renders a raw <table> a phone cannot scroll",
    !/<table/.test(list) && !/<table/.test(detail));
}

section("DuckDB's absence from the runtime is a decision, written down");
{
  const snapshot = read("lib/sales/discovery/overture/snapshot.js");
  ok("the reason DuckDB cannot run in a function is recorded in the file that replaces it",
    /cannot run inside a Vercel function/i.test(snapshot) || /CANNOT run inside a Vercel function/i.test(snapshot));
  const pkg = JSON.parse(read("package.json"));
  ok("no DuckDB dependency entered package.json",
    !Object.keys(pkg.dependencies || {}).some((d) => /duckdb/i.test(d)) &&
      !Object.keys(pkg.devDependencies || {}).some((d) => /duckdb/i.test(d)));
  ok("the offline extractor is wired as an npm script", Boolean(pkg.scripts["overture:snapshot"]));
  ok("this check is wired into check:all", /check:sales-discovery/.test(pkg.scripts["check:all"] || ""));
  const extractor = read("scripts/overture-snapshot.mjs");
  // stripComments, not mask: a hard-coded release would BE a string literal,
  // and mask blanks string literals — so the rule that exists to forbid one
  // could never see it. Found by mutation testing.
  ok("the extractor looks up the current release rather than hard-coding one",
    /fetchCurrentRelease/.test(extractor) && !/["']\d{4}-\d{2}-\d{2}\.\d+["']/.test(stripComments(extractor)));
  ok("the extractor takes its categories from the trade map rather than a copy",
    /mappedSourceCategories|DISCOVERY_TRADES\[trade\]\.sourceCategories/.test(stripComments(extractor)));
}

section("The schema carries the provenance the evidence trail depends on");
{
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model Prospect {"));
  const body = model.slice(0, model.indexOf("\n}\n"));
  for (const field of [
    "sourceProvider",
    "sourceRecordId",
    "sourceRelease",
    "sourceDataset",
    "sourceConfidence",
    "sourceUpdatedAt",
    "classification",
  ]) {
    ok(`Prospect.${field} exists`, new RegExp(`\\n\\s+${field}\\s`).test(body));
  }
  ok("(sourceProvider, sourceRecordId) is UNIQUE — the database is the dedupe guarantee",
    /@@unique\(\[sourceProvider, sourceRecordId\]\)/.test(body));

  const campaign = schema.slice(schema.indexOf("model ProspectCampaign {"));
  const campaignBody = campaign.slice(0, campaign.indexOf("\n}\n"));
  for (const field of ["providerConfig", "discoveryCursor", "rejectedCount", "noWebsiteCount", "unmappedCount"]) {
    ok(`ProspectCampaign.${field} exists`, new RegExp(`\\n\\s+${field}\\s`).test(campaignBody));
  }
  ok("discoveryProvider still has no default", !/discoveryProvider\s+String\?\s*@default/.test(campaignBody));
}

section("Every column this feature writes is READ by something");
{
  const readers = ["lib", "app", "scripts"]
    .flatMap((dir) => walk(path.join(ROOT, dir)))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  for (const field of [
    "sourceRelease",
    "sourceDataset",
    "sourceUpdatedAt",
    "sourceConfidence",
    "classification",
    "classificationReason",
    "possibleDuplicateOfId",
    "discoveryCursor",
    "rejectedCount",
    "noWebsiteCount",
    "unmappedCount",
    "providerConfig",
  ]) {
    // Written once and read somewhere else: at least two mentions outside the
    // schema. One mention is a column nothing consumes — AGENTS.md's first
    // recurring failure class.
    const uses = (readers.match(new RegExp(`\\b${field}\\b`, "g")) || []).length;
    ok(`${field} is used in more than one place`, uses >= 2, `${uses} use(s)`);
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

__resetDiscoveryProvidersForTests();

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
process.exit(failures ? 1 : 0);
