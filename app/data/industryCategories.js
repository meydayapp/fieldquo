// app/data/industryCategories.js
//
// The missing link between the marketing INDUSTRIES list (app/data/industries.js
// — what a company calls itself: "Painting", "Plumbing") and the ServiceCategory
// catalog (prisma/seed.js — the actual quote types: cabinet_refinishing,
// interior_painting, etc.).
//
// Picking an industry at signup should surface a *preset* of the quote types
// that trade actually sells, so a painter lands on refinishing / refacing /
// interior / exterior painting already selected — instead of scrolling the
// full ~60-category catalog hunting for them. This is what makes the signup
// copy ("this narrows down which quote types you'll see") actually true.
//
// Keys here are ServiceCategory.key values from seed.js — kept in sync with
// that file. A category can belong to more than one industry on purpose
// (flooring shows up under both Painting-adjacent remodels and Construction),
// so resolving multiple industries unions and de-dupes their category sets.

export const INDUSTRY_CATEGORY_KEYS = {
  painting: [
    "cabinet_refinishing",
    "cabinet_refacing",
    "interior_painting",
    "exterior_painting",
    "countertop",
    "flooring",
    "stairs",
  ],
  cleaning: [
    "gutter_services",
    "residential_cleaning",
    "deep_cleaning",
    "commercial_cleaning",
    "janitorial",
    "carpet_cleaning",
    "window_cleaning",
  ],
  "construction-contracting": [
    // Gutters come off on a re-roof and go back on at the end, so a general
    // contractor quoting a reno needs the trade in their own list rather than
    // behind "show other trades".
    "gutter_services",
    // Insulation belongs to more than the roofing trade. A garden suite or a
    // basement finish is framing, insulation and drywall in sequence — the
    // three the construction process steps describe — so a general contractor
    // who never opens "show other trades" would otherwise have a quotable
    // trade missing from their own list.
    "insulation",
    // Garage doors are sold by more than the handyman trade: a general
    // contractor or carpenter fits them on a reno, and the category carries a
    // real price book now, so surfacing it here is the difference between
    // "quotable" and "type the total in yourself".
    "garage_door",
    // Paving was in no preset at all. A seeded category belonging to no
    // industry is reachable only by knowing to press "show other trades",
    // which means a driveway contractor signs up and finds their trade
    // missing from their own list.
    "paving",
    "driveway_sealing",
    "general_contracting",
    "general_contracting_reno",
    "remodeling",
    "construction",
    "carpentry",
    "drywall",
    "drywall_install",
    "demolition",
    "demolition_contractor",
    "concrete",
    "masonry",
    "excavation",
    "tiling",
    "flooring_install",
    // Home inspection sits here under protest: none of the twelve marketing
    // industries (app/data/industries.js) is "Home Inspection", and an
    // inspector is not a contractor — they are paid precisely because they
    // build nothing on the house they are looking at.
    //
    // It goes here rather than nowhere for two reasons. The service on the
    // source invoice that ISN'T the inspection is a Construction Performance
    // Guideline inspection — the Tarion new-build warranty milestones — which
    // is construction work by definition and is bought by builders and their
    // clients. And a seeded category in no preset is reachable only by
    // pressing "show other trades", which is how `paving` ended up invisible
    // to paving contractors. One imperfect home beats none.
    //
    // The right fix is a `home-inspection` industry slug of its own; that
    // needs app/data/industries.js and the /industries/[slug] marketing page,
    // and is a product decision rather than a data one.
    "home_inspection",
  ],
  electrical: ["electrical"],
  hvac: ["hvac_install", "hvac_repair"],
  handyman: [
    "gutter_services",
    "handyman",
    "installation_services",
    "property_maintenance",
    "appliance_repair",
    "locksmith",
    "garage_door",
  ],
  // Paving appears here as well as under contracting: interlock, patios and
  // walkways are landscaping work as often as they are construction work, and
  // the resolver unions a category that belongs to more than one industry.
  landscaping: [
    "landscaping_design",
    "paving",
    "driveway_sealing",
    "irrigation",
    "pool_spa",
    "pest_control",
  ],
  "lawn-care": ["lawn_care", "lawn_mowing", "snow_removal"],
  plumbing: ["plumbing", "well_water"],
  // Sealing is the job the driveway washers are already on site for.
  "pressure-washing": [
    "pressure_washing_house",
    "pressure_washing_driveway",
    "driveway_sealing",
  ],
  roofing: [
    "roofing_service",
    "siding",
    // Gutters hang off the roof and are sold by the same crews — and by
    // handymen and window cleaners, which is why it appears in three presets.
    "gutter_services",
    "insulation",
    "restoration",
  ],
  "tree-care": ["tree_care_service"],
};

// Union of the category keys for the given industry slugs, de-duplicated and
// order-stable. Unknown slugs contribute nothing rather than throwing, so a
// stale slug never breaks signup.
export function categoryKeysForIndustries(industrySlugs = []) {
  const seen = new Set();
  for (const slug of industrySlugs) {
    for (const key of INDUSTRY_CATEGORY_KEYS[slug] || []) {
      seen.add(key);
    }
  }
  return [...seen];
}
