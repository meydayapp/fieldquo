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
        if (!used.has(m[1])) used.set(m[1], full);
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
