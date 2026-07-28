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

import { complete, isAiConfigured } from "@/lib/ai/provider";
import { LANGUAGES, isSupported } from "@/app/i18n/languages";

function languageName(code) {
  return LANGUAGES.find((l) => l.code === code)?.name || code;
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
    // Models sometimes wrap JSON in a fence despite instructions.
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);

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
