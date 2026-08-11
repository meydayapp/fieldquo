// app/data/plumbingBenchmarks.js
//
// ── Nothing here is client-facing ───────────────────────────────────────────
//
// These are the market ranges a plumber is shown in the BACK OFFICE while
// setting their own prices — "typical range $1,200–$2,000, most often $1,500;
// set your price". Not one number in this file may land on a quote, an
// invoice, a PDF or an email. They are national aggregates; the contractor's
// own market, crew and overhead are the only things that make a price true,
// and Part 4 rule #2 of docs/trade-pricing-research.md decided that the number
// stays theirs. app/data/plumbingCatalog.js ships the list with no rate at all;
// this file is why that is not a cop-out.
//
// scripts/check-plumbing-catalog.mjs walks app/quote, app/book, app/q,
// app/portal, app/site and app/embed and fails if any of them import this
// module, the same boundary scripts/check-rewire.mjs enforces on the takeoff
// model.
//
// ── Confidence, and the four honest ways to have no number ──────────────────
//
// The tag style is lib/estimate/rewireTakeoff.js's, in lower case because
// these are data values rather than source comments:
//
//   "read"       Published band, cited in `basis`.
//   "derived"    Computed by us from read inputs. The arithmetic is in `basis`.
//   "guess"      Invented. Says in `basis` what it was sanity-checked against.
//   "unverified" There is no number. Only ever appears with `unpriced: true`.
//
// AGENTS.md failure class 5 — absence of a statement is not a statement — is
// the whole reason the next four flags exist instead of a plausible midpoint.
// A benchmark may be missing its centre in four distinct ways, and they mean
// different things to the contractor reading the panel:
//
//   `unpriced: true`          No independent read exists at all. All three
//                             values null, confidence "unverified", `reason`
//                             says what was looked for and not found. Roughly
//                             a third of this file. That is the honest state
//                             of published plumbing pricing, not a gap in the
//                             research — §2D.1 warns Homewyse contaminated
//                             every fixture-install search at ~2× the
//                             independent reads, and a padded band would be
//                             worse than a blank one.
//
//   `noNationalDefault: true` A range is published but a centre is a fiction.
//                             Permits span 57× ($7 Chesapeake VA to $300–400
//                             San Francisco); a sewer spot repair spans 25×.
//                             The midpoint of a 25× band is not information.
//
//   `priceIsMultiplier: true` The reliable published form is a multiplier, not
//                             an absolute — after-hours 1.5×, weekend 2×,
//                             holiday 2–3×, galvanised removal +10–20%.
//                             Storing an absolute would discard the finding.
//
//   `singleObservation: true` One real figure from the owner's own estimates
//                             (§2B.4) and nothing to bracket it with. Shown as
//                             a data point, never as a band, because two of
//                             these are explicitly listed in §2D.8 as things
//                             that could not be corroborated.
//
// ── The one cross-trade finding that must not be smoothed away ──────────────
//
// §2D.3: plumbing equipment takes 2–3×; electrical high-value equipment takes
// 10–15%. Both are correct and the trades genuinely differ — an electrical
// panel is a commodity the homeowner cannot shop, a Bradford White 50-gallon is
// a model number they can Google in ten seconds, and contractors still take
// 2–3× on it. The owner's own estimate sells a ~$1,000 heater at $2,664, which
// is 2.66×. A single global markup multiplier fails on both trades in opposite
// directions, so `equipmentMarkup` is per item and the check script refuses any
// value below 1.5× — that is the tripwire for the electrical band leaking in.

import { PLUMBING_LINE_ITEMS_BY_KEY } from "@/app/data/plumbingCatalog";

/** The only legal `confidence` values. Anything else is a typo that would
 *  otherwise render as a confident-looking label. */
export const BENCHMARK_CONFIDENCE = ["read", "derived", "guess", "unverified"];

/** The exact words the back office puts above any range from this file. It is
 *  a constant so it cannot drift into something that reads like a price. */
export const BENCHMARK_PRESENTATION = "Typical range — set your price";

// ── Shared structures ───────────────────────────────────────────────────────

/**
 * Warranty is not one company-wide string. §2D.5: Roto-Rooter's own national
 * guarantees page publishes a different term per service line, and the owner's
 * Indianapolis work order publishes a residential/commercial split on top of
 * that. A price-book item storing one term is wrong.
 *
 * Parts and labour do not move together and not always in the direction you
 * would guess: a water heater is a 6-year part with 1–2 year labour, while one
 * documented case runs 90 days parts against 30 days labour.
 */
export const WARRANTY = {
  /* Drain cleaning is the anomaly and deliberately the shortest in the trade.
     It is not a workmanship warranty at all — it is a performance guarantee on
     a pipe the contractor did not build and the customer keeps using. */
  drainCleaning: {
    partsTerm: "6 months",
    labourTerm: "6 months",
    residential: { partsTerm: "6 months", labourTerm: "6 months" },
    commercial: { partsTerm: "30 days", labourTerm: "30 days" },
    conditional: "Clear the blockage, or no labour charge",
    basis: "§2D.5 — Roto-Rooter national guarantees page (drain cleaning 6 months, conditional); the residential/commercial split is from the owner's Indianapolis work order",
    confidence: "read",
    caution:
      "§2D.5: the residential/commercial split is not independently confirmed beyond the owner's document, and Roto-Rooter's own page says terms vary by location.",
  },
  /* Nothing about an auger fixes what gets flushed, which is why a term this
     short is honest rather than stingy. */
  toiletAuger: {
    partsTerm: "7 days",
    labourTerm: "7 days",
    residential: { partsTerm: "7 days", labourTerm: "7 days" },
    commercial: { partsTerm: "24 hours", labourTerm: "24 hours" },
    basis: "§2B.1 #5 — Roto-Rooter work order, Indianapolis, 2026-02-20",
    confidence: "read",
    caution:
      "§2D.5: the 7-day term does not appear on Roto-Rooter's national page. Single-document evidence.",
  },
  repair: {
    partsTerm: "6 months",
    labourTerm: "6 months",
    residential: { partsTerm: "6 months", labourTerm: "6 months" },
    commercial: { partsTerm: "90 days", labourTerm: "90 days" },
    basis: "§2B.1 #5 — plumbing repair 6 months residential / 90 days commercial; §2D.5 industry norm is 30 days to 1 year",
    confidence: "read",
  },
  replacement: {
    partsTerm: "1 year",
    labourTerm: "1 year",
    residential: { partsTerm: "1 year", labourTerm: "1 year" },
    commercial: { partsTerm: "90 days", labourTerm: "90 days" },
    basis: "§2B.1 #5 — plumbing replacement 1 year residential / 90 days commercial; §2D.5 major install 1–2 years",
    confidence: "read",
  },
  /* The split that proves the point: one line cannot carry both terms, which
     is exactly why §2B.1 #2 separates equipment from its install package. */
  waterHeater: {
    partsTerm: "6 years (manufacturer, tank)",
    labourTerm: "1 year",
    residential: { partsTerm: "6 years (manufacturer, tank)", labourTerm: "1 year" },
    commercial: { partsTerm: "6 years (manufacturer, tank)", labourTerm: "90 days" },
    basis: "§2D.5 — Roto-Rooter publishes 1 year plus a 6-year manufacturer tank term; the owner's set shows 6-year parts / 2-year labour and a 2-year labour install package",
    confidence: "read",
    caution:
      "The commercial labour term is inferred from the general commercial pattern, not published for water heaters specifically.",
  },
  repipe: {
    partsTerm: "10 years",
    labourTerm: "10 years",
    residential: { partsTerm: "10 years", labourTerm: "10 years" },
    commercial: null,
    basis: "§2B.1 #5 — 10-year materials and labour on the owner's repipe; §2D.5 industry norm is 2–5 years, to 10",
    confidence: "read",
    caution:
      "10 years is the top of the published band, not the middle. §2D.5's norm is 2–5 years — a company should not adopt 10 without meaning it.",
  },
  excavation: {
    partsTerm: "5 years",
    labourTerm: "5 years",
    residential: { partsTerm: "5 years", labourTerm: "5 years" },
    commercial: null,
    basis: "§2D.5 — Roto-Rooter publishes excavation & relining at 5 years; the owner's directional bore carries 10-year materials and labour",
    confidence: "read",
  },
  valve: {
    partsTerm: "2 years",
    labourTerm: "2 years",
    residential: { partsTerm: "2 years", labourTerm: "2 years" },
    commercial: null,
    basis: "§2B.1 #5 — 2-year term on the owner's PRV",
    confidence: "read",
  },
  gasMinor: {
    partsTerm: "1 year",
    labourTerm: "1 year",
    residential: { partsTerm: "1 year", labourTerm: "1 year" },
    commercial: null,
    basis: "§2B.1 #5 — 1-year term on the owner's minor gas repair",
    confidence: "read",
  },
};

/**
 * §2B.1 #3 and §2D.4. The levels themselves are ordinary; **printing the
 * criteria on the customer's document is the differentiator** — §2D.4 checked
 * and found no source that recommends it, and called it the most copyable idea
 * in the estimate set. It converts a judgement call the client has to trust
 * into a fact they can check, which is how a difficulty multiplier stops being
 * a dispute.
 *
 * ⚠️ There is deliberately no multiplier between the levels. Only one level is
 * priced anywhere in the research (the owner's Level 3 at $976/fixture), and
 * §2D.1 puts that figure at the MIDPOINT of the whole published $550–1,200
 * band — so the band is not level-stratified and inventing a 1.0 / 1.2 / 1.5
 * ladder would be a number with nothing behind it. What IS quantified lives in
 * STRUCTURE_ADJUSTMENTS below.
 */
export const REPIPE_DIFFICULTY_TIERS = [
  {
    level: 1,
    label: "Level 1 — open access",
    printOnDocument: true,
    criteria: [
      "Accessible crawlspace, basement or attic with room to work",
      "No demolition needed to reach the pipe",
    ],
    confidence: "derived",
    basis:
      "§2B.1 #3 spells out Level 3 only; Levels 1 and 2 are the stated residual — what is left once the Level 3 conditions are absent.",
  },
  {
    level: 2,
    label: "Level 2 — restricted access",
    printOnDocument: true,
    criteria: [
      "Tight or partially obstructed crawlspace",
      "Limited working height or awkward routing",
      "Drop ceiling that opens without demolition",
    ],
    confidence: "derived",
    basis: "§2B.1 #3 — Level 2 is named on the document but its criteria are not itemised there.",
  },
  {
    level: 3,
    label: "Level 3 — demolition or hostile access",
    printOnDocument: true,
    criteria: [
      "Crawlspace under 24 inches high",
      "Level 2 room in a hostile environment",
      "Sheetrock access — slab home or finished basement (add half a day to a full day of demolition)",
      "Extremely tough drop ceiling",
      "Every attic repipe fixture is Level 3",
    ],
    confidence: "read",
    basis: "§2B.1 #3 — criteria printed verbatim on the owner's $11,712 repipe (12 fixtures × $976).",
  },
];

/**
 * What §2D.4 actually quantified. These are adjustments to a repipe price, not
 * difficulty levels — a slab home is dearer whatever level the fixtures come
 * out at.
 */
export const STRUCTURE_ADJUSTMENTS = [
  {
    key: "slab_foundation",
    label: "Slab foundation (vs crawlspace)",
    uplift: { low: 0.2, high: 0.4 },
    confidence: "read",
    basis: "§2D.4 — slab homes +20–40% over crawlspace.",
  },
  {
    key: "multi_storey",
    label: "Multi-storey",
    uplift: { low: 0.1, high: 0.2 },
    confidence: "read",
    basis: "§2D.4 — multi-storey +10–20%.",
  },
  {
    key: "galvanised_removal",
    label: "Galvanised pipe to remove",
    uplift: { low: 0.1, high: 0.2 },
    confidence: "read",
    basis: "§2D.1 — galvanised removal +10–20%.",
  },
];

/**
 * §2D.1. The premium on emergency work is published as a multiplier and the
 * absolutes are not reliable, so this is the shape it is stored in.
 *
 * §2D.6 names the real dispute: emergency premiums compound three ways at once
 * — trip fee plus hourly multiplier plus holiday tier — and are almost never
 * all disclosed. A quote applying more than one of these must show each.
 */
export const AFTER_HOURS_MULTIPLIERS = {
  weeknight: { low: 1.5, typical: 1.5, high: 1.5 },
  weekend: { low: 2.0, typical: 2.0, high: 2.0 },
  holiday: { low: 2.0, typical: 2.5, high: 3.0 },
  confidence: "read",
  basis: "§2D.1 — after-hours weeknight 1.5×, weekend 2×, holiday 2–3×.",
};

/**
 * §2D.3. The tiered, inverse table everybody except ServiceTitan uses: the
 * cheaper the part, the higher the multiple. ServiceTitan argues instead for a
 * uniform 3–6× on everything purely for bookkeeping consistency; that position
 * is recorded rather than adopted, because the field does not work that way.
 *
 * ⚠️ Every multiple here is against RETAIL, because every price in
 * docs/plumbing-material-costs.md is retail (§11 of that document). Real
 * wholesale runs 25–45% below, which makes each of these a LOWER bound.
 */
export const EQUIPMENT_MARKUP_TIERS = [
  { partCostUnder: 25, low: 4.0, high: 5.0 },
  { partCostUnder: 100, low: 3.0, high: 4.0 },
  { partCostUnder: 500, low: 2.5, high: 3.0 },
  { partCostUnder: Infinity, low: 1.8, high: 2.5 },
];

/** The floor the check script enforces on every `equipmentMarkup`. Electrical's
 *  verified high-value equipment band is 1.10–1.15×, and §2D.3 says in terms
 *  that it must not be carried into plumbing. If a value here ever drops below
 *  this, that is what has happened. */
export const MIN_PLUMBING_EQUIPMENT_MARKUP = 1.5;

/** Gross margin target on plumbing service and repair, §2D.3. Stated more
 *  confidently than electrical's 45–65%. The formula trap is worth repeating:
 *  price = cost ÷ (1 − margin), never cost × (1 + margin). */
export const GROSS_MARGIN_TARGET = {
  low: 0.6,
  typical: 0.61,
  high: 0.62,
  confidence: "read",
  basis: "§2D.3 — 60–62% gross margin on plumbing service/repair.",
  caution: "§2D.3: no verified plumbing NET-margin benchmark exists. Electrical's 10–20% is the only fallback.",
};

// ── Local builders, so 82 entries stay readable ─────────────────────────────

const usd = (low, typical, high, basis, confidence, extra = {}) => ({
  low,
  typical,
  high,
  currency: "USD",
  basis,
  confidence,
  includesPermit: false,
  ...extra,
});

/** No independent read exists. Not a placeholder — a statement. */
const unpriced = (reason, extra = {}) => ({
  low: null,
  typical: null,
  high: null,
  currency: "USD",
  basis: reason,
  confidence: "unverified",
  unpriced: true,
  reason,
  includesPermit: false,
  ...extra,
});

export const PLUMBING_BENCHMARKS = {
  // ── Service & diagnostics ─────────────────────────────────────────────────
  service_call: usd(
    89,
    120,
    175,
    "§2D.1 — service call / diagnostic $89–175 (full observed range $50–275).",
    "read",
    {
      creditedOnApproval: {
        // A live fork in both markets, and the trade's own stated best practice
        // is the second one — stated up front, before the van arrives.
        options: ["charged in full", "waived on approval of the work"],
        recommended: "waived on approval of the work",
        confidence: "read",
        basis: "§2D.1 — callout-credited-or-not is a live fork; the trade's best practice is a diagnostic fee waived on approval, stated up front.",
      },
      warranty: WARRANTY.repair,
    },
  ),

  emergency_callout: {
    low: null,
    typical: null,
    high: null,
    currency: "USD",
    basis: "§2D.1 — the reliable published form for emergency work is a multiplier, not an absolute.",
    confidence: "read",
    priceIsMultiplier: true,
    multipliers: AFTER_HOURS_MULTIPLIERS,
    reason:
      "The absolute depends entirely on the company's own standard call-out, which this file does not know. Storing a national dollar figure would discard the one thing that IS published — the multiplier — and §2D.6 shows emergency premiums are already a dispute because they compound undisclosed.",
    includesPermit: false,
    warranty: WARRANTY.repair,
  },

  labour_standard: usd(
    80,
    105,
    130,
    "§2D.2 — billed $80–130/hr standard residential. Loaded rate used inside flat-rate builds runs $90–160/hr; ServiceTitan's worked build is $28/hr wage → $62.29 break-even → $88.99 billed at a 30% net target.",
    "read",
    {
      caution:
        "§2D.2: no source publishes a metro/suburban/rural cut for plumbing. The one regional task grid suggests ~25% spread, a secondary claim says 30–60%. Do not tier this without local evidence.",
      warranty: WARRANTY.repair,
    },
  ),

  labour_emergency: usd(
    150,
    225,
    300,
    "§2D.1/§2D.2 — emergency hourly $150–300.",
    "read",
    { multipliers: AFTER_HOURS_MULTIPLIERS, warranty: WARRANTY.repair },
  ),

  leak_detection: usd(
    150,
    275,
    400,
    "§2D.1 — slab leak detection $150–400.",
    "read",
    {
      pricingModel: "time_and_materials",
      notToExceedCap: true,
      capBasis:
        "§2D.3 — T&M survives where it should (leak detection, complex troubleshooting, major repipes), 'often with a not-to-exceed cap'. The cap is the part that makes T&M acceptable to a homeowner.",
    },
  ),

  pressure_test: unpriced(
    "The only observation is AUD $95 on one Australian invoice (§2B.4). One foreign data point on a GST-inclusive market is not a USD band, and no US source publishes this task separately.",
    {
      observed: [
        { amount: 95, currency: "AUD", basis: "§2B.4 — Australian invoice, billed alongside a $130 call-out and $130 first labour hour." },
      ],
    },
  ),

  camera_inspection: usd(
    150,
    225,
    300,
    "§2D.1 — camera inspection carried out with a service call, $150–300.",
    "read",
  ),

  camera_inspection_standalone: {
    low: null,
    typical: null,
    high: 900,
    currency: "USD",
    basis: "§2D.1 — standalone camera inspection 'up to $900'. A ceiling is the only thing published.",
    confidence: "read",
    noNationalDefault: true,
    reason:
      "Only a ceiling was found. Inventing a floor and a centre underneath it would turn one published number into three, two of which nobody read.",
    includesPermit: false,
  },

  // ── Drains & sewer clearing ───────────────────────────────────────────────
  drain_clear_fixture: usd(
    175,
    260,
    350,
    "§2D.1 — fixture/branch snake $175–350. The published regional grid (Denver $175–340 → San Jose $220–420 for the identical snake) is the best regionalisation evidence found for any plumbing task: ~25% metro spread.",
    "read",
    {
      regionalSpread: { low: 0.0, high: 0.25, confidence: "read", basis: "§2D.1 — Denver vs San Jose on the identical task." },
      warranty: WARRANTY.drainCleaning,
    },
  ),

  drain_clear_main: usd(
    250,
    375,
    500,
    "§2D.1 — main line $250–500.",
    "read",
    {
      observed: [
        {
          amount: 568,
          currency: "USD",
          basis: "§2B.3 — Roto-Rooter, Indianapolis, labour only before a 15% discount ($482.80 net). §2D.1 places it at the top of the band: a national-brand premium, not an outlier.",
        },
      ],
      warranty: WARRANTY.drainCleaning,
    },
  ),

  toilet_auger: usd(
    175,
    260,
    350,
    "Derived: §2D.1 publishes no separate toilet-auger band, so the fixture/branch snake band is used — a toilet auger is that task at a toilet. The warranty, not the price, is what makes this its own line.",
    "derived",
    { warranty: WARRANTY.toiletAuger },
  ),

  hydro_jet_branch: usd(450, 700, 950, "§2D.1 — hydro-jet branch $450–950.", "read", {
    warranty: WARRANTY.drainCleaning,
  }),

  hydro_jet_main: usd(600, 950, 1300, "§2D.1 — hydro-jet main $600–1,300.", "read", {
    warranty: WARRANTY.drainCleaning,
  }),

  cleanout_install: unpriced(
    "No published band found. §2D.1 prices cleaning and camera work but never the installation of a cleanout, and the aggregators that do are the contaminated ones (§2D.1: Homewyse ran ~2× the independent reads on every fixture-install search).",
    { warranty: WARRANTY.replacement },
  ),

  // ── Repipe & supply lines ─────────────────────────────────────────────────
  repipe_base_fee: {
    low: null,
    typical: 1000,
    high: null,
    currency: "USD",
    basis: "§2B.4 — water repipe base fee $1,000 on the owner's estimate.",
    confidence: "read",
    singleObservation: true,
    reason:
      "One real figure from one contractor. No published band exists for a repipe mobilisation fee, and bracketing it would be inventing the bracket. The structure is worth copying regardless: amortising mobilisation into a stated base fee and charging obstruction separately is what §2D.1 calls the honest form.",
    includesPermit: false,
    warranty: WARRANTY.repipe,
  },

  repipe_pex_per_fixture: usd(
    550,
    976,
    1200,
    "§2D.1 — repipe $550–976–1,200 per fixture; the owner's Level-3 estimate at $976 is the midpoint. §2D.4 confirms per-fixture as the standard unit, used by aggregators and repipe specialists alike. The published fixture-count convention matches the owner's count exactly.",
    "read",
    {
      difficultyTiers: REPIPE_DIFFICULTY_TIERS,
      structureAdjustments: STRUCTURE_ADJUSTMENTS,
      warranty: WARRANTY.repipe,
      pricingModel: "per_unit",
      wholeHouseCrossCheck: {
        basis: "§2D.1 — 2 bath / 1,500 sq ft PEX $4,500–7,000; 3 bath / 2,500 sq ft PEX $7,000–10,000.",
        confidence: "read",
      },
    },
  ),

  repipe_copper_per_fixture: usd(
    770,
    1464,
    1920,
    "Derived: §2D.1's per-fixture PEX band × the published copper premium of 40–60% (550×1.4, 976×1.5, 1200×1.6). §2D.1 also notes the raw material delta is trivial against the total — the copper premium is labour and fittings, not pipe.",
    "derived",
    {
      difficultyTiers: REPIPE_DIFFICULTY_TIERS,
      structureAdjustments: STRUCTURE_ADJUSTMENTS,
      warranty: WARRANTY.repipe,
      pricingModel: "per_unit",
      caution:
        "plumbing-material-costs.md §8: roughly half the copper premium is material and half is labour — copper takes about twice as long to install. This is a separate line from the PEX one for that reason; swapping the material on a PEX line understates copper by ~$2,000–2,500 on a whole house.",
      wholeHouseCrossCheck: {
        basis: "§2D.1 — 2 bath / 1,500 sq ft copper $7,000–10,000; 3 bath / 2,500 sq ft copper $10,000–16,000.",
        confidence: "read",
      },
    },
  ),

  repipe_sheetrock_demo: unpriced(
    "No price is published or observed. What IS on the owner's document is the labour: a sheetrock repipe adds half a day to a full day of demolition (§2B.1 #3). That is carried in `labourDays` so the contractor prices it against their own crew cost instead of a national figure that does not exist.",
    {
      labourDays: { low: 0.5, high: 1.0, confidence: "read", basis: "§2B.1 #3 — printed on the owner's Level-3 repipe criteria." },
    },
  ),

  galvanised_removal: {
    low: null,
    typical: null,
    high: null,
    currency: "USD",
    basis: "§2D.1 — galvanised removal is published as +10–20% on the repipe, not as a price.",
    confidence: "read",
    priceIsMultiplier: true,
    multipliers: {
      upliftOnRepipe: { low: 0.1, typical: 0.15, high: 0.2 },
      confidence: "read",
      basis: "§2D.1 — galvanised removal +10–20%.",
    },
    reason:
      "The published form is an uplift on the repipe price, which scales with fixture count. A flat dollar figure would be right for one house and wrong for every other.",
    includesPermit: false,
  },

  water_line_repair: unpriced(
    "No band published for a spot repair on interior supply pipe. §2D.1's slab-leak repair band ($1,000–4,000) is a different job — under concrete, with access work — and reusing it here would overstate an accessible repair by an order of magnitude.",
    { warranty: WARRANTY.repair },
  ),

  // ── Water heaters ─────────────────────────────────────────────────────────
  wh_tank_supply_install: usd(
    1200,
    1500,
    2000,
    "§2D.1 — 50 gal tank installed $1,200–2,000 (outliers to $3,100).",
    "read",
    {
      variants: [
        { label: "40 gal electric, installed", low: 900, typical: 1150, high: 1400, confidence: "read", basis: "§2D.1" },
        { label: "40 gal gas, installed", low: 1100, typical: 1450, high: 1800, confidence: "read", basis: "§2D.1" },
      ],
      equipmentMarkup: {
        low: 1.8,
        typical: 2.2,
        high: 2.66,
        confidence: "read",
        basis: "§2D.3 — parts over $500 take 1.8–2.5×; the owner's own 50-gal NG heater sells at $2,664 against ~$800–1,400 verified retail, which is 2.66× and sits at the top of the tier. plumbing-material-costs.md §7.1 decomposes it against retail at 2.2–3.3×, and 4–6× on likely wholesale.",
      },
      warranty: WARRANTY.waterHeater,
      itemisationPrompt: {
        thresholdUsd: 500,
        basis: "plumbing-material-costs.md §7.1 — an opaque four-figure equipment line invites the homeowner to look up the SKU and conclude they are being gouged, whether or not they are. Above this, itemise or present as a supply-and-install package with the components listed.",
      },
    },
  ),

  wh_tank_equipment_only: usd(
    1440,
    2200,
    3500,
    "Derived: verified retail of $800–1,400 for a 50-gal NG tank (plumbing-material-costs.md §2.1) × §2D.3's over-$500 markup tier of 1.8–2.5×, anchored on the owner's observed $2,664. Equipment only — the install package is a separate line, and must be.",
    "derived",
    {
      observed: [
        { amount: 2664, currency: "USD", basis: "§2B.1 #2 — 50 gal natural gas water heater, equipment only, marked 'Must be Combined with Install Package'." },
      ],
      equipmentMarkup: {
        low: 1.8,
        typical: 2.2,
        high: 2.66,
        confidence: "read",
        basis: "§2D.3 — over-$500 tier 1.8–2.5×; owner's line is 2.66×.",
      },
      warranty: {
        ...WARRANTY.waterHeater,
        labourTerm: "not applicable — equipment only",
        residential: { partsTerm: "6 years (manufacturer, tank)", labourTerm: "not applicable — equipment only" },
        commercial: { partsTerm: "6 years (manufacturer, tank)", labourTerm: "not applicable — equipment only" },
        basis:
          "§2D.4 — the warranty splitting cleanly is one of the four defensible reasons the equipment/install split exists: a 6-year manufacturer term on the tank and a 1–2 year contractor term on the labour cannot both live on one line.",
      },
      caution:
        "§2D.8: the contractor WHOLESALE cost of a 50-gal heater could not be verified, so the markup inference rests on retail. Real wholesale runs 25–45% below retail (plumbing-material-costs.md §11), which makes every multiple here a lower bound.",
    },
  ),

  wh_install_package_gas: usd(
    200,
    400,
    600,
    "§2D.1 — water heater install labour alone $200–600 (2–4 hours).",
    "read",
    {
      observed: [
        {
          amount: 667.77,
          currency: "USD",
          basis: "§2B.1 #2 — 'Economy Install Package for Gas Water Heaters': new hard lines, shut-off valve, gas flex line, gas valve, drain pan, upgraded drain valve, T&P connection, 2 years labour. Above the labour-only band because it includes parts — the ancillary bundle alone is ~$200–260 retail (plumbing-material-costs.md §2.3).",
        },
      ],
      warranty: { ...WARRANTY.waterHeater, partsTerm: "1 year", labourTerm: "2 years", residential: { partsTerm: "1 year", labourTerm: "2 years" }, commercial: null, basis: "§2B.1 #2 — the owner's install package carries '2 Years Labor' on its own line." },
    },
  ),

  wh_install_package_electric: usd(
    200,
    400,
    600,
    "§2D.1 — install labour alone $200–600 (2–4 hours). No electric-specific band is published; the gas package's extra content (gas flex, gas valve, venting) is what makes gas dearer in practice.",
    "read",
    { warranty: WARRANTY.waterHeater },
  ),

  wh_tankless_supply_install: usd(
    3000,
    4200,
    5500,
    "§2D.1 — tankless installed $3,000–5,500, of which labour is $1,200–1,800.",
    "read",
    {
      equipmentMarkup: {
        low: 1.8,
        typical: 2.0,
        high: 2.5,
        confidence: "derived",
        basis: "§2D.3 over-$500 tier applied to the verified ~$2,100 gas condensing tankless. plumbing-material-costs.md §2.2 notes the equipment band is unusually tight (USD $2,100, CAD $1,988–2,160) — one of the few big-ticket items where a single equipment default is safe.",
      },
      warranty: WARRANTY.waterHeater,
    },
  ),

  wh_tankless_retrofit: usd(
    2500,
    3250,
    4000,
    "§2D.1 — labour scales to $2,500–4,000 for a full retrofit with new gas run from the meter.",
    "read",
    { warranty: WARRANTY.replacement },
  ),

  wh_expansion_tank: usd(150, 250, 400, "§2D.1 — expansion tank adder $150–400.", "read", {
    equipmentMarkup: {
      low: 3.0,
      typical: 4.0,
      high: 5.0,
      confidence: "derived",
      basis: "§2D.3 — a $34–60 part (plumbing-material-costs.md §2.3) falls in the $25–100 tier at 3–4×; the installed band of $150–400 against a $45 typical part implies 3.3–8.9×, so the top of the tier is the realistic read.",
    },
    warranty: WARRANTY.replacement,
  }),

  wh_venting: usd(500, 1000, 1500, "§2D.1 — venting adder $500–1,500.", "read", {
    warranty: WARRANTY.replacement,
  }),

  wh_pan_drain: unpriced(
    "Material only. A plastic pan is $9.69–15.99 and an aluminium one $29.99–39.99 (plumbing-material-costs.md §2.3), but no installed price is published — and the pan drain line, which is the actual work, depends entirely on where the heater sits.",
  ),

  wh_seismic_strap: unpriced(
    "Material only: a strap kit is $24.99–32.99 (plumbing-material-costs.md §2.3). No installed band published, and this is a code requirement in some jurisdictions and absent in others, so a national figure would be meaningless.",
  ),

  wh_removal_disposal: usd(50, 100, 150, "§2D.1 — water heater disposal $50–150.", "read"),

  wh_recirculation_pump: unpriced(
    "Neither the equipment nor the installed price was read. Not in §2D.1's water-heater adders and not in plumbing-material-costs.md §2.3.",
  ),

  // ── Fixtures & appliances ─────────────────────────────────────────────────
  //
  // §2D.1 flags this whole section as thin BY NECESSITY: Homewyse dominated
  // every fixture-install search at roughly 2× the independent reads, and the
  // research chose thin and honest over padded with a contaminated source.
  // That decision is inherited here rather than quietly reversed.
  toilet_supply_install: usd(
    350,
    500,
    700,
    "§2D.1 — toilet installed $350–700.",
    "read",
    {
      caution: "§2D.1 — the fixture section is thin because Homewyse ran ~2× the independent reads and was excluded.",
      equipmentMarkup: {
        low: 2.5,
        typical: 3.0,
        high: 3.5,
        confidence: "derived",
        basis: "§2D.3 — a $73–280 toilet (plumbing-material-costs.md §4.1) straddles the $25–100 (3–4×) and $100–500 (2.5–3×) tiers.",
      },
      warranty: WARRANTY.replacement,
      supplierNote:
        "plumbing-material-costs.md §4.1: comfort height costs $20–40 more than standard, not $150. A price book charging a comfort-height premium is charging for a sales decision, not a material one.",
    },
  ),

  toilet_install_only: unpriced(
    "No labour-only band is published. plumbing-material-costs.md §7 ranks the toilet 3rd for how easily a homeowner can price-check the equipment — a $900 'toilet install' against a $150 toilet reads badly if unexplained — so this line exists precisely so the labour can stand alone when the client supplies the fixture.",
    { warranty: WARRANTY.replacement },
  ),

  lav_faucet_supply_install: usd(
    250,
    375,
    500,
    "§2D.1 — faucet installed $250–500. No separate bathroom/kitchen split is published.",
    "read",
    {
      equipmentMarkup: {
        low: 2.5,
        typical: 3.0,
        high: 4.0,
        confidence: "derived",
        basis: "§2D.3 — a $26–140 bathroom faucet (plumbing-material-costs.md §4.2) sits mostly in the $25–100 tier at 3–4×.",
      },
      warranty: WARRANTY.replacement,
    },
  ),

  kitchen_faucet_supply_install: usd(
    250,
    375,
    500,
    "§2D.1 — faucet installed $250–500, published without a bathroom/kitchen split. The kitchen equipment is dearer ($63–210 vs $26–140, plumbing-material-costs.md §4.2) but no source separates the installed price.",
    "read",
    {
      equipmentMarkup: {
        low: 2.5,
        typical: 3.0,
        high: 4.0,
        confidence: "derived",
        basis: "§2D.3 — a $63–210 kitchen faucet straddles the $25–100 and $100–500 tiers.",
      },
      warranty: WARRANTY.replacement,
    },
  ),

  faucet_install_only: unpriced(
    "No labour-only band published. plumbing-material-costs.md §7 rank 4: the client often supplies their own faucet, and the line is then pure labour and must be structured that way rather than discounted off a supply-and-install price.",
    { warranty: WARRANTY.replacement },
  ),

  sink_supply_install: unpriced(
    "§2D.1 publishes no sink installation band — only the toilet, faucet, disposal, dishwasher hookup and washer box survived the Homewyse exclusion.",
    { warranty: WARRANTY.replacement },
  ),

  tub_supply_install: unpriced(
    "No independent installed band survived §2D.1's exclusion of the contaminated aggregators. Tub work also swings on demolition and surround, which the published figures do not separate.",
    { warranty: WARRANTY.replacement },
  ),

  tub_shower_valve: unpriced(
    "⚠️ §2D.1 states it outright: 'Shower valve: no independent read exists. Ship no default.' This is not an omission — it is the single most explicit instruction in the plumbing benchmark research, and §2D.8 repeats it. The material side is also a fork rather than a grade: plumbing-material-costs.md §4.4 shows pressure-balance at $130–500 complete against thermostatic at $600–1,500, a 4–6× decision that belongs on the quote as two named options with both numbers, never as an upgrade with a single adder.",
    { warranty: WARRANTY.replacement },
  ),

  shower_pan_install: unpriced(
    "No published band. Not in §2D.1's fixture list, and the surrounding tile and waterproofing work is usually a different trade.",
    { warranty: WARRANTY.replacement },
  ),

  disposal_supply_install: usd(250, 350, 450, "§2D.1 — disposal installed $250–450.", "read", {
    equipmentMarkup: {
      low: 2.5,
      typical: 3.0,
      high: 4.0,
      confidence: "derived",
      basis: "§2D.3 — an $80–400 disposal (plumbing-material-costs.md §4.5) spans the $25–100 and $100–500 tiers.",
    },
    warranty: WARRANTY.replacement,
    supplierNote:
      "plumbing-material-costs.md §4.5: ⅓ hp → ½ hp is only +$5–20 of material. A price book charging a meaningful upgrade fee between those two is charging for nothing; ¾ hp is the first real step.",
  }),

  dishwasher_hookup: usd(150, 200, 250, "§2D.1 — dishwasher hookup $150–250.", "read", {
    warranty: WARRANTY.replacement,
  }),

  washer_box_install: usd(
    650,
    1000,
    1500,
    "§2D.1 — washer box $650–1,500, a band that includes running new supply and drain.",
    "read",
    {
      observed: [
        {
          amount: 560,
          currency: "USD",
          basis: "§2B.4 — the owner's washer box install, below the band because the scope is different: no new supply or drain run.",
        },
      ],
      warranty: WARRANTY.replacement,
    },
  ),

  angle_stop_replace: usd(200, 250, 300, "§2D.1 — angle stop $200–300.", "read", {
    equipmentMarkup: {
      low: 4.0,
      typical: 4.5,
      high: 5.0,
      confidence: "derived",
      basis: "§2D.3 — a $12.99–19.99 quarter-turn stop (plumbing-material-costs.md §3) is in the under-$25 tier at 4–5×.",
    },
    warranty: WARRANTY.replacement,
  }),

  hose_bib_replace: usd(150, 200, 250, "§2D.1 — hose bib $150–250.", "read", {
    equipmentMarkup: {
      low: 3.0,
      typical: 3.5,
      high: 4.0,
      confidence: "derived",
      basis: "§2D.3 — a $9.99–36.22 bibb or frost-free sillcock (plumbing-material-costs.md §3) sits in the $25–100 tier at 3–4×.",
    },
    warranty: WARRANTY.replacement,
  }),

  // ── Valves & controls ─────────────────────────────────────────────────────
  prv_supply_install: usd(400, 525, 650, "§2D.1 — PRV $400–650.", "read", {
    observed: [
      { amount: 784, currency: "USD", basis: "§2B.4 — heavy duty ¾\" PRV on the owner's estimate, above the published band." },
    ],
    equipmentMarkup: {
      low: 2.5,
      typical: 3.0,
      high: 3.4,
      confidence: "read",
      basis: "§2D.3's $100–500 tier at 2.5–3×; the owner's $784 against the dearest verified retail PRV ($229.99) is 3.4×, and against the cheapest ($67.99) is 11.5×.",
    },
    warranty: WARRANTY.valve,
    supplierNote:
      "plumbing-material-costs.md §3: the PRV is the sleeper — a 'commodity' valve with a 3.4× retail spread ($67.99 Cash Acme to $229.99 Watts). A single equipment default here misleads in both directions.",
  }),

  main_shutoff_replace: unpriced(
    "No published band. §2D.1 prices the PRV, the angle stop and the hose bib but not the main shut-off, and the job varies from a 20-minute swap to excavating a meter box.",
    { warranty: WARRANTY.replacement },
  ),

  mixing_valve_install: unpriced(
    "Neither the installed price nor the part was read. plumbing-material-costs.md §11 lists the thermostatic mixing valve as unverified — the shower thermostatic bodies that were priced ($200–600) are a different device.",
    { warranty: WARRANTY.replacement },
  ),

  backflow_install: unpriced(
    "Neither the installed price nor the part was read. plumbing-material-costs.md §11: the only backflow-family part priced was a hose-connection vacuum breaker at $77.99, which is not an RPZ or a DCVA.",
    { warranty: WARRANTY.replacement },
  ),

  backflow_test: unpriced(
    "No published band. Annual certification is typically priced to a municipal schedule that varies by water authority, so a national figure would be wrong nearly everywhere.",
  ),

  // ── Gas ───────────────────────────────────────────────────────────────────
  gas_line_run_simple: usd(15, 20, 25, "§2D.1 — new gas run $15–25/ft, simple routing.", "read", {
    warranty: WARRANTY.replacement,
  }),

  gas_line_run_complex: usd(35, 42, 50, "§2D.1 — new gas run $35–50/ft, complex routing.", "read", {
    warranty: WARRANTY.replacement,
  }),

  gas_appliance_connection: unpriced(
    "No published band. §2D.1 prices gas line by the foot but never the appliance connection itself.",
    { warranty: WARRANTY.replacement },
  ),

  gas_repair_minor: {
    low: null,
    typical: 311,
    high: null,
    currency: "USD",
    basis: "§2B.4 — minor gas repair $311 on the owner's estimate.",
    confidence: "read",
    singleObservation: true,
    reason:
      "§2D.8 names this explicitly as something that could not be corroborated: 'minor gas repair (only your $311)'. One figure from one contractor is a data point, not a band.",
    includesPermit: false,
    warranty: WARRANTY.gasMinor,
  },

  gas_pressure_test: unpriced(
    "No published band, and the one observed pressure test (AUD $95, §2B.4) was on water, in a different market and a different currency.",
  ),

  // ── Underground, sewer & excavation ───────────────────────────────────────
  water_main_open_trench: usd(55, 120, 185, "§2D.1 — water main, open trench $55–185/ft.", "read", {
    warranty: WARRANTY.excavation,
  }),

  water_main_bore: usd(
    125,
    225,
    325,
    "§2D.1 — directional bore $125–325/ft, a 50–80% premium over open trench.",
    "read",
    {
      caution:
        "⚠️ §2D.1 and §2D.8 — one source claims the opposite direction (trenchless cheaper). The research leans dearer and says so; this band inherits that uncertainty rather than hiding it.",
      warranty: WARRANTY.excavation,
    },
  ),

  bore_base_fee: {
    low: null,
    typical: 4468,
    high: null,
    currency: "USD",
    basis: "§2B.4 — directional bore base fee including the first 50 ft, $4,468. §2D.1 works that out to ~$89/ft, below both published bands, because it amortises mobilisation into a base fee and charges obstruction separately.",
    confidence: "read",
    singleObservation: true,
    reason:
      "One contractor's structure, not a market band. §2D.1 calls the structure the honest one — which is a statement about the shape, not about the amount.",
    includesPermit: false,
    warranty: WARRANTY.excavation,
  },

  pipe_bursting: usd(
    95,
    170,
    245,
    "§2D.1 — pipe bursting on a water main $95–245/ft. The sewer band is lower, $60–200/ft.",
    "read",
    {
      variants: [
        { label: "Sewer line, pipe bursting", low: 60, typical: 130, high: 200, confidence: "read", basis: "§2D.1" },
      ],
      warranty: WARRANTY.excavation,
    },
  ),

  sewer_excavation_replace: usd(
    50,
    150,
    250,
    "§2D.1 — sewer excavation $50–250/ft, average $150. Full replacement lands at $3,000–7,000.",
    "read",
    { warranty: WARRANTY.excavation },
  ),

  sewer_spot_repair: {
    low: 150,
    typical: null,
    high: 3800,
    currency: "USD",
    basis: "§2D.1 — sewer spot repair $150–3,800.",
    confidence: "read",
    noNationalDefault: true,
    reason:
      "A 25× band. The midpoint of a 25× band is not information — it would show a contractor $1,975 as 'typical' for a job that is genuinely either a $200 afternoon or a $3,500 excavation, and nothing in between is more likely than anything else.",
    includesPermit: false,
    warranty: WARRANTY.excavation,
  },

  sewer_lining: usd(90, 170, 250, "§2D.1 — CIPP lining $90–250/ft.", "read", {
    warranty: WARRANTY.excavation,
  }),

  cast_iron_replace: usd(
    150,
    200,
    250,
    "§2D.1 — cast iron $150–250/ft traditional; $125–175/ft lined.",
    "read",
    {
      variants: [
        { label: "Lined rather than replaced", low: 125, typical: 150, high: 175, confidence: "read", basis: "§2D.1" },
      ],
      caution:
        "⚠️ §2D.1 excluded Angi's '$12.50–30/ft with labor' as a MATERIAL figure mislabelled as installed — the same failure mode as their $1,567 whole-house rewire. If a cheaper band than this ever appears, that is where it came from.",
      warranty: WARRANTY.excavation,
    },
  ),

  underground_obstruction: {
    low: null,
    typical: 621,
    high: null,
    currency: "USD",
    basis: "§2B.4 — obstruction (waterline, sewer or gas in the path) $621 on the owner's estimate.",
    confidence: "read",
    singleObservation: true,
    reason:
      "One contractor's figure. The structure matters more than the number: charging obstruction as its own line is what lets the bore base fee stay low and honest, and it is what the Excavation Clause exists to pre-announce.",
    includesPermit: false,
  },

  driveway_cut_patch: usd(
    1200,
    2500,
    3800,
    "§2D.1 — driveway saw-cut and patch $1,200–3,800.",
    "read",
    {
      caution:
        "§2D.6 — this is not plumbing work and it arrives on a plumbing invoice. Excavation scope creep is a named plumbing-specific dispute; the Excavation Clause line exists to pre-empt exactly this.",
    },
  ),

  landscape_restoration: usd(
    450,
    1425,
    2400,
    "§2D.1 — landscape restoration $450–2,400.",
    "read",
    {
      caution:
        "§2D.6 — like the driveway patch, not plumbing work, and a top dispute cause when it appears unannounced at invoice time.",
    },
  ),

  slab_leak_spot_repair: usd(
    1000,
    2500,
    4000,
    "§2D.1 — slab leak repair $1,000–4,000.",
    "read",
    { warranty: WARRANTY.repair },
  ),

  slab_leak_reroute: {
    low: null,
    typical: null,
    high: 15000,
    currency: "USD",
    basis: "§2D.1 — slab leak reroute 'up to $15,000'. A ceiling is the only thing published.",
    confidence: "read",
    noNationalDefault: true,
    reason:
      "Only a ceiling was found, and a reroute's cost is set by how much of the house it crosses. The repair band above is a different job and must not be stretched to cover this one.",
    includesPermit: false,
    warranty: WARRANTY.replacement,
  },

  // ── Water treatment & pumps ───────────────────────────────────────────────
  water_softener_install: unpriced(
    "Equipment only: $400–1,500 depending on grain capacity (plumbing-material-costs.md §4.5). §2D.1 publishes no installed band, and plumbing-material-costs.md §7 ranks softeners 5th for price-check exposure — homeowners shop them online before calling, which makes an unexplained installed number the worst way to present this.",
    {
      equipmentMarkup: {
        low: 1.8,
        typical: 2.2,
        high: 2.5,
        confidence: "derived",
        basis: "§2D.3 — a $400–1,500 unit sits in the $100–500 and over-$500 tiers; the over-$500 band is used because the softeners contractors actually install are the 40k–64k grain units.",
      },
      warranty: WARRANTY.replacement,
    },
  ),

  water_filtration_install: unpriced(
    "Neither equipment nor installed price read. The category spans a $40 under-sink cartridge and a $6,000 whole-house system, which is why no source publishes a single band.",
    { warranty: WARRANTY.replacement },
  ),

  sump_pump_install: unpriced(
    "Equipment only: $110–345 (plumbing-material-costs.md §4.5). No installed band published.",
    {
      equipmentMarkup: {
        low: 2.5,
        typical: 2.75,
        high: 3.0,
        confidence: "derived",
        basis: "§2D.3 — a $110–345 pump is in the $100–500 tier at 2.5–3×.",
      },
      warranty: WARRANTY.replacement,
    },
  ),

  sewage_ejector_install: unpriced(
    "Equipment only: $215–500 (plumbing-material-costs.md §4.5). No installed band published, and the basin and venting work dominates the cost.",
    {
      equipmentMarkup: {
        low: 2.5,
        typical: 2.75,
        high: 3.0,
        confidence: "derived",
        basis: "§2D.3 — a $215–500 pump is in the $100–500 tier at 2.5–3×.",
      },
      warranty: WARRANTY.replacement,
    },
  ),

  // ── Permits, access & the habitually forgotten ────────────────────────────
  permit_plumbing: {
    low: 7,
    typical: null,
    high: 400,
    currency: "USD",
    basis: "§2D.1 — plumbing permits $7–$400: Chesapeake VA $7 per heater, NYC $130, San Francisco $300–400, the owner's estimate $238.50.",
    confidence: "read",
    noNationalDefault: true,
    reason:
      "A 57× spread set entirely by the authority having jurisdiction. §2D.1 reaches the same conclusion as the electrical research: no national default is possible. The contractor's own city is the only thing that answers this.",
    includesPermit: true,
  },

  inspection_coordination: unpriced(
    "No published band. Some jurisdictions fold inspection into the permit fee and some bill it separately, so even the existence of the charge is local.",
  ),

  travel_fee: usd(
    89,
    130,
    175,
    "Derived: §2D.1's service call band ($89–175) is the closest US equivalent. §2D.7 shows the Australian form directly — a call-out billed separately from, and often exactly equal to, the first labour hour ($130 + $130 on the owner's invoice) — and calls it near-universal in that market.",
    "derived",
    {
      caution:
        "§2D.6 — undisclosed travel and call-out lines added at invoice time are a named plumbing dispute. If this is billed, it belongs on the quote, not on the invoice.",
    },
  ),

  disposal_fee: usd(
    50,
    100,
    150,
    "Derived: §2D.1's water heater disposal adder ($50–150) is the only haul-away figure published for plumbing, and it is the haul-away most plumbers do most often.",
    "derived",
  ),

  access_opening: unpriced(
    "No published band. §2B.1 #2 shows the honest handling instead: the owner's General Damage Clause states that opening walls is part of the work and closing them again is not, so access is either a priced line here or an announced exclusion — never a silent assumption.",
  ),

  concrete_cut_patch: unpriced(
    "No published band for interior slab cutting. The driveway saw-cut band ($1,200–3,800) is exterior work at a different thickness and with a different finish, and reusing it would overstate a bathroom trench.",
  ),

  additional_labour: {
    low: null,
    typical: 703.66,
    high: null,
    currency: "USD",
    basis: "§2B.4 — 'Brief assistance needed' (extra labour on a difficult install), $703.66 on the owner's estimate.",
    confidence: "read",
    singleObservation: true,
    reason:
      "One contractor's figure for a job-specific condition. Anything else would be a national average for 'it was harder than expected', which cannot exist.",
    includesPermit: false,
  },

  // The two clause lines. §2B.1 #1 — they really do print at $0.00, and that is
  // the whole point: the exclusion sits in the price table where the client
  // reads it alongside the price, rather than in a terms paragraph nobody opens.
  // §2.5 of the research names buried exclusions as a top dispute cause; this
  // is the fix, and it costs nothing to implement.
  clause_excavation: usd(
    0,
    0,
    0,
    "§2B.1 #1 — printed at $0.00 as a visible line item on an $18,164 repipe. The zero is deliberate and load-bearing: a priced clause is a charge, an unpriced one is a term nobody reads, and a $0.00 one is an exclusion the client accepts by accepting the quote.",
    "read",
  ),

  clause_general_damage: usd(
    0,
    0,
    0,
    "§2B.1 #1 — printed at $0.00 alongside the excavation clause on the same estimate.",
    "read",
  ),
};

/**
 * One benchmark, with the words it must be presented under attached so a caller
 * cannot render the number bare. Returns null for an unknown key rather than an
 * empty band — an empty band renders as "$0–$0", which is a price.
 */
export function getPlumbingBenchmark(key) {
  const benchmark = PLUMBING_BENCHMARKS[key];
  if (!benchmark) return null;
  return {
    ...benchmark,
    key,
    presentation: BENCHMARK_PRESENTATION,
    lineItem: PLUMBING_LINE_ITEMS_BY_KEY[key] || null,
  };
}

/** True when the benchmark deliberately has no central value. Callers use this
 *  to render the reason instead of a range — the reason is the useful part. */
export function hasNoDefault(benchmark) {
  if (!benchmark) return true;
  return (
    benchmark.typical === null &&
    Boolean(benchmark.unpriced || benchmark.noNationalDefault || benchmark.priceIsMultiplier)
  );
}
