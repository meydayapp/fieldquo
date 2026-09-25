// scripts/productionRateFixtures.mjs
//
// The fixture quote scripts/check-production-rates.mjs runs every figure
// through. Its own file so the md5s the check pins were taken from the SAME
// fixtures before lib/services/productionRates.js existed (commit ef759bb1,
// origin/main at the time) and after — a fixture edited in one place only is
// a baseline that silently stops meaning anything.
//
// Five groups, one per way a group gets hours today:
//   g-paint    interior painting on the area model — per-substrate hours
//   g-siding   siding takeoff — the book's labourHoursPerSqft (0.032)
//   g-cab      cabinet refinishing — the recipe path, off the intake
//   g-fence    fencing — no book hours at all; a template run keyed edgingFt
//   g-plumb    plumbing — typed lines and a template run whose product has no
//              production rate (nor ever will in these fixtures)

import { newPaintArea, newPaintSubstrate, PAINT_TAKEOFF_DEFAULTS } from "@/lib/pricing/paintTakeoff";
import { buildTradeLineItems, createTradeConfig } from "@/lib/pricing/tradeScope";

const B = PAINT_TAKEOFF_DEFAULTS;
const sub = (key, patch = {}) => ({ ...newPaintSubstrate(key, B), ...patch });

export function fixtureGroups() {
  const paintTakeoff = {
    model: "area_substrate",
    areas: [
      { ...newPaintArea("den", B), label: "Living room", lengthFt: 14, widthFt: 16, heightFt: 9, prepHours: 2, substrates: [sub("ceiling"), sub("walls"), sub("baseboard"), sub("door", { quantity: 2 })] },
      { ...newPaintArea("den", B), label: "Hallway", lengthFt: 4, widthFt: 12, heightFt: 9, substrates: [sub("walls"), sub("ceiling")] },
    ],
  };
  const paintLines = buildTradeLineItems("interior_painting", paintTakeoff, null);
  const sidingTakeoff = { ...createTradeConfig("siding"), sqft: 1000 };
  const tpl = (runId, productId, service, lineKind, extra = {}) => ({ template: { runId, productId, service, lineKind, ...extra } });
  return [
    {
      tempId: "g-paint",
      id: "g-paint",
      sortOrder: 0,
      categoryId: "cat-paint",
      categoryKey: "interior_painting",
      category: { key: "interior_painting" },
      label: "Interior painting",
      takeoff: paintTakeoff,
      intakeValues: {},
      lineItems: [...paintLines, { description: "Haul away and site clean", quantity: 1, rate: 120, amount: 120 }],
    },
    {
      tempId: "g-siding",
      id: "g-siding",
      sortOrder: 1,
      categoryId: "cat-siding",
      categoryKey: "siding",
      category: { key: "siding" },
      label: "Siding",
      takeoff: sidingTakeoff,
      intakeValues: {},
      lineItems: [
        { description: "Vinyl siding — supply and install", quantity: 1000, unit: "sqft", rate: 9, amount: 9000 },
        { description: "Siding install", detail: "", quantity: 0, unit: "flat", rate: 0, amount: 0, meta: tpl("run-siding", "prod-siding", "Vinyl siding", "other", { heading: true }) },
        { description: "Hang vinyl siding", quantity: 1000, unit: "sqft", rate: 4.5, amount: 4500, meta: tpl("run-siding", "prod-siding", "Vinyl siding", "labour", { measurementKey: "wallSqft", filled: { value: 1000, calc: "siding", groupTempId: "g-siding", groupLabel: "Siding" } }) },
      ],
    },
    {
      tempId: "g-cab",
      id: "g-cab",
      sortOrder: 2,
      categoryId: "cat-cab",
      categoryKey: "cabinet_refinishing",
      category: { key: "cabinet_refinishing" },
      label: "Kitchen cabinets",
      takeoff: null,
      intakeValues: { doorCount: 24, drawerCount: 8 },
      lineItems: [
        { description: "Refinish cabinet doors", quantity: 24, unit: "each", rate: 140, amount: 3360 },
        { description: "Refinish drawer fronts", quantity: 8, unit: "each", rate: 90, amount: 720 },
      ],
    },
    {
      tempId: "g-fence",
      id: "g-fence",
      sortOrder: 3,
      categoryId: "cat-fence",
      categoryKey: "fence_services",
      category: { key: "fence_services" },
      label: "Back-yard fence",
      takeoff: null,
      intakeValues: { linearFeet: 120 },
      lineItems: [
        { description: "Cedar privacy fence", detail: "", quantity: 0, unit: "flat", rate: 0, amount: 0, meta: tpl("run-fence", "prod-fence", "Cedar privacy fence", "other", { heading: true }) },
        { description: "Build fence", quantity: 120, unit: "linear_ft", rate: 38, amount: 4560, unitCost: 0, meta: tpl("run-fence", "prod-fence", "Cedar privacy fence", "labour", { measurementKey: "edgingFt", filled: { value: 120, calc: "fence", groupTempId: "g-fence", groupLabel: "Back-yard fence" } }) },
        { description: "Fence posts", quantity: 16, unit: "each", rate: 45, amount: 720, unitCost: 22, meta: tpl("run-fence", "prod-fence", "Cedar privacy fence", "material", { measurementKey: "fencePosts" }) },
      ],
    },
    {
      tempId: "g-plumb",
      id: "g-plumb",
      sortOrder: 4,
      categoryId: "cat-plumb",
      categoryKey: "plumbing",
      category: { key: "plumbing" },
      label: "Plumbing",
      takeoff: null,
      intakeValues: {},
      lineItems: [
        { description: "Replace kitchen faucet", quantity: 1, unit: "flat", rate: 280, amount: 280 },
        { description: "Water heater swap", detail: "", quantity: 0, unit: "flat", rate: 0, amount: 0, meta: tpl("run-wh", "prod-wh", "Water heater swap", "other", { heading: true }) },
        { description: "Remove and install tank", quantity: 1, unit: "flat", rate: 650, amount: 650, meta: tpl("run-wh", "prod-wh", "Water heater swap", "labour") },
      ],
    },
  ];
}

/** The same groups as quoteCostSummary receives them from resolveCostingGroups. */
export function costingGroups(groups = fixtureGroups()) {
  return groups.map((g) => ({
    tempId: g.id,
    categoryKey: g.categoryKey,
    label: g.label,
    takeoff: g.takeoff ?? null,
    intakeValues: g.intakeValues ?? null,
    rateOverrides: null,
  }));
}

export function fixtureQuote(groups = fixtureGroups()) {
  return {
    id: "q-fixture",
    scopeGroups: groups.map(({ tempId, categoryKey, ...g }) => g),
    addOns: [{ id: "a1", description: "Accent wall", selected: true, sortOrder: 0 }],
  };
}
