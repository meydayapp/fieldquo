// scripts/check-places-enrich.mjs
//
//   npm run check:places-enrich
//
// The Google listing match rule and its write plan — lib/sales/intel/
// places.js — driven against the shapes that would attach the wrong
// business or overwrite a value somebody typed.
//
// ══ What this no longer checks ════════════════════════════════════════════
//
// Until 2026-09-20 this script also drove checkPlaces, enrichProspects and
// the per-rep hourly sweep against a scripted Google. The Places API path
// was retired that day (the owner's rule: Google data is read from his Mac
// by scripts/scrape/maps.mjs, never fetched by key; the API had refused
// every request for two days) and the functions were deleted, so sections
// 5–7 went with them and the wiring assertions that named the cron sweep,
// the claim-time after() and the "Check Google" button now live, inverted,
// in scripts/check-places-retired.mjs. What is left is what the Maps scrape
// path still calls: the rule, the write plan, the confirmations, the rep
// card row and the brief fact.
//
// ══ Executed, not read ════════════════════════════════════════════════════
//
// The match rule runs over hostile fixtures: the same name in a different
// city, a similar name next door, a chain with many locations, a generic
// name with only the city in common, a permanently closed listing, no
// results. The write plan runs over a row that already has every field, and
// the assertion is that NOTHING on it changes.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The name threshold, the generic-name rule and the never-overwrite guard
// were each broken on disk, confirmed to fail here, and restored from a
// `cp` backup — never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CLOSED_PERMANENTLY,
  CONFIRMATION_KEYS,
  CONFIRMATION_TEXT,
  NAME_OVERLAP_MIN,
  PLACES_VERDICTS,
  matchPlaces,
  nameOverlap,
  placeAgreement,
  placesCrawlKey,
  planPlacesWrite,
  rerunChainForNewWebsite,
  scoreCandidate,
} from "@/lib/sales/intel/places";
import { placesRow } from "@/lib/sales/prospectView";
import { composeBrief } from "@/lib/sales/intel/brief";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
function section(title) { console.log(`\n${title}`); }

// ── Fixtures ────────────────────────────────────────────────────────────

const DRAIN_KINGS = {
  id: "p_dk",
  businessName: "DRAIN KINGS",
  addressLine: null,
  city: "Chatsworth",
  province: "CA",
  country: "US",
  postalCode: "91311",
  latitude: null,
  longitude: null,
  domain: null,
  websiteUrl: null,
  hasWebsite: null,
  phoneE164: "+18185550100",
  googlePlaceId: null,
  googleRating: null,
  googleReviewCount: null,
  businessStatus: null,
  placesCheckedAt: null,
  doNotContactAt: null,
  mergedIntoId: null,
  assignedRepId: "rep_a",
  campaignId: null,
};

const place = (over = {}) => ({
  id: "ChIJ_dk",
  displayName: { text: "Drain Kings Los Angeles" },
  formattedAddress: "9842 Owensmouth Ave, Chatsworth, CA 91311, USA",
  location: { latitude: 34.2492, longitude: -118.6015 },
  websiteUri: "https://drainkingslosangeles.com/",
  nationalPhoneNumber: "(800) 906-9760",
  internationalPhoneNumber: "+1 800-906-9760",
  rating: 4.7,
  userRatingCount: 97,
  businessStatus: "OPERATIONAL",
  regularOpeningHours: { weekdayDescriptions: ["Monday: 6:00 AM – 11:00 PM"] },
  types: ["plumber"],
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
section("1. Name overlap — suffixes stripped, plurals stemmed, distinctive tokens known");
// ═══════════════════════════════════════════════════════════════════════════
{
  const a = nameOverlap("DRAIN KINGS", "Drain Kings Los Angeles");
  ok("the register's whole name inside Google's longer one is a full match", a.overlap === 1 && a.distinctive, a);
  const b = nameOverlap("Drain Kings Inc.", "Drain King Plumbing");
  ok("Inc. is dropped and Kings/King agree", b.overlap === 1, b);
  const c = nameOverlap("ABC Plumbing", "XYZ Plumbing");
  ok("two plumbers sharing only the trade word are half a match, below the threshold", c.overlap === 0.5 && c.overlap < NAME_OVERLAP_MIN && !c.distinctive, c);
  const d = nameOverlap("Plumbing Services Inc", "Chatsworth Plumbing Services");
  ok("a generic name matches fully but carries no distinctive token", d.overlap === 1 && !d.distinctive, d);
  const e = nameOverlap("Toitures Émard Ltée", "Toiture Emard");
  ok("accents and the French suffix do not break the match", e.overlap === 1 && e.distinctive, e);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Place agreement — strong and weak signals");
// ═══════════════════════════════════════════════════════════════════════════
{
  const strong = placeAgreement(DRAIN_KINGS, place());
  ok("the ZIP is a strong signal", strong.strong && strong.signals.includes("postal_code"), strong);
  const street = placeAgreement({ ...DRAIN_KINGS, postalCode: null, addressLine: "9842 Owensmouth Ave" }, place());
  ok("street number + street is a strong signal", street.strong && street.signals.includes("street"), street);
  const zipAsStreet = placeAgreement({ ...DRAIN_KINGS, postalCode: "9842", city: "Elsewhere" }, place());
  ok("a street number is never read as a ZIP", !zipAsStreet.signals.includes("postal_code"), zipAsStreet);
  const near = placeAgreement({ ...DRAIN_KINGS, postalCode: null, city: null, latitude: 34.2495, longitude: -118.6010 }, place());
  ok("a pin within 1 km is strong", near.strong && near.signals.includes("within_1km"), near);
  const far = placeAgreement({ ...DRAIN_KINGS, postalCode: null, city: null, latitude: 34.05, longitude: -118.25 }, place());
  ok("a pin 40 km away is neither", !far.strong && !far.weak && far.distanceKm > 30, far);
  const cityOnly = placeAgreement({ ...DRAIN_KINGS, postalCode: null }, place());
  ok("the city alone is weak", !cityOnly.strong && cityOnly.weak, cityOnly);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The rule, over hostile candidates");
// ═══════════════════════════════════════════════════════════════════════════
{
  const m = matchPlaces(DRAIN_KINGS, [place()]);
  ok("Drain Kings, Chatsworth matches Drain Kings Los Angeles at 9842 Owensmouth", m.verdict === PLACES_VERDICTS.MATCHED && m.place?.id === "ChIJ_dk", m.score);

  // Same name, different city.
  const elsewhere = matchPlaces(DRAIN_KINGS, [place({ id: "x", formattedAddress: "1 Main St, San Diego, CA 92101, USA", location: { latitude: 32.71, longitude: -117.16 } })]);
  ok("the same name in San Diego is NOT attached", elsewhere.verdict === PLACES_VERDICTS.NO_CONFIDENT_MATCH && elsewhere.score?.reason === "place_disagrees", elsewhere.score);
  ok("…and the top candidate's name is kept for a human", elsewhere.score?.name === "Drain Kings Los Angeles" && elsewhere.place === null);

  // Similar name next door.
  const similar = matchPlaces(DRAIN_KINGS, [place({ id: "y", displayName: { text: "Drain Masters Chatsworth" } })]);
  ok("a similar name at the right address is refused on the name", similar.verdict === PLACES_VERDICTS.NO_CONFIDENT_MATCH && similar.score?.reason === "name_disagrees", similar.score);

  // A chain: two locations, one in the right city.
  const chain = matchPlaces(
    { ...DRAIN_KINGS, businessName: "Roto-Rooter Plumbing", postalCode: null },
    [
      place({ id: "van", displayName: { text: "Roto-Rooter Plumbing & Water Cleanup" }, formattedAddress: "7300 Van Nuys Blvd, Van Nuys, CA 91405, USA", location: { latitude: 34.20, longitude: -118.45 } }),
      place({ id: "chats", displayName: { text: "Roto-Rooter Plumbing & Water Cleanup" }, formattedAddress: "20000 Devonshire St, Chatsworth, CA 91311, USA", location: { latitude: 34.257, longitude: -118.59 } }),
    ],
  );
  ok("a chain attaches the location in the register's city, not the first result", chain.verdict === PLACES_VERDICTS.MATCHED && chain.place?.id === "chats", chain.score);
  const chainWrongCity = matchPlaces(
    { ...DRAIN_KINGS, businessName: "Roto-Rooter Plumbing", postalCode: null },
    [place({ id: "van", displayName: { text: "Roto-Rooter Plumbing & Water Cleanup" }, formattedAddress: "7300 Van Nuys Blvd, Van Nuys, CA 91405, USA", location: { latitude: 34.20, longitude: -118.45 } })],
  );
  ok("…and with only the other city's branch, nothing is attached", chainWrongCity.verdict === PLACES_VERDICTS.NO_CONFIDENT_MATCH, chainWrongCity.score);

  // A generic name with only the city in common.
  const generic = matchPlaces(
    { ...DRAIN_KINGS, businessName: "Plumbing Services Inc", postalCode: null },
    [place({ id: "g", displayName: { text: "Chatsworth Plumbing Services" }, formattedAddress: "1 Other Rd, Chatsworth, CA 91311, USA", location: null })],
  );
  ok("a generic name with only the city in common is refused", generic.verdict === PLACES_VERDICTS.NO_CONFIDENT_MATCH && generic.score?.reason === "generic_name_needs_strong_place", generic.score);
  const genericStrong = matchPlaces(
    { ...DRAIN_KINGS, businessName: "Plumbing Services Inc" },
    [place({ id: "g2", displayName: { text: "Chatsworth Plumbing Services" } })],
  );
  ok("…but with the ZIP it is attached", genericStrong.verdict === PLACES_VERDICTS.MATCHED, genericStrong.score);

  // Closed.
  const closed = matchPlaces(DRAIN_KINGS, [place({ businessStatus: CLOSED_PERMANENTLY })]);
  ok("a permanently closed listing still MATCHES — it is flagged, never dropped", closed.verdict === PLACES_VERDICTS.MATCHED && closed.place?.businessStatus === CLOSED_PERMANENTLY);

  // Nothing.
  ok("no results is its own verdict", matchPlaces(DRAIN_KINGS, []).verdict === PLACES_VERDICTS.NO_RESULTS);
  ok("a candidate without an id is not a candidate", matchPlaces(DRAIN_KINGS, [{ displayName: { text: "Drain Kings" } }]).verdict === PLACES_VERDICTS.NO_RESULTS);

  // Mutation guard on the threshold: a 0.5 overlap must sit below it.
  ok("the threshold refuses a half-name match", scoreCandidate({ ...DRAIN_KINGS, businessName: "ABC Plumbing" }, place({ displayName: { text: "XYZ Plumbing" } })).accept === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The write plan — blanks filled, nothing overwritten, evidence cited");
// ═══════════════════════════════════════════════════════════════════════════
{
  const now = new Date("2026-09-17T20:00:00Z");
  const plan = planPlacesWrite({ prospect: DRAIN_KINGS, place: place(), now });
  ok("a blank row gains the place id, domain, URL, hasWebsite, rating, count, status and pin",
    ["googlePlaceId", "domain", "websiteUrl", "hasWebsite", "googleRating", "googleReviewCount", "businessStatus", "location"].every((k) => plan.gained.includes(k)), plan.gained);
  ok("the domain is normalised the way the ingest does it", plan.data.domain === "drainkingslosangeles.com" && plan.data.websiteUrl === "https://drainkingslosangeles.com/", plan.data);
  ok("a different Google phone becomes a SECOND number, and phoneE164 is untouched",
    plan.contactNumber?.e164 === "+18009069760" && plan.data.phoneE164 === undefined && plan.conflicts.includes("phoneE164"), plan.contactNumber);
  ok("the second number is labelled as Google's and carries the check date", plan.contactNumber?.label === "Google listing" && /2026-09-17/.test(plan.contactNumber?.note || ""));
  ok("every evidence row is google / google_field with a Maps link", plan.evidence.length >= 6 && plan.evidence.every((e) => e.source === "google" && e.type === "google_field" && /place_id:ChIJ_dk/.test(e.sourceUrl)), plan.evidence.map((e) => e.detector));
  ok("the website evidence row reads as a sentence the brief can cite", plan.evidence.some((e) => /Google lists a website the register did not: https:\/\/drainkingslosangeles\.com/.test(e.rawValue) && e.normalizedValue === "drainkingslosangeles.com"));
  ok("the confirmations say what was confirmed and what was contradicted, in words",
    plan.confirmations.some((c) => c.code === "website:added") && plan.confirmations.some((c) => c.code === "phone:differs" && /added as a second number/.test(c.text)) && plan.confirmations.some((c) => c.code === "status:open"),
    plan.confirmations.map((c) => c.code));
  ok("…and they are stored on placesResult for the card", Array.isArray(plan.data.placesResult?.confirmations) && plan.data.placesResult.confirmations.length === plan.confirmations.length);

  // Never overwrite: a row with every field set, and Google disagreeing on all of them.
  const full = {
    ...DRAIN_KINGS,
    domain: "typed-by-hand.com",
    websiteUrl: "https://typed-by-hand.com",
    hasWebsite: false,
    phoneE164: "+18185550100",
    googlePlaceId: "ChIJ_other",
    googleRating: 3.2,
    googleReviewCount: 4,
    businessStatus: "open",
    latitude: 34.0,
    longitude: -118.0,
  };
  const keep = planPlacesWrite({ prospect: full, place: place(), now });
  const touched = Object.keys(keep.data).filter((k) => !["placesCheckedAt", "placesVerdict", "placesResult"].includes(k));
  ok("a fully populated row has NOTHING overwritten — only the three places columns are written", touched.length === 0, touched);
  ok("…every disagreement is recorded as a conflict beside the row", ["googlePlaceId", "domain", "websiteUrl", "phoneE164", "googleRating", "googleReviewCount", "businessStatus"].every((k) => keep.conflicts.includes(k)), keep.conflicts);
  ok("…hasWebsite: false is never flipped by a directory", keep.data.hasWebsite === undefined);
  ok("…and Google's own values sit in placesResult", keep.data.placesResult.websiteUri === "https://drainkingslosangeles.com/" && keep.data.placesResult.phone === "+1 800-906-9760");
  ok("…the website confirmation says 'differs — the record's was kept'", keep.confirmations.some((c) => c.code === "website:differs" && /kept/.test(c.text)));

  // Confirmed: same phone, same site.
  const agree = planPlacesWrite({ prospect: { ...DRAIN_KINGS, phoneE164: "+18009069760", domain: "drainkingslosangeles.com", websiteUrl: "https://drainkingslosangeles.com" }, place: place(), now });
  ok("the same phone and site read as CONFIRMED", agree.confirmations.some((c) => c.code === "phone:confirmed") && agree.confirmations.some((c) => c.code === "website:confirmed") && agree.contactNumber === null, agree.confirmations.map((c) => c.code));
  ok("…and the evidence says 'Google confirms the phone number'", agree.evidence.some((e) => /^Google confirms the phone number/.test(e.rawValue)));

  // A closed listing.
  const closed = planPlacesWrite({ prospect: DRAIN_KINGS, place: place({ businessStatus: CLOSED_PERMANENTLY }), now });
  ok("a closed listing writes businessStatus verbatim and the closed confirmation, and nothing suppresses the row", closed.data.businessStatus === CLOSED_PERMANENTLY && closed.confirmations.some((c) => c.code === "status:closed") && closed.data.doNotContactAt === undefined && closed.data.status === undefined);

  // Duplicate place id.
  const dup = planPlacesWrite({ prospect: DRAIN_KINGS, place: place(), placeIdTakenBy: "p_other", now });
  ok("a Place ID another prospect carries is a duplicate verdict with nothing filled", dup.verdict === PLACES_VERDICTS.DUPLICATE_PLACE && dup.gained.length === 0 && dup.evidence.length === 0 && dup.data.placesResult.duplicateOfProspectId === "p_other");

  // A site whose domain disagrees with the record's domain does not fill websiteUrl.
  const halfway = planPlacesWrite({ prospect: { ...DRAIN_KINGS, domain: "other.com" }, place: place(), now });
  ok("a URL on a different domain from the record's is never written beside it", halfway.data.websiteUrl === undefined && halfway.conflicts.includes("domain"));

  // Every confirmation code has a key and a translation in en/fr/es.
  const codes = Object.keys(CONFIRMATION_TEXT);
  ok("every confirmation code has an i18n key", codes.every((c) => typeof CONFIRMATION_KEYS[c] === "string"));
  for (const lang of ["en", "fr", "es"]) {
    ok(`…and ${lang} has every key`, codes.every((c) => typeof APP_MESSAGES[lang][CONFIRMATION_KEYS[c]] === "string"), codes.filter((c) => !APP_MESSAGES[lang][CONFIRMATION_KEYS[c]]));
  }
  ok("the English text is the en catalogue's, so a fallback and a translation agree", codes.every((c) => APP_MESSAGES.en[CONFIRMATION_KEYS[c]] === CONFIRMATION_TEXT[c]));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The crawl re-run, the card, the brief, the wiring");
// ═══════════════════════════════════════════════════════════════════════════
{
  const unchecked = placesRow({ placesCheckedAt: null });
  ok("an unchecked row says so, as unknown, with its key", !unchecked.known && unchecked.textKey === "app.salesIntel.fact.googleCheck.notChecked");
  const matched = placesRow({ placesCheckedAt: new Date("2026-09-17T20:00:00Z"), placesVerdict: "matched", placesResult: { name: "Drain Kings Los Angeles", confirmations: [
    { code: "phone:confirmed", key: CONFIRMATION_KEYS["phone:confirmed"], text: CONFIRMATION_TEXT["phone:confirmed"], params: {} },
    { code: "website:added", key: CONFIRMATION_KEYS["website:added"], text: "Google lists a website the register did not (drainkingslosangeles.com)", params: { site: "drainkingslosangeles.com" } },
  ] } });
  ok("a matched row reads 'Google confirms the phone; Google lists a website the register did not'", /^Google confirms the phone; Google lists a website the register did not \(drainkingslosangeles\.com\) \(checked 2026-09-17\)$/.test(matched.text) && matched.parts.length === 2 && matched.parts[1].params.site === "drainkingslosangeles.com", matched);
  ok("…each clause carries its own key for the rep's language", matched.parts.every((p) => typeof p.key === "string" && APP_MESSAGES.fr[p.key]));

  const brief = composeBrief({ prospect: { ...DRAIN_KINGS, websiteUrl: "https://drainkingslosangeles.com/", placesVerdict: "matched", placesResult: { confirmations: [
    { code: "status:closed", text: CONFIRMATION_TEXT["status:closed"] },
    { code: "website:added", text: "Google lists a website the register did not (drainkingslosangeles.com)" },
  ] } } });
  ok("the brief carries the Google check as a fact sourced to Google", brief.known.some((k) => k.id === "google_check" && k.source === "google_places" && /website the register did not/.test(k.detail)));
  ok("…and a closed listing is its own fact, so the script cannot miss it", brief.known.some((k) => k.id === "google_closed" && /PERMANENTLY CLOSED/.test(k.detail)));

  // The crawl a gained website queues — what listings.js calls after a
  // match fills websiteUrl. One enqueue, claimed lane for a held row,
  // forced, keyed per prospect per day.
  {
    const tasks = [];
    const db = {
      salesPipelineTask: {
        // Honours `select`, as Prisma does: a dedupe hit comes back with the
        // selected columns only, and no createdAt is how the caller reads "not
        // queued by me".
        async findUnique({ where, select }) {
          const row = tasks.find((t) => t.idempotencyKey === where.idempotencyKey);
          if (!row) return null;
          return select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]])) : { ...row };
        },
        async create({ data }) { const row = { id: `t${tasks.length + 1}`, createdAt: new Date(), ...data }; tasks.push(row); return row; },
      },
    };
    const now = new Date("2026-09-17T20:00:00Z");
    const r = await rerunChainForNewWebsite({ db, prospect: { ...DRAIN_KINGS, websiteUrl: "https://drainkingslosangeles.com/" }, now });
    ok("a gained website queues ONE forced crawl in the claimed lane, keyed per prospect per day", r.queued === 1 && tasks.length === 1 && tasks[0].kind === "CRAWL_WEBSITE" && tasks[0].payload.priority === "claimed" && tasks[0].payload.force === true && tasks[0].idempotencyKey === placesCrawlKey("p_dk", now), tasks);
    const again = await rerunChainForNewWebsite({ db, prospect: { ...DRAIN_KINGS, websiteUrl: "https://drainkingslosangeles.com/" }, now });
    ok("…and the same day again queues nothing", tasks.length === 1 && again.queued === 0, again);
    const backlog = await rerunChainForNewWebsite({ db, prospect: { ...DRAIN_KINGS, id: "p_pool", assignedRepId: null }, now });
    ok("a row nobody holds goes to the backlog lane", backlog.priority === "backlog" && tasks[1]?.payload.priority === "backlog");
  }

  const queuePage = read("app/sales/queue/page.js");
  ok("the rep card translates a row's clauses one by one", /f\.parts\.map\(\(part\) => t\(part\.key, part\.text, part\.params/.test(queuePage));
  const briefHandler = read("lib/sales/pipeline/handlers/generateResearchBrief.js");
  ok("the brief's select reads the listing columns", /placesVerdict: true,\s*placesResult: true/.test(briefHandler));
  const listings = read("lib/sales/intel/listings.js");
  ok("the Maps scrape path is what runs the rule and the write plan now", /planPlacesWrite\(\{/.test(listings) && /scoreCandidate,/.test(listings) && /provenance: MAPS_PROVENANCE/.test(listings));
  const page = read("app/platform/sales/prospects/page.js");
  ok("the platform page mounts the Maps panel and the read-only listing card behind the superadmin gate", /isSuperadmin \? <MapsScrapePanel \/> : null/.test(page) && /<MapsListingCard prospect=\{p\} \/>/.test(page));
  const schema = read("prisma/schema.prisma");
  ok("the schema carries the three columns and the index", /placesCheckedAt DateTime\?/.test(schema) && /placesVerdict\s+String\?/.test(schema) && /placesResult\s+Json\?/.test(schema) && /@@index\(\[placesCheckedAt\]\)/.test(schema));
  const pkg = JSON.parse(read("package.json"));
  ok("check:places-enrich is a script and check:all runs it", typeof pkg.scripts?.["check:places-enrich"] === "string" && (pkg.scripts?.["check:all"] || "").includes("check:places-enrich"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
