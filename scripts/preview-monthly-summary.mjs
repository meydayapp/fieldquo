// scripts/preview-monthly-summary.mjs
//
// Renders the monthly summary email to docs/screens/monthly-summary/ — the
// HTML, the plain-text part, and PNGs at phone and desktop width — so the
// owner can see it without waiting for the 1st.
//
//   node --import ./scripts/alias-loader.mjs scripts/preview-monthly-summary.mjs
//       → the demo company fixture (scripts/fixtures/monthlySummaryFixture.mjs),
//         no database at all
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs \
//        scripts/preview-monthly-summary.mjs --company <id> [--month 2026-09]
//       → a READ-ONLY load of a real company through
//         lib/analytics/monthlySummaryData.js. That file writes nothing (the
//         check asserts it); this script calls no AI, sends no mail and
//         writes only files under docs/screens.
//
// PNGs need Google Chrome installed (playwright-core, channel "chrome"); if it
// is not there the HTML and text are still written and the script says so.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMonthlySummaryEmail } from "@/lib/email/monthlySummaryEmail";
import { septemberSummary, emptySummary, COMPANY, ORIGIN, AS_OF } from "./fixtures/monthlySummaryFixture.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/screens/monthly-summary");
mkdirSync(OUT, { recursive: true });

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};

const renders = [];
const companyId = arg("--company");
if (companyId) {
  const { db } = await import("@/lib/db");
  const { loadMonthlySummary } = await import("@/lib/analytics/monthlySummaryData");
  const month = arg("--month") || "2026-09";
  const [y, m] = month.split("-").map(Number);
  const { company, summary, failures } = await loadMonthlySummary({
    db,
    companyId,
    periodStart: new Date(Date.UTC(y, m - 1, 1)),
    asOf: new Date(),
  });
  if (failures.length) console.log("sections left out:", failures);
  renders.push({ name: `company-${month}`, summary, company, language: company.defaultLanguage || "en" });
} else {
  const summary = septemberSummary();
  renders.push({ name: "september-en", summary, company: COMPANY, language: "en" });
  renders.push({ name: "september-fr", summary, company: COMPANY, language: "fr" });
  renders.push({ name: "first-month-empty", summary: emptySummary(), company: COMPANY, language: "en" });
}

const files = [];
for (const r of renders) {
  const email = buildMonthlySummaryEmail({ summary: r.summary, company: r.company, language: r.language, origin: ORIGIN });
  const html = path.join(OUT, `${r.name}.html`);
  writeFileSync(html, email.html);
  writeFileSync(path.join(OUT, `${r.name}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
  files.push({ name: r.name, html });
  console.log(`wrote ${path.relative(ROOT, html)} — "${email.subject}"`);
}

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  chromium = null;
}
if (!chromium) {
  console.log("playwright-core is not installed — HTML and text only.");
} else {
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch (err) {
    console.log(`Chrome could not be launched (${err.message.split("\n")[0]}) — HTML and text only.`);
  }
  if (browser) {
    const shots = [
      { suffix: "mobile", width: 390, scheme: "light" },
      { suffix: "mobile-dark", width: 390, scheme: "dark" },
      { suffix: "desktop", width: 720, scheme: "light" },
    ];
    for (const f of files) {
      for (const s of shots) {
        if (f.name === "september-fr" && s.suffix !== "mobile") continue;
        if (f.name === "first-month-empty" && s.suffix !== "mobile") continue;
        const page = await browser.newPage({ viewport: { width: s.width, height: 900 }, deviceScaleFactor: 2, colorScheme: s.scheme });
        await page.goto(`file://${f.html}`);
        const png = path.join(OUT, `${f.name}-${s.suffix}.png`);
        await page.screenshot({ path: png, fullPage: true });
        await page.close();
        console.log(`wrote ${path.relative(ROOT, png)}`);
      }
    }
    await browser.close();
  }
}
console.log(`rendered as of ${companyId ? "now" : AS_OF.toISOString()}`);
process.exit(0);
