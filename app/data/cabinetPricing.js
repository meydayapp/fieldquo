// app/data/cabinetPricing.js
//
// Client-facing UNIT PRICING for door/drawer trades (cabinet refinishing &
// refacing) — the price the client is charged, set on the quote. This is
// distinct from the internal Cost & Margin estimate (materialRecipes.js): this
// is revenue, that is cost. Modeled on the TrueFinish quote builder: a base
// price per unit (door + drawer counted as units) plus a complexity upcharge,
// with the reasons shown on the quote/PDF.

import { resolveComplexity } from "@/lib/pricing/complexity";

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

/**
 * Final per-unit price = base + upcharge (custom uses the typed amount).
 *
 * ── The new factor module, and why an old quote cannot move ────────────────
 *
 * A group carrying `complexity: { model: "factors_v1", … }` prices from the
 * FACTORS instead of the chip. Everything else — which is every quote written
 * before today, and every group the estimator has not converted — falls
 * through to the original two lines below, byte for byte. The discriminator is
 * checked first and nothing else in this function changed, which is what
 * scripts/check-complexity.mjs asserts against the real stored shapes,
 * including the Custom upcharge.
 *
 * The new model maps its level onto the SAME per-unit grid the company already
 * edits on the rate card — `complexityUpchargePerUnit`, Moderate and High —
 * rather than introducing a second cabinet surcharge. Standard adds nothing;
 * Complex takes the High figure; Specialty never gets here, because
 * lib/pricing/complexity refuses to price it at all and the group becomes an
 * unpriced "on-site assessment required" line instead.
 *
 * @param {object} group
 * @param {object} [book]  the merged price book, when the caller has one. Only
 *   the new model reads it; without it the same defaults as the chips apply,
 *   so a caller that has never had a book keeps working unchanged.
 */
export function finalUnitPrice(group, book = null) {
  const base = Number(group.baseUnitPrice) || 0;

  const factorLevel = factorComplexityLevel(group, book);
  if (factorLevel) {
    return base + factorLevelUpcharge(factorLevel, book);
  }

  if (group.complexityLevel === "custom") {
    return base + (Number(group.complexityUpcharge) || 0);
  }
  return base + levelUpcharge(group.complexityLevel);
}

/**
 * The factor module's level for a cabinet group, or null when the group is not
 * on it.
 *
 * DERIVED on every read, never stored. A level written down beside the factors
 * that produced it is two statements about the same job, and the copy that
 * rots is always the one nobody looks at — here it would be the one the
 * company's own multiplier settings had since moved underneath.
 *
 * Specialty returns null too, and that is not a gap: a Specialty group never
 * reaches a unit price at all, because lib/pricing/tradeScope.js turns it into
 * an unpriced "on-site assessment required" line before any arithmetic runs.
 *
 * TWO places to look, on purpose. A cabinet group has no `takeoff` column, so
 * its answers are persisted inside `intakeValues` (lib/quotes/builderPayload
 * .js's withCabinetAnswers, which is where the door count and the hinge type
 * already live). While the builder is open the object sits on the group; once
 * it has been round-tripped through the database it comes back one level down.
 * Reading only the first would price a reopened quote off a level nobody
 * chose, which is precisely the "reopening a quote shows every upgrade
 * unticked" bug that put the cabinet answers in intakeValues to begin with.
 */
function factorComplexityLevel(group, book) {
  const resolved = resolveComplexity({
    trade: group?.categoryKey || "cabinet_refinishing",
    complexity: group?.complexity || group?.intakeValues?.complexity,
    book,
  });
  if (!resolved || !resolved.priced) return null;
  return resolved.level;
}

/** Moderate and Complex map onto the book's own two figures. */
function factorLevelUpcharge(level, book) {
  if (level === "standard") return 0;
  const grid = book && typeof book === "object" ? book.complexityUpchargePerUnit : null;
  const key = level === "complex" ? "high" : "moderate";
  const fromBook = grid && Number(grid[key]);
  if (Number.isFinite(fromBook)) return fromBook;
  // No book in hand — the same two numbers the chips used, so the two paths
  // never disagree on a company that has not customised anything.
  return levelUpcharge(key === "high" ? "high" : "moderate");
}

export function groupUnits(group) {
  const iv = group.intakeValues || {};
  return (Number(iv.doorCount) || 0) + (Number(iv.drawerCount) || 0);
}

// Revenue from the base scope (units × final unit price). Add-on line items
// are summed separately by the caller.
export function unitPricingSubtotal(group, book = null) {
  return groupUnits(group) * finalUnitPrice(group, book);
}
