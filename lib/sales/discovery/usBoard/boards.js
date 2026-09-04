// lib/sales/discovery/usBoard/boards.js
//
// One row per US state licence board. Everything that differs between them is
// here; everything that does not is in the four files beside it.
//
// ══ Why one shared provider family and not one directory per state ═════════
//
// The brief asked for this explicitly and the answer held up: the boards
// differ in COLUMN NAMES, in CLASS VOCABULARY and in how the file is reached,
// not in shape. All three publish one CSV of one row per licence-and-class,
// carrying a business name, a street address, a phone and a classification.
// A second copy of the reader per state would be AGENTS.md's fourth failure
// class with fifty opportunities to occur — and the copy is the one that rots,
// because it is the one nobody looks at.
//
// What genuinely differs is only how the file is FOUND, and that is two lines
// of config rather than a second reader: Washington and Oregon are Socrata
// datasets resolved through `/api/views/<id>.json`, California is a direct
// query URL on CSLB's own portal. `source.kind` says which.
//
// So the per-state part is DATA and the reader is one file. Adding a state
// that fits this shape is a row below plus a class vocabulary in classes.js.
//
// ══ Why one REGISTERED PROVIDER per state, though ══════════════════════════
//
// The opposite mistake would be one provider with a `state` config field. The
// registry refuses a provider without a licence for a stated reason — a
// campaign ticks several sources at once and each checkbox has to say what
// ticking it costs — and the licences here are NOT the same:
//
//   California CSLB  a plain public record, no licence tag at all
//   Washington L&I   Open Data Commons PDDL 1.0        no attribution required
//   Oregon CCB       Public Domain U.S. Government     no attribution required
//
// All three are permissive today. They are still three different grants from
// three different bodies, and a single checkbox reading "US licence boards"
// would be one checkbox standing for terms that can diverge the next time a
// state re-publishes. It would also make the yield note a lie: California's
// classes identify a trade for 44.9% of its register, Washington's for 23.3%
// and Oregon's for 3.2%, and one description cannot honestly state all three.
//
// A state is therefore its own provider key, its own checkbox, its own licence
// and its own snapshot file — built from one factory. See provider.js.
//
// ══ What "active" means, and why it is per-board ═══════════════════════════
//
// Oregon publishes a dataset called "CCB Active Licenses" and carries NO status
// column: the file is the filter. Washington publishes every licence it has
// ever issued — 160,923 rows, of which 75,917 are ACTIVE — and 61,028 are
// EXPIRED, 9,349 RE-LICENSED (superseded by a newer number), 4,696 OUT OF
// BUSINESS and 15 PASSED AWAY.
//
// Calling an expired licence is calling a business that may not exist, and
// "PASSED AWAY" is a rep phoning a widow. So `activeStatuses` is a per-board
// allow-list and `null` means the publisher already filtered — never "keep
// everything". The extractor refuses to run a board whose status column it
// cannot find, rather than silently keeping all 160,923.
//
// ══ NO board here publishes an email address ═══════════════════════════════
//
// Stated here because it decides what these sources can and cannot do. The
// RBQ carries 47,199 emails, which is what made rbq/derivedSite.js possible —
// a domain guessed from a licence email, crawled, and corroborated. None of
// these three publishes one, and none publishes a website. Measured: 0.00% on
// all three files. California says why in its own words on the download page —
// "Email addresses are not provided (Business & Professions Code Section 27)".
//
// So there is no derived-site route for these boards, and the classification is
// the ONLY thing that can give one of their rows a trade.
//
// That is not a gap to fill later with a guess. It is the reason the class
// mapping in classes.js had to be measured rather than assumed.

import { CA_CSLB_CLASSES, OR_CCB_CLASSES, WA_LNI_CLASSES } from "./classes";

/**
 * California Contractors State License Board — the master licence file.
 *
 * Verified 2026-09-03 by downloading and parsing it: 77,462,224 bytes of CSV,
 * 242,879 rows, 0 bad widths, 242,879 distinct licence numbers, 219,255 of
 * them at PrimaryStatus CLEAR.
 *
 * ══ Not Socrata, and the difference is the release ═════════════════════════
 *
 * CSLB serves the file from its own portal at a stable query URL with no
 * session, no cookie and no charge — the page says so: "There is no charge for
 * this service." What it does NOT serve is a `Last-Modified` header or a
 * `Content-Length`; the response is chunked. So `kind: "direct"` boards have no
 * cheap release probe, and the extractor takes the release from the DATA: the
 * maximum `LastUpdate` across every row. On the 2026-09-03 download that was
 * 2026-09-02, which is exactly the date the portal prints beside the link.
 *
 * That is the more robust signal anyway. A banner is a claim somebody types;
 * the column is what the rows say about themselves. Virginia's equivalent
 * banner was measured a week ahead of its own files' `Last-Modified`.
 */
const CA_CSLB = {
  key: "us_ca_cslb",
  state: "CA",
  country: "US",
  label: "California CSLB — licensed contractors",
  board: "California Contractors State License Board",
  source: {
    kind: "direct",
    url: "https://www.cslb.ca.gov/Onlineservices/DataPortal/DownLoadFile.ashx?fName=MasterLicenseData&type=C",
    // Where the release comes from when there is no header to read it off.
    releaseColumn: "LastUpdate",
  },
  licence: {
    name: "California public record (Business & Professions Code)",
    url: "https://www.cslb.ca.gov/Onlineservices/DataPortal/ContractorList.aspx",
    obligation:
      "A public record CSLB publishes for free download — “There is no charge for this service.” " +
      "No attribution is demanded and no redistribution restriction is stated on the download page. " +
      "One thing IS stated and it is a limit on the data rather than on its use: “Email addresses " +
      "are not provided (Business & Professions Code Section 27)”, so this source can never " +
      "supply an email and nothing downstream should expect one.",
    attribution:
      "Contains licence information published by the California Contractors State License Board on " +
      "its public Data Portal.",
  },
  datasetUrl: "https://www.cslb.ca.gov/Onlineservices/DataPortal/ContractorList.aspx",
  verifyUrl: "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx",
  columns: {
    id: "LicenseNo",
    // The trading name. `BUS-NAME-2` holds the legal entity and
    // `FullBusinessName` the two joined; the trading name is what a rep says
    // out loud, and dedupe.js keys on it.
    name: "BusinessName",
    phone: "BusinessPhone",
    email: null,
    website: null,
    line1: "MailingAddress",
    line2: null,
    city: "City",
    province: "State",
    postalCode: "ZIPCode",
    status: "PrimaryStatus",
    classType: null,
    classCode: "Classifications(s)",
    classLabel: null,
    classCode2: null,
    entityType: "BusinessType",
    principal: null,
  },
  /**
   * CLEAR only.
   *
   * The other 23,624 rows are suspensions — a bond lapse, a workers'
   * compensation lapse, a family-support order — and a suspended California
   * licence may not lawfully contract. Measured: 18,726 Contr Bond Susp, 2,875
   * Work Comp Susp, 615 Liab Ins Susp, and a tail of eight more.
   *
   * Expiry needs no filter here and that is the file's doing rather than an
   * omission: CSLB states the master file holds only licences "currently
   * renewed, or expired but renewable", and exactly ONE of the 242,879 rows
   * carries an expiration date in the past.
   */
  activeStatuses: Object.freeze(["CLEAR"]),
  classes: CA_CSLB_CLASSES,
  /**
   * ASB and HAZ are CERTIFICATIONS, not classifications.
   *
   * The same shape as rbq/licence.js's ADM/GPC/SEC: they describe an
   * additional qualification the holder has passed, inside whatever
   * classification they already hold. CSLB says so on its own list —
   * "Contractors with an asbestos certification can only perform abatement
   * work within the license classification(s) they already hold."
   *
   * Dropped before the class set is built, so a painter holding HAZ is a
   * one-class licence rather than a two-class one whose trade has to be
   * recovered through the alternates.
   */
  nonClassCodes: Object.freeze(["ASB", "HAZ"]),
  /**
   * California packs every classification into ONE column.
   *
   * 81.3% of CLEAR licences hold exactly one; the rest hold up to twenty-one.
   * So `classToken` returns the first and `extraClassTokens` the remainder,
   * and `primaryClass` in record.js then declines to name a primary for any
   * licence holding more than one — the multi-class case is resolved through
   * the alternates, where two mapped classes that disagree produce no trade at
   * all. Measured: that refusal fires on 8,547 licences.
   */
  splitClasses(row) {
    return String(row?.["Classifications(s)"] ?? "")
      .split(/[|,;]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !CA_CSLB.nonClassCodes.includes(part));
  },
  classToken(row) {
    return CA_CSLB.splitClasses(row)[0] || null;
  },
  extraClassTokens(row) {
    return CA_CSLB.splitClasses(row).slice(1);
  },
  measured: Object.freeze({
    release: "2026-09-02",
    rows: 242879,
    licences: 219255,
    phonePct: "99.90",
    addressPct: "100",
    emailPct: "0",
    unrestricted: 80142,
    decisive: 98566,
    decisivePct: "44.9",
  }),
};

/**
 * Washington State Department of Labor & Industries — contractor registrations.
 *
 * Verified 2026-09-03 by downloading and parsing the file: 35,382,695 bytes of
 * CSV, 160,923 rows, 0 rows whose width disagreed with the header.
 */
const WA_LNI = {
  key: "us_wa_lni",
  state: "WA",
  country: "US",
  label: "Washington L&I — contractor registrations",
  board: "Washington State Department of Labor & Industries",
  source: {
    kind: "socrata",
    host: "data.wa.gov",
    datasetId: "m8qx-ubtq",
    // Re-read on every extraction. socrata.js STOPS if this changes — see its
    // header for why a stale licence claim is worse than a stopped extractor.
    licenceId: "PDDL",
  },
  licence: {
    name: "Open Data Commons PDDL 1.0",
    url: "http://opendatacommons.org/licenses/pddl/1.0/",
    obligation:
      "A public-domain dedication: Washington waives its rights in this data, so commercial use, " +
      "storage and redistribution are all permitted and NO attribution is required. FieldQuo names " +
      "the source anyway, on the prospect record, because a rep about to dial needs to know a " +
      "regulator asserted this licence rather than a directory guessed at it.",
    // Not required by PDDL. Carried because the campaign form and the rep's
    // prospect screen both render `attribution` when it is present, and a
    // source row that says only "us_wa_lni" tells a rep nothing.
    attribution:
      "Contains contractor registration data published by the Washington State Department of " +
      "Labor & Industries on data.wa.gov under the Open Data Commons PDDL 1.0.",
  },
  datasetUrl: "https://data.wa.gov/d/m8qx-ubtq",
  /** A human checking one of these rows against the regulator's own lookup. */
  verifyUrl: "https://secure.lni.wa.gov/verify/",
  columns: {
    id: "ContractorLicenseNumber",
    name: "BusinessName",
    phone: "PhoneNumber",
    email: null,
    website: null,
    line1: "Address1",
    line2: "Address2",
    city: "City",
    province: "State",
    postalCode: "Zip",
    status: "ContractorLicenseStatus",
    classType: "ContractorLicenseTypeCode",
    classCode: "SpecialtyCode1",
    classLabel: "SpecialtyCode1Desc",
    // The second specialty, on 180 of 75,917 active licences (0.24%). Read
    // because it is there, not because it matters much — but a licence holding
    // both ROOFING and SIDING is a licence whose trade is genuinely two, and
    // tradeForCategories already refuses that case rather than picking one.
    classCode2: "SpecialtyCode2",
    entityType: "BusinessTypeCodeDesc",
    principal: "PrimaryPrincipalName",
  },
  /**
   * ACTIVE only. See the file header for the 85,006 rows this excludes and
   * what four of the other statuses mean.
   *
   * NOT "RE-LICENSED": that status means the number was superseded by a newer
   * one, so the business is still trading under a DIFFERENT row that is
   * already ACTIVE. Keeping both would put the same contractor in the queue
   * twice under two licence numbers, which dedupe.js would then have to
   * unpick from a phone number.
   */
  activeStatuses: Object.freeze(["ACTIVE"]),
  classes: WA_LNI_CLASSES,
  /**
   * The class token, `TYPE|CODE`.
   *
   * The pipe and the type are load-bearing: six of Washington's specialty
   * codes mean different things under different licence types, and `01` alone
   * means GENERAL, JOURNEY LEVEL or GENERAL depending on which. classes.js's
   * header carries the measurement.
   */
  classToken(row) {
    const type = String(row?.ContractorLicenseTypeCode ?? "").trim();
    const code = String(row?.SpecialtyCode1 ?? "").trim();
    if (!type && !code) return null;
    return `${type}|${code}`;
  },
  /** Extra class tokens on the same row. Washington's second specialty column. */
  extraClassTokens(row) {
    const type = String(row?.ContractorLicenseTypeCode ?? "").trim();
    const code = String(row?.SpecialtyCode2 ?? "").trim();
    return code ? [`${type}|${code}`] : [];
  },
  /**
   * What the campaign form says this source yields, in the numbers it was
   * measured at. Rendered on the provider description — the one surface a
   * superadmin reads BEFORE ticking the box.
   */
  // Every number produced by running scripts/us-board-snapshot.mjs against the
  // published file on 2026-09-03, not by a separate estimate of it.
  measured: Object.freeze({
    // `rowsUpdatedAt` was 1788482167 — 2026-09-04T00:36:07Z. The portal
    // republishes three times a day, so a UTC date one day ahead of the local
    // one is normal here rather than a sign of a clock problem.
    release: "2026-09-04",
    rows: 160923,
    licences: 75917,
    phonePct: "99.97",
    addressPct: "100",
    emailPct: "0",
    unrestricted: 51755,
    decisive: 17650,
    decisivePct: "23.3",
  }),
};

/**
 * Oregon Construction Contractors Board — active licences.
 *
 * Verified 2026-09-03 by downloading and parsing the file: 14,622,752 bytes of
 * CSV, 56,156 rows, 0 bad widths, grouping to 45,483 distinct licences.
 */
const OR_CCB = {
  key: "us_or_ccb",
  state: "OR",
  country: "US",
  label: "Oregon CCB — active contractor licences",
  board: "Oregon Construction Contractors Board",
  source: {
    kind: "socrata",
    host: "data.oregon.gov",
    datasetId: "g77e-6bhs",
    licenceId: "USGOV_WORKS",
  },
  licence: {
    name: "Public Domain (U.S. Government Works)",
    url: "https://www.usa.gov/government-works",
    obligation:
      "Published as a public-domain government work: commercial use, storage and redistribution " +
      "are permitted and no attribution is required. FieldQuo names the source on the prospect " +
      "record anyway, for the same reason it does for Washington.",
    attribution:
      "Contains active contractor licence data published by the Oregon Construction Contractors " +
      "Board on data.oregon.gov as a public-domain U.S. government work.",
  },
  datasetUrl: "https://data.oregon.gov/d/g77e-6bhs",
  verifyUrl: "https://search.ccb.state.or.us/search/",
  columns: {
    id: "license_number",
    name: "full_name",
    phone: "phone_number",
    email: null,
    website: null,
    line1: "address",
    line2: null,
    city: "city",
    province: "state",
    postalCode: "zip_code",
    // No status column: the published dataset IS the active list. See the
    // file header — null means the publisher filtered, never "keep everything".
    status: null,
    classType: null,
    classCode: "license_type",
    classLabel: "endorsement_text",
    classCode2: null,
    entityType: null,
    principal: "rmi_name",
  },
  activeStatuses: null,
  /**
   * What the board asserts about every row, where it asserts it per DATASET
   * rather than per row.
   *
   * The dataset is titled "CCB Active Licenses" and described as "Contractors
   * who can legally work in the State of Oregon". That is a statement the CCB
   * makes, so carrying it is not padding — but it is a statement about the
   * FILE, and the string says so rather than passing a dataset title off as a
   * column the board publishes. Washington has no such field because it
   * publishes the status on every row.
   */
  datasetAssertedStatus: "Active — the CCB publishes this dataset as its active-licence list",
  classes: OR_CCB_CLASSES,
  classToken(row) {
    const code = String(row?.license_type ?? "").trim();
    return code || null;
  },
  extraClassTokens() {
    return [];
  },
  measured: Object.freeze({
    release: "2026-09-03",
    rows: 56156,
    licences: 45483,
    phonePct: "99.97",
    addressPct: "100",
    emailPct: "0",
    unrestricted: 39525,
    decisive: 1470,
    decisivePct: "3.2",
  }),
};

/** Every board this build ships, keyed by provider key. */
export const US_BOARDS = Object.freeze({
  [CA_CSLB.key]: Object.freeze(CA_CSLB),
  [WA_LNI.key]: Object.freeze(WA_LNI),
  [OR_CCB.key]: Object.freeze(OR_CCB),
});

/** Board keys, in the order the campaign form lists them. */
export function usBoardKeys() {
  return Object.keys(US_BOARDS).sort();
}

/** One board, or null for a key this build does not ship. */
export function usBoard(key) {
  return Object.prototype.hasOwnProperty.call(US_BOARDS, key) ? US_BOARDS[key] : null;
}

/**
 * Problems with a board declaration, as data.
 *
 * Run by scripts/check-us-boards.mjs over every shipped board rather than
 * asserted per board, so a state added next month is held to the same rules
 * without anybody remembering to add an assertion. A board that names a status
 * column it does not filter on, or filters on statuses with no column to read
 * them from, is the failure that keeps 85,006 expired Washington licences.
 */
export function boardProblems(board) {
  const problems = [];
  if (!board || typeof board !== "object") return ["not_an_object"];
  for (const field of ["key", "state", "country", "label", "board", "datasetUrl"]) {
    if (typeof board[field] !== "string" || !board[field].trim()) problems.push(`no_${field}`);
  }
  if (typeof board.classToken !== "function") problems.push("no_class_token");
  if (typeof board.extraClassTokens !== "function") problems.push("no_extra_class_tokens");
  if (!board.classes || typeof board.classes !== "object") problems.push("no_class_vocabulary");
  for (const field of ["name", "url", "obligation"]) {
    if (typeof board?.licence?.[field] !== "string" || !board.licence[field].trim()) {
      problems.push(`no_licence_${field}`);
    }
  }
  const columns = board.columns || {};
  for (const field of ["id", "name", "line1", "city", "province", "postalCode"]) {
    if (typeof columns[field] !== "string" || !columns[field].trim()) problems.push(`no_column_${field}`);
  }
  // The two halves of the status decision have to agree. A status column with
  // no allow-list keeps every expired licence; an allow-list with no column to
  // read has nothing to apply it to and would keep them all too.
  const hasStatusColumn = typeof columns.status === "string" && columns.status.trim();
  const hasAllowList = Array.isArray(board.activeStatuses) && board.activeStatuses.length > 0;
  if (hasStatusColumn && !hasAllowList) problems.push("status_column_with_no_allow_list");
  if (!hasStatusColumn && hasAllowList) problems.push("allow_list_with_no_status_column");
  return problems;
}
