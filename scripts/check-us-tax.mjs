// scripts/check-us-tax.mjs
//
// Executes the US rung of the tax resolver — lib/tax/usTaxability.js,
// lib/tax/usRates.js's pure parts, lib/tax/usRatesLoad.js, the sentences and
// the stored record — against real and hostile input.
//
//   npm run check:us-tax
//
// Every assertion is about the same thing the Canadian check is about: a
// number a homeowner is billed is either the state's own published figure,
// applied the way the state's own rules say, or it is not on the document.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  US_TAXABILITY,
  US_STATES,
  US_JOB_OPTIONS,
  usJobTreatment,
  usTaxabilitySummary,
} from "@/lib/tax/usTaxability";
import { US_STATE_BASE_RATES, lookupUsRate } from "@/lib/tax/jurisdictions";
import { resolveTaxRate, explainTaxSource, renderTaxNote, usRatesMonth } from "@/lib/tax/resolveTaxRate";
import { resolveDocumentTax, taxStatement, taxSendRefusal } from "@/lib/tax/documentTax";
import {
  recordTaxResolution,
  resolutionForDocument,
  resolutionMatchesAmount,
  resolutionStatesZero,
  manualTaxResolution,
} from "@/lib/tax/taxResolution";
import { documentTaxSentence } from "@/lib/tax/documentSentence";
import { normaliseUsOverrides, parseUsOverridesInput } from "@/lib/tax/usOverrides";
import {
  parseSstListing,
  parseSstRateFile,
  composeSstZipRates,
  composePaZipRates,
  upsertSql,
  yyyymmdd,
} from "@/lib/tax/usRatesLoad";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { DOCUMENT_LABELS } from "@/lib/i18n/documentLabels";
import { LANGUAGES } from "@/app/i18n/languages";

let failures = 0;
let checks = 0;
function ok(label, condition, detail = "") {
  checks++;
  if (condition) return;
  failures++;
  console.log(`  ✗ ${label}${detail ? `\n        got: ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n${title}`);
}
const t = (k, p = {}) =>
  String(APP_MESSAGES.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => (p[x] == null ? "" : String(p[x])));

/* ── 1. The taxability table covers every state, cites every row ────────── */

section("Taxability table — 50 states + DC, every row cited");

ok("51 rows", US_STATES.length === 51, US_STATES.length);
ok("every rate-table state has a taxability row", Object.keys(US_STATE_BASE_RATES).every((s) => US_TAXABILITY[s]));
ok("every taxability state has a rate-table row", US_STATES.every((s) => US_STATE_BASE_RATES[s]));
for (const [state, row] of Object.entries(US_TAXABILITY)) {
  ok(`${state} labour is one of the three`, ["exempt", "taxable", "depends"].includes(row.labour), row.labour);
  ok(`${state} materials is one of the two`, ["taxable_to_contractor", "taxable_to_customer"].includes(row.materials));
  ok(`${state} carries a rule sentence`, typeof row.rule === "string" && row.rule.length > 20);
  ok(`${state} carries a source`, typeof row.source === "string" && row.source.length > 10);
  ok(`${state} says whether it was fetched`, /fetched 2026-09-19|not re-fetched 2026-09/.test(row.checked || ""));
  if (row.labour === "depends") {
    ok(`${state} depends → has a question`, row.question && row.question.options.length >= 2);
    ok(`${state} question default is one of its options`, row.question.options.some((o) => o.value === row.question.default));
    ok(`${state} every option is a known job kind`, row.question.options.every((o) => US_JOB_OPTIONS.includes(o.value)));
    const outcomes = new Set(row.question.options.map((o) => o.applies));
    ok(`${state} the question actually decides something`, outcomes.size >= 2, [...outcomes].join(","));
  } else {
    ok(`${state} ${row.labour} → no question`, !row.question);
    ok(`${state} exempt ⇔ applies none`, row.labour === "exempt" ? row.applies === "none" : row.applies !== "none");
  }
}
const summary = usTaxabilitySummary();
ok("summary sums to 51", summary.exempt + summary.taxable + summary.depends === 51, JSON.stringify(summary));
console.log(`  exempt ${summary.exempt}, taxable ${summary.taxable}, depends ${summary.depends}`);

// The sample states the brief names.
ok("NY depends", US_TAXABILITY.NY.labour === "depends");
ok("TX depends", US_TAXABILITY.TX.labour === "depends");
ok("CA exempt", US_TAXABILITY.CA.labour === "exempt");
ok("FL exempt", US_TAXABILITY.FL.labour === "exempt");
ok("WA taxable, whole contract", US_TAXABILITY.WA.labour === "taxable" && US_TAXABILITY.WA.applies === "all");

// The per-quote answer, and the stated default when nobody has answered.
const nyDefault = usJobTreatment("NY", null);
ok("NY unanswered → the default, marked assumed", nyDefault.assumedAnswer === true && nyDefault.answer === "repair" && nyDefault.applies === "all");
ok("NY capital improvement → none", usJobTreatment("NY", "capitalImprovement").applies === "none");
ok("NY garbage answer → the default, still marked assumed", usJobTreatment("NY", "__proto__").assumedAnswer === true);
ok("TX residential → none", usJobTreatment("TX", "residential").applies === "none");
ok("TX commercial remodel → all", usJobTreatment("TX", "commercialRemodel").applies === "all");
ok("AZ modification → 65% share", usJobTreatment("AZ", "modification").applies === "share" && usJobTreatment("AZ", "modification").share === 0.65);
ok("SD → fixed 2%", usJobTreatment("SD", null).applies === "fixed" && usJobTreatment("SD", null).fixedRate === 2);
ok("CA never assumed", usJobTreatment("CA", null).assumedAnswer === false);
ok("unknown state → null", usJobTreatment("ZZ", null) === null && usJobTreatment("constructor", null) === null);

/* ── 2. The rate: ZIP hit, ZIP miss, uniform state, wrong-state ZIP ──────── */

section("Rate lookup — precision is named, never assumed");

const ny = {
  zip: "10001", state: "NY", combinedRate: 8.875, stateRate: 4, maxRate: null, zipSpansRates: false,
  effectiveFrom: "2019-01-01T00:00:00.000Z", fetchedAt: "2026-09-19T00:00:00.000Z", source: "test",
};
const hit = lookupUsRate("NY", { zipRate: ny });
ok("ZIP hit → known / zip / 8.875", hit.status === "known" && hit.precision === "zip" && hit.rate === 8.875, JSON.stringify(hit));
ok("ZIP hit splits state and local", hit.stateRate === 4 && hit.localRate === 4.875);
const miss = lookupUsRate("NY");
ok("ZIP miss → state_only with the floor and a caution", miss.status === "state_only" && miss.rate === 4 && miss.cautionKey === "app.tax.caution.usLocalNotIncluded");
const uniform = lookupUsRate("CT");
ok("Connecticut → known / state_uniform / 6.35", uniform.status === "known" && uniform.precision === "state_uniform" && uniform.rate === 6.35);
ok("Hawaii's county surcharge is in the floor", lookupUsRate("HI").rate === 4.5);
ok("Virginia's statewide 1% is in the floor", lookupUsRate("VA").rate === 5.3 && lookupUsRate("VA").status === "state_only");
const wrong = lookupUsRate("TX", { zipRate: ny });
ok("a NY ZIP row against a TX client is ignored", wrong.status === "state_only" && wrong.rate === 6.25);
ok("a ZIP row with a future effectiveFrom is ignored for an earlier date",
  lookupUsRate("NY", { zipRate: { ...ny, effectiveFrom: "2026-12-01T00:00:00.000Z" }, asOf: new Date("2026-09-19") }).status === "state_only");
ok("a date before the table is unknown", lookupUsRate("NY", { zipRate: ny, asOf: new Date("2018-01-01") }).status === "unknown");
for (const key of ["__proto__", "constructor", "toString", "", null, 12, "N Y"]) {
  ok(`hostile region ${JSON.stringify(key)} → unknown`, lookupUsRate(key).status === "unknown");
}
ok("a ZIP row with a non-numeric rate is ignored", lookupUsRate("NY", { zipRate: { ...ny, combinedRate: "abc" } }).status === "state_only");
ok("the month sentence reads the fetch date", usRatesMonth(hit, "en") === "September 2026", usRatesMonth(hit, "en"));

/* ── 3. The resolver: rate × taxability × precedence ────────────────────── */

section("Resolver — destination-based, below the company's word, above the default");

const canadian = { autoApplyLocalTax: true, taxRate: 13, country: "CA", province: "ON" };
const nyClient = { name: "Ada", country: "US", province: "NY", usTaxRate: ny };

const r1 = resolveTaxRate({ company: canadian, taxRates: [], client: nyClient });
ok("a Canadian company quoting NY gets the NY rate", r1.rate === 8.875 && r1.source === "jurisdiction_us", JSON.stringify(r1));
ok("...marked as an assumed answer (nobody said repair or capital)", r1.assumedAnswer === true);
const r2 = resolveTaxRate({ company: canadian, taxRates: [], client: nyClient, workType: "capitalImprovement" });
ok("NY capital improvement → stated 0", r2.rate === 0 && r2.source === "us_exempt" && r2.assumedAnswer === false);
const r3 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "B", country: "US", province: "CA" } });
ok("California → stated 0, no question", r3.rate === 0 && r3.source === "us_exempt" && !r3.assumedAnswer);
const r4 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "C", country: "US", province: "WA" } });
ok("Washington without a ZIP → the floor, applied, with the caution", r4.rate === 6.5 && r4.source === "jurisdiction_us" && r4.cautionKey);
const r5 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "D", country: "US", province: "TX" }, workType: "commercialRemodel" });
ok("TX commercial without a ZIP → 6.25 floor + caution", r5.rate === 6.25 && r5.cautionKey);
const r6 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "E", country: "US", province: "AZ" }, workType: "modification" });
ok("AZ modification → 65% of the floor", r6.rate === 3.64);
const r7 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "F", country: "US", province: "SD" } });
ok("SD → 2% excise, not the sales-tax rate", r7.rate === 2);

// Precedence.
const named = resolveTaxRate({ company: canadian, taxRates: [{ name: "New York sales tax", rate: 8 }], client: nyClient });
ok("a company rate named after the state wins", named.rate === 8 && named.source === "client_province");
const upper = resolveTaxRate({ company: canadian, taxRates: [{ name: "NY", rate: 7.5 }], client: nyClient });
ok("an upper-case two-letter name matches", upper.rate === 7.5);
const inWord = resolveTaxRate({ company: canadian, taxRates: [{ name: "GST in Ontario", rate: 5 }], client: { name: "G", country: "US", province: "IN" } });
ok('"in" inside a name does not match Indiana', inWord.source !== "client_province");
const override = resolveTaxRate({ company: { ...canadian, usTaxOverrides: { NY: { mode: "rate", rate: 7 } } }, taxRates: [], client: nyClient });
ok("a per-state override beats the tables", override.rate === 7 && override.source === "us_company_override");
const none = resolveTaxRate({ company: { ...canadian, usTaxOverrides: { NY: { mode: "none" } } }, taxRates: [], client: nyClient });
ok("a per-state 'none' is a stated zero", none.rate === 0 && none.source === "us_company_none");
const namedOverOverride = resolveTaxRate({ company: { ...canadian, usTaxOverrides: { NY: { mode: "rate", rate: 7 } } }, taxRates: [{ name: "New York", rate: 9 }], client: nyClient });
ok("a named rate beats the override", namedOverOverride.rate === 9);
const off = resolveTaxRate({ company: { ...canadian, autoApplyLocalTax: false }, taxRates: [], client: nyClient });
ok("autoApplyLocalTax off → the default, untouched", off.rate === 13 && off.source === "company_default");
const unknown = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "H", country: "US", province: "XX" } });
ok("an unknown state → status unknown, the default, never 0 invented", unknown.rate === 13 && unknown.source === "unknown_unknown_region");
const noCountry = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "I", province: "NY", usTaxRate: ny } });
ok("a NY province with no country → unknown, not New York", noCountry.source === "unknown_no_client_country");
const past = resolveTaxRate({ company: canadian, taxRates: [], client: nyClient, asOf: new Date("2024-03-01") });
ok("a 2024 date → unknown, not today's rate", past.source === "unknown_no_data_for_date" && past.rate === 13);

// The company-province assumption crosses into the US rung too.
const usCompany = { autoApplyLocalTax: true, taxRate: 0, country: "US", province: "TX" };
const assumed = resolveDocumentTax({ company: usCompany, taxRates: [], client: { name: "J" } });
ok("a US company with a blank client assumes its own state, labelled", assumed.assumed === true && /Texas/.test(assumed.assumedRegion) && assumed.source === "us_exempt");

/* ── 4. The sentences ───────────────────────────────────────────────────── */

section("Sentences — what was applied, in words, and translatable");

const s1 = renderTaxNote(explainTaxSource(r1, nyClient, "en"), t);
ok("NY sentence names rate, ZIP, split, scope, reason, month, assumption",
  s1.startsWith("8.875% New York sales tax (ZIP 10001: state 4% + local 4.875%), on the whole quote") &&
    /repair, maintenance and installation work is taxable in New York/.test(s1) &&
    /Rates table: September 2026\./.test(s1) &&
    /Assumed: Repair, maintenance or installation — tap to change\.$/.test(s1),
  s1);
const s2 = renderTaxNote(explainTaxSource(r2, nyClient, "en"), t);
ok("NY capital sentence is a stated zero with the reason and the would-be rate",
  s2.startsWith("No New York sales tax on this quote — a capital improvement is not taxed in New York") && /If this job were taxable: 8.875%/.test(s2), s2);
const s4 = renderTaxNote(explainTaxSource(r4, { name: "C" }, "en"), t);
ok("the ZIP-miss sentence says state rate only, county and city not known",
  /6.5% Washington sales tax — state rate only; county and city rates for this address are not known/.test(s4), s4);
const s7 = renderTaxNote(explainTaxSource(r7, { name: "F" }, "en"), t);
ok("SD sentence names the contractor's tax, not the sales-tax rate", /2% South Dakota contractor's tax/.test(s7), s7);
const spanning = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "K", country: "US", province: "WI", usTaxRate: { zip: "53202", state: "WI", combinedRate: 5.9, stateRate: 5, maxRate: 7.9, zipSpansRates: true, effectiveFrom: "2024-12-01T00:00:00.000Z", fetchedAt: "2026-09-19T00:00:00.000Z" } }, workType: "landscaping" });
const sSpan = renderTaxNote(explainTaxSource(spanning, { name: "K" }, "en"), t);
ok("a ZIP that spans districts says so", /Addresses in ZIP 53202 pay up to 7.9%/.test(sSpan), sSpan);
ok("no double spaces or trailing space in an assembled note", !/\s{2,}/.test(s1) && s1 === s1.trim());

// Every key the US sentences can reach exists in every app language.
const usKeys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.tax.us.") || k.startsWith("app.settings.usTax.") || ["app.tax.note.usApplied", "app.tax.note.usNone", "app.tax.note.usCompanyOverride", "app.tax.note.usCompanyNone", "app.tax.caution.usLocalNotIncluded"].includes(k));
ok("the US keys exist", usKeys.length >= 60, usKeys.length);
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = usKeys.filter((k) => !(k in APP_MESSAGES[lang]));
  ok(`every US key exists in ${lang}`, missing.length === 0, missing.join(", "));
}
for (const option of US_JOB_OPTIONS) {
  ok(`option ${option} has a label and a reason`, `app.tax.us.option.${option}` in APP_MESSAGES.en && `app.tax.us.reason.${option}` in APP_MESSAGES.en);
}
for (const row of Object.values(US_TAXABILITY)) {
  if (row.reason) ok(`reason ${row.reason} has a key`, `app.tax.us.reason.${row.reason}` in APP_MESSAGES.en);
}

// The document sentence, in every document language.
const docLangs = LANGUAGES.map((l) => l.code).filter((c) => DOCUMENT_LABELS[c]);
for (const code of docLangs) {
  const labels = DOCUMENT_LABELS[code];
  for (const key of ["usTaxApplied", "usTaxAppliedState", "usScopeShare", "usScopeFixed", "usTaxUpTo", "usTaxNone", "usTaxNoneCapital", "usTaxNoneCompany"]) {
    ok(`document label ${key} exists in ${code}`, typeof labels[key] === "string" && labels[key].length > 0);
  }
}
const rec1 = recordTaxResolution(r1);
ok("the document sentence for NY", documentTaxSentence(rec1, "en") === "New York sales tax at 8.875% (ZIP 10001). Rates as of September 2026.", documentTaxSentence(rec1, "en"));
ok("...in French, with a French decimal", /8,875 %/.test(documentTaxSentence(rec1, "fr")) && /septembre 2026/.test(documentTaxSentence(rec1, "fr")), documentTaxSentence(rec1, "fr"));
ok("the stated-zero sentence for a capital improvement", /capital improvement/.test(documentTaxSentence(recordTaxResolution(r2), "en")));
ok("the stated-zero sentence for California", /contractor pays tax on materials/.test(documentTaxSentence(recordTaxResolution(r3), "en")));
ok("AZ prints the real rate on a share, not the blend", documentTaxSentence(recordTaxResolution(r6), "en") === "Arizona sales tax at 5.6% on 65% of the amount.", documentTaxSentence(recordTaxResolution(r6), "en"));
ok("a Canadian record prints no US sentence", documentTaxSentence({ source: "jurisdiction_ca", rate: 13, country: "CA" }, "en") === "");
ok("a manual record prints no sentence", documentTaxSentence(manualTaxResolution(7), "en") === "");

/* ── 5. The stored record and the statement ─────────────────────────────── */

section("Stored record — the document keeps what it said");

ok("the record carries rate, applies, answer, month, ZIP", rec1.rate === 8.875 && rec1.applies === "all" && rec1.answer === "repair" && rec1.ratesMonth === "2026-09" && rec1.zip === "10001");
ok("the record is plain JSON", JSON.parse(JSON.stringify(rec1)).rate === 8.875);
ok("a company-default result records nothing", recordTaxResolution(off) === null);
ok("an unknown result records nothing", recordTaxResolution(unknown) === null);
ok("a stated zero is recognised", resolutionStatesZero(recordTaxResolution(r2)) && resolutionStatesZero(recordTaxResolution(none)) && !resolutionStatesZero(rec1));
ok("a matching amount keeps the record", resolutionMatchesAmount(rec1, 88.75, 1000));
ok("a mismatching amount does not", !resolutionMatchesAmount(rec1, 70, 1000));
ok("resolutionForDocument keeps the record when the money matches", resolutionForDocument({ resolution: r1, tax: 88.75, taxableBase: 1000, taxEnabled: true }).source === "jurisdiction_us");
ok("...and records a manual rate when it does not", resolutionForDocument({ resolution: r1, tax: 70, taxableBase: 1000, taxEnabled: true }).source === "manual");
ok("...and nothing when tax is off", resolutionForDocument({ resolution: r1, tax: 0, taxableBase: 1000, taxEnabled: false }) === null);

// The statement: a stored US zero is "none", a charged line is charged, and
// a line that should have been charged and was not is still unresolved.
const stNone = taxStatement({ taxEnabled: true, tax: 0, stored: recordTaxResolution(r2), company: canadian, client: nyClient });
ok("a stored stated zero → none, never unresolved", stNone.kind === "none");
ok("...and the send gate lets it through", taxSendRefusal(stNone, { client: nyClient }) === null);
const stCharged = taxStatement({ taxEnabled: true, tax: 88.75, stored: rec1, company: canadian, client: nyClient });
ok("a charged line → charged", stCharged.kind === "charged");
const stHole = taxStatement({ taxEnabled: true, tax: 0, stored: rec1, company: canadian, client: nyClient });
ok("8.875% owed and nothing charged → unresolved", stHole.kind === "unresolved");
const stLiveNone = taxStatement({ taxEnabled: true, tax: 0, company: canadian, client: { name: "B", country: "US", province: "CA" } });
ok("a live California resolution with no record → none", stLiveNone.kind === "none");
const stStale = taxStatement({ taxEnabled: true, tax: 0, stored: recordTaxResolution(r2), company: { ...canadian, usTaxOverrides: { NY: { mode: "rate", rate: 9 } } }, client: nyClient });
ok("the record wins over today's settings", stStale.kind === "none");

// An invoice inherits the quote's record verbatim — same object, same sentence.
const inherited = JSON.parse(JSON.stringify(rec1));
ok("invoice inherits rate, split and month exactly", inherited.rate === rec1.rate && inherited.applies === rec1.applies && inherited.ratesMonth === rec1.ratesMonth);
ok("...and prints the same sentence", documentTaxSentence(inherited, "en") === documentTaxSentence(rec1, "en"));

/* ── 6. Overrides ───────────────────────────────────────────────────────── */

section("Per-state overrides — a closed shape");

ok("normalise drops junk", Object.keys(normaliseUsOverrides({ NY: { mode: "rate", rate: 8 }, ZZ: { mode: "rate", rate: 1 }, TX: { mode: "bogus" }, __proto__: { mode: "none" } })).join(",") === "NY");
ok("a typed 0 becomes 'none'", normaliseUsOverrides({ FL: { mode: "rate", rate: 0 } }).FL.mode === "none");
ok("a 400% rate is refused", (() => { try { parseUsOverridesInput({ NY: { mode: "rate", rate: 400 } }); return false; } catch { return true; } })());
ok("an unknown state is refused", (() => { try { parseUsOverridesInput({ XX: { mode: "none" } }); return false; } catch { return true; } })());
ok("'auto' removes a state", Object.keys(parseUsOverridesInput({ NY: { mode: "auto" } })).length === 0);
ok("null input is an empty map", Object.keys(parseUsOverridesInput(null)).length === 0);

/* ── 7. The loader, against a fixture, twice ────────────────────────────── */

section("Loader — idempotent against a fixture");

const RATES = `39,45,39,.05750,.05750,.05750,.05750,20130901,99991231
39,00,049,.01250,.01250,.01250,.01250,20250401,99991231
39,00,049,.00750,.00750,.00750,.00750,20100101,20250331
39,63,25000,.01000,.01000,.01000,.01000,20250401,99991231
39,01,18000,.00500,.00500,.00500,.00500,20200101,99991231
`;
const pad = (n) => Array(n).fill("").join(",");
const BOUNDARY = [
  `Z,20190207,99991231,${pad(14)},43215,,43215,,,39,39,049,,,,,ST,25000,63,${pad(30)}`,
  `Z,20190207,20250331,${pad(14)},43215,,43215,,,39,39,049,,,,,${pad(33)}`,
  `4,20190207,99991231,${pad(14)},43215,0001,43215,0500,,39,39,049,18000,,,,ST,25000,63,${pad(30)}`,
  `4,20190207,99991231,${pad(14)},43215,0501,43215,0600,,39,39,049,,,,,ST,25000,63,${pad(30)}`,
  `Z,20190207,99991231,${pad(14)},43001,,43003,,,39,39,049,,,,,${pad(33)}`,
  `Z,20190207,99991231,${pad(14)},44000,,44000,,,36,36,049,,,,,${pad(33)}`,
  `A,20190207,99991231,1,99,O,,MAIN ST,,,,,,,COLUMBUS,43215,,43215,,,39,39,049,,,,,${pad(33)}`,
  `Z,20261001,99991231,${pad(14)},43050,,43050,,,39,39,049,,,,,${pad(33)}`,
].join("\r\n");

const rates = parseSstRateFile(RATES);
ok("rate file parsed", rates.rows === 5);
ok("the rate for a date picks the period", rates.rateFor("00", "049", 20260919).rate === 1.25 && rates.rateFor("0", "49", 20240101).rate === 0.75);
ok("a code is found across types", rates.rateFor("45", "25000", 20260919).rate === 1);
const asOf = new Date("2026-09-19");
const run = () => composeSstZipRates(BOUNDARY, rates, { state: "OH", asOf, source: "fixture", fetchedAt: new Date("2026-09-19T00:00:00Z") });
const a = run();
const b = run();
const hash = (rows) => createHash("md5").update(JSON.stringify(rows)).digest("hex");
ok("the same input composes the same rows twice", hash(a.rows) === hash(b.rows));
const columbus = a.rows.find((r) => r.zip === "43215");
ok("Columbus composes 5.75 + 1.25 + 1 = 8", columbus && columbus.combinedRate === 8, JSON.stringify(columbus));
ok("...with the state and local split", columbus.stateRate === 5.75 && columbus.countyRate === 1.25 && columbus.specialRate === 1);
ok("...the +4 range inside the city raises maxRate, the Z row stays the rate", columbus.maxRate === 8.5 && columbus.zipSpansRates === true);
ok("a ZIP range expands", ["43001", "43002", "43003"].every((z) => a.rows.some((r) => r.zip === z)));
ok("another state's ZIP in the file is skipped", !a.rows.some((r) => r.zip === "44000"));
ok("address rows are not ZIP facts", !a.rows.some((r) => r.zip === "00001"));
ok("a future-dated row is not yet a rate", !a.rows.some((r) => r.zip === "43050"));
ok("effectiveFrom is the newest component's date", columbus.effectiveFrom.toISOString().slice(0, 10) === "2025-04-01");
const sql = upsertSql(a.rows.slice(0, 2));
ok("upsert is ON CONFLICT DO UPDATE on zip", /ON CONFLICT \("zip"\) DO UPDATE/.test(sql.sql) && !/DELETE/i.test(sql.sql));
ok("upsert binds every column", sql.params.length === 2 * 15);
ok("yyyymmdd", yyyymmdd(new Date("2026-09-19T12:00:00Z")) === 20260919);

const listing = `<A HREF="/ratesandboundry/Rates/OHR2026Q3JUN01.csv">a</A><A HREF="/ratesandboundry/Rates/OHR2026Q4SEP17.csv">b</A><A HREF="/ratesandboundry/Rates/WAR2026Q4AUG27.zip">c</A><A HREF="/ratesandboundry/Rates/XXR2026Q4AUG27.zip">d</A>`;
const files = parseSstListing(listing, "R", "https://www.streamlinedsalestax.org/ratesandboundry/Rates/");
ok("listing picks the newest file per state", files.OH.name === "OHR2026Q4SEP17.csv" && files.OH.fileDate === "2026-09-17");
ok("listing keeps zips and drops non-members", files.WA.name === "WAR2026Q4AUG27.zip" && !files.XX);

const CENSUS = `OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_PART
1|19103|ZCTA5 19103|1000|2|42101|Philadelphia County|1000
3|19047|ZCTA5 19047|1000|4|42017|Bucks County|900
3|19047|ZCTA5 19047|1000|5|42101|Philadelphia County|100
6|15222|ZCTA5 15222|1000|7|42003|Allegheny County|1000
8|10001|ZCTA5 10001|1000|9|36061|New York County|1000
`;
const pa = composePaZipRates(CENSUS, { asOf, source: "fixture", fetchedAt: asOf }).rows;
ok("Philadelphia is 8%", pa.find((r) => r.zip === "19103").combinedRate === 8);
ok("Allegheny is 7%", pa.find((r) => r.zip === "15222").combinedRate === 7);
const straddle = pa.find((r) => r.zip === "19047");
ok("a straddling ZIP takes the lowest, names the largest county, flags the span", straddle.combinedRate === 6 && straddle.county === "Bucks County" && straddle.maxRate === 8 && straddle.zipSpansRates === true);
ok("a New York ZCTA is not in the Pennsylvania rows", !pa.some((r) => r.zip === "10001"));

/* ── 8. The loader script's own guard rails ─────────────────────────────── */

section("Loader script — never deletes, runs from a Mac, documented");

const script = readFileSync(new URL("../scripts/us-tax-rates-load.mjs", import.meta.url), "utf8");
ok("the script never deletes", !/deleteMany|DELETE FROM|TRUNCATE/i.test(script));
ok("the script says it runs from the owner's Mac", /owner's Mac/.test(script));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
ok("npm run us-tax:load exists", typeof pkg.scripts["us-tax:load"] === "string");
ok("fflate is a declared dependency", Boolean(pkg.dependencies.fflate));
const doc = readFileSync(new URL("../docs/US-SALES-TAX.md", import.meta.url), "utf8");
ok("docs/US-SALES-TAX.md names the sources and the monthly run", /streamlinedsalestax\.org/.test(doc) && /us-tax:load/.test(doc));

console.log(`\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} assertions`);
process.exit(failures ? 1 : 0);
