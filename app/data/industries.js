// app/data/industries.js
// Single source of truth for the industries list — the header dropdown, the
// homepage industries grid, and each /industries/[slug] page all read from here,
// so adding an industry later means editing one file, not four.

export const INDUSTRIES = [
  { slug: "cleaning", label: "Cleaning" },
  { slug: "construction-contracting", label: "Construction & Contracting" },
  { slug: "electrical", label: "Electrical" },
  { slug: "hvac", label: "HVAC" },
  { slug: "handyman", label: "Handyman" },
  { slug: "landscaping", label: "Landscaping" },
  { slug: "lawn-care", label: "Lawn Care" },
  { slug: "painting", label: "Painting" },
  { slug: "plumbing", label: "Plumbing" },
  { slug: "pressure-washing", label: "Pressure Washing" },
  { slug: "roofing", label: "Roofing" },
  { slug: "tree-care", label: "Tree Care" },
];
