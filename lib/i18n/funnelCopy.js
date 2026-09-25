// lib/i18n/funnelCopy.js
//
// The chrome on a public lead funnel (/f/[companySlug]/[funnelSlug] and its
// embed twin) — every word FieldQuo puts on that page around the company's own
// copy: placeholders, buttons, validation, the progress label, the estimate
// footnotes, the upload control, the fallbacks for a step the company left
// blank. The funnel's headlines, questions and answers are the company's and
// are never touched here.
//
// ══ Which language: the COMPANY's, never the visitor's ═════════════════════
//
// A funnel's copy is written once, by the contractor, in one language. There is
// no per-funnel language field and no translated copy of a funnel to switch
// to. So the only thing a visitor-driven choice (Accept-Language, a picker)
// could change is OUR chrome — and the result would be a French headline over
// an English "Your name" box, or the reverse: a page that reads as two
// companies. The rule is therefore the one the funnel's server side already
// follows, and the one the other company-written public surfaces open on:
//
//   Company.defaultLanguage → English.
//
// Precedent, so the page and its own API cannot disagree:
//   - app/api/funnels/public/[companySlug]/[funnelSlug]/route.js serves
//     `company.language` (now through funnelPageLanguage below) and prices the
//     estimate step's locked/gated wording in it;
//   - …/estimate/route.js and …/submit/route.js word the estimate the same way
//     (`company.defaultLanguage || "en"`);
//   - the self-quote form (app/quote/[companySlug]/SelfQuoteFlow.js) opens on
//     the company's primary send language, which is its defaultLanguage
//     (lib/company/sendLanguages.js sendLanguagesFor).
//
// The self-quote form ALSO shows a picker when the company sends in more than
// one language. The funnel deliberately does not follow it there: the
// self-quote's picker changes the language the resulting quote is written in
// and its chrome is ours top to bottom, whereas a funnel is mostly the
// contractor's words, and a picker here would flip only the minority of the
// page that is ours. When funnels grow per-language copy, this is the function
// that changes.
//
// ══ Where the words live ═══════════════════════════════════════════════════
//
// lib/i18n/clientDocCopy.js — the client-facing catalogue the quote page, the
// portal and the self-quote form already read, not /app's appMessages (a
// homeowner has no /app language). Strings the funnel shares with the
// self-quote form — the three contact placeholders, the upload control, the
// validation — are READ from its `selfQuote` block rather than copied, so the
// two lead forms say the same thing and a fix to one reaches both. Only what
// is funnel-specific sits in the `funnel` block. scripts/check-language-
// completeness.mjs holds both blocks key-for-key with English in every
// language.
//
// Not in here: the estimate FIGURE's grouping. estimateRange() still formats
// in the reader's own locale, as it always has — the currency is the
// company's and fixed, and Intl's per-locale currency spellings are worse
// than a foreign grouping ("CAD 1,240" for es-419, "1 240 CAD" for uk-UA,
// where the reader's own locale gives "$1,240"). A figure is not a sentence.
//
// Pure: no React, no database — the runner, the builder's preview and the
// check scripts all call it.

import { CLIENT_DOC_COPY, clientDocCopy } from "./clientDocCopy";

/**
 * The language a company's public funnel page is drawn in.
 *
 * Takes the company and nothing else on purpose: there is no argument through
 * which a visitor's browser could reach this answer.
 */
export function funnelPageLanguage(company) {
  const code = String(company?.defaultLanguage || "").toLowerCase();
  // Only a language the catalogue actually has. A code with no block would
  // fall back to English inside clientDocCopy anyway; saying "en" here keeps
  // the <html lang>-style attribute honest about what is on screen.
  return code && Object.prototype.hasOwnProperty.call(CLIENT_DOC_COPY, code) ? code : "en";
}

/**
 * Every FieldQuo-authored string the public funnel draws, for one language.
 * Flat, so a component reads `copy.submit` without knowing which block of the
 * catalogue it came from.
 */
export function funnelCopy(language = "en") {
  const doc = clientDocCopy(language);
  const sq = doc.selfQuote;
  const f = doc.funnel;
  return {
    // Shared with the self-quote form.
    back: sq.back,
    continue: sq.continueCta,
    formTitle: sq.step3Title,
    namePlaceholder: sq.namePlaceholder,
    emailPlaceholder: sq.emailPlaceholder,
    phonePlaceholder: sq.phonePlaceholder,
    errName: sq.errName,
    errContact: sq.errContact,
    errSend: sq.errSend,
    needSooner: sq.callInstead,
    upload: {
      label: sq.uploadLabel,
      hint: sq.uploadHint,
      documentLabel: sq.uploadDocumentFallback,
      busyLabel: sq.uploadBusy,
      limitLabel: sq.uploadLimit,
      failedLabel: sq.uploadFailed,
      rejectedLabel: sq.uploadRejected,
      tooLargeLabel: sq.uploadTooLarge,
      removeLabel: sq.uploadRemove,
    },
    // The instant-estimate step's title where the company left it blank —
    // the same words the estimate report opens with.
    estimateTitle: doc.rangeProposal.yourEstimate,

    // Funnel-only.
    unavailable: f.unavailable,
    progress: f.progress,
    getStarted: f.getStarted,
    submit: f.submit,
    thanks: f.thanks,
    estimateFailed: f.estimateFailed,
    minimumApplied: f.minimumApplied,
    estimateNote: f.estimateNote,
    errEmail: f.errEmail,
    /**
     * An estimate option's unit, as the pricer names it. The pricer's units
     * are English tokens ("per visit" from the lawn-mowing estimator); the
     * known ones are translated, and anything else is shown as it came,
     * because a unit we cannot name is still better than a figure with no
     * unit at all.
     */
    unit: (u) => (u === "per visit" ? f.perVisit : u),
  };
}
