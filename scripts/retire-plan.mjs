// scripts/retire-plan.mjs
//
// Retire one plan — keep it for the companies on it, sell it to nobody — from
// a laptop, with the same write and the same audit row the console button
// makes (app/api/platform/billing/plans/[id]/retire/route.js).
//
//   node --import ./scripts/alias-loader.mjs scripts/retire-plan.mjs <planId>            # dry run: says what would change
//   node --import ./scripts/alias-loader.mjs scripts/retire-plan.mjs <planId> --yes      # writes retiredAt = now()
//   node --import ./scripts/alias-loader.mjs scripts/retire-plan.mjs <planId> --yes --unretire
//   ... --by="owner via chat 2026-09-14"                                                 # who asked (default below)
//
// ══ Why a script and not a DELETE ══════════════════════════════════════════
//
// The owner's "Live test — $1" (cmtzrltno00000kt62j25oip1) was private, and
// private only hides a plan from the pricing page: /api/marketing/plans hands
// an unlisted plan to anyone holding a link with its id, and /api/companies
// accepts any plan that exists — a working $1 signup. It cannot be deleted:
// Test Inc.'s subscription references it, and this codebase never deletes.
// Retired is the third state (Plan.retiredAt), read by isRetired() in
// lib/platform/sellablePlans.js, which every sell path refuses on.
//
// ══ What this does NOT touch ═══════════════════════════════════════════════
//
// No subscription. No Stripe object. No row deleted. The companies on the
// plan are counted and printed so the person running it sees what "kept for
// its subscribers" means, and the audit row records that number.
//
// The audit row's platformAdminId is a foreign key to PlatformAdmin, so it
// carries the first active superadmin; WHO asked is in details.by, which is
// what --by sets. That is the same shape scripts/suggest-trades.mjs uses.

import "dotenv/config";

const args = process.argv.slice(2);
const planId = args.find((a) => !a.startsWith("--")) || null;
const write = args.includes("--yes");
const unretire = args.includes("--unretire");
const byArg = args.find((a) => a.startsWith("--by="));
const by = byArg ? byArg.slice("--by=".length) : "owner via chat 2026-09-14";

if (!planId) {
  console.error("Usage: retire-plan.mjs <planId> [--yes] [--unretire] [--by=\"who asked\"]");
  process.exit(2);
}

const { db } = await import("@/lib/db");
const { isRetired } = await import("@/lib/platform/sellablePlans");

const plan = await db.plan.findUnique({
  where: { id: planId },
  include: {
    subscriptions: {
      select: {
        id: true,
        status: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        company: { select: { id: true, name: true } },
      },
    },
  },
});

if (!plan) {
  console.error(`No plan with id ${planId}.`);
  await db.$disconnect();
  process.exit(1);
}

const retired = isRetired(plan);
console.log(
  `${plan.name}  ${plan.currency} ${String(plan.priceMonthly)}/mo  ` +
    `public=${plan.isPublic}  retiredAt=${plan.retiredAt ? plan.retiredAt.toISOString() : "null"}`,
);
console.log(
  plan.subscriptions.length
    ? `${plan.subscriptions.length} subscription(s) on it — kept, untouched:`
    : "No subscriptions on it.",
);
for (const s of plan.subscriptions) {
  console.log(
    `  ${(s.company?.name || s.company?.id || "?").trim().padEnd(24)} ${s.status.padEnd(9)} ` +
      (s.cancelAtPeriodEnd && s.currentPeriodEnd
        ? `ends ${s.currentPeriodEnd.toISOString().slice(0, 10)} by itself`
        : s.currentPeriodEnd
          ? `renews ${s.currentPeriodEnd.toISOString().slice(0, 10)}`
          : ""),
  );
}

if (retired === !unretire) {
  console.log(`\nAlready ${retired ? "retired" : "on sale"} — nothing to do.`);
  await db.$disconnect();
  process.exit(0);
}

if (!write) {
  console.log(
    `\nDry run. Would set retiredAt = ${unretire ? "null" : "now()"} and write a ` +
      `${unretire ? "plan_unretired" : "plan_retired"} audit row (by: ${by}). ` +
      "Re-run with --yes to do it.",
  );
  await db.$disconnect();
  process.exit(0);
}

const admin = await db.platformAdmin.findFirst({
  where: { role: "superadmin", active: true },
  orderBy: { createdAt: "asc" },
  select: { id: true, email: true },
});
if (!admin) {
  console.error("No active superadmin to attribute the audit row to — refusing to write unlogged.");
  await db.$disconnect();
  process.exit(1);
}

const now = new Date();
const [updated] = await db.$transaction([
  db.plan.update({ where: { id: planId }, data: { retiredAt: unretire ? null : now } }),
  db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: unretire ? "plan_unretired" : "plan_retired",
      details: {
        planId,
        name: plan.name,
        tierKey: plan.tierKey,
        currency: plan.currency,
        priceMonthly: String(plan.priceMonthly),
        subscribersKept: plan.subscriptions.length,
        by,
        via: "scripts/retire-plan.mjs",
        ...(unretire
          ? { previouslyRetiredAt: plan.retiredAt?.toISOString() ?? null }
          : { retiredAt: now.toISOString() }),
      },
    },
  }),
]);

console.log(
  `\n${unretire ? "Un-retired" : "Retired"}: retiredAt=${updated.retiredAt ? updated.retiredAt.toISOString() : "null"}. ` +
    `Audit row written under ${admin.email} (by: ${by}). No subscription touched, nothing deleted.`,
);
await db.$disconnect();
