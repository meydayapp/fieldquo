// lib/onboarding.js
import { db } from "@/lib/db";

// Deliberately generic — no cabinet/painting/electrical-specific steps. Every
// company, regardless of trade, needs: branding, real contact info, at least
// one priced service, a way to get paid, and a team sized to what they're
// actually paying for.
export async function getOnboardingStatus(companyId) {
  const [
    company,
    enabledCategories,
    pricedCategories,
    memberCount,
    subscription,
  ] = await Promise.all([
    db.company.findUnique({ where: { id: companyId } }),
    db.companyServiceCategory.count({ where: { companyId, enabled: true } }),
    db.companyServiceCategory.count({
      where: { companyId, enabled: true, defaultRate: { not: null } },
    }),
    db.member.count({ where: { companyId, active: true } }),
    db.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    }),
  ]);

  if (!company) {
    throw new Error(`Company not found for ID ${companyId}`);
  }

  const seatLimit = subscription?.plan?.maxUsers ?? null;
  const seatsUsed = memberCount;
  const seatsRemaining = seatLimit ? Math.max(seatLimit - seatsUsed, 0) : null;

  const steps = [
    {
      key: "logo",
      label: "Add your logo and brand color",
      done: !!company.logoUrl,
      href: "/app/settings/branding",
    },
    {
      key: "business_info",
      label: "Complete your business address and phone",
      done: !!(
        company.phone &&
        company.address &&
        company.city &&
        company.province
      ),
      href: "/app/settings",
    },
    {
      key: "services",
      label: "Choose the services you offer",
      done: enabledCategories > 0,
      href: "/app/settings/services",
    },
    {
      key: "pricing",
      label: "Set your pricing for at least one service",
      done: pricedCategories > 0,
      href: "/app/settings/services",
    },
    {
      key: "payments",
      label: "Connect Stripe to accept client payments",
      done: !!company.stripeChargesEnabled,
      href: "/app/settings/payments",
    },
    {
      key: "team",
      label: seatLimit
        ? `Invite your team (${seatsUsed}/${seatLimit} licenses used)`
        : "Invite your team",
      done: seatLimit ? seatsUsed >= seatLimit : seatsUsed > 1,
      href: "/app/team",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  return {
    steps,
    percent,
    complete: doneCount === steps.length,
    plan: subscription?.plan
      ? { name: subscription.plan.name, maxUsers: subscription.plan.maxUsers }
      : null,
    seatsUsed,
    seatsRemaining,
  };
}
