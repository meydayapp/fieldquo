// scripts/check-roofing-example-browser.mjs
//
// Part three of check:roofing-example: the page itself, in Chrome, at 1280
// and at 375 — the only way to know the section renders at both widths and
// that walking it end to end sends nothing anywhere.
//
//   ROOFING_EXAMPLE_URL=http://localhost:3123/industries/roofing \
//   ROOFING_EXAMPLE_SHOTS=/path/to/dir \
//   node --import ./scripts/alias-loader.mjs scripts/check-roofing-example-browser.mjs
//
// Needs a running build and Google Chrome (playwright-core, channel
// "chrome", as scripts/scrape/lib/browser.mjs uses). Without the URL it says
// it was skipped and exits 0 — check:all runs on machines with neither, and
// a check that failed for want of a browser would teach people to ignore it.
//
// Every request the page makes is recorded from the first byte. It fails on
// any request to a Google host, any POST, and any call to /api/ — the
// showcase's promise is that walking it (form, lead drawer, approval) is
// entirely in the tab.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { instantQuoteCopy } from "@/lib/i18n/instantQuoteCopy";
import { tradeQuestionCopy } from "@/lib/leads/tradeQuestions";
import { industryShowcaseFor, industryChromeFor } from "@/app/i18n/industries";

const URL_ = process.env.ROOFING_EXAMPLE_URL;
if (!URL_) {
  console.log("check-roofing-example-browser: skipped — set ROOFING_EXAMPLE_URL to a running build's /industries/roofing.");
  process.exit(0);
}
const SHOTS = process.env.ROOFING_EXAMPLE_SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const { chromium } = await import("playwright-core");

let pass = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fails.push(name);
    console.log(`  FAIL ${name}${detail !== undefined ? `\n       ${String(JSON.stringify(detail)).slice(0, 500)}` : ""}`);
  }
};

const t = instantQuoteCopy("en");
const q = tradeQuestionCopy("en");
const copy = industryShowcaseFor("en");
const chrome = industryChromeFor("en");

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [width, height] of [[1280, 900], [375, 812]]) {
    console.log(`\n${width}px`);
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
    const shot = async (name, locator) => {
      if (!SHOTS) return;
      const path = join(SHOTS, `roof-example-${name}-${width}.png`);
      if (locator) await locator.screenshot({ path });
      else await page.screenshot({ path });
    };

    await page.goto(URL_, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const loadCount = requests.length;
    const showcase = page.locator("#instant-quote-example");
    ok("the section is on the page", await showcase.isVisible());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok("nothing scrolls sideways", overflow <= 1, overflow);

    const cta = page.locator("[data-showcase-cta]");
    ok(`the hero has "${chrome.seeItInAction}" beside the existing CTAs`, (await cta.isVisible()) && (await cta.locator("xpath=..").locator('a[href="/signup"]').isVisible()) && (await cta.locator("xpath=..").locator('a[href="/contact"]').isVisible()));
    await shot("hero", page.locator("h1").first().locator("xpath=ancestor::div[contains(@class,'grid')][1]"));
    // Element screenshots scroll the page; the sticky marketing header would
    // land across the middle of them. Hidden for the pictures only.
    if (SHOTS) await page.addStyleTag({ content: "body > header, header.sticky, [data-marketing-header] { visibility: hidden !important; }" });
    await cta.click();
    await page.waitForTimeout(400);
    ok("…it lands on the anchor with step 1 focused", (await page.evaluate(() => window.location.hash)) === "#instant-quote-example" && (await page.evaluate(() => document.activeElement?.id)) === "instant-quote-example-step-1");

    const flowHeader = showcase.locator("h1", { hasText: "Summit Ridge Roofing" }).first();
    ok("the homeowner's page carries the company's name and logo on a white header", (await flowHeader.isVisible()) && (await showcase.locator('img[src="/demo/summit-ridge/logo-mark.webp"]').first().isVisible()));
    await flowHeader.scrollIntoViewIfNeeded();
    await shot("header", flowHeader.locator("xpath=ancestor::div[contains(@class,'mb-8')][1]"));
    await shot("step1-form", showcase.locator("section[aria-labelledby='instant-quote-example-step-1']"));

    // Walk the form the way a homeowner would.
    await showcase.getByRole("button", { name: "Architectural shingles", exact: true }).click();
    await showcase.locator("input[type=number]").first().fill("1");
    await showcase.getByRole("button", { name: q.timeline.this_season || "This season" }).first().click().catch(() => {});
    const budget = showcase.getByRole("button", { name: /\$15,000\+/ }).first();
    if (await budget.count()) await budget.click();
    const leakNo = showcase.getByRole("button", { name: /^No$/ }).first();
    if (await leakNo.count()) await leakNo.click();
    const submit = showcase.getByRole("button", { name: t.ctaReveal });
    ok("the submit button is enabled once the job is described", await submit.isEnabled());
    await submit.click();
    await page.waitForTimeout(500);
    ok("submitting reveals the range in the panel", await showcase.getByText(t.estimatedRange).first().isVisible());
    ok("…and the steps below now show YOUR request", (await page.locator('[data-showcase-run="yours"]').count()) === 1);
    await shot("step1-revealed", showcase.locator("section[aria-labelledby='instant-quote-example-step-1']"));

    // Step 2: open the lead.
    const step2 = showcase.locator("section[aria-labelledby='instant-quote-example-step-2']");
    await step2.scrollIntoViewIfNeeded();
    await shot("step2-lead-card", step2);
    await step2.getByRole("button", { name: /Jordan Avery/ }).click();
    await page.waitForTimeout(300);
    const drawer = page.locator("div.fixed.inset-0.z-50").last();
    ok("the lead opens in the real drawer", await drawer.isVisible());
    ok("…with its score reasons and the homeowner's answers", (await drawer.getByText("Jordan Avery").first().isVisible()) && /Why this score/.test(await drawer.textContent()) && /active leak/i.test(await drawer.textContent()));
    await shot("step2-lead-drawer", drawer);
    await drawer.locator("button").first().click();
    await page.waitForTimeout(200);

    // Step 3 → 4: approve, and the mini quote moves.
    const step3 = showcase.locator("section[aria-labelledby='instant-quote-example-step-3']");
    const step4 = showcase.locator("section[aria-labelledby='instant-quote-example-step-4']");
    await step3.scrollIntoViewIfNeeded();
    await shot("step3-review", step3);
    ok("before approval the quote is a Draft", (await page.locator('[data-sample-status="draft"]').count()) === 1);
    await shot("step4-draft", step4);
    await step3.getByRole("button", { name: /Approve/ }).click();
    await page.waitForTimeout(300);
    ok("approving moves the quote to \"Approved — ready to send\"", (await page.locator('[data-sample-status="approved"]').count()) === 1 && (await step4.getByText(copy.statusApproved).isVisible()));
    await shot("step3-approved", step3);
    await step4.scrollIntoViewIfNeeded();
    await shot("step4-approved", step4);
    const report = showcase.locator("[data-showcase-report]");
    await report.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot("report-preview", report);
    // Scroll a preview's phone box to a section inside its (scaled) frame.
    const scrollTo = (box, id) =>
      box.evaluate((el, sel) => {
        const frame = el.querySelector("iframe");
        const target = frame?.contentDocument?.getElementById(sel);
        if (!target) return false;
        const scale = frame.getBoundingClientRect().width / frame.offsetWidth;
        const frameTop = frame.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
        el.scrollTop = frameTop + target.getBoundingClientRect().top * scale - 12;
        return true;
      }, id);
    const reportBox = report.locator("[data-showcase-scroll]");
    for (const id of ["about", "before-after", "documents"]) {
      ok(`the estimate report has the company's ${id} section`, await scrollTo(reportBox, id));
      await page.waitForTimeout(200);
      await shot(`report-${id}`, reportBox);
    }
    const quotePage = showcase.locator("[data-showcase-quote-page]");
    await quotePage.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot("quote-page-preview", quotePage);
    const quoteBox = quotePage.locator("[data-showcase-scroll]");
    const waiverAt = await quoteBox.evaluate((el) => {
      const frame = el.querySelector("iframe");
      const doc = frame?.contentDocument;
      const h = [...(doc?.querySelectorAll("h2,h3,p") || [])].find((n) => /acknowledgements \(1 of 2\)/.test(n.textContent));
      if (!h) return false;
      const scale = frame.getBoundingClientRect().width / frame.offsetWidth;
      const frameTop = frame.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      el.scrollTop = frameTop + h.getBoundingClientRect().top * scale - 40;
      return true;
    });
    ok("the quote page carries the owner's acknowledgements as a waiver", waiverAt);
    await page.waitForTimeout(200);
    await shot("quote-page-waiver", quoteBox);

    const after = requests.slice(loadCount);
    const google = requests.filter((r) => /google|gstatic/i.test(new URL(r.url).hostname));
    const posts = requests.filter((r) => r.method !== "GET" && r.method !== "HEAD");
    // The marketing header asks Better Auth whether the visitor is signed in
    // (MarketingHeader.js useSession) on every marketing page — not the
    // showcase's request, and a GET that writes nothing. Anything else under
    // /api/ fails.
    const api = requests.filter((r) => new URL(r.url).pathname.startsWith("/api/") && new URL(r.url).pathname !== "/api/auth/get-session");
    ok("no request to any Google host, from load to approval", google.length === 0, google);
    ok("no POST, PATCH or DELETE", posts.length === 0, posts);
    ok("no /api/ call beyond the marketing header's session check", api.length === 0, api);
    console.log(`  (${requests.length} requests in all, ${after.length} after load — ${[...new Set(after.map((r) => new URL(r.url).pathname.split("/").slice(0, 3).join("/")))].join(", ")})`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
