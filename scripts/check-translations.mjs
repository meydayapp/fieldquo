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

if (problems === 0) {
  console.log("\nAll gated languages complete.");
} else {
  console.log(`\n${problems} issue(s).`);
  process.exitCode = 1;
}
