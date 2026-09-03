// lib/sales/intel/tradeDetect.js
//
// What trade a prospect is in, read off their own website.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// `Prospect.tradeKey` is the spine of the rep's queue — a campaign targets a
// territory AND a trade, and lib/sales/discovery/trades.js argues at length
// why a single-trade queue is the whole point. Discovery fills that column
// from the SOURCE's category, and two large sources cannot:
//
//   Overture ships 2,118 categories and trades.js maps the 46 FieldQuo sells
//   to. Everything else arrives with `tradeKey: null`.
//
//   Quebec's RBQ register publishes each licence's AUTHORISED subcategories —
//   81.3% of all licence-holders may do interior finishing, 77.0% cabinets and
//   countertops, median 16–17 codes per licence. That is a permission set, not
//   a trade, and rbq/provider.js refuses to manufacture one from it.
//
// A contractor's own website, however, says what they do in its title, its
// schema.org markup, its service-page URLs and its navigation. That is
// determinable by software, so §58 puts it on the deterministic side of the
// line and it runs inside ANALYZE_CAPABILITIES — the stage kinds.js maps to
// `local` precisely so a free stage stops charging the OpenAI budget.
//
// ══ The rule this file exists to get right ═════════════════════════════════
//
// A prospect filed under the WRONG trade is worse than one filed under none.
// trades.js says it in one sentence — "it lands in a single-trade queue and a
// rep opens a painting script on a locksmith" — and ingest.js repeats it. This
// file is the third place that rule has to hold, and it holds it the same way
// capabilityDetect.js earns a `false`: by making the conclusion EARNED rather
// than defaulted, and by returning null everywhere else.
//
//   confirmed  the site's own machine-readable markup names the trade, OR two
//              independent structural signals agree on it. `Prospect.tradeKey`
//              may be written.
//   weak       one structural signal, or several trades contest the site.
//              A `ProspectInference` is written; `Prospect.tradeKey` is NOT.
//   unknown    nothing. Nothing is written at all.
//
// The three-valued outcome is NOT a scale invented here. It falls straight out
// of lib/sales/intel/confidence.js: `fieldConfidence()` already reports whether
// anything VERIFYING was present and already has a `single_soft_signal` reason
// for "one soft signal — real, and not enough to call this verified". So:
//
//   confirmed ⇔ conf.verifying === true || conf.sampleSize >= 2
//   weak      ⇔ conf.sampleSize === 1 and nothing verifying
//   unknown   ⇔ conf.sampleSize === 0
//
// Reusing that has a second payoff. `usable()` inside confidence.js DEDUPES by
// signal name, so nine nav links saying "Roofing" are one `detection.link` and
// not nine — which is exactly the discipline capabilityDetect.js's "one page
// per signal" break statement keeps, arrived at from the other end.
//
// ══ Prose can never manufacture a trade ════════════════════════════════════
//
// Same rule, same reason, as capabilityDetect.js's `strong` flag and
// technology.js's LOOSE_CEILING: a roofer's page says "we also do siding", a
// painter's says "we repair drywall before we paint", and a general
// contractor's says all of it. So the DECISION is computed from structural
// signals only — schema.org `@type`, the page's own title and meta
// description, its URL paths and its navigation labels. Body prose is recorded
// as evidence and raises the reported confidence of a trade that was already
// established structurally. It can never create a candidate and it can never
// break a tie.
//
// ══ A multi-trade business is real, and gets a name rather than a guess ════
//
// A firm doing roofing AND siding is not a bug; it is most of the roofing
// market. Three options were available and the middle one is wrong:
//
//   a) Pick the leader by array order. That is what
//      primaryCategoryForInstantTrade() refuses in the catalogue and what
//      tradeForCategories() refuses for alternates — array order masquerading
//      as a decision. Rejected.
//   b) Write both. There is one `tradeKey` column and one single-trade queue.
//      A second column would be read by nothing (failure class 1) and the
//      queue would still have to pick. Rejected.
//   c) A clear leader WINS; a tie is a real state with its own name.
//
// So (c): the leading trade takes the prospect only if it beats the runner-up
// on the strongest evidence class present — a schema.org type where the
// runner-up has none, or strictly more distinct structural signal kinds. A tie
// yields `decision: "weak"` with `inference.value = "MULTI_TRADE"`, which is a
// CLASSIFICATION in ProspectInference's sense ("this business advertises more
// than one trade") rather than a count or a guess, and every contesting trade
// is named in the evidence so a human can read the contest rather than
// discovering it on a call.
//
// The cost is stated rather than hidden: a genuine roofing-and-siding
// contractor whose site gives both trades equal billing stays out of both
// queues. That is the conservative direction, and it is the one this codebase
// takes everywhere else.
//
// ══ A supplier is not a trade ══════════════════════════════════════════════
//
// A paint shop's website is full of the word "peinture". classify.js already
// learned the expensive half of this lesson — its first version scored 73%
// because it treated a structural retail signal as decisive and rejected
// contractors that sell what they install — so the veto here is deliberately
// NARROW: schema.org's own Store subtypes, or the words wholesale /
// distributor / grossiste in the site's own title. "Shop" on its own is not a
// veto, and neither is a shopping cart — a fence company that sells panels
// online is the exact business classify.js's first version threw away.
import { DISCOVERY_TRADES, discoveryTradeLabel, isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";
import { fieldConfidence } from "./confidence";
import { looksRendered } from "./capabilityDetect";
import { loadedPages, normaliseCrawl } from "./technology";

export const TRADE_DETECTOR = "trade";
export const TRADE_DETECTOR_VERSION = "1";

/** `ProspectInference.kind` this detector owns. One row per prospect. */
export const TRADE_INFERENCE_KIND = "trade";

/**
 * `ProspectInference.value` when several trades contest the site.
 *
 * A bucket in the schema's sense — the same shape as SOLO_LIKELY — and it
 * carries no digit, which lib/sales/prospectView.js's inferenceStatement
 * refuses to render (a value with a number in it means somebody wrote a count
 * into a classification column).
 */
export const MULTI_TRADE = "MULTI_TRADE";

/**
 * Evidence type → the confidence signal it becomes, and whether it may decide.
 *
 * The signal names are lib/sales/intel/confidence.js's, and the evidence types
 * are the ones lib/sales/prospectView.js's SIGNAL_BY_EVIDENCE_TYPE maps BACK
 * to those same names when a screen recomputes confidence from stored rows.
 * The two directions have to agree or a stored inference renders at a
 * different confidence from the one that was written, and
 * scripts/check-trade-inference.mjs asserts they do rather than trusting this
 * comment.
 *
 * `structural` is what capabilityDetect.js calls `strong`: markup, the page's
 * own title, a URL, a navigation label — an element's own text rather than a
 * sentence in a paragraph.
 */
export const TRADE_SIGNAL_KINDS = Object.freeze({
  schema_org: { signal: "detection.schema_org", structural: true },
  meta: { signal: "detection.meta", structural: true },
  link: { signal: "detection.link", structural: true },
  page_content: { signal: "detection.page_content", structural: false },
});

/**
 * schema.org types that name a trade, and the COMPLETE list of them.
 *
 * These eight are every subtype schema.org publishes under
 * HomeAndConstructionBusiness. Nothing here is invented: a hand-typed
 * `SidingContractor` would match zero pages for ever and be indistinguishable
 * from a trade with no sites in it — the exact failure trades.js's header
 * records another agent hitting on Overture's taxonomy the same week.
 *
 * `MovingCompany` is the ninth and is deliberately absent: FieldQuo sells no
 * moving trade, so mapping it would put a prospect in a queue that does not
 * exist.
 */
export const SCHEMA_TYPE_TRADES = Object.freeze({
  electrician: "electrical",
  generalcontractor: "general_contracting",
  hvacbusiness: "hvac",
  housepainter: "painting",
  locksmith: "locksmith",
  plumber: "plumbing",
  roofingcontractor: "roofing",
});

/**
 * schema.org Store subtypes that say "this is a shop, not a contractor".
 *
 * Real types, all of them, for the same reason as above. A contractor does not
 * mark their site up as a HardwareStore.
 */
const SUPPLIER_SCHEMA_TYPES = Object.freeze([
  "store",
  "hardwarestore",
  "homegoodsstore",
  "furniturestore",
  "gardenstore",
  "wholesalestore",
  "onlinestore",
]);

/** Words that only a distributor uses about itself, matched in the TITLE. */
const SUPPLIER_TITLE_WORDS = /\b(wholesale|wholesaler|distributor|distribution|grossiste|fournisseur|quincaillerie)\b/;

// A shopping cart is deliberately NOT a veto, and this is the one place that
// decision costs something. classify.js's first version scored 73% because it
// treated a structural retail signal as decisive, and the businesses it threw
// away — Whistle Stop Fence Co, A1 Quality Decks — were contractors that sell
// what they install. A fence company with an online store for panels is that
// same business, and vetoing it here would repeat the mistake in a second
// file. What decides alone is the site marking itself up as a Store, or
// calling itself a distributor in its own title.

/**
 * What a business calls itself, per trade, in the two languages this market
 * speaks.
 *
 * ── Why French is not optional ────────────────────────────────────────────
 *
 * The source that motivated this file is Quebec's. A Montreal roofer's site
 * says "couvreur" and "toiture" and never says "roofing", and an English-only
 * vocabulary would resolve almost none of the 54,264 licences the RBQ
 * publishes. Accents are stripped on both sides (see `fold` below), so entries
 * here are written unaccented on purpose — `ebenisterie`, not `ébénisterie`.
 *
 * ── Why several of these are multi-word only ──────────────────────────────
 *
 * A phrase that means the trade in one context and something else in another
 * is not in this list alone. `cabinet` is a dentist's office in French and a
 * ministry in English, so cabinets is reached through `armoires de cuisine`
 * and `cabinet maker`. `electrical` describes a hazard warning as often as a
 * contractor, so electrical is reached through `electricien` and `electrical
 * contractor`. Every entry below has to be a thing a business would put in its
 * own title.
 *
 * ── Every key is a DISCOVERY_TRADES key ───────────────────────────────────
 *
 * Asserted by the check, the same way trades.js's `categoryKeys` are asserted
 * against the real catalogue. A renamed trade fails the build rather than
 * silently pointing at nothing. And no phrase may be claimed by two trades —
 * `duplicateTradePhrases()` below is `duplicateSourceCategories()`'s
 * discipline applied to this vocabulary, for the same reason: a phrase two
 * trades both claim is a coin toss wearing a decision's clothes.
 */
export const TRADE_PHRASES = Object.freeze({
  painting: ["painting", "painter", "painters", "house painting", "peintre", "peintres", "peinture"],
  roofing: ["roofing", "roofer", "roofers", "roof repair", "toiture", "toitures", "couvreur", "couvreurs"],
  siding: ["siding", "revetement exterieur", "revetements exterieurs"],
  cabinets: [
    "cabinet maker",
    "cabinet makers",
    "cabinetry",
    "cabinet refacing",
    "cabinet refinishing",
    "kitchen cabinets",
    "armoires de cuisine",
    "ebenisterie",
    "ebeniste",
  ],
  flooring: ["flooring", "floor covering", "hardwood floors", "plancher", "planchers", "revetement de sol"],
  countertops: ["countertop", "countertops", "comptoir de cuisine", "comptoirs de cuisine"],
  plumbing: ["plumbing", "plumber", "plumbers", "plomberie", "plombier"],
  electrical: ["electrician", "electricians", "electrical contractor", "electrical services", "electricien", "electriciens"],
  hvac: ["hvac", "heating and cooling", "air conditioning", "furnace repair", "chauffage et climatisation", "climatisation", "cvac"],
  landscaping: ["landscaping", "lawn care", "lawn mowing", "amenagement paysager", "paysagiste", "entretien de pelouse"],
  carpentry: ["carpentry", "carpenter", "carpenters", "menuiserie", "menuisier"],
  drywall: ["drywall", "gyproc", "cloison seche", "tirage de joints"],
  tiling: ["tiling", "tile installation", "tile setter", "pose de ceramique", "carrelage"],
  gutters: ["gutter", "gutters", "eavestrough", "eavestroughs", "gouttiere", "gouttieres"],
  fencing: ["fencing", "fence installation", "fence company", "cloture", "clotures"],
  masonry_concrete: ["masonry", "bricklaying", "concrete contractor", "maconnerie", "briquetage", "beton"],
  paving: ["paving", "asphalt paving", "driveway sealing", "pavage", "asphaltage"],
  insulation: ["insulation", "spray foam", "isolation", "isolant"],
  restoration: [
    "water damage restoration",
    "fire damage restoration",
    "disaster restoration",
    "apres sinistre",
    "restauration apres sinistre",
  ],
  chimney: ["chimney sweep", "chimney", "ramonage", "ramoneur"],
  pressure_washing: ["pressure washing", "power washing", "lavage a pression"],
  junk_removal: ["junk removal", "rubbish removal", "debarras", "enlevement de dechets"],
  house_cleaning: ["house cleaning", "residential cleaning", "maid service", "menage residentiel", "entretien menager"],
  carpet_cleaning: ["carpet cleaning", "nettoyage de tapis"],
  window_cleaning: ["window cleaning", "window washing", "lavage de vitres", "nettoyage de vitres"],
  handyman: ["handyman", "handyman services", "homme a tout faire"],
  excavation: ["excavation", "excavating", "excavateur"],
  demolition: ["demolition", "demolition contractor"],
  garage_door: ["garage door", "garage doors", "porte de garage", "portes de garage"],
  locksmith: ["locksmith", "serrurier", "serrurerie"],
  appliance_repair: ["appliance repair", "reparation electromenagers", "reparation d electromenagers"],
  pest_control: ["pest control", "exterminator", "extermination", "gestion parasitaire"],
  tree_care: ["tree service", "tree removal", "arborist", "emondage", "arboriculture", "abattage d arbres"],
  pool_spa: ["pool service", "hot tub", "swimming pool", "piscine", "piscines"],
  irrigation: ["irrigation", "sprinkler system"],
  snow_removal: ["snow removal", "snow plowing", "deneigement"],
  home_inspection: ["home inspection", "home inspector", "inspection en batiment", "inspecteur en batiment"],
  remodeling: [
    "kitchen remodeling",
    "bathroom remodeling",
    "home remodeling",
    "renovation de cuisine",
    "renovation de salle de bain",
  ],
  general_contracting: ["general contractor", "general contracting", "entrepreneur general", "construction generale"],
});

/** Trade keys named here that DISCOVERY_TRADES does not ship. Empty, checked. */
export function unknownTradeKeys() {
  return Object.keys(TRADE_PHRASES).filter((key) => !isDiscoveryTradeKey(key));
}

/** Trades DISCOVERY_TRADES ships that no phrase can ever reach. Reported, not
 *  hidden: a trade with no vocabulary is one this detector will never resolve,
 *  and a superadmin looking at an empty queue deserves to know which. */
export function tradesWithoutPhrases() {
  return Object.keys(DISCOVERY_TRADES).filter((key) => !TRADE_PHRASES[key]?.length);
}

/** Phrases claimed by more than one trade. Empty, and checked — the same rule
 *  and the same reason as trades.js's duplicateSourceCategories(). */
export function duplicateTradePhrases() {
  const seen = new Map();
  const dupes = [];
  for (const [tradeKey, phrases] of Object.entries(TRADE_PHRASES)) {
    for (const phrase of phrases) {
      const key = fold(phrase);
      if (seen.has(key)) dupes.push({ phrase: key, trades: [seen.get(key), tradeKey] });
      else seen.set(key, tradeKey);
    }
  }
  return dupes;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Matching
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Lowercase, unaccented, and with every run of non-alphanumerics collapsed to
 * one space.
 *
 * The last part is what makes one vocabulary serve both prose and URLs:
 * "toiture-montreal", "toiture_montreal" and "/services/toiture/" all fold to
 * a string containing " toiture ", so `couvreur-rive-sud.ca/nos-services` is
 * matched by the same entry that matches a sentence.
 */
export function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Built once, at module load. Rebuilding forty regexes per page would turn the
// hottest loop in the stage into a compile.
const PHRASE_MATCHERS = (() => {
  const out = new Map();
  for (const [tradeKey, phrases] of Object.entries(TRADE_PHRASES)) {
    const alternatives = [...phrases]
      // Longest first, so "cabinet refinishing" is reported as the match
      // rather than the shorter entry that also fits.
      .sort((a, b) => b.length - a.length)
      .map((p) => fold(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s"));
    // Space-anchored rather than \b: the folded haystack is always
    // space-separated, and \b would let "repaint" match "paint".
    out.set(tradeKey, new RegExp(`(?:^| )(${alternatives.join("|")})(?: |$)`));
  }
  return out;
})();

/** The phrase this trade's vocabulary matched in `haystack`, or null. */
export function matchTradePhrase(tradeKey, haystack) {
  const re = PHRASE_MATCHERS.get(tradeKey);
  if (!re) return null;
  const found = re.exec(` ${fold(haystack)} `);
  return found ? found[1] : null;
}

/** Every schema.org `@type` token this page declares, folded. */
function schemaTypesOn(page) {
  const types = new Set();
  for (const block of page?.schema || []) {
    // The crawler stores BOTH the raw block and a comma-joined list of its
    // `@type` values (evidence.js's schemaTypesOf), and pagesFromEvidence
    // pushes both into `schema`. Scanning for the token in either is what lets
    // this work on a stored crawl and on a raw snapshot alike.
    const folded = fold(block);
    for (const token of folded.split(" ")) if (token) types.add(token);
  }
  return types;
}

/**
 * Is this page a shop's rather than a contractor's?
 *
 * Returns the observation that says so, or null. Narrow on purpose — see the
 * header, and classify.js's record of what a wide version cost.
 */
export function supplierSignal(page) {
  const types = schemaTypesOn(page);
  for (const type of SUPPLIER_SCHEMA_TYPES) {
    if (types.has(type)) return { kind: "schema_org", value: `schema.org type ${type}` };
  }

  const title = fold(page?.meta?.title);
  if (SUPPLIER_TITLE_WORDS.test(` ${title} `)) {
    return { kind: "meta", value: `title=${page?.meta?.title}` };
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   The detector
   ═══════════════════════════════════════════════════════════════════ */

function evidenceRow({ type, sourceUrl, rawValue, normalizedValue, confidence }) {
  return {
    type,
    source: "website",
    sourceUrl: sourceUrl || null,
    rawValue: String(rawValue ?? "").slice(0, 400),
    normalizedValue: String(normalizedValue ?? "").slice(0, 2000),
    confidence,
    detector: TRADE_DETECTOR,
    detectorVersion: TRADE_DETECTOR_VERSION,
  };
}

/**
 * Turn a crawl into at most one trade.
 *
 * @param crawl     anything normaliseCrawl understands — a raw page list or a
 *                  crawl rebuilt from stored evidence by pagesFromEvidence.
 * @param prospect  read ONLY for `tradeKey`, and only to report a
 *                  disagreement. This function never decides what to write;
 *                  the handler does, and it never overwrites.
 *
 * @returns {{ tradeKey: string|null, decision: "confirmed"|"weak"|"unknown",
 *             reason: string|null, confidence: object|null,
 *             inference: {kind:string, value:string}|null,
 *             candidates: object[], evidence: object[],
 *             disagreesWithSource: boolean, pagesConsidered: number }}
 *
 * `tradeKey` is non-null ONLY on a confirmed decision. That is deliberate API
 * shape rather than tidiness: a caller that writes `result.tradeKey` without
 * reading `result.decision` still cannot file a prospect under a trade the
 * evidence did not establish.
 */
export function inferTrade({ crawl = null, prospect = null } = {}) {
  const normalised = normaliseCrawl(crawl);
  const pages = loadedPages(normalised).filter(looksRendered);

  const base = {
    tradeKey: null,
    decision: "unknown",
    reason: null,
    confidence: null,
    inference: null,
    candidates: [],
    evidence: [],
    disagreesWithSource: false,
    pagesConsidered: pages.length,
  };

  if (pages.length === 0) {
    // "We did not manage to look", never "this business has no trade". The
    // same distinction enrichBusiness.js refuses to blur for hasWebsite.
    return { ...base, reason: normalised.blocked ? "blocked" : "no_page_rendered" };
  }

  for (const page of pages) {
    const supplier = supplierSignal(page);
    if (supplier) {
      return {
        ...base,
        reason: "supplier",
        evidence: [
          evidenceRow({
            type: supplier.kind,
            sourceUrl: page.finalUrl,
            rawValue: supplier.value,
            normalizedValue: "trade:supplier",
            confidence: 0.8,
          }),
        ],
      };
    }
  }

  // ── Gather, per trade, the distinct SIGNAL KINDS that fired ─────────────
  //
  // Distinct kinds, not hits: nine nav links saying "Roofing" are one reading
  // of one navigation. confidence.js's `usable()` dedupes by signal name for
  // the same reason, so counting hits here would disagree with the number the
  // confidence is computed from.
  const found = new Map();
  const note = (tradeKey, kind, row) => {
    if (!found.has(tradeKey)) found.set(tradeKey, { kinds: new Map() });
    const entry = found.get(tradeKey);
    if (!entry.kinds.has(kind)) entry.kinds.set(kind, row);
  };

  for (const page of pages) {
    const url = page.finalUrl || page.url || null;
    const schemaTypes = schemaTypesOn(page);

    for (const [type, tradeKey] of Object.entries(SCHEMA_TYPE_TRADES)) {
      if (!schemaTypes.has(type)) continue;
      note(
        tradeKey,
        "schema_org",
        evidenceRow({
          type: "schema_org",
          sourceUrl: url,
          rawValue: `@type: ${type}`,
          normalizedValue: `trade:${tradeKey}:schema_type`,
          confidence: 0.8,
        }),
      );
    }

    // The site's own title and meta description. A business's title is the one
    // sentence it wrote about itself for a stranger, which is why it counts as
    // structural where a paragraph does not.
    for (const field of ["title", "description", "og:title", "og:description"]) {
      const content = page.meta?.[field];
      if (!content) continue;
      for (const tradeKey of Object.keys(TRADE_PHRASES)) {
        const phrase = matchTradePhrase(tradeKey, content);
        if (!phrase) continue;
        note(
          tradeKey,
          "meta",
          evidenceRow({
            type: "meta",
            sourceUrl: url,
            rawValue: `${field}=${content}`,
            normalizedValue: `trade:${tradeKey}:${phrase}`,
            confidence: 0.6,
          }),
        );
      }
    }

    // URLs — the page's own and every link on it — and navigation labels. A
    // route called /services/toiture and a nav item labelled "Couvreur" are
    // both structure rather than prose.
    const routes = [url, ...(page.links || [])].filter(Boolean);
    for (const tradeKey of Object.keys(TRADE_PHRASES)) {
      let hit = null;
      for (const route of routes) {
        // Host and path, query dropped — see pathOf.
        const phrase = matchTradePhrase(tradeKey, pathOf(route));
        if (phrase) {
          hit = { raw: route, phrase };
          break;
        }
      }
      if (!hit) {
        for (const link of page.linkTexts || []) {
          const phrase = matchTradePhrase(tradeKey, link.text);
          if (phrase) {
            hit = { raw: `${link.text} → ${link.href || ""}`.trim(), phrase };
            break;
          }
        }
      }
      if (!hit) continue;
      note(
        tradeKey,
        "link",
        evidenceRow({
          type: "link",
          sourceUrl: url,
          rawValue: hit.raw,
          normalizedValue: `trade:${tradeKey}:${hit.phrase}`,
          confidence: 0.55,
        }),
      );
    }

    // Prose. Recorded, and it can neither create a candidate nor break a tie —
    // see the header.
    if (typeof page.text === "string" && page.text) {
      for (const tradeKey of Object.keys(TRADE_PHRASES)) {
        const phrase = matchTradePhrase(tradeKey, page.text);
        if (!phrase) continue;
        note(
          tradeKey,
          "page_content",
          evidenceRow({
            type: "page_content",
            sourceUrl: url,
            rawValue: excerptAround(page.text, phrase),
            normalizedValue: `trade:${tradeKey}:${phrase}`,
            confidence: 0.45,
          }),
        );
      }
    }
  }

  // ── Rank ────────────────────────────────────────────────────────────────
  const candidates = [];
  for (const [tradeKey, entry] of found) {
    const kinds = [...entry.kinds.keys()];
    const structural = kinds.filter((k) => TRADE_SIGNAL_KINDS[k]?.structural);
    // No structural signal means prose only, which is not a candidate at all.
    if (structural.length === 0) continue;
    const signals = kinds.map((k) => TRADE_SIGNAL_KINDS[k].signal);
    candidates.push({
      tradeKey,
      label: discoveryTradeLabel(tradeKey),
      kinds,
      structuralKinds: structural,
      hasSchema: structural.includes("schema_org"),
      signals,
      // What DECIDES is the structural set; what is REPORTED is everything,
      // so a trade established by title and route reads a little surer when
      // the body text agrees with it. Two calls rather than one because those
      // are two different questions and collapsing them would let prose
      // promote a single-signal trade to confirmed.
      decisive: fieldConfidence({ signals: structural.map((k) => TRADE_SIGNAL_KINDS[k].signal) }),
      confidence: fieldConfidence({ signals }),
      evidence: [...entry.kinds.values()],
    });
  }

  if (candidates.length === 0) {
    return { ...base, reason: "no_trade_signal" };
  }

  candidates.sort(
    (a, b) =>
      Number(b.hasSchema) - Number(a.hasSchema) ||
      b.structuralKinds.length - a.structuralKinds.length ||
      (b.confidence.value ?? 0) - (a.confidence.value ?? 0) ||
      a.tradeKey.localeCompare(b.tradeKey),
  );

  const [leader, runnerUp] = candidates;
  const evidence = candidates.flatMap((c) => c.evidence);

  // A tie on the strongest evidence class present. Not "the sort put this one
  // first" — the sort's last tiebreak is alphabetical, which is precisely the
  // array order this whole file refuses to call a decision.
  const contested =
    Boolean(runnerUp) &&
    runnerUp.hasSchema === leader.hasSchema &&
    runnerUp.structuralKinds.length === leader.structuralKinds.length;

  if (contested) {
    return {
      ...base,
      decision: "weak",
      reason: "contested",
      confidence: leader.confidence,
      inference: { kind: TRADE_INFERENCE_KIND, value: MULTI_TRADE },
      candidates,
      evidence,
    };
  }

  // The three-valued outcome, straight out of confidence.js — see the header.
  const decisive = leader.decisive;
  const confirmed = decisive.verifying === true || decisive.sampleSize >= 2;

  return {
    ...base,
    tradeKey: confirmed ? leader.tradeKey : null,
    decision: confirmed ? "confirmed" : "weak",
    reason: confirmed ? null : decisive.reason || "single_soft_signal",
    confidence: leader.confidence,
    inference: { kind: TRADE_INFERENCE_KIND, value: leader.tradeKey },
    candidates,
    evidence,
    // Reported, never acted on. A directory saying painting and the company's
    // own site saying roofing is a fact worth a human's ten seconds; resolving
    // it by overwriting would move a prospect between queues, which is a
    // destructive operation wearing a cosmetic label.
    disagreesWithSource:
      typeof prospect?.tradeKey === "string" &&
      prospect.tradeKey.length > 0 &&
      confirmed &&
      prospect.tradeKey !== leader.tradeKey,
    pagesConsidered: pages.length,
  };
}

/**
 * A URL with its scheme, query and fragment removed.
 *
 * The QUERY is dropped because a phrase inside one is somebody else's search
 * term — `?q=roofing` on a directory listing is not a claim by this site.
 *
 * The HOST is kept, because `couvreur-rive-sud.ca` is a claim a contractor
 * paid for. Note what that does and does not reach: `fold` splits on
 * non-alphanumerics and the matcher is space-anchored, so a run-together
 * `couvreursmontreal.ca` does NOT match. That is the conservative direction
 * and the same one splitUrlPattern takes in technology.js, where the cost of
 * a substring match is `notjobber.com` matching `jobber.com`.
 */
function pathOf(value) {
  return String(value ?? "")
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .split(/[?#]/)[0];
}

/** Enough words either side of the match for a human to judge it. */
function excerptAround(text, phrase) {
  const folded = fold(text);
  const at = folded.indexOf(fold(phrase));
  if (at === -1) return String(text).slice(0, 200);
  const from = Math.max(0, at - 90);
  return `${from > 0 ? "…" : ""}${folded.slice(from, at + phrase.length + 90)}…`;
}
