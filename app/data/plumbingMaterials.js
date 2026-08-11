// app/data/plumbingMaterials.js
//
// Default INTERNAL material costs for residential plumbing, so a plumber who
// signs up has a working cost side and the margin calculation is real rather
// than invented. Same role as app/data/materialRecipes.js, same override
// mechanics, and the same hard rule: **nothing here is client-facing.** These
// are cost inputs. They feed the Cost & Margin panel and nothing else, and
// scripts/check-plumbing-catalog.mjs fails the build if any route under
// app/quote, app/book, app/q, app/portal, app/site or app/embed imports them.
//
// Every figure is from docs/plumbing-material-costs.md, read 2026-08-10.
//
// ── These are RETAIL prices, and that is the point ──────────────────────────
//
// Part 4 rule #10: a material default is labelled "retail, date, region" or a
// contractor has no way to know which direction to adjust it. §11 of the source
// document is blunt that every number in it is retail; real wholesale runs
// 25–45% below, unverified, because verifying it needs a trade account. So
// `source` on every priced item names the retailer, the region, the basis and
// the read date, and WHOLESALE_DISCOUNT below states the gap as an inference
// rather than baking it in.
//
// Part 4 rule #8: a material default is not a number keyed on a name. Each item
// carries `brand`, `packSize` and `scope`, because a contractor adjusting a
// figure needs to know what it was a price FOR before they can say their jobs
// are different.
//
// ── Four findings are encoded as structure, not as comments ─────────────────
//
// 1. **Fitting SYSTEM is a cost axis worth 8–13×.** A push-fit elbow is $12.93
//    against roughly $1.04–1.40 for the equivalent crimp fitting (§1.4). On a
//    120-fitting repipe that is a ~$1,400 swing on fittings alone — the single
//    largest silent cost error available in a plumbing price book. So crimp and
//    push-fit are DIFFERENT ITEMS with different keys. There is no "fitting"
//    item that one can silently stand in for the other inside.
//
// 2. **ABS vs PVC is 1.6–1.9× and is decided by LOCAL CODE, not preference**
//    (§1.8). Western Canada and parts of the US west are ABS country; most of
//    the US east is PVC. A single DWV default is wrong by ~70% for half the
//    user base, so `resolveDwvMaterial()` refuses to answer until it is told
//    which system applies. It has no default branch. Adding one would be the
//    kind of quietly-wrong control AGENTS.md exists to prevent.
//
// 3. **Homeowner-taste items are allowances, not cost defaults** (Part 4 rule
//    #9, §10). A toilet spans 21× inside a single builder catalogue, a shower
//    valve 12×, a tub 6.2×, a bathroom faucet 5.4× — and §10 notes the real
//    market takes faucets past 50×. Those carry `cost: null`, an explicit
//    `tieringAxis` naming what actually moves the price, and an
//    `observedRange` that can never be mistaken for a default because it has
//    no centre.
//
// 4. **CPVC has no verified price at all** (§11) — an entire material system
//    missing, because the category rendered at every source that was readable
//    and no price page did. It is here, marked unpriced, with the reason. It is
//    not interpolated from PVC: different resin, different price point, and a
//    fabricated number in a cost book is worse than a gap a user can see.
//
// ── Region is a value, never an FX conversion ───────────────────────────────
//
// §9 measured CAD/USD ratios from 0.85 to 1.53 across categories — commodity
// pipe at or below parity, tank water heaters at ~1.50. There is no single
// multiplier. `getMaterialCost(key, region)` returns the region's own read or
// refuses; it never converts. That mirrors the existing rule that tax is
// per-jurisdiction rather than global.

/** Legal `confidence` values, following the marking convention in §"Marking
 *  convention" of the source document. The tag describes the TYPICAL value —
 *  the one that would be used as a default — and any interpolated low or high
 *  is called out in `note`. */
export const MATERIAL_CONFIDENCE = ["read", "inferred", "list", "unverified"];

/** Legal `type` values. `allowance` and `unpriced` both mean `cost: null`, for
 *  different reasons, and the distinction is the useful part. */
export const MATERIAL_TYPES = ["material", "allowance", "unpriced"];

/** Regions with their own reads. Not a currency list — a *source* list. */
export const MATERIAL_REGIONS = {
  US: { key: "US", label: "United States", currency: "USD" },
  CA: { key: "CA", label: "Canada", currency: "CAD" },
};

/**
 * §1.4. Crimp, expansion and push-fit are three different products at three
 * very different prices, and substituting one for another silently is how a
 * repipe estimate goes wrong by four figures without anyone noticing.
 */
export const FITTING_SYSTEMS = {
  crimp: {
    key: "crimp",
    label: "Crimp / cinch (insert brass)",
    relativeCost: 1.0,
    confidence: "read",
    basis: "§1.3 — brass insert elbow ½\" $1.03–2.60 USD, $1.04 CAD.",
  },
  expansion: {
    key: "expansion",
    label: "PEX-A cold expansion",
    relativeCost: 1.2,
    confidence: "inferred",
    basis:
      "§1.2 — PEX-A tubing carries a 15–45% premium inferred from one converted CAD/USD pair. The expansion FITTING itself was never priced; 1.2× is a placeholder from the tubing premium and must not be treated as a read.",
  },
  push_fit: {
    key: "push_fit",
    label: "Push-fit (SharkBite type)",
    relativeCost: 9.2,
    confidence: "read",
    basis: "§1.4 — push-fit elbow ½\" $12.93 USD against ~$1.40 crimp: 9.2×, within the published 8–13× band.",
  },
};

/** The measured spread between fitting systems, kept as its own constant so a
 *  check can assert the priced items still reproduce it. */
export const FITTING_SYSTEM_COST_MULTIPLE = {
  low: 8,
  high: 13,
  confidence: "read",
  basis: "§1.4 — a push-fit fitting costs 8–13× the equivalent crimp fitting. On a 120-fitting repipe that is a ~$1,400 USD swing on fittings alone.",
};

/**
 * §1.8. The two DWV systems. `examples` are directional — the source says
 * "western Canada and parts of the US west are ABS country, most of the US east
 * is PVC" — and are deliberately NOT a lookup table. Local code is decided by
 * the authority having jurisdiction, and a province-to-material map built from
 * a directional sentence would be a fabricated authority.
 */
export const DWV_SYSTEMS = {
  abs: {
    key: "abs",
    label: "ABS",
    examples: ["Western Canada", "Parts of the US west"],
    confidence: "read",
    basis: "§1.8 — which one a plumber uses is set by local code, not preference.",
    materialKeys: { "1.5in": "abs_dwv_1_5", "2in": "abs_dwv_2", "3in": "abs_dwv_3", "4in": "abs_dwv_4" },
  },
  pvc: {
    key: "pvc",
    label: "PVC",
    examples: ["Most of the US east"],
    confidence: "read",
    basis: "§1.8 — which one a plumber uses is set by local code, not preference.",
    materialKeys: { "1.5in": "pvc_dwv_1_5", "2in": "pvc_dwv_2", "3in": "pvc_dwv_3", "4in": "pvc_dwv_4" },
  },
};

/**
 * §1.8 — "ABS costs 1.6–1.9× PVC at the same size."
 *
 * ⚠️ That headline is a 4" reading generalised. Recomputing it from the same
 * two tables at every size gives 1.3–1.5× below 4", and at 3" the two bands
 * overlap outright (PVC $2.20–4.00 against ABS $3.90–4.20) because the PVC
 * figure spans Schedule 40 cellular core and Schedule 30. `measuredBySize`
 * carries the arithmetic so nobody has to take the headline on faith; the
 * published band is kept as `low`/`high` because it is what the source says,
 * not because it reproduces at every size.
 *
 * It does not change the product decision. Even at 1.3× the DWV default is
 * wrong by ~30% for whichever half of the user base it is not written for, and
 * the choice is still made by local code rather than by us.
 */
export const DWV_COST_RATIO_ABS_OVER_PVC = {
  low: 1.6,
  high: 1.9,
  confidence: "read",
  basis: "§1.8 — 4\": $5.50/ft ABS vs $3.40/ft PVC on 10 ft lengths; $5.75 vs $3.00 on 20 ft.",
  measuredBySize: {
    "1.5in": 1.46,
    "2in": 1.52,
    "3in": 1.31,
    "4in": 1.75,
  },
  measuredBasis:
    "Typical ÷ typical from the priced items below, on the same read date. Only 4\" lands inside the published 1.6–1.9× band; §1.8's headline is that size generalised.",
};

/**
 * Which DWV material to cost a job in.
 *
 * **There is deliberately no default branch.** Called without an explicit
 * system this returns `{ resolved: false }` with the question to ask, because
 * §1.8 makes the cost of guessing explicit: the wrong choice is ~70% out, and
 * it is wrong for roughly half the user base whichever way it is picked. The
 * caller shows the question; it does not get a silent answer.
 */
export function resolveDwvMaterial(dwvSystemKey) {
  const system = DWV_SYSTEMS[dwvSystemKey];
  if (!system) {
    return {
      resolved: false,
      prompt: "Which DWV material does local code require on this job — ABS or PVC?",
      reason:
        "ABS costs 1.6–1.9× PVC at the same size (§1.8) and which one applies is set by local code, not by preference or by our guess. Defaulting either way is wrong by about 70% for half the user base.",
      options: Object.values(DWV_SYSTEMS).map((s) => ({
        key: s.key,
        label: s.label,
        examples: s.examples,
      })),
      costRatio: DWV_COST_RATIO_ABS_OVER_PVC,
    };
  }
  return {
    resolved: true,
    system: system.key,
    label: system.label,
    materialKeys: system.materialKeys,
    costRatio: DWV_COST_RATIO_ABS_OVER_PVC,
  };
}

/** §11. Every price in this file is retail. This is the gap to wholesale,
 *  stated as the inference it is — which also means every markup multiple in
 *  app/data/plumbingBenchmarks.js is a lower bound. */
export const WHOLESALE_DISCOUNT = {
  low: 0.25,
  high: 0.45,
  confidence: "inferred",
  basis: "§11 — contractor wholesale is typically 25–45% below retail. Never verified: it needs a trade account, and §11 calls that the highest-value thing a human could add to this document.",
};

/** §0. The USD column leans on one independent North Carolina retailer, and
 *  where a Home Depot US comparison exists it runs a measurable amount higher
 *  on commodity plastics. Seeding a big-box supply chain should adjust down. */
export const SOURCE_BIAS = {
  commodityPlastics: { factor: 1.25, direction: "high", basis: "§0 — PEX-B ½\" 100 ft coil: Kellogg $34.99 vs Home Depot US $27.97." },
  metalPipe: { factor: 1.03, direction: "high", basis: "§0 — copper Type L ½\" 10 ft: $39.99 vs ≈$38.81." },
  appliances: { factor: 0.97, direction: "low", basis: "§0 — 40 gal NG heater: $579.99 vs $599.00." },
  singleSourceRisk:
    "§11 — roughly 70% of the USD column is one retailer (Kellogg Supply, NC). Internally consistent and server-rendered, but one region and one co-op's pricing, with three independent cross-checks.",
};

// ── Source shorthands ───────────────────────────────────────────────────────
//
// Written out once each so `source` on every item carries retailer, region,
// basis and read date without eighty repetitions of the same four strings.

const KELLOGG = {
  retailer: "Kellogg Supply Co. (Do It Best co-op)",
  region: "North Carolina, USA",
  priceBasis: "retail",
  readDate: "2026-08-10",
};
const HD_US = {
  retailer: "Home Depot US (search snippet — direct fetch returned 403)",
  region: "United States",
  priceBasis: "retail",
  readDate: "2026-08-10",
};
const HD_CA = {
  retailer: "Home Depot Canada (via r.jina.ai text proxy — direct fetch times out)",
  region: "Canada",
  priceBasis: "retail",
  readDate: "2026-08-10",
};
const ANACO_LIST = {
  retailer: "ANACO-Husky published list",
  region: "United States",
  priceBasis: "list",
  readDate: "2026-07-01",
};
const NOT_READ = {
  retailer: "none — inferred from general knowledge, not read off a page",
  region: "not applicable",
  priceBasis: "inferred",
  readDate: "2026-08-10",
};
const NO_SOURCE = {
  retailer: "none — no price found",
  region: "not applicable",
  priceBasis: "inferred",
  readDate: "2026-08-10",
};

// ── Builders ────────────────────────────────────────────────────────────────

const material = (fields) => ({
  type: "material",
  currency: "USD",
  primaryRegion: "US",
  confidence: "read",
  brand: null,
  ...fields,
});

/** §10 / Part 4 rule #9. Homeowner taste, not trade cost. `cost` is an explicit
 *  null rather than a missing key: a missing key is ambiguous between "we
 *  forgot" and "deliberately none", and only one of those is a statement. */
const allowance = (fields) => ({
  type: "allowance",
  cost: null,
  currency: "USD",
  primaryRegion: "US",
  confidence: "read",
  brand: null,
  ...fields,
});

/** §11. No price exists. Not padded, not interpolated. */
const unpriced = (fields) => ({
  type: "unpriced",
  cost: null,
  currency: "USD",
  primaryRegion: "US",
  confidence: "unverified",
  unpriced: true,
  brand: null,
  packSize: "not applicable — no price read",
  source: NO_SOURCE,
  ...fields,
});

export const PLUMBING_MATERIALS = {
  // ── Supply pipe ───────────────────────────────────────────────────────────
  pex_b_half: material({
    label: 'PEX-B tubing, ½"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 0.28, typical: 0.35, high: 0.5 },
    source: KELLOGG,
    brand: "generic PEX-B (Apollo read at Home Depot US)",
    packSize: "300 ft / 100 ft / 25 ft coils and 10 ft / 20 ft sticks",
    scope: "tubing only — fittings, rings, hangers and insulation are separate lines",
    // §1.1: the stick premium is real and worth encoding. A repipe priced off
    // stick pricing is priced wrong by more than half on the tube.
    lengthTiers: [
      { purchase: "300 ft coil", packPrice: 94.99, costPerFt: 0.32 },
      { purchase: "100 ft coil", packPrice: 32.0, costPerFt: 0.32 },
      { purchase: "25 ft coil", packPrice: 11.99, costPerFt: 0.48 },
      { purchase: "10 ft stick", packPrice: 4.99, costPerFt: 0.5 },
    ],
    stickPremiumPct: 56,
    note: "§1.1 — a 10 ft cut length runs $0.50/ft against $0.32/ft on a 300 ft coil: a 56% penalty for buying short.",
    biasHint: "commodityPlastics",
  }),

  pex_b_three_quarter: material({
    label: 'PEX-B tubing, ¾"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 0.5, typical: 0.55, high: 1.08 },
    source: KELLOGG,
    brand: "generic PEX-B",
    packSize: "300 ft / 100 ft / 25 ft coils and 10 ft / 20 ft sticks",
    scope: "tubing only",
    biasHint: "commodityPlastics",
  }),

  pex_b_one: material({
    label: 'PEX-B tubing, 1"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 0.7, typical: 0.75, high: 0.9 },
    source: KELLOGG,
    confidence: "inferred",
    brand: "generic PEX-B",
    packSize: "100 ft coil ($74.99) — the only readable pack at this size",
    scope: "tubing only",
    note: "§1.1 — only the 100 ft coil was readable; low and high are extrapolated from the adjacent sizes.",
  }),

  pex_a_half_coil: material({
    label: 'PEX-A (expansion) tubing, ½" × 100 ft',
    category: "supply_pipe",
    unit: "roll",
    cost: { low: 56.93, typical: 56.93, high: 56.93 },
    currency: "CAD",
    primaryRegion: "CA",
    source: HD_CA,
    brand: "generic PEX-A",
    packSize: "100 ft coil",
    scope: "tubing only — the expansion tool and fittings are the larger cost difference, and neither was priced",
    singleRead: true,
    note: "§11 — no USD price for PEX-A was ever read. §1.2's '15–45% premium over PEX-B' is inference from this one converted pair and must not be presented as measured.",
  }),

  copper_type_m_half: material({
    label: 'Copper pipe, Type M, ½"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 2.75, typical: 3.0, high: 3.3 },
    source: KELLOGG,
    brand: "Mueller / generic",
    packSize: "10 ft ($32.99) and 20 ft ($54.99) lengths",
    scope: "pipe only — fittings, solder, flux and hangers are separate lines",
    lengthTiers: [
      { purchase: "10 ft length", packPrice: 32.99, costPerFt: 3.3 },
      { purchase: "20 ft length", packPrice: 54.99, costPerFt: 2.75 },
    ],
    volumeSavingPct: 17,
    regions: { CA: { cost: { low: 2.98, typical: 2.98, high: 2.98 }, currency: "CAD", source: HD_CA, singleRead: true } },
    note: "§1.5 — buying 20 ft lengths saves up to 17%/ft over 10 ft.",
  }),

  copper_type_l_half: material({
    label: 'Copper pipe, Type L, ½"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 3.9, typical: 3.95, high: 4.0 },
    source: KELLOGG,
    brand: "Mueller / generic",
    packSize: "10 ft ($39.99) and 20 ft ($77.99) lengths",
    scope: "pipe only",
    regions: { CA: { cost: { low: 4.33, typical: 4.33, high: 4.33 }, currency: "CAD", source: HD_CA, singleRead: true } },
    note: "§1.5 — Type L is 21–25% over Type M at 10 ft but the gap widens to 42% at 20 ft, because Type M discounts harder on volume. The L-vs-M premium is NOT a constant and must not be encoded as one percentage.",
  }),

  copper_type_m_three_quarter: material({
    label: 'Copper pipe, Type M, ¾"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 4.75, typical: 5.0, high: 5.3 },
    source: KELLOGG,
    brand: "Mueller / generic",
    packSize: "10 ft ($52.99) and 20 ft ($94.99) lengths",
    scope: "pipe only",
  }),

  copper_type_l_three_quarter: material({
    label: 'Copper pipe, Type L, ¾"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 6.5, typical: 6.6, high: 6.75 },
    source: KELLOGG,
    brand: "Mueller / generic",
    packSize: "10 ft ($64.99) and 20 ft ($134.99) lengths",
    scope: "pipe only",
    regions: { CA: { cost: { low: 5.6, typical: 5.6, high: 5.6 }, currency: "CAD", source: HD_CA, singleRead: true } },
  }),

  copper_type_l_one: material({
    label: 'Copper pipe, Type L, 1"',
    category: "supply_pipe",
    unit: "per_ft",
    cost: { low: 8.5, typical: 8.5, high: 8.5 },
    source: KELLOGG,
    brand: "Mueller / generic",
    packSize: "10 ft ($84.99) and 20 ft ($169.99) lengths",
    scope: "pipe only",
    singleRead: true,
  }),

  cpvc_pipe: unpriced({
    label: "CPVC pipe — any size, either currency",
    category: "supply_pipe",
    unit: "per_ft",
    scope: "an entire material system, absent",
    reason:
      "§11 — the category exists at every source that could be read and no price page rendered, in either currency, at any size. A whole material system is missing. It is NOT interpolated from PVC: different resin at a different price point, and CPVC is a pressure supply pipe while the priced PVC here is DWV. Somebody has to read a real price before this ships a number.",
  }),

  // ── DWV pipe ──────────────────────────────────────────────────────────────
  //
  // Paired sizes across both systems on purpose: resolveDwvMaterial() hands
  // back one system's keys, and a size present in one and missing in the other
  // would make the region dependency resolvable by accident.
  pvc_dwv_1_5: material({
    label: 'PVC DWV pipe, 1½"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 0.93, typical: 0.96, high: 1.0 },
    source: KELLOGG,
    packSize: "10 ft ($9.29) and 20 ft ($19.99) lengths",
    scope: "pipe only — fittings and cement are separate lines",
    dwvSystem: "pvc",
    biasHint: "commodityPlastics",
  }),

  pvc_dwv_2: material({
    label: 'PVC DWV pipe, 2"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 1.25, typical: 1.35, high: 1.5 },
    source: KELLOGG,
    packSize: "10 ft ($14.99) and 20 ft ($24.99) lengths",
    scope: "pipe only",
    dwvSystem: "pvc",
    biasHint: "commodityPlastics",
  }),

  pvc_dwv_3: material({
    label: 'PVC DWV pipe, 3"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 2.2, typical: 3.1, high: 4.0 },
    source: KELLOGG,
    packSize: "10 ft ($21.99–39.99) and 20 ft ($59.99) lengths",
    scope: "pipe only",
    dwvSystem: "pvc",
    note: "§1.7 — the spread at 3\" is Schedule 40 cellular core ($21.99) against Schedule 30 ($39.99). That is a real spec difference, not noise; carry the schedule on the line.",
    biasHint: "commodityPlastics",
  }),

  pvc_dwv_4: material({
    label: 'PVC DWV pipe, 4"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 3.0, typical: 3.2, high: 3.4 },
    source: KELLOGG,
    packSize: "10 ft ($33.99) and 20 ft ($59.99) lengths",
    scope: "pipe only",
    dwvSystem: "pvc",
    biasHint: "commodityPlastics",
  }),

  abs_dwv_1_5: material({
    label: 'ABS DWV pipe, 1½"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 1.15, typical: 1.4, high: 1.6 },
    source: KELLOGG,
    packSize: "10 ft ($15.99) and 20 ft ($22.99) lengths",
    scope: "pipe only",
    dwvSystem: "abs",
    regions: { CA: { cost: { low: 1.54, typical: 1.54, high: 1.54 }, currency: "CAD", source: HD_CA, singleRead: true } },
    biasHint: "commodityPlastics",
  }),

  abs_dwv_2: material({
    label: 'ABS DWV pipe, 2"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 2.0, typical: 2.05, high: 2.1 },
    source: KELLOGG,
    packSize: "10 ft ($19.99) and 20 ft ($41.99) lengths",
    scope: "pipe only",
    dwvSystem: "abs",
    regions: { CA: { cost: { low: 2.33, typical: 2.33, high: 2.33 }, currency: "CAD", source: HD_CA, singleRead: true } },
    biasHint: "commodityPlastics",
  }),

  abs_dwv_3: material({
    label: 'ABS DWV pipe, 3"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 3.9, typical: 4.05, high: 4.2 },
    source: KELLOGG,
    packSize: "10 ft ($41.99) and 20 ft ($77.99) lengths",
    scope: "pipe only",
    dwvSystem: "abs",
    regions: { CA: { cost: { low: 3.58, typical: 3.58, high: 3.58 }, currency: "CAD", source: HD_CA, singleRead: true } },
    biasHint: "commodityPlastics",
  }),

  abs_dwv_4: material({
    label: 'ABS DWV pipe, 4"',
    category: "dwv_pipe",
    unit: "per_ft",
    cost: { low: 5.5, typical: 5.6, high: 5.75 },
    source: KELLOGG,
    packSize: "10 ft ($54.99) and 20 ft ($114.99) lengths",
    scope: "pipe only",
    dwvSystem: "abs",
    regions: { CA: { cost: { low: 6.5, typical: 6.5, high: 6.5 }, currency: "CAD", source: HD_CA, singleRead: true } },
    biasHint: "commodityPlastics",
  }),

  cast_iron_soil_pipe_4: unpriced({
    label: 'Cast-iron no-hub soil pipe, 4" × 10 ft',
    category: "dwv_pipe",
    unit: "length",
    scope: "pipe only",
    reason:
      "§11 — carried by Lowe's, Ferguson and Charlotte; no price page readable at any of them on 2026-08-10.",
  }),

  cast_iron_nohub_coupling_4: material({
    label: 'Cast-iron no-hub coupling, 4"',
    category: "dwv_pipe",
    unit: "each",
    cost: { low: 12, typical: 15, high: 18 },
    source: ANACO_LIST,
    confidence: "inferred",
    brand: "ANACO-Husky",
    packSize: "each",
    scope: "coupling only",
    listPrice: 52.43,
    note: "§1.10 — $52.43 is the published LIST price effective 2026-07-01, and distribution sells far below list. Never seed a cost book from a list price. The cost band here is the source's own street estimate: $12–18 standard, $25–40 heavy-duty, both inferred.",
    heavyDutyCost: { low: 25, typical: 32, high: 40 },
  }),

  // ── Fittings — the SYSTEM axis (§1.4) ─────────────────────────────────────
  //
  // These are separate items and not variants of one, because the whole point
  // of §1.4 is that substituting one for the other silently is a ~$1,400 error
  // on a single repipe.
  pex_fitting_elbow_half_crimp: material({
    label: 'PEX elbow, ½", crimp / insert brass',
    category: "fitting",
    unit: "each",
    cost: { low: 1.03, typical: 1.4, high: 2.6 },
    source: KELLOGG,
    packSize: "singles and 25/50-packs",
    scope: "fitting only — crimp rings are a separate line",
    fittingSystem: "crimp",
    regions: { CA: { cost: { low: 1.04, typical: 1.04, high: 1.04 }, currency: "CAD", source: HD_CA, singleRead: true } },
  }),

  pex_fitting_tee_half_crimp: material({
    label: 'PEX tee, ½", crimp / insert brass',
    category: "fitting",
    unit: "each",
    cost: { low: 2.5, typical: 3.5, high: 4.99 },
    source: KELLOGG,
    packSize: "singles",
    scope: "fitting only",
    fittingSystem: "crimp",
    note: "§1.3 — the low is interpolated; the typical and high were read.",
  }),

  pex_fitting_coupling_half_crimp: material({
    label: 'PEX coupling, ⅜"–1", crimp / insert brass',
    category: "fitting",
    unit: "each",
    cost: { low: 2.49, typical: 3.0, high: 4.49 },
    source: KELLOGG,
    packSize: "singles",
    scope: "fitting only",
    fittingSystem: "crimp",
  }),

  pex_fitting_elbow_half_push_fit: material({
    label: 'PEX elbow, ½", push-fit',
    category: "fitting",
    unit: "each",
    cost: { low: 12.93, typical: 12.93, high: 12.93 },
    source: KELLOGG,
    brand: "SharkBite type",
    packSize: "each",
    scope: "fitting only — no ring, no tool",
    fittingSystem: "push_fit",
    singleRead: true,
    regions: { CA: { cost: { low: 11.78, typical: 11.78, high: 11.78 }, currency: "CAD", source: HD_CA, singleRead: true } },
    note: "§1.4 — 9.2× the equivalent crimp elbow. This is the single largest silent cost error available in a plumbing price book, which is why it is its own item.",
  }),

  pex_fitting_coupling_half_push_fit: material({
    label: 'PEX coupling, ½", push-fit',
    category: "fitting",
    unit: "each",
    cost: { low: 9.36, typical: 9.36, high: 9.36 },
    source: KELLOGG,
    brand: "SharkBite type",
    packSize: "each",
    scope: "fitting only",
    fittingSystem: "push_fit",
    singleRead: true,
  }),

  pex_crimp_ring_half: material({
    label: 'Copper crimp ring, ½"',
    category: "fitting",
    unit: "each",
    cost: { low: 0.38, typical: 0.38, high: 0.38 },
    source: KELLOGG,
    packSize: "25-pack ($9.49)",
    scope: "ring only",
    fittingSystem: "crimp",
    singleRead: true,
    regions: { CA: { cost: { low: 0.2, typical: 0.21, high: 0.22 }, currency: "CAD", source: HD_CA } },
    note: "§12.7 — $0.38 each in a 25-pack against CAD $0.20 each in a 1000-pack. Different currencies, so treat the gap as directional, not as a measured ratio.",
  }),

  copper_fitting_elbow_half_sweat: material({
    label: 'Copper 90° street elbow, ½", sweat',
    category: "fitting",
    unit: "each",
    cost: { low: 2.09, typical: 2.09, high: 2.09 },
    source: KELLOGG,
    packSize: "each",
    scope: "fitting only — solder and flux are separate lines",
    fittingSystem: "sweat",
    singleRead: true,
  }),

  copper_fitting_elbow_three_quarter_sweat: material({
    label: 'Copper 90° street elbow, ¾", sweat',
    category: "fitting",
    unit: "each",
    cost: { low: 4.59, typical: 4.59, high: 4.59 },
    source: KELLOGG,
    packSize: "each",
    scope: "fitting only",
    fittingSystem: "sweat",
    singleRead: true,
  }),

  copper_fitting_elbow_one_sweat: material({
    label: 'Copper 90° street elbow, 1", sweat',
    category: "fitting",
    unit: "each",
    cost: { low: 16.49, typical: 16.49, high: 16.49 },
    source: KELLOGG,
    packSize: "each",
    scope: "fitting only",
    fittingSystem: "sweat",
    singleRead: true,
    note: "§1.6 — the cliff at 1\": $16.49 against $4.59 at ¾\". Any 'copper fitting' default that ignores size is wrong by 3.6× on larger runs.",
  }),

  copper_fitting_press_coupling: material({
    label: 'Copper press coupling, ½"–¾"',
    category: "fitting",
    unit: "each",
    cost: { low: 11.49, typical: 12.5, high: 13.49 },
    source: { ...KELLOGG, retailer: "Walmart (Mueller)" },
    brand: "Mueller",
    packSize: "each",
    scope: "fitting only — press tool not included and not priced",
    fittingSystem: "press",
  }),

  dwv_fitting_pvc_sanitary_tee_3: material({
    label: 'PVC sanitary tee, 3"',
    category: "fitting",
    unit: "each",
    cost: { low: 10.99, typical: 10.99, high: 10.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "fitting only — cement is a separate line",
    dwvSystem: "pvc",
    singleRead: true,
  }),

  dwv_fitting_abs_wv_tee_3: material({
    label: 'ABS waste & vent tee, 3"',
    category: "fitting",
    unit: "each",
    cost: { low: 19.99, typical: 19.99, high: 19.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "fitting only",
    dwvSystem: "abs",
    singleRead: true,
  }),

  manifold_6_port_bare: material({
    label: "PEX barb manifold, 6-port, no shutoffs",
    category: "fitting",
    unit: "each",
    cost: { low: 29.99, typical: 29.99, high: 29.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "manifold only",
    fittingSystem: "crimp",
    singleRead: true,
  }),

  manifold_12_port_shutoffs: material({
    label: "PEX barb manifold, 12-port, brass ball shutoffs",
    category: "fitting",
    unit: "each",
    cost: { low: 204.99, typical: 204.99, high: 204.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "manifold with integral shutoffs",
    fittingSystem: "crimp",
    singleRead: true,
    note: "§1.11 — a 7× jump from the bare 6-port. The shutoffs are the cost, not the ports.",
  }),

  // ── Water heaters ─────────────────────────────────────────────────────────
  wh_tank_40_gas: material({
    label: "Water heater, 40 gal natural gas",
    category: "water_heater",
    unit: "each",
    cost: { low: 579.99, typical: 600, high: 1349.99 },
    source: KELLOGG,
    brand: "Reliance / Rheem",
    packSize: "each",
    scope: "tank only — no venting, no ancillaries, no labour, no haul-away",
    regions: { CA: { cost: { low: 885, typical: 885, high: 1498 }, currency: "CAD", source: HD_CA } },
    note: "§9 — the CAD/USD ratio on tank heaters is ~1.50, against 0.85–1.2 on commodity pipe. This is the item that proves a single FX multiplier cannot work.",
    biasHint: "appliances",
  }),

  wh_tank_50_gas: material({
    label: "Water heater, 50 gal natural gas",
    category: "water_heater",
    unit: "each",
    cost: { low: 799.99, typical: 850, high: 1399.99 },
    source: KELLOGG,
    brand: "Reliance / Rheem / Bradford White",
    packSize: "each",
    scope: "tank only",
    regions: { CA: { cost: { low: 1199, typical: 1345, high: 1548 }, currency: "CAD", source: HD_CA } },
    note: "§7.1 — the owner's estimate sells this at $2,664, which is 2.2–3.3× verified retail and 4–6× likely wholesale, with install billed separately on top.",
    biasHint: "appliances",
  }),

  wh_tank_50_electric: material({
    label: "Water heater, 50 gal electric",
    category: "water_heater",
    unit: "each",
    cost: { low: 669, typical: 700, high: 1200 },
    source: HD_US,
    confidence: "inferred",
    packSize: "each",
    scope: "tank only",
    note: "§2.1 — read as '$619–$629 after $50 off' at Home Depot US, so list ≈ $669–679; market guides put the band at $500–1,200.",
    biasHint: "appliances",
  }),

  wh_tankless_gas_condensing: material({
    label: "Tankless water heater, gas condensing",
    category: "water_heater",
    unit: "each",
    cost: { low: 2099.99, typical: 2099.99, high: 2099.99 },
    source: KELLOGG,
    brand: "Reliance / Rheem / Rinnai",
    packSize: "each",
    scope: "unit only — no gas line, no venting, no labour",
    singleRead: true,
    regions: { CA: { cost: { low: 1988, typical: 2100, high: 2160 }, currency: "CAD", source: HD_CA } },
    note: "§2.2 — an unusually tight band across three brands and both currencies. §10 lists gas tankless as one of the few big-ticket items where a single shipped default is safe.",
  }),

  wh_expansion_tank_2gal: material({
    label: "Thermal expansion tank, 2 gal",
    category: "water_heater",
    unit: "each",
    cost: { low: 34.42, typical: 45, high: 60 },
    source: KELLOGG,
    packSize: "each",
    scope: "tank only",
  }),

  wh_drain_pan_plastic: material({
    label: 'Water heater drain pan, plastic, 20"–28"',
    category: "water_heater",
    unit: "each",
    cost: { low: 9.69, typical: 12.79, high: 15.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "pan only — the pan adapter fitting is ~$4.39 and the drain line is separate",
  }),

  wh_tp_valve: material({
    label: 'T&P relief valve, ¾"',
    category: "water_heater",
    unit: "each",
    cost: { low: 24.99, typical: 24.99, high: 24.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "valve only",
    singleRead: true,
  }),

  wh_seismic_strap_kit: material({
    label: "Seismic / earthquake strap kit",
    category: "water_heater",
    unit: "kit",
    cost: { low: 24.99, typical: 28, high: 32.99 },
    source: KELLOGG,
    packSize: "kit",
    scope: "straps and anchors",
  }),

  wh_gas_flex_connector: material({
    label: "Gas flex connector",
    category: "water_heater",
    unit: "each",
    cost: { low: 15, typical: 20, high: 35 },
    source: NOT_READ,
    confidence: "inferred",
    packSize: "each",
    scope: "connector only",
    note: "§11 — in every water-heater swap and a guess right now. Never read off a page.",
  }),

  wh_dielectric_union: material({
    label: 'Dielectric union, ¾"',
    category: "water_heater",
    unit: "each",
    cost: { low: 12, typical: 15, high: 22 },
    source: NOT_READ,
    confidence: "inferred",
    packSize: "each",
    scope: "union only",
    note: "§11 — in every water-heater swap and a guess right now. Never read off a page.",
  }),

  // ── Valves & controls ─────────────────────────────────────────────────────
  prv_three_quarter: material({
    label: 'Pressure reducing valve (PRV), ¾"',
    category: "valve",
    unit: "each",
    cost: { low: 67.99, typical: 70, high: 229.99 },
    source: KELLOGG,
    brand: "Cash Acme at the low end, Watts at the high",
    packSize: "each",
    scope: "valve only",
    spread: 3.4,
    note: "§3 / §10 rank 9 — the sleeper. A 'commodity' valve with a 3.4× retail spread, and the owner's estimate bills a heavy-duty ¾\" PRV at $784, which is 3.4× the dearest retail part and 11.5× the cheapest. A single default here misleads in both directions.",
  }),

  angle_stop_quarter_turn: material({
    label: "Angle stop, quarter-turn",
    category: "valve",
    unit: "each",
    cost: { low: 12.99, typical: 16.49, high: 19.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "stop only — supply line is separate",
  }),

  hose_bibb: material({
    label: 'Hose bibb, ½"–¾" MIP',
    category: "valve",
    unit: "each",
    cost: { low: 9.99, typical: 14.99, high: 28.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "bibb only",
  }),

  frost_free_sillcock_8: material({
    label: 'Frost-free sillcock, 8"',
    category: "valve",
    unit: "each",
    cost: { low: 36.22, typical: 36.22, high: 36.22 },
    source: KELLOGG,
    packSize: "each",
    scope: "sillcock only",
    singleRead: true,
  }),

  ball_valve_brass: unpriced({
    label: 'Brass ball valve, ½"–1"',
    category: "valve",
    unit: "each",
    scope: "valve only",
    reason: "§11 — only PVC ball valves were priced ($5.99–29.99). Brass was not read at any size.",
  }),

  mixing_valve_thermostatic: unpriced({
    label: "Thermostatic mixing valve (point-of-use / whole-house)",
    category: "valve",
    unit: "each",
    scope: "valve only",
    reason:
      "§11 — only SHOWER thermostatic bodies were priced ($200–600). A tempering valve is a different part and must not borrow that band.",
  }),

  backflow_preventer_rpz: unpriced({
    label: "Backflow preventer (RPZ / DCVA)",
    category: "valve",
    unit: "each",
    scope: "device only",
    reason:
      "§11 — the only backflow-family part priced was a hose-connection vacuum breaker at $77.99, which is not the same device.",
  }),

  // ── Fixtures — allowances, not cost defaults (§10, Part 4 rule #9) ─────────
  toilet: allowance({
    label: "Toilet",
    category: "fixture",
    unit: "each",
    tieringAxis: ["bowl shape (round / elongated)", "height (standard / comfort / ADA)"],
    observedRange: { low: 72.99, high: 1549.99 },
    spread: 21,
    source: KELLOGG,
    packSize: "each — bowl, tank and seat vary by SKU and by whether the seat is included",
    scope: "fixture only — wax ring, closet bolts, supply line and labour are separate, and all three are unpriced in §11",
    note: "§10 rank 1 — the widest spread of anything in plumbing, and that is inside ONE builder-oriented catalogue. §4.1 also records that comfort height costs $20–40 more than standard, not $150: any tier charging more than that for height is charging for a sales decision.",
  }),

  shower_valve_trim: allowance({
    label: "Shower valve and trim (complete)",
    category: "fixture",
    unit: "set",
    tieringAxis: ["valve technology (pressure-balance vs thermostatic)", "outlet count"],
    observedRange: { low: 130, high: 1500 },
    spread: 12,
    source: KELLOGG,
    packSize: "valve body plus trim kit",
    scope: "valve and trim only",
    note: "§10 rank 2 / §4.4 — pressure-balance vs thermostatic is a 4–6× decision and a different PRODUCT, not a grade. It belongs on the quote as two named options with both numbers, never as an upgrade with a single adder. The installed price is also the one item §2D.1 of the pricing research forbids shipping a default for.",
  }),

  tub_surround: allowance({
    label: "Tub surround",
    category: "fixture",
    unit: "set",
    tieringAxis: ["piece count (3–5 piece)", "material"],
    observedRange: { low: 109, high: 879.99 },
    spread: 8,
    source: KELLOGG,
    packSize: "set",
    scope: "surround panels only",
  }),

  tub: allowance({
    label: "Bathtub",
    category: "fixture",
    unit: "each",
    tieringAxis: ["material (porcelain-enamel steel / fibreglass / acrylic / soaker)"],
    observedRange: { low: 259.99, high: 1599.99 },
    spread: 6.2,
    source: KELLOGG,
    packSize: "each",
    scope: "tub only — waste and overflow, valve and surround are separate",
  }),

  bathroom_faucet: allowance({
    label: "Bathroom sink faucet",
    category: "fixture",
    unit: "each",
    tieringAxis: ["mounting (centerset / widespread)", "brand and finish tier"],
    observedRange: { low: 25.99, high: 139.99 },
    spread: 5.4,
    realMarketSpread: "50×+ — §10 notes the real market runs past $1,500 while this catalogue stops at $139.99",
    source: KELLOGG,
    packSize: "each",
    scope: "faucet only — supply lines and drain assembly are separate",
    note: "§10 rank 5. The in-catalogue spread understates this badly, which is exactly why it is an allowance rather than a default at 5.4×.",
  }),

  kitchen_faucet: allowance({
    label: "Kitchen faucet",
    category: "fixture",
    unit: "each",
    tieringAxis: ["handle count", "pull-out / pull-down spray", "brand and finish tier"],
    observedRange: { low: 49.99, high: 209.99 },
    spread: 4.2,
    realMarketSpread: "24× — §10 notes the real market runs past $1,200",
    source: KELLOGG,
    packSize: "each",
    scope: "faucet only",
    note: "plumbing-material-costs.md §7 rank 4 — clients often supply their own, and when they do the quote line is pure labour and must be structured that way.",
  }),

  kitchen_sink: allowance({
    label: "Kitchen sink",
    category: "fixture",
    unit: "each",
    tieringAxis: ["gauge (20 ga vs 18 ga)", "material (stainless / composite / fireclay)"],
    observedRange: { low: 149.99, high: 799.99 },
    spread: 5.3,
    source: KELLOGG,
    packSize: "each",
    scope: "sink only",
    note: "§4.3 — gauge is the price driver in stainless: 20 ga → 18 ga is +40% at the same size. Encode gauge, not just 'SS sink'.",
  }),

  bathroom_lav_sink: unpriced({
    label: "Bathroom lavatory sink",
    category: "fixture",
    unit: "each",
    scope: "sink only",
    reason: "§11 — the category exists but only kitchen sinks rendered a price page.",
  }),

  // ── Appliances & pumps — real axes, real reads ────────────────────────────
  garbage_disposal_third_hp: material({
    label: "Garbage disposal, ⅓ hp",
    category: "appliance",
    unit: "each",
    cost: { low: 79.99, typical: 119.99, high: 144.99 },
    source: KELLOGG,
    brand: "Waste King / InSinkErator",
    packSize: "each",
    scope: "unit only",
    note: "§4.5 — ⅓ hp to ½ hp is only +$5–20 of material. A price book charging a meaningful upgrade fee between those two is charging for nothing.",
  }),

  garbage_disposal_half_hp: material({
    label: "Garbage disposal, ½ hp",
    category: "appliance",
    unit: "each",
    cost: { low: 94.99, typical: 134.99, high: 149.99 },
    source: KELLOGG,
    brand: "Waste King / InSinkErator",
    packSize: "each",
    scope: "unit only",
  }),

  garbage_disposal_three_quarter_hp: material({
    label: "Garbage disposal, ¾ hp",
    category: "appliance",
    unit: "each",
    cost: { low: 169.99, typical: 204.99, high: 299.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "unit only",
    note: "§4.5 — ¾ hp is the first real step up in cost.",
  }),

  garbage_disposal_one_hp: material({
    label: "Garbage disposal, 1 hp",
    category: "appliance",
    unit: "each",
    cost: { low: 219.99, typical: 300, high: 399.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "unit only",
  }),

  sump_pump_third_hp: material({
    label: "Sump pump, ⅓ hp submersible",
    category: "appliance",
    unit: "each",
    cost: { low: 109.99, typical: 144.99, high: 189.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "pump only — basin, check valve and discharge are separate",
  }),

  sump_pump_half_hp: material({
    label: "Sump pump, ½ hp submersible",
    category: "appliance",
    unit: "each",
    cost: { low: 169.99, typical: 194.99, high: 344.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "pump only",
  }),

  sewage_ejector_half_hp: material({
    label: "Sewage ejector pump, ½ hp",
    category: "appliance",
    unit: "each",
    cost: { low: 214.99, typical: 309.99, high: 499.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "pump only — basin and venting are separate and dominate the job cost",
  }),

  water_softener_40k: material({
    label: "Water softener, 40k grain",
    category: "appliance",
    unit: "each",
    cost: { low: 400, typical: 600, high: 800 },
    source: KELLOGG,
    packSize: "each",
    scope: "unit only — bypass, drain and brine line are separate",
    note: "plumbing-material-costs.md §7 rank 5 — sold heavily online, so homeowners shop this before calling. An unexplained installed number reads badly.",
  }),

  washer_outlet_box: unpriced({
    label: "Washer outlet box",
    category: "appliance",
    unit: "each",
    scope: "box only",
    reason:
      "§11 — the category exists and no price was read. The only figure anywhere is $560 INSTALLED on the owner's estimate, which is a price, not a cost.",
  }),

  laundry_tub: unpriced({
    label: "Laundry tub / utility sink",
    category: "appliance",
    unit: "each",
    scope: "tub only",
    reason: "§11 — the category exists and no price page rendered.",
  }),

  // ── Drainage ──────────────────────────────────────────────────────────────
  p_trap_pvc_1_5: material({
    label: 'P-trap, PVC 1½"',
    category: "drainage",
    unit: "each",
    cost: { low: 6.29, typical: 6.29, high: 6.29 },
    source: KELLOGG,
    packSize: "each",
    scope: "trap only — with union $8.99–16.99, with cleanout $11.49",
    singleRead: true,
  }),

  p_trap_brass_1_25: material({
    label: 'P-trap, brass 1¼"–1½" chrome',
    category: "drainage",
    unit: "each",
    cost: { low: 32.99, typical: 34.99, high: 36.99 },
    source: KELLOGG,
    packSize: "each",
    scope: "trap only",
    note: "§5 — brass P-traps cost 5× plastic. Exposed-trap work under a pedestal lav is a different line item from a vanity trap, and pricing them the same is a real error.",
  }),

  closet_flange: unpriced({
    label: "Closet flange",
    category: "drainage",
    unit: "each",
    scope: "flange only",
    reason:
      "§11 — the 'floor & wall flanges' category turned out to be escutcheons and split plates. Closet flanges were never found at any readable source.",
  }),

  wax_ring: unpriced({
    label: "Wax ring / wax-free seal",
    category: "drainage",
    unit: "each",
    scope: "seal only",
    reason: "§11 — toilet-parts leaf pages returned 404 or category-only.",
  }),

  floor_drain: unpriced({
    label: "Floor drain",
    category: "drainage",
    unit: "each",
    scope: "drain only",
    reason: "§11 — the category exists; the leaf page was never read.",
  }),

  // ── Consumables ───────────────────────────────────────────────────────────
  solvent_cement_4oz: material({
    label: "PVC / ABS / CPVC solvent cement, 4 oz",
    category: "consumable",
    unit: "can",
    cost: { low: 6.29, typical: 7.5, high: 8.29 },
    source: KELLOGG,
    packSize: "4 oz can (32 oz runs $22.49–23.99; a cement-plus-primer kit $11.49–23.99)",
    scope: "cement only",
  }),

  lead_free_solder: material({
    label: "Lead-free solder, 1 lb",
    category: "consumable",
    unit: "lb",
    cost: { low: 29.99, typical: 35, high: 44.99 },
    source: KELLOGG,
    packSize: "1 lb spool",
    scope: "solder only",
  }),

  soldering_flux: material({
    label: "Soldering flux, 1 lb",
    category: "consumable",
    unit: "tub",
    cost: { low: 8, typical: 12, high: 18 },
    source: NOT_READ,
    confidence: "inferred",
    packSize: "1 lb tub",
    scope: "flux only",
    note: "§11 — general knowledge, never read.",
  }),

  ptfe_tape: material({
    label: "PTFE / thread tape",
    category: "consumable",
    unit: "roll",
    cost: { low: 1, typical: 2, high: 4 },
    source: NOT_READ,
    confidence: "inferred",
    packSize: "roll",
    scope: "tape only",
    note: "§11 — general knowledge, never read.",
  }),

  pipe_strap_two_hole_half: material({
    label: 'Two-hole galvanised strap, ½"',
    category: "consumable",
    unit: "each",
    cost: { low: 0.5, typical: 0.5, high: 0.5 },
    source: KELLOGG,
    packSize: "10-pack ($4.99)",
    scope: "strap only",
    singleRead: true,
  }),

  pipe_insulation: material({
    label: 'Pipe insulation, ½"–¾"',
    category: "consumable",
    unit: "per_ft",
    cost: { low: 0.25, typical: 0.47, high: 0.8 },
    source: KELLOGG,
    packSize: "6 ft lengths, 25 ft and 50 ft rolls",
    scope: "insulation only",
  }),
};

// ── Overrides ───────────────────────────────────────────────────────────────
//
// getRecipe()'s semantics, exactly: a shallow spread at the top, then a rebuild
// of each overridden nested key, then one further object-aware merge inside it.
// Here EVERY material is a nested key, which is what gives a company overriding
// `pex_b_half.cost.typical` a merge rather than a wipe — their supplier's
// typical lands on top of the read low and high instead of erasing them.

const NESTED_KEYS = Object.keys(PLUMBING_MATERIALS);

/**
 * Merge a company's saved material-cost overrides on top of these defaults.
 * `overrides` only needs the keys that differ. Safe to call with nothing.
 *
 * The nesting depth is deliberate and matches materialRecipes.getRecipe():
 * one level for the item, one more for the objects inside it (`cost`,
 * `source`, `observedRange`). Deeper than that replaces rather than merges,
 * which is the same behaviour the recipe merge has always had.
 */
export function getPlumbingMaterials(overrides) {
  const base = PLUMBING_MATERIALS;
  if (!overrides || Object.keys(overrides).length === 0) return base;

  const merged = { ...base, ...overrides };
  for (const key of NESTED_KEYS) {
    if (overrides[key]) {
      merged[key] = { ...base[key] };
      for (const subKey of Object.keys(overrides[key])) {
        merged[key][subKey] =
          base[key]?.[subKey] && typeof overrides[key][subKey] === "object"
            ? { ...base[key][subKey], ...overrides[key][subKey] }
            : overrides[key][subKey];
      }
    }
  }
  return merged;
}

/**
 * One material's cost in one region.
 *
 * Refuses rather than converts. §9 measured CAD/USD ratios from 0.85 to 1.53
 * across categories — a single FX multiplier is wrong by up to 60% on water
 * heaters and up to 40% the other way on plastics — so a region with no read of
 * its own gets `available: false` and the reason, not an arithmetic answer.
 * Allowances and unpriced items refuse too, for their own reasons.
 */
export function getMaterialCost(key, region = "US", overrides) {
  const materials = getPlumbingMaterials(overrides);
  const item = materials[key];

  if (!item) {
    return { available: false, reason: `No plumbing material named "${key}".` };
  }
  if (item.type === "allowance") {
    return {
      available: false,
      allowance: true,
      reason: `"${item.label}" is an allowance, not a cost default — it spans ${item.spread}× on homeowner taste alone. Pick a tier on the ${item.tieringAxis.join(" and ")} axis, or carry it as an allowance line.`,
      tieringAxis: item.tieringAxis,
      observedRange: item.observedRange,
    };
  }
  if (item.type === "unpriced") {
    return { available: false, unpriced: true, reason: item.reason };
  }

  if (region === item.primaryRegion) {
    return {
      available: true,
      cost: item.cost,
      currency: item.currency,
      source: item.source,
      confidence: item.confidence,
    };
  }

  const regional = item.regions?.[region];
  if (regional) {
    return {
      available: true,
      cost: regional.cost,
      currency: regional.currency,
      source: regional.source,
      confidence: regional.confidence || item.confidence,
    };
  }

  return {
    available: false,
    noRegionalRead: true,
    reason: `No ${region} price was read for "${item.label}", and this module will not convert the ${item.primaryRegion} figure. §9 measured CAD/USD ratios of 0.85–1.53 across categories; a single FX multiplier is wrong by up to 60% on water heaters and up to 40% the other way on plastics. Store a regional cost instead.`,
  };
}

/** "retail, 2026-08-10, North Carolina, USA" — the label Part 4 rule #10 asks
 *  for, built from the source rather than typed alongside it so the two cannot
 *  drift apart. */
export function materialSourceLabel(key, overrides) {
  const item = getPlumbingMaterials(overrides)[key];
  if (!item) return null;
  const { priceBasis, readDate, region, retailer } = item.source;
  return `${priceBasis}, ${readDate}, ${region} — ${retailer}`;
}
