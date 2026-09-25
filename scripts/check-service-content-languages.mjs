// scripts/check-service-content-languages.mjs
//
//   npm run check:service-content-languages
//   node --import ./scripts/alias-loader.mjs scripts/check-service-content-languages.mjs --lang=es
//
// Every preset string a quote prints about a trade — the generic block, and
// every trade's description, door/work variants, inclusions, process steps
// (with their timelines), "what could change this price" and glossary —
// exists in all eight document languages. The owner asked (2026-09-25) "are
// the presets already translated in the job process on your quotes?"; before
// this, six of the eight languages printed the English sentences.
//
// Structural, walked from the English: a catalogue that lacks a key, has a
// list of a different length, drops a step's timeline, or loses a
// [placeholder] fails here, not on a client's quote. The resolver falls back
// to English per field, so a gap would otherwise be silent.

import { resolveServiceContent, dominantProcessSteps, dominantGlossary, presetCatalogues, presetLanguage } from "../lib/documents/serviceContent.js";
import { unfilledPlaceholders } from "../lib/documents/contractTerms.js";
import { LANGUAGE_CODES } from "../app/i18n/languages.js";

let passed = 0;
let failed = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    failures.push(`  ✗ ${name}${extra === undefined ? "" : " " + JSON.stringify(extra)?.slice(0, 300)}`);
  }
}

const only = (process.argv.find((a) => a.startsWith("--lang=")) || "").slice("--lang=".length) || null;
const cats = presetCatalogues();
const EN = cats.en;
const TEXT_FIELDS = ["description", "variantLabel", "variants", "included", "steps", "mayChange", "glossary"];
// Words that only an untranslated English sentence carries. Applied to every
// language: none of the seven uses these as words of its own.
const ENGLISH = /\b(the|and|with|your|we|is|are|of)\b/i;
const SCRIPT = {
  uk: /[Ѐ-ӿ]/, // Cyrillic
  pa: /[਀-੿]/, // Gurmukhi
};

ok("the eight document languages are the eight catalogues", LANGUAGE_CODES.every((l) => cats[l]) && Object.keys(cats).length === 8, Object.keys(cats));
ok("presetLanguage: 'fr-CA' → fr, 'ES' → es, 'pt' → en, null → en",
  presetLanguage("fr-CA") === "fr" && presetLanguage("ES") === "es" && presetLanguage("pt") === "en" && presetLanguage(null) === "en");

function checkString(where, lang, en, tr) {
  ok(`${lang} ${where}: present`, typeof tr === "string" && tr.trim().length > 0, tr);
  if (typeof tr !== "string" || !tr.trim()) return;
  // One word may genuinely be the same word ("Application" in French, "Fascia"
  // in Italian); a phrase that is identical was not translated.
  ok(`${lang} ${where}: translated, not the English`, tr.trim() !== en.trim() || !/\s/.test(en.trim()), tr.slice(0, 80));
  ok(`${lang} ${where}: no English words left in it`, !ENGLISH.test(tr), tr.slice(0, 120));
  if (SCRIPT[lang]) ok(`${lang} ${where}: written in its own script`, SCRIPT[lang].test(tr), tr.slice(0, 60));
  // A bracket is a prompt the resolver withholds until the company fills it
  // in. One lost — or one longer than the 80 characters the matcher reads —
  // would print on a client's quote WITH its brackets.
  const enBrackets = unfilledPlaceholders(en).length;
  ok(`${lang} ${where}: keeps its ${enBrackets} [placeholder](s), each under 80 characters`,
    unfilledPlaceholders(tr).length === enBrackets && (tr.match(/\[/g) || []).length === (en.match(/\[/g) || []).length,
    { en: unfilledPlaceholders(en), tr: unfilledPlaceholders(tr) });
}

function checkList(where, lang, enList, trList, keys) {
  ok(`${lang} ${where}: same number of entries as the English (${enList.length})`, Array.isArray(trList) && trList.length === enList.length, Array.isArray(trList) ? trList.length : trList);
  if (!Array.isArray(trList)) return;
  enList.forEach((e, i) => {
    const t = trList[i];
    if (typeof e === "string") return checkString(`${where}[${i}]`, lang, e, t);
    for (const k of keys) {
      if (typeof e[k] === "string") checkString(`${where}[${i}].${k}`, lang, e[k], t?.[k]);
      else ok(`${lang} ${where}[${i}].${k}: absent in English, absent here`, t?.[k] === undefined, t?.[k]);
    }
  });
}

function checkEntry(where, lang, en, tr) {
  for (const field of TEXT_FIELDS) {
    const e = en[field];
    if (e === undefined) continue;
    const t = tr?.[field];
    if (field === "description" || field === "variantLabel") checkString(`${where}.${field}`, lang, e, t);
    else if (field === "variants") {
      ok(`${lang} ${where}.variants: same keys`, t && Object.keys(t).sort().join() === Object.keys(e).sort().join(), t && Object.keys(t));
      for (const k of Object.keys(e)) checkString(`${where}.variants.${k}`, lang, e[k], t?.[k]);
    } else if (field === "included") checkList(`${where}.included`, lang, e, t, []);
    else if (field === "steps") checkList(`${where}.steps`, lang, e, t, ["title", "body", "timeline"]);
    else if (field === "mayChange") checkList(`${where}.mayChange`, lang, e, t, ["title", "body"]);
    else if (field === "glossary") checkList(`${where}.glossary`, lang, e, t, ["term", "body"]);
  }
}

const langs = LANGUAGE_CODES.filter((l) => l !== "en" && (!only || l === only));
for (const lang of langs) {
  const c = cats[lang];
  checkEntry("GENERIC", lang, EN.generic, c.generic);
  for (const key of Object.keys(EN.content)) {
    ok(`${lang}: has an entry for ${key}`, Object.prototype.hasOwnProperty.call(c.content, key));
    checkEntry(key, lang, EN.content[key], c.content[key] || {});
  }
  for (const key of Object.keys(c.content)) {
    ok(`${lang}: ${key} is a real trade key (no typo'd entry the resolver never reads)`, Object.prototype.hasOwnProperty.call(EN.content, key));
  }

  // ── Through the resolver: what a document in this language prints ──────
  for (const key of Object.keys(EN.content)) {
    const en = resolveServiceContent(key, null, null, "en");
    const tr = resolveServiceContent(key, null, null, lang);
    const t = c.content[key] || {};
    if (t.description) ok(`${lang} ${key}: the document prints this language's description`, tr.description === t.description);
    const englishPrinted = new Set([en.description, ...en.included, ...en.steps.flatMap((x) => [x.title, x.body, x.timeline]), ...en.mayChange.flatMap((m) => [m.title, m.body]), ...en.glossary.flatMap((g) => [g.term, g.body])]);
    const leaked = [tr.description, ...tr.included, ...tr.steps.flatMap((s) => [s.title, s.body, s.timeline]), ...tr.mayChange.flatMap((m) => [m.title, m.body]), ...tr.glossary.flatMap((g) => [g.term, g.body])]
      // Same single-word allowance as checkString: "Application" is French too.
      .filter((s) => s && /\s/.test(s.trim()) && englishPrinted.has(s));
    ok(`${lang} ${key}: nothing printed is the English sentence`, leaked.length === 0, leaked);
    ok(`${lang} ${key}: same counts as English after placeholders are withheld`,
      tr.included.length === en.included.length && tr.steps.length === en.steps.length && tr.mayChange.length === en.mayChange.length && tr.glossary.length === en.glossary.length,
      [tr.included.length, en.included.length, tr.steps.length, en.steps.length]);
    ok(`${lang} ${key}: the accent colour rides through from English`, tr.accent === en.accent);
  }
  const unknown = resolveServiceContent("no_such_trade", null, null, lang);
  ok(`${lang}: an unknown trade gets this language's generic inclusions`, unknown.included.join() === (c.generic.included || []).join());
  ok(`${lang}: a regional code (${lang}-XX) resolves to the same catalogue`,
    JSON.stringify(resolveServiceContent("interior_painting", null, null, `${lang}-XX`)) === JSON.stringify(resolveServiceContent("interior_painting", null, null, lang)));
  ok(`${lang}: no groups — this language's generic steps`, dominantProcessSteps([], lang).every((s, i) => s.title === c.generic.steps?.[i]?.title));
  ok(`${lang}: the dominant trade's glossary is in this language`,
    dominantGlossary([{ categoryKey: "roofing_service", subtotal: 1 }], lang)[0]?.term === c.content.roofing_service?.glossary?.[0]?.term);

  // A company's own override still wins, in whatever language it was typed.
  const own = resolveServiceContent("interior_painting", { scopeDescription: "Company text.", includedItems: ["Line 1"] }, null, lang);
  ok(`${lang}: a company override wins over the catalogue`, own.description === "Company text." && own.included.join() === "Line 1");
}

ok("no language at all is English, exactly as before", JSON.stringify(resolveServiceContent("cabinet_refacing", null, null)) === JSON.stringify(resolveServiceContent("cabinet_refacing", null, null, "en")));
ok("an unsupported language is English", JSON.stringify(resolveServiceContent("cabinet_refacing", null, null, "pt")) === JSON.stringify(resolveServiceContent("cabinet_refacing", null, null, "en")));

// ── Every glossary call names the document's language ──────────────────────
// dominantGlossary took no language until 2026-09-25, so a French roofing
// quote printed its glossary in English. Code lines only.
{
  const fs = await import("node:fs");
  const ROOT = new URL("..", import.meta.url).pathname;
  for (const [file, lang] of [
    ["app/api/public/quotes/[token]/route.js", "docLanguage"],
    ["app/api/quotes/[id]/document/route.js", "quote\\.language"],
    ["app/api/invoices/[id]/document/route.js", "invoice\\.language"],
    ["lib/documentSections/ScopeGroupsSection.js", "language"],
  ]) {
    const src = fs.readFileSync(ROOT + file, "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const calls = src.match(/dominantGlossary\(/g) || [];
    const withLang = src.match(new RegExp(`dominantGlossary\\([\\s\\S]{0,400}?${lang},?\\s*\\)`, "g")) || [];
    ok(`${file}: every dominantGlossary call passes the document's language`, calls.length > 0 && withLang.length === calls.length, { calls: calls.length, withLang: withLang.length });
  }
}

if (failures.length) console.error(failures.slice(0, 60).join("\n") + (failures.length > 60 ? `\n  … and ${failures.length - 60} more` : ""));
console.log(`\ncheck-service-content-languages${only ? ` (${only})` : ""}: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
