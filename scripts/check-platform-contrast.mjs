// scripts/check-platform-contrast.mjs
//
//   npm run check:platform-contrast
//
// The two colour blind spots the console had, closed with measurement.
//
// ══ What was already covered, and what was not ════════════════════════════
//
// scripts/check-platform-console.mjs measures the RAIL: a named list of
// --sidebar-* pairings, recomputed from app/globals.css in both themes. It is
// the right check and it caught the right bug (text-muted-foreground on a
// near-black, 2.72:1, reported as "I thought there was no menu").
//
// scripts/check-mobile-surfaces.mjs measures same-element pairs across the
// tree, and its header names two deliberate exclusions:
//
//   1. it ignores `hover:` / `focus:` / `active:` variants entirely, because
//      pairing a hover fill against the BASE text produces false failures;
//   2. it only knows the hexes of tokens defined in globals.css, so a Tailwind
//      palette class is reported as an UNMEASURED background and passes.
//
// Both exclusions are correct for that file. Together they left the thirty
// screens of this console — which paint their warnings, their destructive
// buttons and their status pills out of `bg-red-50`, `text-amber-800`,
// `bg-emerald-600` rather than out of theme tokens — measured by nothing at
// all. Four real defects lived in that gap:
//
//   · bg-emerald-600 text-white on the Reactivate button — 3.65:1. Tailwind
//     v4's emerald-600 is #009966; the v3 hex people remember is not what
//     ships.
//   · hover:text-red-600 over hover:bg-red-50 — 4.36:1, on three screens.
//   · text-red-600 with no dark variant, 3.54:1 on --card in dark mode, plus a
//     hover that painted a near-white pill onto a dark page.
//   · `dark:bg-red-950/40` written where `dark:hover:bg-` was meant, twice: in
//     dark mode the wash was permanent and the hover changed nothing, which is
//     the same dead-hover shape check-platform-console.mjs forbids on the rail.
//
// ══ Why the palette is PARSED, in oklch, and not typed in here ════════════
//
// Tailwind v4 defines its colours as oklch in node_modules/tailwindcss/
// theme.css and recalibrated them from v3 — amber-700 is #bb4d00, not the
// #b45309 that is in everybody's memory and in half the internet's snippets. A
// table of hexes in this file would be wrong on the day it was written and
// wronger after an upgrade. So the oklch triples are read from the installed
// Tailwind, converted to sRGB here, and the conversion is pinned by fixed
// points below before anything it produces is trusted.
//
// Theme tokens come from app/globals.css the same way, so a pair that mixes
// one of each (`text-foreground` on `bg-amber-50`) is measurable too.
//
// ══ What this CANNOT prove ════════════════════════════════════════════════
//
// The same limit every static colour check in this repo has, stated rather
// than left for somebody to discover:
//
//   · it reads ONE element at a time. Colour inherits; a heading four levels
//     inside a coloured panel is invisible to this. Mutation-tested and
//     confirmed — see the report for this session.
//   · it skips every opacity modifier (`bg-red-950/40`). What a 40%-alpha wash
//     composites to over an unknown backdrop is not a number this file can
//     know, and inventing one would be padding absent data with a default.
//   · it skips any class list it cannot read statically, and COUNTS the skip.
//     "0 problems" over an unreported skip pile is false confidence.
//   · it does not judge a design. 4.5:1 is a floor, not a compliment.
//
// Every rule is a NEGATIVE — "is there a pair under the floor" — never "is a
// fix present", for the reason check-mobile-surfaces.mjs gives at length: a
// positive containment rule passes as soon as its string appears anywhere.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let checks = 0;
let failures = 0;
let skipped = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}`);

const TEXT_FLOOR = 4.5;

// ═══════════════════════════════════════════════════════════════════════════
// Colour maths
// ═══════════════════════════════════════════════════════════════════════════

/** oklch -> sRGB hex (Ottosson). Out-of-gamut channels clamp, as a browser's do. */
function oklchToHex(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const enc = (u) => {
    const v = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(Math.max(u, 0), 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  return `#${lin.map((u) => enc(u).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex) {
  const s = hex.replace("#", "");
  const full = s.length === 3 ? [...s].map((c) => c + c).join("") : s.slice(0, 6);
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const r2 = (n) => Math.round(n * 100) / 100;

// ═══════════════════════════════════════════════════════════════════════════
// The palettes, parsed
// ═══════════════════════════════════════════════════════════════════════════

section("The maths and the palette, before anything is measured with them");

// A luminance function with a typo produces plausible numbers and passes every
// assertion below. These are fixed points of the WCAG formula.
ok("contrast maths: black on white is 21:1", r2(contrast("#000000", "#ffffff")) === 21);
ok("contrast maths: a colour against itself is 1:1", r2(contrast("#4d6076", "#4d6076")) === 1);

// And the oklch conversion, which is the part that is easy to get subtly wrong
// — a wrong matrix still yields colours, just not Tailwind's.
//
// ── Why these are CHROMATIC, and the grey ones are not enough ─────────────
//
// The first version asserted only L=1/L=0 at C=0. At zero chroma a and b are
// zero, so l_ = m_ = s_ = L and every matrix row is applied to the same
// number; the rows sum to 1 for greys, so a corrupted coefficient still
// returns exact white and exact black. Mutation-tested and MISSED: perturbing
// the red row's blue coefficient by 0.01 changed nothing this file asserted,
// and every ratio downstream would have been measured with a broken
// instrument while the run stayed green.
//
// The three below are the sRGB primaries expressed in oklch. They are
// properties of the two colour spaces, not of Tailwind, so they cannot rot
// when the palette is upgraded — and each one drives a different channel to
// its limit, which is what makes a wrong coefficient show up.
const PRIMARIES = [
  ["red", 0.62796, 0.25768, 29.234, "#ff0000"],
  ["green", 0.86644, 0.29483, 142.495, "#00ff00"],
  ["blue", 0.45201, 0.31321, 264.052, "#0000ff"],
];
for (const [name, L, C, h, expected] of PRIMARIES) {
  const got = oklchToHex(L, C, h);
  // ±1 per channel: the published oklch coordinates are rounded to 5 places.
  const near = [1, 3, 5].every(
    (i) => Math.abs(parseInt(got.slice(i, i + 2), 16) - parseInt(expected.slice(i, i + 2), 16)) <= 1,
  );
  ok(`oklch: sRGB ${name} round-trips to ${expected}`, near, `got ${got}`);
}
ok("oklch: L=1 C=0 is white", oklchToHex(1, 0, 0) === "#ffffff");
ok("oklch: L=0 C=0 is black", oklchToHex(0, 0, 0) === "#000000");

const PALETTE = new Map();
{
  const css = read("node_modules/tailwindcss/theme.css");
  for (const m of css.matchAll(/--color-([\w-]+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g)) {
    PALETTE.set(m[1], oklchToHex(Number(m[2]) / 100, Number(m[3]), Number(m[4])));
  }
  PALETTE.set("white", "#ffffff");
  PALETTE.set("black", "#000000");
}
// A regex that matched nothing would make every rule below pass on an empty
// palette — the failure mode this repo has been bitten by four times.
ok("Tailwind's palette parsed", PALETTE.size > 100, `${PALETTE.size} colours`);
ok(
  "…and it is v4's oklch palette, not the v3 hexes from memory",
  PALETTE.get("amber-700") === "#bb4d00",
  `amber-700 = ${PALETTE.get("amber-700")}`,
);

/** `--token: #hex;` pairs inside one brace-matched block of globals.css. */
function cssTokens(css, selector) {
  const at = css.search(new RegExp(`(^|\\n)\\s*${selector}\\s*\\{`));
  if (at === -1) return new Map();
  const open = css.indexOf("{", at);
  let d = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") d++;
    else if (css[i] === "}" && --d === 0) {
      end = i;
      break;
    }
  }
  const out = new Map();
  for (const m of css.slice(open, end).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

const THEME_CSS = read("app/globals.css");
const LIGHT = cssTokens(THEME_CSS, ":root");
const DARK = new Map([...LIGHT, ...cssTokens(THEME_CSS, "\\.dark")]);
ok("globals.css light tokens parsed", LIGHT.size > 10, `${LIGHT.size} tokens`);
ok("globals.css dark tokens parsed", DARK.size > 10, `${DARK.size} tokens`);

/** The hex a `bg-*` / `text-*` class resolves to in one theme, or null. */
function hexFor(cls, theme) {
  const name = cls.replace(/^(?:bg|text)-/, "");
  const tokens = theme === "dark" ? DARK : LIGHT;
  return tokens.get(name) ?? PALETTE.get(name) ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Reading class lists
// ═══════════════════════════════════════════════════════════════════════════

const SURFACES = ["app/platform", "app/components/platform"];

function walk(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const name of fs.readdirSync(full)) {
    if (name.startsWith(".")) continue;
    const child = path.join(full, name);
    if (fs.statSync(child).isDirectory()) walk(path.relative(ROOT, child), out);
    else if (name.endsWith(".js") || name.endsWith(".jsx")) out.push(path.relative(ROOT, child));
  }
  return out;
}

/**
 * Comments removed. They quote the ratios and the classes they replaced, on
 * purpose — the measurement belongs next to the fix — so a grep that read them
 * would fail on its own explanations.
 *
 * ── Why TRAILING comments have to go too, found by mutation ───────────────
 *
 * The first version anchored on start-of-line and stripped whole-line comments
 * only. That is not where a comment about a class list ends up — this repo
 * writes them like:
 *
 *     isChurned
 *       ? // emerald-600 is 3.65:1 under white
 *         "bg-emerald-700 text-white"
 *
 * — the `?` and the `//` share a line, so the line survived, and the ternary
 * matcher below (which needs a quote straight after `?`) stopped matching.
 * The branch was then never read AT ALL and the element passed silently.
 * Mutation-tested: putting `bg-emerald-600 text-white` back was MISSED by the
 * first version and is caught by this one. A check defeated by its own
 * subject's comments is the false-pass this repo has paid for four times.
 *
 * `[^:]` before the `//` keeps `https://` intact, which is the one thing a
 * naive trailing-comment strip reliably destroys.
 *
 * Line comments FIRST: reversed, a block-comment opener sitting inside a `//`
 * line starts a block that swallows the code the greps exist to inspect.
 */
const codeOnly = (src) =>
  src
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * One class list split into the branches that can be on screen AT ONCE.
 *
 * Concatenating every ternary branch is right for a rule that forbids a string
 * and catastrophic for one that PAIRS two: `bg-inverted text-inverted-
 * foreground : text-muted-foreground` is the standard selected/unselected chip
 * and reading it as one list reports a correct screen as broken.
 */
function branches(raw) {
  const stat = raw.replace(/\$\{[\s\S]*?\}/g, " ");
  const terns = [...raw.matchAll(/\?\s*["'`]([^"'`]*)["'`]\s*:\s*["'`]([^"'`]*)["'`]/g)];
  if (terns.length === 0) return [stat];
  return terns.flatMap((m) => [`${stat} ${m[1]}`, `${stat} ${m[2]}`]);
}

/** Utilities with no variant and no alpha — the only ones this file can read. */
const plainOf = (words, kind) =>
  words
    .filter((w) => w.startsWith(`${kind}-`) && !w.includes(":"))
    .filter((w) => !w.includes("/") && !w.includes("["));

/**
 * `dark:bg-x` -> `bg-x`, reported alongside whether anything was DROPPED.
 *
 * ── The fallback that produced four false failures ────────────────────────
 *
 * The first version returned only the readable utilities, so a list carrying
 * `bg-red-50 dark:bg-red-950/40` came back empty for dark — the alpha wash
 * being unmeasurable — and the caller fell back to the LIGHT background,
 * measuring dark text on a light surface that dark mode never renders. Four
 * correct screens failed. An alpha class is not an absent one: it is a
 * declaration this file cannot read, which is a SKIP.
 */
function variantOf(words, prefix, kind) {
  const all = words.filter((w) => w.startsWith(`${prefix}${kind}-`));
  const readable = all
    .map((w) => w.slice(prefix.length))
    .filter((w) => !w.includes("/") && !w.includes("["));
  return { readable, declared: all.length > 0 };
}

/** Tailwind's non-colour `text-*` utilities, which are not foregrounds. */
const NOT_A_COLOUR =
  /^text-(?:xs|sm|base|lg|xl|\d?xl|left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|top|bottom|middle)$/;

const colourTexts = (list) => list.filter((w) => !NOT_A_COLOUR.test(w));

// ═══════════════════════════════════════════════════════════════════════════
// Rule 1 — the resting pair on one element
// ═══════════════════════════════════════════════════════════════════════════

section("Every measurable bg/text pair written on one element, in both themes");

const restViolations = [];
const hoverViolations = [];
const files = SURFACES.flatMap((d) => walk(d));

for (const file of files) {
  const src = codeOnly(read(file));
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{"([^"]*)"\})/g)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    for (const branch of branches(raw)) {
      const words = branch.split(/\s+/).filter(Boolean);

      for (const theme of ["light", "dark"]) {
        // ── resting ──────────────────────────────────────────────────────
        {
          const dBg = theme === "dark" ? variantOf(words, "dark:", "bg") : { readable: [], declared: false };
          const dTx = theme === "dark" ? variantOf(words, "dark:", "text") : { readable: [], declared: false };
          // A declared-but-unreadable override wins over the base class and
          // then cannot be measured. Skip; never fall through to the base.
          const bgs = dBg.declared ? dBg.readable : plainOf(words, "bg");
          const texts = colourTexts(dTx.declared ? dTx.readable : plainOf(words, "text"));
          if ((dBg.declared && dBg.readable.length === 0) || (dTx.declared && dTx.readable.length === 0)) {
            if (plainOf(words, "bg").length === 1) skipped++;
          } else if (bgs.length === 1 && texts.length > 0) {
            const bg = hexFor(bgs[0], theme);
            for (const t of texts) {
              const fg = hexFor(t, theme);
              if (!fg || !bg) continue;
              const c = contrast(fg, bg);
              if (c < TEXT_FLOOR) {
                restViolations.push(
                  `${file}: ${t} on ${bgs[0]} is ${r2(c)}:1 in ${theme} (${fg} on ${bg})`,
                );
              }
            }
          }
        }

        // ── hovering ─────────────────────────────────────────────────────
        //
        // The pair a cursor actually produces: the hover fill, under whichever
        // colour is on top at that moment — a hover text colour if one is
        // declared for this theme, otherwise the resting one, which is exactly
        // the case a rule that ignored hover could never see.
        {
          const dHoverBg =
            theme === "dark" ? variantOf(words, "dark:hover:", "bg") : { readable: [], declared: false };
          if (dHoverBg.declared && dHoverBg.readable.length === 0) {
            // A dark hover fill exists and is alpha. Unknowable, and it beats
            // the light one — so this pair is skipped, not measured against a
            // surface dark mode never paints.
            skipped++;
            continue;
          }
          const hoverBgs = dHoverBg.readable.length
            ? dHoverBg.readable
            : variantOf(words, "hover:", "bg").readable;
          if (hoverBgs.length !== 1) continue;
          const bg = hexFor(hoverBgs[0], theme);
          if (!bg) continue;

          // The colour on top when the cursor is there: the most specific
          // declaration that applies in THIS theme, in order.
          const ladder =
            theme === "dark"
              ? [
                  variantOf(words, "dark:hover:", "text").readable,
                  variantOf(words, "hover:", "text").readable,
                  variantOf(words, "dark:", "text").readable,
                  plainOf(words, "text"),
                ]
              : [variantOf(words, "hover:", "text").readable, plainOf(words, "text")];
          const texts = colourTexts(ladder.find((l) => colourTexts(l).length > 0) || []);
          for (const t of texts) {
            const fg = hexFor(t, theme);
            if (!fg) continue;
            const c = contrast(fg, bg);
            if (c < TEXT_FLOOR) {
              hoverViolations.push(
                `${file}: on hover, ${t} over ${hoverBgs[0]} is ${r2(c)}:1 in ${theme} (${fg} on ${bg})`,
              );
            }
          }
        }
      }
    }
  }
  // A class list assembled at run time is unreadable here. Counted, not passed.
  for (const m of src.matchAll(/className=\{([^}"'`]*)\}/g)) {
    if (/[A-Za-z_$]/.test(m[1])) skipped++;
  }
}

ok(
  `no resting text/background pair under ${TEXT_FLOOR}:1`,
  restViolations.length === 0,
  [...new Set(restViolations)].slice(0, 6).join(" | "),
);

section("…and the pair a cursor produces, which no other check in this repo looks at");
ok(
  `no hover text/background pair under ${TEXT_FLOOR}:1`,
  hoverViolations.length === 0,
  [...new Set(hoverViolations)].slice(0, 6).join(" | "),
);

// ═══════════════════════════════════════════════════════════════════════════
// Rule 2 — `dark:bg-` where `dark:hover:bg-` was meant
// ═══════════════════════════════════════════════════════════════════════════
//
// Not a contrast rule; a variant-order one, and it is why the two screens above
// were broken in a way no ratio could describe.
//
// app/globals.css defines dark as `@custom-variant dark (&:is(.dark *))`, so
// `.dark\:bg-x:is(.dark *)` and `.hover\:bg-y:hover` both have specificity
// (0,2,0), and Tailwind emits the dark rule LAST. A `dark:bg-` sitting beside a
// `hover:bg-` therefore wins in dark mode permanently: the hover does nothing,
// and the control's resting appearance differs between the two themes. On a
// DESTRUCTIVE button — which is where both instances were — the dark theme
// showed it pre-armed.
//
// Scoped to class lists that carry a `hover:bg-` too. A `dark:bg-` on its own
// is the ordinary way to write a dark background and is not a fault.

section("A dark background that silently overrides the hover beside it");

const variantSlips = [];
for (const file of files) {
  const src = codeOnly(read(file));
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{"([^"]*)"\})/g)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    for (const branch of branches(raw)) {
      const words = branch.split(/\s+/).filter(Boolean);
      const hoverBg = words.filter((w) => w.startsWith("hover:bg-"));
      const darkBg = words.filter((w) => w.startsWith("dark:bg-"));
      if (hoverBg.length > 0 && darkBg.length > 0) {
        variantSlips.push(`${file}: ${darkBg.join(" ")} beside ${hoverBg.join(" ")}`);
      }
    }
  }
}
ok(
  "no dark:bg-* shares a class list with a hover:bg-*",
  variantSlips.length === 0,
  [...new Set(variantSlips)].slice(0, 6).join(" | ") +
    (variantSlips.length ? "  — dark: is emitted after hover: at equal specificity, so the hover never fires in dark mode. Write dark:hover:bg-*." : ""),
);

// ═══════════════════════════════════════════════════════════════════════════
// Rule 3 — a hover that repaints a control the colour it already is
// ═══════════════════════════════════════════════════════════════════════════
//
// check-platform-console.mjs forbids this on the rail, where it was found
// (`text-muted-foreground hover:text-muted-foreground` — a hover that changed
// nothing). Stated for the whole console here, because the next copy-paste
// will pick a different token and land on a different screen.

section("A hover that changes nothing");

const deadHovers = [];
for (const file of files) {
  const src = codeOnly(read(file));
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{"([^"]*)"\})/g)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? "";
    for (const branch of branches(raw)) {
      const words = new Set(branch.split(/\s+/).filter(Boolean));
      for (const w of words) {
        if (!w.startsWith("hover:")) continue;
        if (words.has(w.slice(6))) deadHovers.push(`${file}: ${w} on an element already ${w.slice(6)}`);
      }
    }
  }
}
ok("no hover: repaints a value the element already has", deadHovers.length === 0,
  [...new Set(deadHovers)].slice(0, 6).join(" | "));

console.log(
  `\n${files.length} files read · ${skipped} class list${skipped === 1 ? "" : "s"} could not be read statically and were SKIPPED, not passed`,
);
console.log(`${checks} checks, ${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
