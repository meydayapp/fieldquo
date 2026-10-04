// lib/email/templateTranslationStore.js
//
// Reading and writing TemplateTranslation rows — the server half of
// lib/email/templateTranslation.js (which says what a translation IS and
// when one may be used; this file drafts, stores, reviews and loads them).
//
// ══ One model call per template version per language ═══════════════════════
//
// draftTemplateTranslation() is the only place a template is sent to a model,
// and it runs only when a person presses Translate, Update or Regenerate in
// the template's Translations panel. Never at send time: the campaign send
// and the follow-up cron call translationsForSend(), which only READS approved
// rows. A re-draft sends only the strings whose source changed since the last
// draft (their `src` no longer matches); Regenerate (`full`) sends them all.
//
// Every model call goes through lib/ai/provider.js's complete() and is
// metered by lib/ai/emailTranslationMeter.js — checked BEFORE the call,
// recorded AFTER it on whichever ledger paid, the measured cost stored on the
// row for the panel to show.

import { db } from "@/lib/db";
import { complete as realComplete, isAiConfigured as realIsAiConfigured } from "@/lib/ai/provider";
import { LANGUAGES, LANGUAGE_CODES, isSupported } from "@/app/i18n/languages";
import {
  emailTranslationMeter as realMeter,
  estimateTranslationMicros,
  EMAIL_TRANSLATION_TIER,
} from "@/lib/ai/emailTranslationMeter";
import {
  extractStrings,
  templateSourceHash,
  templateLanguageOf,
  translatableChars,
  protectText,
  acceptModelString,
  checkHumanEdit,
  translationUnusableReason,
  MAX_TRANSLATABLE_CHARS,
} from "./templateTranslation.js";

const languageName = (code) => LANGUAGES.find((l) => l.code === code)?.name || code;

/** Every language a template written in `source` can be translated into. */
export function targetLanguagesFor(source) {
  return LANGUAGE_CODES.filter((c) => c !== source);
}

// ── The prompt ──────────────────────────────────────────────────────────────

function systemPrompt(from, to) {
  return [
    `You translate a small trades business's own email to its customers from ${languageName(from)} into ${languageName(to)}.`,
    "The writer is a contractor (painter, plumber, cabinet maker…) writing to a homeowner. Keep their tone — friendly, plain, professional — and translate the meaning naturally for a native reader, not word for word. Do not add or drop sentences, offers, prices or promises.",
    "Markers like ⟦1⟧, ⟦2⟧ stand for things software fills in or that must not change: the client's name, links, amounts of money, formatting. Copy every marker EXACTLY, exactly once each, wherever it belongs in the translated sentence. Never translate, renumber, remove, repeat or invent a marker, and never write curly-brace placeholders of your own.",
    "Keep line breaks (\\n) and bullet characters (•, -) where they are. Leave the company's name, product names and brand names as written.",
    'Return JSON: {"strings":[{"id","text"}]} with exactly the ids you were given, one entry each.',
  ].join("\n");
}

const SCHEMA = {
  type: "object",
  properties: {
    strings: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, text: { type: "string" } },
        required: ["id", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["strings"],
  additionalProperties: false,
};

/**
 * Pair the model's reply with the strings asked for, verifying each.
 * Unknown ids are ignored, a repeated id counts once (the first), a missing
 * one is a problem. Pure — the check script feeds it hostile replies.
 *
 * @returns {{ strings: object, problems: Array<{path, reason, detail?}> }}
 */
export function acceptModelReply(items, data) {
  const byId = new Map();
  for (const entry of Array.isArray(data?.strings) ? data.strings : []) {
    const id = String(entry?.id ?? "");
    if (id && !byId.has(id)) byId.set(id, entry?.text);
  }
  const strings = {};
  const problems = [];
  for (const item of items) {
    const out = byId.get(item.id);
    if (typeof out !== "string") {
      problems.push({ path: item.path, reason: "missing" });
      strings[item.path] = { src: item.source, text: "" };
      continue;
    }
    const verdict = acceptModelString(item.source, out);
    if (verdict.ok) {
      strings[item.path] = { src: item.source, text: verdict.text };
    } else {
      // REFUSED: the reply's text is not kept — not even for a person to
      // fix — because a string that lost a token reads fine and sends wrong.
      // A person writes it, or presses Regenerate.
      problems.push({ path: item.path, reason: verdict.reason, ...(verdict.detail ? { detail: verdict.detail } : {}) });
      strings[item.path] = { src: item.source, text: "" };
    }
  }
  return { strings, problems };
}

// ── Drafting ────────────────────────────────────────────────────────────────

/**
 * Draft (or update) one template's translation into one language.
 *
 * @param template  the DocumentTemplate row, already checked to be the company's
 * @param company   { id, defaultLanguage }
 * @param full      true = Regenerate every string; false = only what changed
 * @returns {{ ok: true, row, problems, paid, reused } |
 *           { ok: false, code, reason?, estimateMicros?, paid? }}
 */
export async function draftTemplateTranslation({
  template,
  company,
  language,
  userId = null,
  full = false,
  prisma = db,
  now = new Date(),
  deps = {},
}) {
  const {
    complete = realComplete,
    isAiConfigured = realIsAiConfigured,
    emailTranslationMeter = realMeter,
  } = deps;
  const lang = String(language || "").toLowerCase();
  const source = templateLanguageOf(template, company);
  if (!isSupported(lang)) return { ok: false, code: "bad_language" };
  if (lang === source) return { ok: false, code: "same_language" };

  const strings = extractStrings(template);
  if (strings.length === 0) return { ok: false, code: "nothing_to_translate" };
  const hash = templateSourceHash(template, source);

  const existing = await prisma.templateTranslation.findUnique({
    where: { templateId_language: { templateId: template.id, language: lang } },
  });
  const previous = existing?.strings && typeof existing.strings === "object" ? existing.strings : {};
  // A translation drafted from another source language cannot be reused.
  const reusable = existing && existing.sourceLanguage === source && !full;

  const kept = {};
  const toTranslate = [];
  for (const s of strings) {
    const prev = previous[s.path];
    if (reusable && prev && prev.src === s.text && typeof prev.text === "string" && prev.text.trim() && !checkHumanEdit(s.text, prev.text)) {
      kept[s.path] = prev;
    } else {
      toTranslate.push(s);
    }
  }

  // Nothing moved that needs words — a block removed, or reordered. The row
  // follows the new version without a model call and keeps its status.
  if (toTranslate.length === 0) {
    const row = await prisma.templateTranslation.update({
      where: { id: existing.id },
      data: { strings: kept, sourceHash: hash, sourceLanguage: source, problems: null },
    });
    return { ok: true, row, problems: [], paid: { billing: null, chargedCents: 0, costMicros: 0 }, reused: strings.length };
  }

  const chars = translatableChars(toTranslate);
  if (translatableChars(strings) > MAX_TRANSLATABLE_CHARS) {
    return { ok: false, code: "too_long" };
  }
  if (!isAiConfigured()) return { ok: false, code: "ai_unavailable" };

  const estimateMicros = estimateTranslationMicros({ chars, strings: toTranslate.length, from: source, to: lang });
  const meter = await emailTranslationMeter({ companyId: company.id, userId, estimateMicros, prisma, now });
  const gate = await meter.check();
  if (!gate.allowed) return { ok: false, code: gate.code || "refused", reason: gate.reason || null, estimateMicros };

  const items = toTranslate.map((s, i) => ({ id: `s${i + 1}`, path: s.path, source: s.text, protectedText: protectText(s.text).text }));
  let usage = null;
  const result = await complete({
    system: systemPrompt(source, lang),
    prompt: JSON.stringify({ from: languageName(source), to: languageName(lang), strings: items.map((it) => ({ id: it.id, text: it.protectedText })) }),
    tier: EMAIL_TRANSLATION_TIER,
    // Room for a language that runs longer than the source plus reasoning,
    // never a ceiling that truncates a paragraph — and a hard top so a
    // pathological template cannot ask for an unbounded reply.
    maxTokens: Math.min(32_000, Math.max(1_500, Math.ceil(chars * 1.2))),
    schema: SCHEMA,
    schemaName: "email_translation",
    onUsage: (u) => {
      usage = u;
    },
  });

  // Recorded on every outcome that spent, before anything about the reply is
  // decided — a refused reply was still generated and billed.
  const drafts = (existing?.drafts || 0) + 1;
  const paid = usage
    ? await meter.record(usage, {
        ref: `email_translation:${template.id}:${lang}:${drafts}:${hash}`,
        note: `Email translation — ${String(template.name || "template").slice(0, 60)} → ${languageName(lang)}`,
        meta: { templateId: template.id, language: lang },
      })
    : { billing: null, chargedCents: 0, costMicros: 0 };

  const costFields = {
    model: usage?.model || null,
    promptTokens: usage?.promptTokens || 0,
    completionTokens: usage?.completionTokens || 0,
    cachedTokens: usage?.cachedTokens || 0,
    costMicros: paid.costMicros || 0,
    billing: paid.billing || null,
    chargedCents: paid.chargedCents || 0,
    draftedAt: now,
    draftedById: userId,
  };

  if (!result?.ok) {
    // The spend is on the ledger; the row (if any) carries it too so the
    // panel's total is honest. Its words are untouched.
    if (existing && usage) {
      await prisma.templateTranslation.update({
        where: { id: existing.id },
        data: { totalCostMicros: { increment: paid.costMicros || 0 }, drafts: { increment: 1 } },
      });
    }
    return { ok: false, code: "model_failed", reason: result?.reason || null, paid };
  }

  const { strings: drafted, problems } = acceptModelReply(items, result.data);
  const allStrings = { ...kept, ...drafted };
  const data = {
    sourceLanguage: source,
    sourceHash: hash,
    strings: allStrings,
    status: "draft",
    problems: problems.length ? problems : null,
    approvedAt: null,
    approvedById: null,
    ...costFields,
  };
  const row = existing
    ? await prisma.templateTranslation.update({
        where: { id: existing.id },
        data: {
          ...data,
          previousStrings: existing.strings ?? null,
          totalCostMicros: { increment: paid.costMicros || 0 },
          drafts: { increment: 1 },
        },
      })
    : await prisma.templateTranslation.create({
        data: {
          ...data,
          companyId: company.id,
          templateId: template.id,
          language: lang,
          totalCostMicros: paid.costMicros || 0,
          drafts: 1,
        },
      });
  return { ok: true, row, problems, paid, reused: Object.keys(kept).length };
}

/**
 * "Write it yourself": an empty draft a person fills in by hand — no model,
 * no cost. For a deployment with no AI, a company without credit past the
 * free allowance, or anyone who would rather write their own Spanish. An
 * existing row is returned untouched, so a second press never wipes words.
 */
export async function startManualTranslation({ template, company, language, prisma = db }) {
  const lang = String(language || "").toLowerCase();
  const source = templateLanguageOf(template, company);
  if (!isSupported(lang)) return { ok: false, code: "bad_language" };
  if (lang === source) return { ok: false, code: "same_language" };
  const strings = extractStrings(template);
  if (strings.length === 0) return { ok: false, code: "nothing_to_translate" };
  const existing = await prisma.templateTranslation.findUnique({
    where: { templateId_language: { templateId: template.id, language: lang } },
  });
  if (existing) return { ok: true, row: existing, created: false };
  const row = await prisma.templateTranslation.create({
    data: {
      companyId: company.id,
      templateId: template.id,
      language: lang,
      sourceLanguage: source,
      sourceHash: templateSourceHash(template, source),
      strings: Object.fromEntries(strings.map((s) => [s.path, { src: s.text, text: "" }])),
      status: "draft",
    },
  });
  return { ok: true, row, created: true };
}

// ── A person's review ───────────────────────────────────────────────────────

/**
 * Save a person's edits to a translation, and approve or withdraw it.
 *
 * Every edited string is held to the token rule (checkHumanEdit); one that
 * drops or adds a {{token}} refuses the WHOLE save, so nothing half-applies.
 * Approval is refused unless the result is usable as it stands: complete,
 * current and token-clean — the same test the send path applies.
 *
 * @param edits    { "<path>": "text" }
 * @param approve  true = approve, false = stop using, undefined = leave as is
 */
export async function reviewTemplateTranslation({ row, template, company, edits = {}, approve, userId = null, prisma = db, now = new Date() }) {
  const source = templateLanguageOf(template, company);
  const current = new Map(extractStrings(template).map((s) => [s.path, s.text]));
  const strings = { ...(row.strings && typeof row.strings === "object" ? row.strings : {}) };
  const errors = [];
  for (const [path, text] of Object.entries(edits && typeof edits === "object" ? edits : {})) {
    if (!current.has(path)) continue; // a string the template no longer has
    const value = String(text ?? "");
    const problem = checkHumanEdit(current.get(path), value);
    if (problem) {
      errors.push({ path, ...problem });
      continue;
    }
    strings[path] = { src: current.get(path), text: value, edited: true };
  }
  if (errors.length) return { ok: false, code: "token_mismatch", errors };

  // Only the strings the template still has, and only problems still open.
  const kept = {};
  for (const path of current.keys()) if (strings[path]) kept[path] = strings[path];
  const openProblems = (Array.isArray(row.problems) ? row.problems : []).filter((p) => {
    const entry = kept[p.path];
    return !(entry && entry.text && entry.text.trim() && entry.src === current.get(p.path));
  });
  // Every current string present and drafted from the current wording → the
  // row now describes the current version.
  const upToDate = [...current.entries()].every(([path, text]) => kept[path]?.src === text && kept[path]?.text?.trim());
  const sourceHash = upToDate ? templateSourceHash(template, source) : row.sourceHash;

  let status = row.status;
  if (approve === true) {
    const why = translationUnusableReason(template, { ...row, strings: kept, sourceHash, status: "approved", sourceLanguage: source }, row.language, company);
    if (why) return { ok: false, code: "cannot_approve", reason: why };
    status = "approved";
  } else if (approve === false) {
    status = "draft";
  }

  const updated = await prisma.templateTranslation.update({
    where: { id: row.id },
    data: {
      strings: kept,
      sourceHash,
      problems: openProblems.length ? openProblems : null,
      status,
      ...(approve === true ? { approvedAt: now, approvedById: userId } : {}),
      ...(approve === false ? { approvedAt: null, approvedById: null } : {}),
    },
  });
  return { ok: true, row: updated };
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * The approved translations of one template, by language, for a send.
 * Never throws: an unreadable table means every client gets the original,
 * which is what went out before translations existed.
 */
export async function translationsForSend(prisma, templateId) {
  const out = new Map();
  if (!templateId) return out;
  try {
    const rows = await prisma.templateTranslation.findMany({
      where: { templateId, status: "approved" },
      select: { language: true, status: true, sourceHash: true, sourceLanguage: true, strings: true },
    });
    for (const r of rows || []) out.set(r.language, r);
  } catch (err) {
    console.error("[email translation] could not read translations:", err?.message);
  }
  return out;
}

/** One row per target language for the panel — present or not. */
export function summariseTranslations({ template, company, rows }) {
  const source = templateLanguageOf(template, company);
  const strings = extractStrings(template);
  const byLang = new Map((rows || []).map((r) => [r.language, r]));
  return targetLanguagesFor(source).map((language) => {
    const row = byLang.get(language) || null;
    const unusable = row ? translationUnusableReason(template, { ...row, status: "approved" }, language, company) : "none";
    return {
      language,
      exists: Boolean(row),
      status: row?.status || null,
      // Would this row be sent if it were approved? "stale" / "incomplete" /
      // "token_mismatch" say why not.
      current: row ? unusable === null : false,
      unusableReason: row ? unusable : null,
      used: row ? row.status === "approved" && unusable === null : false,
      problems: Array.isArray(row?.problems) ? row.problems.length : 0,
      costMicros: row?.costMicros || 0,
      totalCostMicros: row?.totalCostMicros || 0,
      billing: row?.billing || null,
      chargedCents: row?.chargedCents || 0,
      drafts: row?.drafts || 0,
      draftedAt: row?.draftedAt || null,
      approvedAt: row?.approvedAt || null,
      estimateMicros: estimateTranslationMicros({
        chars: translatableChars(strings),
        strings: strings.length,
        from: source,
        to: language,
      }),
    };
  });
}
