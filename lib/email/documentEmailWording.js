// lib/email/documentEmailWording.js
//
// The words a company may change on its document emails, and the words it
// may not.
//
// ── The problem ─────────────────────────────────────────────────────────────
//
// The quote, invoice, reminder, receipt and deposit-request emails are BUILT
// from the document (lib/email/quoteEmail.js, invoiceEmail.js): the amount,
// the scope, the process steps, the payment methods and the legal footer are
// all derived, in the document's own language, and none of it is a template.
// That is right (AGENTS.md non-negotiables 4–6: no prices from the browser,
// no machine translation at send time, one language per document) and it
// left the owner unable to SEE these emails, let alone soften a greeting:
// "I'm not able to see the quote and invoice template. They should be able to
// see it in the preview and modify it; if they start from the original
// template a new one is saved as the original will never be altered."
//
// ── The split ───────────────────────────────────────────────────────────────
//
// Each document email has exactly five WORDING SLOTS a company may rewrite —
// the sentences that are the company talking, not the document:
//
//   subject     the subject line
//   greeting    "Hi Jane,"
//   intro       the opening paragraph above the amount
//   closing     the "Questions? Reply to this email…" line in the footer
//   signature   the name line in the footer
//
// Everything else — the figure, the scope, the steps, the button label, the
// payment methods, the tax id, the "or paste this" fallback — stays derived.
// A copy holds the five slots for ONE language (a French quote must never
// read an English copy, and a copy is not translated: the company writes
// each language it wants, and a document in a language with no copy uses
// the original). The original is code, in lib/i18n/emailCopy.js, and is
// never written.
//
// ── The shape of a slot ─────────────────────────────────────────────────────
//
// A slot is a plain string with {{tokens}}. The ORIGINAL's slots are produced
// by calling emailCopy's own sentence functions with the tokens as their
// arguments — c.quoteSubject("{{companyName}}", "{{quoteNumber}}") — so the
// original in token form is, by construction, the sentence the original
// sends, in every language emailCopy has. There is no second copy of those
// sentences to drift.
//
// Nothing here touches the database. lib/email/documentEmailCopies.js loads
// and stores the copies; this file decides what a slot means.

import { emailCopy, SUPPORTED_EMAIL_LANGUAGES } from "@/lib/i18n/emailCopy";

/** The document emails a company can see and customise, in page order. */
export const DOCUMENT_EMAIL_KINDS = Object.freeze([
  // `type` is the DocumentTemplateType a copy row is filed under; `builder`
  // names which builder and which of its `kind`s renders it.
  { kind: "quote", type: "quote_email", builder: "quote", builderKind: "quote", labelKey: "app.docEmails.kindQuote" },
  { kind: "invoice", type: "invoice_email", builder: "invoice", builderKind: "invoice", labelKey: "app.docEmails.kindInvoice" },
  { kind: "reminder", type: "invoice_email", builder: "invoice", builderKind: "reminder", labelKey: "app.docEmails.kindReminder" },
  { kind: "receipt", type: "receipt_email", builder: "invoice", builderKind: "paid", labelKey: "app.docEmails.kindReceipt" },
  { kind: "deposit", type: "invoice_email", builder: "invoice", builderKind: "invoice", labelKey: "app.docEmails.kindDeposit" },
]);

export const DOCUMENT_EMAIL_KIND_KEYS = Object.freeze(DOCUMENT_EMAIL_KINDS.map((k) => k.kind));

export function documentEmailKind(kind) {
  return DOCUMENT_EMAIL_KINDS.find((k) => k.kind === kind) || null;
}

/** The five slots, in the order the editor shows them. */
export const WORDING_SLOTS = Object.freeze(["subject", "greeting", "intro", "closing", "signature"]);

/** The languages a copy may be written in: the ones the product copy is reviewed in. */
export const COPY_LANGUAGES = Object.freeze(["en", "fr", "es"]);

/**
 * The tokens a slot may use, with what fills them. `amount` is the figure
 * the email headlines (the quote total, the balance, the amount paid, the
 * stage's share) — already formatted in the company's currency by the
 * builder, so a slot can say "…for {{amount}}" without ever seeing a number
 * from the browser.
 */
export const WORDING_TOKENS = Object.freeze([
  "clientName",
  "companyName",
  "companyPhone",
  "quoteNumber",
  "invoiceNumber",
  "amount",
]);

const T = Object.fromEntries(WORDING_TOKENS.map((k) => [k, `{{${k}}}`]));

/**
 * The original's five slots, in token form, for one kind and language.
 *
 * `intro` for an invoice depends on whether a deposit was already paid, and
 * the original picks that sentence at send time from the invoice. A COPY
 * cannot — it is one paragraph — so the copy's seed is the plain sentence
 * and the partial-payment variant is a thing a company gives up by
 * customising. Said here so it is a decision and not a surprise.
 */
export function originalWording(kind, language = "en") {
  const c = emailCopy(language);
  const base = {
    greeting: c.greeting(T.clientName),
    closing: c.questions(T.companyPhone),
    signature: T.companyName,
  };
  switch (kind) {
    case "quote":
      return { ...base, subject: c.quoteSubject(T.companyName, T.quoteNumber), intro: c.quoteIntro() };
    case "invoice":
      return {
        ...base,
        subject: c.invoiceSubject(T.companyName, T.invoiceNumber, T.amount),
        intro: c.invoiceIntro(T.invoiceNumber),
      };
    case "reminder":
      return {
        ...base,
        subject: c.reminderSubject(T.amount, T.invoiceNumber),
        intro: c.reminderIntro(T.invoiceNumber, T.amount),
      };
    case "receipt":
      return {
        ...base,
        subject: c.paidSubject(T.companyName, T.invoiceNumber, T.amount),
        intro: c.paidIntro(T.invoiceNumber, T.amount),
      };
    case "deposit":
      // The deposit request IS the invoice email with a stage's share as the
      // headline figure (lib/paymentSchedule/run.js) — same sentences.
      return {
        ...base,
        subject: c.invoiceSubject(T.companyName, T.invoiceNumber, T.amount),
        intro: c.invoiceIntro(T.invoiceNumber),
      };
    default:
      return null;
  }
}

/**
 * Fill a slot's tokens. NOT HTML-escaped here — every builder escapes the
 * result where it lands (escapeHtml in the HTML, raw in the text part), the
 * same way it treats emailCopy's own sentences. An unknown token renders as
 * nothing rather than as "{{typo}}" in a homeowner's inbox.
 */
export function fillWording(slot, values = {}) {
  return String(slot ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, tok) =>
    values[tok] == null ? "" : String(values[tok]),
  );
}

/**
 * Read the five slots off a copy row's `sections`. The row stores one block,
 * { id: "wording", type: "documentWording", subject, greeting, … }, so the
 * column keeps its "array of typed blocks" shape and lib/documents/
 * templateKind.js can still tell an email row from a PDF row.
 */
export function slotsFromSections(sections) {
  const block = (Array.isArray(sections) ? sections : []).find((b) => b?.type === "documentWording");
  if (!block) return null;
  const out = {};
  for (const slot of WORDING_SLOTS) out[slot] = typeof block[slot] === "string" ? block[slot] : "";
  return out;
}

/** The inverse: five slots → the one-block `sections` array a copy row stores. */
export function sectionsFromSlots(slots = {}) {
  const block = { id: "wording", type: "documentWording" };
  for (const slot of WORDING_SLOTS) block[slot] = typeof slots[slot] === "string" ? slots[slot] : "";
  return [block];
}

/**
 * Which wording a send uses: the company's ACTIVE copy in the document's
 * language, else the original. The decision every builder's caller makes,
 * so it is one function.
 *
 * @param copy  the copy row for (kind, language), or null — `isDefault` is
 *              "Use this"; a copy that exists but is not switched on is
 *              ignored, which is what "Back to original" means.
 * @returns {{ source: "original"|"copy", slots: object|null, sentMode, canvas }}
 *          `slots: null` tells the builder to use its own sentences. `canvas`
 *          is non-null ONLY when the copy's sentMode is canvas — that is the
 *          whole of the mode decision for a document email, made here so the
 *          builders never read sentMode themselves.
 */
export function chooseWording({ copy = null } = {}) {
  if (!copy || !copy.isDefault) return { source: "original", slots: null, sentMode: "blocks", canvas: null };
  const slots = slotsFromSections(copy.sections);
  return {
    source: "copy",
    slots,
    sentMode: copy.sentMode === "canvas" && copy.canvas ? "canvas" : "blocks",
    canvas: copy.sentMode === "canvas" ? copy.canvas || null : null,
  };
}

/** Every language the original can speak — for the page's language tabs. */
export const ORIGINAL_LANGUAGES = SUPPORTED_EMAIL_LANGUAGES;
