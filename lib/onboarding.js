// lib/onboarding.js
import { db } from "@/lib/db";
import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";

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

  // ── Tax registration ─────────────────────────────────────────────────────
  //
  // The number already prints on every document (lib/documents/taxId.js) — but
  // until this step existed, nothing ever asked for it, so a contractor could
  // invoice for months before a client's bookkeeper told them the number was
  // missing. Where it matters most (Canada, UK, EU) the client cannot claim
  // the tax back without it.
  //
  // Two things keep this from becoming a nag:
  //
  //  - It disappears the moment a number is saved. `done` reads the same
  //    column the document renderer reads, so a tick here means the number is
  //    genuinely on the next invoice.
  //  - Or the company says it has no registration, via the "I don't have one"
  //    checkbox in Company Settings, and it drops off the list entirely rather
  //    than sitting there greyed out. A step nobody can finish is worse than
  //    no step; a step nobody can get rid of is the same bug wearing a hat.
  //
  // That answer lives in Company Settings, next to the field it is about,
  // rather than as a dismiss button on the onboarding card. The two are not
  // the same act: dismissing is "stop showing me this", while ticking the box
  // is a statement about the business — one that Company Settings is the place
  // to record, and one an owner can come back and change when they cross the
  // registration threshold. A card that could be waved away would also let
  // someone silence the ask without ever recording WHY.
  //
  // Available in every jurisdiction. A Canadian sole trader under the $30k
  // threshold genuinely has no GST number, and gating the answer on the
  // country would leave exactly those companies carrying an item they can
  // never tick — the smallest businesses, over a field that does not apply to
  // them.
  //
  // The label is a message KEY, not a sentence: "GST/HST number" and "VAT
  // number" are not translations of each other, they are different registers
  // in different countries, and the client picks the right one for the
  // company's country AND the reader's language.
  const taxReg = taxRegistrationFor(company.country);
  const taxRegDone = !!String(company.taxIdNumber ?? "").trim();
  const taxRegDismissed = !!company.taxRegistrationDismissedAt;

  // "I don't have one" is a fact about the business, not a preference about
  // the UI, so it is honoured everywhere — including where the number is
  // required, because "required IF registered" is what every one of those
  // rules actually says. Someone who is not registered has nothing to give.
  if (taxRegDone || !taxRegDismissed) {
    steps.push({
      key: "tax_registration",
      // English fallback only. The client renders app.onboarding.taxRegLabel
      // with the local name; this is what survives if it ever can't.
      label: "Add your tax registration number",
      done: taxRegDone,
      href: "/app/settings/company",
      nameKey: taxReg.nameKey,
      whyKey: taxReg.whyKey,
      // The answer is a checkbox in Company Settings, which is where the
      // step's href already points — so the card carries no dismiss control
      // of its own and cannot be silenced without recording why.
      dismissible: false,
    });
  }

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
