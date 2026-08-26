// One-off: upsert the ServiceCategory rows from the trade catalogue.
// Additive and idempotent — the seed's own upsert for the category table only.
// Touches label, icon and sortOrder. Deletes nothing.
//
// It used to slice the array out of prisma/seed.js as text and eval it, which
// stopped working the moment the list moved to lib/trades/catalog.js. Same
// import the seeder uses now, so there is one list and one way to read it.
import "dotenv/config";
import { db } from "../lib/db.js";
import { seedRows } from "../lib/trades/catalog.js";

const CATEGORIES = seedRows();

let created = 0, updated = 0;
for (const c of CATEGORIES) {
  const before = await db.serviceCategory.findUnique({ where: { key: c.key } });
  await db.serviceCategory.upsert({
    where: { key: c.key },
    update: { label: c.label, icon: c.icon, sortOrder: c.sortOrder },
    create: c,
  });
  if (before) updated++; else { created++; console.log("  + created", c.key); }
}
console.log(`${CATEGORIES.length} categories: ${created} created, ${updated} updated, 0 deleted`);
process.exit(0);
