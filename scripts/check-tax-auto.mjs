// scripts/check-tax-auto.mjs
//
//   npm run check:tax-auto
//
// Tax is worked out automatically from the province or state of the JOB
// (owner, 2026-09-21: "taxes should be automatically set based on the
// province / state"). This executes the whole ladder — the address parser,
// the client-record reader, the place-of-supply order, the mode switch, the
// tax line's words — against the cases the owner named and the hostile
// input a real client list carries.
//
// Mutations that must fail this script: put the autoApplyLocalTax gate back
// above the ladder; read the client's record before the job address; pass
// the raw "Ontario" to the Canadian table; key the builder's "not worked
// out" on the tax AMOUNT; make a null taxMode read as manual.

import { regionFromAddressText, regionFromClientRecord, normaliseProvince, normaliseUsState, countryFromName } from "@/lib/tax/addressRegion";
import { effectiveTaxMode, companyDefaultRate, parseTaxMode } from "@/lib/tax/taxMode";
import { resolveTaxRate, normaliseProvince as reExportedProvince } from "@/lib/tax/resolveTaxRate";
import { resolveDocumentTax, taxStatement, taxSendRefusal, placeOfSupply, clientJurisdictionKnown } from "@/lib/tax/documentTax";
import { recordTaxResolution } from "@/lib/tax/taxResolution";
import { taxLineHeadline, taxLineSource, taxLineResolved, taxLineUnresolvedHint } from "@/lib/tax/taxLine";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";
import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
function ok(label, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `\n        got: ${detail}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}`);
const fill = (tpl, p = {}) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => (p[k] == null ? "" : String(p[k])));
const tIn = (lang) => (key, params) => fill(APP_MESSAGES[lang]?.[key] ?? APP_MESSAGES.en[key] ?? key, params);

/* ═══════════════ 1. The parser ══════════════════════════════════════════ */

section("The address parser reads a province or state, with its country");

const cases = [
  ["Ottawa, ON", "CA", "ON"],
  ["Ottawa, Ontario", "CA", "ON"],
  ["12 Main St, Ottawa, ON K1A 0B1, Canada", "CA", "ON"],
  ["755 Rue Saint-Louis, Gatineau, QC J8T 1A1, Canada", "CA", "QC"],
  ["755 Rue Saint-Louis, Gatineau, Québec J8T 1A1", "CA", "QC"],
  ["Gatineau QC", "CA", "QC"],
  ["Toronto, Ontario, Canada", "CA", "ON"],
  ["12 Water St, Halifax, NS B3J 1A1, Canada", "CA", "NS"],
  ["Calgary, Alberta", "CA", "AB"],
  ["Vancouver, Colombie-Britannique", "CA", "BC"],
  ["1990 S 1st St, Austin, TX 78704", "US", "TX"],
  ["Austin, TX 78704, USA", "US", "TX"],
  ["1600 Pennsylvania Ave NW, Washington, DC 20500, USA", "US", "DC"],
  ["Seattle, Washington", "US", "WA"],
];
for (const [text, country, region] of cases) {
  const r = regionFromAddressText(text);
  ok(`${JSON.stringify(text)} → ${country} ${region}`, r.country === country && r.region === region, JSON.stringify(r));
}

section("…and refuses what does not name one");
for (const text of ["", null, undefined, 42, "on the road", "Halifax", "12 Ontario St, Stratford", "Ottawa, ON, United States", "in or me hi", "__proto__, constructor", "12 rue de la Paix, Paris, France"]) {
  const r = regionFromAddressText(text);
  ok(`${JSON.stringify(text)} → nothing`, r.country === null && r.region === null, JSON.stringify(r));
}
ok("a lower-case 'on' is a word, not Ontario", regionFromAddressText("meet me on, the corner").region === null);
ok("a code alone settles its country as evidence 'code'", regionFromAddressText("Ottawa, ON").countryEvidence === "code");
ok("a postal code is stronger evidence", regionFromAddressText("Ottawa, ON K1A 0B1").countryEvidence === "postal");
ok("the country's name is the strongest", regionFromAddressText("Ottawa, ON, Canada").countryEvidence === "word");
ok("a Canadian postal code is normalised to 'A1A 1A1'", regionFromAddressText("Ottawa, ON k1a0b1").postalCode === "K1A 0B1");

section("Province, state and country names in three languages");
for (const [v, code] of [["ON", "ON"], ["on", "ON"], ["Ontario", "ON"], ["Québec", "QC"], ["quebec", "QC"], ["Colombie-Britannique", "BC"], ["Nouvelle-Écosse", "NS"], ["Île-du-Prince-Édouard", "PE"], ["Terre-Neuve-et-Labrador", "NL"], ["PEI", "PE"]]) {
  ok(`normaliseProvince(${JSON.stringify(v)}) = ${code}`, normaliseProvince(v) === code, normaliseProvince(v));
}
ok("resolveTaxRate re-exports the same normaliser", reExportedProvince === normaliseProvince);
for (const [v, code] of [["TX", "TX"], ["Texas", "TX"], ["texas", "TX"], ["Californie", "CA"], ["Nueva York", "NY"], ["District of Columbia", "DC"]]) {
  ok(`normaliseUsState(${JSON.stringify(v)}) = ${code}`, normaliseUsState(v) === code, normaliseUsState(v));
}
ok("normaliseUsState refuses a Canadian code", normaliseUsState("ON") === null);
ok("normaliseProvince refuses a US code", normaliseProvince("TX") === null);
for (const [v, code] of [["Canada", "CA"], ["CANADA", "CA"], ["ca", "CA"], ["United States", "US"], ["USA", "US"], ["États-Unis", "US"], ["Estados Unidos", "US"]]) {
  ok(`countryFromName(${JSON.stringify(v)}) = ${code}`, countryFromName(v) === code);
}
ok("normaliseCountry now takes 'Canada'", normaliseCountry("Canada") === "CA");
ok("…and still any two letters", normaliseCountry("mx") === "MX");
ok("…and still refuses free text", normaliseCountry("somewhere") === null);

/* ═══════════════ 2. The client record ═══════════════════════════════════ */

section("The client record: columns in any spelling, then the address line");

ok("province ON + country CA", regionFromClientRecord({ province: "ON", country: "CA" }).region === "ON");
ok("province Ontario + country Canada", (() => { const r = regionFromClientRecord({ province: "Ontario", country: "Canada" }); return r.country === "CA" && r.region === "ON"; })());
ok("province ON, no country, Canadian company → Ontario", regionFromClientRecord({ province: "ON" }, { companyCountry: "CA" }).country === "CA");
ok("province ON, no country, no company country → Ontario", regionFromClientRecord({ province: "ON" }).country === "CA");
ok("province ON, no country, US company → unknown (a border is not crossed on two letters)", regionFromClientRecord({ province: "ON" }, { companyCountry: "US" }).country === null);
ok("province TX, no country, US company → Texas", regionFromClientRecord({ province: "TX" }, { companyCountry: "US" }).region === "TX");
const legacy = regionFromClientRecord({ address: "755 Rue Saint-Louis, Gatineau, QC J8T 1A1, Canada" });
ok("a legacy row with only an address line answers from it", legacy.country === "CA" && legacy.region === "QC" && legacy.from === "address", JSON.stringify(legacy));
ok("a country column that contradicts the address line resolves to nothing", regionFromClientRecord({ country: "US", address: "Ottawa, ON K1A 0B1" }).country === null);
ok("an address line whose country rests on the code alone does not cross the border either", regionFromClientRecord({ address: "Ottawa, ON" }, { companyCountry: "US" }).country === null);
ok("…but a postal code on it does", regionFromClientRecord({ address: "Ottawa, ON K1A 0B1" }, { companyCountry: "US" }).country === "CA");
ok("nothing → nothing", regionFromClientRecord({ name: "Emilio" }).country === null);
ok("null → nothing", regionFromClientRecord(null).country === null);
ok("a VAT country keeps its country with whatever region was typed", regionFromClientRecord({ country: "NL", province: "Noord-Holland" }).country === "NL");

/* ═══════════════ 3. The mode ════════════════════════════════════════════ */

section("The mode: auto by default, manual only when chosen or previously opted out");

ok("null taxMode, autoApplyLocalTax true → auto", effectiveTaxMode({ taxMode: null, autoApplyLocalTax: true }) === "auto");
ok("null taxMode, autoApplyLocalTax absent → auto", effectiveTaxMode({}) === "auto");
ok("null company → auto", effectiveTaxMode(null) === "auto");
ok("null taxMode, autoApplyLocalTax false → manual (the one pre-existing opt-out)", effectiveTaxMode({ autoApplyLocalTax: false }) === "manual");
ok("explicit manual wins over the boolean", effectiveTaxMode({ taxMode: "manual", autoApplyLocalTax: true }) === "manual");
ok("explicit auto wins over the boolean", effectiveTaxMode({ taxMode: "auto", autoApplyLocalTax: false }) === "auto");
ok("garbage taxMode falls back to the derivation", effectiveTaxMode({ taxMode: "sometimes", autoApplyLocalTax: false }) === "manual");
ok("parseTaxMode accepts the two values in any case", parseTaxMode("AUTO") === "auto" && parseTaxMode(" manual ") === "manual");
ok("…and nothing else", parseTaxMode("") === null && parseTaxMode("off") === null && parseTaxMode(null) === null);
ok("the default rate is the row flagged default first", companyDefaultRate({ taxRate: 7 }, [{ name: "HST", rate: 13, isDefault: true }]).rate === 13);
ok("…then the flat column", companyDefaultRate({ taxRate: 7 }, []).rate === 7);
ok("…then nothing, which is 0 with no label", companyDefaultRate({ taxRate: 0 }, []).rate === 0);

/* ═══════════════ 4. The ladder, on the owner's cases ════════════════════ */

section("The owner's cases");

const truefinish = { taxRate: 0, autoApplyLocalTax: true, taxMode: null, country: "CA", province: "ON", vatRegistered: null, usTaxOverrides: null };
const ottawa = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "A", city: "Ottawa", province: "ON", country: "CA" } });
ok("Ottawa, ON client → 13% HST from the client's province", ottawa.rate === 13 && ottawa.source === "jurisdiction_ca" && ottawa.place.source === "client" && !ottawa.assumed, JSON.stringify({ rate: ottawa.rate, source: ottawa.source, place: ottawa.place }));
ok("…as 'HST 13% (Ontario)'", tIn("en")(taxLineHeadline(ottawa, "en").key, taxLineHeadline(ottawa, "en").params) === "HST 13% (Ontario)", JSON.stringify(taxLineHeadline(ottawa, "en")));
ok("…'from the client's address'", taxLineSource(ottawa).key === "app.tax.source.client");
const ottawaWords = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "A2", city: "Ottawa", province: "Ontario", country: "Canada" } });
ok("'Ontario' / 'Canada' spelt out → the same 13%", ottawaWords.rate === 13 && ottawaWords.source === "jurisdiction_ca", `${ottawaWords.rate} ${ottawaWords.source}`);
const ottawaHalf = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "A3", province: "ON", country: "" } });
ok("'ON' with no country, on a Canadian company → 13% from the client, not assumed", ottawaHalf.rate === 13 && ottawaHalf.basis === "client", `${ottawaHalf.rate} ${ottawaHalf.basis}`);

const qc = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "B", province: "QC", country: "CA" } });
const qcHead = taxLineHeadline(qc, "en");
ok("QC → GST 5% + QST 9.975% = 14.975%", qc.rate === 14.975 && tIn("en")(qcHead.key, qcHead.params) === "GST 5% + QST 9.975% (Quebec)", tIn("en")(qcHead.key, qcHead.params));
const qcFr = taxLineHeadline(resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "B", province: "QC", country: "CA" }, lang: "fr" }), "fr");
ok("…in French: 'TPS 5 % + TVQ 9,975 % (Québec)' or the components as named, with the French decimal", /9,975/.test(tIn("fr")(qcFr.key, qcFr.params)) && /Québec/.test(tIn("fr")(qcFr.key, qcFr.params)), tIn("fr")(qcFr.key, qcFr.params));

const ab = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "C", province: "AB", country: "CA" } });
ok("AB → 5% GST", ab.rate === 5 && ab.source === "jurisdiction_ca");

const ns = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "D", province: "ON", country: "CA" }, siteAddress: "12 Water St, Halifax, NS B3J 1A1, Canada" });
ok("job address in NS, client in ON → 14% NS, from the job address", ns.rate === 14 && ns.place.source === "site" && ns.place.region === "NS", JSON.stringify(ns.place));
ok("…'from the job address'", taxLineSource(ns).key === "app.tax.source.site");
const nsCode = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "D", province: "ON", country: "CA" }, siteAddress: "12 Water St, Halifax, NS" });
ok("…and 'Halifax, NS' with no postal code still answers on the company's own side of the border", nsCode.rate === 14 && nsCode.place.source === "site");

const gatineau = resolveDocumentTax({ company: truefinish, taxRates: [], client: { name: "Emilio Boves", address: "755 Rue Saint-Louis, Gatineau, QC J8T 1A1, Canada" } });
ok("the Gatineau client with only an address line → 14.975%, from the client's address line, not assumed Ontario", gatineau.rate === 14.975 && gatineau.place.source === "client_address" && !gatineau.assumed, JSON.stringify({ rate: gatineau.rate, place: gatineau.place }));

const txCo = { ...truefinish, country: "US", province: "TX" };
const tx = resolveDocumentTax({ company: txCo, taxRates: [], client: { name: "E", province: "TX", country: "US" } });
ok("US TX company and client → the combined rate applied (state floor without a ZIP row)", tx.rate === 6.25 && tx.source === "jurisdiction_us", `${tx.rate} ${tx.source}`);
ok("…with the state's own rule as a hint, never a change to the number", typeof tx.detail?.treatment?.hint === "string" && tx.detail.treatment.applies === "all", JSON.stringify(tx.detail?.treatment));
ok("…and the 'local rates not included' caution", tx.cautionKey === "app.tax.caution.usLocalNotIncluded");
const txZip = resolveDocumentTax({ company: txCo, taxRates: [], client: { name: "E", province: "TX", country: "US", postalCode: "78704", usTaxRate: { zip: "78704", state: "TX", combinedRate: 8.25, stateRate: 6.25, fetchedAt: "2026-09-01T00:00:00.000Z" } } });
ok("…and 8.25% with the ZIP row attached", txZip.rate === 8.25 && txZip.detail?.precision === "zip");
const txSiteOther = resolveDocumentTax({ company: txCo, taxRates: [], client: { name: "E", province: "TX", country: "US", postalCode: "78704", usTaxRate: { zip: "78704", state: "TX", combinedRate: 8.25, stateRate: 6.25 } }, siteAddress: "100 Congress Ave, Austin, TX 78701" });
ok("a job at a different ZIP does not borrow the client's ZIP row", txSiteOther.rate === 6.25 && txSiteOther.place.source === "site", `${txSiteOther.rate} ${txSiteOther.place?.source}`);

const nowhere = resolveDocumentTax({ company: { taxRate: 0 }, taxRates: [], client: { name: "F" } });
ok("no address anywhere → unresolved, rate 0", nowhere.rate === 0 && nowhere.source.startsWith("unknown_") && nowhere.basis === "none", `${nowhere.rate} ${nowhere.source} ${nowhere.basis}`);
ok("…and not 'resolved'", taxLineResolved(nowhere) === false);
const hint = taxLineUnresolvedHint(nowhere, { place: null });
ok("…with the hint that says what to ADD, not 'no rate is known'", hint.key === "app.tax.line.addProvince", hint.key);
ok("…which names the province in English", /province/i.test(APP_MESSAGES.en["app.tax.line.addProvince"]));
const placed = taxLineUnresolvedHint({ source: "unknown_unsupported_country", rate: 0 }, { place: "Paris, Île-de-France" });
ok("a place with no table keeps the 'no rate is known for {place}' sentence", placed.key === "app.tax.line.unresolvedHintPlace");

section("The mode switch");
const manualOptOut = resolveDocumentTax({ company: { ...truefinish, autoApplyLocalTax: false, taxMode: null }, taxRates: [{ name: "Flat", rate: 12, isDefault: true }], client: { name: "G", province: "ON", country: "CA" } });
ok("an existing company that had opted OUT with a typed 12% default stays 12% (manual)", manualOptOut.rate === 12 && manualOptOut.source === "company_default", `${manualOptOut.rate} ${manualOptOut.source}`);
ok("…'your default rate'", taxLineSource(manualOptOut).key === "app.tax.source.default");
const manualExplicit = resolveDocumentTax({ company: { ...truefinish, taxMode: "manual" }, taxRates: [{ name: "HST Ontario", rate: 13.5 }, { name: "Flat", rate: 12, isDefault: true }], client: { name: "G", province: "QC", country: "CA" } });
ok("manual: an unmatched province takes the default, never the table", manualExplicit.rate === 12, `${manualExplicit.rate} ${manualExplicit.source}`);
const manualNamed = resolveDocumentTax({ company: { ...truefinish, taxMode: "manual" }, taxRates: [{ name: "HST Ontario", rate: 13.5 }, { name: "Flat", rate: 12, isDefault: true }], client: { name: "G", province: "ON", country: "CA" } });
ok("manual: a row named after the province still matches", manualNamed.rate === 13.5 && manualNamed.source === "client_province");
const manualNothing = resolveDocumentTax({ company: { ...truefinish, taxMode: "manual" }, taxRates: [], client: { name: "G", province: "ON", country: "CA" } });
ok("manual with no rates at all → unresolved, not 0%", manualNothing.rate === 0 && manualNothing.source === "unknown_no_default");
const autoTyped = resolveDocumentTax({ company: { ...truefinish, taxMode: null, autoApplyLocalTax: true }, taxRates: [{ name: "Flat", rate: 12, isDefault: true }], client: { name: "H", province: "ON", country: "CA" } });
ok("an existing company with a typed 12% default that never opted out is on auto: Ontario gets 13% from the table", autoTyped.rate === 13 && autoTyped.source === "jurisdiction_ca", `${autoTyped.rate} ${autoTyped.source}`);
const autoTypedNoPlace = resolveDocumentTax({ company: { taxMode: null, autoApplyLocalTax: true, taxRate: 0 }, taxRates: [{ name: "Flat", rate: 12, isDefault: true }], client: { name: "H" } });
ok("…and its 12% still applies where nothing names a province", autoTypedNoPlace.rate === 12 && autoTypedNoPlace.source === "company_default");
const newCompany = resolveDocumentTax({ company: { taxMode: null, autoApplyLocalTax: true, taxRate: 0, country: "CA", province: "BC" }, taxRates: [], client: { name: "I", province: "BC", country: "CA" } });
ok("a new company (nothing typed) gets auto: BC 12%", newCompany.rate === 12 && newCompany.source === "jurisdiction_ca");
const named = resolveTaxRate({ company: { taxMode: "auto", taxRate: 0 }, taxRates: [{ name: "HST Ontario", rate: 13.25 }], client: { province: "ON", country: "CA" } });
ok("auto: the company's own row named after the province beats the table", named.rate === 13.25 && named.source === "client_province");
ok("…'HST Ontario 13.25%'", tIn("en")(taxLineHeadline(named, "en").key, taxLineHeadline(named, "en").params) === "HST Ontario 13.25%");

/* ═══════════════ 5. The statement is keyed on the rate, not the amount ═══ */

section("An empty quote at a known rate is $0 charged, not unresolved");
const emptyKnown = taxStatement({ taxEnabled: true, tax: 0, taxableBase: 0, company: truefinish, taxRates: [], client: { province: "ON", country: "CA" } });
ok("subtotal $0, rate 13% → charged", emptyKnown.kind === "charged", emptyKnown.kind);
const emptyUnknown = taxStatement({ taxEnabled: true, tax: 0, taxableBase: 0, company: { taxRate: 0 }, taxRates: [], client: {} });
ok("subtotal $0, no rate → unresolved", emptyUnknown.kind === "unresolved", emptyUnknown.kind);
const fullUnknownRate = taxStatement({ taxEnabled: true, tax: 0, taxableBase: 5250, company: truefinish, taxRates: [], client: { province: "ON", country: "CA" } });
ok("subtotal $5,250, tax $0, rate 13% → unresolved (Q-2026-0011's shape)", fullUnknownRate.kind === "unresolved", fullUnknownRate.kind);
const refusal = taxSendRefusal(fullUnknownRate, { client: { id: "c1", name: "janet", province: "ON", country: "CA" } });
ok("…and the send refusal names the 13% rather than a missing field", refusal?.resolvable?.rate === 13 && refusal.missing.length === 0, JSON.stringify(refusal));
const noBase = taxStatement({ taxEnabled: true, tax: 0, company: truefinish, taxRates: [], client: { province: "ON", country: "CA" } });
ok("a caller that does not know the base gets unresolved, not a guessed figure", noBase.kind === "unresolved");
const site = placeOfSupply({ siteAddress: "Halifax, NS B3J 1A1", client: { province: "ON", country: "CA" }, company: truefinish });
ok("placeOfSupply: the site answers first", site.source === "site" && site.region === "NS");
ok("clientJurisdictionKnown reads the border rule", clientJurisdictionKnown({ province: "ON" }, { country: "CA" }) === true && clientJurisdictionKnown({ province: "ON" }, { country: "US" }) === false);

/* ═══════════════ 6. The record carries the words ═════════════════════════ */

section("The stored record explains itself without today's rows");
const rec = recordTaxResolution(ns);
ok("placeSource is recorded", rec.placeSource === "site");
ok("the Canadian components are recorded", Array.isArray(rec.components) && rec.components[0].name === "HST" && rec.components[0].rate === 14, JSON.stringify(rec.components));
const recHead = taxLineHeadline(rec, "en");
ok("…and the headline reads from the record alone", tIn("en")(recHead.key, recHead.params) === "HST 14% (Nova Scotia)", tIn("en")(recHead.key, recHead.params));
ok("…with its source", taxLineSource(rec).key === "app.tax.source.site");
ok("a manual record: '{rate}%' and 'typed'", taxLineHeadline({ source: "manual", rate: 8 }, "en").key === "app.tax.headline.manual" && taxLineSource({ source: "manual", rate: 8 }).key === "app.tax.source.typed");
ok("a stated zero is resolved", taxLineResolved({ source: "us_company_none", rate: 0 }) === true);
ok("a company-default record (never recorded) is not a headline the record can carry", recordTaxResolution(manualOptOut) === null);

/* ═══════════════ 7. Every key, nine languages, placeholders intact ═══════ */

section("Every new string exists in all nine languages with its placeholders");
const NEW_KEYS = [
  "app.tax.headline.region", "app.tax.headline.us", "app.tax.headline.vat", "app.tax.headline.named", "app.tax.headline.default", "app.tax.headline.manual",
  "app.tax.source.site", "app.tax.source.client", "app.tax.source.clientAddress", "app.tax.source.company", "app.tax.source.default", "app.tax.source.typed",
  "app.tax.line.change", "app.tax.line.addProvince", "app.tax.line.addCompanyCountry", "app.tax.line.answerVat",
  "app.tax.blocked.resolvable", "app.tax.blocked.openDocument",
  "app.setCompany.taxModeTitle", "app.setCompany.taxModeAuto", "app.setCompany.taxModeAutoHint", "app.setCompany.taxModeManual", "app.setCompany.taxModeManualHint",
  "app.setCompany.taxPreviewLabel", "app.setCompany.taxPreviewUnknown", "app.setCompany.taxPreviewNoProvince",
  "app.setCompany.taxRatesOptional", "app.setCompany.taxRatesAutoHint", "app.setCompany.taxRatesManualHint", "app.setCompany.noTaxRatesAuto",
];
const langs = Object.keys(APP_MESSAGES);
ok("nine languages", langs.length === 9, langs.join());
for (const key of NEW_KEYS) {
  const missing = langs.filter((l) => typeof APP_MESSAGES[l][key] !== "string");
  ok(`${key} in every language`, missing.length === 0, missing.join());
  const enParams = (APP_MESSAGES.en[key].match(/\{\w+\}/g) || []).sort().join();
  const off = langs.filter((l) => ((APP_MESSAGES[l][key] || "").match(/\{\w+\}/g) || []).sort().join() !== enParams);
  ok(`  …with the same placeholders`, off.length === 0, off.join());
}

/* ═══════════════ 8. The screens read what was written ═══════════════════ */

section("The screens and routes read the mode and the site");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const bar = src("app/components/quotes/builder/QuoteTotalsBar.js");
ok("the totals bar no longer keys 'not worked out' on the amount", !/Number\(tax\) === 0/.test(bar) && /taxUnresolved/.test(bar));
ok("…and offers Change beside a settled line", /app\.tax\.line\.change/.test(bar) && /setChanging\(true\)/.test(bar));
const builder = src("app/components/quotes/builder/QuoteBuilder.js");
ok("the builder hands the job address to the resolver", /resolveDocumentTax\(\{[\s\S]*?siteAddress,/.test(builder));
ok("…and re-resolves when it changes", /\[isEdit, boot\.taxConfig, selectedClient, siteAddress,/.test(builder));
ok("the builder carries taxMode in its tax config", /taxMode: businessInfo\?\.taxMode/.test(builder));
const settings = src("app/app/settings/company/page.js");
ok("Settings → Tax writes taxMode", /taxMode: form\.taxMode/.test(settings));
ok("…shows the two modes", /app\.setCompany\.taxModeAuto/.test(settings) && /app\.setCompany\.taxModeManual/.test(settings));
ok("…and previews the company's own province through the same resolver", /resolveDocumentTax\(\{[\s\S]*?taxMode: form\.taxMode/.test(settings) && /data-tax-preview/.test(settings));
const route = src("app/api/settings/business-info/route.js");
ok("the route reads and writes taxMode", /taxMode: true/.test(route) && /taxMode: effectiveTaxMode\(company\)/.test(route) && /taxMode: cleanTaxMode/.test(route));
ok("…keeping autoApplyLocalTax in step", /autoApplyLocalTax: cleanTaxMode === "auto"/.test(route));
const quotesRoute = src("app/api/quotes/route.js");
ok("POST /api/quotes resolves against the job address", /siteAddress: siteAddressValue,/.test(quotesRoute));
const sendRoute = src("app/api/quotes/[id]/send/route.js");
ok("the send gate reads the job address", /siteAddress: quote\.siteAddress/.test(sendRoute));
const schema = src("prisma/schema.prisma");
ok("Company.taxMode is nullable with no column default", /taxMode TaxMode\?\n/.test(schema) && !/taxMode TaxMode\? @default/.test(schema));
ok("the old gate is gone from the resolver", !/if \(!company\.autoApplyLocalTax\) return fallback/.test(src("lib/tax/resolveTaxRate.js")));
for (const p of ["app/api/quotes/route.js", "app/api/invoices/route.js", "app/api/quotes/[id]/send/route.js", "app/api/invoices/[id]/send/route.js", "app/api/clients/[id]/tax-preview/route.js", "app/api/instant-quote/[companySlug]/request/route.js", "app/api/public/quotes/[token]/route.js", "app/api/portal/[token]/route.js", "lib/jobs/importPastJob.js", "app/api/quotes/[id]/kitchen/route.js"]) {
  ok(`${p} selects taxMode beside autoApplyLocalTax`, /taxMode: true/.test(src(p)));
}
ok("the public quote route strips taxMode from the company it publishes", /taxMode: _taxMode,/.test(src("app/api/public/quotes/[token]/route.js")));
ok("the portal route strips it too", /taxMode: _taxMode,/.test(src("app/api/portal/[token]/route.js")));

console.log(`\n${fail === 0 ? "PASSED" : "FAILED"} — ${pass}/${pass + fail} assertions`);
process.exit(fail === 0 ? 0 : 1);
