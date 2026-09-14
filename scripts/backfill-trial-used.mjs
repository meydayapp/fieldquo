// scripts/backfill-trial-used.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-trial-used.mjs        # dry run
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/backfill-trial-used.mjs --yes  # write
//
// Stamps Company.trialUsedAt for every company that ever had a Subscription
// and has no stamp yet — with that subscription's createdAt.
//
// ══ Why createdAt is the right date ═════════════════════════════════════════
//
// Every checkout this product has ever opened began with a Stripe trial
// (createTrialCheckoutSession sends trial_period_days unconditionally, and the
// plan-change checkout carried the remaining trial days), so "had a
// subscription" and "had a trial" are the same set of companies today. The
// Subscription row is created by checkout.session.completed — the moment the
// trial began. Going forward the stamp comes from Stripe's own trial_start
// (lib/platform/stripeSync.js's stampTrialUsed); this is the one-off for the
// rows that predate the column. lib/billing/trialOnce.js has the rule.
//
// ══ What it does NOT do ═════════════════════════════════════════════════════
//
//   - never moves a stamp that exists (`trialUsedAt: null` in every WHERE)
//   - never touches a company with no Subscription row — a company that
//     closed the Stripe tab at signup has not had a trial, and the setup gate
//     handles it (lib/signup/setupGate.js)
//   - never deletes, never writes any other column
//
// Dry run by default: prints what it would stamp and exits. `--yes` writes,
// one updateMany per company so a partial run is a partial stamp, not a
// half-written transaction.
import { db } from "@/lib/db";

const write = process.argv.includes("--yes");

const rows = await db.subscription.findMany({
  where: { company: { trialUsedAt: null } },
  select: {
    companyId: true,
    createdAt: true,
    status: true,
    company: { select: { name: true, isDemo: true } },
  },
  orderBy: { createdAt: "asc" },
});

console.log(`${rows.length} compan${rows.length === 1 ? "y" : "ies"} with a subscription and no trialUsedAt${write ? "" : " (dry run — pass --yes to write)"}`);
let stamped = 0;
for (const r of rows) {
  const when = r.createdAt.toISOString();
  console.log(`  ${r.companyId}  ${when}  ${r.status.padEnd(9)}  ${r.company?.isDemo ? "[demo] " : ""}${r.company?.name || ""}`);
  if (!write) continue;
  const res = await db.company.updateMany({
    where: { id: r.companyId, trialUsedAt: null },
    data: { trialUsedAt: r.createdAt },
  });
  stamped += res.count;
}
if (write) console.log(`stamped ${stamped}`);
process.exit(0);
