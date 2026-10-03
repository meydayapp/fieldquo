// lib/referrals/index.js
//
// FieldQuo's own referral programme: one contractor telling another about the
// product. Both sides now get the same thing: another month of FieldQuo. The
// newcomer gets REFEREE_BONUS_MONTHS when IT chooses a plan — its first
// charge moves a month later; the referrer gets REFERRER_BONUS_MONTHS added to
// their own access once the referred company actually pays.
//
// ══ Only once the referrer has chosen a plan (the owner, 2026-10-03) ══════
//
// "The referral plan we have for companies should only work when they have
// selected a plan. Not before." So, on every referral made from that day:
//
//   * A company on the free trial with no plan chosen cannot refer: no link
//     on Settings → Refer & Earn, no invites, nothing earned. The page says
//     why and links to Choose plan (app/app/settings/refer/page.js).
//   * The newcomer's month is no longer added to the trial at signup. It is
//     granted when the newcomer chooses a plan (grantRefereeBonus), through
//     extendAccessByMonths — the same trial_end deferral the referrer's month
//     uses, so there is one way to give a month, not two.
//   * Both grants re-check, from the database, at the moment of the grant,
//     that the REFERRER has a plan (hasSelectedPlan). A link a trial company
//     shared before this rule still works for signing up; the referrer's month
//     is held until the referrer chooses a plan and granted then, once
//     (grantHeldReferrerRewards) — never for a plan-less referrer at the
//     moment the newcomer pays.
//
// ══ Grandfathering, and what marks it ══════════════════════════════════════
//
// Company.referralTerms. Every referral made by this code is stamped
// REFERRAL_TERMS_PLAN_REQUIRED at signup; every referral made before carries
// NULL, and NULL means the terms of the day it was made:
//
//   * its newcomer already HAD the month, on the trial, at signup — that row
//     and that trial end are never touched, and no second month is granted at
//     plan selection (the claim row below is the second lock);
//   * its referrer is paid on the newcomer's first payment, plan or no plan,
//     exactly as before.
//
// Rewards already granted are rows, and nothing here updates or deletes a row
// it did not create in the same call.
//
// It was NOT always the same, and this header said the old thing long after it
// stopped being true. The referrer used to get a dollar credit worth one month
// of the REFERRED company's plan — see the reasoning at grantReferrerCredit,
// which changed it because a Scale referrer who introduced a Solo company got
// $129 against a $389 bill: a third of a month, described as a month.
//
// The cost of leaving this paragraph stale was not confusion here. The
// marketing copy went on promising "the bigger the team you refer, the bigger
// your credit" in nine languages, because the file that owns the policy agreed
// with the marketing rather than with the function three hundred lines below.
//
// All the policy lives here rather than in route handlers, because the rules
// are the kind that get quietly violated when they're spread out:
//
//   * A company that already exists can REFER but never REDEEM. The offer is
//     for acquiring new customers; letting existing ones redeem is just a
//     discount on revenue you already had.
//   * You cannot refer yourself. Checked on the code, not on the email,
//     because the email is trivially varied.
//   * The new company's bonus month lands when it chooses a plan. It used to
//     land at signup, on the trial; since 2026-10-03 it is the first paid
//     period that moves, so it is worth something only to a company that
//     commits — and a trial-only signup costs FieldQuo nothing either way.
//   * The referrer's credit lands on the referred company's FIRST PAYMENT.
//     Granting on signup makes this a fraud target: twenty throwaway addresses
//     would earn a couple of free years.
//   * Every grant is a row, and grants are idempotent. A retried webhook or a
//     double-clicked button must not pay twice.

import { db } from "@/lib/db";
import { extendAccessByMonths, hasSelectedPlan } from "@/lib/referrals/extendAccess";
import { stripe } from "@/lib/stripe";
import { captureAttributionWithin, INFLUENCER_SOURCE } from "@/lib/sales/attribution";

export { hasSelectedPlan };

// The NEW company (referee) gets this many free months for signing up through
// a referral link — applied when it chooses a plan, as a deferral of its first
// charge (grantRefereeBonus). This comment used to say the referrer's reward
// was a dollar credit; it has been a month since 2026-08-27 (see
// REFERRER_BONUS_MONTHS and grantReferrerCredit).
export const REFEREE_BONUS_MONTHS = 1;

/**
 * The value stamped on Company.referralTerms for a referral made under the
 * owner's 2026-10-03 rule. NULL on the column is the grandfathered case —
 * see the header.
 */
export const REFERRAL_TERMS_PLAN_REQUIRED = "plan_required";

/** Was this referral made under the plan-required terms? */
export function isPlanRequiredReferral(company) {
  return company?.referralTerms === REFERRAL_TERMS_PLAN_REQUIRED;
}

/**
 * Has `companyId` selected a plan, read fresh from the database? The one
 * question every grant and every gate in this module asks about a REFERRER,
 * asked at the moment it matters and never trusted from an earlier request.
 */
export async function companyHasSelectedPlan(companyId, client = db) {
  if (!companyId) return false;
  const sub = await client.subscription.findUnique({
    where: { companyId },
    select: { stripeSubscriptionId: true, status: true },
  });
  return hasSelectedPlan(sub);
}

// Prisma's unique-constraint refusal. The ReferralCredit
// @@unique([companyId, role, counterpartyCompanyId]) is the lock that makes a
// grant happen once: the row is CLAIMED before the month is given, so two
// deliveries racing each other — the webhook and the on-return reconcile land
// on the same checkout within a second — cannot both get past a read.
const isUniqueViolation = (err) => err?.code === "P2002";

/**
 * Claim the grant row, give the month, and record what the month became.
 *
 * Claim-first is the whole point. The previous order — read, extend, write —
 * let two concurrent callers both read "no row", both extend Stripe, and only
 * then have one INSERT refused: a month given twice with one row to show for
 * it. Here the INSERT is the gate, and only the caller that won it reaches
 * Stripe.
 *
 * A row whose appliedTrialEndsAt stays null is a reward owed and visibly
 * unpaid — the state the referrer-side comment below has always asked for.
 *
 * @returns {Promise<null | { credit, grant }>} null when the row already existed
 */
async function claimAndExtend({ companyId, counterpartyCompanyId, role, months }) {
  let credit;
  try {
    credit = await db.referralCredit.create({
      data: { companyId, counterpartyCompanyId, role, months, appliedTrialEndsAt: null },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
  const grant = await extendAccessByMonths(companyId, months);
  await db.referralCredit.update({
    where: { id: credit.id },
    data: { appliedTrialEndsAt: grant.ok ? grant.until : null },
  });
  if (!grant.ok) {
    console.error(
      `[referrals] ${role} credit ${credit.id} recorded but access was NOT extended:`,
      grant.reason,
    );
  }
  return { credit, grant };
}

/**
 * What the REFERRER gets. Deliberately the same as the referee's.
 *
 * AGENTS.md said three months for each side. The owner overrode it to one,
 * explicitly, and that file has been corrected — a non-negotiable that
 * contradicts the code is worse than either version of it, because the next
 * reader cannot tell which one is the decision.
 */
export const REFERRER_BONUS_MONTHS = 1;

// Max qualified referrals a company can earn credit for in one calendar month.
// A count cap (anti-abuse), NOT a dollar cap — a dollar cap would silently
// strand earned credit.
export const MONTHLY_REFERRAL_CAP = 50;

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Generates a shareable code from the company name — /refer/sunsetinc. */
export function referralCodeFor(name) {
  const base = (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  return base || `fq${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The company's referral code, minting one if it has none.
 *
 * Plain company name, no random suffix: this becomes /refer/sunsetinc, which
 * gets read aloud, typed off a business card and printed on a van. A suffix
 * like "sunsetinc-k3f9a" is unshareable in exactly those situations.
 * Collisions fall back to a suffix in the retry loop.
 *
 * Lived in app/api/settings/referral/route.js until the influencer programme
 * needed to mint the code at enrolment rather than on first visit to the
 * Refer page. `client` lets an enrolment mint inside its own transaction; the
 * pre-check before each write is what makes that safe, because a refused
 * INSERT inside a Postgres transaction aborts everything before it.
 */
export async function ensureReferralCode(company, client = db) {
  if (company.referralCode) return company.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const base = referralCodeFor(company.name);
    const code = attempt === 0 ? base : `${base}${Math.random().toString(36).slice(2, 5)}`;
    const taken = await client.company.findFirst({
      where: { referralCode: { equals: code, mode: "insensitive" } },
      select: { id: true },
    });
    if (taken) continue;
    const updated = await client.company.update({
      where: { id: company.id },
      data: { referralCode: code },
      select: { referralCode: true },
    });
    return updated.referralCode;
  }
  throw new Error("Could not generate a unique referral code");
}

/**
 * Is the referrer an influencer — a company whose link earns a sales
 * commission rather than a month? Both columns, the same test
 * lib/influencers/index.js's isInfluencer() makes; restated here rather
 * than imported because that module imports this one.
 */
function referrerIsInfluencer(referrer) {
  return Boolean(referrer?.influencerAt && referrer?.influencerRepId);
}

/**
 * Resolves a referral code to the company that owns it.
 * Case-insensitive — people retype these off business cards.
 */
export async function findReferrer(code) {
  if (!code) return null;
  const normalized = String(code).trim().toLowerCase();
  if (!normalized) return null;

  return db.company.findFirst({
    where: { referralCode: { equals: normalized, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      brandColor: true,
      referralCode: true,
      onboardingStatus: true,
      // Whether this link pays a commission instead of a month — see the
      // influencer branches in applySignupReferral and grantReferrerCredit.
      influencerAt: true,
      influencerRepId: true,
    },
  });
}

/**
 * Can this signup redeem `code`?
 *
 * Separate from the granting call so the landing page and the signup form can
 * both ask without side effects — someone should be told "this link has
 * already been used" on the page, not after they've filled in a form.
 */
export async function checkRedeemable(code, { existingCompanyId } = {}) {
  const referrer = await findReferrer(code);
  if (!referrer) {
    return { ok: false, reason: "unknown_code", message: "That referral link isn't valid." };
  }

  if (existingCompanyId) {
    if (existingCompanyId === referrer.id) {
      return {
        ok: false,
        referrer,
        reason: "self_referral",
        message: "You can't refer yourself.",
      };
    }
    return {
      ok: false,
      referrer,
      reason: "existing_company",
      message:
        "Referral offers are for businesses new to FieldQuo. You can still send your own link to others.",
    };
  }

  // A suspended or churned referrer shouldn't be recruiting on the platform's
  // behalf, and shouldn't accrue credit against an account that's leaving.
  if (referrer.onboardingStatus === "churned") {
    return {
      ok: false,
      referrer,
      reason: "inactive_referrer",
      message: "That referral link is no longer active.",
    };
  }

  return { ok: true, referrer };
}

/**
 * Records who sent the new company, under the plan-required terms.
 *
 * Call at signup, AFTER the company row exists. Returns null when the code
 * doesn't qualify — a bad referral code must never block a signup, so every
 * failure path here is silent to the user and loud in the logs.
 *
 * ── It grants nothing any more ───────────────────────────────────────────
 *
 * This used to push trialEndsAt out by REFEREE_BONUS_MONTHS and write the
 * "referred" ReferralCredit row, here, at signup. Since 2026-10-03 the month
 * lands when the newcomer chooses a plan (grantRefereeBonus), so what signup
 * records is the RELATIONSHIP — referredByCode, referredAt, and the terms it
 * was made under — and the trial is the ordinary TRIAL_DAYS one. A trial
 * that ends unpaid was never meant to carry the month.
 *
 * A trial referrer's link (one shared before the rule) still signs a
 * newcomer up: the link is not refused, because refusing it would punish the
 * person who clicked it for something the sender did. What the referrer is
 * owed waits for the referrer's plan — see grantReferrerCredit.
 *
 * `bonusMonths` in the answer is what the newcomer will be given when it
 * chooses a plan IF the referrer still has one then: REFEREE_BONUS_MONTHS
 * when the referrer has a plan today, 0 when it does not. It is what the
 * signup page may promise; the grant re-checks.
 */
export async function applySignupReferral({ company, code }) {
  if (!code) return null;

  try {
    const check = await checkRedeemable(code);
    if (!check.ok) {
      console.warn(
        `[referrals] signup ${company.id} could not redeem "${code}": ${check.reason}`,
      );
      return null;
    }

    const referrer = check.referrer;
    if (referrer.id === company.id) return null;

    const referrerHasPlan = await companyHasSelectedPlan(referrer.id);

    // ── The influencer branch ────────────────────────────────────────────
    //
    // When the referrer is an influencer, the referrer's side is a
    // SalesAttribution on their ledger row instead of a month later. Written
    // in the same transaction as the referral itself, through the same
    // captureAttributionWithin() a rep's signup link uses: self-dealing, an
    // inactive ledger and an already-attributed company are refused by the
    // same decision, and nothing here invents a rule. The verdict is returned
    // so the signup route can log a miss the way it logs one for a rep's code.
    //
    // The attribution is NOT gated on the influencer having a plan: it is
    // FieldQuo's commission contract with them, not the Refer & Earn month.
    // The newcomer's month on an influencer's link follows the same rule as
    // any other link — it lands at plan selection, if the influencer has a
    // plan then.
    let attribution = null;
    await db.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: company.id },
        data: {
          referredByCode: referrer.referralCode,
          referredAt: new Date(),
          referralTerms: REFERRAL_TERMS_PLAN_REQUIRED,
        },
      });
      if (referrerIsInfluencer(referrer)) {
        attribution = await captureAttributionWithin(tx, {
          companyId: company.id,
          salesRepId: referrer.influencerRepId,
          source: INFLUENCER_SOURCE,
        });
      }
    });

    // Best-effort: mark a matching invite redeemed so the sender's list shows
    // it. Matching on contact details is deliberately loose — a forwarded link
    // should still count, so a miss here doesn't affect the credit.
    await markInviteRedeemed(referrer.id, company).catch(() => {});

    return {
      referrer,
      referrerHasPlan,
      bonusMonths: referrerHasPlan ? REFEREE_BONUS_MONTHS : 0,
      attribution,
    };
  } catch (err) {
    // A referral is a bonus. It must never be the reason a signup fails.
    console.error("[referrals] applySignupReferral failed:", err);
    return null;
  }
}

/**
 * The newcomer's month, granted when it chooses a plan.
 *
 * Called from every place a company's plan selection is recorded —
 * upsertSubscriptionFromCheckoutSession (the checkout webhook and the
 * on-return reconcile) and the "Check with Stripe" customer sync — through
 * onPlanSelected below. Idempotent: the claim row is the lock, so a webhook
 * replay, a reconcile racing it, or a later plan change finds the row and
 * grants nothing.
 *
 * Every condition is read fresh here, never carried from signup:
 *   - the company was referred under the plan-required terms (a grandfathered
 *     newcomer already had its month on the trial, at signup);
 *   - it has selected a plan now;
 *   - the code still resolves to a company other than itself;
 *   - that REFERRER has selected a plan now.
 *
 * The month itself is extendAccessByMonths — on a subscription Stripe still
 * has in trial, the trial_end moves from the end of the trial to a month
 * later, so the first charge moves with it. The worked example is in
 * scripts/check-referral-reward.mjs.
 *
 * Never throws: a referral month must not be why a plan purchase fails to
 * record. Answers null whenever nothing was granted.
 */
export async function grantRefereeBonus(companyId) {
  try {
    if (!companyId) return null;
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, referredByCode: true, referralTerms: true },
    });
    if (!company?.referredByCode) return null;
    if (!isPlanRequiredReferral(company)) return null; // grandfathered: had it at signup
    if (!(await companyHasSelectedPlan(company.id))) return null;

    const referrer = await findReferrer(company.referredByCode);
    if (!referrer || referrer.id === company.id) return null;
    if (!(await companyHasSelectedPlan(referrer.id))) {
      console.warn(
        `[referrals] ${company.id} chose a plan, but its referrer ${referrer.id} has none — no referee month`,
      );
      return null;
    }

    const claimed = await claimAndExtend({
      companyId: company.id,
      counterpartyCompanyId: referrer.id,
      role: "referred",
      months: REFEREE_BONUS_MONTHS,
    });
    if (!claimed) return null;
    return {
      companyId: company.id,
      referrerId: referrer.id,
      months: REFEREE_BONUS_MONTHS,
      until: claimed.grant.ok ? claimed.grant.until : null,
    };
  } catch (err) {
    console.error("[referrals] grantRefereeBonus failed:", err);
    return null;
  }
}

async function markInviteRedeemed(referrerCompanyId, company) {
  const owner = await db.member.findFirst({
    where: { companyId: company.id, role: "owner" },
    include: { user: { select: { email: true } } },
  });
  const email = owner?.user?.email;
  if (!email) return;

  const invite = await db.referralInvite.findFirst({
    where: {
      companyId: referrerCompanyId,
      status: "sent",
      email: { equals: email, mode: "insensitive" },
    },
  });
  if (!invite) return;

  await db.referralInvite.update({
    where: { id: invite.id },
    data: {
      status: "redeemed",
      redeemedByCompanyId: company.id,
      redeemedAt: new Date(),
    },
  });
}

/**
 * Applies a referrer credit to their Stripe customer balance. A negative
 * balance transaction is money OFF what they owe (their next invoice pays down
 * against it, and any remainder rolls forward). Stamps stripeBalanceTxnId so the
 * credit is marked applied. If the referrer has no Stripe customer yet (still on
 * trial, never billed), it stays unapplied and applyPendingReferralCredits picks
 * it up when they start paying.
 */
async function applyCreditToBalance(creditId, referrerId, creditCents, currency) {
  const sub = await db.subscription.findFirst({
    where: { companyId: referrerId },
    select: { stripeCustomerId: true },
  });
  const customerId = sub?.stripeCustomerId;
  if (!customerId) return false; // no customer to credit yet — swept in later

  const txn = await stripe.customers.createBalanceTransaction(customerId, {
    amount: -Math.abs(Math.round(creditCents)), // negative = credit
    currency: (currency || "usd").toLowerCase(),
    description: "FieldQuo referral credit",
  });
  await db.referralCredit.update({
    where: { id: creditId },
    data: { stripeBalanceTxnId: txn.id },
  });
  return true;
}

/**
 * Grants the REFERRER REFERRER_BONUS_MONTHS of FieldQuo — their next charge
 * moved a month out (extendAccessByMonths) — once the referred company is a
 * verified paying customer. (This said "a dollar account credit" for a month
 * after the reward stopped being one.)
 *
 * Called from the Stripe billing webhook on every paid invoice, and from
 * grantHeldReferrerRewards when a referrer chooses a plan (idempotent via the
 * unique constraint). Requirements, all of which stop throwaway-company fraud:
 *   - real money changed hands (paidAmountCents > 0 — a $0 trial invoice earns
 *     nothing),
 *   - the referred company completed onboarding (onboardingStatus "active"), and
 *   - its Stripe Connect account is verified (stripeChargesEnabled) — proving a
 *     real business with a real payout account, not a burner signup.
 * A company that pays before finishing Connect just earns its referrer the
 * credit on the next paid invoice once verified.
 *
 * And, for a referral made under the 2026-10-03 terms, the REFERRER has
 * selected a plan at the moment of the grant.
 *
 * Capped at MONTHLY_REFERRAL_CAP qualified referrals per referrer per month.
 */
export async function grantReferrerCredit({ paidCompanyId, paidAmountCents, currency }) {
  try {
    // Real money only — the whole anti-fraud premise is that a charge cleared.
    if (!(Number(paidAmountCents) > 0)) return null;

    const company = await db.company.findUnique({
      where: { id: paidCompanyId },
      select: {
        id: true,
        name: true,
        referredByCode: true,
        referralTerms: true,
        onboardingStatus: true,
        stripeChargesEnabled: true,
      },
    });
    if (!company?.referredByCode) return null;

    // Verified real business, or no reward yet.
    if (company.onboardingStatus !== "active" || !company.stripeChargesEnabled) {
      return null;
    }

    const referrer = await findReferrer(company.referredByCode);
    if (!referrer || referrer.id === company.id) return null;

    // An influencer's reward is the commission on their ledger, written as a
    // SalesAttribution at signup and paid by lib/sales/commission.js. It is
    // refused HERE as well as branched there, so no order of events — a
    // company enrolled between the signup and the first invoice included —
    // can earn one link both a month and a commission.
    if (referrerIsInfluencer(referrer)) return null;

    // ── The referrer must have chosen a plan (the owner, 2026-10-03) ──────
    //
    // Read now, from the database, at the moment of the grant. A referrer
    // still on the free trial earns nothing HERE — not a trial extension,
    // not a row. The reward is HELD, not lost: when the referrer chooses a
    // plan, grantHeldReferrerRewards re-runs this function for every company
    // they referred that has since paid, and this check then passes. Never
    // granted twice: the claim row below is the lock either way.
    //
    // A grandfathered referral (referralTerms NULL — made before the rule)
    // is paid on the terms of its day: on the first payment, plan or no plan.
    if (isPlanRequiredReferral(company) && !(await companyHasSelectedPlan(referrer.id))) {
      console.warn(
        `[referrals] ${company.id} paid, but its referrer ${referrer.id} has no plan — reward held until it chooses one`,
      );
      return null;
    }

    // Idempotent: one credit per (referrer, referred). A cheap read first;
    // the claim INSERT in claimAndExtend is what actually holds under a race.
    const already = await db.referralCredit.findUnique({
      where: {
        companyId_role_counterpartyCompanyId: {
          companyId: referrer.id,
          role: "referrer",
          counterpartyCompanyId: company.id,
        },
      },
    });
    if (already) return null;

    // 50 qualified referrals per referrer per calendar month.
    const thisMonth = await db.referralCredit.count({
      where: {
        companyId: referrer.id,
        role: "referrer",
        createdAt: { gte: startOfMonth(new Date()) },
      },
    });
    if (thisMonth >= MONTHLY_REFERRAL_CAP) {
      console.warn(
        `[referrals] ${referrer.id} hit the ${MONTHLY_REFERRAL_CAP}/month cap`,
      );
      return null;
    }

    // ── A month of the product, not a dollar figure ──────────────────────
    //
    // This granted a Stripe balance credit equal to what the referred company
    // had just paid. That is only "a free month" while both are on the same
    // tier: a Scale referrer who introduces a Solo company was getting $129
    // against a $389 bill — a third of a month, described as a month.
    //
    // The reward is now the same thing the referee gets, so both sides of the
    // programme mean one sentence: another month of FieldQuo. The owner set the
    // amount at one month for both, overriding the three in AGENTS.md, which
    // has been corrected rather than left to contradict the code.
    //
    // Recorded whether or not the extension lands — claimAndExtend writes the
    // row FIRST, then extends, then records the date. The row is the audit
    // trail and the idempotency key — losing it because Stripe was briefly
    // unhappy would let the same referral pay out twice on the next invoice. A
    // row with no appliedTrialEndsAt is a reward owed and visibly unpaid, which
    // is a state somebody can find; a missing row is not.
    //
    // creditCents/currency stay null on new rows. The two historical rows
    // that carry them predate this and are left exactly as they are.
    const claimed = await claimAndExtend({
      companyId: referrer.id,
      counterpartyCompanyId: company.id,
      role: "referrer",
      months: REFERRER_BONUS_MONTHS,
    });
    if (!claimed) return null; // another delivery claimed it first

    return {
      referrerId: referrer.id,
      months: REFERRER_BONUS_MONTHS,
      until: claimed.grant.until,
      referredName: company.name,
    };
  } catch (err) {
    console.error("[referrals] grantReferrerCredit failed:", err);
    return null;
  }
}

/**
 * The referred company's first PAID plan invoice, from Stripe — the evidence
 * grantReferrerCredit needs when it is not being handed an invoice by the
 * webhook. Filtered to the company's own plan subscription, because an AI
 * credit bundle bills the same customer with the same billing_reason and must
 * never be read as the plan (app/api/platform/billing/webhook/route.js has the
 * history of that collision).
 */
async function firstPaidPlanInvoice(companyId) {
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { stripeCustomerId: true, stripeSubscriptionId: true },
  });
  if (!sub?.stripeCustomerId || !sub?.stripeSubscriptionId) return null;
  const list = await stripe.invoices.list({
    customer: sub.stripeCustomerId,
    subscription: sub.stripeSubscriptionId,
    status: "paid",
    limit: 100,
  });
  return (
    (list?.data || []).find(
      (inv) =>
        Number(inv?.amount_paid) > 0 &&
        ["subscription_create", "subscription_cycle"].includes(inv?.billing_reason),
    ) || null
  );
}

/**
 * The referrer's months that were HELD because it had no plan, granted now
 * that it has one.
 *
 * "If the referrer chooses a plan later, a reward the newcomer has since
 * earned by paying is granted then." For every company this referrer brought
 * in that has no referrer row yet, look for a paid plan invoice and, if there
 * is one, run grantReferrerCredit exactly as the webhook would have — every
 * one of its conditions (verified business, the monthly cap, the influencer
 * refusal, the plan this referrer now has) re-checked fresh. Never twice: a
 * company with a referrer row is skipped, and the claim row inside
 * grantReferrerCredit holds against a webhook arriving at the same moment.
 *
 * Never throws. Returns the grants made.
 */
export async function grantHeldReferrerRewards(referrerId) {
  try {
    if (!referrerId) return [];
    const referrer = await db.company.findUnique({
      where: { id: referrerId },
      select: { id: true, referralCode: true },
    });
    // Guarded: `referredByCode: null` would match every organic company.
    if (!referrer?.referralCode) return [];
    if (!(await companyHasSelectedPlan(referrer.id))) return [];

    const referred = await db.company.findMany({
      where: { referredByCode: referrer.referralCode },
      select: { id: true },
    });
    if (!referred.length) return [];

    const done = await db.referralCredit.findMany({
      where: { companyId: referrer.id, role: "referrer" },
      select: { counterpartyCompanyId: true },
    });
    const doneIds = new Set(done.map((d) => d.counterpartyCompanyId));

    const granted = [];
    for (const r of referred) {
      if (r.id === referrer.id || doneIds.has(r.id)) continue;
      const paid = await firstPaidPlanInvoice(r.id).catch((err) => {
        console.error(`[referrals] could not read ${r.id}'s invoices:`, err?.message);
        return null;
      });
      if (!paid) continue;
      const g = await grantReferrerCredit({
        paidCompanyId: r.id,
        paidAmountCents: paid.amount_paid,
        currency: paid.currency,
      });
      if (g) granted.push(g);
    }
    return granted;
  } catch (err) {
    console.error("[referrals] grantHeldReferrerRewards failed:", err);
    return [];
  }
}

/**
 * Everything the referral programme does when a company SELECTS A PLAN: its
 * own month as a newcomer, then the months it was owed as a referrer. Called
 * from every writer of a chosen plan — lib/platform/stripeBilling.js
 * upsertSubscriptionFromCheckoutSession (the checkout webhook and the
 * on-return reconcile) and the customer-sync branch of
 * app/api/settings/subscription/reconcile. Idempotent and never throws, so it
 * is safe on every replay of either.
 */
export async function onPlanSelected(companyId) {
  const referee = await grantRefereeBonus(companyId);
  const held = await grantHeldReferrerRewards(companyId);
  return { referee, held };
}

/**
 * Applies any referral credits a company earned while it had no Stripe customer
 * (it referred someone before it started paying). Call when the company pays, so
 * its earned-but-unapplied credits land on its balance.
 */
export async function applyPendingReferralCredits(companyId) {
  try {
    const pending = await db.referralCredit.findMany({
      where: {
        companyId,
        role: "referrer",
        stripeBalanceTxnId: null,
        creditCents: { gt: 0 },
      },
    });
    for (const c of pending) {
      await applyCreditToBalance(c.id, companyId, c.creditCents, c.currency).catch(
        (e) => console.error("[referrals] sweep apply failed:", e?.message),
      );
    }
    return pending.length;
  } catch (err) {
    console.error("[referrals] applyPendingReferralCredits failed:", err);
    return 0;
  }
}
