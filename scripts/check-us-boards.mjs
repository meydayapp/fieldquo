// scripts/check-us-boards.mjs
//
// US state contractor-licence boards as discovery sources. Prove that a
// licence class is only read as a trade where the class actually names one,
// that the unrestricted class two thirds of every register holds can never
// become "general contracting", that a Washington campaign cannot ingest an
// Oregon file, and that a state nobody has read the calling law for refuses
// the call.
//
//   npm run check:us-boards
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// Every guarantee here is a decision made about a hostile row, and none of
// them is visible by reading. "The class token includes the licence type" is a
// claim; two Washington rows carrying specialty `01` under different licence
// types producing an electrician and a plumber is a measurement. So the
// shipped functions run here against the ways each can be wrong.
//
// No database and no network.
//
// ══ The hostile inputs, and the real bug each one stands for ═══════════════
//
//   1. Specialty code `01`. It means GENERAL under a Washington construction
//      licence and JOURNEY LEVEL under a plumbing one. A map keyed on the code
//      alone files 1,445 plumbers as general contractors. Six codes collide.
//   2. The unrestricted class. 51,755 Washington licences, 80,142 California
//      ones and 39,525 Oregon ones hold nothing but it. Mapping it is the
//      single most tempting wrong move in this whole design, because it turns
//      a "3.2% yield" into a "97% yield" and produces a queue of nobody.
//   3. An Oregon snapshot handed to a Washington campaign. Every field parses.
//      The licence notice, the calling window and the class vocabulary would
//      all be the wrong state's, and nothing in the data says so.
//   4. A class that names two trades. "Floor Covering and Counter Tops" is
//      1,891 Washington licences and decides nothing.
//   5. A state code that is not a state. Washington's file carries "98", "BR"
//      and 67 blanks; Oregon's carries "AB", "YT" and "PQ". Assuming US puts a
//      Yukon contractor inside a US territory filter.
//   6. A missing coordinate. `Number(null)` is 0 and 0 is finite, so a naive
//      finite check stores a licence at latitude 0, longitude 0.
//   7. A snapshot with the source statement removed — a file of 219,255 phone
//      numbers nobody can trace back to a regulator.
//   8. `rowsUpdatedAt` read as milliseconds. Socrata publishes SECONDS, and
//      every other timestamp in this codebase is milliseconds; getting it
//      wrong dates every US snapshot to January 1970.
//   9. A California licence in a state whose telephone-solicitation law
//      nobody has read. It must come back UNKNOWN and refuse, never default
//      to allowed.
//
// Positional source rules are scoped to ONE function extracted by brace
// matching, and the source is read COMMENT-STRIPPED, because a guard string
// sitting in a header has manufactured a false pass in this repo repeatedly.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AMBIGUOUS_CLASSES,
  CA_CSLB_CLASSES,
  OR_CCB_CLASSES,
  UNRESTRICTED_CLASSES,
  WA_LNI_CLASSES,
  boardVocabulary,
  classLabel,
  classNamespace,
  classForNamespaced,
  isKnownClass,
  namespacedClass,
  refusalReason,
  slugClass,
} from "@/lib/sales/discovery/usBoard/classes";
import { US_BOARDS, boardProblems, usBoard, usBoardKeys } from "@/lib/sales/discovery/usBoard/boards";
import {
  addLicenceRow,
  classStatement,
  countryForSubdivision,
  groupLicences,
  namespacedClasses,
  parseUsDate,
  primaryClass,
  rowIsActive,
  startLicence,
  toDiscoveredBusiness,
} from "@/lib/sales/discovery/usBoard/record";
import {
  US_BOARD_SNAPSHOT_FORMAT,
  businessFromSnapshotRow,
  manifestProblems,
  readSnapshot,
} from "@/lib/sales/discovery/usBoard/snapshot";
import {
  fetchSocrataDataset,
  isBoardRelease,
  isSocrataId,
  releaseFromSocrata,
  socrataCsvUrl,
  socrataMetadataUrl,
} from "@/lib/sales/discovery/usBoard/socrata";
import { makeBoardProvider, parseCursor, yieldNote, __clearUsBoardSnapshotCache } from "@/lib/sales/discovery/usBoard/provider";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";
import { shapeProblems } from "@/lib/sales/discovery/provider";
import {
  DISCOVERY_TRADES,
  duplicateSourceCategories,
  tradeForCategories,
  unknownCategoryKeys,
} from "@/lib/sales/discovery/trades";
import { normaliseBusiness } from "@/lib/sales/discovery/normalise";
import { CALLING_JURISDICTIONS, salesCallReadiness } from "@/lib/sales/callingRules";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * A source file with its comments removed.
 *
 * Every header in lib/sales/discovery/usBoard/ quotes the exact strings this
 * check looks for — "Email addresses are not provided", "us_wa_lni_cc_cb",
 * "PASSED AWAY" — because the headers explain the decisions. Matching against
 * raw source would therefore pass on the prose that DESCRIBES a guard while
 * the guard itself was deleted. That has happened in this repo.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== "" ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

/**
 * The body of one function, by brace matching, so a rule cannot match prose.
 *
 * The parameter list is skipped by matching PARENS first. Taking the first `{`
 * after the signature looks right and is not: a destructured parameter list
 * opens a brace of its own, and the matcher then returns the parameter list as
 * "the body", so every positional rule scoped to such a function passes
 * vacuously. Copied in shape from scripts/check-rbq-provider.mjs, which
 * documents the same trap.
 */
function functionBody(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) return "";
  let i = start + signature.length;
  // Skip the parameter list.
  while (i < src.length && src[i] !== "(") i++;
  let parens = 0;
  for (; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        i++;
        break;
      }
    }
  }
  while (i < src.length && src[i] !== "{") i++;
  let depth = 0;
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  return "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. The board declarations
   ═══════════════════════════════════════════════════════════════════════════ */

section("Board declarations");
{
  ok("three boards ship", usBoardKeys().length === 3, usBoardKeys().join(", "));
  for (const key of usBoardKeys()) {
    const board = usBoard(key);
    ok(`${key} declares everything boardProblems requires`, boardProblems(board).length === 0, boardProblems(board).join(", "));
    ok(`${key} carries a class vocabulary`, Object.keys(board.classes).length > 0, `${Object.keys(board.classes).length} classes`);
    ok(`${key}'s vocabulary is the one classes.js serves for it`, boardVocabulary(key) === board.classes);
    ok(`${key} names a URL a human can check one licence at`, /^https:\/\//.test(board.verifyUrl || ""));
  }

  // The half of the status decision that keeps 85,006 dead licences.
  ok(
    "a board with a status column and no allow-list is refused",
    boardProblems({ ...usBoard("us_wa_lni"), activeStatuses: null }).includes("status_column_with_no_allow_list"),
  );
  ok(
    "a board with an allow-list and no status column is refused",
    boardProblems({
      ...usBoard("us_or_ccb"),
      activeStatuses: ["ACTIVE"],
    }).includes("allow_list_with_no_status_column"),
  );
  ok("a board with no licence obligation is refused", boardProblems({ ...usBoard("us_ca_cslb"), licence: { name: "x", url: "y" } }).includes("no_licence_obligation"));
  ok("a non-object is refused rather than crashing", boardProblems(null).includes("not_an_object"));

  // Washington keeps the statuses that are NOT a live licence out.
  const wa = usBoard("us_wa_lni");
  for (const dead of ["EXPIRED", "RE-LICENSED", "OUT OF BUSINESS", "PASSED AWAY", "SUSPENDED"]) {
    ok(`Washington does not treat "${dead}" as active`, !wa.activeStatuses.includes(dead));
  }
  ok("California keeps only CLEAR", usBoard("us_ca_cslb").activeStatuses.join(",") === "CLEAR");
  ok(
    "Oregon has no status allow-list because its file is the board's active list",
    usBoard("us_or_ccb").activeStatuses === null && Boolean(usBoard("us_or_ccb").datasetAssertedStatus),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. The class token, and the six codes that collide
   ═══════════════════════════════════════════════════════════════════════════ */

section("The class token: TYPE|CODE, because the code alone is ambiguous");
{
  const wa = usBoard("us_wa_lni");
  const general = { ContractorLicenseTypeCode: "CC", SpecialtyCode1: "01", SpecialtyCode2: "" };
  const journey = { ContractorLicenseTypeCode: "PC", SpecialtyCode1: "01", SpecialtyCode2: "" };
  const electricGeneral = { ContractorLicenseTypeCode: "EC", SpecialtyCode1: "01", SpecialtyCode2: "" };

  ok("CC|01 and PC|01 are different tokens", wa.classToken(general) !== wa.classToken(journey), `${wa.classToken(general)} vs ${wa.classToken(journey)}`);
  ok("CC|01 is GENERAL", classLabel("us_wa_lni", wa.classToken(general)) === "GENERAL");
  ok("PC|01 is JOURNEY LEVEL", classLabel("us_wa_lni", wa.classToken(journey)) === "JOURNEY LEVEL");

  // The bug the token shape exists to stop, stated as an outcome rather than
  // as a shape: the same raw code must not produce the same trade.
  const tradeOf = (row) => {
    const licence = addLicenceRow(wa, startLicence(wa, row), row);
    return tradeForCategories({ primary: primaryClass(licence), alternate: namespacedClasses(licence) }).tradeKey;
  };
  ok("a plumbing licence with specialty 01 is plumbing", tradeOf(journey) === "plumbing", String(tradeOf(journey)));
  ok("an electrical licence with specialty 01 is electrical", tradeOf(electricGeneral) === "electrical", String(tradeOf(electricGeneral)));
  ok("a construction licence with specialty 01 has NO trade", tradeOf(general) === null, String(tradeOf(general)));

  // The second specialty column is read, and it is what found EC|90 and EC|91.
  const twoSpecialties = { ContractorLicenseTypeCode: "EC", SpecialtyCode1: "01", SpecialtyCode2: "6A" };
  ok("a second specialty is carried", wa.extraClassTokens(twoSpecialties).join(",") === "EC|6A");
  ok(
    "a licence registered for two different trades reaches NEITHER",
    tradeOf(twoSpecialties) === null,
    "electrical and HVAC disagree, so the row banks with no trade",
  );

  // California packs the classes into one column, certifications included.
  const ca = usBoard("us_ca_cslb");
  const painter = { "Classifications(s)": "C33" };
  const painterWithCert = { "Classifications(s)": "C33|HAZ" };
  const twoTrades = { "Classifications(s)": "C33|C39" };
  ok("California reads a single class", ca.classToken(painter) === "C33");
  ok("a certification is not treated as a classification", ca.classToken(painterWithCert) === "C33" && ca.extraClassTokens(painterWithCert).length === 0);
  ok("two classifications are both carried", ca.extraClassTokens(twoTrades).join(",") === "C39");
  ok("ASB and HAZ are the only non-classes declared", ca.nonClassCodes.join(",") === "ASB,HAZ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The unrestricted class can never become a trade
   ═══════════════════════════════════════════════════════════════════════════ */

section("The unrestricted class identifies nothing, and nothing may map it");
{
  const mapped = new Set();
  for (const trade of Object.values(DISCOVERY_TRADES)) {
    for (const category of trade.sourceCategories) mapped.add(category);
  }

  for (const [boardKey, tokens] of Object.entries(UNRESTRICTED_CLASSES)) {
    for (const token of tokens) {
      const namespaced = namespacedClass(boardKey, token);
      ok(`${namespaced} is NOT mapped to a trade`, !mapped.has(namespaced), classLabel(boardKey, token) || "");
      ok(`${namespaced} resolves to no trade`, tradeForCategories({ primary: namespaced, alternate: [namespaced] }).tradeKey === null);
      ok(`${namespaced} can say why it is refused`, Boolean(refusalReason(boardKey, token)));
    }
  }

  for (const [boardKey, tokens] of Object.entries(AMBIGUOUS_CLASSES)) {
    for (const token of Object.keys(tokens)) {
      const namespaced = namespacedClass(boardKey, token);
      ok(`${namespaced} names two trades and is NOT mapped`, !mapped.has(namespaced));
      ok(`${namespaced} can say why it is refused`, Boolean(refusalReason(boardKey, token)));
    }
  }

  // The specific temptation, named: California's B is 96,772 licences.
  ok(
    "California's B is not general_contracting",
    !DISCOVERY_TRADES.general_contracting.sourceCategories.includes("us_ca_cslb_b"),
  );
  ok(
    "no board class at all is mapped to general_contracting",
    !DISCOVERY_TRADES.general_contracting.sourceCategories.some((c) => c.startsWith("us_")),
    "the unrestricted class is where a whole register would land",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Every mapped class actually exists in the board's file
   ═══════════════════════════════════════════════════════════════════════════ */

section("A class that does not exist matches zero rows, silently");
{
  let boardCategories = 0;
  let bad = 0;
  for (const [tradeKey, trade] of Object.entries(DISCOVERY_TRADES)) {
    for (const category of trade.sourceCategories) {
      const boardKey = usBoardKeys().find((k) => category.startsWith(classNamespace(k)));
      if (!boardKey) continue;
      boardCategories++;
      // Resolved back through the vocabulary, not by un-folding the slug — the
      // fold is lossy and an inverse computed from the string alone would be a
      // guess dressed as a lookup.
      const token = classForNamespaced(boardKey, category);
      if (!token || !isKnownClass(boardKey, token)) {
        bad++;
        console.log(`       ${tradeKey} names ${category}, which ${boardKey} does not publish`);
      }
    }
  }
  ok("every us_* source category exists in its board's vocabulary", bad === 0, `${boardCategories} board categories checked`);
  ok("there are board categories to check at all", boardCategories >= 40, String(boardCategories));

  ok("no source category is claimed by two trades", duplicateSourceCategories().length === 0, JSON.stringify(duplicateSourceCategories()));

  // ── The fold has to be lossless, and this is the proof ──────────────────
  //
  // `slugClass` drops punctuation and case so a board code can live in the
  // same key space as an Overture category. If it ever collapsed two classes
  // into one, a campaign would file one trade's contractors under another's
  // and nothing in the data would say so. Asserted over every class each
  // board publishes, not over the mapped subset.
  const OVERTURE_SHAPE = /^[a-z][a-z0-9_]{2,63}$/;
  for (const key of usBoardKeys()) {
    const tokens = Object.keys(usBoard(key).classes);
    const slugs = tokens.map((t) => namespacedClass(key, t));
    ok(`${key}: the class fold is injective over all ${tokens.length} classes`, new Set(slugs).size === slugs.length,
      JSON.stringify(slugs.filter((s2, i) => slugs.indexOf(s2) !== i)));
    ok(`${key}: every folded class fits the source-category shape`, slugs.every((s2) => OVERTURE_SHAPE.test(s2)),
      JSON.stringify(slugs.filter((s2) => !OVERTURE_SHAPE.test(s2))));
    ok(`${key}: every folded class resolves back to its own token`,
      tokens.every((t) => classForNamespaced(key, namespacedClass(key, t)) === t));
  }
  ok("the fold turns C-8 into c_8 and CC|01 into cc_01", slugClass("C-8") === "c_8" && slugClass("CC|01") === "cc_01");
  ok("the fold leaves no leading or trailing underscore", slugClass("|C-8|") === "c_8");
  ok("a class that does not exist resolves back to nothing", classForNamespaced("us_ca_cslb", "us_ca_cslb_c93") === null);
  ok("every categoryKeys entry is a real catalogue key", unknownCategoryKeys().length === 0, JSON.stringify(unknownCategoryKeys()));

  // The vocabularies are the measured sizes, so a truncated paste is visible.
  ok("California ships 98 classes", Object.keys(CA_CSLB_CLASSES).length === 98, String(Object.keys(CA_CSLB_CLASSES).length));
  ok("Washington ships 90 classes", Object.keys(WA_LNI_CLASSES).length === 90, String(Object.keys(WA_LNI_CLASSES).length));
  ok("Oregon ships 18 endorsements", Object.keys(OR_CCB_CLASSES).length === 18, String(Object.keys(OR_CCB_CLASSES).length));

  // The one class the brief named, end to end.
  ok(
    "California C-33 is Painting and Decorating and maps to painting",
    classLabel("us_ca_cslb", "C33") === "Painting and Decorating Contractor" &&
      tradeForCategories({ primary: "us_ca_cslb_c33", alternate: ["us_ca_cslb_c33"] }).tradeKey === "painting",
  );
  ok("an invented class is refused", !isKnownClass("us_ca_cslb", "C99") && classLabel("us_ca_cslb", "C99") === null);
  ok("an unknown board has no vocabulary", boardVocabulary("us_zz_none") === null && !isKnownClass("us_zz_none", "C33"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Rows into licences
   ═══════════════════════════════════════════════════════════════════════════ */

section("Grouping, activity and the fields that vary");
{
  const or = usBoard("us_or_ccb");
  // Oregon's real shape: one row per licence-and-endorsement, and NOT adjacent.
  const rows = [
    { license_number: "1", license_type: "RGC", endorsement_text: "Residential General Contractor", full_name: "A CO", address: "1 ST", city: "SALEM", state: "OR", zip_code: "97301", phone_number: "5035551234", rmi_name: "X" },
    { license_number: "2", license_type: "OCLS", endorsement_text: "Oregon Certified Locksmith", full_name: "B CO", address: "2 ST", city: "BEND", state: "OR", zip_code: "97701", phone_number: "5415551234", rmi_name: "Y" },
    { license_number: "1", license_type: "LBPR", endorsement_text: "Lead Based Paint Renovation Contractor", full_name: "A CO TRADING AS Z", address: "1 ST", city: "SALEM", state: "OR", zip_code: "97301", phone_number: "5035551234", rmi_name: "X" },
  ];
  const grouped = groupLicences(or, rows);
  ok("three rows become two licences", grouped.length === 2, String(grouped.length));
  const first = grouped.find((l) => l.id === "1");
  ok("non-adjacent rows of one licence are still grouped", first.classes.length === 2, first.classes.join(","));
  ok("a second trading name is kept, not dropped", first.names.length === 2, first.names.join(" / "));
  ok("a repeated class is not duplicated", groupLicences(or, [rows[0], rows[0]])[0].classes.length === 1);
  ok("a row with no licence number is dropped rather than grouped under ''", groupLicences(or, [{ ...rows[0], license_number: "" }]).length === 0);

  const wa = usBoard("us_wa_lni");
  const waRow = (status) => ({
    ContractorLicenseNumber: "L1", BusinessName: "N", ContractorLicenseTypeCode: "CC", ContractorLicenseTypeCodeDesc: "CONSTRUCTION CONTRACTOR",
    Address1: "1 ST", Address2: "", City: "SEATTLE", State: "WA", Zip: "98101", PhoneNumber: "2065551234",
    SpecialtyCode1: "CB", SpecialtyCode1Desc: "PAINTING/WALLCOVERING", SpecialtyCode2: "",
    BusinessTypeCodeDesc: "Corporation", PrimaryPrincipalName: "P", ContractorLicenseStatus: status,
  });
  ok("an ACTIVE row is kept", rowIsActive(wa, waRow("ACTIVE")));
  for (const dead of ["EXPIRED", "RE-LICENSED", "OUT OF BUSINESS", "PASSED AWAY"]) {
    ok(`a ${dead} row is dropped`, !rowIsActive(wa, waRow(dead)));
  }
  ok("a row with no status at all is dropped, not kept", !rowIsActive(wa, { ...waRow("ACTIVE"), ContractorLicenseStatus: "" }));
  ok("a board with no status column keeps every row", rowIsActive(or, rows[0]));
  ok("grouping drops the inactive rows", groupLicences(wa, [waRow("EXPIRED"), waRow("ACTIVE")]).length === 1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The country is derived, never assumed
   ═══════════════════════════════════════════════════════════════════════════ */

section("A US board's file is not a file of US addresses");
{
  ok("WA is the United States", countryForSubdivision("WA") === "US");
  ok('"Wa" is too — the file spells it six ways', countryForSubdivision("Wa") === "US");
  ok('a spelled-out state name is NOT resolved', countryForSubdivision("Washington") === null, "no name table ships for a case the files do not contain");
  ok("CA in a state column is California, not Canada", countryForSubdivision("CA") === "US");
  ok("AB is Canada", countryForSubdivision("AB") === "CA");
  ok("YT is Canada", countryForSubdivision("YT") === "CA");
  ok('"PQ" is Quebec, not an unknown', countryForSubdivision("PQ") === "CA", "the pre-1991 abbreviation, twice in Oregon's file");
  ok('"98" is NOT a country', countryForSubdivision("98") === null);
  ok('"BR" is NOT a country', countryForSubdivision("BR") === null);
  ok("a blank is null, not US", countryForSubdivision("") === null);
  ok("null in is null out", countryForSubdivision(null) === null);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. One licence, in the shape the pipeline requires
   ═══════════════════════════════════════════════════════════════════════════ */

section("The emitted business");
{
  const ca = usBoard("us_ca_cslb");
  const row = {
    LicenseNo: "1000002", BusinessName: "ACME PAINTING", "BUS-NAME-2": "", FullBusinessName: "ACME PAINTING",
    MailingAddress: "301 SOUTH MILLS AVENUE", City: "LODI", State: "CA", ZIPCode: "95242",
    BusinessPhone: "(925) 383 0487", BusinessType: "Corporation", PrimaryStatus: "CLEAR",
    "Classifications(s)": "C33",
  };
  const licence = addLicenceRow(ca, startLicence(ca, row), row);
  const business = toDiscoveredBusiness(licence, ca, { release: "2026-09-02", sourceUrl: "https://example.test/f.csv" });

  ok("the shape check passes", shapeProblems(business).length === 0, shapeProblems(business).join(","));
  ok("the source record id is the licence number", business.sourceRecordId === "1000002");
  ok("the primary category is the namespaced class", business.categories.primary === "us_ca_cslb_c33");
  ok("the trade resolves to painting", tradeForCategories(business.categories).tradeKey === "painting");
  ok("no taxonomy is invented", Array.isArray(business.taxonomyHierarchy) && business.taxonomyHierarchy.length === 0);
  ok("no website is claimed", business.websites.length === 0);
  ok("no email is claimed", business.emails.length === 0);
  ok("the status is the board's own word", business.operatingStatus === "CLEAR");
  ok("latitude is null, NOT 0", business.latitude === null && business.longitude === null);
  ok("sourceUpdatedAt is null rather than the licence's issue date", business.sourceUpdatedAt === null);
  ok("the release is carried", business.sourceRelease === "2026-09-02");
  ok("no derivedWebsite field is emitted at all", !("derivedWebsite" in business), "nothing reads it and no email exists to derive from");
  ok("the country is derived from the state", business.address.country === "US");

  // Oregon's dataset-level assertion, which is a real statement and is labelled
  // as one rather than passed off as a column.
  const or = usBoard("us_or_ccb");
  const orRow = { license_number: "9", license_type: "OCLS", endorsement_text: "Oregon Certified Locksmith", full_name: "K", address: "1 ST", city: "BEND", state: "OR", zip_code: "97701", phone_number: "5415551234", rmi_name: "Y" };
  const orBusiness = toDiscoveredBusiness(addLicenceRow(or, startLicence(or, orRow), orRow), or, { release: "2026-09-03", sourceUrl: "x" });
  ok("Oregon's status names the dataset it comes from", /dataset|active-licence list/i.test(orBusiness.operatingStatus || ""), orBusiness.operatingStatus || "");
  ok("Oregon's locksmith endorsement resolves", tradeForCategories(orBusiness.categories).tradeKey === "locksmith");

  // Two classes: no primary, and the alternates decide only if they agree.
  const wa = usBoard("us_wa_lni");
  const twoRow = {
    ContractorLicenseNumber: "L2", BusinessName: "N", ContractorLicenseTypeCode: "CC", Address1: "1 ST", Address2: "",
    City: "SEATTLE", State: "WA", Zip: "98101", PhoneNumber: "2065551234", SpecialtyCode1: "CD", SpecialtyCode2: "SW",
    SpecialtyCode1Desc: "ROOFING", SpecialtyCode2Desc: "Siding", BusinessTypeCodeDesc: "", PrimaryPrincipalName: "", ContractorLicenseStatus: "ACTIVE",
  };
  const two = addLicenceRow(wa, startLicence(wa, twoRow), twoRow);
  ok("two classes name no primary", primaryClass(two) === null, namespacedClasses(two).join(","));
  ok("roofing and siding disagree, so no trade", tradeForCategories(toDiscoveredBusiness(two, wa, {}).categories).tradeKey === null);
  ok("the class statement names both in the board's words", (classStatement(two) || "").includes("ROOFING") && (classStatement(two) || "").includes("Siding"));
  ok("a licence with no class at all has no statement", classStatement({ board: "us_wa_lni", classes: [] }) === null);

  // It survives the normaliser the pipeline actually runs.
  const normalised = normaliseBusiness(business, {});
  ok("the normaliser accepts it", normalised.ok === true, normalised.problems.join(","));
  ok("the phone normalises to E.164", normalised.prospect.phoneE164 === "+19253830487", String(normalised.prospect.phoneE164));
  ok("hasWebsite is null, not false — the board has no such column", normalised.prospect.hasWebsite === null);
  ok("the class travels as a source category", normalised.prospect.sourceCategories.includes("us_ca_cslb_c33"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The snapshot, and the wrong-state ingest
   ═══════════════════════════════════════════════════════════════════════════ */

section("The snapshot file");
{
  const wa = usBoard("us_wa_lni");
  const or = usBoard("us_or_ccb");
  const manifest = (over = {}) => ({
    fieldquoSnapshot: US_BOARD_SNAPSHOT_FORMAT,
    provider: "us_wa_lni",
    release: "2026-09-03",
    count: 1,
    sourceUrl: "https://example.test/f.csv",
    datasetUrl: wa.datasetUrl,
    attribution: wa.licence.attribution,
    ...over,
  });

  ok("a good manifest has no problems", manifestProblems(manifest(), "us_wa_lni").length === 0, manifestProblems(manifest(), "us_wa_lni").join(" "));

  // The failure this format exists to stop.
  const wrongState = manifestProblems(manifest({ provider: "us_or_ccb", attribution: or.licence.attribution }), "us_wa_lni");
  ok("an Oregon snapshot is refused by a Washington campaign", wrongState.length > 0, wrongState.join(" "));
  ok("...and the refusal names both states", wrongState.join(" ").includes("us_or_ccb") && wrongState.join(" ").includes("us_wa_lni"));

  ok("a stripped source statement is refused", manifestProblems(manifest({ attribution: "" }), "us_wa_lni").length > 0);
  ok("a rewritten source statement is refused", manifestProblems(manifest({ attribution: "Contains data." }), "us_wa_lni").length > 0);
  ok("a future format is refused", manifestProblems(manifest({ fieldquoSnapshot: 99 }), "us_wa_lni").length > 0);
  ok("a release that is not a date is refused", manifestProblems(manifest({ release: "latest" }), "us_wa_lni").length > 0);
  ok("2026-02-31 is not a date", manifestProblems(manifest({ release: "2026-02-31" }), "us_wa_lni").length > 0);
  ok("a provider this build does not ship is refused", manifestProblems(manifest({ provider: "us_zz_none" }), "us_zz_none").length > 0);
  ok("a manifest that is not an object is refused", manifestProblems("nope", "us_wa_lni").length > 0);
  ok("no count is refused", manifestProblems(manifest({ count: null }), "us_wa_lni").length > 0);

  const licenceRow = { board: "us_wa_lni", id: "L1", name: "N", phone: "2065551234", line1: "1 ST", city: "SEATTLE", province: "WA", postalCode: "98101", status: "ACTIVE", classes: ["CC|CB"], names: ["N"] };
  const body = `${JSON.stringify(manifest())}\n${JSON.stringify(licenceRow)}\n`;
  const parsed = readSnapshot(body, "us_wa_lni");
  ok("a good snapshot reads", parsed.problems.length === 0 && parsed.rows.length === 1, parsed.problems.join(" "));
  ok("a record becomes a business", businessFromSnapshotRow(parsed.rows[0], parsed.manifest).sourceRecordId === "L1");
  ok(
    "the business from a snapshot row reaches its trade",
    tradeForCategories(businessFromSnapshotRow(parsed.rows[0], parsed.manifest).categories).tradeKey === "painting",
  );

  const truncated = readSnapshot(`${JSON.stringify(manifest({ count: 5 }))}\n${JSON.stringify(licenceRow)}\n`, "us_wa_lni");
  ok("a truncated download is caught by the count", truncated.problems.some((p) => p.includes("truncated")), truncated.problems.join(" "));

  const oneBad = readSnapshot(`${JSON.stringify(manifest({ count: 2 }))}\n${JSON.stringify(licenceRow)}\nnot json\n`, "us_wa_lni");
  ok("one malformed line costs one business, not the file", oneBad.problems.length === 0 && oneBad.rows.length === 1 && oneBad.unreadable === 1);
  ok("a first line that is not JSON is refused", readSnapshot("nope\n{}", "us_wa_lni").problems.length > 0);
  ok("an empty body is refused", readSnapshot("", "us_wa_lni").problems.length > 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Socrata resolution
   ═══════════════════════════════════════════════════════════════════════════ */

section("Resolving a Socrata board");
{
  ok("a four-by-four is recognised", isSocrataId("m8qx-ubtq") && isSocrataId("g77e-6bhs"));
  ok("a non-id is refused", !isSocrataId("m8qx_ubtq") && !isSocrataId("") && !isSocrataId(null));
  ok("the metadata URL is /api/views, not /resource", socrataMetadataUrl("data.wa.gov", "m8qx-ubtq") === "https://data.wa.gov/api/views/m8qx-ubtq.json");
  ok("the CSV URL asks for the whole file", socrataCsvUrl("data.wa.gov", "m8qx-ubtq").includes("accessType=DOWNLOAD"));

  // Seconds, not milliseconds. The value below is the real one read from
  // data.wa.gov on 2026-09-03.
  ok("rowsUpdatedAt is read as SECONDS", releaseFromSocrata({ rowsUpdatedAt: 1788482167 }) === "2026-09-04", String(releaseFromSocrata({ rowsUpdatedAt: 1788482167 })));
  ok("...and reading it as milliseconds would give 1970", new Date(1788482167).toISOString().slice(0, 4) === "1970");
  ok("no timestamp is null, never today", releaseFromSocrata({}) === null && releaseFromSocrata({ rowsUpdatedAt: 0 }) === null);
  ok("a release is validated as a real date", isBoardRelease("2026-09-03") && !isBoardRelease("2026-02-31") && !isBoardRelease("latest"));

  const view = (over = {}) => ({ id: "m8qx-ubtq", name: "L&I", licenseId: "PDDL", license: { name: "PDDL", termsLink: "http://x" }, rowsUpdatedAt: 1788482167, ...over });
  const answer = (body, okFlag = true) => ({ ok: okFlag, status: okFlag ? 200 : 500, json: async () => body });

  const good = await fetchSocrataDataset(usBoard("us_wa_lni"), { fetchImpl: async () => answer(view()) });
  ok("a good dataset resolves", good.ok === true && good.release === "2026-09-04", good.problems?.join(" ") || "");

  // The refusal that stops a false licence claim reaching a screen.
  const relicensed = await fetchSocrataDataset(usBoard("us_wa_lni"), { fetchImpl: async () => answer(view({ licenseId: "CC-BY-NC" })) });
  ok("a re-licensed dataset STOPS the extraction", relicensed.ok === false, relicensed.problems.join(" "));
  ok("...and the refusal names both licences", relicensed.problems.join(" ").includes("CC-BY-NC") && relicensed.problems.join(" ").includes("PDDL"));

  const noDate = await fetchSocrataDataset(usBoard("us_or_ccb"), { fetchImpl: async () => answer(view({ licenseId: "USGOV_WORKS", rowsUpdatedAt: null })) });
  ok("a dataset with no rowsUpdatedAt is refused rather than stamped today", noDate.ok === false);

  const down = await fetchSocrataDataset(usBoard("us_wa_lni"), { fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  ok("an unreachable portal is a problem, not a crash", down.ok === false && down.problems.join(" ").includes("ECONNREFUSED"));

  const notJson = await fetchSocrataDataset(usBoard("us_wa_lni"), { fetchImpl: async () => ({ ok: true, json: async () => { throw new Error("bad"); } }) });
  ok("a non-JSON answer is a problem, not a crash", notJson.ok === false);

  const direct = await fetchSocrataDataset(usBoard("us_ca_cslb"), { fetchImpl: async () => answer(view()) });
  ok("a direct board has no Socrata id and is refused here", direct.ok === false, direct.problems.join(" "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. The providers
   ═══════════════════════════════════════════════════════════════════════════ */

section("The registered providers");
{
  for (const key of usBoardKeys()) {
    const provider = getDiscoveryProvider(key);
    ok(`${key} is registered`, Boolean(provider));
    if (!provider) continue;
    ok(`${key} states a licence with all three required fields`, Boolean(provider.licence?.name && provider.licence?.url && provider.licence?.obligation));
    ok(`${key} renders its yield note where a superadmin reads it`, provider.description.includes(yieldNote(usBoard(key))), "not just defined — rendered");
    ok(`${key} says on the box that there is no email`, /NO email address/.test(provider.description));
    ok(`${key} carries its source statement into the description`, provider.description.includes(usBoard(key).licence.attribution));
    ok(`${key} is available`, provider.unavailableReason() === null);
    ok(`${key} refuses a config with no snapshot`, provider.describeConfig({}).ok === false);
    ok(`${key} refuses a non-URL`, provider.describeConfig({ snapshotUrl: "not a url" }).ok === false);
    ok(`${key} refuses a non-HTTP scheme`, provider.describeConfig({ snapshotUrl: "ftp://x/y.ndjson" }).ok === false);
    ok(`${key} accepts a real snapshot URL`, provider.describeConfig({ snapshotUrl: "https://x.test/y.ndjson" }).ok === true);
  }

  ok("the yield note states the decisive count", yieldNote(usBoard("us_ca_cslb")).includes("98,566"));
  ok("the yield note states the unrestricted count", yieldNote(usBoard("us_ca_cslb")).includes("80,142"));
  ok("the yield note names the extractor command", yieldNote(usBoard("us_or_ccb")).includes("--board us_or_ccb"));

  ok("the cursor is parsed defensively", parseCursor(null) === 0 && parseCursor("-4") === 0 && parseCursor("nonsense") === 0 && parseCursor("42") === 42);

  // fetchPage, against a canned snapshot.
  const wa = usBoard("us_wa_lni");
  const rows = ["A", "B", "C"].map((n, i) => ({
    board: "us_wa_lni", id: `L${i}`, name: n, phone: "2065551234", line1: "1 ST",
    city: i === 2 ? "PORTLAND" : "SEATTLE", province: i === 2 ? "OR" : "WA",
    postalCode: "98101", status: "ACTIVE", classes: ["CC|CB"], names: [n],
  }));
  const manifest = {
    fieldquoSnapshot: US_BOARD_SNAPSHOT_FORMAT, provider: "us_wa_lni", release: "2026-09-03",
    count: 3, sourceUrl: "https://x.test/f.csv", datasetUrl: wa.datasetUrl, attribution: wa.licence.attribution,
  };
  const body = [manifest, ...rows].map((r) => JSON.stringify(r)).join("\n");
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => body });
  const provider = getDiscoveryProvider("us_wa_lni");

  __clearUsBoardSnapshotCache();
  const page1 = await provider.fetchPage({ config: { snapshotUrl: "https://x.test/s.ndjson" }, limit: 2, deps: { fetchImpl } });
  ok("a page comes back with the manifest's release", page1.release === "2026-09-03" && page1.businesses.length === 2);
  ok("the cursor points past what was returned", page1.nextCursor === "2");
  const page2 = await provider.fetchPage({ config: { snapshotUrl: "https://x.test/s.ndjson" }, cursor: page1.nextCursor, limit: 2, deps: { fetchImpl } });
  ok("the last page ends the cursor", page2.businesses.length === 1 && page2.nextCursor === null);

  __clearUsBoardSnapshotCache();
  const wa_only = await provider.fetchPage({ config: { snapshotUrl: "https://x.test/s.ndjson" }, territory: { country: "US", province: "WA" }, limit: 10, deps: { fetchImpl } });
  ok("a territory filter drops the out-of-state licence", wa_only.businesses.length === 2, `${wa_only.businesses.length} of 3`);

  __clearUsBoardSnapshotCache();
  const radius = await provider.fetchPage({ config: { snapshotUrl: "https://x.test/s.ndjson" }, territory: { centerLat: 47.6, centerLng: -122.3, radiusKm: 50 }, limit: 10, deps: { fetchImpl, haversineKm: () => 1 } });
  ok("a radius territory excludes every board row, because none carries a coordinate", radius.businesses.length === 0);

  __clearUsBoardSnapshotCache();
  const wrongBoard = await getDiscoveryProvider("us_or_ccb").fetchPage({ config: { snapshotUrl: "https://x.test/s.ndjson" }, deps: { fetchImpl } });
  ok("an Oregon campaign refuses a Washington snapshot", wrongBoard.businesses.length === 0 && Boolean(wrongBoard.error), wrongBoard.error || "");

  __clearUsBoardSnapshotCache();
  const missing = await provider.fetchPage({ config: {}, deps: { fetchImpl } });
  ok("no snapshot URL is an error, not an empty result", missing.businesses.length === 0 && Boolean(missing.error));

  __clearUsBoardSnapshotCache();
  const dead = await provider.fetchPage({ config: { snapshotUrl: "https://x.test/s.ndjson" }, deps: { fetchImpl: async () => ({ ok: false, status: 404 }) } });
  ok("a 404 on the snapshot is an error, not an empty result", dead.businesses.length === 0 && Boolean(dead.error));

  // currentRelease is honest about what a direct board cannot answer.
  const socrataRelease = await getDiscoveryProvider("us_wa_lni").currentRelease({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ licenseId: "PDDL", rowsUpdatedAt: 1788482167 }) }),
  });
  ok("a Socrata board reports its current release", socrataRelease.release === "2026-09-04");
  // A direct board must answer WITHOUT going near the network: the whole point
  // is that CSLB's release cannot be learned without downloading 77 MB, so a
  // status probe that quietly tries anyway is the bug. `fetchImpl` throws if
  // it is called, which is what distinguishes "answered honestly" from
  // "attempted a Socrata lookup and happened to fail". Found by mutation
  // testing: without this, deleting the `kind !== "socrata"` guard survived.
  let directProbeFetched = false;
  const directRelease = await getDiscoveryProvider("us_ca_cslb").currentRelease({
    fetchImpl: async () => {
      directProbeFetched = true;
      throw new Error("a direct board must not probe the network for its release");
    },
  });
  ok("a direct board reports NO release rather than today's date", directRelease.release === null && Boolean(directRelease.error), directRelease.error || "");
  ok("...without making a request at all", directProbeFetched === false);
  ok("...and the reason names the missing header", /Last-Modified/.test(directRelease.error || ""), directRelease.error || "");
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. Calling a state nobody has read
   ═══════════════════════════════════════════════════════════════════════════ */

section("Adding a source does not add a calling permission");
{
  // ── The INVARIANT, not a list of states ────────────────────────────────
  //
  // The brief's rule is that a state with no entry in the jurisdiction table
  // must come back UNKNOWN and refuse, never default to allowed. Asserting it
  // by naming California and Oregon would have been a check with a shelf life:
  // the table is somebody else's file and states get read and added to it, and
  // the day California is added this check would fail for the RIGHT reason
  // while looking like a regression.
  //
  // So it asserts the rule against whichever state currently has no row, and
  // reports which of the boards' own states those are. If every state is ever
  // listed, it says so rather than passing vacuously.
  const ALL_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
    "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
    "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY",
  ];
  const unlisted = ALL_STATES.filter((s) => !CALLING_JURISDICTIONS[`US-${s}`]);
  if (unlisted.length === 0) {
    // Not a pass by default — a statement. If every state has been read, the
    // rule has nothing left to be tested against and saying so is honest.
    ok("every US state now has a jurisdiction row, so there is no unread case left to test", true, "50/50 read");
  } else {
    for (const state of unlisted.slice(0, 3)) {
      const readiness = salesCallReadiness({ prospect: { country: "US", province: state } });
      ok(`${state} has no row and is therefore NOT callable`, readiness.decision === "unknown", readiness.decision);
      ok(`${state}'s refusal names the gap rather than staying silent`, readiness.blockers.some((b) => b.code === "jurisdiction_unread"));
    }
    console.log(`       ${unlisted.length} of 50 states are still unread: ${unlisted.join(", ")}`);
  }

  // And the states these three boards actually put in the bank, reported
  // either way — a listed one is a state a rep can work, an unlisted one is
  // the owner's outstanding item and the number beside it is what it costs.
  for (const key of usBoardKeys()) {
    const board = usBoard(key);
    const row = CALLING_JURISDICTIONS[`US-${board.state}`];
    const readiness = salesCallReadiness({ prospect: { country: "US", province: board.state } });
    if (!row) {
      ok(
        `${board.state} is UNREAD — ${Number(board.measured.decisive).toLocaleString("en-US")} trade-classified contractors nobody may call`,
        readiness.decision === "unknown" && readiness.blockers.some((b) => b.code === "jurisdiction_unread"),
        "a finding, not a failure: the statute read is the owner's item",
      );
    } else {
      ok(`${board.state} has a jurisdiction row, so the gate can speak about it`, Boolean(readiness.jurisdiction), readiness.decision);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. The extractor and the wiring
   ═══════════════════════════════════════════════════════════════════════════ */

section("The offline extractor");
{
  const raw = read("scripts/us-board-snapshot.mjs");
  const script = stripComments(raw);

  ok("it groups with the SHIPPED functions, not a copy", script.includes("addLicenceRow(") && script.includes("startLicence("), "a second grouper is the copy that rots");
  ok("it uses the SHIPPED CSV splitter", script.includes("splitCsvLine("), "a second splitter puts a ZIP code in the phone column");
  ok("it applies the SHIPPED activity filter", script.includes("rowIsActive("));
  ok("it counts the trade with the SHIPPED tradeForCategories", script.includes("tradeForCategories("), "so the number printed is the number the pipeline produces");
  ok("it writes the source statement into the manifest", script.includes("attribution: board.licence.attribution"));
  ok("it checks the board declaration BEFORE downloading", script.indexOf("boardProblems(") < script.indexOf("resolveSource()"));
  ok("it stops if the board drops a column this build reads", script.includes("no longer carries"));
  ok("it counts rows whose width disagrees with the header", script.includes("badWidth"));
  ok("it reports class codes this build has never seen", script.includes("isKnownClass(") && script.includes("unknownClasses"));
  ok("it refuses to stamp a release it did not read", script.includes("isBoardRelease(") && script.includes("provenance lie"));
  ok("it reports the fill rates it actually measured", script.includes("withPhone") && script.includes("withEmail"));

  // The release is taken over EVERY row, not only the kept ones — a fact about
  // the file rather than about the subset. Scoped to main() so the rule cannot
  // match the header prose that explains it.
  const body = functionBody(script, "async function main");
  ok("main() reads the release column", body.includes("releaseColumn"), "the direct-board release comes from the data");
  ok("...before the activity filter drops anything", body.indexOf("releaseColumn") < body.indexOf("rowIsActive("));

  const pkg = JSON.parse(read("package.json"));
  ok("check:us-boards is a script", Boolean(pkg.scripts["check:us-boards"]));
  ok("...and is wired into check:all", (pkg.scripts["check:all"] || "").includes("check:us-boards"));
  ok("us-board:snapshot is a script, so the invocation is not folklore", Boolean(pkg.scripts["us-board:snapshot"]));
  ok("the extractor is invoked with the alias loader, which it needs", (pkg.scripts["us-board:snapshot"] || "").includes("alias-loader"));

  const providersIndex = stripComments(read("lib/sales/discovery/providers.js"));
  ok("the board providers are imported, so they actually register", providersIndex.includes("./usBoard/provider"));

  const doc = read("docs/sales-intel/SOURCE-US-LICENCE-BOARDS.md");
  ok("the state-by-state findings are written down", doc.length > 4000);
  for (const state of ["California", "Washington", "Oregon", "Texas", "Florida", "Tennessee", "Virginia", "Arizona", "North Carolina"]) {
    ok(`the doc records ${state}`, doc.includes(state));
  }
  ok("the doc records what could not be verified", /UNVERIFIED/.test(doc));
}

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
process.exit(failures ? 1 : 0);
