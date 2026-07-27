// scripts/check-translations.mjs
//
// Reports which keys are missing from each language, and which keys exist in
// a translation but not in English (usually a typo or a stale key).
//
//   npx tsx scripts/check-translations.mjs
//
// Exits non-zero when anything is missing, so it can gate a deploy. Worth
// wiring into CI: t() falls back to English on a missing key, which means an
// untranslated string ships silently and a customer finds it before you do.

// Namespace imports, not named ones. package.json has no "type": "module",
// so tsx transpiles these .js sources to CommonJS, and Node's CJS→ESM
// interop detects named exports by static analysis that doesn't catch every
// pattern — producing "does not provide an export named DEFAULT_LANGUAGE"
// even though it plainly does. Reading properties off the namespace object
// happens at runtime and always works.
import * as messages from "../app/i18n/messages.js";
import * as languages from "../app/i18n/languages.js";

const { MESSAGES, MESSAGE_KEYS } = messages;
const { LANGUAGES, DEFAULT_LANGUAGE } = languages;

let problems = 0;

for (const { code, name } of LANGUAGES) {
  if (code === DEFAULT_LANGUAGE) continue;

  const dict = MESSAGES[code] || {};
  const missing = MESSAGE_KEYS.filter((k) => !(k in dict));
  const extra = Object.keys(dict).filter((k) => !MESSAGE_KEYS.includes(k));

  const covered = MESSAGE_KEYS.length - missing.length;
  const pct = Math.round((covered / MESSAGE_KEYS.length) * 100);

  console.log(
    `${name.padEnd(12)} ${String(pct).padStart(3)}%  (${covered}/${MESSAGE_KEYS.length})`,
  );

  for (const k of missing) {
    console.log(`   missing: ${k}`);
    problems++;
  }
  for (const k of extra) {
    console.log(`   not in English: ${k}`);
    problems++;
  }
}

if (problems === 0) {
  console.log("\nAll languages complete.");
} else {
  console.log(`\n${problems} issue(s).`);
  process.exitCode = 1;
}
