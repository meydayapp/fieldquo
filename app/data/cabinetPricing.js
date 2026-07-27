// app/data/cabinetPricing.js
//
// Client-facing UNIT PRICING for door/drawer trades (cabinet refinishing &
// refacing) — the price the client is charged, set on the quote. This is
// distinct from the internal Cost & Margin estimate (materialRecipes.js): this
// is revenue, that is cost. Modeled on the TrueFinish quote builder: a base
// price per unit (door + drawer counted as units) plus a complexity upcharge,
// with the reasons shown on the quote/PDF.

export const UNIT_PRICED_CATEGORIES = ["cabinet_refinishing", "cabinet_refacing"];

export function isUnitPriced(categoryKey) {
  return UNIT_PRICED_CATEGORIES.includes(categoryKey);
}

export const COMPLEXITY_LEVELS = [
  {
    value: "standard",
    label: "Standard",
    upcharge: 0,
    desc: "Straightforward project — no significant complexity factors.",
  },
  {
    value: "moderate",
    label: "Moderate",
    upcharge: 20,
    desc: "1–2 complexity factors — some extra prep or access work.",
  },
  {
    value: "high",
    label: "High",
    upcharge: 40,
    desc: "3+ factors or significant damage — substantially more labour.",
  },
  {
    value: "custom",
    label: "Custom",
    upcharge: null,
    desc: "Enter a custom upcharge per unit.",
  },
];

// Shown as checkboxes; the selected ones appear on the quote & PDF to justify
// the complexity upcharge to the client.
export const COMPLEXITY_REASONS = {
  "Surface Condition": [
    { id: "peeling_paint", label: "Existing paint peeling or flaking extensively" },
    { id: "deep_damage", label: "Deep scratches, gouges, or dents needing filler" },
    { id: "water_damage", label: "Water damage, swelling, or warped surfaces" },
    { id: "heavy_grease", label: "Heavy grease buildup — multiple degreasing passes" },
    { id: "bleed_through", label: "Stain bleed-through risk (oak tannins, pine knots)" },
  ],
  "Space & Access": [
    { id: "poor_ventilation", label: "Poor ventilation — longer dry times" },
    { id: "limited_staging", label: "Limited staging area for drying" },
    { id: "tight_access", label: "Tight or difficult cabinet access" },
    { id: "occupied_home", label: "Occupied home — daily kitchen restoration" },
    { id: "high_cabinets", label: "High uppers requiring ladder work throughout" },
  ],
  "Structural & Layout": [
    { id: "seized_hinges", label: "Seized/stripped hinges needing extraction" },
    { id: "out_of_square", label: "Boxes not square — door alignment work" },
    { id: "mixed_profiles", label: "Multiple door profiles — separate spray setups" },
    { id: "glass_inserts", label: "Glass-insert doors — extra masking per piece" },
  ],
};

export function levelUpcharge(level) {
  const l = COMPLEXITY_LEVELS.find((x) => x.value === level);
  return l && l.upcharge != null ? l.upcharge : 0;
}

// Final per-unit price = base + upcharge (custom uses the typed amount).
export function finalUnitPrice(group) {
  const base = Number(group.baseUnitPrice) || 0;
  if (group.complexityLevel === "custom") {
    return base + (Number(group.complexityUpcharge) || 0);
  }
  return base + levelUpcharge(group.complexityLevel);
}

export function groupUnits(group) {
  const iv = group.intakeValues || {};
  return (Number(iv.doorCount) || 0) + (Number(iv.drawerCount) || 0);
}

// Revenue from the base scope (units × final unit price). Add-on line items
// are summed separately by the caller.
export function unitPricingSubtotal(group) {
  return groupUnits(group) * finalUnitPrice(group);
}
