// lib/sales/discovery/rbq/licence.js
//
// One RBQ licence, assembled from the many CSV rows that describe it.
//
// ══ 927,337 rows are 54,264 businesses ═════════════════════════════════════
//
// The extract is one row per (licence × subcategory). A licence authorised for
// seventeen subcategories occupies seventeen rows carrying the SAME name, the
// same email, the same phone and the same address. Ingesting the file
// row-by-row would produce 927,337 prospects, seventeen of them for one
// electrician, and the deduplicator would then flag sixteen of them as
// possible duplicates of the first — turning a grouping bug into a review
// queue nobody can clear.
//
// So the grouping is the whole job of this file, and it is keyed on `Numéro de
// licence`. Measured on the real 341 MB file on 2026-09-03: of the fourteen
// identity fields, exactly ONE varies between the rows of a single licence —
// `Autre nom`. Name, email, phone, address, municipality, NEQ, legal status,
// issuing body, licence type, issue date, restriction and administrative
// region are byte-identical across every row of a licence, in all 54,264 of
// them. That is what makes "take the first row" safe for those twelve fields
// and WRONG for the thirteenth.
//
//   4,386 licences carry more than one `Autre nom`. Licence 1104-8618-06 alone
//   trades as "Plancher Nobel", "Tapis L. Émard Ltée", "Emard Couvre-Planchers"
//   and "Décor Tapis Émard". Taking the first row would have kept one of the
//   four and silently dropped three trading names — and for a flooring company
//   whose registered name says nothing about flooring, the dropped ones are
//   the informative ones.
//
// ══ The subcategories are an AUTHORISATION SET, not a trade ════════════════
//
// This is the finding that decides the shape of the whole provider, and it was
// measured across all 54,264 licences rather than sampled:
//
//   subcategory 9   "travaux de finition"          44,134 licences  81.3%
//   subcategory 7   "isolation, étanchéité, ..."   43,402 licences  80.0%
//   subcategory 12  "armoires et comptoirs usinés" 41,793 licences  77.0%
//
// The median licence carries sixteen to seventeen subcategories. A thirteen-
// code block — 2.5, 2.7, 3.2, 4.2, 5.2, 6.2, 7, 8, 9, 11.2, 12, 13.5 and 17.2
// — comes attached to general-contractor scope and is held by roughly four in
// five licence-holders. It says what this licensee is PERMITTED to do. It does
// not say what they actually do for a living.
//
// So nothing here maps a subcategory to a FieldQuo trade, and
// lib/sales/discovery/trades.js is deliberately left untouched by this
// provider. Reading "holds subcategory 12" as "sells cabinets" would file
// 41,793 businesses as cabinet makers, and a rep would open a cabinet script
// on a roofer. An unset trade is honest; a wrong one wastes the call and
// teaches the rep the queue is junk — which is the cost classify.js's header
// argues is the expensive one.
//
// The codes are still CARRIED, namespaced `rbq:<code>`, into
// `categories.alternate` and from there into `Prospect.sourceCategories` —
// which the schema describes as "the source's own category strings, unmapped".
// An authorisation set is exactly that. They map to no trade, so
// `tradeForCategories` returns null and the row is counted as unmapped, which
// is a true statement about it.
//
// ══ Why the codes are namespaced ═══════════════════════════════════════════
//
// `trades.js` indexes source categories as flat strings in ONE global map, and
// asserts `duplicateSourceCategories()` is empty. RBQ's `16` is electrical;
// some future board's `16` will be something else. Namespacing now costs three
// characters; discovering the collision later costs a queue of electricians
// filed under the wrong trade with nothing in the data to show why.

/** Codes that are not trades at all: the three competence attestations. */
export const RBQ_ADMIN_CODES = new Set(["ADM", "GPC", "SEC", "GPCCOP", "SECCOP"]);

/**
 * The thirteen subcategories that come attached to general-contractor scope.
 *
 * Held by roughly 80% of all licence-holders — see the header. Exported so the
 * check can assert that none of them is ever treated as identifying, and so a
 * future reader can re-measure the claim rather than take it on trust.
 */
export const RBQ_GENERAL_SCOPE_BUNDLE = Object.freeze([
  "2.5",
  "2.7",
  "3.2",
  "4.2",
  "5.2",
  "6.2",
  "7",
  "8",
  "9",
  "11.2",
  "12",
  "13.5",
  "17.2",
]);

/** The namespace every RBQ source category carries. See the header. */
export const RBQ_CATEGORY_PREFIX = "rbq:";

/** The columns this reader depends on, by their exact French headers. */
export const RBQ_COLUMNS = Object.freeze({
  licence: "Numéro de licence",
  status: "Statut de la licence",
  type: "Type de licence",
  issued: "Date de délivrance",
  restriction: "Restriction",
  issuer: "Mandataire",
  email: "Courriel",
  address: "Adresse",
  neq: "NEQ",
  name: "Nom de l'intervenant",
  phone: "Numéro de téléphone",
  municipality: "Municipalité",
  legalStatus: "Statut juridique",
  region: "Région administrative",
  category: "Categorie",
  subcategory: "Sous-catégories",
  otherName: "Autre nom",
});

/**
 * One line of the RBQ CSV, split.
 *
 * Comma-delimited with every field quoted, and `""` for an embedded quote —
 * RFC 4180. Written out rather than pulled from a dependency because the whole
 * of lib/ is dependency-light and this is fifteen lines; and split rather than
 * regex-matched because a French business name legitimately contains commas
 * inside its quotes ("9265-1234 QUÉBEC INC., FAISANT AFFAIRE SOUS...").
 *
 * NOTE the delimiter: the brief that commissioned this said semicolons. The
 * real file is comma-delimited with 24 columns, not 23 — the restriction's
 * start and end dates are two separate columns. Verified against the published
 * file on 2026-09-03; a semicolon reader would have returned one giant field
 * per row and reported 54,264 businesses with no name.
 */
export function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  const text = String(line ?? "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** Whitespace collapsed, nothing else changed. Null for nothing. */
function tidy(value) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** Accent-folded and upper-cased, for comparing an address to a municipality. */
export function foldForMatch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * The register's single `Adresse` string, split into the columns a Prospect has.
 *
 * ══ Only what can be positively identified ═════════════════════════════════
 *
 * Measured: 49,787 of 54,264 licences carry an address, and 99.1% of those end
 * `<PROVINCE> <COUNTRY> <POSTAL CODE>`. The rest are ordinary addresses whose
 * tail is spelled differently, NOT junk. So each piece is taken off the end
 * only when it matches, and whatever is left stays in `line` verbatim.
 *
 * The city is NOT parsed out of this string. `Municipalité` is its own column,
 * correctly accented and correctly cased, and it agrees with the address text
 * in 91.7% of rows — which is every row that has an address at all. Parsing a
 * city out of free text when the source hands you one in its own column is how
 * "Trois-Rivières" becomes "TROIS RIVIERES" in a queue a human reads.
 *
 * The province is NOT assumed to be QC. Measured: 48,778 QC, 493 ON, and a
 * long tail down to a single "CB" that is somebody's typo for BC. It is
 * carried verbatim, typo included — a register that says CB is a register that
 * says CB, and correcting it here would hide a data-quality fact from the one
 * screen that could report it.
 */
export function parseRbqAddress(address, municipality) {
  const city = tidy(municipality);
  let rest = tidy(address);
  if (!rest) {
    return { line: null, city, province: null, postalCode: null, country: null };
  }

  let postalCode = null;
  const postal = rest.match(/([A-Za-z]\d[A-Za-z])\s?(\d[A-Za-z]\d)\s*$/);
  if (postal) {
    postalCode = `${postal[1]} ${postal[2]}`.toUpperCase();
    rest = rest.slice(0, postal.index).trim();
  }

  let country = null;
  const canada = rest.match(/\s*\bcanada\b\s*$/i);
  if (canada) {
    // ISO-2, matching what Overture puts in this column — the territory filter
    // in overture/provider.js compares countries as strings, and two spellings
    // of Canada would make a Canada-wide territory exclude every RBQ row.
    country = "CA";
    rest = rest.slice(0, canada.index).trim();
  }

  let province = null;
  const prov = rest.match(/\s([A-Za-z]{2})\s*$/);
  if (prov) {
    province = prov[1].toUpperCase();
    rest = rest.slice(0, prov.index).trim();
  }

  // The municipality repeats at the end of the street line. Removed only when
  // it is genuinely there, compared accent-folded because the address string
  // and the Municipalité column disagree about accents and case.
  if (city) {
    const foldedCity = foldForMatch(city);
    const foldedRest = foldForMatch(rest);
    if (foldedCity && foldedRest.endsWith(foldedCity)) {
      // Walk back through the original string by the same number of
      // significant characters, so accents and punctuation in the ORIGINAL are
      // not counted against a folded length.
      let keep = rest.length;
      let matched = 0;
      const target = foldedCity.replace(/\s+/g, "").length;
      while (keep > 0 && matched < target) {
        keep--;
        if (/[A-Za-z0-9]/.test(rest[keep].normalize("NFD")[0])) matched++;
      }
      const trimmed = rest.slice(0, keep).trim();
      // Never leave nothing: an address that is only its municipality keeps the
      // municipality rather than becoming a null street line.
      if (trimmed) rest = trimmed;
    }
  }

  return { line: tidy(rest), city, province, postalCode, country };
}

/**
 * The email addresses on a licence.
 *
 * Measured: 47,199 licences carry one, ten carry something with a separator in
 * it, and fourteen carry something that is not an address at all. So the field
 * is split defensively and implausible values are dropped rather than stored —
 * normalise.js records every one it is handed as evidence, and evidence saying
 * `Courriel: "aucun"` is noise a rep has to read past.
 */
export function parseRbqEmails(value) {
  return String(value ?? "")
    .split(/[;,\s]+/)
    .map((v) => v.trim())
    .filter((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
}

/**
 * Start a licence from its first row.
 *
 * Everything except the subcategory list and the trading names comes from
 * here, because everything except those two is identical on every row of a
 * licence — measured, see the header.
 */
export function startLicence(row) {
  return {
    licence: tidy(row[RBQ_COLUMNS.licence]),
    status: tidy(row[RBQ_COLUMNS.status]),
    type: tidy(row[RBQ_COLUMNS.type]),
    issuer: tidy(row[RBQ_COLUMNS.issuer]),
    issued: tidy(row[RBQ_COLUMNS.issued]),
    restriction: tidy(row[RBQ_COLUMNS.restriction]),
    name: tidy(row[RBQ_COLUMNS.name]),
    neq: tidy(row[RBQ_COLUMNS.neq]),
    legalStatus: tidy(row[RBQ_COLUMNS.legalStatus]),
    region: tidy(row[RBQ_COLUMNS.region]),
    phone: tidy(row[RBQ_COLUMNS.phone]),
    email: tidy(row[RBQ_COLUMNS.email]),
    address: tidy(row[RBQ_COLUMNS.address]),
    municipality: tidy(row[RBQ_COLUMNS.municipality]),
    subcategories: [],
    otherNames: [],
  };
}

/**
 * Fold one more row of the same licence in.
 *
 * Only the two fields that vary. Sets rather than arrays, because a licence
 * repeats its trading names once per subcategory — 1104-8618-06's four names
 * arrive sixty-eight times between them.
 */
export function addLicenceRow(licence, row) {
  const sub = tidy(row[RBQ_COLUMNS.subcategory]);
  if (sub && !licence.subcategories.includes(sub)) licence.subcategories.push(sub);
  const other = tidy(row[RBQ_COLUMNS.otherName]);
  if (other && !licence.otherNames.includes(other)) licence.otherNames.push(other);
  return licence;
}

/**
 * Group a whole sequence of parsed rows into licences.
 *
 * Exported and pure so the check can run 927k rows' worth of shapes through it
 * without a file. Rows of one licence are adjacent in the published extract,
 * but this does NOT rely on that: a Map keyed on the licence number is correct
 * whatever the order, and "they were adjacent when I looked" is the kind of
 * assumption that survives until the day the RBQ changes its sort.
 */
export function groupLicences(rows) {
  const byLicence = new Map();
  for (const row of rows) {
    const id = tidy(row?.[RBQ_COLUMNS.licence]);
    if (!id) continue;
    const existing = byLicence.get(id);
    if (existing) addLicenceRow(existing, row);
    else byLicence.set(id, addLicenceRow(startLicence(row), row));
  }
  return [...byLicence.values()];
}

/**
 * Every subcategory a licence holds, namespaced, with the competence codes out.
 *
 * ADM, GPC and SEC are the three competence attestations every licence-holder
 * must pass — administration, project management, site safety. They are held
 * by 97–99% of licences and they describe the PERSON, not the work. Carrying
 * them as source categories would put three meaningless strings on every
 * prospect in the bank.
 */
export function authorisationCodes(licence) {
  return (licence?.subcategories || [])
    .filter((code) => !RBQ_ADMIN_CODES.has(code))
    .map((code) => `${RBQ_CATEGORY_PREFIX}${code}`)
    .sort();
}

/**
 * One licence, in the shape every discovery provider must emit.
 *
 * @param {object} licence  from groupLicences
 * @param {{release: string|null, sourceUrl: string|null}} context
 */
export function toDiscoveredBusiness(licence = {}, { release = null, sourceUrl = null } = {}) {
  const address = parseRbqAddress(licence.address, licence.municipality);

  return {
    // The licence number. The register's own stable key, printed on the
    // contractor's own paperwork, and the thing a superadmin can type into the
    // RBQ's public lookup to check this row a year from now.
    sourceRecordId: licence.licence || "",
    name: licence.name || null,

    // ── No primary category, and that is a statement ──────────────────────
    //
    // The register names no trade. `primary: null` says so, and the
    // authorisations go in `alternate` where they are carried as provenance
    // and map to nothing. See this file's header for the measurement.
    categories: { primary: null, alternate: authorisationCodes(licence) },

    // Empty, not invented. The RBQ publishes no taxonomy of what a licensee
    // does — only what they may do — so there is no hierarchy to report, and a
    // fabricated ["services_and_business","home_service"] would be read by
    // classify.js as a positive contractor signal the source never gave.
    taxonomyHierarchy: [],

    phones: licence.phone ? [licence.phone] : [],
    // The register carries no website column at all. Empty here means "the
    // source has no such field", which normalise.js correctly turns into
    // `hasWebsite: null` rather than false.
    //
    // A DERIVED domain must never appear in this array, and that is the whole
    // safety property of derivedSite.js: `websites` is what normalise.js turns
    // into `Prospect.websiteUrl` and `hasWebsite: true`, and both of those mean
    // "the source said so". The Régie said no such thing. The guess travels in
    // `derivedWebsite` below, which nothing writes to a Prospect column.
    websites: [],
    emails: parseRbqEmails(licence.email),
    address,
    // No coordinates in the register. Null, never 0 — overture/provider.js's
    // `inTerritory` comment records what a 0 costs.
    latitude: null,
    longitude: null,

    // VERBATIM, and unusually meaningful here: this file is the list of ACTIVE
    // licences, so "Active" is the register positively saying the licence is
    // in force today. That is a stronger statement than any directory makes,
    // and it is the reason this source is worth having.
    operatingStatus: licence.status || null,
    sourceConfidence: null,

    // Which body issued the licence — Regie, CMEQ (the electricians' corporation)
    // or CMMTQ (the piping mechanics'). The same slot Overture uses for its
    // contributing dataset, and the same question: which part of the source
    // vouched for this row.
    sourceDataset: licence.issuer || null,

    // ── Null, deliberately ────────────────────────────────────────────────
    //
    // The extract carries a licence ISSUE date and a next-payment date, and
    // neither is "when this record was last refreshed". Putting the issue date
    // here would report a licence issued in 2004 as a record last touched in
    // 2004, and the staleness banner would tell a rep the row is twenty-two
    // years old when the register republished it this morning. The release
    // date is where that question is answered.
    sourceUpdatedAt: null,
    sourceUrl,
    sourceRelease: release,

    // ── The hypothesis, and nothing that reads like a fact ─────────────────
    //
    // Stamped on the snapshot record by scripts/rbq-snapshot.mjs, which is the
    // only place the used-once rule CAN be applied — it needs a count over the
    // whole register, and a serverless page of a hundred licences cannot see
    // one. See derivedSite.js for the measurement and for why the rule needs
    // no blocklist of Quebec ISPs to work.
    //
    // Null on 38,308 of 54,264 licences, and null is the honest answer for
    // them. Nothing downstream fills it in.
    derivedWebsite: derivedWebsiteOf(licence),
  };
}

/**
 * The candidate site a snapshot record carries, in the shape ingest writes.
 *
 * Read off the record rather than derived here, because deriving needs the
 * register-wide domain histogram (see derivedSite.js's `countEmailDomains`)
 * and this function is handed one licence. A record produced by an older
 * extractor simply has no candidate, which is the same as not being able to
 * guess — not an error.
 */
function derivedWebsiteOf(licence) {
  const domain = tidy(licence?.candidateDomain);
  if (!domain) return null;
  return {
    domain,
    // The address it came from. Carried so the evidence a rep reads names it —
    // an inference nobody can disagree with is the thing ProspectInference
    // exists to prevent.
    email: tidy(licence?.candidateEmail),
    basis: tidy(licence?.candidateBasis) || "licence_email",
    // Written by the extractor rather than composed here, and that is not
    // fussiness: derivedSite.js imports `parseRbqEmails` from THIS file, so a
    // call in the other direction is an import cycle. The one place that
    // already imports both is scripts/rbq-snapshot.mjs, so the sentence is
    // stamped there and read back verbatim.
    statement: tidy(licence?.candidateStatement),
  };
}
