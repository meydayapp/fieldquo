// prisma/seed.js
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const CATEGORIES = [
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

main().finally(() => db.$disconnect());
