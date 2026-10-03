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
// A refused answer, an AI outage, an unconfigured key and a company with no AI credit
// all land in the same place: the catalogue's own sentence for each of the top
// three facts. Plainer text, never a broken email — the email is complete
// without the model, which is what makes the fence safe to be strict.
//
// ══ Cost ═══════════════════════════════════════════════════════════════════
//
// At most ONE call per company per month, and ONLY for a company with AI
// credit, charged to that credit (owner, 2026-10-03 — see buildDigestInsights).
// Every other company gets the catalogue sentences and is never charged. Measured
// on the demo fixture by characters/4 (no key on a dev machine to read real
// usage): input ≈ 610 tokens (system + six facts + the strict schema) against
// ≈ 170 for the old JSON-blob prompt; output ≈ 100 tokens of JSON against
// ≈ 80 of paragraph; maxTokens 400, down from 500. On a mini model that is
// about a hundredth of a cent more per company per month. Recipients whose
// language differs from the company's get the catalogue sentences in their
// language rather than a second call.

import { complete } from "./provider";
import { meterFor } from "./featurePayer";
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

/** The AiUsage feature, the wallet kind and the featurePayer entry — one name. */
export const DIGEST_FEATURE = "monthly_digest";

/**
 * The model's reworded insight sentences — only for a company with AI credit,
 * paid from it, and fenced.
 *
 * ══ Who gets it, and who pays (owner, 2026-10-03) ══════════════════════════
 *
 * "Only for the companies that have the membership token, and it is taken
 * from theirs. It is auto enabled." The entitlement is the one the company's
 * other paid AI already uses: meterFor("monthly_digest") resolves to the
 * company's AI-credit WALLET (lib/ai/featurePayer.js companyLedger "wallet",
 * lib/ai/walletMeter.js) — funded by an AI credit bundle or a top-up, exactly
 * like the AI employee. Its check() asks whether the wallet can cover one
 * call; there is no toggle, so every company with credit gets it.
 *
 *   • A company WITHOUT AI credit: check() refuses with code "no_credit", no
 *     model is called, nothing is recorded or debited, nothing is logged as
 *     an error (it is the normal case, not a fault) — the email uses the
 *     catalogue's own sentences.
 *   • A company WITH AI credit: the call runs, and record() writes the AiUsage
 *     row (paidFromWallet, so it is not ALSO counted against the monthly
 *     token allowance) and debits the wallet at cost × the pay-as-you-go
 *     multiplier, once per company per month (`ref`).
 *
 * Before this, the call was made for EVERY company and counted against each
 * company's monthly token allowance (checkAiQuota / recordAiUsage, feature
 * monthly_digest) — no dollars moved, but the company's included allowance
 * was spent on a summary it never asked for.
 *
 * Any other refusal (a superadmin moved the feature onto FieldQuo's budget and
 * that budget is spent) IS logged, because that one is a fault.
 * scripts/check-ai-credit.mjs and scripts/check-monthly-summary.mjs execute
 * this with every dependency faked; the first mutates the gate away to prove
 * it is load-bearing.
 *
 * @returns {{ chosen: object[]|null, sentences: Array<{text, html}>|null, aiSkipped: boolean,
 *             aiRejected: string|null, skipCode: string|null, ledger: string|null, chargedCents: number }}
 *   `sentences: null` means "use the catalogue sentences".
 */
export async function buildDigestInsights({
  companyId,
  companyName,
  facts,
  fmt,
  periodStart,
  periodEnd,
  periodKey = null,
  meter = null,
  complete: completeFn = complete,
  recordError: recordErrorFn = recordError,
}) {
  const candidates = (facts || []).slice(0, AI_FACTS);
  const none = { chosen: null, sentences: null, aiSkipped: false, aiRejected: null, skipCode: null, ledger: null, chargedCents: 0 };
  // Nothing worth acting on is a fact, not a reason to spend a call.
  if (!candidates.length) return { ...none, chosen: [], sentences: [] };

  const m = meter || (await meterFor("monthly_digest", { companyId }));
  const gate = await m.check();

  if (!gate.allowed) {
    if (gate.code !== "no_credit") {
      await recordErrorFn({
        area: "ai",
        code: "monthly_digest_ai_refused",
        message: `Monthly summary for ${companyName || companyId} sent with its standard sentences — the AI call was refused (${gate.code || "refused"}).`,
        companyId,
        detail: { periodStart, periodEnd, ledger: m.ledger, code: gate.code || null },
      });
    }
    return { ...none, aiSkipped: true, skipCode: gate.code || "refused", ledger: m.ledger };
  }

  let usage = null;
  const result = await completeFn({
    onUsage: (u) => {
      usage = u;
    },
    system: withLanguage(DIGEST_SYSTEM, fmt.lang),
    prompt: digestPrompt({ companyName, facts: candidates, fmt }),
    schema: digestSchema(candidates.map((f) => f.key)),
    schemaName: "monthly_digest_insights",
    maxTokens: 400,
  });

  // Recorded on every outcome that spent — a refused or off-fence answer was
  // still generated and billed by the vendor.
  let chargedCents = 0;
  if (usage) {
    const rec = await m.record(usage, {
      ref: `${DIGEST_FEATURE}:${companyId}:${periodKey || (periodStart ? new Date(periodStart).toISOString().slice(0, 7) : "")}`,
      note: "Monthly summary — AI-worded insights",
    });
    chargedCents = Number(rec?.chargedCents) || 0;
  }

  if (!result || result.ok !== true) {
    return { ...none, aiRejected: result?.reason || "no_answer", ledger: m.ledger, chargedCents };
  }
  const fenced = fenceInsights(result.data, candidates);
  if (!fenced.ok) {
    return { ...none, aiRejected: fenced.reason, ledger: m.ledger, chargedCents };
  }
  return {
    ...none,
    chosen: fenced.items.map((i) => i.fact),
    sentences: fenced.items.map((i) => fmt.fill(i.template, i.fact.values)),
    ledger: m.ledger,
    chargedCents,
  };
}


/** The call-notes feature (lib/ai/callTranscriptDigest.js FEATURE). */
export const CALLS_FEATURE = "monthly_digest_calls";

/**
 * The phone-call notes stored on the digest — only for a company with AI
 * credit, charged to that credit (owner, 2026-10-03, the same rule as the
 * insights).
 *
 * The wallet is asked FIRST, before a single quote or transcript is read: a
 * company without AI credit gets `null` — the archive's call-notes section is
 * then simply absent, the way it is on digests written before it existed — and
 * nothing is called, recorded, debited or counted against an allowance.
 * Before this, buildCallInsights ran for every company with decided quotes
 * linked to calls and spent the company's monthly token allowance.
 *
 * With credit, buildCallInsights runs with the meter, so its own check and its
 * usage go to the wallet (AiUsage paidFromWallet + one debit, keyed per company
 * per month).
 *
 * @returns {Promise<object|null>}
 */
export async function digestCallInsights({ companyId, period, meter = null, buildCallInsights: buildFn = buildCallInsights }) {
  const m = meter || (await meterFor("monthly_digest_calls", { companyId }));
  const gate = await m.check();
  if (!gate.allowed) return null;
  return buildFn({
    companyId,
    from: period.start,
    to: new Date(period.end.getTime() - 1),
    meter: m,
    meterRef: `${CALLS_FEATURE}:${companyId}:${period.key}`,
  });
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
    periodKey: summary.period.key,
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
  // Stored for the in-app archive; not part of the email. Only for a company
  // with AI credit, paid from it — see digestCallInsights.
  const callInsights = await digestCallInsights({ companyId, period: summary.period });

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
        // aiSkipped stays the archive's "your AI allowance is used up" line,
        // so it is NOT set for a company without AI credit — for them the
        // standard sentences are the product working, not a skip.
        aiSkipped: ai.aiSkipped && ai.skipCode !== "no_credit",
        aiRejected: ai.aiRejected,
        // How the insights were worded and paid: "ai" (charged to the
        // company's AI credit), "standard" (no AI credit, nothing charged),
        // or "standard_after_ai" (the model failed or answered off-fence).
        insightSource: ai.sentences ? "ai" : ai.skipCode === "no_credit" ? "standard" : "standard_after_ai",
        aiLedger: ai.ledger,
        aiChargedCents: ai.chargedCents,
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
