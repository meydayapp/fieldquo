// scripts/check-signup-aside.mjs
//
//   npm run check:signup-aside
//
// The reactive signup panel (2026-09-24) — the owner's "side screens like
// Housecall Pro and Jobber have": a calendar that changes with the team-size
// chip, a sample quote whose lines are the trade's own services, an email
// with the typed company name in the From line, a booking page with the
// tax line the province carries — plus the two optional steps that feed it.
//
// ══ What is executed rather than read ══════════════════════════════════════
//
//   1. lib/signup/signupPreview.js against hostile input: the closed lists
//      refuse anything not on them (including "__proto__"), a skipped answer
//      is null and never a default, the band → rung reading is the cheapest
//      rung the stated number of people fits, and the tax line is the real
//      lookup or NOTHING — an incomplete address prints no guess.
//   2. lib/signup/sampleServices.js for every industry: two names and two
//      sentences, the seed's own words, no benchmark and no digit-bearing
//      field in the payload — the seeds' rule that nothing in them reaches a
//      client-facing surface, and non-negotiable #4.
//   3. AuthAside with a `preview` for every step, band, trade and goal,
//      rendered with react-dom/server: the picture the step claims is the
//      picture drawn; the typed company name is in the From line; the
//      board has one row per person and crew headings at 16+; the sample
//      quote prints its two services and the "Sample amounts" caption and
//      NOT one of the seed's medians; the price book prints "Set your rate"
//      and never "$0.00"; nothing a homeowner would read says FieldQuo.
//   4. The wiring: the page keeps and posts the four answers, the route
//      cleans and stores them, the schema carries the columns, the capture
//      lists and the rail know the two new steps, the strip is mounted.
//
// Bundled like check:auth-pages, because the panel is JSX with Next
// aliases; the bundle is deleted after the run.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import AuthAside, { SignupAsideStrip, signupPanelFor } from "@/app/components/auth/AuthAside";
import { ChoiceChips, SAMPLE_AMOUNTS } from "@/app/components/auth/SignupPreviews";
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
import { SAMPLE_COUNT, cleanIndustrySlug, sampleServicesForIndustry } from "@/lib/signup/sampleServices";
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
const EXPECTED_SHAPE = { 1: "week", "2-5": "day", "6-10": "board", "11-15": "board", "16+": "grouped" };
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
console.log("\nThe sample services: names and sentences, nothing priced");
const seedMedians = new Set();
const seedNames = new Set();
for (const seed of Object.values(SERVICE_SEEDS)) {
  for (const s of seed.services || []) {
    for (const v of Object.values(s.name || {})) seedNames.add(v);
    if (s.benchmark) for (const k of ["low", "median", "high"]) if (s.benchmark[k] != null) seedMedians.add(Number(s.benchmark[k]));
  }
}
let seededIndustries = 0;
for (const industry of INDUSTRIES) {
  const rows = sampleServicesForIndustry(industry.slug, "en");
  ok(`${industry.slug}: at most ${SAMPLE_COUNT}, each { name, description } only`, rows.length <= SAMPLE_COUNT && rows.every((r) => Object.keys(r).sort().join(",") === "description,name" && typeof r.name === "string" && typeof r.description === "string" && r.name && r.description), JSON.stringify(rows));
  ok(`${industry.slug}: every name is a seed's own`, rows.every((r) => seedNames.has(r.name)), JSON.stringify(rows.map((r) => r.name)));
  ok(`${industry.slug}: the payload carries no benchmark and no money`, !/benchmark|median|\$|\d+\.\d\d/.test(JSON.stringify(rows)) && rows.every((r) => !("benchmark" in r) && !("unit" in r) && !("seedKey" in r)));
  if (rows.length) seededIndustries++;
  const fr = sampleServicesForIndustry(industry.slug, "fr");
  ok(`${industry.slug}: French asks the seed's French`, fr.length === rows.length && fr.every((r, i) => !rows[i] || r.name !== rows[i].name || !/[a-z]{5}/i.test(r.name)), JSON.stringify(fr.map((r) => r.name)));
}
ok("most industries have a seeded sample (the rest fall back to the page's quote-type labels)", seededIndustries >= 8, seededIndustries);
for (const v of ["__proto__", "constructor", null, 7, "", "Painting", "painting ", "<script>"]) {
  ok(`industry ${JSON.stringify(v)} → nothing`, cleanIndustrySlug(v) === null && sampleServicesForIndustry(v).length === 0);
}
ok("an unknown language falls back to English rather than nothing", sampleServicesForIndustry("painting", "zz").length === sampleServicesForIndustry("painting", "en").length);

{
  const route = code("app/api/signup/sample-services/route.js");
  ok("the route is rate-limited", /rateLimit\(request, "signup-sample-services"/.test(route));
  ok("the route answers { services } and nothing else", /NextResponse\.json\(\s*\{ services \}/.test(route));
  ok("the route reads the seeds through lib/signup/sampleServices, never the seed folder", /lib\/signup\/sampleServices/.test(route) && !/serviceSeeds/.test(route));
  ok("the page calls it", /\/api\/signup\/sample-services\?industry=/.test(code("app/signup/page.js")));
  ok("the browser bundle does not import the seeds", !/serviceSeeds/.test(code("app/components/auth/SignupPreviews.js")) && !/serviceSeeds/.test(code("app/components/auth/AuthAside.js")) && !/serviceSeeds/.test(code("app/signup/page.js")));
}

// ══ 3. The panel, rendered ═════════════════════════════════════════════════
console.log("\nThe panel: the picture each step claims is the picture drawn");
const FORM = { firstName: "Marc", lastName: "Tremblay", email: "marc@example.com", companyName: "Maple Painting Co.", phone: "", address: "12 Elm St", city: "Ottawa", province: "ON", country: "CA", language: "en" };
const aside = (preview, lang = "en") => render(createElement(AuthAside, { variant: "signup", preview }), lang);

{
  const html = aside({ step: "account", form: { ...FORM, province: "", country: "" } });
  ok("account: the typed company name is the From line", /data-email-from[^>]*>Maple Painting Co\.</.test(html), html.slice(0, 200));
  ok("account: the real quote subject wording, with the name in it", textOf(html).includes("Your quote from Maple Painting Co."));
  ok("account: no address → no booking page and no tax line", !html.includes("data-tax-line") && !html.includes("data-booking-title"));
  const withAddress = aside({ step: "account", form: FORM });
  ok("account + Ontario address → the booking page with HST 13% (Ontario)", withAddress.includes("data-booking-title") && textOf(withAddress).includes("HST 13% (Ontario)"), textOf(withAddress).slice(0, 300));
  ok("account: the booking page carries the company name", textOf(withAddress).includes("Book a visit with Maple Painting Co."));
  const fr = aside({ step: "account", form: { ...FORM, province: "QC", language: "fr" }, language: "fr" }, "fr");
  ok("account in French: the French subject and the French tax words", textOf(fr).includes("Votre soumission de Maple Painting Co.") && /TVQ/.test(textOf(fr)), textOf(fr).slice(0, 300));
  const empty = aside({ step: "account", form: {} });
  ok("account with nothing typed: a placeholder that says it is one, never a made-up company", textOf(empty).includes("Your company name"));
  ok("the trial sentence and the counted trades line are still under the reactive panel", /trades, from painting to roofing/.test(textOf(empty)) && /No card and no plan today/.test(textOf(empty)));
}
{
  for (const [band, shape] of Object.entries(EXPECTED_SHAPE)) {
    const html = aside({ step: "team", form: FORM, teamSizeBand: band });
    ok(`team "${band}": draws the ${shape} view`, new RegExp(`data-calendar-shape="${shape}"`).test(html));
    ok(`team "${band}": the payroll line is under it`, html.includes("data-payroll-line"));
    const rows = (html.match(/data-board-row/g) || []).length;
    const expectedRows = TEAM_SIZE_BANDS.find((b) => b.key === band).rows;
    if (shape === "board" || shape === "grouped") ok(`team "${band}": one row per person (${expectedRows})`, rows === expectedRows, rows);
    if (shape === "grouped") ok(`team "${band}": rows sit under crew headings`, textOf(html).includes("Crew 1") && textOf(html).includes("Crew 2"));
  }
  const none = aside({ step: "team", form: FORM, teamSizeBand: null });
  ok("team with no chip yet: the one-person week, and the visitor's own first name on it", /data-calendar-shape="week"/.test(none) && textOf(none).includes("Marc"));
  const fourRows = (aside({ step: "team", form: FORM, teamSizeBand: "2-5" }).match(/data-calendar-shape="day"/g) || []).length;
  ok("team 2–5: the day view with named columns", fourRows === 1);
}
{
  const services = sampleServicesForIndustry("painting", "en");
  const html = aside({ step: "industry", form: FORM, sampleServices: services, groupLabel: "Painting", currency: "CAD" });
  const text = textOf(html);
  ok("trades: the sample quote is the document look (masthead, parties, scope group, totals)", ["data-doc-masthead", "data-doc-parties", "data-doc-group", "data-doc-totals"].every((m) => html.includes(m)));
  ok("trades: both of the trade's services are on it", services.every((s) => text.includes(s.name) && text.includes(s.description)), text.slice(0, 300));
  ok("trades: the company name is on the masthead and the trade names the scope", text.includes("Maple Painting Co.") && text.includes("Painting"));
  ok("trades: Photos and What happens next are there", text.includes("Before") && text.includes("After") && text.includes("What happens next"));
  ok("trades: the amounts are said to be samples", text.includes("Sample amounts"));
  const fmt = (n) => n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ok("trades: the placeholder amounts are figures no seed carries as low, median or high", SAMPLE_AMOUNTS.every((n) => !seedMedians.has(n)), SAMPLE_AMOUNTS.filter((n) => seedMedians.has(n)));
  ok("trades: the only amounts printed are the placeholders and their sum", (text.match(/\$[\d,]+\.\d\d/g) || []).every((m) => [...SAMPLE_AMOUNTS, SAMPLE_AMOUNTS.reduce((a, b) => a + b, 0)].map((n) => `$${fmt(n)}`).includes(m)), text.match(/\$[\d,]+\.\d\d/g));
  const fallback = aside({ step: "industry", form: FORM, sampleServices: [], fallbackLines: ["Pressure washing — house", "Pressure washing — driveway"], groupLabel: "Pressure Washing" });
  ok("trades with no seed: the page's quote-type labels stand in, nothing invented", textOf(fallback).includes("Pressure washing — house") && textOf(fallback).includes("Pressure washing — driveway"));
  const nothing = aside({ step: "industry", form: FORM });
  ok("trades with no trade picked: says so rather than drawing a blank quote", textOf(nothing).includes("Pick a trade"));
  for (const slug of ["painting", "electrical", "roofing", "landscaping"]) {
    const rows = sampleServicesForIndustry(slug, "en");
    const h = aside({ step: "industry", form: FORM, sampleServices: rows, fallbackLines: ["Fallback A", "Fallback B"], groupLabel: slug });
    ok(`trades (${slug}): renders${rows.length ? " the seed's services" : " the fallback labels"}`, rows.length ? rows.every((r) => textOf(h).includes(r.name)) : textOf(h).includes("Fallback A"));
  }
}
{
  const html = aside({ step: "services", form: FORM, serviceLabels: ["Interior painting", "Exterior painting", "Cabinet refinishing"] });
  ok("services: one price-book row per ticked quote type", (html.match(/data-pricebook-row/g) || []).length === 3);
  ok("services: the rate column says 'Set your rate' and never prints a price", textOf(html).includes("Set your rate") && !/\$\s?0\.00/.test(textOf(html)));
  ok("services: the margin benefit is said", textOf(html).includes("cost and margin"));
  ok("services with nothing ticked: says so", textOf(aside({ step: "services", form: FORM, serviceLabels: [] })).includes("Tick a quote type"));
}
{
  const pic = (goal) => aside({ step: "goals", form: FORM, signupGoal: goal, sampleServices: sampleServicesForIndustry("painting", "en") });
  ok("goals: 'feel in control' → the insights dashboard", pic("feel_in_control").includes("data-insights"));
  ok("goals: 'win more jobs' → the inbox / front-desk picture", pic("win_more_jobs").includes("data-inbox"));
  ok("goals: 'look professional' → the sample quote", pic("look_professional").includes("data-doc-masthead"));
  ok("goals: 'just exploring' → the pipeline", pic("exploring").includes("data-pipeline"));
  ok("goals: nothing picked → the pipeline, not a favourite", pic(null).includes("data-pipeline"));
  ok("goals: every headline changes with the goal", new Set(["feel_in_control", "win_more_jobs", "look_professional", null].map((g) => signupPanelFor({ step: "goals", form: FORM, signupGoal: g }, (k, f) => f ?? k).feature)).size === 4);
}
{
  // White-label: the mock-ups a homeowner would read carry no FieldQuo.
  for (const step of ["account", "industry"]) {
    const html = aside({ step, form: FORM, sampleServices: sampleServicesForIndustry("painting", "en"), groupLabel: "Painting" });
    const client = html.split("data-signup-preview").slice(1).join(" ");
    ok(`${step}: the client-facing picture never says FieldQuo`, !/fieldquo/i.test(textOf(client)));
  }
  const strip = render(createElement(SignupAsideStrip, { preview: { step: "team", form: FORM, teamSizeBand: "6-10" } }));
  ok("the phone strip: the feature, its benefit and a 'Show preview' button, picture closed", strip.includes("data-signup-aside-strip") && /aria-expanded="false"/.test(strip) && textOf(strip).includes("Show preview") && !strip.includes("data-calendar-shape"));
  const bare = render(createElement(AuthAside, { variant: "signup" }));
  ok("without a preview the signup panel is what it was (the hero screenshot)", bare.includes("hero-quotes") && !bare.includes("data-signup-aside"));
  ok("the login panel is untouched", render(createElement(AuthAside, { variant: "login" })).includes("hero-quotes"));
  const chips = render(createElement(ChoiceChips, { options: TEAM_SIZE_BANDS, value: "2-5", onChange: () => {}, name: "x" }));
  ok("the chips: one pressed, the rest not, every band a button", (chips.match(/aria-pressed="true"/g) || []).length === 1 && (chips.match(/<button/g) || []).length === TEAM_SIZE_BANDS.length);
  ok("no literal hex colour in the previews (tokens only, so both themes hold)", !/#[0-9a-fA-F]{6}\b/.test(code("app/components/auth/SignupPreviews.js")));
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
  ok("the funnel map names the two steps (as null — the platform funnel has no column for them)", /team: null, goals: null/.test(page));
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
