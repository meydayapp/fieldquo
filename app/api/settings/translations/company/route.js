// app/api/settings/translations/company/route.js
//
// The review surface for the texts auto-translated on save: the company's
// own wording (lib/i18n/companyText.js — payment terms, "what happens next",
// the story, the SMS wordings) and the quote text-block library.
//
// GET  ?language=fr            → every key with its source, its draft in that
//                                language and a status; the text blocks too.
// GET  ?summary=1&language=all → per key, per language, the status only —
//                                what the "Translated automatically" banner
//                                asks a few seconds after a save, so it can
//                                say what is actually there rather than what
//                                was queued. `keys=` narrows the company keys;
//                                `model=quoteTextBlock|product&id=` asks about
//                                one JSON-column row instead.
// PATCH { key, language, text } → a person's wording for a company key
//       { textBlockId, language, name, body } → a person's wording for a block
//
// ── Statuses ────────────────────────────────────────────────────────────────
//
//   reviewed  a person saved it, for the text the company has now
//   drafted   the machine wrote it, nobody has read it — it IS sent
//   pending   the draft failed or AI was unavailable; the source language is
//             sent until the next save or a person types one
//   outdated  the source changed since; ignored by every reader (hash rule)
//             until the fresh draft lands — the same instant, normally
//   missing   no row at all
//
// "Drafted" is sent to clients. That is the owner's decision (2026-09-24):
// an unreviewed translation beats a wrong language. The screen says so with
// the Auto badge rather than pretending a draft is a review — the same
// honesty app/api/settings/translations/route.js keeps for products.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isSupported, LANGUAGE_CODES } from "@/app/i18n/languages";
import { COMPANY_TEXT_KEYS, companyTextKey, companyTextFields, sourceHash } from "@/lib/i18n/companyText";
import { translationEntry } from "@/lib/quotes/textBlocks";
import { Prisma } from "@prisma/client";
import { targetLanguages, OTHER_LANGUAGE, acceptDraft } from "@/lib/i18n/autoTranslate";
import { serviceContentHash } from "@/lib/i18n/contentHash";
import { isPhraseKey, parsePhraseKey } from "@/lib/i18n/phrases";

const COMPANY_SELECT = {
  defaultLanguage: true,
  paymentTerms: true,
  defaultProcessNotes: true,
  story: true,
  storyHeadline: true,
  smsTemplates: true,
};

// ── Which language each text is written in (2026-09-25) ─────────────────────
//
// Detected by the drafting call, recorded on the rows drafted from the
// CURRENT text (CompanyTextTranslation.sourceLanguage). A text never detected
// is assumed to be in the company's default language, as before. The review
// lists a text under every language except its own — so an English-default
// company's French story is reviewed in English too, and not in French.
function sourceLanguageOf(rows, key, hash, fallback) {
  const hit = rows.find((r) => r.key === key && r.sourceHash === hash && r.sourceLanguage);
  return hit?.sourceLanguage || fallback;
}

function targetsFor(source) {
  return source === OTHER_LANGUAGE ? [...LANGUAGE_CODES] : targetLanguages(source);
}

function rowStatus(row, hash) {
  if (!row) return "missing";
  if (row.status === "pending") return "pending";
  if (row.sourceHash !== hash) return "outdated";
  return row.status === "reviewed" ? "reviewed" : "drafted";
}

function jsonEntryStatus(entry, hash, fields) {
  if (!entry || typeof entry !== "object") return "missing";
  if (entry.pending) return "pending";
  const hasText = fields.some((f) => typeof entry[f] === "string" && entry[f].trim());
  if (!hasText) return "missing";
  if (entry.auto) return entry.sourceHash === hash ? "drafted" : "outdated";
  // A person's entry (the review PATCH, the builder's accept, the catalogue
  // seed). Without a hash there is nothing to compare, and it was not ours.
  if (entry.sourceHash && entry.sourceHash !== hash) return "outdated";
  return "reviewed";
}

async function summary(member, searchParams) {
  const model = searchParams.get("model") || "company";
  const id = searchParams.get("id") || "";
  const wantKeys = (searchParams.get("keys") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: COMPANY_SELECT });
  const source = company?.defaultLanguage || "en";
  const languages = targetLanguages(source);

  if (model === "quoteTextBlock" || model === "product") {
    if (!id) return NextResponse.json({ error: "Pass the row id." }, { status: 400 });
    const fields = model === "product" ? ["name", "description"] : ["name", "body"];
    const table = model === "product" ? db.product : db.quoteTextBlock;
    const row = await table.findFirst({ where: { id, companyId: member.companyId } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const hash = sourceHash(fields.map((f) => row[f] || "").join("\u0000"));
    const t = row.translations && typeof row.translations === "object" ? row.translations : {};
    // A block's own language is its source (detection corrects it); a
    // product's is the `from` its current drafts record, else the default.
    const detected = Object.values(t).find((e) => e && e.sourceHash === hash && e.from)?.from;
    const rowSource = model === "quoteTextBlock" ? row.language || source : detected || source;
    const rowLanguages = targetsFor(rowSource);
    const byLanguage = Object.fromEntries(rowLanguages.map((l) => [l, jsonEntryStatus(t[l], hash, fields)]));
    return NextResponse.json({ model, id, sourceLanguage: rowSource, defaultLanguage: source, languages: rowLanguages, sourceLanguages: { [id]: rowSource }, keys: { [id]: byLanguage } });
  }

  // The job-process wording a company edited in Settings › Services, one
  // CompanyServiceCategory row per trade (`ids=` for a save that touched
  // several). Keys are "<rowId>:<field>".
  if (model === "serviceContent") {
    const ids = (searchParams.get("ids") || id).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 80);
    if (!ids.length) return NextResponse.json({ error: "Pass the row id." }, { status: 400 });
    const rows = await db.companyServiceCategory.findMany({
      where: { id: { in: ids }, companyId: member.companyId },
      select: { id: true, scopeDescription: true, includedItems: true, processSteps: true, translations: true },
    });
    const out = {};
    const sources = {};
    for (const r of rows) {
      const t = r.translations && typeof r.translations === "object" ? r.translations : {};
      for (const field of SERVICE_FIELDS) {
        const value = r[field];
        const has = field === "scopeDescription" ? typeof value === "string" && value.trim() : Array.isArray(value) && value.length;
        if (!has) continue;
        const hash = serviceContentHash(field, value);
        const byLang = Object.fromEntries(Object.entries(t).map(([l, e]) => [l, e?.[field]]).filter(([, e]) => e && typeof e === "object"));
        const fieldSource = Object.values(byLang).find((e) => e.sourceHash === hash && e.from)?.from || source;
        const key = `${r.id}:${field}`;
        sources[key] = fieldSource;
        out[key] = {};
        for (const l of targetsFor(fieldSource)) out[key][l] = serviceEntryStatus(byLang[l], hash);
      }
    }
    return NextResponse.json({ model, ids, sourceLanguage: source, defaultLanguage: source, languages, sourceLanguages: sources, keys: out });
  }

  const fields = companyTextFields(company || {});
  // Company texts, and phrases (lib/i18n/phrases.js) — a phrase key carries
  // the hash of its text, so it needs no source to be checked against.
  const keys = (wantKeys.length ? wantKeys : Object.keys(fields)).filter((k) => companyTextKey(k) || isPhraseKey(k)).slice(0, 80);
  const rows = keys.length
    ? await db.companyTextTranslation.findMany({
        where: { companyId: member.companyId, key: { in: keys } },
        select: { key: true, language: true, status: true, sourceHash: true, sourceLanguage: true },
      })
    : [];
  const out = {};
  const sources = {};
  for (const key of keys) {
    const phrase = parsePhraseKey(key);
    const text = phrase ? key : fields[key] || "";
    const hash = phrase ? phrase.hash : sourceHash(text);
    const keySource = sourceLanguageOf(rows, key, hash, source);
    sources[key] = keySource;
    out[key] = {};
    for (const l of targetsFor(keySource)) {
      const row = rows.find((r) => r.key === key && r.language === l);
      out[key][l] = text ? rowStatus(row, hash) : "missing";
    }
  }
  return NextResponse.json({ model: "company", sourceLanguage: source, defaultLanguage: source, languages, sourceLanguages: sources, keys: out });
}

const SERVICE_FIELDS = ["scopeDescription", "includedItems", "processSteps"];
const SERVICE_VALUE_KEY = { scopeDescription: "text", includedItems: "items", processSteps: "steps" };

function serviceEntryStatus(entry, hash) {
  if (!entry) return "missing";
  if (entry.pending) return "pending";
  if (entry.sourceHash !== hash) return "outdated";
  return entry.auto ? "drafted" : "reviewed";
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { searchParams } = new URL(request.url);
  if (searchParams.get("summary")) return summary(member, searchParams);

  const language = searchParams.get("language");
  if (!language || !isSupported(language)) {
    return NextResponse.json({ error: "Pass a supported language code." }, { status: 400 });
  }

  const [company, allRows, blocks, services] = await Promise.all([
    db.company.findUnique({ where: { id: member.companyId }, select: COMPANY_SELECT }),
    db.companyTextTranslation.findMany({ where: { companyId: member.companyId } }),
    db.quoteTextBlock.findMany({
      where: { companyId: member.companyId },
      select: { id: true, name: true, body: true, language: true, translations: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.companyServiceCategory.findMany({
      where: {
        companyId: member.companyId,
        OR: [{ scopeDescription: { not: null } }, { includedItems: { not: Prisma.DbNull } }, { processSteps: { not: Prisma.DbNull } }],
      },
      select: {
        id: true, scopeDescription: true, includedItems: true, processSteps: true, translations: true,
        category: { select: { key: true, label: true, labelTranslations: true } },
      },
    }),
  ]);
  const sourceLanguage = company?.defaultLanguage || "en";
  const fields = companyTextFields(company || {});
  const rows = allRows.filter((r) => r.language === language);
  let foreignSource = false;

  const items = COMPANY_TEXT_KEYS.filter((k) => fields[k.key]).flatMap((k) => {
    const text = fields[k.key];
    const hash = sourceHash(text);
    const keySource = sourceLanguageOf(allRows, k.key, hash, sourceLanguage);
    if (keySource !== sourceLanguage) foreignSource = true;
    // A text is not reviewed in the language it is written in.
    if (keySource === language) return [];
    const row = rows.find((r) => r.key === k.key) || null;
    return [{
      key: k.key,
      labelKey: k.labelKey,
      label: k.label,
      kind: k.kind,
      source: text,
      sourceLanguage: keySource,
      translation: row?.status === "pending" ? "" : row?.text || "",
      status: rowStatus(row, hash),
      draftedAt: row?.draftedAt || null,
      reviewedAt: row?.reviewedAt || null,
      previousText: row?.previousText || null,
    }];
  });

  // The job-process wording a company edited, per trade and field.
  const serviceItems = [];
  for (const r of services) {
    const t = r.translations && typeof r.translations === "object" ? r.translations : {};
    for (const field of SERVICE_FIELDS) {
      const value = r[field];
      const has = field === "scopeDescription" ? typeof value === "string" && value.trim() : Array.isArray(value) && value.length;
      if (!has) continue;
      const hash = serviceContentHash(field, value);
      const entries = Object.values(t).map((e) => e?.[field]).filter((e) => e && typeof e === "object");
      const fieldSource = entries.find((e) => e.sourceHash === hash && e.from)?.from || sourceLanguage;
      if (fieldSource !== sourceLanguage) foreignSource = true;
      if (fieldSource === language) continue;
      const entry = t[language]?.[field] && typeof t[language][field] === "object" ? t[language][field] : null;
      const status = serviceEntryStatus(entry, hash);
      const key = SERVICE_VALUE_KEY[field];
      serviceItems.push({
        id: `${r.id}:${field}`,
        rowId: r.id,
        field,
        trade: r.category?.label || r.category?.key || "",
        source: value,
        sourceLanguage: fieldSource,
        translation: status === "pending" || status === "missing" ? null : entry?.[key] ?? null,
        status,
        draftedAt: entry?.draftedAt || null,
        reviewedAt: entry?.reviewedAt || null,
      });
    }
  }

  const textBlocks = blocks
    .filter((b) => {
      if ((b.language || "en") !== sourceLanguage) foreignSource = true;
      return (b.language || "en") !== language;
    })
    .map((b) => {
      const hash = sourceHash(["name", "body"].map((f) => b[f] || "").join("\u0000"));
      const t = b.translations && typeof b.translations === "object" ? b.translations : {};
      const entry = t[language] && typeof t[language] === "object" ? t[language] : null;
      const status = jsonEntryStatus(entry, hash, ["name", "body"]);
      return {
        id: b.id,
        sourceLanguage: b.language || "en",
        source: { name: b.name, body: b.body || "" },
        translation: {
          name: status === "pending" || status === "missing" ? "" : entry?.name || "",
          body: status === "pending" || status === "missing" ? "" : entry?.body || "",
        },
        status,
        draftedAt: entry?.draftedAt || null,
        reviewedAt: entry?.reviewedAt || null,
      };
    });

  const count = (list, s) => list.filter((i) => i.status === s).length;
  const lists = [items, textBlocks, serviceItems];
  const sum = (s) => lists.reduce((n, l) => n + count(l, s), 0);
  return NextResponse.json({
    language,
    sourceLanguage,
    defaultLanguage: sourceLanguage,
    // True when anything is written in a language other than the company's
    // default — the review then offers the default language too, where
    // those texts' drafts are read.
    foreignSource,
    languages: LANGUAGE_CODES.filter((c) => c !== sourceLanguage),
    items,
    textBlocks,
    serviceItems,
    counts: {
      drafted: sum("drafted"),
      reviewed: sum("reviewed"),
      pending: sum("pending"),
      missing: sum("missing") + sum("outdated"),
    },
    canEdit: member.role === "owner" || member.role === "admin",
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same gate as the product translations: this rewrites text a
  // homeowner reads on a document that goes out under the company's name.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only an owner or admin can change translations." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const language = String(body.language || "").toLowerCase();
  if (!isSupported(language)) {
    return NextResponse.json({ error: "Pass a supported language code." }, { status: 400 });
  }

  // ── A text block ──────────────────────────────────────────────────────────
  if (body.textBlockId) {
    const block = await db.quoteTextBlock.findFirst({ where: { id: String(body.textBlockId), companyId: member.companyId } });
    if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((block.language || "en") === language) {
      return NextResponse.json({ error: "That's the language the block is written in." }, { status: 400 });
    }
    const entry = translationEntry({ name: body.name, body: body.body });
    if (!entry) return NextResponse.json({ error: "Give the translation a name." }, { status: 400 });
    const all = block.translations && typeof block.translations === "object" ? { ...block.translations } : {};
    const prev = all[language] && typeof all[language] === "object" ? all[language] : null;
    all[language] = {
      ...entry,
      // A person's entry: no `auto`, and the hash of the source it describes,
      // so the drafter leaves it alone until the block's words change.
      reviewed: true,
      reviewedAt: new Date().toISOString(),
      sourceHash: sourceHash(["name", "body"].map((f) => block[f] || "").join("\u0000")),
      from: block.language || "en",
      ...(prev?.previousReviewed ? { previousReviewed: prev.previousReviewed } : {}),
    };
    const row = await db.quoteTextBlock.update({ where: { id: block.id }, data: { translations: all }, select: { id: true } });
    return NextResponse.json({ ok: true, textBlockId: row.id, language, status: "reviewed" });
  }

  // ── A trade's edited job-process wording ─────────────────────────────────
  if (body.serviceRowId) {
    const field = String(body.field || "");
    if (!SERVICE_FIELDS.includes(field)) return NextResponse.json({ error: "Unknown text." }, { status: 400 });
    const row = await db.companyServiceCategory.findFirst({
      where: { id: String(body.serviceRowId), companyId: member.companyId },
      select: { id: true, scopeDescription: true, includedItems: true, processSteps: true, translations: true },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const source = row[field];
    const hash = serviceContentHash(field, source);
    const all = row.translations && typeof row.translations === "object" ? { ...row.translations } : {};
    const fieldSource = Object.values(all).map((e) => e?.[field]).find((e) => e && e.sourceHash === hash && e.from)?.from;
    const company = await db.company.findUnique({ where: { id: member.companyId }, select: { defaultLanguage: true } });
    if ((fieldSource || company?.defaultLanguage || "en") === language) {
      return NextResponse.json({ error: "That's the language this wording is written in." }, { status: 400 });
    }
    // The same boundary the drafter's own output crosses: same count, same
    // [prompts], every line real — a reviewed list that dropped a bullet
    // would print a shorter scope than the company wrote.
    const text = field === "scopeDescription" ? String(body.value ?? "") : JSON.stringify(body.value ?? null);
    const value = acceptDraft({ model: "serviceContent", field, text, source: typeof source === "string" ? source : JSON.stringify(source), value: source });
    if (!value) {
      return NextResponse.json({ error: "Keep the same number of lines as the original, and any [bracketed] prompts in brackets." }, { status: 400 });
    }
    const key = SERVICE_VALUE_KEY[field];
    const lang = { ...(all[language] && typeof all[language] === "object" ? all[language] : {}) };
    const prev = lang[field] && typeof lang[field] === "object" ? lang[field] : null;
    lang[field] = {
      [key]: value,
      reviewed: true,
      reviewedAt: new Date().toISOString(),
      sourceHash: hash,
      ...(fieldSource ? { from: fieldSource } : {}),
      ...(prev?.previousReviewed ? { previousReviewed: prev.previousReviewed } : {}),
    };
    all[language] = lang;
    await db.companyServiceCategory.update({ where: { id: row.id }, data: { translations: all } });
    return NextResponse.json({ ok: true, serviceRowId: row.id, field, language, status: "reviewed" });
  }

  // ── A company key ─────────────────────────────────────────────────────────
  const spec = companyTextKey(String(body.key || ""));
  if (!spec) return NextResponse.json({ error: "Unknown text." }, { status: 400 });
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: COMPANY_SELECT });
  const source = spec.get(company || {}).trim();
  if (!source) return NextResponse.json({ error: "There is nothing to translate yet — write the original first." }, { status: 400 });
  // Refused in the language the text is WRITTEN in — detected, else the
  // default — and allowed in the default when the text was detected in
  // another one: that is the English version of a French-written story.
  const keyRows = await db.companyTextTranslation.findMany({
    where: { companyId: member.companyId, key: spec.key },
    select: { key: true, sourceHash: true, sourceLanguage: true },
  });
  const keySource = sourceLanguageOf(keyRows, spec.key, sourceHash(source), company?.defaultLanguage || "en");
  if (keySource === language) {
    return NextResponse.json({ error: "That's the language this text is written in." }, { status: 400 });
  }
  const text = String(body.text || "").trim().slice(0, spec.maxChars);
  if (!text) return NextResponse.json({ error: "Write the translation first." }, { status: 400 });
  if (spec.kind === "sms") {
    // A wording that lost or invented a {token} would render a raw brace to
    // a client; the same rule the drafter applies (acceptDraft).
    const used = [...source.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const kept = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    if (used !== kept) {
      return NextResponse.json({ error: "Keep the same {fields} as the original — they are filled in when the text is sent." }, { status: 400 });
    }
  }
  const hash = sourceHash(source);
  const now = new Date();
  const row = await db.companyTextTranslation.upsert({
    where: { companyId_key_language: { companyId: member.companyId, key: spec.key, language } },
    create: { companyId: member.companyId, key: spec.key, language, text, sourceHash: hash, sourceLanguage: keySource, status: "reviewed", auto: false, reviewedAt: now },
    update: { text, sourceHash: hash, sourceLanguage: keySource, status: "reviewed", auto: false, reviewedAt: now },
    select: { key: true, language: true, status: true, reviewedAt: true },
  });
  return NextResponse.json({ ok: true, ...row });
}
