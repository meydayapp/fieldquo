// scripts/check-instant-quote-copy.mjs
//
//   npm run check:instant-quote-copy
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-instant-quote-copy.mjs
//
// The public instant-estimate page in three languages, executed rather than
// read:
//
//   1. lib/i18n/instantQuoteCopy.js carries every key in en, fr and es, with
//      no English sentence left standing inside fr or es.
//   2. Every instant trade has a chip label in the three languages, and the
//      English one is the label the server has always used.
//   3. Every junk-removal item and job type has a French and a Spanish name.
//   4. The payload really is localised: loadCompanyInstantTrades over the db
//      stub, asked for fr / es, returns French / Spanish chips, bands and
//      junk items.
//   5. The measure and request routes read the POSTED language and validate
//      it; the submission carries the language, the "when", the answers and
//      the note; the draft and the lead are created in it.
//   6. The form has no `fr ?` ternary left and none of the English strings
//      it used to hardcode.
//   7. The pills and the button measure ≥ 4.5:1 on five hostile brands.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  INSTANT_QUOTE_COPY,
  INSTANT_QUOTE_LANGUAGES,
  INSTANT_TRADE_WORDS,
  JUNK_ITEM_WORDS,
  JUNK_JOB_TYPE_WORDS,
  instantQuoteCopy,
  instantQuoteLanguage,
  instantTradeLabel,
  junkItemLabel,
} from "@/lib/i18n/instantQuoteCopy";
import { LAWN_ESTIMATE_COPY } from "@/lib/i18n/lawnEstimateCopy";
import { GUTTER_ESTIMATE_COPY } from "@/lib/i18n/gutterEstimateCopy";
import { TRADE_QUESTION_COPY, cleanTradeAnswers } from "@/lib/leads/tradeQuestions";
import { SERVICE_AREA_COPY } from "@/lib/company/serviceArea";
import { INSTANT_ESTIMATE_TRADES, INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";
import { TRADE_LABELS, loadCompanyInstantTrades } from "@/lib/estimate/instantQuoteServer";
import { JUNK_ITEMS, JOB_TYPES } from "@/lib/junk/pricing";
import { lockedEstimateMessage, gatedMessage } from "@/lib/estimate/visibility";
import { budgetBands } from "@/lib/estimate/budgetBands";
import { measureErrorMessage } from "@/lib/estimate/measureErrorMessage";
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

function checkTable(name, table) {
  console.log(`\n${name}: three languages, no English left inside fr/es`);
  const en = new Map(leaves(table.en));
  for (const code of ["fr", "es"]) {
    const other = new Map(leaves(table[code] || {}));
    const missing = [...en.keys()].filter((k) => !other.has(k));
    const extra = [...other.keys()].filter((k) => !en.has(k));
    ok(`${code}: every en key present (${en.size})`, missing.length === 0, missing);
    ok(`${code}: no keys en lacks`, extra.length === 0, extra);
    const same = [...en].filter(([k, v]) => other.get(k) === v && !SAME_OK.has(v) && !k.startsWith("languageNames") && v.length > 3);
    ok(`${code}: no English sentence duplicated as the translation`, same.length === 0, same.slice(0, 5));
  }
}

checkTable("instantQuoteCopy", INSTANT_QUOTE_COPY);
checkTable("lawnEstimateCopy", LAWN_ESTIMATE_COPY);
checkTable("gutterEstimateCopy", GUTTER_ESTIMATE_COPY);
checkTable("tradeQuestions", TRADE_QUESTION_COPY);
checkTable("serviceArea", SERVICE_AREA_COPY);

// ── 2. Every instant trade has a chip label in three languages ─────────────
console.log("\nEvery instant trade is named in en, fr and es");
for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
  const row = INSTANT_TRADE_WORDS[trade];
  ok(`${trade}: en/fr/es labels`, row && ["en", "fr", "es"].every((c) => row[c]?.label?.trim()), row);
  ok(`${trade}: en label is the server's TRADE_LABELS entry`, row?.en?.label === TRADE_LABELS[trade], [row?.en?.label, TRADE_LABELS[trade]]);
  ok(`${trade}: fr and es differ from en`, row && row.fr.label !== row.en.label && row.es.label !== row.en.label);
  ok(`${trade}: a report-title noun in en/fr/es, no English noun inside fr/es`, row && ["en", "fr", "es"].every((c) => row[c]?.noun?.trim()) && row.fr.noun !== row.en.noun && row.es.noun !== row.en.noun);
}
ok("an unknown trade falls back to the passed English label, then the key", instantTradeLabel("zzz", "fr", "Zed") === "Zed" && instantTradeLabel("zzz", "fr") === "zzz");
ok("instantQuoteLanguage accepts fr-CA / ES / es-MX and refuses de, uk, ''", instantQuoteLanguage("fr-CA") === "fr" && instantQuoteLanguage("ES") === "es" && instantQuoteLanguage("es-MX") === "es" && instantQuoteLanguage("de") === null && instantQuoteLanguage("uk") === null && instantQuoteLanguage("") === null);

// ── 3. Junk items and job types ────────────────────────────────────────────
console.log("\nEvery junk-removal item and job type has a French and a Spanish name");
{
  const missingItems = JUNK_ITEMS.filter((i) => !JUNK_ITEM_WORDS[i.key]?.fr || !JUNK_ITEM_WORDS[i.key]?.es).map((i) => i.key);
  ok(`all ${JUNK_ITEMS.length} items`, missingItems.length === 0, missingItems);
  const missingTypes = Object.values(JOB_TYPES).filter((j) => !JUNK_JOB_TYPE_WORDS[j.key]?.fr || !JUNK_JOB_TYPE_WORDS[j.key]?.es).map((j) => j.key);
  ok(`all ${Object.keys(JOB_TYPES).length} job types`, missingTypes.length === 0, missingTypes);
  const orphans = Object.keys(JUNK_ITEM_WORDS).filter((k) => !JUNK_ITEMS.some((i) => i.key === k));
  ok("no translated item the pricing file no longer has", orphans.length === 0, orphans);
  ok("junkItemLabel falls back to the English label for en and for an unknown key", junkItemLabel("couch", "Sofa / couch", "en") === "Sofa / couch" && junkItemLabel("nope", "Thing", "fr") === "Thing");
}

// ── Server-side sentences that used to be en/fr only ──────────────────────
console.log("\nThe server's own sentences exist in Spanish");
ok("lockedEstimateMessage es", lockedEstimateMessage("es").title !== lockedEstimateMessage("en").title && lockedEstimateMessage("es").placeholder === "$X,XXX – $X,XXX");
ok("gatedMessage es, both stages", gatedMessage("es", "prompt") !== gatedMessage("en", "prompt") && gatedMessage("es", "confirmed") !== gatedMessage("en", "confirmed"));
ok("budget bands es: 'Menos de'", budgetBands(null, { currency: "CAD", language: "es" })[0].label.startsWith("Menos de"));
ok("budget bands fr: 'Moins de'", budgetBands(null, { currency: "CAD", language: "fr" })[0].label.startsWith("Moins de"));
ok("measureErrorMessage es for geocode_failed differs from en and is not English", measureErrorMessage("geocode_failed", "es") !== measureErrorMessage("geocode_failed", "en") && !/couldn't/.test(measureErrorMessage("geocode_failed", "es")));
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
  rows.companyServiceCategory = [];

  const en = await loadCompanyInstantTrades("acme");
  const fr = await loadCompanyInstantTrades("acme", { language: "fr" });
  const es = await loadCompanyInstantTrades("acme", { language: "es" });
  const de = await loadCompanyInstantTrades("acme", { language: "de" });
  const by = (d, k) => d.trades.find((x) => x.trade === k);

  ok("language echoed: en by default, fr / es when asked, company's for an unsupported code", en.language === "en" && fr.language === "fr" && es.language === "es" && de.language === "en");
  ok("roofing chip: Roofing / Toiture / Techado", by(en, "roofing").label === "Roofing" && by(fr, "roofing").label === "Toiture" && by(es, "roofing").label === "Techado");
  ok("locked message follows the language", by(fr, "roofing").lockedMessage.title !== by(en, "roofing").lockedMessage.title && by(es, "roofing").lockedMessage.title !== by(en, "roofing").lockedMessage.title);
  ok("budget bands follow the language", by(fr, "roofing").budgetBands[0].label.startsWith("Moins") && by(es, "roofing").budgetBands[0].label.startsWith("Menos"));
  const couch = (d) => by(d, "junk_removal").items.find((i) => i.key === "couch").label;
  ok("junk items follow the language", couch(en) === "Sofa / couch" && couch(fr) === "Sofa / canapé" && couch(es) === "Sofá");
  const jt = (d) => by(d, "junk_removal").jobTypes.find((i) => i.key === "house_cleanout").label;
  ok("job types follow the language", jt(fr) !== jt(en) && jt(es) !== jt(en));
  const flat = JSON.stringify(fr);
  ok("no rate crossed with the labels", !/ratePerSqft|minCharge|budgetThresholds/.test(flat));
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
  ok("/measure validates the posted language", /instantQuoteLanguage\(body\?\.language\)/.test(measure));
  ok("/request validates the posted language", /const language = instantQuoteLanguage\(body\?\.language\) \|\| company\.defaultLanguage/.test(request));
  ok("/request creates the draft in it", /createEstimateDraft\(\{[\s\S]*?\n    language,\n/.test(request));
  ok("/request emails in it", /const emailLanguage = language;/.test(request));
  ok("/request creates the lead in it", /createScoredLead\(\{[\s\S]*?language: emailLanguage,/.test(request));
  ok("/request never trusts a raw `language ||` fallback any more", !/language \|\| company\.defaultLanguage/.test(request));

  ok("the form fetches the payload with ?lang=", /\/api\/instant-quote\/\$\{companySlug\}\$\{wanted \? `\?lang=\$\{wanted\}` : ""\}/.test(flow));
  ok("the form posts language on /measure", /const payload = \{ trade: trade\.trade, intake, language: lang \};/.test(flow));
  ok("the form posts language, whenNeeded, answers and notes on /request", /language: lang,\s*whenNeeded,\s*answers,\s*\.\.\.\(notes\.trim\(\)/.test(flow));
  ok("?lang= pre-selects, localStorage remembers, per company", /new URLSearchParams\(window\.location\.search\)\.get\("lang"\)/.test(flow) && /fq\.instantQuote\.lang\.\$\{slug\}/.test(flow) && /storeLanguage\(companySlug, code\)/.test(flow));
  ok("the browser's Accept-Language is tried when it is one of the three", /instantQuoteLanguage\(window\.navigator\?\.language\)/.test(flow));
  ok("three pills, aria-pressed on the lit one", /INSTANT_QUOTE_LANGUAGES\.map\(\(code\)/.test(flow) && /aria-pressed=\{on\}/.test(flow));
  ok("no `fr ?` ternary and no `=== \"fr\"` left in the form", !/\bfr \?/.test(flow) && !/=== "fr"/.test(flow));
  for (const s of ["\"Your details\"", "\"Tell us about the property\"", "\"What do you need?\"", "\"Which option?\"", "\"Your budget\"", "\"Where's the job?\"", "\"Photos\"", "Still needed:", "Request a quote instead", "Powered by measurements", "You&apos;re all set", "Select…", "Fewer", "\"Property\""]) {
    ok(`hardcoded English gone: ${s}`, !flow.includes(s));
  }
  ok("the 60-second headline is not on the page (owner dropped it)", !/60 second/.test(flow) && !/instantQuoteHeadline/.test(flow));
  ok("the 'when' question is required in the missing list", /trade && !whenNeeded && t\.missing\.whenNeeded/.test(flow));
  ok("a trade question the estimator already asks as an input is not asked twice", /questionsFor\(trade\.trade\)\.filter\(\(qq\) => !inputKeys\.has\(qq\.key\)\)/.test(flow));
  ok("the service-area line only ever prints an explicit outside", /verdict\.configured !== true \|\| verdict\.inside !== false\) return null/.test(flow));
  ok("area_polygon renders the same map as lawn_polygon", /const byTrace = \(measure\) => measure === "lawn_polygon" \|\| measure === "area_polygon"/.test(flow));

  ok("/request requires whenNeeded and validates the answers", /cleanTradeAnswers\(trade, \{ whenNeeded, answers, notes \}\)/.test(request) && /if \(!homeowner\.whenNeeded\) return NextResponse\.json\(\{ error: t\.missingWhen \}/.test(request));
  ok("/request stores the answers on the draft and the lead", /homeowner: \{ \.\.\.homeowner, trade, outsideServiceArea \}/.test(request) && /timeline: homeowner\.timeline,/.test(request) && /whenNeeded: homeowner\.whenNeeded,/.test(request));
  ok("/request writes outsideServiceArea only when true", /\.\.\.\(outsideServiceArea && \{ outsideServiceArea: true \}\)/.test(request));
  ok("/request checks the area only for a configured company", /if \(serviceAreaConfigured\(company\) && jobAddress\)/.test(request));
  ok("the draft keeps the answers as keys and prints the lines for the reviewer", /estimateData: \{[\s\S]*?homeower|homeowner: \{\s*whenNeeded: homeowner\.whenNeeded \|\| null,/.test(draft) && /reviewNotes: mergedReviewNotes \|\| null/.test(draft));
  ok("the AI review reads them", /homeownerSaid: quote\.estimateData\.homeowner\.lines/.test(review) && /homeownerSaid/.test(review.slice(review.indexOf("WRITING_SYSTEM"))));

  const r = cleanTradeAnswers("roofing", { whenNeeded: "this_season", answers: { activeLeak: "yes" }, notes: "x" });
  ok("cleanTradeAnswers maps this_season to the scorer's 1_3_months", r.timeline === "1_3_months" && r.answers.activeLeak === "yes");
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
