// scripts/retire-legacy-plans.mjs
//
// Take the per-licence plans off the menu without taking them off anybody.
//
// ══ Why ════════════════════════════════════════════════════════════════════
//
// The seat ladder shipped alongside the old per-headcount plans and both were
// public at once. A prospect opening the picker saw
//
//     1 Employee — $45          Solo — $129
//
// side by side for effectively the same product, and took the $45. The new
// pricing was being undercut by the old pricing on the same screen.
//
// ══ Retired, never deleted ═════════════════════════════════════════════════
//
// Eight subscriptions sit on these rows. `isPublic: false` is exactly the right
// instrument because app/api/settings/plans/route.js already asks
//
//     { OR: [{ isPublic: true }, { id: subscription.planId }] }
//
// so a company on a legacy plan keeps seeing and keeping it, while nobody new
// can pick one. Deleting the rows would orphan live subscriptions; changing
// their price would silently re-bill real customers. This changes one boolean
// and is reversible with the same boolean.
//
// ── The second fix, which is a trap being defused ──────────────────────────
//
// These rows carry seats=1 and crewSeats=0 — schema DEFAULTS, not decisions.
// Nothing reads them yet. The moment seat enforcement lands, a twenty-person
// company on "20 Employees" would be capped at one seat and nineteen people
// would lose their login, and the cause would look like the enforcement rather
// than a default written months earlier. Under the old model every user held a
// licence, so seats = maxUsers and crew = 0 is the honest translation.
//
// Idempotent. Run: node --import ./scripts/alias-loader.mjs scripts/retire-legacy-plans.mjs [--dry]

import { db } from "@/lib/db";

const DRY = process.argv.includes("--dry");

const legacy = await db.plan.findMany({ where: { tierKey: null } });
if (!legacy.length) {
  console.log("No legacy plans found — nothing to do.");
  process.exit(0);
}

console.log(`${legacy.length} legacy plan row(s):\n`);
let changed = 0;

for (const p of legacy) {
  const subs = await db.subscription.count({ where: { planId: p.id } });
  const wantSeats = Math.max(1, Number(p.maxUsers) || 1);
  const needsPrivate = p.isPublic === true;
  const needsSeats = p.seats !== wantSeats || p.crewSeats !== 0;

  console.log(
    `  ${p.name.padEnd(22)} $${String(p.priceMonthly).padEnd(6)} ` +
      `public=${String(p.isPublic).padEnd(5)} seats=${p.seats} crew=${p.crewSeats} ` +
      `subs=${subs}` +
      (needsPrivate || needsSeats
        ? `  ->  public=false seats=${wantSeats} crew=0`
        : "  ->  already correct"),
  );

  if (!DRY && (needsPrivate || needsSeats)) {
    await db.plan.update({
      where: { id: p.id },
      data: { isPublic: false, seats: wantSeats, crewSeats: 0 },
    });
    changed += 1;
  }
}

console.log(
  DRY
    ? "\n--dry: nothing written."
    : `\n${changed} row(s) updated. No row deleted, no price changed, no subscription touched.`,
);

// Proof rather than assertion: what a NEW company would now be offered.
const offered = await db.plan.findMany({
  where: { isPublic: true },
  orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
  select: { name: true, priceMonthly: true, currency: true, seats: true, crewSeats: true },
});
console.log(`\nOffered to a new company (${offered.length}):`);
for (const p of offered) {
  console.log(`  ${p.name.padEnd(16)} ${p.currency} ${String(p.priceMonthly).padStart(6)}  ${p.seats} seats + ${p.crewSeats} crew`);
}
console.log(`\nSubscriptions still attached: ${await db.subscription.count()}`);
await db.$disconnect();
