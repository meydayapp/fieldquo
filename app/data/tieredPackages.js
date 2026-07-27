// app/data/tieredPackages.js
//
// The third pricing pattern from the research — NOT a formula (sqft × rate),
// NOT diagnostic-fee-plus-hourly. A fixed menu of price points the client picks
// from directly. This needs its own UI component (a package-tier selector),
// not the line-item quantity table every other category uses.
//
// Confirmed real for exactly three researched categories: junk removal (load
// fraction), auto detailing (Bronze/Silver/Gold/Platinum), chimney sweep
// (NFPA inspection levels 1/2/3).

export const TIERED_PACKAGES = {
  junk_removal: {
    label: "Load Size",
    tiers: [
      { key: "minimum", label: "Minimum (1/8 load)", priceHint: "$100–175" },
      { key: "quarter", label: "Quarter Load", priceHint: "$150–300" },
      { key: "half", label: "Half Load", priceHint: "$250–550" },
      { key: "full", label: "Full Truckload", priceHint: "$550–1,000" },
    ],
    // Single large items bypass the load-fraction tiers entirely — flat per-item
    singleItems: [
      { key: "couch", label: "Couch" },
      { key: "mattress", label: "Mattress" },
      { key: "refrigerator", label: "Refrigerator" },
      { key: "hot_tub", label: "Hot Tub" },
    ],
  },

  auto_detailing: {
    label: "Package",
    tiers: [
      { key: "bronze", label: "Bronze — Wash, Vacuum, Basic Interior" },
      {
        key: "silver",
        label: "Silver — Bronze + Leather Conditioning, Protectant",
      },
      { key: "gold", label: "Gold — Silver + Full Paint Decontamination" },
      {
        key: "platinum",
        label: "Platinum — Gold + Paint Correction + Ceramic Coating",
      },
    ],
    // Package price additionally scales by vehicle size — a second axis, not a separate tier
    vehicleSizeMultiplier: [
      { key: "small", label: "Small (sedan/coupe)" },
      { key: "midsize", label: "Mid-Size" },
      { key: "large", label: "Large (SUV/truck/van)" },
    ],
    addOns: [
      {
        key: "ceramic_coating",
        label: "Ceramic Coating (separate from package)",
      },
      {
        key: "paint_correction",
        label: "Paint Correction (separate from package)",
      },
    ],
  },

  chimney_sweep: {
    label: "Inspection Level",
    tiers: [
      { key: "level_1", label: "Level 1 — Annual Visual Inspection" },
      {
        key: "level_2",
        label: "Level 2 — Camera Scan (required for home sale / post-fire)",
      },
      { key: "level_3", label: "Level 3 — Structural Investigation" },
    ],
    elevator_services: {
      label: "Contract Level",
      tiers: [
        {
          key: "pog",
          label: "POG — Parts, Oil & Grease (inspection + lubrication only)",
        },
        {
          key: "partial",
          label: "Partial Service (excludes major components)",
        },
        {
          key: "full",
          label: "Full Service (complete coverage, most predictable)",
        },
      ],
    },
  },
};

export function isTieredPackageCategory(categoryKey) {
  return categoryKey in TIERED_PACKAGES;
}

export function getTieredPackage(categoryKey) {
  return TIERED_PACKAGES[categoryKey] || null;
}
