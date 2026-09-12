// lib/sales/discovery/tradeSuggest.js
//
// Up to three trades a REVIEWER might pick for a prospect that has none, each
// with the reason it is being suggested.
//
// ══ A suggestion is not a guess ════════════════════════════════════════════
//
// rbq/provider.js's header refuses to guess a trade at ingest, and the
// refusal stands: 81% of Quebec licence-holders are authorised for interior
// finishing, and "holds subcategory 12" is not "sells cabinets". Nothing here
// writes a trade. A suggestion is rendered as a chip with its basis beside it
// — "name: 'Toitures'", "licence: only 16 Électricité", "site" — and a
// superadmin accepts or ignores it. The row stays trade-less until a human
// says otherwise, and the accept route is the only thing that writes.
//
// The difference is who decides. The ingest decides for 49,187 rows at once
// with nobody looking; a reviewer decides one row at a time while looking at
// the name, the licence and the reason. A rule that would be reckless as a
// verdict is useful as a prompt, precisely because a wrong prompt costs a
// glance and a wrong verdict costs a call.
//
// ══ Three sources, in the order they are trusted ═══════════════════════════
//
//   site     lib/sales/intel/tradeDetect.js already read the business's own
//            website and wrote a `trade` ProspectInference. Strongest: the
//            contractor said it themselves.
//   name     the business name, in French or English. "Toitures Tremblay
//            inc." names its trade; so does "R&L Electric". Keyword table
//            below, matched on an accent-folded copy of the name and of every
//            trading name the register listed.
//   licence  ONLY when the licence authorises a single kind of SPECIFIC
//            work. An RBQ licence authorised for nothing but 16 (électricité)
//            is an electrician's. The general-contractor scope — a 1.x code
//            and the thirteen-code bundle that rides with it — is set aside
//            first, the way California's unrestricted B is: it is held by
//            four licences in five and identifies nobody. So 1.2 + bundle +
//            16 still suggests electrical, because 16 is the one thing the
//            licence says beyond "general contractor" and it is issued by the
//            electricians' own corporation; 1.2 + bundle + 16 + 15.5 suggests
//            nothing, because two kinds of specific work is not one. A
//            California licence holding B plus C-33 is a painter by the same
//            rule (usBoard/classes.js's UNRESTRICTED_CLASSES).
//
// ══ Retail words switch the whole thing off ════════════════════════════════
//
// "Peinture Dépôt", "Boutique du Plancher", "Plumbing Supply Co" all carry a
// trade word. Suggesting "painting" for a paint depot is the exact wasted call
// classify.js exists to prevent, so a name carrying a shop word yields NO
// contractor suggestion at all, and the reviewer sees why instead. The word
// list is FieldQuo's own, in both languages; classify.js's SUPPLIER_NAME_
// PATTERNS are English and decisive, this list is wider and only advisory.
//
// ══ What is deliberately absent ════════════════════════════════════════════
//
//   "construction"   in two names out of five ("Construction 2Much inc."). It
//                    says "builds things", which every row here does.
//   "fenêtre" / "window"
//                    FieldQuo sells no window-installation trade. "window
//                    cleaning" maps; a bare "fenêtre" maps to nothing rather
//                    than to the nearest-looking trade.
//   RBQ family 1     "entrepreneur général" as a LICENCE class is the same
//                    unrestricted residual as California's B: four in five
//                    licences carry it. The words in a NAME still count.
//   RBQ 7, 9, 12     each names two or more FieldQuo trades (7 is insulation,
//                    roofing AND siding; 12 is cabinets AND countertops).
//                    Same rule as usBoard/classes.js's AMBIGUOUS_CLASSES —
//                    except that a US ambiguous class DOES suggest each trade
//                    it names, because the reviewer is the tie-break the
//                    ingest lacked.
//
// Pure. Executed against forty hostile fixtures by scripts/check-review-
// folder.mjs, including accents, hyphenated compounds, the empty name, and
// shop words beside trade words.

import { DISCOVERY_TRADES, discoveryTradeLabel, isDiscoveryTradeKey, tradeForCategories } from "./trades";
import { RBQ_CATEGORY_PREFIX, RBQ_GENERAL_SCOPE_BUNDLE } from "./rbq/licence";
import { normaliseRbqCode, rbqFamilyOf, rbqSubcategory } from "./rbq/subcategories";
import { UNRESTRICTED_CLASSES, classForNamespaced, classLabel } from "./usBoard/classes";
import { MULTI_TRADE, TRADE_INFERENCE_KIND } from "@/lib/sales/intel/tradeDetect";

/** How many suggestions a row may carry. Three keys, 1–3, on the keyboard. */
export const MAX_SUGGESTIONS = 3;

/**
 * Accent-folded, lower-cased, punctuation collapsed to single spaces.
 * "Électro-Plomberie J.-P. inc." → "electro plomberie j p inc".
 */
export function foldName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Name keywords, as PREFIXES anchored at a word start, on the folded name.
 *
 * "electri" catches électricité, électrique, electric, electrical,
 * electrician. A space inside a keyword matches any run of punctuation or
 * whitespace, so "entrepreneur general" also matches "Entrepreneur-Général".
 * A TRAILING space pins the word's end as well: "electro " matches
 * "Électro-Plomberie" and not "Électroménager", which is an appliance
 * repairer and has its own entry. Written as plain strings rather than
 * RegExps because the same table has to compile to a Postgres regex for the
 * Review folder's sort — see `nameKeywordPgRegex`.
 */
export const NAME_KEYWORDS = Object.freeze([
  { tradeKey: "electrical", words: ["electri", "electro "] },
  { tradeKey: "roofing", words: ["toitur", "couvreur", "roof"] },
  { tradeKey: "plumbing", words: ["plomb", "plumb"] },
  { tradeKey: "painting", words: ["peintur", "peintre", "paint"] },
  { tradeKey: "landscaping", words: ["paysag", "landscap", "lawn", "pelouse", "gazon"] },
  { tradeKey: "excavation", words: ["excavat", "terrassement"] },
  { tradeKey: "masonry_concrete", words: ["beton", "concrete", "maconn", "mason", "brique", "brick"] },
  { tradeKey: "carpentry", words: ["menuis", "carpent", "charpent"] },
  { tradeKey: "cabinets", words: ["cuisine", "armoire", "cabinet", "ebenist"] },
  { tradeKey: "countertops", words: ["comptoir", "countertop", "quartz", "granit"] },
  { tradeKey: "flooring", words: ["plancher", "floor", "tapis", "couvre plancher"] },
  { tradeKey: "drywall", words: ["gyps", "drywall", "platr", "tirage de joint"] },
  { tradeKey: "hvac", words: ["cvc", "hvac", "chauffage", "climatis", "ventilation", "heating", "air conditioning", "thermopompe", "heat pump"] },
  { tradeKey: "insulation", words: ["isolation", "isolant", "insulat"] },
  { tradeKey: "fencing", words: ["clotur", "fence", "fencing"] },
  { tradeKey: "pool_spa", words: ["piscine", "pool ", "pools "] },
  { tradeKey: "gutters", words: ["gouttier", "gutter"] },
  { tradeKey: "demolition", words: ["demoli"] },
  { tradeKey: "general_contracting", words: ["entrepreneur general", "general contract", "construction generale"] },
  { tradeKey: "tiling", words: ["ceramique", "ceramic", "carrelage", "carreleur", "tile ", "tiles ", "tiling"] },
  { tradeKey: "siding", words: ["revetement exterieur", "siding", "parement"] },
  { tradeKey: "paving", words: ["pavage", "paving", "asphalt", "pave uni", "paver"] },
  { tradeKey: "tree_care", words: ["arbor", "elagage", "emondage", "abattage", "tree "] },
  { tradeKey: "pressure_washing", words: ["pressure wash", "power wash", "lavage a pression", "haute pression"] },
  { tradeKey: "window_cleaning", words: ["window clean", "lavage de vitre"] },
  { tradeKey: "carpet_cleaning", words: ["carpet clean", "nettoyage de tapis"] },
  { tradeKey: "snow_removal", words: ["deneig", "snow"] },
  { tradeKey: "handyman", words: ["handyman", "homme a tout faire", "bricoleur"] },
  { tradeKey: "garage_door", words: ["porte de garage", "portes de garage", "garage door"] },
  { tradeKey: "locksmith", words: ["serrur", "locksmith"] },
  { tradeKey: "pest_control", words: ["exterminat", "pest control", "gestion parasitaire"] },
  { tradeKey: "appliance_repair", words: ["electromenager", "appliance"] },
  { tradeKey: "house_cleaning", words: ["entretien menager", "maid ", "maids ", "housekeep"] },
  { tradeKey: "irrigation", words: ["irrigation", "arrosage"] },
  { tradeKey: "chimney", words: ["cheminee", "chimney", "ramonage"] },
  { tradeKey: "restoration", words: ["apres sinistre", "sinistre", "restoration", "water damage", "fire damage"] },
  { tradeKey: "junk_removal", words: ["junk", "hauling"] },
  { tradeKey: "home_inspection", words: ["home inspect", "inspecteur en batiment", "inspection de batiment"] },
  { tradeKey: "remodeling", words: ["renov", "remodel"] },
]);

/**
 * Words that mean "a shop". Any one of them suppresses every suggestion.
 *
 * Prefixes at a word start on the folded name, like the trade words. "depot"
 * is here even though classify.js lists it as merely ambiguous: classify.js
 * is deciding a verdict and "Ottawa Roofing Centre" is a roofer, whereas this
 * file is deciding whether to PROMPT, and a prompt withheld costs one glance.
 */
export const RETAIL_WORDS = Object.freeze([
  "boutique",
  "depot",
  "magasin",
  "store",
  "supply",
  "supplies",
  "wholesale",
  "distribut",
  "lumber",
  "quincaillerie",
  "materiaux",
  "building material",
  "building product",
  "centre de renovation",
  "centre renovation",
  "entrepot",
  "warehouse",
  "showroom",
  "salle de montre",
  "rental",
  "location d outil",
  "outlet",
]);

/**
 * RBQ subcategory → the ONE FieldQuo trade it names, or absent when it names
 * none or several. Consulted only after the general-contractor scope has been
 * set aside and only when what remains is a single code family — see
 * `licenceSuggestions`.
 */
export const RBQ_CODE_TRADES = Object.freeze({
  "2.5": "excavation",
  "3.1": "masonry_concrete",
  "3.2": "masonry_concrete",
  "4.1": "masonry_concrete",
  "6.1": "carpentry",
  "6.2": "carpentry",
  "15.1": "hvac",
  "15.2": "hvac",
  "15.3": "hvac",
  "15.4": "hvac",
  "15.5": "plumbing",
  "15.7": "hvac",
  "15.8": "hvac",
  "16": "electrical",
});

/**
 * A US board class that names MORE than one trade, and the trades it names.
 *
 * usBoard/classes.js's AMBIGUOUS_CLASSES refuses to map these at ingest,
 * because array order is not a decision. A reviewer IS a decision, so the
 * folder offers each trade the class names and lets the human pick. D41's
 * decking is absent because FieldQuo does not sell it; C38 (commercial
 * refrigeration) is absent because it names nothing FieldQuo sells.
 */
export const AMBIGUOUS_CLASS_TRADES = Object.freeze({
  us_ca_cslb: Object.freeze({
    "C-6": ["cabinets", "carpentry"],
    C12: ["excavation", "paving"],
    C21: ["demolition"],
    C28: ["locksmith"],
    D41: ["siding"],
  }),
  us_wa_lni: Object.freeze({
    "CC|SK": ["flooring", "countertops"],
    "CC|SB": ["cabinets", "carpentry"],
  }),
  us_or_ccb: Object.freeze({}),
});

const BUNDLE = new Set(RBQ_GENERAL_SCOPE_BUNDLE);

// ── Keyword compilation ───────────────────────────────────────────────────

/** A keyword as a JS RegExp over the folded name. */
function keywordRe(word) {
  const wholeWord = /\s$/.test(word);
  const body = word.trim().replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${body}${wholeWord ? "\\b" : ""}`);
}

const NAME_RES = NAME_KEYWORDS.map((entry) => ({
  tradeKey: entry.tradeKey,
  words: entry.words.map((w) => ({ word: w.trim(), re: keywordRe(w) })),
}));
const RETAIL_RES = RETAIL_WORDS.map((w) => ({ word: w.trim(), re: keywordRe(w) }));

/** The first shop word in a name, or null. */
export function retailWordIn(name) {
  const folded = foldName(name);
  if (!folded) return null;
  for (const { word, re } of RETAIL_RES) if (re.test(folded)) return word;
  return null;
}

/**
 * Trades the NAME names, with the word that named each. Position order in the
 * name, so "Électro-Plomberie" suggests electrical before plumbing and a
 * reviewer's "1" is the word they read first.
 */
export function nameTrades(name) {
  const folded = foldName(name);
  if (!folded) return [];
  const hits = [];
  for (const entry of NAME_RES) {
    for (const { word, re } of entry.words) {
      const m = re.exec(folded);
      if (m) {
        hits.push({ tradeKey: entry.tradeKey, word, at: m.index });
        break;
      }
    }
  }
  hits.sort((a, b) => a.at - b.at);
  return hits.map(({ tradeKey, word }) => ({ tradeKey, word }));
}

// ── Licence ───────────────────────────────────────────────────────────────

/**
 * What an RBQ licence's authorisations say, once the general scope is out.
 *
 * @returns {{ tradeKey:string, code:string }[]|null}
 *          null when the licence says nothing usable. A single-element array
 *          is the only shape that becomes a suggestion; several elements means
 *          several kinds of work and no suggestion — the rule the header
 *          gives.
 */
export function rbqLicenceTrades(sourceCategories = []) {
  const codes = [];
  for (const raw of Array.isArray(sourceCategories) ? sourceCategories : []) {
    if (typeof raw !== "string" || !raw.startsWith(RBQ_CATEGORY_PREFIX)) continue;
    const code = normaliseRbqCode(raw);
    if (code && !codes.includes(code)) codes.push(code);
  }
  if (!codes.length) return null;

  const general = codes.some((c) => rbqFamilyOf(c) === "1");
  // The thirteen-code bundle rides on the general scope; with a 1.x present
  // it describes the general contractor, not a second trade. Without one it
  // is the licence's own authorisation set and counts.
  const specific = codes.filter((c) => rbqFamilyOf(c) !== "1" && !(general && BUNDLE.has(c)));
  if (!specific.length) return null;

  const families = new Set(specific.map((c) => rbqFamilyOf(c)));
  if (families.size !== 1) return null;

  const trades = new Map();
  for (const code of specific) {
    const tradeKey = RBQ_CODE_TRADES[code] || null;
    // One ambiguous code in the family (15.6 propane beside 15.5) and the
    // family no longer names one trade.
    if (!tradeKey) return null;
    if (!trades.has(tradeKey)) trades.set(tradeKey, code);
  }
  return [...trades].map(([tradeKey, code]) => ({ tradeKey, code }));
}

/**
 * What a US board licence's classes say, the unrestricted ones set aside.
 *
 * @returns {{ tradeKey:string, token:string, ambiguous:boolean }[]|null}
 */
export function boardLicenceTrades(providerKey, sourceCategories = []) {
  if (!providerKey || !UNRESTRICTED_CLASSES[providerKey]) return null;
  const tokens = [];
  for (const raw of Array.isArray(sourceCategories) ? sourceCategories : []) {
    if (typeof raw !== "string") continue;
    const token = classForNamespaced(providerKey, raw.trim());
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  const specific = tokens.filter((t) => !UNRESTRICTED_CLASSES[providerKey].includes(t));
  if (specific.length !== 1) return null;
  const token = specific[0];
  const namespaced = (Array.isArray(sourceCategories) ? sourceCategories : []).find(
    (c) => typeof c === "string" && classForNamespaced(providerKey, c.trim()) === token,
  );
  const mapped = tradeForCategories({ primary: namespaced ? namespaced.trim() : null }).tradeKey;
  if (mapped) return [{ tradeKey: mapped, token, ambiguous: false }];
  const several = AMBIGUOUS_CLASS_TRADES[providerKey]?.[token];
  if (several?.length) return several.map((tradeKey) => ({ tradeKey, token, ambiguous: true }));
  return null;
}

/** The licence-based suggestions for one row, with their basis sentences. */
export function licenceSuggestions({ sourceProvider, sourceCategories }) {
  if (sourceProvider === "rbq") {
    const trades = rbqLicenceTrades(sourceCategories);
    if (!trades || trades.length !== 1) return [];
    const { tradeKey, code } = trades[0];
    const sub = rbqSubcategory(code);
    // "beyond general scope" when a 1.x sat beside it, so the reviewer sees
    // that this licence-holder is ALSO a general contractor.
    const general = (Array.isArray(sourceCategories) ? sourceCategories : []).some((c) => rbqFamilyOf(c) === "1");
    return [
      {
        tradeKey,
        source: "licence",
        basis: `licence: only ${code}${sub ? ` ${sub.fr.replace(/^Entrepreneur en /, "")}` : ""}${general ? " beyond general scope" : ""}`,
      },
    ];
  }
  const trades = boardLicenceTrades(sourceProvider, sourceCategories);
  if (!trades) return [];
  return trades.map(({ tradeKey, token, ambiguous }) => {
    const label = classLabel(sourceProvider, token);
    return {
      tradeKey,
      source: "licence",
      basis: ambiguous
        ? `licence: ${token}${label ? ` ${label}` : ""} names ${trades.length} trades`
        : `licence: only ${token}${label ? ` ${label}` : ""}`,
    };
  });
}

// ── Site ──────────────────────────────────────────────────────────────────

/** The trade tradeDetect wrote, if it wrote one and it is a single trade. */
export function siteSuggestion(inferences = [], { domain = null } = {}) {
  for (const inf of Array.isArray(inferences) ? inferences : []) {
    if (inf?.kind !== TRADE_INFERENCE_KIND) continue;
    if (inf.value === MULTI_TRADE) return null;
    if (isDiscoveryTradeKey(inf.value)) {
      return { tradeKey: inf.value, source: "site", basis: `site: ${domain || "their own website"}` };
    }
  }
  return null;
}

// ── The one entry point ───────────────────────────────────────────────────

/**
 * Suggest up to three trades for one prospect.
 *
 * @param {{ businessName?:string, tradingNames?:string[], sourceProvider?:string,
 *           sourceCategories?:string[], inferences?:{kind:string,value:string}[],
 *           domain?:string }} row
 * @returns {{ suggestions: {tradeKey:string, label:string, source:"site"|"name"|"licence", basis:string}[],
 *             retailWord: string|null }}
 *          `retailWord` is the shop word that switched suggestions off, so the
 *          screen can say so instead of showing an empty chip row.
 */
export function suggestTrades(row = {}) {
  const names = [row?.businessName, ...(Array.isArray(row?.tradingNames) ? row.tradingNames : [])].filter(
    (n) => typeof n === "string" && n.trim(),
  );

  for (const name of names) {
    const word = retailWordIn(name);
    if (word) return { suggestions: [], retailWord: word };
  }

  const out = [];
  const seen = new Set();
  const push = (s) => {
    if (!s || seen.has(s.tradeKey) || !isDiscoveryTradeKey(s.tradeKey)) return;
    seen.add(s.tradeKey);
    out.push({ ...s, label: discoveryTradeLabel(s.tradeKey) });
  };

  push(siteSuggestion(row?.inferences, { domain: row?.domain || null }));

  for (const name of names) {
    for (const { tradeKey, word } of nameTrades(name)) {
      push({ tradeKey, source: "name", basis: `name: '${word.trim()}'` });
    }
  }

  for (const s of licenceSuggestions({ sourceProvider: row?.sourceProvider, sourceCategories: row?.sourceCategories })) {
    push(s);
  }

  return { suggestions: out.slice(0, MAX_SUGGESTIONS), retailWord: null };
}

// ── The same table, as Postgres ───────────────────────────────────────────

/**
 * A folded keyword as a case-insensitive, accent-tolerant Postgres regex over
 * the RAW stored name. The folded table cannot be applied in SQL without the
 * unaccent extension, so each vowel is expanded to its accented forms instead:
 * "electri" → "\m[eéèêë]l[eéèêë]ctr[iîï]". `\m` is Postgres for a word start.
 */
const ACCENTS = { a: "[aàâä]", e: "[eéèêë]", i: "[iîï]", o: "[oôö]", u: "[uùûü]", c: "[cç]" };

export function keywordToPgRegex(word) {
  const wholeWord = /\s$/.test(word);
  let out = "";
  for (const ch of word.trim()) {
    if (ch === " ") out += "[^[:alnum:]]+";
    else if (ACCENTS[ch]) out += ACCENTS[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += `\\${ch}`;
  }
  return `\\m${out}${wholeWord ? "\\M" : ""}`;
}

/** One alternation of every trade keyword, for `ORDER BY name ~* $1`. */
export function nameKeywordPgRegex() {
  return NAME_KEYWORDS.flatMap((e) => e.words.map(keywordToPgRegex)).join("|");
}

/** One alternation of every shop word, for the "Reject all matching" filter. */
export function retailWordPgRegex() {
  return RETAIL_WORDS.map(keywordToPgRegex).join("|");
}

/** Every trade key the keyword table names, for the check. */
export function keywordTradeKeys() {
  return [...new Set(NAME_KEYWORDS.map((e) => e.tradeKey))];
}

/** Every trade key the RBQ and board tables name, for the check. */
export function licenceTradeKeys() {
  const keys = new Set(Object.values(RBQ_CODE_TRADES));
  for (const board of Object.values(AMBIGUOUS_CLASS_TRADES)) {
    for (const list of Object.values(board)) for (const k of list) keys.add(k);
  }
  return [...keys];
}

/** So a screen can list what the picker offers, in the catalogue's order. */
export function tradePickerOptions() {
  return Object.keys(DISCOVERY_TRADES)
    .sort()
    .map((key) => ({ key, label: DISCOVERY_TRADES[key].label }));
}
