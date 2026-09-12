// lib/sales/leadLanguage.js
//
// Which language a prospect has to be sold in, and whether a given rep can
// take them.
//
// ══ The owner's rule, verbatim ════════════════════════════════════════════
//
// "the leads from quebec will be most likely french speakers so they can't be
// handed out to anybody unless they have a French profile in their settings.
// so that we know who can get the quebec leads"
//
// One rule, four places a lead changes hands, and every one of them has to
// ask the SAME question — so the question lives here, pure, and each of them
// imports it rather than deciding for itself:
//
//   · claimCandidateWhere() in lib/sales/prospectView.js merges
//     languageWhereFor(rep) into the WHERE of every single and batch claim.
//     The database refuses the row; nothing in JS filters after the fact.
//   · lib/sales/queueBatch.js counts what that WHERE kept back
//     (skippedForLanguage) so the screen can say "N Quebec leads not offered".
//   · lib/sales/reassign.js's planReassign() refuses a Move whose target
//     cannot take a row the source holds.
//   · lib/sales/calls/inboundDistribution.js's ringPlan() rings only reps
//     with French when the caller is in Quebec.
//
// ══ Why the province and not the country, and why QC alone ═══════════════
//
// Canada is bilingual on paper; Quebec is francophone in practice. A Prospect
// row's `province` is the only fact on the row that says where the phone
// rings — Prospect.language does not exist and inventing one from a postal
// code would be AGENTS.md failure class #5 — so the rule keys on it. New
// Brunswick is officially bilingual and gets no requirement: an anglophone
// rep ringing Moncton is the ordinary case, and refusing NB to every rep
// without French would starve the pool over a coin-flip. If the data ever
// says otherwise, add it here, in one place.
//
// ══ Empty `sellsIn` means English only ════════════════════════════════════
//
// SalesRep.sellsIn defaults to []. For allocation that reads as "English
// only", which is the safe direction: a rep who never said they speak French
// is not handed a francophone contractor. The screen treats [] as UNSET and
// asks, so the safe reading never silently becomes the permanent one.
//
// ══ Pure ══════════════════════════════════════════════════════════════════
//
// No database, no React, no next/*. Its one import is a constant list —
// app/i18n/languages.js — so scripts/check-lead-language.mjs can execute
// every function here against fixtures, and so the client-side chip on the
// queue card and the lead page can import it without dragging a server
// module into the browser bundle.

import { LANGUAGE_CODES } from "@/app/i18n/languages";

/** The one language code this file ever requires. */
export const FRENCH = "fr";
export const ENGLISH = "en";

/**
 * New Brunswick, the one bilingual province: no requirement either way, so
 * both an anglophone and a francophone rep may take it. Same spelling logic
 * as Quebec's list below.
 */
export const NEW_BRUNSWICK_SPELLINGS = Object.freeze([
  "NB",
  "nb",
  "Nb",
  "CA-NB",
  "ca-nb",
  "New Brunswick",
  "NEW BRUNSWICK",
  "new brunswick",
  "Nouveau-Brunswick",
  "nouveau-brunswick",
]);

/**
 * Every spelling of Quebec a Prospect.province may carry.
 *
 * Measured on 2026-09-11: 67,689 rows, every one of them "QC" — Overture and
 * RBQ both write the ISO code, and lib/sales/callingRules.js's
 * normaliseSubdivision folds the French forms to it on the way in. The
 * spelled-out forms are here because a row typed by hand (a rep correcting a
 * lead's place, a CSV import) is not normalised on the way in, and a rule
 * that quietly missed "Québec" would hand a francophone contractor to an
 * anglophone rep over an accent. Uppercase and lowercase both, because the
 * Prisma `in` is case-sensitive and the alternative — a `mode: "insensitive"`
 * on every claim query — is a sequential scan of a 250,000-row table.
 */
export const QUEBEC_PROVINCE_SPELLINGS = Object.freeze([
  "QC",
  "qc",
  "Qc",
  "CA-QC",
  "ca-qc",
  "PQ",
  "pq",
  "Quebec",
  "QUEBEC",
  "quebec",
  "Québec",
  "QUÉBEC",
  "québec",
]);

/** Accents folded, whitespace trimmed, uppercased — the same fold callingRules uses. */
function fold(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    // Escaped, not literal: callingRules.js gives the reason — a literal
    // combining mark is invisible in a diff.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const QUEBEC_FOLDED = new Set(QUEBEC_PROVINCE_SPELLINGS.map(fold));

/**
 * Quebec's geographic NANP area codes.
 *
 * lib/voice/nanp.js has the Canadian list and no per-province split, so the
 * split lives here beside the only rule that needs it. The eight in service
 * for decades — 418 and 581 (Quebec City and the east), 514 and 438
 * (Montreal island), 450 and 579 (the ring around it), 819 and 873 (the
 * west and north) — plus the three overlays the CRTC added on top of those
 * pairs: 263 over 819/873, 354 over 450/579, 468 over 418/581. All eleven
 * are in nanp.js's CANADIAN_AREA_CODES; scripts/check-lead-language.mjs
 * asserts that so the two tables cannot drift.
 *
 * An area code is where a number was ISSUED, not where its owner stands
 * today — a Montrealer who moved to Ottawa keeps 514 — so this is a strong
 * hint for an inbound caller with no matched row, not a fact about the row.
 * requiredLanguageFor() reads the province; this list is only for the call
 * that arrives before anybody has looked the caller up.
 */
export const QUEBEC_AREA_CODES = Object.freeze([
  "263", "354", "418", "438", "450", "468", "514", "579", "581", "819", "873",
]);

const QUEBEC_AREA = new Set(QUEBEC_AREA_CODES);

/**
 * Whether a province value names Quebec, in any spelling this file knows.
 *
 * Case- and accent-insensitive on the way in, so a check can hand it
 * "québec" and get the same answer the database's `in` list gives "Québec".
 */
export function isQuebec(province) {
  const p = fold(province);
  if (!p) return false;
  if (QUEBEC_FOLDED.has(p)) return true;
  // "CA QC" after folding, from "CA-QC".
  return p === "CA QC";
}

/**
 * The language a prospect has to be sold in, or null when there is no rule.
 *
 * "fr" for Quebec. Null for everywhere else — INCLUDING New Brunswick (see
 * the header) and including a row with no province at all: absence of a
 * province is not a statement about language, and a null here means "any
 * rep", which is what an unknown location has always meant.
 */
export function requiredLanguageFor(prospect) {
  if (!prospect || typeof prospect !== "object") return null;
  if (isQuebec(prospect.province)) return FRENCH;
  // ── The other direction, asked by the owner on 2026-09-12 ────────────────
  //
  // "can you confirm that someone who sets their sales language to French
  // only will only receive leads from Quebec?" — it could not, because the
  // rule only said who may take QUEBEC. Now everywhere that is not Quebec
  // is sold in English: an Ontario roofer or a Texas electrician is an
  // English call, and a rep who did not say they sell in English is not
  // handed one. New Brunswick stays bilingual (either language may take it),
  // and a row with no province at all is still "any rep" — an unknown place
  // is not a statement about language.
  const province = typeof prospect.province === "string" ? prospect.province.trim() : "";
  if (!province) return null;
  if (NEW_BRUNSWICK_SPELLINGS.includes(province)) return null;
  return ENGLISH;
}

/**
 * The languages a rep is treated as selling in. An empty list reads as
 * English only — the safe default the header describes — so that a rep who
 * never answered still receives the ordinary English pool and never a
 * Quebec row.
 */
export function effectiveSellsIn(rep) {
  const list = sellsInOf(rep);
  return list.length ? list : [ENGLISH];
}

/** Whether this rep sells in English, by their list or by the default. */
export function repSellsEnglish(rep) {
  return effectiveSellsIn(rep).includes(ENGLISH);
}

/**
 * The languages a rep sells in, as a clean list of supported codes.
 *
 * Anything that is not a supported code is dropped rather than kept: a code
 * removed from app/i18n/languages.js after a rep chose it should not keep
 * qualifying them for a rule about a language the product no longer knows.
 * Duplicates collapse; case is folded; non-arrays are [].
 */
export function sellsInOf(rep) {
  const raw = rep && typeof rep === "object" ? rep.sellsIn : null;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const code = v.trim().toLowerCase();
    if (!code || !LANGUAGE_CODES.includes(code) || out.includes(code)) continue;
    out.push(code);
  }
  return out;
}

/** Whether this rep has said they can sell in French. */
export function repSellsFrench(rep) {
  return sellsInOf(rep).includes(FRENCH);
}

/**
 * May this rep be handed this prospect, as far as language goes?
 *
 * True when the prospect has no requirement, or when the rep's list carries
 * it. Everything else — including a rep with an empty list — is false.
 */
export function repCanTake(rep, prospect) {
  const need = requiredLanguageFor(prospect);
  if (!need) return true;
  return effectiveSellsIn(rep).includes(need);
}

/**
 * The Prisma `where` fragment that keeps rows this rep cannot take out of
 * a claim.
 *
 * A rep with French gets `{}` — no restriction, and spreading `{}` into a
 * WHERE changes nothing. A rep without gets the Quebec spellings excluded.
 *
 * ── The shape, measured rather than assumed ───────────────────────────────
 *
 * Both `province: { notIn }` and `NOT: { province: { in } }` compile to a
 * bare `NOT IN` / `NOT (... IN ...)` in Postgres (printed from Prisma 7's
 * query log on 2026-09-11), and both are NULL — therefore false — for a row
 * whose province is NULL. A row with no province would vanish from every
 * anglophone rep's queue, while requiredLanguageFor() says such a row has no
 * requirement. So the fragment says the NULL case out loud: province IS NULL
 * OR province NOT IN (...). It is wrapped in an `AND` of one because
 * claimCandidateWhere() already owns the top-level `OR` (the lease clause),
 * and two `OR` keys in one object literal is one `OR` key.
 */
export function languageWhereFor(rep) {
  const fr = repSellsFrench(rep);
  const en = repSellsEnglish(rep);
  if (fr && en) return {};
  // Rows any rep may take, whatever they sell in: no province, or bilingual
  // New Brunswick. Said with IS NULL out loud for the reason above.
  const open = [{ province: null }, { province: { in: [...NEW_BRUNSWICK_SPELLINGS] } }];
  if (en) {
    // English only — everything but Quebec (the shape measured above).
    return {
      AND: [{ OR: [{ province: null }, { province: { notIn: [...QUEBEC_PROVINCE_SPELLINGS] } }] }],
    };
  }
  if (fr) {
    // French only — Quebec, plus what is open to everyone.
    return { AND: [{ OR: [...open, { province: { in: [...QUEBEC_PROVINCE_SPELLINGS] } }] }] };
  }
  // Neither English nor French (say, Spanish alone): only what is open to
  // everyone. The screen tells such a rep to add English or French.
  return { AND: [{ OR: open }] };
}

/**
 * The complement of languageWhereFor(): the rows the rule KEPT BACK from
 * this rep, or null when it kept back nothing.
 *
 * The batch claim counts these so a rep reading "claimed 12" beside a
 * trade with 900 in the pool is told why the other 888 were not offered.
 */
export function languageExcludedWhereFor(rep) {
  const fr = repSellsFrench(rep);
  const en = repSellsEnglish(rep);
  if (fr && en) return null;
  if (en) return { province: { in: [...QUEBEC_PROVINCE_SPELLINGS] } };
  // A row with a province that is neither Quebec nor New Brunswick is an
  // English row; a French-only rep is kept from it. (A rep with neither
  // language is kept from Quebec too.)
  const keptOut = fr ? [...NEW_BRUNSWICK_SPELLINGS, ...QUEBEC_PROVINCE_SPELLINGS] : [...NEW_BRUNSWICK_SPELLINGS];
  return { AND: [{ province: { not: null } }, { province: { notIn: keptOut } }] };
}

/** New Brunswick's one area code, bilingual: neither rule applies. */
export const NEW_BRUNSWICK_AREA = new Set(["506"]);

/**
 * Whether an inbound caller's number is a Quebec area code.
 *
 * Accepts E.164 ("+15145551234"), a bare eleven-digit NANP number
 * ("15145551234") or ten digits ("5145551234"). Anything else — a
 * non-NANP number, a short code, garbage — is false: a number this file
 * cannot read is not a reason to ring fewer people.
 */
export function inboundNeedsFrench(e164) {
  if (typeof e164 !== "string") return false;
  const digits = e164.replace(/\D/g, "");
  let national = null;
  if (digits.length === 11 && digits.startsWith("1")) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  if (!national) return false;
  return QUEBEC_AREA.has(national.slice(0, 3));
}

/**
 * Whether an inbound caller's number is an ENGLISH call: a readable NANP
 * number whose area code is not Quebec's and not New Brunswick's (506 — the
 * one bilingual province, open to either language). Unreadable → false, for
 * the same reason as inboundNeedsFrench: a number this file cannot read is
 * not a reason to ring fewer people.
 */
export function inboundNeedsEnglish(e164) {
  if (typeof e164 !== "string") return false;
  const digits = e164.replace(/\D/g, "");
  let national = null;
  if (digits.length === 11 && digits.startsWith("1")) national = digits.slice(1);
  else if (digits.length === 10) national = digits;
  if (!national) return false;
  const area = national.slice(0, 3);
  if (QUEBEC_AREA.has(area) || NEW_BRUNSWICK_AREA.has(area)) return false;
  return true;
}

/**
 * Validate what a picker posted as a rep's languages.
 *
 * @returns `{ ok: true, sellsIn }` — a de-duplicated list of supported codes,
 *          possibly empty — or `{ ok: false, error }`.
 *
 * An empty list is ACCEPTED: it is the "unset" state the screen asks about,
 * and a rep who ticked French by mistake needs a way back. A non-array, or an
 * array carrying a code the product does not know, is refused rather than
 * silently trimmed — a rep who typed "fr-CA" into a hand-crafted request
 * should hear that it was not understood, not find "fr" missing later.
 */
export function parseSellsIn(body) {
  if (!body || typeof body !== "object" || !("sellsIn" in body)) {
    return { ok: false, error: "Send sellsIn: a list of language codes, or an empty list." };
  }
  const raw = body.sellsIn;
  if (!Array.isArray(raw)) {
    return { ok: false, error: "sellsIn must be a list of language codes." };
  }
  const out = [];
  for (const v of raw) {
    const code = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (!code || !LANGUAGE_CODES.includes(code)) {
      return {
        ok: false,
        error: `"${typeof v === "string" ? v : String(v)}" isn't a language FieldQuo has been translated into.`,
      };
    }
    if (!out.includes(code)) out.push(code);
  }
  return { ok: true, sellsIn: out };
}
