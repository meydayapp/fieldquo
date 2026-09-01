// scripts/check-translations.mjs
//
// Reports which keys are missing from each language, and which keys exist in
// a translation but not in English (usually a typo or a stale key).
//
//   node scripts/check-translations.mjs
//
// Exits non-zero when the MARKETING catalogue is incomplete, so it can gate a
// deploy. t() falls back to English on a missing key, which means an
// untranslated string ships silently and a customer finds it before you do.
//
// ── Run it with node, NOT tsx ───────────────────────────────────────────────
//
// This file used to use namespace imports and claimed they were the fix for a
// CJS/ESM interop problem under tsx. That had the diagnosis backwards, and the
// script had been dying on `LANGUAGES is not iterable` — so the coverage gate
// it exists to provide was never actually running.
//
// What really happens: tsx transpiles the imported .js sources to CommonJS
// (package.json has no "type": "module") and the namespace object collapses to
// `{ default }`, so every named export reads as undefined. Plain node detects
// the ESM syntax and reparses those same files as modules, and the named
// exports are there. So: plain node, named imports, no interop workaround.
import { MESSAGES, MESSAGE_KEYS } from "../app/i18n/messages.js";
import { APP_MESSAGE_KEYS, appCoverage } from "../app/i18n/appMessages.js";
import { LANGUAGES, DEFAULT_LANGUAGE } from "../app/i18n/languages.js";
import { TOURS } from "../app/components/tours.js";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

let problems = 0;

// ── Marketing: every language, or the check fails ──────────────────────────
//
// The public site is the one surface where a missing string is read by someone
// who has no relationship with the product yet.
console.log("Marketing site\n");

for (const { code, name } of LANGUAGES) {
  if (code === DEFAULT_LANGUAGE) continue;

  const dict = MESSAGES[code] || {};
  const missing = MESSAGE_KEYS.filter((k) => !(k in dict));
  // App keys live in the same merged object but are governed separately below,
  // so they are not "extra" here.
  const extra = Object.keys(dict).filter(
    (k) => !MESSAGE_KEYS.includes(k) && !k.startsWith("app."),
  );

  const covered = MESSAGE_KEYS.length - missing.length;
  const pct = Math.round((covered / MESSAGE_KEYS.length) * 100);

  console.log(
    `  ${name.padEnd(12)} ${String(pct).padStart(3)}%  (${covered}/${MESSAGE_KEYS.length})`,
  );

  for (const k of missing) {
    console.log(`     missing: ${k}`);
    problems++;
  }
  for (const k of extra) {
    console.log(`     not in English: ${k}`);
    problems++;
  }
}

// ── App interface: reported, NOT gated ─────────────────────────────────────
//
// Deliberately a different bar. The app catalogue is English and French by
// design — see the header of appMessages.js. Holding it to full coverage in all
// six languages would either block every deploy or force machine-translating
// hundreds of interface strings nobody who reads those languages has checked,
// on screens where a mistranslated payroll label costs real money.
//
// So this prints the truth and moves on. The number that keeps the product
// honest is the one on the language settings page, which reads the same
// appCoverage() and shows it to the person doing the choosing.
console.log("\nApp interface (reported, not gated — see appMessages.js)\n");

for (const { code, name } of LANGUAGES) {
  const pct = Math.round(appCoverage(code) * 100);
  const covered = APP_MESSAGE_KEYS.filter((k) => k in (MESSAGES[code] || {})).length;
  const note = pct === 100 ? "" : "  → falls back to English";
  console.log(
    `  ${name.padEnd(12)} ${String(pct).padStart(3)}%  (${covered}/${APP_MESSAGE_KEYS.length})${note}`,
  );
}

// A French app string missing while French claims to be complete IS a bug
// rather than a policy — it puts an English word in the middle of an otherwise
// French screen, which is the failure this whole catalogue exists to prevent.
for (const k of APP_MESSAGE_KEYS.filter((k) => !(k in (MESSAGES.fr || {})))) {
  console.log(`     missing from French: ${k}`);
  problems++;
}

// ── The onboarding tour: every step must be a KEY, not English text ────────
//
// tours.js used to hold the walkthrough's English sentences directly in
// `title`/`body` — every account read the tour in English regardless of the
// language they'd picked, in a product whose non-negotiable #6 is about
// respecting the language a document was created in. The fix was moving the
// strings into this catalogue (app.tour.*) and having tours.js hold only
// `titleKey`/`bodyKey`, resolved by OnboardingTour.js's own t() call at
// render time — but nothing stopped a future edit from typing a sentence
// back into `titleKey` the way the old field held one directly. The generic
// "every app.* literal the code asks for must exist" scan just below this
// block would NOT catch that regression: a bare English sentence has no
// "app." prefix, so it never enters that scan at all. This block exists
// specifically to close that gap — it inspects the tour data itself, not
// source text, and fails on anything that isn't a resolvable app.tour.* key.
console.log("\nOnboarding tour strings (app/components/tours.js)\n");
{
  const KEY_RE = /^app\.tour\.[A-Za-z0-9]+\.[A-Za-z0-9]+$/;
  let badSteps = 0;
  for (const tour of TOURS) {
    for (const [i, step] of tour.steps.entries()) {
      for (const field of ["titleKey", "bodyKey"]) {
        const value = step[field];
        if (typeof value !== "string" || !KEY_RE.test(value)) {
          console.log(
            `     ${tour.key} step ${i + 1}: ${field} is not an "app.tour.*" key (got ${JSON.stringify(value)}) — looks like a hardcoded string crept back in`,
          );
          badSteps++;
          continue;
        }
        if (!(value in MESSAGES.en)) {
          console.log(`     ${tour.key} step ${i + 1}: ${field} "${value}" has no English string`);
          badSteps++;
        }
      }
    }
  }
  if (badSteps === 0) {
    console.log("  every tour step title/body is a translation key.");
  } else {
    problems += badSteps;
  }
}

// ── Every tour target must point at a real anchor ──────────────────────────
//
// The string-key check above closes "a tour step said English instead of a
// key." This one closes a different, equally silent failure: a tour step
// that names a `data-tour` value nobody ever rendered. Nothing throws —
// OnboardingTour.js's own `visibleTarget` just never finds the element, the
// first-step guard in its mount effect never sets `active`, and the tour
// simply never opens. No error, no broken UI, just a walkthrough that
// silently does nothing for every account that reaches that page — the exact
// "control that appears to work and doesn't" AGENTS.md is about, except this
// one has no visible control to notice is broken; there is nothing on screen
// to click and find out. This check exists because that failure is invisible
// to every other check here, including the one above it.
//
// Scans app/ for literal `data-tour="..."` / `data-tour='...'` attributes,
// PLUS three indirect shapes the same codebase search turned up — a literal
// `data-tour="x"` is not the only way an anchor ends up on an element:
//
//   1. `data-tour={item.tour}` (AdminSidebar.js's nav rows) — the JSX
//      attribute holds a variable, but the variable's value is a `tour: "x"`
//      property sitting right there in the same module-scope array literal
//      (the nav items are DATA, read at render — same reason the comment
//      below the "Every key the code asks for" scan already gives for why
//      those arrays carry `key: "app.nav.x"` instead of calling t()).
//   2. `data-tour={dataTour}` (app/app/settings/voice/page.js's own local
//      Card component) — same shape, one function argument instead of an
//      array field: the call site passes `dataTour="voice-credit"`.
//   3. `data-tour={tour}` (app/app/settings/ai-credit/page.js's own local
//      Card component) — the call site passes a JSX prop literally named
//      `tour`, e.g. `<Card tour="ai-credit-voice">`.
//
// None of the three is hypothetical or specific to one file by accident —
// they're the only indirect forms that exist in the codebase today (grepped
// for `tour:`, `dataTour=` and `tour=` project-wide while building this
// check). A future page inventing yet another differently-named prop for the
// same purpose is possible and this check cannot see it — add its pattern
// here the way these three were added, or the anchor it carries will read as
// missing even though it renders fine.
console.log("\nOnboarding tour anchors (data-tour attributes in app/)\n");
{
  const anchors = new Set();
  const ATTR_RE = /data-tour=["']([^"']+)["']/g;
  // Case 1 above: `tour: "nav-requests"` as an object-literal property.
  const TOUR_PROP_RE = /\btour:\s*["']([^"']+)["']/g;
  // Cases 2 and 3 above: `dataTour="voice-credit"` / `tour="ai-credit-voice"`
  // as a JSX prop at a call site.
  const DATA_TOUR_PROP_RE = /\b(?:dataTour|tour)=["']([^"']+)["']/g;
  // tours.js itself is the one file where "data-tour='job-photos'" appears
  // WITHOUT anything having rendered it — it's the selector string a step
  // asks for, e.g. `target: "[data-tour='job-photos']"`. That substring
  // matches ATTR_RE just as well as a real JSX attribute does, so scanning
  // this file would make every tour verify itself against its own selector
  // text — the anchor-existence check silently checking nothing. This is not
  // hypothetical: it's exactly what happened on the first run of this check,
  // caught by the mutation test in docs/TOUR-COVERAGE.md.
  //
  // `openWith`/`closeWith` are deliberately NOT verified the same way. A first
  // attempt tried it — same idea, against `data-tour-open`/`data-tour-close`
  // — and its own mutation test caught the reason it can't work as a plain
  // text scan: OnboardingTour.js's header comment and MobileTabBar.js's own
  // `document.querySelector('[data-tour-open="nav"]')` both contain that
  // exact substring without either one being the element that renders it, so
  // renaming the real attribute in AdminSidebar.js still "verified" against
  // those two mentions. `target` doesn't have that problem because there is
  // exactly one place selector STRINGS like it appear outside a real render
  // (tours.js itself, excluded above); `data-tour-open`/`-close` have at
  // least three, and reliably telling a mention from a render apart would
  // need real parsing, not a regex. Reported as unverifiable instead of
  // shipping a check that can pass on a broken drawer control.
  const TOUR_DEFINITIONS_FILE = join("app", "components", "tours.js");

  async function scanAnchors(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        await scanAnchors(full);
      } else if (
        (entry.name.endsWith(".js") || entry.name.endsWith(".jsx")) &&
        full !== TOUR_DEFINITIONS_FILE
      ) {
        const src = await readFile(full, "utf8");
        for (const m of src.matchAll(ATTR_RE)) anchors.add(m[1]);
        for (const m of src.matchAll(TOUR_PROP_RE)) anchors.add(m[1]);
        for (const m of src.matchAll(DATA_TOUR_PROP_RE)) anchors.add(m[1]);
      }
    }
  }
  await scanAnchors("app");

  const TARGET_RE = /^\[data-tour='([^']+)'\]$/;
  let missingAnchors = 0;
  for (const tour of TOURS) {
    for (const [i, step] of tour.steps.entries()) {
      for (const field of ["target", "openWith", "closeWith"]) {
        const selector = step[field];
        if (!selector) continue;
        if (field !== "target") {
          console.log(
            `     ${tour.key} step ${i + 1}: ${field} "${selector}" not verified — see this check's own comment on why openWith/closeWith are reported, not gated`,
          );
          continue;
        }
        const m = TARGET_RE.exec(selector);
        if (!m) {
          console.log(
            `     ${tour.key} step ${i + 1}: ${field} "${selector}" isn't a "[data-tour='...']" selector, so this check can't verify it`,
          );
          continue;
        }
        if (!anchors.has(m[1])) {
          console.log(
            `     ${tour.key} step ${i + 1}: ${field} points at data-tour="${m[1]}", which nothing in app/ renders`,
          );
          missingAnchors++;
        }
      }
    }
  }
  if (missingAnchors === 0) {
    console.log(`  every tour target resolves to a real anchor (${anchors.size} data-tour values found in app/).`);
  } else {
    problems += missingAnchors;
  }
}

// ── Every key the code asks for must exist ─────────────────────────────────
//
// The other direction, and the one that actually bites. t() falls back to the
// key itself when nothing resolves, so a typo — t("app.nav.jobss") — renders
// the literal string "app.nav.jobss" on screen in every language including
// English. No test catches that; a customer does.
//
// Scans source rather than a manifest so it can't fall out of step with the
// code, and matches any "app.*" string literal rather than only t("...") calls.
// That second part matters: the two sidebars keep their nav definitions in
// module-scope constants that can't call a hook, so they carry `key: "app.nav.x"`
// as DATA and translate at render. A t()-only scan reported 8 keys in use and
// 145 unused, which is the sort of confidently wrong number that gets a real
// key deleted.
//
// Still blind to computed keys (`app.status.${x}`) — a good reason to prefer
// literals at call sites.
const SRC_DIRS = ["app", "lib"];
const CATALOGUE = "app/i18n/appMessages.js"; // the definitions, not a use
const used = new Map(); // key -> first file that uses it

async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await scan(full);
    } else if (
      (entry.name.endsWith(".js") || entry.name.endsWith(".jsx")) &&
      full !== CATALOGUE
    ) {
      const src = await readFile(full, "utf8");
      for (const m of src.matchAll(/["'](app\.[A-Za-z0-9_.]+)["']/g)) {
        const key = m[1];
        // A literal ending in "." is a dynamic-key PREFIX being concatenated —
        // t("app.mkStop." + stop.status). The real keys are app.mkStop.pending
        // etc.; the prefix itself is never a key, so don't flag it as undefined.
        // Every such usage in this codebase passes a fallback, so a miss is safe.
        if (key.endsWith(".")) continue;
        if (!used.has(key)) used.set(key, full);
      }
    }
  }
}

for (const dir of SRC_DIRS) await scan(dir);

console.log(`\nKey usage — ${used.size} distinct app keys referenced in source\n`);

let undefinedKeys = 0;
for (const [key, file] of used) {
  if (!APP_MESSAGE_KEYS.includes(key)) {
    console.log(`     undefined key: ${key}   (${file})`);
    undefinedKeys++;
    problems++;
  }
}
if (undefinedKeys === 0) console.log("  every referenced key is defined.");

// The reverse is only worth reporting, not failing on: a key can legitimately
// be defined ahead of the screen that will use it, and computed call sites are
// invisible to the scan above, so "unused" here is a hint and not a verdict.
const unused = APP_MESSAGE_KEYS.filter((k) => !used.has(k));
if (unused.length) {
  console.log(`  ${unused.length} defined but not referenced by a literal t() call.`);
}

if (problems === 0) {
  console.log("\nAll gated languages complete.");
} else {
  console.log(`\n${problems} issue(s).`);
  process.exitCode = 1;
}
