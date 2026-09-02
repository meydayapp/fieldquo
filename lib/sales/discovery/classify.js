// lib/sales/discovery/classify.js
//
// Is this business a CONTRACTOR, or a shop that sells the same materials?
//
// ══ The waste this exists to prevent ═══════════════════════════════════════
//
// Overture's `painting` category contains Benjamin Moore, Dulux and
// Sherwin-Williams. A rep calling a Dulux branch to sell field-service
// software wastes the call, wastes the branch manager's time, and — because
// they will be told "we're a paint store" in the first ten seconds — teaches
// the rep that the list is junk. One in forty of those is enough to make a rep
// stop trusting the queue, which costs far more than the forty calls.
//
// ══ Why the answer is three-valued ═════════════════════════════════════════
//
// A flooring business with a showroom is genuinely both. So is "Phil's Lawn,
// Landscaping & Nursery". Forcing those into contractor or retailer is a
// coin-toss recorded as a fact, so the third value exists and it is the one
// this file reaches for whenever the evidence points both ways.
//
// `needs_review` is a real state with a real screen behind it
// (/platform/sales/campaigns/[id]), not a bin. A superadmin accepts or rejects
// each one, and until they do, no rep sees the row.
//
// ══ What was MEASURED, on 278,879 real Overture rows ═══════════════════════
//
// Every rule below was chosen by querying the sample and then hand-checking a
// stratified draw of what the rules produced. Four findings changed the design,
// and the fourth changed it twice:
//
//   1. `tax_hierarchy[0] === "shopping"` is a clean systemic signal — 6,147
//      rows of the sample, the source itself saying "this is a shop".
//   2. `home_improvement_store` as an ALTERNATE is noise, not signal. 6,128
//      of the nine core categories' rows carry it, and the names include
//      CertaPro Painters, Refresh Painting and Wow 1 Day Painting. It is a
//      Facebook page category a painter picked for themselves. Treating it as
//      a retail signal would send 7% of the queue to manual review to catch
//      almost nothing, so it is deliberately absent from every list here.
//   3. `wholesale_store` and `building_supply_store` as alternates DO carry
//      signal: Plumb Supply Company, Ferguson, Crescent Electric Supply,
//      Beacon Building Products.
//   4. **But they are not decisive on their own.** A first version of this
//      file treated them as decisive and scored 73% precision on a
//      hand-checked draw of 60 — it rejected Whistle Stop Fence Co, A1
//      Quality Decks, Hudson Valley HVAC and Cleveland Air Comfort, all of
//      which are contractors that happen to sell material too. Fence and deck
//      builders sell what they install; HVAC contractors carry stock. So a
//      structural retail signal is now a QUESTION (tier B below), and only the
//      NAME — a chain, or the words supply / wholesale / distribution — is
//      allowed to decide on its own.
//
// ══ The three tiers, and why the order is what it is ═══════════════════════
//
//   A. The name says it sells goods → retailer. Decisive, because "Ferguson
//      Plumbing Supply" is not a plumber under any reading.
//   B. The STRUCTURE says shop (taxonomy, primary category, supplier
//      alternate). Decisive only when nothing says contractor; when the same
//      row also carries a contractor signal it goes to review, because that
//      is the fence company that sells fence panels.
//   C. Merely ambiguous — a retail alternate, a showroom in the name → review.
//   D. A contractor signal and nothing against it → contractor.
//   E. Nothing said anything → review. Not contractor: absence of a statement
//      is not a statement (AGENTS.md failure class 5).
//
// ══ Bias, stated ══════════════════════════════════════════════════════════
//
// The rules are tuned so an uncertain row goes to `needs_review` rather than
// to either verdict. The costs are asymmetric: a contractor wrongly marked
// retailer is silently lost from the market and nobody ever finds out; a
// retailer wrongly marked contractor is a wasted call. A row in `needs_review`
// costs a superadmin four seconds and loses nothing.

/** The three verdicts. Nothing else may be written to Prospect.classification. */
export const CLASSIFICATIONS = ["contractor", "retailer", "needs_review"];

export function isClassification(value) {
  return CLASSIFICATIONS.includes(value);
}

/**
 * Category names that mean "a shop" when they are the PRIMARY category.
 *
 * Structural, so tier B: decisive only against a row with no contractor signal
 * of its own.
 */
export const RETAIL_CATEGORIES = [
  "paint_store",
  "hardware_store",
  "home_improvement_store",
  "home_goods_store",
  "carpet_store",
  "flooring_store",
  "lighting_store",
  "furniture_store",
  "building_supply_store",
  "lumber_store",
  "wholesale_store",
  "online_shop",
  "nursery_and_gardening",
  "appliance_store",
  "kitchen_and_bath",
  "home_decor",
];

/**
 * Alternates that mean "distributes to the trade".
 *
 * Tier B rather than decisive — see finding 4. A fence company that stocks
 * panels carries `building_supply_store` and is still a fence company.
 */
export const SUPPLIER_ALTERNATES = ["wholesale_store", "building_supply_store", "lumber_store"];

/**
 * Alternates that mean "sells goods as well", which is a question and not an
 * answer. Tier C.
 *
 * `home_improvement_store` is NOT here. See finding 2.
 */
export const AMBIGUOUS_ALTERNATES = [
  "retail",
  "paint_store",
  "hardware_store",
  "carpet_store",
  "flooring_store",
  "lighting_store",
  "furniture_store",
  "home_goods_store",
  "online_shop",
  "appliance_store",
];

/**
 * Chains and manufacturers that sell materials, never labour.
 *
 * A brand name is the strongest signal available for the case the taxonomy
 * misses entirely — "Benjamin Moore" filed as `painting` with no alternate
 * category at all, which no structural rule can catch. Matched on word
 * boundaries against the normalised name, so "Moore Painting" does not match
 * "Benjamin Moore" and "Homer Depot Painting" does not match "Home Depot".
 *
 * Kept short and specific on purpose. Generic words here would start rejecting
 * contractors, and a contractor rejected as a retailer is invisible.
 */
export const RETAIL_BRANDS = [
  "benjamin moore",
  "sherwin williams",
  "dulux",
  "betonel",
  "behr",
  // "ppg" and "sico" are bare on purpose: the sample carries "PPG Industries"
  // and "Sico Pro Ctr" as well as "PPG Paints Store", and the flattened match
  // is word-bounded, so "Corona Plumbing" does not match "rona".
  "ppg",
  "sico",
  "para paints",
  "cloverdale paint",
  "home depot",
  "lowes",
  "rona",
  "reno depot",
  "home hardware",
  "canadian tire",
  "ace hardware",
  "menards",
  "true value hardware",
  "floor and decor",
  "ferguson",
  "abc supply",
  "beacon building products",
];

/**
 * Phrases in a business name that mean it sells materials. Tier A — decisive.
 *
 * Every one was read off real rows in the sample. They are allowed to decide
 * alone precisely because they are the business SAYING what it is: nobody
 * calls a painting contractor "Plumb Supply Company".
 */
export const SUPPLIER_NAME_PATTERNS = [
  /\bsupply\b/,
  /\bsupplies\b/,
  /\bwholesale(?:rs?)?\b/,
  /\bdistribut(?:or|ors|ion|ing)\b/,
  /\bbuilding products\b/,
  /\bbuilding materials\b/,
  /\bmaterials\b/,
  /\bmillwork\b/,
  /\bpaint store\b/,
  /\blumber\b/,
  /\bparts (?:store|centre|center)\b/,
];

/**
 * Words that make a name AMBIGUOUS rather than retail. Tier C.
 *
 * "Showroom" and "outlet" belong to shops; "centre" and "depot" appear in both
 * ("Ottawa Roofing Centre" is a roofer). None decides anything on its own.
 */
export const AMBIGUOUS_NAME_PATTERNS = [
  /\bshowroom\b/,
  /\boutlet\b/,
  /\bwarehouse\b/,
  /\bdepot\b/,
  /\bdealers?\b/,
  /\brentals?\b/,
  /\bmanufactur(?:er|ers|ing)\b/,
  /\bstore\b/,
];

/** Alternates that say outright "this is a contractor". */
export const CONTRACTOR_ALTERNATES = [
  "contractor",
  "construction_services",
  "general_contractor",
  "builders",
  "handyman",
];

/**
 * Trade words in a business name. A contractor signal, never a verdict.
 *
 * These exist for one job: to stop tier B rejecting a business whose own name
 * says it does the work. "The Roofing Guys Inc" arrived filed under
 * `building_supply_store` and "R&L Electric, LLC" under `shopping`; the
 * taxonomy was simply wrong about both, and their names are the evidence.
 *
 * NOT used to promote anything to `contractor` — a trade word in a name is
 * equally present in "Ottawa Paint Store", which is why tier A runs first.
 */
export const TRADE_NAME_PATTERNS = [
  /\bcontract(?:or|ors|ing)\b/,
  /\bconstruction\b/,
  /\bbuilders?\b/,
  /\bremodel(?:ing|ling|ers)?\b/,
  /\brenovations?\b/,
  /\brestorations?\b/,
  /\bservices?\b/,
  /\brepairs?\b/,
  /\binstallations?\b/,
  /\broof(?:ing|ers)?\b/,
  /\bplumb(?:ing|er|ers)\b/,
  /\belectric(?:al|ian|ians)?\b/,
  /\bhvac\b/,
  /\bheating\b/,
  /\bcooling\b/,
  /\bair conditioning\b/,
  /\bpaint(?:ing|ers)\b/,
  /\blandscap(?:e|es|ing|ers)\b/,
  /\blawn\b/,
  /\bpaving\b/,
  /\bmasonry\b/,
  /\bconcrete\b/,
  /\bdrywall\b/,
  /\bflooring\b/,
  /\bcabinet(?:s|ry)?\b/,
  /\bdecks?\b/,
  /\bfenc(?:e|es|ing)\b/,
  /\bgutters?\b/,
  /\bsiding\b/,
  /\bexcavat(?:ion|ing|ors?)\b/,
  /\bdemolition\b/,
  /\bcleaning\b/,
  /\bchimney\b/,
  /\bpest\b/,
  /\btree (?:service|services|care|removal)\b/,
  /\bsnow removal\b/,
  /\birrigation\b/,
  /\binsulation\b/,
  /\btil(?:e|es|ing)\b/,
  /\bcarpentry\b/,
  /\bwoodwork(?:ing|s)?\b/,
  /\bhandyman\b/,
  /\bmechanical\b/,
  /\bsewer\b/,
  /\bseptic\b/,
  /\bhardscap(?:e|es|ing)\b/,
];

/**
 * A business name, flattened for matching.
 *
 * Markup is STRIPPED rather than refused. Overture names arrive with the odd
 * `&amp;`, a stray tag from whatever scraped them, and a non-breaking space; a
 * name that failed to match a brand because it contained `<b>` would be a
 * retailer admitted on a technicality. The stored `businessName` keeps its own
 * cleaning — see normalise.js — this is only the matching form.
 */
export function normaliseNameForMatch(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#0?39|apos|nbsp);/gi, " ")
    .toLowerCase()
    // Keep letters, digits and spaces; everything else becomes a boundary, so
    // "Sherwin-Williams" and "Sherwin Williams" match the same brand entry,
    // and so does any Unicode punctuation or whitespace the source carried.
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesBrand(name) {
  if (!name) return null;
  const padded = ` ${name} `;
  for (const brand of RETAIL_BRANDS) {
    const flat = normaliseNameForMatch(brand);
    if (!flat) continue;
    if (padded.includes(` ${flat} `)) return brand;
  }
  return null;
}

function firstMatch(name, patterns) {
  if (!name) return null;
  for (const pattern of patterns) if (pattern.test(name)) return pattern.source;
  return null;
}

function hasAny(list, values) {
  const set = new Set(Array.isArray(list) ? list.filter((v) => typeof v === "string") : []);
  return values.find((v) => set.has(v)) || null;
}

/**
 * Decide what kind of business this is.
 *
 * Pure. Takes an already-shaped source row so it can be executed against
 * hostile input without a database or a provider — see
 * scripts/check-sales-discovery.mjs.
 *
 * @param {{
 *   name?: string|null,
 *   categories?: {primary?: string|null, alternate?: string[]},
 *   taxonomyHierarchy?: string[],
 * }} row
 * @returns {{ classification: "contractor"|"retailer"|"needs_review",
 *             reasons: string[], reason: string }}
 *          `reasons` are rule ids, stable enough to count; `reason` is the one
 *          sentence the screen shows. Both, because a funnel needs the first
 *          and a human needs the second.
 */
export function classifyBusiness(row = {}) {
  const name = normaliseNameForMatch(row?.name);
  const categories = row?.categories || {};
  const primary = typeof categories.primary === "string" ? categories.primary.trim() : "";
  const alternates = Array.isArray(categories.alternate) ? categories.alternate : [];
  const hierarchy = Array.isArray(row?.taxonomyHierarchy)
    ? row.taxonomyHierarchy.filter((h) => typeof h === "string")
    : [];

  // ── Tier A: the name says it sells goods ────────────────────────────────

  const brand = matchesBrand(name);
  if (brand) {
    return {
      classification: "retailer",
      reasons: [`retail_brand:${brand}`],
      reason: `The name matches ${brand}, which sells materials rather than labour.`,
    };
  }

  const supplierName = firstMatch(name, SUPPLIER_NAME_PATTERNS);
  if (supplierName) {
    return {
      classification: "retailer",
      reasons: [`supplier_name:${supplierName}`],
      reason: "The name says supply, wholesale, lumber or distribution.",
    };
  }

  // ── What the row says in its own right ──────────────────────────────────

  const structural = [];
  if (hierarchy[0] === "shopping") structural.push("taxonomy_shopping");
  if (primary && RETAIL_CATEGORIES.includes(primary)) structural.push(`primary_category:${primary}`);
  const supplierAlternate = hasAny(alternates, SUPPLIER_ALTERNATES);
  if (supplierAlternate) structural.push(`supplier_alternate:${supplierAlternate}`);

  const contractorSignals = [];
  const contractorAlternate = hasAny(alternates, CONTRACTOR_ALTERNATES);
  if (contractorAlternate) contractorSignals.push(`contractor_alternate:${contractorAlternate}`);
  // The source ALSO files this under home services. Measured: within the nine
  // core trade categories this holds for 100% of rows, which is what makes it
  // the default in tier D rather than a tie-breaker.
  if (hierarchy.includes("home_service")) contractorSignals.push("taxonomy_home_service");
  const tradeName = firstMatch(name, TRADE_NAME_PATTERNS);
  if (tradeName) contractorSignals.push(`trade_name:${tradeName}`);

  // ── Tier B: the structure says shop ─────────────────────────────────────

  if (structural.length) {
    if (contractorSignals.length) {
      return {
        classification: "needs_review",
        reasons: [...structural, ...contractorSignals],
        reason:
          "The source files this as a shop and as a trade at once — it may be a contractor that also sells material.",
      };
    }
    return {
      classification: "retailer",
      reasons: structural,
      reason: structuralSentence(structural),
    };
  }

  // ── Tier C: merely ambiguous ────────────────────────────────────────────

  const ambiguous = [];
  const ambiguousAlternate = hasAny(alternates, AMBIGUOUS_ALTERNATES);
  if (ambiguousAlternate) ambiguous.push(`retail_alternate:${ambiguousAlternate}`);
  const ambiguousName = firstMatch(name, AMBIGUOUS_NAME_PATTERNS);
  if (ambiguousName) ambiguous.push(`ambiguous_name:${ambiguousName}`);
  // No name at all: none of the name rules could run, and the structural rules
  // alone are not enough to call it a contractor.
  if (!name) ambiguous.push("no_name");

  if (ambiguous.length) {
    return {
      classification: "needs_review",
      reasons: ambiguous,
      reason: ambiguousSentence(ambiguous),
    };
  }

  // ── Tier D: a contractor signal and nothing against it ──────────────────

  if (contractorSignals.length) {
    return {
      classification: "contractor",
      reasons: contractorSignals,
      reason: "Filed by the source under home services, with no retail or supplier signal.",
    };
  }

  // ── Tier E ──────────────────────────────────────────────────────────────

  return {
    classification: "needs_review",
    reasons: ["no_signal"],
    reason: "Nothing in the source says whether this is a contractor or a shop.",
  };
}

function structuralSentence(reasons) {
  const first = reasons[0] || "";
  if (first.startsWith("primary_category:")) {
    return `The source's own primary category is ${first.slice("primary_category:".length)}, a shop.`;
  }
  if (first.startsWith("supplier_alternate:")) {
    return "The source also files this as a wholesaler or building supplier.";
  }
  return "The source files this under shopping rather than home services.";
}

function ambiguousSentence(reasons) {
  const first = reasons[0] || "";
  if (first === "no_name") return "The source carries no usable business name.";
  if (first.startsWith("retail_alternate:")) {
    return "The source lists this as a shop as well as a trade — it may be a contractor with a showroom.";
  }
  return "The name reads like a shop as well as a trade.";
}
