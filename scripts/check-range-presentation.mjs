// scripts/check-range-presentation.mjs
//
//   npm run check:range-presentation
//
// "The same presentation but with the range" (owner, 2026-09-22): the
// instant-estimate page a homeowner lands on (app/estimate-report/[token]) is
// the company's proposal — the sections the quote page (app/q/[token]) draws —
// with a RANGE where a quote's prices would be, labelled as an estimate
// subject to a site visit. This proves the four things that make that true
// and safe, by RENDERING the page rather than reading it:
//
//   1. No exact price leaves the server. The model and the rendered HTML are
//      built from a fixture whose point estimate, line prices and line totals
//      are distinctive numbers; none of them may appear, and every currency
//      figure in the HTML must be one of the range's two ends or a "starting
//      at" card the report has always carried (non-negotiable #4).
//   2. One set of section components. QuoteApproval and ReportView both
//      import app/components/public/proposal/ProposalSections.js and neither
//      carries its own copy of a section (AGENTS.md recurring failure 4).
//   3. The copy exists in all eight document languages.
//   4. Contrast, measured on hostile brand colours, for every new pairing.
//
// Bundled through esbuild (like check:doc-builder) because the page is JSX.
// The one database-reading module the page uses (lib/estimate/report/
// presentation.js) is not imported by the component, which is itself part
// of what this proves.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildEstimateReportModel } from "../lib/estimate/report/model.js";
import ReportView from "../app/estimate-report/[token]/ReportView.js";
import { estimateRange } from "../lib/estimate/estimateMoney.js";
import { instantQuoteLocale } from "../lib/i18n/instantQuoteCopy.js";
import { CLIENT_DOC_COPY } from "../lib/i18n/clientDocCopy.js";
import { documentTheme, fillPair, washPair, ruleColor } from "../lib/documents/theme.js";
import { contrastRatio } from "../lib/brand/colour.js";
import { EMPTY_PROPOSAL } from "../lib/proposal/sections.js";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got === undefined ? "" : `  — got ${JSON.stringify(got)}`}`);
  }
};

// ── Fixture: every number that must NOT leave is distinctive ─────────────────
const LOW = 9800;
const HIGH = 12950;
const POINT = 11437; // the exact estimate — never shown
const LINE_UNIT = 37.25; // a per-unit rate on a stored line
const LINE_TOTAL = 4321.99; // a line total
const OPTIONS = {
  ok: true,
  visibility: "after_submit", // → "range" once confirmed
  options: [
    { materialKey: "metal", label: "Standing seam metal", low: 31850, high: 42000, point: 36613, unit: null },
    { materialKey: "asphalt_3tab", label: "3-tab asphalt shingles", low: LOW, high: HIGH, point: POINT, unit: null },
  ],
};
const COMPANY = {
  id: "c1", name: "Acme Roofing", slug: "acme", phone: "(613) 555-0100", email: "hello@acme.example",
  website: "https://acmeroofing.example", logoUrl: null, brandColor: "#06356b", currency: "CAD",
};
const quoteFor = (language, extra = {}) => ({
  id: "q1", companyId: "c1", quoteNumber: "Q-2026-0042", language, quoteType: "roofing",
  autoEstimated: true, createdVia: "instant_quote", estimateSource: "google_solar",
  createdAt: "2026-09-18T12:00:00.000Z", shareToken: "tok",
  estimateData: {
    trade: "roofing",
    materialKey: "asphalt_3tab",
    measurement: { areaSqft: 2450, squares: 24.5, predominantPitch: { rise: 6, run: 12 } },
    range: { low: LOW, point: POINT, high: HIGH },
    // What createEstimateDraft stores for the record — lines with a rate and
    // a total. The presentation must never read it.
    breakdown: [{ label: "Tear-off", qty: 24.5, unitPrice: LINE_UNIT, total: LINE_TOTAL }],
    ...extra,
  },
  client: { name: "Sam Rivera", email: "sam@example.com", phone: "(613) 555-0199", address: "917 Littlerock St, Ottawa, ON" },
});
const URLS = {
  report: "https://www.example.com/estimate-report/tok",
  book: "https://www.example.com/estimate-report/tok/book",
  callbackApi: "https://www.example.com/api/instant-quote/acme/callback",
};
const PRESENTATION = {
  proposal: {
    sections: ["about", "beforeAfter", "testimonials", "services"],
    about: { headline: "Family run since 1998", story: "We re-roof homes across the valley.", videoUrl: null, teamPhotoUrl: null },
    gallery: [{ before: "https://res.cloudinary.com/demo/b.jpg", after: "https://res.cloudinary.com/demo/a.jpg", caption: "Maple St" }],
    documents: [],
    testimonials: [{ quote: "Tidy crew, on time.", author: "J. Park" }],
    services: [{ key: "gutter_services", label: "Gutters" }],
  },
  processSteps: [
    { num: 1, title: "Site visit", body: "We confirm the measurements on the roof itself." },
    { num: 2, title: "Tear-off", body: "Old shingles off, deck inspected." },
  ],
};

const render = (report, presentation = PRESENTATION, company = COMPANY) =>
  renderToStaticMarkup(React.createElement(ReportView, { report, company, token: "tok", presentation }));

// Every way a number can be printed: plain, grouped with a comma, a space, a
// narrow no-break space or a period, and with two decimals.
function spellings(n) {
  const int = String(Math.trunc(n));
  const grouped = (sep) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const out = new Set([int, grouped(","), grouped(" "), grouped(" "), grouped(" "), grouped(".")]);
  if (!Number.isInteger(n)) {
    // A cents figure is looked for WITH its cents: "37" alone would match a
    // street number and prove nothing.
    const [, dec] = n.toFixed(2).split(".");
    return [...out].flatMap((s) => [`${s}.${dec}`, `${s},${dec}`]);
  }
  return [...out];
}

// ── 1. The model carries the range as one string, and nothing more ───────────
console.log("\n1. The model: the range the homeowner was shown, as one string");
for (const language of ["en", "fr", "es"]) {
  const report = buildEstimateReportModel({ quote: quoteFor(language), company: COMPANY, options: OPTIONS, urls: URLS, emailed: true });
  const expected = estimateRange(LOW, HIGH, "CAD", instantQuoteLocale(language));
  ok(`${language}: rangeText is the stored low–high in the document's locale`, report.estimate.rangeText === expected, report.estimate.rangeText);
  ok(`${language}: it names the option picked`, report.estimate.optionLabel === "3-tab asphalt shingles");
  const flat = JSON.stringify(report);
  const leaked = [POINT, LINE_UNIT, LINE_TOTAL, 36613].flatMap(spellings).filter((s) => flat.includes(s));
  ok(`${language}: no point estimate, no line rate, no line total anywhere in the model`, leaked.length === 0, leaked);
  ok(`${language}: no breakdown key in the model`, !/breakdown|unitPrice|"point"/.test(flat));
}
{
  const gated = buildEstimateReportModel({ quote: quoteFor("en"), company: COMPANY, options: { ...OPTIONS, visibility: "gated" }, urls: URLS });
  ok("a gated trade has no range at all", gated.estimate.rangeText === null && gated.estimate.optionLabel === null);
  const off = buildEstimateReportModel({ quote: quoteFor("en"), company: COMPANY, options: null, urls: URLS });
  ok("a trade that no longer prices has no range (the cards' own gate)", off.estimate.rangeText === null);
  for (const [label, range] of [
    ["a zero low", { low: 0, high: 5000 }],
    ["an inverted pair", { low: 9000, high: 100 }],
    ["strings", { low: "abc", high: "def" }],
    ["no range stored", undefined],
    ["an array", [1, 2]],
  ]) {
    const r = buildEstimateReportModel({ quote: quoteFor("en", { range }), company: COMPANY, options: OPTIONS, urls: URLS });
    ok(`hostile stored range (${label}) draws no figure rather than "$0"`, r.estimate.rangeText === null, r.estimate.rangeText);
  }
}

// ── 2. The rendered page ─────────────────────────────────────────────────────
console.log("\n2. The rendered page: the proposal, with the range and no exact price");
for (const language of ["en", "fr", "es"]) {
  const report = buildEstimateReportModel({ quote: quoteFor(language), company: COMPANY, options: OPTIONS, urls: URLS, emailed: true });
  const html = render(report);
  const rp = CLIENT_DOC_COPY[language].rangeProposal;
  const text = html.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
  ok(`${language}: the range is on the page`, text.includes(report.estimate.rangeText));
  ok(`${language}: labelled "subject to a site visit" in the document's language`, text.includes(rp.subjectToVisit) && text.includes(rp.estimatedRange));
  const leaked = [POINT, LINE_UNIT, LINE_TOTAL, 36613].flatMap(spellings).filter((s) => text.includes(s));
  ok(`${language}: no point estimate, line rate or line total in the HTML`, leaked.length === 0, leaked);
  // Every money figure on the page is a range end or a "starting at" card.
  const allowed = new Set([...spellings(LOW), ...spellings(HIGH), ...spellings(31850)]);
  // Text nodes only: a hex colour in a style or an icon's path data is not a
  // figure a homeowner reads.
  const visible = text.replace(/<[^>]*>/g, " ");
  const money = [...visible.matchAll(/(\d{1,3}(?:[ ,.  ]\d{3})+|\d{4,})/g)].map((m) => m[1]);
  const stray = money.filter((m) => !allowed.has(m) && !/^(2026|1998|0042|0100|0199|2450|6135550100)$/.test(m.replace(/\D/g, "")));
  ok(`${language}: every figure on the page is a range end or a starting-at card`, stray.length === 0, stray);
  ok(`${language}: the company sections are drawn from the shared projection`, /id="about"/.test(html) && /id="before-after"/.test(html) && /id="testimonials"/.test(html) && /id="services"/.test(html));
  ok(`${language}: …and the documents section, empty, is not`, !/id="documents"/.test(html));
  ok(`${language}: what happens next, with the trade's numbered steps`, /id="next-steps"/.test(html) && text.includes("Site visit") && text.includes(rp.whatHappensNext));
  ok(`${language}: the call to action books the visit`, html.includes(URLS.book) && text.includes(rp.bookVisit));
  ok(`${language}: no Accept control — a range is not a price anyone can accept`, !/Accept quote|Accepter la soumission|Aceptar/i.test(text));
  ok(`${language}: white label — FieldQuo is nowhere on the page`, !/fieldquo/i.test(html));
  ok(`${language}: the call-back form still carries the draft, and no figure`, !spellings(LOW).concat(spellings(HIGH)).some((s) => JSON.stringify(report.questions.callback).includes(s)));
}
{
  const report = buildEstimateReportModel({ quote: quoteFor("en"), company: COMPANY, options: { ...OPTIONS, visibility: "gated" }, urls: { ...URLS, book: null } });
  const html = render(report, { proposal: EMPTY_PROPOSAL, processSteps: [] });
  const text = html.replace(/&#x27;/g, "'");
  ok("gated: the band says who confirms the price, with no figure", text.includes(CLIENT_DOC_COPY.en.rangeProposal.noRange("Acme Roofing")) && !spellings(LOW).some((s) => text.includes(s)));
  ok("no calendar: the call to action is the call-back form on the page", /href="#callback"/.test(html) && text.includes(CLIENT_DOC_COPY.en.rangeProposal.talkToUs));
  ok("nothing loaded: no company section, no heading over nothing", !/id="about"|id="before-after"|id="testimonials"|id="services"|id="documents"/.test(html));
}

// ── 3. One set of section components ─────────────────────────────────────────
console.log("\n3. The quote and the estimate draw the company with the same components");
{
  const shared = strip(read("app/components/public/proposal/ProposalSections.js"));
  const quote = strip(read("app/q/[token]/QuoteApproval.js"));
  const view = strip(read("app/estimate-report/[token]/ReportView.js"));
  const load = strip(read("lib/proposal/load.js"));
  const route = strip(read("app/api/public/quotes/[token]/route.js"));
  const pres = strip(read("lib/estimate/report/presentation.js"));
  const imports = (src) => /from "@\/app\/components\/public\/proposal\/ProposalSections"/.test(src);
  ok("QuoteApproval imports the shared sections", imports(quote) && /<CompanySections /.test(quote) && /<ProcessStepList /.test(quote));
  ok("ReportView imports the same", imports(view) && /<CompanySections /.test(view) && /<ProcessStepList /.test(view));
  for (const [name, src] of [["QuoteApproval", quote], ["ReportView", view]]) {
    ok(`${name} carries no copy of a section`, !/function ProposalSection\(|function SectionKicker\(|const SECTION_IDS = \{|copy\.proposal\.whatClientsSaid|copy\.proposal\.recentWork/.test(src));
  }
  ok("the shared file draws a section only when the server listed it", /on\("about"\)/.test(shared) && /on\("documents"\)/.test(shared) && /const on = \(key\) => Array\.isArray\(sectionKeys\) && sectionKeys\.includes\(key\)/.test(shared));
  ok("the shared file is not a client component and selects no price", !/"use client"/.test(shared) && !/price|amount|total|rate\b/i.test(shared.replace(/import[^;]+;/g, "")));
  ok("one projection for both pages (projectProposal)", /export function projectProposal/.test(load) && /\.\.\.projectProposal\(\{ content, sections \}\)/.test(route) && /projectProposal\(loaded\)/.test(pres));
  ok("the projection publishes only rendered sections' content", /about: on\("about"\) \? content\?\.about \|\| null : null/.test(load) && /gallery: on\("beforeAfter"\) \? content\?\.gallery \|\| \[\] : \[\]/.test(load));
  ok("ReportView reads no database module", !/@\/lib\/db"|report\/presentation"/.test(view));
  ok("the page loads the presentation and hands it down", /loadEstimatePresentation\(\{ quote: loaded\.quote, language: loaded\.report\.language \}\)/.test(strip(read("app/estimate-report/[token]/page.js"))));
  ok("the model never reads the stored point or breakdown for the range", /publicEstimate\(data\.range, "range"\)/.test(strip(read("lib/estimate/report/model.js"))) && !/data\.range\.point|data\.breakdown/.test(strip(read("lib/estimate/report/model.js"))));
}

// ── 4. The copy, in the eight document languages ─────────────────────────────
console.log("\n4. The presentation's words in en, fr, es, it, de, uk, pa, tl");
{
  const LANGS = ["en", "fr", "es", "it", "de", "uk", "pa", "tl"];
  const keys = Object.keys(CLIENT_DOC_COPY.en.rangeProposal);
  for (const l of LANGS) {
    const rp = CLIENT_DOC_COPY[l]?.rangeProposal;
    ok(`${l}: every key present`, Boolean(rp) && keys.every((k) => k in rp), rp && keys.filter((k) => !(k in rp)));
    if (!rp || l === "en") continue;
    const same = keys.filter((k) => {
      const a = typeof rp[k] === "function" ? rp[k]("X") : rp[k];
      const b = typeof CLIENT_DOC_COPY.en.rangeProposal[k] === "function" ? CLIENT_DOC_COPY.en.rangeProposal[k]("X") : CLIENT_DOC_COPY.en.rangeProposal[k];
      // "Estimate" is spelled the same in Tagalog usage — the word they use.
      return a === b && !(l === "tl" && k === "estimateWord");
    });
    ok(`${l}: nothing is still English`, same.length === 0, same);
    ok(`${l}: never names FieldQuo`, !/fieldquo/i.test(JSON.stringify(Object.values(rp).map((v) => (typeof v === "function" ? v("X") : v)))));
  }
}

// ── 5. Contrast, measured on hostile brands ──────────────────────────────────
console.log("\n5. Every new pairing measures 4.5:1 on hostile brand colours");
{
  const PAGE = "#f5f2ec"; // the proposal page behind the cards (both pages)
  for (const hex of ["#ffffff", "#c0c0c0", "#fefcdd", "#ffff00", "#bd9d60", "#808080", "#000000", "#06356b", "#ff0000"]) {
    const theme = documentTheme({ brandColor: hex });
    const fill = fillPair(theme);
    const wash = washPair(theme);
    const pairs = {
      "range band / CTA text on its fill": contrastRatio(fill.fg, fill.bg),
      "mobile contents chip (wash ink on wash)": contrastRatio(wash.ink, wash.bg),
      "desktop contents link (ink on the page)": contrastRatio(theme.ink, PAGE),
      "range note (inkMuted on paper)": contrastRatio(theme.inkMuted, theme.paper),
      "kicker (accentText on paper)": contrastRatio(theme.accentText, theme.paper),
    };
    const bad = Object.entries(pairs).filter(([, r]) => r < 4.5).map(([k, r]) => `${k} ${r.toFixed(2)}`);
    ok(`${hex}: ${Object.values(pairs).map((r) => r.toFixed(2)).join(" / ")}`, bad.length === 0, bad);
    // A fill that is invisible against the page would be a band with no edge;
    // the CTA carries an accentText border for exactly that case.
    ok(`${hex}: the CTA's edge is visible on white (accentText ≥ 3:1)`, contrastRatio(theme.accentText, "#ffffff") >= 3);
    ok(`${hex}: the rule is a visible hairline`, contrastRatio(ruleColor(theme), "#ffffff") >= 1.6);
  }
  // Why the desktop contents use ink, not inkMuted: measured, not assumed.
  const muted = contrastRatio(documentTheme({}).inkMuted, PAGE);
  ok(`inkMuted on the #f5f2ec page measures ${muted.toFixed(2)}:1 — under 4.5, so the presentation does not use it there`, muted < 4.5);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
