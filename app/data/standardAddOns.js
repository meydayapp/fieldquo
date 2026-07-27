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
  countertop: [
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
      name: "Countertop Removal & Disposal",
      unit: "flat",
      unitPrice: 250,
      type: "service",
      description: "Remove and dispose of existing countertops.",
    },
  ],
};

export function getStandardAddOns(categoryKey) {
  return STANDARD_ADDONS[categoryKey] || [];
}

export function hasStandardAddOns(categoryKey) {
  return (STANDARD_ADDONS[categoryKey] || []).length > 0;
}
