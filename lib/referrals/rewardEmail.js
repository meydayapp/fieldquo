// lib/referrals/rewardEmail.js
//
// "You earned a free month" — the letter that says a referral month LANDED.
//
// ══ Why it exists ═══════════════════════════════════════════════════════════
//
// A referral month moves a date nobody looks at: the referrer's next Stripe
// charge (or the end of a grandfathered trial), and for the newcomer the
// first charge after the trial. Both sides were told the PROMISE — the refer
// page, the invite email, /refer/<code> ("your first charge moves a month
// later") — and neither was ever told it happened. The referrer saw a tick on
// the Refer & Earn list if they went looking; the newcomer's only trace was a
// "Trial ends" date on their subscription letter a month later than they
// expected, with nothing saying why. Checked 2026-10-11: no email, banner or
// notification anywhere mentions the month once granted.
//
// ══ When, exactly once ══════════════════════════════════════════════════════
//
// Called by lib/referrals/index.js right after claimAndExtend, for both roles,
// and ONLY when the month actually landed (grant.ok — appliedTrialEndsAt
// set). A claimed row whose extension failed is "a reward owed and visibly
// unpaid" (that file's words); telling the company it has a free month would
// be the control that appears to work and doesn't. The row's own
// ReferralCredit.notifiedAt is the once-only stamp: claimed before the send
// (guarded on null, so a webhook replay racing a reconcile cannot both send),
// restored to null if the send did not happen. The row is unique per
// (company, role, counterparty), so "once per reward" is the database's
// guarantee, not this file's.
//
// ══ What it is not ══════════════════════════════════════════════════════════
//
// Transactional, about the company's own account and money — so it is not
// held to the marketing do-not-contact list or the coming email preferences,
// the same standing as the subscription letters. A demo is diverted by
// sendEmail itself (companyId), a reserved test address is skipped here, and
// a company FieldQuo ended is never written to about a month it cannot use.
//
// FieldQuo → the company, so FieldQuo-branded (lib/email/billingEmail.js's
// platform envelope), in the owner's language (lib/billing/billingLanguage.js).

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { ownerEmailFor } from "@/lib/email/companySender";
import { buildPlatformNotice, formatBillingDate } from "@/lib/email/billingEmail";
import { escapeHtml } from "@/lib/email/emailTheme";
import { accountNoticeCopy, hasAccountNoticeLanguage, fillNotice } from "@/lib/i18n/accountNoticeCopy";
import { ownerLetterLanguage } from "@/lib/billing/billingLanguage";
import { isReservedTestAddress } from "@/lib/signup/abandoned";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";

/**
 * The letter. Pure.
 *
 * @param role             "referrer" | "referred" (ReferralRole)
 * @param companyName      the company being written to
 * @param counterpartyName the other company — the referred business for a
 *                         referrer, the referrer for a newcomer
 * @param until            the date the month runs to (appliedTrialEndsAt)
 * @param via              "subscription" (a Stripe charge moved) | "trial"
 *                         (a grandfathered trial lengthened)
 * @param language         the reader's language
 * @param origin           absolute app origin for the button
 */
export function buildReferralRewardEmail({ role, companyName, counterpartyName, until, via = "subscription", language = "en", origin }) {
  const c = accountNoticeCopy(language);
  const side = role === "referrer" ? "referrer" : "referee";
  const bold = (v) => `<strong>${escapeHtml(v)}</strong>`;
  const company = String(companyName || "").trim();
  const other = String(counterpartyName || "").trim();
  const date = formatBillingDate(until, language);
  const base = String(origin || "https://www.fieldquo.com").replace(/\/+$/, "");

  const paragraphs = [
    fillNotice(c[`${side}.intro`], side === "referrer" ? { referred: other, company } : { referrer: other, company }, bold),
    fillNotice(c[`${side}.${via === "trial" ? "trial" : "subscription"}`], { date }, bold),
  ];
  if (side === "referrer") paragraphs.push(escapeHtml(c["referrer.more"]));

  return buildPlatformNotice({
    subject: c[`${side}.subject`],
    heading: c[`${side}.heading`],
    sub: company,
    paragraphs,
    cta: {
      url: side === "referrer" ? `${base}/app/settings/refer` : `${base}/app/settings/account-billing`,
      label: c[`${side}.cta`],
    },
    language,
  });
}

function originOrDefault() {
  try {
    return getAppOrigin();
  } catch {
    return "https://www.fieldquo.com";
  }
}

/**
 * Send the letter for one ReferralCredit row, once. Never throws.
 *
 * @param creditId  the row claimAndExtend wrote
 * @param via       grant.via from extendAccessByMonths
 * @returns {{ sent: boolean, reason?: string }}
 */
export async function notifyReferralReward({ creditId, via = "subscription", origin = null } = {}) {
  let claimed = false;
  try {
    if (!creditId) return { sent: false, reason: "no_credit" };
    const credit = await db.referralCredit.findUnique({
      where: { id: creditId },
      select: { id: true, companyId: true, counterpartyCompanyId: true, role: true, appliedTrialEndsAt: true, notifiedAt: true },
    });
    if (!credit) return { sent: false, reason: "no_credit" };
    // The month did not land: say nothing rather than announce it.
    if (!credit.appliedTrialEndsAt) return { sent: false, reason: "not_applied" };
    if (credit.notifiedAt) return { sent: false, reason: "already_sent" };

    const [company, counterparty] = await Promise.all([
      db.company.findUnique({
        where: { id: credit.companyId },
        select: { id: true, name: true, email: true, isDemo: true, platformEndsAt: true },
      }),
      credit.counterpartyCompanyId
        ? db.company.findUnique({ where: { id: credit.counterpartyCompanyId }, select: { name: true } })
        : null,
    ]);
    if (!company) return { sent: false, reason: "no_company" };
    if (company.platformEndsAt) return { sent: false, reason: "ended_by_fieldquo" };

    const to = String(company.email || "").trim() || (await ownerEmailFor(company.id)) || "";
    if (!to) return { sent: false, reason: "no_recipient" };
    if (isReservedTestAddress(to)) return { sent: false, reason: "test_address" };

    // ── Claim (provisional) ──────────────────────────────────────────────
    const claim = await db.referralCredit.updateMany({
      where: { id: credit.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    if (claim.count === 0) return { sent: false, reason: "claimed_elsewhere" };
    claimed = true;

    const language = await ownerLetterLanguage(company.id, hasAccountNoticeLanguage);
    const { subject, html } = buildReferralRewardEmail({
      role: credit.role,
      companyName: company.name,
      counterpartyName: counterparty?.name || "",
      until: credit.appliedTrialEndsAt,
      via,
      language,
      origin: origin || originOrDefault(),
    });
    const from = await getPlatformFrom();
    const result = await sendEmail({ companyId: company.id, from, to, subject, html });
    if (result?.error || result?.skipped) {
      await release(credit.id);
      return { sent: false, reason: result.error ? "resend_rejected" : "no_api_key" };
    }
    return { sent: true };
  } catch (err) {
    if (claimed) await release(creditId);
    await recordError({
      area: "referrals",
      code: "referral_reward_email_failed",
      message: `The referral reward letter was not sent: ${err?.message}`,
    }).catch(() => {});
    return { sent: false, reason: err?.message };
  }
}

async function release(creditId) {
  await db.referralCredit.updateMany({ where: { id: creditId }, data: { notifiedAt: null } }).catch(() => {});
}
