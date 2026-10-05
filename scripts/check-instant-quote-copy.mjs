// scripts/check-instant-quote-copy.mjs
//
//   npm run check:instant-quote-copy
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-instant-quote-copy.mjs
//
// The public instant-estimate page in its eight languages, executed rather
// than read:
//
//   1. lib/i18n/instantQuoteCopy.js — and every other table the flow reads —
//      carries every key in all eight languages, with no English sentence
//      left standing inside a non-English block (an equal-to-English string,
//      a run of English function words, or — for Ukrainian and Punjabi — a
//      sentence with no Cyrillic / Gurmukhi in it at all).
//   2. Every instant trade has a chip label and a report noun in the eight
//      languages, and the English one is the label the server has always used.
//   3. Every junk-removal item and job type is named in the seven others.
//   4. The payload really is localised: loadCompanyInstantTrades over the db
//      stub, asked for a language the company offers, answers in it.
//   5. The measure and request routes resolve the POSTED language against
//      the company's offered list; the submission carries the language, the
//      "when", the answers and the note; the draft and the lead are created
//      in it.
//   6. The form has no `fr ?` ternary left and none of the English strings
//      it used to hardcode.
//   6b. The company's choice: unset → exactly en/fr/es (today's forms do not
//      change), a saved ["de","pa"] is honoured, a crafted ?lang= for a
//      language it does not offer never wins, and the save accepts all eight
//      and refuses [] and junk.
//   7. The pills and the button measure ≥ 4.5:1 on five hostile brands.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INSTANT_QUOTE_COPY,
  INSTANT_QUOTE_LANGUAGES,
  INSTANT_QUOTE_DEFAULT_LANGUAGES,
  INSTANT_TRADE_WORDS,
  JUNK_ITEM_WORDS,
  JUNK_JOB_TYPE_WORDS,
  instantQuoteCopy,
  instantQuoteLanguage,
  instantQuoteLocale,
  instantTradeLabel,
  instantTradeBlurb,
  INSTANT_TRADE_BLURBS,
  junkItemLabel,
} from "@/lib/i18n/instantQuoteCopy";
import {
  sanitiseInstantLanguages,
  offeredInstantLanguages,
  resolveInstantLanguage,
  instantLanguagesForSave,
} from "@/lib/estimate/instantQuoteLanguages";
import { LANGUAGES, LANGUAGE_CODES } from "@/app/i18n/languages";
import { LAWN_ESTIMATE_COPY } from "@/lib/i18n/lawnEstimateCopy";
import { GUTTER_ESTIMATE_COPY } from "@/lib/i18n/gutterEstimateCopy";
import { ESTIMATE_REPORT_COPY } from "@/lib/i18n/estimateReportCopy";
import { MEASURE_DOC_COPY } from "@/lib/i18n/measureDocCopy";
import { TRADE_QUESTION_COPY, cleanTradeAnswers } from "@/lib/leads/tradeQuestions";
import { SERVICE_AREA_COPY } from "@/lib/company/serviceArea";
import { INSTANT_ESTIMATE_TRADES, INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";
import { TRADE_LABELS, loadCompanyInstantTrades } from "@/lib/estimate/instantQuoteServer";
import { JUNK_ITEMS, JOB_TYPES } from "@/lib/junk/pricing";
import { lockedEstimateMessage, gatedMessage } from "@/lib/estimate/visibility";
import { budgetBands } from "@/lib/estimate/budgetBands";
import { measureErrorMessage } from "@/lib/estimate/measureErrorMessage";
import { buildEstimateEmail } from "@/lib/estimate/estimateEmail";
import { financingCtaLabel } from "@/lib/estimate/financing";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { rows, resetDbStub } from "@/lib/db";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got === undefined ? "" : `\n      got: ${JSON.stringify(got)}`}`);
  }
};

const OTHERS = INSTANT_QUOTE_LANGUAGES.filter((l) => l !== "en");

// ── 0. The language list itself ────────────────────────────────────────────
console.log("\nThe form's languages are the product's eight");
ok("INSTANT_QUOTE_LANGUAGES is app/i18n/languages.js LANGUAGE_CODES, in that order", JSON.stringify(INSTANT_QUOTE_LANGUAGES) === JSON.stringify(LANGUAGE_CODES), INSTANT_QUOTE_LANGUAGES);
ok("…eight of them, and no zh / ko / pt / ru", INSTANT_QUOTE_LANGUAGES.length === 8 && !["zh", "ko", "pt", "ru"].some((l) => INSTANT_QUOTE_LANGUAGES.includes(l)));
ok("the never-chosen default is exactly en / fr / es", JSON.stringify(INSTANT_QUOTE_DEFAULT_LANGUAGES) === JSON.stringify(["en", "fr", "es"]));
ok("instantQuoteLanguage: fr-CA → fr, ES → es, de-AT → de, pa-IN → pa, UK → uk, it → it", instantQuoteLanguage("fr-CA") === "fr" && instantQuoteLanguage("ES") === "es" && instantQuoteLanguage("de-AT") === "de" && instantQuoteLanguage("pa-IN") === "pa" && instantQuoteLanguage("UK") === "uk" && instantQuoteLanguage("it") === "it");
ok("instantQuoteLanguage: a browser's Filipino (fil, fil-PH) is Tagalog", instantQuoteLanguage("fil") === "tl" && instantQuoteLanguage("fil-PH") === "tl" && instantQuoteLanguage("tl") === "tl");
ok("instantQuoteLanguage refuses zh, ko, pt, ru, xx, '', null, <script>", ["zh", "zh-CN", "ko", "pt-BR", "ru", "xx", "", null, "<script>"].every((v) => instantQuoteLanguage(v) === null));
ok("every language has a number locale of its own", INSTANT_QUOTE_LANGUAGES.every((l) => typeof instantQuoteLocale(l) === "string" && instantQuoteLocale(l).toLowerCase().startsWith(l === "tl" ? "fil" : l)) && instantQuoteLocale("xx") === "en-CA");
{
  const native = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.nativeName]));
  const names = INSTANT_QUOTE_COPY.en.languageNames;
  ok("every pill name is the language's own name (languages.js nativeName)", INSTANT_QUOTE_LANGUAGES.every((l) => names[l] === native[l]), names);
  ok("…and every block draws the same eight names", INSTANT_QUOTE_LANGUAGES.every((l) => JSON.stringify(INSTANT_QUOTE_COPY[l].languageNames) === JSON.stringify(names)));
}

// Walk a copy table: every leaf path with its value, functions probed with
// sample arguments so a translated template is compared as a sentence.
function leaves(obj, path = []) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = [...path, k];
    if (typeof v === "function") out.push([p.join("."), String(v("X", "Y", "Z"))]);
    else if (Array.isArray(v)) out.push([p.join("."), JSON.stringify(v)]);
    else if (v && typeof v === "object") out.push(...leaves(v, p));
    else out.push([p.join("."), String(v)]);
  }
  return out;
}

// Strings that are legitimately the same word in two languages.
const SAME_OK = new Set([
  "Photos", "Notes", "Interior", "Exterior", "No", "Table", "Chair", "PDF", "$X,XXX – $X,XXX",
  "English", "Français", "Español", "Autre", "Otro", "Quand", "Cuándo", "X services",
]);
// …and per language, where the word really is the same: French "Date" and
// "Commercial"; Tagalog writes email, website and the foot units as English
// does (a number-formatting probe given "X" prints NaN before the unit);
// German "Name"; the unit after a figure; Italian's "per".
const SAME_OK_BY_LANG = {
  fr: new Set(["Date", "Commercial"]),
  tl: new Set(["Email", "Website", "sq ft", "X sq ft", "X ft", "NaN sq ft"]),
  de: new Set(["Name", "X ft"]),
  it: new Set(["per X"]),
};
// English running text: a non-English block that contains these words is an
// English sentence (or half of one) left standing. Latin-script languages
// share letters with English, so equality alone misses "Your … – Ihre …".
const ENGLISH_WORDS = /\b(the|your|you|we|we'll|with|from|please|our|this|that|and|request|measured)\b/i;
// Ukrainian and Punjabi use their own scripts, so a sentence with Latin
// letters and none of theirs is English.
const SCRIPT = { uk: /[Ѐ-ӿ]/, pa: /[਀-੿]/ };
// Latin that is allowed inside a uk / pa string: the sample address, the
// Enter key, the L/U staircase shapes, BBQ, PDF and the probe arguments.
const LATIN_OK = /^(?:[\sXYZ\d.,:;!?·—–\-+*/()"'«»„“”$%№#|]|PDF|BBQ|Enter|L|U|Littlerock|St|sq|ft)*$/u;

function checkTable(name, table) {
  console.log(`\n${name}: eight languages, no English left inside the other seven`);
  ok(`${name}: exactly the eight languages`, INSTANT_QUOTE_LANGUAGES.every((l) => table[l]) && Object.keys(table).length === 8, Object.keys(table));
  const en = new Map(leaves(table.en));
  for (const code of OTHERS) {
    const other = new Map(leaves(table[code] || {}));
    const missing = [...en.keys()].filter((k) => !other.has(k));
    const extra = [...other.keys()].filter((k) => !en.has(k));
    ok(`${code}: every en key present (${en.size})`, missing.length === 0, missing);
    ok(`${code}: no keys en lacks`, extra.length === 0, extra);
    const allowed = SAME_OK_BY_LANG[code] || new Set();
    const same = [...en].filter(([k, v]) => other.get(k) === v && !SAME_OK.has(v) && !allowed.has(v) && !k.startsWith("languageNames") && v.length > 3);
    ok(`${code}: no English sentence duplicated as the translation`, same.length === 0, same.slice(0, 5));
    const english = [...other].filter(([k, v]) => !k.startsWith("languageNames") && !k.startsWith("pdfFilename") && ENGLISH_WORDS.test(v.replace(/X|Y|Z/g, "")));
    ok(`${code}: no English running text`, english.length === 0, english.slice(0, 5));
    if (SCRIPT[code]) {
      const latinOnly = [...other].filter(
        ([k, v]) => !k.startsWith("languageNames") && !k.startsWith("pdfFilename") && /[A-Za-z]/.test(v) && !SCRIPT[code].test(v) && !LATIN_OK.test(v),
      );
      ok(`${code}: every sentence is written in its own script`, latinOnly.length === 0, latinOnly.slice(0, 5));
    }
  }
}

checkTable("instantQuoteCopy", INSTANT_QUOTE_COPY);
checkTable("lawnEstimateCopy", LAWN_ESTIMATE_COPY);
checkTable("gutterEstimateCopy", GUTTER_ESTIMATE_COPY);
checkTable("estimateReportCopy", ESTIMATE_REPORT_COPY);
checkTable("measureDocCopy", MEASURE_DOC_COPY);
checkTable("tradeQuestions", TRADE_QUESTION_COPY);
checkTable("serviceArea", SERVICE_AREA_COPY);

// ── 2. Every instant trade has a chip label in the eight languages ────────
console.log("\nEvery instant trade is named in all eight languages");
for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
  const row = INSTANT_TRADE_WORDS[trade];
  ok(`${trade}: a label in all eight`, row && INSTANT_QUOTE_LANGUAGES.every((c) => row[c]?.label?.trim()), row);
  ok(`${trade}: en label is the server's TRADE_LABELS entry`, row?.en?.label === TRADE_LABELS[trade], [row?.en?.label, TRADE_LABELS[trade]]);
  ok(`${trade}: no other language's label is the English one`, row && OTHERS.every((c) => row[c].label !== row.en.label));
  ok(`${trade}: a report-title noun in all eight, none of them the English noun`, row && INSTANT_QUOTE_LANGUAGES.every((c) => row[c]?.noun?.trim()) && OTHERS.every((c) => row[c].noun !== row.en.noun));
  ok(`${trade}: uk / pa label and noun in their own scripts`, row && ["uk", "pa"].every((c) => SCRIPT[c].test(row[c].label) && SCRIPT[c].test(row[c].noun)));
}
ok("an unknown trade falls back to the passed English label, then the key", instantTradeLabel("zzz", "fr", "Zed") === "Zed" && instantTradeLabel("zzz", "fr") === "zzz");
ok("a German chip is German", instantTradeLabel("roofing", "de") === "Dacharbeiten" && instantTradeLabel("roofing", "zh") === "Roofing");

// ── 3. Junk items and job types ────────────────────────────────────────────
console.log("\nEvery junk-removal item and job type is named in the seven other languages");
{
  const missingItems = JUNK_ITEMS.filter((i) => OTHERS.some((c) => !JUNK_ITEM_WORDS[i.key]?.[c])).map((i) => i.key);
  ok(`all ${JUNK_ITEMS.length} items, in ${OTHERS.join("/")}`, missingItems.length === 0, missingItems);
  const missingTypes = Object.values(JOB_TYPES).filter((j) => OTHERS.some((c) => !JUNK_JOB_TYPE_WORDS[j.key]?.[c])).map((j) => j.key);
  ok(`all ${Object.keys(JOB_TYPES).length} job types, in ${OTHERS.join("/")}`, missingTypes.length === 0, missingTypes);
  const englishItems = JUNK_ITEMS.flatMap((i) => OTHERS.filter((c) => JUNK_ITEM_WORDS[i.key]?.[c] === i.label && !SAME_OK.has(i.label)).map((c) => `${c}.${i.key}`));
  ok("no item's translation is its English label", englishItems.length === 0, englishItems);
  const orphans = Object.keys(JUNK_ITEM_WORDS).filter((k) => !JUNK_ITEMS.some((i) => i.key === k));
  ok("no translated item the pricing file no longer has", orphans.length === 0, orphans);
  ok("junkItemLabel falls back to the English label for en and for an unknown key", junkItemLabel("couch", "Sofa / couch", "en") === "Sofa / couch" && junkItemLabel("nope", "Thing", "fr") === "Thing");
  ok("junkItemLabel answers in Italian", junkItemLabel("couch", "Sofa / couch", "it") === "Divano");
}

// ── Server-side sentences ──────────────────────────────────────────────────
console.log("\nThe server's own sentences exist in every language");
for (const code of OTHERS) {
  ok(`lockedEstimateMessage ${code}`, lockedEstimateMessage(code).title !== lockedEstimateMessage("en").title && lockedEstimateMessage(code).placeholder === "$X,XXX – $X,XXX");
  ok(`gatedMessage ${code}, both stages`, gatedMessage(code, "prompt") !== gatedMessage("en", "prompt") && gatedMessage(code, "confirmed") !== gatedMessage("en", "confirmed"));
  ok(`budget bands ${code}: the lowest band is not English`, !/^Under /.test(budgetBands(null, { currency: "CAD", language: code })[0].label));
  ok(`measureErrorMessage ${code} for geocode_failed is its own`, measureErrorMessage("geocode_failed", code) === instantQuoteCopy(code).measureErrors.geocode_failed && measureErrorMessage("geocode_failed", code) !== measureErrorMessage("geocode_failed", "en"));
  ok(`financing button ${code}`, financingCtaLabel(code) !== financingCtaLabel("en"));
  const mail = buildEstimateEmail({ company: { name: "Acme", brandColor: "#123456", currency: "CAD" }, contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "range", language: code });
  const enMail = buildEstimateEmail({ company: { name: "Acme", brandColor: "#123456", currency: "CAD" }, contact: { name: "Sam" }, estimate: { low: 4200, high: 5500 }, visibility: "range", language: "en" });
  ok(`confirmation email ${code}: subject and body in it`, mail.subject !== enMail.subject && !/Estimated range|before tax|We'll be in touch/.test(mail.html));
}
ok("budget bands es: 'Menos de'", budgetBands(null, { currency: "CAD", language: "es" })[0].label.startsWith("Menos de"));
ok("budget bands fr: 'Moins de'", budgetBands(null, { currency: "CAD", language: "fr" })[0].label.startsWith("Moins de"));
ok("budget bands pa: the postposition follows the figure", /^\$1,000 ਤੋਂ ਘੱਟ$/.test(budgetBands([1000, 5000, 15000], { currency: "CAD", language: "pa" })[0].label), budgetBands([1000, 5000, 15000], { currency: "CAD", language: "pa" })[0].label);
ok("budget bands de: German grouping", budgetBands([1000, 5000, 15000], { currency: "CAD", language: "de" })[0].label === "Unter $1.000", budgetBands([1000, 5000, 15000], { currency: "CAD", language: "de" })[0].label);
ok("measureErrorMessage falls back to `other` for an unknown reason", measureErrorMessage("???", "fr") === instantQuoteCopy("fr").measureErrors.other);

// ── 4. The payload, localised ─────────────────────────────────────────────
console.log("\nloadCompanyInstantTrades answers in the language it was asked for");
{
  const company = {
    id: "c1", slug: "acme", name: "Acme", logoUrl: null, brandColor: "#123456",
    defaultLanguage: "en", currency: "CAD", bookingModes: [], bookingSlug: null, eventTypes: [],
    financing: null, phone: null,
  };
  resetDbStub();
  rows.company = [company];
  rows.instantQuoteConfig = [
    { companyId: "c1", trade: "roofing", enabled: true, config: { ...INSTANT_ESTIMATE_DEFAULTS.roofing, estimateVisibility: "after_submit" } },
    { companyId: "c1", trade: "junk_removal", enabled: true, config: { ...INSTANT_ESTIMATE_DEFAULTS.junk_removal } },
  ];
  // Both trades have to be SOLD to be offered — the public list is now gated
  // on the company's enabled services (instantTradeOffered), so an empty
  // service list is an empty estimator and there would be nothing to localise.
  rows.companyServiceCategory = [
    { id: "ccs_roof", companyId: "c1", enabled: true, rates: null, category: { key: "roofing_service" } },
    { id: "ccs_junk", companyId: "c1", enabled: true, rates: null, category: { key: "junk_removal" } },
  ];

  const en = await loadCompanyInstantTrades("acme");
  const fr = await loadCompanyInstantTrades("acme", { language: "fr" });
  const es = await loadCompanyInstantTrades("acme", { language: "es" });
  const de = await loadCompanyInstantTrades("acme", { language: "de" });
  const by = (d, k) => d.trades.find((x) => x.trade === k);

  ok("language echoed: en by default, fr / es when asked, and a never-chosen company does not answer in German", en.language === "en" && fr.language === "fr" && es.language === "es" && de.language === "en");
  ok("…because a never-chosen company offers exactly en / fr / es", JSON.stringify(en.languages) === JSON.stringify(["en", "fr", "es"]));
  ok("roofing chip: Roofing / Toiture / Techado", by(en, "roofing").label === "Roofing" && by(fr, "roofing").label === "Toiture" && by(es, "roofing").label === "Techado");
  ok("locked message follows the language", by(fr, "roofing").lockedMessage.title !== by(en, "roofing").lockedMessage.title && by(es, "roofing").lockedMessage.title !== by(en, "roofing").lockedMessage.title);
  ok("budget bands follow the language", by(fr, "roofing").budgetBands[0].label.startsWith("Moins") && by(es, "roofing").budgetBands[0].label.startsWith("Menos"));
  const couch = (d) => by(d, "junk_removal").items.find((i) => i.key === "couch").label;
  ok("junk items follow the language", couch(en) === "Sofa / couch" && couch(fr) === "Sofa / canapé" && couch(es) === "Sofá");
  const jt = (d) => by(d, "junk_removal").jobTypes.find((i) => i.key === "house_cleanout").label;
  ok("job types follow the language", jt(fr) !== jt(en) && jt(es) !== jt(en));
  const flat = JSON.stringify(fr);
  ok("no rate crossed with the labels", !/ratePerSqft|minCharge|budgetThresholds/.test(flat));

  // The company opts in to German and Punjabi only.
  rows.company[0].instantQuoteLanguages = ["de", "pa"];
  const deOn = await loadCompanyInstantTrades("acme", { language: "de" });
  const paOn = await loadCompanyInstantTrades("acme", { language: "pa" });
  const itAsked = await loadCompanyInstantTrades("acme", { language: "it" });
  ok("an opted-in company offers exactly what it saved, in pill order", JSON.stringify(deOn.languages) === JSON.stringify(["pa", "de"]), deOn.languages);
  ok("?lang=de answers in German — chips, bands, junk items", deOn.language === "de" && by(deOn, "roofing").label === "Dacharbeiten" && by(deOn, "roofing").budgetBands[0].label.startsWith("Unter") && couch(deOn) === "Sofa / Couch");
  ok("?lang=pa answers in Punjabi", paOn.language === "pa" && by(paOn, "roofing").label === "ਛੱਤ ਦਾ ਕੰਮ" && SCRIPT.pa.test(by(paOn, "roofing").lockedMessage.title));
  ok("a crafted ?lang=it on that form resolves to an offered language, never Italian", itAsked.language !== "it" && ["pa", "de"].includes(itAsked.language) && by(itAsked, "roofing").label !== instantTradeLabel("roofing", "it"));
  ok("…and the English it used to be is not offered either", (await loadCompanyInstantTrades("acme", { language: "en" })).language !== "en");
  resetDbStub();
}

// ── 5. The routes and the submission ──────────────────────────────────────
console.log("\nThe language is posted, validated, and becomes the document's");
{
  const flow = stripComments(read("app/instant-quote/[companySlug]/InstantQuoteFlow.js"));
  const get = stripComments(read("app/api/instant-quote/[companySlug]/route.js"));
  const measure = stripComments(read("app/api/instant-quote/[companySlug]/measure/route.js"));
  const request = stripComments(read("app/api/instant-quote/[companySlug]/request/route.js"));
  const draft = stripComments(read("lib/estimate/createEstimateQuote.js"));
  const review = stripComments(read("lib/ai/quoteReview.js"));

  ok("GET reads ?lang= and hands it to loadCompanyInstantTrades", /searchParams\.get\("lang"\)/.test(get) && /loadCompanyInstantTrades\(companySlug, \{ language: requested \}\)/.test(get));
  // Since 2026-10-03 /measure resolves through the company's offered list
  // too, so its sentences can never be in a language the form does not offer.
  ok("/measure resolves the posted language against the company's offered list", /const language = resolveInstantLanguage\(company, body\?\.language\)/.test(measure) && /instantQuoteLanguages: true/.test(measure));
  ok("/measure no longer passes the company's raw default through", !/\|\| company\.defaultLanguage/.test(measure));
  // Since 2026-09-25 through the company's offered list, one function for the
  // payload and the POST (lib/estimate/instantQuoteLanguages.js).
  ok("/request validates the posted language against the company's offered list", /const language = resolveInstantLanguage\(company, body\?\.language\)/.test(request) && /instantQuoteLanguages: true/.test(request));
  ok("/request creates the draft in it", /createEstimateDraft\(\{[\s\S]*?\n    language,\n/.test(request));
  ok("/request emails in it", /const emailLanguage = language;/.test(request));
  ok("/request creates the lead in it", /createScoredLead\(\{[\s\S]*?language: emailLanguage,/.test(request));
  ok("/request never trusts a raw `language ||` fallback any more", !/language \|\| company\.defaultLanguage/.test(request));
  ok("the lead accepts every one of the eight (isSupported, not a three-language list)", /language: isSupported\(input\.language\) \? input\.language : null/.test(stripComments(read("lib/leads/createLead.js"))));
  ok("the report is written in the draft's language, any of the eight", /return instantQuoteLanguage\(quote\?\.language\) \|\| "en";/.test(stripComments(read("lib/estimate/report/model.js"))));
  ok("the draft's lawn lines and money follow its language, not an en/fr/es ternary", /formatMoney\(n, company\.currency, instantQuoteLocale\(docLanguage\)\)/.test(draft) && !/docLanguage === "fr"/.test(draft));

  ok("the form fetches the payload with ?lang=", /\/api\/instant-quote\/\$\{companySlug\}\$\{wanted \? `\?lang=\$\{wanted\}` : ""\}/.test(flow));
  // The intake goes through postedIntake (the painting room picker says its
  // mode outright — check:room-presets); the language rides beside it.
  ok("the form posts language on /measure", /const payload = \{ trade: trade\.trade, intake: postedIntake\(trade, intake\), language: lang \};/.test(flow));
  ok("the form posts language, whenNeeded, answers and notes on /request", /language: lang,\s*whenNeeded,\s*answers,\s*\.\.\.\(notes\.trim\(\)/.test(flow));
  ok("?lang= pre-selects, localStorage remembers, per company", /new URLSearchParams\(window\.location\.search\)\.get\("lang"\)/.test(flow) && /fq\.instantQuote\.lang\.\$\{slug\}/.test(flow) && /storeLanguage\(companySlug, code\)/.test(flow));
  ok("the browser's Accept-Language is tried when it is one of the eight", /instantQuoteLanguage\(window\.navigator\?\.language\)/.test(flow));
  ok("the company's offered pills, aria-pressed on the lit one", /offeredLanguages\.map\(\(code\)/.test(flow) && /aria-pressed=\{on\}/.test(flow) && /data\?\.languages/.test(flow));
  ok("before the payload lands, the never-chosen three are drawn — never all eight", /data\.languages\.length \? data\.languages : INSTANT_QUOTE_DEFAULT_LANGUAGES/.test(flow) && !/INSTANT_QUOTE_LANGUAGES/.test(flow));
  ok("one language offered draws no pills at all", /offeredLanguages\.length < 2 \? null/.test(flow));
  ok("a pill for a language the company switched off cannot be chosen", /!offeredLanguages\.includes\(code\)\) return;/.test(flow));
  ok("the page takes the language the payload resolved, not the one it asked for", /const resolved = instantQuoteLanguage\(payload\.language\) \|\| "en";/.test(flow) && /if \(language !== resolved\) setLanguage\(resolved\);/.test(flow));
  ok("GET publishes the offered list", /languages,/.test(get) && /const \{ company, trades, booking, language, languages \} = data;/.test(get));
  ok("no `fr ?` ternary and no `=== \"fr\"` left in the form", !/\bfr \?/.test(flow) && !/=== "fr"/.test(flow));
  ok("no en/fr/es locale ternary left in the lawn card, the email or the bands", !/=== "fr" \? "fr-CA"/.test(read("app/instant-quote/[companySlug]/LawnCareOffer.js")) && !/=== "fr" \? "fr-CA"/.test(read("lib/estimate/estimateEmail.js")) && !/=== "fr" \? "fr-CA"/.test(read("lib/estimate/budgetBands.js")));
  for (const s of ["\"Your details\"", "\"Tell us about the property\"", "\"What do you need?\"", "\"Which option?\"", "\"Your budget\"", "\"Where's the job?\"", "\"Photos\"", "Still needed:", "Request a quote instead", "Powered by measurements", "You&apos;re all set", "Select…", "Fewer", "\"Property\""]) {
    ok(`hardcoded English gone: ${s}`, !flow.includes(s));
  }
  ok("the 60-second headline is not on the page (owner dropped it)", !/60 second/.test(flow) && !/instantQuoteHeadline/.test(flow));
  // Required by default, and the owner may relax it per trade
  // (lib/estimate/formFields.js) — the missing list reads the field state.
  ok("the 'when' question is required in the missing list", /trade && fields\.timeline === "required" && !whenNeeded && t\.missing\.whenNeeded/.test(flow));
  ok("a trade question the estimator already asks as an input is not asked twice", /questionsFor\(trade\.trade\)\.filter\(\(qq\) => !inputKeys\.has\(qq\.key\)\)/.test(flow));
  ok("the service-area line only ever prints an explicit outside", /verdict\.configured !== true \|\| verdict\.inside !== false\) return null/.test(flow));
  ok("area_polygon renders the same map as lawn_polygon", /const byTrace = \(measure\) => measure === "lawn_polygon" \|\| measure === "area_polygon"/.test(flow));

  ok("/request requires whenNeeded and validates the answers", /cleanTradeAnswers\(trade, \{ whenNeeded, answers, notes \}\)/.test(request) && /if \(fields\.timeline === "required" && !homeowner\.whenNeeded\) return NextResponse\.json\(\{ error: t\.missingWhen \}/.test(request));
  ok("/request stores the answers on the draft and the lead", /homeowner: \{ \.\.\.homeowner, trade, outsideServiceArea \}/.test(request) && /timeline: homeowner\.timeline,/.test(request) && /whenNeeded: homeowner\.whenNeeded,/.test(request));
  ok("/request writes outsideServiceArea only when true", /\.\.\.\(outsideServiceArea && \{ outsideServiceArea: true \}\)/.test(request));
  ok("/request checks the area only for a configured company", /if \(serviceAreaConfigured\(company\) && jobAddress\)/.test(request));
  ok("the draft keeps the answers as keys and prints the lines for the reviewer", /estimateData: \{[\s\S]*?homeower|homeowner: \{\s*whenNeeded: homeowner\.whenNeeded \|\| null,/.test(draft) && /reviewNotes: mergedReviewNotes \|\| null/.test(draft));
  ok("the AI review reads them", /homeownerSaid: quote\.estimateData\.homeowner\.lines/.test(review) && /homeownerSaid/.test(review.slice(review.indexOf("WRITING_SYSTEM"))));

  const r = cleanTradeAnswers("roofing", { whenNeeded: "this_season", answers: { activeLeak: "yes" }, notes: "x" });
  ok("cleanTradeAnswers maps this_season to the scorer's 1_3_months", r.timeline === "1_3_months" && r.answers.activeLeak === "yes");
}

// ── 6b. The company picks the languages; the cards say what each service is ─
console.log("\nThe company's languages, and the one line under each service card");
{
  // Pure rules first, against hostile input.
  ok("sanitise keeps only instant languages, once, in pill order", JSON.stringify(sanitiseInstantLanguages(["IT", "fr", "de", "fr", 3, null, " en ", "zh", "pa"])) === JSON.stringify(["en", "fr", "pa", "de", "it"]));
  ok("sanitise of a non-array is []", [null, undefined, "en", { en: true }, 7].every((v) => sanitiseInstantLanguages(v).length === 0));
  ok("never chosen ([] / null / junk) offers exactly en / fr / es — today's behaviour, not all eight", [[], null, ["xx"], ["zh"], undefined].every((v) => JSON.stringify(offeredInstantLanguages({ instantQuoteLanguages: v })) === JSON.stringify(["en", "fr", "es"])));
  ok("a choice is honoured", JSON.stringify(offeredInstantLanguages({ instantQuoteLanguages: ["fr"] })) === JSON.stringify(["fr"]));
  ok("a saved [de, pa] offers exactly de and pa (in pill order: pa, de)", JSON.stringify(offeredInstantLanguages({ instantQuoteLanguages: ["de", "pa"] })) === JSON.stringify(["pa", "de"]));
  ok("all eight can be offered", JSON.stringify(offeredInstantLanguages({ instantQuoteLanguages: [...INSTANT_QUOTE_LANGUAGES].reverse() })) === JSON.stringify(INSTANT_QUOTE_LANGUAGES));
  const co = { defaultLanguage: "fr", instantQuoteLanguages: ["en", "fr"] };
  ok("an offered request wins", resolveInstantLanguage(co, "en") === "en");
  ok("a switched-off request falls to the company's own language", resolveInstantLanguage(co, "es") === "fr");
  ok("…and to the first offered when the company's own is switched off too", resolveInstantLanguage({ defaultLanguage: "es", instantQuoteLanguages: ["fr", "en"] }, "es") === "en");
  ok("a garbage request is the company's language", resolveInstantLanguage(co, "<script>") === "fr" && resolveInstantLanguage(co, null) === "fr");
  ok("a company language it never offered (de, never chose) resolves inside the offered list", resolveInstantLanguage({ defaultLanguage: "de", instantQuoteLanguages: [] }, null) === "en");
  ok("a non-instant company language (zh) resolves inside the offered list", resolveInstantLanguage({ defaultLanguage: "zh", instantQuoteLanguages: ["uk", "tl"] }, null) === "uk");
  const dp = { defaultLanguage: "en", instantQuoteLanguages: ["de", "pa"] };
  ok("[de, pa]: a crafted ?lang=it resolves to an offered one, never it", ["pa", "de"].includes(resolveInstantLanguage(dp, "it")) && resolveInstantLanguage(dp, "it") !== "it");
  ok("[de, pa]: ?lang=de / pa-IN / fil are honoured or refused correctly", resolveInstantLanguage(dp, "de") === "de" && resolveInstantLanguage(dp, "pa-IN") === "pa" && resolveInstantLanguage(dp, "fil") === "pa");
  ok("[de, pa]: English is not offered, so ?lang=en is not English", resolveInstantLanguage(dp, "en") !== "en");
  ok("[tl]: a browser's Filipino lands on Tagalog", resolveInstantLanguage({ defaultLanguage: "en", instantQuoteLanguages: ["en", "tl"] }, "fil-PH") === "tl");
  ok("the save refuses an empty choice, unknown codes and a non-list", [[], ["zh"], ["xx", "  "], "en", null, { de: true }].every((v) => Boolean(instantLanguagesForSave(v).error)));
  ok("the save accepts each of the eight on its own", INSTANT_QUOTE_LANGUAGES.every((l) => JSON.stringify(instantLanguagesForSave([l]).languages) === JSON.stringify([l])));
  ok("the save accepts all eight together, in pill order", JSON.stringify(instantLanguagesForSave(["it", "de", "tl", "pa", "uk", "es", "fr", "en"]).languages) === JSON.stringify(INSTANT_QUOTE_LANGUAGES));
  ok("the save cleans what it stores", JSON.stringify(instantLanguagesForSave(["es", "EN", "zh"]).languages) === JSON.stringify(["en", "es"]));
  ok("a saved list reads back as offered", JSON.stringify(offeredInstantLanguages({ instantQuoteLanguages: instantLanguagesForSave(["de", "pa"]).languages })) === JSON.stringify(["pa", "de"]));

  // The payload: the real loader over the db stub.
  resetDbStub();
  rows.company = [{
    id: "c2", slug: "duo", name: "Duo", logoUrl: null, brandColor: "#123456", defaultLanguage: "fr",
    currency: "CAD", bookingModes: [], bookingSlug: null, eventTypes: [], financing: null, phone: null,
    instantQuoteLanguages: ["en", "fr"],
  }];
  rows.instantQuoteConfig = [
    { companyId: "c2", trade: "roofing", enabled: true, config: { ...INSTANT_ESTIMATE_DEFAULTS.roofing } },
    { companyId: "c2", trade: "junk_removal", enabled: true, config: { ...INSTANT_ESTIMATE_DEFAULTS.junk_removal } },
  ];
  rows.companyServiceCategory = [
    { id: "d_roof", companyId: "c2", enabled: true, rates: null, category: { key: "roofing_service" } },
    { id: "d_junk", companyId: "c2", enabled: true, rates: null, category: { key: "junk_removal" } },
  ];
  const plain = await loadCompanyInstantTrades("duo");
  const asEs = await loadCompanyInstantTrades("duo", { language: "es" });
  const asEn = await loadCompanyInstantTrades("duo", { language: "en" });
  ok("the payload lists the company's languages", JSON.stringify(plain.languages) === JSON.stringify(["en", "fr"]));
  ok("no ?lang= opens in the company's language", plain.language === "fr");
  ok("?lang=es on a form that does not offer Spanish is French, labels and all", asEs.language === "fr" && asEs.trades.find((x) => x.trade === "roofing").label === "Toiture");
  ok("?lang=en on a form that offers it is English", asEn.language === "en" && asEn.trades.find((x) => x.trade === "roofing").label === "Roofing");
  const desc = (d, k) => d.trades.find((x) => x.trade === k).description;
  ok("each card carries its one line, in the page's language", desc(plain, "roofing") === instantTradeBlurb("roofing", "fr") && desc(asEn, "roofing") === instantTradeBlurb("roofing", "en") && desc(asEn, "roofing") !== desc(plain, "roofing"));
  ok("…and no figure crossed with it", !/\d|\$|€|£/.test(JSON.stringify(plain.trades.map((x) => x.description))));
  rows.company[0].instantQuoteLanguages = [];
  ok("a company that never chose still gets exactly en / fr / es", JSON.stringify((await loadCompanyInstantTrades("duo")).languages) === JSON.stringify(INSTANT_QUOTE_DEFAULT_LANGUAGES));
  resetDbStub();

  // The table: every instant trade, every instant language, no price.
  for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
    const row = INSTANT_TRADE_BLURBS[trade];
    ok(`blurb: ${trade} in ${INSTANT_QUOTE_LANGUAGES.join("/")}`, Boolean(row) && INSTANT_QUOTE_LANGUAGES.every((l) => typeof row[l] === "string" && row[l].length > 15 && row[l].length <= 140));
    ok(`blurb: ${trade} names no figure and no currency`, Boolean(row) && INSTANT_QUOTE_LANGUAGES.every((l) => !/\d|\$|€|£/.test(row[l])));
    ok(`blurb: ${trade} is translated, not English in another language`, Boolean(row) && OTHERS.every((l) => row[l] !== row.en && !ENGLISH_WORDS.test(row[l])));
  }
  ok("an unknown trade has no line rather than a generic one", instantTradeBlurb("no_such_trade", "en") === null);

  // The form draws it only when there is a choice.
  const flow = stripComments(read("app/instant-quote/[companySlug]/InstantQuoteFlow.js"));
  ok("the card shows the line only when more than one service is offered", /data\.trades\.length > 1 && tr\.description &&/.test(flow));
  ok("auto-select of a single trade is kept", /payload\.trades\.length === 1\s*\?\s*payload\.trades\[0\]/.test(flow));

  // The settings screen writes it and the public side reads it.
  const settingsRoute = stripComments(read("app/api/settings/instant-quote/route.js"));
  const settingsPage = stripComments(read("app/app/settings/instant-quotes/page.js"));
  ok("the settings PUT stores the cleaned list and refuses an empty one", /instantLanguagesForSave\(body\.instantQuoteLanguages\)/.test(settingsRoute) && /data: \{ instantQuoteLanguages: languages \}/.test(settingsRoute));
  ok("the settings GET reports all eight, chosen and offered", /all: INSTANT_QUOTE_LANGUAGES,/.test(settingsRoute) && /chosen: sanitiseInstantLanguages\(company\?\.instantQuoteLanguages\)/.test(settingsRoute) && /offered: offeredInstantLanguages\(company \|\| \{\}\)/.test(settingsRoute));
  ok("the settings card PUTs instantQuoteLanguages", /body: JSON\.stringify\(\{ instantQuoteLanguages: picked \}\)/.test(settingsPage) && /<LanguagesCard/.test(settingsPage));
  ok("the card draws a box per language and names each in its own words", /languages\.all\.map\(\(code\)/.test(settingsPage) && /const names = instantQuoteCopy\("en"\)\.languageNames;/.test(settingsPage));
  ok("the card's unset sentence names the three, no longer 'all of them'", /"app\.setInstantQuotes\.languages\.unsetThree"/.test(settingsPage) && /English, French and Spanish are offered/.test(settingsPage) && !/"app\.setInstantQuotes\.languages\.unset"/.test(settingsPage));
  ok("the column is in the schema", /instantQuoteLanguages String\[\] @default\(\[\]\)/.test(read("prisma/schema.prisma")));
  ok("the loader reads the column", /instantQuoteLanguages: true/.test(stripComments(read("lib/estimate/instantQuoteServer.js"))));
}

// ── 7. Contrast on hostile brands ─────────────────────────────────────────
console.log("\nThe lit pill, the chip and the button measure on hostile brands");
for (const hex of ["#ffffff", "#c0c0c0", "#fefcdd", "#ffff00", "#000000", "#06356b"]) {
  const theme = documentTheme({ brandColor: hex });
  const solid = fillPair(theme);
  const fill = contrastRatio(solid.fg, solid.bg);
  const text = contrastRatio(theme.accentText, theme.paper);
  ok(`${hex}: fill ${fill.toFixed(2)}:1, accent text ${text.toFixed(2)}:1`, fill >= 4.5 && text >= 4.5);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
