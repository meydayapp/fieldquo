// scripts/seed-seat-ladder.mjs
//
// Puts the four rungs of SEAT_LADDER into the Plan table, once per currency.
//
//   npm run seed:seat-ladder            # create anything missing, change nothing
//   npm run seed:seat-ladder -- --dry   # say what it would do and stop
//
// ── Additive. Deletes nothing, and overwrites nothing ──────────────────────
//
// Four legacy Plan rows ("1 Employee", "10 Employees", "20 Employees",
// "Custom (2 employees)") carry ten live Subscriptions between them. They are
// not touched, not renamed and not retired here — a company on one keeps
// billing exactly as before. Retiring them is a migration with customers in
// it, not a seeder.
//
// ── Why the update clause is empty, deliberately ───────────────────────────
//
// The obvious seeder writes the ladder's price on every run:
//
//     update: { priceMonthly: tier.price, seats: tier.seats, ... }
//
// That is the same bug this session exists to remove, in a second costume. The
// owner must be able to change a price at /platform/billing/plans without a
// deploy; a seeder that re-asserts the constant would revert their edit the
// next time anyone ran it, and the editor would look live and quietly not be.
//
// SEAT_LADDER prices are the DEFAULTS a row is minted with. Once the row
// exists, the row is the price. So the second run creates nothing, writes
// nothing, and — because that silence is indistinguishable from a broken
// script — prints which rows already differ from the ladder default, so drift
// is visible without being corrected behind the operator's back.

import "dotenv/config";
import { db } from "../lib/db.js";
import { SEAT_LADDER, SUPPORTED_CURRENCIES } from "../lib/pricing/ladder.js";

const DRY = process.argv.includes("--dry");

const rows = SUPPORTED_CURRENCIES.flatMap((currency) =>
  SEAT_LADDER.map((tier) => ({
    tierKey: tier.tierKey,
    currency,
    // "Solo (CAD)" rather than "Solo". Plan.name is no longer unique, but it
    // is what the platform console labels a row with and what
    // /api/platform/analytics/overview keys its subscriber counts by — two
    // rows both called "Solo" would be two indistinguishable cards showing
    // each other's company count.
    name: `${tier.label} (${currency})`,
    priceMonthly: tier.price,
    // Same number monthly and annual: annual is the INTERVAL, not a discount —
    // the owner's decision, recorded on Plan.priceAnnual. Twelve times the
    // monthly figure, because the column is a per-year charge.
    priceAnnual: tier.price * 12,
    seats: tier.seats,
    crewSeats: tier.crewSeats,
    // maxUsers counted PEOPLE and still has readers (the company-facing plan
    // picker prints "N users"). Seats plus crew is the honest total for a row
    // that now carries both.
    maxUsers: tier.seats + tier.crewSeats,
    sortOrder: tier.sortOrder,
    aiCopilotEnabled: true,
    // No stripePriceId. The platform console already prints "No Stripe price
    // ID — checkout will fail" on such a row and /api/marketing/plans withholds
    // it from the public page rather than offering something unbuyable, so a
    // seeded row is inert until somebody pastes the id in. Inventing a
    // plausible-looking id would be worse than leaving it blank.
    isPublic: true,
  })),
);

const fmt = (v) => (v === null || v === undefined ? "—" : String(v));

async function main() {
  const before = await db.plan.count();
  const legacyBefore = await db.plan.count({ where: { tierKey: null } });
  const subsBefore = await db.subscription.count();

  console.log(
    `\nBefore: ${before} Plan rows (${legacyBefore} legacy, no tierKey), ` +
      `${subsBefore} Subscriptions`,
  );

  let created = 0;
  let untouched = 0;
  const drifted = [];

  for (const row of rows) {
    const { tierKey, currency, ...data } = row;
    const existing = await db.plan.findUnique({
      where: { tierKey_currency: { tierKey, currency } },
    });

    if (existing) {
      untouched++;
      if (Number(existing.priceMonthly) !== Number(data.priceMonthly)) {
        drifted.push(
          `${tierKey}/${currency}: row says ${fmt(existing.priceMonthly)}, ` +
            `ladder default is ${fmt(data.priceMonthly)}`,
        );
      }
      continue;
    }

    if (DRY) {
      console.log(`  would create ${tierKey}/${currency} at ${data.priceMonthly}`);
      created++;
      continue;
    }

    await db.plan.create({ data: { tierKey, currency, ...data } });
    console.log(`  + created ${tierKey}/${currency} — ${data.name}`);
    created++;
  }

  const after = await db.plan.count();
  const legacyAfter = await db.plan.count({ where: { tierKey: null } });
  const subsAfter = await db.subscription.count();

  console.log(
    `\nAfter: ${after} Plan rows (${legacyAfter} legacy, no tierKey), ` +
      `${subsAfter} Subscriptions`,
  );
  console.log(
    `${rows.length} ladder rows: ${created} created, ${untouched} left alone, 0 deleted`,
  );

  if (drifted.length) {
    console.log(
      `\n${drifted.length} row(s) differ from the ladder default. NOT changed —` +
        ` the row is the price once it exists:`,
    );
    drifted.forEach((d) => console.log(`  · ${d}`));
  }

  // The load-bearing claim. A seeder that quietly reduced the legacy count
  // would have taken paying subscriptions with it, so it is asserted rather
  // than assumed.
  if (legacyAfter !== legacyBefore || subsAfter !== subsBefore) {
    console.error(
      `\nFAILED — legacy plans ${legacyBefore}→${legacyAfter}, ` +
        `subscriptions ${subsBefore}→${subsAfter}. Nothing here should move either.`,
    );
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
