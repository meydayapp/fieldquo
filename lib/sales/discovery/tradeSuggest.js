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
// ══ A fourth source, weaker: the website's own name ════════════════════════
//
// Added 2026-09-13 at the coordinator's note on the owner's example row
// ("Fasso Tree Service · treeservicesangola.com"): the domain is a name-like
// signal. It is matched with the same table, as a substring with guards
// (see `domainTrades`), reported as "site name", and offered LAST — a name is
// a statement the business registered; a domain is a string somebody bought.
//
// ══ Stored, since 2026-09-13, so the pile can be worked in batches ════════
//
// The folder held 299,945 rows that day, 210,969 of them trade-less, and a
// suggestion computed inside one request cannot be grouped. So
// suggestTradesBatch.js runs `suggestionColumns()` below over every folder
// row and writes Prospect.suggested* (schema comment there); the screen's
// By-suggestion mode is a GROUP BY over that. The per-row chip is still
// computed here at render time, from the same function, so what a reviewer
// reads on the row and the group it sits in cannot disagree. STILL nothing
// here writes a trade — scripts/check-trade-suggestions.mjs greps for it.
//
// ══ Measured, 2026-09-13, before the table grew ═══════════════════════════
//
// The suggester as it stood, over a random 2,000 of the trade-less rows:
// 456 suggested (22.8%), 3 shop words, 1,541 nothing. Forty names per top
// trade hand-checked; the wrongs are recorded on CONFIDENCE_BY_BASIS. What
// the 1,541 said, and what was added for it: "PLASTERING" (drywall),
// "DIRTWORKS" / "GRADING" / "BACKHOE" (excavation), "BLACKTOP" / "SEAL
// COAT" (paving), "CEMENT" (masonry and concrete), "COOLING" / "FURNACE"
// (hvac), "ROOTER" / "SEWER" / "SEPTIC" (plumbing), "HARDWOOD" / "LAMINATE"
// (flooring), "SPA" / "HOT TUB" (pools), "MOLD" / "PUROCLEAN" / "SERVPRO"
// (restoration), "TERMITE" (pest control), "FIREPLACE" (chimney),
// "EAVESTROUGH" (gutters), "SPRINKLER" (irrigation), "FERBLANTERIE"
// (roofing, Quebec). And what was NOT added, because the sample showed it
// naming several trades or none: "construction", "builders", "glass",
// "windows", "doors", "stone", "drain", "mechanical", "home improvement".
// Most of the remainder are person names and numbered companies, which is
// what Phase 2 (suggestTradesAi.js) is for.
//
// Pure. Executed against forty hostile fixtures by scripts/check-review-
// folder.mjs, including accents, hyphenated compounds, the empty name, and
// shop words beside trade words; and against the owner's six examples, the
// domain guards and the stored form by scripts/check-trade-suggestions.mjs.

import { DISCOVERY_TRADES, discoveryTradeLabel, isDiscoveryTradeKey, tradeForCategories } from "./trades";
import { RBQ_CATEGORY_PREFIX, RBQ_GENERAL_SCOPE_BUNDLE } from "./rbq/licence";
import { normaliseRbqCode, rbqFamilyOf, rbqSubcategory } from "./rbq/subcategories";
import { UNRESTRICTED_CLASSES, classForNamespaced, classLabel } from "./usBoard/classes";
import { MULTI_TRADE, TRADE_INFERENCE_KIND } from "@/lib/sales/intel/tradeDetect";
import { SUPPLIER_NAME_PATTERNS, normaliseNameForMatch } from "./classify";

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
  { tradeKey: "roofing", words: ["toitur", "toit ", "toits ", "couvreur", "roof", "shingle", "ferblant"] },
  { tradeKey: "plumbing", words: ["plomb", "plumb", "rooter", "sewer", "septic", "water heater"] },
  { tradeKey: "painting", words: ["peintur", "peintre", "paint"] },
  // "tree " is here AND under tree_care, landscaping first: the owner's
  // verdict on 2026-09-13, twice ("Fasso Tree Service would most likely be a
  // landscaping"), against a catalogue that has both. The tree crew gets the
  // landscaping script; tree care rides as the second chip so a reviewer who
  // disagrees is one keypress away. A tie on position keeps table order.
  { tradeKey: "landscaping", words: ["paysag", "landscap", "lawn", "pelouse", "gazon", "tree ", "hardscap", "sod ", "turf"] },
  { tradeKey: "excavation", words: ["excavat", "terrassement", "dirtwork", "dirt work", "grading", "backhoe", "trenching", "earthwork"] },
  { tradeKey: "masonry_concrete", words: ["beton", "concrete", "cement", "ciment", "maconn", "mason", "brique", "brick", "stucco"] },
  { tradeKey: "carpentry", words: ["menuis", "carpent", "charpent", "framing", "woodwork"] },
  { tradeKey: "cabinets", words: ["cuisine", "armoire", "cabinet", "ebenist"] },
  { tradeKey: "countertops", words: ["comptoir", "countertop", "quartz", "granit", "marble", "marbre"] },
  { tradeKey: "flooring", words: ["plancher", "floor", "tapis", "couvre plancher", "hardwood", "laminate", "carpet install", "carpets "] },
  { tradeKey: "drywall", words: ["gyps", "drywall", "platr", "plaster", "tirage de joint"] },
  { tradeKey: "hvac", words: ["cvc", "hvac", "chauffage", "climatis", "ventilation", "heating", "cooling", "furnace", "air cond", "thermopompe", "heat pump", "geotherm"] },
  { tradeKey: "insulation", words: ["isolation", "isolant", "insulat", "spray foam"] },
  { tradeKey: "fencing", words: ["clotur", "fence", "fencing"] },
  { tradeKey: "pool_spa", words: ["piscine", "pool ", "pools ", "spa ", "spas ", "hot tub", "swimming"] },
  { tradeKey: "gutters", words: ["gouttier", "gutter", "eavestrough"] },
  { tradeKey: "demolition", words: ["demoli", "wrecking"] },
  { tradeKey: "general_contracting", words: ["entrepreneur general", "general contract", "construction generale"] },
  { tradeKey: "tiling", words: ["ceramique", "ceramic", "carrelage", "carreleur", "tile ", "tiles ", "tiling", "grout"] },
  { tradeKey: "siding", words: ["revetement exterieur", "siding", "parement"] },
  { tradeKey: "paving", words: ["pavage", "paving", "asphalt", "pave uni", "paver", "blacktop", "black top", "sealcoat", "seal coat"] },
  { tradeKey: "tree_care", words: ["arbor", "elagage", "emondage", "abattage", "tree "] },
  { tradeKey: "pressure_washing", words: ["pressure wash", "power wash", "lavage a pression", "haute pression", "soft wash"] },
  { tradeKey: "window_cleaning", words: ["window clean", "window wash", "lavage de vitre"] },
  { tradeKey: "carpet_cleaning", words: ["carpet clean", "nettoyage de tapis"] },
  { tradeKey: "snow_removal", words: ["deneig", "snow"] },
  { tradeKey: "handyman", words: ["handyman", "homme a tout faire", "bricoleur", "home repair"] },
  { tradeKey: "garage_door", words: ["porte de garage", "portes de garage", "garage door"] },
  { tradeKey: "locksmith", words: ["serrur", "locksmith", "lock key", "lock and key"] },
  { tradeKey: "pest_control", words: ["exterminat", "pest control", "gestion parasitaire", "termite", "mosquito"] },
  { tradeKey: "appliance_repair", words: ["electromenager", "appliance"] },
  { tradeKey: "house_cleaning", words: ["entretien menager", "maid ", "maids ", "housekeep", "house clean", "cleaning service", "janitorial"] },
  { tradeKey: "irrigation", words: ["irrigation", "arrosage", "sprinkler"] },
  { tradeKey: "chimney", words: ["cheminee", "chimney", "ramonage", "fireplace"] },
  { tradeKey: "restoration", words: ["apres sinistre", "sinistre", "restoration", "water damage", "fire damage", "mold ", "moisissure", "servpro", "puroclean"] },
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
  // Whole words. "store" as a prefix caught "Storefronts", which is a glass
  // contractor's word, forty times in a sample of the folder.
  "store ",
  "stores ",
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
  "dealer",
  "manufactur",
  // ── Grown, not built (the owner, 2026-09-13: "Blasz Tree Farm looks like
  // it's a greenhouse or farm and not a contractor") ────────────────────────
  //
  // Measured on the folder's names carrying "farm": Fuzzy Foot Farms,
  // Hillcrest Tree Farm, Indigo Farms, Firewood Farms, Holly Hill Christmas
  // Tree Farm — and, in the minority, Farm City Fence and Huber Farms &
  // Excavating, which carry a trade word too. Those land in the "shop word
  // beside a trade word" group, where the trade chip is still shown; the
  // rest stay here. Whole words, so "Farmington" and "Farmer's Roofing" are
  // untouched.
  "farm ",
  "farms ",
  "tree farm",
  "christmas",
  "nursery",
  "nurseries",
  "greenhouse",
  "serre ",
  "serres ",
  "pepiniere",
  "garden cent",
  "centre jardin",
  "centre de jardin",
  // ── Made, not installed ────────────────────────────────────────────────
  //
  // Sixty folder names carry "products": Malarkey Roofing Products, Stonecraft
  // Concrete Products, Sierra Cascade Aggregate & Asphalt Products, Suffolk
  // Cement Products, Diamond Precast Products. Manufacturers and yards. The
  // few installers among them ("Builders Installed Products") keep their
  // trade chip in the mixed group.
  "products ",
  "produits ",
  "precast",
  "ready mix",
  "aggregate",
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

/**
 * The first not-a-contractor word in a name, or null.
 *
 * Two lists, one answer. RETAIL_WORDS above is FieldQuo's bilingual, advisory
 * list; classify.js's SUPPLIER_NAME_PATTERNS is the English, decisive one
 * ("materials", "millwork", "paint store", "parts centre"). The second is
 * REUSED rather than copied — a copy is the one that rots (AGENTS.md failure
 * class 4) — and consulted after the first, so a word in both reports the
 * spelling this file's Postgres compile knows. The SQL filter behind "Reject
 * all matching" (`retailWordPgRegex`) compiles RETAIL_WORDS only; every row
 * it selects is also matched here, never the reverse.
 */
export function retailWordIn(name) {
  const folded = foldName(name);
  if (!folded) return null;
  for (const { word, re } of RETAIL_RES) if (re.test(folded)) return word;
  const flat = normaliseNameForMatch(name);
  for (const pattern of SUPPLIER_NAME_PATTERNS) {
    const m = pattern.exec(flat);
    if (m) return m[0];
  }
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
    // The EARLIEST word of the entry, not the first in the list: "Apex Tree
    // And Landscape" names landscaping at "tree" (position 5), and reading
    // it at "landscap" (position 14) would let tree care sort ahead of the
    // trade the table puts first. Ties keep table order (sort is stable).
    let best = null;
    for (const { word, re } of entry.words) {
      const m = re.exec(folded);
      if (m && (!best || m.index < best.at)) best = { tradeKey: entry.tradeKey, word, at: m.index };
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => a.at - b.at);
  return hits.map(({ tradeKey, word }) => ({ tradeKey, word }));
}

// ── The website's own name ─────────────────────────────────────────────────
//
// "treeservicesangola.com" names the trade the way "Fasso Tree Service" does,
// and for a numbered company ("9410-5111 Québec inc." at plomberie-roy.ca)
// it is the only name that does. A domain has no word boundaries, so the
// keyword table is matched as a SUBSTRING of the registrable label — and a
// substring match is where "street" contains "tree", "harbor" contains
// "arbor", "waterproofing" contains "roofing" and "fresno" contains "snow".
//
// Measured on 20,000 folder domains (2026-09-13): keywords of five letters
// and more were clean at substring; the short ones were not. So a keyword
// under five letters must sit at the label's start, after a hyphen or a
// digit, or be followed by a form that only the trade produces ("roofing",
// "roofer", "roofs", "treeservice", "treecare", "poolservice"); and the
// substrings below that were SEEN to lie are refused outright. A weaker
// basis than the name, reported as "site name", offered last.
const DOMAIN_SHORT_SUFFIXES = ["s", "ing", "er", "ers", "service", "care", "removal", "repair", "work", "works", "pro", "pros", "guy", "guys", "man", "men", "doctor", "expert", "experts", "and", "co", "company", "plus", "master", "masters", "king", "tech", "solutions", "specialist", "specialists"];
const DOMAIN_LIARS = ["proof", "street", "liverpool", "harbor", "harbour", "fresno", "textile", "versatile", "reptile", "laundertree", "brickhouse", "electronics", "pooled"];

/** The registrable label of a domain: "www.plomberie-roy.ca" → "plomberie-roy". */
export function domainLabel(domain) {
  const host = String(domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!host || !host.includes(".")) return "";
  return host.split(".")[0].replace(/[^a-z0-9-]/g, "");
}

/** Trades the WEBSITE'S NAME names, with the word that named each. */
export function domainTrades(domain) {
  const label = domainLabel(domain);
  if (!label) return [];
  const liars = DOMAIN_LIARS.filter((l) => label.includes(l));
  const hits = [];
  for (const entry of NAME_KEYWORDS) {
    let best = null;
    for (const raw of entry.words) {
      const word = raw.trim().replace(/\s+/g, "");
      if (word.length < 3) continue;
      let from = 0;
      for (;;) {
        const at = label.indexOf(word, from);
        if (at < 0) break;
        from = at + 1;
        // A liar that contains this very occurrence: "harbor" swallows the
        // "arbor" at position 1, but not an "arbor" elsewhere in the label.
        if (liars.some((l) => { const li = label.indexOf(l); return li >= 0 && at >= li && at + word.length <= li + l.length; })) continue;
        if (word.length < 5) {
          const before = at === 0 ? "" : label[at - 1];
          const after = label.slice(at + word.length);
          const anchored = !before || /[-0-9]/.test(before);
          const formed = DOMAIN_SHORT_SUFFIXES.some((sfx) => after.startsWith(sfx));
          if (!anchored && !formed) continue;
        }
        if (!best || at < best.at) best = { tradeKey: entry.tradeKey, word, at };
        break;
      }
    }
    if (best) hits.push(best);
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

  for (const { tradeKey, word } of domainTrades(row?.domain)) {
    push({ tradeKey, source: "site_name", basis: `site name: '${word}'` });
  }

  const suggestions = out.slice(0, MAX_SUGGESTIONS);

  // A shop word wins: NO suggestion, and the reviewer sees why. What the name
  // ALSO said is kept beside it as `alsoNames`, so the By-suggestion mode can
  // put "Nursery & Landscaping" in the shop-word-beside-a-trade-word group
  // with its landscaping chip rather than in the plain "not a contractor"
  // pile — classify.js's three-valued answer, applied to a prompt.
  for (const name of names) {
    const word = retailWordIn(name);
    if (word) return { suggestions: [], retailWord: word, alsoNames: suggestions };
  }

  return { suggestions, retailWord: null, alsoNames: [] };
}

// ── The stored form ────────────────────────────────────────────────────────

/**
 * Bumped whenever a table above changes. The batch recomputes rows carrying
 * an older version and leaves rows carrying this one alone, so the cron slice
 * is idempotent and a keyword added tomorrow reaches every row without a
 * human remembering to re-run anything.
 */
export const SUGGEST_VERSION = "2026-09-13.1";

/**
 * Precision of each basis, MEASURED on a hand-checked draw from the folder
 * (2026-09-13, random 2,000 of the 210,969 trade-less rows — the draw and the
 * wrongs are recorded in scripts/check-trade-suggestions.mjs's header):
 *
 *   site       the crawler read it off their own pages. Not re-measured here;
 *              lib/sales/intel/tradeDetect.js's own figure.
 *   name       40 per top trade hand-checked; the wrongs were a cleaning
 *              company named "Brick-O", a laundry, and concrete PUMPING and
 *              CUTTING firms filed under masonry — the word was right and the
 *              business was adjacent.
 *   licence    "only 16" on an RBQ licence, "only C-33" on a CSLB one.
 *   site_name  the domain, substring-matched with the guards above.
 *
 * Stored per row so a later screen can sort a group by it. NOT a threshold:
 * nothing here is accepted on a number, a person accepts a page.
 */
export const CONFIDENCE_BY_BASIS = Object.freeze({
  site: 0.9,
  name: 0.93,
  licence: 0.9,
  site_name: 0.85,
});

/**
 * One row's suggestion as the Prospect columns the batch writes.
 *
 * Every field is derived from suggestTrades() above and nothing else, so the
 * chip a reviewer sees on the row and the group it sits in are one
 * computation. `suggestedTradeKey` is null under a shop word even when the
 * name also carries a trade — the primary is what a bulk accept would write,
 * and a paint depot must not be a bulk-acceptable painter — while
 * `suggestedTradeKeys` keeps what the name also said, for the mixed group.
 *
 * @returns {{ suggestedTradeKey:string|null, suggestedTradeKeys:string[], suggestedTradeBasis:string|null,
 *             suggestedTradeConfidence:number|null, suggestedNotContractor:boolean, suggestedTradeNote:string|null,
 *             suggestedVersion:string }}
 */
export function suggestionColumns(row = {}) {
  const { suggestions, retailWord, alsoNames } = suggestTrades(row);
  const list = retailWord ? alsoNames : suggestions;
  const primary = retailWord ? null : suggestions[0] || null;
  const note = [...new Set([retailWord ? `shop word: '${retailWord}'` : null, ...list.map((s) => s.basis)].filter(Boolean))].join(" · ");
  return {
    suggestedTradeKey: primary ? primary.tradeKey : null,
    suggestedTradeKeys: list.map((s) => s.tradeKey),
    suggestedTradeBasis: primary ? primary.source : null,
    suggestedTradeConfidence: primary ? CONFIDENCE_BY_BASIS[primary.source] ?? null : null,
    suggestedNotContractor: Boolean(retailWord),
    suggestedTradeNote: note || null,
    suggestedVersion: SUGGEST_VERSION,
  };
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
