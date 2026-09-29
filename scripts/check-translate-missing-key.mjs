// scripts/check-translate-missing-key.mjs
//
// A missing translation key is a missing string, never a crashed page.
//
// ── What went wrong ─────────────────────────────────────────────────────────
//
// On 2026-09-19 the platform error log caught /app/quotes/new three times for
// one owner: render_error, "undefined is not an object (evaluating 'a.split')"
// (Safari's wording; the minified stack pointed into one big client chunk and
// could not be mapped). The cause: the quote builder's "?" tour still handed
// OnboardingTour translated `title`/`body` strings after every other tour had
// moved to `titleKey`/`bodyKey`, so the tour called t(step.titleKey) with
// undefined, and the catalogue lookup ran `key.split(".")` on it. One stale
// shape in one tour took the whole builder down, for anyone who pressed "?".
//
// 7b1bb836 fixed it the same day (keys in the tour, a type guard in the
// lookup, and check:tour-language reading the tour's source). What it did not
// do is EXECUTE the guard: the lookup was a private function inside a
// "use client" hook that bare Node cannot import, so every check rebuilt its
// own copy of t() instead. The lookup now lives in lib/i18n/resolveMessage.js
// and the hook calls it; this file runs it against hostile keys.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-translate-missing-key.mjs

import { readFileSync } from "node:fs";
import { resolveMessage, translate } from "@/lib/i18n/resolveMessage.js";
import { MESSAGES } from "@/app/i18n/messages.js";
import { DEFAULT_LANGUAGE } from "@/app/i18n/languages.js";

let fail = 0;
const ok = (name, pass, detail = "") => {
  if (!pass) fail++;
  console.log(`${pass ? "  ok  " : "  FAIL"} ${name}${pass ? "" : `  ${detail}`}`);
};
const show = (v) => (typeof v === "symbol" ? v.toString() : JSON.stringify(v));
const run = (fn) => {
  try {
    return { value: fn(), threw: null };
  } catch (err) {
    return { value: undefined, threw: err };
  }
};
const section = (s) => console.log(`\n${s}\n`);

const HOSTILE_KEYS = [
  ["undefined", undefined],
  ["null", null],
  ["0", 0],
  ["a number", 123],
  ["NaN", NaN],
  ["true", true],
  ["an empty string", ""],
  ["an object", { key: "app.quoteNew.tourClientTitle" }],
  ["an array", ["app", "quoteNew"]],
  ["a function", () => "x"],
  ["a symbol", Symbol("k")],
];

// Flat and nested, both shapes the lookup promises to read.
const DICT = {
  "app.greeting": "Hi {name}",
  "app.plain": "Plain",
  nav: { pricing: "Pricing" },
  fn: { count: ({ n }) => `${n} items` },
};

// ───────────────────────────────────────────────────────────────────────────
section("1. resolveMessage: a key that is not a non-empty string resolves to nothing");

for (const [label, key] of HOSTILE_KEYS) {
  const r = run(() => resolveMessage(DICT, key));
  ok(`key = ${label}: no throw`, !r.threw, r.threw?.message);
  ok(`key = ${label}: undefined, not a coerced lookup`, r.value === undefined, `got ${show(r.value)}`);
}

// A key that is a string but names nothing: the same answer, not a throw on
// the way down a nested path that stops existing halfway.
for (const key of ["app.missing", "nav.pricing.deeper.still", "nav.", ".", "..", "nav..pricing"]) {
  const r = run(() => resolveMessage(DICT, key));
  ok(`key = ${show(key)}: no throw, undefined`, !r.threw && r.value === undefined, r.threw?.message ?? `got ${show(r.value)}`);
}

section("2. resolveMessage: an absent catalogue resolves to nothing");

for (const [label, dict] of [["undefined", undefined], ["null", null], ["a string", "app.plain"], ["a number", 7]]) {
  const r = run(() => resolveMessage(dict, "app.plain"));
  ok(`catalogue = ${label}: no throw, undefined`, !r.threw && r.value === undefined, r.threw?.message ?? `got ${show(r.value)}`);
}

section("3. resolveMessage: real keys still resolve, flat and nested");

ok("flat hit", resolveMessage(DICT, "app.plain") === "Plain");
ok("nested hit", resolveMessage(DICT, "nav.pricing") === "Pricing");
ok("function entry returned as-is", typeof resolveMessage(DICT, "fn.count") === "function");

// ───────────────────────────────────────────────────────────────────────────
section("4. translate (the body of t()): absent key → absent answer, never the word \"undefined\"");

const L = { en: DICT, fr: { "app.plain": "Simple" } };
const tr = (...args) => run(() => translate(L, "fr", "en", ...args));

for (const [label, key] of HOSTILE_KEYS) {
  const r = tr(key);
  ok(`t(${label}): no throw`, !r.threw, r.threw?.message);
}

{
  const r = tr(undefined);
  ok("t(undefined) → undefined (renders nothing)", !r.threw && r.value === undefined, `got ${show(r.value)}`);
}
{
  const r = tr(null);
  ok("t(null) → null (renders nothing)", !r.threw && r.value === null, `got ${show(r.value)}`);
}
{
  // The tour's case with values: stepCount-style calls pass a values object.
  // Before this file the values branch ran String(undefined) and put the
  // literal word "undefined" on screen.
  const r = tr(undefined, { n: 1, total: 3 });
  ok("t(undefined, values) → undefined, not \"undefined\"", !r.threw && r.value === undefined, `got ${show(r.value)}`);
}
{
  const r = tr(undefined, "Take the tour");
  ok("t(undefined, fallback) → the caller's fallback", r.value === "Take the tour", `got ${show(r.value)}`);
}
{
  const r = tr(undefined, "Step {n}", { n: 2 });
  ok("t(undefined, fallback, values) → the fallback, filled", r.value === "Step 2", `got ${show(r.value)}`);
}

section("5. translate: the ordinary paths are unchanged");

ok("requested language first", tr("app.plain").value === "Simple");
ok("English when the language lacks the key", tr("nav.pricing").value === "Pricing");
ok("placeholders filled", tr("app.greeting", { name: "Jane" }).value === "Hi Jane");
ok("unknown placeholder left visible", tr("app.greeting", { other: 1 }).value === "Hi {name}");
ok("function entries called with values", tr("fn.count", { n: 3 }).value === "3 items");
ok("string fallback for a missing key", tr("app.missing", "Fallback").value === "Fallback");
ok("the key itself as the last resort", tr("app.missing").value === "app.missing");
ok("an absent catalogue set does not throw", !run(() => translate(undefined, "fr", "en", "app.plain")).threw);

// ───────────────────────────────────────────────────────────────────────────
section("6. The 2026-09-19 case, against the real catalogue");

// OnboardingTour renders t(step.titleKey) and t(step.bodyKey). A step in the
// old shape — { title, body } with no keys — is what crashed the builder.
const staleStep = { target: "[data-tour='client-picker']", title: "Client", body: "Pick one" };
for (const lang of ["en", "es", "fr", "pa", "xx-not-a-language"]) {
  const title = run(() => translate(MESSAGES, lang, DEFAULT_LANGUAGE, staleStep.titleKey));
  const count = run(() =>
    translate(MESSAGES, lang, DEFAULT_LANGUAGE, "app.tour.stepCount", "{n} of {total}", { n: 1, total: 3 }),
  );
  ok(`[${lang}] a step with no titleKey: no throw, nothing rendered`, !title.threw && title.value === undefined, title.threw?.message ?? `got ${show(title.value)}`);
  ok(`[${lang}] the tour's step counter still fills`, typeof count.value === "string" && !count.value.includes("{n}"), `got ${show(count.value)}`);
}
for (const key of ["app.quoteNew.tourClientTitle", "app.quoteNew.tourServiceBody", "app.quoteNew.tourReviewTitle"]) {
  const en = translate(MESSAGES, "en", DEFAULT_LANGUAGE, key);
  ok(`${key} resolves to real English copy`, typeof en === "string" && en.length > 0 && en !== key, `got ${show(en)}`);
}

// ───────────────────────────────────────────────────────────────────────────
section("7. The hook runs THIS lookup, not a copy of it");

const hook = readFileSync(new URL("../app/hooks/useTranslation.js", import.meta.url), "utf8");
ok("useTranslation.js imports translate from lib/i18n/resolveMessage", /import\s*\{\s*translate\s*\}\s*from\s*"@\/lib\/i18n\/resolveMessage"/.test(hook));
ok("useTranslation.js's t() calls translate()", /translate\(MESSAGES,\s*language,\s*DEFAULT_LANGUAGE,/.test(hook));
ok("useTranslation.js holds no lookup of its own (no .split)", !/\.split\(/.test(hook));

console.log(fail ? `\n${fail} check(s) FAILED` : "\nall translate-missing-key checks passed");
process.exit(fail ? 1 : 0);
