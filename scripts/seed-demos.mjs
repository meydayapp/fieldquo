// scripts/seed-demos.mjs
//
// Create the ten sales demo companies. Idempotent — run it as often as you like.
//
//   node --import ./scripts/alias-loader.mjs scripts/seed-demos.mjs
//
// ── What it does and doesn't do ─────────────────────────────────────────────
//
// It creates the COMPANIES, flags them isDemo, and dresses each one in an
// industry preset. It does NOT create logins: this codebase has no server-side
// sign-up path (rule 1 — no public signup; people arrive by invitation), and
// inventing a second user-creation route that bypasses that would be a hole in
// the thing the rule exists to protect.
//
// So: run this, then invite each sales agent to their demo company from
// Settings → Team, exactly like any other member. They get the normal
// invitation email and set their own password.
import "dotenv/config";
import { db } from "@/lib/db";
import { demoAccounts } from "@/lib/demo/industries";
import { applyIndustry } from "@/lib/demo/seedDemo";

const accounts = demoAccounts();

for (const acct of accounts) {
  // Matched on slug, which is the stable identity — the NAME changes every
  // time somebody switches the industry, so matching on it would create a
  // duplicate company on the second run.
  let company = await db.company.findUnique({ where: { slug: acct.slug } });

  if (company && !company.isDemo) {
    // A real company already owns this slug. Refuse loudly rather than flag
    // someone's live tenant as a demo, which would make it wipeable.
    console.error(
      `✗ ${acct.slug} — a NON-DEMO company ("${company.name}") already has this slug. Skipped.`,
    );
    continue;
  }

  if (!company) {
    company = await db.company.create({
      data: {
        name: `Demo ${acct.slug}`,
        slug: acct.slug,
        bookingSlug: acct.slug,
        email: acct.email,
        isDemo: true,
      },
    });
    console.log(`+ created ${acct.slug}`);
  }

  const result = await applyIndustry(company.id, acct.industry);
  console.log(
    `  ${acct.slug} → ${result.industry} (${result.categories} categories, ${result.services} services)`,
  );
}

console.log(`\nDone. ${accounts.length} demo companies ready.`);
console.log("Next: invite each sales agent from Settings → Team on their demo company.");
console.log("Switch a demo's trade any time at /platform/demo.\n");
process.exit(0);
