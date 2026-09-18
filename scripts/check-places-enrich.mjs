// scripts/check-places-enrich.mjs
//
//   npm run check:places-enrich
//
// Google Places as a corroborating source — lib/sales/intel/places.js and
// placesSweep.js, driven against the shapes that would attach the wrong
// business or overwrite a value somebody typed.
//
// ══ Executed, not read ════════════════════════════════════════════════════
//
// The match rule runs over hostile fixtures: the same name in a different
// city, a similar name next door, a chain with many locations, a generic
// name with only the city in common, a permanently closed listing, no
// results. The write plan runs over a row that already has every field, and
// the assertion is that NOTHING on it changes. checkPlaces runs end to end
// against a scripted fake db: idempotency (a second call inside 90 days
// makes no request), evidence rows, the second phone number, the crawl the
// chain re-runs from, the cost row, the duplicate Place ID, the fatal stop.
// The sweep runs over two reps' claims and honours the per-rep hourly cap.
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
  PLACES_COST_MICROS,
  PLACES_FIELD_MASK,
  PLACES_RECHECK_DAYS,
  PLACES_VERDICTS,
  checkPlaces,
  checkedRecently,
  enrichProspects,
  matchPlaces,
  nameOverlap,
  placeAgreement,
  placesCrawlKey,
  planPlacesWrite,
  projectedCents,
  scoreCandidate,
} from "@/lib/sales/intel/places";
import { PLACES_PER_REP_PER_HOUR, SWEEP_PER_TICK, hourWindow, placesWindowStatus, remainingThisHour, sweepQueuedPlaces } from "@/lib/sales/intel/placesSweep";
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
section("5. checkPlaces end to end — a scripted fake db and a scripted Google");
// ═══════════════════════════════════════════════════════════════════════════

function fakeDb(seed = {}) {
  const prospects = new Map(Object.entries(seed.prospects || {}));
  const state = { evidence: [], numbers: [...(seed.numbers || [])], tasks: [], costs: new Map(), errors: [] };
  const client = {
    state,
    prospect: {
      async findUnique({ where }) {
        const p = prospects.get(where.id);
        return p ? { ...p } : null;
      },
      async findFirst({ where }) {
        for (const p of prospects.values()) {
          if (p.googlePlaceId === where.googlePlaceId && p.id !== where.NOT?.id) return { id: p.id };
        }
        return null;
      },
      async findMany({ where }) {
        const ids = where?.id?.in || [...prospects.keys()];
        return ids.map((id) => prospects.get(id)).filter(Boolean).filter((p) => {
          if (where?.placesCheckedAt === null) return !p.placesCheckedAt;
          return true;
        }).map((p) => ({ ...p }));
      },
      async update({ where, data }) {
        const p = prospects.get(where.id);
        Object.assign(p, data);
        return { ...p };
      },
    },
    salesContactNumber: {
      async findMany({ where }) { return state.numbers.filter((n) => n.prospectId === where.prospectId); },
      async create({ data }) { state.numbers.push(data); return data; },
    },
    prospectEvidence: { async createMany({ data }) { state.evidence.push(...data); return { count: data.length }; } },
    salesPipelineTask: {
      async findUnique({ where }) { return state.tasks.find((t) => t.idempotencyKey === where.idempotencyKey) || null; },
      async create({ data }) { const row = { id: `t${state.tasks.length + 1}`, createdAt: new Date(), ...data }; state.tasks.push(row); return row; },
    },
    platformCostDaily: {
      async upsert({ where, create, update }) {
        const key = `${where.day_provider_category.day.toISOString()}|${where.day_provider_category.provider}|${where.day_provider_category.category}`;
        const row = state.costs.get(key);
        if (!row) { state.costs.set(key, { ...create }); return create; }
        row.cents += update.cents.increment; row.count += update.count.increment; row.units += update.units.increment;
        return row;
      },
      async aggregate() { let cents = 0, count = 0; for (const r of state.costs.values()) { cents += r.cents; count += r.count; } return { _sum: { cents, count } }; },
    },
    salesQueueClaim: { async findMany() { return seed.claims || []; } },
    salesRep: { async findMany() { return seed.reps || []; } },
    platformErrorLog: { async create({ data }) { state.errors.push(data); return data; } },
    async $transaction(fn) { return fn(client); },
  };
  return client;
}

{
  const now = new Date("2026-09-17T20:00:00Z");
  const db = fakeDb({ prospects: { p_dk: { ...DRAIN_KINGS } } });
  let requests = 0;
  const google = async () => { requests += 1; return { ok: true, places: [place()], billed: true }; };

  const first = await checkPlaces({ db, prospectId: "p_dk", now, deps: { searchPlaces: google } });
  ok("the first check matches and fills the row", first.outcome === "checked" && first.verdict === "matched" && first.gained.includes("websiteUrl"), first);
  const row = await db.prospect.findUnique({ where: { id: "p_dk" } });
  ok("…placesCheckedAt, verdict and result are stamped", row.placesCheckedAt === now && row.placesVerdict === "matched" && row.placesResult.placeId === "ChIJ_dk");
  ok("…the website is on the row for the crawler to read", row.websiteUrl === "https://drainkingslosangeles.com/" && row.domain === "drainkingslosangeles.com" && row.hasWebsite === true);
  ok("…the evidence rows were written", db.state.evidence.length >= 6 && db.state.evidence.every((e) => e.prospectId === "p_dk"));
  ok("…the second phone number was written", db.state.numbers.some((n) => n.e164 === "+18009069760" && n.prospectId === "p_dk"));
  ok("…the crawl was queued DIRECTLY, in the claimed lane, forced, with a Places key", db.state.tasks.length === 1 && db.state.tasks[0].kind === "CRAWL_WEBSITE" && db.state.tasks[0].payload.priority === "claimed" && db.state.tasks[0].payload.force === true && db.state.tasks[0].idempotencyKey === placesCrawlKey("p_dk", now), db.state.tasks);
  ok("…and the report says so", first.research?.queued === 1 && first.research?.kind === "CRAWL_WEBSITE", first.research);
  ok("…one request was metered at list price", requests === 1 && [...db.state.costs.values()][0]?.cents === PLACES_COST_MICROS / 10_000 && [...db.state.costs.values()][0]?.count === 1, [...db.state.costs.values()]);

  const second = await checkPlaces({ db, prospectId: "p_dk", now: new Date(now.getTime() + 24 * 3600 * 1000), deps: { searchPlaces: google } });
  ok("a second check a day later makes NO request — idempotent inside the window", second.outcome === "skipped" && second.reason === "checked_recently" && requests === 1, second);
  const forced = await checkPlaces({ db, prospectId: "p_dk", now: new Date(now.getTime() + 24 * 3600 * 1000), force: true, deps: { searchPlaces: google } });
  ok("force re-asks, and the already-filled row gains nothing and loses nothing", forced.outcome === "checked" && forced.gained.length === 0 && requests === 2 && (await db.prospect.findUnique({ where: { id: "p_dk" } })).phoneE164 === "+18185550100", forced);
  ok("…and the second number is not written twice", db.state.numbers.filter((n) => n.e164 === "+18009069760").length === 1);
  ok("…and no second crawl task was queued for the same site the same day", db.state.tasks.length === 1);
  ok("the window is 90 days", checkedRecently(now, { now: new Date(now.getTime() + 89 * 86400000) }) && !checkedRecently(now, { now: new Date(now.getTime() + 91 * 86400000) }) && PLACES_RECHECK_DAYS === 90);

  // Duplicate Place ID across two rows.
  const db2 = fakeDb({ prospects: { p_dk: { ...DRAIN_KINGS, googlePlaceId: "ChIJ_dk" }, p_two: { ...DRAIN_KINGS, id: "p_two", googlePlaceId: null } } });
  const dup = await checkPlaces({ db: db2, prospectId: "p_two", now, deps: { searchPlaces: google } });
  ok("a listing another row already carries is a duplicate verdict, with nothing filled", dup.verdict === PLACES_VERDICTS.DUPLICATE_PLACE && (await db2.prospect.findUnique({ where: { id: "p_two" } })).websiteUrl === null && db2.state.evidence.length === 0, dup);

  // No confident match writes the candidate for a human.
  const db3 = fakeDb({ prospects: { p_dk: { ...DRAIN_KINGS } } });
  const none = await checkPlaces({ db: db3, prospectId: "p_dk", now, deps: { searchPlaces: async () => ({ ok: true, billed: true, places: [place({ formattedAddress: "1 Main St, San Diego, CA 92101, USA", location: null })] }) } });
  const r3 = await db3.prospect.findUnique({ where: { id: "p_dk" } });
  ok("no confident match stores the top candidate and its reason, fills nothing, queues nothing", none.verdict === "no_confident_match" && r3.placesResult.candidate.name === "Drain Kings Los Angeles" && r3.placesResult.candidate.reason === "place_disagrees" && r3.websiteUrl === null && db3.state.tasks.length === 0 && db3.state.evidence.length === 0, r3.placesResult);
  ok("…and the rep card row says so in words", /No confident Google match — the top result was "Drain Kings Los Angeles"/.test(placesRow(r3).text) && placesRow(r3).textKey === "app.salesIntel.fact.googleCheck.unconfirmed");

  // An error does not stamp the row.
  const db4 = fakeDb({ prospects: { p_dk: { ...DRAIN_KINGS } } });
  const err = await checkPlaces({ db: db4, prospectId: "p_dk", now, deps: { searchPlaces: async () => ({ ok: false, status: 403, code: "PERMISSION_DENIED", message: "Places API (New) has not been used", fatal: true, billed: false }) } });
  ok("a denied key is a fatal error, unbilled, and the row is left unchecked for next time", err.outcome === "error" && err.fatal && !err.billed && (await db4.prospect.findUnique({ where: { id: "p_dk" } })).placesCheckedAt === null, err);

  // Do-not-contact and retired rows are never asked about.
  const db5 = fakeDb({ prospects: { dnc: { ...DRAIN_KINGS, id: "dnc", doNotContactAt: now }, ret: { ...DRAIN_KINGS, id: "ret", mergedIntoId: "p_dk" } } });
  let asked = 0;
  const count = async () => { asked += 1; return { ok: true, billed: true, places: [] }; };
  const a = await checkPlaces({ db: db5, prospectId: "dnc", now, deps: { searchPlaces: count } });
  const b = await checkPlaces({ db: db5, prospectId: "ret", now, deps: { searchPlaces: count } });
  ok("do-not-contact and retired rows spend nothing", a.reason === "do_not_contact" && b.reason === "retired_into_survivor" && asked === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The batch — tallies, and a fatal stop");
// ═══════════════════════════════════════════════════════════════════════════
{
  const now = new Date("2026-09-17T20:00:00Z");
  const db = fakeDb({ prospects: {
    a: { ...DRAIN_KINGS, id: "a" },
    b: { ...DRAIN_KINGS, id: "b", businessName: "Plumbing Services Inc", postalCode: null },
    c: { ...DRAIN_KINGS, id: "c", placesCheckedAt: now },
    d: { ...DRAIN_KINGS, id: "d" },
  } });
  const google = async ({ prospect }) => {
    if (prospect.id === "b") return { ok: true, billed: true, places: [place({ id: "g", displayName: { text: "Chatsworth Plumbing Services" }, formattedAddress: "1 Other Rd, Chatsworth, CA, USA", location: null })] };
    if (prospect.id === "d") return { ok: true, billed: true, places: [place({ id: "closed", businessStatus: CLOSED_PERMANENTLY })] };
    return { ok: true, billed: true, places: [place({ id: `pl_${prospect.id}` })] };
  };
  const report = await enrichProspects({ db, ids: ["a", "b", "c", "d", "a"], now, concurrency: 2, deps: { searchPlaces: google } });
  ok("the report tallies matched / unconfirmed / skipped / closed / websites gained", report.asked === 4 && report.checked === 3 && report.skipped === 1 && report.matched === 2 && report.noConfidentMatch === 1 && report.closedPermanently === 1 && report.websitesGained === 2, report);
  ok("…and the cost: three requests at list price", report.requests === 3 && report.costMicros === 3 * PLACES_COST_MICROS && projectedCents(1000) === 3500);
  ok("…and the confirmed/contradicted counts", report.websiteContradicted === 2 && report.phoneContradicted === 2 && report.phoneConfirmed === 0, report);

  const db2 = fakeDb({ prospects: { a: { ...DRAIN_KINGS, id: "a" }, b: { ...DRAIN_KINGS, id: "b" }, c: { ...DRAIN_KINGS, id: "c" } } });
  let calls = 0;
  const denied = async () => { calls += 1; return { ok: false, status: 403, code: "PERMISSION_DENIED", message: "denied", fatal: true, billed: false }; };
  const stopped = await enrichProspects({ db: db2, ids: ["a", "b", "c"], now, concurrency: 1, deps: { searchPlaces: denied } });
  ok("a fatal error stops the batch after the first refusal", stopped.stopped?.code === "PERMISSION_DENIED" && calls === 1 && stopped.errors === 1, stopped);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The standing job — 25 per rep per hour, in queue order");
// ═══════════════════════════════════════════════════════════════════════════
{
  const now = new Date("2026-09-17T22:10:00Z");
  const w = hourWindow(now);
  ok("the window is the clock hour", w.start.toISOString() === "2026-09-17T22:00:00.000Z" && w.end.toISOString() === "2026-09-17T23:00:00.000Z");
  ok("the owner's figure", PLACES_PER_REP_PER_HOUR === 25 && remainingThisHour(25) === 0 && remainingThisHour(3) === 22);

  // Rep A holds 30 rows, 24 already checked this hour; rep B holds 3, none checked.
  const prospects = {};
  const claims = [];
  for (let i = 0; i < 30; i += 1) {
    const id = `a${i}`;
    prospects[id] = { ...DRAIN_KINGS, id, placesCheckedAt: i < 24 ? new Date("2026-09-17T22:01:00Z") : null };
    claims.push({ salesRepId: "rep_a", prospectId: id, claimedAt: new Date("2026-09-17T21:00:00Z"), position: i });
  }
  for (let i = 0; i < 3; i += 1) {
    const id = `b${i}`;
    prospects[id] = { ...DRAIN_KINGS, id };
    claims.push({ salesRepId: "rep_b", prospectId: id, claimedAt: new Date("2026-09-17T21:30:00Z"), position: i });
  }
  const db = fakeDb({ prospects, claims, reps: [{ id: "rep_a", name: "Favor" }, { id: "rep_b", name: "Rachel" }] });
  const status = await placesWindowStatus({ db, now });
  const favor = status.find((s) => s.repId === "rep_a");
  ok("the counter reads 24/25 for Favor with the next window at 23:00", favor.checkedThisHour === 24 && favor.remaining === 1 && favor.nextWindowAt === "2026-09-17T23:00:00.000Z" && favor.name === "Favor", favor);
  ok("…and 6 of her 30 still to check, in queue order", favor.heldUnchecked === 6 && favor.nextIds[0] === "a24");

  const seen = [];
  const google = async ({ prospect }) => { seen.push(prospect.id); return { ok: true, billed: true, places: [place({ id: `pl_${prospect.id}` })] }; };
  const tick = await sweepQueuedPlaces({ db, now, deps: { searchPlaces: google } });
  ok("one tick takes Favor's ONE remaining lookup and all three of Rachel's", seen.filter((id) => id.startsWith("a")).length === 1 && seen[0] === "a24" && seen.filter((id) => id.startsWith("b")).length === 3, seen);
  ok("…and reports each rep's remaining allowance", tick.reps.find((r) => r.repId === "rep_a")?.remainingAfter === 0 && tick.reps.find((r) => r.repId === "rep_b")?.remainingAfter === 22, tick.reps);
  const again = await sweepQueuedPlaces({ db, now: new Date("2026-09-17T22:30:00Z"), deps: { searchPlaces: google } });
  ok("the same hour again: Favor is at 25/25 and nothing more is spent on her", again.asked === 0 && seen.length === 4, again);
  const nextHour = await sweepQueuedPlaces({ db, now: new Date("2026-09-17T23:05:00Z"), deps: { searchPlaces: google } });
  ok("the next hour, her remaining five are taken", nextHour.asked === 5 && seen.slice(4).every((id) => id.startsWith("a")), nextHour);
  ok("a tick is bounded", SWEEP_PER_TICK <= 25);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The card, the brief, the wiring");
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

  const queuePage = read("app/sales/queue/page.js");
  ok("the rep card translates a row's clauses one by one", /f\.parts\.map\(\(part\) => t\(part\.key, part\.text, part\.params/.test(queuePage));
  const queueRoute = read("app/api/sales/queue/route.js");
  ok("the claim route asks Google after the response, through after(), for never-checked rows only", /import \{ NextResponse, after \} from "next\/server"/.test(queueRoute) && /after\(async \(\) => \{/.test(queueRoute) && /placesCheckedAt: null/.test(queueRoute) && /enrichProspects\(\{ db, ids: never/.test(queueRoute));
  ok("…and errors there go to recordError", /recordError\(\{\s*area: "places"/.test(queueRoute));
  const cron = read("app/api/cron/sales-pipeline/route.js");
  ok("the per-minute sales cron runs the sweep in its own try/catch", /sweepQueuedPlaces\(\{ db, now \}\)/.test(cron) && /result\.places = places/.test(cron));
  const briefHandler = read("lib/sales/pipeline/handlers/generateResearchBrief.js");
  ok("the brief's select reads the Places columns", /placesVerdict: true,\s*placesResult: true/.test(briefHandler));
  const enrich = read("app/api/platform/sales/prospects/enrich/route.js");
  ok("the enrich route is superadmin-only, 300 s, and refuses the pool without confirm: true", /superadminOrRefusal/.test(enrich) && /maxDuration = 300/.test(enrich) && /confirm_required/.test(enrich) && /body\?\.confirm !== true/.test(enrich));
  const page = read("app/platform/sales/prospects/page.js");
  ok("the platform page mounts the counters and the per-prospect card behind the superadmin gate", /isSuperadmin \? <GooglePlacesPanel \/> : null/.test(page) && /<GooglePlacesCard prospect=\{p\} onChanged=\{onChanged\} \/>/.test(page));
  const panel = read("app/components/platform/GooglePlacesPanel.js");
  ok("the panel prints the per-rep hourly counter in the owner's words", /Google check: \{w\.checkedThisHour\}\/\{w\.cap\} this hour for \{w\.name\}/.test(panel) && /next window/.test(panel));
  ok("the field mask is exactly the twelve fields costed", PLACES_FIELD_MASK.split(",").length === 12 && /websiteUri/.test(PLACES_FIELD_MASK) && !/reviews|photos|editorialSummary/.test(PLACES_FIELD_MASK));
  const schema = read("prisma/schema.prisma");
  ok("the schema carries the three columns and the index", /placesCheckedAt DateTime\?/.test(schema) && /placesVerdict\s+String\?/.test(schema) && /placesResult\s+Json\?/.test(schema) && /@@index\(\[placesCheckedAt\]\)/.test(schema));
  const pkg = JSON.parse(read("package.json"));
  ok("check:places-enrich is a script and check:all runs it", typeof pkg.scripts?.["check:places-enrich"] === "string" && (pkg.scripts?.["check:all"] || "").includes("check:places-enrich"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
