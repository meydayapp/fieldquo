// prisma/seed-plumbing-materials.js
import "dotenv/config";
import { db } from "../lib/db.js";

// Real parts/prices from the uploaded PBP spreadsheet's Material tab.
// section ties each part back to which Quote-tab section it belongs to.
const MATERIALS = [
  {
    section: "groundworks",
    description: "Main line BWV",
    unit: "each",
    rate: 150,
  },
  { section: "groundworks", description: "Glue", unit: "each", rate: 50 },
  {
    section: "groundworks",
    description: "4 inch ABS/PVC Pipe",
    unit: "ft",
    rate: 87,
  },
  {
    section: "groundworks",
    description: "3 inch ABS/PVC Pipe",
    unit: "ft",
    rate: 62,
  },
  {
    section: "groundworks",
    description: "4 inch 45's",
    unit: "each",
    rate: 7.5,
  },
  {
    section: "groundworks",
    description: "4 inch Wyes",
    unit: "each",
    rate: 15,
  },
  { section: "drainage", description: "Strapping", unit: "each", rate: 3 },
  { section: "drainage", description: "Laundry Box", unit: "each", rate: 50 },
  { section: "drainage", description: "Shower Drains", unit: "each", rate: 15 },
  { section: "drainage", description: "Floor Flanges", unit: "each", rate: 7 },
  {
    section: "waterlines",
    description: "Backflows",
    unit: "each",
    rate: 182,
    sku: null,
  },
  {
    section: "waterlines",
    description: "3/4 inch DCVA",
    unit: "each",
    rate: 182,
  },
  {
    section: "waterlines",
    description: "1 inch DCVA",
    unit: "each",
    rate: 250,
  },
  {
    section: "waterlines",
    description: "1 inch Pex Pipe",
    unit: "ft",
    rate: 24,
  },
  {
    section: "waterlines",
    description: "3/4 inch Pex Pipe",
    unit: "ft",
    rate: 13.5,
  },
  {
    section: "waterlines",
    description: "1/2 inch Pex Pipe",
    unit: "ft",
    rate: 7.36,
  },
  {
    section: "tubs_showers",
    description: "Shower stainers",
    unit: "each",
    rate: 15,
  },
  {
    section: "tubs_showers",
    description: "Waste & Overflows",
    unit: "each",
    rate: 25,
  },
  {
    section: "tubs_showers",
    description: '1/2" Copper (Type M)',
    unit: "ft",
    rate: 20,
  },
  { section: "gas", description: '2" Black iron', unit: "ft", rate: 128.3 },
  { section: "gas", description: '1-1/2" black iron', unit: "ft", rate: 95.52 },
  { section: "gas", description: '1" Black iron', unit: "ft", rate: 59.16 },
  {
    section: "gas",
    description: '3/4" Gas tite (Per Foot)',
    unit: "ft",
    rate: 3.72,
  },
  {
    section: "gas",
    description: '1/2" Gas Tite (Per Foot)',
    unit: "ft",
    rate: 3.05,
  },
  {
    section: "finishing",
    description: "1/2 inch Pex x 3/8 Straight Comp Valves",
    unit: "each",
    rate: 4.43,
  },
  {
    section: "finishing",
    description: "20 inch Lav Supplies",
    unit: "each",
    rate: 2.89,
  },
  {
    section: "finishing",
    description: "20 inch Toilet Supplies",
    unit: "each",
    rate: 2.45,
  },
  {
    section: "finishing",
    description: "Wax Seals With Horn",
    unit: "each",
    rate: 1.6,
  },
  {
    section: "finishing",
    description: "Dishwasher Supply",
    unit: "each",
    rate: 7.89,
  },
  {
    section: "finishing",
    description: "Fridge Supply",
    unit: "each",
    rate: 8.21,
  },
  {
    section: "hot_water_tank",
    description: "200K BTU Tankless HWT",
    unit: "each",
    rate: 1950,
  },
  {
    section: "hot_water_tank",
    description: "50 Gallon PDV Tank",
    unit: "each",
    rate: 1926,
  },
  {
    section: "hot_water_tank",
    description: "60 Gallon Electric Tank",
    unit: "each",
    rate: 912,
  },
  {
    section: "water_softener",
    description: "Water Softener",
    unit: "each",
    rate: 900,
  },
];

async function main({ companyId }) {
  if (!companyId) {
    console.error("Usage: node prisma/seed-plumbing-materials.js <companyId>");
    process.exit(1);
  }

  for (const item of MATERIALS) {
    await db.quickAddItem.create({
      data: {
        companyId,
        description: item.description,
        unit: item.unit,
        rate: item.rate,
        section: item.section,
      },
    });
  }

  console.log(
    `Seeded ${MATERIALS.length} plumbing materials for company ${companyId}.`,
  );
}

main({ companyId: process.argv[2] }).finally(() => db.$disconnect());
