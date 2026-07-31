// lib/demo/industries.js
//
// What a demo account looks like when it's dressed as a particular trade.
//
// ══ Why presets rather than one generic demo ═══════════════════════════════
//
// A sales agent showing FieldQuo to a landscaper should not be walking through
// a kitchen refinishing quote. The prospect spends the call translating every
// screen into their own trade instead of listening, and the one question that
// actually matters — "does this handle MY work?" — goes unanswered.
//
// So the industry is switchable, and switching it changes the services, the
// pricing, the client names and the job titles. Not just a label.
//
// ══ Pure data ═════════════════════════════════════════════════════════════
//
// No database, no imports. The seeder reads this; nothing here reads anything.
// That means the whole preset table can be executed against the real category
// keys in a check script, which is the only way to catch a preset pointing at a
// trade that doesn't exist — a demo that silently comes up with no services.

/**
 * Category keys must exist in ServiceCategory (see prisma/seed.js).
 * `check:demo` asserts every one of these resolves; a typo here is a demo
 * account with an empty services list handed to a sales agent mid-call.
 */
export const INDUSTRIES = {
  painting: {
    label: "Painting",
    company: "Northside Painting Co.",
    tagline: "Interior and exterior painting, done properly",
    brandColor: "#1E5F8C",
    categories: ["interior_painting", "exterior_painting", "drywall"],
    services: [
      { name: "Interior painting — walls & ceilings", unit: "sqft", rate: 3.25 },
      { name: "Interior painting — trim & doors", unit: "linear ft", rate: 8.5 },
      { name: "Exterior painting — siding", unit: "sqft", rate: 4.75 },
      { name: "Drywall repair", unit: "hour", rate: 85 },
    ],
    jobs: ["Repaint main floor", "Exterior — front and side elevations", "Nursery + hallway"],
  },

  cabinets: {
    label: "Cabinet refinishing",
    company: "TrueFinish Cabinets",
    tagline: "Your kitchen, refinished — not replaced",
    brandColor: "#8C5A2B",
    categories: ["cabinet_refinishing", "cabinet_refacing", "countertop"],
    services: [
      { name: "Cabinet refinishing — doors", unit: "door", rate: 95 },
      { name: "Cabinet refinishing — drawer fronts", unit: "drawer", rate: 55 },
      { name: "Cabinet refacing", unit: "linear ft", rate: 210 },
      { name: "Quartz countertop supply & install", unit: "sqft", rate: 78 },
    ],
    jobs: ["Kitchen refinish — 24 doors", "Island refacing", "Countertop replacement"],
  },

  flooring: {
    label: "Flooring",
    company: "Cedar & Co. Flooring",
    tagline: "Hardwood, vinyl and tile, installed to last",
    brandColor: "#6B4423",
    categories: ["flooring", "flooring_install", "tiling", "stairs"],
    services: [
      { name: "Engineered hardwood — supply & install", unit: "sqft", rate: 11.5 },
      { name: "Luxury vinyl plank — install only", unit: "sqft", rate: 4.25 },
      { name: "Tile — floor", unit: "sqft", rate: 14 },
      { name: "Stair treads & risers", unit: "step", rate: 165 },
    ],
    jobs: ["Main floor hardwood", "Basement LVP", "Bathroom tile + stairs"],
  },

  landscaping: {
    label: "Landscaping & lawn care",
    company: "Meadowline Landscaping",
    tagline: "Design, build and maintain",
    brandColor: "#3F7A3F",
    categories: ["landscaping_design", "lawn_care", "lawn_mowing", "tree_care_service", "snow_removal"],
    services: [
      { name: "Lawn maintenance — weekly", unit: "visit", rate: 65 },
      { name: "Garden bed design & planting", unit: "sqft", rate: 18 },
      { name: "Tree pruning", unit: "hour", rate: 120 },
      { name: "Seasonal cleanup", unit: "visit", rate: 285 },
    ],
    jobs: ["Front yard redesign", "Weekly maintenance — Elm St", "Fall cleanup"],
  },

  cleaning: {
    label: "Cleaning",
    company: "Brightwork Cleaning",
    tagline: "Homes and offices, spotless",
    brandColor: "#2E8B8B",
    categories: ["residential_cleaning", "deep_cleaning", "commercial_cleaning", "window_cleaning"],
    services: [
      { name: "Standard clean — 2 cleaners", unit: "hour", rate: 55 },
      { name: "Deep clean", unit: "hour", rate: 70 },
      { name: "Window cleaning", unit: "window", rate: 7 },
      { name: "Office clean — after hours", unit: "visit", rate: 240 },
    ],
    jobs: ["Bi-weekly — Rosewood Ave", "Move-out deep clean", "Office — Fridays"],
  },

  plumbing: {
    label: "Plumbing",
    company: "Ridgeway Plumbing",
    tagline: "Licensed, insured, on time",
    brandColor: "#1F4E79",
    categories: ["plumbing", "well_water", "appliance_repair"],
    services: [
      { name: "Service call — diagnostic", unit: "visit", rate: 145 },
      { name: "Labour — journeyman", unit: "hour", rate: 135 },
      { name: "Water heater replacement", unit: "each", rate: 2350 },
      { name: "Drain clearing", unit: "each", rate: 285 },
    ],
    jobs: ["Water heater swap", "Kitchen drain", "Bathroom rough-in"],
  },

  hvac: {
    label: "HVAC",
    company: "Clearair Heating & Cooling",
    tagline: "Comfort, all year",
    brandColor: "#0F6E8C",
    categories: ["hvac_install", "hvac_repair"],
    services: [
      { name: "Diagnostic visit", unit: "visit", rate: 129 },
      { name: "Labour — certified tech", unit: "hour", rate: 145 },
      { name: "Furnace replacement", unit: "each", rate: 5400 },
      { name: "Annual maintenance plan", unit: "year", rate: 320 },
    ],
    jobs: ["Furnace replacement", "AC tune-up", "Ductwork — new build"],
  },

  roofing: {
    label: "Roofing",
    company: "Summit Roofing",
    tagline: "Roofs that outlast the mortgage",
    brandColor: "#7A3B2E",
    categories: ["roofing_service", "siding", "chimney_sweep"],
    services: [
      { name: "Asphalt shingle — tear-off & replace", unit: "square", rate: 525 },
      { name: "Flat roof — TPO", unit: "sqft", rate: 12.5 },
      { name: "Siding — vinyl", unit: "sqft", rate: 9 },
      { name: "Repair — labour", unit: "hour", rate: 115 },
    ],
    jobs: ["Full re-roof — 28 squares", "Leak repair — north valley", "Siding — rear elevation"],
  },

  electrical: {
    label: "Electrical",
    company: "Bright Line Electric",
    tagline: "Licensed electrical, residential and light commercial",
    brandColor: "#B8860B",
    categories: ["electrical", "installation_services"],
    services: [
      { name: "Service call", unit: "visit", rate: 135 },
      { name: "Labour — licensed electrician", unit: "hour", rate: 140 },
      { name: "Panel upgrade — 200A", unit: "each", rate: 3200 },
      { name: "EV charger install", unit: "each", rate: 1250 },
    ],
    jobs: ["Panel upgrade", "Basement circuits", "EV charger — garage"],
  },

  handyman: {
    label: "Handyman / general contracting",
    company: "Mainstay Home Services",
    tagline: "The list you never get to",
    brandColor: "#4A5568",
    categories: ["handyman", "general_contracting", "carpentry", "property_maintenance"],
    services: [
      { name: "Labour — handyman", unit: "hour", rate: 95 },
      { name: "Half-day rate", unit: "half day", rate: 340 },
      { name: "Carpentry — custom", unit: "hour", rate: 110 },
      { name: "Property maintenance — monthly", unit: "month", rate: 450 },
    ],
    jobs: ["Punch list — Maple St", "Deck repair", "Monthly maintenance — 4-plex"],
  },
};

export const INDUSTRY_KEYS = Object.keys(INDUSTRIES);

export function industry(key) {
  return INDUSTRIES[key] || null;
}

/**
 * The demo accounts themselves.
 *
 * Ten, one per sales agent, each starting on a different industry so a new
 * agent's account already looks like something rather than an empty shell they
 * have to configure before their first call. They can switch at any time.
 *
 * The slug is what appears in URLs (demo1.fieldquo.com, /book/demo1), so it's
 * short, stable, and never derived from the company name — renaming the demo to
 * a different trade must not break a link an agent has bookmarked.
 */
export const DEMO_COUNT = 10;

export function demoAccounts(count = DEMO_COUNT) {
  return Array.from({ length: count }, (_, i) => ({
    slug: `demo${i + 1}`,
    email: `demo${i + 1}@fieldquo.com`,
    // Round-robin so the ten aren't all the same trade on day one.
    industry: INDUSTRY_KEYS[i % INDUSTRY_KEYS.length],
  }));
}
