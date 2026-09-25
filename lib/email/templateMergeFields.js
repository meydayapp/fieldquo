// lib/email/templateMergeFields.js
//
// How the money and date {{tokens}} of a company's email template are
// written: in the company's currency, formatted the way the DOCUMENT's
// language formats them. One formatter for the follow-up cron, the editor's
// preview and the test send.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The follow-up cron had its own `money()`: a hard-coded "$" in front of
// `toLocaleString(undefined, …)`. So {{quoteTotal}} on a French quote from a
// company billing in euros read "$4,250.00" — the wrong currency sign, and
// English digit grouping, directly under a document that says "4 250,00 €".
// The dates beside it ({{dueDate}}) used the server's default locale and
// timezone, which on Vercel is en-US in UTC and on a laptop is whatever the
// laptop is. The editor preview and the test send each carried their own
// "$4,250.00" literal, so the company was shown the same wrong sign the
// homeowner got, whatever currency it had set.
//
// Now every one of them goes through documentFormatters — the formatter the
// quote email, the invoice email, the PDF and the approval page use — with the
// same two arguments: the document's language (non-negotiable 6) and the
// company's currency (language changes formatting, never the money).
//
// ── Zero is blank, as it always was ─────────────────────────────────────────
//
// The old money() returned "" for zero and for anything non-numeric, so
// "{{discount}}" on a quote with no discount prints nothing rather than a
// "$0.00 discount" the document never states. That behaviour is kept on
// purpose: this change is about which currency and which language, and a
// template written against "blank when nil" must not start printing zeros.
//
// Pure, no I/O, no server-only import: the template editor (a client
// component) builds its preview from sampleMergeData below.

import { documentFormatters } from "@/lib/i18n/documentLabels";
import { sampleTemplateLines, SAMPLE_TOTALS } from "@/lib/email/templateLineItems";

/**
 * The formatters a template's {{tokens}} are written with.
 *
 * @param language  the document's language (Quote.language / Invoice.language),
 *                  or the client's for a send with no document — the caller
 *                  resolves it with lib/i18n/clientLanguage.js
 * @param currency  the company's currency (Company.currency; null → CAD, the
 *                  same default documentFormatters applies everywhere else)
 */
export function mergeFormatters({ language = "en", currency = null } = {}) {
  const f = documentFormatters(language || "en", currency);
  return {
    locale: f.locale,
    money(value) {
      if (value === null || value === undefined || value === "") return "";
      const n = Number(value);
      if (!Number.isFinite(n) || n === 0) return "";
      return f.money(n);
    },
    // Calendar dates read as UTC — documentFormatters' own note on why a
    // due date formatted in the server's zone lands a day early.
    date(value) {
      if (!value) return "";
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? "" : f.date(d);
    },
  };
}

// ── The sample the editor preview and the test send draw ────────────────────
//
// Words first: names, numbers and links are not translated, so they are
// plain strings. Every token here must be one a real send path fills —
// scripts/check-follow-up-flow.mjs reads this literal and fails on an orphan
// (the old "$1,275.00" depositAmount lived in a fixture exactly like this).
const SAMPLE_WORDS = {
  clientName: "Jane Doe",
  clientAddress: "123 Maple Street, Toronto, ON",
  clientPhone: "(416) 555-0142",
  quoteNumber: "Q-1042",
  quoteUrl: "https://example.com/quote/preview",
  invoiceNumber: "INV-1042",
  invoiceUrl: "https://example.com/invoice/preview",
  jobTitle: "Kitchen Cabinet Refinishing",
};

// Figures, as numbers, so they are formatted per language and currency rather
// than stored with a "$" in front. They agree with the itemised sample
// (SAMPLE_TOTALS: 3,900 − 150 + 500 = 4,250), and 3,000 paid leaves 1,250.
const SAMPLE_AMOUNTS = {
  quoteTotal: SAMPLE_TOTALS.total,
  invoiceTotal: SAMPLE_TOTALS.total,
  subtotal: SAMPLE_TOTALS.subtotal,
  discount: SAMPLE_TOTALS.discount,
  tax: SAMPLE_TOTALS.tax,
  amountPaid: 3000,
  balanceDue: SAMPLE_TOTALS.total - 3000,
};

const SAMPLE_DATES = {
  dueDate: "2026-08-01T00:00:00Z",
  projectStartDate: "2026-07-28T00:00:00Z",
  projectEndDate: "2026-07-30T00:00:00Z",
};

/**
 * Every sample token, formatted for one language and currency, plus the
 * itemised block's sample lines in the same pair.
 *
 * The caller adds what it knows better (the real company name, the
 * template's progress stage).
 */
export function sampleMergeData({ language = "en", currency = null } = {}) {
  const fmt = mergeFormatters({ language, currency });
  const out = { ...SAMPLE_WORDS };
  for (const [k, v] of Object.entries(SAMPLE_AMOUNTS)) out[k] = fmt.money(v);
  for (const [k, v] of Object.entries(SAMPLE_DATES)) out[k] = fmt.date(v);
  out.lineItems = sampleTemplateLines({ language, currency });
  return out;
}

/** The token names the sample fills — for the orphan check. */
export const SAMPLE_TOKENS = Object.freeze([
  ...Object.keys(SAMPLE_WORDS),
  ...Object.keys(SAMPLE_AMOUNTS),
  ...Object.keys(SAMPLE_DATES),
]);
