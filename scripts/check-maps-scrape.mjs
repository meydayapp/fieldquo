// scripts/check-maps-scrape.mjs
//
// The Google Maps scrape, checked without Google: the parser over saved
// panels, the matcher over hostile rows, the tiling arithmetic, the
// never-overwrite fill, the dedupe, the resumable log, the pacing bounds.
//
//   npm run check:maps-scrape            (loads the fixtures into Chrome)
//   npm run check:maps-scrape -- --no-browser
//
// The parser runs INSIDE a page (scripts/scrape/lib/mapsParse.mjs
// extractDetailInPage), so the fixture checks open the installed Chrome
// headless and page.setContent() each saved panel — the same function, the
// same DOM engine, no network. --no-browser skips only those.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import {
  LISTING_VERDICTS,
  candidateWhere,
  listingRow,
  looksLikeNewLead,
  matchListing,
  meterLocalScrape,
  normaliseListing,
  parseFormattedAddress,
  scoreProspectForListing,
  searchTermForTrade,
  tradeKeyForListingCategory,
  applyListing,
} from "@/lib/sales/intel/listings";
import { planPlacesWrite } from "@/lib/sales/intel/places";
import { assembleRecord, dedupeFeed, extractDetailInPage, markersFor, parsePlaceUrl, placeIdFromHtml, readFeedInPage } from "./scrape/lib/mapsParse.mjs";
import { FEED_BOUNDARY, SINGLE_TILE_DIAGONAL_KM, boundsFromMapsUrl, diagonalKm, planViewports, regionBounds, subdivide, textSearchUrl, tileSearchUrl, tilesFor, viewportKm } from "./scrape/lib/geo.mjs";
import { classifyWall } from "./scrape/lib/browser.mjs";
import { jitter, wheelDelta } from "./scrape/lib/pace.mjs";
import { emptySummary, progressFrom } from "./scrape/lib/log.mjs";
import { pairsFromArgs, parseArgs } from "./scrape/maps.mjs";

let failures = 0;
let passes = 0;
function ok(label, cond, detail = "") {
  if (cond) passes += 1;
  else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
function section(name) {
  console.log(`\n${name}`);
}

const FIXTURES = path.join(path.dirname(new URL(import.meta.url).pathname), "scrape", "fixtures");
const noBrowser = process.argv.includes("--no-browser");

// ── URLs and the feed ──────────────────────────────────────────────────
section("place URLs and the feed");
{
  const u = "https://www.google.com/maps/place/All+Pipe+Plumbing/data=!4m7!3m6!1s0x652cf15db02228eb:0x176e174126296894!8m2!3d32.8541795!4d-116.9264871!16s%2Fg%2F11nj99w370!19sChIJ6ygisF3xLGURlGgpJkEXbhc?authuser=0&hl=en";
  const p = parsePlaceUrl(u);
  ok("place id from !19s", p.placeId === "ChIJ6ygisF3xLGURlGgpJkEXbhc");
  ok("cid pair from !1s", p.cid === "0x652cf15db02228eb:0x176e174126296894");
  ok("pin from !3d/!4d", p.latitude === 32.8541795 && p.longitude === -116.9264871);
  ok("name from the path", p.name === "All Pipe Plumbing");
  ok("query string dropped from href", !p.href.includes("?"));
  const none = parsePlaceUrl("https://www.google.com/maps/search/plumber/@32.8,-116.9,14z");
  ok("a search URL yields no place id", none.placeId === null && none.cid === null);
  ok("most-frequent ChIJ wins, singletons lose", placeIdFromHtml("x ChIJaaaaaaaaaaaaaaaaaaaaaa y ChIJbbbbbbbbbbbbbbbbbbbbbb z ChIJaaaaaaaaaaaaaaaaaaaaaa") === "ChIJaaaaaaaaaaaaaaaaaaaaaa");
  ok("one lone ChIJ is not enough", placeIdFromHtml("ChIJbbbbbbbbbbbbbbbbbbbbbb") === null);
  const feed = dedupeFeed([{ href: u, label: "All Pipe Plumbing" }, { href: u + "&x=1", label: "All Pipe Plumbing" }, { href: "https://www.google.com/maps/place/Other/data=!19sChIJotherotherotherother", label: "Other" }]);
  ok("feed dedupes by place id, keeps order", feed.length === 2 && feed[0].placeId === "ChIJ6ygisF3xLGURlGgpJkEXbhc" && feed[1].label === "Other");
}

// ── Addresses ──────────────────────────────────────────────────────────
section("formatted addresses");
{
  const us = parseFormattedAddress("9648 Prospect Ave, Lakeside, CA 92040, United States");
  ok("US: street, city, state, ZIP, country", us.addressLine === "9648 Prospect Ave" && us.city === "Lakeside" && us.province === "CA" && us.postalCode === "92040" && us.country === "US");
  const suite = parseFormattedAddress("12415 Woodside Ave Ste 263, Lakeside, CA 92040, United States");
  ok("US: a suite stays on the street line", suite.addressLine === "12415 Woodside Ave Ste 263" && suite.city === "Lakeside");
  const ca = parseFormattedAddress("1234 Rue Saint-Joseph, Gatineau, QC J8Y 3W4, Canada");
  ok("CA: FSA LDU postal code and province", ca.city === "Gatineau" && ca.province === "QC" && ca.postalCode === "J8Y 3W4" && ca.country === "CA");
  const noStreet = parseFormattedAddress("Lakeside, CA 92040, United States");
  ok("no street: city only, nothing invented", noStreet.addressLine === null && noStreet.city === "Lakeside" && noStreet.postalCode === "92040");
  const junk = parseFormattedAddress("Somewhere on the mountain");
  ok("unparseable: kept whole as the line, no city", junk.addressLine === "Somewhere on the mountain" && junk.city === null && junk.province === null);
  ok("empty: all null", Object.values(parseFormattedAddress("")).every((v) => v === null));
  const zip4 = parseFormattedAddress("1 Main St, Buffalo, NY 14202-1234, United States");
  ok("ZIP+4 kept whole", zip4.postalCode === "14202-1234" && zip4.province === "NY");
}

// ── Categories → trades ────────────────────────────────────────────────
section("categories");
{
  ok("Plumber → plumbing", tradeKeyForListingCategory("Plumber") === "plumbing");
  ok("Roofing contractor → roofing", tradeKeyForListingCategory("Roofing contractor") === "roofing");
  ok("Plumbing supply store → null (a supply house)", tradeKeyForListingCategory("Plumbing supply store") === null);
  ok("Garage door supplier → garage_door (Google's own name for installers)", tradeKeyForListingCategory("Garage door supplier") === "garage_door");
  ok("Restaurant → null", tradeKeyForListingCategory("Restaurant") === null);
  ok("null category → null", tradeKeyForListingCategory(null) === null);
  ok("every trade has a search term", ["plumbing", "roofing", "painting", "general_contracting", "cabinets"].every((k) => typeof searchTermForTrade(k) === "string" && searchTermForTrade(k).length > 2));
  ok("unknown trade → null term", searchTermForTrade("dentistry") === null);
}

// ── The listing, normalised ────────────────────────────────────────────
section("normalised listing");
{
  const l = normaliseListing({ placeId: "ChIJ6ygisF3xLGURlGgpJkEXbhc", name: "  All Pipe Plumbing ", category: "Plumber", address: "9648 Prospect Ave, Lakeside, CA 92040, United States", phone: "+1 619-277-7475", websiteUrl: "http://www.allpipeplumber.com/#contact", rating: "5.0", reviewCount: "14", latitude: "32.85", longitude: "-116.92", hours: ["Monday, 7 a.m.–5 p.m."], businessStatus: "OPERATIONAL", claimed: null });
  ok("name trimmed", l.name === "All Pipe Plumbing");
  ok("phone normalised to E.164", l.phoneE164 === "+16192777475" && l.phone === "+1 619-277-7475");
  ok("domain from the website, fragment dropped", l.domain === "allpipeplumber.com");
  ok("numbers parsed", l.rating === 5 && l.reviewCount === 14 && l.latitude === 32.85);
  ok("trade from the category", l.tradeKey === "plumbing");
  ok("claimed stays null", l.claimed === null);
  ok("looks like a new lead", looksLikeNewLead(l));
  const bad = normaliseListing({ placeId: "0x652c:0x176e", name: "X", phone: "call us", websiteUrl: "javascript:alert(1)" });
  ok("a CID is not a place id", bad.placeId === null);
  ok("an unparseable phone is null, not kept", bad.phoneE164 === null);
  ok("a javascript: website is refused", bad.websiteUrl === null && bad.domain === null);
  ok("no phone → not a new lead", !looksLikeNewLead(bad));
  const closed = normaliseListing({ name: "Y", phone: "+1 619 555 0100", category: "Plumber", businessStatus: "CLOSED_PERMANENTLY" });
  ok("closed → not a new lead", !looksLikeNewLead(closed));
}

// ── The matcher over hostile rows ──────────────────────────────────────
section("matcher");
{
  const listing = normaliseListing({ placeId: "ChIJAMSAMSAMSAMSAMSAMSAMS", name: "AMS Plumbing & Drain", category: "Plumber", address: "8539 Amato Dr, Lakeside, CA 92040, United States", phone: "+1 619-847-8330", latitude: 32.857, longitude: -116.92 });
  const ams = { id: "p-ams", businessName: "AMS PLUMBING & DRAIN", addressLine: "8539 AMATO DRIVE", city: "LAKESIDE", province: "CA", postalCode: "92040", phoneE164: "+16198478330", domain: null, websiteUrl: null, hasWebsite: null, googlePlaceId: null, latitude: null, longitude: null, tradingNames: [] };
  const beaumont = { ...ams, id: "p-beaumont", businessName: "AMS PLUMBING", addressLine: "1308 SILVER TOUCH DR", city: "BEAUMONT", postalCode: "92223", phoneE164: "+19512953741" };
  const adams = { ...ams, id: "p-adams", businessName: "ADAMS PLUMBING & DRAIN", addressLine: "3425 HASTY ST", city: "SAN DIEGO", postalCode: "92111", phoneE164: "+16196061952" };

  const m = matchListing(listing, [beaumont, adams, ams]);
  ok("AMS Lakeside chosen over AMS Beaumont and ADAMS San Diego", m.verdict === LISTING_VERDICTS.MATCHED && m.prospect.id === "p-ams", JSON.stringify(m.score));
  ok("phone identity recorded", m.score.identity.includes("phone"));
  ok("no other row accepted", m.score.alsoAccepted.length === 0);

  const sameNameOtherCity = matchListing(listing, [beaumont]);
  ok("same name, different city, different phone → refused", sameNameOtherCity.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && sameNameOtherCity.score.reason === "place_disagrees");

  ok("no candidates → no_candidates", matchListing(listing, []).verdict === LISTING_VERDICTS.NO_CANDIDATES);

  // Same phone, a distinctive word shared: the sole proprietor's business.
  const thompsons = normaliseListing({ placeId: "ChIJTHOMPSONTHOMPSONTHOMPS", name: "Thompson's Plumbing & Repair", phone: "+1 619-577-7999", address: "Lakeside, CA 92040, United States" });
  const scott = { ...ams, id: "p-scott", businessName: "THOMPSON SCOTT", phoneE164: "+16195777999", addressLine: null, postalCode: "92040" };
  const t = scoreProspectForListing(thompsons, scott);
  ok("same phone + distinctive shared word → accepted", t.accept && t.identity.includes("phone"), JSON.stringify(t));

  // Same phone, only a trade word shared: two brands on one number.
  const psi = normaliseListing({ placeId: "ChIJPSIPSIPSIPSIPSIPSIPSI", name: "PSI Plumbing Services Inc.", phone: "+1 619-733-9334", address: "El Cajon, CA 92020, United States" });
  const k2 = { ...ams, id: "p-k2", businessName: "K2 PLUMBING INC", phoneE164: "+16197339334", city: "EL CAJON", postalCode: "92020", addressLine: null };
  const s = scoreProspectForListing(psi, k2);
  ok("same phone + only 'plumbing' shared → refused with a reason", !s.accept && s.reason === "phone_same_only_generic_words_shared", JSON.stringify(s));

  // Same phone, nothing shared.
  const stranger = { ...k2, id: "p-stranger", businessName: "GOLDEN STATE ROOFING" };
  const g = scoreProspectForListing(psi, stranger);
  ok("same phone, no word shared → refused", !g.accept && g.reason === "phone_same_name_disagrees");

  // A trading name carries the match.
  const nobel = normaliseListing({ placeId: "ChIJNOBELNOBELNOBELNOBELNO", name: "Plancher Nobel", address: "100 Rue X, Gatineau, QC J8Y 3W4, Canada" });
  const emard = { ...ams, id: "p-emard", businessName: "TAPIS L. ÉMARD LTÉE", city: "GATINEAU", province: "QC", postalCode: "J8Y 3W4", phoneE164: "+18195550100", tradingNames: ["Plancher Nobel", "Emard Couvre-Planchers"] };
  const n = scoreProspectForListing(nobel, emard);
  ok("a trading name counts as the name", n.accept && n.nameOverlap === 1, JSON.stringify(n));

  // Place id identity wins outright.
  const attached = { ...beaumont, googlePlaceId: "ChIJAMSAMSAMSAMSAMSAMSAMS" };
  ok("same place id → accepted whatever the address", scoreProspectForListing(listing, attached).accept);

  // A generic name needs strong place agreement.
  const generic = normaliseListing({ placeId: "ChIJGENERICGENERICGENERICG", name: "Plumbing Services Inc", address: "Lakeside, CA 92040, United States", phone: "+1 619-555-0199" });
  const genericRow = { ...ams, id: "p-generic", businessName: "PLUMBING SERVICES INC", phoneE164: "+16195550100", postalCode: null, addressLine: null };
  const gs = scoreProspectForListing(generic, genericRow);
  ok("generic name with only the city → refused", !gs.accept && gs.reason === "generic_name_needs_strong_place", JSON.stringify(gs));

  // The candidate net.
  const w = candidateWhere(listing);
  ok("net pulls by place id, phone and name+area", JSON.stringify(w).includes("googlePlaceId") && JSON.stringify(w).includes("+16198478330") && JSON.stringify(w).includes("businessName"));
  ok("net excludes retired rows", w.mergedIntoId === null);
  const bare = candidateWhere(normaliseListing({ name: "" }));
  ok("no name, no phone, no id → a where that matches nothing", bare.id === "__no_candidates__");
}

// ── Never overwrite ────────────────────────────────────────────────────
section("never overwrite");
{
  const full = { id: "p-full", businessName: "ALL - PIPE PLUMBING", addressLine: "9648 PROSPECT AVE", city: "LAKESIDE", province: "CA", postalCode: "92040", phoneE164: "+16195550000", domain: "example.com", websiteUrl: "https://example.com/", hasWebsite: true, googlePlaceId: "ChIJ6ygisF3xLGURlGgpJkEXbhc", googleRating: 4.1, googleReviewCount: 3, businessStatus: "CLEAR", latitude: 32.85, longitude: -116.92, tradingNames: [] };
  const listing = normaliseListing({ placeId: "ChIJ6ygisF3xLGURlGgpJkEXbhc", name: "All Pipe Plumbing", address: "9648 Prospect Ave, Lakeside, CA 92040, United States", phone: "+1 619-277-7475", websiteUrl: "http://www.allpipeplumber.com/", rating: 5, reviewCount: 14, businessStatus: "OPERATIONAL", latitude: 32.8541795, longitude: -116.9264871 });
  const place = { id: listing.placeId, displayName: { text: listing.name }, formattedAddress: listing.address, websiteUri: listing.websiteUrl, internationalPhoneNumber: listing.phone, rating: 5, userRatingCount: 14, businessStatus: "OPERATIONAL", location: { latitude: 32.8541795, longitude: -116.9264871 }, types: ["Plumber"] };
  const plan = planPlacesWrite({ prospect: full, place, score: null, existingNumbers: [], provenance: { detector: "maps.scrape", detectorVersion: "1", surface: "Google Maps", numberLabel: "Google Maps listing", via: "maps_scrape" } });
  const touched = Object.keys(plan.data).filter((k) => !["placesCheckedAt", "placesVerdict", "placesResult"].includes(k));
  ok("a fully populated row: nothing but the Places stamp is written", touched.length === 0, touched.join(","));
  ok("every disagreement is a conflict, not a write", ["domain", "websiteUrl", "phoneE164", "googleRating", "googleReviewCount", "businessStatus"].every((c) => plan.conflicts.includes(c)), plan.conflicts.join(","));
  ok("the differing phone becomes a second number, labelled for Maps", plan.contactNumber?.e164 === "+16192777475" && plan.contactNumber.label === "Google Maps listing" && /Google Maps/.test(plan.contactNumber.note));
  ok("evidence carries the scrape's detector", plan.evidence.length > 0 && plan.evidence.every((e) => e.detector.startsWith("maps.scrape:")));
  ok("the snapshot says it came via the scrape", plan.data.placesResult.via === "maps_scrape");

  const row = listingRow(listing, { verdict: "no_confident_match" });
  ok("an unmatched sighting never writes matchedProspectId on update", !("matchedProspectId" in row.update) && row.create.matchedProspectId === null);
  const matchedRow = listingRow(listing, { verdict: "matched", matchedProspectId: "p-full" });
  ok("a matched sighting sets it", matchedRow.update.matchedProspectId === "p-full" && matchedRow.create.matchedAt instanceof Date);
  ok("unique on (source, externalId)", matchedRow.where.source_externalId.externalId === "ChIJ6ygisF3xLGURlGgpJkEXbhc" && matchedRow.where.source_externalId.source === "google_maps");
  ok("no id at all → no row", listingRow(normaliseListing({ name: "X" })) === null);
  ok("a CID-only listing keys on the CID", listingRow(normaliseListing({ name: "X", cid: "0x1:0x2" })).where.source_externalId.externalId === "cid:0x1:0x2");
}

// ── applyListing over a fake database ──────────────────────────────────
section("applyListing (fake db)");
{
  const writes = [];
  const prospect = { id: "p-1", businessName: "SITKO SERVICES", addressLine: null, city: "LAKESIDE", province: "CA", postalCode: "92040", phoneE164: "+16199220473", domain: null, websiteUrl: null, hasWebsite: null, googlePlaceId: null, googleRating: null, googleReviewCount: null, businessStatus: null, latitude: null, longitude: null, tradingNames: [], assignedRepId: null, campaignId: null };
  const tx = {
    prospect: { update: async (a) => (writes.push(["prospect.update", a]), a) },
    prospectEvidence: { createMany: async (a) => (writes.push(["evidence", a]), a) },
    salesContactNumber: { create: async (a) => (writes.push(["number", a]), a) },
    externalListing: { upsert: async (a) => (writes.push(["listing", a]), { id: "el-1" }) },
  };
  const fake = {
    prospect: { findMany: async () => [prospect], findFirst: async () => null },
    salesContactNumber: { findMany: async () => [] },
    externalListing: { upsert: async (a) => (writes.push(["listing", a]), { id: "el-1", matchedProspectId: null }) },
    $transaction: async (fn) => fn(tx),
  };
  const r = await applyListing({
    db: fake,
    raw: { placeId: "ChIJSITKOSITKOSITKOSITKOSI", name: "Sitko Services", category: "Plumber", address: "Lakeside, CA 92040, United States", phone: "+1 619-922-0473", websiteUrl: "https://sitkoservices.com/", rating: 4.8, reviewCount: 30, businessStatus: "OPERATIONAL", latitude: 32.85, longitude: -116.92 },
    deps: { rerunChainForNewWebsite: async () => ({ queued: 1, kind: "CRAWL_WEBSITE" }) },
  });
  ok("matched and filled", r.verdict === "matched" && r.prospectId === "p-1" && r.gained.includes("websiteUrl") && r.gained.includes("googlePlaceId"), JSON.stringify(r.gained));
  ok("the crawl was queued for the new website", r.research?.queued === 1);
  const upd = writes.find((w) => w[0] === "prospect.update")[1];
  ok("phone untouched (it agreed)", !("phoneE164" in upd.data));
  ok("website written", upd.data.websiteUrl === "https://sitkoservices.com/" && upd.data.domain === "sitkoservices.com");
  ok("listing recorded as matched in the same transaction", writes.some((w) => w[0] === "listing" && w[1].create.matchedProspectId === "p-1"));

  writes.length = 0;
  const dry = await applyListing({ db: fake, raw: { placeId: "ChIJSITKOSITKOSITKOSITKOSI", name: "Sitko Services", phone: "+1 619-922-0473" }, dry: true });
  ok("dry: matched, nothing written", dry.verdict === "matched" && writes.length === 0);

  writes.length = 0;
  const conflictDb = { ...fake, prospect: { findMany: async () => [{ ...prospect, googlePlaceId: "ChIJOTHEROTHEROTHEROTHEROT" }], findFirst: async () => null } };
  const c = await applyListing({ db: conflictDb, raw: { placeId: "ChIJSITKOSITKOSITKOSITKOSI", name: "Sitko Services", phone: "+1 619-922-0473" } });
  ok("a row carrying another place id is a conflict, not an overwrite", c.verdict === "place_id_conflict" && !writes.some((w) => w[0] === "prospect.update"));

  writes.length = 0;
  const none = await applyListing({ db: { ...fake, prospect: { findMany: async () => [], findFirst: async () => null } }, raw: { placeId: "ChIJNEWNEWNEWNEWNEWNEWNEWN", name: "Brand New Plumbing", category: "Plumber", phone: "+1 619-555-0123" } });
  ok("no row → listing kept as a prospect-in-waiting, flagged as lead-like", none.verdict === "no_candidate" && none.newLeadLike && writes.some((w) => w[0] === "listing"));

  const meters = [];
  const m = await meterLocalScrape({ db: { platformCostDaily: { upsert: async (a) => (meters.push(a), a) } }, places: 20, now: new Date("2026-09-18T04:00:00Z") });
  ok("metered as local_scrape / google-maps at $0 with units = places", m && meters[0].create.provider === "local_scrape" && meters[0].create.category === "google-maps" && meters[0].create.cents === 0 && meters[0].create.units === 20 && meters[0].update.units.increment === 20);
  ok("zero places meters nothing", (await meterLocalScrape({ db: {}, places: 0 })) === null);
}

// ── Tiling ─────────────────────────────────────────────────────────────
section("tiling");
{
  const sd = regionBounds("San Diego County, CA");
  ok("the table knows San Diego County", sd && sd.south < 33 && sd.north > 33);
  const tiles = tilesFor(sd, { zoom: 14 });
  ok("a county at 14z is hundreds of viewports, not one", tiles.length > 100 && tiles.length < 2000, String(tiles.length));
  const km = viewportKm(14, 33);
  ok("a 14z viewport at 33°N is a few km across", km.width > 5 && km.width < 9, JSON.stringify(km));
  ok("tiles cover the box: first is SW, last is NE", tiles[0].lat < tiles[tiles.length - 1].lat && tiles[0].lng < tiles[tiles.length - 1].lng);
  const inside = tiles.every((t) => t.lat >= sd.south && t.lat <= sd.north && t.lng >= sd.west && t.lng <= sd.east);
  ok("every tile centre is inside the box", inside);
  const kids = subdivide(tiles[0]);
  ok("a saturated tile splits into four at the next zoom", kids.length === 4 && kids.every((k) => k.zoom === 15 && k.parent === tiles[0].key));
  ok("children sit inside the parent", kids.every((k) => k.lat >= tiles[0].bounds.south && k.lat <= tiles[0].bounds.north));
  ok("no split past the deepest zoom", subdivide({ ...tiles[0], zoom: 17 }).length === 0);
  const lakeside = { south: 32.82, west: -116.97, north: 32.88, east: -116.88 };
  ok("Lakeside is one search", planViewports({ location: "Lakeside, CA", bounds: lakeside }).mode === "single" && diagonalKm(lakeside) < SINGLE_TILE_DIAGONAL_KM);
  ok("no bounds at all is one search", planViewports({ location: "X", bounds: null }).mode === "single");
  ok("a county is a grid", planViewports({ location: "San Diego County, CA", bounds: sd }).mode === "tiles");
  ok("--tiles forces a grid on a town", planViewports({ location: "Lakeside, CA", bounds: lakeside, force: "tiles" }).tiles.length >= 1);
  ok("the URL for a tile", tileSearchUrl("plumber", { lat: 32.85, lng: -116.92, zoom: 15 }) === "https://www.google.com/maps/search/plumber/@32.85,-116.92,15z?hl=en");
  ok("the URL for a text search", textSearchUrl("roofing contractor", "Lockport, NY", { lang: "fr" }) === "https://www.google.com/maps/search/roofing+contractor+in+Lockport%2C+NY?hl=fr");
  const b = boundsFromMapsUrl("https://www.google.com/maps/place/Lakeside,+CA/@32.857,-116.922,13z/data=!3m1");
  ok("bounds from a Maps URL's @lat,lng,zoom", b && b.zoom === 13 && b.bounds.south < 32.857 && b.bounds.north > 32.857);
  ok("no @ in the URL → null", boundsFromMapsUrl("https://www.google.com/maps/search/plumber") === null);
  ok("the boundary is Google's ~120", FEED_BOUNDARY === 120);
}

// ── Pacing, walls, log, args ───────────────────────────────────────────
section("pacing, walls, log, args");
{
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < 2000; i += 1) {
    const j = jitter();
    lo = Math.min(lo, j);
    hi = Math.max(hi, j);
  }
  ok("jitter stays in 2–6 s", lo >= 2000 && hi <= 6000 && hi - lo > 2000, `${lo}–${hi}`);
  ok("jitter pins to the rand", jitter(2000, 6000, () => 0) === 2000 && jitter(2000, 6000, () => 0.999999) === 6000);
  const deltas = Array.from({ length: 500 }, () => wheelDelta());
  ok("wheel scrolls mostly down, sometimes a small correction up", deltas.some((d) => d < 0) && deltas.filter((d) => d > 0).length > 400 && deltas.every((d) => Math.abs(d) <= 1400));
  ok("sorry page → unusual_traffic", classifyWall({ url: "https://www.google.com/sorry/index?continue=x" }) === "unusual_traffic");
  ok("unusual traffic text → unusual_traffic", classifyWall({ url: "https://www.google.com/maps", text: "Our systems have detected unusual traffic from your computer network." }) === "unusual_traffic");
  ok("consent host → consent", classifyWall({ url: "https://consent.google.com/m?continue=..." }) === "consent");
  ok("a plain Maps page → null", classifyWall({ url: "https://www.google.com/maps/search/plumber", text: "Results\nLakeside Plumbers" }) === null);
  const events = [
    { type: "run_start", args: { maxPerTerm: 20 } },
    { type: "place", placeId: "ChIJa", pairKey: "plumber|lakeside, ca|US" },
    { type: "tile_done", tileKey: "plumber|lakeside, ca|US|single" },
    { type: "place", placeId: "ChIJb", pairKey: "plumber|lakeside, ca|US" },
    { type: "pair_done", pairKey: "plumber|lakeside, ca|US" },
  ];
  const p = progressFrom(events);
  ok("replay: places, tiles and pairs already done", p.places.size === 2 && p.tilesDone.has("plumber|lakeside, ca|US|single") && p.pairsDone.has("plumber|lakeside, ca|US") && p.args.maxPerTerm === 20);
  ok("an empty summary counts nothing", emptySummary("r", {}).placesParsed === 0);
  const args = parseArgs(["--term", "plumber", "--location", "Lakeside, CA", "--country", "US", "--max-per-term", "20", "--headless", "--lang", "fr", "--resume"]);
  ok("args parse", args.terms[0] === "plumber" && args.maxPerTerm === 20 && args.headless && args.lang === "fr" && args.resume === "latest");
  const pairs = pairsFromArgs(parseArgs(["--term", "plumber", "--term", "roofer", "--location", "Buffalo, NY", "--location", "Lockport, NY", "--location", "Olean, NY", "--country", "US"]));
  ok("unequal lists: every term in every location", pairs.length === 6);
  const zipped = pairsFromArgs(parseArgs(["--term", "plumber", "--term", "roofer", "--location", "Buffalo, NY", "--location", "Lockport, NY"]));
  ok("equal lists zip", zipped.length === 2 && zipped[1].term === "roofer" && zipped[1].location === "Lockport, NY");
  let threw = false;
  try {
    parseArgs(["--bogus"]);
  } catch {
    threw = true;
  }
  ok("an unknown flag is refused", threw);
  const markers = markersFor("fr");
  ok("French markers exist", markers.endOfList.length > 0 && markers.closedPermanently.length > 0);
  const rec = assembleRecord({ detail: { name: "X", loaded: true }, link: { placeId: null, cid: "0x1:0x2", latitude: 1, longitude: 2 }, finalUrl: "https://www.google.com/maps/place/X/@1,2,17z/data=!3m1", html: "ChIJfromhtmlfromhtmlfromhtml ChIJfromhtmlfromhtmlfromhtml", term: "plumber", location: "L", tile: null });
  ok("place id falls back to the page's own ChIJ", rec.placeId === "ChIJfromhtmlfromhtmlfromhtml" && rec.cid === "0x1:0x2" && rec.latitude === 1);
}

// ── The parser, in Chrome, over saved panels ───────────────────────────
section("parser over fixtures");
if (noBrowser) {
  console.log("  (skipped: --no-browser)");
} else {
  let browser = null;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch (err) {
    console.log(`  (skipped: Chrome could not launch — ${err?.message?.split("\n")[0]})`);
  }
  if (browser) {
    const page = await browser.newPage();
    const markers = markersFor("en");
    const load = async (name) => {
      await page.setContent(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
      return page.evaluate(extractDetailInPage, markers);
    };

    const real = await load("real-no-website-no-address.html");
    ok("real panel: name, category, phone", real.name === "Lakeside Plumbers" && real.category === "Plumber" && real.phoneE164Hint === "+16194523837", JSON.stringify(real));
    ok("real panel: no website, no address, no plus code → null", real.websiteUrl === null && real.address === null && real.plusCode === null);
    ok("real panel: rating and review count", real.rating === 4.5 && real.reviewCount === 17);
    ok("real panel: histogram sums to the count", Array.isArray(real.starHistogram) && real.starHistogram.reduce((a, b) => a + b, 0) === 17, JSON.stringify(real.starHistogram));
    ok("real panel: seven day lines", Array.isArray(real.hours) && real.hours.length === 7 && real.hours.every((h) => /^[A-Z][a-z]+day, /.test(h)), JSON.stringify(real.hours));
    ok("real panel: operating, claimed unknown, loaded", real.businessStatus === "OPERATIONAL" && real.claimed === null && real.loaded);

    const closed = await load("closed-non-ascii.html");
    ok("closed: non-ASCII name intact", closed.name === "Plomberie Éric Côté & Fils Inc.", closed.name);
    ok("closed: status CLOSED_PERMANENTLY", closed.businessStatus === "CLOSED_PERMANENTLY");
    ok("closed: website and address read, phone null, hours null", closed.websiteUrl === "https://www.plomberiecote.ca/" && closed.address === "1234 Rue Saint-Joseph, Gatineau, QC J8Y 3W4, Canada" && closed.phone === null && closed.hours === null);
    ok("closed: a comma decimal rating", closed.rating === 4.2 && closed.reviewCount === 8);
    ok("closed: histogram", JSON.stringify(closed.starHistogram) === "[1,1,0,0,6]");

    const un = await load("unclaimed-no-hours-price.html");
    ok("unclaimed: the prompt makes claimed false", un.claimed === false && un.ownerPromptSeen);
    ok("unclaimed: price bracket", un.priceBracket === "$$", un.priceBracket);
    ok("unclaimed: temporarily closed", un.businessStatus === "CLOSED_TEMPORARILY");
    ok("unclaimed: thousands separator in reviews", un.reviewCount === 1204 && un.rating === 3.9);
    ok("unclaimed: no hours → null, not []", un.hours === null);
    ok("unclaimed: phone from the data-item-id", un.phoneE164Hint === "+17165550142" && un.phone === "+1 716-555-0142");

    const empty = await load("empty-panel.html");
    ok("empty panel: not loaded, nothing invented", !empty.loaded && empty.name === null && empty.businessStatus === null && empty.claimed === null && empty.rating === null);

    await page.setContent(fs.readFileSync(path.join(FIXTURES, "feed-ended.html"), "utf8"));
    const feed = await page.evaluate(readFeedInPage, markers);
    ok("feed: links read and the end sentence seen", feed.hasFeed && feed.count === 3 && feed.ended && !feed.noResults);
    ok("feed: dedupe leaves two", dedupeFeed(feed.links).length === 2);

    const rec = assembleRecord({ detail: real, link: parsePlaceUrl("https://www.google.com/maps/place/Lakeside+Plumbers/data=!1s0x80d9589fa03d866d:0xfe91012aacda937c!8m2!3d33.0172666!4d-116.8460104!19sChIJbYY9oJ9Y2YARfJParCoBkf4"), finalUrl: "", html: "", term: "plumber", location: "Lakeside, CA", tile: null });
    const norm = normaliseListing(rec);
    ok("assembled record normalises to a lead-like listing", norm.placeId === "ChIJbYY9oJ9Y2YARfJParCoBkf4" && norm.phoneE164 === "+16194523837" && norm.latitude === 33.0172666 && looksLikeNewLead(norm));

    await browser.close();
  }
}

section("wiring");
{
  const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(FIXTURES), "..", "..", "package.json"), "utf8"));
  ok("check:maps-scrape is a script and check:all runs it", typeof pkg.scripts?.["check:maps-scrape"] === "string" && (pkg.scripts?.["check:all"] || "").includes("check:maps-scrape"));
  ok("scrape:maps is a script that loads .env and the alias", /--env-file=\.env/.test(pkg.scripts?.["scrape:maps"] || "") && /alias-loader/.test(pkg.scripts?.["scrape:maps"] || ""));
  const schema = fs.readFileSync(path.join(path.dirname(FIXTURES), "..", "..", "prisma", "schema.prisma"), "utf8");
  ok("the schema carries the maps-scrape columns on ExternalListing", /model ExternalListing \{[\s\S]*?tradeKey\s+String\?[\s\S]*?businessStatus String\?[\s\S]*?claimed\s+Boolean\?[\s\S]*?matchResult\s+Json\?[\s\S]*?lastSeenAt\s+DateTime[\s\S]*?@@unique\(\[source, externalId\]\)/.test(schema));
  const summary = fs.readFileSync(path.join(path.dirname(FIXTURES), "..", "..", "lib", "platform", "costs", "summary.js"), "utf8");
  ok("/platform/costs reads the local_scrape line", /provider: "local_scrape"/.test(summary) && /key: "local_scrape"/.test(summary));
  const docs = path.join(path.dirname(FIXTURES), "..", "..", "docs", "sales", "SCRAPE-LOCAL-RUN.md");
  ok("the run-book exists and names the commands", fs.existsSync(docs) && /scrape:maps/.test(fs.readFileSync(docs, "utf8")) && /--resume/.test(fs.readFileSync(docs, "utf8")));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
