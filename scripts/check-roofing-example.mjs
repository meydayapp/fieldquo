// scripts/check-roofing-example.mjs
//
//   npm run check:roofing-example
//
// The roofing walk-through on /industries/roofing#instant-quote-example
// (app/(marketing)/industries/[slug]/showcase/). Three files, one claim each:
//
//   this file                          the numbers are the product's numbers,
//                                      the words exist in every language, and
//                                      no section can reach the network
//   check-roofing-example-render.mjs   the sections render, in every
//                                      language, and Approve moves step 4
//   check-roofing-example-browser.mjs  the page at 375 and 1280 in Chrome,
//                                      walked end to end with every request
//                                      recorded — runs when ROOFING_EXAMPLE_URL
//                                      names a running build, skipped (and
//                                      said so) otherwise
//
// ══ Why the prices are checked against the DATABASE path ══════════════════
//
// The showcase prices in the browser through ./roofingRun.js, which calls the
// estimator directly because the route's entry points (priceAllMaterials,
// priceOneMaterial, createEstimateDraft, createScoredLead) read the database.
// "It calls the same function" is a claim about the source; this file makes
// it a claim about output. Under scripts/db-stub-loader.mjs the REAL entry
// points run against a company whose saved instant-quote row is the fixture's,
// and every figure the showcase shows — each option's range, the chosen
// estimate, the draft's lines, tax and total, the lead's score — has to come
// out identical, for every option at every tear-off count the form accepts.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { rows, writes, resetDbStub } from "@/lib/db";
import { priceAllMaterials, priceOneMaterial, loadMaterialLabels, materialLabelSlot } from "@/lib/estimate/instantQuoteServer";
import { appliedTaxRate, documentLinesTotal } from "@/lib/estimate/approveEstimate";
import { createEstimateDraft } from "@/lib/estimate/createEstimateQuote";
import { createScoredLead } from "@/lib/leads/createLead";
import { INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";
import { primaryCategoryForInstantTrade } from "@/lib/trades/catalog";
import { steepnessTier } from "@/lib/measure/roofMeasurement";
import { ROOF_MEASUREMENT } from "@/docs/screens/app-guide/harness/fixtures/takeoffs.js";
import { INDUSTRY_MESSAGES, industryShowcaseFor, industryChromeFor } from "@/app/i18n/industries";
import { buildRoofingShowcase, SHOWCASE_COMPANY } from "@/app/(marketing)/industries/[slug]/showcase/buildRoofingShowcase.js";
import { industryShowcase, INDUSTRY_SHOWCASES } from "@/app/(marketing)/industries/[slug]/showcase/registry.js";
import {
  runRequest,
  defaultBody,
  priceWorkings,
  measurementFor,
  tearOffLayersFrom,
} from "@/app/(marketing)/industries/[slug]/showcase/roofingRun.js";
import { SUMMIT_RIDGE_CONTENT } from "@/app/(marketing)/industries/[slug]/showcase/summitRidgeContent.js";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";

let pass = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fails.push(name);
    console.log(`  FAIL ${name}${detail !== undefined ? `\n       ${JSON.stringify(detail).slice(0, 600)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);
const read = (p) => readFileSync(p, "utf8");
const DIR = "app/(marketing)/industries/[slug]/showcase";
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const fixture = buildRoofingShowcase();
const MATERIALS = fixture.config.materials.map((m) => m.key);
const LAYERS = [0, 1, 2, 3];

/* ═════════════════════════ 1. The fixture is what it says ════════════════ */

section("1. The fixture");
ok("the price book is the roofing seed Settings starts from, unconverted", JSON.stringify(fixture.config.materials) === JSON.stringify(INSTANT_ESTIMATE_DEFAULTS.roofing.materials) && fixture.config.tearOffPerSquarePerLayer === INSTANT_ESTIMATE_DEFAULTS.roofing.tearOffPerSquarePerLayer && fixture.config.rangeBandPct === INSTANT_ESTIMATE_DEFAULTS.roofing.rangeBandPct && fixture.config.minCharge === INSTANT_ESTIMATE_DEFAULTS.roofing.minCharge);
ok("the only owner choices on it are 'range after submit' and 'no photos'", fixture.config.estimateVisibility === "after_submit" && JSON.stringify(fixture.config.fields) === JSON.stringify({ photos: "hidden" }));
ok("the roof is the harness's measured roof", fixture.measurement.squares === ROOF_MEASUREMENT.squares && fixture.measurement.areaSqft === ROOF_MEASUREMENT.areaSqft && fixture.measurement.predominantPitch.rise === ROOF_MEASUREMENT.predominantPitch.rise);
ok("…tiered by steepnessTier(), what measureRoof() stores", fixture.measurement.steepness === steepnessTier(ROOF_MEASUREMENT.predominantPitch.rise), fixture.measurement.steepness);
ok("the roof picture is a drawing on this page, not a Google tile", /^data:image\/svg\+xml/.test(fixture.measurement.satelliteImageUrl) && !/googleapis|maps\.google|google\.com/i.test(JSON.stringify(fixture)));
ok("the company is Summit Ridge Roofing, fictional contact details only", fixture.company.name === "Summit Ridge Roofing" && /555-01\d\d/.test(fixture.company.phone) && /@example\.com$/.test(fixture.company.email) && fixture.company.address === "Ottawa, ON");
ok("the homeowner is fictional too", /@example\.com$/.test(fixture.homeowner.email) && /555-01\d\d/.test(fixture.homeowner.phone));
ok("no testimonials — a fictional company's reviews would be fabricated", fixture.presentation.proposal.testimonials.length === 0 && !fixture.presentation.proposal.sections.includes("testimonials"));
ok("the owner's About is used verbatim", fixture.presentation.proposal.about.story === SUMMIT_RIDGE_CONTENT.about.story && fixture.presentation.proposal.about.headline === SUMMIT_RIDGE_CONTENT.about.headline);
ok("…the nine process steps", fixture.presentation.processSteps.length === 9 && fixture.presentation.processSteps.every((s, i) => s.num === i + 1 && s.title && s.body));
ok("…the ten acknowledgements, as two waivers of five (the WaiverSign limit)", fixture.presentation.proposal.waivers.length === 2 && fixture.presentation.proposal.waivers.every((w) => w.sections.length === 5 && w.acknowledgements.length === 5) && fixture.presentation.proposal.waivers.flatMap((w) => w.sections.map((s) => s.heading)).join("|") === SUMMIT_RIDGE_CONTENT.waivers.map((w) => w.title).join("|"));
ok("the insurance document keeps its SAMPLE / DEMO marking", /SAMPLE \/ DEMO/.test(fixture.presentation.proposal.documents[0].title) && fixture.presentation.proposal.documents[0].url.endsWith(".pdf"));
const assets = ["logo-mark.webp", "team.webp", "roof-before.webp", "roof-after.webp", "insurance-certificate-SAMPLE.pdf"];
const onDisk = new Set(readdirSync("public/demo/summit-ridge"));
ok("every demo asset the fixture names is in public/demo/summit-ridge", assets.every((a) => onDisk.has(a)) && JSON.stringify(fixture).split("/demo/summit-ridge/").slice(1).every((s) => onDisk.has(s.split('"')[0])));
{
  const sizes = assets.filter((a) => a.endsWith(".webp")).map((a) => readFileSync(join("public/demo/summit-ridge", a)).length);
  ok("each image is compressed to 250 KB or less", sizes.every((n) => n <= 250 * 1024), sizes);
}
{
  const theme = documentTheme({ brandColor: fixture.company.brandColor });
  const fill = fillPair(theme);
  ok("the brand's measured accent clears 4.5:1 on paper", contrastRatio(theme.accentText, theme.paper) >= 4.5, { accent: theme.accentText, paper: theme.paper });
  ok("…and its button pair clears 4.5:1", contrastRatio(fill.fg, fill.bg) >= 4.5, fill);
}

/* ═════════════════════════ 2. The registry ═══════════════════════════════ */

section("2. Which trades have a showcase — data, not a branch");
ok("roofing has one, at #instant-quote-example", industryShowcase("roofing")?.anchor === "instant-quote-example");
ok("no other trade has one", Object.keys(INDUSTRY_SHOWCASES).join() === "roofing" && industryShowcase("painting") === null && industryShowcase("__proto__") === null);
{
  const content = stripComments(read("app/(marketing)/industries/[slug]/IndustryPageContent.js"));
  ok("the template never tests for roofing (it maps a showcase KIND to its view)", !/["'`]roofing["'`]|slug\s*===\s*["'`]/.test(content) && /SHOWCASE_VIEWS\[showcase\.kind\]/.test(content));
  ok("the hero CTA is drawn only when a showcase view exists, and links to its anchor", /ShowcaseView && \(\s*<a\s+href=\{`#\$\{showcase\.anchor\}`\}/.test(content));
  ok("…beside the existing trial and talk-to-us links, which are unchanged", /href="\/signup"[\s\S]*chrome\.startTrial[\s\S]*href="\/contact"[\s\S]*chrome\.talkToUs[\s\S]*chrome\.seeItInAction/.test(content));
}

/* ═════════════════════════ 3. Prices = the product's prices ══════════════ */

section("3. Every price is what the real entry points produce for this roof");
const COMPANY_ID = "co_summit";
const categoryKey = primaryCategoryForInstantTrade("roofing");
function seed() {
  resetDbStub();
  rows.company = [{ id: COMPANY_ID, slug: SHOWCASE_COMPANY.slug, name: SHOWCASE_COMPANY.name, defaultLanguage: "en", currency: "CAD", province: "ON", country: "CA", taxRates: null, financing: null }];
  rows.instantQuoteConfig = [{ companyId: COMPANY_ID, trade: "roofing", enabled: true, config: fixture.config }];
  rows.serviceCategory = [{ id: "cat_roof", key: categoryKey, label: "Roofing" }];
  rows.companyServiceCategory = [{ id: "ccs_roof", companyId: COMPANY_ID, enabled: true, rates: null, category: { key: categoryKey } }];
}
ok("roofing files under a real catalogue category", Boolean(categoryKey), categoryKey);
seed();
let compared = 0;
let mismatches = [];
for (const layers of LAYERS) {
  const intake = { tearOffLayers: String(layers) };
  const measurement = measurementFor(fixture, intake);
  const all = await priceAllMaterials({ companyId: COMPANY_ID, trade: "roofing", measurement });
  for (const materialKey of MATERIALS) {
    const run = runRequest(fixture, { ...defaultBody(fixture, "en"), materialKey, intake });
    const one = await priceOneMaterial({ companyId: COMPANY_ID, trade: "roofing", materialKey, measurement });
    const real = all.ok ? all.options.find((o) => o.materialKey === materialKey) : null;
    const mine = run.options.options.find((o) => o.materialKey === materialKey);
    compared += 1;
    const same =
      one.ok &&
      real &&
      mine &&
      [real.low, real.point, real.high].join() === [mine.low, mine.point, mine.high].join() &&
      [one.estimate.low, one.estimate.point, one.estimate.high].join() === [run.estimate.low, run.estimate.point, run.estimate.high].join() &&
      JSON.stringify(one.estimate.breakdown.map((b) => b.amount)) === JSON.stringify(run.estimate.breakdown.map((b) => b.amount));
    if (!same) mismatches.push({ layers, materialKey, real, mine, one: one.estimate, run: run.estimate });
  }
}
ok(`priceAllMaterials and priceOneMaterial agree with the showcase on all ${compared} option × tear-off combinations`, compared === MATERIALS.length * LAYERS.length && mismatches.length === 0, mismatches[0]);
ok("the tear-off clamp is measureForTrade()'s: blank, negative and fractional all behave as the route does", tearOffLayersFrom({}) === 0 && tearOffLayersFrom({ tearOffLayers: "-3" }) === 0 && tearOffLayersFrom({ tearOffLayers: "2.9" }) === 2 && tearOffLayersFrom({ tearOffLayers: "abc" }) === 0);
{
  const route = read("lib/estimate/instantQuoteServer.js");
  ok("…and that clamp is still the route's own line", route.includes("Math.max(0, Math.floor(Number(input?.intake?.tearOffLayers) || 0))"));
}

section("4. The draft, the lead and the review are createEstimateDraft's and createScoredLead's");
for (const [label, body] of [
  ["the default request", defaultBody(fixture, "en")],
  ["architectural, one layer (where the estimator's rounding used to show)", { ...defaultBody(fixture, "en"), intake: { tearOffLayers: "1" } }],
  ["standing seam, no tear-off, a French form", { ...defaultBody(fixture, "fr"), materialKey: "metal_standing_seam", intake: { tearOffLayers: "0" }, budgetBandIndex: 2 }],
]) {
  seed();
  const run = runRequest(fixture, body);
  const measurement = measurementFor(fixture, body.intake);
  const priced = await priceOneMaterial({ companyId: COMPANY_ID, trade: "roofing", materialKey: body.materialKey, measurement, language: body.language });
  await createEstimateDraft({
    createdVia: "instant_quote",
    company: rows.company[0],
    trade: "roofing",
    categoryId: priced.categoryId,
    contact: { name: body.name, email: body.email, phone: body.phone },
    measurement: run.draft.estimateData.measurement,
    materialKey: body.materialKey,
    estimate: priced.estimate,
    source: priced.source,
    address: body.address,
    province: "ON",
    country: "CA",
    language: body.language,
    homeowner: { whenNeeded: run.draft.estimateData.homeowner.whenNeeded, answers: run.draft.estimateData.homeowner.answers, notes: null, trade: "roofing" },
    budget: run.draft.estimateData.budget,
  });
  const q = [...writes].reverse().find((w) => w.model === "quote" && w.action === "create")?.data;
  ok(`${label}: subtotal, tax and total are the real draft's`, q && Number(q.subtotal) === run.draft.subtotal && Number(q.tax) === run.draft.tax && Number(q.total) === run.draft.total, { real: q && [q.subtotal, q.tax, q.total], mine: [run.draft.subtotal, run.draft.tax, run.draft.total] });
  // A French or Spanish form names the option in that language: the real
  // path reads the company's drafted translation (lib/i18n/phrases.js, not
  // scripted in the stub, so it prints the saved English name), the showcase
  // reads its own. Everything but that one name must match exactly.
  const own = fixture.config.materials.find((m) => m.key === body.materialKey)?.label || "";
  const theirs = fixture.materialLabels?.[body.language]?.[body.materialKey] || own;
  const realLines = q ? q.lineItems.map((l) => [String(l.description).replace(own, theirs), l.quantity, l.amount]) : null;
  ok(`${label}: …the lines, word for word and cent for cent`, q && JSON.stringify(realLines) === JSON.stringify(run.draft.lineItems.map((l) => [l.description, l.quantity, l.amount])), { real: q?.lineItems, mine: run.draft.lineItems });
  ok(`${label}: …the range the homeowner saw and the review notes`, q && JSON.stringify(q.estimateData.range) === JSON.stringify(run.draft.estimateData.range) && (q.reviewNotes || null) === (run.draft.reviewNotes || null), { real: q?.reviewNotes, mine: run.draft.reviewNotes });
  ok(`${label}: the review card approves at that total`, run.review.total === run.draft.total && run.review.quoteNumber === run.draft.quoteNumber);
  ok(`${label}: the homeowner's reply reveals that range`, run.reply.estimate && run.reply.estimate.low === run.estimate.low && run.reply.estimate.high === run.estimate.high);
  const w = priceWorkings(fixture, run);
  ok(`${label}: the working adds up — rows = subtotal, subtotal + tax = total`, w.rounding === 0 && w.lines.reduce((s, l) => s + l.amount, 0) === w.subtotal && Math.round((w.subtotal + w.tax) * 100) === Math.round(w.total * 100), w);
  ok(`${label}: the mini quote's lines add up to its subtotal`, Math.round(run.draft.lineItems.reduce((s, l) => s + Number(l.amount), 0) * 100) === Math.round(run.draft.subtotal * 100), { lines: run.draft.lineItems.map((l) => l.amount), subtotal: run.draft.subtotal });

  // The two figures GET /api/quotes/estimate-reviews adds beside the money,
  // worked by the route's own calls on the row createEstimateDraft wrote —
  // its taxResolution record and its scope group — against the sample's.
  const realRate = q && appliedTaxRate(q);
  const realLinesTotal = q && documentLinesTotal({ lineItems: q.lineItems, scopeGroups: q.scopeGroups?.create || [] });
  ok(`${label}: the review row's taxRate and linesTotal are the route's for the real draft`, q && run.review.taxRate === realRate && run.review.linesTotal === realLinesTotal && run.review.taxRate === fixture.tax.rate, { real: [realRate, realLinesTotal], mine: [run.review.taxRate, run.review.linesTotal] });
  ok(`${label}: …with the subtotal and tax beside them, so the "before tax + tax" caption renders`, q && run.review.subtotal === Number(q.subtotal) && run.review.tax === Number(q.tax) && run.review.discount === 0 && run.review.taxEnabled === true && run.review.linesTotal === run.review.subtotal);
  ok(`${label}: …and the draft's tax record is the one createEstimateDraft wrote`, q && JSON.stringify(run.draft.taxResolution) === JSON.stringify(q.taxResolution), { real: q?.taxResolution, mine: run.draft.taxResolution });

  // The option's name, as GET /api/leads/[id] and the review queue send it.
  const named = (await loadMaterialLabels(COMPANY_ID, [{ trade: "roofing", key: body.materialKey }]))[materialLabelSlot("roofing", body.materialKey)] || null;
  ok(`${label}: the lead and the review row name the option by loadMaterialLabels' label`, named && run.lead.materialLabel?.label === named.label && run.review.materialLabel?.label === named.label, { real: named, lead: run.lead.materialLabel, review: run.review.materialLabel });

  const lead = await createScoredLead({
    companyId: COMPANY_ID,
    name: body.name,
    email: body.email,
    phone: body.phone,
    source: "instant_quote",
    message: run.lead.message,
    budgetBand: run.lead.budgetBand,
    timeline: run.lead.timeline,
    clientPhotos: [],
    intake: run.lead.intake,
    language: body.language,
  });
  ok(`${label}: the lead's score, band and reasons are createScoredLead's`, lead && lead.score === run.lead.score && lead.temperature === run.lead.temperature && JSON.stringify(lead.scoreReasons) === JSON.stringify(run.lead.scoreReasons), { real: lead && [lead.score, lead.temperature], mine: [run.lead.score, run.lead.temperature] });
}
{
  const r = runRequest(fixture, { ...defaultBody(fixture, "en"), intake: { tearOffLayers: "1" } });
  const w = priceWorkings(fixture, r);
  ok("where the estimator's rounded lines used to miss its total, they now add up to it exactly (settleBreakdown) — no rounding row", w.rounding === 0 && w.lines.reduce((s, l) => s + l.amount, 0) === w.subtotal, w.rounding);
}

/* ═════════════════════════ 5. Words, in every language ══════════════════ */

section("5. Every string exists in every marketing language");
const LANGS = Object.keys(INDUSTRY_MESSAGES);
const EN = INDUSTRY_MESSAGES.en.showcase;
const KEYS = Object.keys(EN);
ok("nine languages", LANGS.length === 9, LANGS);
for (const code of LANGS) {
  const own = INDUSTRY_MESSAGES[code].showcase || {};
  const missing = KEYS.filter((k) => own[k] === undefined || own[k] === "" || (Array.isArray(own[k]) && own[k].length !== EN[k].length));
  const matMissing = Object.keys(EN.materials).filter((k) => !own.materials?.[k]);
  ok(`${code}: every showcase key is written`, missing.length === 0 && matMissing.length === 0, { missing, matMissing });
  ok(`${code}: the example notice is there and names the company`, typeof own.notice === "string" && own.notice.includes("Summit Ridge Roofing") && own.noticeTitle);
  ok(`${code}: the hero link has a label`, Boolean(INDUSTRY_MESSAGES[code].chrome?.seeItInAction));
  if (code !== "en") {
    const same = KEYS.filter((k) => typeof EN[k] === "string" && EN[k].length > 12 && own[k] === EN[k]);
    ok(`${code}: nothing long is left in English`, same.length === 0, same);
  }
  const s = industryShowcaseFor(code);
  ok(`${code}: the resolver returns four steps and five materials`, s.how.length === 4 && Object.keys(s.materials).length === 5 && industryChromeFor(code).seeItInAction);
  for (const key of ["workMeasured", "workMaterial", "workTearOff", "workPitch", "workRange", "tierRate"]) {
    const holes = (EN[key].match(/\{\w+\}/g) || []).sort().join();
    const theirs = (own[key].match(/\{\w+\}/g) || []).sort().join();
    if (holes !== theirs) ok(`${code}: ${key} keeps the same placeholders`, false, { en: holes, [code]: theirs });
  }
}

/* ═════════════════════════ 6. Nothing reaches the network ═══════════════ */

section("6. No section can reach Google, post, or fetch");
const SHOWCASE_FILES = readdirSync(DIR).map((f) => join(DIR, f));
for (const f of SHOWCASE_FILES) {
  const src = stripComments(read(f));
  ok(`${f}: no fetch, no XHR, no beacon, no Google`, !/\bfetch\s*\(|fetchJson|XMLHttpRequest|sendBeacon|maps\.googleapis|google\.com\/maps|maps\.google/.test(src));
}
{
  const flow = read("app/instant-quote/[companySlug]/InstantQuoteFlow.js");
  const at = (needle) => flow.indexOf(needle);
  ok("the flow seeds a sample's payload instead of fetching it", flow.includes("useState(sample ? sample.payload : null)") && /useEffect\(\(\) => \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*if \(sample\) return undefined;\s*const wanted/.test(flow));
  ok("…gives the ad tracker nothing to report", flow.includes("ready: Boolean(data) && !sample,"));
  ok("…never measures a sample", flow.includes("if (!livePreview || sample) return;"));
  ok("…never asks the service area about one", flow.includes("if (sample || !trade || jobAddress.trim().length < 5) return;"));
  ok("…hands the submit body to the page before the /request POST can run", at("setResult(sample.submit(payload));") > 0 && at("setResult(sample.submit(payload));") < at("await tracking.settled();") && at("await tracking.settled();") < at("/request`"));
  ok("…draws no call-back control (a POST) for a sample", flow.includes("{!sample && fromImagery(trade?.measure)"));
  ok("…and fixes the sample's address", flow.includes("readOnly={Boolean(sample)}"));
  ok("the sample company asks for no photos, so no uploader renders", fixture.payloads.en.trades[0].fields.photos === "hidden" && /fields\.photos !== "hidden" && \(\s*<Section title=\{t\.photos\}/.test(flow));
  ok("…and takes no bookings, so no calendar renders", fixture.payloads.en.booking.canBookVisit === false);
}
{
  const leads = read("app/app/leads/page.js");
  const drawer = leads.slice(leads.indexOf("function LeadDrawer("));
  ok("the leads route renders the sample view for a sample and the board otherwise", /export default function LeadsRoute\(\{ sample = null \} = \{\}\) \{\s*return sample \? <LeadsSample sample=\{sample\} \/> : <LeadsPage \/>;/.test(leads));
  ok("the sample view has no drag context, no search, no links", (() => { const s = leads.slice(leads.indexOf("function LeadsSample("), leads.indexOf("function LeadsPage(")); return !/DndContext|fetch|<Link|setQ\(/.test(s); })());
  ok("the drawer seeds a sample lead and never reloads it", drawer.includes("useState(sample)") && /const reload = useCallback\(async \(\) => \{\s*if \(sample\) return;/.test(drawer));
  ok("…keeps a sample's changes local, before any PATCH", drawer.indexOf("if (sample) {") < drawer.indexOf("method: \"PATCH\""));
  ok("…refuses notes, deletes and convert for a sample", /if \(sample \|\| !noteText\.trim\(\)\) return;/.test(drawer) && /async function deleteNote\(noteId\) \{\s*if \(sample\) return;/.test(drawer) && /async function convert\(\) \{\s*if \(sample\) return;/.test(drawer));
  ok("…and renders neither Street View (a Google call) nor the linked-documents list (a fetch)", drawer.includes("{addressLine && !sample && (") && /\{!sample && \(\s*<LinkedDocuments/.test(drawer));
}
{
  const rev = read("app/app/estimate-reviews/page.js");
  ok("the review queue seeds a sample and never loads", rev.includes("useState(sample ? sample.quotes : null)") && /useEffect\(\(\) => \{\s*if \(sample\) return;\s*load\(\);/.test(rev));
  ok("…approves a sample in place, before the POST", /async function approve\(q, adjusted\) \{\s*if \(sample\) \{[\s\S]*?return;\s*\}\s*setBusyId/.test(rev));
  ok("…claims a sample in place, before the PATCH", /async function assignToMe\(q\) \{\s*if \(sample\) \{[\s\S]*?return;\s*\}\s*setBusyId/.test(rev));
  ok("…does not let a sample's total be edited (the adjusted-total write is the route's)", rev.includes("readOnly={sample}"));
  ok("…and draws no link into the app for a sample", /\{!sample && \(\s*<Link\s+href=\{`\/app\/quotes\/\$\{q\.id\}`\}/.test(rev));
}
{
  const qa = read("app/q/[token]/QuoteApproval.js");
  ok("the quote page's sample mode (commit da656e6d) still refuses its fetch and its POST", /if \(sample\) \{\s*setQuote\(sample\);/.test(qa) && /async function submit\(decision\) \{\s*if \(sample\) return;/.test(qa));
  ok("the two homeowner pages render inside SampleFrame (inert, sandboxed)", /<SampleFrame[\s\S]*<ReportView[\s\S]*<SampleFrame[\s\S]*<QuoteApproval token=\{null\} sample=/.test(read(join(DIR, "ClientPreviews.js"))));
}

/* ═════════════════════════ 7. Contrast, both palettes ════════════════════ */

// The marketing tree renders light for everybody (check:marketing-contrast
// says why and measures it). The app screens the showcase embeds are the
// ones /app draws in BOTH themes, so the pairings the showcase's own chrome
// uses are measured against the light :root and the .dark block alike, read
// from app/globals.css rather than typed here.
section("7. The showcase's own text pairings, light and dark");
{
  const css = read("app/globals.css");
  const block = (start) => {
    const i = css.indexOf(start);
    return css.slice(i, css.indexOf("}", i));
  };
  const tokens = (b) => Object.fromEntries([...b.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map((m) => [m[1], m[2]]));
  const light = tokens(block(":root {"));
  const dark = tokens(block(".dark {"));
  const PAIRS = [
    ["foreground", "card"],
    ["foreground", "muted"],
    ["foreground", "background"],
    ["muted-foreground", "card"],
    ["muted-foreground", "muted"],
    ["inverted-foreground", "inverted"],
    ["primary-foreground", "primary"],
  ];
  const used = SHOWCASE_FILES.map((f) => read(f)).join("\n");
  for (const [fg, bg] of PAIRS) {
    for (const [name, pal] of [["light", light], ["dark", dark]]) {
      const r = contrastRatio(pal[fg], pal[bg]);
      ok(`${name}: text-${fg} on bg-${bg} ${r ? r.toFixed(2) : "?"}:1 ≥ 4.5`, r >= 4.5, { fg: pal[fg], bg: pal[bg] });
    }
  }
  ok("…and those are the only token pairings the showcase's chrome draws text with", !/\btext-(?:primary|accent|brand|red|amber|green|emerald|blue)-?\d*\b/.test(stripComments(used).replace(/text-primary-foreground/g, "")));
}

/* ═════════════════════════ 8. Phone width ═══════════════════════════════ */

section("8. Nothing in the showcase is wider than a phone");
for (const f of SHOWCASE_FILES) {
  const src = stripComments(read(f));
  const wide = (src.match(/\b(?:min-)?w-\[(\d+)px\]/g) || []).filter((m) => Number(m.match(/\d+/)[0]) > 343);
  ok(`${f}: no fixed width over 343px (375 minus the 16px gutters)`, wide.length === 0, wide);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
