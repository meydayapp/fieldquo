// scripts/check-rbq-provider.mjs
//
// Quebec's RBQ licence register as a discovery source. Prove it groups
// 927,337 rows into 54,264 businesses without losing any, that it refuses to
// invent a trade it cannot know, that the CC-BY notice cannot be stripped, and
// that 45,831 email addresses cannot become a mailing list.
//
//   npm run check:rbq-provider
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// Every guarantee here is a decision made about a hostile row, and none of
// them is visible by reading. "The rows are grouped by licence" is a claim;
// seventeen rows of one electrician collapsing to one business WHILE keeping
// all four of its trading names is a measurement. So the shipped functions run
// here against the ways each can be wrong.
//
// No database and no network.
//
// ══ The hostile inputs, and the real bug each one stands for ═══════════════
//
//   1. A licence whose rows are NOT adjacent. The published extract happens to
//      sort them together. Relying on that is an assumption that survives
//      until the RBQ changes its sort, and then one business becomes nine.
//   2. A licence with four trading names. Measured: 4,386 of them. Every
//      identity field is constant across a licence's rows EXCEPT `Autre nom`,
//      so "take the first row" is right for twelve fields and silently lossy
//      for the thirteenth.
//   3. A business name with a comma inside its quotes. "9265-1234 QUÉBEC INC.,
//      FAISANT AFFAIRE SOUS..." is a real shape, and a naive split on commas
//      shifts every column after it — putting a postal code in the phone
//      column.
//   4. The universal authorisation bundle. 81.3% of ALL licence-holders are
//      authorised for interior finishing. A source category mapped to a trade
//      would file 44,134 businesses as painters.
//   5. An address that is not in Quebec. 493 Ontario, and one "CB" that is
//      somebody's typo for BC. Assuming QC would file them wrong.
//   6. A snapshot with the CC-BY notice removed. That is a redistribution of a
//      CC-BY dataset with the credit stripped, which is the one thing the
//      licence forbids.
//   7. An RBQ email address reaching an outbound send. CASL implies no consent
//      from a government register, and the do-not-contact list is silent about
//      these people because none of them ever opted out.
//   8. A missing coordinate. `Number(null)` is 0 and 0 is finite, so a naive
//      finite check stores a licence with no coordinates at latitude 0,
//      longitude 0 — the Gulf of Guinea.
//
// Positional source rules are scoped to ONE function extracted by brace
// matching, because a guard string sitting elsewhere in the same file has
// manufactured a false pass in this repo repeatedly.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RBQ_ADMIN_CODES,
  RBQ_CATEGORY_PREFIX,
  RBQ_COLUMNS,
  RBQ_GENERAL_SCOPE_BUNDLE,
  addLicenceRow,
  authorisationCodes,
  foldForMatch,
  groupLicences,
  parseRbqAddress,
  parseRbqEmails,
  splitCsvLine,
  startLicence,
  toDiscoveredBusiness,
} from "@/lib/sales/discovery/rbq/licence";
import {
  RBQ_ATTRIBUTION,
  RBQ_DATASET_ID,
  fetchRbqResource,
  isRbqRelease,
  pickCsvResource,
  releaseFromResource,
} from "@/lib/sales/discovery/rbq/register";
import {
  RBQ_PROVIDER_KEY,
  RBQ_SNAPSHOT_FORMAT,
  businessFromSnapshotRow,
  manifestProblems,
  readSnapshot,
} from "@/lib/sales/discovery/rbq/snapshot";
import { RBQ_YIELD_NOTE, __clearRbqSnapshotCache, parseCursor, rbqProvider } from "@/lib/sales/discovery/rbq/provider";
import { claimCandidateWhere } from "@/lib/sales/prospectView";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";
import { shapeProblems } from "@/lib/sales/discovery/provider";
import { tradeForCategories, duplicateSourceCategories } from "@/lib/sales/discovery/trades";
import { isCallReady, normaliseBusiness } from "@/lib/sales/discovery/normalise";
import { nameKey } from "@/lib/sales/discovery/dedupe";
import { planIngest } from "@/lib/sales/discovery/ingest";
import { contactBasisFor, prohibitedChannelsFor, suppressionVerdict } from "@/lib/sales/suppressionRules";
import { sourceRows, SOURCE_ATTRIBUTION } from "@/lib/sales/prospectView";

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

/**
 * The body of one function, by brace matching, so a rule cannot match prose.
 *
 * The parameter list is skipped by matching PARENS first. Taking the first `{`
 * after the signature looks right and is not: a destructured parameter list —
 * `deliverOutreach({ rep, lead, thread })` — opens a brace of its own, and the
 * matcher then returns the parameter list as "the body". Every positional rule
 * scoped to such a function passes vacuously. Caught by this check failing on
 * a guard that was demonstrably present in the file.
 */
function functionBody(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) return "";
  const open = src.indexOf("(", start);
  if (open === -1) return "";
  let parens = 0;
  let afterParams = -1;
  for (let j = open; j < src.length; j++) {
    if (src[j] === "(") parens++;
    else if (src[j] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = j;
        break;
      }
    }
  }
  if (afterParams === -1) return "";
  let i = src.indexOf("{", afterParams);
  if (i === -1) return "";
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. The CSV reader
   ═══════════════════════════════════════════════════════════════════════════ */

section("Reading the published extract");
{
  const header = splitCsvLine(
    '"Numéro de licence","Statut de la licence","Type de licence","Date de délivrance","Restriction",' +
      '"Date de début de la restriction","Date de fin de la restriction",' +
      '"Association ou compagnie fournissant le cautionnement","Montant de la caution","Date du paiement annuel",' +
      '"Mandataire","Courriel","Adresse","NEQ","Nom de l\'intervenant","Numéro de téléphone","Municipalité",' +
      '"Statut juridique","Code de région administrative","Région administrative",' +
      '"Nombre de sous-catégorie autorisées","Categorie","Sous-catégories","Autre nom"',
  );
  // The brief that commissioned this said 23 semicolon-delimited columns. The
  // real file is 24 comma-delimited ones — the restriction's start and end
  // dates are two separate columns. Asserted so a future reader trusts the
  // code over the brief.
  ok("the extract has 24 columns, not 23", header.length === 24, `${header.length}`);
  ok("every column this build reads is in the real header",
    Object.values(RBQ_COLUMNS).every((c) => header.includes(c)),
    JSON.stringify(Object.values(RBQ_COLUMNS).filter((c) => !header.includes(c))));

  // Hostile input 3.
  const commaInName = splitCsvLine('"1100-0001-01","Active","Entrepreneur","2020-01-01","Non"');
  ok("plain quoted fields split", commaInName.length === 5 && commaInName[2] === "Entrepreneur");

  const embedded = splitCsvLine('"9265-1234 QUÉBEC INC., FAISANT AFFAIRE SOUS PLANCHERS X","5145551234"');
  ok("a comma INSIDE quotes does not shift the columns",
    embedded.length === 2 && embedded[0].includes(",") && embedded[1] === "5145551234",
    JSON.stringify(embedded));

  const escaped = splitCsvLine('"He said ""hello""","b"');
  ok('a doubled quote decodes to one', escaped[0] === 'He said "hello"', JSON.stringify(escaped));

  ok("an empty line yields one empty field rather than throwing", splitCsvLine("").length === 1);
  ok("null does not throw", splitCsvLine(null).length === 1);
  ok("a trailing empty field is kept",
    splitCsvLine('"a","b",""').length === 3,
    JSON.stringify(splitCsvLine('"a","b",""')));
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Grouping — the whole job
   ═══════════════════════════════════════════════════════════════════════════ */

section("927,337 rows are 54,264 businesses");
{
  const row = (licence, sub, other = "") => ({
    [RBQ_COLUMNS.licence]: licence,
    [RBQ_COLUMNS.status]: "Active",
    [RBQ_COLUMNS.type]: "Entrepreneur",
    [RBQ_COLUMNS.issuer]: "Regie",
    [RBQ_COLUMNS.name]: "Roy & Fils Ltée",
    [RBQ_COLUMNS.phone]: "5147254754",
    [RBQ_COLUMNS.email]: "info@royfils.ca",
    [RBQ_COLUMNS.address]: "217 BOULEVARD MAISONNEUVE SAINT-JÉRÔME QC CANADA J5L 0A1",
    [RBQ_COLUMNS.municipality]: "Saint-Jérôme",
    [RBQ_COLUMNS.subcategory]: sub,
    [RBQ_COLUMNS.otherName]: other,
  });

  // Seventeen rows of one licence — the real median.
  const codes = ["1.2", "1.3", "2.5", "2.7", "3.2", "4.2", "5.2", "6.2", "7", "8", "9", "11.2", "12", "13.5", "17.2", "GPC", "SEC"];
  const one = groupLicences(codes.map((c) => row("1105-2289-09", c)));
  ok("seventeen rows of one licence collapse to ONE business", one.length === 1, `${one.length}`);
  ok("...keeping every subcategory", one[0].subcategories.length === 17, `${one[0].subcategories.length}`);

  // Hostile input 1: interleaved licences.
  const interleaved = groupLicences([
    row("A", "9"),
    row("B", "16"),
    row("A", "7"),
    row("C", "15.5"),
    row("B", "9"),
    row("A", "12"),
  ]);
  ok("rows of one licence that are NOT adjacent still group",
    interleaved.length === 3 && interleaved.find((l) => l.licence === "A").subcategories.length === 3,
    JSON.stringify(interleaved.map((l) => [l.licence, l.subcategories.length])));

  // Hostile input 2: the one field that varies.
  const names = ["Plancher Nobel", "Tapis L. Émard Ltée", "Emard Couvre-Planchers", "Décor Tapis Émard"];
  const many = groupLicences(
    names.flatMap((n) => ["9", "7", "12"].map((c) => row("1104-8618-06", c, n))),
  );
  ok("all four trading names survive the grouping",
    many.length === 1 && many[0].otherNames.length === 4,
    JSON.stringify(many[0]?.otherNames));
  ok("...and a repeated trading name is not stored twice",
    many[0].otherNames.length === new Set(many[0].otherNames).size);
  ok("...and the twelve constant fields come through once",
    many[0].name === "Roy & Fils Ltée" && many[0].phone === "5147254754");

  ok("a row with no licence number is dropped rather than grouped under ''",
    groupLicences([row("", "9"), row("A", "9")]).length === 1);
  ok("an empty input is an empty result, not a throw", groupLicences([]).length === 0);

  // The count that matters: nothing is lost and nothing is duplicated.
  const wide = [];
  for (let i = 0; i < 500; i++) for (const c of codes) wide.push(row(`L-${i}`, c));
  const grouped = groupLicences(wide);
  ok("500 licences × 17 rows → exactly 500 businesses", grouped.length === 500, `${grouped.length}`);
  ok("...every one of them keeps all 17 authorisations",
    grouped.every((l) => l.subcategories.length === 17));
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The finding that shapes the provider: authorisations are not a trade
   ═══════════════════════════════════════════════════════════════════════════ */

section("Subcategories are an authorisation set, and no trade is guessed from one");
{
  ok("the general-scope bundle is the thirteen codes that were measured",
    RBQ_GENERAL_SCOPE_BUNDLE.length === 13, `${RBQ_GENERAL_SCOPE_BUNDLE.length}`);
  // 9 = travaux de finition (81.3% of ALL licences), 12 = armoires et
  // comptoirs (77.0%), 7 = isolation/couvertures (80.0%).
  for (const code of ["9", "12", "7"]) {
    ok(`code ${code} is in the bundle — held by ~80% of licence-holders`,
      RBQ_GENERAL_SCOPE_BUNDLE.includes(code));
  }

  const licence = { licence: "X", subcategories: ["9", "12", "7", "GPC", "SEC", "ADM"], otherNames: [] };
  const codes = authorisationCodes(licence);
  ok("every authorisation is namespaced", codes.every((c) => c.startsWith(RBQ_CATEGORY_PREFIX)), JSON.stringify(codes));
  ok("the three competence attestations are NOT carried as categories",
    !codes.some((c) => [...RBQ_ADMIN_CODES].some((a) => c === `${RBQ_CATEGORY_PREFIX}${a}`)),
    JSON.stringify(codes));
  ok("the authorisations ARE carried, so provenance is not lost", codes.length === 3, JSON.stringify(codes));
  ok("they are sorted, so two runs of one licence produce one string",
    JSON.stringify(codes) === JSON.stringify([...codes].sort()));

  // The load-bearing negative. If this ever fails, 44,134 Quebec businesses
  // are about to be filed as painters.
  const business = toDiscoveredBusiness(licence, { release: "2026-09-03", sourceUrl: "https://x.test" });
  ok("no RBQ code maps to a FieldQuo trade", tradeForCategories(business.categories).tradeKey === null,
    JSON.stringify(tradeForCategories(business.categories)));
  ok("...and primary is null, because the register names no trade",
    business.categories.primary === null);
  ok("trades.js still has no duplicate source category", duplicateSourceCategories().length === 0);

  const trades = read("lib/sales/discovery/trades.js");
  ok("trades.js carries no rbq: category at all",
    !trades.includes(RBQ_CATEGORY_PREFIX),
    "an rbq: key in the trade map is a trade guessed from an authorisation");
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Addresses
   ═══════════════════════════════════════════════════════════════════════════ */

section("Addresses are split only as far as they can be positively read");
{
  const a = parseRbqAddress("217 BOULEVARD MAISONNEUVE SAINT-JÉRÔME QC CANADA J5L 0A1", "Saint-Jérôme");
  ok("the postal code comes off the end", a.postalCode === "J5L 0A1", JSON.stringify(a));
  ok("the country is ISO-2, matching what Overture writes", a.country === "CA", a.country);
  ok("the province is taken from the string", a.province === "QC", a.province);
  ok("the city is the Municipalité column, correctly accented", a.city === "Saint-Jérôme", a.city);
  ok("the municipality is stripped off the street line",
    a.line === "217 BOULEVARD MAISONNEUVE", JSON.stringify(a.line));

  // Hostile input 5.
  const ont = parseRbqAddress("100 MAIN ST OTTAWA ON CANADA K1A 0B1", "Ottawa");
  ok("an Ontario address is not forced to QC", ont.province === "ON", ont.province);
  const typo = parseRbqAddress("1 RUE X VANCOUVER CB CANADA V6B 1A1", "Vancouver");
  ok("the register's own 'CB' typo is carried, not corrected", typo.province === "CB", typo.province);

  const mixed = parseRbqAddress("2077 Route Kennedy Saint-Isidore QC Canada G0S 2S0", "Saint-Isidore");
  ok("a mixed-case tail parses too", mixed.postalCode === "G0S 2S0" && mixed.country === "CA", JSON.stringify(mixed));

  const noPostal = parseRbqAddress("12 RUE SANS CODE MONTRÉAL QC CANADA", "Montréal");
  ok("no postal code is null, and the rest still parses",
    noPostal.postalCode === null && noPostal.province === "QC", JSON.stringify(noPostal));

  const junk = parseRbqAddress("SOMEWHERE ELSE ENTIRELY", "Laval");
  ok("an unparseable address keeps its whole string rather than being blanked",
    junk.line === "SOMEWHERE ELSE ENTIRELY" || junk.line?.startsWith("SOMEWHERE"), JSON.stringify(junk));

  const empty = parseRbqAddress("", "Laval");
  ok("no address at all is nulls, not an invented line",
    empty.line === null && empty.postalCode === null && empty.city === "Laval", JSON.stringify(empty));

  const onlyCity = parseRbqAddress("MONTRÉAL QC CANADA H1A 1A1", "Montréal");
  ok("an address that is ONLY its municipality keeps the municipality",
    Boolean(onlyCity.line), JSON.stringify(onlyCity));

  ok("accent folding matches the address spelling to the column spelling",
    foldForMatch("TROIS-RIVIÈRES") === foldForMatch("Trois-Rivières"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. What one licence becomes
   ═══════════════════════════════════════════════════════════════════════════ */

section("One licence, in the shape every provider must emit");
{
  const licence = {
    licence: "1105-2289-09",
    status: "Active",
    type: "Entrepreneur",
    issuer: "CMEQ",
    name: "Roy & Fils Ltée",
    phone: "5147254754",
    email: "rbessette@royfils.ca",
    address: "217 BOULEVARD MAISONNEUVE SAINT-JÉRÔME QC CANADA J5L 0A1",
    municipality: "Saint-Jérôme",
    subcategories: ["16", "9", "GPC"],
    otherNames: ["Roy Electrique"],
  };
  const b = toDiscoveredBusiness(licence, { release: "2026-09-03", sourceUrl: "https://x.test/f.zip" });

  ok("the shape passes the interface's own check", shapeProblems(b).length === 0, JSON.stringify(shapeProblems(b)));
  ok("the licence number is the stable source record id", b.sourceRecordId === "1105-2289-09");
  ok("operatingStatus is the register's word, verbatim", b.operatingStatus === "Active", b.operatingStatus);
  ok("the issuing body is carried as the contributing dataset", b.sourceDataset === "CMEQ", b.sourceDataset);

  // Hostile input 8 — and the reason normalise.js's finiteOrNull was fixed.
  ok("no coordinates means null, never 0", b.latitude === null && b.longitude === null);
  const shaped = normaliseBusiness(b, { provider: "rbq", release: "2026-09-03" });
  ok("...and it is still null after normalisation, not the Gulf of Guinea",
    shaped.prospect.latitude === null && shaped.prospect.longitude === null,
    JSON.stringify([shaped.prospect.latitude, shaped.prospect.longitude]));
  ok("a source that expressed no confidence is not stored as confidence 0",
    shaped.prospect.sourceConfidence === null, `${shaped.prospect.sourceConfidence}`);

  ok("the register carries no website, so hasWebsite is null and not false",
    shaped.prospect.hasWebsite === null, `${shaped.prospect.hasWebsite}`);
  ok("the licence issue date is NOT reported as a refresh time",
    b.sourceUpdatedAt === null, `${b.sourceUpdatedAt}`);
  ok("the phone normalises to E.164", shaped.prospect.phoneE164 === "+15147254754", shaped.prospect.phoneE164);
  ok("this row is call-ready", isCallReady(shaped.prospect));
  ok("the email is INGESTED, as evidence — it is identity data, not a mailing list",
    shaped.facts.some((f) => f.field === "email" && f.raw === "rbessette@royfils.ca"));
  ok("the authorisations reach Prospect.sourceCategories",
    shaped.prospect.sourceCategories.includes("rbq:16"), JSON.stringify(shaped.prospect.sourceCategories));

  // Accented names must key the same as their unaccented spelling, or no
  // French business ever matches its own duplicate.
  ok("an accented business name folds to a usable dedupe key",
    nameKey("Rénovations Lévis Inc.") === nameKey("Renovations Levis Inc"),
    JSON.stringify([nameKey("Rénovations Lévis Inc."), nameKey("Renovations Levis Inc")]));

  ok("emails: a single address is read", JSON.stringify(parseRbqEmails("a@b.ca")) === '["a@b.ca"]');
  ok("emails: two separated addresses are both read",
    parseRbqEmails("a@b.ca; c@d.ca").length === 2, JSON.stringify(parseRbqEmails("a@b.ca; c@d.ca")));
  ok("emails: a non-address is dropped rather than stored",
    parseRbqEmails("aucun").length === 0, JSON.stringify(parseRbqEmails("aucun")));
  ok("emails: nothing is an empty list, not [null]", parseRbqEmails(null).length === 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The snapshot, and the notice that cannot be stripped
   ═══════════════════════════════════════════════════════════════════════════ */

section("The snapshot refuses what it cannot vouch for");
{
  const manifest = {
    fieldquoSnapshot: RBQ_SNAPSHOT_FORMAT,
    provider: RBQ_PROVIDER_KEY,
    release: "2026-09-03",
    count: 1,
    attribution: RBQ_ATTRIBUTION,
    sourceUrl: "https://x.test/f.zip",
  };
  const licence = { licence: "A", name: "X", subcategories: ["9"], otherNames: [] };
  const body = `${JSON.stringify(manifest)}\n${JSON.stringify(licence)}\n`;

  ok("a good snapshot reads", readSnapshot(body).problems.length === 0, JSON.stringify(readSnapshot(body).problems));

  // Hostile input 6.
  const stripped = readSnapshot(`${JSON.stringify({ ...manifest, attribution: undefined })}\n${JSON.stringify(licence)}\n`);
  ok("a snapshot with the CC-BY notice removed is REFUSED",
    stripped.problems.some((p) => p.includes("attribution")), JSON.stringify(stripped.problems));

  const wrongNotice = readSnapshot(`${JSON.stringify({ ...manifest, attribution: "made up" })}\n${JSON.stringify(licence)}\n`);
  ok("...and so is one whose notice has been rewritten", wrongNotice.problems.length > 0);

  const truncated = readSnapshot(`${JSON.stringify({ ...manifest, count: 900 })}\n${JSON.stringify(licence)}\n`);
  ok("a truncated download is caught by the manifest's own count",
    truncated.problems.some((p) => p.includes("truncated")), JSON.stringify(truncated.problems));

  ok("a snapshot for another provider is refused",
    manifestProblems({ ...manifest, provider: "overture" }).length > 0);
  ok("a release that is not a date is refused",
    manifestProblems({ ...manifest, release: "latest" }).length > 0);
  ok("a manifest that is not an object is refused", manifestProblems("nope").length === 1);
  ok("an empty body is refused", readSnapshot("").problems.length > 0);
  ok("a first line that is not JSON is refused", readSnapshot("hello\n").problems.length > 0);

  const oneBad = readSnapshot(`${JSON.stringify({ ...manifest, count: 2 })}\n${JSON.stringify(licence)}\nNOT JSON\n`);
  ok("one malformed record costs one business, not the whole snapshot",
    oneBad.rows.length === 1 && oneBad.unreadable === 1 && oneBad.problems.length === 0,
    JSON.stringify(oneBad.problems));

  const b = businessFromSnapshotRow(licence, manifest);
  ok("a snapshot row becomes a business carrying the release",
    b.sourceRelease === "2026-09-03" && b.sourceUrl === "https://x.test/f.zip");

  ok("the release format is validated", isRbqRelease("2026-09-03") && !isRbqRelease("2026-9-3"));
  ok("a date that does not exist is not a release", !isRbqRelease("2026-02-31"));
  ok("garbage is not a release", !isRbqRelease(null) && !isRbqRelease("") && !isRbqRelease("latest"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. CKAN resolution
   ═══════════════════════════════════════════════════════════════════════════ */

section("The download URL is resolved, never hardcoded");
{
  const registerSrc = read("lib/sales/discovery/rbq/register.js");
  ok("the dataset id is the stable one, not a resource id", RBQ_DATASET_ID === "755b45d6-7aee-46df-a216-748a0191c79f");
  ok("no resource download URL is hardcoded anywhere in the provider",
    !registerSrc.includes("/download/rdl01"),
    "a hardcoded resource URL 404s the day the RBQ re-publishes");

  const pkg = {
    license_id: "cc-by",
    resources: [
      { format: "JSON", url: "https://x.test/a.json" },
      { format: "PDF", url: "https://x.test/doc.pdf" },
      { format: "CSV", url: "https://x.test/f.zip", last_modified: "2026-09-03T07:00:18.879179" },
    ],
  };
  ok("the zipped CSV is picked over the JSON sibling", pickCsvResource(pkg).resource?.url === "https://x.test/f.zip");
  ok("...by format and extension, not by position",
    pickCsvResource({ ...pkg, resources: [...pkg.resources].reverse() }).resource?.url === "https://x.test/f.zip");
  ok("a package with no CSV reports a problem rather than returning the PDF",
    pickCsvResource({ resources: [{ format: "PDF", url: "x" }] }).resource === null);
  ok("a package with no resources at all is a problem", pickCsvResource({}).problems.length === 1);
  ok("the release is the resource's own last_modified date",
    releaseFromResource(pkg.resources[2]) === "2026-09-03");
  ok("a resource with no date has no release, rather than today's",
    releaseFromResource({}) === null);

  const answering = (payload, okStatus = true) => async () => ({
    ok: okStatus,
    status: okStatus ? 200 : 503,
    json: async () => payload,
  });

  const good = await fetchRbqResource({ fetchImpl: answering({ result: pkg }) });
  ok("a good CKAN answer resolves to a URL and a release",
    good.ok && good.url === "https://x.test/f.zip" && good.release === "2026-09-03", JSON.stringify(good));
  ok("...and carries the attribution the licence requires", good.attribution === RBQ_ATTRIBUTION);

  // The licence is RE-READ. If the RBQ ever relicensed, printing a CC-BY
  // notice would be a false statement made on FieldQuo's behalf.
  const relicensed = await fetchRbqResource({
    fetchImpl: answering({ result: { ...pkg, license_id: "notspecified" } }),
  });
  ok("a dataset that is no longer CC-BY stops the extractor",
    !relicensed.ok && relicensed.problems.some((p) => p.includes("licence")), JSON.stringify(relicensed.problems));

  const down = await fetchRbqResource({ fetchImpl: answering({}, false) });
  ok("a 503 from Données Québec is a problem, not a throw", !down.ok && down.problems.length === 1);
  const nonsense = await fetchRbqResource({ fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  ok("a CKAN answer with no result is a problem", !nonsense.ok);
  const threw = await fetchRbqResource({
    fetchImpl: async () => {
      throw new Error("ENOTFOUND");
    },
  });
  ok("a network failure is a problem, not an exception", !threw.ok && threw.problems[0].includes("ENOTFOUND"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The provider
   ═══════════════════════════════════════════════════════════════════════════ */

section("The provider is registered, and refuses honestly");
{
  ok("rbq is registered under its own key", getDiscoveryProvider("rbq") === rbqProvider);
  ok("overture is still registered alongside it", Boolean(getDiscoveryProvider("overture")));
  // A regex rather than a literal, for the reason check-sales-discovery.mjs
  // does the same on the line above it in providers.js: a bare
  // `import "./rbq/provider"` string in this file is an import specifier as
  // far as scripts/check-imports.mjs is concerned, and it fails the build
  // trying to resolve it relative to scripts/.
  ok("providers.js imports the rbq provider for its side effect",
    /import "\.\/rbq\/provider";/.test(read("lib/sales/discovery/providers.js")),
    "a provider nobody imports never registers, and a campaign naming it fails");

  ok("the CC-BY notice is on the provider description the campaign form renders",
    rbqProvider.description.includes("CC BY 4.0"), rbqProvider.description.slice(0, 60));

  // The honest refusal, and its ORDER. A refusal placed first would stop the
  // snapshot URL ever being validated, and the day the refusal is lifted the
  // URL check would turn out never to have run.
  const noUrl = rbqProvider.describeConfig({});
  ok("no snapshot URL is refused, naming the URL first",
    !noUrl.ok && noUrl.problems[0].includes("snapshot URL"), JSON.stringify(noUrl.problems[0]));
  const badUrl = rbqProvider.describeConfig({ snapshotUrl: "not a url" });
  ok("a non-URL is refused", !badUrl.ok && badUrl.problems[0].includes("not a URL"));
  const badScheme = rbqProvider.describeConfig({ snapshotUrl: "s3://bucket/f.ndjson" });
  ok("s3:// is refused, because the snapshot is fetched over HTTP", !badScheme.ok);

  // ── The flip, 2026-09-03 ──────────────────────────────────────────────
  //
  // This assertion used to read "a perfectly good snapshot URL is STILL
  // refused". It was true for as long as an RBQ campaign could only produce a
  // dead end — no website column, so no crawl, so no trade, so nothing that
  // could ever reach a rep. lib/sales/discovery/rbq/derivedSite.js closed
  // that, and scripts/check-rbq-derived-site.mjs is where the closing is
  // proved. The URL branches above still run, which is exactly why the
  // refusal was written LAST: lifting it leaves a config validator that has
  // been exercised all along rather than one nothing ever reached.
  const good = rbqProvider.describeConfig({ snapshotUrl: "https://x.test/f.ndjson" });
  ok("a good snapshot URL is now ACCEPTED — the source can run",
    good.ok === true && good.problems.length === 0,
    JSON.stringify(good.problems));
  ok("...and the summary describes the snapshot, so the field was validated",
    good.summary === "x.test/f.ndjson", good.summary);
  ok("...and the source no longer reports itself unavailable",
    rbqProvider.unavailableReason() === null,
    String(rbqProvider.unavailableReason()).slice(0, 60));

  // The yield is not silence. 2% of the register becomes callable and the
  // superadmin ticking the box has to be told that BEFORE they tick it, or the
  // form has quietly promised 54,264 contractors and will deliver 1,100.
  ok("the yield note is rendered on the description the campaign form shows",
    rbqProvider.description.includes(RBQ_YIELD_NOTE),
    "a number defined and never rendered is the first failure class");
  ok("...and it says why a trade is not read off an authorisation, in numbers",
    RBQ_YIELD_NOTE.includes("81%") && RBQ_YIELD_NOTE.includes("77%"));
  ok("...and it says how many licences actually become callable",
    /1,100/.test(RBQ_YIELD_NOTE) && /54,264/.test(RBQ_YIELD_NOTE),
    "the honest half is the denominator");
  ok("...and it names the corroboration, so nobody reads the domain as published",
    /DERIVED/.test(RBQ_YIELD_NOTE) && /phone or\s+address/.test(RBQ_YIELD_NOTE.replace(/\s+/g, " ")));

  const body = functionBody(read("lib/sales/discovery/rbq/provider.js"), "describeConfig(config = {})");
  ok("the URL branches still run BEFORE the acceptance",
    body.indexOf("protocol") !== -1 && body.indexOf("protocol") < body.lastIndexOf("ok: true"),
    "an acceptance placed first would leave the URL validation never exercised");
  // "describeConfig accepts exactly once" belongs here and is NOT here, on
  // purpose. This file reads source RAW, and the comment beside the acceptance
  // in provider.js contains the literal `ok: true` — so a count over the raw
  // text counted two and failed on prose. That is the exact false-pass class
  // this repo has been bitten by, arriving as a false FAIL for once. The
  // assertion lives in scripts/check-rbq-derived-site.mjs, which strips
  // comments before matching.

  ok("parseCursor defends against garbage",
    parseCursor(null) === 0 && parseCursor("-4") === 0 && parseCursor("abc") === 0 && parseCursor("12") === 12);
}

section("fetchPage walks the snapshot without losing or repeating a licence");
{
  const manifest = {
    fieldquoSnapshot: RBQ_SNAPSHOT_FORMAT,
    provider: RBQ_PROVIDER_KEY,
    release: "2026-09-03",
    count: 250,
    attribution: RBQ_ATTRIBUTION,
    sourceUrl: "https://x.test/f.zip",
  };
  const rows = [];
  for (let i = 0; i < 250; i++) {
    rows.push({
      licence: `L-${i}`,
      name: `Entreprise ${i}`,
      status: "Active",
      issuer: "Regie",
      phone: "5145550100",
      email: `a${i}@x.ca`,
      address: `${i} RUE X MONTRÉAL QC CANADA H1A 1A1`,
      municipality: "Montréal",
      subcategories: ["9", "12", "GPC"],
      otherNames: [],
    });
  }
  const text = [JSON.stringify(manifest), ...rows.map((r) => JSON.stringify(r))].join("\n");
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => text });
  const config = { snapshotUrl: "https://x.test/f.ndjson" };

  __clearRbqSnapshotCache();
  const seen = [];
  let cursor = null;
  let pages = 0;
  do {
    const page = await rbqProvider.fetchPage({ cursor, limit: 100, config, deps: { fetchImpl } });
    if (page.error) throw new Error(page.error);
    seen.push(...page.businesses);
    cursor = page.nextCursor;
    pages++;
  } while (cursor && pages < 10);

  ok("every licence in the snapshot is returned exactly once",
    seen.length === 250 && new Set(seen.map((b) => b.sourceRecordId)).size === 250, `${seen.length}`);
  ok("paging ends with a null cursor rather than looping", cursor === null, `${cursor}`);
  ok("the release comes from the snapshot, not from today", seen[0].sourceRelease === "2026-09-03");

  __clearRbqSnapshotCache();
  const dead = await rbqProvider.fetchPage({ config, deps: { fetchImpl: async () => ({ ok: false, status: 404 }) } });
  ok("a 404 on the snapshot is an error, not an empty page",
    dead.businesses.length === 0 && dead.error?.includes("404"), dead.error);
  const noConfig = await rbqProvider.fetchPage({ config: {}, deps: { fetchImpl } });
  ok("no snapshot URL is an error, not silently zero businesses", Boolean(noConfig.error));

  // The territory filter is Overture's, reused. A register carries no
  // coordinates, so a radius territory must EXCLUDE these rows rather than
  // silently place them at (0,0).
  __clearRbqSnapshotCache();
  const radius = await rbqProvider.fetchPage({
    config,
    deps: { fetchImpl },
    territory: { centerLat: 45.5, centerLng: -73.6, radiusKm: 25 },
  });
  ok("a radius territory excludes rows the register cannot locate",
    radius.businesses.length === 0, `${radius.businesses.length}`);
  __clearRbqSnapshotCache();
  const city = await rbqProvider.fetchPage({ config, deps: { fetchImpl }, territory: { city: "Montréal" } });
  ok("a city territory matches on the Municipalité column", city.businesses.length === 100, `${city.businesses.length}`);
  __clearRbqSnapshotCache();
  const elsewhere = await rbqProvider.fetchPage({ config, deps: { fetchImpl }, territory: { city: "Toronto" } });
  ok("a city with no licences returns none rather than everything", elsewhere.businesses.length === 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. What ingest does with them — the consequence, asserted
   ═══════════════════════════════════════════════════════════════════════════ */

section("The consequence of an unset trade is counted, not hidden");
{
  const business = toDiscoveredBusiness(
    { licence: "A", name: "Construction Roy", status: "Active", phone: "5145550100",
      address: "1 RUE X MONTRÉAL QC CANADA H1A 1A1", municipality: "Montréal",
      subcategories: ["9", "12"], otherNames: [] },
    { release: "2026-09-03", sourceUrl: "https://x.test" },
  );
  const { plans, counters } = planIngest([business], { provider: "rbq", release: "2026-09-03", tradeKey: null }, null);

  // INVERTED 2026-09-03. The old version asserted `action === "skip"` and "no
  // prospect is written", which was true of the ingest as it stood and is the
  // exact behaviour that made this source unusable. What is asserted now is
  // the pair that has to hold TOGETHER, because either half alone is a bug:
  // the row is WRITTEN (or the register is worthless), and it is written with
  // NO TRADE and not counted as accepted (or a Quebec licence-holder lands in
  // a painting queue on the strength of an authorisation code).
  ok("an RBQ business is counted as found", counters.foundCount === 1);
  ok("...and as unmapped, because it has no trade", counters.unmappedCount === 1);
  ok("...and is written to the bank rather than thrown away", plans[0].action === "insert",
    JSON.stringify([plans[0].action, plans[0].reason]));
  ok("...with tradeKey null — never inferred from an authorisation code",
    plans[0].row.tradeKey === null);
  ok("...and counted as banked rather than accepted",
    counters.bankedCount === 1 && counters.acceptedCount === 0 && counters.needsReviewCount === 0);
  ok("...so it can reach no rep's queue: claimCandidateWhere needs an exact trade key",
    claimCandidateWhere({ tradeKey: plans[0].row.tradeKey }).tradeKey === "__none__");
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. CASL — 45,831 addresses that are not a mailing list
   ═══════════════════════════════════════════════════════════════════════════ */

section("CASL: a register is not consent");
{
  ok("email from the RBQ is prohibited", contactBasisFor("rbq", "email").state === "prohibited");
  ok("sms from the RBQ is prohibited", contactBasisFor("rbq", "sms").state === "prohibited");
  ok("a voice call is NOT prohibited — CASL does not govern calls",
    contactBasisFor("rbq", "phone").state === "permitted");
  ok("...and the phone reason still names the internal DNC list and the CRTC rules",
    contactBasisFor("rbq", "phone").reason.includes("internal do-not-call") &&
      contactBasisFor("rbq", "phone").reason.includes("CRTC"));
  ok("the two closed channels are exactly email and sms",
    JSON.stringify(prohibitedChannelsFor("rbq").sort()) === '["email","sms"]',
    JSON.stringify(prohibitedChannelsFor("rbq")));

  ok("Overture's CEM basis is undetermined, not invented in either direction",
    contactBasisFor("overture", "email").state === "undetermined");
  ok("...and undetermined blocks nothing",
    prohibitedChannelsFor("overture").length === 0, JSON.stringify(prohibitedChannelsFor("overture")));
  ok("an unknown provider is undetermined rather than permitted",
    contactBasisFor("who", "email").state === "undetermined");

  // The gate itself. An empty suppression list is the REAL case here: nobody
  // in this file has ever opted out, because nobody was ever asked.
  const clean = suppressionVerdict({ rows: [], channel: "email", sourceProvider: "rbq" });
  ok("an RBQ address with NO opt-out on file is still refused for email",
    clean.suppressed === true, JSON.stringify(clean));
  ok("...and the refusal explains CASL rather than claiming they opted out",
    clean.hit === null && clean.reason.includes("CASL"), clean.reason);
  ok("an RBQ number is NOT refused for a call",
    suppressionVerdict({ rows: [], channel: "phone", sourceProvider: "rbq" }).suppressed === false);
  ok("omitting the provider changes nothing for every existing caller",
    suppressionVerdict({ rows: [], channel: "email" }).suppressed === false);
  ok("a real opt-out still wins on a source with no restriction",
    suppressionVerdict({
      rows: [{ kind: "email", value: "a@b.ca", channels: ["email"], source: "reply" }],
      channel: "email",
      sourceProvider: "overture",
    }).suppressed === true);

  // Hostile input 7: the send paths must actually ask.
  const sender = read("lib/sales/outreachSender.js");
  const deliver = functionBody(sender, "export async function deliverOutreach(");
  ok("deliverOutreach resolves the contact's provenance", deliver.includes("sourceProviderForContact("));
  ok("...and passes it to the suppression check", /checkSuppression\(db,\s*\{[^}]*sourceProvider/.test(deliver));
  ok("...before it builds the email", deliver.indexOf("sourceProviderForContact(") < deliver.indexOf("buildOutboundEmail"));
  ok("...and before anything is sent", deliver.indexOf("sourceProviderForContact(") < deliver.indexOf("sendEmail("));

  const sms = read("lib/sales/salesSms.js");
  const smsGate = functionBody(sms, "async function suppressionFor(lead)");
  ok("the SMS path asks the same question", smsGate.includes("sourceProviderForContact("));
  ok("...and passes it through", /checkSuppression\(db,\s*\{[^}]*sourceProvider/.test(smsGate));

  const suppression = read("lib/sales/suppression.js");
  const lookup = functionBody(suppression, "export async function sourceProviderForContact(");
  ok("provenance is looked up by the lead's prospect link", lookup.includes("salesLead.findUnique"));
  // `db.` included on purpose: an earlier version of this rule matched the
  // bare method name, and a mutation that renamed the model to
  // `notprospectEvidence` sailed straight through it. The substring a rule
  // matches has to be one a break cannot keep.
  ok("...and ALSO by the address itself, for an address a rep pasted in",
    lookup.includes("db.prospectEvidence.findFirst("),
    "nothing writes SalesLead.prospectId today, so the link alone would never fire");
  ok("...matching the normalised address and the raw one",
    lookup.includes("normalizedValue: address") && lookup.includes("rawValue: address"));
  ok("an unknown contact imposes no restriction", lookup.includes("return null"));

  // The email is INGESTED. Dropping it would lose identity and dedupe data.
  // The presenter that renders this rule is imported by app/sales/queue/page.js,
  // a CLIENT component. When this rule lived in suppressionRules.js it reached
  // lib/voice/numbers.js -> lib/db.js -> pg, and the build failed with seven
  // errors trying to resolve Node's `dns` for the browser. So the module that
  // states the law imports NOTHING, and that is a property worth holding.
  const basisSrc = read("lib/sales/contactBasis.js");
  ok("the consent rule lives in a module with no imports at all",
    !/^\s*import\s/m.test(basisSrc),
    "an import here puts the Postgres driver in the rep queue's browser bundle");
  ok("...and prospectView takes it from there, not from suppressionRules",
    read("lib/sales/prospectView.js").includes('from "@/lib/sales/contactBasis"'));

  // ── The property, not the path ────────────────────────────────────────
  //
  // The two assertions above were written when the CASL rule tripped this
  // chain, and they check the ONE module that tripped it. They did not stop it
  // happening again: hours later `DERIVED_SITE_INFERENCE_KIND` was defined in
  // lib/sales/discovery/normalise.js — a topical home for it — and prospectView
  // importing one bare string from there reached suppressionRules ->
  // lib/voice/numbers -> lib/db -> pg, and `npm run build` failed on the rep's
  // queue page for the second time in a day.
  //
  // A check written to stop something, that did not stop it, is the more
  // important half of that bug. So this walks the WHOLE transitive graph
  // rather than naming a module: whatever anybody imports next, from wherever
  // they put it, the build cannot be broken this way without failing here
  // first — and failing with the chain printed, which is the thing that takes
  // twenty minutes to work out by hand.
  const CLIENT_ROOTS = ["lib/sales/prospectView.js"];
  const FORBIDDEN = ["@/lib/db", "lib/db"];

  const resolveSpecifier = (spec, fromFile) => {
    let rel;
    if (spec.startsWith("@/")) rel = spec.slice(2);
    else if (spec.startsWith(".")) {
      const dir = path.dirname(fromFile);
      rel = path.normalize(path.join(dir, spec));
    } else return null; // a package, not ours
    for (const suffix of ["", ".js", ".mjs", "/index.js"]) {
      const candidate = `${rel}${suffix}`;
      if (fs.existsSync(path.join(ROOT, candidate)) && fs.statSync(path.join(ROOT, candidate)).isFile()) {
        return candidate;
      }
    }
    return null;
  };

  const importsOf = (file) => {
    const src = read(file);
    const out = [];
    // `import ... from "x"`, `export ... from "x"` and bare `import "x"`. The
    // re-export form matters: normalise.js re-exports the kind string, and a
    // scanner blind to `export … from` would call this graph clean.
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+["']([^"']+)["']/g)) out.push(m[1]);
    for (const m of src.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) out.push(m[1]);
    return out;
  };

  for (const root of CLIENT_ROOTS) {
    const seen = new Set([root]);
    const queue = [[root, [root]]];
    let offending = null;
    while (queue.length && !offending) {
      const [file, trail] = queue.shift();
      for (const spec of importsOf(file)) {
        if (FORBIDDEN.includes(spec)) {
          offending = [...trail, spec];
          break;
        }
        const next = resolveSpecifier(spec, file);
        if (!next || seen.has(next)) continue;
        seen.add(next);
        queue.push([next, [...trail, next]]);
      }
    }
    ok(`${root} never reaches lib/db, at any import depth`,
      offending === null,
      offending ? offending.join("  ->  ") : `${seen.size} modules walked`);
  }

  // The walker itself, proved on a graph that IS dirty. Without this the loop
  // above passes for ever the day `resolveSpecifier` stops resolving anything
  // — which is the vacuous-pass class this repo keeps being bitten by.
  {
    const probe = "lib/sales/discovery/ingest.js"; // imports @/lib/db directly
    ok("...and the walker actually detects a module that DOES import lib/db",
      importsOf(probe).includes("@/lib/db"),
      "if this fails the walk above proves nothing");
    ok("...and resolves an @/ specifier to a real file",
      resolveSpecifier("@/lib/sales/inferenceKinds", "lib/sales/prospectView.js") ===
        "lib/sales/inferenceKinds.js");
    ok("...and resolves a relative one",
      resolveSpecifier("./normalise", "lib/sales/discovery/ingest.js") ===
        "lib/sales/discovery/normalise.js");
    ok("...and follows `export … from`, which is how a re-export hides a chain",
      importsOf("lib/sales/discovery/normalise.js").includes("@/lib/sales/inferenceKinds"));
  }

  ok("the shared inference kind lives in a module with no imports at all",
    !/^\s*import\s/m.test(read("lib/sales/inferenceKinds.js")),
    "the same property contactBasis.js holds, for the same reason");

  const licenceSrc = read("lib/sales/discovery/rbq/licence.js");
  ok("the provider still ingests the Courriel column",
    licenceSrc.includes("parseRbqEmails(licence.email)"),
    "storage is permitted and useful; sending is what is not");
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. Attribution, on a surface a human reads
   ═══════════════════════════════════════════════════════════════════════════ */

section("CC-BY attribution reaches a screen");
{
  ok("the notice names the dataset, the Régie and the licence",
    RBQ_ATTRIBUTION.includes("Régie du bâtiment") &&
      RBQ_ATTRIBUTION.includes("CC BY 4.0") &&
      RBQ_ATTRIBUTION.includes("Données Québec"),
    RBQ_ATTRIBUTION);

  const rows = sourceRows({ sourceProvider: "rbq", sourceRelease: "2026-09-03" });
  ok("an RBQ prospect carries a source row", rows.length >= 1);
  ok("...whose detail IS the attribution notice", rows[0].detail === RBQ_ATTRIBUTION, rows[0].detail);
  ok("...and it names the release, so the row can be re-checked",
    rows[0].text.includes("2026-09-03"), rows[0].text);
  ok("...and a second row says email is closed", rows.some((r) => r.key === "contactBasis"));
  ok("SOURCE_ATTRIBUTION has an entry for rbq", SOURCE_ATTRIBUTION.rbq === RBQ_ATTRIBUTION);

  ok("an Overture prospect gets no invented credit line",
    sourceRows({ sourceProvider: "overture" })[0].detail === null);
  ok("...and no contact-basis warning, because undetermined is not a prohibition",
    !sourceRows({ sourceProvider: "overture" }).some((r) => r.key === "contactBasis"));
  ok("a hand-typed prospect gets no source row at all", sourceRows({}).length === 0);

  // A notice the presenter returns and the page drops is not a notice.
  const page = read("app/platform/sales/prospects/page.js");
  const factsBlock = page.slice(page.indexOf("p.facts.map("), page.indexOf("p.facts.map(") + 900);
  ok("the prospects page RENDERS a fact's detail line",
    factsBlock.includes("f.detail"),
    "the attribution and the CASL reason both ride on `detail`");
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. The extractor
   ═══════════════════════════════════════════════════════════════════════════ */

section("The offline extractor");
{
  const script = read("scripts/rbq-snapshot.mjs");
  ok("it resolves through CKAN rather than a hardcoded URL", script.includes("fetchRbqResource("));
  ok("it writes the attribution into the manifest", script.includes("attribution: RBQ_ATTRIBUTION"));
  ok("it groups with the SHIPPED grouping functions, not a copy",
    script.includes("addLicenceRow(") && script.includes("startLicence("),
    "a second grouper is the copy that rots");
  ok("it refuses a --file with no --release rather than stamping today",
    script.includes("--file needs --release"));
  ok("it stops if the register drops a column this build reads",
    script.includes("no longer carries"));
  ok("it counts rows whose width disagrees with the header", script.includes("badWidth"));
  ok("it reports the fill rates it actually measured", script.includes("withPhone") && script.includes("withEmail"));

  const pkg = JSON.parse(read("package.json"));
  ok("check:rbq-provider is a script", Boolean(pkg.scripts["check:rbq-provider"]));
  ok("...and is wired into check:all", pkg.scripts["check:all"].includes("check:rbq-provider"));
  ok("rbq:snapshot is a script, so the invocation is not folklore",
    Boolean(pkg.scripts["rbq:snapshot"]));
  ok("the extractor is invoked with the alias loader, which it needs",
    pkg.scripts["rbq:snapshot"].includes("alias-loader"));
}

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
process.exit(failures ? 1 : 0);
