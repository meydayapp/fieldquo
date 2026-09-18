#!/usr/bin/env node
// scripts/check-estimate-report.mjs
//
//   npm run check:estimate-report
//
// The instant-estimate report, executed without a database: the copy table
// in three languages with no English left inside French or Spanish, the
// model built for EVERY instant trade in every language from a fixture with
// every section populated, the website rule, the contrast of the tiles and
// the starting-at figure on hostile brands, the three buttons' targets, the
// map overlay round-tripped through imageScale's inverse projection, and the
// PDF section registration.

import { readFileSync } from "node:fs";
import { INSTANT_ESTIMATE_TRADES } from "@/lib/estimate/instantEstimate";
import { ESTIMATE_REPORT_COPY, estimateReportCopy } from "@/lib/i18n/estimateReportCopy";
import { INSTANT_TRADE_WORDS } from "@/lib/i18n/instantQuoteCopy";
import {
  buildEstimateReportModel,
  isInstantEstimateQuote,
  measureKindFor,
  optionCards,
  imageryDateText,
} from "@/lib/estimate/report/model";
import { resolveReportWebsite, siteIsTailored, ownWebsiteUrl } from "@/lib/estimate/report/website";
import { satelliteOutline, outlinePointsAttr } from "@/lib/estimate/report/mapOverlay";
import { documentTheme, fillPair, washPair, neutralPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { canvasPointToLatLng, imageScale } from "@/lib/measure/imageScale";
import { ESTIMATE_REPORT_SECTIONS } from "@/lib/estimate/report/sections";
import { buildEstimateReportEmail, estimateReportEmailPalette } from "@/lib/estimate/report/email";
import { SECTION_META, sectionsForType } from "@/lib/documentSections/sectionMeta";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const LANGS = ["en", "fr", "es"];

// ── 1. The copy table ───────────────────────────────────────────────────────
console.log("\nCopy table");
{
  const en = ESTIMATE_REPORT_COPY.en;
  const sample = (fn) => fn("Acme Roofing", "roofing");
  // Words that ARE the same in another language and are allowed to be.
  // "Date" and "Commercial" are French words spelled as in English.
  const SAME = { fr: new Set(["Date", "Commercial"]), es: new Set([]) };
  for (const lang of ["fr", "es"]) {
    const table = ESTIMATE_REPORT_COPY[lang];
    let missing = 0;
    let english = 0;
    for (const [key, value] of Object.entries(en)) {
      const other = table[key];
      if (other === undefined || typeof other !== typeof value) {
        missing++;
        console.log(`       ${lang}.${key} missing or wrong type`);
        continue;
      }
      const pairs = [];
      if (typeof value === "string") pairs.push([value, other]);
      else if (typeof value === "function") {
        const a = sample(value);
        const b = sample(other);
        if (Array.isArray(a)) a.forEach((s, i) => pairs.push([s, b[i]]));
        else pairs.push([a, b]);
      } else if (Array.isArray(value)) value.forEach((row, i) => pairs.push([row[1], other[i]?.[1]]));
      else if (value && typeof value === "object") {
        for (const k of Object.keys(value)) pairs.push([value[k], other[k]]);
      }
      for (const [a, b] of pairs) {
        if (typeof b !== "string" || !b.trim()) {
          missing++;
          console.log(`       ${lang}.${key} empty`);
        } else if (a === b && !SAME[lang].has(a)) {
          english++;
          console.log(`       ${lang}.${key} is still English: ${JSON.stringify(a)}`);
        }
      }
    }
    ok(missing === 0, `${lang}: every en key present with the same shape`);
    ok(english === 0, `${lang}: no English string inside the table`);
  }
  ok(estimateReportCopy("xx") === en, "unknown language falls back to English");
  ok(estimateReportCopy("FR-ca") === ESTIMATE_REPORT_COPY.fr, "language code is case/region tolerant");
  ok(estimateReportCopy("es").title(INSTANT_TRADE_WORDS.roofing.es.noun) === "Su estimación gratuita de techado", "es title carries the Spanish noun");
  ok(estimateReportCopy("fr").title(INSTANT_TRADE_WORDS.roofing.fr.noun) === "Votre estimation de toiture gratuite", "fr title carries the French noun");
}

// ── 2. Fixtures ─────────────────────────────────────────────────────────────
const STILL =
  "https://maps.googleapis.com/maps/api/staticmap?center=45.42,-75.69&zoom=20&size=640x400&scale=2&maptype=satellite&key=abc";
// A rectangle roughly 20 m × 12 m around the centre: the outline must land
// inside the still.
const POLY = [
  { lat: 45.42009, lng: -75.69013 },
  { lat: 45.42009, lng: -75.68987 },
  { lat: 45.41991, lng: -75.68987 },
  { lat: 45.41991, lng: -75.69013 },
];
function measurementFor(trade) {
  const base = {
    formattedAddress: "917 Littlerock St, Ottawa, ON",
    satelliteImageUrl: "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/satellite/x.png",
    satelliteSourceUrl: STILL,
  };
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  switch (spec?.measure) {
    case "roof_address":
      return { ...base, areaSqft: 2450, squares: 24.5, predominantPitch: { rise: 6, run: 12, degrees: 26.6 }, imageryDate: { year: 2024, month: 7, day: 29 } };
    case "gutter_address":
      return { ...base, gutterFt: 180, downspouts: 4, imagery: { date: "2024-07-29" } };
    case "lawn_address":
      return { ...base, areaSqft: 1500, source: "traced", vertices: POLY, imageryDate: { year: 2023 } };
    case "lawn_polygon":
    case "area_polygon":
      return { ...base, areaSqft: 1500, polygon: POLY };
    case "manual_units":
      return { ...base, doorCount: 18, drawerCount: 6, satelliteImageUrl: null, satelliteSourceUrl: null };
    case "stair_count":
      return { ...base, treads: 14, satelliteImageUrl: null, satelliteSourceUrl: null };
    case "item_picker":
      return { ...base, items: [{ key: "sofa", count: 1 }, { key: "mattress", count: 2 }], satelliteImageUrl: null, satelliteSourceUrl: null };
    default:
      return { ...base, areaSqft: 800, satelliteImageUrl: null, satelliteSourceUrl: null };
  }
}
const OPTIONS = {
  ok: true,
  visibility: "after_submit",
  options: [
    { materialKey: "metal_standing_seam", label: "Standing seam metal", low: 31850, high: 42000, point: 36000, unit: null },
    { materialKey: "asphalt_arch", label: "Architectural shingles", low: 13475, high: 17800, point: 15000, unit: null },
    { materialKey: "asphalt_3tab", label: "3-tab asphalt shingles", low: 9800, high: 12950, point: 11000, unit: null },
  ],
};
const COMPANY = {
  id: "c1",
  name: "Acme Roofing",
  slug: "acme",
  bookingSlug: null,
  phone: "(613) 555-0100",
  email: "hello@acme.example",
  website: "https://acmeroofing.example",
  logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
  brandColor: "#06356b",
  currency: "CAD",
};
function quoteFor(trade, language) {
  return {
    id: "q1",
    quoteNumber: "Q-2026-0042",
    language,
    quoteType: trade,
    autoEstimated: true,
    createdVia: "instant_quote",
    estimateSource: "google_solar",
    createdAt: "2026-09-18T12:00:00.000Z",
    shareToken: "tok",
    estimateData: { trade, materialKey: "asphalt_3tab", measurement: measurementFor(trade), range: { low: 9800, point: 11000, high: 12950 } },
    client: { name: "Sam Rivera", email: "sam@example.com", phone: "(613) 555-0199", address: "917 Littlerock St, Ottawa, ON" },
  };
}
const URLS = { report: "https://www.fieldquo.com/estimate-report/tok", book: "https://www.fieldquo.com/estimate-report/tok/book", callbackApi: "https://www.fieldquo.com/api/instant-quote/acme/callback" };
const WEBSITE = { kind: "own", url: "https://acmeroofing.example/", automatic: true };

const flatten = (v, out = []) => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => flatten(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => flatten(x, out));
  return out;
};
// Strings that are DATA, allowed to be identical in every language.
const DATA = new Set([
  ...flatten(COMPANY),
  ...flatten(OPTIONS),
  ...flatten(URLS),
  ...flatten(WEBSITE),
  "Sam Rivera", "sam@example.com", "(613) 555-0199", "917 Littlerock St, Ottawa, ON", "mailto:hello@acme.example", "tel:6135550100",
  "Q-2026-0042", "q1", "tok", "asphalt_3tab", "metal_standing_seam", "2024-07-29", "2023", "6/12", "24.5",
  "https://www.fieldquo.com/estimate-report/tok/book", "Estimate-report-Q-2026-0042.pdf", "own", "figures", "traced", "satellite",
  "morning", "afternoon", "evening", "anytime",
  // The trade KEY travels in the callback body (a key, not a label), and the
  // captured still is a URL. Neither is a sentence.
  ...Object.keys(INSTANT_ESTIMATE_TRADES),
  "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/satellite/x.png",
  // French words spelled as in English (see SAME above).
  "Date", "Commercial",
]);

// ── 3. The model, every trade × every language ──────────────────────────────
console.log("\nModel");
const enStrings = new Map();
for (const trade of Object.keys(INSTANT_ESTIMATE_TRADES)) {
  for (const language of LANGS) {
    const quote = quoteFor(trade, language);
    const report = buildEstimateReportModel({ quote, company: COMPANY, options: OPTIONS, website: WEBSITE, urls: URLS, emailed: true });
    const label = `${trade}/${language}`;
    const noun = INSTANT_TRADE_WORDS[trade]?.[language]?.noun;
    const problems = [];
    if (report.language !== language) problems.push("language");
    if (!report.title.text.includes(noun)) problems.push(`title lacks noun "${noun}"`);
    if (!report.title.preparedFor) problems.push("preparedFor");
    if (!report.title.date) problems.push("date");
    if (!report.header.call || !report.header.email || !report.header.website) problems.push("tiles");
    if (report.options.cards.length !== 2) problems.push("two cards");
    if (report.options.cards[0]?.label !== "3-tab asphalt shingles") problems.push("cheapest first");
    if (report.options.cards[1]?.label !== "Standing seam metal") problems.push("premium second");
    if (!report.options.cards[0]?.chosen || report.options.cards[1]?.chosen) problems.push("chosen flag");
    if (!report.options.cards.every((c) => c.startingAt && !/NaN|undefined/.test(c.startingAt))) problems.push("starting at");
    if (!report.questions.book || !report.questions.callback.api || !report.questions.website) problems.push("three buttons");
    if (!report.measurement.rows.length) problems.push("measurement rows");
    if (!report.measurement.rows.some((r) => r.label === estimateReportCopy(language).source)) problems.push("source row");
    if (report.property.rows.length < 4) problems.push("property rows");
    if (!report.notes.reportId || !report.notes.viewOnline || report.notes.nextSteps.length !== 2 || report.notes.disclaimers.length !== 2) problems.push("notes");
    if (!report.email.subject.includes("Acme Roofing")) problems.push("email subject");
    const kind = measureKindFor(trade, quote.estimateData.measurement);
    const expected = { roof_address: "satellite", gutter_address: "satellite", lawn_address: "traced", lawn_polygon: "traced", area_polygon: "traced" }[INSTANT_ESTIMATE_TRADES[trade].measure] || "figures";
    if (kind !== expected) problems.push(`measure kind ${kind} ≠ ${expected}`);
    const hasStill = Boolean(quote.estimateData.measurement.satelliteImageUrl);
    if (hasStill !== Boolean(report.property.map.imageUrl)) problems.push("map still");
    ok(problems.length === 0, `${label}: every section populated`, problems);

    const strings = flatten(report).filter((s) => !DATA.has(s) && !/^[\d\s.,]+$/.test(s));
    if (language === "en") enStrings.set(trade, new Set(strings));
    else {
      const leaked = strings.filter((s) => enStrings.get(trade).has(s));
      ok(leaked.length === 0, `${label}: no English string in the model`, leaked.slice(0, 5));
    }
  }
}
{
  const r = buildEstimateReportModel({ quote: quoteFor("roofing", "en"), company: COMPANY, options: OPTIONS, website: WEBSITE, urls: URLS });
  ok(r.options.cards[0].startingAt === "$9,800" && r.options.cards[1].startingAt === "$31,850", "starting-at figures are whole-unit company currency", r.options.cards.map((c) => c.startingAt));
  const fr = buildEstimateReportModel({ quote: quoteFor("roofing", "fr"), company: { ...COMPANY, currency: "USD" }, options: OPTIONS, website: WEBSITE, urls: URLS });
  ok(/9\s?800/.test(fr.options.cards[0].startingAt) && /US/.test(fr.options.cards[0].startingAt), "fr grouping, USD stays USD", fr.options.cards[0].startingAt);
  ok(r.property.map.outline === null, "roofing fixture with no polygon draws no outline");
  ok(r.measurement.rows.find((x) => x.label === "Imagery date")?.value === "2024-07-29", "Solar { year, month, day } becomes a date");
  const gated = buildEstimateReportModel({ quote: quoteFor("roofing", "en"), company: COMPANY, options: { ...OPTIONS, visibility: "gated" }, website: WEBSITE, urls: URLS });
  ok(gated.options.cards.length === 2 && gated.options.cards.every((c) => c.startingAt === null), "a gated trade shows the options without figures");
  const none = buildEstimateReportModel({ quote: quoteFor("roofing", "en"), company: COMPANY, options: null, website: { kind: "none", url: null }, urls: { report: URLS.report, book: null, callbackApi: URLS.callbackApi } });
  ok(none.options.cards.length === 0 && none.header.website === null && none.questions.website === null && none.questions.book === null, "no re-pricing, no website, no calendar → no cards, no tiles, no buttons");
  ok(none.notes.emailed === estimateReportCopy("en").emailedCopyNone, "not emailed → the notes do not claim it was");
  const one = optionCards({ options: [OPTIONS.options[0]], chosenKey: null, currency: "CAD", language: "en", showPrices: true });
  ok(one.length === 1 && one[0].tier === null, "a single option is one card with no tier");
  const junk = optionCards({ options: [{ materialKey: null, label: null, low: "abc" }, { low: -5 }, null], chosenKey: null, currency: "CAD", language: "en", showPrices: true });
  ok(junk.length === 0, "hostile option rows produce no card");
  ok(imageryDateText({ imageryDate: { year: "x" } }) === null && imageryDateText({ imageryDate: { year: 2022 } }) === "2022", "imagery date: junk → null, year only → year");
  ok(isInstantEstimateQuote(quoteFor("roofing", "en")), "an instant draft is a report");
  ok(!isInstantEstimateQuote({ ...quoteFor("roofing", "en"), estimateSource: "phone_call" }), "a phone draft is not");
  ok(!isInstantEstimateQuote({ ...quoteFor("roofing", "en"), createdVia: "builder" }), "a builder quote is not");
  ok(!isInstantEstimateQuote({ ...quoteFor("roofing", "en"), autoEstimated: false }), "a hand quote with a token is not");
  const pl = buildEstimateReportModel({ quote: { ...quoteFor("roofing", "en"), language: "pl" }, company: COMPANY, options: OPTIONS, website: WEBSITE, urls: URLS });
  ok(pl.language === "en", "an unsupported document language renders English rather than a blank");
}

// ── 4. The website rule ─────────────────────────────────────────────────────
console.log("\nWebsite rule");
{
  const stock = "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=1600&q=80&auto=format&fit=crop";
  const own = "https://res.cloudinary.com/demo/image/upload/v1/fieldquo/c1/roof.jpg";
  const site = (over = {}) => ({ subdomain: "acme", published: true, blocks: [{ type: "hero", content: { backgroundImage: stock } }], pages: null, handEditedAt: null, photoLibrary: null, ...over });
  const r = (company, s) => resolveReportWebsite({ company, site: s });
  ok(r({ website: "acme.example" }, site()).kind === "own" && r({ website: "acme.example" }, site()).url === "https://acme.example/", "own site → own (scheme added)");
  ok(r({ website: null }, site()).kind === "none", "no own site + published but untouched → omitted");
  ok(r({ website: null }, site({ handEditedAt: "2026-01-01" })).kind === "fieldquo", "hand-edited → fieldquo");
  ok(r({ website: null }, site({ blocks: [{ type: "hero", content: { backgroundImage: own } }] })).url === "https://acme.fieldquo.com", "an own photo → fieldquo, at the subdomain URL");
  ok(r({ website: null }, site({ pages: [{ blocks: [{ type: "gallery", content: { images: [own] } }] }] })).kind === "fieldquo", "an own photo on a sub-page counts");
  ok(r({ website: null }, site({ photoLibrary: [{ url: own }] })).kind === "fieldquo", "a photo library upload counts");
  ok(r({ website: null }, site({ published: false, handEditedAt: "2026-01-01" })).kind === "none", "unpublished is never linked");
  ok(r({ website: null, instantReportWebsite: "fieldquo" }, site()).kind === "fieldquo", "setting fieldquo overrides the stock check");
  ok(r({ website: "acme.example", instantReportWebsite: "none" }, site()).kind === "none", "setting none wins over an own site");
  ok(r({ website: null, instantReportWebsite: "own" }, site({ handEditedAt: "2026-01-01" })).kind === "none", "setting own with no site on record → none, not a guess");
  ok(r({ website: "acme.example", instantReportWebsite: "garbage" }, site()).kind === "own", "an unknown setting reads as automatic");
  ok(ownWebsiteUrl({ website: "javascript:alert(1)" }) === null && ownWebsiteUrl({ website: "notaurl" }) === null, "a non-http website is no website");
  ok(!siteIsTailored(null) && !siteIsTailored({ published: true }), "no site / no subdomain → untailored");
}

// ── 5. Contrast on hostile brands ───────────────────────────────────────────
console.log("\nContrast");
for (const brand of ["#ffffff", "#c0c0c0", "#fefcdd", "#ffff00", "#000000", "#06356b", "#e11d48", "#7c7c7c"]) {
  const theme = documentTheme({ brandColor: brand });
  const fill = fillPair(theme);
  const wash = washPair(theme);
  const neutral = neutralPair(theme);
  const tiles = contrastRatio(fill.fg, fill.bg);
  const cardLabel = contrastRatio(wash.ink, wash.bg);
  const cardAccent = contrastRatio(wash.accent, wash.bg);
  const heading = contrastRatio(theme.accentText, theme.paper);
  const footer = contrastRatio(neutral.fg, neutral.bg);
  ok(tiles >= 4.5, `${brand}: tile text and starting-at figure on the fill ${tiles.toFixed(2)}:1`);
  ok(cardLabel >= 4.5 && cardAccent >= 4.5, `${brand}: option tile label ${cardLabel.toFixed(2)}:1, secondary button ${cardAccent.toFixed(2)}:1`);
  ok(heading >= 4.5 && footer >= 4.5, `${brand}: section headings ${heading.toFixed(2)}:1, footer ${footer.toFixed(2)}:1`);
}

// ── 6. The three buttons' targets ───────────────────────────────────────────
console.log("\nButtons");
{
  const r = buildEstimateReportModel({ quote: quoteFor("gutters", "fr"), company: COMPANY, options: OPTIONS, website: WEBSITE, urls: URLS });
  ok(r.questions.book.href === `${URLS.report}/book`, "book → the report's own prefilled booking page");
  ok(r.questions.callback.api === URLS.callbackApi && r.questions.callback.body.quoteId === "q1" && r.questions.callback.body.trade === "gutters" && r.questions.callback.body.language === "fr", "call back → the existing callback route with quoteId, trade and language");
  ok(r.questions.callback.prefill.name === "Sam Rivera" && r.questions.callback.prefill.phone === "(613) 555-0199", "call back form prefilled from the draft");
  ok(r.questions.website.href === WEBSITE.url && r.header.website.href === WEBSITE.url, "website button and tile share one target");
  ok(r.questions.callback.copy.timeOptions.map(([k]) => k).join() === "morning,afternoon,evening,anytime", "preferred-time keys are the callback route's");
  ok(r.header.call.href === "tel:6135550100" && r.header.email.href === "mailto:hello@acme.example", "call and email tiles dial and mail");
}

// ── 7. The map overlay ──────────────────────────────────────────────────────
console.log("\nMap overlay");
{
  const m = measurementFor("lawn_care");
  const outline = satelliteOutline(m);
  ok(outline && outline.width === 1280 && outline.height === 800 && outline.points.length === 4, "outline in returned-image pixels", outline && [outline.width, outline.height]);
  const scale = imageScale({ lat: 45.42, lng: -75.69, zoom: 20, scale: 2, width: 640, height: 400 });
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    const back = canvasPointToLatLng(outline.points[i], { center: { lat: 45.42, lng: -75.69 }, scaleInfo: scale, viewWidth: 1280, viewHeight: 800, fit: "meet" });
    worst = Math.max(worst, Math.abs(back.lat - POLY[i].lat) * 111000, Math.abs(back.lng - POLY[i].lng) * 78000);
  }
  ok(worst < 0.2, `projected points round-trip through canvasPointToLatLng within ${worst.toFixed(3)} m`);
  ok(outline.points.every((p) => p.x > 0 && p.x < 1280 && p.y > 0 && p.y < 800), "a 20 m outline sits inside a zoom-20 still");
  ok(/^[\d.]+,[\d.]+( [\d.]+,[\d.]+){3}$/.test(outlinePointsAttr(outline)), "SVG points attribute");
  ok(satelliteOutline({ ...m, polygon: [POLY[0], POLY[1]] , vertices: null }) === null, "under three vertices → no outline");
  ok(satelliteOutline({ ...m, satelliteSourceUrl: null, satelliteImageUrl: "https://res.cloudinary.com/x.png" }) === null, "a captured still with no source URL → no outline (never guessed)");
  ok(satelliteOutline({ ...m, satelliteSourceUrl: "https://maps.googleapis.com/maps/api/staticmap?size=640x400&scale=2&path=..." }) === null, "a path-fitted lawn still (no centre/zoom) → no outline");
  ok(satelliteOutline({ ...m, vertices: [{ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 }, { lat: 0, lng: 0.001 }] }) === null, "an outline off the picture → none");
  ok(satelliteOutline({ ...m, vertices: [{ lat: "x" }, {}, null, POLY[0], POLY[1], POLY[2]] })?.points.length === 3, "junk vertices dropped, real ones kept");
}

// ── 8. The emailed copy carries the report ──────────────────────────────────
console.log("\nEmail");
{
  const unescape = (h) => h.replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"');
  for (const language of LANGS) {
    const quote = quoteFor("roofing", language);
    quote.estimateData.measurement.vertices = POLY;
    const report = buildEstimateReportModel({ quote, company: COMPANY, options: OPTIONS, website: WEBSITE, urls: URLS, emailed: true });
    const { subject, html, text } = buildEstimateReportEmail({ report, company: COMPANY });
    const h = unescape(html);
    const cards = report.options.cards;
    const still = quote.estimateData.measurement.satelliteImageUrl;
    const missing = [];
    for (const card of cards) {
      if (!h.includes(card.label)) missing.push(`html: ${card.label}`);
      if (!h.includes(card.startingAt)) missing.push(`html: ${card.startingAt}`);
      if (!text.includes(card.label)) missing.push(`text: ${card.label}`);
      if (!text.includes(card.startingAt)) missing.push(`text: ${card.startingAt}`);
    }
    for (const [what, needle] of [
      ["address", "917 Littlerock St, Ottawa, ON"],
      ["map still", still],
      ["book URL", URLS.book],
      ["callback URL", `${URLS.report}#callback`],
      ["website URL", WEBSITE.url],
      ["report URL", URLS.report],
      ["report id", "Q-2026-0042"],
    ]) {
      if (!h.includes(needle)) missing.push(`html: ${what}`);
      if (!text.includes(needle)) missing.push(`text: ${what}`);
    }
    ok(missing.length === 0, `${language}: HTML and text carry both options, both figures, the address, the still and every button URL`, missing);
    ok(subject === report.email.subject && subject.includes("Acme Roofing"), `${language}: subject is the model's`);
    ok(/<table role="presentation"/.test(html) && !/<div class=|display:flex|<style/.test(html), `${language}: tables-based, no flex, no stylesheet`);
    ok(h.includes(report.title.text) && h.includes(report.questions.title) && h.includes(report.measurement.title) && h.includes(report.notes.nextTitle) && report.notes.disclaimers.every((d) => h.includes(d)), `${language}: title, three sections, next steps and both disclaimers present`);
    ok(!/undefined|NaN|\[object/.test(h) && !/undefined|NaN|\[object/.test(text), `${language}: nothing unrendered`);
    // The gate: same cards, no figure.
    const gated = buildEstimateReportModel({ quote, company: COMPANY, options: { ...OPTIONS, visibility: "gated" }, website: WEBSITE, urls: URLS });
    const g = unescape(buildEstimateReportEmail({ report: gated, company: COMPANY }).html);
    ok(cards.every((c) => g.includes(c.label)) && !cards.some((c) => g.includes(c.startingAt)), `${language}: a gated trade's email shows the cards without figures`);
    // The buttons follow the model: no calendar, no website → one button.
    const bare = buildEstimateReportModel({ quote, company: COMPANY, options: OPTIONS, website: { kind: "none", url: null }, urls: { report: URLS.report, book: null, callbackApi: URLS.callbackApi } });
    const b = buildEstimateReportEmail({ report: bare, company: COMPANY });
    ok(!b.html.includes(URLS.book) && !b.html.includes(WEBSITE.url) && b.html.includes(`${URLS.report}#callback`) && !b.text.includes(URLS.book), `${language}: no calendar and no website → only the call-back button, in HTML and text`);
  }
  // A hostile client name cannot break out of the markup.
  const nasty = quoteFor("roofing", "en");
  nasty.client.name = '<img src=x onerror=alert(1)>"';
  const nh = buildEstimateReportEmail({ report: buildEstimateReportModel({ quote: nasty, company: COMPANY, options: OPTIONS, website: WEBSITE, urls: URLS }), company: COMPANY }).html;
  ok(!nh.includes("<img src=x") && nh.includes("&lt;img src=x"), "a hostile client name is escaped in the email");
  // Contrast: every pair the email puts text on, on the hostile brands.
  for (const brand of ["#ffffff", "#c0c0c0", "#fefcdd", "#ffff00", "#000000"]) {
    const pal = estimateReportEmailPalette({ brandColor: brand });
    const under = pal.pairs.filter((p) => p.ratio < 4.5);
    ok(under.length === 0, `${brand}: every email text pair ≥ 4.5:1 (${pal.pairs.map((p) => p.ratio.toFixed(2)).join(" / ")})`, under.map((p) => p.name));
    // The palette is what the markup uses, not a separate list: the fill
    // and wash hexes appear in the HTML built for that brand.
    const rep = buildEstimateReportModel({ quote: quoteFor("roofing", "en"), company: { ...COMPANY, brandColor: brand }, options: OPTIONS, website: WEBSITE, urls: URLS });
    const hh = buildEstimateReportEmail({ report: rep, company: { ...COMPANY, brandColor: brand } }).html;
    ok(hh.includes(`bgcolor="${pal.fill.bg}"`) && hh.includes(`color:${pal.fill.fg}`) && hh.includes(`bgcolor="${pal.wash.bg}"`), `${brand}: the measured fill and wash are the ones in the markup`);
  }
}

// ── 9. PDF sections registered ──────────────────────────────────────────────
console.log("\nPDF sections");
{
  const reg = readFileSync(new URL("../lib/documentSections/registry.js", import.meta.url), "utf8");
  const types = ESTIMATE_REPORT_SECTIONS.map((s) => s.type);
  ok(types.every((t) => SECTION_META[t]), "every report section is described in sectionMeta", types.filter((t) => !SECTION_META[t]));
  ok(types.filter((t) => t.startsWith("report_")).every((t) => new RegExp(`\\b${t}:`).test(reg)), "every report section is in SECTION_REGISTRY");
  ok(!sectionsForType("quote_pdf").some((t) => t.startsWith("report_")) && !sectionsForType("invoice_pdf").some((t) => t.startsWith("report_")), "report sections are never offered on a quote or invoice template");
  ok(sectionsForType("estimate_report_pdf").filter((t) => t.startsWith("report_")).length === 6, "six report sections for the report kind");
  ok(types[0] === "report_header" && types[types.length - 1] === "footer", "header first, shared footer last");
}

console.log(fail ? `\n${fail} failure(s)` : "\nAll estimate-report checks passed.");
process.exit(fail ? 1 : 0);
