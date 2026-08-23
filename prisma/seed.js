// prisma/seed.js
import "dotenv/config";
import { db } from "../lib/db.js";

const CATEGORIES = [
  // ── Cabinets / TrueFinish origin categories ──
  {
    key: "cabinet_refinishing",
    label: "Cabinet Refinishing",
    icon: "Paintbrush",
    sortOrder: 1,
  },
  {
    key: "cabinet_refacing",
    label: "Cabinet Refacing",
    icon: "Layers",
    sortOrder: 2,
  },
  {
    key: "countertop",
    label: "Countertop Installation",
    icon: "Square",
    sortOrder: 3,
  },
  { key: "flooring", label: "Flooring", icon: "Grid2x2", sortOrder: 4 },
  { key: "stairs", label: "Stairs", icon: "MoveUp", sortOrder: 5 },
  {
    key: "interior_painting",
    label: "Interior Painting",
    icon: "PaintRoller",
    sortOrder: 6,
  },
  {
    key: "exterior_painting",
    label: "Exterior Painting",
    icon: "Home",
    sortOrder: 7,
  },
  { key: "drywall", label: "Drywall", icon: "PanelTop", sortOrder: 8 },
  { key: "demolition", label: "Demolition", icon: "Hammer", sortOrder: 9 },
  {
    key: "general_contracting",
    label: "General Contracting",
    icon: "HardHat",
    sortOrder: 10,
  },
  {
    key: "construction",
    label: "New Construction",
    icon: "Building2",
    sortOrder: 11,
  },

  // ── Cleaning ──
  {
    key: "residential_cleaning",
    label: "Residential Cleaning",
    icon: "Sparkles",
    sortOrder: 12,
  },
  {
    key: "deep_cleaning",
    label: "Deep Cleaning",
    icon: "Sparkles",
    sortOrder: 13,
  },
  {
    key: "commercial_cleaning",
    label: "Commercial Cleaning",
    icon: "Building",
    sortOrder: 14,
  },
  {
    key: "janitorial",
    label: "Janitorial Services",
    icon: "Building",
    sortOrder: 15,
  },
  {
    key: "carpet_cleaning",
    label: "Carpet Cleaning",
    icon: "Sparkles",
    sortOrder: 16,
  },
  {
    key: "window_cleaning",
    label: "Window Cleaning",
    icon: "Sparkles",
    sortOrder: 17,
  },

  // ── Handyman / General ──
  {
    key: "handyman",
    label: "Handyman Services",
    icon: "Wrench",
    sortOrder: 18,
  },
  {
    key: "general_contracting_reno",
    label: "General Renovation",
    icon: "HardHat",
    sortOrder: 19,
  },
  { key: "remodeling", label: "Remodeling", icon: "HardHat", sortOrder: 20 },
  { key: "carpentry", label: "Carpentry", icon: "Hammer", sortOrder: 21 },
  {
    key: "drywall_install",
    label: "Drywall Installation",
    icon: "PanelTop",
    sortOrder: 22,
  },
  { key: "tiling", label: "Tiling", icon: "Grid2x2", sortOrder: 23 },
  {
    key: "flooring_install",
    label: "Flooring Installation",
    icon: "Grid2x2",
    sortOrder: 24,
  },

  // ── Trades ──
  { key: "plumbing", label: "Plumbing", icon: "Wrench", sortOrder: 25 },
  { key: "electrical", label: "Electrical", icon: "Zap", sortOrder: 26 },
  {
    key: "hvac_install",
    label: "HVAC Installation",
    icon: "Wind",
    sortOrder: 27,
  },
  { key: "hvac_repair", label: "HVAC Repair", icon: "Wind", sortOrder: 28 },
  {
    key: "appliance_repair",
    label: "Appliance Repair",
    icon: "Wrench",
    sortOrder: 29,
  },
  {
    key: "locksmith",
    label: "Locksmith Services",
    icon: "Lock",
    sortOrder: 30,
  },
  {
    key: "garage_door",
    label: "Garage Door Services",
    icon: "DoorClosed",
    sortOrder: 31,
  },
  {
    key: "elevator_services",
    label: "Elevator Services",
    icon: "Building",
    sortOrder: 32,
  },
  {
    key: "well_water",
    label: "Well Water Services",
    icon: "Droplet",
    sortOrder: 33,
  },
  {
    key: "mechanical_contracting",
    label: "Mechanical Contracting",
    icon: "Wrench",
    sortOrder: 34,
  },

  // ── Construction / Structural ──
  { key: "concrete", label: "Concrete", icon: "Square", sortOrder: 35 },
  { key: "masonry", label: "Masonry", icon: "Square", sortOrder: 36 },
  { key: "excavation", label: "Excavation", icon: "Truck", sortOrder: 37 },
  {
    key: "demolition_contractor",
    label: "Demolition Contractor",
    icon: "Hammer",
    sortOrder: 38,
  },
  { key: "paving", label: "Paving", icon: "Square", sortOrder: 39 },
  {
    key: "fence_services",
    label: "Fence Installation",
    icon: "Fence",
    sortOrder: 40,
  },
  { key: "roofing_service", label: "Roofing", icon: "Home", sortOrder: 41 },
  { key: "siding", label: "Siding", icon: "Home", sortOrder: 42 },
  { key: "restoration", label: "Restoration", icon: "Home", sortOrder: 43 },
  {
    key: "chimney_sweep",
    label: "Chimney Sweep",
    icon: "Flame",
    sortOrder: 44,
  },

  // ── Outdoor / Landscaping ──
  {
    key: "landscaping_design",
    label: "Landscaping",
    icon: "Trees",
    sortOrder: 45,
  },
  { key: "lawn_care", label: "Lawn Care", icon: "Sprout", sortOrder: 46 },
  { key: "lawn_mowing", label: "Lawn Mowing", icon: "Sprout", sortOrder: 47 },
  {
    key: "irrigation",
    label: "Irrigation Services",
    icon: "Droplet",
    sortOrder: 48,
  },
  {
    key: "tree_care_service",
    label: "Tree Care",
    icon: "Trees",
    sortOrder: 49,
  },
  {
    key: "snow_removal",
    label: "Snow Removal",
    icon: "Snowflake",
    sortOrder: 50,
  },
  { key: "pest_control", label: "Pest Control", icon: "Bug", sortOrder: 51 },
  {
    key: "pool_spa",
    label: "Pool & Spa Services",
    icon: "Waves",
    sortOrder: 52,
  },
  { key: "junk_removal", label: "Junk Removal", icon: "Trash2", sortOrder: 53 },
  {
    key: "property_maintenance",
    label: "Property Maintenance",
    icon: "Wrench",
    sortOrder: 54,
  },

  // ── Pressure Washing / Auto ──
  {
    key: "pressure_washing_house",
    label: "House Pressure Washing",
    icon: "Droplet",
    sortOrder: 55,
  },
  {
    key: "pressure_washing_driveway",
    label: "Driveway/Walkway Washing",
    icon: "Droplet",
    sortOrder: 56,
  },
  {
    key: "auto_detailing",
    label: "Auto Detailing",
    icon: "Car",
    sortOrder: 57,
  },

  // ── Pet services ──
  { key: "dog_walking", label: "Dog Walking", icon: "PawPrint", sortOrder: 58 },
  {
    key: "pooper_scooper",
    label: "Pooper Scooper Service",
    icon: "PawPrint",
    sortOrder: 59,
  },

  // ── Installation / misc ──
  {
    key: "installation_services",
    label: "Installation Services",
    icon: "Package",
    sortOrder: 60,
  },

  // ── Coatings / concrete (added for the instant estimator) ──
  {
    key: "epoxy",
    label: "Epoxy & Concrete Coatings",
    icon: "Square",
    sortOrder: 61,
  },
  { key: "parging", label: "Parging", icon: "Square", sortOrder: 62 },

  // Sealcoating is maintenance, not paving: it recoats a driveway that is
  // already there, is priced per square foot of surface rather than by depth
  // and tonnage, and is resold to the same client every two to four years.
  // Folding it into `paving` would have meant one rate card answering two
  // different questions.
  {
    key: "driveway_sealing",
    label: "Driveway Sealing",
    icon: "Square",
    sortOrder: 63,
  },
];

async function main() {
  for (const c of CATEGORIES) {
    await db.serviceCategory.upsert({
      where: { key: c.key },
      update: { label: c.label, icon: c.icon, sortOrder: c.sortOrder },
      create: c,
    });
  }
  console.log(`Seeded ${CATEGORIES.length} service categories.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
