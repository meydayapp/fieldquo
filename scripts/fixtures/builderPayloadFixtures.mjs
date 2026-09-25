// scripts/fixtures/builderPayloadFixtures.mjs
//
// A spread of scope groups and builder states, as the quote builder holds
// them, for proving a change to lib/quotes/builderPayload.js or
// lib/quotes/builderRequest.js left the bytes that reach the API alone.
//
// scripts/check-custom-factors.mjs hashes every one of these through
// scopeGroupPayload / groupSubtotal / quoteRequestBody and compares the md5
// against the value recorded from origin/main at 853639c9, BEFORE custom
// complexity factors and builder add-on offers existed. A group or a request
// that uses neither must hash exactly as it did then.
//
// Deterministic by construction: every tempId is fixed, nothing reads the
// clock, nothing reads Math.random.

import { newScopeGroup } from "@/lib/quotes/builderPayload";

export const CATEGORIES = {
  cabinets: { id: "cat_cab", key: "cabinet_refinishing", label: "Cabinet Refinishing", unit: "unit", defaultRate: null },
  stairs: { id: "cat_stairs", key: "stairs", label: "Stair Refinishing", unit: "flat", defaultRate: null },
  plumbing: { id: "cat_plumb", key: "plumbing", label: "Plumbing", unit: "hour", defaultRate: 95 },
  custom: { id: "cat_custom", key: "custom_abc", label: "Pressure washing", unit: "flat", defaultRate: 240 },
  interior: { id: "cat_int", key: "interior_painting", label: "Interior Painting", unit: "sqft", defaultRate: null },
};

/** Every fixture group, keyed by a stable name. */
export function fixtureGroups() {
  const cab = newScopeGroup(CATEGORIES.cabinets, "Kitchen cabinets", null, {
    tempId: "t_cab",
    intakeValues: { doorCount: 22, drawerCount: 8 },
    addOns: ["softCloseHinges"],
  });
  cab.complexityLevel = "moderate";
  cab.color = "White Dove";
  cab.lineItems = [{ description: "Disposal fee", quantity: 1, unit: "flat", rate: 120, amount: 120 }];

  const stairs = newScopeGroup(CATEGORIES.stairs, "Main staircase", null, { tempId: "t_stairs" });
  // Real counts and a built-in factor answered off its benign value, so the
  // stair lines carry the built-in complexity a custom factor composes after.
  stairs.takeoff = {
    ...stairs.takeoff,
    sections: [{ ...stairs.takeoff.sections[0], treads: 13, risers: 14, balusters: 26, posts: 2, handrailFt: 14, paintRisers: true }],
    complexity: {
      ...stairs.takeoff.complexity,
      factors: { ...stairs.takeoff.complexity.factors, shape: "l_or_u", access: "tight", sides: "one_open" },
    },
  };

  const plumbing = newScopeGroup(CATEGORIES.plumbing, "Plumbing", null, { tempId: "t_plumb" });
  plumbing.lineItems = [
    { description: "Plumbing", quantity: 3, unit: "hour", rate: 95, amount: 285 },
    { description: "Shut-off valve", quantity: 2, unit: "each", rate: 42.5, amount: 85, unitCost: 18 },
  ];

  const custom = newScopeGroup(CATEGORIES.custom, "Driveway wash", null, { tempId: "t_custom" });

  const persisted = {
    tempId: "g_1",
    id: "g_1",
    persisted: true,
    imported: false,
    categoryId: "cat_int",
    categoryKey: "interior_painting",
    label: "Living room",
    isTiered: false,
    selectedTier: null,
    intakeValues: { rooms: 2 },
    takeoff: { areas: [{ name: "Living room" }] },
    lineItems: [
      { description: "Walls — 2 coats", quantity: 1, unit: "flat", rate: 1840.37, amount: 1840.37 },
      { description: "Ceiling", quantity: 1, unit: "flat", rate: 410, amount: 410, detail: "Flat white" },
    ],
  };

  return { cab, stairs, plumbing, custom, persisted };
}

/** The builder states quoteRequestBody is exercised with. */
export function fixtureRequests(groupsPayload) {
  const shared = {
    subtotal: 4620,
    appliedDiscount: 120,
    tax: 585,
    taxEnabled: true,
    total: 5085,
    notes: "Side door only.",
    reviewNotes: "",
    processNotes: "50% on approval.",
    validUntil: "2026-10-21",
    clientPhotos: [],
    siteAddress: " 214 rue Principale, Laval QC ",
    costing: { crew: [], addedLabourHours: 0, addedMaterialCost: 0, labourRate: 35, overheadPct: 12 },
    groupsPayload,
  };
  return {
    create: { ...shared, isEdit: false, clientId: "c_1", composeSeconds: 300, language: "fr", assignedToId: "", canEditScope: true },
    edit: { ...shared, isEdit: true, canEditScope: true, assignedToTouched: false, assignedToId: "", version: "2026-09-21T10:00:00.000Z" },
    decided: { ...shared, isEdit: true, canEditScope: false, assignedToTouched: false, assignedToId: "", version: null },
  };
}
