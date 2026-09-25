// app/components/auth/samples/sampleCompany.js
//
// The company every signup sample is drawn for: the visitor's own words where
// they have typed them, and the fixture company's (the app-guide harness,
// docs/screens/app-guide/harness/fixtures) for everything a stranger has not
// told us yet — the client, the quote number, the dates, the week.
//
// Two rules:
//
//   · The brand is FieldQuo-neutral (`brandColor: null` → documentTheme's
//     default ink). The signup never asks for a colour, and painting their
//     documents in a colour they did not pick — the fixture's green, or one
//     guessed from the company name — would be a claim about their brand.
//   · Nothing is padded. A phone they have not typed is not printed; the
//     real templates already leave an empty field out, so passing "" is what
//     makes the sample honest about what they have and have not given.
//
// Pure: no React, no network — scripts/check-signup-aside.mjs executes it.

import { COMPANY, CLIENT, QUOTE } from "@/docs/screens/app-guide/harness/fixtures/company.js";

export { CLIENT as SAMPLE_CLIENT, QUOTE as SAMPLE_QUOTE, COMPANY as FIXTURE_COMPANY };

/** The name as typed, or the placeholder that says it is one. */
export function companyNameOf(form, placeholder) {
  const name = String(form?.companyName || "").trim();
  return name || placeholder || "";
}

/** The currencies a sample may print in — what the signup's address resolved to, else the fixture's. */
export function sampleCurrency(currency) {
  return ["USD", "CAD", "AUD"].includes(currency) ? currency : COMPANY.currency;
}

/**
 * The company, in the shape the document builders read (lib/email/
 * quoteEmail.js, the /q page's `company`), with every optional-section
 * switch present and off — buildQuoteEmail asserts those keys are loaded.
 */
export function sampleCompany(form, { placeholder = "", currency = null } = {}) {
  const f = form || {};
  const address = [f.city, f.province].filter(Boolean).join(", ");
  return {
    name: companyNameOf(f, placeholder),
    logoUrl: null,
    brandColor: null,
    brandColors: null,
    email: String(f.email || "").trim(),
    phone: String(f.phone || "").trim(),
    website: f.hasWebsite === true ? String(f.website || "").trim() : "",
    address,
    province: f.province || "",
    country: f.country || "",
    currency: sampleCurrency(currency),
    taxIdName: null,
    taxIdNumber: null,
    paymentTerms: null,
    paymentMethods: [],
    defaultLanguage: f.language || "en",
    defaultProcessNotes: null,
    quoteEmailReferences: null,
    quoteEmailBeforeAfter: null,
    quoteEmailIncludeReferences: false,
    quoteEmailIncludeBeforeAfter: false,
  };
}

/**
 * The quote's priced lines. The trade's own two seed services at the price a
 * company in that trade starts with, when the signup has fetched them and
 * BOTH carry a price; otherwise the fixture company's own quote (Q-1042, the
 * cabinet maker's kitchen), whose figures are real sample figures for that
 * work. `fromTrade` says which, so the panel can say so.
 *
 * @returns {{ fromTrade: boolean, lines: [{ name, description, quantity, unitPrice, total }] }}
 */
export function sampleLines(trade) {
  const services = Array.isArray(trade?.services) ? trade.services : [];
  const priced = services.length > 0 && services.every((s) => Number(s?.price) > 0);
  if (priced) {
    return {
      fromTrade: true,
      lines: services.map((s) => ({ name: s.name, description: s.description || "", quantity: 1, unitPrice: Number(s.price), total: Number(s.price) })),
    };
  }
  return {
    fromTrade: false,
    lines: QUOTE.items.map((it) => ({ name: it.name, description: it.description || "", quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })),
  };
}

/** Subtotal, tax at `ratePct` (null → none charged), total — rounded to the cent. */
export function sampleTotals(lines, ratePct) {
  const subtotal = Math.round(lines.reduce((sum, l) => sum + Number(l.total || 0), 0) * 100) / 100;
  const rate = Number(ratePct);
  const tax = Number.isFinite(rate) && rate > 0 ? Math.round(subtotal * rate) / 100 : 0;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100, ratePct: tax ? rate : null };
}
