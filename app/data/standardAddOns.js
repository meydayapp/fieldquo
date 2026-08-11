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
      description: "Install soft-close hinges, per door.",
    },
    {
      name: "Soft-Close Drawer Slides",
      unit: "drawer",
      unitPrice: 45,
      type: "service",
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
      description:
        "Prep doors for glass inserts, per door (glass supplied separately).",
    },
  ],

  // ── Cabinet refacing (new doors/fronts + resurface visible boxes) ──
  cabinet_refacing: [
    {
      name: "New Painted MDF Doors",
      unit: "door",
      unitPrice: 95,
      type: "product",
      description: "New paint-grade MDF doors, per door.",
    },
    {
      name: "Thermofoil / Vinyl-Wrapped Doors",
      unit: "door",
      unitPrice: 85,
      type: "product",
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
      description: "Install soft-close hinges, per door.",
    },
    {
      name: "Soft-Close Drawer Slides",
      unit: "drawer",
      unitPrice: 45,
      type: "service",
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
