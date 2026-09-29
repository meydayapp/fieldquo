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
// showcase's promise is that walking it (form, lead drawer, approval, the
// previews' tabs and Phone/Desktop switch) is entirely in the tab.
//
// Then two more passes: every language a visitor can pick (what follows the
// site language, what follows the document's), and the opt-in "Use a real
// address" panel with Google and POST /api/showcase/roof-measure answered by
// stubs — measured, back to the sample, no roof model then a typed size, and
// the day's cap. No request in any pass reaches Google.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { instantQuoteCopy } from "@/lib/i18n/instantQuoteCopy";
import { tradeQuestionCopy } from "@/lib/leads/tradeQuestions";
import { industryShowcaseFor, industryChromeFor } from "@/app/i18n/industries";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { LANGUAGE_CODES } from "@/app/i18n/languages";
import { summitRidgeContentFor } from "@/app/(marketing)/industries/[slug]/showcase/summitRidgeContent.js";
import { documentLanguageFor } from "@/app/(marketing)/industries/[slug]/showcase/showcaseLanguage.js";
import { SESSION_LANGUAGE_KEY } from "@/lib/i18n/languageStorage";

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

    // Every Sample tag whole and on top. Hit-testing is the measure: a point
    // a clipping ancestor cuts away, or one the caption above lies over, hits
    // something other than the tag. The points are a 3x3 grid inside the
    // pill's rounded ends — the corners of its box lie outside a rounded-full
    // pill, and hit-testing honours the radius. (Owner's screenshot,
    // 2026-09-28: step 1's tag showed only its bottom half.)
    const tags = showcase.locator("[data-showcase-pill], [data-sample-frame] > span[aria-hidden='true']");
    const tagCount = await tags.count();
    const cut = [];
    for (let i = 0; i < tagCount; i += 1) {
      const miss = await tags.nth(i).evaluate(async (el) => {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = el.getBoundingClientRect();
        const k = r.height / 2;
        const pts = [r.left + k, (r.left + r.right) / 2, r.right - k].flatMap((x) => [r.top + 2, (r.top + r.bottom) / 2, r.bottom - 2].map((y) => [x, y]));
        return pts.filter(([x, y]) => !el.contains(document.elementFromPoint(x, y))).length;
      });
      if (miss) cut.push({ tag: (await tags.nth(i).textContent()).trim(), pointsHidden: miss });
    }
    ok(`all ${tagCount} Sample tags (3 surfaces, 2 previews) are whole — nothing clips or covers them`, tagCount === 5 && cut.length === 0, { tagCount, cut });

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

    // ── The previews navigate, and only navigate (owner, 2026-09-28) ─────
    const v3 = async (name, locator) => {
      if (!SHOTS) return;
      await locator.screenshot({ path: join(SHOTS, `roof-v3-${name}-${width}.png`) });
    };
    const expectedView = width >= 1024 ? "desktop" : "phone";
    ok(`both previews open in the ${expectedView} view at ${width}px`, (await reportBox.getAttribute("data-preview-view")) === expectedView && (await quoteBox.getAttribute("data-preview-view")) === expectedView);
    const aboutLabel = clientDocCopy("en").proposal.aboutUs;
    // Where a section sits inside its box, in box pixels from the box's top.
    const sectionOffset = (box, id) =>
      box.evaluate((el, sel) => {
        const frame = el.querySelector("iframe");
        const target = frame?.contentDocument?.getElementById(sel);
        if (!target) return null;
        const scale = frame.getBoundingClientRect().height / frame.offsetHeight;
        return frame.getBoundingClientRect().top - el.getBoundingClientRect().top + target.getBoundingClientRect().top * scale;
      }, id);
    for (const [name, box, tab] of [
      ["report", reportBox, report.frameLocator("iframe").locator('a[href="#about"]:visible').first()],
      ["quote", quoteBox, quotePage.frameLocator("iframe").locator("button:visible", { hasText: aboutLabel }).first()],
    ]) {
      await box.evaluate((el) => {
        el.scrollTop = 0;
      });
      await box.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      const before = await sectionOffset(box, "about");
      await tab.click();
      // A smooth scroll over thousands of pixels takes its time: wait until
      // the box stops moving (up to four seconds) before measuring.
      let last = -1;
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(200);
        const now = await box.evaluate((el) => el.scrollTop);
        if (now === last) break;
        last = now;
      }
      const after = await sectionOffset(box, "about");
      ok(`${name} preview: tapping "${aboutLabel}" scrolls the preview to that section`, before > 200 && after != null && after >= -4 && after < 80, { before, after });
      await v3(`tabs-${name}`, box);
    }
    // Anything that is not navigation does nothing, and says so.
    const checkbox = quotePage.frameLocator("iframe").locator("input[type=checkbox]:visible").first();
    if (await checkbox.count()) {
      await checkbox.scrollIntoViewIfNeeded();
      await checkbox.click({ force: true });
      await page.waitForTimeout(200);
      ok("a waiver box tapped in the preview stays unticked, with the Sample line under the preview", !(await checkbox.isChecked()) && (await quotePage.locator("[data-preview-blocked]").textContent()).includes(copy.previewBlocked));
    } else ok("the quote preview has a waiver box to try", false);
    // Phone / Desktop.
    for (const view of ["phone", "desktop"]) {
      await report.locator(`[data-view-toggle="report"] [data-view="${view}"]`).click();
      await page.waitForTimeout(900);
      ok(`report preview: "${view}" draws the page at ${view === "phone" ? 390 : 1280}px`, (await report.locator(`[data-sample-width="${view === "phone" ? 390 : 1280}"]`).count()) === 1 && (await report.locator(`[data-view="${view}"]`).getAttribute("aria-pressed")) === "true");
      await v3(`toggle-report-${view}`, report);
      await quotePage.locator(`[data-view-toggle="quote"] [data-view="${view}"]`).click();
      await page.waitForTimeout(900);
      ok(`quote preview: "${view}" draws the page at ${view === "phone" ? 390 : 1280}px`, (await quotePage.locator(`[data-sample-width="${view === "phone" ? 390 : 1280}"]`).count()) === 1);
      await v3(`toggle-quote-${view}`, quotePage);
    }
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok("…and neither view makes the page scroll sideways", sideways <= 1, sideways);

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

  // ── Every language a visitor can pick (owner, 2026-09-28) ──────────────
  //
  // The site language is the marketing switcher's session key; the page is
  // loaded fresh in each. What must follow it: the example notice, Summit
  // Ridge's tagline, the live panel. What follows the DOCUMENT language
  // (showcase/showcaseLanguage.js): the About inside the previews.
  console.log("\nlanguages (1280px)");
  for (const lang of LANGUAGE_CODES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    await context.addInitScript(([key, code]) => sessionStorage.setItem(key, code), [SESSION_LANGUAGE_KEY, lang]);
    const page = await context.newPage();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(URL_, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    const c = industryShowcaseFor(lang);
    const section_ = page.locator("#instant-quote-example");
    await section_.scrollIntoViewIfNeeded();
    const text = await section_.innerText();
    const doc = documentLanguageFor(lang);
    const aboutIn = await page.locator("[data-showcase-report] iframe").evaluate((f) => f.contentDocument?.body?.innerText || "");
    ok(`${lang}: the notice, the live panel and Summit Ridge's tagline are in ${lang}`, text.includes(c.noticeTitle) && text.includes(c.liveTitle) && text.includes(summitRidgeContentFor(lang).tagline), { notice: text.includes(c.noticeTitle), live: text.includes(c.liveTitle), tagline: text.includes(summitRidgeContentFor(lang).tagline) });
    ok(`${lang}: the report preview carries Summit Ridge's About in ${doc}`, aboutIn.includes(summitRidgeContentFor(doc).about.headline));
    ok(`${lang}: no Google request`, !requests.some((u) => /google|gstatic/i.test(new URL(u).hostname)));
    if (SHOTS) {
      await page.addStyleTag({ content: "body > header, header.sticky, [data-marketing-header] { visibility: hidden !important; }" });
      await section_.screenshot({ path: join(SHOTS, `roof-v3-lang-${lang}.png`), clip: undefined }).catch(async () => {
        await page.screenshot({ path: join(SHOTS, `roof-v3-lang-${lang}.png`) });
      });
    }
    await context.close();
  }

  // ── "Use a real address", with Google and the route stubbed ───────────
  //
  // No live Google call: every request to a Google host is answered here —
  // the Maps script by a stub whose Autocomplete fires a place on demand,
  // the still by a 1px image — or aborted, and each is recorded. The route
  // is answered from canned replies shaped by the real handler
  // (check-roofing-example-live.mjs proves the handler).
  console.log("\nuse a real address (1280px, Google and the route stubbed)");
  {
    const { showcaseTax } = await import("@/app/(marketing)/industries/[slug]/showcase/buildRoofingShowcase.js");
    const address = "742 Maple Ave, Kingston, ON K7L 1A1, Canada";
    const still = "https://maps.googleapis.com/maps/api/staticmap?center=44.23,-76.48&zoom=19&size=640x640&scale=2&maptype=satellite&key=stub";
    const measured = {
      ok: true,
      cached: false,
      house: {
        address,
        country: "CA",
        region: "ON",
        currency: "CAD",
        tax: showcaseTax({ province: "ON", country: "CA", address }),
        satelliteImageUrl: still,
        trustworthy: true,
        warnings: [],
        measurement: { source: "google_solar", areaSqft: 1830.2, squares: 18.3, predominantPitch: { rise: 5, run: 12, degrees: 22.6 }, steepness: "standard", segmentCount: 4, footprintSqft: 1690, formattedAddress: address, imageryDate: { year: 2024, month: 6, day: 3 }, satelliteImageUrl: still },
      },
    };
    const noRoof = { ok: false, reason: "no_roof_coverage", error: "x", cached: false, house: { ...measured.house, address: "9 Lonely Rd, Nowhere, SK S0K 0A0, Canada", region: "SK", tax: showcaseTax({ province: "SK", country: "CA", address: "9 Lonely Rd, Nowhere, SK S0K 0A0, Canada" }), measurement: null, trustworthy: null } };
    const capped = { ok: false, reason: "capped", error: "The live example has reached today's limit — try the sample house." };
    const replies = [[200, measured], [422, noRoof], [429, capped]];
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const google = [];
    const routeCalls = [];
    const STUB = `(() => {
      const acs = [];
      class Autocomplete { constructor(input) { this.input = input; this.fns = []; acs.push(this); } addListener(ev, fn) { this.fns.push(fn); return { ev }; } getPlace() { return this.place; } }
      window.google = { maps: { places: { Autocomplete }, event: { removeListener() {} } } };
      window.__fqPlaces = { pick(place) { const a = acs[acs.length - 1]; a.place = place; a.input.value = place.formatted_address; a.fns.forEach((f) => f()); } };
      if (typeof window.initMap === "function") window.initMap();
    })();`;
    const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    await context.route(/^https:\/\/([a-z0-9-]+\.)*(googleapis|gstatic|google)\.com\//, (route) => {
      const url = route.request().url();
      google.push(url);
      if (/maps\/api\/js/.test(url)) return route.fulfill({ status: 200, contentType: "text/javascript", body: STUB });
      if (/maps\/api\/staticmap/.test(url)) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
      return route.abort();
    });
    await context.route("**/api/showcase/roof-measure", (route) => {
      routeCalls.push({ method: route.request().method(), body: route.request().postDataJSON() });
      const [status, body] = replies.shift() || [503, { ok: false, reason: "unavailable" }];
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    const seen = [];
    page.on("request", (r) => seen.push(r.url()));
    await page.goto(URL_, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    ok("nothing Google is asked for until the visitor presses the button", google.length === 0, google);
    const live = page.locator("[data-showcase-live]");
    await live.scrollIntoViewIfNeeded();
    await live.locator("[data-live-open]").click();
    await page.waitForTimeout(800);
    ok("pressing it loads the Places picker (stubbed here)", google.some((u) => /maps\/api\/js/.test(u)) && (await live.locator("input[name=address]").isVisible()));
    ok("…and Measure waits for a picked address", await live.locator("[data-live-measure]").isDisabled());
    const pick = (formatted, country) => page.evaluate(([f, c]) => window.__fqPlaces.pick({ formatted_address: f, address_components: [{ types: ["country"], short_name: c, long_name: c }], geometry: null }), [formatted, country]);

    await pick("10 High St, Oxford OX1 4DB, UK", "GB");
    await live.locator("[data-live-measure]").click();
    await page.waitForTimeout(300);
    ok("a UK address is refused in the page, with no call", (await live.locator('[data-live-reason="outside"]').isVisible()) && routeCalls.length === 0);

    await pick(address, "CA");
    await live.locator("[data-live-measure]").click();
    await page.waitForTimeout(1200);
    ok("a Canadian address: one POST with the address and country only", routeCalls.length === 1 && routeCalls[0].method === "POST" && JSON.stringify(Object.keys(routeCalls[0].body).sort()) === JSON.stringify(["address", "country"]) && routeCalls[0].body.country === "CA");
    ok("…the panel says what was measured", (await live.getAttribute("data-showcase-live")) === "measured" && (await live.locator('[data-live-showing="measured"]').textContent()).includes("18.3"));
    const step1 = page.locator("section[aria-labelledby='instant-quote-example-step-1']");
    const formAddress = await step1.locator("input[readonly]").first().inputValue();
    ok("…the homeowner's form now shows that address", formAddress === address, formAddress);
    ok("…the step-1 note says the picture is Google's photo", (await step1.textContent()).includes(copy.liveImageNote));
    const working = page.locator("[data-sample-workings] [data-working-source]");
    ok("…and step 4's working is on that roof (18.3 squares, measured)", (await working.getAttribute("data-working-source")) === "google_solar" && (await working.textContent()).includes("18.3"));
    if (SHOTS) {
      await page.addStyleTag({ content: "body > header, header.sticky, [data-marketing-header] { visibility: hidden !important; }" });
      await step1.screenshot({ path: join(SHOTS, "roof-v3-live-measured-1280.png") });
    }

    await live.locator("[data-live-back]").click();
    await page.waitForTimeout(400);
    ok("Back to the sample house restores the sample", (await live.getAttribute("data-showcase-live")) === "sample" && (await step1.locator("input[readonly]").first().inputValue()) === "123 Sample Street, Ottawa, ON");

    await pick("9 Lonely Rd, Nowhere, SK S0K 0A0, Canada", "CA");
    await live.locator("[data-live-measure]").click();
    await page.waitForTimeout(800);
    ok("no roof model: the sentence, and a box to type the size", (await live.locator('[data-live-reason="no_roof_coverage"]').isVisible()) && (await live.locator("[data-live-squares] input").isVisible()));
    await live.locator("[data-live-squares] input").fill("2");
    await live.locator("[data-live-squares] button").click();
    await page.waitForTimeout(200);
    ok("…a size that is no house is refused with the range", (await live.locator("[role=alert]").textContent()).includes("4") && (await live.getAttribute("data-showcase-live")) === "sample");
    await live.locator("[data-live-squares] input").fill("22.5");
    await live.locator("[data-live-squares] button").click();
    await page.waitForTimeout(800);
    ok("…22.5 typed squares price the house as TYPED, not measured", (await live.getAttribute("data-showcase-live")) === "typed" && (await working.getAttribute("data-working-source")) === "manual" && (await working.textContent()).includes("22.5"));
    if (SHOTS) await step1.screenshot({ path: join(SHOTS, "roof-v3-live-typed-1280.png") });

    await pick("55 Elm St, Ottawa, ON K1A 0B1, Canada", "CA");
    await live.locator("[data-live-measure]").click();
    await page.waitForTimeout(800);
    ok("the day's cap: \"The live example has reached today's limit — try the sample house.\"", (await live.locator('[data-live-reason="capped"]').textContent()) === copy.liveCapped);
    if (SHOTS) await live.screenshot({ path: join(SHOTS, "roof-v3-live-capped-1280.png") });
    const seenGoogle = seen.filter((u) => /(^|\.)(googleapis|gstatic|google)\.com$/i.test(new URL(u).hostname));
    ok("every Google request the page made was answered by the stub or aborted — none reached Google", seenGoogle.length > 0 && seenGoogle.every((u) => google.includes(u)), seenGoogle.filter((u) => !google.includes(u)));
    ok("three POSTs in all, one per measured address, none for the UK one", routeCalls.length === 3);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
