// lib/ai/featurePayer.js
//
// Who pays for one AI feature's model calls — FieldQuo, or the company — and
// the one wrapper, meterFor(), that routes a call's metering accordingly.
//
// ══ The ledgers ════════════════════════════════════════════════════════════
//
//   "company"   checkAiQuota() before, recordAiUsage() after — the company's
//               own monthly allowance (lib/ai/usage.js). Every AI call in the
//               product was metered this way before this switch existed, and
//               a feature this file does not list still is.
//     …wallet   A feature registered with companyLedger: "wallet" is paid by
//               the company in DOLLARS from its AI credit instead — the AI
//               employee, per the owner's 2026-09-25 decision. See
//               lib/ai/walletMeter.js for the charge, the pre-call balance
//               check and the one-time grace.
//   "fieldquo"  checkPlatformAiBudget() before, recordPlatformAiUsage() after
//               (lib/ai/platformUsage.js), with meta.companyId — FieldQuo's own
//               cost, invisible to the company's allowance, still attributable
//               per company on /platform/ai-billing.
//
// ══ Fair use on FieldQuo's card ════════════════════════════════════════════
//
// The copilot was capped per company by the monthly token allowance, and
// lib/ai/usage.js's header says why: a scripted loop against /api/ai/copilot
// must not be able to run up an unbounded bill. Moving the copilot onto
// FieldQuo's budget moves the bill, not the reason. So a FieldQuo-paid
// feature marked `fairUse` keeps a per-company monthly ceiling of the SAME
// size the company's allowance has (getAiCap), counted on FieldQuo's own
// ledger for that feature only — it never reads or writes the company's
// AiUsage rows, and the company's allowance is no longer spent by it.
// Translation's equivalent is its per-company daily draft cap
// (lib/i18n/autoTranslate.js's DAILY_DRAFT_CAP), not this.
//
// The owner's words for receipts: reading one costs FieldQuo ~0.2–0.4¢ and
// stays on FieldQuo, but /platform needs a per-feature switch so that can
// change without a deploy. The same switch is meant for every AI feature —
// hence a table keyed by feature, not a receipt setting.
//
// ══ "wired" is not decoration ══════════════════════════════════════════════
//
// A switch that is saved and read by nothing is the first failure class in
// AGENTS.md. So every feature below says whether its code actually calls
// meterFor(). /platform/ai-billing renders the switch ONLY for wired
// features; the rest are listed with the payer they WILL use and a plain
// "not routed through the switch yet — meters to the company's allowance
// today". scripts/check-receipt-books.mjs fails when a feature marked wired
// has no meterFor("<feature>") call site.
//
// ══ No rows are required ═══════════════════════════════════════════════════
//
// An absent AiFeaturePayer row means the registry default below — the seed
// the owner set (copilot, receipt_scan, translation → FieldQuo; the AI
// employee's two features → the company). The table only holds a superadmin's
// explicit change, so nothing had to be written to production to ship this.
import { db } from "@/lib/db";
import { checkAiQuota, recordAiUsage, getAiCap, allowanceVerdict, startOfMonth } from "./usage";
import { checkPlatformAiBudget, recordPlatformAiUsage } from "./platformUsage";
import { walletLedger } from "./walletMeter";

export const PAYERS = Object.freeze(["fieldquo", "company"]);

/**
 * Every feature the switch knows. English labels — the platform console is
 * FieldQuo's own staff surface, like lib/features/registry.js.
 */
export const PAYER_FEATURES = Object.freeze([
  Object.freeze({
    feature: "receipt_scan",
    label: "Receipt reading",
    blurb: "Reading a photographed or PDF receipt into lines, totals and tax (the receipts book and the job materials scanner).",
    defaultPayer: "fieldquo",
    wired: true,
  }),
  Object.freeze({
    feature: "copilot",
    label: "FieldQuo AI (in-app assistant)",
    blurb: "The assistant in /app answering questions about the company's own data.",
    defaultPayer: "fieldquo",
    // Per-company monthly ceiling while FieldQuo pays — see the header.
    fairUse: true,
    wired: true,
  }),
  Object.freeze({
    feature: "translation",
    label: "Translation drafts",
    blurb: "Drafting translations of a company's own client-facing text — auto-translation on save, the catalogue's \"fill in the blanks\" and a quote text block's draft.",
    defaultPayer: "fieldquo",
    // No monthly fair-use ceiling: translation's guard is the per-company
    // DAILY draft cap lib/i18n/autoTranslate.js already enforces (and the two
    // manual drafting routes now share), because the owner's rule is that a
    // company offering bilingual service must not be penalised for volume.
    wired: true,
  }),
  Object.freeze({
    feature: "ai_employee_reply",
    label: "AI employee replies",
    blurb: "The company's AI employee answering its customers — the company's paid AI, in dollars from its AI credit.",
    defaultPayer: "company",
    companyLedger: "wallet",
    wired: true,
  }),
  Object.freeze({
    feature: "ai_employee_front_desk",
    label: "AI employee front desk routing",
    blurb: "Routing an inbound conversation to one of the company's AI employees — charged from its AI credit with the replies.",
    defaultPayer: "company",
    companyLedger: "wallet",
    wired: true,
  }),
]);

/** Which company ledger a feature spends when the company pays: its monthly
 *  token "allowance", or its AI credit "wallet" in dollars. */
export function companyLedgerFor(feature) {
  return payerFeature(feature)?.companyLedger === "wallet" ? "wallet" : "allowance";
}

const BY_FEATURE = new Map(PAYER_FEATURES.map((f) => [f.feature, f]));

export function payerFeature(feature) {
  return BY_FEATURE.get(String(feature || "")) || null;
}

/** A stored value, validated. Anything else is not a payer and is ignored. */
export function normalisePayer(value) {
  return PAYERS.includes(value) ? value : null;
}

/**
 * The payer, pure: an explicit row wins, else the registry default, else the
 * company — the behaviour every unlisted feature had before this existed.
 */
export function resolvePayer(feature, row) {
  const stored = normalisePayer(row?.payer);
  if (stored) return stored;
  return payerFeature(feature)?.defaultPayer || "company";
}

// ── A 60-second cache, per server instance ───────────────────────────────────
//
// meterFor runs on every metered call; a table read each time is waste for a
// value a superadmin changes a few times a year. A change made on this
// instance clears it at once (setFeaturePayer); another instance picks it up
// within a minute, which is the lag the console states.
export const PAYER_CACHE_MS = 60_000;
const cache = new Map();

export function clearPayerCache() {
  cache.clear();
}

export async function payerFor(feature, { prisma = db, now = Date.now() } = {}) {
  const key = String(feature || "");
  const hit = cache.get(key);
  if (hit && now - hit.at < PAYER_CACHE_MS) return hit.payer;
  let row = null;
  try {
    row = await prisma.aiFeaturePayer.findUnique({ where: { feature: key } });
  } catch (err) {
    // Unreadable table → the registry default, not "company": a read failure
    // must not quietly move a FieldQuo-paid feature onto customers' quotas.
    console.error("[ai/featurePayer] read failed:", err?.message);
  }
  const payer = resolvePayer(key, row);
  cache.set(key, { payer, at: now });
  return payer;
}

/** Written by /api/platform/ai-billing only. Superadmin-checked there. */
export async function setFeaturePayer({ feature, payer, adminId, prisma = db }) {
  const f = payerFeature(feature);
  const p = normalisePayer(payer);
  if (!f || !p) return null;
  const row = await prisma.aiFeaturePayer.upsert({
    where: { feature: f.feature },
    create: { feature: f.feature, payer: p, updatedByAdminId: adminId || null },
    update: { payer: p, updatedByAdminId: adminId || null },
  });
  clearPayerCache();
  return row;
}

/** What a person is told when FieldQuo's own budget stops a call. The
 *  platform budget's reasons talk about prospecting — true for FieldQuo's
 *  staff, meaningless to a contractor at a till. */
export const PLATFORM_BUDGET_REFUSAL =
  "FieldQuo's AI is paused for a moment. Nothing was charged — try again later.";

/**
 * The metering pair for one feature and one company.
 *
 *   const meter = await meterFor("receipt_scan", { companyId, userId });
 *   const gate = await meter.check();          // BEFORE the call
 *   if (!gate.allowed) return refuse(gate.reason);
 *   ... complete({ ..., onUsage: (u) => { usage = u; } })
 *   if (usage) await meter.record(usage);      // AFTER, on every outcome
 *
 * `record` never throws — every ledger's writer already promises that.
 *
 * `record(usage, { ref, note, meta })`: `ref` is the wallet debit's
 * idempotency key and `note` its statement line (wallet features only);
 * `meta` is merged into a FieldQuo-ledger row's meta (auto-translation
 * records which field and language each draft was for).
 *
 * `now` and `deps` are seams for the check scripts — every function that
 * reads or writes the global client can be swapped for a scripted one.
 */
export async function meterFor(feature, { companyId, userId = null, prisma = db, now = null, deps = {} } = {}) {
  const {
    checkAiQuota: checkQuota = checkAiQuota,
    recordAiUsage: recordUsage = recordAiUsage,
    getAiCap: capFor = getAiCap,
    checkPlatformAiBudget: checkBudget = checkPlatformAiBudget,
    recordPlatformAiUsage: recordPlatform = recordPlatformAiUsage,
  } = deps;
  const spec = payerFeature(feature);
  const payer = await payerFor(feature, { prisma });

  if (payer === "fieldquo") {
    return {
      payer,
      ledger: "fieldquo",
      async check() {
        const budget = await checkBudget(prisma);
        if (!budget.allowed) return { allowed: false, reason: PLATFORM_BUDGET_REFUSAL, code: budget.reason };
        if (!spec?.fairUse || !companyId) return { allowed: true, reason: null };
        // The fair-use ceiling — the header's "Fair use on FieldQuo's card".
        const at = now || new Date();
        const [{ cap, source }, tokens] = await Promise.all([
          capFor(companyId),
          fieldquoTokensThisMonth(prisma, { companyId, feature, now: at }),
        ]);
        const verdict = allowanceVerdict({ usage: { tokens }, cap, source, now: at });
        return verdict.allowed
          ? { ...verdict, reason: null, code: null }
          : { ...verdict, code: "quota" };
      },
      async record(usage, { meta = null } = {}) {
        if (!usage) return null;
        const images = Number(usage.imageCount) || 0;
        const extra = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
        return recordPlatform(prisma, {
          // The same `_photos` split recordAiUsage makes, so a receipt read
          // costs the same line on either ledger.
          area: images > 0 ? `${feature}_photos` : feature,
          model: usage.model,
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          // companyId last: a caller's meta cannot re-attribute the spend.
          meta: { ...extra, userId: userId || null, feature, imageCount: images, companyId: companyId || null },
        });
      },
    };
  }

  if (spec?.companyLedger === "wallet") {
    return walletLedger(feature, { companyId, userId, prisma, now, deps: { ...deps, checkAiQuota: checkQuota, recordAiUsage: recordUsage } });
  }

  return {
    payer: "company",
    ledger: "allowance",
    async check() {
      const quota = await checkQuota(companyId);
      // The allowance's own figures ride along (used, cap, nearLimit) so a
      // screen that warns at 80% keeps warning whichever ledger is active.
      return quota.allowed ? { ...quota, allowed: true, reason: null, code: null } : { ...quota, allowed: false, code: "quota" };
    },
    async record(usage) {
      if (!usage) return null;
      return recordUsage({
        companyId,
        feature,
        model: usage.model,
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        userId,
        imageCount: usage.imageCount || 0,
      });
    },
  };
}

/**
 * Tokens FieldQuo has paid for on one company's behalf for one feature this
 * allowance month — the fair-use ceiling's numerator. The company lives in the
 * row's meta (PlatformAiUsage has no companyId column; lib/i18n/autoTranslate.js's
 * draftsToday reads it the same way).
 */
export async function fieldquoTokensThisMonth(prisma, { companyId, feature, now = new Date() }) {
  const agg = await prisma.platformAiUsage.aggregate({
    where: {
      area: { in: [feature, `${feature}_photos`] },
      createdAt: { gte: startOfMonth(now) },
      meta: { path: ["companyId"], equals: companyId },
    },
    _sum: { totalTokens: true },
  });
  return Number(agg?._sum?.totalTokens) || 0;
}
