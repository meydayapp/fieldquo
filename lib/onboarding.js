// lib/onboarding.js
import { db } from "@/lib/db";
import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";
import { tradeIsPricedByDefault } from "@/app/data/tradePriceBooks";

// Deliberately generic — no cabinet/painting/electrical-specific steps. Every
// company, regardless of trade, needs: branding, real contact info, at least
// one priced service, a way to get paid, and a team sized to what they're
// actually paying for.
export async function getOnboardingStatus(companyId) {
  const [
    company,
    enabledCategories,
    enabledCategoryRows,
    memberCount,
    pendingInvites,
    subscription,
  ] = await Promise.all([
    db.company.findUnique({ where: { id: companyId } }),
    db.companyServiceCategory.count({ where: { companyId, enabled: true } }),
    // "At least one priced service". Counting `defaultRate: { not: null }`
    // alone was never right and is now actively wrong: a trade with a price
    // book never sets that column — Settings > Services deliberately hides the
    // single-rate box next to a rate card — so a cabinet shop with a full rate
    // card was told it had no priced service and could not clear the step. The
    // same is true of trades that now ship an opening hourly rate.
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { defaultRate: true, category: { select: { key: true } } },
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

  // A service is priced if the company typed a rate for it, or if the trade
  // arrives priced — a rate card, or an opening hourly rate for a book-less
  // trade. Both are real prices a quote builds from.
  const pricedCategoryCount = enabledCategoryRows.filter(
    (row) =>
      row.defaultRate != null || tradeIsPricedByDefault(row.category?.key),
  ).length;

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
      done: pricedCategoryCount > 0,
      href: "/app/settings/services",
    },
    {
      key: "payments",
      label: "Connect Stripe to accept client payments",
      done: !!company.stripeChargesEnabled,
      href: "/app/settings/payments",
    },
  ];

  // ── "It's just me — no crew right now" ───────────────────────────────────
  //
  // A one-person shop could never finish onboarding. Not "rarely": the team
  // step is `seatsUsed > 1` and `complete` needs every step, so a van-run solo
  // contractor — a core FieldQuo customer — carried a permanent checklist on
  // their dashboard with one item on it they had no way to tick, short of
  // paying for a seat and inviting somebody who doesn't exist.
  //
  // The answer is the one the tax step already worked out below: when the
  // company says the step doesn't apply, it is NOT pushed at all. Not greyed
  // out, not auto-ticked. A step nobody can finish is worse than no step; a
  // step nobody can get rid of is the same bug wearing a hat.
  //
  // The statement lives in Team Settings, beside the roster it is about,
  // rather than as a dismiss button on the card — same division, same reason:
  // dismissing says "stop showing me this", ticking the box is a statement
  // about the business, and an owner can come back and untick it the day they
  // hire someone.
  //
  // `seatsUsed <= 1` is the honest expiry, and it is deliberately a FACT
  // beating a CLAIM rather than a write. The moment somebody is invited the
  // claim stops applying and the step comes back — already ticked, because by
  // then it is true. Clearing the column on invite was rejected twice over: it
  // destroys the record of when the owner said it, and the day that hire
  // leaves and seatsUsed is 1 again the owner would be back to an untickable
  // step, which is the bug this whole block exists to remove.
  const worksAlone = !!company.worksAloneAt && seatsUsed <= 1;

  if (!worksAlone) {
    steps.push({
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
    });
  }

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
  const complete = doneCount === steps.length;

  // ── The moment they finished, recorded once ──────────────────────────────
  //
  // Completeness is recomputed on every read and there is no event when it
  // flips, so "are they set up?" was answerable and "when did they finish?"
  // was not. The date is read by the platform console's company detail screen,
  // where support answers exactly that question.
  //
  // NOT a commission trigger, and deliberately so — docs/sales/PLAN.md §5 is
  // settled: milestone 1 pays on Stripe Connect activation alone, and
  // onboarding completeness must never be added to it. Recorded anyway because
  // a date that is only knowable at the instant it happens has to be captured
  // then or not at all; wiring it to a payout is a separate decision that has
  // already been taken the other way.
  //
  // This function runs on page loads, so the write has to be the exception:
  // the in-memory guard stops a no-op UPDATE on every dashboard render after
  // completion, and `updateMany` with `onboardingCompletedAt: null` in the
  // WHERE is what makes it safe when it does run. Two concurrent requests
  // become one UPDATE that matches a row and one that matches nothing —
  // Postgres decides, not a read-then-write in this process, which is exactly
  // the race a findUnique-then-update would lose.
  //
  // Never moved and never cleared afterwards. A company that completes setup
  // and later disconnects Stripe goes back to an incomplete checklist, but the
  // day they finished still happened; rewriting it because a step regressed
  // would make the milestone a function of today's state instead of a date.
  if (complete && !company.onboardingCompletedAt) {
    await db.company.updateMany({
      where: { id: companyId, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: new Date() },
    });
  }

  return {
    steps,
    percent,
    complete,
    plan: subscription?.plan
      ? { name: subscription.plan.name, maxUsers: subscription.plan.maxUsers }
      : null,
    seatsUsed,
    seatsRemaining,
  };
}
