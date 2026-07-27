// prisma/seed-fence-categories.js
import "dotenv/config";
import { db } from "../lib/db.js";

const NEW_CATEGORIES = [
  { key: "fence_repair", label: "Fence Repair", icon: "Wrench", sortOrder: 61 },
  {
    key: "fence_restoration",
    label: "Fence Restoration",
    icon: "Sparkles",
    sortOrder: 62,
  },
];

async function main() {
  for (const c of NEW_CATEGORIES) {
    await db.serviceCategory.upsert({
      where: { key: c.key },
      update: { label: c.label, icon: c.icon, sortOrder: c.sortOrder },
      create: c,
    });
  }
  console.log(`Seeded ${NEW_CATEGORIES.length} fence categories.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
