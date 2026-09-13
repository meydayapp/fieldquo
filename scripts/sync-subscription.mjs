// scripts/sync-subscription.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/sync-subscription.mjs <companyId>
//
// Pull one company's subscription from Stripe and write what Stripe says onto
// our Subscription row — the same lib/platform/stripeSync.js the platform
// "Sync from Stripe" button and /api/cron/billing-sync use, from a shell, for
// the day the console is what is broken.
//
// ── It refuses a test-mode key ──────────────────────────────────────────────
//
// The live secret key lives only in Vercel, on purpose. A local .env carries
// sk_test_…, and asking a test key about a live subscription id answers "No
// such subscription" — which lib/platform/stripeSync.js correctly refuses to
// write as cancelled, so the run would be a no-op that LOOKS like a finding.
// Rather than print that, the script says what it needs: the live key, or
// the button on /platform/companies/<id>, which runs where the key is.
//
// Set STRIPE_SECRET_KEY=sk_live_… in the environment for one invocation if
// you genuinely hold it; never write it into .env.
import { syncSubscriptionFromStripe } from "@/lib/platform/stripeSync";

const companyId = process.argv[2];
if (!companyId) {
  console.error("usage: node --env-file=.env --import ./scripts/alias-loader.mjs scripts/sync-subscription.mjs <companyId>");
  process.exit(2);
}

const key = process.env.STRIPE_SECRET_KEY || "";
if (!key.startsWith("sk_live_")) {
  console.error(
    key.startsWith("sk_test_")
      ? "Refusing: STRIPE_SECRET_KEY is a TEST-mode key (sk_test_…). A live subscription id asked of it answers \"No such subscription\", which is not a finding.\n" +
        "The live key exists only in Vercel. Use the \"Sync from Stripe\" button on /platform/companies/" + companyId + " (it runs on the deployment), or the six-hourly /api/cron/billing-sync."
      : "Refusing: STRIPE_SECRET_KEY is not set to a live key (sk_live_…).",
  );
  process.exit(3);
}

const result = await syncSubscriptionFromStripe(companyId);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
