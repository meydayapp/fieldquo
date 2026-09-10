// scripts/check-marketing-i18n.mjs
//
//   npm run check:marketing-i18n
//
// The surfaces the owner read in Spanish and found in English:
//
//   /compare and /compare/<slug>   — five comparison pages
//   /pricing                       — specifically the add-on stack under it
//   /app/leads/import              — a back-office screen beside a translated twin
//
// Each of them had the same shape of hole, and none of the checks already in
// this repo could see any of it. check:translations gates the CATALOGUE: every
// key English defines must exist in every offered language. It has nothing to
// say about a sentence that was never a key — and all three surfaces were full
// of those, sitting in JSX or in a plain data module, where a coverage check
// looking at catalogues will never find them.
//
// So this asks the other question: is there a user-facing string on these
// surfaces that is a bare English literal with no key behind it?
//
// ══ Why the source is read with COMMENTS STRIPPED ══════════════════════════
//
// Every file this scans explains, in prose, the thing it must not do. The
// header of compareCopy.js contains the sentence "a machine-translated sentence
// about a competitor's prices is a sentence nobody has read"; ComparisonPage.js
// spends four paragraphs on English literals. A raw read cannot tell the
// explanation from the deed, and a check that matches its own header comment is
// a check that fails for the wrong reason — or, worse, passes because somebody
// tuned it until the comments stopped matching. scripts/check-translations.mjs
// carries the same masker and the same scar; two checks in this repo were
// already fooled that way.
//
// The masker replaces comment bodies with spaces rather than deleting them, so
// line numbers in a failure message still point at the real line.
//
// ══ What it can and cannot see ═════════════════════════════════════════════
//
// It sees JSX TEXT — the characters between a tag's `>` and the next `<`. That
// is where every one of the reported bugs actually lived, and it is the form a
// regression takes: somebody types a sentence between two tags because it is
// the fastest thing to do.
//
// It does NOT see an English sentence passed as a prop value, or assigned to a
// variable and rendered later. A determined regression can still get past it,
// and pretending otherwise would be the "control that appears to work" AGENTS.md
// is about. Three other assertions below narrow that gap from the other side:
// every key these files ASK for must exist, the English catalogue must be
// character-identical to the module it duplicates, and a long sentence must not
// be byte-identical to English in a language that claims to be translated.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { MESSAGES } from "../app/i18n/messages.js";
import { LANGUAGES, DEFAULT_LANGUAGE } from "../app/i18n/languages.js";
import { COMPARE_PAGE_MESSAGES } from "../app/i18n/comparePages/index.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass += 1)
    : fails.push(`${label}${detail !== undefined ? `\n      ${detail}` : ""}`);

// ── The surfaces ───────────────────────────────────────────────────────────
//
// Named rather than globbed over app/, because the claim being made is about
// these pages specifically. A glob would quietly start policing every screen in
// the product the first time somebody added one, and this check has no business
// deciding that.
const SURFACES = [
  "app/(marketing)/compare",
  "app/(marketing)/pricing",
  "app/app/leads/import",
];

// The catalogue modules themselves are DEFINITIONS, not uses: en.js is nothing
// but English literals and scanning it would guarantee a failure.
const NOT_A_USE = new Set([]);

function jsFilesUnder(path) {
  const out = [];
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const entry of readdirSync(p)) walk(join(p, entry));
    } else if (p.endsWith(".js") || p.endsWith(".jsx")) {
      if (!NOT_A_USE.has(p)) out.push(p);
    }
  };
  walk(path);
  return out;
}

/**
 * Comment bodies blanked, every other character kept in place.
 *
 * Lifted in spirit from scripts/check-translations.mjs, whose header explains
 * why a `src.replace(/\/\/.*$/gm, "")` is dangerous here specifically: a line
 * containing an https:// URL gets truncated at the slashes, and everything
 * after it on that line vanishes from the scan along with any bug it held. A
 * check whose job is to NOTICE something must never lose real code to its own
 * pre-processing — that direction of error is a false pass.
 *
 * So: track string and template state, and treat `//` or slash-star as a
 * comment only when it opens outside one.
 */
function maskComments(src) {
  const out = src.split("");
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") {
        out[i] = " ";
        i += 1;
      }
      continue;
    }
    if (c === "/" && next === "*") {
      out[i] = " ";
      out[i + 1] = " ";
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] !== "\n") out[i] = " ";
        i += 1;
      }
      if (i < src.length) {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
      }
      continue;
    }
    i += 1;
  }
  return out.join("");
}

/**
 * String and template CONTENTS blanked, quotes kept.
 *
 * JSX text is not a string literal, so the text scan below has to remove string
 * literals before looking — otherwise every English fallback written beside a
 * t() key (which is the correct thing to write) reads as a bare literal, and
 * the check fails on exactly the pattern it is asking for.
 */
function maskStrings(src) {
  const out = src.split("");
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === "\\") {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
        continue;
      }
      if (c === quote) {
        quote = null;
        i += 1;
        continue;
      }
      if (c !== "\n") out[i] = " ";
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      i += 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

// Words that are not a translation failure when they appear on their own in
// JSX text. Brands and route paths are the whole list, and each is here for a
// reason a translator would give: a trademark is not translated, and "/features"
// is a URL a visitor types.
const NOT_COPY = new Set([
  "fieldquo",
  "jobber",
  "housecall",
  "pro",
  "servicetitan",
  "projul",
  "quoteiq",
  "quickbooks",
  "xero",
  "vs",
  "csv",
  "ai",
]);

const isRoute = (w) => w.startsWith("/");

/**
 * The JSX text runs in one file, with their line numbers.
 *
 * A run is what sits between a tag's `>` and the next `<`. `{...}` is excluded
 * from the character class, so an expression splits a run rather than being
 * swallowed into it — which is what makes `— {entry.summary}` read as the
 * punctuation it is rather than as a sentence.
 *
 * `=>` is excluded because an arrow's `>` is not a tag's, and a run carrying
 * JS punctuation is discarded for the same reason: this scan is looking for
 * prose, and a false positive on an expression would get the check switched off.
 */
function jsxTextRuns(masked) {
  const runs = [];
  const re = /(^|[^=!<>])>([^<>{}]*)</g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const text = m[2];
    if (/[;()=]|&&|\|\|/.test(text)) continue;
    const words = text
      .split(/[^A-Za-z/']+/)
      .filter((w) => w.length > 1 && !NOT_COPY.has(w.toLowerCase()) && !isRoute(w));
    if (words.length < 2) continue;
    const line = masked.slice(0, m.index).split("\n").length;
    runs.push({ line, text: text.trim().replace(/\s+/g, " ") });
  }
  return runs;
}

console.log("1. No bare English literal in the JSX of a translated surface\n");
{
  let offenders = 0;
  for (const surface of SURFACES) {
    for (const file of jsFilesUnder(surface)) {
      const masked = maskStrings(maskComments(readFileSync(file, "utf8")));
      for (const run of jsxTextRuns(masked)) {
        // The masker blanks string contents, so a run here really is text a
        // visitor reads with nothing resolving it.
        console.log(`     ${file}:${run.line}  "${run.text}"`);
        offenders += 1;
      }
    }
  }
  ok(
    "every visible sentence on /compare, /pricing and /app/leads/import goes through t()",
    offenders === 0,
    offenders > 0
      ? `${offenders} bare literal(s) listed above — wrap each in t("key", "the English") and add the key to the catalogue`
      : undefined,
  );
  if (offenders === 0) console.log("  no bare JSX literals.\n");
}

// ── 2. Every key these surfaces ask for exists ─────────────────────────────
//
// The other direction, and the one that bit hardest: the add-on stack on
// /pricing was already written as t("addOns.title", "…") with an English
// fallback at every call site, and NOT ONE of those eleven keys existed in the
// catalogue. Every language fell through to the fallback, so the block was
// English on a nine-language page and check:translations — which only ever
// compares languages against English — reported 100%.
console.log("2. Every key these surfaces ask for is defined in English\n");
{
  const asked = new Map();
  for (const surface of SURFACES) {
    for (const file of jsFilesUnder(surface)) {
      const src = maskComments(readFileSync(file, "utf8"));
      for (const m of src.matchAll(/["']((?:compare|addOns|pricing)\.[A-Za-z0-9_.-]+)["']/g)) {
        const key = m[1];
        // A trailing dot is a dynamic PREFIX being concatenated —
        // t(`compare.per.${price.per}`) — and the prefix itself is never a key.
        if (key.endsWith(".")) continue;
        if (!asked.has(key)) asked.set(key, file);
      }
    }
  }
  const undefinedKeys = [...asked].filter(([key]) => !(key in MESSAGES.en));
  for (const [key, file] of undefinedKeys) console.log(`     undefined: ${key}  (${file})`);
  ok(
    `every "compare.*" / "addOns.*" / "pricing.*" key a surface names has an English string (${asked.size} referenced)`,
    undefinedKeys.length === 0,
    undefinedKeys.length ? `${undefinedKeys.length} missing` : undefined,
  );
  if (undefinedKeys.length === 0) console.log(`  ${asked.size} keys, all defined.\n`);
}

// ── 3. The English catalogue is pinned to the module it duplicates ─────────
//
// COMPARE_CHROME and the per-page ledes live in
// app/(marketing)/compare/compareCopy.js AND in the catalogue. The module is
// what scripts/check-compare-pages.mjs asserts against — that the
// stale-reading note is not the same sentence as the never-checked note, for
// instance — so it has to stay the one authority. Without this assertion the
// duplicate is free to drift into a second wording that nothing checks, which
// is exactly the hole scripts/check-feature-labels.mjs was written to close for
// the feature matrix.
console.log("3. English in the catalogue is character-identical to compareCopy.js\n");
{
  const { COMPARE_CHROME, COMPARE_PAGES, CHROME_COPY_FIELDS, chromeKey, ledeKey, concessionKey, counterpointKey } =
    await import("../app/(marketing)/compare/compareCopy.js");
  const en = COMPARE_PAGE_MESSAGES.en;
  const drift = [];
  for (const field of CHROME_COPY_FIELDS) {
    if (en[chromeKey(field)] !== COMPARE_CHROME[field]) drift.push(chromeKey(field));
  }
  COMPARE_CHROME.rules.forEach((rule, i) => {
    if (en[chromeKey(`rule.${i + 1}`)] !== rule) drift.push(chromeKey(`rule.${i + 1}`));
  });
  for (const p of COMPARE_PAGES) {
    if (en[ledeKey(p.competitorId)] !== p.lede) drift.push(ledeKey(p.competitorId));
    if (en[concessionKey(p.competitorId)] !== p.concessionLede) {
      drift.push(concessionKey(p.competitorId));
    }
  }
  const counterpoint = counterpointKey("projul", "monthly_billing");
  const { counterpointFor } = await import("../app/(marketing)/compare/compareCopy.js");
  if (en[counterpoint] !== counterpointFor("projul", "monthly_billing")) drift.push(counterpoint);

  // The same pin, one module along. lib/marketing/compareLabels.js resolves a
  // capability label, a team-size band, a billing mode and an availability word
  // through the catalogue, falling back to lib/marketing/competitors.js — which
  // is the module scripts/check-competitors.mjs asserts against in English. An
  // English catalogue entry that drifts from the ledger puts a claim about our
  // own product on the page that the ledger does not carry, which is the whole
  // reason the ledger exists.
  const { FIELDQUO_CAPABILITIES, TEAM_SIZES, BILLING_MODES } = await import(
    "../lib/marketing/competitors.js"
  );
  const { RENDERED_CAPABILITIES, capabilityKey, teamSizeKey, billingModeKey, AVAILABILITY_FALLBACK } =
    await import("../lib/marketing/compareLabels.js");
  const { AVAILABILITY_KEYS } = await import("../lib/marketing/compareLabels.js");
  for (const cap of RENDERED_CAPABILITIES) {
    if (en[capabilityKey(cap)] !== FIELDQUO_CAPABILITIES[cap].label) drift.push(capabilityKey(cap));
  }
  for (const [k, v] of Object.entries(TEAM_SIZES)) {
    if (en[teamSizeKey(k)] !== v.label) drift.push(teamSizeKey(k));
  }
  for (const [k, v] of Object.entries(BILLING_MODES)) {
    if (en[billingModeKey(k)] !== v.label) drift.push(billingModeKey(k));
  }
  Object.values(AVAILABILITY_FALLBACK).forEach((word, i) => {
    if (en[AVAILABILITY_KEYS[i]] !== word) drift.push(AVAILABILITY_KEYS[i]);
  });

  for (const key of drift) console.log(`     drifted: ${key}`);
  ok("no English string says one thing in the module and another in the catalogue", drift.length === 0);
  if (drift.length === 0) console.log("  pinned.\n");
}

// ── 4. Nine catalogues, key for key ────────────────────────────────────────
//
// check:translations already gates the eight OFFERED languages through
// MESSAGE_KEYS. Mandarin is not offered — it is catalogue-only, see
// CATALOGUE_ONLY in scripts/check-language-completeness.mjs — which makes it the
// one file that can fall behind with nothing noticing. Held to the same bar
// here, and the reverse direction (a key in a translation that English does not
// have) is checked for every language, because that is how a typo hides.
console.log("4. Every /compare catalogue is key-for-key with English\n");
{
  const base = Object.keys(COMPARE_PAGE_MESSAGES.en);
  for (const [code, dict] of Object.entries(COMPARE_PAGE_MESSAGES)) {
    if (code === DEFAULT_LANGUAGE) continue;
    const here = Object.keys(dict);
    const missing = base.filter((k) => !(k in dict));
    const extra = here.filter((k) => !base.includes(k));
    ok(
      `${code} is key-for-key with English (${base.length} keys)`,
      missing.length === 0 && extra.length === 0,
      [
        missing.length ? `missing: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ` (+${missing.length - 8})` : ""}` : "",
        extra.length ? `not in English: ${extra.slice(0, 8).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
    console.log(`  ${code.padEnd(3)} ${here.length}/${base.length}`);
  }
  console.log("");
}

// ── 5. A long sentence is not still English ────────────────────────────────
//
// The failure this catches is the one a key-parity check cannot: a translator
// who copies the English block, changes the const name and ships. Every key is
// present, coverage reads 100%, and the page is in English.
//
// Held to LONG strings only, and the threshold is a judgement rather than a
// rule: "Both" is legitimately "Both" in more than one language, a tier name is
// never translated, and a currency code is a currency code. A sentence of forty
// characters or more that is byte-identical to English is not a coincidence.
//
// The offered languages only. Mandarin is checked for keys above but not for
// this — a Latin-script fragment inside a Chinese string is normal.
console.log("5. No long sentence is byte-identical to the English\n");
{
  const offered = LANGUAGES.map((l) => l.code).filter((c) => c !== DEFAULT_LANGUAGE);
  const en = COMPARE_PAGE_MESSAGES.en;
  for (const code of offered) {
    const dict = COMPARE_PAGE_MESSAGES[code] || {};
    const same = Object.keys(en).filter(
      (k) => typeof en[k] === "string" && en[k].length >= 40 && dict[k] === en[k],
    );
    for (const k of same) console.log(`     ${code}: ${k} is still the English sentence`);
    ok(`${code} translated every sentence of 40 characters or more`, same.length === 0,
      same.length ? `${same.length} untranslated` : undefined);
  }
  console.log("");
}

console.log(`${pass} assertion(s) passed.`);
if (fails.length) {
  console.log(`\n${fails.length} FAILED:\n`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exitCode = 1;
}
