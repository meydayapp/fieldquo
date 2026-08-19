// lib/i18n/translateContent.js
//
// Drafts translations of company-authored content (service names, line-item
// descriptions, email template text) into the languages a company sends in.
//
// Crucially this runs at AUTHORING time, not at send time. The company adds a
// service once, gets a draft in each language, reviews it, and that reviewed
// text is what every future quote uses. Translating at send time would mean:
//
//   * an API call and a cost on every send
//   * the client seeing text nobody at the company has ever read
//   * two clients getting subtly different wording for the same service
//   * a document that's a commercial commitment containing unreviewed text
//
// Standard add-ons don't come through here at all — they ship with
// hand-written translations in app/data/standardAddOns.js, the same approach
// TrueFinish uses for its service catalogue. Only content a company writes
// itself needs drafting.
//
// ── This is NOT a licence to machine-translate documents ───────────────────
//
// AGENTS.md non-negotiable 6: "A document keeps the language it was created in.
// Nothing is machine-translated at send time — a signed PDF must keep saying
// what it said." Everything in this file stays on the right side of that rule,
// and the distinction is worth stating precisely because the two look similar:
//
//   ALLOWED — a company's own CATALOGUE entry, translated on demand in a
//     settings screen, shown to the person who wrote it, edited by them, and
//     saved by them. It becomes a stored value that a human approved. Nothing
//     reaches a client until that approval happens.
//
//   FORBIDDEN — a Quote, Invoice or PDF, translated at send time or at render
//     time. Quote.language is fixed at creation for a reason: the document is a
//     commercial commitment, and the wording a client signed has to keep being
//     the wording a client signed.
//
// If you are here because you want a document in another language: create the
// document in that language. Do not translate an existing one.

import { complete, isAiConfigured } from "@/lib/ai/provider";
import { LANGUAGES, isSupported } from "@/app/i18n/languages";

function languageName(code) {
  return LANGUAGES.find((l) => l.code === code)?.name || code;
}

// Models wrap JSON in a fence despite being told not to, often enough that
// stripping it is part of parsing rather than a workaround.
function parseJsonReply(text) {
  const cleaned = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  if (!cleaned) return null;
  return JSON.parse(cleaned);
}

// Small enough that one bad batch loses little work and a stalled call doesn't
// hold the whole catalogue hostage; big enough that the shared instructions are
// amortised across many short strings, which is most of the token cost here.
const DRAFT_BATCH_SIZE = 15;

/**
 * Draft one language's wording for a list of the company's own catalogue rows.
 *
 * The complement of translateFields: that one takes ONE item into MANY
 * languages (a product being created), this takes MANY items into ONE language
 * (the review screen's "fill in the blanks" button).
 *
 * @param {Array<{id: string, name: string, description?: string}>} items
 * @param {string} from    source language code
 * @param {string} to      target language code
 * @param {object} opts
 * @param {Function} opts.onUsage        per-call token report, for metering
 * @param {Function} opts.shouldContinue awaited before each batch; return false
 *                                       to stop (the caller re-checks quota)
 * @returns {Promise<{drafts: object, failedIds: string[], stopped: boolean}>}
 *
 * Partial results are a first-class outcome, not an error. A company with 80
 * services and one batch that comes back as malformed JSON should get the other
 * 75 filled in and be told plainly that 5 didn't work — losing 75 good drafts to
 * protect the purity of a failure is the worse trade.
 */
export async function draftProductTranslations(items, from, to, opts = {}) {
  const { onUsage, shouldContinue } = opts;
  const drafts = {};
  const failedIds = [];

  if (!isAiConfigured()) {
    return { drafts, failedIds: items.map((i) => i.id), stopped: false, unavailable: true };
  }
  if (!isSupported(to) || to === from) {
    return { drafts, failedIds: items.map((i) => i.id), stopped: false };
  }

  const batches = [];
  for (let i = 0; i < items.length; i += DRAFT_BATCH_SIZE) {
    batches.push(items.slice(i, i + DRAFT_BATCH_SIZE));
  }

  for (const batch of batches) {
    if (shouldContinue && !(await shouldContinue())) {
      // Everything not yet attempted is reported as untouched rather than
      // failed — the caller distinguishes "we stopped" from "it went wrong".
      return { drafts, failedIds, stopped: true };
    }

    // Indices, not cuids. A 25-character id per row, echoed back, is pure token
    // cost for a value the model has no use for.
    const payload = batch.map((item, i) => ({
      i,
      name: item.name || "",
      ...(item.description ? { description: item.description } : {}),
    }));

    const prompt = [
      `Translate this field-service company's own catalogue of services from ${languageName(from)} into ${languageName(to)}.`,
      "",
      "These are trade terms that appear as line items on quotes and invoices a homeowner signs. Translate for the meaning a tradesperson would intend, not the dictionary sense — a \"finish\", a \"coat\", a \"run\" and \"trim\" all mean something specific on a job site. Keep them as short as the originals; these are line items, not marketing copy. Leave units, measurements, model numbers and brand names exactly as written.",
      "",
      JSON.stringify(payload),
      "",
      `Reply with ONLY a JSON array of objects, one per input, each { "i": <the same index>, "name": "…"${payload.some((p) => p.description) ? ', "description": "…"' : ""} }. No commentary, no markdown fence.`,
    ].join("\n");

    let parsed;
    try {
      const text = await complete({
        system:
          "You translate trade and contracting vocabulary for documents clients sign. Reply with JSON only — no commentary, no markdown fence.",
        prompt,
        maxTokens: 4000,
        onUsage,
      });
      parsed = parseJsonReply(text);
    } catch (err) {
      console.error("[translateContent] draft batch failed:", err?.message);
      parsed = null;
    }

    const batchResult = applyDraftBatch(batch, parsed);
    Object.assign(drafts, batchResult.drafts);
    failedIds.push(...batchResult.failedIds);
  }

  return { drafts, failedIds, stopped: false };
}

/**
 * The boundary between "what a model replied" and "what goes in a form field".
 *
 * Separated from the call above and exported so
 * scripts/check-translation-draft.mjs can execute it against replies no live
 * model would conveniently produce on demand — an object where an array was
 * asked for, indices out of range, indices repeated, numbers where strings
 * should be, a row for an item that was never sent, prose instead of JSON.
 * Reading this function and believing it is not the same as running it; every
 * bug this file has had was in exactly this shape of code.
 *
 * @param {Array} batch  what was sent, in order — index i is batch[i]
 * @param {*} parsed     whatever JSON.parse produced, or null
 */
export function applyDraftBatch(batch, parsed) {
  const drafts = {};
  const failedIds = [];
  const items = Array.isArray(batch) ? batch : [];

  const rows = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(rows)) {
    // A whole batch lost. Named as failed rather than retried here: the caller
    // reports the count, and a person types those few in.
    for (const item of items) failedIds.push(item.id);
    return { drafts, failedIds };
  }

  // Keyed by the index WE sent, so a row referring to an item that was never in
  // this batch is dropped rather than landing on whichever product happens to
  // sit at that position. First wins — a repeated index is a confused reply,
  // and the second copy has no better claim than the first.
  const byIndex = new Map();
  for (const row of rows) {
    const i = Number(row?.i);
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue;
    if (!byIndex.has(i)) byIndex.set(i, row);
  }

  items.forEach((item, i) => {
    const row = byIndex.get(i);
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    // A draft with no name is not a usable draft — the review screen treats a
    // blank name as "still missing", so returning one would only make the count
    // lie. Same rule as the PATCH in the translations route. Note the type
    // check: a model that answers `"name": 3` must not produce the string "3".
    if (!name) {
      failedIds.push(item.id);
      return;
    }
    const description =
      typeof row?.description === "string" ? row.description.trim() : "";
    drafts[item.id] = {
      name,
      // Only ever fill a description when there was one to translate. Inventing
      // prose the company never wrote is the "padding absent data with
      // defaults" failure in AGENTS.md — and it would be prose a homeowner
      // reads on a quote.
      description: item.description ? description : "",
    };
  });

  return { drafts, failedIds };
}

/**
 * Translate a set of short fields into several languages in one call.
 *
 * @param {object} fields    e.g. { name: "Rush fee", description: "Same-day…" }
 * @param {string} from      source language code
 * @param {string[]} targets language codes to produce
 * @returns {Promise<object>} { fr: { name, description }, ... }
 *
 * Returns {} rather than throwing when the API key is missing or the call
 * fails — a company adding a service should not be blocked because
 * translation is unavailable. They get the source language and can fill the
 * rest in later.
 */
export async function translateFields(fields, from = "en", targets = []) {
  const wanted = targets.filter((t) => isSupported(t) && t !== from);
  if (wanted.length === 0) return {};
  if (!isAiConfigured()) return {};

  const keys = Object.keys(fields).filter((k) => fields[k]);
  if (keys.length === 0) return {};

  const prompt = [
    `Translate these fields for a field-service company's quote from ${languageName(from)} into: ${wanted.map(languageName).join(", ")}.`,
    "",
    "This is trade/contractor vocabulary that appears on quotes and invoices clients sign. Translate for meaning and register, not word-for-word. Keep it concise — these are line items, not marketing copy. Keep any units, numbers and brand names exactly as written.",
    "",
    "Source fields:",
    JSON.stringify(fields, null, 2),
    "",
    `Reply with ONLY a JSON object keyed by language code (${wanted.join(", ")}), each containing the same field names. No commentary, no markdown fence.`,
  ].join("\n");

  try {
    const text = await complete({
      system:
        "You translate trade and contracting vocabulary for documents clients sign. Reply with JSON only — no commentary, no markdown fence.",
      prompt,
      maxTokens: 2000,
    });
    if (!text) return {};
    const parsed = parseJsonReply(text);

    // Only keep languages we asked for and fields we sent — never let a model
    // response introduce keys the caller didn't expect.
    const out = {};
    for (const code of wanted) {
      const entry = parsed?.[code];
      if (!entry || typeof entry !== "object") continue;
      const clean = {};
      for (const key of keys) {
        if (typeof entry[key] === "string" && entry[key].trim()) {
          clean[key] = entry[key].trim();
        }
      }
      if (Object.keys(clean).length > 0) out[code] = clean;
    }
    return out;
  } catch (err) {
    console.error("[translateContent] draft failed:", err?.message);
    return {};
  }
}

/**
 * Resolve a product's client-facing text for a given language.
 *
 * Returns `missing: true` when there's no translation, so the quote builder
 * can flag it rather than silently sending a mixed-language document. The
 * caller decides what to do about it; this function always returns usable
 * text.
 */
export function resolveProductText(product, language, defaultLanguage = "en") {
  const source = {
    name: product?.name || "",
    description: product?.description || "",
  };

  if (!language || language === defaultLanguage) {
    return { ...source, missing: false };
  }

  const entry = product?.translations?.[language];
  if (!entry?.name) return { ...source, missing: true };

  return {
    name: entry.name,
    description: entry.description || source.description,
    // Description falling back on its own is worth knowing about separately —
    // a translated name with an English description still looks unfinished.
    missing: !entry.description && Boolean(source.description),
  };
}

/**
 * The name of a trade in a given language.
 *
 * Deliberately NOT the drafting path above. `ServiceCategory` rows are the
 * product's own catalogue, shared by every tenant — "Interior Painting" means
 * the same thing to all 62 of them, so it's translated once in the seed
 * (`labelTranslations`) rather than 62 times per company at authoring time.
 *
 * Falls back to the English label when a language hasn't been filled in. A
 * visibly English trade name is honest; a machine-guessed one on a page a
 * homeowner is deciding from is not.
 */
export function categoryLabel(category, language, defaultLanguage = "en") {
  const label = category?.label || "";
  if (!language || language === defaultLanguage) return label;
  const translated = category?.labelTranslations?.[language];
  return typeof translated === "string" && translated.trim() ? translated : label;
}
