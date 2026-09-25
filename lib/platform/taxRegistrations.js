// lib/platform/taxRegistrations.js
//
// Where FieldQuo has to register to charge tax on its OWN subscriptions, and
// how close each place is — the /platform/billing/tax page. Stripe Billing
// only: this is FieldQuo selling to companies. What a contractor charges a
// homeowner (lib/tax/*) is a different sale, in the contractor's name, and
// nothing here reads or changes it.
//
// ══ The mechanism is Stripe Tax, and this file does not compete with it ══════
//
// The owner, 2026-09-24: UK 20% VAT (reverse charge only with a VAT number),
// EU the buyer's country rate (reverse charge with a VAT ID), Australia 10%
// GST, USA nothing for now, Canada as today — "charged within the system".
//
// Every subscription Checkout already sends automatic_tax, a required
// billing address and tax-ID collection (lib/platform/stripeBilling.js
// SUBSCRIPTION_TAX), and plan changes carry automatic_tax forward. With those,
// Stripe Tax does exactly what was decided — per Stripe's own documentation,
// read 2026-09-25:
//
//   · UK: "Tax isn't charged on sales to business customers who provide their
//     VAT identification number"; everyone else pays UK VAT.
//     (docs.stripe.com/tax/supported-countries/europe/collect-tax, United
//     Kingdom)
//   · EU: "If your customer is eligible for a reverse charge and provides
//     their European VAT number in Stripe, we treat their transactions as a
//     reverse charge"; digital services are otherwise taxed at the customer's
//     country rate. (docs.stripe.com/tax/supported-countries/european-union)
//   · Australia: "No tax is charged on sales to business customers who provide
//     their Australian Business Register (ABN) number"; 10% GST otherwise.
//     (docs.stripe.com/tax/supported-countries/asia-pacific/collect-tax,
//     Australia)
//
// BUT only where a registration has been ADDED in Stripe: "Adding your
// registrations allows Stripe to calculate and collect the taxes you're
// responsible for remitting" (docs.stripe.com/tax/registering). With none,
// Stripe charges nothing there. So the missing piece was never a tax engine —
// building one beside Stripe's would compute a second number for the same
// invoice — it is knowing WHEN to add each registration. That is this file.
//
// One deviation from the owner's sentence, and it is the law rather than a
// choice: "Australia 10% GST" becomes 10% GST for customers WITHOUT an ABN.
// An Australian business that gives its ABN is charged none — the ATO does
// not count sales to GST-registered businesses toward a non-resident's
// threshold and the supply is not taxable to the offshore seller. Stripe
// applies that automatically; the page says so.
//
// ══ The thresholds, for a seller established OUTSIDE all three ═══════════════
//
// FieldQuo is a Canadian business. The familiar thresholds are for sellers
// established in the place, and do not apply to it:
//
//   UK  £90,000 is for UK-based businesses. "You must also register
//       (regardless of taxable turnover) if … your business is based outside
//       the UK [and] you supply any goods or services to the UK" — HMRC, "When
//       to register for VAT" (gov.uk/vat-registration/when-to-register).
//       Sales to VAT-registered UK businesses are reverse-charged and are not
//       taxable supplies by FieldQuo, so the trigger is the first sale to a
//       UK customer who gives no VAT number (Stripe's UK page: "Threshold: 1
//       transaction … that reverse charge doesn't apply to").
//   EU  €10,000 applies only where "the supplier is established … in only
//       one Member State" — European Commission, VAT One Stop Shop
//       (vat-one-stop-shop.ec.europa.eu/one-stop-shop_en). A seller outside
//       the EU has none: the first sale to an EU customer without a VAT ID.
//       The non-Union OSS scheme is one registration, in one member state of
//       FieldQuo's choice, covering all 27.
//   AU  A$75,000 of sales connected with Australia in the past 12 months, or
//       expected in the next 12, counting only sales to customers who are NOT
//       GST-registered businesses — ATO, "GST on imported services and
//       digital products"; Stripe's Australia page says the same.
//
// These are facts about the law as of 2026-09-25 and are cited so they can be
// re-checked, not trusted. Nothing here is tax advice, and the page says to
// confirm with an adviser before registering.

import { isBilledBucket, isTrialingBucket } from "./subscriberBuckets.js";

/** EU-27. The non-Union OSS registration covers every one of them. */
export const EU_COUNTRIES = Object.freeze([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);
const EU = new Set(EU_COUNTRIES);

/**
 * One row per place the owner decided to charge tax in (plus the two he
 * decided about differently, so the page answers for every subscriber).
 *
 * threshold.amount is in threshold.currency; 0 means "the first taxable sale".
 * stripeType is the value the Stripe dashboard's "Add registration" asks for
 * (docs.stripe.com/tax/registering, "Registration types").
 */
export const REGISTRATION_REGIONS = Object.freeze([
  {
    key: "GB",
    label: "United Kingdom",
    countries: ["GB"],
    tax: "VAT 20%",
    charge: true,
    threshold: { amount: 0, currency: "GBP", window: "none — from the first sale to a customer without a UK VAT number" },
    reverseCharge: "UK VAT number given at checkout → no VAT (reverse charge)",
    stripeType: "standard",
    stripeSteps: "Stripe → Tax → Locations → Add registration → United Kingdom → Standard → “I’ve already registered” → VAT number and start date.",
    authority: "HMRC — register as a non-established taxable person (VAT1)",
    sources: [
      { label: "HMRC: When to register for VAT", url: "https://www.gov.uk/vat-registration/when-to-register" },
      { label: "Stripe Tax: United Kingdom", url: "https://docs.stripe.com/tax/supported-countries/europe/collect-tax?tax-jurisdiction-europe=united-kingdom" },
    ],
    note: "£90,000 is the threshold for UK-based businesses only. HMRC also says you must register if you have reasonable grounds to expect a taxable UK sale within 30 days — so a UK trial without a VAT number that is about to convert counts.",
  },
  {
    key: "EU",
    label: "European Union (27)",
    countries: EU_COUNTRIES,
    tax: "VAT at the customer's country rate",
    charge: true,
    threshold: { amount: 0, currency: "EUR", window: "none for a seller outside the EU — from the first sale to a customer without a VAT ID" },
    reverseCharge: "EU VAT ID given at checkout → no VAT (reverse charge)",
    stripeType: "oss_non_union",
    stripeSteps: "Register for the non-Union One Stop Shop in one EU country of your choice, then Stripe → Tax → Locations → Add registration → that country → One Stop Shop, non-Union scheme.",
    authority: "Any one EU member state's OSS portal (non-Union scheme)",
    sources: [
      { label: "European Commission: One Stop Shop", url: "https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en" },
      { label: "Stripe Tax: European Union", url: "https://docs.stripe.com/tax/supported-countries/european-union" },
    ],
    note: "The €10,000 EU threshold applies only to sellers established in one EU member state. FieldQuo is not.",
  },
  {
    key: "AU",
    label: "Australia",
    countries: ["AU"],
    tax: "GST 10%",
    charge: true,
    threshold: { amount: 75000, currency: "AUD", window: "past 12 months, or expected in the next 12 — sales to customers without an ABN only" },
    reverseCharge: "ABN given at checkout → no GST (the ATO does not tax, or count, sales to GST-registered businesses)",
    stripeType: "simplified",
    stripeSteps: "Register for simplified GST (non-resident) with the ATO, then Stripe → Tax → Locations → Add registration → Australia → Simplified.",
    authority: "ATO — simplified GST registration for non-residents",
    sources: [
      { label: "ATO: GST on imported services and digital products", url: "https://www.ato.gov.au/businesses-and-organisations/international-tax-for-business/gst-for-non-resident-businesses/gst-on-imported-services-and-digital-products" },
      { label: "Stripe Tax: Australia", url: "https://docs.stripe.com/tax/supported-countries/asia-pacific/collect-tax?tax-jurisdiction-asia-pacific=australia" },
    ],
    note: "Australian companies are billed in AUD (the same numbers as the ladder), so the 12-month figure is compared in AUD with no conversion.",
  },
  {
    key: "US",
    label: "United States",
    countries: ["US"],
    tax: "None for now",
    charge: false,
    threshold: null,
    reverseCharge: null,
    stripeType: null,
    stripeSteps: null,
    authority: null,
    sources: [],
    note: "The owner, 2026-09-24: no US tax on FieldQuo's subscription for now. Stripe's own Tax → Locations monitoring still watches state thresholds.",
  },
  {
    key: "CA",
    label: "Canada",
    countries: ["CA"],
    tax: "As today",
    charge: true,
    threshold: null,
    reverseCharge: null,
    stripeType: "standard",
    stripeSteps: null,
    authority: null,
    sources: [],
    note: "FieldQuo's home country — collected under the registrations already in Stripe. Unchanged by this page.",
  },
]);

/** Which region row a country code belongs to, or null. */
export function regionForCountry(country) {
  const code = String(country || "").trim().toUpperCase();
  const iso = code === "UK" ? "GB" : code;
  if (!/^[A-Z]{2}$/.test(iso)) return null;
  if (EU.has(iso)) return "EU";
  const hit = REGISTRATION_REGIONS.find((r) => r.countries.includes(iso));
  return hit ? hit.key : null;
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Tally Stripe invoices (paid, last 12 months) into regions.
 *
 * Reads the invoice's own snapshot — `customer_address.country` and
 * `customer_tax_ids` — because that is what Stripe Tax decided on, not the
 * company's settings today. An invoice with a tax ID is the reverse-charge
 * case: counted, but not as a taxable sale. Amounts stay in their own
 * currency; nothing is converted.
 *
 * @param invoices  [{ amount_paid (cents), currency, customer_address: {country}, customer_tax_ids: [] }]
 */
export function tallyInvoices(invoices) {
  const out = {};
  for (const inv of Array.isArray(invoices) ? invoices : []) {
    const region = regionForCountry(inv?.customer_address?.country);
    if (!region) continue;
    const row = (out[region] ||= { invoices: 0, withTaxId: 0, taxable: {}, reverseCharge: {} });
    const cur = String(inv?.currency || "").toUpperCase() || "?";
    const amount = (Number(inv?.amount_paid) || 0) / 100;
    const hasTaxId = Array.isArray(inv?.customer_tax_ids) && inv.customer_tax_ids.some((t) => t && t.value);
    row.invoices++;
    if (hasTaxId) {
      row.withTaxId++;
      row.reverseCharge[cur] = round2((row.reverseCharge[cur] || 0) + amount);
    } else {
      row.taxable[cur] = round2((row.taxable[cur] || 0) + amount);
    }
  }
  return out;
}

/**
 * Tally companies (from FieldQuo's own rows) into regions: paying, trialling,
 * and the run-rate of the paying ones per currency — the "expected in the
 * next 12 months" half of Australia's test.
 *
 * Paying and trialling are the dashboard's buckets, read off `c.bucket`
 * (lib/platform/trialCounting.js subscriberBucket, attached by the route):
 * paying = the Paying or Past-due bucket, trialling = either trial bucket.
 * This used to re-derive both from the status and trialEndsAt right here, a
 * third copy of the rule beside the companies page's and the dashboard's.
 * The classifier is not called from here so this file stays pure (it reads
 * lib/billing/access.js, which imports the database); a row with no bucket
 * is refused by name rather than guessed at.
 *
 * @param companies [{ bucket, country, subscription: { billingInterval,
 *                    plan: { priceMonthly, priceAnnual, currency } } }]
 */
export function tallyCompanies(companies, now = new Date()) {
  const out = {};
  const unplaced = { paying: 0, trialling: 0, countries: {} };
  for (const c of Array.isArray(companies) ? companies : []) {
    if (!c) continue;
    if (c.bucket === undefined) {
      throw new Error("tallyCompanies: company.bucket is missing — classify the rows with subscriberBucket first");
    }
    const paying = isBilledBucket(c.bucket);
    const trialling = isTrialingBucket(c.bucket);
    if (!paying && !trialling) continue;
    const region = regionForCountry(c.country);
    if (!region) {
      if (paying) unplaced.paying++;
      else unplaced.trialling++;
      const key = String(c.country || "(none)");
      unplaced.countries[key] = (unplaced.countries[key] || 0) + 1;
      continue;
    }
    const row = (out[region] ||= { paying: 0, trialling: 0, annualRunRate: {}, countries: {} });
    if (paying) {
      row.paying++;
      const plan = c.subscription?.plan;
      const yearly =
        c.subscription?.billingInterval === "year" && Number(plan?.priceAnnual) > 0
          ? Number(plan.priceAnnual)
          : Number(plan?.priceMonthly) * 12;
      if (Number.isFinite(yearly) && yearly > 0) {
        const cur = String(plan?.currency || "?").toUpperCase();
        row.annualRunRate[cur] = round2((row.annualRunRate[cur] || 0) + yearly);
      }
    } else {
      row.trialling++;
    }
    const cc = String(c.country).trim().toUpperCase();
    row.countries[cc] = (row.countries[cc] || 0) + 1;
  }
  return { regions: out, unplaced };
}

/**
 * Which regions Stripe is already collecting in, from the Tax Registrations
 * API's list (active or scheduled). Only the registration types that make
 * Stripe collect on FieldQuo's sales count for a region: an EU standard
 * registration in one country covers that country only, so it does NOT mark
 * the EU row registered — only oss_non_union does.
 *
 * @param registrations [{ country, status, country_options: { [cc]: { type } } }]
 * @returns {{ [regionKey]: { status, country, type } }}
 */
export function registeredRegions(registrations) {
  const out = {};
  for (const r of Array.isArray(registrations) ? registrations : []) {
    const status = r?.status;
    if (status !== "active" && status !== "scheduled") continue;
    const cc = String(r?.country || "").toUpperCase();
    const opts = r?.country_options?.[cc.toLowerCase()] || {};
    const type = opts.type || null;
    const region = regionForCountry(cc);
    if (!region) continue;
    if (region === "EU" && type !== "oss_non_union") continue;
    // Active beats scheduled when both exist.
    if (out[region]?.status === "active") continue;
    out[region] = { status, country: cc, type };
  }
  return out;
}

/**
 * The verdict for one region.
 *
 *   registered       Stripe has an active or scheduled registration
 *   register_now     a taxable sale has happened (UK/EU), or Australia's
 *                    12-month figure — past or run-rate — is at the threshold
 *   approaching      UK/EU: only trials so far, which become taxable sales on
 *                    their first charge; AU: at 80% of the threshold
 *   not_yet          customers, nothing near a threshold
 *   no_customers     nobody here
 *   not_charged      the owner decided not to charge here (US)
 *   home             Canada — as today
 *   unknown          the invoices could not be read, and nothing else can
 *                    say whether a taxable sale happened
 */
export function regionVerdict(region, { invoices = null, companies = null, registration = null } = {}) {
  if (region.key === "US") return "not_charged";
  if (region.key === "CA") return "home";
  if (registration) return "registered";
  const paying = companies?.paying || 0;
  const trialling = companies?.trialling || 0;
  if (!invoices && !paying && !trialling) return "no_customers";

  if (region.threshold?.amount === 0) {
    if (invoices) {
      const taxableCount = invoices.invoices - invoices.withTaxId;
      if (taxableCount > 0) return "register_now";
    } else if (paying > 0) {
      // Invoices unreadable: a paying customer here may be a taxable sale.
      return "unknown";
    }
    // A trial is a sale waiting for its first charge, and nobody knows yet
    // whether the card will come with a VAT number — HMRC's "reasonable
    // grounds to believe" within 30 days is exactly this.
    if (trialling > 0) return "approaching";
    // Paying, or paid in the window, and every invoice reverse-charged:
    // nothing taxable yet. (A customer who has since cancelled still sold
    // here — "no customers" would hide the history.)
    if (paying > 0 || (invoices?.invoices || 0) > 0) return "not_yet";
    return "no_customers";
  }

  // Australia: past 12 months of taxable (no-ABN) sales, or the run-rate.
  const cur = region.threshold.currency;
  const past = invoices?.taxable?.[cur] || 0;
  const expected = companies?.annualRunRate?.[cur] || 0;
  const figure = Math.max(past, expected);
  if (figure >= region.threshold.amount) return "register_now";
  if (figure >= region.threshold.amount * 0.8) return "approaching";
  if (!invoices && paying > 0) return "unknown";
  return paying || trialling ? "not_yet" : "no_customers";
}

export const VERDICT_LABELS = Object.freeze({
  registered: "Registered in Stripe — collecting",
  register_now: "Register now, then add it in Stripe",
  approaching: "Approaching — prepare the registration",
  not_yet: "Not yet",
  no_customers: "No customers here",
  not_charged: "Not charged (owner decision)",
  home: "Home country — as today",
  unknown: "Unknown — Stripe invoices could not be read",
});

/**
 * The whole page: one row per region, each with its figures, verdict and —
 * when there is something to do — the checklist line.
 */
export function registrationReport({ invoices = null, companies = [], registrations = null, now = new Date() } = {}) {
  const inv = invoices ? tallyInvoices(invoices) : null;
  const { regions: co, unplaced } = tallyCompanies(companies, now);
  const reg = registrations ? registeredRegions(registrations) : {};
  const rows = REGISTRATION_REGIONS.map((region) => {
    const invoiceTally = inv ? inv[region.key] || { invoices: 0, withTaxId: 0, taxable: {}, reverseCharge: {} } : null;
    const companyTally = co[region.key] || { paying: 0, trialling: 0, annualRunRate: {}, countries: {} };
    const registration = reg[region.key] || null;
    const verdict = regionVerdict(region, { invoices: invoiceTally, companies: companyTally, registration });
    return {
      ...region,
      invoices: invoiceTally,
      companies: companyTally,
      registration,
      verdict,
      verdictLabel: VERDICT_LABELS[verdict],
      todo: verdict === "register_now" || verdict === "approaching" ? region.stripeSteps : null,
    };
  });
  return { rows, unplaced, invoicesRead: Boolean(invoices), registrationsRead: Boolean(registrations) };
}
