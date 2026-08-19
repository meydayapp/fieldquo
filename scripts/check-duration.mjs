// scripts/check-duration.mjs
//
// Executes the duration formatter against every language and every count that
// changes the answer.
//
//   npm run check:duration
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The bug it replaces was invisible to every other check in the repo. The keys
// existed, all six languages defined them, coverage read 100%, and the screen
// said "1 days" — because a catalogue that holds one word per unit cannot be
// wrong about a count it never sees. Nothing here reads the catalogue for
// COMPLETENESS; it reads it for what it actually renders.
//
// Runs under plain node: lib/i18n/duration.js and lib/i18n/plurals.js import
// nothing, and appMessages.js imports plurals.js by relative path for exactly
// this reason.
import { formatDuration, DURATION_UNIT_KEYS } from "../lib/i18n/duration.js";
import { pluralCategory } from "../lib/i18n/plurals.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { LANGUAGES } from "../app/i18n/languages.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
function eq(name, actual, expected) {
  ok(name, actual === expected, actual === expected ? "" : `got "${actual}", want "${expected}"`);
}

// The same resolution t() does — requested language, then English, then the
// key. Rebuilt rather than imported because useTranslation.js is a "use client"
// React hook and can't run here.
function translatorFor(code) {
  return (key, values) => {
    const raw = APP_MESSAGES[code]?.[key] ?? APP_MESSAGES.en[key] ?? key;
    if (typeof raw === "function") return raw(values ?? {});
    if (!values) return raw;
    return String(raw).replace(/\{(\w+)\}/g, (m, name) =>
      values[name] !== undefined ? String(values[name]) : m,
    );
  };
}

// ── 1. The runtime actually has the plural data ────────────────────────────
//
// Everything below rests on Intl.PluralRules knowing these six locales. A
// node built with small-icu silently resolves every one of them to English,
// which would put "1 дні" back on screen with no error anywhere. So assert the
// assumption instead of duplicating CLDR by hand to work around it.
console.log("\nICU plural data\n");

for (const { code, name } of LANGUAGES) {
  const resolved = new Intl.PluralRules(code).resolvedOptions().locale;
  ok(
    `${name}: Intl.PluralRules resolves ${code}, not a fallback`,
    resolved === code || resolved.startsWith(`${code}-`) || (code === "tl" && resolved === "fil"),
    `resolved to ${resolved}`,
  );
}

ok(
  "Ukrainian really reports four categories",
  new Intl.PluralRules("uk").resolvedOptions().pluralCategories.length === 4,
);

// ── 2. The counts that used to render wrong ────────────────────────────────
console.log("\nRendered phrases\n");

// [language, unit, value, expected]
const CASES = [
  // English — the original "1 days".
  ["en", "days", 1, "1 day"],
  ["en", "days", 2, "2 days"],
  ["en", "days", 0, "0 days"],
  ["en", "hours", 1, "1 hour"],
  ["en", "minutes", 1, "1 minute"],

  // French — the original "Attendre 1 jours". Zero is singular in French.
  ["fr", "days", 1, "1 jour"],
  ["fr", "days", 0, "0 jour"],
  ["fr", "days", 3, "3 jours"],
  ["fr", "hours", 1, "1 heure"],
  ["fr", "hours", 24, "24 heures"],
  ["fr", "minutes", 1, "1 minute"],

  // Spanish — zero is plural here, unlike French.
  ["es", "days", 1, "1 día"],
  ["es", "days", 0, "0 días"],
  ["es", "hours", 1, "1 hora"],

  // Ukrainian — three forms, selected by the last digits.
  ["uk", "days", 1, "1 день"],
  ["uk", "days", 2, "2 дні"],
  ["uk", "days", 4, "4 дні"],
  ["uk", "days", 5, "5 днів"],
  ["uk", "days", 11, "11 днів"], // 11 is "many" despite ending in 1
  ["uk", "days", 21, "21 день"],
  ["uk", "days", 22, "22 дні"],
  ["uk", "days", 0, "0 днів"],
  ["uk", "hours", 1, "1 година"],
  ["uk", "hours", 3, "3 години"],
  ["uk", "hours", 8, "8 годин"],
  ["uk", "minutes", 1, "1 хвилина"],
  ["uk", "minutes", 30, "30 хвилин"],

  // Punjabi — only ਘੰਟਾ inflects; zero is singular as in French.
  ["pa", "hours", 1, "1 ਘੰਟਾ"],
  ["pa", "hours", 3, "3 ਘੰਟੇ"],
  ["pa", "days", 1, "1 ਦਿਨ"],
  ["pa", "days", 7, "7 ਦਿਨ"],

  // Tagalog — the noun never changes, so the fil category split (which is
  // about numbers ending in 4/6/9, not about count) must not surface as two
  // different words. 3 and 4 land in different categories; same output.
  ["tl", "days", 1, "1 araw"],
  ["tl", "days", 3, "3 araw"],
  ["tl", "days", 4, "4 araw"],
  ["tl", "hours", 6, "6 oras"],
];

for (const [code, unit, value, expected] of CASES) {
  eq(`${code}: ${unit} @ ${value} → "${expected}"`, formatDuration(translatorFor(code), value, unit), expected);
}

ok(
  "tl: 3 and 4 fall in different CLDR categories, proving the case above is real",
  pluralCategory("tl", 3) !== pluralCategory("tl", 4),
);

// ── 3. Every language answers for every unit ───────────────────────────────
//
// A missing key falls back to English, which would put an English noun in the
// middle of a Ukrainian sentence rather than failing.
console.log("\nCoverage of the duration keys\n");

for (const { code, name } of LANGUAGES) {
  const missing = Object.values(DURATION_UNIT_KEYS).filter(
    (k) => typeof APP_MESSAGES[code]?.[k] !== "function",
  );
  ok(`${name}: all three units defined as declining entries`, missing.length === 0, missing.join(", "));
}

// ── 4. Input the settings form can actually produce ────────────────────────
console.log("\nHostile input\n");

const en = translatorFor("en");
eq("unknown unit is read as days, as cutoffFor() does", formatDuration(en, 3, "fortnights"), "3 days");
eq("missing unit is read as days", formatDuration(en, 3, undefined), "3 days");
eq("a numeric string still declines", formatDuration(en, "1", "days"), "1 day");
eq("an empty delay renders 0, not NaN", formatDuration(en, "", "days"), "0 days");
eq("a half-typed number renders 0, not NaN", formatDuration(en, "1e", "days"), "0 days");
eq("null renders 0, not NaN", formatDuration(en, null, "days"), "0 days");

// ── 5. Both call sites use it ──────────────────────────────────────────────
//
// The whole point was that the list and the diagram say the same thing. A
// formatter nobody calls is worth nothing, and the list's old line printed the
// raw delayUnit column — untranslated in every language.
console.log("\nCall sites\n");

const page = read("app/app/settings/follow-ups/page.js");
const diagram = read("app/app/settings/follow-ups/FlowDiagram.js");

ok("the rule list calls formatDuration", /formatDuration\(t, rule\.delayValue, rule\.delayUnit\)/.test(page));
ok("the flow diagram calls formatDuration", /formatDuration\(t, rule\.delayValue, rule\.delayUnit\)/.test(diagram));
ok(
  "the rule list no longer prints the raw delayUnit column",
  !/\{rule\.delayValue\}\s*\{rule\.delayUnit\}/.test(page),
);
ok(
  "app.followFlow.wait takes the whole phrase, not a number and a bare noun",
  Object.values(APP_MESSAGES).every(
    (d) =>
      d["app.followFlow.wait"].includes("{duration}") &&
      !d["app.followFlow.wait"].includes("{unit}"),
  ),
);

// ── 6. The sentence the contractor actually reads ─────────────────────────
//
// Composing it here, not just the fragment: a `wait` entry edited to drop
// {duration} would still pass every check above while the pill silently
// stopped saying how long it waits.
console.log("\nComposed pill\n");

const PILLS = [
  ["en", 1, "days", "Wait 1 day"],
  ["fr", 1, "days", "Attendre 1 jour"],
  ["es", 1, "days", "Esperar 1 día"],
  ["uk", 2, "days", "Зачекати 2 дні"],
  ["pa", 1, "hours", "1 ਘੰਟਾ ਉਡੀਕੋ"],
  ["tl", 4, "days", "Maghintay ng 4 araw"],
];

for (const [code, value, unit, expected] of PILLS) {
  const t = translatorFor(code);
  eq(
    `${code}: pill reads "${expected}"`,
    t("app.followFlow.wait", { duration: formatDuration(t, value, unit) }),
    expected,
  );
}

console.log(`\n${checks} checks, ${failures} failure(s).`);
if (failures) process.exitCode = 1;
