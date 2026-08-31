// scripts/backfill-my-subscription.js
//
// One-time manual fix for accounts that signed up BEFORE the planId fix in
// app/api/companies/route.js / lib/platform/stripeBilling.js — their
// Subscription row was never created because the signup checkout session
// never carried a planId for the webhook to use. This creates it directly.
//
// Run once: node scripts/backfill-my-subscription.js your-company-slug-or-email
//
// Safe to delete after running.
import "dotenv/config";
import { db } from "../lib/db.js";

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error(
      "Usage: node scripts/backfill-my-subscription.js <company-slug-or-owner-email>",
    );
    process.exit(1);
  }

  const company = await db.company.findFirst({
    where: {
      OR: [{ slug: identifier }, { email: identifier }],
    },
  });

  if (!company) {
    console.error(`No company found matching "${identifier}"`);
    process.exit(1);
  }

  const existing = await db.subscription.findUnique({
    where: { companyId: company.id },
  });
  if (existing) {
    console.log(
      `Company "${company.name}" already has a Subscription row — nothing to do.`,
    );
    return;
  }

  // Pick whichever plan actually matches what they were quoted at signup —
  // adjust this to the real plan name/employee count if it's not the
  // smallest tier.
  const plan = await db.plan.findFirst({ orderBy: { priceMonthly: "asc" } });
  if (!plan) {
    console.error(
      "No Plan rows exist at all — run `npm run seed:seat-ladder` first.",
    );
    process.exit(1);
  }

  await db.subscription.create({
    data: {
      companyId: company.id,
      planId: plan.id,
      status: "trialing",
      trialEndsAt: company.trialEndsAt,
    },
  });

  console.log(
    `Created Subscription for "${company.name}" on plan "${plan.name}".`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
