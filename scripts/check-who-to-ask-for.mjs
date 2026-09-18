// scripts/check-who-to-ask-for.mjs
//
//   npm run check:who-to-ask-for
//
// The named person on a lead — lib/sales/intel/people.js, registerPeople.js,
// bbbProfile.js, listingMatch.js, bbbApply.js, enrichmentOrder.js,
// apifyRuns.js — driven against the shapes that would put the wrong name
// on a card or overwrite one somebody typed.
//
// ══ Executed, not read ════════════════════════════════════════════════════
//
// The CSLB row parser runs over the file's own shapes: a person whose
// every stint has ended, a "Principal| AKA" double name, a "Business" name
// type, a JR suffix in the fourth column, an accented two-word given name.
// The BBB parser runs over the saved AMS profile and search pages, an
// empty page, a page with two principals and "Mr./Mrs." prefixes. The
// matcher runs over the same name in a different city, a chain with two
// locations, a phone-only match with a different name. The write plans
// run over a row that already has every field and the assertion is that
// nothing on it changes. Typed beats fetched is asserted on the ranking.
// The upload path is driven against a scripted db and refuses a profile
// whose city and phone disagree with the prospect it names.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { splitCsvLine } from "@/lib/sales/discovery/rbq/licence";
import {
  PEOPLE_SOURCES,
  bbbFactLine,
  bbbSearchUrl,
  cslbPersonName,
  nameKeyFor,
  planPeopleWrite,
  principalFor,
  rankPeople,
  roleRank,
  tidyPersonName,
  whoToAskFor,
} from "@/lib/sales/intel/people";
import { CSLB_PERSONNEL_COLUMNS, REGISTERS_WITH_PEOPLE, cslbPeopleFromRow, peopleFromRegisterRows, registerLicenceNumber } from "@/lib/sales/intel/registerPeople";
import { parseBbbProfile, parseBbbSearch, parseContactLine, searchResultAsListing } from "@/lib/sales/intel/bbbProfile";
import { listingAsPlace, matchListings, planBbbWrite } from "@/lib/sales/intel/listingMatch";
import { applyBbbRow, profileAsListing } from "@/lib/sales/intel/bbbApply";
import { aheadOfDispatcher, orderCandidates, pairsFromRows } from "@/lib/sales/intel/enrichmentOrder";
import { ACTORS, ingestListings, pairKeyFor, projectedPairCents, searchKeywordFor } from "@/lib/sales/intel/apifyRuns";
import { meterApifyRun } from "@/lib/sales/intel/apify";
import { placeAgreement, planPlacesWrite } from "@/lib/sales/intel/places";
import { directoryFacts } from "@/lib/sales/intel/callScript";
import { composeBrief } from "@/lib/sales/intel/brief";
import { whoToAskRow, bbbRow, prospectFacts } from "@/lib/sales/prospectView";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${typeof got === "string" ? got : JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

// ── 1. Names ─────────────────────────────────────────────────────────────
section("1. Names, tidied");
ok("honorific dropped, given name split", tidyPersonName("Mr. Alexander Singer").givenName === "Alexander");
ok("Mrs. with a hyphenated accented surname keeps the accent", tidyPersonName("Mrs. Monica Williams-López").name === "Monica Williams-López");
ok("a mononym has no given name (no guess)", tidyPersonName("Madonna").givenName === null);
ok("ALL CAPS is title-cased, mixed case is left alone", tidyPersonName("JOHN SMITH JR").name === "John Smith Jr" && tidyPersonName("Jean-Luc DeMarco").name === "Jean-Luc DeMarco");
ok("a suffix is not a family name", tidyPersonName("John Smith Jr").familyName === "Smith");
ok("CSLB fixed-width LAST FIRST MIDDLE → First Middle Last", cslbPersonName("SINGER                             ALEXANDER      MATTHEW").name === "Alexander Matthew Singer");
ok("CSLB JR in the fourth column becomes a suffix", cslbPersonName("BRIARE                             RICHARD        W           JR").name === "Richard W Briare Jr");
ok("CSLB two-word given name with accents survives", cslbPersonName("DE LA CRUZ                         MARÍA JOSÉ").name === "María José De La Cruz");
ok("CSLB one-part name is not split", cslbPersonName("RFMCO HOLDCO INC").givenName === null);
ok("nameKey folds case, accents and punctuation", nameKeyFor("Monica Williams-López") === nameKeyFor("MONICA WILLIAMS LOPEZ"));

// ── 2. CSLB rows ─────────────────────────────────────────────────────────
section("2. The CSLB personnel row parser");
const row = (line) => cslbPeopleFromRow(splitCsvLine(line));
const AMS = "1090449,04/22/2022,Class/Title,1067552, Principal, SINGER                             ALEXANDER      MATTHEW, Responsible Managing Officer/Chief Executive Officer/President, C36, Y, 04/22/2022, ,Percentage Statement,,,,04/22/2022,,,";
ok("the header has the file's 19 columns", CSLB_PERSONNEL_COLUMNS.length === 19 && splitCsvLine(AMS).length === 19);
const amsRows = row(AMS);
ok("AMS's RMO is read with title, class and date", amsRows.length === 1 && amsRows[0].name === "Alexander Matthew Singer" && amsRows[0].classes[0] === "C36" && amsRows[0].associatedAt.toISOString().startsWith("2022-04-22"), amsRows);
ok("every stint ended → nobody current", row("8,01/03/2024,Class/Title,728121, Principal, DAVIS                              DANA           MICHAEL, Officer| Officer, | , | , 03/06/2002| 11/06/2018, 04/04/2007| 12/26/2023,,,,,,,,").length === 0);
const mixed = row("9,01/01/2024,Class/Title,1, Principal, NILSEN                             MARK           ALAN, Officer| Responsible Managing Officer, | C57, N| N, 03/05/2003| 04/30/2003, 04/30/2003| ,,,,,,,,");
ok("only the CURRENT stint's title and class are kept", mixed.length === 1 && mixed[0].titles.join() === "Responsible Managing Officer" && mixed[0].classes.join() === "C57", mixed);
const aka = row("88,06/27/2004,Class/Title,15972, Principal| AKA, BRUNS                              LYNN           LUYET| KETTERING                          LYNN           LAVON, Responsible Managing Employee, C-8, N, 11/29/1990, ,,,,,,,,");
ok("Principal| AKA is one person under the first name", aka.length === 1 && aka[0].name === "Lynn Luyet Bruns");
ok("a Business name type is not a person", row("220117,05/17/2024,Class/Title,1104951, Business, RFMCO HOLDCO INC, LLC Member, , , 05/17/2024, ,,,,,,,,").length === 0);
ok("an empty row is nothing", cslbPeopleFromRow([]).length === 0 && cslbPeopleFromRow(null).length === 0);
ok("register rows become people with the compound title as the role", peopleFromRegisterRows([{ name: "A B", titles: ["Officer", "Sole Owner"] }])[0].role === "Officer / Sole Owner");
ok("the US boards' licence number is sourceRecordId; RBQ's is licenceNumber", registerLicenceNumber({ sourceRecordId: "1090449" }) === "1090449" && registerLicenceNumber({ licenceNumber: "1104-8618-06", sourceRecordId: "x" }) === "1104-8618-06");
ok("CSLB, WA and OR carry a person; RBQ and Overture do not", REGISTERS_WITH_PEOPLE.us_ca_cslb && REGISTERS_WITH_PEOPLE.us_wa_lni && REGISTERS_WITH_PEOPLE.us_or_ccb && !REGISTERS_WITH_PEOPLE.rbq && !REGISTERS_WITH_PEOPLE.overture);

// ── 3. Which name leads ──────────────────────────────────────────────────
section("3. Which name leads");
const cslb = { name: "Alexander Matthew Singer", role: "Responsible Managing Officer/Chief Executive Officer/President", source: "cslb_personnel", seenAt: "2026-09-17" };
const officer = { name: "Monica Macera Williams", role: "Officer", source: "cslb_personnel", seenAt: "2026-09-17" };
const bbb = { name: "Alexander Singer", role: "Owner", source: "bbb", seenAt: "2026-09-18" };
const typed = { name: "Alex", role: null, source: "typed", seenAt: "2026-09-18T10:00:00Z" };
const typedOlder = { name: "Al", role: null, source: "typed", seenAt: "2026-09-18T09:00:00Z" };
ok("the RMO/CEO outranks a plain officer inside one source", principalFor([officer, cslb]).name === cslb.name);
ok("BBB's principal beats the register's", principalFor([cslb, bbb]).name === "Alexander Singer" && principalFor([cslb, bbb]).source === "bbb");
ok("typed beats fetched, and the newest typed wins", principalFor([bbb, cslb, typedOlder, typed]).name === "Alex");
ok("a Responsible Managing EMPLOYEE ranks behind an officer", roleRank("Responsible Managing Employee") > roleRank("Officer") && roleRank("Sole Owner") === 0);
ok("an unknown role sits behind every known one", roleRank("Grand Poobah") > roleRank("Responsible Managing Employee"));
const who = whoToAskFor([cslb, bbb, officer]);
ok("the line names the person, the role and the source", who.text === "Alexander Singer — Owner (per BBB profile, 2026-09-18)" && who.givenName === "Alexander", who);
ok("the others follow with their sources", who.others.length === 2 && who.others[0].source === "cslb_personnel");
ok("no people → null, never an invented name", whoToAskFor([]) === null && whoToAskFor(null) === null);
ok("every source has a rank and a label", Object.values(PEOPLE_SOURCES).every((s) => Number.isInteger(s.rank) && s.label));
ok("rankPeople drops a row with no name", rankPeople([{ name: "", source: "bbb" }, bbb]).length === 1);

// ── 4. Never overwritten ─────────────────────────────────────────────────
section("4. Never overwritten");
const plan = planPeopleWrite({ prospectId: "p", people: [{ name: "Alexander Singer", role: "Owner" }, { name: "ALEXANDER SINGER", role: "Owner" }, { name: "Monica Williams", role: "Director" }], source: "bbb", sourceUrl: "https://bbb/x", seenAt: new Date("2026-09-18T00:00:00Z"), existing: [{ source: "bbb", nameKey: nameKeyFor("Monica Williams") }] });
ok("a name already there for that source is skipped, a duplicate within the batch is one row", plan.rows.length === 1 && plan.skipped === 1);
ok("the evidence row cites the source in a sentence", plan.evidence[0].rawValue === "BBB profile lists Alexander Singer as Owner" && plan.evidence[0].type === "person");
ok("the same name from ANOTHER source is its own row", planPeopleWrite({ prospectId: "p", people: [{ name: "Monica Williams" }], source: "typed", existing: [{ source: "bbb", nameKey: nameKeyFor("Monica Williams") }], typedBySalesRepId: "rep1" }).rows[0]?.typedBySalesRepId === "rep1");
ok("typedBySalesRepId is only ever set on a typed row", planPeopleWrite({ prospectId: "p", people: [{ name: "X Y" }], source: "bbb", typedBySalesRepId: "rep1" }).rows[0].typedBySalesRepId === null);
ok("an unknown source writes nothing", planPeopleWrite({ prospectId: "p", people: [{ name: "X Y" }], source: "linkedin" }).rows.length === 0);

// ── 5. BBB parser ────────────────────────────────────────────────────────
section("5. The BBB profile and search parsers, on saved pages");
const profile = parseBbbProfile(read("scripts/fixtures/bbb/ams-plumbing-drain.profile.html"));
ok("AMS: the principal contact with title, from JSON-LD", profile.people.some((p) => p.name === "Alexander Singer" && p.role === "Owner" && p.kind === "principal"));
ok("AMS: business management listed too, flagged as management", profile.people.some((p) => p.name === "Monica Williams" && p.role === "Director" && p.kind === "management"));
ok("AMS: started year, entity, rating, accreditation, years", profile.businessStartedYear === 2021 && profile.entityType === "Corporation" && profile.rating === "A+" && profile.accredited === false && profile.yearsInBusiness === 4, profile);
ok("AMS: phone, website, address, geo", profile.phone === "(619) 847-8330" && profile.website === "https://amsplumbinganddrain.com" && profile.address.city === "Lakeside" && profile.location?.latitude === 32.909873);
ok("AMS: the profile URL", profile.url === "https://www.bbb.org/us/ca/lakeside/profile/plumber/ams-plumbing-drain-1126-1000102899");
ok("an empty page is not a profile", parseBbbProfile("") === null && parseBbbProfile("<html><body>Just a moment…</body></html>") === null);
const twoPrincipals = parseBbbProfile('<html><head></head><body><span id="businessName">Two Owners Plumbing</span><dl><div><dt>Principal Contacts</dt><dd>Mr. José Núñez, Co-Owner</dd><dd>Mrs. Ann-Marie O\'Brien, Co-Owner</dd></div><div><dt>Number of Employees</dt><dd>2 - 5</dd></div><div><dt>Type of Entity</dt><dd>Limited Liability Company (LLC)</dd></div></dl></body></html>');
ok("two principals with Mr./Mrs. prefixes and accents, both kept, prefixes dropped", twoPrincipals.people.length === 2 && twoPrincipals.people[0].name === "José Núñez" && twoPrincipals.people[1].name === "Ann-Marie O'Brien" && twoPrincipals.people.every((p) => p.role === "Co-Owner"), twoPrincipals.people);
ok("employee band and entity from the <dl> when JSON-LD has none", twoPrincipals.employeeRange === "2-5" && twoPrincipals.entityType === "Limited Liability Company (LLC)");
ok("a page with a name and no Principal Contacts block names nobody", parseBbbProfile('<html><body><span id="businessName">Quiet Co</span><dl><div><dt>Type of Entity:</dt><dd>Sole Proprietorship</dd></div></dl></body></html>').people.length === 0);
ok("a contact line with no role keeps the name", parseContactLine("Ms. Priya Patel").role === null && parseContactLine("Ms. Priya Patel").name === "Priya Patel");
ok("malformed JSON-LD does not throw, the <dl> still reads", parseBbbProfile('<html><head><script type="application/ld+json">{bad json</script></head><body><span id="businessName">X</span><dl><div><dt>Principal Contacts</dt><dd>Mr. A B, Owner</dd></div></dl></body></html>').people[0].name === "A B");
const results = parseBbbSearch(read("scripts/fixtures/bbb/ams-plumbing-drain.search.html"));
ok("the search page lists 9 businesses from JSON-LD, ads excluded", results.length === 9);
ok("<em> highlight tags are stripped from names", results[6].name === "AMS Plumbing & Drain");
ok("an addressId suffix is dropped so a chain's locations share the profile", results.filter((r) => /conejo-services-llc-1216/.test(r.url)).every((r) => !/addressId/.test(r.url)));
ok("a search page with no JSON-LD lists nothing", parseBbbSearch("<html></html>").length === 0);

// ── 6. The matcher, hostile ──────────────────────────────────────────────
section("6. The matcher — the Places rule over listings");
const ams = { id: "ams", businessName: "AMS PLUMBING & DRAIN", city: "LAKESIDE", province: "CA", country: "US", postalCode: "92040", addressLine: "8539 AMATO DRIVE", phoneE164: "+16198478330" };
const listings = results.map(searchResultAsListing);
const m = matchListings(ams, listings);
ok("AMS matches its own profile on postal code, city and phone", m.verdict === "matched" && /ams-plumbing-drain/.test(m.listing.externalId) && m.score.placeSignals.includes("phone"), m.score);
ok("the same name in another city with no phone is refused", matchListings({ ...ams, phoneE164: null, city: "Fresno", postalCode: "93701", addressLine: null }, listings).verdict === "no_confident_match");
ok("a phone that agrees but a name that does not is refused", matchListings({ ...ams, businessName: "Singer Enterprises" }, listings).score.reason === "name_disagrees");
ok("a chain with two locations: the generic name needs a strong place signal", matchListings({ id: "c", businessName: "Conejo Services", city: "Los Angeles", province: "CA", country: "US", postalCode: null, phoneE164: null }, listings).verdict === "no_confident_match");
ok("a chain's right location matches by phone", matchListings({ id: "c", businessName: "Conejo Services LLC", city: "Valencia", province: "CA", country: "US", phoneE164: "+18054990448" }, listings).listing?.city === "Valencia" || matchListings({ id: "c", businessName: "Conejo Services LLC", city: "Valencia", province: "CA", country: "US", phoneE164: "+18054990448" }, listings).verdict === "matched");
ok("no listings → no_results", matchListings(ams, []).verdict === "no_results");
ok("phone agreement is a STRONG signal in placeAgreement", placeAgreement({ phoneE164: "+16198478330" }, { nationalPhoneNumber: "(619) 847-8330", formattedAddress: "" }).strong === true);
ok("a listing becomes a Place with the fields the rule reads", listingAsPlace({ externalId: "u", name: "N", city: "C", province: "CA", postalCode: "9", country: "US", latitude: 1, longitude: 2, phone: "1" }).formattedAddress === "C, CA 9, US");

// ── 7. The BBB write plan ────────────────────────────────────────────────
section("7. The BBB write plan — blank-only");
const blank = { ...ams, bbbProfileUrl: null, bbbRating: null, bbbAccredited: null, businessStartedYear: null, employeeRange: null, entityType: null, domain: null, websiteUrl: null, hasWebsite: null };
const p1 = planBbbWrite({ prospect: blank, profile, now: new Date("2026-09-18T00:00:00Z") });
ok("a blank row gains the profile, rating, accreditation, year, entity, website", ["bbbProfileUrl", "bbbRating", "bbbAccredited", "businessStartedYear", "entityType", "domain", "websiteUrl", "hasWebsite"].every((f) => p1.gained.includes(f)) && p1.conflicts.length === 0, p1);
ok("the phone that agrees is confirmed, not re-written", !p1.gained.includes("phoneE164") && p1.evidence.some((e) => /confirms the phone/.test(e.rawValue)));
const full = { ...ams, bbbProfileUrl: "https://other", bbbRating: "B", bbbAccredited: true, businessStartedYear: 1999, employeeRange: "10-19", entityType: "LLC", domain: "other.com", websiteUrl: "https://other.com", hasWebsite: true, phoneE164: "+15550000000" };
const p2 = planBbbWrite({ prospect: full, profile, existingNumbers: [], now: new Date("2026-09-18T00:00:00Z") });
ok("a full row: NOTHING but the stamp is written, every disagreement is a conflict", Object.keys(p2.data).join() === "bbbCheckedAt" && p2.gained.join() === "contactNumber" && p2.conflicts.includes("bbbRating") && p2.conflicts.includes("domain") && p2.conflicts.includes("phoneE164"), { data: p2.data, gained: p2.gained, conflicts: p2.conflicts });
ok("a differing phone becomes a second number, never the record's", p2.contactNumber?.e164 === "+16198478330" && p2.contactNumber.label === "BBB profile");
ok("the second number is not added twice", planBbbWrite({ prospect: full, profile, existingNumbers: ["+16198478330"] }).contactNumber === null);
ok("the Maps origin changes the evidence detector and nothing on the row", (() => {
  const a = planPlacesWrite({ prospect: blank, place: listingAsPlace({ externalId: "pid", name: "AMS PLUMBING & DRAIN", city: "Lakeside", province: "CA", postalCode: "92040", country: "US", phone: "(619) 847-8330", websiteUrl: "https://amsplumbinganddrain.com", rating: "4.8", reviewCount: 12, source: "google_maps" }), now: new Date("2026-09-18T00:00:00Z") });
  const b = planPlacesWrite({ prospect: blank, place: listingAsPlace({ externalId: "pid", name: "AMS PLUMBING & DRAIN", city: "Lakeside", province: "CA", postalCode: "92040", country: "US", phone: "(619) 847-8330", websiteUrl: "https://amsplumbinganddrain.com", rating: "4.8", reviewCount: 12, source: "google_maps" }), now: new Date("2026-09-18T00:00:00Z"), origin: { detector: "maps.apify", detectorVersion: "1" } });
  const same = ["googlePlaceId", "domain", "websiteUrl", "googleRating", "googleReviewCount", "placesVerdict"].every((k) => JSON.stringify(a.data[k]) === JSON.stringify(b.data[k]));
  return same && b.evidence[0].detector.startsWith("maps.apify:") && a.evidence[0].detector.startsWith("places.textSearch:") && b.data.placesResult.origin === "maps.apify";
})());

// ── 8. The upload path refuses a wrong profile ───────────────────────────
section("8. The server re-matches an uploaded row");
function fakeDb(prospect) {
  const rows = { prospect: [prospect], prospectPerson: [], prospectEvidence: [], salesContactNumber: [] };
  const db = {
    __rows: rows,
    prospect: {
      findUnique: async ({ where }) => rows.prospect.find((p) => p.id === where.id) || null,
      update: async ({ where, data }) => Object.assign(rows.prospect.find((p) => p.id === where.id), data),
    },
    prospectPerson: {
      findMany: async ({ where }) => rows.prospectPerson.filter((p) => p.prospectId === where.prospectId),
      createMany: async ({ data }) => {
        for (const d of data) if (!rows.prospectPerson.some((x) => x.prospectId === d.prospectId && x.source === d.source && x.nameKey === d.nameKey)) rows.prospectPerson.push(d);
      },
    },
    prospectEvidence: { createMany: async ({ data }) => rows.prospectEvidence.push(...data), create: async ({ data }) => rows.prospectEvidence.push(data) },
    salesContactNumber: { findMany: async () => rows.salesContactNumber, create: async ({ data }) => rows.salesContactNumber.push(data) },
    $transaction: async (fn) => fn(db),
  };
  return db;
}
{
  const db = fakeDb({ ...blank, mergedIntoId: null, bbbCheckedAt: null });
  const r = await applyBbbRow({ db, row: { prospectId: "ams", profile }, now: new Date("2026-09-18T00:00:00Z") });
  ok("a profile that IS the prospect is applied, people and facts written", r.outcome === "matched" && r.peopleAdded === 2 && db.__rows.prospect[0].bbbRating === "A+" && db.__rows.prospectPerson.length === 2, r);
  const again = await applyBbbRow({ db, row: { prospectId: "ams", profile }, now: new Date("2026-09-18T00:00:00Z") });
  ok("the same profile again is already_known — nothing re-written", again.outcome === "already_known" && db.__rows.prospectPerson.length === 2);
}
{
  const db = fakeDb({ ...blank, id: "other", businessName: "Fresno Drain Kings", city: "Fresno", postalCode: "93701", phoneE164: "+15591112222", addressLine: null, mergedIntoId: null, bbbCheckedAt: null });
  const r = await applyBbbRow({ db, row: { prospectId: "other", profile }, now: new Date("2026-09-18T00:00:00Z") });
  ok("a profile whose name, city and phone disagree with the prospect it names is REFUSED", r.outcome === "refused" && r.reason === "name_disagrees" && db.__rows.prospectPerson.length === 0 && db.__rows.prospect[0].bbbRating === null, r);
  ok("…and the prospect is stamped so it is not searched again this season", db.__rows.prospect[0].bbbCheckedAt !== null);
}
{
  const db = fakeDb({ ...blank, mergedIntoId: null, bbbCheckedAt: null });
  const r = await applyBbbRow({ db, row: { prospectId: "ams", profile: null, reason: "no_confident_match", topCandidate: { name: "Morey Plumbing", url: "https://bbb/m", reason: "name_disagrees", city: "San Diego" } }, now: new Date("2026-09-18T00:00:00Z") });
  ok("no profile: stamped, top candidate on the evidence, nobody named", r.outcome === "no_match" && db.__rows.prospectEvidence.some((e) => e.type === "bbb_search" && /Morey/.test(e.rawValue)) && db.__rows.prospectPerson.length === 0);
  ok("a row with no prospect id is refused", (await applyBbbRow({ db, row: { profile } })).reason === "no_prospect_id");
}
ok("profileAsListing carries phone, city, postal, geo", profileAsListing(profile).phoneE164 === "+16198478330" && profileAsListing(profile).postalCode === "92040-5506" && profileAsListing(profile).latitude === 32.909873);

// ── 9. The order ─────────────────────────────────────────────────────────
section("9. The enrichment order");
const ordered = orderCandidates({
  claims: [
    { prospectId: "c2", salesRepId: "r1", claimedAt: "2026-09-18T10:00:00Z", position: 1, tradeKey: "plumbing" },
    { prospectId: "c1", salesRepId: "r1", claimedAt: "2026-09-18T10:00:00Z", position: 0, tradeKey: "plumbing" },
    { prospectId: "c0", salesRepId: "r2", claimedAt: "2026-09-18T09:00:00Z", position: 5, tradeKey: "roofing" },
  ],
  trades: [
    { tradeKey: "roofing", lastWorkedAt: "2026-09-18T09:00:00Z", claims: 1 },
    { tradeKey: "plumbing", lastWorkedAt: "2026-09-18T10:00:00Z", claims: 2 },
  ],
  candidates: {
    plumbing: [{ id: "c1", researched: true }, { id: "p1", researched: true }, { id: "p2", researched: false }],
    roofing: [{ id: "q1", researched: false }, { id: "q2", researched: false }],
  },
});
ok("open claims first, in claim order (claimedAt, then position)", ordered.slice(0, 3).map((r) => r.id).join() === "c0,c1,c2" && ordered.slice(0, 3).every((r) => r.tier === "claimed"));
ok("then the worked trades round-robin, most recently worked first, in dispatch order", ordered.slice(3).map((r) => r.id).join() === "p1,q1,p2,q2", ordered.map((r) => r.id));
ok("a claimed row is not repeated in its trade's tier", ordered.filter((r) => r.id === "c1").length === 1);
ok("every row has a rank and a reason", ordered.every((r, i) => r.rank === i && r.reason));
ok("nothing outside the claims and the worked trades is ever listed", !ordered.some((r) => r.id === "z"));
ok("ahead of the dispatcher counts the done rows at the head, stops at the first undone", JSON.stringify(aheadOfDispatcher([{ id: "a", done: true }, { id: "b", done: true }, { id: "c", done: false }, { id: "d", done: true }])) === JSON.stringify({ ahead: 2, total: 4, nextId: "c" }));
const pairs = pairsFromRows(ordered, new Map([["c0", { tradeKey: "roofing", city: "Denver", province: "CO", country: "us" }], ["c1", { tradeKey: "plumbing", city: "Lakeside", province: "CA", country: "US" }], ["c2", { tradeKey: "plumbing", city: "LAKESIDE", province: "CA", country: "US" }], ["p1", { tradeKey: "plumbing", city: "Fresno", province: "CA", country: "US" }]]));
ok("pairs are deduped case-insensitively and keep the order's urgency", pairs.length === 3 && pairs[0].city === "Denver" && pairs[1].city === "Lakeside" && pairs[0].country === "US" && pairs[0].tier === "claimed", pairs);
ok("a row with no trade or city makes no pair", pairsFromRows([{ id: "x", tier: "claimed", rank: 0 }], new Map([["x", { tradeKey: null, city: "Y", country: "US" }]])).length === 0);

// ── 10. The vendor runs ──────────────────────────────────────────────────
section("10. The vendor runs — pairs, dedupe, cost");
ok("both actors are data: input, row reader, price, setting key", ["bbb", "google_maps"].every((s) => ACTORS[s].actor && typeof ACTORS[s].input === "function" && typeof ACTORS[s].row === "function" && ACTORS[s].listPriceUsdPerRow > 0 && ACTORS[s].settingKey));
ok("the pair key is case-folded and includes the country", pairKeyFor({ source: "bbb", keyword: "Plumber", city: "Lakeside", province: "CA", country: "US" }) === pairKeyFor({ source: "bbb", keyword: "plumber", city: "LAKESIDE", province: "ca", country: "us" }) && pairKeyFor({ source: "bbb", keyword: "a", city: "b", province: "", country: "US" }) !== pairKeyFor({ source: "bbb", keyword: "a", city: "b", province: "", country: "CA" }));
ok("a trade's search keyword is a directory heading, not a key", searchKeywordFor("plumbing") === "plumber" && searchKeywordFor("drywall") === "drywall");
ok("BBB input: keyword, 'City, ST', USA/CAN, details on", (() => { const i = ACTORS.bbb.input({ keyword: "plumber", city: "Gatineau", province: "QC", country: "CA", maxItems: 50 }); return i.searchQuery === "plumber" && i.location === "Gatineau, QC" && i.country === "CAN" && i.enrichWithDetails === true && i.maxItems === 50; })());
ok("Maps input: no paid add-ons switched on", (() => { const i = ACTORS.google_maps.input({ keyword: "plumber", city: "Lakeside", province: "CA", country: "US", maxItems: 50 }); return i.scrapeContacts === false && i.scrapePlaceDetailPage === false && i.maximumLeadsEnrichmentRecords === 0 && i.maxReviews === 0 && i.maxCrawledPlacesPerSearch === 50; })());
const bbbRow_ = ACTORS.bbb.row({ profile_url: "https://www.bbb.org/us/ca/lakeside/profile/plumber/x-1126-1/addressId/5", name: "X Plumbing", phone: "(619) 847-8330", website: "https://x.com", city: "Lakeside", state: "CA", zip: "92040", country: "USA", bbb_rating: "a+", is_accredited: true, years_in_business: 15, num_employees: "2 - 5", principal_name: "Mr. Pat Lee", principal_title: "Owner", categories: "Plumber, Drain" });
ok("a BBB actor row maps to a listing + profile: E.164 phone, addressId stripped, prefix dropped, band tidied", bbbRow_.listing.phoneE164 === "+16198478330" && !/addressId/.test(bbbRow_.listing.externalId) && bbbRow_.profile.people[0].name === "Pat Lee" && bbbRow_.profile.employeeRange === "2-5" && bbbRow_.profile.rating === "A+" && bbbRow_.profile.accredited === true, bbbRow_);
ok("years_in_business becomes a started year only as a plain integer", bbbRow_.profile.businessStartedYear === new Date().getUTCFullYear() - 15 && ACTORS.bbb.row({ profile_url: "u", years_in_business: "n/a" }).profile.businessStartedYear === null);
ok("a BBB row without a profile URL is dropped", ACTORS.bbb.row({ name: "X" }) === null);
const mapsRow = ACTORS.google_maps.row({ placeId: "ChIJx", title: "X", phone: "+1 619-847-8330", website: "https://x.com", street: "1 Main St", city: "Lakeside", state: "CA", postalCode: "92040", countryCode: "US", location: { lat: 1, lng: 2 }, categoryName: "Plumber", totalScore: 4.7, reviewsCount: 31, openingHours: [{ day: "Monday", hours: "8 AM to 5 PM" }], permanentlyClosed: false });
ok("a Maps actor row maps to the Places shape: status, hours, rating, geo", mapsRow.listing.businessStatus === "OPERATIONAL" && mapsRow.listing.hours[0] === "Monday: 8 AM to 5 PM" && mapsRow.listing.rating === "4.7" && mapsRow.listing.latitude === 1);
ok("a permanently closed Maps row says so in Google's own word", ACTORS.google_maps.row({ placeId: "p", permanentlyClosed: true }).listing.businessStatus === "CLOSED_PERMANENTLY");
ok("the projected pair cost is start + rows at list price", projectedPairCents("bbb", 50) === 20 && projectedPairCents("google_maps", 50) > 7 && projectedPairCents("nope") === 0);
{
  const costRows = [];
  const db = { platformCostDaily: { upsert: async (args) => { costRows.push(args); return args; } } };
  await meterApifyRun({ db, now: new Date("2026-09-18T12:00:00Z"), category: "bbb-scraper", cents: 20, rows: 50, source: "apify_run_usage" });
  await meterApifyRun({ db, now: new Date("2026-09-18T13:00:00Z"), category: "bbb-scraper", cents: 5, rows: 10, source: "apify_run_usage" });
  ok("a run is metered onto the day's row under provider apify and the actor's category", costRows.length === 2 && costRows[0].where.day_provider_category.provider === "apify" && costRows[0].where.day_provider_category.category === "bbb-scraper" && costRows[0].create.cents === 20 && costRows[1].update.cents.increment === 5);
  ok("metering never throws", (await meterApifyRun({ db: {}, category: "x", cents: 1 })) === null);
}
{
  // ingestListings against a scripted db: keep every row, match one, refuse the rest.
  const listings = [];
  const prospects = [{ ...blank, mergedIntoId: null }];
  const people = [];
  const evidence = [];
  const db = {
    externalListing: {
      upsert: async ({ where, create, update }) => { const i = listings.findIndex((l) => l.externalId === where.source_externalId.externalId); if (i === -1) listings.push({ ...create }); else Object.assign(listings[i], update); },
      update: async ({ where, data }) => Object.assign(listings.find((l) => l.externalId === where.source_externalId.externalId), data),
      updateMany: async ({ where, data }) => { for (const l of listings) if (l.externalId === where.externalId && !l.matchedProspectId) Object.assign(l, data); },
    },
    prospect: {
      findMany: async () => prospects,
      findUnique: async ({ where }) => prospects.find((p) => p.id === where.id) || null,
      findFirst: async () => null,
      update: async ({ where, data }) => Object.assign(prospects.find((p) => p.id === where.id), data),
    },
    prospectPerson: { findMany: async () => people, createMany: async ({ data }) => people.push(...data) },
    prospectEvidence: { createMany: async ({ data }) => evidence.push(...data) },
    salesContactNumber: { findMany: async () => [], create: async () => {} },
    $transaction: async (fn) => fn(db),
  };
  const items = [
    { profile_url: "https://www.bbb.org/us/ca/lakeside/profile/plumber/ams-plumbing-drain-1126-1000102899", name: "AMS Plumbing & Drain", phone: "(619) 847-8330", city: "Lakeside", state: "CA", zip: "92040", country: "USA", bbb_rating: "A+", is_accredited: false, principal_name: "Mr. Alexander Singer", principal_title: "Owner" },
    { profile_url: "https://www.bbb.org/us/ca/san-diego/profile/plumber/other-1", name: "Other Plumbing", phone: "(619) 111-2222", city: "San Diego", state: "CA", zip: "92101", country: "USA" },
  ];
  const r = await ingestListings({ db, source: "bbb", items, runId: "run1", keyword: "plumber", location: "Lakeside, CA", now: new Date("2026-09-18T00:00:00Z") });
  ok("every vendor row is KEPT, one matched, one refused and kept for later", r.kept === 2 && r.matched === 1 && r.refused === 1 && listings.find((l) => /other-1/.test(l.externalId)).matchVerdict === "no_confident_match", r);
  ok("the matched row's prospect gained the principal and the facts", people.some((p) => p.name === "Alexander Singer" && p.source === "bbb") && prospects[0].bbbRating === "A+" && listings[0].matchedProspectId === "ams");
}

// ── 11. The surfaces ─────────────────────────────────────────────────────
section("11. The card, the brief, the script, the console");
const card = whoToAskRow({ ...ams, people: [cslb, bbb] });
ok("the card row leads with the best name and carries the BBB link", card.known && /Alexander Singer — Owner/.test(card.text) && card.bbbSearchUrl === bbbSearchUrl(ams) && card.others.length === 1);
ok("with nobody named the row says so, keyed, with a search link and no invented name", !whoToAskRow(ams).known && whoToAskRow(ams).textKey === "app.salesIntel.fact.whoToAskFor.missing" && /find_text=AMS/.test(whoToAskRow(ams).bbbSearchUrl));
ok("the BBB row prints the facts in one line, or says not checked", bbbRow({ ...ams, bbbCheckedAt: new Date(), bbbRating: "A+", bbbAccredited: true, businessStartedYear: 2009, employeeRange: "2-5" }).text === "2-5 employees · in business since 2009 · A+ accredited" && bbbRow(ams).textKey === "app.salesIntel.fact.bbb.notChecked");
ok("no BBB profile matched is its own sentence, keyed", bbbRow({ ...ams, bbbCheckedAt: new Date("2026-09-18") }).textKey === "app.salesIntel.fact.bbb.noMatch");
ok("both rows are in prospectFacts, after the Google check", (() => { const keys = prospectFacts(ams).map((f) => f.key); return keys.indexOf("whoToAskFor") > keys.indexOf("googleCheck") && keys.includes("bbb"); })());
ok("bbbFactLine is null with nothing to say — never padded", bbbFactLine({}) === null);
for (const lang of ["en", "fr", "es"]) {
  ok(`${lang}: the new keys exist`, ["app.salesIntel.fact.whoToAskFor.label", "app.salesIntel.fact.whoToAskFor.missing", "app.salesIntel.fact.bbb.label", "app.salesIntel.fact.bbb.notChecked", "app.salesIntel.fact.bbb.noMatch", "app.salesIntel.people.typedLabel", "app.salesIntel.people.save", "app.salesIntel.people.openBbb"].every((k) => typeof APP_MESSAGES[lang]?.[k] === "string" && APP_MESSAGES[lang][k]));
}
const brief = composeBrief({ prospect: { ...ams, people: [cslb, bbb], bbbRating: "A+", businessStartedYear: 2021 } });
ok("the brief carries who to ask for as a FACT with its source, and the BBB line", brief.known.some((k) => k.id === "who_to_ask" && k.layer === "fact" && k.source === "bbb" && /Alexander Singer/.test(k.detail)) && brief.known.some((k) => k.id === "bbb"));
ok("with nobody named the brief lists the gap with an honest reason", composeBrief({ prospect: ams }).unknown.some((u) => u.id === "who_to_ask" && /ask on the call/.test(u.reasonText)));
ok("the script's facts carry the spoken first name and role only", directoryFacts({ ...ams, people: [cslb, bbb] }).askFor === "Alexander (owner)" && directoryFacts(ams).askFor === "");
ok("the prompt prints it as one fact line", /Ask for: \$\{f\.askFor\}/.test(read("lib/sales/intel/callScript.js")));

// ── 12. Wiring ───────────────────────────────────────────────────────────
section("12. Wiring — every control has a caller");
const queueRoute = read("app/api/sales/queue/route.js");
ok("the claim hook looks the register up before Google", queueRoute.indexOf("lookupRegisterPeopleFor") < queueRoute.indexOf("enrichProspects({ db, ids: never"));
ok("the current row loads its people", /people: \{ orderBy: \{ seenAt: "desc" \} \}/.test(queueRoute));
const cron = read("app/api/cron/sales-pipeline/route.js");
ok("the cron runs the register sweep and both vendor ticks", /sweepRegisterPeople\(/.test(cron) && /runApifyTick\(\{ db, source, now, trigger: "cron" \}\)/.test(cron));
ok("the rep's typed name has a route, scoped by queueWhere", /queueWhere\(rep\.id/.test(read("app/api/sales/queue/people/route.js")) && /source: "typed"/.test(read("app/api/sales/queue/people/route.js")));
ok("the rep card mounts the control and posts to that route", /WhoToAskFor/.test(read("app/sales/queue/page.js")) && /\/api\/sales\/queue\/people/.test(read("app/components/sales/WhoToAskFor.js")));
ok("the platform page mounts the enrichment panel and lists people with sources", /EnrichmentPanel/.test(read("app/platform/sales/prospects/page.js")) && /x\.sourceLabel/.test(read("app/platform/sales/prospects/page.js")));
ok("the panel's routes exist", /enrichmentSweepStatus/.test(read("app/api/platform/sales/prospects/enrichment/route.js")) && /applyBbbRows/.test(read("app/api/platform/sales/prospects/bbb-upload/route.js")) && /bbbBatch/.test(read("app/api/platform/sales/prospects/bbb-batch/route.js")));
ok("the ingest carries WA/OR principals through record → normalise → ingest", /principal: licence\.principal \|\| null/.test(read("lib/sales/discovery/usBoard/record.js")) && /principal:/.test(read("lib/sales/discovery/normalise.js")) && /recordBoardPrincipal\(/.test(read("lib/sales/discovery/ingest.js")));
ok("the loader never deletes", !/deleteMany|\.delete\(/.test(read("scripts/cslb-personnel-load.mjs")));
ok("nothing in lib fetches bbb.org", !/fetch\([^)]*bbb\.org/.test(read("lib/sales/intel/bbbProfile.js") + read("lib/sales/intel/bbbApply.js") + read("lib/sales/intel/listingMatch.js")));
ok("APIFY_TOKEN is documented and the Apify client reads it by name", /`APIFY_TOKEN`/.test(read("docs/VERCEL.md")) && /process\.env\.APIFY_TOKEN/.test(read("lib/sales/intel/apify.js")));
ok("the schema carries the four tables and the stamps", /model ProspectPerson/.test(read("prisma/schema.prisma")) && /model RegisterPersonnel/.test(read("prisma/schema.prisma")) && /model ExternalListing/.test(read("prisma/schema.prisma")) && /model ApifyRun/.test(read("prisma/schema.prisma")) && /principalCheckedAt DateTime\?/.test(read("prisma/schema.prisma")) && /bbbCheckedAt\s+DateTime\?/.test(read("prisma/schema.prisma")));
const pkg = JSON.parse(read("package.json"));
ok("check:who-to-ask-for is a script and check:all runs it", /check-who-to-ask-for\.mjs/.test(pkg.scripts["check:who-to-ask-for"] || "") && /check:who-to-ask-for/.test(pkg.scripts["check:all"]));
ok("the two operator scripts are wrapped", /bbb-principal\.mjs/.test(pkg.scripts["bbb:principal"] || "") && /cslb-personnel-load\.mjs/.test(pkg.scripts["cslb:personnel"] || ""));

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
