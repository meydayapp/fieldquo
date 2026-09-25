// lib/estimate/report/model.js
//
// The instant-estimate report, as data.
//
// ── One model, three renderings ─────────────────────────────────────────────
//
// The report is read three ways — the branded page at /estimate-report/<token>,
// the PDF attached to the email, and the email itself — and the three must
// say the same thing. So every sentence, figure and link is decided HERE, once,
// and the renderers (app/estimate-report/**, lib/documentSections/report*.js,
// lib/estimate/report/email.js) only lay it out. A renderer that computed a
// figure of its own would be the copy that rots.
//
// ── Nothing here trusts the stored breakdown for a price ────────────────────
//
// The "starting at" figures come from `options`, which the loader obtains by
// re-pricing the SAVED measurement through priceAllMaterials() — the
// company's current rate card against the measurement the homeowner was
// shown. Quote.estimateData.range is what they saw on the day; the report
// says what the company's options start at, and those are read fresh. If
// the trade has since been switched off, or the owner has chosen not to show
// figures, the option cards render without a price rather than with a stale
// one (see `showPrices`).
//
// Pure: no database, no request. scripts/check-estimate-report.mjs builds it
// for every instant trade in every language from fixtures.

import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { stairsFromSteps } from "@/lib/estimate/stairsFromSteps";
import { estimateMoney, estimateRange } from "@/lib/estimate/estimateMoney";
import { effectiveVisibility, publicEstimate } from "@/lib/estimate/visibility";
import { estimateReportCopy } from "@/lib/i18n/estimateReportCopy";
import {
  INSTANT_TRADE_WORDS,
  instantTradeLabel,
  instantQuoteLanguage,
  instantQuoteLocale,
} from "@/lib/i18n/instantQuoteCopy";
import { satelliteOutline } from "./mapOverlay";

/**
 * Is this quote one the report may be built for?
 *
 * An instant estimate the public form created — not a phone draft (which was
 * priced off a call nobody measured), not a hand-built quote that happens to
 * carry a share token. The public page 404s anything else.
 */
export function isInstantEstimateQuote(quote) {
  if (!quote || quote.autoEstimated !== true) return false;
  const trade = quote?.estimateData?.trade || quote?.quoteType;
  if (!trade) return false;
  if (quote.estimateSource === "phone_call") return false;
  if (quote.createdVia && quote.createdVia !== "instant_quote") return false;
  return true;
}

/** The report's language: the document's, fixed at creation; English otherwise. */
export function reportLanguage(quote) {
  return instantQuoteLanguage(quote?.language) || "en";
}

/**
 * How a trade's figure was measured, for the "Source" row:
 *   satellite — an address measured from aerial imagery (roof, gutters, lawn
 *               care from the parcel)
 *   traced    — the homeowner drew the area on the map
 *   figures   — the homeowner typed sizes, counts or picked items
 */
export function measureKindFor(trade, measurement) {
  const measure = INSTANT_ESTIMATE_TRADES[trade]?.measure || null;
  if (measure === "lawn_polygon" || measure === "area_polygon") return "traced";
  if (measure === "lawn_address") {
    return measurement?.source === "traced" ? "traced" : "satellite";
  }
  if (measure === "roof_address" || measure === "gutter_address") return "satellite";
  if (measure) return "figures";
  // A trade this build does not know (a sibling's paving added at merge):
  // an outline means it was traced; otherwise their figures.
  return Array.isArray(measurement?.polygon) && measurement.polygon.length >= 3 ? "traced" : "figures";
}

const fmtInt = (n, locale) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v));
  } catch {
    return String(Math.round(v));
  }
};

/** "2024-07-29" from Solar's { year, month, day }, a "2024-07-29" string, or null. */
export function imageryDateText(measurement) {
  const raw = measurement?.imageryDate ?? measurement?.imagery?.date ?? null;
  if (typeof raw === "string") return raw.trim() || null;
  if (raw && typeof raw === "object") {
    const y = Number(raw.year);
    if (!Number.isFinite(y) || y < 1900) return null;
    const m = Number(raw.month);
    const d = Number(raw.day);
    const pad = (x) => String(x).padStart(2, "0");
    if (Number.isFinite(m) && m >= 1 && Number.isFinite(d) && d >= 1) return `${y}-${pad(m)}-${pad(d)}`;
    if (Number.isFinite(m) && m >= 1) return `${y}-${pad(m)}`;
    return String(y);
  }
  return null;
}

/** "6/12" from { rise, run } or a bare number of rise, or null. */
function pitchText(p) {
  if (p && typeof p === "object") {
    const rise = Number(p.rise);
    const run = Number(p.run) || 12;
    return Number.isFinite(rise) ? `${rise}/${run}` : null;
  }
  const rise = Number(p);
  return Number.isFinite(rise) && rise > 0 ? `${rise}/12` : null;
}

/** The measurement rows for a trade — only facts the draft actually carries. */
export function measurementRows(trade, measurement, language) {
  const t = estimateReportCopy(language);
  const locale = instantQuoteLocale(language);
  const m = measurement || {};
  const rows = [];
  const push = (label, value) => {
    if (value !== null && value !== undefined && value !== "") rows.push({ label, value });
  };
  const measure = INSTANT_ESTIMATE_TRADES[trade]?.measure || null;

  if (trade === "roofing") {
    push(t.measuredArea, fmtInt(m.areaSqft, locale) && t.sqft(fmtInt(m.areaSqft, locale)));
    push(t.squares, Number.isFinite(Number(m.squares)) ? String(Math.round(Number(m.squares) * 10) / 10) : null);
    push(t.pitch, pitchText(m.predominantPitch));
  } else if (trade === "gutters") {
    push(t.gutterRun, fmtInt(m.gutterFt, locale) && t.ft(fmtInt(m.gutterFt, locale)));
    push(t.downspouts, fmtInt(m.downspouts, locale));
  } else if (trade === "lawn_care" || trade === "lawn_mowing" || measure === "lawn_address" || measure === "lawn_polygon") {
    push(t.lawnArea, fmtInt(m.areaSqft, locale) && t.sqft(fmtInt(m.areaSqft, locale)));
  } else if (trade === "paving" || measure === "area_polygon") {
    push(t.pavingArea, fmtInt(m.areaSqft, locale) && t.sqft(fmtInt(m.areaSqft, locale)));
  } else if (measure === "manual_units" || trade === "cabinet_refinishing" || trade === "cabinet_refacing") {
    push(t.doors, fmtInt(m.doorCount, locale));
    push(t.drawers, fmtInt(m.drawerCount, locale));
  } else if (measure === "stair_count" || trade === "stair") {
    push(t.treads, fmtInt(m.treads, locale));
    // The counts the range was priced on, re-derived from the saved step
    // count and shape by the same rule (lib/estimate/stairsFromSteps.js) and
    // labelled as assumed — the estimator confirms them from the photos, and
    // the homeowner sees the figure came from what they typed, not a visit.
    const derived = stairsFromSteps({ steps: m.treads, shape: m.shape, railingFt: m.railingFt });
    if (derived) {
      const shapeWord = t.stairShapes?.[derived.shape] || derived.shape;
      const assumed = (value) => `${value} — ${t.assumedFromSteps(fmtInt(derived.steps, locale), shapeWord)}`;
      push(t.stairShape, shapeWord);
      push(t.risers, assumed(fmtInt(derived.risers, locale)));
      push(t.balusters, assumed(fmtInt(derived.balusters, locale)));
      push(t.posts, assumed(fmtInt(derived.posts, locale)));
      push(
        t.handrail,
        derived.railingGiven
          ? t.ft(fmtInt(derived.handrailFt, locale))
          : assumed(t.ft(fmtInt(derived.handrailFt, locale))),
      );
    }
  } else if (measure === "item_picker" || trade === "junk_removal") {
    const n = Array.isArray(m.items) ? m.items.reduce((s, it) => s + (Number(it?.count ?? it?.qty ?? 1) || 0), 0) : null;
    push(t.items, n ? fmtInt(n, locale) : null);
  } else {
    push(t.measuredArea, fmtInt(m.areaSqft, locale) && t.sqft(fmtInt(m.areaSqft, locale)));
  }

  push(t.imageryDate, imageryDateText(m));
  push(t.source, t.sourceKinds[measureKindFor(trade, m)]);
  return rows;
}

function tel(phone) {
  const s = typeof phone === "string" ? phone.trim() : "";
  if (!s) return null;
  const digits = s.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : null;
}

function safeHttps(url) {
  return typeof url === "string" && /^https:\/\//i.test(url.trim()) ? url.trim() : null;
}

/**
 * The two option cards: the cheapest starting figure and the dearest.
 *
 * `options` is priceAllMaterials()'s list — every enabled material priced for
 * THIS measurement, lowest bound first once sorted. A trade with one option
 * (no materials, or one row) shows one card. The homeowner's own pick is
 * flagged when it is one of the two.
 */
export function optionCards({ options, chosenKey, currency, language, showPrices }) {
  const t = estimateReportCopy(language);
  const locale = instantQuoteLocale(language);
  const list = (Array.isArray(options) ? options : [])
    .filter((o) => o && Number.isFinite(Number(o.low)) && Number(o.low) > 0)
    .map((o) => ({ ...o, low: Number(o.low) }))
    .sort((a, b) => a.low - b.low);
  if (!list.length) return [];
  const cheapest = list[0];
  const dearest = list[list.length - 1];
  const picked = cheapest === dearest ? [cheapest] : [cheapest, dearest];
  return picked.map((o, i) => ({
    key: o.materialKey || null,
    label: o.label || null,
    tier: picked.length === 1 ? null : i === 0 ? t.goodValue : t.premium,
    chosen: Boolean(chosenKey) && o.materialKey === chosenKey,
    startingAt: showPrices ? estimateMoney(o.low, currency, locale) : null,
    unit: o.unit ? t.perUnit(o.unit) : null,
    // No product photograph: the repo holds none per material and the
    // company's rate card has no image field. The renderers draw a neutral
    // brand-wash tile with the material's name; never a broken <img>.
    imageUrl: null,
  }));
}

/**
 * Build the report.
 *
 * @param quote    the draft Quote with `client`, `estimateData`, `language`,
 *                 `quoteNumber`, `createdAt`, `estimateSource`
 * @param company  { name, logoUrl, phone, email, currency, slug, bookingSlug }
 * @param options  priceAllMaterials() result, or null when the trade cannot be
 *                 re-priced today
 * @param website  resolveReportWebsite() result
 * @param urls     { report, book, callbackApi } absolute URLs (book null when
 *                 the company cannot take a visit)
 * @param emailed  whether a copy was (or will be) emailed — the notes say so
 */
export function buildEstimateReportModel({ quote, company = {}, options = null, website = null, urls = {}, emailed = false }) {
  const language = reportLanguage(quote);
  const t = estimateReportCopy(language);
  const data = quote?.estimateData && typeof quote.estimateData === "object" ? quote.estimateData : {};
  const trade = data.trade || quote?.quoteType || null;
  const measurement = data.measurement && typeof data.measurement === "object" ? data.measurement : {};
  const client = quote?.client || {};
  const companyName = company.name || "";
  const noun = INSTANT_TRADE_WORDS[trade]?.[language]?.noun || null;
  const address = client.address || measurement.formattedAddress || null;

  // A price is only printed when the owner's per-trade setting allows a
  // figure on a confirmed estimate — the same gate the result screen and the
  // confirmation email obey (lib/estimate/visibility.js).
  const showPrices = Boolean(options?.ok) && effectiveVisibility(options.visibility, "confirmed") === "range";

  // ── The range, for the presentation's headline ─────────────────────────
  //
  // The page this report opens on is now the company's proposal with the
  // RANGE where a quote's prices would be (owner, 2026-09-22). Which range:
  // the one the homeowner was shown when they submitted
  // (estimateData.range, written once by createEstimateDraft) — a document
  // keeps saying what it said — and only while the owner's setting still
  // allows a figure (`showPrices`, the gate the option cards obey). Through
  // publicEstimate like every other public figure: a half-stored range, a
  // zero or an inverted pair draws no range rather than "$0". The point
  // estimate stored beside low/high is never read here; only the two ends
  // are, rounded, and only as one formatted string.
  const shownRange = showPrices ? publicEstimate(data.range, "range") : { show: false };
  const rangeLocale = instantQuoteLocale(language);
  const rangeText = shownRange.show
    ? shownRange.low === shownRange.high
      ? estimateMoney(shownRange.low, company.currency || "CAD", rangeLocale)
      : estimateRange(shownRange.low, shownRange.high, company.currency || "CAD", rangeLocale)
    : null;

  const cards = options?.ok
    ? optionCards({
        options: options.options,
        chosenKey: data.materialKey || null,
        currency: company.currency || "CAD",
        language,
        showPrices,
      })
    : [];

  const dateLocale = instantQuoteLocale(language);
  let dateText = null;
  try {
    const d = quote?.createdAt ? new Date(quote.createdAt) : null;
    dateText = d && !Number.isNaN(d.getTime())
      ? new Intl.DateTimeFormat(dateLocale, { year: "numeric", month: "long", day: "numeric" }).format(d)
      : null;
  } catch {
    dateText = null;
  }

  const outline = satelliteOutline(measurement);
  const still = safeHttps(measurement.satelliteImageUrl);

  const nextSteps = t.nextSteps(companyName || t.theTeam);

  return {
    language,
    trade,
    tradeLabel: instantTradeLabel(trade, language),
    header: {
      companyName,
      logoUrl: safeHttps(company.logoUrl),
      call: tel(company.phone) ? { label: t.call, href: tel(company.phone), text: company.phone.trim() } : null,
      email: company.email ? { label: t.email, href: `mailto:${company.email.trim()}`, text: company.email.trim() } : null,
      website: website?.url ? { label: t.website, href: website.url, kind: website.kind } : null,
    },
    title: {
      text: t.title(noun),
      preparedForLabel: t.preparedFor,
      preparedFor: address,
      preparedBy: t.preparedBy(companyName),
      date: dateText,
    },
    // The headline figure — one string, or null when no figure may be shown.
    estimate: {
      rangeText,
      // The one material the homeowner picked, by name — which option the
      // range is for, when the trade offers more than one.
      optionLabel: rangeText && data.materialKey
        ? (options?.options || []).find((o) => o?.materialKey === data.materialKey)?.label || null
        : null,
    },
    options: {
      title: t.optionsTitle,
      intro: cards.length > 1 ? t.optionsIntro : t.optionsIntroOne,
      startingAtLabel: t.startingAt,
      yourPickLabel: t.yourPick,
      cards,
      showPrices,
    },
    questions: {
      title: t.questionsTitle,
      body: t.questionsBody,
      book: urls.book ? { label: t.bookVisit, href: urls.book } : null,
      callback: {
        label: t.requestCallback,
        api: urls.callbackApi || null,
        // What the callback route needs, minus anything it would only echo.
        // The homeowner's name and phone prefill the form; nothing else is
        // typed twice.
        prefill: { name: client.name || "", phone: client.phone || "" },
        body: { trade, address: address || "", quoteId: quote?.id || null, language },
        copy: {
          name: t.cbName,
          phone: t.cbPhone,
          time: t.cbTime,
          timeOptions: t.cbTimeOptions,
          note: t.cbNote,
          send: t.cbSend,
          sending: t.cbSending,
          done: t.cbDone,
          phoneRequired: t.cbPhoneRequired,
          failed: t.cbFailed,
          cancel: t.cbCancel,
        },
      },
      website: website?.url ? { label: t.backToWebsite, href: website.url } : null,
    },
    measurement: {
      title: t.measurementTitle,
      rows: measurementRows(trade, measurement, language),
      kind: measureKindFor(trade, measurement),
      verifyNote: t.verifyNote,
    },
    property: {
      title: t.propertyTitle,
      rows: [
        [t.address, address],
        [t.name, client.name || null],
        [t.emailLabel, client.email || null],
        [t.phone, client.phone || null],
        // Property type: shown only when the draft knows it. Nothing on the
        // instant form asks, so it is null for every draft today — the row
        // is omitted rather than defaulted to "Residential".
        [t.propertyType, data.propertyType ? t.propertyTypes[data.propertyType] || null : null],
      ]
        .filter(([, v]) => v)
        .map(([label, value]) => ({ label, value })),
      map: still
        ? {
            title: t.mapTitle,
            imageUrl: still,
            outline,
            caption: outline ? t.mapCaption : t.mapCaptionNoOutline,
          }
        : { title: t.mapTitle, imageUrl: null, outline: null, caption: t.mapUnavailable },
    },
    notes: {
      title: t.notesTitle,
      emailed: emailed ? t.emailedCopy : t.emailedCopyNone,
      nextTitle: t.nextTitle,
      nextSteps,
      disclaimers: [t.disclaimerPrice, t.disclaimerMeasure],
      reportIdLabel: t.reportId,
      reportId: quote?.quoteNumber || null,
      viewOnlineLabel: t.viewOnline,
      viewOnline: urls.report || null,
      dateLabel: t.date,
      date: dateText,
    },
    email: {
      subject: t.emailSubject(companyName, noun),
      greeting: t.emailGreeting(client.name || ""),
      body: t.emailBody(companyName),
      footer: t.emailFooter,
      filename: t.pdfFilename(quote?.quoteNumber || "estimate"),
    },
  };
}
