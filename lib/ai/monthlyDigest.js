// lib/ai/monthlyDigest.js
//
// The monthly summary email, run by app/api/cron/monthly-digest on the 1st for
// every active company, sent to its active owners and admins.
//
// ══ What changed on 2026-10-03, and why ════════════════════════════════════
//
// This used to hand a model a JSON blob and email back whatever paragraph it
// wrote, as `<p>${summaryText}</p>`. Two separate failures showed in the
// owner's September copy:
//
//   1. WRONG MONTH. getAnalyticsOverview() was called with no date at 08:00 on
//      the 1st, so revenue, expenses and quotes were October's first eight
//      hours ("Revenue and expenses were both 0 this month… created 0
//      quotes") beside a lead count that was September's. The numbers now come
//      from lib/analytics/monthlySummaryData.js, which asks every existing
//      loader about the month being reported.
//   2. THE MODEL OWNED THE PAGE. Money with no currency, FX plumbing ("converted
//      from USD 261.11 at 1.3888, rate 34 days old"), one paragraph. The email
//      is now built in code (lib/email/monthlySummaryEmail.js) and the model's
//      job shrinks to the one thing prose is good for: wording the "what to act
//      on" lines.
//
// ══ The fence (same discipline as lib/site/generateSite.js) ════════════════
//
// The model is handed FACTS — each an id, a catalogue sentence with
// {placeholders} and the values behind them — and returns up to three
// sentences in that same placeholder form. fenceInsights() then REFUSES the
// whole answer if any sentence:
//
//   • names a fact it was not given, or one twice
//   • uses a placeholder that fact does not have
//   • contains a digit, a currency sign or a % of its own — every number is
//     ours, filled in by lib/email/monthlySummaryEmail.js's formatter
//   • is empty, runs long, or carries markup
//
// A refused answer, an AI outage, an unconfigured key and an exhausted quota
// all land in the same place: the catalogue's own sentence for each of the top
// three facts. Plainer text, never a broken email — the email is complete
// without the model, which is what makes the fence safe to be strict.
//
// ══ Cost ═══════════════════════════════════════════════════════════════════
//
// Still ONE call per company per month, metered as `monthly_digest`. Measured
// on the demo fixture by characters/4 (no key on a dev machine to read real
// usage): input ≈ 610 tokens (system + six facts + the strict schema) against
// ≈ 170 for the old JSON-blob prompt; output ≈ 100 tokens of JSON against
// ≈ 80 of paragraph; maxTokens 400, down from 500. On a mini model that is
// about a hundredth of a cent more per company per month. Recipients whose
// language differs from the company's get the catalogue sentences in their
// language rather than a second call.

import { complete } from "./provider";
import { checkAiQuota, recordAiUsage } from "./usage";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { buildCallInsights } from "./callTranscriptDigest";
import { recordError } from "@/lib/platform/errorLog";
import { withLanguage } from "@/lib/i18n/aiLanguage";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { loadMonthlySummary } from "@/lib/analytics/monthlySummaryData";
import {
  buildMonthlySummaryEmail,
  summaryFormatter,
  summaryLanguage,
} from "@/lib/email/monthlySummaryEmail";

/** How many ranked facts the model may choose its three from. */
export const AI_FACTS = 6;
/** How many sentences come back. */
export const AI_INSIGHTS = 3;
/** Longest sentence the fence accepts, in characters, placeholders included. */
export const AI_SENTENCE_MAX = 260;

const PLACEHOLDER = /\{(\w+)\}/g;

export const DIGEST_SYSTEM =
  "You write the 'what to act on' lines of a home-service contractor's monthly business summary. " +
  "You are given facts, each with an id, a sentence template and the values behind its placeholders. " +
  "Pick the facts that matter most to the owner's cash and workload this week (at most three) and write ONE short, specific, practical sentence for each, in plain words a tradesperson uses. " +
  "Rules: write every amount, count, percentage, month or source ONLY as the placeholder given for it, in curly braces — for example {overdueAmount}; " +
  "never write a digit, a currency sign or a percent sign yourself; use only the placeholders of the fact you are writing about; " +
  "do not invent causes, figures or facts that are not given; no greeting, no headings, no markdown.";

/** The JSON shape the model must return. Strict: no extra keys. */
export function digestSchema(factKeys) {
  return {
    type: "object",
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fact: { type: "string", enum: factKeys },
            text: { type: "string" },
          },
          required: ["fact", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["insights"],
    additionalProperties: false,
  };
}

/** The user prompt: facts, their English templates, and the values in the reader's format. */
export function digestPrompt({ companyName, facts, fmt }) {
  const en = APP_MESSAGES.en;
  const lines = facts.map((f) => {
    const values = fmt.renderValues(f.values);
    const placeholders = Object.entries(values)
      .map(([k, v]) => `{${k}} = ${JSON.stringify(v)}`)
      .join("; ");
    return `- id: ${f.key}\n  template: ${en[`app.monthlySummary.insight.${f.key}`]}\n  placeholders: ${placeholders}`;
  });
  return `Company: ${companyName}.\nFacts, most important first:\n${lines.join("\n")}`;
}

/**
 * Accept the model's answer only if every sentence stays inside the fence.
 *
 * @returns {{ ok: true, items: Array<{ fact: object, template: string }> } | { ok: false, reason: string }}
 */
export function fenceInsights(data, facts) {
  const byKey = new Map((facts || []).map((f) => [f.key, f]));
  const list = data?.insights;
  if (!Array.isArray(list) || list.length === 0) return { ok: false, reason: "no_insights" };
  if (list.length > AI_INSIGHTS) return { ok: false, reason: "too_many" };
  const seen = new Set();
  const items = [];
  for (const item of list) {
    const fact = byKey.get(item?.fact);
    if (!fact) return { ok: false, reason: `unknown_fact:${item?.fact}` };
    if (seen.has(fact.key)) return { ok: false, reason: `duplicate_fact:${fact.key}` };
    seen.add(fact.key);
    const text = String(item?.text ?? "").trim();
    if (text.length < 10 || text.length > AI_SENTENCE_MAX) return { ok: false, reason: `length:${fact.key}` };
    if (/[<>`*#]/.test(text)) return { ok: false, reason: `markup:${fact.key}` };
    const allowed = new Set(Object.keys(fact.values || {}));
    for (const m of text.matchAll(PLACEHOLDER)) {
      if (!allowed.has(m[1])) return { ok: false, reason: `placeholder:${fact.key}:${m[1]}` };
    }
    const bare = text.replace(PLACEHOLDER, "");
    if (/[{}]/.test(bare)) return { ok: false, reason: `brace:${fact.key}` };
    // Any script's digits (\p{Nd}), not just 0-9 — a model writing Punjabi may
    // reach for Gurmukhi numerals.
    if (/\p{Nd}/u.test(bare)) return { ok: false, reason: `digit:${fact.key}` };
    if (/[$€£¥₹%]|\b(?:USD|CAD|EUR|GBP|AUD)\b/.test(bare)) return { ok: false, reason: `money_or_percent:${fact.key}` };
    items.push({ fact, template: text });
  }
  return { ok: true, items };
}

/**
 * The model's reworded insight sentences, quota-gated and fenced.
 *
 * Over the monthly AI allowance the email still goes — every number in it is
 * computed in code and costs nothing — with the catalogue's own sentences in
 * place of the model's, and the skip is logged on /platform/errors where
 * support looks (a company chronically over cap is visible there, not only
 * to its owner). The quota is checked BEFORE the call (AGENTS.md: checkAiQuota
 * before, recordAiUsage after, on every path); scripts/check-ai-credit.mjs
 * executes this with every dependency faked and mutates the gate away to prove
 * it is load-bearing.
 *
 * @returns {{ chosen: object[]|null, sentences: Array<{text, html}>|null, aiSkipped: boolean, aiRejected: string|null }}
 *   `sentences: null` means "use the catalogue sentences".
 */
export async function buildDigestInsights({
  companyId,
  companyName,
  facts,
  fmt,
  periodStart,
  periodEnd,
  checkAiQuota: checkQuotaFn = checkAiQuota,
  complete: completeFn = complete,
  recordAiUsage: recordUsageFn = recordAiUsage,
  recordError: recordErrorFn = recordError,
}) {
  const candidates = (facts || []).slice(0, AI_FACTS);
  // Nothing worth acting on is a fact, not a reason to spend a call.
  if (!candidates.length) return { chosen: [], sentences: [], aiSkipped: false, aiRejected: null };

  const quota = await checkQuotaFn(companyId);

  if (!quota.allowed) {
    await recordErrorFn({
      area: "ai",
      code: "monthly_digest_quota_exceeded",
      message: `Monthly summary for ${companyName || companyId} sent with its standard sentences — company is over its monthly AI allowance.`,
      companyId,
      detail: { periodStart, periodEnd, cap: quota.cap, usageTokens: quota.usage?.tokens },
    });
    return { chosen: null, sentences: null, aiSkipped: true, aiRejected: null };
  }

  const result = await completeFn({
    onUsage: (u) => recordUsageFn({ companyId, feature: "monthly_digest", ...u }),
    system: withLanguage(DIGEST_SYSTEM, fmt.lang),
    prompt: digestPrompt({ companyName, facts: candidates, fmt }),
    schema: digestSchema(candidates.map((f) => f.key)),
    schemaName: "monthly_digest_insights",
    maxTokens: 400,
  });

  if (!result || result.ok !== true) {
    return { chosen: null, sentences: null, aiSkipped: false, aiRejected: result?.reason || "no_answer" };
  }
  const fenced = fenceInsights(result.data, candidates);
  if (!fenced.ok) {
    return { chosen: null, sentences: null, aiSkipped: false, aiRejected: fenced.reason };
  }
  return {
    chosen: fenced.items.map((i) => i.fact),
    sentences: fenced.items.map((i) => fmt.fill(i.template, i.fact.values)),
    aiSkipped: false,
    aiRejected: null,
  };
}

/**
 * The tiles as label → formatted text, in the company's language, for the
 * AiDigest row the in-app archive (app/app/analytics/digest) renders as a
 * grid. Formatted here so the archive can never show a bare 0 or a number
 * with no currency — the two things the email was fixed for.
 */
export function digestMetrics(summary, fmt) {
  const k = (key) => fmt.t(`app.monthlySummary.${key}`);
  const na = (m) => {
    const v = fmt.t(`app.monthlySummary.na.${m.reason}`);
    return v === `app.monthlySummary.na.${m.reason}` ? k("na.unavailable") : v;
  };
  const money = (m) => (m.available ? fmt.money(m.value, m.approximate) : na(m));
  const count = (m) => (m.available ? fmt.intFmt.format(m.value) : na(m));
  const t = summary.tiles;
  return {
    [k("tile.invoiced")]: money(t.invoiced),
    [k("tile.collected")]: money(t.collected),
    [k("tile.leads")]: count(t.leads),
    [k("tile.quotes")]: count(t.quotesSent),
    [k("funnel.accepted")]: count(t.quotesAccepted),
    [k("tile.jobs")]: count(t.jobs),
    [k("tile.spend")]: money(t.spend),
    [k("tile.cpl")]: money(t.costPerLead),
  };
}

export async function generateMonthlyDigest({ companyId, periodStart, periodEnd, origin, asOf = new Date() }) {
  if (!origin) throw new Error("generateMonthlyDigest: origin is required for the email's links");
  const { company, summary, failures } = await loadMonthlySummary({ db, companyId, periodStart, asOf });

  if (failures.length) {
    // The email still goes without those sections; this says which and why.
    await recordError({
      area: "cron",
      code: "monthly_digest_section_failed",
      message: `Monthly summary for ${company.name || companyId} left out: ${failures.map((f) => f.split(":")[0]).join(", ")}.`,
      companyId,
      detail: { failures, periodStart, periodEnd },
    });
  }

  const companyLang = summaryLanguage(company.defaultLanguage);
  const fmt = summaryFormatter({ language: companyLang, currency: company.currency });

  const ai = await buildDigestInsights({
    companyId,
    companyName: company.name,
    facts: summary.candidates,
    fmt,
    periodStart,
    periodEnd,
  });

  // The company-language email: the model's sentences when it passed the
  // fence, the catalogue's otherwise.
  const primary = ai.sentences
    ? buildMonthlySummaryEmail({ summary: { ...summary, insights: ai.chosen }, company, language: companyLang, origin, insights: ai.sentences })
    : buildMonthlySummaryEmail({ summary, company, language: companyLang, origin });

  // The conversations behind the quotes above, not the numbers again. See
  // lib/ai/callTranscriptDigest.js's header for why this is the one place an
  // AI-authored addition was welcomed onto this report while
  // lib/analytics/winLoss.js and lib/analytics/estimateAccuracy.js both
  // stayed model-free on purpose. Metered under its own feature name.
  // Stored for the in-app archive; not part of the email.
  const callInsights = await buildCallInsights({
    companyId,
    from: summary.period.start,
    to: new Date(summary.period.end.getTime() - 1),
  });

  const summaryText = [primary.headline, ...primary.insights.map((s) => `• ${s.text}`)].join("\n");

  const digest = await db.aiDigest.create({
    data: {
      companyId,
      periodStart,
      periodEnd,
      summaryText,
      // aiSkipped: written and read (app/app/analytics/digest prints a line
      // for it). aiRejected names why a model answer was not used — the
      // fence's reason, or the provider's failure — so a month of plainer
      // sentences can be explained from the row.
      highlightsJson: {
        version: 2,
        metrics: digestMetrics(summary, fmt),
        flags: [],
        insightFacts: (ai.chosen || summary.insights).map((f) => f.key),
        callInsights,
        aiSkipped: ai.aiSkipped,
        aiRejected: ai.aiRejected,
        sectionsFailed: failures.map((f) => f.split(":")[0]),
      },
    },
  });

  const owners = await db.member.findMany({
    where: { companyId, role: { in: ["owner", "admin"] }, active: true },
    include: { user: true },
  });

  for (const owner of owners) {
    if (!owner.user.email) continue;
    // The reader's interface language, else the company's — the same
    // precedence User.language documents. A different language gets the
    // catalogue's sentences in it rather than a second model call.
    const lang = summaryLanguage(owner.user.language || company.defaultLanguage);
    const email = lang === companyLang ? primary : buildMonthlySummaryEmail({ summary, company, language: lang, origin });
    await sendEmail({
      // The digest is about ONE company's month, so it is that company's mail
      // even though FieldQuo signs it. A demo's digest is simulated.
      companyId,
      from: `FieldQuo <digest@fieldquo.com>`,
      to: owner.user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }

  await db.aiDigest.update({
    where: { id: digest.id },
    data: { sentAt: new Date() },
  });

  return digest;
}
