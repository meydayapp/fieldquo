// scripts/check-pay-over-time-guide.mjs
//
//   npm run check:pay-over-time-guide
//
// The client's "How to pay over time" guide and the financing copy on
// fieldquo.com (2026-10-09). What is held here:
//
//   1. ONE rule. payOverTimeOffer (lib/payments/payOverTimeGuide.js) is the
//      portal's old inline expression, moved — EXECUTED against it across
//      every combination of currency, account, demo, opt-in, status and
//      amount, so "the email's link follows the button" is proved, not said.
//   2. The guide link renders exactly where the button does, and the three
//      invoice-email senders pass a link only through that rule.
//   3. The email line: present with a URL under a working Pay button,
//      absent on a receipt, without a card, or without a URL — in all eight
//      client languages.
//   4. The guide itself, RENDERED with react-dom/server in all eight client
//      languages: four steps, the company's name, the provider's name, no
//      FieldQuo, no money, one image with a sentence, an honest empty state.
//   5. Contrast, MEASURED: every text/background pair the guide, the portal
//      link and the email line draw, for yellow, white, black, mid-grey,
//      lime, pale grey, red and the fallback navy.
//   6. Claims. Every client sentence and every new marketing sentence is read
//      against the banned list (rates, "0%", interest-free, approval odds,
//      Afterpay while the pay link does not offer it); the confirmed facts
//      are pinned; the Stripe URLs they rest on are cited in the source.
//   7. A mutant of the rule (demo ignored) and of the copy (an "interest-free"
//      promise) — each must be caught, or this file proves nothing.
//
// Bundled with esbuild first — the guide is JSX:
//   npx esbuild scripts/check-pay-over-time-guide.mjs --bundle --platform=node \
//     --format=cjs --jsx=automatic --loader:.js=jsx --alias:@=. \
//     --outfile=.pay-over-time-guide.cjs && node .pay-over-time-guide.cjs

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PAY_OVER_TIME_COMPANY_SELECT,
  payOverTimeOffer,
  payOverTimeGuidePath,
  payOverTimeGuideUrl,
  guideProviders,
  guideBackPath,
  guidePalette,
  parseGuideProviders,
  providerNames,
} from "@/lib/payments/payOverTimeGuide";
import {
  PAY_OVER_TIME_GUIDE_COPY,
  PAY_OVER_TIME_GUIDE_LANGUAGES,
  payOverTimeGuideCopy,
  payOverTimeGuideLink,
} from "@/lib/i18n/payOverTimeGuideCopy";
import { FINANCING_PROVIDERS, offeredFinancingMethods } from "@/lib/stripe/financingMethods";
import { invoicePaymentCurrency } from "@/lib/stripe/paymentCurrency";
import { HOW_TO_PAY_COMPANY_SELECT } from "@/lib/payments/offlineMethods";
import { documentTheme, outlinePair, PORTAL_PAY_SURFACE } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { buildInvoiceEmail } from "@/lib/email/invoiceEmail";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { PRODUCT_FEATURES } from "@/app/data/productFeatures";
import { HOME_PAGE_EN } from "@/app/i18n/homePage/en.js";
import { HOME_PAGE_FR } from "@/app/i18n/homePage/fr.js";
import { HOME_PAGE_ES } from "@/app/i18n/homePage/es.js";
import { HOME_PAGE_UK } from "@/app/i18n/homePage/uk.js";
import { HOME_PAGE_PA } from "@/app/i18n/homePage/pa.js";
import { HOME_PAGE_TL } from "@/app/i18n/homePage/tl.js";
import { HOME_PAGE_DE } from "@/app/i18n/homePage/de.js";
import { HOME_PAGE_IT } from "@/app/i18n/homePage/it.js";
import { HOME_PAGE_ZH } from "@/app/i18n/homePage/zh.js";
import { HOME_PAGE_KO } from "@/app/i18n/homePage/ko.js";
import { HOME_PAGE_PT_BR as HOME_PAGE_PT } from "@/app/i18n/homePage/pt.js";
import { HOME_PAGE_RU } from "@/app/i18n/homePage/ru.js";
import { OUTCOME_GROUPS } from "@/app/components/marketing/home/OutcomeGroups";
import PayOverTimeGuide from "@/app/portal/[token]/pay-over-time/PayOverTimeGuide";

let pass = 0;
const fails = [];
// Label first, condition second (a non-empty label as the condition can
// never fail — see check-product-pages.mjs).
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fails.push(label);
    console.log(`  ✗ ${label}${detail !== undefined ? `  — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  }
  return !!cond;
};
const section = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 64 - t.length))}\n`);
// Relative to the repo root: import.meta.url does not survive esbuild's cjs.
const read = (p) => readFileSync(p, "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
const textOf = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// ── The claims nobody may make on these surfaces ───────────────────────────
// Rates and promotional terms: Stripe says Klarna financing "might include
// interest" and that approval "is subject to creditworthiness"
// (https://docs.stripe.com/payments/klarna); FieldQuo cannot know which plan
// a client will see, so no surface may promise one. Afterpay: not on the pay
// link (lib/stripe/financingMethods.js), so not in the copy.
const AFTERPAY_OFFERED = Object.prototype.hasOwnProperty.call(FINANCING_PROVIDERS, "afterpay");
const BANNED = [
  [/\d\s?%/, "a percentage"],
  [/\bAPR\b|\bTAEG\b|\bTAN\b/i, "an APR"],
  [/interest[- ]free|without interest|no interest|sans (frais|intérêt)|sin intereses|без відсотків|zinsfrei|ohne Zinsen|senza interessi|walang interes|无息|免息|무이자|sem juros|без процентов/i, "interest-free"],
  [/approval rate|always approved|guaranteed|garanti|no credit check/i, "approval odds"],
  ...(AFTERPAY_OFFERED ? [] : [[/afterpay|clearpay/i, "Afterpay (not on the pay link)"]]),
];
const claimsIn = (s) => BANNED.filter(([re]) => re.test(String(s))).map(([, why]) => why);

// ── Hostile brands ─────────────────────────────────────────────────────────
const BRANDS = {
  yellow: "#facc15",
  white: "#ffffff",
  black: "#000000",
  "mid-grey": "#808080",
  lime: "#84cc16",
  "pale grey": "#e5e7eb",
  red: "#dc2626",
  fallback: null,
};

async function main() {
  // ═══════════════════════════════════════════════════════════════════════
  section("1. One rule — payOverTimeOffer IS the portal's old expression");
  // ═══════════════════════════════════════════════════════════════════════

  // The expression app/api/portal/[token]/route.js computed inline until
  // this change, verbatim in meaning: a charge currency, online payments,
  // not a demo, then offeredFinancingMethods.
  const legacy = (company, amountCents) => {
    let currency = null;
    try {
      currency = invoicePaymentCurrency(company?.currency);
    } catch {
      currency = null;
    }
    const demo = Boolean(company?.isDemo);
    const online = Boolean(company?.stripeAccountId && company?.stripeChargesEnabled) || demo;
    return currency && online && !demo ? offeredFinancingMethods({ company, amountCents, currency }) : [];
  };

  const ruleSuite = (offer, assert) => {
    const base = {
      currency: "CAD",
      stripeAccountId: "acct_1",
      stripeChargesEnabled: true,
      isDemo: false,
      offerFinancing: true,
      stripeKlarnaStatus: "active",
      stripeAffirmStatus: "inactive",
    };
    assert("TrueFinish's case — CA$6,500, Klarna active, Affirm refused → Klarna", JSON.stringify(offer({ company: base, amountCents: 650_000 })) === '["klarna"]');
    assert("a demo company is never offered it", offer({ company: { ...base, isDemo: true }, amountCents: 650_000 }).length === 0);
    assert("no Stripe account → none", offer({ company: { ...base, stripeAccountId: null }, amountCents: 650_000 }).length === 0);
    assert("charges not enabled → none", offer({ company: { ...base, stripeChargesEnabled: false }, amountCents: 650_000 }).length === 0);
    assert("an unknown currency is none, never a CAD guess", offer({ company: { ...base, currency: "XYZ" }, amountCents: 650_000 }).length === 0 && offer({ company: { ...base, currency: null }, amountCents: 650_000 }).length === 0);
    assert("switched off → none", offer({ company: { ...base, offerFinancing: false }, amountCents: 650_000 }).length === 0);
    assert("pending / inactive / unavailable / null → none", ["pending", "inactive", "unavailable", null].every((st) => offer({ company: { ...base, stripeKlarnaStatus: st }, amountCents: 650_000 }).length === 0));
    assert("over Klarna's CAD financing ceiling (17,500) → none", offer({ company: base, amountCents: 1_750_001 }).length === 0 && offer({ company: base, amountCents: 1_750_000 }).length === 1);
    assert("Affirm active as well, CA$20,000 → Affirm only (Klarna's range ends at 17,500)", JSON.stringify(offer({ company: { ...base, stripeAffirmStatus: "active" }, amountCents: 2_000_000 })) === '["affirm"]');
    assert("zero / negative / NaN amount → none", [0, -100, NaN].every((a) => offer({ company: base, amountCents: a }).length === 0));
  };
  ruleSuite(payOverTimeOffer, ok);

  // Equivalence, exhaustively over a grid.
  {
    let cases = 0;
    let mismatches = [];
    for (const currency of ["CAD", "usd", "gbp", "XYZ", null])
      for (const stripeAccountId of ["acct_1", null])
        for (const stripeChargesEnabled of [true, false])
          for (const isDemo of [false, true])
            for (const offerFinancing of [true, false])
              for (const stripeKlarnaStatus of ["active", "pending", "inactive", null])
                for (const stripeAffirmStatus of ["active", "inactive", null])
                  for (const amountCents of [0, 100, 4_500, 25_000, 150_001, 650_000, 1_000_001, 1_750_001, 3_000_001]) {
                    const company = { currency, stripeAccountId, stripeChargesEnabled, isDemo, offerFinancing, stripeKlarnaStatus, stripeAffirmStatus };
                    cases++;
                    const a = JSON.stringify(payOverTimeOffer({ company, amountCents }));
                    const b = JSON.stringify(legacy(company, amountCents));
                    if (a !== b) mismatches.push({ company, amountCents, a, b });
                  }
    ok(`payOverTimeOffer equals the portal's previous inline rule on all ${cases} combinations`, mismatches.length === 0, mismatches.slice(0, 2));
  }
  ok("a missing company is none, never a throw", payOverTimeOffer({}).length === 0 && payOverTimeOffer().length === 0);

  {
    const portal = code(read("app/api/portal/[token]/route.js"));
    ok("the portal route's financingFor IS payOverTimeOffer (no second copy)",
      /const financingFor = \(amountCents\) => payOverTimeOffer\(\{ company: client\.company, amountCents \}\);/.test(portal) && !/offeredFinancingMethods\(/.test(portal));
  }

  // ═══════════════════════════════════════════════════════════════════════
  section("2. Links — where the button is, and only through the rule");
  // ═══════════════════════════════════════════════════════════════════════

  {
    const inv = code(read("app/portal/[token]/invoices/[id]/PortalInvoice.js"));
    const block = inv.slice(inv.indexOf("{financing.length > 0 && ("), inv.indexOf("{bankDebit && ("));
    ok("portal invoice page: the guide link sits INSIDE the `financing.length > 0` block (shown exactly when the button is)",
      block.length > 0 && /data-pay-over-time-guide-link/.test(block) && (inv.match(/data-pay-over-time-guide-link/g) || []).length === 1);
    ok("  ^ it names the providers the server offered for this figure, and the record to return to — never an amount",
      /payOverTimeGuidePath\(token, \{ providers: financing, invoiceId, stageId, requestId \}\)/.test(block) && !/amount/i.test(block.slice(block.indexOf("payOverTimeGuidePath"), block.indexOf("payOverTimeGuidePath") + 90)));
  }
  {
    const senders = {
      "app/api/invoices/[id]/send/route.js": /payOverTimeUrl: payOverTimeGuideUrl\(\{[\s\S]*?amountCents: ask\.requestCents,/,
      "app/api/invoices/[id]/request-payment/route.js": /const payOverTimeUrl = payOverTimeGuideUrl\(\{[\s\S]*?amountCents: requestCents \?\? Math\.round\(balance \* 100\),/,
      "lib/paymentSchedule/run.js": /payOverTimeUrl: payOverTimeGuideUrl\(\{[\s\S]*?amountCents: askCents,/,
    };
    for (const [file, re] of Object.entries(senders)) {
      const src = code(read(file));
      ok(`${file}: the email's guide link comes from payOverTimeGuideUrl for the figure it asks for, and the select carries its columns`,
        re.test(src) && /\.\.\.PAY_OVER_TIME_COMPANY_SELECT/.test(src));
    }
    const rp = code(read("app/api/invoices/[id]/request-payment/route.js"));
    ok("  ^ request-payment passes it to BOTH builds (balance chase and stage / different amount)", (rp.match(/payOverTimeUrl,/g) || []).length === 2);
    ok("the shared HOW_TO_PAY_COMPANY_SELECT is untouched — the public quote route spreads it, and a new status column there would leak",
      !("stripeKlarnaStatus" in HOW_TO_PAY_COMPANY_SELECT) && !("isDemo" in HOW_TO_PAY_COMPANY_SELECT) && !/PAY_OVER_TIME_COMPANY_SELECT/.test(read("app/api/public/quotes/[token]/route.js")));
    ok("PAY_OVER_TIME_COMPANY_SELECT names every column payOverTimeOffer reads",
      ["currency", "stripeAccountId", "stripeChargesEnabled", "isDemo", "offerFinancing", "stripeAffirmStatus", "stripeKlarnaStatus"].every((k) => PAY_OVER_TIME_COMPANY_SELECT[k] === true));
  }
  {
    const co = { currency: "CAD", stripeAccountId: "a", stripeChargesEnabled: true, offerFinancing: true, stripeKlarnaStatus: "active" };
    const p = payOverTimeGuidePath("tok/../x", { providers: ["klarna", "afterpay", "klarna"], invoiceId: "inv_1", stageId: "st 1" });
    ok("guide path: token encoded, unknown providers dropped, a malformed id left out, no amount",
      p === "/portal/tok%2F..%2Fx/pay-over-time?p=klarna&invoice=inv_1" && !/amount|cents/i.test(p), p);
    ok("guide URL: absolute when the payment offers it", payOverTimeGuideUrl({ origin: "https://app.example.com/", token: "t", company: co, amountCents: 650_000, invoiceId: "i1", requestId: "r1" }) === "https://app.example.com/portal/t/pay-over-time?p=klarna&invoice=i1&request=r1");
    ok("guide URL: null when it does not (amount out of range, demo, no origin)",
      payOverTimeGuideUrl({ origin: "https://x", token: "t", company: co, amountCents: 5_000_000 }) === null &&
        payOverTimeGuideUrl({ origin: "https://x", token: "t", company: { ...co, isDemo: true }, amountCents: 650_000 }) === null &&
        payOverTimeGuideUrl({ origin: "", token: "t", company: co, amountCents: 650_000 }) === null);
    ok("back link: the invoice (with its stage / request) it came from, else the portal home",
      guideBackPath("t", { invoiceId: "i1", stageId: "s1" }) === "/portal/t/invoices/i1?stage=s1" &&
        guideBackPath("t", { invoiceId: "i1", requestId: "r1" }) === "/portal/t/invoices/i1?request=r1" &&
        guideBackPath("t", { invoiceId: "javascript:alert(1)" }) === "/portal/t");
    ok("the page's providers: the query is a hint, never a grant",
      JSON.stringify(guideProviders(co, "klarna,affirm")) === '["klarna"]' &&
        JSON.stringify(guideProviders(co, "affirm")) === "[]" &&
        JSON.stringify(guideProviders(co, "")) === '["klarna"]' &&
        guideProviders({ ...co, isDemo: true }, "klarna").length === 0 &&
        guideProviders({ ...co, stripeChargesEnabled: false }, "klarna").length === 0 &&
        JSON.stringify(parseGuideProviders(["KLARNA", "afterpay"])) === '["klarna"]');
    const page = code(read("app/portal/[token]/pay-over-time/page.js"));
    ok("the page awaits params AND searchParams (Next 16), names providers through guideProviders, and is noindex",
      /const \{ token \} = await params;/.test(page) && /await searchParams/.test(page) && /guideProviders\(company, p\)/.test(page) && /index: false/.test(page));
  }

  // ═══════════════════════════════════════════════════════════════════════
  section("3. The email line — under a working Pay button, never on a receipt");
  // ═══════════════════════════════════════════════════════════════════════

  {
    const company = { name: "Northline Painting", brandColor: "#facc15", currency: "CAD", phone: "555" };
    const invoice = { invoiceNumber: "INV-1", total: 6500, amountPaid: 0, dueDate: null };
    const client = { name: "Sam Lee" };
    const url = "https://app.example.com/portal/t/invoices/i1";
    const guide = "https://app.example.com/portal/t/pay-over-time?p=klarna&invoice=i1";
    for (const language of PAY_OVER_TIME_GUIDE_LANGUAGES) {
      const e = buildInvoiceEmail({ invoice, client, company, url, canTakeCard: true, language, payOverTimeUrl: guide });
      const link = payOverTimeGuideLink(language);
      ok(`${language}: the invoice email carries "${link.prompt} ${link.action}" with the guide's URL, in HTML and text`,
        /data-pay-over-time-guide/.test(e.html) && e.html.includes(`href="${guide.replace(/&/g, "&amp;")}"`) && e.text.includes(guide) && e.text.includes(link.prompt));
    }
    const none = [
      ["no URL (the payment offers none)", { canTakeCard: true, payOverTimeUrl: null }],
      ["no card (the Pay button is 'View invoice')", { canTakeCard: false, payOverTimeUrl: guide }],
      ["a receipt", { canTakeCard: true, payOverTimeUrl: guide, kind: "paid", invoice: { ...invoice, amountPaid: 6500 } }],
    ];
    for (const [why, opts] of none) {
      const e = buildInvoiceEmail({ invoice, client, company, url, language: "en", ...opts });
      ok(`no guide line with ${why}`, !/data-pay-over-time-guide/.test(e.html) && !e.text.includes("pay-over-time"));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  section("4. The guide, rendered — eight languages, white-label, no money");
  // ═══════════════════════════════════════════════════════════════════════

  ok("the guide covers exactly the client languages (app/i18n/languages.js)",
    JSON.stringify([...PAY_OVER_TIME_GUIDE_LANGUAGES].sort()) === JSON.stringify([...LANGUAGE_CODES].sort()), PAY_OVER_TIME_GUIDE_LANGUAGES);
  const KEYS = Object.keys(PAY_OVER_TIME_GUIDE_COPY.en).sort();
  for (const language of PAY_OVER_TIME_GUIDE_LANGUAGES) {
    const raw = PAY_OVER_TIME_GUIDE_COPY[language];
    ok(`${language}: every key English has, four steps`, JSON.stringify(Object.keys(raw).sort()) === JSON.stringify(KEYS) && raw.steps.length === 4);
  }
  const COMPANY = "Northline Painting";
  for (const language of PAY_OVER_TIME_GUIDE_LANGUAGES) {
    const names = ["Klarna"];
    const copy = payOverTimeGuideCopy(language, { names, company: COMPANY });
    const html = renderToStaticMarkup(
      createElement(PayOverTimeGuide, {
        copy,
        pal: guidePalette({ brandColor: "#84cc16" }),
        company: { name: COMPANY, logoUrl: null },
        names,
        backHref: "/portal/t/invoices/i1",
        backLabel: copy.backToInvoice,
      }),
    );
    const text = textOf(html);
    const strings = [copy.title, copy.intro, copy.button, copy.alt, copy.unavailable, copy.linkPrompt, copy.linkAction, ...copy.steps.flatMap((s) => [s.title, s.body]), ...Object.values(copy.mock)];
    ok(`${language}: renders the title, four steps, the company and the provider`,
      text.includes(copy.title) && (html.match(/data-guide-step=/g) || []).length === 4 && text.includes(COMPANY) && text.includes("Klarna") && copy.steps.every((s) => text.includes(textOf(s.title)) && text.includes(textOf(s.body))));
    ok(`${language}: step 1 names the button exactly as the portal prints it`, copy.steps[0].title.includes(copy.button) && html.includes("data-mock-over-time"));
    ok(`${language}: step 3 says the provider decides and shows the plan first (provider named in it)`, copy.steps[2].body.includes("Klarna"));
    ok(`${language}: white-label — "FieldQuo" appears nowhere`, !/fieldquo/i.test(html));
    ok(`${language}: no money, no figure in the drawing (no currency sign, no number beyond the step bubbles)`, !/[$€£¥]/.test(text) && !/\d{2,}/.test(text));
    ok(`${language}: the mock is ONE image to a screen reader, with a sentence, and holds no control`,
      /role="img" aria-label="[^"]{20,}"/.test(html) && !/<button|<input|onclick/i.test(html) && (html.match(/<a /g) || []).length === 1);
    ok(`${language}: no banned claim in any sentence`, strings.every((s) => claimsIn(s).length === 0), strings.map((s) => [s, claimsIn(s)]).filter(([, c]) => c.length));
    ok(`${language}: lang attribute set for the reader's language`, html.includes(`lang="${language}"`));
  }
  {
    const copy = payOverTimeGuideCopy("en", { names: [], company: COMPANY });
    const html = renderToStaticMarkup(createElement(PayOverTimeGuide, { copy, pal: guidePalette({}), company: { name: COMPANY }, names: [], backHref: "/portal/t", backLabel: copy.backToAccount }));
    ok("nothing offered now → an honest sentence, no steps, no drawing", textOf(html).includes(copy.unavailable) && !/data-guide-step|role="img"/.test(html));
  }
  {
    const two = payOverTimeGuideCopy("fr", { names: providerNames(["affirm", "klarna"]), company: COMPANY });
    ok("two providers read with the language's own 'or' (fr: « Affirm ou Klarna »)", two.steps[1].title === "Choisissez Affirm ou Klarna");
    ok("an unknown language falls back to English, never blank", payOverTimeGuideCopy("xx", { names: ["Klarna"], company: COMPANY }).title === "How to pay over time");
  }

  // ═══════════════════════════════════════════════════════════════════════
  section("5. Contrast, measured against the surface each pair is drawn on");
  // ═══════════════════════════════════════════════════════════════════════

  for (const [label, hex] of Object.entries(BRANDS)) {
    const company = hex ? { brandColor: hex } : {};
    const p = guidePalette(company);
    const t = documentTheme(company);
    const portal = outlinePair(t, PORTAL_PAY_SURFACE);
    const pairs = [
      ["title / steps on the card", p.ink, p.paper, 4.5],
      ["intro / step body on the card", p.muted, p.paper, 4.5],
      ["step number on its bubble", p.bubble.fg, p.bubble.bg, 4.5],
      ["mock label on the mock card", p.mockInk, p.mockCard, 4.5],
      ["mock small print on the mock card", p.mockMuted, p.mockCard, 4.5],
      ["mock Pay text on its fill", p.mockFill.fg, p.mockFill.bg, 4.5],
      ["mock Pay-over-time text on the mock card", p.mockOutline.fg, p.mockCard, 4.5],
      ["the chosen row's ring (non-text) on the mock card", p.selected, p.mockCard, 3],
      ["the mock card's edge against the wash (non-text)", p.wash.bg, p.mockCard, 1.05],
      ["back link on the warm page", p.link, p.pageBg, 4.5],
      ["portal: 'Want to pay over time?' on the pay surface", portal.muted, PORTAL_PAY_SURFACE, 4.5],
      ["portal: 'See how' on the pay surface", portal.fg, PORTAL_PAY_SURFACE, 4.5],
      ["email: the guide line on paper", t.inkMuted, t.paper, 4.5],
      ["email: 'See how' on paper", t.accentText, t.paper, 4.5],
    ];
    const low = pairs.filter(([, fg, bg, min]) => contrastRatio(fg, bg) < min).map(([n, fg, bg, min]) => `${n} ${contrastRatio(fg, bg).toFixed(2)} < ${min}`);
    ok(`${label}${hex ? ` (${hex})` : ""}: every pair meets its bar`, low.length === 0, low.join("; "));
  }

  // ═══════════════════════════════════════════════════════════════════════
  section("6. fieldquo.com — the headline, the FAQ, the homepage line");
  // ═══════════════════════════════════════════════════════════════════════

  const HEADLINE = "Offer your clients financing and win more projects";
  {
    const q = PRODUCT_FEATURES.quoting;
    const inv = q.sections.find((s) => s.id === "invoice");
    ok("invoice section: the body carries the owner's headline and Klarna, paid up front minus fees",
      inv.body.includes(HEADLINE) && /Klarna/.test(inv.body) && /paid the full amount up front, minus fees/.test(inv.body) && /where Stripe enables Klarna for your business/.test(inv.body));
    ok("invoice section: a pay-over-time bullet (still three)", inv.bullets.length === 3 && inv.bullets.some((b) => /Pay over time with Klarna/.test(b)));
    const faq = q.faq.find((f) => f.id === "pay-over-time");
    ok('FAQ "Can my clients pay over time?" exists', faq?.q === "Can my clients pay over time?");
    ok("  ^ Klarna; Affirm ONLY where Stripe approves the business", /Klarna/.test(faq.a) && /Affirm, only where Stripe approves your business for it/.test(faq.a));
    ok("  ^ paid the full amount up front, minus fees, on the normal payout schedule (Klarna) / up to two business days to settle (Affirm)",
      /paid the full amount up front, minus fees/.test(faq.a) && /normal payout schedule/.test(faq.a) && /two business days to settle/.test(faq.a));
    ok("  ^ the provider decides approval", /provider decides whether to approve your client/.test(faq.a));
    const marketing = [inv.body, ...inv.bullets, faq.q, faq.a];
    ok("no banned claim in the new marketing sentences", marketing.every((s) => claimsIn(s).length === 0), marketing.map((s) => claimsIn(s)).flat());
    const src = read("app/data/productFeatures.js");
    ok("the sources are cited beside the copy (Stripe's Klarna, Klarna rules and Affirm pages)",
      ["https://docs.stripe.com/payments/klarna", "https://docs.stripe.com/payments/klarna/compliance", "https://docs.stripe.com/payments/affirm"].every((u) => src.includes(u)));
  }
  {
    const HOME = { en: HOME_PAGE_EN, fr: HOME_PAGE_FR, es: HOME_PAGE_ES, uk: HOME_PAGE_UK, pa: HOME_PAGE_PA, tl: HOME_PAGE_TL, de: HOME_PAGE_DE, it: HOME_PAGE_IT, zh: HOME_PAGE_ZH, ko: HOME_PAGE_KO, pt: HOME_PAGE_PT, ru: HOME_PAGE_RU };
    const KEY = "home.outcomes.paidFinancing";
    for (const [lang, cat] of Object.entries(HOME)) {
      const v = cat?.[KEY];
      ok(`homepage ${lang}: the Get-paid financing line, naming Klarna, no banned claim`, typeof v === "string" && v.length > 20 && /Klarna/.test(v) && /Stripe/.test(v) && claimsIn(v).length === 0, v);
    }
    ok("homepage en: the line opens with the owner's headline", HOME_PAGE_EN[KEY].startsWith(HEADLINE));
    const paid = OUTCOME_GROUPS.find((g) => g.key === "paid");
    ok("the Get-paid card (beside Payments) renders the line", paid?.note === "paidFinancing" && paid.items.some((i) => i.key === "payments") && /t\(`home\.outcomes\.\$\{group\.note\}`\)/.test(read("app/components/marketing/home/OutcomeGroups.js")));
  }
  {
    const src = read("lib/payments/payOverTimeGuide.js") + read("lib/i18n/payOverTimeGuideCopy.js");
    ok("the guide's claims cite Stripe's Klarna, Klarna-rules and Affirm pages",
      ["https://docs.stripe.com/payments/klarna", "https://docs.stripe.com/payments/klarna/compliance", "https://docs.stripe.com/payments/affirm"].every((u) => src.includes(u)));
  }

  // ═══════════════════════════════════════════════════════════════════════
  section("7. Mutants — each must be caught");
  // ═══════════════════════════════════════════════════════════════════════

  {
    const mutant = ({ company, amountCents } = {}) => payOverTimeOffer({ company: { ...company, isDemo: false }, amountCents });
    let caught = false;
    ruleSuite(mutant, (_label, cond) => {
      if (!cond) caught = true;
    });
    ok("a rule that forgets demo companies is caught", caught);
    ok("an 'interest-free' promise is caught", claimsIn("Pay in 4 interest-free payments").length > 0 && claimsIn("0% APR for 12 months").length > 0);
    ok(AFTERPAY_OFFERED ? "Afterpay is on the pay link, so it may be named" : "an Afterpay mention is caught while the pay link does not offer it", AFTERPAY_OFFERED || claimsIn("Pay with Afterpay").length > 0);
  }

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    console.log("\nFailed:");
    for (const f of fails) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
