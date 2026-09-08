// lib/contacts/matchContact.js
//
// "Is this person already a client of yours?" — asked once, in one place.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// A Facebook message arrives from "Marie Tremblay". A Lead Ad form arrives
// with an email and a phone. A CSV of last year's jobs arrives with a name and
// maybe an address. Every one of those has to be turned into "this is client
// c_abc, or we do not know", and until now the only thing in the repo that did
// it was a private helper inside lib/jobs/importPastJob.js that matched on
// name and nothing else. lib/sales/calls/inboundMatch.js does the same job for
// FieldQuo's OWN prospects and is the closest existing thing to this file —
// its two lessons are taken wholesale:
//
//   1. A CONTACT DETAIL IS A HINT, NOT PROOF. A Facebook display name is
//      chosen by the person, a caller ID is asserted by the network. So this
//      module returns facts — who, how confidently, and on what evidence —
//      and never an action. There is no field on the result a caller could
//      mistake for permission to merge, write or bill.
//
//   2. AMBIGUITY IS REPORTED, NEVER RESOLVED BY PICKING. Two clients called
//      "J. Smith" in one city is the ordinary case for a contractor, not an
//      edge case. Silently attaching a conversation to the wrong homeowner is
//      worse than leaving it unattached, because nothing downstream can ever
//      notice. Ties come back as `alternatives` with `client: null` so a
//      screen can ask.
//
// ══ Certain means IDENTIFIER, never name ═══════════════════════════════════
//
//   certain   an exact email match, or an exact phone match. Both are things
//             the person had to know to give us.
//   likely    the full name agrees AND the address agrees. Two people with the
//             same name at the same street number is a household, not a
//             coincidence — but a household can be two customers (a landlord
//             and a tenant), so this still is not `certain`.
//   possible  the name agrees and nothing else does. NEVER auto-links.
//   none      nothing agrees, or something CONFLICTS (see below).
//
// A conflict downgrades, it does not merely fail to add: a name that agrees
// while the two emails disagree is evidence of two different people, and
// scoring it the same as "no email on either side" would silently merge them.
// That rule is inherited from importPastJob's original helper, which refused a
// name match whenever both sides carried an email and the emails differed.
//
// ══ Pure decision, thin read ═══════════════════════════════════════════════
//
// matchContactAgainst() takes rows and decides. matchContact() reads the rows
// and calls it. Everything interesting — the accented name, the phone written
// five ways, the two identical names, the row from another company — is then
// EXECUTED by scripts/check-conversation-attribution.mjs rather than reasoned
// about, which is where every real bug in this class has been found.
//
// ══ One phone normaliser, not a second one ═════════════════════════════════
//
// normalisePhone comes from lib/sales/suppressionRules.js, which gets it from
// lib/voice/numbers.js's toE164. Its header explains why that matters more
// than style: two normalisers that disagree on "+1 613 555-0142" produce a
// lookup that misses, and a matcher that misses looks exactly like a matcher
// that ran and found nothing.
import { normalisePhone, normaliseEmail } from "@/lib/sales/suppressionRules";

/** Strongest first. Index order IS the ranking — see meetsConfidence(). */
export const CONTACT_CONFIDENCE = Object.freeze(["certain", "likely", "possible", "none"]);

/**
 * The columns every caller of this module reads.
 *
 * `companyId` is here because the decision function REFUSES a row that cannot
 * prove which tenant it belongs to (see matchContactAgainst) — a select that
 * drops it makes the matcher throw rather than quietly match nothing.
 *
 * `language`, `province` and `country` are carried for lib/jobs/importPastJob.js,
 * which needs them on the row it gets back to resolve the document's language
 * and tax. They cost nothing and having one select means the past-jobs path
 * cannot drift from this one.
 */
export const CLIENT_MATCH_SELECT = Object.freeze({
  id: true,
  companyId: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  province: true,
  country: true,
  language: true,
  createdAt: true,
});

/**
 * How many client rows a full scan will read before it gives up on being
 * exhaustive.
 *
 * A scan is needed because `Client.phone` and `Client.address` are free text —
 * "(613) 555-0142" and "+16135550142" are one number and no SQL predicate on
 * this schema finds one from the other, and accent-folding a name needs an
 * extension this database does not have. A field-service company has hundreds
 * to a few thousand clients, so the scan is small; the cap exists so that the
 * one company that has more gets a TRUNCATED flag on the answer rather than a
 * confident "no match" computed from part of their list.
 *
 * Ordered newest-first, so the rows a truncation drops are the oldest ones —
 * the least likely to be the person who just messaged.
 */
export const CANDIDATE_SCAN_LIMIT = 5000;

// ── Normalisation ──────────────────────────────────────────────────────────

/** Lowercase, accent-folded, punctuation-to-space, collapsed. */
function fold(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Words that are not part of a person's name.
 *
 * Deliberately short. A long list starts deleting real surnames — "Mr" is an
 * honorific in English and a family name nowhere, but "Sr" is both — so this
 * holds only forms that cannot be a name on their own in the languages this
 * product ships in.
 */
const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "dr", "m", "mme", "mlle"]);

/**
 * A name reduced to a key that ignores order, case, accents and punctuation.
 *
 * "Tremblay, Marie", "marie tremblay" and "Marie Trémblay" all become
 * "marie tremblay". Order-insensitivity is the point: a Facebook profile shows
 * "Given Family" and a client record typed by an estimator very often reads
 * "Family, Given", and a matcher that treats those as two people is a matcher
 * that never fires on the surname-first half of a contractor's client list.
 *
 * Returns null for a name with nothing in it, so "no name" can never be
 * mistaken for "a name that happens to normalise to the empty string" — the
 * empty key would otherwise match every other unnamed row.
 */
export function nameKey(value) {
  const tokens = fold(value)
    .split(" ")
    .filter(Boolean)
    .filter((t) => !HONORIFICS.has(t));
  if (!tokens.length) return null;
  return tokens.slice().sort().join(" ");
}

/** The same name as tokens, in the order they were written. */
export function nameTokens(value) {
  return fold(value).split(" ").filter(Boolean).filter((t) => !HONORIFICS.has(t));
}

const CA_POSTAL = /\b([a-z]\d[a-z])[ -]?(\d[a-z]\d)\b/;
const US_ZIP = /\b(\d{5})(?:-\d{4})?\b/;

/** Unit designators, and the token after one, are not the street number. */
const UNIT_WORDS = new Set(["apt", "apartment", "unit", "suite", "ste", "bureau", "local", "no", "num"]);

/**
 * Street-type abbreviations, canonicalised so "12 Main St" and "12 Main
 * Street" are one address.
 *
 * Applied only to a token that is NOT the first word of the street name, which
 * is what keeps "St Jean" (a saint) from becoming "Street Jean" while still
 * folding the "St" in "Main St". Kept short on purpose: an aggressive synonym
 * table is how an address normaliser starts merging two real streets.
 */
const STREET_TYPES = new Map(Object.entries({
  st: "street", str: "street", rd: "road", ave: "avenue", av: "avenue",
  blvd: "boulevard", bl: "boulevard", boul: "boulevard", dr: "drive",
  cres: "crescent", crt: "court", ct: "court", pl: "place", ln: "lane",
  hwy: "highway", pkwy: "parkway", ter: "terrace", cir: "circle",
  n: "north", s: "south", e: "east", w: "west",
  nord: "north", sud: "south", est: "east", ouest: "west",
}));

/**
 * An address reduced to the three parts that identify a property: street
 * number, street name, postal code.
 *
 * Everything else — city, province, country, unit, "please use the side gate"
 * — is dropped, because those are the parts two records of the same house
 * disagree about most often. Returns null when nothing usable is left.
 */
export function addressKey(value) {
  const folded = fold(value);
  if (!folded) return null;

  // Postal first, and taken from anywhere BUT the very start of the string: a
  // five-digit house number ("12345 Main St") reads as a US ZIP otherwise, and
  // a wrong postal code is worse than no postal code because it is compared.
  let postal = null;
  const ca = CA_POSTAL.exec(folded);
  if (ca && ca.index > 0) postal = `${ca[1]}${ca[2]}`;
  if (!postal) {
    const us = US_ZIP.exec(folded);
    if (us && us.index > 0) postal = us[1];
  }

  // The street lives before the first comma in every address people type;
  // fold() has already turned that comma into a space, so the raw string is
  // consulted for the split instead.
  const beforeComma = String(value ?? "").split(",")[0];
  let street = fold(beforeComma);
  if (postal) street = street.replace(CA_POSTAL, " ").replace(US_ZIP, " ").replace(/\s+/g, " ").trim();

  const tokens = street.split(" ").filter(Boolean);
  let number = null;
  const rest = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (UNIT_WORDS.has(t)) {
      // Skip the designator and whatever it numbers: "apt 3" is not the house.
      i += 1;
      continue;
    }
    if (number === null && /^\d+[a-z]?$/.test(t)) {
      number = t;
      continue;
    }
    rest.push(t);
  }

  const name = rest
    .map((t, i) => (i > 0 && STREET_TYPES.has(t) ? STREET_TYPES.get(t) : t))
    .join(" ")
    .trim();

  if (!number && !name && !postal) return null;
  return {
    number: number || null,
    street: name || null,
    postal: postal || null,
    key: [number, name, postal].filter(Boolean).join(" "),
  };
}

/**
 * Every key one contact reduces to.
 *
 * `emailFolded` exists for one reason: importPastJob.js compared emails with
 * lib/expenses/csvImport.js's normaliseDescription, which happily compares two
 * MALFORMED addresses as text. normaliseEmail returns null for those, and a
 * null on both sides would read as "neither side has an email" — turning a
 * disagreement into an absence. So an address that will not parse keeps a
 * folded text key, which can produce a CONFLICT but never a `certain` match.
 */
export function contactKeys({ name = null, email = null, phone = null, address = null } = {}) {
  const canonicalEmail = normaliseEmail(email);
  const foldedEmail = fold(email) || null;
  const keys = {
    name: name ? String(name).trim() || null : null,
    nameKey: nameKey(name),
    nameTokens: nameTokens(name),
    email: canonicalEmail,
    emailFolded: canonicalEmail || foldedEmail,
    phone: normalisePhone(phone),
    address: addressKey(address),
  };
  keys.isEmpty = !keys.nameKey && !keys.email && !keys.emailFolded && !keys.phone && !keys.address;
  return keys;
}

/**
 * Do two addresses describe the same property?
 *
 * Three answers, and "unknown" is not "no". A client row with no address
 * cannot disagree with anything, and treating that silence as a disagreement
 * would make every address-less client unmatchable — the padding-absent-data
 * failure AGENTS.md names, wearing a different hat.
 */
export function addressAgreement(a, b) {
  if (!a || !b) return "unknown";
  if (a.postal && b.postal) {
    if (a.postal !== b.postal) return "disagree";
    if (a.number && b.number && a.number !== b.number) return "disagree";
    return "agree";
  }
  if (a.number && b.number && a.number !== b.number) return "disagree";
  if (a.street && b.street && a.street !== b.street) return "disagree";
  if (a.number && b.number && a.street && b.street) return "agree";
  return "unknown";
}

// ── Scoring ────────────────────────────────────────────────────────────────

/**
 * Points per kind of agreement.
 *
 * The numbers order candidates against each other; they do NOT decide the
 * confidence tier, which is a rule (see below). Two numbers that happened to
 * add up to 100 must never become a "certain" nobody wrote down.
 */
export const MATCH_POINTS = Object.freeze({
  email: 100,
  phone: 80,
  name: 30,
  address: 20,
  emailConflict: -60,
  phoneConflict: -25,
  addressConflict: -25,
});

/**
 * Score one candidate client against a contact's keys.
 *
 * @returns {{ score, confidence, reasons, conflicts }} — reasons and conflicts
 *   are lists of strings ("email", "phone", "name", "address"). The score is
 *   never returned on its own: a bare number cannot be shown to a human, and
 *   "why did this link?" is the question a screen has to answer.
 */
export function scoreCandidate(keys, client) {
  const theirs = contactKeys({
    name: client?.name,
    email: client?.email,
    phone: client?.phone,
    // city/province are appended after a comma, so addressKey's street split
    // still sees only the street line while a postal code typed into either
    // column is still found.
    address: [client?.address, client?.city, client?.province].filter(Boolean).join(", "),
  });

  const reasons = [];
  const conflicts = [];
  let score = 0;

  if (keys.email && theirs.email) {
    if (keys.email === theirs.email) { reasons.push("email"); score += MATCH_POINTS.email; }
    else { conflicts.push("email"); score += MATCH_POINTS.emailConflict; }
  } else if (keys.emailFolded && theirs.emailFolded && keys.emailFolded !== theirs.emailFolded) {
    // One of the two would not parse as an address. They still disagree, and a
    // disagreement is evidence — but it can never be evidence FOR a match, so
    // there is no reasons-side branch here.
    conflicts.push("email");
    score += MATCH_POINTS.emailConflict;
  }

  if (keys.phone && theirs.phone) {
    if (keys.phone === theirs.phone) { reasons.push("phone"); score += MATCH_POINTS.phone; }
    else { conflicts.push("phone"); score += MATCH_POINTS.phoneConflict; }
  }

  if (keys.nameKey && theirs.nameKey && keys.nameKey === theirs.nameKey) {
    reasons.push("name");
    score += MATCH_POINTS.name;
  }

  const addr = addressAgreement(keys.address, theirs.address);
  if (addr === "agree") { reasons.push("address"); score += MATCH_POINTS.address; }
  else if (addr === "disagree") { conflicts.push("address"); score += MATCH_POINTS.addressConflict; }

  return { score, confidence: confidenceFor(reasons, conflicts), reasons, conflicts };
}

/**
 * The rule that turns evidence into a tier. Written as one function so there
 * is exactly one place where "certain" is decided.
 */
export function confidenceFor(reasons, conflicts = []) {
  const has = (r) => reasons.includes(r);
  // An identifier the person had to know. A conflicting email alongside it is
  // recorded but does not demote: two people at one household share a landline
  // and have different addresses, and that is still the right household.
  if (has("email") || has("phone")) return "certain";

  if (has("name")) {
    // Any conflict at all pulls a name-based match down to "possible", which
    // never auto-links. This is importPastJob's original rule generalised: two
    // records that carry the same name and different emails are two people
    // until a human says otherwise.
    if (conflicts.length) return "possible";
    return has("address") ? "likely" : "possible";
  }
  return "none";
}

/** Is `confidence` at least as strong as `floor`? */
export function meetsConfidence(confidence, floor) {
  const a = CONTACT_CONFIDENCE.indexOf(confidence);
  const b = CONTACT_CONFIDENCE.indexOf(floor);
  if (a === -1 || b === -1) return false;
  return a <= b;
}

// ── The decision ───────────────────────────────────────────────────────────

const EMPTY = (why) => ({
  client: null,
  clientId: null,
  confidence: "none",
  reasons: [],
  conflicts: [],
  alternatives: [],
  ambiguous: false,
  considered: 0,
  why,
});

/**
 * Decide, from rows already read. Pure.
 *
 * @param clients   Client rows selected with CLIENT_MATCH_SELECT.
 * @param companyId the tenant this answer is for. Every row is re-checked
 *                  against it here even though the query already filtered —
 *                  the same deliberate belt-and-braces as non-negotiable #2's
 *                  two impersonation gates. A row whose companyId is absent
 *                  THROWS rather than being dropped: a matcher that silently
 *                  finds nothing because the select was wrong is the exact
 *                  "control that appears to work" this repo keeps deleting.
 * @param contact   { name, email, phone, address }
 * @param minConfidence  the floor at which `client` is populated. Default
 *                  "likely" — name alone is returned as a candidate and never
 *                  as an answer.
 * @param onTie     "refuse" (default) leaves `client` null when two candidates
 *                  score identically. "oldest" picks the longest-standing of
 *                  them, and exists for ONE caller: the past-jobs importer,
 *                  whose alternative is creating a duplicate client row.
 * @param requireNameAgreement  drop any candidate whose name does not agree,
 *                  however well its email matches. Also for the importer,
 *                  which has always been a name-first match.
 */
export function matchContactAgainst({
  clients = [],
  companyId,
  contact = {},
  minConfidence = "likely",
  onTie = "refuse",
  requireNameAgreement = false,
} = {}) {
  if (!companyId) throw new Error("matchContactAgainst: companyId is required — a match is always tenant-scoped");

  const keys = contactKeys(contact);
  if (keys.isEmpty) {
    return { ...EMPTY("The conversation carries no name, email, phone or address, so there is nothing to match on."), keys };
  }

  const rows = [];
  for (const c of clients || []) {
    if (!c || !c.id) continue;
    if (!("companyId" in c)) {
      throw new Error("matchContactAgainst: a candidate row has no companyId — select CLIENT_MATCH_SELECT so tenancy can be proved");
    }
    // Another company's client is dropped here even if the query returned it.
    if (c.companyId !== companyId) continue;
    rows.push(c);
  }

  const scored = rows
    .map((client) => ({ client, ...scoreCandidate(keys, client) }))
    .filter((s) => s.confidence !== "none")
    .filter((s) => !requireNameAgreement || s.reasons.includes("name"))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Oldest first among equals: the longest-standing row is the one with
      // history hanging off it. Deterministic, which the old importer query —
      // an unordered findMany — was not.
      const at = new Date(a.client.createdAt || 0).getTime();
      const bt = new Date(b.client.createdAt || 0).getTime();
      if (at !== bt) return at - bt;
      return String(a.client.id).localeCompare(String(b.client.id));
    });

  if (!scored.length) {
    return { ...EMPTY("Nobody on file agrees with this contact on a name, an email, a phone number or an address."), keys, considered: rows.length };
  }

  const best = scored[0];
  const tied = scored.filter((s) => s.score === best.score);
  const ambiguous = tied.length > 1;

  const alternatives = scored.slice(1, 6).map((s) => ({
    id: s.client.id,
    name: s.client.name || null,
    confidence: s.confidence,
    reasons: s.reasons,
    conflicts: s.conflicts,
    score: s.score,
    tied: s.score === best.score,
  }));

  const meets = meetsConfidence(best.confidence, minConfidence);
  const refuseTie = ambiguous && onTie !== "oldest";
  const client = meets && !refuseTie ? best.client : null;

  let why;
  if (refuseTie) {
    why = `${tied.length} clients match this contact equally well (${best.reasons.join(" + ") || "no agreement"}). Picking one would attach this conversation to the wrong homeowner with no way to notice afterwards, so somebody has to choose.`;
  } else if (!meets) {
    why = `The best candidate is a ${best.confidence} match on ${best.reasons.join(" + ")}, which is below the ${minConfidence} this caller requires. It is offered as a candidate, not as an answer.`;
  } else {
    why = `${best.client.name || "A client"} matches on ${best.reasons.join(" + ")}${best.conflicts.length ? ` (but their ${best.conflicts.join(" and ")} differ${best.conflicts.length > 1 ? "" : "s"})` : ""}.`;
  }

  return {
    client,
    clientId: client ? client.id : null,
    // The confidence describes the EVIDENCE, not whether the caller's floor
    // was met — a screen showing "possible: same name" needs the tier even
    // though `client` is null.
    confidence: best.confidence,
    reasons: best.reasons,
    conflicts: best.conflicts,
    alternatives,
    ambiguous,
    considered: rows.length,
    keys,
    why,
  };
}

/**
 * Read the candidates, then decide.
 *
 * Two lookup shapes, and the caller says which:
 *
 *   "scan" (default) reads the company's clients (newest first, capped at
 *   CANDIDATE_SCAN_LIMIT) and matches in JS. It is the only shape that can
 *   match a phone written differently from how it was stored, or a name whose
 *   accents differ, because neither is expressible as a predicate on this
 *   schema.
 *
 *   "exact-name" issues exactly the query lib/jobs/importPastJob.js has always
 *   issued — one case-insensitive equality on `name`. It exists so that the
 *   past-jobs importer, which calls this once PER ROW of a 300-row CSV, keeps
 *   its narrow indexed lookup instead of scanning the client table 300 times.
 *
 * @param db  a Prisma client or a transaction client. Passed in rather than
 *            imported, the same convention lib/sales/suppression.js uses, so
 *            the importer's writes and this read share one transaction.
 */
export async function matchContact(db, companyId, contact = {}, options = {}) {
  if (!companyId) throw new Error("matchContact: companyId is required — a match is always tenant-scoped");
  const { lookup = "scan", limit = CANDIDATE_SCAN_LIMIT, ...decide } = options;

  const keys = contactKeys(contact);
  if (keys.isEmpty) {
    return { ...EMPTY("The conversation carries no name, email, phone or address, so there is nothing to match on."), keys, lookup, scanned: 0, truncated: false };
  }

  let rows = [];
  let truncated = false;

  if (lookup === "exact-name") {
    if (!keys.name) {
      return { ...EMPTY("No name was given, and this lookup matches on name."), keys, lookup, scanned: 0, truncated: false };
    }
    rows = await db.client.findMany({
      where: { companyId, name: { equals: keys.name, mode: "insensitive" } },
      select: { ...CLIENT_MATCH_SELECT },
    });
  } else {
    const read = await db.client.findMany({
      where: { companyId },
      select: { ...CLIENT_MATCH_SELECT },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    truncated = Array.isArray(read) && read.length > limit;
    rows = truncated ? read.slice(0, limit) : read;
  }

  const result = matchContactAgainst({ clients: rows, companyId, contact, ...decide });
  return {
    ...result,
    lookup,
    scanned: rows.length,
    // Said out loud rather than hidden: on a truncated scan a "no match" means
    // "not among the newest N", which is a different sentence.
    truncated,
    why: truncated && !result.client
      ? `${result.why} Only the ${rows.length} most recent clients were checked, so this is not a complete answer.`
      : result.why,
  };
}
