// lib/compliance/taxRegistration.js
//
// What a contractor's tax registration is CALLED where they work, whether the
// number belongs on an invoice there, and one plain sentence saying why.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// lib/documents/taxId.js already prints the number on the quote, the invoice,
// the PDF, the covering email and the portal. But nothing ever ASKED for it.
// A contractor could run for months issuing invoices with no registration
// number on them, and only hear about it from a client's bookkeeper. So the
// number gets asked for during onboarding — and the ask has to use the words
// the contractor actually uses. "Tax ID" is what a database calls it. A
// Canadian says GST/HST number, a Brit says VAT number.
//
// ── What this file will NOT claim ──────────────────────────────────────────
//
// FieldQuo does not register anyone, file anything, or make anyone compliant.
// It prints a number on a document. Every sentence below is phrased around
// what the CLIENT needs to see, never around the contractor's standing with a
// tax authority.
//
// In particular: **the United States has no federal requirement to show an
// EIN, a resale certificate, or a sales-tax permit number on an invoice.**
// Some states require specific wording when sales tax is charged; none of them
// require the registration number itself on the document. Marked OPTIONAL.
// Inventing a US requirement to make the table look symmetrical would be a lie
// told to every American contractor on the platform.
//
// ── Why Mexico and Brazil are not in this file ─────────────────────────────
//
// They were, briefly, and they were removed on purpose. Do not add them back
// as two more rows — that is the shape this comment exists to prevent.
//
// Neither country invoices by putting a number on a document. Mexico requires
// invoices to be issued as CFDI: XML, stamped through the SAT or an authorised
// PAC, with a UUID the client's own accounting expects to reconcile against.
// Brazilian service invoices are NFS-e, issued electronically and administered
// per MUNICIPALITY — thousands of them, each with its own portal, schema and
// authorisation flow. A FieldQuo PDF carrying an RFC or a CNPJ is a commercial
// document. It is not a CFDI and it is not an NFS-e, and no amount of config
// in this file changes that.
//
// So a row here would have captured a number, ticked a step, and left the
// contractor believing something had been handled that had not — a control
// that appears to work and doesn't, with a tax authority attached. Supporting
// those markets means integrating a local e-invoicing provider (a PAC in
// Mexico; a municipal gateway aggregator in Brazil), issuing and storing the
// fiscal document, and handling cancellation — a phase of work, not a config
// entry. Until that exists, MX and BR fall through to the generic profile
// below, which asks for nothing, asserts nothing about their law, and can be
// dismissed.
//
// ── No format validation, deliberately ─────────────────────────────────────
//
// There is no regex here and there must not be one. A GST/HST number has an
// RT suffix, sometimes typed with spaces and sometimes not; EU VAT numbers
// vary by member state and change format when a country reforms them.
// Rejecting a valid number costs the contractor the compliance the field
// exists to give them. A typo costs them one correction. The asymmetry is not
// close.

/**
 * Profiles, keyed by a short slug. Several countries share one — the EU VAT
 * story is genuinely the same story in 27 places, and duplicating it 27 times
 * would only create 27 sentences to drift apart.
 *
 * required — is showing the number on an invoice a requirement in that
 *            jurisdiction FOR A REGISTERED BUSINESS? (Nobody is required to
 *            show a number they don't have; every sentence is written to start
 *            from "if you are registered".)
 */
export const TAX_REGISTRATION_PROFILES = {
  ca: {
    nameKey: "app.taxReg.name.ca",
    whyKey: "app.taxReg.why.ca",
    required: true,
  },
  // No federal invoice-content rule. See the header.
  us: {
    nameKey: "app.taxReg.name.us",
    whyKey: "app.taxReg.why.us",
    required: false,
  },
  gb: {
    nameKey: "app.taxReg.name.gb",
    whyKey: "app.taxReg.why.gb",
    required: true,
  },
  // EU member states: the VAT identification number the supply was made under
  // is one of the particulars a VAT invoice has to carry.
  eu: {
    nameKey: "app.taxReg.name.eu",
    whyKey: "app.taxReg.why.eu",
    required: true,
  },
  // Norway and Iceland are in the EEA but OUTSIDE the EU VAT area — their own
  // national VAT law applies, not the EU directive. Same practical outcome for
  // a contractor, different reason, so the sentence doesn't cite the directive.
  no: {
    nameKey: "app.taxReg.name.no",
    whyKey: "app.taxReg.why.eea",
    required: true,
  },
  is: {
    nameKey: "app.taxReg.name.is",
    whyKey: "app.taxReg.why.eea",
    required: true,
  },
  // Liechtenstein is in a customs and VAT union with Switzerland, so it gets
  // the Swiss profile rather than an EEA one.
  ch: {
    nameKey: "app.taxReg.name.ch",
    whyKey: "app.taxReg.why.ch",
    required: true,
  },
  au: {
    nameKey: "app.taxReg.name.au",
    whyKey: "app.taxReg.why.au",
    required: true,
  },
  nz: {
    nameKey: "app.taxReg.name.nz",
    whyKey: "app.taxReg.why.nz",
    required: true,
  },
  // The fallback, and the landing place for Mexico and Brazil (see header).
  // Says nothing about any particular country's law, because we either know
  // nothing about it or know that printing a number is not how it works there.
  // Absence of a statement is not a statement.
  generic: {
    nameKey: "app.taxReg.name.generic",
    whyKey: "app.taxReg.why.generic",
    required: false,
  },
};

/**
 * ISO-3166 alpha-2 → profile slug.
 *
 * Covers what lib/currency.js already claims (CA, US, GB, AU, NZ, IE, FR, DE,
 * ES, NL, CH) plus the rest of the EU/EEA that Stripe supports. Countries
 * beyond the currency list cost nothing here because they share a profile — and
 * a company can type its way to any of them if the signup country list grows.
 *
 * MX and BR are deliberately absent; see the header before adding them.
 */
const COUNTRY_PROFILE = {
  CA: "ca",
  US: "us",
  GB: "gb",
  AU: "au",
  NZ: "nz",
  CH: "ch",
  LI: "ch", // Swiss VAT union
  NO: "no",
  IS: "is",
  // EU-27
  AT: "eu", BE: "eu", BG: "eu", CY: "eu", CZ: "eu", DE: "eu", DK: "eu",
  EE: "eu", ES: "eu", FI: "eu", FR: "eu", GR: "eu", HR: "eu", HU: "eu",
  IE: "eu", IT: "eu", LT: "eu", LU: "eu", LV: "eu", MT: "eu", NL: "eu",
  PL: "eu", PT: "eu", RO: "eu", SE: "eu", SI: "eu", SK: "eu",
};

/**
 * The registration profile for a country code.
 *
 * Never throws and never returns undefined: an unknown, blank or malformed
 * country gets the generic profile, which asks for nothing and asserts
 * nothing. A lookup that threw would take the dashboard down over a bad
 * two-letter string.
 *
 * @param {string} country ISO-3166 alpha-2, any case, possibly null.
 * @returns {{
 *   profile: string, nameKey: string, whyKey: string,
 *   required: boolean, dismissible: boolean,
 * }}
 */
export function taxRegistrationFor(country) {
  const code = String(country || "").trim().toUpperCase();
  const slug = COUNTRY_PROFILE[code] || "generic";
  const p = TAX_REGISTRATION_PROFILES[slug];

  return {
    profile: slug,
    nameKey: p.nameKey,
    whyKey: p.whyKey,
    required: p.required,
    // Can the contractor tell us to stop asking?
    //
    // Only where the number is OPTIONAL. A sole trader under the registration
    // threshold has no number to give, and nagging them forever for something
    // that does not exist is the "step that can never be completed" the
    // onboarding card must never contain.
    //
    // Where it is required, the step stays: that is precisely where the client
    // cannot claim the tax back without it, and letting the ask be waved away
    // would be the product quietly taking the contractor's side against their
    // own customer.
    dismissible: !p.required,
  };
}
