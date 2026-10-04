// scripts/check-email-template-translation.mjs
//
//   npm run check:email-template-translation
//
// Starter templates in every language, and a company's own template in its
// client's language (2026-10-03). Executes the shipped functions against
// hostile input rather than reading them:
//
//   1. The starter catalogues (lib/i18n/emailStarterCopy.js, funnelStarterCopy.js):
//      every language complete, every {{token}} of every English string present
//      in every translation, English output byte-identical to before.
//   2. Token protection (lib/email/templateTranslation.js): tokens inside
//      sentences, HTML, links, money, a literal ⟦ — hidden from the model and
//      restored; a reply that drops, doubles, alters or ADDS a token refused.
//   3. When a translation is used: approved + current only; stale, draft,
//      tampered, same-language → the original. Never mutates the template.
//   4. Drafting (lib/email/templateTranslationStore.js) against a scripted
//      model and database: one call per version, only changed strings
//      re-sent, no raw {{token}} ever in a prompt, refusals keep no text,
//      empty / 25k-char templates never reach the model.
//   5. Money (lib/ai/emailTranslationMeter.js): the wallet when there is
//      credit, FieldQuo up to 5¢ a version and $1 a month, otherwise refused;
//      cached prompt tokens at 10%; FieldQuo-absorbed spend never touches the
//      company's AiUsage allowance.
//   6. Wiring: both send paths localise from approved rows and never call a
//      model; the feature is registered; every UI string in all languages.
//
// Prints the estimated cost of a typical 150–300-word email per language.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { STARTER_COPY, STARTER_LANGUAGES } from "@/lib/i18n/emailStarterCopy";
import { FUNNEL_STARTER_COPY } from "@/lib/i18n/funnelStarterCopy";
import { defaultSectionsFor, defaultSubjectFor, newBlock, DEFAULT_SUBJECTS, LIFECYCLE_STAGES } from "@/app/data/emailTemplateBlocks";
import { buildFunnelFromTemplate, budgetAmount, blankFunnelSteps, FUNNEL_TEMPLATES } from "@/lib/funnels/templates";
import { LANGUAGES, LANGUAGE_CODES } from "@/app/i18n/languages";
import {
  extractStrings,
  templateSourceHash,
  templateLanguageOf,
  protectText,
  restoreText,
  acceptModelString,
  checkHumanEdit,
  mergeTokensOf,
  localizeTemplate,
  overlayStrings,
  translatableChars,
  PER_VERSION_ABSORB_MAX_MICROS,
  MONTHLY_ABSORB_CAP_MICROS,
  MAX_TRANSLATABLE_CHARS,
} from "@/lib/email/templateTranslation";
import {
  acceptModelReply,
  draftTemplateTranslation,
  reviewTemplateTranslation,
  startManualTranslation,
  summariseTranslations,
  translationsForSend,
} from "@/lib/email/templateTranslationStore";
import {
  translationVerdict,
  estimateTranslationTokens,
  estimateTranslationMicros,
  measuredMicros,
  emailTranslationMeter,
  EMAIL_TRANSLATION_FEATURE,
} from "@/lib/ai/emailTranslationMeter";
import { estimateCostMicros } from "@/lib/ai/usage";
import { chatChargeCents } from "@/lib/ai/imageEconomics";
import { PAYER_FEATURES, clearPayerCache } from "@/lib/ai/featurePayer";
import { poolForKind, POOLS } from "@/lib/voice/credits";
import { renderTemplateSections } from "@/lib/email/renderTemplateSections";
import { templateBody } from "@/lib/email/templateBody";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let checks = 0;
let failures = 0;
const ok = (cond, msg, detail) => {
  checks++;
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}${detail === undefined ? "" : `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
  }
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const md5 = (s) => createHash("md5").update(s).digest("hex").slice(0, 10);

// ═══ 1. Starter catalogues ═══════════════════════════════════════════════════
section("1. Starter email templates — every language, every token");

const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const enFlat = new Map(flat(STARTER_COPY.en));
ok(STARTER_LANGUAGES.length === LANGUAGE_CODES.length && LANGUAGE_CODES.every((c) => STARTER_LANGUAGES.includes(c)), "the email starter catalogue carries every document language", STARTER_LANGUAGES);
for (const lang of STARTER_LANGUAGES) {
  const f = new Map(flat(STARTER_COPY[lang]));
  const missing = [...enFlat.keys()].filter((k) => !f.has(k) || typeof f.get(k) !== "string" || !f.get(k).trim());
  ok(missing.length === 0, `${lang}: every starter string present`, missing);
  const tokenBad = [...enFlat.entries()].filter(([k, v]) => f.has(k) && checkHumanEdit(v, f.get(k)));
  ok(tokenBad.length === 0, `${lang}: every {{token}} of every English starter string survives`, tokenBad.map(([k]) => k));
  if (lang !== "en") {
    const same = [...enFlat.entries()].filter(([k, v]) => f.get(k) === v && /\p{L}{4,}/u.test(v.replace(/\{\{[^}]+\}\}/g, "")));
    ok(same.length === 0, `${lang}: no starter string left in English`, same.map(([k]) => k));
  }
}

// English output pinned to what the starters produced before the catalogue
// existed (md5 of the block list without ids, measured 2026-10-03 from the
// previous app/data/emailTemplateBlocks.js).
const PINNED_EN = {
  quote_email: "1494b0f436",
  instructions_email: "f5dbc45fb2",
  receipt_email: "b087d47756",
  follow_up_email: "638c0728aa",
  marketing_email: "f448204d46",
  custom_email: "8c5725d6e1",
};
const stripIds = (a) => JSON.stringify(a.map(({ id, ...rest }) => rest));
for (const [type, hash] of Object.entries(PINNED_EN)) {
  ok(md5(stripIds(defaultSectionsFor(type))) === hash, `English ${type} starter is byte-identical to before`, md5(stripIds(defaultSectionsFor(type))));
  ok(stripIds(defaultSectionsFor(type)) === stripIds(defaultSectionsFor(type, "en")), `English ${type} with and without a language agree`);
}
ok(DEFAULT_SUBJECTS.quote_email === "Your quote from {{companyName}} is ready" && defaultSubjectFor("quote_email") === DEFAULT_SUBJECTS.quote_email, "the English subjects are unchanged");

for (const lang of STARTER_LANGUAGES) {
  for (const type of Object.keys(PINNED_EN)) {
    const en = defaultSectionsFor(type, "en");
    const tr = defaultSectionsFor(type, lang);
    const shape = (a) => JSON.stringify(a.map((b) => [b.type, b.url ?? null, b.align ?? null, b.stages ?? null, b.activeStage ?? null]));
    if (shape(en) !== shape(tr)) ok(false, `${lang} ${type}: same layout, links and stages as English`);
  }
}
ok(true, "every language's starters have the English layout, links and stages (checked per type above; silence = pass)");
ok(JSON.stringify(defaultSectionsFor("quote_email", "fr").find((b) => b.type === "progress").stages) === JSON.stringify(LIFECYCLE_STAGES),
  "progress stages stay stored in English — the renderer prints them in the READER's language");
const frQuoteHtml = renderTemplateSections(defaultSectionsFor("quote_email", "fr"), { clientName: "Ana" }, { language: "en" });
ok(/Votre soumission est prête/.test(frQuoteHtml) && />Quote</.test(frQuoteHtml), "a French starter sent to an English reader keeps the company's French words and prints FieldQuo's stage names in English");
ok(newBlock("text", "es").text === STARTER_COPY.es.blockDefaults.text && newBlock("text").text === "Write a paragraph here…", "a new block's placeholder follows the template's language; no language = the English default");
ok(defaultSubjectFor("follow_up_email", "pa") === STARTER_COPY.pa.subjects.follow_up_email && defaultSubjectFor("nonsense", "de") === STARTER_COPY.de.subjects.custom_email, "subjects by language, unknown type → the custom subject in that language");
ok(defaultSubjectFor("quote_email", "xx") === DEFAULT_SUBJECTS.quote_email, "an unknown language falls back to English whole, never a mix");

const createRoute = code("app/api/settings/document-templates/route.js");
ok(/starterSectionsFor\(type,\s*language\)/.test(createRoute) && /defaultSubjectFor\(type,\s*language\)/.test(createRoute) && /defaultLanguage/.test(createRoute),
  "creating from a starter writes it in the company's language");
ok(/language: source \? templateLanguageOf\(source, company\) : language/.test(createRoute), "…and records the language it is written in (a copy keeps its source's)");
const seeder = code("lib/email/seedDefaultTemplates.js");
ok(/defaultSectionsFor\(type, language\)/.test(seeder) && /defaultSubjectFor\(type, language\)/.test(seeder) && /defaultLanguage/.test(seeder), "seeding the defaults writes them in the company's language");

section("1b. Starter funnels — every language");

const enFunnel = new Map(flat(FUNNEL_STARTER_COPY.en).filter(([, v]) => typeof v === "string"));
for (const lang of LANGUAGE_CODES) {
  ok(Boolean(FUNNEL_STARTER_COPY[lang]), `${lang}: funnel starter copy present`);
  const f = FUNNEL_STARTER_COPY[lang] || {};
  const strings = new Map(flat(f).filter(([, v]) => typeof v === "string"));
  ok([...enFunnel.keys()].every((k) => strings.has(k) && strings.get(k).trim()), `${lang}: every funnel starter string present`);
  const fns = ["web_quote", "instagram_estimate", "youtube_leadmagnet"].every((k) => typeof f.templates?.[k]?.hook === "function" && f.templates[k].hook("ACME").includes("ACME"));
  ok(fns && f.done?.subhead("ACME").includes("ACME") && f.budget?.range("A", "B").includes("A") && f.budget.range("A", "B").includes("B"), `${lang}: hooks and amounts carry the company name and both figures`);
}
const acme = { name: "Acme Painting", currency: "CAD" };
const services = [{ key: "int", label: "Interior" }, { key: "ext", label: "Exterior" }];
const en = buildFunnelFromTemplate("web_quote", { company: acme, services });
ok(en.steps[0].headline === "Get your Acme Painting quote" && en.name === "Website — get a quote", "English funnel hook unchanged", en.steps[0].headline);
ok(en.steps.find((s) => s.id === "budget").answers.map((a) => a.label).join("|") === "Under $1,000|$1,000 – $5,000|$5,000 – $15,000|$15,000+|Not sure yet", "English budget labels unchanged");
ok(en.steps.find((s) => s.id === "done").subhead === "Acme Painting will be in touch shortly with your price. No obligation.", "English thank-you unchanged");
ok(buildFunnelFromTemplate("instagram_estimate", { company: {} }).steps[0].headline === "Free estimate from us" && buildFunnelFromTemplate("web_quote", { company: {} }).steps[0].headline === "Get your quote",
  "no company name: 'Free estimate from us' as before, and 'Get your quote' instead of 'Get your us quote'");
for (const lang of LANGUAGE_CODES) {
  const b = buildFunnelFromTemplate("tiktok_quiz", { company: { ...acme, defaultLanguage: lang }, services });
  const values = (s) => JSON.stringify(s.map((x) => [x.id, x.kind, x.maps ?? null, (x.answers || []).map((a) => a.value)]));
  ok(values(b.steps) === values(buildFunnelFromTemplate("tiktok_quiz", { company: acme, services }).steps), `${lang}: same steps and scoring values as English`);
  if (lang !== "en") ok(b.steps[0].headline !== buildFunnelFromTemplate("tiktok_quiz", { company: acme }).steps[0].headline, `${lang}: hook written in ${lang}`);
}
ok(budgetAmount(1000, "CAD", "fr").startsWith("1") && budgetAmount(1000, "CAD", "fr").endsWith("$") && budgetAmount(15000, "EUR", "de") === "15.000 €",
  "budget amounts: a French reader's grouping with the sign after; '15.000 €' in German", [budgetAmount(1000, "CAD", "fr"), budgetAmount(15000, "EUR", "de")]);
ok(blankFunnelSteps("fr")[2].headline === FUNNEL_STARTER_COPY.fr.blank.doneHeadline && blankFunnelSteps("en", "Kitchen")[0].headline === "Kitchen", "the blank funnel too");
ok(FUNNEL_TEMPLATES.every((t) => t.name && t.hook && t.sub), "FUNNEL_TEMPLATES still exposes the English name/hook/sub for the back-office picker");
const funnelRoute = code("app/api/funnels/route.js");
ok(/funnelPageLanguage\(company\)/.test(funnelRoute) && /buildFunnelFromTemplate\(body\.template, \{ company, services, language \}\)/.test(funnelRoute) && /blankFunnelSteps\(language/.test(funnelRoute),
  "the create route builds every starter in the language the public page is drawn in");
const gen = code("lib/funnels/generate.js");
ok(/funnelPageLanguage\(company\)/.test(gen) && /language: LANGUAGES\.find/.test(gen) && /Write every string in the language named in "language"/.test(read("lib/funnels/generate.js")),
  "the AI generator writes in the page's language and falls back to the starter in that language");

// ═══ 2. Token protection ═════════════════════════════════════════════════════
section("2. Tokens never reach the model and must come back intact");

const src1 = "Hi {{clientName}}, your quote #{{quoteNumber}} is {{ quoteTotal }} — or $1,500 cash, 1 500,00 € or CHF 200. <b>Thanks</b> <a href=\"https://x.co/a?b=1&c=2\">see it</a>&nbsp;at www.acme.ca or mail office@acme.ca ⟦1⟧";
const p1 = protectText(src1);
ok(!/\{\{/.test(p1.text) && !/<[a-z/]/i.test(p1.text) && !/https?:/.test(p1.text) && !/@acme/.test(p1.text) && !/1,500|1 500|CHF/.test(p1.text),
  "tokens inside sentences, HTML, links, emails and amounts are all hidden", p1.text);
ok(p1.spans.includes("{{ quoteTotal }}") && p1.spans.includes("$1,500") && p1.spans.includes("1 500,00 €") && p1.spans.includes("CHF 200") && p1.spans.includes("⟦") && p1.spans.includes("⟧"),
  "…including a spaced token, three money formats and a literal marker bracket", p1.spans);
ok(restoreText(p1.text, p1.spans) === src1, "protect → restore is the identity");
// A model that reorders the markers (French word order) is fine.
const reordered = p1.text.replace("Hi", "Bonjour").replace("your quote", "votre devis");
ok(acceptModelString(src1, reordered).ok && acceptModelString(src1, reordered).text.includes("{{ quoteTotal }}"), "a faithful reply is accepted and restored byte-for-byte");
const firstMarker = "⟦1⟧";
const dropped = acceptModelString(src1, p1.text.replace(firstMarker, ""));
ok(!dropped.ok && dropped.reason === "dropped_token", "a dropped token is refused", dropped);
const doubled = acceptModelString(src1, p1.text + " " + firstMarker);
ok(!doubled.ok && doubled.reason === "duplicated_token", "a doubled token is refused", doubled);
const extraMarker = acceptModelString(src1, p1.text + " ⟦99⟧");
ok(!extraMarker.ok && extraMarker.reason === "extra_token", "an invented marker is refused", extraMarker);
const extraLiteral = acceptModelString("Hello there", "Bonjour {{clientName}}");
ok(!extraLiteral.ok && extraLiteral.reason === "extra_token", "a model ADDING a {{token}} of its own is refused", extraLiteral);
const renamed = acceptModelString("Hi {{clientName}}", "Bonjour {{nomClient}}");
ok(!renamed.ok, "a token translated into another name is refused", renamed);
const mangled = acceptModelString("Hi {{clientName}}", "Bonjour ⟦ 1⟧");
ok(!mangled.ok, "a mangled marker is refused", mangled);
ok(!acceptModelString("Hi", "").ok && !acceptModelString("Hi", "   ").ok, "an empty reply is refused");
ok(!acceptModelString("Hi", "x".repeat(1000)).ok, "a runaway reply is refused");
ok(checkHumanEdit("Hi {{clientName}}", "Bonjour {{clientName}}") === null && checkHumanEdit("Hi {{clientName}}", "Bonjour")?.missing?.[0] === "clientName" && checkHumanEdit("Hi", "Hi {{x}}")?.extra?.[0] === "x",
  "a person's edit: same tokens pass; a missing or added one is named");
ok(JSON.stringify(mergeTokensOf("{{a}} {{ b }} {{a}}")) === JSON.stringify(["a", "a", "b"]), "tokens are compared as a multiset");

// ═══ 3. When a translation is used ═══════════════════════════════════════════
section("3. Only an approved, current translation is ever sent");

const tpl = {
  id: "T1",
  type: "marketing_email",
  language: "en",
  subject: "A note from {{companyName}}",
  sentMode: "blocks",
  sections: [
    { id: "h", type: "heading", text: "Spring offer" },
    { id: "t", type: "text", text: "Hi {{clientName}},\n<b>10% off</b> until May." },
    { id: "b", type: "button", label: "Book now", url: "https://acme.ca/book" },
    { id: "i", type: "image", url: "https://img/x.png", alt: "Our work" },
    { id: "l", type: "lineItems", title: "What's included" },
    { id: "p", type: "progress", stages: ["Quote", "Our survey", "Project start"] },
    { id: "only", type: "text", text: "{{clientName}}" },
    { id: "d", type: "divider" },
  ],
};
const paths = extractStrings(tpl).map((s) => s.path);
ok(JSON.stringify(paths) === JSON.stringify(["subject", "block.h.text", "block.t.text", "block.b.label", "block.i.alt", "block.p.stages.1"]),
  "extract: subject, heading, text, button, alt and a CUSTOM stage — not URLs, default stages, the default list title or a token-only line", paths);
const words = {
  subject: "Un mot de {{companyName}}",
  "block.h.text": "Offre de printemps",
  "block.t.text": "Bonjour {{clientName}},\n<b>10 % de rabais</b> jusqu'en mai.",
  "block.b.label": "Réserver",
  "block.i.alt": "Nos réalisations",
  "block.p.stages.1": "Notre visite",
};
const hash = templateSourceHash(tpl, "en");
const strings = Object.fromEntries(extractStrings(tpl).map((s) => [s.path, { src: s.text, text: words[s.path] }]));
const approved = { language: "fr", status: "approved", sourceHash: hash, sourceLanguage: "en", strings };
const before = JSON.stringify(tpl);
const loc = localizeTemplate(tpl, new Map([["fr", approved]]), "fr");
ok(loc.translated && loc.template.subject === words.subject && loc.template.sections[2].label === "Réserver" && loc.template.sections[2].url === "https://acme.ca/book" && loc.template.sections[5].stages[1] === "Notre visite",
  "approved + current → the French words, the template's own links and layout");
ok(JSON.stringify(tpl) === before, "the template itself is never mutated");
const html = templateBody(loc.template, { clientName: "Élise", companyName: "Acme" }, { language: "fr" });
ok(/Bonjour Élise/.test(html) && /Offre de printemps/.test(html) && !/\{\{/.test(html), "the rendered email has the client's name filled in and no raw token");
ok(!localizeTemplate(tpl, { fr: { ...approved, status: "draft" } }, "fr").translated, "a draft is never sent");
ok(localizeTemplate(tpl, { fr: approved }, "es").reason === "none" && !localizeTemplate(tpl, { fr: approved }, "es").translated, "no translation for the reader's language → the original");
ok(localizeTemplate(tpl, { fr: approved }, "en").reason === "same_language", "a reader in the template's own language gets the original");
const edited = { ...tpl, sections: tpl.sections.map((b) => (b.id === "h" ? { ...b, text: "Summer offer" } : b)) };
ok(localizeTemplate(edited, { fr: approved }, "fr").reason === "stale", "the template changed after approval → the original until it is updated");
const tampered = { ...approved, strings: { ...strings, "block.t.text": { src: strings["block.t.text"].src, text: "Bonjour,\n10 % de rabais." } } };
ok(localizeTemplate(tpl, { fr: tampered }, "fr").reason === "token_mismatch", "a stored translation missing a token (edited in the database) is not sent");
ok(localizeTemplate(tpl, { fr: { ...approved, strings: { ...strings, subject: { src: strings.subject.src, text: "" } } } }, "fr").reason === "incomplete", "an empty line → the original, never a blank");
const canvasTpl = { id: "C", type: "marketing_email", language: "en", subject: "Hi", sentMode: "canvas", sections: [{ id: "x", type: "text", text: "unused blocks" }], canvas: { objects: [{ name: "clip", type: "rect" }, { type: "textbox", text: "Spring sale for {{clientName}}" }] } };
ok(JSON.stringify(extractStrings(canvasTpl).map((s) => s.path)) === JSON.stringify(["subject", "canvas.1.text"]), "a canvas template translates the canvas it sends, not its unused blocks");
const canvasHash = templateSourceHash(canvasTpl, "en");
const canvasLoc = localizeTemplate(canvasTpl, { de: { language: "de", status: "approved", sourceHash: canvasHash, strings: { subject: { src: "Hi", text: "Hallo" }, "canvas.1.text": { src: "Spring sale for {{clientName}}", text: "Frühlingsangebot für {{clientName}}" } } } }, "de");
ok(canvasLoc.translated && canvasLoc.template.canvas.objects[1].text.startsWith("Frühlings"), "a canvas translation is laid over the canvas");
ok(templateSourceHash({ ...tpl, sentMode: "canvas" }, "en") !== hash && templateSourceHash(tpl, "fr") !== hash, "switching body or authored language is a new version");
ok(templateLanguageOf({}, { defaultLanguage: "fr" }) === "fr" && templateLanguageOf({ language: "de" }, { defaultLanguage: "fr" }) === "de" && templateLanguageOf({ language: "xx" }, null) === "en",
  "authored language: the template's, else the company's, else English");
ok(overlayStrings(tpl, { "block.h.text": "X" }).sections[0].text === "X" && tpl.sections[0].text === "Spring offer", "overlayStrings (the review preview) copies, never mutates");
ok(extractStrings({}).length === 0 && extractStrings({ sections: "nope", subject: null }).length === 0 && extractStrings({ sections: [null, 5, { type: "heading" }] }).length === 0, "an empty or malformed template has nothing to translate and does not throw");
ok(LANGUAGES.every((l) => l.dir === "ltr"), "every document language is left-to-right — no direction handling is needed in the email shell (Arabic would change that)");

// ═══ 4. Drafting against a scripted model and database ════════════════════════
section("4. Drafting — one call per version, only what changed, never a raw token");

function fakeDb() {
  const rows = [];
  let n = 0;
  const match = (r, where) => Object.entries(where).every(([k, v]) => (k === "templateId_language" ? r.templateId === v.templateId && r.language === v.language : v && typeof v === "object" ? true : r[k] === v));
  const apply = (r, data) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && "increment" in v) r[k] = (r[k] || 0) + v.increment;
      else r[k] = v;
    }
    return r;
  };
  return {
    rows,
    aiFeaturePayer: { findUnique: async () => null },
    templateTranslation: {
      findUnique: async ({ where }) => rows.find((r) => match(r, where)) || null,
      findFirst: async ({ where }) => rows.find((r) => match(r, where)) || null,
      findMany: async ({ where }) => rows.filter((r) => match(r, where)),
      create: async ({ data }) => {
        const r = apply({ id: `TT${++n}`, drafts: 0, totalCostMicros: 0, status: "draft" }, data);
        rows.push(r);
        return r;
      },
      update: async ({ where, data }) => apply(rows.find((r) => r.id === where.id), data),
    },
  };
}
const prompts = [];
let reply = null; // (items) => data
const fakeComplete = async ({ prompt, onUsage, schema, system }) => {
  prompts.push({ prompt, system });
  await onUsage({ model: "gpt-5-mini", promptTokens: 900, completionTokens: 1200, cachedTokens: 0 });
  const asked = JSON.parse(prompt).strings;
  return { ok: true, data: reply(asked) };
};
// "Translate" by tagging every string and keeping its markers.
const faithful = (asked) => ({ strings: asked.map((s) => ({ id: s.id, text: `FR:${s.text}` })) });
const paidRecords = [];
const fakeMeter = async () => ({
  payer: "company",
  async check() {
    return { allowed: true, billing: "fieldquo" };
  },
  async record(usage, opts) {
    paidRecords.push({ usage, opts });
    return { billing: "fieldquo", chargedCents: 0, costMicros: measuredMicros(usage) };
  },
});
const company = { id: "CO1", defaultLanguage: "en" };
const deps = { complete: fakeComplete, isAiConfigured: () => true, emailTranslationMeter: fakeMeter };
const db1 = fakeDb();
reply = faithful;
const r1 = await draftTemplateTranslation({ template: tpl, company, language: "fr", prisma: db1, deps });
ok(r1.ok && prompts.length === 1 && db1.rows.length === 1 && db1.rows[0].status === "draft", "Translate: one model call, one draft row, not approved", r1.code);
ok(prompts.every((p) => !/\{\{/.test(p.prompt) && !/<b>/.test(p.prompt) && !/acme\.ca/.test(p.prompt)), "no raw {{token}}, HTML tag or link ever reaches the model's prompt");
ok(db1.rows[0].strings["block.t.text"].text === "FR:Hi {{clientName}},\n<b>10% off</b> until May.", "the reply is restored with the tokens and markup exactly as written");
ok(db1.rows[0].costMicros === estimateCostMicros({ model: "gpt-5-mini", promptTokens: 900, completionTokens: 1200 }) && db1.rows[0].billing === "fieldquo" && paidRecords.length === 1,
  "the measured cost and payer are stored on the row and recorded once");
ok(paidRecords[0].opts.ref.startsWith("email_translation:T1:fr:1:"), "the charge carries an idempotency ref per draft", paidRecords[0].opts.ref);
ok(!localizeTemplate(tpl, await translationsForSend(db1, "T1"), "fr").translated, "an unreviewed draft is not sent");
const r2 = await draftTemplateTranslation({ template: tpl, company, language: "fr", prisma: db1, deps });
ok(r2.ok && prompts.length === 1 && r2.reused === extractStrings(tpl).length, "Update on an unchanged template: no model call at all");
const tplEdited = { ...tpl, sections: tpl.sections.map((b) => (b.id === "h" ? { ...b, text: "Summer offer" } : b)) };
const r3 = await draftTemplateTranslation({ template: tplEdited, company, language: "fr", prisma: db1, deps });
ok(r3.ok && prompts.length === 2 && JSON.parse(prompts[1].prompt).strings.length === 1 && JSON.parse(prompts[1].prompt).strings[0].text === "Summer offer",
  "Update after one heading changed: only that line is sent", prompts[1] && JSON.parse(prompts[1].prompt).strings);
ok(db1.rows[0].drafts === 2 && db1.rows[0].totalCostMicros === 2 * db1.rows[0].costMicros && db1.rows[0].previousStrings, "drafts and total cost accumulate; the previous words are kept");
const r4 = await draftTemplateTranslation({ template: tplEdited, company, language: "fr", full: true, prisma: db1, deps });
ok(r4.ok && JSON.parse(prompts[2].prompt).strings.length === extractStrings(tplEdited).length, "Regenerate sends every line");
// Hostile replies.
reply = (asked) => ({
  strings: [
    { id: asked[0].id, text: "Un mot" }, // subject: dropped {{companyName}} marker
    { id: asked[1].id, text: `FR:${asked[1].text}` },
    { id: asked[1].id, text: "DUPLICATE id — ignored" },
    { id: "s999", text: "an id nobody asked for" },
    { id: asked[2].id, text: `FR:${asked[2].text} ⟦7⟧` }, // invented marker
    { id: asked[3].id, text: `FR:${asked[3].text}` },
    // asked[4] missing entirely; asked[5] a non-string
    { id: asked[5].id, text: 42 },
  ],
});
const db2 = fakeDb();
const r5 = await draftTemplateTranslation({ template: tpl, company, language: "de", prisma: db2, deps });
const reasons = Object.fromEntries((r5.problems || []).map((p) => [p.path, p.reason]));
ok(r5.ok && reasons.subject === "dropped_token" && reasons["block.t.text"] === "extra_token" && reasons["block.i.alt"] === "missing" && reasons["block.p.stages.1"] === "missing",
  "a reply that drops, invents or omits is refused line by line", reasons);
ok(db2.rows[0].strings.subject.text === "" && db2.rows[0].strings["block.h.text"].text.startsWith("FR:") && !db2.rows[0].strings["block.h.text"].text.includes("DUPLICATE"),
  "refused lines keep NO text; a duplicated id counts once; an unknown id is ignored");
const approveBad = await reviewTemplateTranslation({ row: db2.rows[0], template: tpl, company, approve: true, prisma: db2 });
ok(!approveBad.ok && approveBad.code === "cannot_approve", "a translation with refused lines cannot be approved");
const editBad = await reviewTemplateTranslation({ row: db2.rows[0], template: tpl, company, edits: { subject: "Ein Wort von uns" }, prisma: db2 });
ok(!editBad.ok && editBad.code === "token_mismatch" && editBad.errors[0].missing[0] === "companyName", "a person's edit that drops a token is refused — and names it");
const fix = {
  subject: "Ein Wort von {{companyName}}",
  "block.t.text": "Hallo {{clientName}},\n<b>10 % Rabatt</b> bis Mai.",
  "block.i.alt": "Unsere Arbeit",
  "block.p.stages.1": "Unsere Besichtigung",
};
const editOk = await reviewTemplateTranslation({ row: db2.rows[0], template: tpl, company, edits: fix, approve: true, userId: "U1", prisma: db2 });
ok(editOk.ok && db2.rows[0].status === "approved" && db2.rows[0].problems === null && db2.rows[0].approvedById === "U1", "fixed by a person and approved", editOk);
const sendDe = localizeTemplate(tpl, await translationsForSend(db2, "T1"), "de");
ok(sendDe.translated && sendDe.template.subject === fix.subject, "…and only now does a German reader get it");
const stop = await reviewTemplateTranslation({ row: db2.rows[0], template: tpl, company, approve: false, prisma: db2 });
ok(stop.ok && db2.rows[0].status === "draft" && !localizeTemplate(tpl, await translationsForSend(db2, "T1"), "de").translated, "Stop using → the original again");
// Empty, too long, unconfigured, refused by the meter — no model call.
const callsBefore = prompts.length;
ok((await draftTemplateTranslation({ template: { id: "E", sections: [], subject: "" }, company, language: "fr", prisma: fakeDb(), deps })).code === "nothing_to_translate", "an empty template: nothing_to_translate");
const huge = { id: "H", type: "marketing_email", language: "en", subject: "Hi", sections: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, type: "text", text: `Paragraph ${i} {{clientName}} `.padEnd(5_000, "lorem ipsum ") })) };
ok(translatableChars(extractStrings(huge)) > MAX_TRANSLATABLE_CHARS && (await draftTemplateTranslation({ template: huge, company, language: "fr", prisma: fakeDb(), deps })).code === "too_long", "a 25,000-character template: too_long");
ok((await draftTemplateTranslation({ template: tpl, company, language: "fr", prisma: fakeDb(), deps: { ...deps, isAiConfigured: () => false } })).code === "ai_unavailable", "no AI key: ai_unavailable");
ok((await draftTemplateTranslation({ template: tpl, company, language: "fr", prisma: fakeDb(), deps: { ...deps, emailTranslationMeter: async () => ({ async check() { return { allowed: false, code: "needs_credit_monthly", reason: "x" }; }, async record() { throw new Error("must not record"); } }) } })).code === "needs_credit_monthly",
  "the meter refuses: needs_credit_monthly");
ok((await draftTemplateTranslation({ template: tpl, company, language: "en", prisma: fakeDb(), deps })).code === "same_language" && (await draftTemplateTranslation({ template: tpl, company, language: "zz", prisma: fakeDb(), deps })).code === "bad_language", "same or unsupported language refused");
ok(prompts.length === callsBefore, "none of those reached the model");
// A 10k-character template is translated in one call.
reply = faithful;
const tenK = { id: "K", type: "marketing_email", language: "en", subject: "News from {{companyName}}", sections: [{ id: "a", type: "text", text: `Hi {{clientName}}, ${"we repaint kitchens, decks and fences. ".repeat(300)}`.slice(0, 10_000) }] };
const r10k = await draftTemplateTranslation({ template: tenK, company, language: "pa", prisma: fakeDb(), deps });
ok(r10k.ok && prompts.length === callsBefore + 1 && translatableChars(extractStrings(tenK)) >= 10_000, "a 10,000-character template: one call, translated");
// Manual.
const db3 = fakeDb();
const man = await startManualTranslation({ template: tpl, company, language: "it", prisma: db3 });
ok(man.ok && man.created && Object.values(db3.rows[0].strings).every((e) => e.text === "") && prompts.length === callsBefore + 1, "Write it yourself: an empty draft, no model, no cost");
ok((await startManualTranslation({ template: tpl, company, language: "it", prisma: db3 })).created === false, "…pressed twice, it never wipes the words");
// Panel summary.
const sum = summariseTranslations({ template: tpl, company, rows: db2.rows });
ok(sum.length === LANGUAGE_CODES.length - 1 && !sum.find((l) => l.language === "en") && sum.find((l) => l.language === "de").exists && sum.every((l) => l.estimateMicros > 0),
  "the panel lists every other language, with an estimate for each");
ok(JSON.stringify(acceptModelReply([{ id: "s1", path: "subject", source: "Hi {{clientName}}" }], { strings: "garbage" }).problems) === JSON.stringify([{ path: "subject", reason: "missing" }]), "a reply that isn't the schema is a 'missing' problem, not a throw");

// ═══ 5. Money ════════════════════════════════════════════════════════════════
section("5. Who pays — the wallet, FieldQuo up to 5¢ and $1 a month, or refused");

ok(PER_VERSION_ABSORB_MAX_MICROS === 50_000 && MONTHLY_ABSORB_CAP_MICROS === 1_000_000, "the two thresholds: 5¢ a version, $1.00 a month");
const v = (o) => translationVerdict({ platformBudgetAllowed: true, absorbedThisMonthMicros: 0, ...o });
ok(v({ balanceCents: 100, estimateMicros: 2_000 }).billing === "wallet", "credit covers it → the AI credit");
ok(v({ balanceCents: 100, estimateMicros: 200_000 }).billing === "wallet", "credit covers a 20¢ translation → still the AI credit");
ok(v({ balanceCents: 0, estimateMicros: 2_000 }).billing === "fieldquo", "no credit, 0.2¢ → FieldQuo absorbs");
ok(v({ balanceCents: 0, estimateMicros: 50_000 }).billing === "fieldquo" && v({ balanceCents: 0, estimateMicros: 50_001 }).code === "needs_credit_large", "exactly 5¢ is absorbed; a hair over needs credit");
ok(v({ balanceCents: 0, estimateMicros: 2_000, absorbedThisMonthMicros: 998_000 }).billing === "fieldquo" && v({ balanceCents: 0, estimateMicros: 2_000, absorbedThisMonthMicros: 998_001 }).code === "needs_credit_monthly", "the monthly cap, to the micro");
ok(v({ balanceCents: 0, estimateMicros: 2_000, platformBudgetAllowed: false }).code === "platform_paused", "FieldQuo's own AI budget closed → paused, nothing charged");
ok(v({ balanceCents: "NaN", estimateMicros: 2_000 }).billing === "fieldquo" && v({ balanceCents: 1, estimateMicros: 2_000 }).billing === "wallet", "an unreadable balance counts as empty; 1¢ covers a sub-cent translation (charged ≥ 1¢)");
ok(measuredMicros({ model: "gpt-5-mini", promptTokens: 1000, cachedTokens: 800, completionTokens: 0 }) === Math.round((200 * 0.13 + 800 * 0.013) ), "cached prompt tokens are priced at 10% of input",
  measuredMicros({ model: "gpt-5-mini", promptTokens: 1000, cachedTokens: 800, completionTokens: 0 }));

// The meter itself, with scripted ledgers.
clearPayerCache();
const ledger = { platform: [], usage: [], debits: [] };
const meterDeps = (balance, absorbed = 0) => ({
  balanceFor: async () => balance,
  absorbedThisMonth: async () => absorbed,
  checkPlatformAiBudget: async () => ({ allowed: true }),
  recordPlatformAiUsage: async (_p, row) => ledger.platform.push(row),
  recordAiUsage: async (row) => ledger.usage.push(row),
  debitCredit: async (d) => (ledger.debits.push(d), { cents: -d.cents }),
});
const usage = { model: "gpt-5-mini", promptTokens: 1200, completionTokens: 1800, cachedTokens: 400 };
const prismaNoRow = { aiFeaturePayer: { findUnique: async () => null } };
const mFree = await emailTranslationMeter({ companyId: "C1", userId: "U1", estimateMicros: 2_500, prisma: prismaNoRow, deps: meterDeps(0) });
const gFree = await mFree.check();
const pFree = await mFree.record(usage, { meta: { companyId: "EVIL", templateId: "T1" } });
ok(gFree.billing === "fieldquo" && pFree.billing === "fieldquo" && ledger.platform.length === 1 && ledger.usage.length === 0 && ledger.debits.length === 0,
  "absorbed: FieldQuo's ledger only — the company's AiUsage allowance is untouched", ledger);
ok(ledger.platform[0].area === EMAIL_TRANSLATION_FEATURE && ledger.platform[0].meta.companyId === "C1" && ledger.platform[0].cachedTokens === 400, "…attributed to the company (a caller's meta cannot re-attribute it), cached tokens passed");
clearPayerCache();
const mPaid = await emailTranslationMeter({ companyId: "C1", userId: "U1", estimateMicros: 2_500, prisma: prismaNoRow, deps: meterDeps(500) });
await mPaid.check();
const pPaid = await mPaid.record(usage, { ref: "email_translation:T1:fr:1:h" });
const cost = estimateCostMicros({ model: "gpt-5-mini", promptTokens: 1200, completionTokens: 1800, cachedTokens: 400 });
ok(pPaid.billing === "wallet" && pPaid.chargedCents === Math.max(0, chatChargeCents(cost)) && ledger.debits[0].kind === "email_translation" && ledger.debits[0].ref === "email_translation:T1:fr:1:h",
  "with credit: debited at the wallet rate, idempotent ref, kind email_translation", { pPaid, cost });
ok(ledger.usage[0].paidFromWallet === true && ledger.usage[0].cachedTokens === 400, "…and the AiUsage row is marked paid from the wallet (kept out of the allowance)");
clearPayerCache();
const mRef = await emailTranslationMeter({ companyId: "C1", estimateMicros: 60_000, prisma: prismaNoRow, deps: meterDeps(0) });
ok((await mRef.check()).code === "needs_credit_large", "no credit and over 5¢ → refused before the call");
clearPayerCache();
const switched = { aiFeaturePayer: { findUnique: async () => ({ feature: "email_translation", payer: "fieldquo" }) }, platformAiBudget: { findMany: async () => [] } };
const mSwitch = await emailTranslationMeter({ companyId: "C1", estimateMicros: 999_999_999, prisma: switched, deps: { ...meterDeps(0), recordPlatformAiUsage: async (_p, row) => ledger.platform.push(row) } });
ok(mSwitch.payer === "fieldquo" && (await mSwitch.check()).allowed === true, "/platform switch set to FieldQuo → FieldQuo pays every translation, whatever its size");
clearPayerCache();
ok(poolForKind("email_translation") === POOLS.AI, "a debit lands in the AI wallet, not the voice one");
const reg = PAYER_FEATURES.find((f) => f.feature === "email_translation");
ok(reg && reg.wired && reg.defaultPayer === "company" && reg.companyLedger === "wallet", "registered on the /platform switch, wired, company-paid from the wallet by default");
ok(/meterFor\("email_translation"/.test(code("lib/ai/emailTranslationMeter.js")), "…and the meter routes through meterFor(\"email_translation\")");

// Estimated cost of a typical email, printed for the report.
console.log("\n  Estimated cost per translated version (standard model, before the call; the panel shows the measured figure after):");
for (const words of [150, 300]) {
  const chars = Math.round(words * 6); // ~6 characters per English word incl. spaces and punctuation
  const row = LANGUAGE_CODES.filter((l) => l !== "en").map((to) => {
    const t = estimateTranslationTokens({ chars, strings: 6, from: "en", to });
    const m = estimateTranslationMicros({ chars, strings: 6, from: "en", to });
    return `${to} ${(m / 10_000).toFixed(3)}¢ (${t.promptTokens}+${t.completionTokens} tok)`;
  });
  console.log(`    ${words} words: ${row.join(" · ")}`);
}
for (const model of ["gpt-5.5"]) {
  const m = estimateTranslationMicros({ chars: 1800, strings: 6, from: "en", to: "pa", model });
  console.log(`    300 words into Punjabi on ${model}: ${(m / 10_000).toFixed(2)}¢ — where the 5¢ line starts to matter`);
}
const tenKm = estimateTranslationMicros({ chars: 10_000, strings: 2, from: "en", to: "pa" });
console.log(`    10,000 characters into Punjabi (worst script): ${(tenKm / 10_000).toFixed(3)}¢`);
ok(estimateTranslationMicros({ chars: 1800, strings: 6, from: "en", to: "pa" }) < PER_VERSION_ABSORB_MAX_MICROS, "a typical email on the standard model is well under the 5¢ line");

// ═══ 6. Wiring ═══════════════════════════════════════════════════════════════
section("6. Wiring — both send paths, never a model at send time; strings in every language");

const campaign = code("app/api/marketing/campaigns/[id]/send/route.js");
ok(/translationsForSend\(db, campaign\.template\.id\)/.test(campaign) && /localizeTemplate\(campaign\.template, translations, language, campaign\.company\)/.test(campaign) && /templateBody\(template, mergeData/.test(campaign) && /renderSubject\(\s*template\.subject/.test(campaign),
  "campaign send: reads approved translations once, localises per subscriber, renders the localised body AND subject");
const cron = code("app/api/cron/follow-ups/route.js");
ok(/translationsForSend\(db, rule\.template\.id\)/.test(cron) && /localizeTemplate\(\s*rule\.template,/.test(cron) && /html = templateBody\(template, mergeData/.test(cron) && /renderSubject\(template\.subject/.test(cron),
  "follow-up cron: the same, in the document's language (followUpLanguage)");
for (const [name, src] of [["campaign", campaign], ["cron", cron]]) {
  ok(!/lib\/ai\/provider|draftTemplateTranslation|complete\(/.test(src), `${name}: no model is ever called at send time`);
}
const panel = code("app/components/settings/TemplateTranslationsPanel.js");
ok(/app\.emailTranslations\.rule/.test(panel) && /app\.emailTranslations\.documentRule/.test(panel) && /formatMicros\(row\.costMicros\)/.test(panel), "the panel states the rule and shows each translation's cost");
const editor = code("app/app/settings/email-templates/[id]/page.js");
ok(/<TemplateTranslationsPanel/.test(editor) && /language: authoredLanguage/.test(editor) && /newBlock\(type, authoredLanguage\)/.test(editor), "the editor shows the panel, saves the authored language, adds blocks in it");
const used = new Set([...read("app/components/settings/TemplateTranslationsPanel.js").matchAll(/"(app\.emailTranslations\.[\w.]+)"/g)].map((m) => m[1]).concat([...read("app/app/settings/email-templates/[id]/page.js").matchAll(/"(app\.emailTranslations\.[\w.]+)"/g)].map((m) => m[1])));
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = [...used].filter((k) => typeof APP_MESSAGES[lang][k] !== "string");
  ok(missing.length === 0, `appMessages ${lang}: every Translations string present`, missing);
  const ph = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(",");
  const bad = [...used].filter((k) => ph(APP_MESSAGES[lang][k]) !== ph(APP_MESSAGES.en[k]));
  ok(bad.length === 0, `appMessages ${lang}: placeholders match English`, bad);
}

console.log(`\n${checks} checks, ${failures} failure(s).${failures ? "" : " Every client gets words a person at the company read — or the original."}\n`);
if (failures) process.exitCode = 1;
