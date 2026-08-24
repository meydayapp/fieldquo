// One-off: upsert the ServiceCategory rows from prisma/seed.js's CATEGORIES.
// Additive and idempotent — the seed's own upsert for the category table only,
// because `insulation` is new and everything at sortOrder 43+ shifted by one to
// make room for it. Touches label, icon and sortOrder. Deletes nothing.
import "dotenv/config";
import fs from "node:fs";
import { db } from "../lib/db.js";

const src = fs.readFileSync(new URL("../prisma/seed.js", import.meta.url), "utf8");
const i = src.indexOf("const CATEGORIES = [");
const block = src.slice(i, src.indexOf("\n];", i) + 2);
const CATEGORIES = eval(block.replace("const CATEGORIES =", "(") + ")");

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
