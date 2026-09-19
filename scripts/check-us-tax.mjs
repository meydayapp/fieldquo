// scripts/check-us-tax.mjs
//
// Executes the US rung of the tax resolver — lib/tax/usTaxability.js,
// lib/tax/usRates.js's pure parts, lib/tax/usRatesLoad.js, the sentences and
// the stored record — against real and hostile input.
//
//   npm run check:us-tax
//
// Every assertion is about the same thing the Canadian check is about: the
// number in the box is the state's own published figure for the address,
// applied to the whole quote exactly as a province's rate is (the owner's
// rule, 2026-09-19: "the contractor can charge the tax, I'm not here to
// police them"), with the state's own rule beside it as a hint — and a
// document that said nothing was owed keeps saying it.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  US_TAXABILITY,
  US_STATES,
  US_JOB_OPTIONS,
  usTaxHint,
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

// The hint: the case in which the state's rule leaves the customer untaxed.
ok("NY hint names the capital improvement", usTaxHint("NY").reason === "capitalImprovement" && usTaxHint("NY").labour === "depends");
ok("TX hint names residential work", usTaxHint("TX").reason === "residential");
ok("OH hint names building work", usTaxHint("OH").reason === "construction");
ok("CA hint is the generic exempt reason", usTaxHint("CA").reason === "exempt" && usTaxHint("CA").labour === "exempt");
ok("AZ hint names MRRA", usTaxHint("AZ").reason === "mrra");
ok("WA has no hint — the rate is the rule", usTaxHint("WA").reason === null && usTaxHint("WA").labour === "taxable");
ok("HI has no hint", usTaxHint("HI").reason === null);
ok("SD hints at the excise", usTaxHint("SD").reason === "contractorExcise");
ok("unknown state → null", usTaxHint("ZZ") === null && usTaxHint("constructor") === null && usTaxHint(null) === null);
for (const state of US_STATES) {
  const h = usTaxHint(state);
  ok(`${state} hint reason has a sentence`, h.reason === null || `app.tax.us.reason.${h.reason}` in APP_MESSAGES.en, h.reason);
}

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

/* ── 3. The resolver: the full rate on the whole quote, hint beside it ─── */

section("Resolver — the full combined rate, destination-based, below the company's word");

const canadian = { autoApplyLocalTax: true, taxRate: 13, country: "CA", province: "ON" };
const nyClient = { name: "Ada", country: "US", province: "NY", usTaxRate: ny };

const r1 = resolveTaxRate({ company: canadian, taxRates: [], client: nyClient });
ok("a Canadian company quoting NY gets the full NY rate", r1.rate === 8.875 && r1.source === "jurisdiction_us", JSON.stringify(r1));
ok("...nothing assumed on the contractor's behalf", r1.assumedAnswer === null);
ok("...and the capital-improvement hint beside it", r1.detail?.treatment?.hint === "capitalImprovement" && r1.detail?.treatment?.applies === "all");
const r2 = resolveTaxRate({ company: canadian, taxRates: [], client: nyClient, workType: "capitalImprovement" });
ok("a work-type answer no longer moves the number", r2.rate === 8.875 && r2.source === "jurisdiction_us");
const r3 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "B", country: "US", province: "CA" } });
ok("California → the 7.25% floor, applied, with the exempt hint", r3.rate === 7.25 && r3.source === "jurisdiction_us" && r3.detail.treatment.hint === "exempt");
const r4 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "C", country: "US", province: "WA" } });
ok("Washington without a ZIP → the floor, applied, with the caution, no hint", r4.rate === 6.5 && r4.source === "jurisdiction_us" && r4.cautionKey && r4.detail.treatment.hint === null);
const r5 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "D", country: "US", province: "TX" } });
ok("TX without a ZIP → 6.25 floor + caution + residential hint", r5.rate === 6.25 && r5.cautionKey && r5.detail.treatment.hint === "residential");
const r6 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "E", country: "US", province: "AZ" } });
ok("AZ → the full floor, never 65% of it", r6.rate === 5.6);
const r7 = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "F", country: "US", province: "SD" } });
ok("SD → the sales-tax floor, the excise is a hint", r7.rate === 4.2 && r7.detail.treatment.hint === "contractorExcise");
const oh = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "G", country: "US", province: "OH", usTaxRate: { zip: "43215", state: "OH", combinedRate: 8, stateRate: 5.75, fetchedAt: "2026-09-19T00:00:00.000Z" } } });
ok("Ohio → 8% on the whole quote, building-work hint", oh.rate === 8 && oh.detail.treatment.hint === "construction");
ok("the US rung never produces a stated zero any more", [r1, r2, r3, r4, r5, r6, r7, oh].every((r) => r.rate > 0 && r.source === "jurisdiction_us"));

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
ok("a US company with a blank client assumes its own state, labelled", assumed.assumed === true && /Texas/.test(assumed.assumedRegion) && assumed.rate === 6.25);

/* ── 4. The sentences ───────────────────────────────────────────────────── */

section("Sentences — what was applied, in words, and translatable");

const s1 = renderTaxNote(explainTaxSource(r1, nyClient, "en"), t);
ok("NY sentence: rate, ZIP, split, whole quote, month, then the hint",
  s1.startsWith("8.875% New York sales tax (ZIP 10001: state 4% + local 4.875%), on the whole quote. Rates table: September 2026.") &&
    /Note: a capital improvement is not taxed in New York/.test(s1) &&
    /switch tax off on this quote if that applies to you; what you charge is your call\.$/.test(s1),
  s1);
const s5 = renderTaxNote(explainTaxSource(r5, { name: "D" }, "en"), t);
ok("TX sentence says state rate only, whole quote, then the residential hint",
  /6.25% Texas sales tax — state rate only; county and city rates for this address are not known, on the whole quote\./.test(s5) &&
    /Note: residential work is not taxed to the customer in Texas/.test(s5), s5);
const sOh = renderTaxNote(explainTaxSource(oh, { name: "G" }, "en"), t);
ok("Ohio sentence: 8%, ZIP split, building-work hint", /^8% Ohio sales tax \(ZIP 43215: state 5.75% \+ local 2.25%\), on the whole quote\. Rates table: September 2026\. Note: the contractor pays tax on materials at purchase and construction on real property is not taxed in Ohio/.test(sOh), sOh);
const s4 = renderTaxNote(explainTaxSource(r4, { name: "C" }, "en"), t);
ok("a state with no hint gets no note", /on the whole quote\.$/.test(s4) && !/Note:/.test(s4), s4);
const spanning = resolveTaxRate({ company: canadian, taxRates: [], client: { name: "K", country: "US", province: "WI", usTaxRate: { zip: "53202", state: "WI", combinedRate: 5.9, stateRate: 5, maxRate: 7.9, zipSpansRates: true, effectiveFrom: "2024-12-01T00:00:00.000Z", fetchedAt: "2026-09-19T00:00:00.000Z" } } });
const sSpan = renderTaxNote(explainTaxSource(spanning, { name: "K" }, "en"), t);
ok("a ZIP that spans districts says so", /Addresses in ZIP 53202 pay up to 7.9%/.test(sSpan), sSpan);
ok("no double spaces, no orphan punctuation", [s1, s4, s5, sOh, sSpan].every((x) => !/\s{2,}|\.\s*\./.test(x) && x === x.trim()));
for (const lang of Object.keys(APP_MESSAGES)) {
  const tl = (k, p = {}) => String(APP_MESSAGES[lang][k] ?? k).replace(/\{(\w+)\}/g, (_, x) => (p[x] == null ? "" : String(p[x])));
  const note = renderTaxNote(explainTaxSource(r5, { name: "D" }, lang), tl);
  ok(`the TX note renders in ${lang} with no raw key`, note.length > 40 && !/app\.tax\./.test(note), note);
}

// Every key the US sentences can reach exists in every app language.
const usKeys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.tax.us.") || k.startsWith("app.settings.usTax.") || ["app.tax.note.usApplied", "app.tax.note.usAppliedHint", "app.tax.note.usCompanyOverride", "app.tax.note.usCompanyNone", "app.tax.caution.usLocalNotIncluded"].includes(k));
ok("the US keys exist", usKeys.length >= 45, usKeys.length);
for (const lang of Object.keys(APP_MESSAGES)) {
  const missing = usKeys.filter((k) => !(k in APP_MESSAGES[lang]));
  ok(`every US key exists in ${lang}`, missing.length === 0, missing.join(", "));
}
for (const option of US_JOB_OPTIONS) {
  ok(`kind ${option} has a reason sentence`, `app.tax.us.reason.${option}` in APP_MESSAGES.en);
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
ok("the document sentence for TX without a ZIP", documentTaxSentence(recordTaxResolution(r5), "en") === "Texas sales tax at 6.25%.");
ok("the document sentence for Ohio", documentTaxSentence(recordTaxResolution(oh), "en") === "Ohio sales tax at 8% (ZIP 43215). Rates as of September 2026.");
ok("the hint is the estimator's, never the homeowner's", !/switch tax off|your call/.test(documentTaxSentence(rec1, "en")));
// Documents written under the earlier rule keep saying what they said.
const oldExempt = { v: 1, source: "us_exempt", rate: 0, country: "US", region: "NY", label: "New York", applies: "none", answer: "capitalImprovement", precision: "zip", zip: "10001", ratesMonth: "2026-09" };
ok("a stored us_exempt record still prints its stated zero", /capital improvement/.test(documentTaxSentence(oldExempt, "en")));
const oldShare = { v: 1, source: "jurisdiction_us", rate: 3.64, baseRate: 5.6, country: "US", region: "AZ", label: "Arizona", applies: "share", share: 0.65, precision: "state_only" };
ok("a stored share record still prints the real rate on the share", documentTaxSentence(oldShare, "en") === "Arizona sales tax at 5.6% on 65% of the amount.", documentTaxSentence(oldShare, "en"));
ok("a Canadian record prints no US sentence", documentTaxSentence({ source: "jurisdiction_ca", rate: 13, country: "CA" }, "en") === "");
ok("a manual record prints no sentence", documentTaxSentence(manualTaxResolution(7), "en") === "");

/* ── 5. The stored record and the statement ─────────────────────────────── */

section("Stored record — the document keeps what it said");

ok("the record carries rate, applies (all), month, ZIP, no answer", rec1.rate === 8.875 && rec1.applies === "all" && rec1.answer === null && rec1.assumedAnswer === false && rec1.ratesMonth === "2026-09" && rec1.zip === "10001");
ok("the record is plain JSON", JSON.parse(JSON.stringify(rec1)).rate === 8.875);
ok("a company-default result records nothing", recordTaxResolution(off) === null);
ok("an unknown result records nothing", recordTaxResolution(unknown) === null);
ok("a stated zero is recognised — the company's own, and an older us_exempt record", resolutionStatesZero(recordTaxResolution(none)) && resolutionStatesZero(oldExempt) && !resolutionStatesZero(rec1));
ok("a matching amount keeps the record", resolutionMatchesAmount(rec1, 88.75, 1000));
ok("a mismatching amount does not", !resolutionMatchesAmount(rec1, 70, 1000));
ok("resolutionForDocument keeps the record when the money matches", resolutionForDocument({ resolution: r1, tax: 88.75, taxableBase: 1000, taxEnabled: true }).source === "jurisdiction_us");
ok("...and records a manual rate when it does not", resolutionForDocument({ resolution: r1, tax: 70, taxableBase: 1000, taxEnabled: true }).source === "manual");
ok("...and nothing when tax is off", resolutionForDocument({ resolution: r1, tax: 0, taxableBase: 1000, taxEnabled: false }) === null);

// The statement: a charged line is charged; a US line with tax on and
// nothing charged is unresolved (the same hole Canada refuses); the
// company's own "collect nothing" and an older stated-zero record are "none".
const stCharged = taxStatement({ taxEnabled: true, tax: 88.75, stored: rec1, company: canadian, client: nyClient });
ok("a charged line → charged", stCharged.kind === "charged");
const stHole = taxStatement({ taxEnabled: true, tax: 0, stored: rec1, company: canadian, client: nyClient });
ok("8.875% owed and nothing charged → unresolved", stHole.kind === "unresolved");
const stOff = taxStatement({ taxEnabled: false, tax: 0, stored: null, company: canadian, client: nyClient });
ok("tax switched off on the quote → off, the one press the hint points at", stOff.kind === "off");
const stCompanyNone = taxStatement({ taxEnabled: true, tax: 0, stored: recordTaxResolution(none), company: canadian, client: nyClient });
ok("the company's own 'collect nothing' → none", stCompanyNone.kind === "none");
ok("...and the send gate lets it through", taxSendRefusal(stCompanyNone, { client: nyClient }) === null);
const stOld = taxStatement({ taxEnabled: true, tax: 0, stored: oldExempt, company: canadian, client: nyClient });
ok("an older stored us_exempt record → none, whatever today's rule says", stOld.kind === "none");
const stLive = taxStatement({ taxEnabled: true, tax: 0, company: canadian, client: { name: "B", country: "US", province: "CA" } });
ok("a live California resolution with nothing charged → unresolved, not a zero invented for the contractor", stLive.kind === "unresolved");

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
