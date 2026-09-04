// lib/sales/discovery/usBoard/record.js
//
// One licence, assembled from the rows that describe it and turned into the
// shape every discovery provider must emit.
//
// ══ Grouping is not optional, even where it looks like it is ═══════════════
//
// Washington publishes one row per licence: 75,917 ACTIVE rows, 75,917
// distinct licence numbers, measured. Oregon does NOT — its 56,156 rows
// describe 45,483 licences, because a contractor holding both a Residential
// General endorsement and a Lead Based Paint Renovation endorsement occupies
// two rows carrying the same name, the same phone and the same address.
//
// Ingesting Oregon row-by-row would produce 10,673 duplicate prospects and
// then hand them to dedupe.js as a review queue nobody can clear — which is
// exactly the failure rbq/licence.js's header describes at 927,337 rows.
//
// So everything goes through `groupLicences`, and Washington's grouping is a
// no-op that costs one Map lookup per row. A board-shaped `if` here would be
// the thing that breaks the first time Washington adds a second specialty row
// instead of a second specialty column.
//
// ══ The country is DERIVED, never assumed ══════════════════════════════════
//
// A US state board's file is not a file of US addresses. Measured on the real
// files: Oregon's active licences carry mailing addresses in Alberta, Ontario,
// the Yukon and "PQ", and Washington's carry 61 distinct spellings of a state
// including "Wa", "wa", "On", "BR", "98" and 67 blanks.
//
// Stamping `country: "US"` on all of them would be AGENTS.md's fifth failure
// class — padding absent data with a default — and it would put a Yukon
// contractor inside a US territory filter. So the country is looked up from
// the state code and is NULL when the code is not one anybody recognises. The
// province itself is carried VERBATIM, typos included, for the reason
// rbq/licence.js gives: a register that says "98" is a register that says
// "98", and correcting it here hides a data-quality fact from the one screen
// that could report it.
import { classLabel, namespacedClass } from "./classes";

// ══ Why the country lookup below is local and not borrowed ═════════════════
//
// lib/sales/callingRules.js owns the subdivision tables this codebase already
// has, and reusing them was the first instinct. Two reasons it is wrong here,
// and the second is the one that decides:
//
//   1. It answers a DIFFERENT question. `SUBDIVISION_TIME_ZONES` says "which
//      statute and which clock", and a code with no time zone behind it is
//      deliberately unrecognised there — "US-PR" is a real subdivision the
//      calling gate must refuse to guess about. Borrowing that table as a
//      country oracle would silently import a refusal into a question it was
//      never built to answer.
//   2. It is the calling gate, which this work is not allowed to touch, and
//      taking a hard dependency on it would couple a discovery provider to a
//      file whose whole point is that it changes only when a lawyer has read
//      something.
//
// So the codes are stated here, for this question only, and the fold is a
// plain uppercase — which is all the real data needs. MEASURED: every state
// value in Washington's and Oregon's files is two characters or empty, in six
// spellings ("WA", "Wa", "wa", "On", "98", ""). Not one is a spelled-out
// state name, so no name table is shipped for a case that does not occur.

/** US states, DC and the inhabited territories. */
const US_SUBDIVISIONS = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC", "PR", "VI", "GU", "AS", "MP",
]);

/** Canadian provinces and territories, in the ISO spellings. */
const CA_SUBDIVISIONS = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
]);

/**
 * Canada Post's pre-ISO abbreviations, which US registers still carry.
 *
 * "PQ" for Quebec appears twice in Oregon's active file. It is not a typo — it
 * is what Quebec was called in North American address data until 1991, and
 * dropping it would put two real Canadian contractors in the "country unknown"
 * bucket for a spelling that was correct when their record was created.
 */
const CA_LEGACY = new Map([
  ["PQ", "QC"],
  ["NF", "NL"],
]);

/** Whitespace collapsed, control characters out, nothing else changed. */
export function tidy(value) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/**
 * The country a state code implies, or null.
 *
 * Null is a real answer and the common failure is to avoid returning it. "BR"
 * and "98" are in Washington's file; neither is a country FieldQuo can name,
 * and a business whose country is unknown must not be filtered INTO a US
 * territory on the strength of the board that listed it.
 */
export function countryForSubdivision(province) {
  const code = String(province ?? "").trim().toUpperCase();
  if (!code) return null;
  if (US_SUBDIVISIONS.has(code)) return "US";
  if (CA_SUBDIVISIONS.has(code) || CA_LEGACY.has(code)) return "CA";
  return null;
}

/**
 * A US board's `MM/DD/YYYY` date as `YYYY-MM-DD`, or null.
 *
 * Used for exactly one thing — the release of a board that publishes no
 * Last-Modified header, taken as the maximum of its own update column. Null
 * for anything that is not that shape, INCLUDING a well-formed date that is
 * not a real one: "13/45/2026" would parse in `new Date` on some engines and
 * then sort ahead of every real release for ever.
 */
export function parseUsDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, m, d, y] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const at = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/** The value of a board column on a row, or null when the board has no such column. */
function column(board, row, field) {
  const name = board?.columns?.[field];
  if (typeof name !== "string" || !name) return null;
  return tidy(row?.[name]);
}

/**
 * Does this row describe a licence that is in force?
 *
 * Three states, and they are different:
 *
 *   allow-list + status column   keep only the listed statuses
 *   no status column at all      the publisher already filtered — keep it
 *   status column, no allow-list REFUSED by boards.js's boardProblems, because
 *                                keeping everything is how 85,006 expired
 *                                Washington licences reach a rep's queue
 */
export function rowIsActive(board, row) {
  const statuses = board?.activeStatuses;
  if (!Array.isArray(statuses) || !statuses.length) return true;
  const value = column(board, row, "status");
  return Boolean(value && statuses.includes(value));
}

/** Start a licence from its first row. */
export function startLicence(board, row) {
  return {
    board: board.key,
    id: column(board, row, "id"),
    name: column(board, row, "name"),
    phone: column(board, row, "phone"),
    email: column(board, row, "email"),
    website: column(board, row, "website"),
    line1: column(board, row, "line1"),
    line2: column(board, row, "line2"),
    city: column(board, row, "city"),
    province: column(board, row, "province"),
    postalCode: column(board, row, "postalCode"),
    status: column(board, row, "status"),
    entityType: column(board, row, "entityType"),
    principal: column(board, row, "principal"),
    classes: [],
    names: [],
  };
}

/**
 * Fold one more row of the same licence in.
 *
 * Only the fields that VARY between rows of a licence: the class tokens and
 * the name. Oregon repeats the name identically on every row of a licence in
 * all but nine cases, and those nine are real — a licence whose second
 * endorsement was filed under a different trading name. Keeping both costs
 * nothing and dropping one loses the informative half, which is the mistake
 * rbq/licence.js measured on 4,386 Quebec licences.
 */
export function addLicenceRow(board, licence, row) {
  for (const token of [board.classToken(row), ...board.extraClassTokens(row)]) {
    const clean = tidy(token);
    if (clean && !licence.classes.includes(clean)) licence.classes.push(clean);
  }
  const name = column(board, row, "name");
  if (name && !licence.names.includes(name)) licence.names.push(name);
  return licence;
}

/**
 * Group a sequence of parsed rows into licences, dropping the inactive ones.
 *
 * A Map keyed on the licence number, NOT an assumption that a licence's rows
 * are adjacent. They happen to be in both published files today; relying on
 * that is the assumption that survives until the board changes its sort, and
 * then one contractor becomes four.
 */
export function groupLicences(board, rows) {
  const byLicence = new Map();
  for (const row of rows) {
    if (!rowIsActive(board, row)) continue;
    const id = column(board, row, "id");
    if (!id) continue;
    const existing = byLicence.get(id);
    if (existing) addLicenceRow(board, existing, row);
    else byLicence.set(id, addLicenceRow(board, startLicence(board, row), row));
  }
  return [...byLicence.values()];
}

/**
 * A licence's class tokens, namespaced for `categories`.
 *
 * Sorted so two extractions of the same licence produce the same array and a
 * re-ingest does not look like a change.
 */
export function namespacedClasses(licence) {
  return (licence?.classes || []).map((token) => namespacedClass(licence.board, token)).sort();
}

/**
 * The class this licence's trade should be read from, or null.
 *
 * A licence holding exactly ONE class has a primary; a licence holding two
 * does not, and the second one is not a tiebreak. 180 of Washington's 75,917
 * active licences hold two specialties, and a licence registered for both
 * ROOFING and SIDING is a business whose trade is genuinely two — the same
 * case `tradeForCategories` already refuses when two alternates disagree.
 *
 * Both classes still travel in `alternate`, so nothing is lost: if they happen
 * to name the SAME FieldQuo trade, tradeForCategories resolves it through the
 * alternates and the row is queued anyway. That is the behaviour we want, and
 * it comes free rather than from a second rule here.
 */
export function primaryClass(licence) {
  const classes = namespacedClasses(licence);
  return classes.length === 1 ? classes[0] : null;
}

/**
 * One licence, in the shape every discovery provider must emit.
 *
 * @param {object} licence  from groupLicences
 * @param {object} board    from boards.js
 * @param {{release: string|null, sourceUrl: string|null}} context
 */
export function toDiscoveredBusiness(licence = {}, board = null, { release = null, sourceUrl = null } = {}) {
  const province = licence.province || null;
  const classes = namespacedClasses(licence);

  return {
    // The licence number. The board's own stable key, printed on the
    // contractor's own paperwork and on the truck door, and the thing a
    // superadmin can type into the regulator's public lookup — see
    // `board.verifyUrl` — to check this row a year from now.
    sourceRecordId: licence.id || "",
    name: licence.name || null,

    // ── The class IS the primary category, and that is the difference ─────
    //
    // rbq/licence.js sets `primary: null` because a Quebec licence carries
    // sixteen authorisations and none of them is a trade. A Washington licence
    // carries one specialty and it names a single trade in 23.6% of cases. So
    // the class goes in `primary` where there is exactly one, and
    // tradeForCategories resolves it against trades.js — which maps only the
    // classes classes.js proved decisive, and none of the unrestricted ones.
    categories: { primary: primaryClass(licence), alternate: classes },

    // Empty, not invented. Neither board publishes a taxonomy of what a
    // licensee DOES — only what they are registered for — so there is no
    // hierarchy to report, and a fabricated one would be read by classify.js
    // as a positive contractor signal the source never gave.
    taxonomyHierarchy: [],

    phones: licence.phone ? [licence.phone] : [],
    // Neither shipped board publishes a website or an email. Empty here means
    // "the source has no such field", which normalise.js turns into
    // `hasWebsite: null` rather than a false claim that we looked and there
    // was none. `columns.website` and `columns.email` exist on the board so a
    // state that DOES publish one needs no code change.
    websites: licence.website ? [licence.website] : [],
    emails: licence.email ? [licence.email] : [],

    address: {
      line: [licence.line1, licence.line2].filter(Boolean).join(", ") || null,
      city: licence.city || null,
      province,
      postalCode: licence.postalCode || null,
      country: countryForSubdivision(province),
    },

    // No coordinates in either register. Null, never 0 — overture/provider.js's
    // `inTerritory` comment records what a 0 costs, and the consequence here is
    // that a RADIUS territory excludes every board row rather than placing it
    // in the Gulf of Guinea.
    latitude: null,
    longitude: null,

    // VERBATIM where the board publishes a per-row status, and the board's own
    // dataset-level assertion where it does not. Oregon has no status column
    // because the dataset it publishes IS its active list; saying so is a
    // statement the board actually makes, and the string says which kind of
    // statement it is rather than passing a dataset title off as a row fact.
    operatingStatus: licence.status || board?.datasetAssertedStatus || null,
    sourceConfidence: null,

    // Which part of the board vouched for this row — the licence type on
    // Washington, the board itself on Oregon. The same slot Overture uses for
    // its contributing dataset, and the same question.
    sourceDataset: board?.board || null,

    // ── Null, deliberately ────────────────────────────────────────────────
    //
    // Both files carry licence effective and expiry dates, and neither is
    // "when this record was last refreshed". A licence issued in 2009 is not a
    // record last touched in 2009, and putting one here would make the
    // staleness banner tell a rep the row is seventeen years old when L&I
    // republished it at 07:30 this morning. The release date answers that.
    sourceUpdatedAt: null,
    sourceUrl,
    sourceRelease: release,

    // ── No `derivedWebsite`, and the absence is deliberate ────────────────
    //
    // rbq/derivedSite.js guesses a domain from a licence email and stores it
    // as a hypothesis. Neither shipped board publishes an email, so there is
    // nothing to guess from — and a `derivedWebsite: null` on every row would
    // be a field written and never read, which is AGENTS.md's first recurring
    // failure class. A board that DOES publish emails is the one change that
    // makes that route worth wiring, and the doc names which ones do.
  };
}

/**
 * What the board said about this licence's classification, in its own words.
 *
 * NOT a field on the emitted business — see `toDiscoveredBusiness` for why a
 * field nothing reads is worse than no field. This is for the extractor's
 * console report and for the check, which need to render a class token as a
 * human sentence to prove the vocabulary in classes.js is actually consulted.
 *
 * Null when the licence carries no class at all, which is a thing that happens
 * and is not an error — Washington ships 208 active licences whose specialty
 * label is empty.
 */
export function classStatement(licence) {
  const tokens = licence?.classes || [];
  if (!tokens.length) return null;
  const parts = tokens.map((token) => {
    const label = classLabel(licence.board, token);
    return label ? `${token} ${label}` : token;
  });
  return parts.length === 1
    ? `Registered for ${parts[0]}.`
    : `Registered for ${parts.length} classifications: ${parts.join("; ")}.`;
}
