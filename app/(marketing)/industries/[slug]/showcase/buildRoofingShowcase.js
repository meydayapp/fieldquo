// app/(marketing)/industries/[slug]/showcase/buildRoofingShowcase.js
//
// The fixture behind the roofing walk-through (#instant-quote-example on
// /industries/roofing), built on the SERVER when the page is generated and
// handed to the client as plain data. Four things decide what is in it:
//
//   · The company is invented and says so: "Summit Ridge Roofing", the
//     owner's demo company (see SHOWCASE_COMPANY). It takes no bookings, so
//     the form offers no visit to book.
//   · The house is the app-guide harness's measured roof
//     (docs/screens/app-guide/harness/fixtures/takeoffs.js ROOF_MEASUREMENT:
//     24.1 squares, 2,412.5 sq ft, 8/12, six facets) at an invented address.
//     The harness still is a live Google tile; this one is an illustration
//     drawn here, so the page makes no Google request. Its steepness tier is
//     derived by lib/measure/roofMeasurement.js steepnessTier(), which is what
//     measureRoof() stores — the harness's own `tier: "steep"` label is not
//     read by the estimator and is not copied.
//   · The price book is the one a roofer starts from: INSTANT_ESTIMATE_DEFAULTS
//     .roofing, the seed Settings › Instant quotes shows before anything is
//     saved (app/api/settings/instant-quote/route.js). Roofing does not derive
//     from the services price book (lib/estimate/instantSeed.js
//     DERIVED_SEED_TRADES), so for a roofer the saved row IS the price —
//     effectiveInstantConfig() returns it untouched. Currency-neutral by the
//     seed's own statement ("CAD/USD are close enough"), so the figures are
//     not converted; the company bills in CAD because the house is in Ontario.
//   · The only choices made FOR the sample company are ones any owner makes on
//     that same screen: show the range after the homeowner submits (the
//     setting's "usual pick", lib/estimate/visibility.js) and do not ask for
//     photos (an upload would be a request).
//
// Everything priced is priced later, in the browser, by the real pure
// functions (./roofingRun.js) — this file only states the inputs.

import { ROOF_MEASUREMENT } from "@/docs/screens/app-guide/harness/fixtures/takeoffs.js";
import { steepnessTier } from "@/lib/measure/roofMeasurement";
import { INSTANT_ESTIMATE_DEFAULTS, INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { sanitiseInstantConfig } from "@/lib/estimate/instantQuoteReadiness";
import { visibilityFor, lockedEstimateMessage } from "@/lib/estimate/visibility";
import { budgetBands } from "@/lib/estimate/budgetBands";
import { effectiveFormFields } from "@/lib/estimate/formFields";
import { resolveDocumentTax } from "@/lib/tax/documentTax";
import { taxLineHeadline } from "@/lib/tax/taxLine";
import { INDUSTRY_MESSAGES } from "@/app/i18n/industries";
import { SUMMIT_RIDGE_CONTENT } from "./summitRidgeContent";
import {
  INSTANT_QUOTE_LANGUAGES,
  instantTradeLabel,
  instantTradeBlurb,
} from "@/lib/i18n/instantQuoteCopy";

const TRADE = "roofing";

/**
 * The example company, supplied by the owner (2026-09-28) and fictional: its
 * name, tagline, logo and photos are demo assets under public/demo/summit-ridge/.
 * Contact details are reserved-for-fiction only (555-01xx, example.com) and
 * the address is city-level. The brand is the logo's own blue (#365e7e, the
 * "ROOFING" wordmark), measured by documentTheme like any tenant's.
 *
 * The logo slot gets the mountain-and-roofs MARK, not the full lockup: the
 * source PNG is transparent with a dark wordmark (15.9:1 on white, "ROOFING"
 * 6.2:1 — fine on a light header, unreadable on a dark one), and at the
 * 32–40px the headers draw a logo the words would be illegible anyway. Every
 * header sets the company name in text beside it.
 */
export const SHOWCASE_COMPANY = Object.freeze({
  name: "Summit Ridge Roofing",
  tagline: "Built strong. Built to last.",
  slug: "summit-ridge-roofing-example",
  logoUrl: "/demo/summit-ridge/logo-mark.webp",
  brandColor: "#365e7e",
  phone: "(613) 555-0150",
  email: "summitridge@example.com",
  address: "Ottawa, ON",
  currency: "CAD",
  province: "ON",
  country: "CA",
  defaultLanguage: "en",
});

/**
 * What the company shows beside its documents — the proposal sections the
 * client quote page and the estimate report draw (lib/proposal/load.js
 * projectProposal's shape) and the waivers attached to the quote
 * (loadQuoteWaivers' shape). Words from ./summitRidgeContent.js, verbatim.
 * No testimonials: a fictional company's reviews would be fabricated, so the
 * section is off rather than filled.
 */
function showcasePresentation() {
  const c = SUMMIT_RIDGE_CONTENT;
  const half = Math.ceil(c.waivers.length / 2);
  // WaiverSign pairs one box with each section, and a waiver carries at most
  // five boxes (lib/company/documents.js WAIVER_MAX_ACKNOWLEDGEMENTS), so the
  // owner's ten acknowledgements are two documents of five.
  const waiver = (items, n) => ({
    token: `sample-waiver-${n}`,
    title: `Roofing project acknowledgements (${n} of 2)`,
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
          title: "SAMPLE / DEMO – NOT VALID INSURANCE",
          summary: "Certificate of commercial general liability · fictional insurer DemoSure",
        },
      ],
      testimonials: [],
      services: [],
      waivers: [waiver(c.waivers.slice(0, half), 1), waiver(c.waivers.slice(half), 2)],
    },
    processSteps: c.process.steps,
  };
}

/** The invented homeowner — example.com and a 555-01xx number are reserved for fiction. */
export const SHOWCASE_HOMEOWNER = Object.freeze({
  name: "Jordan Avery",
  email: "jordan.avery@example.com",
  phone: "(613) 555-0142",
});

export const SHOWCASE_ADDRESS = "123 Sample Street, Ottawa, ON";

/** The reviewer on the company's side, for "Assigned to …" and the owner menu. */
export const SHOWCASE_REVIEWER = Object.freeze({ id: "sample-reviewer", name: "Alex Moreau" });

// A top-down drawing of a six-facet hip roof on a lawn, 640×400 like the
// still it stands in for. Drawn, not photographed, and labelled as such by the
// section — a satellite frame of somebody's real house is not ours to publish.
const ROOF_ILLUSTRATION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
<rect width="640" height="400" fill="#7d9468"/>
<rect x="0" y="300" width="640" height="100" fill="#8a8f93"/>
<rect x="430" y="210" width="90" height="190" fill="#9ea3a6"/>
<path d="M150 70 L490 70 L490 250 L150 250 Z" fill="#5b6770"/>
<path d="M150 70 L240 160 L400 160 L490 70 Z" fill="#6c7881"/>
<path d="M150 250 L240 160 L400 160 L490 250 Z" fill="#4f5a62"/>
<path d="M150 70 L240 160 L150 250 Z" fill="#616d76"/>
<path d="M490 70 L400 160 L490 250 Z" fill="#56626a"/>
<path d="M150 70 L240 160 L400 160 L490 70 M150 250 L240 160 M400 160 L490 250" stroke="#3a434a" stroke-width="3" fill="none"/>
<rect x="300" y="95" width="26" height="22" fill="#8c5a44"/>
<circle cx="80" cy="110" r="34" fill="#5d7a4a"/><circle cx="570" cy="120" r="28" fill="#5d7a4a"/>
</svg>`;
export const ROOF_ILLUSTRATION_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ROOF_ILLUSTRATION_SVG)}`;

/**
 * The measurement /measure would store for this house: measureRoof()'s shape
 * (area, squares, pitch, steepness, facets, footprint, imagery date) with the
 * illustration where the still would be.
 */
function showcaseMeasurement() {
  const m = ROOF_MEASUREMENT;
  return {
    source: "google_solar",
    areaSqft: m.areaSqft,
    squares: m.squares,
    predominantPitch: { rise: m.predominantPitch.rise, run: 12, degrees: m.predominantPitch.degrees },
    steepness: steepnessTier(m.predominantPitch.rise),
    segmentCount: m.segmentCount,
    footprintSqft: m.footprintSqft,
    formattedAddress: SHOWCASE_ADDRESS,
    imageryDate: m.imageryDate,
    satelliteImageUrl: ROOF_ILLUSTRATION_URL,
  };
}

/** The saved instant-quote row: the seed, plus the two owner choices named in the header. */
function showcaseConfig() {
  return sanitiseInstantConfig({
    ...INSTANT_ESTIMATE_DEFAULTS[TRADE],
    estimateVisibility: "after_submit",
    fields: { photos: "hidden" },
  });
}

/**
 * The option names in a form language — the showcase's stand-in for the
 * translations Settings drafts when an owner saves a trade (namespace
 * materialLabel, lib/i18n/phrases.js). English is the seed's own wording.
 */
function materialLabelsFor(language) {
  return INDUSTRY_MESSAGES[language]?.showcase?.materials || INDUSTRY_MESSAGES.en?.showcase?.materials || {};
}

/**
 * GET /api/instant-quote/[slug]'s reply for this company in one of the
 * form's three languages — the same fields loadCompanyInstantTrades() puts on
 * a trade, from the same pure helpers (that function itself reads the
 * database, so its assembly is restated here, field for field).
 */
function showcasePayload(language, config) {
  const spec = INSTANT_ESTIMATE_TRADES[TRADE];
  const estimateDisplay = visibilityFor(config);
  return {
    company: {
      name: SHOWCASE_COMPANY.name,
      slug: SHOWCASE_COMPANY.slug,
      logoUrl: SHOWCASE_COMPANY.logoUrl,
      brandColor: SHOWCASE_COMPANY.brandColor,
      phone: SHOWCASE_COMPANY.phone,
    },
    mapsKey: null,
    language,
    languages: [language],
    companyLanguage: SHOWCASE_COMPANY.defaultLanguage,
    currency: SHOWCASE_COMPANY.currency,
    trades: [
      {
        trade: TRADE,
        estimateDisplay,
        ...(estimateDisplay === "after_submit" && { lockedMessage: lockedEstimateMessage(language) }),
        budgetBands: budgetBands(config.budgetThresholds, { currency: SHOWCASE_COMPANY.currency, language }).map((b) => ({
          index: b.index,
          label: b.label,
        })),
        label: instantTradeLabel(TRADE, language),
        description: instantTradeBlurb(TRADE, language),
        measure: spec.measure,
        hasMaterials: spec.hasMaterials,
        materials: (config.materials || []).map((m) => ({ key: m.key, label: materialLabelsFor(language)[m.key] || m.label })),
        fields: effectiveFormFields(config.fields, { measure: spec.measure, serviceAreaConfigured: false }).fields,
      },
    ],
    booking: { canBookVisit: false },
    pixels: null,
    pixelConsentRequired: false,
  };
}

/**
 * Everything the walk-through needs, as plain data. Called by the industry
 * page's server half for the roofing slug only.
 */
export function buildRoofingShowcase() {
  const config = showcaseConfig();
  const client = { province: SHOWCASE_COMPANY.province, country: SHOWCASE_COMPANY.country, address: SHOWCASE_ADDRESS };
  // The draft's tax, resolved the way createEstimateDraft resolves it: the
  // client's province, no company override, no work-type claim.
  const tax = resolveDocumentTax({
    company: { province: SHOWCASE_COMPANY.province, country: SHOWCASE_COMPANY.country },
    taxRates: null,
    client,
    workType: null,
    lang: "en",
  });
  return {
    trade: TRADE,
    company: { ...SHOWCASE_COMPANY },
    presentation: showcasePresentation(),
    homeowner: { ...SHOWCASE_HOMEOWNER },
    address: SHOWCASE_ADDRESS,
    reviewer: { ...SHOWCASE_REVIEWER },
    measurement: showcaseMeasurement(),
    config,
    // The rate, and the estimator screens' own headline for it ("HST 13%
    // (Ontario)") as a key and params per marketing language — the words
    // and the decimal separator are the reader's.
    tax: {
      rate: Number(tax?.rate) || 0,
      // The resolver's result itself (plain data), which createEstimateDraft
      // turns into the draft's Quote.taxResolution — so the review row's
      // taxRate comes out of appliedTaxRate() from the record the real queue
      // reads, not from the rate re-implied by the rounded tax.
      resolution: tax || null,
      headline: Object.fromEntries(Object.keys(INDUSTRY_MESSAGES).map((code) => [code, taxLineHeadline(tax, code)])),
    },
    quoteNumber: "Q-1048",
    // A fixed moment, so the default request reads the same on every build.
    createdAt: "2026-09-24T14:05:00.000Z",
    materialLabels: Object.fromEntries(INSTANT_QUOTE_LANGUAGES.map((code) => [code, materialLabelsFor(code)])),
    payloads: Object.fromEntries(INSTANT_QUOTE_LANGUAGES.map((code) => [code, showcasePayload(code, config)])),
  };
}
