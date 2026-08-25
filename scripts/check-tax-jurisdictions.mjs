// scripts/check-tax-jurisdictions.mjs
//
// Executes lib/tax/jurisdictions.js and lib/tax/resolveTaxRate.js against real
// and hostile input.
//
//   npm run check:tax-jurisdictions
//
// A wrong tax rate is not a rendering bug — it is a number a homeowner is
// billed and a contractor has to honour. Every assertion below is about the
// resolver refusing to invent one.

import {
  CANADA_RATES,
  US_STATE_BASE_RATES,
  VAT_RATES,
  lookupCanadianRate,
  lookupUsStateBase,
  lookupVatRate,
  lookupJurisdictionRate,
  normaliseCountry,
  supportedCountryOptions,
} from "@/lib/tax/jurisdictions";
import { resolveTaxRate, explainTaxSource } from "@/lib/tax/resolveTaxRate";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let failures = 0;
let checks = 0;

function ok(label, condition, detail = "") {
  checks++;
  if (condition) return;
  failures++;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n${title}`);
}

/* ── 1. Canada: components must sum to the stated total ─────────────────── */

section("Canada — every province and territory");

const EXPECTED_CA = {
  AB: 5, BC: 12, MB: 12, NB: 15, NL: 15, NS: 14, NT: 5,
  NU: 5, ON: 13, PE: 15, QC: 14.975, SK: 11, YT: 5,
};

ok(
  "all 13 provinces and territories present",
  Object.keys(CANADA_RATES).length === 13,
  `got ${Object.keys(CANADA_RATES).length}`,
);

for (const [code, expected] of Object.entries(EXPECTED_CA)) {
  const r = lookupCanadianRate(code);
  ok(`${code} resolves`, r.status === "known", r.reason);
  if (r.status !== "known") continue;

  ok(`${code} rate is ${expected}%`, r.rate === expected, `got ${r.rate}`);

  // The headline assertion: a stored total that disagrees with its own parts
  // is a number nobody can reconcile against a tax return.
  const sum = r.components.reduce((a, c) => a + c.rate, 0);
  ok(
    `${code} components sum to the total`,
    Math.abs(sum - r.rate) < 1e-9,
    `components ${sum} vs total ${r.rate}`,
  );

  ok(`${code} cites a source`, typeof r.source === "string" && r.source.length > 10);
  ok(
    `${code} has an effective date`,
    /^\d{4}-\d{2}-\d{2}$/.test(r.effectiveFrom || ""),
    r.effectiveFrom,
  );
}

// Every period of every province, not just the one in force today — the
// historical rows exist so a back-dated quote reconciles, and a typo in one
// would only ever surface on a document somebody had already sent.
for (const [code, entry] of Object.entries(CANADA_RATES)) {
  for (const p of entry.periods) {
    const sum = p.components.reduce((a, c) => a + c.rate, 0);
    ok(
      `${code} period from ${p.effectiveFrom} sums correctly`,
      Math.abs(sum - p.total) < 1e-9,
      `components ${sum} vs total ${p.total}`,
    );
  }
}

section("Canada — effective dates are honoured, not ignored");

// Nova Scotia cut its HST on 1 Apr 2025. A quote written before that must
// still explain 15%, and a date before the data starts must return nothing at
// all rather than today's number wearing a historical date.
ok(
  "NS on 2024-06-01 returns the old 15%",
  lookupCanadianRate("NS", "2024-06-01").rate === 15,
  String(lookupCanadianRate("NS", "2024-06-01").rate),
);
ok(
  "NS today returns 14%",
  lookupCanadianRate("NS", "2026-08-01").rate === 14,
);
ok(
  "NS in 1998 returns unknown, not the oldest rate we happen to hold",
  lookupCanadianRate("NS", "1998-01-01").status === "unknown",
);
ok(
  "an unparseable date returns unknown rather than defaulting to today",
  lookupCanadianRate("ON", "not-a-date").status === "unknown",
);

/* ── 2. Unknown and ambiguous resolve to unknown, never to 0 ────────────── */

section("Unknown is unknown — never 0%");

const noCountry = lookupJurisdictionRate({ clientRegion: "ON" });
ok(
  "a province with no country is unknown, not Ontario",
  noCountry.status === "unknown" && noCountry.reason === "no_client_country",
  JSON.stringify(noCountry),
);
ok("...and carries no rate at all", noCountry.rate === undefined);

ok(
  "an unrecognised region in a known country is unknown",
  lookupJurisdictionRate({ clientCountry: "CA", clientRegion: "ZZ" }).status ===
    "unknown",
);
ok(
  "a country we hold no table for is unsupported, not 'no country'",
  lookupJurisdictionRate({ clientCountry: "JP", clientRegion: "13" }).reason ===
    "unsupported_country",
);
ok(
  "an EU client with no known supplier country refuses rather than using the client's rate",
  lookupJurisdictionRate({ clientCountry: "FR", clientRegion: "75" }).reason ===
    "supplier_country_unknown",
);

/* ── 3. A company's own rate beats the library ──────────────────────────── */

section("The contractor's own rates win");

const companyWithRates = {
  autoApplyLocalTax: true,
  taxRate: 5,
  country: "CA",
};
const ontarioClient = { name: "Test", province: "ON", country: "CA" };

const configured = resolveTaxRate({
  company: companyWithRates,
  // Deliberately NOT 13. If the library ever overruled this, the assertion
  // below would read 13 and the contractor's own number would be gone.
  taxRates: [{ name: "HST Ontario", rate: 11.5 }],
  client: ontarioClient,
});
ok(
  "a named company rate wins over the published one",
  configured.rate === 11.5 && configured.source === "client_province",
  JSON.stringify(configured),
);

const unconfigured = resolveTaxRate({
  company: companyWithRates,
  taxRates: [],
  client: ontarioClient,
});
ok(
  "with no company rate, the published Ontario rate fills the gap",
  unconfigured.rate === 13 && unconfigured.source === "jurisdiction_ca",
  JSON.stringify(unconfigured),
);

const optedOut = resolveTaxRate({
  company: { ...companyWithRates, autoApplyLocalTax: false },
  taxRates: [],
  client: ontarioClient,
});
ok(
  "the opt-out switch turns the whole library off",
  optedOut.rate === 5 && optedOut.source === "company_default",
  JSON.stringify(optedOut),
);

const noCountryClient = resolveTaxRate({
  company: companyWithRates,
  taxRates: [],
  client: { name: "Legacy", province: "ON", country: null },
});
ok(
  "a legacy client with no country keeps the company default, not 0",
  noCountryClient.rate === 5 &&
    noCountryClient.source === "unknown_no_client_country",
  JSON.stringify(noCountryClient),
);

/* ── 4. The United States never presents a state rate as the rate ───────── */

section("United States — a base is not a rate");

for (const code of Object.keys(US_STATE_BASE_RATES)) {
  const r = lookupUsStateBase(code);
  ok(`${code} never returns status "known"`, r.status === "base_only", r.status);
  ok(`${code} exposes no field called "rate"`, r.rate === undefined);
  ok(`${code} always carries the local-tax caution`, Boolean(r.cautionKey));
}

const ohio = resolveTaxRate({
  company: { autoApplyLocalTax: true, taxRate: 7, country: "US" },
  taxRates: [],
  client: { name: "Test", province: "OH", country: "US" },
});
ok(
  "an Ohio client does NOT get Ohio's 5.75% state base in the tax box",
  ohio.rate === 7 && ohio.rate !== 5.75,
  JSON.stringify(ohio),
);
ok(
  "...the state figure is offered as guidance instead",
  ohio.source === "us_state_base_only" && ohio.detail?.stateRate === 5.75,
);
ok("...with a caution attached", Boolean(ohio.cautionKey));

// A state with no sales tax must not read as "we don't know".
const oregon = lookupUsStateBase("OR");
ok(
  "Oregon's 0% is stated as a base with a note, not silently dropped",
  oregon.status === "base_only" && oregon.stateRate === 0 && oregon.note,
);

/* ── 5. Europe — the reduced rate, and the registration gate ────────────── */

section("Europe — VAT");

const nlCompany = { country: "NL", vatRegistered: true };

const nlStandard = lookupVatRate({ ...nlCompany });
ok(
  "a Dutch registered company gets the 21% standard rate",
  nlStandard.status === "known" && nlStandard.rate === 21,
  JSON.stringify(nlStandard),
);

const nlReno = lookupVatRate({ ...nlCompany, workType: "renovation" });
ok(
  "...and 9% once the work is declared a renovation",
  nlReno.rate === 9 && nlReno.appliedReduced === true,
  JSON.stringify(nlReno),
);
ok(
  "...with the qualifying conditions attached, not just a number",
  Boolean(nlReno.reducedConditionKey),
);

// Denmark operates no reduced rates at all. A renovation there must stay at
// 25% rather than quietly borrowing a neighbour's reduced rate.
const dkReno = lookupVatRate({
  country: "DK",
  vatRegistered: true,
  workType: "renovation",
});
ok(
  "a Danish renovation stays at the standard 25% — Denmark has no reduced rate",
  dkReno.rate === 25 && dkReno.appliedReduced === false,
  JSON.stringify(dkReno),
);

// Sweden's ROT is a tax credit, not a reduced rate. Null must be explained.
const se = lookupVatRate({ country: "SE", vatRegistered: true, workType: "renovation" });
ok(
  "Sweden charges the full 25% and names the ROT scheme instead",
  se.rate === 25 && se.reducedRate === null && Boolean(se.schemeNoteKey),
  JSON.stringify(se),
);

const notRegistered = lookupVatRate({ country: "IE", vatRegistered: false });
ok(
  "a company below the threshold charges nothing, and says why",
  notRegistered.status === "not_registered" &&
    notRegistered.rate === 0 &&
    Boolean(notRegistered.cautionKey),
  JSON.stringify(notRegistered),
);

const neverAsked = lookupVatRate({ country: "IE", vatRegistered: null });
ok(
  "an unanswered VAT question is unknown — NOT 0 and NOT the standard rate",
  neverAsked.status === "unknown" && neverAsked.reason === "vat_status_unknown",
  JSON.stringify(neverAsked),
);
ok("...and returns no rate to apply", neverAsked.rate === undefined);

// The twist: for B2C services the SUPPLIER's country decides.
const crossBorder = lookupJurisdictionRate({
  companyCountry: "NL",
  vatRegistered: true,
  clientCountry: "BE",
  clientRegion: "Brussels",
});
ok(
  "a Dutch firm quoting a Belgian homeowner charges Dutch VAT, not Belgian",
  crossBorder.country === "NL" && crossBorder.rate === 21,
  JSON.stringify(crossBorder),
);

const unregisteredThroughResolver = resolveTaxRate({
  company: { autoApplyLocalTax: true, taxRate: 20, country: "IE", vatRegistered: false },
  taxRates: [],
  client: { name: "Test", province: "Dublin", country: "IE" },
});
ok(
  "through the resolver: not registered means 0%, deliberately",
  unregisteredThroughResolver.rate === 0 &&
    unregisteredThroughResolver.source === "vat_not_registered",
  JSON.stringify(unregisteredThroughResolver),
);

const unansweredThroughResolver = resolveTaxRate({
  company: { autoApplyLocalTax: true, taxRate: 20, country: "IE", vatRegistered: null },
  taxRates: [],
  client: { name: "Test", province: "Dublin", country: "IE" },
});
ok(
  "through the resolver: unanswered falls back to the company's own 20%",
  unansweredThroughResolver.rate === 20 &&
    unansweredThroughResolver.source === "unknown_vat_status_unknown",
  JSON.stringify(unansweredThroughResolver),
);

/* ── 6. Hostile input ───────────────────────────────────────────────────── */

section("Hostile input never yields a rate");

// Prototype keys. `CANADA_RATES.__proto__` and `.constructor` are truthy on any
// plain object, so a naive `TABLE[key]` lookup would sail straight through and
// then throw (or worse, half-succeed) on `.periods`.
const PROTO_KEYS = ["__proto__", "constructor", "prototype", "toString", "valueOf", "hasOwnProperty"];
for (const key of PROTO_KEYS) {
  ok(`CA lookup rejects "${key}"`, lookupCanadianRate(key).status === "unknown");
  ok(`US lookup rejects "${key}"`, lookupUsStateBase(key).status === "unknown");
  ok(
    `VAT lookup rejects "${key}"`,
    lookupVatRate({ country: key, vatRegistered: true }).status === "unknown",
  );
  ok(
    `country normaliser rejects "${key}"`,
    lookupJurisdictionRate({ clientCountry: key, clientRegion: key }).status ===
      "unknown",
  );
}

// Wrong types. None of these may throw, and none may produce a number.
const JUNK = [null, undefined, 0, 13, NaN, Infinity, true, false, {}, [], [["ON"]], () => "ON", Symbol("ON")];
for (const value of JUNK) {
  const shown = typeof value === "symbol" ? "Symbol" : JSON.stringify(value) ?? String(value);
  let caResult, vatResult, dispatch;
  try {
    caResult = lookupCanadianRate(value);
    vatResult = lookupVatRate({ country: value, vatRegistered: true });
    dispatch = lookupJurisdictionRate({ clientCountry: value, clientRegion: value });
  } catch (err) {
    ok(`junk region ${shown} does not throw`, false, err.message);
    continue;
  }
  ok(`junk region ${shown} → unknown (CA)`, caResult.status === "unknown");
  ok(`junk country ${shown} → unknown (VAT)`, vatResult.status === "unknown");
  ok(`junk input ${shown} → unknown (dispatch)`, dispatch.status === "unknown");
  ok(`junk input ${shown} carries no rate`, dispatch.rate === undefined);
}

// Whitespace and case ARE normalised, and that is a decision rather than an
// oversight: the existing normaliseProvince has always lowercased and trimmed,
// Google Places emits mixed case, and refusing "on" while accepting "ON" would
// reject a correct address. What must never happen is the pair below diverging
// from each other, or either resolving WITHOUT a country.
for (const messy of ["ON ", " on", "on", "oN", "\tON\n"]) {
  ok(
    `"${messy.replace(/\s/g, "·")}" normalises to Ontario when the country says Canada`,
    lookupJurisdictionRate({ clientCountry: "CA", clientRegion: messy }).rate === 13,
  );
  // The real ambiguity was never the whitespace — it is the missing country.
  ok(
    `"${messy.replace(/\s/g, "·")}" alone yields nothing without a country`,
    lookupJurisdictionRate({ clientRegion: messy }).status === "unknown",
  );
}

// Country codes are two letters, strictly. "Canada" is not a country code, and
// accepting it would mean guessing at strings nobody validated.
for (const value of ["Canada", "CAN", "C", "", "  ", "ca1", "12", "ON "]) {
  const norm = normaliseCountry(value);
  ok(
    `country "${value}" normalises to a 2-letter code or null`,
    norm === null || /^[A-Z]{2}$/.test(norm),
    String(norm),
  );
}
ok("lowercase country codes are accepted", normaliseCountry("ca") === "CA");
ok("padded country codes are accepted", normaliseCountry("  nl ") === "NL");

// The resolver must survive being handed nothing at all — it runs on every
// keystroke in the quote builder, before a client is picked.
for (const args of [undefined, {}, { company: null }, { client: null }, { taxRates: null }]) {
  let out;
  try {
    out = resolveTaxRate(args);
  } catch (err) {
    ok(`resolveTaxRate(${JSON.stringify(args)}) survives`, false, err.message);
    continue;
  }
  ok(
    `resolveTaxRate(${JSON.stringify(args)}) returns a numeric rate`,
    Number.isFinite(out.rate),
    JSON.stringify(out),
  );
}

/* ── 7. Every string the resolver can produce is translatable ───────────── */

section("Every reachable message has en and fr");

const REACHABLE_SOURCES = [
  "client_province", "jurisdiction_ca", "jurisdiction_vat", "vat_not_registered",
  "us_state_base_only", "unknown_no_client_country", "unknown_unknown_region",
  "unknown_supplier_country_unknown", "unknown_vat_status_unknown",
  "unknown_unsupported_country", "unknown_no_data_for_date",
];

for (const source of REACHABLE_SOURCES) {
  const msg = explainTaxSource({ source, label: "X", rate: 1, detail: {} }, { name: "Y" });
  ok(`source "${source}" maps to a message key`, Boolean(msg?.key), source);
  if (!msg) continue;
  ok(`  ${msg.key} exists in en`, msg.key in APP_MESSAGES.en);
  ok(`  ${msg.key} exists in fr`, msg.key in APP_MESSAGES.fr);
}

// Every cautionKey, reducedConditionKey and schemeNoteKey in the data tables
// has to exist too — a key that reaches the screen with no catalogue entry
// renders as the raw key, which is how "app.tax.caution.pstRealProperty"
// ends up printed on a contractor's screen.
const DATA_KEYS = new Set();
for (const entry of Object.values(CANADA_RATES)) {
  if (entry.cautionKey) DATA_KEYS.add(entry.cautionKey);
}
for (const code of Object.keys(US_STATE_BASE_RATES)) {
  DATA_KEYS.add(lookupUsStateBase(code).cautionKey);
}
for (const entry of Object.values(VAT_RATES)) {
  if (entry.reducedConditionKey) DATA_KEYS.add(entry.reducedConditionKey);
  if (entry.schemeNoteKey) DATA_KEYS.add(entry.schemeNoteKey);
}
DATA_KEYS.add("app.tax.caution.vatNotRegistered");
DATA_KEYS.add("app.tax.vatChoice.title");
DATA_KEYS.add("app.tax.vatChoice.standard");
DATA_KEYS.add("app.tax.vatChoice.reduced");
DATA_KEYS.add("app.field.country");
DATA_KEYS.add("app.field.countryNotSet");

for (const key of DATA_KEYS) {
  ok(`${key} in en`, key in APP_MESSAGES.en);
  ok(`${key} in fr`, key in APP_MESSAGES.fr);
}

section("Jurisdiction names follow the reader's language");

// "we'll use 's published rate" — the unknown branches carry the name on
// `detail`, not on `label`, and reading only the top-level one left a hole in
// the middle of the sentence.
const holeCheck = explainTaxSource(
  resolveTaxRate({
    company: { autoApplyLocalTax: true, taxRate: 18, country: "NL", vatRegistered: null },
    taxRates: [],
    client: { name: "Bram", country: "NL" },
  }),
  { name: "Bram" },
);
ok(
  "the VAT-unknown note names the country instead of leaving a gap",
  holeCheck.params.label === "Netherlands",
  JSON.stringify(holeCheck.params),
);

ok(
  "French names the Netherlands Pays-Bas",
  lookupVatRate({ country: "NL", vatRegistered: true, lang: "fr" }).label === "Pays-Bas",
);
ok(
  "French names British Columbia Colombie-Britannique",
  lookupCanadianRate("BC", new Date(), "fr").label === "Colombie-Britannique",
);
ok(
  "French keeps Ontario as Ontario — no labelFr means same in both",
  lookupCanadianRate("ON", new Date(), "fr").label === "Ontario",
);
ok(
  "English is unaffected",
  lookupCanadianRate("BC").label === "British Columbia",
);
ok(
  "an unknown language falls back to English rather than blanking the name",
  lookupCanadianRate("QC", new Date(), "pa").label === "Quebec",
);
ok(
  "the resolver threads the language through",
  resolveTaxRate({
    company: { autoApplyLocalTax: true, taxRate: 0, country: "CA" },
    taxRates: [],
    client: { name: "Marie", province: "QC", country: "CA" },
    lang: "fr",
  }).label === "Québec",
);

// A labelFr that matched its English label would be dead weight pretending to
// be a translation.
for (const table of [CANADA_RATES, VAT_RATES]) {
  for (const [code, entry] of Object.entries(table)) {
    ok(
      `${code} labelFr, if present, actually differs from label`,
      !entry.labelFr || entry.labelFr !== entry.label,
      entry.labelFr,
    );
  }
}

/* ── 8. Table hygiene ───────────────────────────────────────────────────── */

section("Table hygiene");

for (const [code, entry] of Object.entries(VAT_RATES)) {
  ok(`${code} has a standard rate`, typeof entry.standard === "number" && entry.standard > 0);
  ok(
    `${code} reduced rate is a number or an explicit null`,
    entry.constructionReduced === null || typeof entry.constructionReduced === "number",
  );
  ok(
    `${code} reduced rate is below the standard one`,
    entry.constructionReduced === null || entry.constructionReduced < entry.standard,
    `${entry.constructionReduced} vs ${entry.standard}`,
  );
  // A reduced rate with no stated conditions would be applied by a contractor
  // who has no way to know whether the job qualifies.
  ok(
    `${code} states the conditions whenever it offers a reduced rate`,
    entry.constructionReduced === null || Boolean(entry.reducedConditionKey),
  );
  ok(`${code} cites a source`, typeof entry.source === "string" && entry.source.length > 10);
  ok(
    `${code} has an effective date`,
    /^\d{4}-\d{2}-\d{2}$/.test(entry.effectiveFrom || ""),
  );
}

for (const [code, entry] of Object.entries(US_STATE_BASE_RATES)) {
  ok(`${code} has a numeric state rate`, typeof entry.stateRate === "number");
  ok(`${code} rate is plausible (0–15%)`, entry.stateRate >= 0 && entry.stateRate <= 15);
}
ok("all 50 states plus DC", Object.keys(US_STATE_BASE_RATES).length === 51);

const options = supportedCountryOptions();
ok("every supported country has a display name", options.every((o) => o.label && o.label !== o.code));
ok(
  "the picker is sorted by name",
  options.every((o, i) => i === 0 || options[i - 1].label.localeCompare(o.label) <= 0),
);

/* ── Report ─────────────────────────────────────────────────────────────── */

console.log(
  `\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} assertions`,
);
process.exit(failures ? 1 : 0);
