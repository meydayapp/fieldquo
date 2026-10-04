// lib/platform/planLimits.js
import { db } from "@/lib/db";

export async function getCompanyPlan(companyId) {
  const subscription = await db.subscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });

  // No subscription = treat as unlimited-free during early access / manually created companies.
  // Tighten this once self-serve billing is actually live.
  return subscription?.plan || null;
}

export async function checkUserLimit(companyId) {
  const plan = await getCompanyPlan(companyId);
  if (!plan?.maxUsers) return { allowed: true };

  const currentCount = await db.member.count({
    where: { companyId, active: true },
  });

  return {
    allowed: currentCount < plan.maxUsers,
    currentCount,
    limit: plan.maxUsers,
  };
}

export async function checkQuoteLimit(companyId) {
  const plan = await getCompanyPlan(companyId);
  if (!plan?.maxQuotesPerMonth) return { allowed: true };

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Imported past jobs are not this month's quoting. The Past jobs screen
  // creates a quote row per job it records, today — so on a plan with a
  // monthly cap, a company that typed in last year's forty jobs had used the
  // month's allowance before writing a single real quote, and New quote and
  // Duplicate answered 402.
  const currentCount = await db.quote.count({
    where: { companyId, historicalImportedAt: null, createdAt: { gte: startOfMonth } },
  });

  return {
    allowed: currentCount < plan.maxQuotesPerMonth,
    currentCount,
    limit: plan.maxQuotesPerMonth,
  };
}

export async function requireWithinLimit(companyId, type) {
  const check =
    type === "users"
      ? await checkUserLimit(companyId)
      : await checkQuoteLimit(companyId);

  if (!check.allowed) {
    const err = new Error(
      `Plan limit reached: ${check.currentCount}/${check.limit} ${type}. Upgrade to continue.`,
    );
    err.status = 402; // Payment Required
    throw err;
  }
}
