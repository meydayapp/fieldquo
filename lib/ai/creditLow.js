// lib/ai/creditLow.js
//
// "Your AI credit is running low" — to the owner and admins, once per
// crossing.
//
// ══ What the AI credit is ═══════════════════════════════════════════════════
//
// The company's AI wallet: the POOLS.AI side of the VoiceCreditEntry ledger
// (lib/voice/credits.js), in US cents (lib/voice/creditCurrency.js), filled by
// one-time top-ups (lib/ai/topup.js) and an AI credit plan's monthly grant
// (lib/ai/creditBundle.js), and drawn by the AI employee's replies
// (lib/ai/walletMeter.js), AI pictures and photo review, material lists,
// drawing reads, conversation-to-lead reads and email-template translation.
// It is the company's own money — so this letter is transactional, like the
// subscription letters: no marketing preference or do-not-contact list
// silences it, the same way none silences "we couldn't charge your card".
//
// ══ When ════════════════════════════════════════════════════════════════════
//
// Threshold: AI_CREDIT_LOW_CENTS ($5 — lib/voice/credits.js says why), the
// same figure the assistant's account summary calls "low".
//
//   SEND   an AI USAGE charge (not a plan's month-end expiry, not a refund or
//          an adjustment — those are bookkeeping, not spending) leaves the
//          balance below $5, and the letter is armed;
//   ARM    the stamp Company.aiCreditLowNotifiedAt is null. Sending sets it;
//          a CREDIT (top-up, plan grant, demo top-up, refund) that brings the
//          balance back to $5 or more clears it — "again only after a top-up
//          and a new crossing";
//   NONE   everything else, including every charge while the stamp is set.
//
// Read off the ledger AFTER the write, through the writers themselves
// (lib/voice/credits.js addCredit / debitCredit call afterAiLedgerWrite), so
// there is no cron and no window in which a crossing is missed. A balance
// already below $5 when this shipped is told on its next AI charge — it IS
// low, and nobody has said so.
//
// The stamp is claimed (guarded on null) before any send, so two charges
// landing together send one letter, and put back if not one recipient
// accepted it.

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildPlatformNotice } from "@/lib/email/billingEmail";
import { escapeHtml } from "@/lib/email/emailTheme";
import { formatAppMoney } from "@/lib/format/money";
import { accountNoticeCopy, hasAccountNoticeLanguage, fillNotice } from "@/lib/i18n/accountNoticeCopy";
import { letterLanguage } from "@/lib/i18n/letterLanguage";
import { isReservedTestAddress } from "@/lib/signup/abandoned";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";
import { balanceFor, POOLS, isAiCreditLow, AI_CREDIT_LOW_CENTS } from "@/lib/voice/credits";
import { CREDIT_CURRENCY } from "@/lib/voice/creditCurrency";

export { AI_CREDIT_LOW_CENTS };

/**
 * AI-pool ledger kinds that are NOT usage. A debit of one of these never
 * sends the letter: a plan's unused month expiring at the end of the month
 * (lib/ai/planCreditReset.js) is followed by the next month's grant, and a
 * letter between the two would be about a balance nobody spent.
 */
export const AI_NON_USAGE_KINDS = Object.freeze(new Set(["ai_topup", "ai_adjustment", "ai_bundle", "ai_plan_expiry", "ai_demo_grant", "ai_demo_topup"]));

/**
 * The decision. Pure.
 *
 * @param event         "debit" | "credit"
 * @param kind          the ledger kind written
 * @param balanceCents  the AI balance AFTER the write
 * @param notifiedAt    Company.aiCreditLowNotifiedAt
 * @returns {{ action: "send" | "rearm" | "none", reason }}
 */
export function aiCreditLowDecision({ event, kind, balanceCents, notifiedAt }) {
  const low = isAiCreditLow(balanceCents);
  if (event === "credit") {
    if (!notifiedAt) return { action: "none", reason: "armed" };
    return low ? { action: "none", reason: "still_low" } : { action: "rearm", reason: "topped_up" };
  }
  if (event !== "debit") return { action: "none", reason: "unknown_event" };
  if (AI_NON_USAGE_KINDS.has(String(kind))) return { action: "none", reason: "not_usage" };
  if (!low) return { action: "none", reason: "not_low" };
  if (notifiedAt) return { action: "none", reason: "already_sent" };
  return { action: "send", reason: "crossed" };
}

/**
 * The letter. Pure.
 *
 * @param balanceCents  what is left, in the ledger's cents (USD)
 */
export function buildAiCreditLowEmail({ companyName, balanceCents, language = "en", origin }) {
  const c = accountNoticeCopy(language);
  const bold = (v) => `<strong>${escapeHtml(v)}</strong>`;
  const company = String(companyName || "").trim();
  // Never print a negative: an overdrawn wallet (a long reply after the gate
  // let it through) has nothing left, which is what the letter says.
  const balance = formatAppMoney(Math.max(0, Number(balanceCents) || 0) / 100, CREDIT_CURRENCY, language);
  const base = String(origin || "https://www.fieldquo.com").replace(/\/+$/, "");
  return buildPlatformNotice({
    subject: c["ai.subject"],
    heading: c["ai.heading"],
    sub: company,
    paragraphs: [
      fillNotice(c["ai.balance"], { company, balance }, bold),
      escapeHtml(c["ai.what"]),
      escapeHtml(`${c["ai.topups"]} ${c["ai.once"]}`),
    ],
    cta: { url: `${base}/app/settings/ai-credit`, label: c["ai.cta"] },
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
 * Run after every AI-wallet ledger write (lib/voice/credits.js). Never throws.
 *
 * @param deps  injectable for the checks: { now }
 * @returns {{ action, reason, sent? }}
 */
export async function afterAiLedgerWrite({ companyId, kind, event, now = new Date() } = {}) {
  let claimedAt = null;
  try {
    if (!companyId) return { action: "none", reason: "no_company" };
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, defaultLanguage: true, aiCreditLowNotifiedAt: true, platformEndsAt: true },
    });
    if (!company) return { action: "none", reason: "no_company" };

    // Cheap exits first — the common case (a charge while already told, a
    // top-up while armed) never reads the ledger.
    if (event === "debit" && company.aiCreditLowNotifiedAt) return { action: "none", reason: "already_sent" };
    if (event === "credit" && !company.aiCreditLowNotifiedAt) return { action: "none", reason: "armed" };

    const balanceCents = await balanceFor(companyId, db, POOLS.AI);
    const decision = aiCreditLowDecision({ event, kind, balanceCents, notifiedAt: company.aiCreditLowNotifiedAt });

    if (decision.action === "rearm") {
      await db.company.updateMany({
        where: { id: companyId, aiCreditLowNotifiedAt: company.aiCreditLowNotifiedAt },
        data: { aiCreditLowNotifiedAt: null },
      });
      return decision;
    }
    if (decision.action !== "send") return decision;
    // FieldQuo ended it: nothing to top up for.
    if (company.platformEndsAt) return { action: "none", reason: "ended_by_fieldquo" };

    // ── Claim (provisional) ──────────────────────────────────────────────
    const claim = await db.company.updateMany({
      where: { id: companyId, aiCreditLowNotifiedAt: null },
      data: { aiCreditLowNotifiedAt: now },
    });
    if (claim.count === 0) return { action: "none", reason: "claimed_elsewhere" };
    claimedAt = now;

    // Owners and admins: the people who can top up (the AI credit page is
    // theirs — app/api/settings/ai/credit). Each in their own language.
    const members = await db.member.findMany({
      where: { companyId, active: true, role: { in: ["owner", "admin"] } },
      select: { user: { select: { email: true, language: true } } },
    });
    const seen = new Set();
    const recipients = [];
    for (const m of members) {
      const email = String(m.user?.email || "").trim();
      const key = email.toLowerCase();
      if (!email || seen.has(key) || isReservedTestAddress(email)) continue;
      seen.add(key);
      recipients.push({ email, language: letterLanguage(m.user, company, hasAccountNoticeLanguage) });
    }
    if (!recipients.length) {
      await release(companyId, claimedAt);
      return { action: "none", reason: "no_recipient" };
    }

    const origin = originOrDefault();
    const from = await getPlatformFrom();
    let delivered = 0;
    for (const r of recipients) {
      const { subject, html, text } = buildAiCreditLowEmail({ companyName: company.name, balanceCents, language: r.language, origin });
      const result = await sendEmail({ companyId, from, to: r.email, subject, html, text });
      if (!result?.error && !result?.skipped) delivered++;
    }
    if (delivered === 0) {
      await release(companyId, claimedAt);
      return { action: "none", reason: "not_delivered" };
    }
    return { action: "send", reason: "crossed", sent: delivered };
  } catch (err) {
    if (claimedAt) await release(companyId, claimedAt);
    await recordError({
      area: "ai-credit",
      code: "ai_credit_low_email_failed",
      message: `The AI credit low-balance letter was not sent: ${err?.message}`,
      companyId,
    }).catch(() => {});
    return { action: "none", reason: "error" };
  }
}

async function release(companyId, claimedAt) {
  await db.company
    .updateMany({ where: { id: companyId, aiCreditLowNotifiedAt: claimedAt }, data: { aiCreditLowNotifiedAt: null } })
    .catch(() => {});
}
