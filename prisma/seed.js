// prisma/seed.js
//
// Seeds the ServiceCategory catalogue.
//
// The list itself lives in lib/trades/catalog.js, which also declares each
// trade's industry and its instant estimator. It used to live here, and that
// was how the fence categories ended up seeded by a second file with sortOrder
// values already taken and no industry at all: half the answer was in the
// seeder and half was in app/data, so adding a trade in one place looked done.
//
// Imported with a RELATIVE path, and catalog.js imports nothing, because this
// file runs as plain `node prisma/seed.js` with no `@/` alias loader.
import "dotenv/config";
import { db } from "../lib/db.js";
import { seedRows } from "../lib/trades/catalog.js";

const CATEGORIES = seedRows();

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
