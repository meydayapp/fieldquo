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
    pendingInvites,
    subscription,
  ] = await Promise.all([
    db.company.findUnique({ where: { id: companyId } }),
    db.companyServiceCategory.count({ where: { companyId, enabled: true } }),
    db.companyServiceCategory.count({
      where: { companyId, enabled: true, defaultRate: { not: null } },
    }),
    db.member.count({ where: { companyId, active: true } }),
    // Invited-but-not-yet-accepted people. A Member row only appears when the
    // invitation is accepted, so counting members alone meant the card read
    // "1/20 licenses used" for as long as the invitee took to click the link —
    // and the owner who had just invited someone was told nothing had
    // happened. A pending invite holds a seat (that is what the seat check
    // charges for), so it counts as one here, exactly as it does on
    // GET /api/settings/members/pending. PendingTeamProfile rows are deleted
    // on acceptance by reconcilePendingProfiles, so nobody is counted twice.
    db.pendingTeamProfile.count({ where: { companyId } }),
    db.subscription.findUnique({
      where: { companyId },
      include: { plan: true },
    }),
  ]);

  if (!company) {
    throw new Error(`Company not found for ID ${companyId}`);
  }

  const seatLimit = subscription?.plan?.maxUsers ?? null;
  const seatsUsed = memberCount + pendingInvites;
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
      // Done once somebody other than the owner has been brought in. It used
      // to require seatsUsed >= seatLimit, i.e. every licence on the plan
      // spent: a 20-seat company had to invite nineteen people before the tick
      // appeared, so the step read as broken for everyone who invited one. The
      // step asks you to invite your team, not to fill the plan.
      done: seatsUsed > 1,
      // /app/team does not exist and never did — the link 404'd. The Team page
      // lives under settings.
      href: "/app/settings/team",
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
