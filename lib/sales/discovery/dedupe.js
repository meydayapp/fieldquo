// lib/sales/discovery/dedupe.js
//
// Have we already got this business?
//
// ══ The order, and why it is the order ═════════════════════════════════════
//
// Prospect's schema comment states it: "Deterministic identifiers first, fuzzy
// matching only after. A Place ID is proof; a similar company name two streets
// apart is a question." This file is that sentence as code, and the ORDER is
// the whole design — a fuzzy match that ran first would merge two branches of
// the same franchise, and their two phone numbers would then disagree with the
// one row that survived.
//
//   1. Same provider, same record id  → THE SAME RECORD. Update it in place.
//   2. Same normalised E.164 phone    → almost certainly the same business.
//   3. Same registrable domain        → likewise.
//   4. Same normalised name in the same locality → a QUESTION.
//
// ══ Only step 1 removes anything ═══════════════════════════════════════════
//
// Steps 2–4 FLAG. `possibleDuplicateOfId` exists for that and its schema
// comment says why: "Merging destroys provenance, and a wrong merge is
// unrecoverable." Two rows that turn out to be one can be merged by a human
// later; one row that turns out to be two cannot be unmerged, because the
// evidence of the second was thrown away at ingest.
//
// This is also why the campaign funnel has two different lines. "Duplicates
// removed" counts step 1 — the same source record seen twice in one run, which
// is genuinely one thing. "Possible duplicates" counts steps 2–4, which are
// rows that exist, are workable, and carry a flag.
//
// ══ Why a phone match is not treated as proof ══════════════════════════════
//
// It is nearly proof, and the measurement says so: 10,889 Ontario rows with a
// phone resolve to 10,522 distinct numbers, 3.4% duplication. But a shared
// number is also what an answering service, a franchise head office and a
// husband-and-wife pair of businesses look like. So it flags.
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";

/** Words that carry no identity, dropped before a name is compared. */
const NOISE_WORDS = new Set([
  "inc", "incorporated", "llc", "llp", "ltd", "limited", "corp", "corporation",
  "co", "company", "the", "and", "of", "enterprises", "group", "services",
  "service", "sons", "son", "bros", "brothers",
]);

/**
 * A business name reduced to the words that identify it.
 *
 * "Acme Painting Inc." and "The Acme Painting Company" both become "acme
 * painting". Sorted, so word order does not make two spellings of one business
 * look like two businesses.
 *
 * Returns null when nothing identifying survives — "The Company Ltd" reduces
 * to nothing, and a null key must never match another null key, which is what
 * an empty string would do.
 */
export function nameKey(value) {
  const words = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !NOISE_WORDS.has(w));
  if (!words.length) return null;
  return [...new Set(words)].sort().join(" ");
}

/**
 * The fuzzy key: identity words plus where the business is.
 *
 * The locality is REQUIRED, not optional. "Superior Painting" in Ottawa and
 * "Superior Painting" in Buffalo are two companies, and a name-only key would
 * flag every one of the hundreds of "ABC Plumbing"s in eastern North America
 * as a duplicate of the first one ingested — which turns the flag into noise
 * and gets it ignored.
 */
export function fuzzyKey(prospect) {
  const name = nameKey(prospect?.businessName);
  const city = String(prospect?.city ?? "").trim().toLowerCase();
  if (!name || !city) return null;
  return `${name}|${city}`;
}

/**
 * Every deterministic key this candidate can be looked up by, strongest first.
 *
 * The strength order matters because `matchExisting` stops at the first hit —
 * a candidate matching a record id AND a phone is the same record, not a
 * possible duplicate of itself.
 */
export function dedupeKeys(prospect) {
  const keys = [];
  if (prospect?.sourceProvider && prospect?.sourceRecordId) {
    keys.push({ kind: "source_record", value: `${prospect.sourceProvider}:${prospect.sourceRecordId}` });
  }
  const phone = normalisePhone(prospect?.phoneE164);
  if (phone) keys.push({ kind: "phone", value: phone });
  const domain = normaliseDomain(prospect?.domain);
  if (domain) keys.push({ kind: "domain", value: domain });
  const fuzzy = fuzzyKey(prospect);
  if (fuzzy) keys.push({ kind: "name_locality", value: fuzzy });
  return keys;
}

/**
 * An index over already-loaded rows, so matching is pure.
 *
 * The db wrapper loads the candidates a batch could collide with and hands
 * them here; nothing in this file queries. That is what lets the check drive
 * the real matching logic against hostile input with no database.
 *
 * @param {Array<{id:string, sourceProvider?:string, sourceRecordId?:string,
 *                phoneE164?:string, domain?:string, businessName?:string,
 *                city?:string}>} rows
 */
export function buildDedupeIndex(rows = []) {
  const bySourceRecord = new Map();
  const byPhone = new Map();
  const byDomain = new Map();
  const byFuzzy = new Map();

  const remember = (map, key, row) => {
    if (!key) return;
    // FIRST wins. The oldest row is the one everything else should point at,
    // and the caller loads in creation order — so a chain of three rows all
    // flag the same original rather than forming a linked list nobody can
    // follow.
    if (!map.has(key)) map.set(key, row);
  };

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.id) continue;
    if (row.sourceProvider && row.sourceRecordId) {
      remember(bySourceRecord, `${row.sourceProvider}:${row.sourceRecordId}`, row);
    }
    remember(byPhone, normalisePhone(row.phoneE164), row);
    remember(byDomain, normaliseDomain(row.domain), row);
    remember(byFuzzy, fuzzyKey(row), row);
  }

  return {
    bySourceRecord,
    byPhone,
    byDomain,
    byFuzzy,
    /** Add a row written during this run, so a batch dedupes against itself. */
    add(row) {
      if (!row?.id) return;
      if (row.sourceProvider && row.sourceRecordId) {
        remember(bySourceRecord, `${row.sourceProvider}:${row.sourceRecordId}`, row);
      }
      remember(byPhone, normalisePhone(row.phoneE164), row);
      remember(byDomain, normaliseDomain(row.domain), row);
      remember(byFuzzy, fuzzyKey(row), row);
    },
    size() {
      return bySourceRecord.size + byPhone.size + byDomain.size + byFuzzy.size;
    },
  };
}

/**
 * What to do with this candidate.
 *
 * @returns {{ action: "insert"|"update"|"flag", matchedId: string|null,
 *             via: string|null }}
 *
 *   insert  nothing matched — a new prospect.
 *   update  the same provider record we already hold. The row is refreshed in
 *           place; it is not a new prospect and it is not a duplicate, and
 *           counting it as either would make a re-run of the same campaign
 *           look like it found the whole city again.
 *   flag    a DIFFERENT record that may be the same business. Written, and
 *           written with possibleDuplicateOfId set.
 */
export function matchExisting(prospect, index) {
  if (!index) return { action: "insert", matchedId: null, via: null };

  const source =
    prospect?.sourceProvider && prospect?.sourceRecordId
      ? index.bySourceRecord.get(`${prospect.sourceProvider}:${prospect.sourceRecordId}`)
      : null;
  if (source) return { action: "update", matchedId: source.id, via: "source_record" };

  const phone = normalisePhone(prospect?.phoneE164);
  const byPhone = phone ? index.byPhone.get(phone) : null;
  if (byPhone) return { action: "flag", matchedId: byPhone.id, via: "phone" };

  const domain = normaliseDomain(prospect?.domain);
  const byDomain = domain ? index.byDomain.get(domain) : null;
  if (byDomain) return { action: "flag", matchedId: byDomain.id, via: "domain" };

  const fuzzy = fuzzyKey(prospect);
  const byFuzzy = fuzzy ? index.byFuzzy.get(fuzzy) : null;
  if (byFuzzy) return { action: "flag", matchedId: byFuzzy.id, via: "name_locality" };

  return { action: "insert", matchedId: null, via: null };
}

/** The sentence the review screen shows next to a flagged row. */
export function duplicateReason(via) {
  if (via === "phone") return "Another prospect has the same phone number.";
  if (via === "domain") return "Another prospect has the same website domain.";
  if (via === "name_locality") return "Another prospect has the same name in the same town.";
  return "Flagged as a possible duplicate.";
}
