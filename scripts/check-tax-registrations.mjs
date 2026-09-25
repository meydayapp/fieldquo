// scripts/check-tax-registrations.mjs
//
//   npm run check:tax-registrations
//
// Executes lib/platform/taxRegistrations.js — the /platform/billing/tax page's
// reasoning about where FieldQuo must register to charge tax on its OWN
// subscriptions — against fixtures shaped like Stripe's invoice and tax
// registration objects and FieldQuo's company rows. Also holds the Checkout
// builders to the mechanism the page relies on: automatic_tax, a required
// billing address and tax-ID collection on every subscription Checkout, and
// a Stripe currency taken from the PLAN row.

import fs from "node:fs";
import {
  regionForCountry,
  tallyInvoices,
  tallyCompanies,
  registeredRegions,
  regionVerdict,
  registrationReport,
  REGISTRATION_REGIONS,
  EU_COUNTRIES,
} from "@/lib/platform/taxRegistrations";
// The tally reads the dashboard's bucket off each row (it is attached by the
// route from the one classifier), so the fixtures are classified by the same
// function rather than labelled by hand.
import { subscriberBucket } from "@/lib/platform/trialCounting";

let checks = 0;
let failures = 0;
function ok(label, cond, detail = "") {
  checks++;
  if (cond) return;
  failures++;
  console.log(`  ✗ ${label}${detail !== "" ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}
const region = (key) => REGISTRATION_REGIONS.find((r) => r.key === key);

console.log("\nCountries land in the right row");
ok("GB → GB", regionForCountry("GB") === "GB");
ok("UK (hand-typed) → GB", regionForCountry("uk") === "GB");
ok("every EU-27 code → EU", EU_COUNTRIES.every((c) => regionForCountry(c) === "EU") && EU_COUNTRIES.length === 27);
ok("AU → AU", regionForCountry("au") === "AU");
ok("US → US, CA → CA", regionForCountry("US") === "US" && regionForCountry("CA") === "CA");
ok("Norway and Switzerland are NOT the EU", regionForCountry("NO") === null && regionForCountry("CH") === null);
ok("junk is nobody's", [null, "", "ZZZ", "__proto__", 12, "E U"].every((v) => regionForCountry(v) === null));

console.log("\nThe thresholds are FieldQuo's, not a local seller's");
ok("UK: from the first taxable sale (non-established seller), not £90,000", region("GB").threshold.amount === 0);
ok("EU: from the first taxable sale (seller outside the EU), not €10,000", region("EU").threshold.amount === 0);
ok("AU: A$75,000", region("AU").threshold.amount === 75000 && region("AU").threshold.currency === "AUD");
ok("every charged region cites a primary source and Stripe", ["GB", "EU", "AU"].every((k) => region(k).sources.length >= 2 && region(k).sources.every((s) => /^https:\/\//.test(s.url))));
ok("the Stripe registration types are the ones Stripe names", region("GB").stripeType === "standard" && region("EU").stripeType === "oss_non_union" && region("AU").stripeType === "simplified");
ok("the US is not charged (owner decision)", region("US").charge === false);

console.log("\nInvoices: taxable vs reverse-charged, never converted");
const INV = [
  { amount_paid: 9900, currency: "usd", customer_address: { country: "GB" }, customer_tax_ids: [] },
  { amount_paid: 16900, currency: "usd", customer_address: { country: "GB" }, customer_tax_ids: [{ type: "gb_vat", value: "present" }] },
  { amount_paid: 26900, currency: "usd", customer_address: { country: "DE" }, customer_tax_ids: [{ type: "eu_vat", value: "present" }] },
  { amount_paid: 9900, currency: "aud", customer_address: { country: "AU" }, customer_tax_ids: [] },
  { amount_paid: 9900, currency: "usd", customer_address: { country: "AU" }, customer_tax_ids: [] },
  { amount_paid: 36900, currency: "aud", customer_address: { country: "AU" }, customer_tax_ids: [{ type: "au_abn", value: "present" }] },
  { amount_paid: 9900, currency: "cad", customer_address: { country: "CA" }, customer_tax_ids: [] },
  { amount_paid: 9900, currency: "usd", customer_address: null, customer_tax_ids: [] },
  { amount_paid: 9900, currency: "usd", customer_address: { country: "NZ" }, customer_tax_ids: [] },
  null,
];
const inv = tallyInvoices(INV);
ok("GB: one taxable US$99, one reverse-charged US$169", inv.GB.invoices === 2 && inv.GB.withTaxId === 1 && inv.GB.taxable.USD === 99 && inv.GB.reverseCharge.USD === 169, inv.GB);
ok("DE lands in EU, reverse-charged", inv.EU.invoices === 1 && inv.EU.withTaxId === 1 && !inv.EU.taxable.USD, inv.EU);
ok("AU keeps AUD and USD apart", inv.AU.taxable.AUD === 99 && inv.AU.taxable.USD === 99 && inv.AU.reverseCharge.AUD === 369, inv.AU);
ok("an invoice with no address or outside the rows is not placed", !inv.NZ && Object.keys(inv).sort().join() === "AU,CA,EU,GB");
ok("an empty tax-ID value is not a tax ID", tallyInvoices([{ amount_paid: 100, currency: "usd", customer_address: { country: "GB" }, customer_tax_ids: [{ type: "gb_vat", value: "" }] }]).GB.withTaxId === 0);

console.log("\nCompanies: paying, trialling, run-rate");
const NOW = new Date("2026-09-25T12:00:00Z");
const future = "2026-10-20T00:00:00Z";
const past = "2026-09-01T00:00:00Z";
const CO = [
  { country: "AU", trialEndsAt: null, subscription: { status: "active", billingInterval: "month", plan: { priceMonthly: 99, priceAnnual: 990, currency: "AUD" } } },
  { country: "AU", trialEndsAt: null, subscription: { status: "active", billingInterval: "year", plan: { priceMonthly: 369, priceAnnual: 3690, currency: "AUD" } } },
  { country: "AU", trialEndsAt: null, subscription: { status: "trialing", plan: { priceMonthly: 99, currency: "AUD" } } },
  { country: "AU", subscription: null, trialEndsAt: future },
  { country: "AU", subscription: null, trialEndsAt: past },
  { country: "AU", isDemo: true, trialEndsAt: null, subscription: { status: "active", plan: { priceMonthly: 99, currency: "AUD" } } },
  { country: "GB", subscription: null, trialEndsAt: future },
  { country: "NZ", trialEndsAt: null, subscription: { status: "active", plan: { priceMonthly: 99, currency: "USD" } } },
  { country: null, trialEndsAt: null, subscription: { status: "active", plan: { priceMonthly: 99, currency: "CAD" } } },
  { country: "IE", trialEndsAt: null, subscription: { status: "canceled", plan: { priceMonthly: 99, currency: "USD" } } },
  // A failed payment still inside its grace window is billed; one whose grace
  // ran out is locked and in neither column.
  { country: "CA", trialEndsAt: null, subscription: { status: "past_due", pastDueSince: "2026-09-23T00:00:00Z", plan: { priceMonthly: 99, currency: "CAD" } } },
  { country: "DE", trialEndsAt: null, subscription: { status: "past_due", pastDueSince: "2026-08-01T00:00:00Z", plan: { priceMonthly: 99, currency: "EUR" } } },
].map((c) => ({ ...c, bucket: subscriberBucket(c, NOW) }));
const { regions: co, unplaced } = tallyCompanies(CO, NOW);
let unclassified = null;
try {
  tallyCompanies([{ country: "AU", subscription: null, trialEndsAt: future }], NOW);
} catch (err) {
  unclassified = err;
}
ok("a row with no bucket is refused by name, not guessed at", /bucket is missing/.test(String(unclassified?.message)));
ok("a past-due company inside its grace is paying; one past it is not counted", co.CA?.paying === 1 && !co.EU, { CA: co.CA, EU: co.EU });
ok("AU: two paying, two trialling (demo and an ended trial left out)", co.AU.paying === 2 && co.AU.trialling === 2, co.AU);
ok("AU run-rate: 99×12 + the annual 3,690", co.AU.annualRunRate.AUD === 99 * 12 + 3690, co.AU.annualRunRate);
ok("GB: one card-free trial", co.GB.trialling === 1 && co.GB.paying === 0);
ok("a cancelled company is in no column", !co.EU);
ok("NZ and no-country are 'everywhere else'", unplaced.paying === 2 && unplaced.countries.NZ === 1 && unplaced.countries["(none)"] === 1, unplaced);

console.log("\nRegistrations: only the ones that make Stripe collect");
const REG = [
  { country: "IE", status: "active", country_options: { ie: { type: "standard" } } },
  { country: "GB", status: "expired", country_options: { gb: { type: "standard" } } },
  { country: "AU", status: "scheduled", country_options: { au: { type: "simplified" } } },
];
const reg = registeredRegions(REG);
ok("an Irish STANDARD registration does not cover the EU", !reg.EU);
ok("an expired UK registration does not count", !reg.GB);
ok("a scheduled AU registration counts", reg.AU?.status === "scheduled" && reg.AU.type === "simplified");
ok("non-Union OSS in any member state covers the EU", registeredRegions([{ country: "NL", status: "active", country_options: { nl: { type: "oss_non_union" } } }]).EU?.type === "oss_non_union");
ok("junk registrations are ignored", Object.keys(registeredRegions([null, {}, { country: "ZZ", status: "active" }])).length === 0);

console.log("\nVerdicts");
const blankInv = { invoices: 0, withTaxId: 0, taxable: {}, reverseCharge: {} };
ok("UK: one sale without a VAT number → register now", regionVerdict(region("GB"), { invoices: inv.GB, companies: { paying: 1, trialling: 0 } }) === "register_now");
ok("UK: only reverse-charged sales → not yet", regionVerdict(region("GB"), { invoices: { invoices: 1, withTaxId: 1, taxable: {}, reverseCharge: { USD: 99 } }, companies: { paying: 1, trialling: 0 } }) === "not_yet");
ok("UK: a trial only → approaching (30-day rule)", regionVerdict(region("GB"), { invoices: blankInv, companies: co.GB }) === "approaching");
ok("UK: invoices unreadable and someone paying → unknown, not 'not yet'", regionVerdict(region("GB"), { invoices: null, companies: { paying: 1, trialling: 0 } }) === "unknown");
ok("UK: nobody → no customers", regionVerdict(region("GB"), { invoices: blankInv, companies: { paying: 0, trialling: 0 } }) === "no_customers");
ok("a registration beats every figure", regionVerdict(region("GB"), { invoices: inv.GB, companies: { paying: 9 }, registration: { status: "active" } }) === "registered");
const au = (taxableAud, runRate = 0, extra = {}) =>
  regionVerdict(region("AU"), { invoices: { invoices: 1, withTaxId: 0, taxable: { AUD: taxableAud, ...extra }, reverseCharge: {} }, companies: { paying: 1, trialling: 0, annualRunRate: { AUD: runRate } } });
ok("AU: A$59,999 → not yet", au(59999) === "not_yet");
ok("AU: A$60,000 (80%) → approaching", au(60000) === "approaching");
ok("AU: A$75,000 → register now", au(75000) === "register_now");
ok("AU: a run-rate of A$75,000 → register now (the 'expected' test)", au(1000, 75000) === "register_now");
ok("AU: US$200,000 is not counted as AUD — nothing is converted", au(1000, 0, { USD: 200000 }) === "not_yet");
ok("US: not charged", regionVerdict(region("US"), { invoices: blankInv, companies: { paying: 50 } }) === "not_charged");
ok("CA: home", regionVerdict(region("CA"), { invoices: blankInv, companies: { paying: 50 } }) === "home");

console.log("\nThe whole report");
const rep = registrationReport({ invoices: INV, companies: CO, registrations: REG, now: NOW });
const byKey = Object.fromEntries(rep.rows.map((r) => [r.key, r]));
ok("one row per region", rep.rows.length === REGISTRATION_REGIONS.length);
ok("GB → register now, with the checklist", byKey.GB.verdict === "register_now" && /United Kingdom/.test(byKey.GB.todo || ""));
ok("EU → not yet (the only sale was reverse-charged)", byKey.EU.verdict === "not_yet", byKey.EU.verdict);
ok("AU → registered (scheduled)", byKey.AU.verdict === "registered" && !byKey.AU.todo);
ok("no checklist where nothing is due", !byKey.US.todo && !byKey.CA.todo);
const blind = registrationReport({ invoices: null, companies: CO, registrations: null, now: NOW });
ok("Stripe unreadable: flagged as not read, never as zero", blind.invoicesRead === false && blind.rows.find((r) => r.key === "AU").invoices === null);

console.log("\nThe mechanism the page relies on is really in Checkout");
const billing = fs.readFileSync("lib/platform/stripeBilling.js", "utf8");
const taxBlock = /const SUBSCRIPTION_TAX = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(billing)?.[1] || "";
ok("automatic_tax is enabled", /automatic_tax:\s*\{\s*enabled:\s*true\s*\}/.test(taxBlock));
ok("a billing address is required (Stripe Tax needs it)", /billing_address_collection:\s*"required"/.test(taxBlock));
ok("tax IDs are collected (the reverse charge needs them)", /tax_id_collection:\s*\{\s*enabled:\s*true\s*\}/.test(taxBlock));
ok("both subscription Checkouts spread it", (billing.match(/\.\.\.SUBSCRIPTION_TAX/g) || []).length === 2);
ok("both Checkouts take the currency from the plan row", (billing.match(/const currency = planStripeCurrency\(plan, company\)/g) || []).length === 2);
ok("no Checkout builds its currency from company.currency any more", !/const currency = stripeCurrency\(company\.currency\)/.test(billing));

// planStripeCurrency itself, executed. Imported late: stripeBilling pulls the
// database and Stripe clients, which the stub loader supplies.
const { planStripeCurrency } = await import("@/lib/platform/stripeBilling");
ok("a ladder row sells in its own currency (GB company, USD row)", planStripeCurrency({ tierKey: "solo", currency: "USD" }, { currency: "GBP" }) === "usd");
ok("an AUD row sells in AUD", planStripeCurrency({ tierKey: "crew", currency: "AUD" }, { currency: "AUD" }) === "aud");
ok("a legacy row (no tierKey) keeps the company's currency, as before", planStripeCurrency({ tierKey: null, currency: "CAD" }, { currency: "USD" }) === "usd");

console.log(`\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} assertions`);
process.exit(failures ? 1 : 0);
