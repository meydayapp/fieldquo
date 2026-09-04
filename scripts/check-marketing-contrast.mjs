// scripts/check-marketing-contrast.mjs
//
//   npm run check:marketing-contrast
//
// Text measured against the panel it is SITTING IN, across the public
// marketing pages.
//
// ══ The gap this fills, named by the checks either side of it ══════════════
//
// Two contrast checks already exist and both are right about their own scope.
// Their headers also both write down the hole:
//
//   scripts/check-mobile-surfaces.mjs measures SAME-ELEMENT pairs — a class
//   list that carries a text colour and a background colour together. Its own
//   note: "it reads ONE element at a time. Colour inherits; a heading four
//   levels inside a coloured panel is invisible to this."
//
//   scripts/check-platform-contrast.mjs adds the Tailwind palette and is
//   scoped to /platform. It skips every opacity modifier, because "what a
//   40%-alpha wash composites to over an unknown backdrop is not a number this
//   file can know, and inventing one would be padding absent data with a
//   default".
//
// The closing call-to-action on the marketing pages is exactly one element
// four levels inside a coloured panel:
//
//     <div className="bg-primary">
//       <div className="max-w-3xl mx-auto ... text-center">
//         <h2 className="... text-white">…</h2>
//         <p  className="mt-3 text-muted-foreground">…</p>
//
// --muted-foreground is #4d6076 and it is chosen to sit on the light --card
// and --muted washes. On --primary (#06356b) it measures 1.88:1 — grey on
// navy. It was live on every industry page, on /glossary and on all hundred-odd
// /glossary/[slug] pages, and it was the sentence carrying the offer. Nothing
// in the repo could see it: neither element carries both colours.
//
// This file resolves the NEAREST ENCLOSING background instead. Which also
// means the alpha exclusion above stops applying here: /80 over an unknown
// backdrop is unknowable, but /80 over a backdrop this file just resolved is
// arithmetic, and it is composited rather than skipped. That matters, because
// the fix for the bug above is text-primary-foreground/80 and a check that
// skipped it would be green on both the broken version and the fixed one.
//
// ══ Light only, on purpose ════════════════════════════════════════════════
//
// app/layout.js allow-lists /app and /platform as themeable and its comment
// explains why: a homeowner's quote must not arrive dark. The marketing tree
// renders in the light palette for everybody, so measuring it in dark would be
// measuring a page that does not exist.
//
// ══ What this CANNOT prove ════════════════════════════════════════════════
//
//   · It reads JSX as text. An element whose className is computed
//     (a template literal, a ternary, a variable) is UNREADABLE and is
//     counted and printed, never silently passed.
//   · It knows the theme tokens in app/globals.css and text-white. A Tailwind
//     palette class is an unmeasured pairing and is counted the same way.
//     check-platform-contrast.mjs owns the palette; duplicating its oklch
//     converter here would be the copy that rots.
//   · A background applied by a parent COMPONENT rather than a parent element
//     is invisible — the nesting it walks is within one file.
//   · 4.5:1 is a floor, not a compliment.
//
// Every rule is a NEGATIVE: "is there a pair under the floor". A positive
// containment rule ("the fix is present") passes the moment its string appears
// anywhere in the file, which is how a check turns into a comment.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(p, "utf8");

const TEXT_FLOOR = 4.5;
// Large text (>=18.66px bold or >=24px) is allowed 3:1 by WCAG. Not used as a
// pass here — every pairing below is measured against 4.5 — but recorded so
// nobody "relaxes" the file later without noticing that it never claimed the
// relaxation.
const DIRS = ["app/(marketing)", "app/components/marketing"];

let checks = 0;
let failures = 0;
const unreadable = [];
const unmeasured = new Map();

function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}`);

/* ═══════════════════════════════════════════════════════════════════════════
   Colour
   ═══════════════════════════════════════════════════════════════════════════ */

const hexToRgb = (hex) => {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};

const luminance = ([r, g, b]) => {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

const contrast = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** `alpha` of `fg` painted over an opaque `bg`. What the browser actually shows. */
const composite = (fg, bg, alpha) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));

// Fixed points, asserted before anything this file computes is believed. A
// contrast function with a sign error still returns plausible numbers.
section("The maths, pinned before it is used");
ok("black on white is 21:1", Math.round(contrast([0, 0, 0], [255, 255, 255])) === 21);
ok("a colour against itself is 1:1", Math.round(contrast([9, 9, 9], [9, 9, 9])) === 1);
ok(
  "compositing white at 0 alpha leaves the background",
  composite([255, 255, 255], [6, 53, 107], 0).join() === "6,53,107",
);
ok(
  "and at full alpha leaves the foreground",
  composite([255, 255, 255], [6, 53, 107], 1).join() === "255,255,255",
);

/* ═══════════════════════════════════════════════════════════════════════════
   The tokens, read from the stylesheet rather than typed here
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The LIGHT `:root` block only.
 *
 * Sliced rather than regexed over the whole file: globals.css defines every
 * token twice, and a naive last-match-wins scan would silently measure the
 * marketing pages in the dark palette — which would pass this exact bug,
 * because --muted-foreground is #9fb2c8 in dark and reads perfectly well on
 * navy. The one theme that is never served to these pages is the one a lazy
 * parser would pick.
 */
function lightTokens(css) {
  const start = css.indexOf(":root");
  const darkAt = css.search(/(prefers-color-scheme:\s*dark|\[data-theme=["']dark["']\])/);
  const block = css.slice(start, darkAt === -1 ? css.length : darkAt);
  const out = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    if (!(m[1] in out)) out[m[1]] = m[2];
  }
  return out;
}

const TOKENS = lightTokens(read(path.join(ROOT, "app/globals.css")));

section("The light palette was read, and it is the light one");
for (const t of ["primary", "card", "muted", "accent", "foreground", "muted-foreground"]) {
  ok(`--${t} resolved`, typeof TOKENS[t] === "string", TOKENS[t]);
}
// The single most load-bearing assertion in this file. If the slice above ever
// picks the dark block, every measurement below is of a page nobody is served
// and the bug this file was written for passes.
ok(
  "--primary is the light navy, not the dark-mode blue",
  TOKENS.primary?.toLowerCase() === "#06356b",
  TOKENS.primary,
);

/** Tailwind class -> hex, for the tokens this repo defines plus white/black. */
const COLOR_OF = {
  white: "#ffffff",
  black: "#000000",
  ...Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, v])),
};

/**
 * `text-*` utilities that are not colours.
 *
 * Excluded from the SKIP tally rather than from the parse, and the difference
 * matters: a skip report padded with 198 `text-sm` is a report nobody reads,
 * and the whole point of printing skips is that "0 problems" over an unreported
 * skip pile is false confidence. Sizes and alignment were never candidates, so
 * counting them as "could not measure" is the report lying about its own reach.
 */
const NOT_A_COLOUR = new Set([
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
  "left", "center", "right", "justify", "start", "end",
  "balance", "pretty", "wrap", "nowrap", "ellipsis", "clip",
]);

/** `text-primary-foreground/80` -> { name, alpha }. Null when we cannot read it. */
function parseColorClass(cls, prefix) {
  const m = cls.match(new RegExp(`^${prefix}-([a-z-]+?)(?:/(\\d{1,3}))?$`));
  if (!m) return null;
  const name = m[1];
  if (!(name in COLOR_OF)) return { name, alpha: 1, unknown: true };
  return { name, alpha: m[2] === undefined ? 1 : Number(m[2]) / 100, unknown: false };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Reading the nesting
   ═══════════════════════════════════════════════════════════════════════════ */

function walk(dir) {
  const out = [];
  const rec = (abs) => {
    for (const entry of fs.readdirSync(abs)) {
      const full = path.join(abs, entry);
      if (fs.statSync(full).isDirectory()) rec(full);
      else if (entry.endsWith(".js")) out.push(full);
    }
  };
  const start = path.join(ROOT, dir);
  if (fs.existsSync(start)) rec(start);
  return out;
}

/**
 * Every JSX element in `src` that sets a background, as { start, end, bg }.
 *
 * `end` is found by matching the element's own tag rather than by counting
 * braces: a `>` inside a string or an expression is common in this tree and a
 * brace counter trips over the arrow functions in every `.map(`.
 */
function backgroundSpans(src) {
  const spans = [];
  for (const m of src.matchAll(/className="([^"]*)"/g)) {
    const classes = m[1].split(/\s+/);
    // Base backgrounds only. A hover/focus/dark variant is a different state
    // and pairing it against the base text colour invents failures — the same
    // exclusion check-mobile-surfaces.mjs makes, for the same reason.
    const bgClass = classes.find((c) => /^bg-[a-z-]+(\/\d{1,3})?$/.test(c));
    if (!bgClass) continue;
    const parsed = parseColorClass(bgClass, "bg");
    if (!parsed || parsed.unknown) {
      if (parsed) unmeasured.set(bgClass, (unmeasured.get(bgClass) || 0) + 1);
      continue;
    }
    // An alpha background sits on something this file did not resolve, so it
    // is not a backdrop anything can be measured against.
    if (parsed.alpha !== 1) {
      unmeasured.set(bgClass, (unmeasured.get(bgClass) || 0) + 1);
      continue;
    }

    const open = src.lastIndexOf("<", m.index);
    if (open === -1) continue;
    const tag = src.slice(open + 1).match(/^([A-Za-z][\w.]*)/)?.[1];
    if (!tag) continue;
    const end = closingIndex(src, open, tag);
    if (end === null) continue;
    spans.push({ start: open, end, bg: hexToRgb(COLOR_OF[parsed.name]), bgClass });
  }
  return spans;
}

/** Index just past `<Tag …>…</Tag>`, or null for a self-closing / unreadable one. */
function closingIndex(src, open, tag) {
  const gt = findTagEnd(src, open);
  if (gt === null) return null;
  if (src[gt - 1] === "/") return gt + 1; // self-closing: nothing nests inside
  let depth = 1;
  let i = gt + 1;
  const openRe = new RegExp(`<${tag}(?=[\\s/>])`, "g");
  const closeRe = new RegExp(`</${tag}\\s*>`, "g");
  while (depth > 0 && i < src.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const o = openRe.exec(src);
    const c = closeRe.exec(src);
    if (!c) return null;
    if (o && o.index < c.index) {
      const oEnd = findTagEnd(src, o.index);
      if (oEnd === null) return null;
      if (src[oEnd - 1] !== "/") depth++;
      i = oEnd + 1;
      continue;
    }
    depth--;
    i = c.index + c[0].length;
  }
  return depth === 0 ? i : null;
}

/** The `>` that closes an opening tag, skipping any inside quotes or braces. */
function findTagEnd(src, open) {
  let braces = 0;
  let quote = null;
  for (let i = open + 1; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === ">" && braces === 0) return i;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   The rule
   ═══════════════════════════════════════════════════════════════════════════ */

section("No marketing text sits on a panel it cannot be read against");

const offenders = [];
let measured = 0;
const FILES = DIRS.flatMap(walk);

ok("the marketing tree was found", FILES.length > 20, `${FILES.length} files`);

for (const file of FILES) {
  const src = read(file);
  const spans = backgroundSpans(src);
  if (!spans.length) continue;
  const rel = path.relative(ROOT, file);

  for (const m of src.matchAll(/className="([^"]*)"/g)) {
    const classes = m[1].split(/\s+/);
    const textClass = classes.find((c) => /^text-[a-z-]+(\/\d{1,3})?$/.test(c));
    if (!textClass) continue;
    // text-sm / text-center / text-balance are not colours.
    const parsed = parseColorClass(textClass, "text");
    if (!parsed) continue;
    if (parsed.unknown) {
      if (!NOT_A_COLOUR.has(parsed.name)) {
        unmeasured.set(textClass, (unmeasured.get(textClass) || 0) + 1);
      }
      continue;
    }

    // The element carrying this text colour. If it declares its own opaque
    // background, that background is the backdrop and the same-element checks
    // already own it.
    const ownBg = classes.find((c) => /^bg-[a-z-]+$/.test(c));

    // Nearest enclosing background: the latest-starting span containing us.
    const enclosing = spans
      .filter((s) => m.index > s.start && m.index < s.end)
      .sort((a, b) => b.start - a.start)[0];
    if (!enclosing) continue;

    const ownParsed = ownBg ? parseColorClass(ownBg, "bg") : null;
    const bg =
      ownParsed && !ownParsed.unknown ? hexToRgb(COLOR_OF[ownParsed.name]) : enclosing.bg;

    // Alpha is COMPOSITED, not skipped: the backdrop is known here, which is
    // the whole reason this file exists beside the two that skip it.
    const fg = composite(hexToRgb(COLOR_OF[parsed.name]), bg, parsed.alpha);
    const ratio = contrast(fg, bg);
    measured++;
    if (ratio < TEXT_FLOOR) {
      const line = src.slice(0, m.index).split("\n").length;
      offenders.push(
        `${rel}:${line}  ${textClass} on ${
          ownParsed && !ownParsed.unknown ? ownBg : enclosing.bgClass
        } — ${ratio.toFixed(2)}:1`,
      );
    }
  }
}

ok(
  `enough pairings were resolved to be measuring something (${measured})`,
  measured > 100,
  "a walk that resolves nothing passes every rule below without reading anything",
);

ok(
  "every text/background pairing reaches 4.5:1",
  offenders.length === 0,
  offenders.length ? `\n      ${offenders.join("\n      ")}` : "",
);

/* ═══════════════════════════════════════════════════════════════════════════
   The other way a colour lies: a hover that changes nothing
   ═══════════════════════════════════════════════════════════════════════════

   `border border-border … hover:border-border` and `bg-primary …
   hover:bg-primary` are both real class lists off these pages. They read as
   an affordance and they are a no-op: the element says "I respond to a
   pointer" and does not. That is the dead-control rule at its smallest, and
   it is the size that survives review, because nothing about the markup looks
   wrong — the hover IS declared.

   check-platform-console.mjs forbids the same shape on the platform rail, so
   this is that rule pointed at the marketing tree rather than a new idea.

   Deliberately compares the VALUE, not just the property: `hover:bg-muted` on
   a `bg-card` element is a real hover and must keep passing. Only an exact
   match of base and hover value is an offence. */
section("No marketing hover state is a no-op");

{
  const noops = [];
  for (const file of FILES) {
    const src = read(file);
    for (const m of src.matchAll(/className="([^"]*)"/g)) {
      const classes = m[1].split(/\s+/).filter(Boolean);
      const base = new Set(classes.filter((c) => !c.includes(":")));
      for (const c of classes) {
        const hover = c.match(/^hover:(.+)$/);
        if (!hover) continue;
        if (base.has(hover[1])) {
          const line = src.slice(0, m.index).split("\n").length;
          noops.push(`${path.relative(ROOT, file)}:${line}  hover:${hover[1]} on ${hover[1]}`);
        }
      }
    }
  }
  ok(
    "no hover: variant repeats the base value it is meant to change",
    noops.length === 0,
    noops.length ? `\n      ${noops.join("\n      ")}` : "",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   What was skipped, printed rather than swallowed
   ═══════════════════════════════════════════════════════════════════════════ */

section("What this run could not measure");
const skipped = [...unmeasured.entries()].sort((a, b) => b[1] - a[1]);
console.log(
  skipped.length
    ? `  ${skipped.length} class(es) outside the theme palette or carrying alpha over an ` +
      `unresolved backdrop, ${skipped.reduce((n, [, c]) => n + c, 0)} occurrence(s):`
    : "  nothing",
);
for (const [cls, count] of skipped.slice(0, 20)) console.log(`    ${cls} × ${count}`);
if (unreadable.length) {
  console.log(`  ${unreadable.length} element(s) whose className could not be read statically`);
}

console.log(
  `\n${measured} pairing(s) measured across ${FILES.length} marketing files, light palette.`,
);
if (failures) {
  console.log(`\n${failures} FAILED of ${checks}`);
  process.exit(1);
}
console.log(`ALL PASS — ${checks} checks`);
