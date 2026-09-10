// scripts/check-app-screens-i18n.mjs
//
//   npm run check:app-screens-i18n
//
// The back-office screens the owner read with his account set to Spanish and
// found in English:
//
//   /app/funnels                    — the list, and everything behind "New funnel"
//   /app/purchasing                 — three panels, all of it
//   /app/help                       — the intro sentence
//   /app/activity                   — the intro paragraph and every relative time
//   /app/marketing/designer/*       — the whole designer
//   /app/settings/product-updates   — the changelog chrome
//   /app/settings/checklists        — phase labels and the starter library
//   /app/settings/follow-ups        — the "new rule" form
//   /app/settings/company           — opening hours
//   /app/settings/voice             — the three number options
//
// check:translations gates the CATALOGUE — every key English defines exists in
// every language. It has nothing to say about a sentence that was never a key,
// and that is what all ten screens were full of. check:marketing-i18n asks the
// other question for /compare and /pricing; this asks it for /app.
//
// ══ Why the source is read with COMMENTS STRIPPED ══════════════════════════
//
// Every file scanned here explains, in prose, the thing it must not do. The
// header of app/app/help/page.js literally contained the English sentence it
// was failing to translate, spelled out under an "i18n PENDING" heading. A raw
// read cannot tell the explanation from the deed, and a check that matches its
// own header comment fails for the wrong reason — or gets tuned until it stops
// matching and then cannot see the real thing either. Two checks in this repo
// were already fooled that way (see check-translations.mjs and
// check-marketing-i18n.mjs, which carry the same masker and the same scar).
//
// The masker replaces comment bodies with spaces rather than deleting them, so
// the line numbers in a failure still point at the real line.
//
// ══ What it sees, and what it does not ═════════════════════════════════════
//
// 1. JSX TEXT — the characters between a tag's `>` and the next `<`. This is
//    where a regression lands, because typing a sentence between two tags is
//    the fastest thing to do.
//
// 2. USER-FACING PROP VALUES — a string literal assigned to placeholder,
//    aria-label, title, alt, label, intro or confirm. check:marketing-i18n
//    explicitly cannot see these and says so; on these screens they were a
//    third of the problem (`intro="Step-by-step guides…"` on /app/help was one
//    prop, and it was the longest string on the page).
//
// It still does NOT see an English sentence assigned to a variable and
// rendered later, or one built by string concatenation. Assertion 3 narrows
// that from the other side: every app.* key these screens ASK for must exist
// in English, because a t() call on a key nobody defined renders its English
// fallback in all nine languages while check:translations reports 100%.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass += 1)
    : fails.push(`${label}${detail !== undefined ? `\n      ${detail}` : ""}`);

// ── The surfaces ───────────────────────────────────────────────────────────
//
// Named, not globbed over app/app. A glob would silently start policing every
// screen in the product the first time somebody added one, and this check has
// no business making that decision for another agent's file. Add a path here
// deliberately, once that screen has actually been swept.
const SURFACES = [
  "app/app/funnels",
  "app/app/purchasing",
  "app/components/purchasing",
  "app/app/help",
  "app/app/activity",
  "app/app/marketing/designer",
  "app/app/settings/product-updates",
  "app/app/settings/checklists",
  "app/app/settings/follow-ups",
  "app/app/settings/company",
  "app/app/settings/voice",
];

function jsFilesUnder(path) {
  const out = [];
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const entry of readdirSync(p)) walk(join(p, entry));
    } else if (p.endsWith(".js") || p.endsWith(".jsx")) {
      out.push(p);
    }
  };
  walk(path);
  return out;
}

/**
 * Comment bodies blanked, every other character kept in place.
 *
 * Not `src.replace(/\/\/.*$/gm, "")`: a line holding an https:// URL would be
 * truncated at the slashes and everything after it — including any bug on that
 * line — would vanish from the scan. A check whose job is to NOTICE something
 * must never lose real code to its own pre-processing, because that direction
 * of error is a false pass.
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
 * t() key (which is the CORRECT thing to write) reads as a bare literal and
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

// Words that are not a translation failure standing alone in JSX text or in a
// prop. Product names, trademarks, currency and unit tokens, and the file
// extensions a help sentence has to name literally. Each is here for a reason
// a translator would give: you do not translate a trademark, and "MP4" is not
// English.
const NOT_COPY = new Set([
  "fieldquo",
  "stripe",
  "twilio",
  "retell",
  "cloudinary",
  "google",
  "facebook",
  "instagram",
  "meta",
  "whatsapp",
  "unsplash",
  "ai",
  "sms",
  "url",
  "csv",
  "pdf",
  "png",
  "jpg",
  "svg",
  "mp4",
  "id",
  "qr",
  "usd",
  "cad",
  "eur",
  "mo",
  "min",
  "px",
]);

const isRoute = (w) => w.startsWith("/");

/**
 * The JSX text runs in one file, with their line numbers.
 *
 * A run is what sits between a tag's `>` and the next `<`. `{...}` is excluded
 * from the character class so an expression SPLITS a run rather than being
 * swallowed into it — which is what makes `— {entry.summary}` read as the
 * punctuation it is rather than as a sentence.
 *
 * `=>` and `>=` are excluded because an arrow's `>` is not a tag's, and a run
 * carrying JS punctuation is discarded for the same reason: this scan looks
 * for prose, and a false positive on an expression gets a check switched off.
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

// The props whose value a user actually reads. `title` is on the list because
// it is the browser tooltip; `label` and `intro` because both are how a screen
// on this list hands copy to a shared component — which is precisely how
// /app/help shipped its longest sentence in English on a nine-language app.
const COPY_PROPS = [
  "placeholder",
  "aria-label",
  "ariaLabel",
  "title",
  "alt",
  "label",
  "intro",
  "subtitle",
  "heading",
  "confirmLabel",
  "emptyLabel",
];

/**
 * String literals handed to a user-facing prop, with their line numbers.
 *
 * Only a DOUBLE- or SINGLE-quoted literal directly after the `=` counts.
 * `title={t("…")}` is an expression and is skipped by construction, which is
 * the whole point: the correct form must not trip the check.
 */
function copyPropLiterals(masked) {
  const hits = [];
  const re = new RegExp(
    `\\b(${COPY_PROPS.join("|")})\\s*=\\s*(["'])([^"'\\n]{2,})\\2`,
    "g",
  );
  let m;
  while ((m = re.exec(masked)) !== null) {
    const value = m[3];
    const words = value
      .split(/[^A-Za-z']+/)
      .filter((w) => w.length > 1 && !NOT_COPY.has(w.toLowerCase()));
    // One word is a slot name or a token ("orders", "email"); prose starts at
    // two. Deliberately the same threshold the JSX scan uses, so the two
    // assertions cannot disagree about what counts as a sentence.
    if (words.length < 2) continue;
    const line = masked.slice(0, m.index).split("\n").length;
    hits.push({ line, prop: m[1], text: value });
  }
  return hits;
}

console.log("1. No bare English literal in the JSX of an /app screen\n");
{
  let offenders = 0;
  for (const surface of SURFACES) {
    for (const file of jsFilesUnder(surface)) {
      const masked = maskStrings(maskComments(readFileSync(file, "utf8")));
      for (const run of jsxTextRuns(masked)) {
        console.log(`     ${file}:${run.line}  "${run.text}"`);
        offenders += 1;
      }
    }
  }
  ok(
    "every visible sentence on these screens goes through t()",
    offenders === 0,
    offenders > 0
      ? `${offenders} bare literal(s) listed above — wrap each in t("app.<screen>.<key>", "the English") and add the key to every language in app/i18n/appMessages.js`
      : undefined,
  );
  if (offenders === 0) console.log("  no bare JSX literals.\n");
}

console.log("2. No English sentence handed to a user-facing prop\n");
{
  let offenders = 0;
  for (const surface of SURFACES) {
    for (const file of jsFilesUnder(surface)) {
      // COMMENTS stripped, strings KEPT — the opposite of assertion 1, because
      // here the string literal is the thing being looked for.
      const masked = maskComments(readFileSync(file, "utf8"));
      for (const hit of copyPropLiterals(masked)) {
        console.log(`     ${file}:${hit.line}  ${hit.prop}="${hit.text}"`);
        offenders += 1;
      }
    }
  }
  ok(
    "placeholder / aria-label / title / alt / label / intro are all expressions, not literals",
    offenders === 0,
    offenders > 0
      ? `${offenders} literal prop value(s) listed above — replace with t("…")`
      : undefined,
  );
  if (offenders === 0) console.log("  no literal copy props.\n");
}

// ── 3. Every key these screens ask for exists in English ───────────────────
//
// The direction that bit hardest on /pricing and would bite identically here:
// a screen written as t("app.funnels.title", "Funnels") with an English
// fallback at every call site, and not one of those keys in the catalogue.
// Every language falls through to the fallback, the screen is English in nine
// languages, and check:translations — which only ever compares languages
// against English — reports 100%.
console.log("3. Every app.* key these screens name has an English string\n");
{
  const asked = new Map();
  for (const surface of SURFACES) {
    for (const file of jsFilesUnder(surface)) {
      const src = maskComments(readFileSync(file, "utf8"));
      for (const m of src.matchAll(/["'](app\.[A-Za-z0-9_.-]+)["']/g)) {
        const key = m[1];
        // A trailing dot is a dynamic PREFIX being concatenated —
        // t(`app.voice.plan.${plan}`) — and the prefix itself is never a key.
        if (key.endsWith(".")) continue;
        if (!asked.has(key)) asked.set(key, file);
      }
    }
  }
  const missing = [...asked].filter(([key]) => !(key in APP_MESSAGES.en));
  for (const [key, file] of missing) console.log(`     undefined: ${key}  (${file})`);
  ok(
    `every app.* key these screens name is defined in English (${asked.size} referenced)`,
    missing.length === 0,
    missing.length ? `${missing.length} missing` : undefined,
  );
  if (missing.length === 0) console.log(`  ${asked.size} keys, all defined.\n`);
}

// ── 4. Every key these screens ask for exists in EVERY language ────────────
//
// The claim assertion 3 makes is only half of one. A key that exists in
// English and nowhere else renders its English through t()'s fallback, which
// is the correct fallback and the wrong OUTCOME: the screen is English again,
// and check:translations — which reports per-catalogue rather than per-screen
// — was already red for an unrelated reason in another agent's directory, so
// nobody would see it.
//
// Scoped to what these SCREENS reference rather than to a namespace prefix,
// because that is the promise being made: open /app/purchasing in Punjabi and
// read Punjabi. /app/purchasing had 61 keys missing from Ukrainian, Punjabi
// and Tagalog when this was written, and no check in the repo said so.
console.log("4. Every key these screens ask for exists in every language\n");
{
  const asked = new Set();
  for (const surface of SURFACES) {
    for (const file of jsFilesUnder(surface)) {
      const src = maskComments(readFileSync(file, "utf8"));
      for (const m of src.matchAll(/["'](app\.[A-Za-z0-9_.-]+)["']/g)) {
        if (!m[1].endsWith(".") && m[1] in APP_MESSAGES.en) asked.add(m[1]);
      }
    }
  }
  const holes = [];
  for (const [code, dict] of Object.entries(APP_MESSAGES)) {
    if (code === "en") continue;
    for (const key of asked) if (!(key in dict)) holes.push(`${code}: ${key}`);
  }
  for (const hole of holes.slice(0, 40)) console.log(`     ${hole}`);
  if (holes.length > 40) console.log(`     … and ${holes.length - 40} more`);
  ok(
    `${asked.size} referenced key(s) present in all ${Object.keys(APP_MESSAGES).length} languages`,
    holes.length === 0,
    holes.length ? `${holes.length} hole(s)` : undefined,
  );
  if (holes.length === 0)
    console.log(
      `  ${asked.size} keys × ${Object.keys(APP_MESSAGES).length} languages, complete.\n`,
    );
}

if (fails.length) {
  console.error(`\ncheck:app-screens-i18n FAILED — ${fails.length} problem(s).\n`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check:app-screens-i18n passed — ${pass} assertion(s).`);
