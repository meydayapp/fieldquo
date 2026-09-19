// app/data/industries.js
// Single source of truth for the industries list — the header dropdown, the
// homepage industries grid, and each /industries/[slug] page all read from here,
// so adding an industry later means editing one file, not four.
//
// `tradeKey` is the lib/sales/discovery/trades.js key whose selling points
// (lib/sales/tradeSellingPoints.js) the page's "built for" section lists —
// the same three the sales call and the intro email lead with, so a visitor
// who was called reads the page and recognises the pitch. Two slugs share a
// key on purpose: Landscaping and Lawn Care are one discovery trade.
// scripts/check-trade-selling-points.mjs asserts every key resolves.

export const INDUSTRIES = [
  { slug: "cleaning", tradeKey: "house_cleaning", label: "Cleaning" },
  { slug: "construction-contracting", tradeKey: "general_contracting", label: "Construction & Contracting" },
  { slug: "electrical", tradeKey: "electrical", label: "Electrical" },
  { slug: "hvac", tradeKey: "hvac", label: "HVAC" },
  { slug: "handyman", tradeKey: "handyman", label: "Handyman" },
  { slug: "landscaping", tradeKey: "landscaping", label: "Landscaping" },
  { slug: "lawn-care", tradeKey: "landscaping", label: "Lawn Care" },
  { slug: "painting", tradeKey: "painting", label: "Painting" },
  { slug: "plumbing", tradeKey: "plumbing", label: "Plumbing" },
  { slug: "pressure-washing", tradeKey: "pressure_washing", label: "Pressure Washing" },
  { slug: "roofing", tradeKey: "roofing", label: "Roofing" },
  { slug: "tree-care", tradeKey: "tree_care", label: "Tree Care" },
];
