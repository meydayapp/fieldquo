// prisma/seed-construction-checklists.js
//
//   npm run seed:construction-checklists
//
// The 88 construction inspection checklists — 2,491 items across 579 sections
// — seeded as SYSTEM templates (companyId null) and filed under the trade that
// actually does the work.
//
// ── How this differs from seed-checklists.js ───────────────────────────────
//
// That file seeds the residential trade lists: short, in a contractor's voice,
// three phases per trade, a line you tick. This one seeds inspection regimes:
// each item has an objective acceptance threshold, often a published standard
// section (OSHA 29 CFR 1926, ACI, ASTM, AISC, AWS, NFPA, SMACNA, TMS), a
// response type that may be a measurement rather than a tick, and flags for
// hold points and required photographs.
//
// They share one shape on purpose — see lib/jobs/checklistItems.js. A crew
// ticks both on the same phone from the same screen.
//
// ── Offered, never applied ─────────────────────────────────────────────────
//
// Same rule as every other seeded list: nothing here is stamped onto a real
// visit on its own. A seeded checklist is a suggestion in a picker. Putting 44
// paving inspection items on a work order under a company's name because we
// guessed their process would be inventing it for them.
//
// ── Why one category per checklist and not several ─────────────────────────
//
// Several trades genuinely touch some of these — a cladding inspection is a
// siding contractor's and a masonry contractor's business both. Seeding a row
// per (checklist, trade) pair would put the same list in the picker twice for
// anyone enabled in both, and the picker is already the place where duplicate
// entries do the most damage.
//
// So each gets ONE home: the trade whose crew is holding the tape. Everything
// stays reachable regardless, because the settings screen searches the whole
// system library rather than only the trades a company switched on — a general
// contractor should not have to enable "masonry" to find a masonry checklist.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db } from "../lib/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(here, "data", "construction-checklists.json");

// Kept in step with lib/jobs/checklistItems.js. Duplicated as literals rather
// than imported because this file runs under plain node, where the "@/" alias
// the rest of the codebase uses doesn't resolve.
const PHASES = ["pre", "during", "post"];

// ── The map ────────────────────────────────────────────────────────────────
//
// checklist id → [ServiceCategory.key, phase]
//
// The phase is the moment in a visit the whole list belongs to, not the moment
// each item belongs to — a construction checklist carries its own internal
// order in its section names ("Surface Preparation" before "Finish Coat
// Application"), and re-slicing 579 sections into three buckets would destroy
// a sequence the author chose.
//
// Where no trade category fits (structural steel, air barriers, suspended
// ceilings), the home is `construction` — the general category a commercial
// builder enables — rather than the nearest half-match. Filing a welding
// inspection under "carpentry" because both are framing would be worse than
// filing it under the trade that has no narrower name.
const MAP = {
  // ── Pre-Construction & Planning ─────────────────── all before the work
  "bid-package-review-checklist": ["construction", "pre"],
  "design-review-and-validation-checklist": ["construction", "pre"],
  "geotechnical-investigation-review-checklist": ["construction", "pre"],
  "permitting-and-regulatory-compliance-checklist": ["construction", "pre"],
  "pre-construction-site-assessment-checklist": ["construction", "pre"],
  "project-kick-off-meeting-checklist": ["construction", "pre"],
  "proposal-submission-compliance-checklist": ["construction", "pre"],
  "stakeholder-communication-plan-checklist": ["construction", "pre"],
  "subcontractor-prequalification-checklist": ["construction", "pre"],
  "title-search-and-insurance-checklist": ["construction", "pre"],
  "value-engineering-checklist": ["construction", "pre"],

  // ── Site Mobilization, Safety & Compliance ──────────────────────────────
  // Utility locates and excavation safety file under excavation: the crew
  // running them is the one with the machine, and the 811 ticket is theirs.
  "excavation-safety-plan-checklist": ["excavation", "pre"],
  "utilities-coordination-checklist": ["excavation", "pre"],
  "jobsite-safety-and-compliance-checklist-construction-site-assessment": [
    "construction",
    "during",
  ],
  "site-mobilization-readiness-checklist": ["construction", "pre"],
  "steel-erection-safety-checklist": ["construction", "pre"],
  "subcontractor-compliance-checklist-construction-site-safety-and-legal-review": [
    "construction",
    "pre",
  ],
  "tree-protection-measures-checklist": ["tree_care_service", "pre"],
  "vegetation-removal-compliance-checklist": ["landscaping_design", "pre"],

  // ── Earthwork & Sitework ────────────────────────────────────────────────
  "backfilling-and-compaction-checklist-around-foundation": ["excavation", "during"],
  "cut-and-fill-balance-verification-checklist": ["excavation", "during"],
  "erosion-and-sediment-control-implementation-checklist": ["excavation", "during"],
  "foundation-excavation-inspection-checklist": ["excavation", "during"],
  "grade-control-and-survey-accuracy-checklist": ["excavation", "during"],
  "soil-compaction-verification-checklist": ["excavation", "during"],
  "stormwater-management-installation-checklist": ["excavation", "during"],
  "sub-base-preparation-checklist": ["excavation", "during"],
  "topsoil-salvage-and-stockpiling-checklist": ["excavation", "pre"],
  "topsoil-placement-and-grading-checklist": ["landscaping_design", "during"],

  // ── Concrete & Foundations ──────────────────────────────────────────────
  // Mix design and formwork design are reviewed before anyone pours; the rest
  // happen with a truck on site.
  "concrete-mix-design-verification-checklist": ["concrete", "pre"],
  "formwork-design-and-stability-checklist": ["concrete", "pre"],
  "concrete-delivery-and-placement-checklist": ["concrete", "during"],
  "concrete-pour-readiness-checklist-formwork-reinforcement-and-quality-control": [
    "concrete",
    "during",
  ],
  "concrete-pour-sequencing-checklist": ["concrete", "during"],
  "concrete-vibration-checklist": ["concrete", "during"],
  "footing-formwork-inspection-checklist": ["concrete", "during"],
  "reinforcement-bar-placement-checklist-rebar": ["concrete", "during"],
  "post-tensioning-checklist": ["concrete", "during"],
  "foundation-waterproofing-installation-checklist": ["concrete", "during"],
  // Curing and cylinder breaks are what you do after the pour is finished.
  "concrete-strength-testing-checklist": ["concrete", "post"],
  "foundation-curing-procedures-checklist": ["concrete", "post"],

  // ── Structural Steel & Framing ──────────────────────────────────────────
  "steel-fabrication-quality-control-checklist": ["construction", "pre"],
  "structural-steel-alignment-checklist": ["construction", "during"],
  "column-and-beam-alignment-and-plumbness-checklist": ["construction", "during"],
  "bolting-inspection-checklist": ["construction", "during"],
  "welding-inspection-checklist": ["construction", "during"],
  "framing-material-inspection-checklist": ["carpentry", "pre"],
  "framing-layout-verification-checklist": ["carpentry", "during"],
  "sheathing-installation-checklist": ["carpentry", "during"],
  "structural-sheathing-fastening-checklist": ["carpentry", "during"],

  // ── Building Envelope ───────────────────────────────────────────────────
  "roof-deck-preparation-checklist": ["roofing_service", "pre"],
  "roofing-membrane-installation-checklist": ["roofing_service", "during"],
  "flashing-installation-checklist": ["roofing_service", "during"],
  "roof-drainage-system-inspection-checklist": ["roofing_service", "post"],
  "cladding-system-installation-checklist-brick-siding-metal-panels-etc": [
    "siding",
    "during",
  ],
  "masonry-joint-inspection-checklist": ["masonry", "during"],
  "exterior-painting-and-staining-checklist": ["exterior_painting", "during"],
  "window-and-door-installation-alignment-checklist": ["installation_services", "during"],
  "window-and-door-weatherstripping-checklist": ["installation_services", "during"],
  "air-barrier-installation-checklist": ["construction", "during"],
  "insulation-installation-checklist-thermal-and-acoustic": ["construction", "during"],
  "waterproofing-membrane-installation-checklist": ["construction", "during"],

  // ── MEP & Systems ───────────────────────────────────────────────────────
  // The three testing/commissioning lists are post: they are what proves the
  // installation works, run once everything is in.
  "electrical-wiring-inspection-checklist": ["electrical", "during"],
  "building-automation-system-bas-configuration-checklist": ["electrical", "post"],
  "plumbing-pipe-pressure-testing-checklist": ["plumbing", "during"],
  "fixture-installation-checklist-sinks-toilets-etc": ["plumbing", "during"],
  "hvac-ductwork-installation-checklist": ["hvac_install", "during"],
  "fire-sprinkler-system-installation-checklist": ["mechanical_contracting", "during"],
  "system-functional-testing-checklist-mep-systems": ["mechanical_contracting", "post"],
  "performance-testing-checklist": ["mechanical_contracting", "post"],
  "operation-and-functionality-checklist": ["mechanical_contracting", "post"],

  // ── Interior Finishes ───────────────────────────────────────────────────
  "drywall-installation-and-fastening-checklist": ["drywall", "during"],
  "taping-and-mudding-inspection-checklist": ["drywall", "during"],
  "interior-painting-checklist": ["interior_painting", "during"],
  "flooring-installation-checklist": ["flooring", "during"],
  "ceiling-tile-installation-checklist": ["construction", "during"],

  // ── Paving & Landscape ──────────────────────────────────────────────────
  "paving-material-placement-checklist": ["paving", "during"],
  "compaction-verification-checklist-for-pavement": ["paving", "during"],
  "irrigation-system-installation-checklist": ["irrigation", "during"],
  "planting-installation-checklist": ["landscaping_design", "during"],

  // ── Materials, Closeout & Handover ──────────────────────────────────────
  "construction-material-inventory-checklist-template": ["construction", "pre"],
  "construction-material-inventory-tracking-checklist": ["construction", "during"],
  "renovation-project-checklist": ["remodeling", "during"],
  "as-built-drawings-verification-checklist": ["construction", "post"],
  "final-punch-list-completion-checklist": ["construction", "post"],
  "operation-and-maintenance-o-and-m-manuals-checklist": ["construction", "post"],
  "project-turnover-checklist": ["construction", "post"],
  "warranty-documentation-checklist": ["construction", "post"],
};

/**
 * Flatten a template's sections into one item array, stamping each item with
 * the section it came from.
 *
 * The nesting is not kept as nesting because JobVisit.checklistItems is a flat
 * array that three routes and two screens already read, and a visit's list is
 * a MERGE of whatever the crew applied — two checklists appended together have
 * no single section tree. Carrying the section on the item lets the renderer
 * rebuild the grouping either way round, and survives the merge.
 */
function flatten(template, phase) {
  const items = [];
  for (const section of template.sections || []) {
    for (const item of section.items || []) {
      const label = String(item.text || "").trim();
      if (!label) continue;

      const next = { label, done: false, phase };
      if (section.name) next.section = section.name;
      if (item.acceptance_criteria) next.criteria = item.acceptance_criteria;
      if (item.reference) next.reference = item.reference;
      if (item.response_type) next.responseType = item.response_type;
      if (item.unit) next.unit = item.unit;

      // expected_range is [min, max] with either end nullable — an open-ended
      // tolerance ("95% or greater") is the normal case here, not a gap.
      if (Array.isArray(item.expected_range)) {
        const [min, max] = item.expected_range;
        if (Number.isFinite(Number(min)) && min !== null && min !== "")
          next.expectedMin = Number(min);
        if (Number.isFinite(Number(max)) && max !== null && max !== "")
          next.expectedMax = Number(max);
      }
      if (Array.isArray(item.options) && item.options.length)
        next.options = item.options;

      if (item.critical === true) next.critical = true;
      if (item.photo_required === true) next.photoRequired = true;
      if (item.note_required_on_fail === true) next.noteRequiredOnFail = true;

      items.push(next);
    }
  }
  return items;
}

async function main() {
  const bundle = JSON.parse(readFileSync(BUNDLE, "utf8"));
  const templates = bundle.templates || [];

  // Resolve every category key up front. A key that isn't in the database is a
  // mapping bug, not a runtime condition to route around — seeding a checklist
  // with a null category would hide it from the picker forever while the seed
  // reported success.
  const wanted = [...new Set(Object.values(MAP).map(([key]) => key))];
  const categories = await db.serviceCategory.findMany({
    where: { key: { in: wanted }, companyId: null },
    select: { id: true, key: true },
  });
  const byKey = new Map(categories.map((c) => [c.key, c.id]));

  const missingCategories = wanted.filter((key) => !byKey.has(key));
  if (missingCategories.length) {
    throw new Error(
      `ServiceCategory rows missing for: ${missingCategories.join(", ")}. ` +
        `Run \`npm run seed\` first.`,
    );
  }

  const unmapped = templates.filter((t) => !MAP[t.id]).map((t) => t.id);
  if (unmapped.length) {
    throw new Error(
      `${unmapped.length} checklist(s) have no category mapping: ${unmapped.join(", ")}`,
    );
  }

  let written = 0;
  let items = 0;

  for (const template of templates) {
    const [categoryKey, rawPhase] = MAP[template.id];
    const phase = PHASES.includes(rawPhase) ? rawPhase : "during";
    const categoryId = byKey.get(categoryKey);
    const flat = flatten(template, phase);

    if (!flat.length) {
      console.warn(`[skip] ${template.id} produced no items`);
      continue;
    }

    const meta = {
      description: template.description || null,
      tradeGroup: template.subcategory || null,
      typicalRole: template.typical_role || null,
      estimatedMinutes: Number.isFinite(template.estimated_duration_min)
        ? template.estimated_duration_min
        : null,
      appliesTo: Array.isArray(template.applies_to) ? template.applies_to : [],
      prerequisites: Array.isArray(template.prerequisites)
        ? template.prerequisites
        : [],
      signoff: Array.isArray(template.signoff) ? template.signoff : [],
      // The standards this list actually cites, deduped. Rendered as a line
      // under the name so somebody choosing between two similar checklists can
      // see which regime each is written to.
      standards: [
        ...new Set(
          flat
            .map((i) => i.reference)
            .filter(Boolean)
            .map((ref) => ref.split(/[ /]/)[0]),
        ),
      ].slice(0, 8),
      source: "FieldQuo Construction Checklist Library",
    };

    // Namespaced `construction-library:` rather than `construction:`, because
    // seed-checklists.js already owns `construction:pre|during|post` — the
    // residential New Construction trade lists. The exact keys never collided,
    // but the shared prefix does: any query filtering by `startsWith` would
    // silently rake in three unrelated rows, which is exactly what happened
    // the first time this seed was verified.
    const systemKey = `construction-library:${template.id}`;
    // `category: { connect }` rather than the `categoryId` scalar: Prisma 7
    // does not accept the foreign key directly when the relation field is
    // declared, and a silently-null category would hide the checklist from the
    // picker while the seed still reported success.
    const data = {
      name: template.name,
      items: flat,
      phase,
      category: { connect: { id: categoryId } },
      meta,
    };

    // companyId is left unset, which is what makes this a SYSTEM row every
    // tenant can see. It cannot collide with a company's own template: those
    // leave `systemKey` null, and this unique key is only ever written here.
    await db.jobChecklistTemplate.upsert({
      where: { systemKey },
      create: { ...data, systemKey },
      update: data,
    });

    written += 1;
    items += flat.length;
  }

  console.log(
    `Seeded ${written} construction checklists (${items} items) across ` +
      `${new Set(Object.values(MAP).map(([k]) => k)).size} trades.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
