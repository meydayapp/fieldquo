// app/(marketing)/industries/[slug]/showcase/showcaseLanguage.js
//
// The walk-through in the visitor's language — as far as the product itself
// goes, and no further.
//
// ══ Two languages on one page, on purpose ═════════════════════════════════
//
// SITE language (the marketing switcher, nine of them): the section's own
// words, FieldQuo's app screens in steps 2–4 (their catalogues are in eight),
// and Summit Ridge's tagline on the company card.
//
// DOCUMENT language: what the homeowner's pages and the draft are written in.
// The real instant-quote form, its estimate report and the draft it creates
// exist in English, French and Spanish only (lib/i18n/instantQuoteCopy.js
// INSTANT_QUOTE_LANGUAGES), and a quote keeps the language it was created in
// (non-negotiable #6). So a visitor reading in French or Spanish gets the
// form, the report, the draft and the quote page in their language; one
// reading in German, Ukrainian, Punjabi, Tagalog, Italian or Chinese gets
// them in English, and step 1 says why (formLanguageNote). Rendering those
// pages in a language the product cannot produce would show a homeowner page
// that does not exist — the one thing this showcase must not do.
//
// The sample company is treated as WRITING in the document language: its
// company language, its saved option names and its own words (About, the
// process, the acknowledgements, the insurance document) are the ones for
// that language (./summitRidgeContent.js), so a French visitor's draft reads
// "Toiture", not "Roofing", and its quote page carries the French About.
//
// Pure: no React. The fixture is never mutated.

import { instantQuoteLanguage } from "@/lib/i18n/instantQuoteCopy";
import { summitRidgeContentFor } from "./summitRidgeContent";

/** The language the homeowner's pages and the draft are in, for a site language. */
export function documentLanguageFor(siteLanguage) {
  return instantQuoteLanguage(siteLanguage) || "en";
}

/**
 * What the company shows beside its documents, in `language` — the proposal
 * sections the client quote page and the estimate report draw
 * (lib/proposal/load.js projectProposal's shape) and the waivers attached to
 * the quote (loadQuoteWaivers' shape). Words from ./summitRidgeContent.js.
 * No testimonials: a fictional company's reviews would be fabricated, so the
 * section is off rather than filled.
 */
export function showcasePresentation(language = "en") {
  const c = summitRidgeContentFor(language);
  const half = Math.ceil(c.waivers.length / 2);
  // WaiverSign pairs one box with each section, and a waiver carries at most
  // five boxes (lib/company/documents.js WAIVER_MAX_ACKNOWLEDGEMENTS), so the
  // owner's ten acknowledgements are two documents of five.
  const waiver = (items, n) => ({
    token: `sample-waiver-${n}`,
    title: c.waiverTitle.replace("{n}", String(n)),
    sections: items.map((w) => ({ heading: w.title, text: w.text })),
    acknowledgements: items.map((w) => w.title),
    status: "pending",
    signedAt: null,
    signedName: null,
  });
  return {
    proposal: {
      sections: ["about", "beforeAfter", "documents"],
      about: { headline: c.about.headline, story: c.about.story, teamPhotoUrl: "/demo/summit-ridge/team.webp", videoUrl: null },
      gallery: [{ before: "/demo/summit-ridge/roof-before.webp", after: "/demo/summit-ridge/roof-after.webp", caption: null }],
      documents: [
        {
          url: "/demo/summit-ridge/insurance-certificate-SAMPLE.pdf",
          title: c.insuranceTitle,
          summary: c.insuranceSummary,
        },
      ],
      testimonials: [],
      services: [],
      waivers: [waiver(c.waivers.slice(0, half), 1), waiver(c.waivers.slice(half), 2)],
    },
    processSteps: c.process.steps,
  };
}

/**
 * The fixture as a visitor reading `siteLanguage` sees it: the company
 * writing in the document language (its language, its saved option names,
 * its own words), and its tagline in the site language. Prices, the house,
 * the homeowner and the tax are untouched.
 */
export function fixtureInLanguage(fixture, siteLanguage) {
  const doc = documentLanguageFor(siteLanguage);
  const names = fixture.materialLabels?.[doc] || null;
  return {
    ...fixture,
    company: { ...fixture.company, defaultLanguage: doc, tagline: summitRidgeContentFor(siteLanguage).tagline },
    // The saved row as a company writing in `doc` saved it: its own names
    // for the options, the keys and rates untouched.
    config: names
      ? { ...fixture.config, materials: (fixture.config.materials || []).map((m) => (names[m.key] ? { ...m, label: names[m.key] } : m)) }
      : fixture.config,
    presentation: showcasePresentation(doc),
    payloads: Object.fromEntries(Object.entries(fixture.payloads).map(([code, p]) => [code, { ...p, companyLanguage: doc }])),
  };
}
