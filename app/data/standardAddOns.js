// app/data/standardAddOns.js
//
// Standard, editable add-on line items per service-category key. These are
// seeded as Products (linked to the category) so they appear in the quote
// builder's "Add from Products & Services" picker for that quote type. They
// are only STARTING POINTS — every company adds, removes, and reprices them
// to fit its own scope of work from Settings > Products & Services.
//
// Prices/units below are seeded defaults sourced from the TrueFinish add-on
// catalog (handle drilling $12/door, soft-close hinges $35/door, two-tone
// $600 flat, etc.); other lines use reasonable round starting numbers a
// company will tune. `unit` is free text that shows on the quote line;
// `type` is "service" (labour) or "product" (goods).
//
// ── `spans`: how many of the job's units the add-on actually covers ────────
//
// A unit price alone does not say how many units a job buys, and the two
// answers are nothing like each other. Soft-close hinges go on every door in
// the kitchen; glass inserts go in the two or three feature doors beside the
// hood, never all of them. Both are "per door, $35 / $85", and
// lib/quotes/offeredAddOns.js multiplied both by the door count off the
// intake — so a twenty-nine-door kitchen was offered "Glass Inserts (29 ×
// door) = $2,465", a figure the contractor would never have written and the
// homeowner could tick.
//
// The difference is known HERE and nowhere else, so it is stated here:
//
//   spans: "every"               one per unit the job has — hinges, slides,
//                                new door fronts. Priced across the intake
//                                count, exactly as before.
//   spans: "some", typicalUnits  a feature upgrade on a few units. Offered at
//                                `typicalUnits` (capped by what the job
//                                actually has), with the count in the row's
//                                description so the document says what is
//                                being offered, and the estimator retypes it
//                                in the add-ons panel like any other row.
//
// `typicalUnits` is a seeded default of the same kind as `unitPrice` — a
// starting number the company tunes — and it errs low on purpose: an
// estimator raising two doors to four is a correction, a homeowner charged
// for twenty-nine is a refund. Required on every entry whose unit is one the
// quote can count (door, drawer — COUNT_BY_UNIT); an entry priced per linear
// foot or per hole needs none, because no count exists to multiply and such
// an add-on is not offered at all.
// scripts/check-offered-add-ons.mjs fails the build on a countable-unit entry
// that declares nothing, so the next per-door add-on cannot be added without
// someone deciding which of the two it is.

export const STANDARD_ADDONS = {
  // ── Cabinet refinishing (recoat existing doors/boxes) ──
  cabinet_refinishing: [
    {
      name: "New Handles — supply & install",
      unit: "each",
      unitPrice: 12,
      type: "service",
      description: "Drill and install new handles/pulls, per hole.",
    },
    {
      name: "Soft-Close Hinges",
      unit: "door",
      unitPrice: 35,
      type: "service",
      spans: "every",
      description: "Install soft-close hinges, per door.",
    },
    {
      name: "Soft-Close Drawer Slides",
      unit: "drawer",
      unitPrice: 45,
      type: "service",
      spans: "every",
      description: "Install soft-close full-extension drawer slides, per drawer.",
    },
    {
      name: "Two-Tone Finish",
      unit: "flat",
      unitPrice: 600,
      type: "service",
      description:
        "Second colour — additional masking, staging and spray cycles.",
    },
    {
      name: "Glass Inserts",
      unit: "door",
      unitPrice: 85,
      type: "service",
      // Feature doors either side of a hood or a glass-front display run.
      // Nobody glazes a whole kitchen, and the owner's report was this row
      // counting every door and drawer as a window.
      spans: "some",
      typicalUnits: 2,
      description:
        "Prep doors for glass inserts, per door (glass supplied separately).",
    },
  ],

  // ── Cabinet refacing (new doors/fronts + resurface visible boxes) ──
  cabinet_refacing: [
    {
      // Refacing replaces every front; a kitchen with some new doors and some
      // old ones is not a reface.
      name: "New Painted MDF Doors",
      unit: "door",
      unitPrice: 95,
      type: "product",
      spans: "every",
      description: "New paint-grade MDF doors, per door.",
    },
    {
      name: "Thermofoil / Vinyl-Wrapped Doors",
      unit: "door",
      unitPrice: 85,
      type: "product",
      spans: "every",
      description: "New thermofoil / vinyl-wrapped MDF doors, per door.",
    },
    {
      name: "Cabinet Box Skinning — veneer/laminate",
      unit: "linear ft",
      unitPrice: 25,
      type: "service",
      description: "Resurface visible cabinet-box faces with veneer/laminate.",
    },
    {
      name: "Soft-Close Hinges",
      unit: "door",
      unitPrice: 35,
      type: "service",
      spans: "every",
      description: "Install soft-close hinges, per door.",
    },
    {
      name: "Soft-Close Drawer Slides",
      unit: "drawer",
      unitPrice: 45,
      type: "service",
      spans: "every",
      description: "Install soft-close full-extension drawer slides, per drawer.",
    },
    {
      name: "New Handles — supply & install",
      unit: "each",
      unitPrice: 12,
      type: "service",
      description: "Drill and install new handles/pulls, per hole.",
    },
    {
      name: "Crown Moulding",
      unit: "linear ft",
      unitPrice: 18,
      type: "service",
      description: "Supply and install crown moulding, per linear foot.",
    },
    {
      name: "Glass Inserts",
      unit: "door",
      unitPrice: 85,
      type: "service",
      spans: "some",
      typicalUnits: 2,
      description: "Prep doors for glass inserts, per door.",
    },
    {
      name: "Under-Cabinet LED Lighting",
      unit: "linear ft",
      unitPrice: 22,
      type: "product",
      description: "Under-cabinet LED lighting, per linear foot.",
    },
    {
      name: "Pull-Out Shelf",
      unit: "each",
      unitPrice: 120,
      type: "product",
      description: "Supply and install a pull-out / roll-out shelf.",
    },
  ],

  // ── Countertop ──
  // ── Countertop ──
  // The full line-up a countertop quote is actually built from, in the order
  // it reads on the document. Removal and disposal are SEPARATE lines: they
  // are separate decisions (a client can rip out their own tops) and separate
  // costs, and combining them hid the disposal fee inside a labour number.
  countertop: [
    {
      name: "Countertop Supply & Installation",
      unit: "flat",
      unitPrice: 0,
      type: "product",
      description:
        "Supply and install the countertop. Installation is bundled into the slab price by the fabricator, so it is not a separate line.",
    },
    {
      name: "Backsplash",
      unit: "flat",
      unitPrice: 0,
      type: "product",
      description: "Matching backsplash — height chosen on the quote.",
    },
    {
      name: "Sink / Undermount Cutout",
      unit: "each",
      unitPrice: 150,
      type: "service",
      description: "Cut and polish sink / undermount opening.",
    },
    {
      name: "Waterfall Edge",
      unit: "each",
      unitPrice: 450,
      type: "service",
      description: "Fabricate and install a waterfall edge.",
    },
    {
      name: "Countertop Removal",
      unit: "flat",
      unitPrice: 250,
      type: "service",
      description: "Remove the existing countertops.",
    },
    {
      name: "Disposal Fee",
      unit: "flat",
      unitPrice: 900,
      type: "service",
      description: "Haul away and dispose of the old countertops.",
    },
    {
      name: "Travel Fee",
      unit: "flat",
      unitPrice: 0,
      type: "service",
      description: "Travel outside the standard service area.",
    },
  ],

  // ── Stairs ──
  // Priced per element, because that is how a staircase is quoted: you count
  // treads, risers, balusters and posts and measure the handrail. Prices here
  // are the STANDARD-complexity rates; the quote's complexity selector moves
  // the whole grid, and any line can still be overridden on the quote.
  stairs: [
    {
      name: "Stair Treads — refinishing",
      unit: "tread",
      unitPrice: 150,
      type: "service",
      description: "Sand, stain and finish each tread.",
    },
    {
      name: "Risers — painting",
      unit: "riser",
      unitPrice: 25,
      type: "service",
      description: "Prep and paint each riser.",
    },
    {
      name: "Balusters / Spindles — painting",
      unit: "each",
      unitPrice: 25,
      type: "service",
      description: "Prep and paint each baluster or spindle.",
    },
    {
      name: "Newel Posts — painting",
      unit: "each",
      unitPrice: 150,
      type: "service",
      description: "Prep and paint each newel post.",
    },
    {
      name: "Handrail — refinishing",
      unit: "lf",
      unitPrice: 15,
      type: "service",
      description: "Sand, stain and finish the handrail, per linear foot.",
    },
    {
      name: "Landing / Hallway — refinishing",
      unit: "sqft",
      unitPrice: 5,
      type: "service",
      description: "Refinish landing or adjoining hallway floor, per square foot.",
    },
    {
      name: "Two-Tone Finish",
      unit: "flat",
      unitPrice: 800,
      type: "service",
      description:
        "Second colour on the staircase — extra masking, staging and spray cycles.",
    },
  ],
};

export function getStandardAddOns(categoryKey) {
  return STANDARD_ADDONS[categoryKey] || [];
}

export function hasStandardAddOns(categoryKey) {
  return (STANDARD_ADDONS[categoryKey] || []).length > 0;
}

/**
 * What a seeded add-on's unit price covers, found by NAME, or null when the
 * name is not one of ours.
 *
 * Found by name for the reason standardAddOnDescription() and
 * standardAddOnTranslations() are: the English name is how a seeded Product
 * row is identified again (lib/products/seedStandardAddOns.js writes it, and
 * the translations live in Product.translations rather than replacing it).
 *
 * ── Why this is not a Product column ───────────────────────────────────────
 *
 * A column would have to be written by the seeder and backfilled onto every
 * live row, and nothing in Settings > Products & Services could ever set it,
 * so for a product the company wrote itself it would read null forever —
 * exactly what this returns. It would buy one thing: surviving a rename. It
 * would cost a second home for a fact this file owns, and the second copy is
 * the one that rots (AGENTS.md). A renamed row falls to the same answer as a
 * company-written one, which is the right answer: we no longer know what it
 * covers.
 *
 * null is the SAFE answer, not a shrug. The caller does not offer a per-unit
 * add-on it cannot count — the same path a product priced per hole or per
 * square foot has always taken — because multiplying a company's own
 * per-door row by every door in the kitchen is a guess about scope printed on
 * a document the homeowner signs. The estimator adds it by hand, priced by
 * hand, which is what "Add another" is for.
 *
 * @returns {{ spans: "every" } | { spans: "some", typicalUnits: number } | null}
 */
export function standardAddOnUnitScope(name) {
  const wanted = String(name || "").trim().toLowerCase();
  if (!wanted) return null;
  for (const list of Object.values(STANDARD_ADDONS)) {
    for (const a of list) {
      if (String(a.name || "").trim().toLowerCase() !== wanted) continue;
      if (a.spans === "every") return { spans: "every" };
      const units = Math.floor(Number(a.typicalUnits));
      if (a.spans === "some" && units > 0) return { spans: "some", typicalUnits: units };
      return null;
    }
  }
  return null;
}
