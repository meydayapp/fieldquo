// scripts/check-roofing-example-render.mjs
//
// Part two of check:roofing-example (see scripts/check-roofing-example.mjs).
// Bundled with esbuild like check:signup-aside, so the real components render:
// the whole walk-through, in each of the nine marketing languages, through
// react-dom/server — with fetch replaced by a tripwire, so a component that
// reached for the network while rendering fails here rather than on the page.
//
// What it asserts per language: the section and its anchor, the example
// notice, the four "how it works" steps, the company named as fictional, the
// homeowner's form, the lead card, the review card and the mini quote — and
// that the quote's total, the review's approve-at figure and the working's
// total are ONE number. Then that Approve moves step 4: the mini quote drawn
// unapproved says Draft, drawn approved says "Approved — ready to send".

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import RoofingShowcase from "@/app/(marketing)/industries/[slug]/showcase/RoofingShowcase";
import MiniQuote from "@/app/(marketing)/industries/[slug]/showcase/MiniQuote";
import IndustryPageContent from "@/app/(marketing)/industries/[slug]/IndustryPageContent";
import { buildRoofingShowcase } from "@/app/(marketing)/industries/[slug]/showcase/buildRoofingShowcase";
import { runRequest, defaultBody } from "@/app/(marketing)/industries/[slug]/showcase/roofingRun";
import { industryShowcaseFor, industryChromeFor } from "@/app/i18n/industries";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { instantQuoteCopy, instantQuoteLanguage } from "@/lib/i18n/instantQuoteCopy";
import { moneyFormatter } from "@/lib/format/money";

let pass = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fails.push(name);
    console.log(`  FAIL ${name}${detail !== undefined ? `\n       ${String(JSON.stringify(detail)).slice(0, 400)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);

// The tripwire. Rendering must not fetch; nothing in the showcase may.
let fetched = [];
globalThis.fetch = (url, init) => {
  fetched.push({ url: String(url), method: init?.method || "GET" });
  return Promise.reject(new Error("check:roofing-example — no request may leave the showcase"));
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const render = (node, lang) => renderToStaticMarkup(createElement(LanguageProvider, { initialLanguage: lang }, node));

const fixture = buildRoofingShowcase();
const ANCHOR = "instant-quote-example";

section("1. The walk-through renders in every language a visitor can pick");
// The languages a visitor can pick (app/i18n/languages.js). The zh catalogue
// exists and part one checks its strings, but the provider does not offer
// it, so a zh render would be an English one.
for (const lang of LANGUAGE_CODES) {
  fetched = [];
  let html = "";
  try {
    html = render(createElement(RoofingShowcase, { fixture, anchor: ANCHOR }), lang);
  } catch (err) {
    ok(`${lang}: renders`, false, err?.stack?.split("\n").slice(0, 4).join(" | "));
    continue;
  }
  const copy = industryShowcaseFor(lang);
  const flowLang = instantQuoteLanguage(lang) || "en";
  const run = runRequest(fixture, defaultBody(fixture, flowLang));
  const money = moneyFormatter(fixture.company.currency, lang);
  ok(`${lang}: the section carries the ad anchor`, html.includes(`id="${ANCHOR}"`));
  ok(`${lang}: the example notice is on it, in ${lang}`, html.includes(esc(copy.notice)) && html.includes(esc(copy.noticeTitle)));
  ok(`${lang}: …with the company labelled fictional`, html.includes(esc(copy.exampleCompany)) && html.includes("Summit Ridge Roofing"));
  ok(`${lang}: four "how it works" steps`, copy.how.every((s) => html.includes(esc(s.title))));
  ok(`${lang}: step 1 is the homeowner's real form (${flowLang})`, html.includes(esc(instantQuoteCopy(flowLang).heroTitle)) && html.includes(esc(fixture.address)));
  ok(`${lang}: step 2 is the lead card, scored`, html.includes(esc(run.lead.name)) && html.includes(String(run.lead.score)));
  ok(`${lang}: step 3 is the review card for the same quote`, html.includes(run.review.quoteNumber) && html.includes(`value="${run.review.total}"`));
  if (lang === "en") {
    const review = html.slice(html.indexOf(run.review.quoteNumber), html.indexOf('data-sample-quote'));
    ok(`${lang}: step 3 says what "Approve at" is made of (= subtotal before tax + tax)`, review.includes(esc(`= ${money(run.review.subtotal)} before tax + ${money(run.review.tax)} tax.`)), review.match(/=[^<]*before tax[^<]*/)?.[0] || null);
  }
  ok(`${lang}: step 4's working has no "rounded" row — the lines add up to the subtotal`, !html.includes('data-working="rounding"'));
  ok(`${lang}: step 4's quote and working show that same total`, html.split(esc(money(run.draft.total))).length - 1 >= 2);
  ok(`${lang}: the quote starts as a Draft`, html.includes('data-sample-status="draft"'));
  ok(`${lang}: every option on the tier list is priced`, run.options.options.every((o) => html.includes(`data-tier="${o.materialKey}"`)));
  ok(`${lang}: "Example prices — you set your own" is printed`, html.includes(esc(copy.examplePrices)));
  ok(`${lang}: both CTAs — the trial and the demo`, html.includes('href="/signup"') && html.includes(esc(industryChromeFor(lang).startTrial)));
  ok(`${lang}: no Google URL anywhere in the markup`, !/maps\.googleapis|google\.com\/maps|maps\.google/.test(html));
  ok(`${lang}: rendering made no request`, fetched.length === 0, fetched);
}

section("2. Approve moves the mini quote from Draft to ready to send");
for (const lang of ["en", "fr", "pa"]) {
  const copy = industryShowcaseFor(lang);
  const run = runRequest(fixture, defaultBody(fixture, instantQuoteLanguage(lang) || "en"));
  const before = render(createElement(MiniQuote, { fixture, run, approved: false, copy }), lang);
  const after = render(createElement(MiniQuote, { fixture, run, approved: true, copy }), lang);
  ok(`${lang}: unapproved says Draft and waits for step 3`, before.includes('data-sample-status="draft"') && before.includes(esc(copy.waitingApproval)) && !before.includes(esc(copy.statusApproved)));
  ok(`${lang}: approved says "${copy.statusApproved}" and that lines can still be edited`, after.includes('data-sample-status="approved"') && after.includes(esc(copy.statusApproved)) && after.includes(esc(copy.editNote)));
  ok(`${lang}: the mini quote is not a link or a control`, !/<a\s|<button|onclick/i.test(before.slice(before.indexOf("data-sample-quote"), before.indexOf("data-sample-workings"))));
  const rows = [...before.matchAll(/data-working="(\w+)" data-amount="([-\d.]+)"/g)].map((m) => [m[1], Number(m[2])]);
  const byKey = Object.fromEntries(rows);
  const parts = rows.filter(([k]) => !["subtotal", "tax", "total"].includes(k)).reduce((s, [, v]) => s + v, 0);
  ok(`${lang}: the rendered working sums to the subtotal, and subtotal + tax to the total`, parts === byKey.subtotal && Math.round((byKey.subtotal + byKey.tax) * 100) === Math.round(byKey.total * 100) && byKey.total === run.draft.total, rows);
}

section("3. The hero link is data-driven");
{
  const roofing = render(createElement(IndustryPageContent, { slug: "roofing", videoId: null, showcase: { kind: "instant_quote", anchor: ANCHOR, data: fixture } }), "en");
  const painting = render(createElement(IndustryPageContent, { slug: "painting", videoId: null, showcase: null }), "en");
  const unknownKind = render(createElement(IndustryPageContent, { slug: "roofing", videoId: null, showcase: { kind: "nope", anchor: ANCHOR, data: fixture } }), "en");
  ok("roofing's hero links to #instant-quote-example with the translated label", roofing.includes(`href="#${ANCHOR}"`) && roofing.includes(esc(industryChromeFor("en").seeItInAction)));
  ok("…beside the trial and talk-to-us links, still there", roofing.includes('href="/signup"') && roofing.includes('href="/contact"'));
  ok("a trade with no showcase draws no such link", !painting.includes("data-showcase-cta") && painting.includes('href="/signup"'));
  ok("a showcase of a kind the page cannot draw gets no link to a missing anchor", !unknownKind.includes("data-showcase-cta"));
  const fr = render(createElement(IndustryPageContent, { slug: "roofing", videoId: null, showcase: { kind: "instant_quote", anchor: ANCHOR, data: fixture } }), "fr");
  ok("…and in French it reads the French label", fr.includes(esc(industryChromeFor("fr").seeItInAction)));
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
