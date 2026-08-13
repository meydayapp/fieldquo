// lib/selfQuote/confirmation.js
//
// What a self-quote confirmation SAYS, once, for both surfaces that say it.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The confirmation screen was four lines of plain text and there was no
// confirmation email at all. A homeowner who fills in a contractor's form and
// then receives that contractor's actual quote should recognise the second as
// coming from the first — same masthead, same "prepared for" panel, same
// ordering. Rebuilding that resemblance twice (once in React, once in email
// HTML) is the duplication class AGENTS.md warns about: the copy is the one
// that rots.
//
// So the DOCUMENT is described here, as data, and the two renderers are dumb.
// The page maps it to JSX with literal hex from documentTheme; the email maps
// it through lib/email/documentEmailLayout.js and the shared
// ClientInfoSection. Neither decides what the document contains.
//
// ── Why it is a "Request" and not a "Quote" ─────────────────────────────────
//
// Nothing here has been priced. A confirmation headed QUOTE with a reference
// number on it implies a document that exists and a figure someone agreed to,
// and the whole point of the self-quote form is that a human prices it
// afterwards. The masthead word is the honest one, and the slot a real quote
// fills with its number is filled here with the submission date — a fact,
// rather than an invented reference the company's own Leads screen could not
// look up (it searches name, email, phone and message, not ids).
//
// ── The price gate ──────────────────────────────────────────────────────────
//
// This route never computes an estimate — /api/self-quote returns no rates by
// construction (AGENTS.md non-negotiable 4). It still goes through
// publicEstimate() rather than hardcoding "no figure", so the gate is the same
// one lib/estimate/visibility.js applies everywhere else and a future caller
// that DOES have a range gets the same treatment. When it is withheld the
// document says so deliberately (`gatedNote`) instead of leaving a hole.
//
// Pure. No database, no network, no React, no HTML.

import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { publicEstimate } from "@/lib/estimate/visibility";

// Symbol for the currencies FieldQuo onboards; falls back to the ISO code so a
// stranger never reads "undefined". A rough band label, not an invoice line.
export function currencySymbol(code) {
  return (
    { USD: "$", CAD: "$", AUD: "$", NZD: "$", EUR: "€", GBP: "£", MXN: "$" }[
      code
    ] || (code ? `${code} ` : "$")
  );
}

/** The four timeline keys, keyed to lib/leads/qualifiers.js. */
export function timelineOptions(copy) {
  return [
    { key: "asap", label: copy.timelineAsap },
    { key: "2_weeks", label: copy.timeline2Weeks },
    { key: "1_3_months", label: copy.timeline1To3Months },
    { key: "exploring", label: copy.timelineExploring },
  ];
}

/** The five budget bands, with the company's currency symbol interpolated. */
export function budgetOptions(copy, symbol) {
  const s = symbol || "$";
  return [
    { key: "under_1k", label: copy.budgetUnder(s) },
    { key: "1k_5k", label: copy.budgetLow(s) },
    { key: "5k_15k", label: copy.budgetMid(s) },
    { key: "15k_plus", label: copy.budgetHigh(s) },
    { key: "unsure", label: copy.budgetUnsure },
  ];
}

// A stored key ("2_weeks") back to the sentence the homeowner picked. Returns
// null for anything unrecognised rather than echoing the raw key at them —
// "1_3_months" on a document is a leaked database value.
function labelForKey(options, key) {
  if (!key) return null;
  return options.find((o) => o.key === key)?.label || null;
}

/**
 * Turn one intake answer into a readable line.
 *
 * Falls back to a humanised key when the field definition is missing (an old
 * category, a field removed since the form was rendered), because dropping the
 * answer silently would lose something the homeowner told us.
 */
function humanise(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Compose the confirmation document.
 *
 * @param company      { name, logoUrl, brandColor, email, phone, website, currency }
 * @param contact      { name, email, phone, address } — as typed by the homeowner
 * @param service      { label, fields: [{ key, label }] } or null
 * @param details      { fieldKey: value } — the intake answers
 * @param description  the homeowner's free text
 * @param budgetBand   stored qualifier key, or null
 * @param timeline     stored qualifier key, or null
 * @param estimate     { low, high } if one was ever computed. Self-quote passes
 *                     nothing; the parameter exists so the gate is real.
 * @param visibility   "gated" | "range"
 * @param language     the language the record is being CREATED in
 * @param submittedAt  Date
 */
export function buildConfirmation({
  company = {},
  contact = {},
  service = null,
  details = null,
  description = "",
  budgetBand = null,
  timeline = null,
  estimate = null,
  visibility = "gated",
  language = "en",
  submittedAt = new Date(),
} = {}) {
  const copy = clientDocCopy(language).selfQuote;
  const labels = documentLabels(language);
  const fmt = documentFormatters(language, company.currency || "CAD");
  const symbol = currencySymbol(company.currency);

  // The masthead: the same two facts a quote puts there, honestly named.
  const masthead = {
    word: copy.documentWord,
    // The slot a quote fills with its number. See the header comment.
    referenceLabel: copy.submittedLabel,
    reference: fmt.date(submittedAt),
  };

  // Exactly the shape ClientInfoSection.renderEmailHtml expects, so the email
  // can hand it straight over rather than building a lookalike panel.
  const client = {
    name: contact.name || "",
    address: contact.address || "",
    email: contact.email || "",
    phone: contact.phone || "",
  };

  // ── What they asked for ───────────────────────────────────────────────────
  //
  // Answers only. A field the homeowner left blank is not a statement about
  // the job, and padding it with a zero or a dash would put words in their
  // mouth on a document they keep (AGENTS.md recurring failure 5).
  const fieldLabels = new Map(
    (service?.fields || []).map((f) => [f.key, f.label]),
  );

  const answers = Object.entries(
    details && typeof details === "object" ? details : {},
  )
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => ({
      label: fieldLabels.get(k) || humanise(k),
      value: String(v).replace(/_/g, " "),
    }));

  const qualifiers = [
    timeline && {
      label: copy.timelineLabel,
      value: labelForKey(timelineOptions(copy), timeline),
    },
    budgetBand && {
      label: copy.budgetLabel,
      value: labelForKey(budgetOptions(copy, symbol), budgetBand),
    },
  ].filter((q) => q && q.value);

  const requested = {
    heading: copy.requestedHeading,
    title: service?.label || null,
    lines: [...answers, ...qualifiers],
    note: String(description || "").trim() || null,
  };

  // ── The figure, or the honest absence of one ──────────────────────────────
  const pub = publicEstimate(estimate, visibility);
  const amount = pub.show
    ? {
        show: true,
        label: copy.estimateLabel,
        value: `${fmt.money(pub.low)} – ${fmt.money(pub.high)}`,
        sub: copy.beforeTax,
      }
    : { show: false, label: copy.estimateLabel, note: copy.gatedNote };

  const nextSteps = {
    heading: copy.nextHeading,
    steps: [
      { num: 1, title: copy.next1Title, body: copy.next1Body },
      { num: 2, title: copy.next2Title, body: copy.next2Body },
      { num: 3, title: copy.next3Title, body: copy.next3Body },
    ],
  };

  return {
    language,
    copy,
    labels,
    fmt,
    masthead,
    title: copy.confirmTitle,
    intro: copy.confirmIntro(company.name || ""),
    preparedForLabel: labels.preparedFor,
    client,
    requested,
    amount,
    nextSteps,
  };
}
