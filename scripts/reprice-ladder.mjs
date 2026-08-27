// scripts/reprice-ladder.mjs
//
// Bring the live Plan rows in line with SEAT_LADDER after an owner price change.
//
// The seeder is deliberately CREATE-ONLY — it never re-asserts the defaults over
// a price an operator set by hand, because a seeder that "corrects" a deliberate
// edit is a dead control in a second costume. So a price change decided by the
// owner needs its own deliberate run, which is this.
//
// Only touches ladder rows (tierKey is not null). Legacy and bespoke plans are
// left exactly as they are — companies are subscribed to those.
//
// Run: node --env-file=.env --import ./scripts/alias-loader.mjs scripts/reprice-ladder.mjs [--dry]

import { db } from "@/lib/db";
import { SEAT_LADDER, defaultAnnualPrice } from "@/lib/pricing/ladder";

const DRY = process.argv.includes("--dry");
const byTier = new Map(SEAT_LADDER.map((t) => [t.tierKey, t]));

const rows = await db.plan.findMany({
  where: { tierKey: { not: null } },
  orderBy: [{ sortOrder: "asc" }, { currency: "asc" }],
});

console.log(`${rows.length} ladder row(s):\n`);
let changed = 0;

for (const row of rows) {
  const tier = byTier.get(row.tierKey);
  if (!tier) {
    console.log(`  ${row.name.padEnd(10)} ${row.currency}  tierKey "${row.tierKey}" is not in SEAT_LADDER — LEFT ALONE`);
    continue;
  }
  const want = {
    name: tier.label,
    priceMonthly: tier.price,
    priceAnnual: defaultAnnualPrice(tier.price),
    seats: tier.seats,
    crewSeats: tier.crewSeats,
    // maxUsers is the legacy "people" column several screens still read. Kept
    // in step with seats + crew rather than left stale, because a screen that
    // reads it would otherwise report last week's headcount.
    maxUsers: tier.seats + tier.crewSeats,
  };
  const diffs = Object.entries(want).filter(([k, v]) => String(row[k]) !== String(v));
  if (!diffs.length) {
    console.log(`  ${row.name.padEnd(10)} ${row.currency}  already correct`);
    continue;
  }
  console.log(
    `  ${String(row.name).padEnd(10)} ${row.currency}  ` +
      diffs.map(([k, v]) => `${k}: ${row[k]} -> ${v}`).join(", "),
  );
  if (!DRY) {
    await db.plan.update({ where: { id: row.id }, data: want });
    changed += 1;
  }
}

console.log(DRY ? "\n--dry: nothing written." : `\n${changed} row(s) updated.`);

// Nobody should be on a ladder row yet, but say so rather than assume it.
for (const row of rows) {
  const n = await db.subscription.count({ where: { planId: row.id } });
  if (n > 0) console.log(`  NOTE: ${n} subscription(s) on ${row.name} (${row.currency}) — their price just moved.`);
}
console.log(`Legacy plans untouched: ${await db.plan.count({ where: { tierKey: null } })}`);
await db.$disconnect();
