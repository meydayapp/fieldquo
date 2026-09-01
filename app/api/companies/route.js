// app/api/companies/route.js
//
// The only change vs. what you already have: planId was being destructured
// from the request body and then never used anywhere. That's the root cause
// of "Account & Billing shows no active plan" — createTrialCheckoutSession
// never got told which plan to attach, so the checkout.session.completed
// webhook couldn't create a valid Subscription row afterward (planId is
// required on that model). Everything else in this file — company/member/
// org creation, service category setup — is unchanged.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createTrialCheckoutSession } from "@/lib/platform/stripeBilling";
import { TRIAL_PRICE } from "@/lib/pricing";
import { seedStandardAddOns } from "@/lib/products/seedStandardAddOns";
import { seedDefaultTemplates } from "@/lib/email/seedDefaultTemplates";
import { getAppOrigin, isInternalPath } from "@/lib/appUrl";
import { applySignupReferral, REFEREE_BONUS_MONTHS } from "@/lib/referrals";
import { redeemPromoCode } from "@/lib/platform/promoCodes";
import { isSupported, DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { currencyForCountry } from "@/lib/currency";
import { billingBasis } from "@/lib/signup/funnel";
import { chargeFor, isBillingInterval } from "@/lib/billing/interval";
<<<<<<< HEAD
import { containsMarkupCharacters } from "@/lib/security/rejectMarkupCharacters";
=======
import { recordError } from "@/lib/platform/errorLog";
>>>>>>> worktree-agent-a91823a0d44afa599

export async function POST(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── One business per login ───────────────────────────────────────────────
  //
  // This route used to create a second company for anybody with a session, and
  // /signup carried a banner explaining that carrying on would "set up an
  // additional business". The owner's ruling, twice: "i cannot sign up if i'm
  // already logged in."
  //
  // Gated here and not only on the screen, because hiding the form is not the
  // rule — somebody with the URL and a session would still have posted.
  //
  // The distinction that matters, and the reason this is a MEMBERSHIP check
  // rather than a session check: a session with NO membership is the abandoned
  // signup — an account created, the tab closed, the company never posted.
  // Refusing that would strand them permanently with no way to finish and no
  // way to start again. They are exactly who this route still has to serve.
  const existingMembership = await db.member.findFirst({
    where: { userId: session.user.id },
    select: { companyId: true, company: { select: { name: true } } },
  });
  if (existingMembership) {
    return NextResponse.json(
      {
        error:
          `You're already signed in to ${existingMembership.company?.name || "a business"} on FieldQuo. ` +
          `Sign out first if you're setting up a different business on a separate login.`,
        code: "already_has_company",
      },
      { status: 409 },
    );
  }

  const {
    name,
    phone,
    address,
    postalCode,
    country,
    city,
    province,
    industries,
    planId,
    serviceCategoryIds,
    // Carried through from /refer/<code> or ?ref=<code>. See lib/referrals.
    referralCode,
    // Where to send the user after checkout — set when signup began from a flow
    // like "add this quote to your project". Validated to an internal path below.
    next,
    // The company's chosen interface language (default for staff + fallback for
    // client documents). `country` is already destructured above and derives
    // the billing currency.
    language,
    // "month" (no commitment) or "year" (one year, billed annually). Absent on
    // any request from a page older than this one, which is the correct default
    // — monthly is what every existing subscription is on.
    billingInterval,
  } = await request.json();

  // The company's default language, validated to a supported code (else English).
  const defaultLanguage = isSupported(language) ? language : DEFAULT_LANGUAGE;

  // ── Where they are, read rather than defaulted ──────────────────────────
  //
  // This was `String(country || "CA").toUpperCase()`. Paired with the signup
  // form seeding `country: "CA"`, it meant a company that never stated a
  // country was made Canadian TWICE — and Company.country is not decoration:
  // it picks the billing currency and it is the jurisdiction every quote falls
  // back to when the client's own address can't answer (lib/tax/documentTax.js).
  //
  // billingBasis reads the column, then the formatted address, then the
  // province (lib/company/resolveCountry.js), and returns null rather than
  // guessing. Null is refused here instead of being padded, because the padding
  // is a price and a tax jurisdiction.
  const basis = billingBasis({ country, address, province });
  const homeCountry = basis.country;
  if (!homeCountry) {
    return NextResponse.json(
      {
        error:
          "We couldn't tell which country this business is in. Add the address " +
          "(or pick a country) — it's what sets your billing currency and your " +
          "default tax jurisdiction.",
      },
      { status: 400 },
    );
  }
  // The currency the COMPANY's own documents are in. Distinct from
  // basis.planCurrency, which is the one FieldQuo may bill THEM in: the seat
  // ladder exists in CAD and USD only, while a company can quote its own
  // clients in any of the currencies lib/currency.js lists.
  const currency = currencyForCountry(homeCountry);

  // ── The cadence, validated rather than coerced ──────────────────────────
  //
  // Refused rather than quietly read as "month": a body asking for something
  // this doesn't understand is a bug somewhere, and answering it with a
  // successful checkout on a different cadence is how a control comes to look
  // like it worked.
  if (billingInterval !== undefined && !isBillingInterval(billingInterval)) {
    return NextResponse.json(
      { error: "billingInterval must be \"month\" or \"year\"" },
      { status: 400 },
    );
  }
  const interval = billingInterval || "month";

  if (!name) {
    return NextResponse.json(
      { error: "Company name is required" },
      { status: 400 },
    );
  }
  // Signup is self-serve (non-negotiable #1), so this is the one company-name
  // write anyone on the internet can reach with no invite and no review.
  // `<`/`>` have no legitimate use in a business name; see
  // lib/security/rejectMarkupCharacters.js for why this is a second layer,
  // not the actual fix.
  if (containsMarkupCharacters(name)) {
    return NextResponse.json(
      { error: "Company name can't contain < or >" },
      { status: 400 },
    );
  }

  // ── There is no self-serve headcount price any more ─────────────────────
  //
  // This used to accept an `employeeCount` and mint a "Custom (N employees)"
  // Plan on the fly at $45/licence (calculatePricing + findOrCreateCustomPlan)
  // — the pricing model the owner retired 2026-08-31 in favour of the four-tier
  // seat ladder (lib/pricing/ladder.js: Solo/Crew/Shop/Scale). The ladder has
  // no function from a raw headcount to a tier, because a headcount alone
  // doesn't say how many of those people are billable seats versus free crew
  // (lib/pricing/ladder.js isBillableSeat) — that split isn't knowable from a
  // single number, so guessing it would be padding absent data with a default
  // (AGENTS.md). A real Plan row, chosen on the signup page, is required
  // instead. A company that needs more than Scale (10 seats + 15 crew) has no
  // self-serve price — see docs/PRICING-CLEANUP.md for that gap.
  if (!planId) {
    return NextResponse.json(
      { error: "planId is required" },
      { status: 400 },
    );
  }

  // Resolve a real Plan row before we ever create a Stripe checkout session,
  // since Subscription.planId is required and the webhook can't invent one
  // after the fact.
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    return NextResponse.json(
      { error: "Selected plan not found" },
      { status: 400 },
    );
  }

  // What createTrialCheckoutSession needs to know about money: the free first
  // month (always TRIAL_PRICE, never plan-specific) and, for the record kept
  // on the Stripe subscription's own metadata, how many people this plan is
  // for. The recurring charge itself comes straight off `plan` — see the note
  // on the line item in lib/platform/stripeBilling.js.
  const pricing = {
    trialTotal: TRIAL_PRICE,
    employeeCount: plan.maxUsers ?? plan.seats + (plan.crewSeats || 0),
  };
  // ── A tier from the other currency is not buyable here ──────────────────
  //
  // The browser posts an id, and the seat ladder exists once per currency with
  // the SAME NUMBER in each row. So a stale draft — or a hand-rolled body —
  // could hand us "Solo (CAD)" for a company in Texas, which is not a currency
  // choice, it is about 38% off. The signup page only ever offers the matching
  // set; this is the half that doesn't trust the page.
  //
  // Scoped to ladder rows on purpose. Legacy per-headcount plans and bespoke
  // "Custom (N employees)" rows carry the schema's default currency rather than
  // a chosen one, and refusing those would stop a US company buying Custom at
  // all — a break, not a guard.
  if (plan.tierKey && plan.currency !== basis.planCurrency) {
    return NextResponse.json(
      {
        error: basis.planCurrency
          ? "That plan is priced in a different currency from your business address."
          : `FieldQuo doesn't have plan pricing for ${homeCountry} yet — please contact us.`,
      },
      { status: 400 },
    );
  }

  // ── The cadence has to exist on the plan ────────────────────────────────
  //
  // Plan.priceAnnual is nullable and null MEANS "this tier has no annual
  // option" — every bespoke Custom row is created without one. Refused rather
  // than silently downgraded to monthly: the visitor pressed a button labelled
  // "1 year commitment", and charging them monthly instead is the failure this
  // whole guard exists for.
  const charge = chargeFor(plan, interval);
  if (!charge) {
    return NextResponse.json(
      {
        error:
          interval === "year"
            ? "That plan is billed monthly only — pick monthly, or choose a different plan."
            : "That plan has no usable price. Please contact us.",
      },
      { status: 400 },
    );
  }

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .concat(`-${Math.random().toString(36).slice(2, 6)}`);

  // ── Company + owner membership: one unit, or neither ────────────────────
  //
  // These two writes used to run as two separate `await`s. A failure between
  // them — a database blip, a Neon cold start — left a Company row with no
  // Member on it: not just unusable, but PERMANENTLY unusable, because the
  // "one business per login" guard above keys off Member, not Company. The
  // stranded row satisfies neither check: it's not a company this user can
  // reach, and it's not a company this user is blocked from creating another
  // one over, so a retry doesn't recover it — it silently mints a second
  // orphan next to the first. A transaction makes the pair atomic instead:
  // either both rows exist, or neither does and the request failed cleanly.
  const company = await db.$transaction(async (tx) => {
    const c = await tx.company.create({
      data: {
        name,
        slug,
        // The address the person REGISTERED with. Company.email was never set at
        // signup, so Company Details opened with an empty Email field for every
        // company ever created — and every client-facing document that falls back
        // to it had nothing to fall back to. The signed-in user's address is the
        // one they just proved they own, so it's the right default; they can change
        // it on Company Settings if the business uses a different inbox.
        email: session.user.email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        province: province || null,
        postalCode: postalCode || null,
        country: homeCountry,
        defaultLanguage,
        currency,
        industries: Array.isArray(industries) ? industries : [],
        onboardingStatus: "pending",
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.member.create({
      data: { userId: session.user.id, companyId: c.id, role: "owner" },
    });

    return c;
  });

  // The code the signup carried is EITHER a platform promo code (influencer /
  // tester — "FQ-XXXX", extra free months, no referrer) OR a company referral
  // code. Try promo first: if it resolves as a promo (redeemable or not), it was
  // a promo attempt and we don't also treat it as a referral. Only a null result
  // (not a promo code at all) falls through to the referral path. Both are
  // best-effort — a bad code must never block a signup.
  const promo = await redeemPromoCode({ company, code: referralCode }).catch(() => null);
  const referral =
    promo === null
      ? await applySignupReferral({ company, code: referralCode })
      : null;

  // ── The org: external, and cannot join the transaction above ────────────
  //
  // Better Auth generates its OWN id for the organization — it is NOT the same
  // as company.id, even though we pass company.id in as the slug. We capture
  // org.id here and store it on Company.authOrgId so getCurrentMember() can
  // translate session.activeOrganizationId -> the right Company row.
  //
  // This is an external system (a different library, plausibly its own
  // tables), so it genuinely cannot be enlisted in the db.$transaction above
  // the way Stripe can't either — that part of the "no transaction" finding
  // is real and stays true. What changes: if IT fails, the Company + Member
  // just committed are rolled back by hand rather than left as an orphan the
  // "one business per login" guard would then block the user from ever
  // retrying past. This is a request-scoped compensating delete of rows THIS
  // request created seconds ago, not a mutation of existing customer data —
  // the same idea as settleBookingFee.js deleting the Appointment it
  // optimistically created when it loses a race.
  let org;
  try {
    org = await auth.api.createOrganization({
      body: { name, slug: company.id },
      headers: request.headers,
    });
  } catch (err) {
    await db.member.deleteMany({ where: { companyId: company.id } }).catch(() => {});
    await db.company.delete({ where: { id: company.id } }).catch(() => {});
    await recordError({
      area: "signup",
      code: "create_organization",
      message: `Better Auth org creation failed during signup: ${err?.message}`,
      detail: { companyId: company.id, userId: session.user.id },
    });
    return NextResponse.json(
      { error: "Couldn't finish setting up your account. Please try again." },
      { status: 500 },
    );
  }

  await db.company.update({
    where: { id: company.id },
    data: { authOrgId: org.id },
  });

  // Without this, activeOrganizationId stays null on the session, and every
  // company-scoped API route 401s regardless of how correct everything else
  // is. Company + Member + org are all genuinely valid at this point though —
  // unlike the createOrganization failure above, there is nothing here to
  // roll back, only a session pointer that didn't get set. Logged rather
  // than left silent, and NOT fatal: the owner is a real member of a real,
  // fully-formed company and can still sign in and pick up from there.
  try {
    await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      headers: request.headers,
    });
  } catch (err) {
    await recordError({
      area: "signup",
      code: "set_active_organization",
      message: `setActiveOrganization failed during signup: ${err?.message}`,
      companyId: company.id,
      detail: { orgId: org.id, userId: session.user.id },
    });
  }

  if (Array.isArray(serviceCategoryIds) && serviceCategoryIds.length > 0) {
    await db.companyServiceCategory.createMany({
      data: serviceCategoryIds.map((categoryId) => ({
        companyId: company.id,
        categoryId,
        enabled: true,
      })),
    });

    // Seed standard add-on products for any selected category that has a
    // starter set (e.g. cabinet refinishing → New Handles, Soft-Close Hinges,
    // Two-Tone, Glass Inserts). Best-effort: a seeding hiccup must never block
    // signup/checkout, so failures are logged, not thrown.
    try {
      const selected = await db.serviceCategory.findMany({
        where: { id: { in: serviceCategoryIds } },
        select: { id: true, key: true },
      });
      for (const cat of selected) {
        await seedStandardAddOns({
          companyId: company.id,
          categoryId: cat.id,
          categoryKey: cat.key,
        });
      }
    } catch (err) {
      console.error("[companies POST] standard add-on seeding failed", err);
    }
  }

  // Every company gets one Active starter template per automated email type
  // (quote/instructions/receipt/follow-up) — not tied to which service
  // categories were picked, so this runs unconditionally. Same best-effort
  // rule as above: never block signup over a seeding hiccup.
  try {
    await seedDefaultTemplates(company.id);
  } catch (err) {
    console.error("[companies POST] default template seeding failed", err);
  }

  const baseUrl = getAppOrigin(request);

  // Trial length Stripe should honour = however long this company is actually
  // free for. applySignupReferral may have just extended trialEndsAt by
  // REFEREE_BONUS_MONTHS; `company` in memory still holds the base 30-day date,
  // so read the referral's returned value when present. This is what makes a
  // referred signup's FIRST Stripe trial the full 30 days + referral, not 30
  // with the extra time stranded in a column Stripe never sees.
  // Whichever path extended the trial (referral or a promo code) is the real
  // free-until date Stripe should honour.
  const effectiveTrialEnd =
    referral?.trialEndsAt || (promo?.ok && promo.trialEndsAt) || company.trialEndsAt;
  const trialDays = Math.max(
    1,
    Math.ceil((effectiveTrialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );

  // ── The last step is deliberately the external, hard-to-undo one ────────
  //
  // Company, Member and org are all fully committed by now — reversible,
  // local state that a transaction and a compensating delete above already
  // protect. A Stripe Checkout session is the opposite: it's a real object
  // on a third party's server, not something to roll back if a LATER step
  // fails, so it stays exactly where the original code already put it —
  // last. If creating it fails, nothing above needs undoing: the owner is a
  // real member of a real company and Account & Billing's own "Choose plan"
  // button (see cancelUrl below) starts checkout again from there. That
  // existing recovery path is why this can be a friendly message instead of
  // a raw 500 with no way forward.
  let checkoutSession;
  try {
    checkoutSession = await createTrialCheckoutSession({
      company,
      pricing,
      // The ROW, not just its id. The recurring line is built from the plan's own
      // price now — see lib/platform/stripeBilling.js for why the old
      // calculatePricing() line was charging a seat-ladder signup a different
      // number from the one on the card they clicked.
      plan,
      interval,
      trialDays,
      // {CHECKOUT_SESSION_ID} is a literal Stripe template placeholder — Stripe
      // substitutes it with the real session id before redirecting the
      // browser. /app reads it and calls /api/platform/billing/reconcile-session
      // so the Subscription row exists immediately even if the
      // checkout.session.completed webhook is delayed or never arrives.
      // Carry a validated internal `next` through checkout so /app can bounce the
      // new contractor back to where they started (e.g. the received quote).
      // Internal-path only — never an absolute URL — so this can't become an open
      // redirect through the signup flow.
      successUrl: `${baseUrl}/app?welcome=true&session_id={CHECKOUT_SESSION_ID}${
        isInternalPath(next) ? `&next=${encodeURIComponent(next)}` : ""
      }`,
      // Back to BILLING, not back to /signup. By the time Stripe can cancel,
      // everything above has already run — the company, the membership and the
      // org all exist — so /signup is the one page that can't help: it would
      // greet them as a signed-in owner and offer to set up an *additional*
      // business, which is how you end up with two companies and one contractor.
      // Account & Billing is where the same plans are listed and where "Choose
      // plan" starts checkout again.
      cancelUrl: `${baseUrl}/app/settings/account-billing`,
    });
  } catch (err) {
    await recordError({
      area: "signup",
      code: "create_trial_checkout_session",
      message: `Trial checkout session creation failed after signup completed: ${err?.message}`,
      companyId: company.id,
      detail: { userId: session.user.id, planId },
    });
    return NextResponse.json(
      {
        error:
          "Your account was created, but we couldn't start checkout. Go to Account & Billing in the app to choose your plan and finish.",
        code: "checkout_failed",
        recoverable: true,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    checkoutUrl: checkoutSession.url,
    // Null unless a referral was actually redeemed, so the client can show
    // "a free month from Sunset Inc" rather than guessing from the code it
    // sent — which may have been rejected as self-referral or unknown.
    //
    // months comes from the constant that actually granted them. It was
    // hardcoded to 3 while lib/referrals granted 1, so the confirmation
    // promised three times what the trial had been extended by.
    referral: referral
      ? {
          referrerName: referral.referrer.name,
          trialEndsAt: referral.trialEndsAt,
          months: REFEREE_BONUS_MONTHS,
        }
      : null,
  });
}
