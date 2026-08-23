// lib/documents/serviceContent.js
//
// What a quote SAYS about each trade, beyond the price.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// FieldQuo already supports multi-service quotes: a quote has scopeGroups,
// each pointing at a ServiceCategory, so "interior painting + flooring" or
// "cabinets + countertop" already works as data. What it didn't have was
// anything to SAY about each one. Every group rendered as a bare label over a
// list of amounts, so a $14,000 kitchen quote and a $200 tap repair looked
// like the same document at different scales.
//
// The gap between those two is not price, it's confidence. A client comparing
// three quotes picks the one that reads like the company has done this before:
// what's included, in what order, what happens on which day. That content is
// identical for every painter in the country, which is exactly why it should
// ship as a default rather than be homework for someone who signed up an hour
// ago.
//
// ── Defaults in code, overrides in the database ─────────────────────────────
//
// These live in a JS file, keyed on ServiceCategory.key, rather than being
// seeded into rows. Two reasons:
//
//   1. Improving the wording for every existing company is an edit here, not a
//      migration that has to avoid clobbering anyone who customised theirs.
//   2. A company that HAS customised theirs is stored in
//      CompanyServiceCategory, and overrides cleanly — see resolveServiceContent
//      below. Their edit survives every change made here.
//
// ── The claims are deliberately unverifiable-free ──────────────────────────
//
// Nothing here states a warranty term, a price, a cure time, a brand of
// material or a number of days. Those vary by company and by job, and a
// default that quietly asserts "5-year warranty" on behalf of a contractor who
// offers two is not a nice touch, it's a contract term they didn't agree to.
// Anything specific is left for the company to add.

// Per-trade accent. Used for the left border and badge on each scope card, so
// a three-trade quote reads as three sections rather than one long list.
//
// These are chosen to sit alongside ANY brand colour without clashing —
// desaturated, mid-lightness, and used only as a thin border plus a wash. The
// page's own accent (rules, totals, buttons) always stays the company's.
const PALETTE = {
  slate: "#5b6b7f",
  teal: "#3f7d78",
  moss: "#5c7a4a",
  clay: "#a86a48",
  plum: "#7a5a86",
  ochre: "#9a7b3c",
  denim: "#4a6795",
  rust: "#9c5a49",
};

// Shared step sets. Most trades genuinely follow one of these shapes, and
// pretending otherwise would mean sixty near-identical arrays that drift.
const PREP_APPLY_FINISH = [
  {
    title: "Walkthrough and confirmation",
    body: "We confirm the scope on site, agree the finish and colours, and answer anything outstanding before work starts.",
  },
  {
    title: "Protection and preparation",
    body: "Furniture moved or covered, surrounding surfaces masked, and all surfaces cleaned and prepared for a lasting result.",
  },
  {
    title: "Repairs and priming",
    body: "Imperfections filled and sanded, and primer applied where it's needed for adhesion and coverage.",
  },
  {
    title: "Application",
    body: "The finish is applied in full coats, with the drying time between them that the product actually requires.",
  },
  {
    title: "Cleanup and final walkthrough",
    body: "Masking removed, the area left clean, and a walkthrough with you before we call it done.",
  },
];

const MEASURE_SUPPLY_INSTALL = [
  {
    title: "Consultation and selection",
    body: "We confirm the scope, materials and finishes with you, and answer anything outstanding before ordering.",
  },
  {
    title: "Measurement",
    body: "Exact measurements taken on site so the material is cut to your space rather than to an estimate.",
  },
  {
    title: "Ordering and fabrication",
    body: "Materials ordered and prepared to the confirmed measurements.",
  },
  {
    title: "Removal and preparation",
    body: "Existing material removed and disposed of where that's part of the scope, and the area prepared for installation.",
  },
  {
    title: "Installation and walkthrough",
    body: "Installed, levelled, sealed and cleaned, followed by a walkthrough with you.",
  },
];

const ASSESS_REPAIR_TEST = [
  {
    title: "Assessment",
    body: "We diagnose the problem on site and confirm what's needed before any work or parts are committed to.",
  },
  {
    title: "Confirmation",
    body: "If the job turns out to differ from what was quoted, you hear about it before we proceed — not afterwards on the invoice.",
  },
  {
    title: "The work",
    body: "Carried out to code, using the parts and methods set out in this quote.",
  },
  {
    title: "Testing",
    body: "Everything is tested under normal operating conditions before we pack up.",
  },
  {
    title: "Cleanup and handover",
    body: "The area is left as we found it, and we walk you through what was done and anything to watch for.",
  },
];

const VISIT_SERVICE_VERIFY = [
  {
    title: "Confirmation",
    body: "We confirm access, timing and anything specific you'd like attention paid to.",
  },
  {
    title: "Preparation",
    body: "The area is prepared and anything that needs protecting is covered before we begin.",
  },
  {
    title: "The work",
    body: "Carried out to the scope set out in this quote, with our own equipment and materials unless stated otherwise.",
  },
  {
    title: "Inspection",
    body: "We check the work over before leaving and put right anything that isn't up to standard.",
  },
];

const PLAN_BUILD_HANDOVER = [
  {
    title: "Scope and schedule",
    body: "We confirm the full scope, sequence the trades, and agree a start date and expected duration with you.",
  },
  {
    title: "Permits and preparation",
    body: "Any permits and inspections required are arranged, and the site is prepared and protected.",
  },
  {
    title: "Demolition and rough-in",
    body: "Existing material removed and structural, electrical and plumbing work brought to inspection-ready.",
  },
  {
    title: "Finishes",
    body: "Surfaces, fixtures and finishes installed to the specification agreed above.",
  },
  {
    title: "Inspection and handover",
    body: "Final inspection, deficiency list cleared, site cleaned, and a walkthrough with you.",
  },
];

// Generic — used for any category not listed below, and for custom categories
// a company creates. Vague enough to be true of any trade, specific enough to
// beat a blank space.
const GENERIC = {
  accent: PALETTE.slate,
  included: [
    "All labour and equipment needed to complete the work described above",
    "Protection of surrounding surfaces and finishes while we're on site",
    "Cleanup and removal of our own debris on completion",
    "A walkthrough with you before the job is signed off",
  ],
  steps: VISIT_SERVICE_VERIFY,
};

// Only the trades where the wording genuinely differs get their own entry.
// Everything else inherits GENERIC, which is honest rather than padded.
const CONTENT = {
  // ── Coatings and finishes ────────────────────────────────────────────────
  interior_painting: {
    accent: PALETTE.denim,
    included: [
      "Furniture moved or covered and floors protected throughout",
      "Nail holes and cracks filled, rough areas sanded, gaps caulked",
      "Primer applied where needed for colour change, repairs or bare surfaces",
      "Full coats of premium paint on every surface listed above",
      "Cut-in brushwork on trim, edges and detail rather than taped lines",
      "Outlet covers and hardware removed and refitted",
    ],
    steps: PREP_APPLY_FINISH,
  },
  exterior_painting: {
    accent: PALETTE.teal,
    included: [
      "Surfaces washed and left to dry properly before any coating goes on",
      "Loose and peeling material scraped back, rough areas sanded",
      "Joints, seams and gaps caulked; minor surface repairs made good",
      "Exterior-grade primer on bare and repaired areas",
      "Full coats of exterior paint on every surface listed above",
      "Site left clear of masking, drop sheets and debris",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refinishing: {
    accent: PALETTE.ochre,
    included: [
      "Doors, drawer fronts and hardware removed, labelled and refitted",
      "All surfaces degreased, sanded and prepared for adhesion",
      "Primer applied to block staining and give the topcoat something to hold",
      "Sprayed topcoat on both faces of every door and drawer front",
      "Cabinet box exteriors finished to match",
      "Hardware refitted and doors realigned before handover",
    ],
    steps: PREP_APPLY_FINISH,
  },
  cabinet_refacing: {
    accent: PALETTE.ochre,
    included: [
      "New door and drawer fronts made to your cabinet dimensions",
      "Cabinet box exteriors finished to match the new fronts",
      "Hinges supplied, fitted and adjusted",
      "Handle positions drilled to your chosen placement",
      "Existing doors and fronts removed and taken away",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  stairs: {
    accent: PALETTE.clay,
    included: [
      "Surrounding walls, spindles and flooring masked and protected",
      "Treads and components sanded back ready for finish",
      "Gaps, dents and imperfections filled",
      "Stain applied evenly across all prepared surfaces",
      "Protective finish coats with light sanding between them",
      "Care and drying guidance at handover",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring: {
    accent: PALETTE.moss,
    included: [
      "Furniture moved as required and surrounding areas protected",
      "Loose boards secured and the floor checked before sanding",
      "Progressive sanding to remove the old finish and level the surface",
      "Nail holes and gaps filled before the final pass",
      "Stain applied uniformly where a colour has been selected",
      "Protective finish coats with screening between them",
    ],
    steps: PREP_APPLY_FINISH,
  },
  flooring_install: { accent: PALETTE.moss, steps: MEASURE_SUPPLY_INSTALL },
  countertop: {
    accent: PALETTE.plum,
    included: [
      "Material supplied to the specification set out above",
      "Templating on site so the fit is to your actual cabinets",
      "Existing countertop removed and disposed of",
      "Fabrication including edge profile and any cutouts listed",
      "Installation, levelling and seaming",
      "Joints, seams and the perimeter sealed",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  tiling: { accent: PALETTE.plum, steps: MEASURE_SUPPLY_INSTALL },
  drywall: { accent: PALETTE.slate, steps: PREP_APPLY_FINISH },
  drywall_install: { accent: PALETTE.slate, steps: PREP_APPLY_FINISH },

  // ── Mechanical and electrical ────────────────────────────────────────────
  plumbing: { accent: PALETTE.denim, steps: ASSESS_REPAIR_TEST },
  electrical: { accent: PALETTE.ochre, steps: ASSESS_REPAIR_TEST },
  hvac_install: { accent: PALETTE.teal, steps: MEASURE_SUPPLY_INSTALL },
  hvac_repair: { accent: PALETTE.teal, steps: ASSESS_REPAIR_TEST },
  appliance_repair: { accent: PALETTE.slate, steps: ASSESS_REPAIR_TEST },
  garage_door: { accent: PALETTE.slate, steps: ASSESS_REPAIR_TEST },
  locksmith: { accent: PALETTE.slate, steps: ASSESS_REPAIR_TEST },
  well_water: { accent: PALETTE.denim, steps: ASSESS_REPAIR_TEST },
  elevator_services: { accent: PALETTE.slate, steps: ASSESS_REPAIR_TEST },
  mechanical_contracting: { accent: PALETTE.denim, steps: ASSESS_REPAIR_TEST },
  installation_services: {
    accent: PALETTE.slate,
    steps: MEASURE_SUPPLY_INSTALL,
  },

  // ── Structure and envelope ───────────────────────────────────────────────
  roofing_service: {
    accent: PALETTE.rust,
    included: [
      "Existing material stripped and removed from site",
      "Decking inspected and any damaged sections reported before replacement",
      "Underlayment, flashing and ventilation as required",
      "New roofing installed to manufacturer specification",
      "Grounds cleared and swept for nails and debris",
    ],
    steps: MEASURE_SUPPLY_INSTALL,
  },
  siding: { accent: PALETTE.rust, steps: MEASURE_SUPPLY_INSTALL },
  masonry: { accent: PALETTE.rust, steps: MEASURE_SUPPLY_INSTALL },
  concrete: { accent: PALETTE.slate, steps: MEASURE_SUPPLY_INSTALL },
  paving: { accent: PALETTE.slate, steps: MEASURE_SUPPLY_INSTALL },
  driveway_sealing: { accent: PALETTE.slate, steps: PREP_APPLY_FINISH },
  fence_services: { accent: PALETTE.moss, steps: MEASURE_SUPPLY_INSTALL },
  chimney_sweep: { accent: PALETTE.rust, steps: VISIT_SERVICE_VERIFY },
  restoration: { accent: PALETTE.rust, steps: ASSESS_REPAIR_TEST },
  excavation: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },
  demolition: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },
  demolition_contractor: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },

  // ── Whole-project ────────────────────────────────────────────────────────
  general_contracting: { accent: PALETTE.slate, steps: PLAN_BUILD_HANDOVER },
  general_contracting_reno: {
    accent: PALETTE.slate,
    steps: PLAN_BUILD_HANDOVER,
  },
  construction: { accent: PALETTE.slate, steps: PLAN_BUILD_HANDOVER },
  remodeling: { accent: PALETTE.clay, steps: PLAN_BUILD_HANDOVER },
  carpentry: { accent: PALETTE.ochre, steps: MEASURE_SUPPLY_INSTALL },
  handyman: { accent: PALETTE.slate, steps: VISIT_SERVICE_VERIFY },
  property_maintenance: { accent: PALETTE.slate, steps: VISIT_SERVICE_VERIFY },

  // ── Cleaning ─────────────────────────────────────────────────────────────
  residential_cleaning: {
    accent: PALETTE.teal,
    included: [
      "All cleaning products and equipment supplied by us",
      "Every room and surface listed above",
      "Fixtures, fittings and touchpoints wiped down",
      "Rubbish removed and bins relined",
    ],
    steps: VISIT_SERVICE_VERIFY,
  },
  deep_cleaning: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  commercial_cleaning: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  janitorial: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  carpet_cleaning: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  window_cleaning: { accent: PALETTE.denim, steps: VISIT_SERVICE_VERIFY },
  pressure_washing_house: {
    accent: PALETTE.denim,
    steps: VISIT_SERVICE_VERIFY,
  },
  pressure_washing_driveway: {
    accent: PALETTE.denim,
    steps: VISIT_SERVICE_VERIFY,
  },
  auto_detailing: { accent: PALETTE.denim, steps: VISIT_SERVICE_VERIFY },
  junk_removal: { accent: PALETTE.clay, steps: VISIT_SERVICE_VERIFY },

  // ── Grounds ──────────────────────────────────────────────────────────────
  landscaping_design: { accent: PALETTE.moss, steps: PLAN_BUILD_HANDOVER },
  lawn_care: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  lawn_mowing: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  irrigation: { accent: PALETTE.moss, steps: MEASURE_SUPPLY_INSTALL },
  tree_care_service: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  snow_removal: { accent: PALETTE.denim, steps: VISIT_SERVICE_VERIFY },
  pest_control: { accent: PALETTE.ochre, steps: VISIT_SERVICE_VERIFY },
  pool_spa: { accent: PALETTE.teal, steps: VISIT_SERVICE_VERIFY },
  dog_walking: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
  pooper_scooper: { accent: PALETTE.moss, steps: VISIT_SERVICE_VERIFY },
};

/**
 * Resolve the content for one scope group.
 *
 * Precedence, most specific first:
 *   1. What the company wrote for this category (CompanyServiceCategory)
 *   2. The default for that category key, here
 *   3. GENERIC
 *
 * @param categoryKey  ServiceCategory.key; null for a group with no category
 * @param override     the CompanyServiceCategory row, when one was loaded
 */
export function resolveServiceContent(categoryKey, override) {
  const base = CONTENT[categoryKey] || {};

  const included =
    firstArray(override?.includedItems) || base.included || GENERIC.included;

  const steps =
    firstArray(override?.processSteps) || base.steps || GENERIC.steps;

  return {
    accent: override?.accentColor || base.accent || GENERIC.accent,
    included,
    // Numbered here rather than in the data, so reordering or removing a step
    // can't leave a document numbered 1, 2, 4.
    steps: steps.map((s, i) => ({ ...s, num: i + 1 })),
  };
}

function firstArray(v) {
  return Array.isArray(v) && v.length ? v : null;
}

/**
 * Process steps for a whole quote.
 *
 * A multi-service quote would otherwise repeat five near-identical steps per
 * trade — fifteen numbered bubbles saying much the same thing, which reads as
 * padding rather than as thoroughness. So the steps shown once at the bottom
 * are those of the LARGEST scope group by value, which is the work the client
 * is really deciding about. Each group still carries its own "what's included"
 * inline, because that part genuinely differs.
 */
export function dominantProcessSteps(groups = []) {
  if (!groups.length)
    return GENERIC.steps.map((s, i) => ({ ...s, num: i + 1 }));

  const biggest = [...groups].sort(
    (a, b) => Number(b.subtotal || 0) - Number(a.subtotal || 0),
  )[0];

  return resolveServiceContent(biggest?.categoryKey, biggest?.override).steps;
}

export { PALETTE as SERVICE_PALETTE };
