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
import { MATCHED_VERIFY, placeWordsFor, planPlacesWrite, verifyConfirmation, nameOverlap, nameTokens } from "@/lib/sales/intel/places";
import { inRegions, loadEnrichmentOrder, pairsFromRows, parseRegions } from "@/lib/sales/intel/enrichmentOrder";
import { emptyPromotionReport, planPromotion, promotableWhere, promoteListings, retailCategory } from "@/lib/sales/intel/promoteListings";
import { rawFromListingRow, rematchUnmatched, rematchWhere } from "@/lib/sales/intel/rematch";
import { RUNS_KEPT, RUNS_SETTING_KEY, foldRuns, keepRuns, recordScrapeRun, runRecordFrom } from "@/lib/sales/intel/mapsScrapeStatus";
import { askedSentence, promotionSentence } from "@/lib/sales/intel/mapsScrapeSentences";
import { placesRow } from "@/lib/sales/prospectView";
import { composeBrief } from "@/lib/sales/intel/brief";
import { contactBasisFor } from "@/lib/sales/contactBasis";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
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

// ── The 2026-09-21 change: names, and matched_verify ───────────────────
//
// Measured on production before the change: 914 name_disagrees, 406 no
// candidate, 255 place_disagrees (correct refusals, and they stay so), and
// ~148 where the phone or domain WAS the record's and only the name
// disagreed — the four reasons that now flip. Every shape below is one of
// those, built as a listing + a prospect and put through matchListing, the
// function the sweep and the rematch both call.
section("matcher — names and matched_verify");
{
  const T = (n) => [...nameTokens(n)].join(",");
  ok("B P / B.P. / B&P / BP are one token", T("B P Plumbing") === "bp,plumbing" && T("B.P. Plumbing") === "bp,plumbing" && T("B&P Plumbing") === "bp,plumbing" && T("BP Plumbing") === "bp,plumbing");
  ok("A-1 and A 1 agree; a lone article is still dropped", T("A-1 Plumbing") === T("A 1 Plumbing") && T("A Plus Plumbing").split(",")[0] !== "a");
  ok("legal suffixes drop: Bock Plumbing, Inc. ≡ Bock Plumbing", nameOverlap("BOCK PLUMBING, INC.", "Bock Plumbing").overlap === 1);
  ok("trade words set aside: the licence's full trade list ≡ the sign's short name", nameOverlap("THOMPSON PLUMBING HEATING & AIR CONDITIONING INC", "Thompson Plumbing").overlap === 1);
  ok("…but two DIFFERENT trades on one surname stay two businesses", nameOverlap("THOMPSON PLUMBING", "Thompson Roofing").overlap === 0.5);
  ok("…and a name that is all trade words is judged whole, as before", nameOverlap("QUALITY PLUMBING SERVICES", "Quality Roofing Services").overlap < 1 && nameOverlap("QUALITY PLUMBING SERVICES", "Quality Plumbing Services").overlap === 1);
  ok("PSI vs K2 share only 'plumbing' still — the name half did not loosen", nameOverlap("PSI PLUMBING SERVICES", "K2 Plumbing").overlap < 0.6);
  // Measured on the first dry rematch, 2026-09-21: a register-only reading
  // of the trade-word-free core called every one of these 1.0. The
  // symmetric reading refuses them all.
  for (const [reg, cand] of [["MK BEST ROOFING", "Atlantic Do it Best Hardware"], ["Chimney MD", "Allied Roofing and Chimney"], ["Re-Masters", "MASTER APPLIANCE REPAIR ~ FREE service call"], ["Paint of Wny", "WNY Install Co."], ["Custom Carpet Centers", "Rent-A-Center"], ["Evergreen Heating & Cooling", "Evergreen Point Partners"], ["B & W Appliance Inc.", "D&M Appliance Repair Inc."], ["Brothers Construction Group", "Brothers Appliance"]]) {
    ok(`one shared word in a longer name is not a match: '${reg}' vs '${cand}'`, nameOverlap(reg, cand).overlap < 0.6, String(nameOverlap(reg, cand).overlap));
  }
  ok("O.S. Electric ≡ OS Electric", nameOverlap("O.S. Electric Inc", "OS Electric Inc").overlap === 1);
  // The second dry rematch: two names that each reduce to the town.
  ok("the row's city is a place word: 'Rochester Remodeling and Home Builders' is not 'Quality Homes of Rochester'", nameOverlap("Rochester Remodeling and Home Builders", "Quality Homes of Rochester", { placeWords: placeWordsFor("Rochester") }).overlap < 0.6 && nameOverlap("Rochester Remodeling and Home Builders", "Quality Homes of Rochester").overlap === 1);
  ok("…nor 'Flushing Heating and Plumbing Services' 'Flushing Heating and Air Conditioning'", nameOverlap("Flushing Heating and Plumbing Services", "Flushing Heating and Air Conditioning", { placeWords: placeWordsFor("Flushing", "Queens") }).overlap < 0.6);
  ok("a surname is not a place word: Thompson still matches with the city set aside", nameOverlap("THOMPSON PLUMBING HEATING & AIR CONDITIONING INC", "Thompson Plumbing", { placeWords: placeWordsFor("Lakeside") }).overlap === 1);

  const L = (o) => normaliseListing({ placeId: o.placeId || "ChIJLISTINGLISTINGLISTINGL", name: o.name, phone: o.phone || null, websiteUrl: o.web || null, category: "Plumber", address: o.address || "10 Main St, Lakeside, CA 92040, United States", latitude: o.lat ?? 32.85, longitude: o.lng ?? -116.92 });
  const P = (o) => ({ id: o.id || "p", businessName: o.name, city: o.city || "LAKESIDE", province: o.province || "CA", country: "US", postalCode: o.postal ?? "92040", addressLine: o.addr ?? "10 MAIN ST", phoneE164: o.phone || null, domain: o.domain || null, websiteUrl: null, hasWebsite: null, latitude: o.lat ?? 32.85, longitude: o.lng ?? -116.92, googlePlaceId: null, googleRating: null, googleReviewCount: null, businessStatus: null, tradingNames: [] });
  const far = { addr: "99 OTHER RD", postal: "92020", city: "EL CAJON", lat: 33.5, lng: -117.5 };

  const roch = matchListing(L({ name: "Quality Homes of Rochester", address: "10 Main St, Rochester, NY 14604, United States" }), [P({ id: "rr", name: "ROCHESTER REMODELING AND HOME BUILDERS", city: "ROCHESTER", province: "NY", postal: "14604" })]);
  ok("…and through the listing matcher, with the city read off both rows", roch.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && roch.score.reason === "name_disagrees", JSON.stringify(roch.score));
  // The four that flip.
  const v1 = matchListing(L({ name: "K2 Plumbing", phone: "(619) 733-9334" }), [P({ id: "psi", name: "PSI PLUMBING SERVICES INC", phone: "+16197339334", ...far })]);
  ok("phone_same_only_generic_words_shared → matched_verify", v1.verdict === MATCHED_VERIFY && v1.prospect?.id === "psi" && v1.score.reason === "phone_same_only_generic_words_shared", JSON.stringify(v1.score));
  const v2 = matchListing(L({ name: "Golden State Rooter", phone: "(619) 733-9334" }), [P({ id: "psi", name: "PSI PLUMBING SERVICES INC", phone: "+16197339334", ...far })]);
  ok("phone_same_name_disagrees → matched_verify", v2.verdict === MATCHED_VERIFY && v2.score.reason === "phone_same_name_disagrees" && v2.score.identity.join() === "phone");
  const v3 = matchListing(L({ name: "Drain Kings", web: "https://www.acmeplumb.com/" }), [P({ id: "acme", name: "ACME PLUMBING", domain: "acmeplumb.com", ...far })]);
  ok("domain_same_name_disagrees → matched_verify", v3.verdict === MATCHED_VERIFY && v3.score.reason === "domain_same_name_disagrees" && v3.score.identity.join() === "domain");
  const v4 = matchListing(L({ name: "Superior Plumbing Co", web: "https://www.acmeplumb.com/" }), [P({ id: "acme", name: "ACME PLUMBING", domain: "acmeplumb.com", ...far })]);
  ok("domain_same_only_generic_words_shared → matched_verify", v4.verdict === MATCHED_VERIFY && v4.score.reason === "domain_same_only_generic_words_shared");
  ok("the verify score says verify, not accept", v1.score.verify === true && v1.score.accept === false);
  // A shared number or domain is a network, not a business.
  const shared = matchListing(L({ name: "Servpro Restoration", web: "https://www.servpro.com/locations/ca/lakeside" }), [P({ id: "s1", name: "SERVPRO OF EL CAJON", domain: "servpro.com", ...far }), P({ id: "s2", name: "SERVPRO OF SANTEE", domain: "servpro.com", city: "SANTEE", postal: "92071", addr: "5 ELM ST", lat: 32.84, lng: -116.97 })]);
  ok("a franchise domain two candidates carry is neither a verify nor an identity accept — refused, with the reason saying so", shared.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && /domain_shared_by_2_prospects/.test(shared.score.reason), shared.score.reason);
  const franchiseSolo = matchListing(L({ name: "Servpro of Lakeside", web: "https://www.servpro.com/locations/ca/lakeside" }), [P({ id: "s1", name: "SERVPRO OF EL CAJON", domain: "servpro.com", ...far })]);
  ok("…and with one candidate, two towns on the two signs is two branches: refused, no verify", franchiseSolo.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && franchiseSolo.score.reason === "domain_same_different_towns" && !franchiseSolo.score.verify, JSON.stringify(franchiseSolo.score));
  const sameTown = matchListing(L({ name: "Servpro of El Cajon", web: "https://www.servpro.com/locations/ca/elcajon", address: "99 Other Rd, El Cajon, CA 92020, United States", lat: 33.5, lng: -117.5 }), [P({ id: "s1", name: "SERVPRO OF EL CAJON", domain: "servpro.com", ...far })]);
  ok("…the same town on both signs is the same branch", sameTown.verdict === LISTING_VERDICTS.MATCHED);
  const sharedLine = matchListing(L({ name: "Golden State Rooter", phone: "(619) 733-9334" }), [P({ id: "psi", name: "PSI PLUMBING SERVICES INC", phone: "+16197339334", ...far }), P({ id: "k2", name: "K2 PLUMBING INC", phone: "+16197339334", city: "SANTEE", postal: "92071", addr: "5 ELM ST", lat: 32.84, lng: -116.97 })]);
  ok("a phone two candidates carry is not a verify either", sharedLine.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && /phone_shared_by_2_prospects/.test(sharedLine.score.reason));
  const fb = matchListing(L({ name: "Drain Kings", web: "https://www.facebook.com/drainkings" }), [P({ id: "acme", name: "ACME PLUMBING", domain: "facebook.com", ...far })]);
  ok("a platform domain (facebook.com) is never an identity", fb.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && fb.score.identity.length === 0 && fb.score.reason === "name_disagrees");

  // The three that must not.
  const r1 = matchListing(L({ name: "Drain Kings" }), [P({ id: "singer", name: "SINGER ENTERPRISES" })]);
  ok("name_disagrees with no identity → still refused", r1.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && r1.prospect === null && r1.score.reason === "name_disagrees");
  const r2 = matchListing(L({ name: "Thompson Plumbing", address: "1 Far Ave, Fresno, CA 93701, United States", lat: 36.7, lng: -119.8 }), [P({ id: "th", name: "THOMPSON PLUMBING", city: "BAKERSFIELD", postal: "93301", addr: "500 ELSEWHERE ST", lat: 35.37, lng: -119.02 })]);
  ok("place_disagrees with no identity → still refused", r2.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && r2.score.reason === "place_disagrees", JSON.stringify(r2.score));
  ok("no candidate → still no_candidate", matchListing(L({ name: "Anything" }), []).verdict === LISTING_VERDICTS.NO_CANDIDATES);
  const r3 = matchListing(L({ name: "Thompson Roofing" }), [P({ id: "th", name: "THOMPSON PLUMBING", addr: "99 OTHER RD" })]);
  ok("a surname across two trades in one city → still refused", r3.verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH && r3.score.reason === "name_disagrees");
  const both = matchListing(L({ name: "K2 Plumbing", phone: "(619) 733-9334" }), [P({ id: "psi", name: "PSI PLUMBING SERVICES INC", phone: "+16197339334", ...far }), P({ id: "k2", name: "K2 PLUMBING INC", phone: "+16197339334" })]);
  ok("a plain match anywhere in the net beats a verify", both.verdict === LISTING_VERDICTS.MATCHED && both.prospect.id === "k2" && !both.score.alsoAccepted.includes("psi"));
  const solo = matchListing(L({ name: "K2 Plumbing", phone: "(619) 733-9334" }), [P({ id: "psi", name: "PSI PLUMBING SERVICES INC", phone: "+16197339334", ...far }), P({ id: "k2", name: "K2 PLUMBING INC", phone: "+16197339334", ...far, postal: "92021" })]);
  ok("an exact name on a shared line is still the rule's own accept", solo.verdict === LISTING_VERDICTS.MATCHED && solo.prospect.id === "k2" && solo.score.acceptedVia === "rule");

  // The names the owner named.
  const bp = matchListing(L({ name: "BP Plumbing" }), [P({ id: "bp", name: "B P PLUMBING" })]);
  ok("'B P Plumbing' ≡ 'BP Plumbing' at the same address → matched", bp.verdict === LISTING_VERDICTS.MATCHED && bp.score.nameOverlap === 1);
  const bock = matchListing(L({ name: "Bock Plumbing" }), [P({ id: "bock", name: "BOCK PLUMBING, INC." })]);
  ok("'Bock Plumbing, Inc.' ≡ 'Bock Plumbing' → matched", bock.verdict === LISTING_VERDICTS.MATCHED);

  // The fact.
  const f = verifyConfirmation({ identity: ["phone"], name: "K2 Plumbing" });
  ok("the verify fact names the listing and says confirm on the call", f.code === "identity:phone" && f.text === "Google lists this number as K2 Plumbing — a rebrand or a shared line; confirm on the call" && f.key === "app.salesIntel.places.identity.phone");
  ok("website and both have their own clause", verifyConfirmation({ identity: ["domain"], name: "X" }).code === "identity:website" && verifyConfirmation({ identity: ["phone", "domain"], name: "X" }).code === "identity:both");
  for (const lang of ["en", "fr", "es"]) ok(`${lang}: the verify keys exist and carry {name}`, ["phone", "website", "both"].every((k) => /\{name\}/.test(APP_MESSAGES[lang]?.[`app.salesIntel.places.identity.${k}`] || "")));

  // applyListing under verify: linked, blanks only, the fact first.
  const writes = [];
  const psiRow = { ...P({ id: "psi", name: "PSI PLUMBING SERVICES INC", phone: "+16197339334", ...far }), googleRating: 3.9, assignedRepId: null, campaignId: null };
  const tx = {
    prospect: { update: async (a) => (writes.push(["prospect.update", a]), a) },
    prospectEvidence: { createMany: async (a) => (writes.push(["evidence", a]), a) },
    salesContactNumber: { create: async (a) => (writes.push(["number", a]), a) },
    externalListing: { upsert: async (a) => (writes.push(["listing", a]), { id: "el-v" }) },
  };
  const fake = { prospect: { findMany: async () => [psiRow], findFirst: async () => null }, salesContactNumber: { findMany: async () => [] }, externalListing: { upsert: async (a) => (writes.push(["listing", a]), { id: "el-v", matchedProspectId: null }) }, $transaction: async (fn) => fn(tx) };
  const rv = await applyListing({ db: fake, raw: { placeId: "ChIJK2K2K2K2K2K2K2K2K2K2K2", name: "K2 Plumbing", category: "Plumber", address: "99 Other Rd, El Cajon, CA 92020, United States", phone: "+1 619-733-9334", websiteUrl: "https://k2plumbing.example/", rating: 4.9, reviewCount: 12, businessStatus: "OPERATIONAL" }, deps: { rerunChainForNewWebsite: async () => ({ queued: 1 }) } });
  ok("applyListing: verdict matched_verify, the prospect linked", rv.verdict === MATCHED_VERIFY && rv.prospectId === "psi");
  const upd = writes.find((w) => w[0] === "prospect.update")[1].data;
  ok("blanks filled (website, place id), the record's rating kept", upd.websiteUrl === "https://k2plumbing.example/" && upd.googlePlaceId === "ChIJK2K2K2K2K2K2K2K2K2K2K2" && !("googleRating" in upd) && rv.conflicts.includes("googleRating"));
  ok("placesVerdict is matched_verify and the fact leads the confirmations", upd.placesVerdict === MATCHED_VERIFY && upd.placesResult.confirmations[0].code === "identity:phone" && /K2 Plumbing/.test(upd.placesResult.confirmations[0].text));
  ok("the listing row carries the verdict and the prospect", writes.some((w) => w[0] === "listing" && w[1].create.matchVerdict === MATCHED_VERIFY && w[1].create.matchedProspectId === "psi"));
  ok("an evidence row records the verify", writes.some((w) => w[0] === "evidence" && w[1].data.some((e) => e.detector === "maps.scrape:identity_verify")));
  const card = placesRow({ ...psiRow, placesCheckedAt: new Date("2026-09-21T00:00:00Z"), placesVerdict: upd.placesVerdict, placesResult: upd.placesResult });
  ok("the rep card prints the fact first", card.known && card.parts[0].key === "app.salesIntel.places.identity.phone" && /K2 Plumbing/.test(card.text));
  const brief = composeBrief({ prospect: { ...psiRow, placesVerdict: upd.placesVerdict, placesResult: upd.placesResult, people: [] }, evidence: [], now: new Date("2026-09-21T00:00:00Z") });
  const verifyFact = (brief.known || brief.facts || []).find((x) => x.id === "google_verify" || x.key === "google_verify");
  ok("the brief carries a 'Confirm on the call' fact of its own", Boolean(verifyFact) && /K2 Plumbing/.test(verifyFact.detail || verifyFact.text || JSON.stringify(verifyFact)), JSON.stringify(Object.keys(brief)));
}

// ── --state: the regional pass ─────────────────────────────────────────
section("regions");
{
  ok("codes, names, commas and repeats parse to codes in order", parseRegions(["NY,FL", "california", "ny"]).regions.join() === "NY,FL,CA");
  ok("an unknown token is refused, not filtered to nothing", parseRegions(["NY", "Narnia"]).unknown.join() === "Narnia");
  ok("no filter → everything is in; a null province is OUTSIDE a filter", inRegions(null, null) && inRegions("OR", null) && !inRegions(null, ["NY"]) && inRegions("ny", ["NY"]) && !inRegions("OR", ["NY", "FL", "CA"]));
  const rows = [{ id: "a", tier: "claimed", rank: 0 }, { id: "b", tier: "claimed", rank: 1 }, { id: "c", tier: "next_in_trade", rank: 2 }];
  const byId = new Map([["a", { tradeKey: "plumbing", city: "Buffalo", province: "NY", country: "US" }], ["b", { tradeKey: "plumbing", city: "Portland", province: "OR", country: "US" }], ["c", { tradeKey: "roofing", city: "Miami", province: "FL", country: "US" }]]);
  const pairs = pairsFromRows(rows, byId, { regions: ["NY", "FL", "CA"] });
  ok("pairs outside the states are dropped and counted", pairs.length === 2 && pairs.every((p) => ["NY", "FL"].includes(p.province)) && pairs.skippedOutside === 1);
  ok("without a filter nothing is dropped", pairsFromRows(rows, byId).length === 3 && pairsFromRows(rows, byId).skippedOutside === 0);

  // loadEnrichmentOrder over a fake db: the filter goes into the WHERE and
  // the claims outside are counted.
  const seen = [];
  const fakeDb = {
    salesQueueClaim: { findMany: async ({ where }) => (where.releasedAt === null ? [
      { prospectId: "a", salesRepId: "r", claimedAt: new Date("2026-09-20"), position: 0, prospect: { tradeKey: "plumbing", mergedIntoId: null, doNotContactAt: null, province: "NY" } },
      { prospectId: "b", salesRepId: "r", claimedAt: new Date("2026-09-20"), position: 1, prospect: { tradeKey: "plumbing", mergedIntoId: null, doNotContactAt: null, province: "OR" } },
    ] : [{ claimedAt: new Date("2026-09-20"), prospect: { tradeKey: "plumbing" } }]) },
    prospect: {
      findMany: async ({ where }) => (seen.push(where), []),
      count: async () => 7,
    },
  };
  const order = await loadEnrichmentOrder({ db: fakeDb, regions: ["NY", "FL", "CA"] });
  ok("the claim outside the states is dropped before ranking and counted", order.rows.length === 1 && order.rows[0].id === "a" && order.outsideRegions.claimed === 1);
  ok("the candidate reads carry the province filter; the outside count is read", seen.every((w) => JSON.stringify(w).includes('"province":{"in":["NY","FL","CA"]}')) && order.outsideRegions.candidates === 7 && order.regions.join() === "NY,FL,CA");
  const plain = await loadEnrichmentOrder({ db: { ...fakeDb, prospect: { findMany: async () => [], count: async () => { throw new Error("must not count without a filter"); } } } });
  ok("without --state: two claims, no province clause, nothing counted", plain.rows.length === 2 && plain.regions === null && plain.outsideRegions.candidates === 0);

  const a = parseArgs(["--from-order", "--state", "NY,FL", "--state", "california", "--province", "QC"]);
  ok("maps.mjs --state / --province parse to codes", a.regions.join() === "NY,FL,CA,QC");
  let threw = null;
  try { parseArgs(["--state", "Narnia"]); } catch (e) { threw = e.message; }
  ok("an unknown state stops the run", /Narnia/.test(threw || ""));
  ok("--rematch / --promote / --apply / --limit parse", parseArgs(["--rematch", "--apply", "--limit", "5"]).rematch && parseArgs(["--promote"]).promote && !parseArgs(["--promote"]).apply && parseArgs(["--limit", "5"]).limit === 5);
}

// ── Promotion: unmatched listings → prospects ──────────────────────────
section("promotion");
{
  const base = { id: "el-1", externalId: "ChIJPROMOPROMOPROMOPROMOPR", name: "Bayside Plumbing", phoneE164: "+17185550100", domain: "baysideplumb.com", websiteUrl: "https://baysideplumb.com/", addressLine: "1 Shore Rd", city: "Brooklyn", province: "NY", postalCode: "11201", country: "US", latitude: 40.69, longitude: -73.99, category: "Plumber", tradeKey: "plumbing", rating: "4.6", reviewCount: 41, businessStatus: "OPERATIONAL", runId: "20260921-010000Z", lastSeenAt: new Date("2026-09-21T01:05:00Z"), matchedProspectId: null, promotedProspectId: null };
  const ctx = () => ({ regions: null, existingPhones: new Set(), existingDomains: new Set(), existingPlaceIds: new Set(), dncPhones: new Set(), dncDomains: new Set(), batchPhones: new Set(), batchDomains: new Set() });
  const p = planPromotion(base, ctx());
  ok("a plumber with a phone becomes a discovered contractor in the plumbing trade", p.ok && p.prospect.status === "discovered" && p.prospect.classification === "contractor" && p.prospect.tradeKey === "plumbing" && p.prospect.sourceProvider === "google_maps" && p.prospect.sourceRecordId === base.externalId && p.prospect.googlePlaceId === base.externalId && p.prospect.campaignId === null, JSON.stringify(p));
  ok("hasWebsite is true with a site and null without — never false", p.prospect.hasWebsite === true && planPromotion({ ...base, websiteUrl: null, domain: null }, ctx()).prospect.hasWebsite === null);
  const noTradeName = planPromotion({ ...base, category: "Home builder", tradeKey: null }, ctx());
  ok("category → no trade, name says a trade: discovered, no tradeKey → the folder's 'no trade'", noTradeName.ok && noTradeName.prospect.tradeKey === null && noTradeName.prospect.status === "discovered" && noTradeName.prospect.classification === "contractor");
  const unclear = planPromotion({ ...base, name: "Bayside Group LLC", category: "Consultant", tradeKey: null }, ctx());
  ok("category → no trade, name says nothing: needs_review → the folder's 'unclear'", unclear.ok && unclear.prospect.tradeKey === null && unclear.prospect.status === "needs_review" && unclear.prospect.classification === "needs_review");
  ok("no phone → refused", planPromotion({ ...base, phoneE164: null }, ctx()).reason === "no_phone");
  ok("closed → refused", planPromotion({ ...base, businessStatus: "CLOSED_PERMANENTLY" }, ctx()).reason === "closed" && planPromotion({ ...base, businessStatus: "CLOSED_TEMPORARILY" }, ctx()).reason === "closed");
  ok("already matched or promoted → refused", planPromotion({ ...base, matchedProspectId: "x" }, ctx()).reason === "matched" && planPromotion({ ...base, promotedProspectId: "x" }, ctx()).reason === "already_promoted");
  ok("a prospect on the same phone → duplicate", planPromotion(base, { ...ctx(), existingPhones: new Set(["+17185550100"]) }).reason === "duplicate_phone");
  ok("a prospect on the same domain → duplicate", planPromotion(base, { ...ctx(), existingDomains: new Set(["baysideplumb.com"]) }).reason === "duplicate_domain");
  ok("a prospect already carrying the place id → duplicate", planPromotion(base, { ...ctx(), existingPlaceIds: new Set([base.externalId]) }).reason === "duplicate_place_id");
  ok("the do-not-contact list refuses by phone and by domain", planPromotion(base, { ...ctx(), dncPhones: new Set(["+17185550100"]) }).reason === "do_not_contact" && planPromotion(base, { ...ctx(), dncDomains: new Set(["baysideplumb.com"]) }).reason === "do_not_contact");
  ok("outside --state → refused", planPromotion(base, { ...ctx(), regions: ["FL", "CA"] }).reason === "outside_regions" && planPromotion(base, { ...ctx(), regions: ["NY"] }).ok);
  ok("a supply house by category or by name is not a lead", planPromotion({ ...base, category: "Plumbing supply store", tradeKey: null }, ctx()).reason === "retail_category" && planPromotion({ ...base, name: "Bayside Plumbing Supply", category: "Plumber" }, ctx()).reason === "retail_name" && retailCategory("Garage door supplier") === false);
  ok("the where excludes matched, promoted, phoneless and closed rows, and takes --state", (() => { const w = promotableWhere({ regions: ["NY"] }); return w.matchedProspectId === null && w.promotedProspectId === null && w.phoneE164.not === null && w.NOT.length === 2 && w.province.in.join() === "NY"; })());

  // Over a fake database: dedupe inside the batch, one research call, idempotent.
  const created = [];
  const listingWrites = [];
  const research = [];
  const rows = [base, { ...base, id: "el-2", externalId: "ChIJPROMOPROMOPROMOPROMOP2", name: "Bayside Plumbing (2nd pin)", phoneE164: "+17185550100" }, { ...base, id: "el-3", externalId: "ChIJPROMOPROMOPROMOPROMOP3", name: "Sunrise Roofing", phoneE164: "+13055550199", domain: null, websiteUrl: null, category: "Roofing contractor", tradeKey: "roofing", province: "FL", city: "Miami" }, { ...base, id: "el-4", externalId: "ChIJPROMOPROMOPROMOPROMOP4", name: "Taken Plumbing", phoneE164: "+12125550111", domain: "taken.example" }, { ...base, id: "el-5", externalId: "ChIJPROMOPROMOPROMOPROMOP5", name: "Blocked Plumbing", phoneE164: "+12125550122", domain: null, websiteUrl: null }];
  let promotedFlags = new Map();
  const fakeDb = {
    externalListing: {
      findMany: async ({ where, cursor }) => (cursor ? [] : rows.filter((r) => !promotedFlags.get(r.id) && (!where.province || where.province.in.includes(r.province)))),
      updateMany: async ({ where }) => { const r = rows.find((x) => x.id === where.id); if (!r || promotedFlags.get(r.id)) return { count: 0 }; return { count: 1 }; },
      update: async ({ where, data }) => { promotedFlags.set(where.id, data.promotedProspectId); listingWrites.push([where.id, data]); return {}; },
      count: async () => 0,
    },
    prospect: {
      // The pool as the database would answer it: one row already on
      // +1 212 555 0111, plus whatever this run created.
      findMany: async ({ where, select }) => {
        if (select.phoneE164) return [{ phoneE164: "+12125550111" }, ...created.map((c) => ({ phoneE164: c.phoneE164 }))].filter((r) => where.phoneE164.in.includes(r.phoneE164));
        if (select.domain) return created.filter((c) => c.domain && where.domain.in.includes(c.domain)).map((c) => ({ domain: c.domain }));
        if (select.googlePlaceId) return created.filter((c) => where.googlePlaceId.in.includes(c.googlePlaceId)).map((c) => ({ googlePlaceId: c.googlePlaceId }));
        return [];
      },
      create: async ({ data }) => { const id = `p-${created.length + 1}`; created.push({ id, ...data }); return { id }; },
    },
    prospectEvidence: { createMany: async () => ({}) },
    salesSuppression: { findMany: async () => [{ kind: "phone", value: "+12125550122" }] },
    $transaction: async (fn) => fn(fakeDb),
  };
  const dry = await promoteListings({ db: fakeDb, dry: true, queueResearch: async (a) => (research.push(a), { queued: a.prospectIds.length }) });
  ok("dry: counts by state and trade, writes nothing, queues nothing", dry.promoted === 2 && dry.byState.NY === 1 && dry.byState.FL === 1 && dry.byTrade.known === 2 && created.length === 0 && research.length === 0 && dry.skipped.duplicate_phone_in_batch === 1 && dry.skipped.duplicate_phone === 1 && dry.skipped.do_not_contact === 1, JSON.stringify(dry.skipped));
  const fl = await promoteListings({ db: { ...fakeDb, externalListing: { ...fakeDb.externalListing, findMany: async ({ where, cursor }) => (cursor ? [] : rows.filter((r) => where.province.in.includes(r.province))) } }, dry: true, regions: ["FL"], queueResearch: async () => ({ queued: 0 }) });
  ok("--state bounds the promotion", fl.considered === 1 && fl.byState.FL === 1 && !fl.byState.NY);
  const wet = await promoteListings({ db: fakeDb, dry: false, queueResearch: async (a) => (research.push(a), { queued: a.prospectIds.length }) });
  ok("applied: two prospects, each listing stamped with its prospect, research queued once for both", wet.promoted === 2 && created.length === 2 && listingWrites.length === 2 && research.length === 1 && research[0].prospectIds.length === 2 && research[0].priority === "backlog" && wet.researchQueued === 2);
  ok("the created rows are what ingest writes: discovered, contractor, the trade, the source", created.every((c) => c.status === "discovered" && c.classification === "contractor" && c.sourceProvider === "google_maps") && created.map((c) => c.tradeKey).sort().join() === "plumbing,roofing");
  const again = await promoteListings({ db: fakeDb, dry: false, queueResearch: async (a) => (research.push(a), { queued: 0 }) });
  ok("idempotent: a second run promotes nothing and queues nothing", again.promoted === 0 && created.length === 2 && research.length === 1);
  ok("the empty report has the shape the panel and the summary read", JSON.stringify(Object.keys(emptyPromotionReport())) === JSON.stringify(["dry", "regions", "considered", "promoted", "researchQueued", "skipped", "byState", "byTrade", "byTradeKey", "byStatus", "rows", "errors"]));
  ok("a promoted row's source has a label and a phone basis on the card", contactBasisFor("google_maps", "phone").sourceLabel === "Google Maps listing" && contactBasisFor("google_maps", "phone").state === "permitted");
}

// ── Rematch: the refused rows through today's rule ─────────────────────
section("rematch");
{
  const listing = normaliseListing({ placeId: "ChIJREMATCHREMATCHREMATCHR", name: "B P Plumbing", category: "Plumber", address: "10 Main St, Lakeside, CA 92040, United States", phone: "+1 619-555-0100", websiteUrl: "https://bpplumb.example/", rating: 4.4, reviewCount: 9, businessStatus: "OPERATIONAL", latitude: 32.85, longitude: -116.92, hours: ["Monday: 8 AM–5 PM"], plusCode: "ABCD+EF", searchTerm: "plumber", searchLocation: "Lakeside, CA" });
  const row = listingRow(listing, { verdict: "no_confident_match", runId: "20260919-000000Z", matchResult: { candidate: { reason: "name_disagrees" } } });
  const stored = { id: "el-r", externalId: row.where.source_externalId.externalId, ...row.create, matchResult: { candidate: { reason: "name_disagrees" } }, lastSeenAt: new Date("2026-09-19T03:00:00Z") };
  const back = normaliseListing(rawFromListingRow(stored));
  const same = ["placeId", "name", "category", "address", "addressLine", "city", "province", "postalCode", "country", "latitude", "longitude", "phone", "phoneE164", "websiteUrl", "domain", "rating", "reviewCount", "businessStatus", "plusCode", "searchTerm", "searchLocation"].filter((k) => JSON.stringify(back[k]) !== JSON.stringify(listing[k]));
  ok("a stored row rebuilds to the listing it came from", same.length === 0 && JSON.stringify(back.hours) === JSON.stringify(listing.hours), same.join(","));
  ok("a CID-only row rebuilds its cid", rawFromListingRow({ externalId: "cid:0x1:0x2", payload: {} }).cid === "0x1:0x2" && rawFromListingRow({ externalId: "cid:0x1:0x2", payload: {} }).placeId === null);
  ok("the where: refused google_maps rows only, --state optional", rematchWhere().matchedProspectId === null && rematchWhere().matchResult.not === null && rematchWhere({ regions: ["NY"] }).province.in.join() === "NY");

  // Over a fake db: the refused row flips to matched under today's rule, dry writes nothing.
  const bpRow = { id: "p-bp", businessName: "BP PLUMBING", addressLine: "10 MAIN ST", city: "LAKESIDE", province: "CA", country: "US", postalCode: "92040", phoneE164: null, domain: null, websiteUrl: null, hasWebsite: null, googlePlaceId: null, googleRating: null, googleReviewCount: null, businessStatus: null, latitude: 32.85, longitude: -116.92, tradingNames: [], assignedRepId: null, campaignId: null };
  const writes = [];
  const tx = { prospect: { update: async (a) => (writes.push(["prospect.update", a]), a) }, prospectEvidence: { createMany: async (a) => (writes.push(["evidence", a]), a) }, salesContactNumber: { create: async (a) => (writes.push(["number", a]), a) }, externalListing: { upsert: async (a) => (writes.push(["listing", a]), { id: "el-r" }) } };
  const fakeDb = {
    externalListing: { findMany: async ({ cursor }) => (cursor ? [] : [stored]), upsert: async (a) => (writes.push(["listing", a]), { id: "el-r", matchedProspectId: null }) },
    prospect: { findMany: async () => [bpRow], findFirst: async () => null },
    salesContactNumber: { findMany: async () => [] },
    $transaction: async (fn) => fn(tx),
  };
  const dry = await rematchUnmatched({ db: fakeDb, dry: true });
  ok("dry: the name_disagrees row now matches, nothing written", dry.considered === 1 && dry.byBefore.name_disagrees === 1 && dry.flipped.matched === 1 && dry.flips[0].prospect === "BP PLUMBING" && writes.length === 0, JSON.stringify(dry));
  const wet = await rematchUnmatched({ db: fakeDb, dry: false });
  ok("applied: the prospect gains the phone and website, the listing is linked, stamps stay at the sighting", wet.flipped.matched === 1 && writes.some((w) => w[0] === "prospect.update" && w[1].data.phoneE164 === "+16195550100" && w[1].data.websiteUrl === "https://bpplumb.example/" && w[1].data.placesCheckedAt.toISOString() === "2026-09-19T03:00:00.000Z") && writes.some((w) => w[0] === "listing" && w[1].update.matchedProspectId === "p-bp" && !("runId" in w[1].update)));
}

// ── The run record and the panel ───────────────────────────────────────
section("run record and panel");
{
  const summary = { ...emptySummary("20260921-020000Z", { regions: ["NY", "FL", "CA"] }), regions: ["NY", "FL", "CA"], skippedOutside: { rows: 61987, claimed: 10, candidates: 61977 }, pairs: 12, placesOpened: 40, placesParsed: 39, written: { matched: 20, matchedVerify: 2, alreadyAttached: 0, noConfidentMatch: 5, noCandidates: 12, placeIdConflict: 0, duplicatePlace: 0, unnamed: 0, errors: 0 }, promoted: { considered: 12, promoted: 9, researchQueued: 9, byState: { NY: 9 }, byTrade: { known: 7, unknown: 2 }, dry: false } };
  const rec = runRecordFrom(summary);
  ok("the record keeps the states, the skipped count, the verify count and the promotion — and no args or file paths", rec.regions.join() === "NY,FL,CA" && rec.skippedOutside.rows === 61987 && rec.written.matchedVerify === 2 && rec.promoted.promoted === 9 && !("args" in rec));
  const kept = keepRuns([{ runId: "20260920-010000Z" }, { runId: "20260921-020000Z", pairs: 1 }], rec);
  ok("keepRuns replaces by runId, newest first, capped", kept.length === 2 && kept[0].runId === "20260921-020000Z" && kept[0].pairs === 12 && keepRuns(Array.from({ length: 30 }, (_, i) => ({ runId: `2026090${i}-000000Z` })), rec).length === RUNS_KEPT);
  const settings = new Map();
  await recordScrapeRun({ db: { platformSetting: { findUnique: async ({ where }) => (settings.has(where.key) ? { value: settings.get(where.key) } : null), upsert: async ({ where, create }) => settings.set(where.key, create.value) } }, summary });
  ok("recordScrapeRun writes the setting the status reads", settings.get(RUNS_SETTING_KEY)?.[0]?.runId === "20260921-020000Z");
  const folded = foldRuns([{ runId: "20260921-020000Z", _count: { _all: 39 }, _min: { createdAt: new Date("2026-09-21T02:10:00Z") }, _max: { updatedAt: new Date("2026-09-21T04:00:00Z"), lastSeenAt: null } }, { runId: "20260920-010000Z", _count: { _all: 5 }, _min: {}, _max: {} }], [{ runId: "20260921-020000Z", _count: { _all: 22 }, _max: {} }], settings.get(RUNS_SETTING_KEY));
  ok("the run's record is joined onto its listing counts by runId; an unrecorded run has asked: null", folded.runs[0].asked?.regions?.join() === "NY,FL,CA" && folded.runs[0].matched === 22 && folded.runs[1].asked === null);
  ok("a recorded run that wrote no listing is still listed", foldRuns([], [], [rec]).runs.length === 1 && foldRuns([], [], [rec]).runs[0].rows === 0);
  const sentence = askedSentence(folded.runs[0]);
  ok("the panel prints the state filter and the skipped count", /States: NY \/ FL \/ CA only/.test(sentence) && /61,987 prospects outside skipped \(10 held, 61,977 next in dispatch\)/.test(sentence) && /promoted 9 of 12/.test(sentence) && /2 attached on phone\/website alone/.test(sentence), sentence);
  ok("an unrecorded run is never printed as 'no filter'", /not recorded/.test(askedSentence(folded.runs[1])) && /no filter/.test(askedSentence({ asked: { regions: null } })));
  ok("promotable now / promoted", promotionSentence({ promotable: 2568, promoted: 12 }) === "promotable now: 2,568 · promoted: 12" && /unavailable/.test(promotionSentence(null)));
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
  ok("the schema carries promotedProspectId and its index", /model ExternalListing \{[\s\S]*?promotedProspectId String\?[\s\S]*?promotedAt\s+DateTime\?[\s\S]*?@@index\(\[promotedProspectId\]\)/.test(schema));
  const mapsSrc = fs.readFileSync(path.join(path.dirname(FIXTURES), "maps.mjs"), "utf8");
  ok("every sweep ends by promoting its own run's listings, and records the run for the panel", /promoteListings\(\{ db, dry: args\.dry, runId, regions: args\.regions \}\)/.test(mapsSrc) && /recordScrapeRun\(\{ db, summary: snapshot \}\)/.test(mapsSrc));
  const bbbSrc = fs.readFileSync(path.join(path.dirname(FIXTURES), "..", "bbb-principal.mjs"), "utf8");
  ok("bbb-principal.mjs takes --state through the same parser and passes it to the batch", /parseRegions/.test(bbbSrc) && /regions: REGIONS/.test(bbbSrc));
  const docsText = fs.readFileSync(path.join(path.dirname(FIXTURES), "..", "..", "docs", "sales", "SCRAPE-LOCAL-RUN.md"), "utf8");
  ok("the run-book names --state, --rematch and --promote", /--state NY,FL,CA/.test(docsText) && /--rematch --apply/.test(docsText) && /--promote --apply/.test(docsText));
  const summary = fs.readFileSync(path.join(path.dirname(FIXTURES), "..", "..", "lib", "platform", "costs", "summary.js"), "utf8");
  ok("/platform/costs reads the local_scrape line", /provider: "local_scrape"/.test(summary) && /key: "local_scrape"/.test(summary));
  const docs = path.join(path.dirname(FIXTURES), "..", "..", "docs", "sales", "SCRAPE-LOCAL-RUN.md");
  ok("the run-book exists and names the commands", fs.existsSync(docs) && /scrape:maps/.test(fs.readFileSync(docs, "utf8")) && /--resume/.test(fs.readFileSync(docs, "utf8")));
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
