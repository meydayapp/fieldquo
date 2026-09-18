// lib/onboarding.js
import { db } from "@/lib/db";
import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";
import { tradeIsPricedByDefault } from "@/app/data/tradePriceBooks";

// Deliberately generic — no cabinet/painting/electrical-specific steps. Every
// company, regardless of trade, needs: branding, real contact info, at least
// one priced service, a way to get paid.
//
// ══ Why "Invite your team" is not here ═════════════════════════════════════
//
// It was, until 2026-09-18. The owner: "the on-boarding steps have add
// employee. That should be moved to the additional steps as it can be marked
// as done without leaving the window." The distinction this card now keeps
// is exactly that one: every row here is a thing that needs its own page —
// uploading a logo, connecting Stripe, typing an address — and the card is a
// list of links. Adding an employee is a popup, done in place, so it belongs
// with the set-up steps (lib/setupSteps.js), whose card can host that popup
// and whose rule — removed when done, never ticked — fits a row that is
// finished the moment the popup closes. Same measurement (a second member or
// a pending invite), same "it's just me" claim honoured, one card fewer for
// it to be on.
//
// Two consequences, both intended. A company that was complete before is
// still complete: the step could only ever add a requirement, never remove
// one. And a company that was incomplete ONLY because of the team row is
// complete now — which is the owner's ask, not a regression.
export async function getOnboardingStatus(companyId) {
  const [company, enabledCategories, enabledCategoryRows] = await Promise.all([
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

  // `labelKey` + `label`: the key the client renders through t(), and the
  // English the step carries as its own fallback. The same shape as
  // lib/setupSteps.js's titleKey/title, and for the same reason: this runs on
  // the server with no reader's language in hand, so it cannot translate, and
  // the card used to print these sentences verbatim — English on every one of
  // the nine interfaces. The tax step below already worked this way (nameKey);
  // the rest now follow it. `label` stays as the fallback the card renders if
  // a key is ever missing, and scripts/check-onboarding-solo.mjs asserts on it.
  const steps = [
    {
      key: "logo",
      labelKey: "app.onboarding.step.logo",
      label: "Add your logo and brand color",
      done: !!company.logoUrl,
      href: "/app/settings/branding",
    },
    {
      key: "business_info",
      labelKey: "app.onboarding.step.business_info",
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
      labelKey: "app.onboarding.step.services",
      label: "Choose the services you offer",
      done: enabledCategories > 0,
      href: "/app/settings/services",
    },
    {
      key: "pricing",
      labelKey: "app.onboarding.step.pricing",
      label: "Set your pricing for at least one service",
      done: pricedCategoryCount > 0,
      href: "/app/settings/services",
    },
    {
      key: "payments",
      labelKey: "app.onboarding.step.payments",
      label: "Connect Stripe to accept client payments",
      done: !!company.stripeChargesEnabled,
      href: "/app/settings/payments",
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
      labelKey: "app.onboarding.step.tax_registration",
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

  // No plan name or seat figures any more. They were on the response for the
  // card's subtitle ("Crew — 3/5 licenses in use"), which explained the team
  // row's parenthetical; with that row on the other card, a licence count
  // beside "add your logo" was a fact about nothing on the list. The three
  // reads that produced it now run in lib/setupStepsSnapshot.js, beside the
  // step that uses them.
  return { steps, percent, complete };
}
