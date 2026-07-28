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

export const REWARD_MONTHS = 3;

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
    const trialEndsAt = addMonths(base, REWARD_MONTHS);

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
          months: REWARD_MONTHS,
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
 * Grants the REFERRER their three months, once the company they referred has
 * actually paid.
 *
 * Called from the Stripe billing webhook on first successful payment. Safe to
 * call repeatedly: the unique constraint on (companyId, role, counterparty)
 * makes a duplicate a no-op rather than a second free quarter.
 */
export async function grantReferrerCredit({ paidCompanyId }) {
  try {
    const company = await db.company.findUnique({
      where: { id: paidCompanyId },
      select: { id: true, name: true, referredByCode: true },
    });
    if (!company?.referredByCode) return null;

    const referrer = await findReferrer(company.referredByCode);
    if (!referrer || referrer.id === company.id) return null;

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

    const referrerRow = await db.company.findUnique({
      where: { id: referrer.id },
      select: { id: true, trialEndsAt: true },
    });

    const base =
      referrerRow?.trialEndsAt && referrerRow.trialEndsAt > new Date()
        ? referrerRow.trialEndsAt
        : new Date();
    const trialEndsAt = addMonths(base, REWARD_MONTHS);

    await db.$transaction([
      db.company.update({
        where: { id: referrer.id },
        data: { trialEndsAt },
      }),
      db.referralCredit.create({
        data: {
          companyId: referrer.id,
          counterpartyCompanyId: company.id,
          role: "referrer",
          months: REWARD_MONTHS,
          appliedTrialEndsAt: trialEndsAt,
        },
      }),
    ]);

    return { referrerId: referrer.id, trialEndsAt, referredName: company.name };
  } catch (err) {
    console.error("[referrals] grantReferrerCredit failed:", err);
    return null;
  }
}
