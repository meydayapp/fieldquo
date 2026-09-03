// scripts/check-mobile-surfaces.mjs
//
//   npm run check:mobile
//
// The regression guard for the owner's second standing rule: the superadmin
// console AND the sales rep view have to work on a phone. A rep checks their
// queue in a van; a screen that needs a laptop adds the administrative
// overhead the portal exists to remove.
//
// ══ THE SCOPE WAS A LIE, AND THIS IS THE CORRECTION ══════════════════════
//
// Until 2026-09-02 this walked app/platform, app/sales and app/app/clock, and
// was described to the owner as covering "the app surfaces". It did not. Every
// screen a contractor opens all day — jobs, the schedule, quotes, invoices,
// clients, settings — was unchecked, which is the worse failure of the two:
// the rep view matters most, but the crew member standing in a driveway is on
// app/app. app/app is now walked in full.
//
// It still does not walk app/components/**. Roughly a third of the /app UI
// lives there (the drawers, the uploaders, the shared panels) and none of it
// is checked. That is a REAL remaining gap, named here rather than left for
// somebody to discover the way this one was.
//
// ══ WHAT THIS PROVES, AND WHAT IT CANNOT ═════════════════════════════════
//
// Read this before trusting it. It is a hazard detector, not a usability
// test. It proves the ABSENCE of seven specific, mechanically detectable
// mistakes. It cannot prove:
//
//   * that a layout is usable, readable, or reachable one-handed;
//   * that anything actually fits at 375px — that needs a browser, a font, and
//     a rendered box, none of which exist here;
//   * that text contrasts IN GENERAL. One narrow colour rule lives here (a
//     theme-flipping text token parked on a fixed surface — see the section
//     at the bottom) because it is the same shape as the rest: a mechanical
//     mismatch, measured, not a judgement about a design;
//   * that a control is reachable at all — a page can pass every rule below
//     and still be a wall of unlabelled icons;
//   * that a colour pair INHERITED across elements is readable — the colour
//     rule below reads one element at a time and says so;
//   * anything about a class name assembled at run time from a value this
//     script cannot see. Those are COUNTED and reported, never silently
//     passed, because "0 problems" over an unreported skip pile is the false
//     confidence a check like this is most likely to produce.
//
// A green run means: no fixed-width container, no unscrollable table, no
// nowrap outside a scroll container, nothing defeating the iOS 16px input
// rule, no sub-36px touch target, no fixed-height modal, and no text token
// measured under 4.5:1 on the fixed surface it was written onto. That is worth
// having and it is not "mobile friendly".
//
// ══ Two tiers, and why the strict one is a short list ════════════════════
//
// BASELINE runs over every platform and sales screen and carries only the
// rules the repo already satisfies today — measured, not assumed. Its job is
// to stop the NEXT screen regressing.
//
// STRICT adds the two rules existing screens do not universally meet (touch
// targets, nowrap). New screens go in the strict list; the honest way to widen
// it is to fix a file and move it, not to weaken a rule.
//
// KNOWN_GAPS records the files that fail a baseline rule today, with the
// actual violation named. A stale entry — one whose file no longer fails —
// is REPORTED and does not fail the run, deliberately: those files belong to
// other people, and a check that breaks somebody else's build the moment they
// fix something teaches them to delete the check.
//
// ══ Every rule is a NEGATIVE, on purpose ═════════════════════════════════
//
// Each rule below asks "does this file contain a hazard", never "does this
// file contain a fix". A positive containment rule passes as soon as the
// string appears ANYWHERE in the file, which has produced a false pass four
// times in this project. The one place a positive assertion is unavoidable —
// the iOS rule in app/globals.css — is scoped by BRACE MATCHING to the single
// `@media` block that carries it, which is the CSS analogue of the
// one-named-function scoping the source checks use.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
const warnings = [];
let skipped = 0;

function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    return true;
  }
  failures.push(`${name}${detail ? `  ${detail}` : ""}`);
  console.log(`  ✗ ${name}${detail ? `  ${detail}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);

// ═══════════════════════════════════════════════════════════════════════════
// The surfaces, as data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Directories to walk, and which tier each is held to.
 *
 * Adding a path here is the whole extension mechanism — no rule needs
 * touching to cover a new surface.
 */
const SURFACES = [
  // The superadmin console. Baseline: it is 30 screens written before this
  // check existed.
  { dir: "app/platform", tier: "baseline" },
  // The sales rep view. The standing rule calls this the one that matters
  // most — a rep reads it on a phone — and it is small and new enough to hold
  // to baseline today.
  { dir: "app/sales", tier: "baseline" },
  // The time clock. Not a console screen at all — it is the one page an hourly
  // worker opens on their own phone, standing in a driveway, and it gained a
  // job picker. Held to STRICT from the day it did: a screen written mobile
  // first has no excuse for a gap list, and the honest way to widen this check
  // is to add screens that pass it rather than to soften a rule.
  { dir: "app/app/clock", tier: "strict" },
  // The contractor's back office — 139 files, the ones a crew opens forty
  // times a day. Baseline for the whole tree, because holding 139 pre-existing
  // screens to strict would have produced ~90 failures on day one and the rule
  // would have been switched off by Friday. The phone-critical screens are
  // named in STRICT_FILES below, each one FIXED first rather than exempted.
  { dir: "app/app", tier: "baseline" },
  // The mobile primitives themselves. Three files, written for a phone, and
  // they pass strict as written — so they go in strict, not on a gap list.
  { dir: "app/components/mobile", tier: "strict" },
  // The chrome every /app screen carries: the rail, the mobile tab bar, the
  // banners. Baseline — MobileTabBar's tab buttons put min-h-[44px] on the
  // inner <span> that draws the pill rather than on the <button>, which the
  // touch-target rule cannot see because it reads one tag. Failing a bar that
  // is genuinely 44px tall would be the false failure that gets a check
  // deleted. Everything else here is held.
  { dir: "app/components/layout", tier: "baseline" },
];

/** Files held to every rule. New screens are added here, not to a gap list. */
const STRICT_FILES = [
  "app/platform/sales/rules/page.js",
  "app/platform/sales/confidence/page.js",
  "app/platform/sales/signatures/page.js",
  "app/platform/sales/campaigns/page.js",
  "app/platform/sales/campaigns/[id]/page.js",
  // Rewritten from a six-column table into a card per rep on the day it gained
  // a signup link, a work mailbox and a sending verdict — six columns of that
  // is a horizontal scroll on every phone. Held to strict from that rewrite:
  // the honest way to widen this check is to fix a file and move it.
  "app/platform/sales/reps/page.js",
  "app/platform/sales/performance/page.js",
  // The two screens the sales-intelligence pipeline was missing. Written
  // mobile-first — a rep reads the queue in a driveway, on a phone — so they go
  // straight into the strict list rather than into a gap list.
  "app/platform/sales/prospects/page.js",
  "app/sales/queue/page.js",
  "app/app/clock/page.js",

  // ── The contractor's phone, ranked ──────────────────────────────────────
  //
  // Not every /app screen — the ones somebody opens standing up. The order a
  // crew actually uses: find the job, read the job, look at the week, check
  // the quote, check the invoice, look up the client. A settings screen a
  // bookkeeper opens once a year on a laptop is NOT the same priority and is
  // deliberately left at baseline; pretending otherwise would have meant ~90
  // failures and a switched-off rule.
  //
  // Five of these needed a fix before they could be listed (a 32px filter
  // chip, a nowrap pill, an 18px close button, two underline buttons, two
  // invoice pills). The rest already passed — measured, not assumed.
  "app/app/jobs/page.js",
  "app/app/jobs/[id]/page.js",
  "app/app/jobs/[id]/JobDetail.js",
  "app/app/jobs/[id]/PaymentScheduleCard.js",
  "app/app/jobs/[id]/edit/page.js",
  "app/app/jobs/[id]/visits/new/page.js",
  "app/app/schedule/page.js",
  "app/app/quotes/page.js",
  "app/app/quotes/new/page.js",
  "app/app/quotes/[id]/page.js",
  "app/app/quotes/[id]/edit/page.js",
  "app/app/invoices/page.js",
  "app/app/invoices/[id]/page.js",
  "app/app/clients/page.js",
  "app/app/clients/new/page.js",
  "app/app/clients/[id]/page.js",
  // app/app/layout.js — the shell all of the above render inside — passes
  // strict today and is deliberately NOT listed. It is being rewritten by
  // another agent as this lands (122 lines changed while this file was being
  // written), and holding a file under active edit to a stricter tier than its
  // neighbours breaks somebody else's build for a rule they never opted into.
  // It stays covered at baseline like the rest of app/app. Promote it once the
  // shell settles — it needs no fix, only a quieter moment.
  "app/components/mobile/AppBar.js",
  "app/components/mobile/BottomSheet.js",
  "app/components/mobile/TouchFeedback.js",
];

/**
 * Files that fail a baseline rule today, with the violation named.
 *
 * Each entry is a fact about the repo on the day it was written, not a
 * permanent exemption. A stale one is reported as a warning rather than a
 * failure — see the header.
 */
const KNOWN_GAPS = [];

/** A container this wide cannot fit a 375px phone with any padding at all. */
const FIXED_WIDTH_LIMIT = 360;

/** Anything shorter than this is a target a thumb misses. Not 44 — see below. */
const MIN_TOUCH_PX = 36;

/**
 * 36, not Apple's 44.
 *
 * The house button style in this console is `px-4 py-2.5` — 10px of padding
 * around a 20px line box, so 40px — and `py-2` rows come out at 36. Setting
 * the floor at 44 would fail the majority of existing buttons and the rule
 * would be turned off within a week. 36 is the number that separates "a
 * deliberately sized control" from "a bare text node somebody bound onClick
 * to", which is the failure worth catching. New screens use 44 anyway.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Source helpers
// ═══════════════════════════════════════════════════════════════════════════

function walk(dir, out = []) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const name of readdirSync(full)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const child = join(full, name);
    if (statSync(child).isDirectory()) walk(relative(ROOT, child), out);
    else if (name.endsWith(".js") || name.endsWith(".jsx")) out.push(relative(ROOT, child));
  }
  return out;
}

/** Comments stripped: a hazard named in a comment is not a hazard. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The opening tag starting at `i`, ending at the `>` that closes it.
 *
 * Brace- and quote-aware: `className={cond ? "a" : "b"}` and `size={13}` both
 * contain characters that a naive `indexOf(">")` stops on, and a truncated tag
 * would make every class-based rule read half a tag.
 */
function openingTag(src, i) {
  let braces = 0;
  let quote = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === quote && src[j - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "{") braces++;
    else if (c === "}") braces--;
    else if (c === ">" && braces === 0) return src.slice(i, j + 1);
  }
  return null;
}

/** Every `const NAME = "..."` string at the top of a file, for `${NAME}` in a class. */
function stringConstants(src) {
  const out = new Map();
  const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*((?:"[^"]*"|'[^']*'|`[^`${}]*`)(?:\s*\+\s*(?:"[^"]*"|'[^']*'|`[^`${}]*`))*)\s*;/g;
  for (const m of src.matchAll(re)) {
    const literal = m[2]
      .split("+")
      .map((part) => part.trim().replace(/^["'`]|["'`]$/g, ""))
      .join("");
    out.set(m[1], literal);
  }
  return out;
}

/**
 * The class text of one tag, with `${CONST}` resolved.
 *
 * Returns null when the class cannot be read statically — a variable, a
 * function call, a prop. Null is COUNTED as a skip by every caller rather than
 * treated as a pass.
 */
function classText(tag, consts) {
  const m = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\}|\{([^}]*)\})/);
  if (!m) return "";
  const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
  if (m[4] != null && !/["'`]/.test(m[4])) return null; // a bare identifier or call
  let text = raw;
  // `${BTN}` and any string literals inside a ternary — every branch is
  // concatenated, so a rule that needs a class present must find it in ALL of
  // them, and a rule that forbids one catches it in any.
  text = text.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (_, name) => consts.get(name) ?? "");
  if (m[4] != null) {
    const literals = [...m[4].matchAll(/["'`]([^"'`]*)["'`]/g)].map((x) => x[1]);
    text = literals.join(" ").replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (_, n) => consts.get(n) ?? "");
  }
  return text;
}

/**
 * Is this position inside a horizontally scrolling container?
 *
 * A HEURISTIC and stated as one. It looks back a bounded window for a scroll
 * class and then asks whether we are still inside that element, by counting
 * tags. It cannot see a wrapper that lives in another component, so a table
 * wrapped by its parent reads as unwrapped: a false FAILURE, which is the safe
 * direction, and the reason KNOWN_GAPS exists rather than a looser rule.
 *
 * ── Why counting, and not "has anything closed" ──────────────────────────
 * The first version returned false the moment it saw a `</` after the scroll
 * class. That is wrong for the commonest correct markup there is: a scroll
 * wrapper holding a header row AND a body row as SIBLINGS. The header closes,
 * so everything after it read as outside the wrapper — app/app/settings/team
 * failed on a min-w that is inside its overflow-x-auto and always was.
 * A sibling that opens and closes is BALANCED; only a NET excess of closings
 * means we left the container. Self-closing tags are subtracted because they
 * open and close in one token and would otherwise pad the opening count and
 * hide a real escape.
 */
const SCROLL_CLASS = /overflow-x-auto|overflow-x-scroll|overflow-auto/g;

function insideScrollContainer(src, index, window = 700) {
  const before = src.slice(Math.max(0, index - window), index);
  const m = [...before.matchAll(SCROLL_CLASS)];
  if (m.length === 0) return false;
  const after = before.slice(m[m.length - 1].index);
  const opens = (after.match(/<[A-Za-z]/g) || []).length - (after.match(/\/>/g) || []).length;
  const closes = (after.match(/<\//g) || []).length;
  return closes <= opens;
}

/** The `<table>` this position sits in, if any. */
function enclosingTableIndex(src, index) {
  const before = src.slice(0, index);
  const open = before.lastIndexOf("<table");
  if (open === -1) return -1;
  if (before.slice(open).includes("</table")) return -1;
  return open;
}

function gapFor(file, rule) {
  return KNOWN_GAPS.find((g) => g.file === file && g.rule === rule);
}

// ═══════════════════════════════════════════════════════════════════════════
// Colour: a theme token measured on the surface it was actually written onto
// ═══════════════════════════════════════════════════════════════════════════
//
// ── Why a colour rule lives in a mobile check ────────────────────────────
// It doesn't, really — it lives here because it is the same SHAPE as the
// other rules: a mechanical mismatch between two strings in one class list,
// decidable without rendering anything. The platform sidebar audit found
// `text-muted-foreground` on a hardcoded dark background at 2.72:1, and no
// mobile rule would ever have caught it. check-sidebar.mjs proves the sidebar
// PALETTE; nothing proved that a screen used it correctly.
//
// ── What it does, and the two things it deliberately will not do ─────────
// For one element carrying both a background class and a text class, it looks
// both colours up in app/globals.css — PARSED, never hardcoded here, so a
// palette edit re-measures instead of going stale — and computes WCAG
// contrast in the LIGHT theme and again in the DARK one. Under 4.5:1 in
// either is a failure.
//
//   1. It ignores `hover:` / `focus:` / `active:` variants entirely. A hover
//      fill almost always comes with its own hover text colour, and pairing a
//      hover background against the BASE text is how this rule would produce
//      its first false failure. app/components/layout/SettingsSidebar.js is
//      exactly that case: text-muted-foreground on hover:bg-sidebar-panel-
//      accent is 4.16:1 in light, but hover:text-foreground lands on it, at
//      11.25:1. Measuring the wrong pair there would have been a bug.
//   2. It skips any class with an opacity modifier (`bg-sidebar/80`). What a
//      65%-alpha bar over a backdrop-blur actually composites to is not a
//      number this file can know, and inventing one would be padding absent
//      data with a default.
//
// Both are COUNTED as skips, like every other thing this script cannot read.
//
// ── And the limit that matters most ──────────────────────────────────────
// It only sees a pair written on ONE element. Colour inherits; the rail sets
// bg-sidebar on the <aside> and text-sidebar-muted-foreground four levels
// down, and this rule cannot connect them — mutation-tested and confirmed:
// wrecking --sidebar-muted-foreground does NOT fail this run, while wrecking
// --sidebar-foreground (which IS written same-element) does. So it catches
// the mistake at the point somebody TYPES both classes together, which is
// where the platform sidebar bug was typed, and it does not audit a palette.
// check-sidebar.mjs is what proves the sidebar ladder itself.

/** `--token: #hex;` pairs inside one CSS block. */
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

function relativeLuminance(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const THEME_CSS = readFileSync(join(ROOT, "app/globals.css"), "utf8");
const LIGHT_TOKENS = cssTokens(THEME_CSS, ":root");
const DARK_TOKENS = new Map([...LIGHT_TOKENS, ...cssTokens(THEME_CSS, "\\.dark")]);

/**
 * Backgrounds worth measuring: the ones a text token can be WRONG on.
 *
 * Every entry is a token defined in globals.css, plus plain black. Tailwind
 * palette classes (bg-neutral-900 and friends) are not here because app/app
 * uses none opaquely today — every `bg-black` in the tree is a `/40` modal
 * scrim, which rule 2 above skips anyway. If one appears, it will show up as
 * an UNMEASURED background in the run summary rather than passing silently.
 */
const MEASURED_BACKGROUNDS = new Map([
  ["bg-sidebar", "sidebar"],
  ["bg-sidebar-accent", "sidebar-accent"],
  ["bg-sidebar-primary", "sidebar-primary"],
  ["bg-sidebar-panel-accent", "sidebar-panel-accent"],
  ["bg-inverted", "inverted"],
  ["bg-card", "card"],
  ["bg-popover", "popover"],
  ["bg-muted", "muted"],
  ["bg-accent", "accent"],
  ["bg-secondary", "secondary"],
  ["bg-background", "background"],
]);

const MEASURED_TEXT = new Map([
  ["text-foreground", "foreground"],
  ["text-muted-foreground", "muted-foreground"],
  ["text-card-foreground", "card-foreground"],
  ["text-popover-foreground", "popover-foreground"],
  ["text-secondary-foreground", "secondary-foreground"],
  ["text-accent-foreground", "accent-foreground"],
  ["text-inverted-foreground", "inverted-foreground"],
  ["text-sidebar-foreground", "sidebar-foreground"],
  ["text-sidebar-muted-foreground", "sidebar-muted-foreground"],
  ["text-sidebar-accent-foreground", "sidebar-accent-foreground"],
  ["text-sidebar-primary-foreground", "sidebar-primary-foreground"],
  ["text-primary", "primary"],
  ["text-destructive", "destructive"],
  ["text-brand-accent-text", "brand-accent-text"],
]);

const CONTRAST_FLOOR = 4.5;

/**
 * One class list split into the branches that can actually be on screen AT
 * ONCE.
 *
 * classText() concatenates every ternary branch, which is right for a rule
 * that forbids a string anywhere and CATASTROPHIC for one that pairs two
 * strings: `bg-inverted text-inverted-foreground : text-muted-foreground` is
 * the standard selected/unselected chip in this repo, and reading it as one
 * list would report muted-foreground on inverted (1.88:1) on a dozen screens
 * that are correct. So each `cond ? "A" : "B"` contributes the static text
 * plus A, and the static text plus B, as SEPARATE lists.
 */
function classBranches(raw, consts) {
  const resolve = (s) => s.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (_, n) => consts.get(n) ?? "");
  const ternaries = [...raw.matchAll(/\?\s*["'`]([^"'`]*)["'`]\s*:\s*["'`]([^"'`]*)["'`]/g)];
  // The text outside every `${...}` — the classes that are always present.
  const stat = resolve(raw.replace(/\$\{[\s\S]*?\}/g, " "));
  if (ternaries.length === 0) return [stat];
  return ternaries.flatMap((m) => [`${stat} ${resolve(m[1])}`, `${stat} ${resolve(m[2])}`]);
}

/**
 * Opaque backgrounds carrying a theme text token that this file has no hex
 * for — a Tailwind palette class, an arbitrary hex, anything new. Reported by
 * name at the end of the run. Silence over an unmeasured pair is exactly the
 * false confidence the header warns about.
 */
const unmeasuredBackgrounds = new Set();

/** The measurable bg/text pair on one element, ignoring state variants. */
function contrastViolations(classList) {
  const words = classList.split(/\s+/).filter(Boolean);
  // Rule 1: a state variant is a different pair; rule 2: alpha is unknowable.
  const plain = words.filter((w) => !w.includes(":") && !w.includes("/"));
  const bgs = plain.filter((w) => MEASURED_BACKGROUNDS.has(w));
  const texts = plain.filter((w) => MEASURED_TEXT.has(w));
  if (texts.length > 0 && bgs.length === 0) {
    for (const w of plain) {
      if (/^bg-(?:\[|[a-z]+-\d{2,3}$|black$|white$)/.test(w)) unmeasuredBackgrounds.add(w);
    }
  }
  if (bgs.length !== 1 || texts.length === 0) return [];
  const bgToken = MEASURED_BACKGROUNDS.get(bgs[0]);
  const bad = [];
  for (const textClass of texts) {
    const fgToken = MEASURED_TEXT.get(textClass);
    for (const [theme, table] of [
      ["light", LIGHT_TOKENS],
      ["dark", DARK_TOKENS],
    ]) {
      const fg = table.get(fgToken);
      const bg = table.get(bgToken);
      if (!fg || !bg) continue;
      const r = contrast(fg, bg);
      if (r < CONTRAST_FLOOR) {
        bad.push(
          `${textClass} on ${bgs[0]} is ${r.toFixed(2)}:1 in ${theme} ` +
            `(${fg} on ${bg}) — under ${CONTRAST_FLOOR}:1`,
        );
      }
    }
  }
  return bad;
}

// ═══════════════════════════════════════════════════════════════════════════
// The rules, as data
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Each rule returns a list of violation strings for one file.
 *
 * `tier: "baseline"` runs everywhere; `tier: "strict"` runs on STRICT_FILES.
 */
const RULES = [
  {
    id: "fixed-width",
    tier: "baseline",
    title: "no container wider than a phone",
    run(src) {
      const bad = [];
      for (const m of src.matchAll(/\b(?:sm:|md:|lg:|xl:)?(w|min-w)-\[(\d+)px\]/g)) {
        const [text, prop, px] = [m[0], m[1], Number(m[2])];
        // A breakpoint-prefixed width only applies above that breakpoint, so
        // it cannot break a 375px screen.
        if (/^(sm|md|lg|xl):/.test(text)) continue;
        if (px < FIXED_WIDTH_LIMIT) continue;
        // `min-w` on a table is the correct pattern INSIDE a scroll container —
        // it is what stops columns collapsing while the wrapper scrolls.
        if (prop === "min-w" && insideScrollContainer(src, m.index)) continue;
        bad.push(`${text} — ${px}px will not fit a 375px screen`);
      }
      return bad;
    },
  },

  {
    id: "table-scroll",
    tier: "baseline",
    title: "every table scrolls inside its own wrapper",
    run(src) {
      const bad = [];
      for (const m of src.matchAll(/<table\b/g)) {
        if (!insideScrollContainer(src, m.index)) {
          bad.push("a <table> with no overflow-x-auto wrapper — the BODY will scroll sideways");
        }
      }
      return bad;
    },
  },

  {
    id: "nowrap-outside-scroll",
    tier: "strict",
    title: "nothing refuses to wrap outside a scroll container",
    run(src) {
      const bad = [];
      for (const m of src.matchAll(/whitespace-nowrap/g)) {
        const table = enclosingTableIndex(src, m.index);
        const scrolls =
          table >= 0 ? insideScrollContainer(src, table) : insideScrollContainer(src, m.index, 1500);
        if (!scrolls) {
          bad.push("whitespace-nowrap with no scrolling ancestor — long text pushes the page wide");
        }
      }
      return bad;
    },
  },

  {
    id: "input-font-size",
    tier: "baseline",
    title: "nothing defeats the iOS 16px input rule",
    run(src, { consts, skip }) {
      const bad = [];
      for (const tagName of ["input", "select", "textarea"]) {
        const re = new RegExp(`<${tagName}\\b`, "g");
        for (const m of src.matchAll(re)) {
          const tag = openingTag(src, m.index);
          if (!tag) continue;
          // Tailwind's important modifier, either spelling, beats an unlayered
          // rule and puts Safari's auto-zoom back. Checked against the
          // RESOLVED class text, not the raw tag: these screens keep the shared
          // field classes in a `const`, and a rule that only read the tag would
          // miss the one edit that changes every input at once.
          const cls = classText(tag, consts);
          if (cls === null) skip();
          const bang = (cls ?? tag).match(
            /(!text-(?:xs|sm)|text-(?:xs|sm)!|!text-\[\d+px\]|text-\[\d+px\]!)/,
          );
          if (bang) bad.push(`<${tagName}> carries ${bang[1]}, which overrides the 16px rule`);
          const inline = tag.match(/fontSize:\s*["']?(\d+)(?:px)?["']?/);
          if (inline && Number(inline[1]) < 16) {
            bad.push(`<${tagName}> sets fontSize ${inline[1]} inline, under the 16px floor`);
          }
        }
      }
      return bad;
    },
  },

  {
    id: "touch-target",
    tier: "strict",
    title: "no touch target under 36px",
    run(src, { consts, skip }) {
      const bad = [];
      for (const m of src.matchAll(/<button\b/g)) {
        const tag = openingTag(src, m.index);
        if (!tag) continue;
        const cls = classText(tag, consts);
        if (cls === null) {
          skip();
          continue;
        }
        if (!meetsTouchFloor(cls)) {
          bad.push(
            `a <button> with no height floor (${cls.trim().slice(0, 70) || "no className"}) — ` +
              `give it min-h-[44px], or py-2 at least`,
          );
        }
      }
      return bad;
    },
  },

  {
    id: "modal-height",
    tier: "baseline",
    title: "no dialog trapped at a fixed height",
    run(src) {
      const bad = [];
      // `(?<![\w-])h-` and not `min-h-`/`max-h-`: `\bh-\[` matched the tail of
      // BOTH of those, because a word boundary sits between `-` and `h`. It
      // flagged `min-h-[380px]` — a floor that content grows past, cutting off
      // nothing — and it would have flagged `max-h-[400px]`, which is the very
      // remedy the message below recommends. A rule that fails its own fix
      // teaches people to delete the rule.
      for (const m of src.matchAll(/(?<![\w-])h-\[(\d+)px\]/g)) {
        if (Number(m[1]) >= 300) {
          bad.push(`h-[${m[1]}px] — a short screen cannot reach what this cuts off; use max-h-[…vh]`);
        }
      }
      // A full-screen overlay that also fixes its own height, in the SAME
      // class list, with nothing to scroll: the content below the fold is
      // unreachable. Scoped to one element rather than to the file, so a
      // scroll container elsewhere cannot manufacture a pass.
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        const cls = m[1] ?? m[2] ?? "";
        if (!/\bfixed\b/.test(cls) || !/\binset-0\b/.test(cls)) continue;
        if (/\b(h-screen|h-full)\b/.test(cls) && !/overflow-y-auto|overflow-auto/.test(cls)) {
          bad.push("a fixed inset-0 overlay at full height with nothing to scroll");
        }
      }
      return bad;
    },
  },

  {
    id: "token-on-wrong-surface",
    tier: "baseline",
    title: "no text token measured under 4.5:1 on its own background",
    run(src, { consts, skip }) {
      const bad = [];
      // Every className in the file, not just the ones on a known tag: the
      // pairing can sit on any element, and the tag name is irrelevant to it.
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([\s\S]*?)`\}|\{"([^"]*)"\})/g)) {
        const raw = m[1] ?? m[2] ?? m[3] ?? "";
        for (const branch of classBranches(raw, consts)) bad.push(...contrastViolations(branch));
      }
      // A className built by a helper or held in a variable is unreadable
      // here, exactly as it is for the touch-target rule. Counted, not passed.
      for (const m of src.matchAll(/className=\{([^}"'`]*)\}/g)) {
        if (/[A-Za-z_$]/.test(m[1])) skip();
      }
      return [...new Set(bad)];
    },
  },
];

/** Does this class list give a control a floor of at least MIN_TOUCH_PX? */
function meetsTouchFloor(cls) {
  const arb = cls.match(/\bmin-h-\[(\d+)px\]/);
  if (arb && Number(arb[1]) >= MIN_TOUCH_PX) return true;
  const minH = cls.match(/\bmin-h-(\d+)\b/);
  if (minH && Number(minH[1]) * 4 >= MIN_TOUCH_PX) return true;
  const h = cls.match(/\bh-(\d+)\b/);
  if (h && Number(h[1]) * 4 >= MIN_TOUCH_PX) return true;
  // py-2 is 8px top and bottom around a 20px line box — 36. py-1.5 is 32 and
  // does not count, which is the line this floor is drawing.
  const py = cls.match(/\bp[yb]?-(\d+(?:\.\d+)?)\b/);
  if (py && Number(py[1]) * 4 * 2 + 20 >= MIN_TOUCH_PX) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// The iOS zoom fix, asserted where it lives
// ═══════════════════════════════════════════════════════════════════════════

/**
 * app/globals.css carries an UNLAYERED `@media (max-width: 767px)` rule that
 * forces 16px on inputs. Unlayered is the load-bearing part: per the Cascade
 * Layers spec any rule outside a layer beats every rule inside one, so a
 * plain `input` selector wins over Tailwind's `.text-sm` — which compiles
 * inside `@layer utilities` — without `!important` and without touching
 * twenty form files. Moving it into `@layer base` would look like tidying and
 * would silently restore Safari's auto-zoom on every phone.
 *
 * The block is located and brace-matched, and every assertion is made against
 * THAT SLICE only. A `font-size: 16px` anywhere else in the stylesheet must
 * not be able to satisfy this.
 */
function iosZoomFix() {
  section("The iOS auto-zoom fix in app/globals.css");
  const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");

  const at = css.search(/@media\s*\(\s*max-width:\s*767px\s*\)/);
  if (!ok("the 767px media query still exists", at !== -1)) return;

  // Unlayered: count `@layer <name> {` blocks still open at this point. The
  // one-line form `@layer theme, base, components, utilities;` is a
  // declaration, not a block, and is skipped by requiring the brace.
  let depth = 0;
  let openLayers = 0;
  const layerStarts = [];
  for (let i = 0; i < at; i++) {
    if (css[i] === "{") {
      depth++;
      const before = css.slice(Math.max(0, i - 60), i);
      if (/@layer\s+[\w\s,]*$/.test(before)) {
        openLayers++;
        layerStarts.push(depth);
      }
    } else if (css[i] === "}") {
      if (layerStarts[layerStarts.length - 1] === depth) {
        layerStarts.pop();
        openLayers--;
      }
      depth--;
    }
  }
  ok(
    "…and is OUTSIDE every @layer, which is what makes it beat Tailwind's .text-sm",
    openLayers === 0,
    openLayers ? `nested inside ${openLayers} @layer block(s)` : "",
  );

  const open = css.indexOf("{", at);
  let d = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") d++;
    else if (css[i] === "}" && --d === 0) {
      end = i + 1;
      break;
    }
  }
  if (!ok("…and the block is terminated", end !== -1)) return;
  const block = css.slice(open, end);

  ok("…and still sets 16px", /font-size:\s*16px/.test(block));
  ok("…on input", /\binput\b/.test(block));
  ok("…on select", /\bselect\b/.test(block));
  ok("…on textarea", /\btextarea\b/.test(block));

  // Nothing else unlayered may set a SMALLER size on the same controls. A
  // later rule at the same layer-less weight and equal specificity wins on
  // source order, which is exactly how this fix gets silently undone.
  const others = [];
  for (const m of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1];
    const body = m[2];
    if (m.index >= at && m.index < end) continue;
    if (!/\b(input|select|textarea)\b/.test(selector)) continue;
    const size = body.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
    if (size && Number(size[1]) < 16) others.push(`${selector.trim()} → ${size[1]}px`);
  }
  ok(
    "…and nothing else in the stylesheet sets a smaller font-size on a control",
    others.length === 0,
    others.join("; "),
  );

  // The wrong fix, refused twice: app/layout.js's viewport export must not
  // disable pinch-zoom for everybody to stop one zoom.
  // Comments stripped: app/layout.js's viewport export explains at length why
  // it does NOT set these, and a check that reads the explanation as the
  // violation is the false failure that gets a check deleted.
  const layout = stripComments(readFileSync(join(ROOT, "app/layout.js"), "utf8"));
  ok(
    "…and the viewport does not disable zoom instead",
    !/maximumScale|userScalable|user-scalable|maximum-scale/.test(layout),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Run
// ═══════════════════════════════════════════════════════════════════════════

console.log("Mobile surfaces — hazards that are mechanically detectable\n");
console.log("This proves the ABSENCE of seven specific mistakes. It does not prove");
console.log("a layout is usable at 375px. See the header before quoting it.\n");

iosZoomFix();

const strict = new Set(STRICT_FILES);
const seen = new Set();
let fileCount = 0;

for (const surface of SURFACES) {
  const files = walk(surface.dir);
  section(`${surface.dir} — ${files.length} files (${surface.tier})`);
  for (const file of files) {
    if (seen.has(file)) continue;
    seen.add(file);
    fileCount++;
    const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
    const consts = stringConstants(src);
    const tier = strict.has(file) ? "strict" : surface.tier;

    for (const rule of RULES) {
      if (rule.tier === "strict" && tier !== "strict") continue;
      const violations = rule.run(src, { consts, skip: () => skipped++ });
      const gap = gapFor(file, rule.id);
      if (gap) {
        if (violations.length === 0) {
          warnings.push(
            `KNOWN_GAPS lists ${file} for ${rule.id} and it now passes — remove the entry.`,
          );
        }
        continue;
      }
      // Capped: nine copies of the same sentence buries the other failures.
      const shown = [...new Set(violations)].slice(0, 3);
      const more = violations.length - shown.length;
      ok(
        `${file} — ${rule.title}`,
        violations.length === 0,
        shown.join(" | ") + (more > 0 ? ` (+${more} more)` : ""),
      );
    }
  }
}

section("Strict files are real files");
for (const file of STRICT_FILES) {
  // A strict entry pointing at a renamed file would silently stop checking it.
  ok(`${file} exists`, existsSync(join(ROOT, file)));
  ok(`${file} is inside a scanned surface`, seen.has(file));
}

// ── What is NOT scanned, printed every run ────────────────────────────────
//
// This is the correction to the mistake in the header. The old scope was
// described as "the app surfaces" and covered three directories; nothing in
// the output said otherwise, so nobody could see the difference between "no
// hazards" and "not looked at". These lines exist so that never happens
// again — silently narrowing the walk to keep the run green would now have to
// delete a printed sentence, which is a thing a reviewer can notice.
const NOT_SCANNED = [
  ["app/components/** (except mobile/, layout/)", "~148 files — the drawers, uploaders and shared panels a phone screen renders. The job PHOTO surfaces (JobPhotoCurator/Timeline/Comments) are in here and are as phone-critical as anything in the strict list."],
  ["app/components/jobs/**", "an agent is writing DailyLog* here right now. Adding it mid-write would check a half-file and break somebody else's build."],
  ["app/components/purchasing/**, app/components/fleet/**", "same — being created as this ran."],
  ["(not a gap) app/app/purchasing/**, app/app/fleet/**", "listed only to say they need no listing: app/app is walked as a TREE, so a screen added under it is checked the run after it lands. purchasing/page.js appeared while this was being written and was picked up with no edit here."],
  ["app/quote, app/book, app/portal, app/site, app/embed", "the client-facing surfaces. A homeowner in a driveway on a bad connection is the harder case, and no rule here has ever looked at it."],
];
section("NOT scanned — named, because an unstated gap is how the last one happened");
for (const [where, why] of NOT_SCANNED) console.log(`  · ${where}\n      ${why}`);
if (unmeasuredBackgrounds.size) {
  console.log(
    `  · ${unmeasuredBackgrounds.size} opaque background(s) carrying a theme text token with no hex in this file — ` +
      `NOT measured: ${[...unmeasuredBackgrounds].sort().join(", ")}`,
  );
}

console.log(
  `\n${fileCount} files scanned · ${skipped} class list${skipped === 1 ? "" : "s"} could not be read statically and were SKIPPED, not passed`,
);
for (const w of warnings) console.log(`  ! ${w}`);
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
