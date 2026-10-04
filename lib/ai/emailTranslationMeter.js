// lib/ai/emailTranslationMeter.js
//
// Who pays for translating a company's email template, and how much it is.
//
// ══ The rule (owner, 2026-10-03, as briefed) ═══════════════════════════════
//
// "if each email created costs more than 5 cents for translation … then we
// might charge the company in case they create a lot of campaigns as all the
// cost add up". Applied per drafted translation (one template version into
// one language):
//
//   1. The company HAS AI credit that covers this translation's estimate →
//      it is charged to the AI credit, at the same pay-as-you-go rate as every
//      other wallet feature (cost × lib/ai/imageEconomics.js's multiplier,
//      rounded up to the cent) — lib/ai/walletMeter.js's arithmetic.
//   2. No credit → FieldQuo absorbs it, while BOTH hold:
//        - the estimate for this one version is at most 5¢
//          (PER_VERSION_ABSORB_MAX_MICROS), and
//        - FieldQuo's absorbed translation spend for this company this
//          calendar month, plus this estimate, stays within
//          MONTHLY_ABSORB_CAP_MICROS ($1.00).
//      Recorded on FieldQuo's ledger (lib/ai/platformUsage.js, area
//      "email_translation", meta.companyId) — NOT on the company's AiUsage,
//      because an AiUsage row with paidFromWallet=false is counted against the
//      company's monthly token allowance, which would charge the company for
//      the very translation FieldQuo said it was absorbing.
//   3. Otherwise the draft is refused with a reason the panel shows ("needs
//      AI credit"). Sending is never affected: the original goes out.
//
// /platform/ai-billing's switch still rules over all of this: a superadmin
// who sets "email_translation" to FieldQuo makes FieldQuo pay for every
// translation (meterFor's FieldQuo ledger, behind its platform budget).
//
// The 5¢ test is made on the ESTIMATE, before the call, because after the
// call the money is spent. A version the estimate put under 5¢ that came in
// over it stays absorbed (and counts toward the month); the estimate is
// deliberately on the high side (below) so that is rare.
//
// ══ What a translation costs (measured per call, estimated before) ═════════
//
// The cost of a draft is the provider's own token counts × lib/ai/usage.js's
// price table, with the cached part of the prompt at the cached rate (a tenth
// of input on the GPT-5 family) — estimateCostMicros. It is stored on the
// translation row and shown in the panel.
//
// Before the call it is ESTIMATED from the characters being translated:
//
//   prompt     = 400 (instructions) + 14 per string + chars ÷ chars-per-token(source)
//   completion = (chars × length-ratio(target) ÷ chars-per-token(target) + 14 per string)
//                × 1.4 (reasoning at low effort) + 250
//
// Chars-per-token are deliberately PESSIMISTIC for the o200k tokenizer
// (English 4.2, the Latin-script languages ~3.5, Ukrainian 3.0, Punjabi 2.0 —
// Gurmukhi is the costliest script here). On the standard model (gpt-5-mini,
// $0.13 in / $1.00 out per million tokens in the table) that puts a typical
// 150–300-word email (~900–1,800 characters) at roughly 0.09–0.18¢ per
// language (Spanish/Italian cheapest, Punjabi dearest), and a 10,000-character
// template into Punjabi at ~0.8¢ — so on the standard model the 5¢ line is
// never met; it is the guard for the day OPENAI_MODEL points at a dearer model
// (the same 300 words into Punjabi on gpt-5.5 at $5/$30 is ~5.5¢).
// scripts/check-email-template-translation.mjs prints the table. These are
// estimates; the figure the panel shows after a draft is the measured one.

import { db } from "@/lib/db";
import { estimateCostMicros, recordAiUsage, startOfMonth } from "./usage";
import { chatChargeCents } from "./imageEconomics";
import { modelForTier } from "./provider";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "./platformUsage";
import { meterFor, PLATFORM_BUDGET_REFUSAL } from "./featurePayer";
import { balanceFor, debitCredit, POOLS } from "@/lib/voice/credits";
import { PER_VERSION_ABSORB_MAX_MICROS, MONTHLY_ABSORB_CAP_MICROS } from "@/lib/email/templateTranslation";

export { PER_VERSION_ABSORB_MAX_MICROS, MONTHLY_ABSORB_CAP_MICROS };

/** The feature name on every ledger: AiUsage.feature, PlatformAiUsage.area,
 *  VoiceCreditEntry.kind and the /platform switch. */
export const EMAIL_TRANSLATION_FEATURE = "email_translation";

/** The tier a template is translated on. The mini: this is translation of a
 *  few paragraphs a person then reviews, not writing from scratch. */
export const EMAIL_TRANSLATION_TIER = "standard";

const CHARS_PER_TOKEN = Object.freeze({ en: 4.2, fr: 3.6, es: 3.7, it: 3.6, de: 3.5, tl: 3.4, uk: 3.0, pa: 2.0 });
const LENGTH_VS_ENGLISH = Object.freeze({ en: 1, fr: 1.2, es: 1.2, it: 1.15, de: 1.25, tl: 1.25, uk: 1.1, pa: 1.05 });
const INSTRUCTION_TOKENS = 400;
const PER_STRING_TOKENS = 14;
const REASONING_FACTOR = 1.4;
const REASONING_FLOOR = 250;

const cpt = (lang) => CHARS_PER_TOKEN[lang] || 3.0;
const ratio = (from, to) => (LENGTH_VS_ENGLISH[to] || 1.2) / (LENGTH_VS_ENGLISH[from] || 1);

/** Tokens one draft is expected to spend. Pure. */
export function estimateTranslationTokens({ chars = 0, strings = 0, from = "en", to = "fr" } = {}) {
  const c = Math.max(0, Number(chars) || 0);
  const n = Math.max(0, Number(strings) || 0);
  const promptTokens = Math.ceil(INSTRUCTION_TOKENS + n * PER_STRING_TOKENS + c / cpt(from));
  const visible = (c * ratio(from, to)) / cpt(to) + n * PER_STRING_TOKENS;
  const completionTokens = Math.ceil(visible * REASONING_FACTOR + REASONING_FLOOR);
  return { promptTokens, completionTokens };
}

/** Estimated vendor cost of one draft, in micros, on the model it will run on. Pure. */
export function estimateTranslationMicros({ chars, strings, from, to, model = modelForTier(EMAIL_TRANSLATION_TIER) } = {}) {
  const t = estimateTranslationTokens({ chars, strings, from, to });
  return estimateCostMicros({ model, ...t });
}

/** The measured cost of a call that happened, cached prompt at the cached rate. */
export function measuredMicros(usage) {
  if (!usage) return 0;
  return estimateCostMicros({
    model: usage.model,
    promptTokens: Number(usage.promptTokens) || 0,
    completionTokens: Number(usage.completionTokens) || 0,
    cachedTokens: Number(usage.cachedTokens) || 0,
  });
}

export const VERDICT_REASONS = Object.freeze({
  needs_credit_large:
    "This template is long enough that one translation costs more than 5¢, so it is paid from your AI credit — and your AI credit can't cover it. Top up AI credit to translate it. Emails still go out in the original.",
  needs_credit_monthly:
    "FieldQuo has covered this month's free translation allowance for your company. Top up AI credit to keep translating this month. Emails still go out in the original.",
  platform_paused: PLATFORM_BUDGET_REFUSAL,
});

/**
 * The decision, pure.
 *
 * @returns {{ allowed, billing: "wallet"|"fieldquo"|null, code, reason, needCents, estimateMicros }}
 */
export function translationVerdict({ balanceCents, estimateMicros, absorbedThisMonthMicros = 0, platformBudgetAllowed = true }) {
  const est = Math.max(0, Math.round(Number(estimateMicros) || 0));
  const needCents = Math.max(1, chatChargeCents(est));
  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;
  const base = { estimateMicros: est, needCents, balanceCents: balance };
  if (balance >= needCents) return { ...base, allowed: true, billing: "wallet", code: null, reason: null };
  if (est > PER_VERSION_ABSORB_MAX_MICROS) {
    return { ...base, allowed: false, billing: null, code: "needs_credit_large", reason: VERDICT_REASONS.needs_credit_large };
  }
  const absorbed = Math.max(0, Number(absorbedThisMonthMicros) || 0);
  if (absorbed + est > MONTHLY_ABSORB_CAP_MICROS) {
    return { ...base, allowed: false, billing: null, code: "needs_credit_monthly", reason: VERDICT_REASONS.needs_credit_monthly };
  }
  if (!platformBudgetAllowed) {
    return { ...base, allowed: false, billing: null, code: "platform_paused", reason: VERDICT_REASONS.platform_paused };
  }
  return { ...base, allowed: true, billing: "fieldquo", code: null, reason: null };
}

/** FieldQuo's absorbed email-translation spend for one company this month, in micros. */
export async function absorbedThisMonth(prisma, companyId, now = new Date()) {
  if (!companyId) return 0;
  const agg = await prisma.platformAiUsage.aggregate({
    where: {
      area: EMAIL_TRANSLATION_FEATURE,
      createdAt: { gte: startOfMonth(now) },
      meta: { path: ["companyId"], equals: companyId },
    },
    _sum: { costMicros: true },
  });
  return Number(agg?._sum?.costMicros) || 0;
}

/**
 * The meter for one draft, in meterFor's check()/record() shape.
 *
 *   const meter = await emailTranslationMeter({ companyId, userId, estimateMicros });
 *   const gate = await meter.check();      // BEFORE the call
 *   …complete({ onUsage: (u) => { usage = u; } })
 *   const paid = await meter.record(usage, { ref, meta });   // AFTER, on every outcome that spent
 *
 * record() returns { billing, chargedCents, costMicros } and never throws.
 * `deps` are seams for scripts/check-email-template-translation.mjs.
 */
export async function emailTranslationMeter({ companyId, userId = null, estimateMicros = 0, prisma = db, now = null, deps = {} } = {}) {
  const {
    balanceFor: readBalance = balanceFor,
    debitCredit: debit = debitCredit,
    recordAiUsage: recordUsage = recordAiUsage,
    recordPlatformAiUsage: recordPlatform = recordPlatformAiUsage,
    checkPlatformAiBudget: checkBudget = checkPlatformAiBudget,
    absorbedThisMonth: readAbsorbed = absorbedThisMonth,
  } = deps;

  // The /platform switch first. FieldQuo set as the payer → FieldQuo pays
  // every translation, through meterFor's own ledger (budget-checked there).
  // Spelled as a literal: scripts/check-receipt-books.mjs proves every wired
  // feature has a meterFor("<feature>") call site.
  const base = await meterFor("email_translation", { companyId, userId, prisma, deps });
  if (base.payer === "fieldquo") {
    return {
      payer: "fieldquo",
      async check() {
        const gate = await base.check();
        return { ...gate, billing: gate.allowed ? "fieldquo" : null, estimateMicros: estimateMicros, needCents: 0 };
      },
      async record(usage, { meta = null } = {}) {
        if (!usage) return { billing: "fieldquo", chargedCents: 0, costMicros: 0 };
        await base.record(usage, { meta });
        return { billing: "fieldquo", chargedCents: 0, costMicros: measuredMicros(usage) };
      },
    };
  }

  // The company is the payer: credit first, FieldQuo up to the thresholds.
  let admitted = null;
  return {
    payer: "company",
    async check() {
      const at = now || new Date();
      let balance = 0;
      try {
        balance = await readBalance(companyId, prisma, POOLS.AI);
      } catch (err) {
        console.error("[ai/emailTranslationMeter] balance read failed:", err?.message);
      }
      let absorbed = 0;
      let budgetAllowed = true;
      // Only asked when the wallet cannot cover it — a funded company's
      // translation never reads FieldQuo's ledger.
      if (balance < Math.max(1, chatChargeCents(estimateMicros))) {
        try {
          absorbed = await readAbsorbed(prisma, companyId, at);
        } catch (err) {
          // Unreadable → treat as over the cap. An unread ledger must fail
          // towards "needs credit", never towards unbounded free drafts.
          console.error("[ai/emailTranslationMeter] absorbed read failed:", err?.message);
          absorbed = MONTHLY_ABSORB_CAP_MICROS;
        }
        const budget = await checkBudget(prisma).catch(() => ({ allowed: false }));
        budgetAllowed = budget?.allowed !== false;
      }
      const verdict = translationVerdict({
        balanceCents: balance,
        estimateMicros,
        absorbedThisMonthMicros: absorbed,
        platformBudgetAllowed: budgetAllowed,
      });
      admitted = verdict.billing;
      return { ...verdict, absorbedThisMonthMicros: absorbed };
    },

    async record(usage, { ref = null, note = null, meta = null } = {}) {
      const costMicros = measuredMicros(usage);
      if (!usage) return { billing: admitted, chargedCents: 0, costMicros: 0 };
      // A record() nobody checked first is charged to the wallet — an
      // unchecked call must never become a free one (walletMeter's rule).
      const billing = admitted || "wallet";
      if (billing === "fieldquo") {
        const extra = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
        await recordPlatform(prisma, {
          area: EMAIL_TRANSLATION_FEATURE,
          model: usage.model,
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          cachedTokens: usage.cachedTokens || 0,
          // companyId last: a caller's meta cannot re-attribute the spend.
          meta: { ...extra, userId: userId || null, feature: EMAIL_TRANSLATION_FEATURE, companyId: companyId || null },
        });
        return { billing, chargedCents: 0, costMicros };
      }
      await recordUsage({
        companyId,
        feature: EMAIL_TRANSLATION_FEATURE,
        model: usage.model,
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        userId,
        paidFromWallet: true,
        cachedTokens: usage.cachedTokens || 0,
      });
      const cents = chatChargeCents(costMicros);
      if (cents <= 0) return { billing, chargedCents: 0, costMicros };
      try {
        const entry = await debit({ companyId, cents, kind: EMAIL_TRANSLATION_FEATURE, ref, note, prisma });
        const taken = entry ? Math.abs(Number(entry.cents) || cents) : 0;
        return { billing, chargedCents: taken, costMicros };
      } catch (err) {
        // The AiUsage row above still records the spend; a ledger failure
        // must not lose the translation the company paid the vendor for.
        console.error("[ai/emailTranslationMeter] debit failed:", err?.message);
        return { billing, chargedCents: 0, costMicros };
      }
    },
  };
}
