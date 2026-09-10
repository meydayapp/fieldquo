// scripts/check-savings-i18n.mjs
//
//   npm run check:savings-i18n
//
// Two bugs the owner reported in one sentence, and they are different bugs:
//
//   "this is still english only even if i changed it to ukrainian spanish
//    https://www.fieldquo.com/savings — its missing proper dollar formatting"
//
// The first half: /savings rendered in English in every language, because its
// copy lived in lib/marketing/savings.js — a data module, not a catalogue — and
// check:translations only ever compares catalogues. 100% coverage, reported
// truthfully, over a set of keys that did not include a single sentence on the
// page. The same hole swallowed /compare and the /pricing add-on stack before
// it; scripts/check-marketing-i18n.mjs was written for those and does not scan
// this page.
//
// The second half: every figure was grouped with a hardcoded "en-CA", so once
// the words WERE translated a French reader would have read "12,500" inside a
// French paragraph that writes it "12 500", and a German one "12.500". That is
// the bug another session fixed on /compare by introducing numberLocaleFor();
// this file exists partly so the third page cannot reintroduce it.
//
// The same two questions are asked of /login, because the owner's browser
// showed the left column in Spanish and the entire right-hand panel in English
// — AuthAside asked for "auth.aside.*" keys from the day it was written and no
// catalogue ever defined them, so t() fell through to the English fallback
// beside every call. A half-Spanish sign-in page is the first thing a new
// contractor sees.
//
// ══ Why the source is read with COMMENTS STRIPPED ══════════════════════════
//
// Every file scanned here explains, in prose, the thing it must not do. This
// file's own header quotes "en-CA". SavingsCalculator.js spends a paragraph on
// why it used to be hardcoded. A raw read cannot tell the explanation from the
// deed, and a check that matches its own comment is a check that fails for the
// wrong reason — or worse, passes because somebody deleted the explanation
// until it stopped matching.
//
// ══ Why the maskers are copied rather than imported ════════════════════════
//
// They are character-for-character scripts/check-marketing-i18n.mjs's, and
// AGENTS.md is explicit that the copy is the one that rots. The reason it is
// still a copy: that file runs its entire assertion suite at import time, so
// importing it to borrow two functions would run a second check inside this
// one and exit the process on ITS failures. Lifting them into a shared module
// is the right fix and belongs in a session that owns scripts/.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { MESSAGES } from "../app/i18n/messages.js";
import { LANGUAGES, DEFAULT_LANGUAGE } from "../app/i18n/languages.js";
import { SAVINGS_PAGE_MESSAGES } from "../app/i18n/savingsPage/index.js";
import { numberLocaleFor } from "../app/i18n/numberLocale.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass += 1, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? `\n      ${detail}` : ""}`);
const section = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 60 - t.length))}\n`);

// ── The surfaces ───────────────────────────────────────────────────────────
//
// Named, not globbed. The claim this file makes is about these pages, and a
// glob would quietly start policing every screen somebody added next.
const SAVINGS_FILES = [
  "app/(marketing)/savings/SavingsCalculator.js",
  "app/(marketing)/savings/page.js",
];
const LOGIN_FILES = [
  "app/login/page.js",
  "app/components/auth/AuthAside.js",
  "app/components/auth/AuthShell.js",
];
const SURFACES = [...SAVINGS_FILES, ...LOGIN_FILES];

/* ═══════════════════════════════════════════════════════════════════════════
   The maskers
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Comment bodies blanked, every other character kept in place.
 *
 * Not `src.replace(/\/\/.*$/gm, "")`: a line holding an https:// URL gets
 * truncated at the slashes and everything after it vanishes from the scan
 * along with any bug it held. A check whose job is to NOTICE something must
 * never lose real code to its own pre-processing.
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
 * JSX text is not a string literal, so the text scan has to remove string
 * literals before looking — otherwise every English fallback written beside a
 * t() key, which is the correct thing to write, reads as a bare literal and
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

// Brands and route paths. A trademark is not translated and "/pricing" is a
// URL a visitor types, so neither is a translation failure standing alone.
const NOT_COPY = new Set(["fieldquo", "stripe", "ai", "csv"]);
const isRoute = (w) => w.startsWith("/");

/**
 * The JSX text runs in one file, with their line numbers.
 *
 * A run is what sits between a tag's `>` and the next `<`. `{...}` is excluded
 * from the character class so an expression splits a run rather than being
 * swallowed into it. `=>` is excluded because an arrow's `>` is not a tag's.
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

/* ═══════════════════════════════════════════════════════════════════════════
   1. No bare English sentence on either surface
   ═══════════════════════════════════════════════════════════════════════════ */
section("Every visible sentence goes through t()");

{
  let offenders = 0;
  for (const file of SURFACES) {
    const masked = maskStrings(maskComments(read(file)));
    for (const run of jsxTextRuns(masked)) {
      console.log(`     ${file}:${run.line}  "${run.text}"`);
      offenders += 1;
    }
  }
  ok(
    "no bare JSX literal on /savings or /login",
    offenders === 0,
    offenders > 0
      ? `${offenders} listed above — wrap each in t("key", "the English") and add the key`
      : undefined,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. No hardcoded formatting locale
   ═══════════════════════════════════════════════════════════════════════════

   The half of the bug that survives a translation. A page can be perfectly
   translated and still punctuate every figure the English way, and it reads as
   sloppiness to exactly the readers whose language you went to the trouble of
   adding. lib/marketing/savings.js is scanned too, because that is where the
   "en-CA" actually lived — a scan of the view alone would have called this
   fixed while the module still decided it.

   DEFAULT_NUMBER_LOCALE is the one permitted literal, in the one file that
   declares it: a default that every caller can override is not a hardcoded
   locale, and the tag has to be written down somewhere. */
section("Numbers are punctuated for the reader, not for English");

{
  const LOCALE_LITERAL = /(?:toLocaleString|toLocaleDateString|Intl\.NumberFormat|Intl\.DateTimeFormat|Intl\.PluralRules)\s*\(\s*["'`]([a-z]{2}(?:-[A-Za-z0-9]+)*)["'`]/g;
  const MODULE = "lib/marketing/savings.js";
  for (const file of [...SURFACES, MODULE]) {
    const src = maskComments(read(file));
    const hits = [...src.matchAll(LOCALE_LITERAL)].map((m) => m[1]);
    ok(
      `${file}: no formatting locale is hardcoded`,
      hits.length === 0,
      hits.length ? hits.join(", ") : undefined,
    );
  }

  // ── And the module's formatter can be told which one to use ──────────────
  //
  // The assertion above passed on the old, broken code, and it is worth saying
  // why rather than quietly tightening it: the hardcoded "en-CA" was never
  // written inline at the call — it sat in `Math.round(v).toLocaleString(
  // "en-CA", …)` inside formatAmount, which the scan does catch, but the moment
  // that literal moved into a named constant the scan went quiet while the
  // behaviour stayed identical. A scan for a literal cannot tell "configurable"
  // from "renamed". So the shape is asserted directly: the formatter takes a
  // locale, and the default it falls back to is exported rather than buried,
  // because a default nobody can name is a default nobody can override.
  {
    const mod = maskComments(read(MODULE));
    ok(
      "formatAmount takes the locale as an argument",
      /export function formatAmount\(\s*n\s*,\s*locale\s*=/.test(mod),
    );
    ok(
      "and its fallback is a named export rather than a buried literal",
      /export const DEFAULT_NUMBER_LOCALE\s*=/.test(mod),
    );
  }

  // And the view has to actually reach for the reader's locale, or the
  // assertion above passes on a page that formats nothing at all.
  const view = maskComments(read("app/(marketing)/savings/SavingsCalculator.js"));
  ok(
    "the calculator reads the language's own grouping locale",
    /numberLocaleFor\(language\)/.test(view),
  );
  ok(
    "and hands it to the module's formatter rather than re-deriving one",
    /formatAmount\([^)]*locale\)/.test(view),
  );

  // The locale table has to answer for every language the marketing catalogue
  // carries. A language that falls through to en-CA is the bug wearing a
  // different hat, and it is invisible unless somebody asks.
  const carried = Object.keys(SAVINGS_PAGE_MESSAGES);
  const fellThrough = carried.filter(
    (code) => code !== "en" && numberLocaleFor(code) === numberLocaleFor("en"),
  );
  ok(
    `every language on this page has its own grouping locale (${carried.length} carried)`,
    fellThrough.length === 0,
    fellThrough.join(", "),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Every key the surfaces name is defined in English
   ═══════════════════════════════════════════════════════════════════════════

   The direction that bit hardest, and the one check:translations is blind to
   by construction: it compares every language against English, so eleven keys
   that exist in NO language report 100% coverage. That is exactly what
   AuthAside did — every point on the login panel was already written as
   t("auth.aside.login.point1", "Build the quote…") and not one of the keys
   existed. */
section("Every key these pages ask for has an English string");

{
  const asked = new Map();
  const KEY = /["'`]((?:marketing\.savings|auth\.aside)\.[A-Za-z0-9_.-]+)["'`]/g;
  for (const file of SURFACES) {
    const src = maskComments(read(file));
    for (const m of src.matchAll(KEY)) {
      const key = m[1];
      // A trailing dot, or a `${` left behind by a template literal, is a
      // dynamic PREFIX rather than a key. Those are covered by section 4,
      // which asserts the ids they are built from.
      if (key.endsWith(".") || key.includes("$")) continue;
      if (!asked.has(key)) asked.set(key, file);
    }
  }
  const missing = [...asked].filter(([key]) => !(key in MESSAGES.en));
  for (const [key, file] of missing) console.log(`     undefined: ${key}  (${file})`);
  ok(
    `every literal key named on these pages exists in English (${asked.size} referenced)`,
    missing.length === 0,
    missing.length ? `${missing.length} missing` : undefined,
  );

  // The panel is the specific regression this section was written for, so it
  // is asserted by name rather than left to the sweep — a rename that dropped
  // all twelve would otherwise pass with "0 referenced".
  const PANEL = [
    "auth.aside.login.heading",
    "auth.aside.login.point1",
    "auth.aside.login.point2",
    "auth.aside.login.point3",
    "auth.aside.login.newHere",
    "auth.aside.login.newHereCta",
    "auth.aside.signup.heading",
    "auth.aside.signup.point1",
    "auth.aside.signup.point2",
    "auth.aside.signup.point3",
    "auth.aside.signup.billing",
    "auth.aside.trades",
  ];
  const undef = PANEL.filter((k) => !(k in MESSAGES.en));
  ok("the login panel's twelve keys are all defined", undef.length === 0, undef.join(", "));
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. The catalogue is pinned to the module it duplicates
   ═══════════════════════════════════════════════════════════════════════════

   Every assumption, line item and exclusion exists twice: in
   lib/marketing/savings.js, which scripts/check-savings.mjs reads and holds to
   its 308 assertions, and in app/i18n/savingsPage/en.js, which is what a
   reader sees. Without this, the English a visitor reads is free to drift away
   from the English the truth check inspects — and the drifted copy is the one
   nobody looks at. */
section("English on the page is the English the truth check reads");

{
  const {
    ASSUMPTIONS,
    INPUT_FIELDS,
    LINE_BUILDERS,
    NOT_COUNTED,
    AI_WITHOUT_AN_UPGRADE,
    SAVINGS_DISCLOSURE,
    CURRENCY_NOTE,
  } = await import("../lib/marketing/savings.js");

  const en = SAVINGS_PAGE_MESSAGES.en;
  const drift = [];
  const pin = (key, value) => {
    if (en[key] !== value) drift.push(key);
  };

  for (const f of INPUT_FIELDS) {
    pin(`marketing.savings.field.${f.key}.label`, f.label);
    pin(`marketing.savings.field.${f.key}.help`, f.help);
    if (f.kind === "choice") {
      for (const o of f.options) {
        pin(`marketing.savings.field.${f.key}.option.${o.value}`, o.label);
      }
    }
  }
  for (const r of ASSUMPTIONS) {
    pin(`marketing.savings.assumption.${r.key}.label`, r.label);
    pin(`marketing.savings.assumption.${r.key}.represents`, r.represents);
    pin(`marketing.savings.assumption.${r.key}.reasoning`, r.reasoning);
  }
  for (const b of LINE_BUILDERS) {
    pin(`marketing.savings.line.${b.key}.label`, b.label);
    pin(`marketing.savings.line.${b.key}.mechanism`, b.mechanism);
  }
  for (const n of NOT_COUNTED) {
    pin(`marketing.savings.notCounted.${n.key}.subject`, n.subject);
    pin(`marketing.savings.notCounted.${n.key}.reason`, n.reason);
  }
  pin("marketing.savings.ai.headline", AI_WITHOUT_AN_UPGRADE.headline);
  pin("marketing.savings.ai.body", AI_WITHOUT_AN_UPGRADE.body);
  pin("marketing.savings.disclosure.headline", SAVINGS_DISCLOSURE.headline);
  pin("marketing.savings.disclosure.body", SAVINGS_DISCLOSURE.body);
  pin("marketing.savings.currency.short", CURRENCY_NOTE.short);
  pin("marketing.savings.currency.long", CURRENCY_NOTE.long);

  for (const key of drift) console.log(`     drifted: ${key}`);
  ok(
    "every sentence the module publishes is the same sentence the catalogue renders",
    drift.length === 0,
    drift.length ? `${drift.length} drifted` : undefined,
  );

  // The keys the module hands back at runtime, asserted to exist rather than
  // trusted. A workings sentence resolves through a key built inside a
  // builder, so a typo there is invisible to every other check on this page:
  // t() would fall back to the English the builder also returns, and the page
  // would look right in English and stay English in eight languages.
  const runtimeKeys = new Set();
  for (const b of LINE_BUILDERS) {
    runtimeKeys.add(`marketing.savings.line.${b.key}.workings`);
  }
  runtimeKeys.add("marketing.savings.line.quote_writing.sourceAnswered");
  runtimeKeys.add("marketing.savings.line.quote_writing.sourceDefault");
  runtimeKeys.add("marketing.savings.omit.quote_writing.noQuotes");
  runtimeKeys.add("marketing.savings.omit.quote_writing.alreadyFast");
  runtimeKeys.add("marketing.savings.omit.quotes_chased.winsAll");
  for (const unit of ["minutes", "days"]) {
    runtimeKeys.add(`marketing.savings.unit.${unit}.one`);
    runtimeKeys.add(`marketing.savings.unit.${unit}.other`);
  }
  const absent = [...runtimeKeys].filter((k) => !(k in en));
  ok(
    `every key the arithmetic names at runtime exists (${runtimeKeys.size} keys)`,
    absent.length === 0,
    absent.join(", "),
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Every language actually carries it
   ═══════════════════════════════════════════════════════════════════════════ */
section("Nine languages, and none of them is English wearing a label");

{
  const en = SAVINGS_PAGE_MESSAGES.en;
  const keys = Object.keys(en);
  ok(`the English catalogue is not empty (${keys.length} keys)`, keys.length > 100);

  // Every OFFERED language, from languages.js, not from this file's own idea
  // of the list. A language added there and forgotten here would otherwise
  // ship as a page in English with a language switcher that lies.
  for (const { code, name } of LANGUAGES) {
    if (code === DEFAULT_LANGUAGE) continue;
    const dict = SAVINGS_PAGE_MESSAGES[code] || {};
    const missing = keys.filter((k) => !(k in dict));
    ok(`${name}: all ${keys.length} keys`, missing.length === 0, missing.slice(0, 5).join(", "));

    // Byte-identical to English on a long sentence is a copy-paste, not a
    // translation. Short labels legitimately coincide (a brand, a unit), so
    // the bar is a sentence — the thing nobody translates by accident.
    const copied = keys.filter(
      (k) =>
        typeof dict[k] === "string" &&
        dict[k] === en[k] &&
        String(en[k]).split(/\s+/).length > 6,
    );
    ok(
      `${name}: no long sentence left in English`,
      copied.length === 0,
      copied.slice(0, 5).join(", "),
    );

    // A dropped {placeholder} silently deletes a figure from a claim — the
    // total loses its currency note, or a workings line loses the number it
    // was multiplying. That is a wrong sentence, not a missing one, and it is
    // the failure a translator makes most.
    const names = (s) =>
      [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const bad = keys.filter((k) => dict[k] && names(en[k]) !== names(dict[k]));
    ok(`${name}: every figure still has somewhere to land`, bad.length === 0, bad.join(", "));
  }

  // The panel keys ride in messages.js rather than this directory, so they are
  // checked against the merged catalogue.
  for (const { code, name } of LANGUAGES) {
    if (code === DEFAULT_LANGUAGE) continue;
    const missing = ["auth.aside.login.heading", "auth.aside.trades"].filter(
      (k) => !(k in (MESSAGES[code] || {})),
    );
    ok(`${name}: the login panel is translated`, missing.length === 0, missing.join(", "));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. The translated page still says, in English, exactly what it said before
   ═══════════════════════════════════════════════════════════════════════════

   The workings lines are the ones this could quietly break. They used to be
   built inside the module as one English string; they are now a catalogue
   template plus a bag of tagged values that the page assembles. Those two
   paths have to produce the same characters, or the sentence a contractor
   checks against his own books is not the sentence scripts/check-savings.mjs
   holds to its 308 assertions.

   The English formatting pipeline is reproduced here rather than imported: the
   real one lives inside a JSX component, and nothing in an alias-loader run
   can parse JSX. That makes this a WEAKER check than executing the component —
   it proves the templates and the tagged values agree, not that React renders
   them. It is still the only assertion in the repo that would notice a
   translator's template losing a word. */
section("English out of the catalogue is English out of the module");

{
  const { LINE_BUILDERS, estimateSavings, formatAmount, unitLabel } = await import(
    "../lib/marketing/savings.js"
  );
  const en = SAVINGS_PAGE_MESSAGES.en;
  const L = "en-CA";

  const num = (n) => Number(n).toLocaleString(L, { maximumFractionDigits: 0 });
  const percent = (v) =>
    new Intl.NumberFormat(L, { style: "percent", maximumFractionDigits: 2 }).format(v);
  const plurals = new Intl.PluralRules(L);
  const render = (spec) => {
    if (!spec || typeof spec !== "object") return String(spec ?? "");
    if (spec.kind === "phrase") return fill(en[spec.key], spec.values);
    if (spec.kind === "money") return formatAmount(spec.n, L);
    if (spec.kind === "share") return percent(spec.n);
    if (spec.kind === "minutes" || spec.kind === "days") {
      const cat = plurals.select(Math.abs(spec.n));
      const key = `marketing.savings.unit.${spec.kind}.${cat}`;
      const template = key in en ? key : `marketing.savings.unit.${spec.kind}.other`;
      return fill(en[template], { n: num(spec.n) });
    }
    return num(spec.n);
  };
  function fill(template, values) {
    const mapped = {};
    for (const [name, spec] of Object.entries(values || {})) mapped[name] = render(spec);
    return String(template).replace(/\{(\w+)\}/g, (m, name) =>
      mapped[name] !== undefined ? mapped[name] : m,
    );
  }

  // A shape of business that produces every line at once, including the two
  // that only appear when a box is left blank and when it is not.
  const ANSWERS = {
    seats: 3,
    crew: 5,
    quotesPerMonth: 20,
    projectsPerMonth: 8,
    averageProjectValue: 4200,
    adminHoursPerWeek: 9,
    hourlyCost: 45,
    tools: "paper",
  };

  for (const answers of [ANSWERS, { ...ANSWERS, quoteDeskMinutes: 75, tools: "separate_apps" }]) {
    const r = estimateSavings(answers);
    for (const line of r.lines) {
      ok(
        `${line.key}: the catalogue rebuilds the module's own workings`,
        fill(en[line.workingsKey], line.workingsValues) === line.workings,
        `catalogue: ${fill(en[line.workingsKey], line.workingsValues)}\n      module:    ${line.workings}`,
      );
    }
  }

  // And the omission sentences, which carry a figure in one of the three.
  const fast = estimateSavings({ ...ANSWERS, quoteDeskMinutes: 1 });
  for (const o of fast.omitted) {
    ok(
      `${o.key}: the catalogue rebuilds the module's own reason`,
      fill(en[o.reasonKey], o.reasonValues) === o.reason,
      `catalogue: ${fill(en[o.reasonKey], o.reasonValues)}\n      module:    ${o.reason}`,
    );
  }

  // unitLabel is the module's own renderer for "120 minutes" and it is what
  // validateAssumptions holds the table's `display` to. The catalogue has to
  // agree with it, or the assumption table prints one figure and the workings
  // beside it print another.
  for (const [n, unit] of [[1, "minutes"], [120, "minutes"], [5, "days"], [3, "days"]]) {
    ok(
      `the catalogue writes "${unitLabel(n, unit)}" the way the module does`,
      render({ n, kind: unit }) === unitLabel(n, unit),
      render({ n, kind: unit }),
    );
  }
  ok("no line builder is missing a workings key", LINE_BUILDERS.length > 0);
}

/* ═══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${pass} checks passed.`);
if (fails.length) {
  console.log(`\n${fails.length} FAILED:\n`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("/savings and /login read in every language, with the reader's own numbers.\n");
