// scripts/check-signup-aside.mjs
//
//   npm run check:signup-aside
//
// The reactive signup panel (2026-09-24) — the owner's "side screens like
// Housecall Pro and Jobber have" — and, since 2026-09-25, its samples are
// the PRODUCT: the owner looked at the first version and said the pictures
// did not look like real samples ("make it FACTUAL, not some fake render").
// Every picture a client or the office sees is now a real component or
// template rendered with the app-guide harness's data (app/components/auth/
// samples/), and this check holds the panel to that.
//
// ══ What is executed rather than read ══════════════════════════════════════
//
//   1. lib/signup/signupPreview.js against hostile input: the closed lists
//      refuse anything not on them (including "__proto__"), a skipped answer
//      is null and never a default, the band → rung reading is the cheapest
//      rung the stated number of people fits, the band → view reading names
//      only the scheduler's two real views, and the tax line is the real
//      lookup or NOTHING — an incomplete address prints no guess.
//   2. lib/signup/sampleServices.js for every industry: two of the trade's
//      seed services, each { name, description, price } where price is
//      EXACTLY what seeding writes into Product.unitPrice (suggestedIn of the
//      seed median — the owner's call of 2026-09-25) or null, and nothing
//      else of the benchmark; the trade's scope wording and steps are the
//      same readers the public quote route uses.
//   3. The panel: which REAL sample each step asks for, with what props —
//      read from the element tree signupPanelFor returns — and each sample
//      rendered with react-dom/server: the email is buildQuoteEmail's own
//      HTML with the typed company in the From line; the booking calendar is
//      SlotCalendar over slotGrid's times for the fixture's opening hours;
//      the schedule is WeekGrid or DayBoard with one row per person and no
//      view the product lacks; the quote is QuoteApproval with the trade's
//      seed prices, or the fixture's own quote said to be one; the dashboard
//      is the dashboard's tiles over buildDashboardRank; the inbox is the
//      inbox's rows and TeamFlow; nothing a homeowner reads says FieldQuo.
//   4. The wiring: the page keeps and posts the four answers, the route
//      cleans and stores them, the schema carries the columns, the capture
//      lists and the rail know the two new steps, the strip is mounted.
//
// Bundled like check:auth-pages, because the panel is JSX with Next
// aliases; next/dynamic is stubbed (scripts/stub-next-dynamic.js) because a
// server render has no chunk to load — the samples are imported directly
// instead. The bundle is deleted after the run.

import { readFileSync, readdirSync } from "node:fs";
import { createElement, isValidElement, Children } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import AuthAside, { SignupAsideStrip, signupPanelFor } from "@/app/components/auth/AuthAside";
import { ChoiceChips } from "@/app/components/auth/SignupPreviews";
import { Sample, SAMPLE_KINDS } from "@/app/components/auth/samples";
import EmailSample, { sampleEmailArgs } from "@/app/components/auth/samples/EmailSample";
import BookingSample, { sampleSlots, sampleWindows } from "@/app/components/auth/samples/BookingSample";
import ScheduleSample, { scheduleSampleFor } from "@/app/components/auth/samples/ScheduleSample";
import QuoteSample, { sampleQuotePayload } from "@/app/components/auth/samples/QuoteSample";
import DashboardSample, { dashboardSample } from "@/app/components/auth/samples/DashboardSample";
import InboxSample, { inboxSample } from "@/app/components/auth/samples/InboxSample";
import ExploreCollage, { collageSample } from "@/app/components/auth/samples/ExploreCollage";
import { buildQuoteEmail } from "@/lib/email/quoteEmail";
import { formatMoney } from "@/lib/currency";
import { suggestedIn } from "@/lib/pricing/benchmarkFx";
import { dominantProcessSteps, resolveServiceContent } from "@/lib/documents/serviceContent";
import { COMPANY as FIXTURE_COMPANY, QUOTE as FIXTURE_QUOTE, PEOPLE as FIXTURE_PEOPLE } from "@/docs/screens/app-guide/harness/fixtures/company.js";
import { SHIFTS as FIXTURE_SHIFTS } from "@/docs/screens/app-guide/harness/fixtures/routes-people.js";
import {
  SIGNUP_GOALS,
  SIGNUP_SOURCE_MAX,
  TEAM_SIZE_BANDS,
  YEARS_BANDS,
  calendarShapeForBand,
  cleanSignupGoal,
  cleanSignupSource,
  cleanTeamSizeBand,
  cleanYearsBand,
  recommendedTierKeyForBand,
  taxPreviewFor,
} from "@/lib/signup/signupPreview";
import { SAMPLE_COUNT, cleanIndustrySlug, cleanSampleCurrency, sampleQuoteForIndustry, sampleServicesForIndustry } from "@/lib/signup/sampleServices";
import { categoryKeysForIndustries } from "@/lib/trades/catalog";
import { serviceSeedsFor } from "@/lib/services/seeds";
import { SERVICE_SEEDS } from "@/app/data/serviceSeeds";
import { INDUSTRIES } from "@/app/data/industries";
import { STEPS, OPTIONAL_STEPS, nextStep, previousStep, furthestStep } from "@/lib/signup/funnel";
import { CAPTURE_STEPS } from "@/lib/signup/leadCapture";
import { SEAT_LADDER } from "@/lib/pricing/ladder";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(label + (detail !== undefined ? ` — ${String(detail).slice(0, 300)}` : ""));
    console.log(`  ✗ ${label}${detail !== undefined ? ` — ${String(detail).slice(0, 300)}` : ""}`);
  }
};
const read = (p) => readFileSync(p, "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const render = (node, lang = "en") => renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: lang }, node));
const textOf = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const HOSTILE = ["__proto__", "constructor", 7, null, undefined, {}, [], "", " 2-5 ", "2–5", "TWO", "<script>", true];

// ══ 1. The pure helpers ════════════════════════════════════════════════════
console.log("\nThe closed lists refuse everything not on them");
for (const v of HOSTILE) {
  ok(`team band ${JSON.stringify(v)} → null`, cleanTeamSizeBand(v) === null, cleanTeamSizeBand(v));
  ok(`years band ${JSON.stringify(v)} → null`, cleanYearsBand(v) === null, cleanYearsBand(v));
  ok(`goal ${JSON.stringify(v)} → null`, cleanSignupGoal(v) === null, cleanSignupGoal(v));
}
for (const b of TEAM_SIZE_BANDS) ok(`team band "${b.key}" is kept as typed`, cleanTeamSizeBand(b.key) === b.key);
for (const b of YEARS_BANDS) ok(`years band "${b.key}" is kept as typed`, cleanYearsBand(b.key) === b.key);
for (const g of SIGNUP_GOALS) ok(`goal "${g.key}" is kept as typed`, cleanSignupGoal(g.key) === g.key);
ok("the bands are the five the owner saw (Just me / 2–5 / 6–10 / 11–15 / 16+)", TEAM_SIZE_BANDS.map((b) => b.key).join(",") === "1,2-5,6-10,11-15,16+");
ok("the years are the five the brief named", YEARS_BANDS.map((b) => b.key).join(",") === "<1,1-2,3-5,6-10,10+");
ok("four goals, one of them 'just exploring'", SIGNUP_GOALS.length === 4 && SIGNUP_GOALS.some((g) => g.key === "exploring"));

console.log("\nThe free-text source is trimmed, cleaned, capped — and empty is null");
ok("whitespace only → null", cleanSignupSource("   ") === null);
ok("not a string → null", cleanSignupSource(42) === null && cleanSignupSource(null) === null && cleanSignupSource({}) === null);
ok("control characters are removed", cleanSignupSource("a\u0000b\u001fc") === "a b c", cleanSignupSource("a\u0000b\u001fc"));
ok(`capped at ${SIGNUP_SOURCE_MAX}`, cleanSignupSource("x".repeat(500)).length === SIGNUP_SOURCE_MAX);
ok("a plain answer survives", cleanSignupSource("  A friend on Facebook ") === "A friend on Facebook");

console.log("\nThe band → rung reading: the cheapest rung the stated people fit");
const EXPECTED_TIER = { 1: "solo", "2-5": "solo", "6-10": "crew", "11-15": "shop", "16+": "shop" };
for (const [band, tier] of Object.entries(EXPECTED_TIER)) {
  ok(`"${band}" → ${tier}`, recommendedTierKeyForBand(band) === tier, recommendedTierKeyForBand(band));
}
ok("every recommendation is a real rung", Object.keys(EXPECTED_TIER).every((b) => SEAT_LADDER.some((t) => t.tierKey === recommendedTierKeyForBand(b))));
for (const v of HOSTILE) ok(`no band ${JSON.stringify(v)} → no rung`, recommendedTierKeyForBand(v) === null);
ok("the rung never DEcreases as the band grows", (() => {
  const order = SEAT_LADDER.map((t) => t.tierKey);
  const ranks = TEAM_SIZE_BANDS.map((b) => order.indexOf(recommendedTierKeyForBand(b.key)));
  return ranks.every((r, i) => i === 0 || r >= ranks[i - 1]);
})());

console.log("\nThe calendar's shape per band");
// The two views /app/scheduler has (app/app/scheduler/page.js: Day, Week) —
// and nothing else. "day" (a column per person) and "grouped" (crew
// headings) were drawings of views the product does not have.
const EXPECTED_SHAPE = { 1: "week", "2-5": "week", "6-10": "board", "11-15": "board", "16+": "board" };
ok("every band names one of the scheduler's two real views", TEAM_SIZE_BANDS.every((b) => b.shape === "week" || b.shape === "board"));
ok("no band promises more rows than the fixture company has people (six)", TEAM_SIZE_BANDS.every((b) => b.rows >= 1 && b.rows <= 6));
for (const [band, shape] of Object.entries(EXPECTED_SHAPE)) ok(`"${band}" → ${shape}`, calendarShapeForBand(band) === shape, calendarShapeForBand(band));
for (const v of HOSTILE) ok(`no band ${JSON.stringify(v)} → the one-person week`, calendarShapeForBand(v) === "week");

console.log("\nThe tax line: the real lookup, or nothing");
const on = taxPreviewFor({ country: "CA", province: "ON" });
ok("Ontario → HST 13% (Ontario)", on && on.key === "app.tax.headline.region" && on.params.taxes === "HST 13%" && on.params.region === "Ontario", JSON.stringify(on));
const qc = taxPreviewFor({ country: "Canada", province: "Québec" }, "fr");
ok("Québec in French → TPS 5 % + TVQ 9,975 % (Québec)", qc && /TPS 5 %/.test(qc.params.taxes) && /TVQ/.test(qc.params.taxes) && qc.params.region === "Québec", JSON.stringify(qc));
const tx = taxPreviewFor({ country: "US", province: "Texas" });
ok("Texas → the state base with the local-rates caution", tx && tx.key === "app.tax.headline.us" && tx.params.state === "Texas" && tx.cautionKey === "app.tax.caution.usLocalNotIncluded", JSON.stringify(tx));
ok("a two-letter state reads the same as the name", JSON.stringify(taxPreviewFor({ country: "US", province: "TX" })) === JSON.stringify(tx));
for (const [label, place] of [
  ["no province", { country: "CA", province: "" }],
  ["no country", { country: "", province: "ON" }],
  ["a country the table does not hold", { country: "FR", province: "Île-de-France" }],
  ["a province that is not one", { country: "CA", province: "Narnia" }],
  ["null", null],
  ["a number", 7],
  ["a string", "Ontario"],
  ["undefined", undefined],
]) {
  ok(`${label} → nothing, never a guess`, taxPreviewFor(place) === null, JSON.stringify(taxPreviewFor(place)));
}

// ══ 2. The sample services ═════════════════════════════════════════════════
console.log("\nThe sample services: the seed's words, and the price seeding would write — nothing else");
const seedNames = new Set();
for (const seed of Object.values(SERVICE_SEEDS)) for (const s of seed.services || []) for (const v of Object.values(s.name || {})) seedNames.add(v);
/** The seed row an industry's sample line came from, by its English name. */
const seedRowFor = (slug, enName) => {
  for (const key of categoryKeysForIndustries([slug])) {
    const hit = serviceSeedsFor(key)?.services.find((s) => s.name?.en === enName);
    if (hit) return hit;
  }
  return null;
};
let seededIndustries = 0;
let pricedIndustries = 0;
for (const industry of INDUSTRIES) {
  const rows = sampleServicesForIndustry(industry.slug, "en", "CAD");
  ok(`${industry.slug}: at most ${SAMPLE_COUNT}, each { name, description, price } only`, rows.length <= SAMPLE_COUNT && rows.every((r) => Object.keys(r).sort().join(",") === "description,name,price" && typeof r.name === "string" && typeof r.description === "string" && r.name && r.description), JSON.stringify(rows));
  ok(`${industry.slug}: every name is a seed's own`, rows.every((r) => seedNames.has(r.name)), JSON.stringify(rows.map((r) => r.name)));
  ok(`${industry.slug}: each CAD price is exactly suggestedIn(the seed's median, "CAD") — what seeding writes — or null`, rows.every((r) => r.price === suggestedIn(seedRowFor(industry.slug, r.name)?.benchmark?.median, "CAD")), JSON.stringify(rows.map((r) => r.price)));
  const usd = sampleServicesForIndustry(industry.slug, "en", "USD");
  ok(`${industry.slug}: a USD price is the median itself`, usd.every((r) => r.price === (Number(seedRowFor(industry.slug, r.name)?.benchmark?.median) > 0 ? Number(seedRowFor(industry.slug, r.name).benchmark.median) : null)), JSON.stringify(usd.map((r) => r.price)));
  ok(`${industry.slug}: no range, source or date of the benchmark leaves`, !/benchmark|median|"low"|"high"|asOf|source/.test(JSON.stringify(rows)));
  for (const cur of [null, "", "EUR", "AUD", "usd ", "<script>", 7]) {
    if (!sampleServicesForIndustry(industry.slug, "en", cur).every((r) => r.price === null || cur === "usd ")) ok(`${industry.slug}: currency ${JSON.stringify(cur)} prints no price`, false);
  }
  if (rows.length) seededIndustries++;
  if (rows.some((r) => r.price != null)) pricedIndustries++;
  // A priced service beats an unpriced one: an unpriced line never sits
  // ahead of a priced one.
  ok(`${industry.slug}: priced lines come first`, rows.every((r, i) => i === 0 || r.price == null || rows[i - 1].price != null));
  const fr = sampleServicesForIndustry(industry.slug, "fr", "CAD");
  ok(`${industry.slug}: French asks the seed's French`, fr.length === rows.length && fr.every((r, i) => !rows[i] || r.name !== rows[i].name || !/[a-z]{5}/i.test(r.name)), JSON.stringify(fr.map((r) => r.name)));
  const q = sampleQuoteForIndustry(industry.slug, "en", "CAD");
  ok(`${industry.slug}: the sample quote carries only its words, prices and the trade's page wording`, q && Object.keys(q).sort().join(",") === "categoryKey,currency,glossary,group,processSteps,services" && Object.keys(q.group).sort().join(",") === "accent,description,included,mayChange");
  const content = resolveServiceContent(q.categoryKey, null, null, "en");
  ok(`${industry.slug}: the scope wording and "what happens next" are the public quote route's own readers`, q.group.description === (content.description || "") && JSON.stringify(q.processSteps) === JSON.stringify(dominantProcessSteps([{ categoryKey: q.categoryKey, override: null, subtotal: q.services.reduce((a, s) => a + (Number(s.price) || 0), 0) }], "en")));
}
ok("most industries have a seeded sample (the rest fall back)", seededIndustries >= 8, seededIndustries);
ok("most seeded industries have a PRICED sample", pricedIndustries >= 7, pricedIndustries);
const hvac = sampleServicesForIndustry("hvac", "en", "CAD");
ok("HVAC (the owner's example): the 3.5-ton split system at its seed median in CAD, not $1,180", hvac[0] && /3\.5-ton/.test(hvac[0].name) && hvac[0].price === suggestedIn(9480, "CAD") && hvac[0].price > 10000, JSON.stringify(hvac));
for (const v of ["__proto__", "constructor", null, 7, "", "Painting", "painting ", "<script>"]) {
  ok(`industry ${JSON.stringify(v)} → nothing`, cleanIndustrySlug(v) === null && sampleServicesForIndustry(v).length === 0 && sampleQuoteForIndustry(v) === null);
}
for (const v of ["__proto__", null, 7, "", "EUR", "AUD", "<script>", {}]) ok(`currency ${JSON.stringify(v)} → none`, cleanSampleCurrency(v) === null);
ok("currency is read case-blind and trimmed", cleanSampleCurrency(" cad ") === "CAD" && cleanSampleCurrency("usd") === "USD");
ok("an unknown language falls back to English rather than nothing", sampleServicesForIndustry("painting", "zz", "CAD").length === sampleServicesForIndustry("painting", "en", "CAD").length);

{
  const route = code("app/api/signup/sample-services/route.js");
  ok("the route is rate-limited", /rateLimit\(request, "signup-sample-services"/.test(route));
  ok("the route reads the currency through the closed list", /cleanSampleCurrency\(params\.get\("currency"\)\)/.test(route));
  ok("the route answers services, categoryKey, currency, group, processSteps, glossary and nothing else", /NextResponse\.json\(\s*\{\s*services: sample\?\.services \|\| \[\],[\s\S]*?categoryKey: sample\?\.categoryKey \|\| null,\s*currency: sample\?\.currency \|\| null,\s*group: sample\?\.group \|\| null,\s*processSteps: sample\?\.processSteps \|\| \[\],\s*glossary: sample\?\.glossary \|\| \[\],\s*\}/.test(route));
  ok("the route reads the seeds through lib/signup/sampleServices, never the seed folder", /lib\/signup\/sampleServices/.test(route) && !/serviceSeeds/.test(route));
  const page = code("app/signup/page.js");
  ok("the page calls it with the trade, the language and the plan's currency", /\/api\/signup\/sample-services\?industry=\$\{encodeURIComponent\(firstIndustry\)\}&lang=\$\{encodeURIComponent\(form\.language\)\}&currency=\$\{encodeURIComponent\(planCurrency \|\| ""\)\}/.test(page));
  const browserFiles = ["app/components/auth/SignupPreviews.js", "app/components/auth/AuthAside.js", "app/signup/page.js", ...readdirSync("app/components/auth/samples").map((f) => `app/components/auth/samples/${f}`)];
  ok("the browser bundle does not import the seeds", browserFiles.every((f) => !/serviceSeeds|lib\/services\/seeds|signup\/sampleServices/.test(code(f))), browserFiles.filter((f) => /serviceSeeds|lib\/services\/seeds|signup\/sampleServices/.test(code(f))));
}

// ══ 3. The panel, and the real samples ═════════════════════════════════════
console.log("\nThe panel: the sample each step asks for");
const FORM = { firstName: "Priya", lastName: "Shah", email: "priya@example.com", companyName: "Maple Painting Co.", phone: "613-555-0181", address: "12 Elm St", city: "Ottawa", province: "ON", country: "CA", language: "en" };
const aside = (preview, lang = "en") => render(createElement(AuthAside, { variant: "signup", preview }), lang);
const tt = (k, f, p) => {
  let s = typeof f === "string" ? f : k;
  for (const [a, b] of Object.entries(p || (typeof f === "object" ? f : {}) || {})) s = s.replaceAll(`{${a}}`, String(b));
  return s;
};
/** Every <Sample kind=…> in an element tree, with its props. */
function samplesIn(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => samplesIn(n, out));
    return out;
  }
  if (!isValidElement(node)) return out;
  if (node.type === Sample) out.push(node.props);
  Children.forEach(node.props?.children, (c) => samplesIn(c, out));
  return out;
}
const kindsFor = (preview) => samplesIn(signupPanelFor(preview, tt).picture).map((p) => p.kind);
const TRADE_HVAC = { ...sampleQuoteForIndustry("hvac", "en", "CAD") };

ok("the sample kinds are the seven real screens", SAMPLE_KINDS.join(",") === "email,booking,schedule,quote,dashboard,inbox,collage", SAMPLE_KINDS.join(","));
ok("account, no address: the quote email only", kindsFor({ step: "account", form: { ...FORM, province: "", country: "" } }).join(",") === "email");
ok("account + Ontario address: the email, then the booking calendar", kindsFor({ step: "account", form: FORM }).join(",") === "email,booking");
{
  const [email] = samplesIn(signupPanelFor({ step: "account", form: FORM, currency: "CAD" }, tt).picture);
  ok("account: the email is handed the form, the currency and the address's tax rate", email.form === FORM && email.currency === "CAD" && email.taxRatePct === 13, JSON.stringify({ currency: email.currency, tax: email.taxRatePct }));
  const withAddress = aside({ step: "account", form: FORM });
  ok("account + Ontario: the tax line is the real lookup, HST 13% (Ontario)", withAddress.includes("data-tax-line") && textOf(withAddress).includes("HST 13% (Ontario)"), textOf(withAddress).slice(0, 300));
  ok("account: no tax line without an address", !aside({ step: "account", form: { ...FORM, province: "", country: "" } }).includes("data-tax-line"));
  const empty = aside({ step: "account", form: {} });
  ok("the trial sentence and the counted trades line are still under the reactive panel", /trades, from painting to roofing/.test(textOf(empty)) && /No card and no plan today/.test(textOf(empty)));
}
for (const b of TEAM_SIZE_BANDS) {
  const [s] = samplesIn(signupPanelFor({ step: "team", form: FORM, teamSizeBand: b.key }, tt).picture);
  ok(`team "${b.key}": the schedule sample, told the band`, s?.kind === "schedule" && s.band === b.key);
}
ok("team with no chip: the schedule sample with no band", samplesIn(signupPanelFor({ step: "team", form: FORM }, tt).picture)[0]?.band === null);
const GOAL_KIND = { look_professional: "quote", feel_in_control: "dashboard", win_more_jobs: "inbox", exploring: "collage" };
for (const [goal, kind] of Object.entries(GOAL_KIND)) ok(`goals: "${goal}" → the ${kind} sample`, kindsFor({ step: "goals", form: FORM, signupGoal: goal }).join(",") === kind);
ok("goals: nothing picked → the collage of the whole product, not a favourite", kindsFor({ step: "goals", form: FORM, signupGoal: null }).join(",") === "collage");
ok("goals: every headline changes with the goal", new Set(["feel_in_control", "win_more_jobs", "look_professional", null].map((g) => signupPanelFor({ step: "goals", form: FORM, signupGoal: g }, tt).feature)).size === 4);
{
  const [q] = samplesIn(signupPanelFor({ step: "industry", form: FORM, sampleTrade: TRADE_HVAC, groupLabel: "HVAC", currency: "CAD" }, tt).picture);
  ok("trades: the quote sample, handed the trade's sample, its name, the currency and the address's tax", q?.kind === "quote" && q.trade === TRADE_HVAC && q.groupLabel === "HVAC" && q.currency === "CAD" && q.tax?.rate === 13);
}
{
  const html = aside({ step: "services", form: FORM, serviceLabels: ["Interior painting", "Exterior painting", "Cabinet refinishing"] });
  ok("services: one price-book row per ticked quote type", (html.match(/data-pricebook-row/g) || []).length === 3);
  ok("services: the rate column says 'Set your rate' and never prints a price", textOf(html).includes("Set your rate") && !/\$\s?0\.00/.test(textOf(html)));
  ok("services with nothing ticked: says so", textOf(aside({ step: "services", form: FORM, serviceLabels: [] })).includes("Tick a quote type"));
}

console.log("\nThe quote email is the real template's HTML");
{
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"]) {
    let built = null;
    try {
      built = buildQuoteEmail(sampleEmailArgs({ form: FORM, language: lang, currency: "CAD", placeholder: "Your company name", taxRatePct: 13 }));
    } catch (e) {
      built = { error: e.message };
    }
    ok(`${lang}: buildQuoteEmail accepts the sample's arguments`, built && !built.error && built.html.includes("Maple Painting Co."), built?.error);
  }
  const args = sampleEmailArgs({ form: FORM, language: "en", currency: "CAD", placeholder: "Your company name", taxRatePct: 13 });
  const built = buildQuoteEmail(args);
  const html = render(createElement(EmailSample, { form: FORM, language: "en", currency: "CAD", taxRatePct: 13 }));
  ok("the From line is the typed company name (lib/email/resend.js sends as the company)", /data-email-from[^>]*>Maple Painting Co\.</.test(html));
  ok("the subject shown is the template's own subject", html.includes(built.subject.replace(/&/g, "&amp;")) && built.subject === "Your quote from Maple Painting Co. — Q-1042");
  ok("the frame shows the template's HTML itself (srcdoc), at a mail client's width", /data-sample-frame="html"/.test(html) && /data-sample-width="600"/.test(html) && /<iframe[^>]*srcDoc="|<iframe[^>]*srcdoc="/i.test(html));
  ok("the email's brand is the neutral one: the company chose no colour", args.company.brandColor === null && args.company.logoUrl === null);
  // The first cut passed {name, total} rows — the shape the Settings preview's
  // own sample uses — and the template, which reads QuoteLineItem's
  // description/amount, printed every line at $0.00.
  ok("the lines are QuoteLineItem's own fields, so every line prints its amount (no $0.00)", args.quote.lineItems.every((l) => "description" in l && "amount" in l) && !/\$0\.00/.test(built.html) && built.html.includes("5,100.00"));
  ok("no trade yet: the lines are the fixture's own quote (Q-1042), not placeholders", JSON.stringify(args.quote.lineItems.map((l) => l.amount)) === JSON.stringify(FIXTURE_QUOTE.items.map((i) => i.total)) && args.scopeGroups.length === 2);
  const tradeArgs = sampleEmailArgs({ form: FORM, language: "en", trade: TRADE_HVAC, currency: "CAD", taxRatePct: 13 });
  ok("with a priced trade: the lines are the trade's seed prices, and the total carries 13% tax", JSON.stringify(tradeArgs.quote.lineItems.map((l) => l.amount)) === JSON.stringify(TRADE_HVAC.services.map((s) => s.price)) && tradeArgs.scopeGroups[0].category?.key === TRADE_HVAC.categoryKey && Math.abs(tradeArgs.quote.total - Math.round(TRADE_HVAC.services.reduce((a, s) => a + s.price, 0) * 113) / 100) < 0.01);
  const visible = built.html.replace(/<[^>]*>/g, " ").replace(/https?:\/\/\S+/g, " ");
  ok("white-label: nothing in the email a homeowner reads says FieldQuo (the link is the only address it carries)", !/fieldquo/i.test(visible));
  const fr = buildQuoteEmail(sampleEmailArgs({ form: FORM, language: "fr", currency: "CAD" }));
  ok("in French: the French subject", fr.subject === "Votre soumission de Maple Painting Co. — Q-1042", fr.subject);
  ok("nothing typed: the placeholder that says it is one, never a made-up company", buildQuoteEmail(sampleEmailArgs({ form: {}, placeholder: "Your company name" })).subject.includes("Your company name"));
}

console.log("\nThe booking calendar is SlotCalendar over slotGrid's times");
{
  const now = new Date(2026, 9, 5, 12, 0); // Mon 5 Oct 2026, noon
  const slots = sampleSlots("2026-10-01", "2026-10-31", { now, timezone: "UTC" });
  const all = Object.entries(slots).flatMap(([d, list]) => list.map((iso) => ({ d, at: new Date(iso) })));
  const open = Object.fromEntries(FIXTURE_COMPANY.businessHours.filter((h) => !h.closed).map((h) => [h.day, h]));
  ok("the windows are the fixture's open days and nothing else", sampleWindows("UTC").map((w) => w.dayOfWeek).join(",") === Object.keys(open).join(","));
  ok("no times on a closed day", all.every(({ at }) => open[at.getUTCDay()]));
  ok("every time is inside that day's opening hours, a visit's length before the close", all.every(({ at }) => {
    const h = open[at.getUTCDay()];
    const [oh, om] = h.open.split(":").map(Number);
    const [ch, cm] = h.close.split(":").map(Number);
    const m = at.getUTCHours() * 60 + at.getUTCMinutes();
    return m >= oh * 60 + om && m + FIXTURE_COMPANY.defaultVisitMinutes <= ch * 60 + cm;
  }));
  ok("nothing in the past is offered", all.every(({ at }) => at >= now) && all.length > 20, all.length);
  const html = render(createElement(BookingSample, { language: "en", title: "Book a visit with Maple Painting Co." }));
  ok("the frame renders SlotCalendar (its own loading line on the server)", /data-sample-frame="component"/.test(html) && textOf(html).includes("Finding times"));
  ok("the title is the panel's caption, outside the frame", html.indexOf("data-booking-title") < html.indexOf("data-sample-frame"));
}

console.log("\nThe schedule is the scheduler's own Week and Day views");
{
  const [, , , , LEO, ANA] = FIXTURE_PEOPLE;
  const MARC = FIXTURE_PEOPLE[0];
  for (const b of [null, ...TEAM_SIZE_BANDS.map((x) => x.key)]) {
    const s = scheduleSampleFor({ band: b, form: FORM });
    const expected = b ? TEAM_SIZE_BANDS.find((x) => x.key === b) : null;
    ok(`"${b}": the ${s.shape} view — one of the two /app/scheduler offers`, ["week", "board"].includes(s.shape) && s.shape === calendarShapeForBand(b));
    ok(`"${b}": one row per person (${s.rows})`, s.workers.length === (expected?.rows || 1), s.workers.length);
    ok(`"${b}": the visitor stands in by name`, s.workers.some((w) => w.name === "Priya Shah"));
    const html = render(createElement(ScheduleSample, { band: b, form: FORM }));
    ok(`"${b}": the rendered view carries the visitor's name and the fixture's other people`, textOf(html).includes("Priya Shah") && (s.workers.length === 1 || textOf(html).includes(ANA.name)));
    ok(`"${b}": no view the product lacks — no crew headings, no per-person day columns`, !/Crew 1|Crew 2/.test(textOf(html)) && !/data-calendar-shape="(day|grouped)"/.test(html));
    if (s.shape === "board") ok(`"${b}": the dispatch board's coverage strip and this morning's clock-ins`, textOf(html).includes("Coverage") && /on site since/.test(textOf(html)));
    else ok(`"${b}": the week grid's seven days from Mon 14`, textOf(html).includes("Mon 14") && textOf(html).includes("Sun 20"));
  }
  const solo = scheduleSampleFor({ band: "1", form: FORM });
  ok("Just me: the stand-in is the fixture person with a full week of shifts", solo.shifts.length === FIXTURE_SHIFTS.filter((x) => x.worker.name === LEO.name).length && solo.shifts.length >= 3);
  ok("no name typed: the fixture's own name stays (nobody is invented)", scheduleSampleFor({ band: "6-10", form: {} }).workers.some((w) => w.name === MARC.name));
}

console.log("\nThe quote is the client quote page itself");
{
  const tax = taxPreviewFor({ country: "CA", province: "ON" });
  const { fromTrade, payload } = sampleQuotePayload({ form: FORM, trade: TRADE_HVAC, groupLabel: "HVAC", currency: "CAD", tax });
  ok("with the trade: the page's lines are the trade's two seed services at their seed prices", fromTrade && JSON.stringify(payload.scopeGroups[0].lineItems.map((l) => [l.description, l.amount])) === JSON.stringify(TRADE_HVAC.services.map((s) => [s.name, s.price])));
  ok("…tax charged at the address's rate, and the total adds up", payload.taxKind === "charged" && Math.abs(payload.tax - Math.round(payload.subtotal * 13) / 100) < 0.01 && Math.abs(payload.total - (payload.subtotal + payload.tax)) < 0.01);
  ok("…in the visitor's company, in the neutral brand", payload.company.name === "Maple Painting Co." && payload.company.brandColor === null);
  ok("…with the trade's own steps", JSON.stringify(payload.processSteps) === JSON.stringify(TRADE_HVAC.processSteps));
  const noTax = sampleQuotePayload({ form: FORM, trade: TRADE_HVAC, currency: "CAD", tax: null }).payload;
  ok("no address: tax is 'To be confirmed', never a $0.00 that reads as none", noTax.taxKind === "unresolved" && noTax.tax === 0);
  const html = render(createElement(QuoteSample, { form: FORM, trade: TRADE_HVAC, groupLabel: "HVAC", currency: "CAD", tax }));
  const text = textOf(html);
  ok("the rendered page prints both services and their seed prices", TRADE_HVAC.services.every((s) => text.includes(s.name) && text.includes(formatMoney(s.price, "CAD").replace(/^CA/, ""))), text.slice(0, 400));
  ok("…at a phone's width, captioned as the trade's starting prices", /data-sample-width="390"/.test(html) && /data-quote-sample="trade"/.test(html) && text.includes("starts with"));
  ok("white-label: the client quote page says nothing of FieldQuo", !/fieldquo/i.test(text));
  const unpriced = sampleQuoteForIndustry("roofing", "en", "CAD");
  const fixture = sampleQuotePayload({ form: FORM, trade: unpriced, currency: "CAD" });
  ok("a trade with no seed price: the fixture's own quote, not an invented price", !fixture.fromTrade && fixture.payload.total === FIXTURE_QUOTE.total && fixture.payload.company.name === FIXTURE_COMPANY.name);
  const fixtureHtml = render(createElement(QuoteSample, { form: FORM, trade: unpriced }));
  ok("…and the caption says so", /data-quote-sample="fixture"/.test(fixtureHtml) && textOf(fixtureHtml).includes("no typical price"));
  const none = render(createElement(QuoteSample, { form: FORM }));
  ok("no trade picked yet: the fixture's quote, captioned 'pick your trade'", textOf(none).includes("Pick your trade") && textOf(none).includes(FIXTURE_COMPANY.name));
}

console.log("\nThe dashboard is the dashboard");
{
  const { overview, money, rank } = dashboardSample();
  const html = render(createElement(DashboardSample));
  const text = textOf(html);
  ok("the hero is buildDashboardRank's over the fixture's overview", rank.hero.known && rank.hero.amount === overview.revenue && text.includes(formatMoney(overview.revenue, money.currency)));
  ok("the four tiles are the page's four", rank.metrics.map((m) => m.id).join(",") === "quotesSent,conversion,owed,booked" && text.includes(String(overview.quotesSent)));
  ok("the goal card shows the fixture's goal", text.includes("420,000"));
  ok("rendered at the office's width", /data-sample-width="900"/.test(html));
}

console.log("\nThe inbox is the inbox, and the routing is TeamFlow");
{
  const { threads, team } = inboxSample();
  const html = render(createElement(InboxSample));
  const text = textOf(html);
  ok("every fixture conversation is a row", threads.every((t) => text.includes(t.participantName)));
  ok("the AI team's live employees are on the routing picture", team.employees.filter((e) => e.enabled).every((e) => text.includes(e.displayName)));
  ok("the front desk is drawn", text.includes("Front desk"));
}

console.log("\nJust exploring: the collage of real cards");
{
  const html = render(createElement(ExploreCollage, { form: FORM }));
  const cards = (html.match(/data-collage-card="/g) || []).length;
  const kinds = [...html.matchAll(/data-collage-card="([a-z-]+)"/g)].map((m) => m[1]);
  ok("the owner's seven: AI team, quotes, jobs, payroll, calendar, AI receptionist, lead funnel builder", ["ai-team", "quotes", "jobs", "payroll", "calendar", "receptionist", "funnel"].every((k) => kinds.includes(k)), kinds.join(","));
  ok("seven cards, no filler", cards === 7, cards);
  const c = collageSample();
  ok("the cards' figures are the fixture's rows", c && Object.keys(c).length >= 5);
  ok("the collage stacks into a list on a narrow panel and floats from a wide one", /data-collage-layout/.test(html));
}

{
  // White-label across the client-facing samples at once, and the strip.
  const strip = render(createElement(SignupAsideStrip, { preview: { step: "team", form: FORM, teamSizeBand: "6-10" } }));
  ok("the phone strip: the feature, its benefit and a 'Show preview' button, picture closed", strip.includes("data-signup-aside-strip") && /aria-expanded="false"/.test(strip) && textOf(strip).includes("Show preview") && !strip.includes("data-sample-kind"));
  const bare = render(createElement(AuthAside, { variant: "signup" }));
  ok("without a preview the signup panel is what it was (the hero screenshot)", bare.includes("hero-quotes") && !bare.includes("data-signup-aside"));
  ok("the login panel is untouched", render(createElement(AuthAside, { variant: "login" })).includes("hero-quotes"));
  const chips = render(createElement(ChoiceChips, { options: TEAM_SIZE_BANDS, value: "2-5", onChange: () => {}, name: "x" }));
  ok("the chips: one pressed, the rest not, every band a button", (chips.match(/aria-pressed="true"/g) || []).length === 1 && (chips.match(/<button/g) || []).length === TEAM_SIZE_BANDS.length);
  const sampleFiles = readdirSync("app/components/auth/samples").map((f) => `app/components/auth/samples/${f}`);
  ok("no literal hex colour in the panel's own pictures (tokens or the document theme only)", ["app/components/auth/SignupPreviews.js", ...sampleFiles].every((f) => !/#[0-9a-fA-F]{3,6}\b/.test(code(f))), ["app/components/auth/SignupPreviews.js", ...sampleFiles].filter((f) => /#[0-9a-fA-F]{3,6}\b/.test(code(f))));
  // The drawings are gone, not kept beside the real thing.
  const previews = code("app/components/auth/SignupPreviews.js");
  ok("no hand-drawn email, booking page, calendar, quote, dashboard or inbox is left", !/export function (EmailPreview|BookingPreview|CalendarPreview|QuoteSamplePreview|GoalPreview)\b/.test(previews) && !/function (WeekView|DayView|BoardView|InsightsMock|InboxMock|Pipeline)\b/.test(previews));
  ok("every sample renders through the frame (scaled, clipped, inert, labelled Sample)", ["EmailSample", "BookingSample", "ScheduleSample", "QuoteSample", "DashboardSample", "InboxSample", "ExploreCollage"].every((f) => /<SampleFrame\b/.test(code(`app/components/auth/samples/${f}.js`))));
  const frame = code("app/components/auth/samples/SampleFrame.js");
  ok("the frame is inert: no pointer, no tab stop, hidden from AT, a sandbox with no scripts, body inert", /pointerEvents: "none"/.test(frame) && /tabIndex=\{-1\}/.test(frame) && /aria-hidden="true"/.test(frame) && /sandbox="allow-same-origin"/.test(frame) && !/allow-scripts/.test(frame) && /setAttribute\("inert", ""\)/.test(frame));
  ok("…and is an image with a 'Sample:' label", /role="img"/.test(frame) && /\$\{sampleWord\}: \$\{label\}/.test(frame));
  ok("the samples call no API: no fetch in any sample file", sampleFiles.every((f) => !/\bfetch\(/.test(code(f))));
  const index = code("app/components/auth/samples/index.js");
  ok("each sample is its own lazy chunk, never server-rendered", (index.match(/dynamic\(\(\) => import\("\.\/\w+"\), \{ ssr: false, loading: Placeholder \}\)/g) || []).length === SAMPLE_KINDS.length);
  ok("…loaded only once it is on screen (the phone's hidden panel loads nothing)", /new IntersectionObserver\(/.test(index) && /\{shown \? <Component \{\.\.\.props\} \/> : <Placeholder \/>\}/.test(index));
}

// ══ 4. The wiring ══════════════════════════════════════════════════════════
console.log("\nThe wiring: written AND read");
{
  const page = code("app/signup/page.js");
  const route = code("app/api/companies/route.js");
  const schema = read("prisma/schema.prisma");
  ok("the funnel walks team and goals between the entry and trades", STEPS.join(",") === "account,business,team,goals,industry,services,plan" && OPTIONAL_STEPS.join(",") === "team,goals");
  ok("next/previous agree through the two new rungs", nextStep("business") === "team" && nextStep("team") === "goals" && nextStep("goals") === "industry" && previousStep("industry") === "goals" && previousStep("goals") === "team" && previousStep("team", { accountExists: true }) === "business");
  ok("neither optional rung gates a later one", furthestStep({ accountExists: true, companyReady: true }) === "industry");
  ok("the capture reports the two new steps as themselves", CAPTURE_STEPS.includes("team") && CAPTURE_STEPS.includes("goals"));
  ok("the page renders a team step and a goals step", /step === "team" && \(/.test(page) && /step === "goals" && \(/.test(page));
  ok("both steps can be skipped, and skipping stores nothing", /data-skip-step="team"/.test(page) && /setTeamSizeBand\(null\);\s*setYearsBand\(null\);/.test(page) && /data-skip-step="goals"/.test(page) && /setSignupGoal\(null\);\s*setSignupSource\(""\);/.test(page));
  ok("the page posts the four answers, null when skipped", /teamSizeBand: teamSizeBand \|\| null,\s*yearsInBusinessBand: yearsBand \|\| null,\s*signupGoal: signupGoal \|\| null,\s*signupSource: signupSource\.trim\(\) \|\| null,/.test(page));
  ok("the draft keeps them for a refresh", /teamSizeBand,\s*yearsBand,\s*signupGoal,\s*signupSource,\s*step,/.test(page) && /typeof draft\?\.teamSizeBand === "string"/.test(page));
  // Since 2026-09-25 the platform funnel has a bar for each (Team shown =
  // account submitted, Goals shown = Team done — lib/analytics/product/
  // events.js SIGNUP_STEP_BAR), so the page sends both.
  ok("the funnel map sends the two steps", /\{ team: "team", goals: "goals", industry: "trades", services: "services" \}/.test(page));
  ok("the aside and the strip are handed the live preview", /<AuthAside variant="signup" preview=\{asidePreview\} \/>/.test(page) && /<SignupAsideStrip preview=\{asidePreview\} \/>/.test(page));
  ok("the route cleans each answer against its closed list", /cleanTeamSizeBand\(teamSizeBand\)/.test(route) && /cleanYearsBand\(yearsInBusinessBand\)/.test(route) && /cleanSignupGoal\(signupGoal\)/.test(route) && /cleanSignupSource\(signupSource\)/.test(route));
  ok("the route writes the four columns", /teamSizeBand: teamBand,\s*yearsInBusinessBand: yearsBand,\s*signupGoal: goal,\s*signupSource: source,/.test(route));
  ok("the route starts the trial banner on the band's rung only when the link named none", /recommendedTierKeyForBand\(teamBand\)/.test(route) && route.indexOf("recommendedTierKeyForBand(teamBand)") > route.indexOf("wantedPlanId === \"string\""));
  ok("the schema carries the four columns, all optional", ["teamSizeBand", "yearsInBusinessBand", "signupGoal", "signupSource"].every((c) => new RegExp(`\\n  ${c}\\s+String\\?`).test(schema)));
  ok("the platform company list reads them", /c\.teamSizeBand/.test(code("app/platform/companies/page.js")) && /c\.signupGoal/.test(code("app/platform/companies/page.js")));
  ok("the rail labels the two rungs from the app catalogue", /team: \{ key: "app\.signup\.steps\.team"/.test(code("app/components/auth/SignupSteps.js")));
  const shell = code("app/components/auth/AuthShell.js");
  ok("the shell draws the strip above the form below lg, and the aside only from lg when a strip is given", /strip \? <div className="mt-6 lg:hidden">\{strip\}<\/div> : null/.test(shell) && /strip \? "hidden lg:block" : ""/.test(shell));
}

console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}` : `\nPASSED — ${pass}/${pass} assertions`);
process.exit(fails.length ? 1 : 0);
