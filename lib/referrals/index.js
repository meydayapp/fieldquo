// lib/referrals/index.js
//
// FieldQuo's own referral programme: one contractor telling another about the
// product. Both sides get three free months.
//
// All the policy lives here rather than in route handlers, because the rules
// are the kind that get quietly violated when they're spread out:
//
//   * A company that already exists can REFER but never REDEEM. The offer is
//     for acquiring new customers; letting existing ones redeem is just a
//     discount on revenue you already had.
//   * You cannot refer yourself. Checked on the code, not on the email,
//     because the email is trivially varied.
//   * The new company's three months land at signup. It's their trial — it
//     costs nothing if they churn, and it's what makes the link worth clicking.
//   * The referrer's three months land on the referred company's FIRST
//     PAYMENT. Granting on signup makes this a fraud target: twenty throwaway
//     addresses would earn five free years.
//   * Every grant is a row, and grants are idempotent. A retried webhook or a
//     double-clicked button must not pay twice.

import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// The NEW company (referee) gets this many extra free trial months for signing
// up through a referral link. The referrer's reward is different — a dollar
// account credit equal to one month of the referred company's plan (see
// grantReferrerCredit), applied only once that company is a verified paying
// customer.
export const REFEREE_BONUS_MONTHS = 1;

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

function addMonths(date, months) {
  const out = new Date(date);
  // setMonth handles the wrap; the clamp below handles Jan 31 + 1 month, which
  // JavaScript would otherwise roll forward into March.
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  if (out.getDate() < day) out.setDate(0);
  return out;
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
 * Grants the new company its three months and records who sent them.
 *
 * Call at signup, AFTER the company row exists. Returns null when the code
 * doesn't qualify — a bad referral code must never block a signup, so every
 * failure path here is silent to the user and loud in the logs.
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

    // Extend from whichever is later: their existing trial end or now. A
    // 30-day trial plus a 3-month referral should be 4 months, not 3.
    const base =
      company.trialEndsAt && company.trialEndsAt > new Date()
        ? company.trialEndsAt
        : new Date();
    const trialEndsAt = addMonths(base, REFEREE_BONUS_MONTHS);

    await db.$transaction([
      db.company.update({
        where: { id: company.id },
        data: {
          referredByCode: referrer.referralCode,
          referredAt: new Date(),
          trialEndsAt,
        },
      }),
      db.referralCredit.create({
        data: {
          companyId: company.id,
          counterpartyCompanyId: referrer.id,
          role: "referred",
          months: REFEREE_BONUS_MONTHS,
          appliedTrialEndsAt: trialEndsAt,
        },
      }),
    ]);

    // Best-effort: mark a matching invite redeemed so the sender's list shows
    // it. Matching on contact details is deliberately loose — a forwarded link
    // should still count, so a miss here doesn't affect the credit.
    await markInviteRedeemed(referrer.id, company).catch(() => {});

    return { referrer, trialEndsAt };
  } catch (err) {
    // A referral is a bonus. It must never be the reason a signup fails.
    console.error("[referrals] applySignupReferral failed:", err);
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
 * Grants the REFERRER a dollar account credit — one month of the REFERRED
 * company's plan — once that company is a verified paying customer.
 *
 * Called from the Stripe billing webhook on every paid invoice (idempotent via
 * the unique constraint). Requirements, all of which stop throwaway-company
 * fraud:
 *   - real money changed hands (paidAmountCents > 0 — a $0 trial invoice earns
 *     nothing), and that amount IS one month of their plan,
 *   - the referred company completed onboarding (onboardingStatus "active"), and
 *   - its Stripe Connect account is verified (stripeChargesEnabled) — proving a
 *     real business with a real payout account, not a burner signup.
 * A company that pays before finishing Connect just earns its referrer the
 * credit on the next paid invoice once verified.
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

    // Idempotent: one credit per (referrer, referred).
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

    // One month of the referred company's plan = exactly what they just paid.
    const creditCents = Math.round(Number(paidAmountCents));
    const cur = (currency || "usd").toLowerCase();

    // Record first (idempotency + audit), then try to apply to Stripe balance.
    const credit = await db.referralCredit.create({
      data: {
        companyId: referrer.id,
        counterpartyCompanyId: company.id,
        role: "referrer",
        creditCents,
        currency: cur,
      },
    });
    await applyCreditToBalance(credit.id, referrer.id, creditCents, cur).catch(
      (e) => console.error("[referrals] apply credit failed:", e?.message),
    );

    return { referrerId: referrer.id, creditCents, referredName: company.name };
  } catch (err) {
    console.error("[referrals] grantReferrerCredit failed:", err);
    return null;
  }
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
