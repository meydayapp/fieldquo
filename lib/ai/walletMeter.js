// lib/ai/walletMeter.js
//
// The company's paid AI credit, used as a METER for chat: the AI employee's
// replies and its front desk are charged in dollars, per call, from the same
// "ai" wallet the bundles and top-ups fund.
//
// ══ The owner's decision (2026-09-25) ══════════════════════════════════════
//
// "FieldQuo AI is okay if it's us. But the AI chat settings in the agentic
// employee should be theirs to pay — their own chat bot." The in-app copilot
// and auto-translation moved onto FieldQuo's own budget (lib/ai/featurePayer.js).
// The AI employee — the bot on the company's website, Meta pages and SMS line —
// is paid by the company "from their paid AI subscription": the AI wallet in
// lib/voice/credits.js (POOLS.AI), filled by AiCreditBundle's monthly credits
// and by one-time top-ups (lib/ai/topup.js).
//
// ══ The charge ═════════════════════════════════════════════════════════════
//
//   cents = ceil( vendorCostMicros × PAY_AS_YOU_GO_MULTIPLIER / 10,000 )
//
// vendorCostMicros is lib/ai/usage.js's estimateCostMicros over the provider's
// own token counts — the same figure the AiUsage row records. The multiplier
// is lib/ai/imageEconomics.js's, the 2x (≈50% gross margin) the owner approved
// for pay-as-you-go images on 2026-08-30. There was no separate margin rule
// for chat; it takes the images' rule rather than inventing a second one.
//
// ══ Before the call: can the wallet cover ONE reply? ═══════════════════════
//
// Estimated from a stated average — TYPICAL_CONVERSATION_TOKENS for a reply
// on the best model, a small fixed prompt for the front desk on the standard
// one — priced by the same formula. A balance below that does not reach the
// model at all: lib/aiEmployee/decide.js turns the refusal into NO_CREDIT, the
// thread is handed to a person and the company is notified. The estimate is a
// floor, not a reservation: a long reply can overdraw by the difference, and
// the next one is then refused. Reserving an estimate and refunding the rest
// would put two ledger rows on every reply for a few cents of float.
//
// ══ The grace (one-time, ends at AI_EMPLOYEE_GRACE_ENDS_ON) ════════════════
//
// Until this switch, the employee spent the company's monthly TOKEN allowance
// (checkAiQuota), which every plan includes. A company running it today with
// an empty wallet would go silent the moment this shipped. So until the end of
// the month the decision was made in, a wallet that cannot cover a reply falls
// back to exactly the old behaviour — the allowance, checked and recorded as
// before, nothing debited — and the settings page says so, with the date.
// A funded wallet is charged from the first reply. After the date, an empty
// wallet pauses the employee. One constant; nothing is written to switch it.
//
// ══ After the call: debit the actual cost, once ═══════════════════════════
//
// The ledger's unique (companyId, ref) index is the idempotency: the ref is
// "ai_employee_reply:<AiEmployeeReply.id>", so recording the same reply twice
// writes one debit. The AiUsage row is still written for every call (the
// usage screens and /platform read it) with paidFromWallet set, which keeps
// it out of the allowance — the company is not billed twice for one call.
import { db } from "@/lib/db";
import { checkAiQuota, recordAiUsage, estimateCostMicros, TYPICAL_CONVERSATION_TOKENS } from "./usage";
import { chatChargeCents, PAY_AS_YOU_GO_MULTIPLIER } from "./imageEconomics";
import { modelForTier } from "./provider";
import { balanceFor, debitCredit, POOLS } from "@/lib/voice/credits";

/**
 * The last day of the old behaviour is the day BEFORE this one: from
 * 00:00 UTC on this calendar day, an empty wallet pauses the AI employee.
 * The end of the month the owner decided in — checkAiQuota's month is the
 * server's calendar month, which on Vercel is UTC.
 */
export const AI_EMPLOYEE_GRACE_ENDS_ON = "2026-10-01";
export const AI_EMPLOYEE_GRACE_ENDS_AT = new Date(`${AI_EMPLOYEE_GRACE_ENDS_ON}T00:00:00.000Z`);

export { PAY_AS_YOU_GO_MULTIPLIER };

/** What each wallet-paid feature is estimated at before the call, and on
 *  which tier. The front desk's is its fixed system prompt plus a first
 *  message of up to 2,000 characters, and its 120-token answer cap. */
export const WALLET_ESTIMATES = Object.freeze({
  ai_employee_reply: Object.freeze({ tier: "best", ...TYPICAL_CONVERSATION_TOKENS }),
  ai_employee_front_desk: Object.freeze({ tier: "standard", prompt: 1_000, completion: 120 }),
});

/** The English refusal. The settings screen and the notification translate
 *  their own copy from `code`; this sentence is for logs and the API. */
export const WALLET_EMPTY_REASON =
  "Your AI employee is paused — AI credit is empty. Top up AI credit or add a monthly bundle to switch it back on.";

export function inAiEmployeeGrace(now = new Date()) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Number.isFinite(t) && t < AI_EMPLOYEE_GRACE_ENDS_AT.getTime();
}

/** Cents one call of this feature is estimated to be charged. Never below
 *  1¢: a reply that could be "free" is a gate that never closes. */
export function estimateChargeCents(feature, { model = null } = {}) {
  const e = WALLET_ESTIMATES[feature] || WALLET_ESTIMATES.ai_employee_reply;
  const micros = estimateCostMicros({
    model: model || modelForTier(e.tier),
    promptTokens: e.prompt,
    completionTokens: e.completion,
  });
  return Math.max(1, chatChargeCents(micros));
}

/** Cents the wallet is charged for one call, from its actual token counts. */
export function chargeCentsForUsage(usage) {
  if (!usage) return 0;
  return chatChargeCents(
    estimateCostMicros({
      model: usage.model,
      promptTokens: Number(usage.promptTokens) || 0,
      completionTokens: Number(usage.completionTokens) || 0,
    }),
  );
}

/**
 * The decision, pure. Given the balance and the estimate, which way is this
 * call paid — or is it refused?
 *
 *   "wallet"  the balance covers one call: charge it.
 *   "grace"   it does not, but the grace has not ended: fall back to the
 *             monthly allowance (the caller then asks checkAiQuota).
 *   refused   it does not, and the grace is over: code "no_credit".
 *
 * A balance that is not a finite number counts as empty. An unreadable wallet
 * must fail towards a person answering, never towards unpaid model calls.
 */
export function walletVerdict({ balanceCents, needCents, now = new Date() }) {
  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;
  const need = Number.isFinite(Number(needCents)) && Number(needCents) >= 1 ? Math.ceil(Number(needCents)) : 1;
  const base = { balanceCents: balance, needCents: need, graceEndsOn: AI_EMPLOYEE_GRACE_ENDS_ON };
  if (balance >= need) return { ...base, allowed: true, billing: "wallet", reason: null, code: null };
  if (inAiEmployeeGrace(now)) return { ...base, allowed: true, billing: "grace", reason: null, code: null };
  return { ...base, allowed: false, billing: null, reason: WALLET_EMPTY_REASON, code: "no_credit" };
}

/**
 * The company-wallet ledger for one feature and one company, in meterFor's
 * check()/record() shape (lib/ai/featurePayer.js calls this for every feature
 * registered with companyLedger: "wallet").
 *
 * `deps` are seams for scripts/check-ai-wallet-meter.mjs: checkAiQuota and
 * recordAiUsage read and write the global client, so a check swaps them.
 */
export function walletLedger(feature, { companyId, userId = null, prisma = db, now = null, deps = {} } = {}) {
  const {
    checkAiQuota: checkQuota = checkAiQuota,
    recordAiUsage: recordUsage = recordAiUsage,
    balanceFor: readBalance = balanceFor,
    debitCredit: debit = debitCredit,
  } = deps;
  // What check() admitted this call under. record() charges accordingly; a
  // record() nobody checked first is charged to the wallet — an unchecked
  // call must never become a free one.
  let admitted = null;

  return {
    payer: "company",
    ledger: "wallet",
    async check() {
      const at = now || new Date();
      let balance = 0;
      try {
        balance = await readBalance(companyId, prisma, POOLS.AI);
      } catch (err) {
        console.error("[ai/walletMeter] balance read failed:", err?.message);
      }
      const verdict = walletVerdict({ balanceCents: balance, needCents: estimateChargeCents(feature), now: at });
      if (verdict.billing === "grace") {
        // The old behaviour, exactly: the monthly allowance decides.
        const quota = await checkQuota(companyId);
        admitted = quota?.allowed === false ? null : "grace";
        return {
          ...verdict,
          allowed: quota?.allowed !== false,
          reason: quota?.allowed === false ? quota.reason : null,
          code: quota?.allowed === false ? "quota" : null,
          quota,
        };
      }
      admitted = verdict.allowed ? "wallet" : null;
      return verdict;
    },

    /**
     * After the call, on every outcome that spent.
     *
     * @param usage  provider.js's onUsage payload
     * @param ref    the idempotency key — "ai_employee_reply:<replyId>". Two
     *               records with one ref write one debit.
     * @returns {{ billing, chargedCents, entry }} — chargedCents is what the
     *          ledger actually took (0 when nothing was debited). Never throws.
     */
    async record(usage, { ref = null, note = null } = {}) {
      if (!usage) return { billing: admitted, chargedCents: 0, entry: null };
      const billing = admitted || "wallet";
      const wallet = billing === "wallet";
      await recordUsage({
        companyId,
        feature,
        model: usage.model,
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        userId,
        imageCount: usage.imageCount || 0,
        paidFromWallet: wallet,
      });
      if (!wallet) return { billing, chargedCents: 0, entry: null };
      const cents = chargeCentsForUsage(usage);
      if (cents <= 0) return { billing, chargedCents: 0, entry: null };
      try {
        const entry = await debit({ companyId, cents, kind: feature, ref, note, prisma });
        // An entry that already existed under this ref is the SAME charge
        // found again, not a second one — report what it took.
        const taken = entry ? Math.abs(Number(entry.cents) || cents) : 0;
        return { billing, chargedCents: taken, entry: entry || null };
      } catch (err) {
        // A ledger failure must not turn a reply that was composed into an
        // error. The AiUsage row above still records the spend, so it is
        // visible on /platform as usage with no matching charge.
        console.error("[ai/walletMeter] debit failed:", err?.message);
        return { billing, chargedCents: 0, entry: null };
      }
    },
  };
}
