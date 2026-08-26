// prisma/seed-fence-categories.js
//
// Kept as its own entry point because `npm run seed` upserts all 68 catalogue
// rows and someone adding fencing to a live database wanted the two. It no
// longer carries its own copy of them: the rows come from lib/trades/catalog.js
// like every other trade, which is what stops the next add-a-trade patch from
// inventing a sortOrder that is already taken (these two shipped as 61 and 62,
// colliding with Pooper Scooper Service and Installation Services).
import "dotenv/config";
import { db } from "../lib/db.js";
import { seedRows } from "../lib/trades/catalog.js";

const FENCE_KEYS = ["fence_repair", "fence_restoration"];
const NEW_CATEGORIES = seedRows().filter((c) => FENCE_KEYS.includes(c.key));

async function main() {
  if (NEW_CATEGORIES.length !== FENCE_KEYS.length) {
    throw new Error(
      `Expected ${FENCE_KEYS.length} fence categories in the catalogue, found ${NEW_CATEGORIES.length}.`,
    );
  }
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
