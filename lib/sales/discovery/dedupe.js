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
// ══ Steps 2 and 3 also FILL — since 2026-09-14 ═════════════════════════════
//
// The flag alone left the rep with half a business: the row they hold has
// the licence and the trade, the row that was flagged against it has the
// website and the phone, and nothing carried one to the other. So on the two
// near-proof matches — same phone, same domain — ingest now also copies the
// NEW record's fields into the EXISTING row's EMPTY fields (never over a
// value), records each fill on the existing row's `mergedFrom` as
// `kind: "autofill"`, and STILL writes the new row flagged exactly as
// before. Nothing is retired, nothing is deleted, and the new row keeps its
// own provenance whole; the field logic is mergeProspects.js's planFills, the
// same one a human merge uses. Step 4, the name-in-locality match, stays a
// question and fills nothing: it is wrong 52.5% of the time it fires.
//
// ══ A retired row resolves to its survivor ═════════════════════════════════
//
// A human merge (mergeProspects.js) retires a row with `mergedIntoId`. When
// ingest re-sees THAT row's source record, or a record matching its phone,
// the answer is the survivor — an update goes to the survivor as a fill-only
// refresh (never a resurrection of the retired row, and never an overwrite
// of the survivor's own fields), and a flag points at the survivor. The
// index follows the pointer; the candidate loader brings the survivor along.
//
// ══ Why a phone match is not treated as proof ══════════════════════════════
//
// It is nearly proof, and the measurement says so: 10,889 Ontario rows with a
// phone resolve to 10,522 distinct numbers, 3.4% duplication. But a shared
// number is also what an answering service, a franchise head office and a
// husband-and-wife pair of businesses look like. So it flags.
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";

/**
 * Accents folded to their base letters, lowercased.
 *
 * Everything downstream filters on `[^a-z0-9]`, so this has to run FIRST. It
 * used to run only inside `nameKey`, and the city half of the fuzzy key was
 * left raw — see `cityKey`.
 */
const fold = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Words that carry no identity, dropped before a name is compared.
 *
 * The French half is not a courtesy. RBQ is the largest bank in this system —
 * 54,264 Quebec businesses — and its names are French, so "Les Entreprises de
 * Rénovation Lévis Ltée" and "Rénovations Lévis Inc." are one company that the
 * English-only list scored as two. Each French entry is the direct counterpart
 * of an English one already here: ltee/enr/cie are the legal suffixes, le/la/
 * les are "the", et is "and", de/du/des/d are "of", l' and d' are the elided
 * articles the apostrophe leaves behind as bare letters.
 */
const NOISE_WORDS = new Set([
  "inc", "incorporated", "llc", "llp", "ltd", "limited", "corp", "corporation",
  "co", "company", "the", "and", "of", "enterprises", "group", "services",
  "service", "sons", "son", "bros", "brothers",
  // French
  "ltee", "limitee", "enr", "enregistree", "cie", "compagnie",
  "le", "la", "les", "l", "et", "de", "du", "des", "d",
  "entreprise", "entreprises", "groupe", "freres", "frere", "fils",
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
  const words = fold(String(value ?? "").replace(/<[^>]*>/g, " "))
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !NOISE_WORDS.has(w));
  if (!words.length) return null;
  return [...new Set(words)].sort().join(" ");
}

/**
 * A locality reduced to something two spellings of it can share.
 *
 * This did NOT exist and the city was compared raw and lowercased, which meant
 * the accent fix in `nameKey` only half worked: "Québec" and "Quebec" produced
 * one name key and then two different fuzzy keys, so the pair still never met.
 * Every Quebec locality with an accent — Québec, Montréal, Trois-Rivières,
 * Sept-Îles — was in that state.
 *
 * Saint is expanded because the register and the map data disagree about it
 * constantly: RBQ writes "St-Jérôme", Overture writes "Saint-Jerome". They are
 * the same town.
 *
 * Word order is KEPT, unlike a name. "Saint-Jean-sur-Richelieu" is a sequence;
 * sorting it would collide places that merely share words.
 */
export function cityKey(value) {
  const words = fold(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w === "st" ? "saint" : w === "ste" ? "sainte" : w));
  if (!words.length) return null;
  return words.join(" ");
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
  const city = cityKey(prospect?.city);
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
  const byId = new Map();

  const remember = (map, key, row) => {
    if (!key) return;
    // FIRST wins. The oldest row is the one everything else should point at,
    // and the caller loads in creation order — so a chain of three rows all
    // flag the same original rather than forming a linked list nobody can
    // follow.
    if (!map.has(key)) map.set(key, row);
  };

  const index = (row) => {
    if (!row?.id) return;
    byId.set(row.id, row);
    if (row.sourceProvider && row.sourceRecordId) {
      remember(bySourceRecord, `${row.sourceProvider}:${row.sourceRecordId}`, row);
    }
    // A RETIRED row's keys are remembered too — a phone the survivor did not
    // take (it had its own) would otherwise let a third copy in — and every
    // hit resolves through `resolve()` below to the row that is live.
    remember(byPhone, normalisePhone(row.phoneE164), row);
    remember(byDomain, normaliseDomain(row.domain), row);
    remember(byFuzzy, fuzzyKey(row), row);
  };
  for (const row of Array.isArray(rows) ? rows : []) index(row);

  return {
    bySourceRecord,
    byPhone,
    byDomain,
    byFuzzy,
    byId,
    /** Add a row written during this run, so a batch dedupes against itself. */
    add: index,
    /**
     * The live row behind `row`: itself, or — for a retired row — the survivor
     * it was merged into, following the pointer at most a few hops. Returns
     * `{ row, throughRetiredId }`; when the survivor was not loaded, a stub
     * carrying only its id, so the match still lands on the right row.
     */
    resolve(row) {
      let cur = row;
      let through = null;
      for (let hop = 0; cur?.mergedIntoId && hop < 5; hop++) {
        through = through || cur.id;
        cur = byId.get(cur.mergedIntoId) || { id: cur.mergedIntoId, stub: true };
      }
      return { row: cur, throughRetiredId: through };
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
 *             via: string|null, matched: object|null, fillOnly: boolean,
 *             throughRetiredId: string|null }}
 *
 *   insert  nothing matched — a new prospect.
 *   update  the same provider record we already hold. The row is refreshed in
 *           place; it is not a new prospect and it is not a duplicate, and
 *           counting it as either would make a re-run of the same campaign
 *           look like it found the whole city again.
 *           `fillOnly: true` when that record's row was RETIRED by a merge:
 *           `matchedId` is then the SURVIVOR, and the refresh may only fill
 *           the survivor's empty fields — its own values came from its own
 *           source and are not this record's to overwrite.
 *   flag    a DIFFERENT record that may be the same business. Written, and
 *           written with possibleDuplicateOfId set. `matched` is the existing
 *           row, so the ingest can plan the step-2/3 autofill from it.
 */
export function matchExisting(prospect, index) {
  const none = { action: "insert", matchedId: null, via: null, matched: null, fillOnly: false, throughRetiredId: null };
  if (!index) return none;
  const resolve = (row) => (typeof index.resolve === "function" ? index.resolve(row) : { row, throughRetiredId: null });

  const source =
    prospect?.sourceProvider && prospect?.sourceRecordId
      ? index.bySourceRecord.get(`${prospect.sourceProvider}:${prospect.sourceRecordId}`)
      : null;
  if (source) {
    const { row, throughRetiredId } = resolve(source);
    return { action: "update", matchedId: row.id, via: "source_record", matched: row, fillOnly: Boolean(throughRetiredId), throughRetiredId };
  }

  const flag = (hit, via) => {
    const { row, throughRetiredId } = resolve(hit);
    return { action: "flag", matchedId: row.id, via, matched: row, fillOnly: false, throughRetiredId };
  };

  const phone = normalisePhone(prospect?.phoneE164);
  const byPhone = phone ? index.byPhone.get(phone) : null;
  if (byPhone) return flag(byPhone, "phone");

  const domain = normaliseDomain(prospect?.domain);
  const byDomain = domain ? index.byDomain.get(domain) : null;
  if (byDomain) return flag(byDomain, "domain");

  const fuzzy = fuzzyKey(prospect);
  const byFuzzy = fuzzy ? index.byFuzzy.get(fuzzy) : null;
  if (byFuzzy) return flag(byFuzzy, "name_locality");

  return none;
}

/** The matches that fill at ingest: dedupe's steps 2 and 3, never the name. */
export const AUTOFILL_VIAS = Object.freeze(["phone", "domain"]);

/** The sentence the review screen shows next to a flagged row. */
export function duplicateReason(via) {
  if (via === "phone") return "Another prospect has the same phone number.";
  if (via === "domain") return "Another prospect has the same website domain.";
  if (via === "name_locality") return "Another prospect has the same name in the same town.";
  return "Flagged as a possible duplicate.";
}
