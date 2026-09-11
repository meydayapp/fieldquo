// lib/sales/intel/siteInference.js
//
// What a model may infer about a business from its own website — the
// inputs, the prompt, the closed list of kinds, and the check that throws
// away anything it cannot point at.
//
// ══ Why "What we infer" was empty ═════════════════════════════════════════
//
// The rep's queue draws three layers — observed, inferred, recommended — and
// the middle one read "Nothing has been inferred about this business" for
// almost every prospect. Two rules wrote ProspectInference rows: `trade`,
// when the source had not established it, and `derived_site`, when the
// website was guessed from a licence email. South County Electric had a
// crawled site that names its owner, its town and its years, and nothing
// read a word of it into that layer. The owner asked whether AI should fill
// it; the answer he was given, and this file implements, is yes — on the
// claimed lane only, every inference carrying the exact sentence on the page
// it came from, at about a tenth of a cent a prospect.
//
// ══ A quote, or nothing ═══════════════════════════════════════════════════
//
// The model reads the same page excerpts the call script reads
// (lib/sales/intel/pageExcerpts.js) and answers with entries of
// { kind, value, quote, sourceUrl, confidence }. The rule that keeps this
// layer honest is in validateSiteInferences(): a quote that is not in the
// supplied text, verbatim, drops the entry and is counted — the same
// verifier the call script's citations go through
// (lib/sales/scriptVoice.js findQuoteSource), reused rather than copied so
// a quote cannot pass one and fail the other. A kind the pages do not state
// is absent from the reply, and the prompt says so twice. Absence of a
// statement is not a statement.
//
// ══ Words, not digits ═════════════════════════════════════════════════════
//
// ProspectInference.value is a classification column, and the queue refuses
// to render a value with a digit in it (lib/sales/prospectView.js — "a
// number is not a bucket"). "Since 1998" is exactly the fact a rep wants,
// so it reaches the row as "nineteen ninety-eight": the model is asked for
// words, a stray number is spelled out here, and a value that still carries
// a digit after that is dropped and counted rather than stored unrenderable.
// The call script may not contain a digit either, so a value in words is the
// form it can quote.
//
// ══ No numeric field in the schema ════════════════════════════════════════
//
// The brief asked for a confidence from zero to one. It is stored that way,
// but the model answers it as a WORD — low, medium, high — and the number is
// assigned in code. lib/ai/jsonSchema.js's closing section makes the
// argument: a numeric field in a schema is a claim that a model's guess is
// good arithmetic, and a number should be computed from the model's words
// instead. This file keeps to it.
import { createHash } from "node:crypto";
import { SITE_INFERENCE_KINDS } from "@/lib/sales/inferenceKinds";
import { findQuoteSource } from "@/lib/sales/scriptVoice";
import { integerInWords } from "./pageExcerpts";

/** Bumped when the prompt, the schema or the kind list changes. A run row
 *  with an older version is redone on the next claim, whatever its hash. */
export const SITE_INFERENCE_VERSION = "1";

/** The PlatformAiUsage.area this stage's spend is filed under. */
export const SITE_INFERENCE_AI_AREA = "site_inference";

/** ProspectEvidence.detector on the sentence rows this stage writes. One
 *  detector string, so the rows can be found by name and never confused with
 *  the crawler's page rows or the capability detector's notes. */
export const SITE_INFERENCE_DETECTOR = "site_inference";

/** Ten entries of a short value and a one-sentence quote inside the JSON
 *  envelope. provider.js raises it to the model's own floor. */
export const SITE_INFERENCE_MAX_TOKENS = 900;

export const SITE_INFERENCE_LIMITS = Object.freeze({
  /** A value is a phrase, not a paragraph. */
  value: 120,
  /** Long enough to be a sentence, short enough to be one. */
  quote: 240,
});

/** The word the model answers, and the number the row stores. */
export const CONFIDENCE_WORDS = Object.freeze({ low: 0.35, medium: 0.6, high: 0.85 });

/** What each kind means, in the prompt's own words. Values are examples of
 *  the FORM — words, no digits — not of the content. */
export const KIND_GUIDANCE = Object.freeze({
  crew_size: "how many people work there, in words — \"a team of six\", \"family-run, two brothers\"",
  years_in_business: "how long they have been going, in words — \"over twenty years\"",
  founded_year: "the year they started, spelled out in words — \"nineteen ninety-eight\"",
  owner_name: "the owner's or founder's name, as the site gives it",
  service_area: "the towns, counties or radius they say they serve",
  emphasis: "what the site leads with — commercial, residential, emergency, new construction, a specialism",
  hiring: "whether the site says they are hiring — \"hiring technicians\"",
  licence_or_insurance_claim: "\"licensed and insured\", bonded, a licence they cite — any number in words",
  languages_spoken: "languages the site says they speak",
  busy_season: "a season or months the site says are busy or booked up",
});

const clip = (value, n) => {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/**
 * The material, as plain sentences.
 *
 * @param pages     selectPageExcerpts() output [{ url, text }]
 * @param prospect  the row: businessName, tradeKey, city, province
 *
 * The hash is taken over this object, so a new crawl (new text), a renamed
 * business or a version bump regenerates, and the same pages twice do not.
 */
export function siteInferenceInputs({ pages = [], prospect = null } = {}) {
  const p = prospect || {};
  return {
    version: SITE_INFERENCE_VERSION,
    business: clip(p.businessName || "", 120),
    trade: clip(String(p.tradeKey || "").replace(/_/g, " "), 60),
    place: clip([p.city, p.province].filter(Boolean).join(", "), 120),
    pages: (Array.isArray(pages) ? pages : [])
      .filter((pg) => pg?.text)
      .map((pg) => ({ url: String(pg.url || ""), text: String(pg.text).replace(/\s+/g, " ").trim() })),
  };
}

export function siteInferenceInputHash(inputs) {
  return createHash("sha256").update(JSON.stringify(inputs ?? null)).digest("hex").slice(0, 40);
}

/** Everything a quote may be checked against — the page text exactly as the
 *  prompt printed it. Same shape citationSources() hands the script lint. */
export function siteInferenceSources(inputs) {
  return (inputs?.pages || []).map((p) => ({ url: p.url || "", text: p.text || "" })).filter((s) => s.text);
}

/**
 * The strict schema. Kind and confidence are enums; nothing is numeric;
 * every property required; additionalProperties false at every level.
 */
export function siteInferenceSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["inferences"],
    properties: {
      inferences: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "value", "quote", "sourceUrl", "confidence"],
          properties: {
            kind: { type: "string", enum: [...SITE_INFERENCE_KINDS] },
            value: { type: "string" },
            quote: { type: "string" },
            sourceUrl: { type: "string" },
            confidence: { type: "string", enum: Object.keys(CONFIDENCE_WORDS) },
          },
        },
      },
    },
  };
}

export const SITE_INFERENCE_SYSTEM =
  "You read a small contractor's website and record only what it states outright about the business. " +
  "You never guess, never fill a gap from what businesses like this usually say, and never add a fact " +
  "that is not in the text you were given. Every entry quotes the exact words it rests on. " +
  "Values are short phrases in words with no digits.";

export function siteInferencePrompt(inputs) {
  const i = inputs || {};
  return [
    `Business: ${i.business || "(unnamed)"}`,
    ...(i.trade ? [`Trade: ${i.trade}`] : []),
    ...(i.place ? [`Where: ${i.place}`] : []),
    "",
    "WHAT THEIR OWN WEBSITE SAYS (excerpts, in the business's own words)",
    ...(i.pages || []).flatMap((p) => [`[${p.url || "page"}]`, p.text]),
    "",
    "Record what these pages state, one entry per kind at most, from this list and no other:",
    ...SITE_INFERENCE_KINDS.map((k) => `- ${k}: ${KIND_GUIDANCE[k]}`),
    "",
    "Rules:",
    `- quote: the exact sentence or phrase from the text above that says it, copied verbatim, ${SITE_INFERENCE_LIMITS.quote} characters or fewer. It is checked character for character; an entry whose quote is not on the page is thrown away.`,
    "- A kind the pages do not state is LEFT OUT. An empty list is a correct answer. Never infer a kind from silence.",
    `- value: a short phrase in words, ${SITE_INFERENCE_LIMITS.value} characters or fewer, no digits anywhere — "twenty-six years", "nineteen ninety-eight", "a crew of four".`,
    "- sourceUrl: the URL in brackets above the text the quote came from.",
    "- confidence: high when the page states it plainly about this business; medium when their own words imply it; low when the words could be read another way.",
  ].join("\n");
}

/** 1998 → "nineteen ninety-eight"; 2005 → "two thousand and five"; 2015 →
 *  "twenty fifteen". Years only; anything else falls to integerInWords. */
export function yearInWords(n) {
  if (!Number.isInteger(n) || n < 1000 || n > 2099) return integerInWords(n);
  const rest = n % 100;
  if (n >= 2000 && n < 2010) return rest ? `two thousand and ${integerInWords(rest)}` : "two thousand";
  const head = integerInWords(Math.floor(n / 100));
  if (rest === 0) return `${head} hundred`;
  return rest < 10 ? `${head} oh ${integerInWords(rest)}` : `${head} ${integerInWords(rest)}`;
}

/** Every run of digits in a value, spelled out. Years read as years; other
 *  integers as counts; a decimal or a run too long for words is left alone,
 *  and the caller drops the value for the digit that remains. */
export function spellDigits(value) {
  return String(value || "").replace(/\d+(?:[.,]\d+)?/g, (run) => {
    if (/[.,]/.test(run)) return run;
    const n = Number(run);
    if (!Number.isInteger(n)) return run;
    const words = run.length === 4 ? yearInWords(n) : integerInWords(n);
    return words || run;
  });
}

/** Why an entry was dropped. A closed list, for the task note and the check. */
export const DROP_REASONS = Object.freeze({
  unknown_kind: "the kind is not on the list",
  duplicate_kind: "a second entry for a kind already recorded",
  empty: "the value or the quote was empty",
  quote_too_long: `the quote was longer than ${SITE_INFERENCE_LIMITS.quote} characters`,
  quote_not_in_material: "the quote is not on the pages the model was shown",
  digit_value: "the value still carried a digit after numbers were spelled out",
});

/**
 * Check a reply against the material.
 *
 * @param raw      the model's parsed reply { inferences: [...] }
 * @param sources  siteInferenceSources(inputs) — the pages, as printed
 * @returns { kept: [{ kind, value, quote, sourceUrl, confidence }],
 *            dropped: [{ kind, reason }] }
 *
 * Per entry, never whole: one invented quote should not cost the nine real
 * ones. The sourceUrl stored is where the quote was FOUND, not where the
 * model said it was — the model's URL is advisory and the material's is
 * true. `confidence` on a kept entry is the number for the word.
 */
export function validateSiteInferences(raw, sources = []) {
  const kept = [];
  const dropped = [];
  const seen = new Set();
  const entries = Array.isArray(raw?.inferences) ? raw.inferences : [];
  for (const e of entries) {
    const kind = typeof e?.kind === "string" ? e.kind.trim() : "";
    if (!SITE_INFERENCE_KINDS.includes(kind)) {
      dropped.push({ kind: kind || "(none)", reason: "unknown_kind" });
      continue;
    }
    if (seen.has(kind)) {
      dropped.push({ kind, reason: "duplicate_kind" });
      continue;
    }
    const quote = typeof e?.quote === "string" ? e.quote.replace(/\s+/g, " ").trim() : "";
    const value = clip(spellDigits(typeof e?.value === "string" ? e.value : ""), SITE_INFERENCE_LIMITS.value);
    if (!quote || !value) {
      dropped.push({ kind, reason: "empty" });
      continue;
    }
    if (quote.length > SITE_INFERENCE_LIMITS.quote) {
      dropped.push({ kind, reason: "quote_too_long" });
      continue;
    }
    const found = findQuoteSource(quote, sources);
    if (!found) {
      dropped.push({ kind, reason: "quote_not_in_material" });
      continue;
    }
    if (/\d/.test(value)) {
      dropped.push({ kind, reason: "digit_value" });
      continue;
    }
    seen.add(kind);
    kept.push({
      kind,
      value,
      quote,
      sourceUrl: found.url || String(e?.sourceUrl || ""),
      confidence: CONFIDENCE_WORDS[e?.confidence] ?? CONFIDENCE_WORDS.medium,
    });
  }
  return { kept, dropped };
}

/**
 * Does a stored run still stand for these inputs? Same hash and same
 * version: yes, spend nothing. Pure, like callScriptCurrent.
 */
export function siteInferenceCurrent(run, { inputHash, version = SITE_INFERENCE_VERSION } = {}) {
  return Boolean(run && run.inputHash === inputHash && run.promptVersion === version);
}
