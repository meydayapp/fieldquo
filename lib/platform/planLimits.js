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

  const currentCount = await db.quote.count({
    where: { companyId, createdAt: { gte: startOfMonth } },
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
