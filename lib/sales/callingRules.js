// lib/sales/callingRules.js
//
// WHICH rules bind a sales call, WHERE they bind, and whether this call may be
// placed right now.
//
// ══ Why a table and not a function full of if-statements ═══════════════════
//
// lib/sales/callingWindow.js encodes ONE window — Canada's — as constants,
// because when it was written Canada was the only jurisdiction anyone had
// read. That was honest then and is wrong now: the same file's window was
// being applied, in principle, to a prospect in Oklahoma whose statute says
// something different, and in practice to nobody at all, because nothing in
// production ever called it. `app/sales/queue/page.js` rendered a `tel:` link
// with no check of any kind, so a rep could dial at three in the morning.
//
// The rules differ per jurisdiction along four axes at once — window start,
// window end, whether the weekend differs, and whether there is a cap on how
// often the same business may be rung — and, crucially, along a fifth that no
// window function can express: whether anybody has actually READ that
// jurisdiction's law. So this is a table of rows with a `verified` flag, and
// the flag is load-bearing. A row that says "we have not read this" must
// produce "we cannot confirm this is allowed", never "allowed".
//
// ══ There is no permissive default, and that is the whole design ═══════════
//
// The obvious shape was a federal floor with state overrides. It cannot be
// built, because there is no federal floor for these calls:
//
//   16 CFR 310.6(b)(7) exempts business-to-business calls from the ENTIRE
//   Telemarketing Sales Rule, and the TSR's 8am–9pm restriction (16 CFR
//   310.4(c)) is limited to calls to a RESIDENCE in the first place. FieldQuo
//   sells software to contractors for use in their business. Federal calling
//   hours therefore do not bind these calls at all, and a "federal default" in
//   this table would be an invented rule wearing a citation.
//
// So an unlisted US state resolves to `unknown`, not to a comfortable 8-to-9.
// That is a strong posture and it is deliberate: AGENTS.md failure class #5,
// padding absent data with defaults. The audit's own words are that fifty
// states were not read and would not be guessed at
// (docs/sales-intel/AUDIT-compliance.md §8), and the corresponding owner item
// is "get a state-law read for the US states actually targeted". Rendering
// "we cannot confirm this is allowed" on the queue screen is what makes that
// item visible instead of theoretical.
//
// ══ 47 U.S.C. 227(b)(1)(A)(iii) is out of scope, and stays that way ════════
//
// The TCPA's ban on autodialled and artificial-voice calls to wireless numbers
// has NO business exemption, and small contractors answer on mobiles. It is
// not triggered today for one structural reason: the queue dials through a
// `tel:` link a human presses, and the automated voice path
// (lib/voice/outboundCall.js) requires a companyId and targets a tenant's own
// client. No sales path reaches it. That is a property worth keeping rather
// than a fact worth noting, so scripts/check-sales-calling-window.mjs walks the
// import graph from every sales entry point and fails if it ever does.
//
// ══ What this file deliberately does NOT do ════════════════════════════════
//
// Registration. Washington (RCW 19.158.050) and Texas (Bus. & Com. Code ch.
// 302) require a telephone solicitor to register — and post security — BEFORE
// the first call, and Canada's National DNCL registration is free and
// mandatory even for callers whose calls are exempt. None of that is code: it
// is a form, a fee and a bond. It is carried here as a per-jurisdiction flag
// so the screen can say it out loud and the owner can see which markets are
// gated on a signature, and it is a WARNING rather than a refusal because
// nothing in this system can know whether the certificate is in the drawer.
// Flip `registration.done` to true in this table when it is, and cite the
// registration number in the commit.
import { SALES_CALL_WINDOW, localTimeIn } from "./callingWindow";

export const CALL_ALLOWED = "allowed";
export const CALL_REFUSED = "refused";
export const CALL_UNKNOWN = "unknown";

/**
 * A window that is the same every day, expressed the way SALES_CALL_WINDOW is
 * so one evaluator serves both.
 *
 * Minutes from local midnight rather than hours, for callingWindow.js's reason:
 * Canada's weekday cutoff is 21:30, and an hour-granular representation has to
 * round it to a side, both of which are wrong.
 */
function flat(startMinute, endMinute) {
  return { weekday: { startMinute, endMinute }, weekend: { startMinute, endMinute } };
}

/** 08:00–20:00, every day. The shape Oklahoma, Florida and Washington share. */
const EIGHT_TO_EIGHT = flat(8 * 60, 20 * 60);

/**
 * The jurisdictions, as data.
 *
 * `verified: true` means a human read the primary source named in `citation`
 * and the window below is what it says. `verified: false` means the
 * jurisdiction is KNOWN TO MATTER and has not been read — it is listed rather
 * than omitted so the screen can say which statute is outstanding, which an
 * absent row cannot.
 *
 * `window: null` on a verified row means the jurisdiction was read and imposes
 * no time-of-day restriction. That is a finding, and it is not the same as
 * `verified: false` — see US-NV, where the distinction is the whole point.
 *
 * `maxCallsPer24h` is a cap on calls to the same called party on the same
 * subject within 24 hours. Only two jurisdictions here have one, and neither
 * can be enforced until something records call attempts — see
 * `salesCallReadiness`, which reports that gap rather than ignoring it.
 *
 * `dataAcquisition` is not about dialling at all. Several states regulate
 * OBTAINING a list of licensed contractors for solicitation, which is upstream
 * of this gate and of the discovery pipeline both. It rides here because this
 * is the file that already knows which jurisdiction a prospect is in, and
 * because a constraint recorded nowhere is a constraint nobody meets.
 */
export const CALLING_JURISDICTIONS = Object.freeze({
  // ── Canada: federal, and the same in every province ─────────────────────
  //
  // The CRTC's Unsolicited Telecommunications Rules are federal, so there is
  // one Canadian row rather than thirteen. B2B calls are exempt from Part II
  // (the National DNCL) ONLY; Parts III and IV still apply in full, which is
  // where the hours, the identification requirement and the internal
  // do-not-call list come from.
  CA: {
    code: "CA",
    name: "Canada",
    verified: true,
    window: SALES_CALL_WINDOW,
    maxCallsPer24h: null,
    citation:
      "CRTC Unsolicited Telecommunications Rules, Part III (Telemarketing Rules): " +
      "09:00–21:30 weekdays and 10:00–18:00 weekends in the called party's time zone. " +
      "Business-to-business calls are exempt from Part II (National DNCL) only.",
    registration: {
      required: true,
      done: false,
      what:
        "Registration with Canada's National DNCL at lnnte-dncl.gc.ca. Free, and " +
        "mandatory even for a telemarketer whose calls are exempt. A subscription " +
        "is a different thing and is almost certainly not needed.",
    },
    dataAcquisition: null,
  },

  // ── United States, by state ─────────────────────────────────────────────

  "US-OK": {
    code: "US-OK",
    name: "Oklahoma",
    verified: true,
    window: EIGHT_TO_EIGHT,
    maxCallsPer24h: 3,
    citation:
      "15 O.S. §775C.1 et seq. — 'called party' carries no consumer or residential " +
      "limitation, so these calls are in scope: 08:00–20:00 local, and no more than " +
      "three calls in 24 hours on the same subject. Private right of action, $500 " +
      "trebled. The B2B exemption at §775C.5(10) requires three years' trading under " +
      "the same name with at least half of sales repeat business to existing " +
      "customers; FieldQuo cannot meet it, so it is assumed not to apply.",
    registration: null,
    dataAcquisition: null,
  },

  "US-FL": {
    code: "US-FL",
    name: "Florida",
    verified: true,
    window: EIGHT_TO_EIGHT,
    maxCallsPer24h: 3,
    citation:
      "Fla. Stat. §501.616(6) — 08:00–20:00 local and no more than three calls in " +
      "24 hours on the same subject. NOT §501.059, which is the do-not-call " +
      "provision and a different rule. §501.603 defines 'person' to include a sole " +
      "proprietorship or any other business entity, so a contractor's business line " +
      "is inside it.",
    registration: null,
    dataAcquisition: null,
  },

  "US-WA": {
    code: "US-WA",
    name: "Washington",
    verified: true,
    window: EIGHT_TO_EIGHT,
    maxCallsPer24h: null,
    citation:
      "RCW 19.158.110(4) bars a telephone solicitation before 08:00 or after 20:00 " +
      "to 'any person', with no business-to-business carve-out, and a violation is a " +
      "per se Consumer Protection Act violation (treble damages, fee-shifting). " +
      "RCW 80.36.390 points the other way — §(1)(b)(v) expressly excludes " +
      "'business-to-business contacts' — but excluding one statute does not lift " +
      "the other, so the 08:00–20:00 window is encoded on the 19.158 basis.",
    registration: {
      required: true,
      done: false,
      what:
        "RCW 19.158.050 requires a commercial telephone solicitor to register with " +
        "the Department of Licensing and post security BEFORE the first call. This " +
        "is a filing and a bond, not code.",
    },
    dataAcquisition: null,
  },

  "US-NV": {
    code: "US-NV",
    name: "Nevada",
    verified: true,
    // Read, and there is nothing to encode. `null` is a FINDING here — the
    // statutes were checked and impose no time-of-day restriction on this call
    // — which is why it must not be confused with `verified: false`. See
    // FIELDQUO_COURTESY_WINDOW below for what happens next, and why it is
    // labelled as FieldQuo's manners rather than as Nevada's law.
    window: null,
    maxCallsPer24h: null,
    citation:
      "NRS 239 and NRS/NAC 624 carry no commercial-purpose or solicitation " +
      "restriction, and NRS 624.110(1) affirmatively requires the contractor licence " +
      "record be kept open to the public. Nothing in Nevada law restricts the hours " +
      "of a business-to-business sales call, and no federal rule fills the gap: " +
      "16 CFR 310.6(b)(7) exempts B2B from the TSR entirely.",
    registration: null,
    dataAcquisition: null,
  },

  "US-AZ": {
    code: "US-AZ",
    name: "Arizona",
    // The calling hours were NOT read. What was read is a public-records rule
    // about how the prospect list may be obtained, which is a different
    // question and does not make the calling question answered.
    verified: false,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Arizona's telephone solicitation hours have not been read. Separately and " +
      "verified: A.R.S. §39-121.03(D) names 'obtaining of names and addresses … for " +
      "the purpose of solicitation' as a commercial purpose, so a written statement " +
      "of purpose is required to obtain the records, market-value pricing is " +
      "permitted, and §39-121.03(C) allows treble damages for misstating the purpose.",
    registration: null,
    dataAcquisition:
      "A.R.S. §39-121.03: obtaining names and addresses from an Arizona public body " +
      "for solicitation requires a written declaration of that purpose. Misstating it " +
      "carries treble damages. This binds the discovery pipeline, not the dialler.",
  },

  "US-TX": {
    code: "US-TX",
    name: "Texas",
    verified: false,
    window: null,
    maxCallsPer24h: null,
    citation:
      "Texas Bus. & Com. Code ch. 302 requires a telephone solicitor to register and " +
      "post security, and that requirement could NOT be verified this session — the " +
      "statute sites now serve a JavaScript shell and the Secretary of State returns " +
      "403. Calling hours were not read either. Separately and verified: Gov't Code " +
      "§552.222(b) forbids a Texas agency from asking why a requestor wants records, " +
      "so obtaining a list is unconstrained on the requestor's side.",
    registration: {
      required: true,
      done: false,
      what:
        "Texas Bus. & Com. Code ch. 302 registration and security. Status UNKNOWN — " +
        "not confirmed either way. Treat Texas as gated until somebody reads it.",
    },
    dataAcquisition: null,
  },

  // ── Named, known to matter, and not read ────────────────────────────────
  //
  // Listed rather than omitted so a refusal can name the statute that is
  // outstanding. An omitted state produces "nobody has read this state";
  // these produce "this is the specific thing nobody has read".
  "US-MD": unread(
    "US-MD",
    "Maryland",
    "Stop the Spam Calls Act (2023). A business-to-business exemption at Comm. Law " +
      "§14-4502 was claimed but could not be verified from the codified text.",
  ),
  "US-NY": unread("US-NY", "New York", "New York's telemarketing provisions were not read."),
  "US-MS": unread("US-MS", "Mississippi", "Mississippi's telemarketing provisions were not read."),
  "US-LA": unread("US-LA", "Louisiana", "Louisiana's telemarketing provisions were not read."),
  "US-IN": unread("US-IN", "Indiana", "Indiana's telemarketing provisions were not read."),
  "US-CT": unread("US-CT", "Connecticut", "Connecticut's telemarketing provisions were not read."),
});

function unread(code, name, citation) {
  return {
    code,
    name,
    verified: false,
    window: null,
    maxCallsPer24h: null,
    citation,
    registration: null,
    dataAcquisition: null,
  };
}

/**
 * FieldQuo's own manners, applied only where a VERIFIED row imposes no window.
 *
 * Nevada is the case that forces the decision. Its law was read and it imposes
 * nothing, so the legally correct answer is that a rep may dial a Nevada
 * contractor at four in the morning. Shipping that would be defensible in court
 * and indefensible on the phone, and it would be the only surface in this
 * product where "legal" was the whole test.
 *
 * So a verified-but-unrestricted jurisdiction gets this window, and every
 * refusal it produces SAYS it is FieldQuo's rule rather than the state's. That
 * distinction is the honesty: a rep told "Nevada forbids this" would be told
 * something false, and would find out.
 *
 * It is the narrower of the two real windows in this file rather than a new
 * number, because inventing a third set of bounds would mean defending them.
 */
export const FIELDQUO_COURTESY_WINDOW = EIGHT_TO_EIGHT;

// ═══════════════════════════════════════════════════════════════════════════
// Where is this prospect, and what time is it there
// ═══════════════════════════════════════════════════════════════════════════

/** Accents folded, punctuation dropped, uppercased. */
function fold(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    // Escaped rather than written as literal combining marks: the literal form
    // is invisible in a diff and a reviewer cannot tell a correct range from a
    // mangled one. lib/sales/discovery/dedupe.js folds the same way.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const COUNTRY_ALIASES = Object.freeze({
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  CA: "CA",
  CAN: "CA",
  CANADA: "CA",
});

/** Full subdivision names → ISO code. Overture writes codes; humans write names. */
const SUBDIVISION_ALIASES = Object.freeze({
  // Canada, including the French forms a Quebec directory row arrives in.
  ALBERTA: "AB",
  "BRITISH COLUMBIA": "BC",
  "COLOMBIE BRITANNIQUE": "BC",
  MANITOBA: "MB",
  "NEW BRUNSWICK": "NB",
  "NOUVEAU BRUNSWICK": "NB",
  "NEWFOUNDLAND AND LABRADOR": "NL",
  "TERRE NEUVE ET LABRADOR": "NL",
  "NORTHWEST TERRITORIES": "NT",
  "NOVA SCOTIA": "NS",
  "NOUVELLE ECOSSE": "NS",
  NUNAVUT: "NU",
  ONTARIO: "ON",
  "PRINCE EDWARD ISLAND": "PE",
  "ILE DU PRINCE EDOUARD": "PE",
  QUEBEC: "QC",
  SASKATCHEWAN: "SK",
  YUKON: "YT",
  // United States.
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
  COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", "DISTRICT OF COLUMBIA": "DC",
  FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL",
  INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA",
  MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN",
  MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV",
  "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
  "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK",
  OREGON: "OR", PENNSYLVANIA: "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
  "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT", VERMONT: "VT",
  VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI",
  WYOMING: "WY",
});

/**
 * Subdivision → every IANA zone a DISTRICT-SIZED part of it observes.
 *
 * ══ The rule for what goes in a list, written down because it is a judgement ═
 *
 * A subdivision lists every zone observed by a county-, district- or
 * census-area-sized part of it. Sub-municipal and single-town exceptions are
 * named in a comment and NOT listed, because listing one would cost an hour of
 * lawful calling time across an entire province to be right about one town.
 * Where a prospect actually sits in one of those towns, the evaluation below is
 * at most one hour out in the permissive direction, and that is a stated,
 * bounded error rather than a hidden one.
 *
 * ══ Why a state and not an area code ═══════════════════════════════════════
 *
 * SalesLead.timeZone's schema comment already rejects area codes and gives the
 * reason: an area code is wrong for every ported mobile, and small contractors
 * answer on mobiles they carried from a previous city. A registered business
 * address is where the business is, and it is what the directory source
 * actually publishes with provenance attached (Prospect.sourceRelease). It is
 * also the field the JURISDICTION comes from, and having the clock and the
 * statute derive from the same fact is what stops them ever disagreeing about
 * which state a prospect is in.
 *
 * The approximation that remains is the multi-zone state, and it is handled by
 * refusing to guess rather than by picking a side — see `zoneAgreement`.
 */
export const SUBDIVISION_TIME_ZONES = Object.freeze({
  // ── Canada ──────────────────────────────────────────────────────────────
  // NL: south-eastern Labrador observes Atlantic. Sub-district; not listed.
  NL: ["America/St_Johns"],
  NS: ["America/Halifax"],
  PE: ["America/Halifax"],
  NB: ["America/Moncton"],
  // QC: Blanc-Sablon (one municipality, ~1,000 people) is AST year-round.
  // Sub-district; not listed.
  QC: ["America/Toronto"],
  // ON: Kenora and Rainy River districts are Central. District-sized, listed.
  ON: ["America/Toronto", "America/Winnipeg"],
  MB: ["America/Winnipeg"],
  // SK: Lloydminster observes Alberta time by charter. One town; not listed.
  SK: ["America/Regina"],
  AB: ["America/Edmonton"],
  // BC: the Peace River region keeps MST year-round, the East Kootenay keeps
  // Mountain with DST. Both are regional districts, so both are listed.
  BC: ["America/Vancouver", "America/Dawson_Creek", "America/Edmonton"],
  YT: ["America/Whitehorse"],
  // NT: America/Yellowknife is a deprecated alias of America/Edmonton and some
  // ICU builds no longer carry it, so the canonical name is used.
  NT: ["America/Edmonton"],
  NU: ["America/Iqaluit", "America/Rankin_Inlet", "America/Cambridge_Bay"],

  // ── United States ───────────────────────────────────────────────────────
  AL: ["America/Chicago"],
  // AK: the Aleutians West census area is Hawaii-Aleutian. Census-area sized.
  AK: ["America/Anchorage", "America/Adak"],
  // AZ: the state does not observe DST, the Navajo Nation does. Multi-county.
  AZ: ["America/Phoenix", "America/Denver"],
  AR: ["America/Chicago"],
  CA: ["America/Los_Angeles"],
  CO: ["America/Denver"],
  CT: ["America/New_York"],
  DE: ["America/New_York"],
  DC: ["America/New_York"],
  // FL: the western panhandle counties are Central. Multi-county.
  FL: ["America/New_York", "America/Chicago"],
  GA: ["America/New_York"],
  HI: ["Pacific/Honolulu"],
  // ID: the northern panhandle is Pacific.
  ID: ["America/Boise", "America/Los_Angeles"],
  IL: ["America/Chicago"],
  // IN: the north-west and south-west counties are Central.
  IN: ["America/Indiana/Indianapolis", "America/Chicago"],
  IA: ["America/Chicago"],
  KS: ["America/Chicago", "America/Denver"],
  KY: ["America/New_York", "America/Chicago"],
  LA: ["America/Chicago"],
  ME: ["America/New_York"],
  MD: ["America/New_York"],
  MA: ["America/New_York"],
  // MI: four Upper Peninsula counties bordering Wisconsin are Central.
  MI: ["America/New_York", "America/Menominee"],
  MN: ["America/Chicago"],
  MS: ["America/Chicago"],
  MO: ["America/Chicago"],
  MT: ["America/Denver"],
  NE: ["America/Chicago", "America/Denver"],
  // NV: West Wendover observes Mountain. One town; not listed.
  NV: ["America/Los_Angeles"],
  NH: ["America/New_York"],
  NJ: ["America/New_York"],
  NM: ["America/Denver"],
  NY: ["America/New_York"],
  NC: ["America/New_York"],
  ND: ["America/Chicago", "America/Denver"],
  OH: ["America/New_York"],
  OK: ["America/Chicago"],
  // OR: Malheur County is Mountain.
  OR: ["America/Los_Angeles", "America/Boise"],
  PA: ["America/New_York"],
  RI: ["America/New_York"],
  SC: ["America/New_York"],
  SD: ["America/Chicago", "America/Denver"],
  TN: ["America/New_York", "America/Chicago"],
  // TX: El Paso and Hudspeth counties are Mountain.
  TX: ["America/Chicago", "America/Denver"],
  UT: ["America/Denver"],
  VT: ["America/New_York"],
  VA: ["America/New_York"],
  WA: ["America/Los_Angeles"],
  WV: ["America/New_York"],
  WI: ["America/Chicago"],
  WY: ["America/Denver"],
});

/**
 * Country and subdivision codes from whatever the directory source wrote.
 *
 * Returns `{ country, subdivision }`, either of which may be null. Never
 * guesses one from the other: a bare "OK" with no country is Oklahoma to a
 * human and ambiguous to a program, and inventing the country is how a
 * Canadian prospect gets evaluated against an American statute.
 */
export function locationCodes({ country = null, province = null } = {}) {
  const c = fold(country);
  const p = fold(province);

  const countryCode = COUNTRY_ALIASES[c] || null;

  let subdivision = null;
  if (p) {
    // "US-FL" and "CA-ON" are both spellings a source may use.
    const hyphen = p.match(/^(?:US|CA) ([A-Z]{2})$/);
    const bare = hyphen ? hyphen[1] : p;
    if (/^[A-Z]{2}$/.test(bare) && SUBDIVISION_TIME_ZONES[bare]) subdivision = bare;
    else if (SUBDIVISION_ALIASES[p]) subdivision = SUBDIVISION_ALIASES[p];
  }

  return { country: countryCode, subdivision };
}

/**
 * The jurisdiction row governing this prospect, or null.
 *
 * Canada resolves to one federal row whatever the province is, because the
 * rules are federal. The United States resolves per state, because they are
 * not, and there is no national row to fall back to.
 */
export function jurisdictionFor(prospect = {}) {
  const { country, subdivision } = locationCodes(prospect);
  if (country === "CA") return CALLING_JURISDICTIONS.CA;
  if (country === "US" && subdivision) {
    return CALLING_JURISDICTIONS[`US-${subdivision}`] || null;
  }
  return null;
}

/** Every zone a district-sized part of this prospect's subdivision observes. */
export function zonesFor(prospect = {}) {
  const { subdivision } = locationCodes(prospect);
  const zones = subdivision ? SUBDIVISION_TIME_ZONES[subdivision] : null;
  return zones ? [...zones] : [];
}

// ═══════════════════════════════════════════════════════════════════════════
// The clock
// ═══════════════════════════════════════════════════════════════════════════

/** Minutes from local midnight → "08:00". */
export function hhmm(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** A window, as a sentence. Derived from the bounds, never retyped beside them. */
export function describeWindow(window) {
  if (!window) return null;
  const { weekday, weekend } = window;
  const same =
    weekday.startMinute === weekend.startMinute && weekday.endMinute === weekend.endMinute;
  if (same) {
    return `${hhmm(weekday.startMinute)}–${hhmm(weekday.endMinute)} every day, in the prospect's own time zone`;
  }
  return (
    `${hhmm(weekday.startMinute)}–${hhmm(weekday.endMinute)} weekdays, ` +
    `${hhmm(weekend.startMinute)}–${hhmm(weekend.endMinute)} weekends, ` +
    `in the prospect's own time zone`
  );
}

/** Is this instant inside the window, in ONE named zone? */
function insideIn(window, zone, now) {
  const local = localTimeIn(zone, now);
  if (!local) return null;
  const isWeekend = local.weekday === 0 || local.weekday === 6;
  const bounds = isWeekend ? window.weekend : window.weekday;
  return local.minute >= bounds.startMinute && local.minute < bounds.endMinute;
}

/**
 * The three-valued answer across every zone the subdivision might be in.
 *
 * `true` and `false` only when every candidate agrees. When they disagree the
 * answer is `null` — "we cannot tell", which is a different sentence from "no"
 * and gets a different one on screen.
 *
 * ══ Why not pick the majority zone ═════════════════════════════════════════
 *
 * Because being wrong is not symmetric. Florida spans Eastern and Central; a
 * Pensacola contractor evaluated as Miami is rung at 07:00 local when the
 * screen believes it is 08:00, and Fla. Stat. §501.616(6) carries a private
 * right of action. Picking the majority zone is AGENTS.md failure class #5 with
 * a legal bill attached: absence of a stated time zone is not a statement that
 * they are in the populous half.
 *
 * The cost is an hour at each end of the day in a split subdivision, and it
 * lands as "we cannot confirm", which is honest and fixable, rather than as a
 * confident wrong answer, which is neither.
 */
export function zoneAgreement(window, zones, now) {
  if (!window || !Array.isArray(zones) || zones.length === 0) return null;
  let seen = null;
  for (const zone of zones) {
    const inside = insideIn(window, zone, now);
    if (inside === null) return null; // an unusable zone name poisons the answer
    if (seen === null) seen = inside;
    else if (seen !== inside) return null;
  }
  return seen;
}

/**
 * The next instant every candidate zone agrees is inside the window.
 *
 * Stepped rather than solved. Every bound in this file falls on :00 or :30, so
 * five-minute steps from a five-minute-aligned start land exactly on the
 * boundary; solving it analytically would mean re-deriving DST transitions that
 * Intl already knows. Capped at eight days, which is longer than any window's
 * gap — a null back from here means something is wrong with the zones, not that
 * the wait is long.
 */
export function nextOpening(window, zones, now = new Date()) {
  if (!window || !Array.isArray(zones) || zones.length === 0) return null;
  const STEP = 5 * 60 * 1000;
  let t = Math.ceil(now.getTime() / STEP) * STEP;
  const limit = now.getTime() + 8 * 24 * 60 * 60 * 1000;
  while (t <= limit) {
    const at = new Date(t);
    if (zoneAgreement(window, zones, at) === true) return at;
    t += STEP;
  }
  return null;
}

/** "08:00 on Tue 8 Sep, their time" — in the zone named, spelled for a human. */
export function describeLocal(at, zone) {
  if (!at || !zone) return null;
  try {
    const text = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(at);
    return `${text} (${zone})`;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// The single entry point
// ═══════════════════════════════════════════════════════════════════════════

/**
 * May a rep dial this prospect right now, and what does a human need told?
 *
 * ══ Three outcomes, because there are three states ═════════════════════════
 *
 * `allowed`, `refused` and `unknown` are not two states with a shading. The
 * queue screen already renders `has` / `gap` / `unknown` in three colours for
 * exactly this reason, and the mistake it exists to prevent is the same one:
 * "we looked and it is not permitted" and "nobody has looked" are different
 * claims, and collapsing them tells a rep something nobody knows.
 *
 * Only `allowed` may produce a dial control. `dialHref` below is the structural
 * half of that — the page has no `tel:` string of its own to render.
 *
 * ══ The 24-hour cap, and why it is reported rather than enforced ═══════════
 *
 * Oklahoma and Florida both cap calls to the same business on the same subject
 * at three in 24 hours. Nothing in this repository records that a call was
 * attempted — there is no model, and inventing one is the owner's decision, not
 * this session's. So when `attemptsLast24h` is null the cap goes into
 * `unenforced` and onto the screen in the rep's own words, instead of silently
 * not applying. A rule the software claims to keep and does not is worse than a
 * rule it admits it cannot count.
 *
 * Pass a number and it is enforced properly.
 *
 * ══ A stated time zone beats a derived one ════════════════════════════════
 *
 * `timeZone` is the zone a REP stated after speaking to the business — today
 * that is SalesLead.timeZone, written from the texting screen and already read
 * by lib/sales/salesSmsRules.js. When one exists it replaces the whole derived
 * set, because a person who has had the prospect on the phone outranks a
 * subdivision lookup, and because it is the only thing that resolves a split
 * state such as Florida to a single clock. When there is none the derived set
 * stands and its ambiguity is reported rather than averaged away.
 *
 * @param prospect        `{ country, province }` — the rest is ignored.
 * @param timeZone        an IANA zone somebody actually stated, or null.
 * @param attemptsLast24h calls already placed to this prospect in the last 24
 *                        hours, or null for "nothing counts them yet".
 */
export function salesCallReadiness({
  prospect = {},
  timeZone = null,
  now = new Date(),
  attemptsLast24h = null,
} = {}) {
  const blockers = [];
  const warnings = [];
  const unenforced = [];

  const { country, subdivision } = locationCodes(prospect);
  const jurisdiction = jurisdictionFor(prospect);
  // A stated zone is only honoured if Intl can actually read it — a typo would
  // otherwise silently replace a working derived set with an unusable one.
  const stated =
    typeof timeZone === "string" && timeZone.trim() && localTimeIn(timeZone, now)
      ? timeZone.trim()
      : null;
  const zones = stated ? [stated] : zonesFor(prospect);
  const zoneSource = stated ? "stated" : "derived";

  const base = {
    jurisdiction: jurisdiction
      ? { code: jurisdiction.code, name: jurisdiction.name, verified: jurisdiction.verified }
      : null,
    zones,
    zoneSource,
    windowText: null,
    citation: jurisdiction?.citation || null,
    opensAt: null,
    opensAtText: null,
    blockers,
    warnings,
    unenforced,
  };

  // ── Do we know where they are at all? ───────────────────────────────────
  if (!country || !subdivision) {
    blockers.push({
      code: "location_unknown",
      title: "We do not know which state or province this business is in.",
      fix:
        "Calling hours are set by the place the phone rings, and there is no federal " +
        "rule underneath to fall back on — 16 CFR 310.6(b)(7) exempts business calls " +
        "from the whole Telemarketing Sales Rule. Until this record carries a country " +
        "and a state, nobody can say whether ringing them is allowed.",
    });
    return { ...base, decision: CALL_UNKNOWN };
  }

  // ── Has anybody read this jurisdiction's law? ───────────────────────────
  if (!jurisdiction) {
    blockers.push({
      code: "jurisdiction_unread",
      title: `Nobody has read ${subdivision}'s telephone solicitation law.`,
      fix:
        "Federal law does not fill this gap: business-to-business calls are exempt " +
        "from the Telemarketing Sales Rule entirely, so the state's own rule is the " +
        "only one there is. This is the owner's item — a state-law read for the " +
        "states actually being called. Until it comes back, this cannot be confirmed " +
        "as allowed.",
    });
    return { ...base, decision: CALL_UNKNOWN };
  }

  if (!jurisdiction.verified) {
    blockers.push({
      code: "jurisdiction_unverified",
      title: `${jurisdiction.name}'s calling rules have not been verified.`,
      fix: jurisdiction.citation,
    });
    // A registration flag on an unverified row still gets said out loud — Texas
    // is gated twice over and a rep should see both reasons, not the first one.
    pushRegistration(warnings, jurisdiction);
    pushDataAcquisition(warnings, jurisdiction);
    return { ...base, decision: CALL_UNKNOWN };
  }

  pushRegistration(warnings, jurisdiction);
  pushDataAcquisition(warnings, jurisdiction);

  // ── Which window applies, and whose rule is it? ─────────────────────────
  const statutory = Boolean(jurisdiction.window);
  const window = jurisdiction.window || FIELDQUO_COURTESY_WINDOW;
  const windowText = describeWindow(window);
  const whose = statutory
    ? `${jurisdiction.name}'s rule`
    : `FieldQuo's own rule — ${jurisdiction.name} imposes none`;

  if (zones.length === 0) {
    blockers.push({
      code: "time_zone_unknown",
      title: "We cannot work out what time it is where this business is.",
      fix:
        `The window is ${windowText} (${whose}), and it is stated in THEIR local ` +
        `time. We hold no time zone for ${subdivision}, so there is nothing to ` +
        `evaluate — and our own clock is the worst available substitute.`,
    });
    return { ...base, windowText, decision: CALL_UNKNOWN };
  }

  const agreement = zoneAgreement(window, zones, now);
  const opensAt = nextOpening(window, zones, now);
  const opensAtText = opensAt ? describeLocal(opensAt, zones[0]) : null;
  const withClock = { ...base, windowText, opensAt, opensAtText };

  if (agreement === null) {
    // Split subdivision, and the halves disagree about this minute.
    blockers.push({
      code: "time_zone_ambiguous",
      title: `${subdivision} spans more than one time zone, and right now they disagree.`,
      fix:
        `It is inside ${windowText} in part of ${subdivision} and outside it in the ` +
        `rest, and this record does not say which part. Rather than guess the ` +
        `populous half, nothing is confirmed. It is safe to call everywhere in ` +
        `${subdivision} from ${opensAtText || "the next time both halves agree"} — ` +
        `or ask them where they are and set their time zone on their lead, which ` +
        `answers this exactly.`,
    });
    return { ...withClock, decision: CALL_UNKNOWN };
  }

  if (agreement === false) {
    blockers.push({
      code: "outside_window",
      title: `It is outside the calling window where they are (${windowText}).`,
      fix: opensAtText
        ? `${whose}. The window opens at ${opensAtText}. Nothing is queued — you press call.`
        : `${whose}. Wait for the window.`,
    });
    return { ...withClock, decision: CALL_REFUSED };
  }

  // ── The cap ─────────────────────────────────────────────────────────────
  if (jurisdiction.maxCallsPer24h != null) {
    if (typeof attemptsLast24h === "number" && Number.isFinite(attemptsLast24h)) {
      if (attemptsLast24h >= jurisdiction.maxCallsPer24h) {
        blockers.push({
          code: "call_cap_reached",
          title:
            `${jurisdiction.name} allows ${jurisdiction.maxCallsPer24h} calls to the same ` +
            `business on the same subject in 24 hours, and ${attemptsLast24h} have been made.`,
          fix: "Nothing more today. The cap is per called party, not per rep.",
        });
        return { ...withClock, decision: CALL_REFUSED };
      }
    } else {
      unenforced.push({
        code: "call_cap_uncounted",
        title:
          `${jurisdiction.name} allows at most ${jurisdiction.maxCallsPer24h} calls to this ` +
          "business on the same subject in 24 hours.",
        fix:
          "Nothing in FieldQuo records call attempts yet, so this cap is not being " +
          "counted for you — keep track yourself. It is a private right of action in " +
          "both states that impose it.",
      });
    }
  }

  return { ...withClock, decision: CALL_ALLOWED };
}

function pushRegistration(warnings, jurisdiction) {
  const reg = jurisdiction.registration;
  if (!reg || !reg.required || reg.done) return;
  warnings.push({
    code: "registration_outstanding",
    title: `FieldQuo must be registered to make sales calls into ${jurisdiction.name}.`,
    fix: reg.what,
  });
}

function pushDataAcquisition(warnings, jurisdiction) {
  if (!jurisdiction.dataAcquisition) return;
  warnings.push({
    code: "data_acquisition_rule",
    title: `${jurisdiction.name} regulates how this prospect's details may be obtained.`,
    fix: jurisdiction.dataAcquisition,
  });
}

/**
 * The dial target — or null, which is the point.
 *
 * ══ Why the href is built HERE and not in the page ═════════════════════════
 *
 * `app/sales/queue/page.js` used to carry `href={`tel:${current.phoneE164}`}`
 * with no check of any kind. The fix that only ADDS a condition around it is
 * one careless edit from regressing, and a check script asserting "the tel:
 * link is inside the right branch" is a regex arguing about JSX, which this
 * project has had produce a false pass more than once.
 *
 * So the page has no `tel:` string of its own. The only way to get one is
 * through this function, which cannot produce one from a refusal or an unknown.
 * That makes the rule executable — the check calls this with each decision and
 * reads the answer — instead of textual. It is the same move
 * lib/sales/salesSmsRules.js makes when it builds the message body only after
 * every blocker has cleared.
 */
export function dialHref(readiness, phoneE164) {
  if (!readiness || readiness.decision !== CALL_ALLOWED) return null;
  const phone = typeof phoneE164 === "string" ? phoneE164.trim() : "";
  if (!phone) return null;
  return `tel:${phone}`;
}
