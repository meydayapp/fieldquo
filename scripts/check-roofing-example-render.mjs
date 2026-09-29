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
import { industryShowcaseFor, industryChromeFor, INDUSTRY_MESSAGES } from "@/app/i18n/industries";
import { summitRidgeContentFor } from "@/app/(marketing)/industries/[slug]/showcase/summitRidgeContent";
import { documentLanguageFor, fixtureInLanguage } from "@/app/(marketing)/industries/[slug]/showcase/showcaseLanguage";
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

section("4. Every Sample tag is whole — none pinned half outside a box that clips it");
// Owner's screenshot, 2026-09-28: step 1's "Sample · What the homeowner
// sees" tag was `absolute -top-3` on a surface that is overflow-hidden, so
// the clip showed only the bottom half of its letters, under the caption.
// The Surface tags are now in the flow; SampleFrame's own tag still sits on
// its frame's top border, so the scrolling (clipping) box around each
// preview must pad above it by more than it sticks out. Part three measures
// the same thing in Chrome; this holds the structure without a browser.
for (const lang of LANGUAGE_CODES) {
  const html = render(createElement(RoofingShowcase, { fixture, anchor: ANCHOR }), lang);
  const copy = industryShowcaseFor(lang);
  const classOf = (tag) => tag.match(/class="([^"]*)"/)?.[1] || "";
  const NEG = /(^|\s)-(top|mt|inset|inset-y|translate-y)-/;

  const pills = [...html.matchAll(/<span[^>]*data-showcase-pill[^>]*>([^<]*)<\/span>/g)];
  ok(`${lang}: three Surface tags (steps 1, 2 and 3), each saying "${copy.sampleTag} · …"`, pills.length === 3 && pills.every((m) => m[1].startsWith(esc(copy.sampleTag))), pills.map((m) => m[1]));
  ok(`${lang}: …none positioned out of the flow or offset upward`, pills.every((m) => !/(^|\s)(absolute|fixed|sticky)(\s|$)/.test(classOf(m[0])) && !NEG.test(classOf(m[0]))), pills.map((m) => classOf(m[0])));
  const surfaces = html.split("data-showcase-surface").length - 1;
  const leading = [...html.matchAll(/data-showcase-surface[^>]*><div[^>]*><span[^>]*data-showcase-pill/g)].length;
  ok(`${lang}: …and each is the first thing inside its surface, above the screen`, surfaces === 3 && leading === 3, { surfaces, leading });

  const frameTags = [...html.matchAll(/data-sample-frame="[^"]*"[^>]*><span aria-hidden="true" class="([^"]*)"/g)];
  ok(`${lang}: both previews wear SampleFrame's tag`, frameTags.length === 2, frameTags.length);
  for (const m of frameTags) {
    const offset = Number(classOf(`class="${m[1]}"`).match(/(?:^|\s)-top-([\d.]+)/)?.[1] || 0) * 4;
    const scrollAt = html.lastIndexOf("data-showcase-scroll", m.index);
    const scrollDiv = scrollAt < 0 ? "" : html.slice(html.lastIndexOf("<div", scrollAt), scrollAt);
    const pad = Number(classOf(scrollDiv).match(/(?:^|\s)pt-([\d.]+)(\s|$)/)?.[1] || 0) * 4;
    const between = scrollAt < 0 ? "" : html.slice(scrollAt, m.index);
    ok(`${lang}: SampleFrame's tag (${offset}px above its frame) clears the top of the scroll box that clips it (${pad}px padding, 8px to spare)`, scrollAt >= 0 && pad - offset >= 8 && (between.match(/<div/g) || []).length === 1, { offset, pad });
  }
}

section("5. The showcase follows the visitor's language — as far as the product does");
// Owner, 2026-09-28: switched the site to UK, ਪੰ, TL, DE, IT and parts of the
// showcase stayed English. The rule now (showcase/showcaseLanguage.js): the
// section, the app screens and Summit Ridge's card follow the SITE language;
// the homeowner's pages and the draft follow the DOCUMENT language, which is
// the site's when the product's homeowner pipeline speaks it (en, fr, es)
// and English otherwise. So: French and Spanish renders may contain NO
// English string from the fixture anywhere; the other five may contain them
// only inside the homeowner's pages (the step-1 form and the two previews)
// and in the draft's own line wording — and step 1 says why.
{
  const enContent = summitRidgeContentFor("en");
  const EN_SHOWCASE = INDUSTRY_MESSAGES.en.showcase;
  const englishStrings = (lang) => {
    const own = INDUSTRY_MESSAGES[lang]?.showcase || {};
    const copyStrings = Object.entries(EN_SHOWCASE)
      .filter(([k, v]) => typeof v === "string" && v.length > 12 && own[k] !== v)
      // Templates are checked through their fixed opening words only.
      .map(([, v]) => v.split("{")[0].trim())
      .filter((v) => v.length > 12);
    return [
      enContent.about.headline,
      enContent.tagline,
      enContent.insuranceTitle,
      enContent.waiverTitle.split("(")[0].trim(),
      ...enContent.process.steps.map((s) => s.title),
      ...enContent.waivers.map((w) => w.title),
      // A product name a language keeps as a loanword (Tagalog's
      // "Architectural shingles") is that language's word, not a leak.
      ...Object.entries(EN_SHOWCASE.materials).filter(([k, v]) => own.materials?.[k] !== v).map(([, v]) => v),
      ...copyStrings,
    ];
  };
  const cut = (html, from, to) => (from >= 0 && to > from ? html.slice(0, from) + html.slice(to) : html);
  for (const lang of LANGUAGE_CODES) {
    const html = render(createElement(RoofingShowcase, { fixture, anchor: ANCHOR }), lang);
    const doc = documentLanguageFor(lang);
    const content = summitRidgeContentFor(lang);
    ok(`${lang}: Summit Ridge's tagline on the company card is in ${lang}`, html.includes(esc(content.tagline)));
    const docContent = summitRidgeContentFor(doc);
    ok(`${lang}: both homeowner previews carry Summit Ridge's About and process in the document language (${doc})`, html.split(esc(docContent.about.headline)).length - 1 >= 2 && html.includes(esc(docContent.process.steps[8].title)) && html.includes(esc(docContent.waivers[9].title)));
    if (lang === "en") continue;
    let outside = html;
    if (doc !== lang) {
      // The homeowner's pages, in the document language by the product's
      // own limit: the form's surface, and each preview's frame content.
      outside = cut(outside, outside.indexOf("data-showcase-surface"), outside.indexOf("data-showcase-report"));
      const rp = outside.indexOf("data-showcase-report");
      outside = cut(outside, outside.indexOf("data-sample-fallback", rp), outside.indexOf("data-showcase-run"));
      const qp = outside.indexOf("data-showcase-quote-page");
      outside = cut(outside, outside.indexOf("data-sample-fallback", qp), outside.indexOf('href="/signup"', qp));
      // The draft's own lines, written in its language when it was created.
      const run = runRequest(fixtureInLanguage(fixture, lang), defaultBody(fixtureInLanguage(fixture, lang), doc));
      for (const l of run.draft.lineItems) outside = outside.split(esc(l.description)).join("");
    }
    const leaked = englishStrings(lang).filter((s) => outside.includes(esc(s)));
    ok(`${lang}: no English fixture or showcase string ${doc === lang ? "anywhere on the section" : "outside the homeowner's pages and the draft's own lines"}`, leaked.length === 0, leaked);
    if (doc !== lang) ok(`${lang}: …and step 1 says the homeowner's pages are in English`, html.includes(esc(industryShowcaseFor(lang).formLanguageNote)));
  }
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
