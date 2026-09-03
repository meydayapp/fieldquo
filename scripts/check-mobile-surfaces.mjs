// scripts/check-mobile-surfaces.mjs
//
//   npm run check:mobile
//
// The regression guard for the owner's second standing rule: the superadmin
// console AND the sales rep view have to work on a phone. A rep checks their
// queue in a van; a screen that needs a laptop adds the administrative
// overhead the portal exists to remove.
//
// ══ WHAT THIS PROVES, AND WHAT IT CANNOT ═════════════════════════════════
//
// Read this before trusting it. It is a hazard detector, not a usability
// test. It proves the ABSENCE of six specific, mechanically detectable
// mistakes. It cannot prove:
//
//   * that a layout is usable, readable, or reachable one-handed;
//   * that anything actually fits at 375px — that needs a browser, a font, and
//     a rendered box, none of which exist here;
//   * that text contrasts (scripts/check-contrast.mjs does colour, and only
//     for the document theme);
//   * that a control is reachable at all — a page can pass every rule below
//     and still be a wall of unlabelled icons;
//   * anything about a class name assembled at run time from a value this
//     script cannot see. Those are COUNTED and reported, never silently
//     passed, because "0 problems" over an unreported skip pile is the false
//     confidence a check like this is most likely to produce.
//
// A green run means: no fixed-width container, no unscrollable table, no
// nowrap outside a scroll container, nothing defeating the iOS 16px input
// rule, no sub-36px touch target, and no fixed-height modal. That is worth
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
  "app/app/clock/page.js",
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
 * class and then asserts nothing has been CLOSED since — if an element closed
 * between the wrapper and here, we have left it. It cannot see a wrapper that
 * lives in another component, so a table wrapped by its parent reads as
 * unwrapped: a false FAILURE, which is the safe direction, and the reason
 * KNOWN_GAPS exists rather than a looser rule.
 */
const SCROLL_CLASS = /overflow-x-auto|overflow-x-scroll|overflow-auto/g;

function insideScrollContainer(src, index, window = 700) {
  const before = src.slice(Math.max(0, index - window), index);
  const m = [...before.matchAll(SCROLL_CLASS)];
  if (m.length === 0) return false;
  const after = before.slice(m[m.length - 1].index);
  return !after.includes("</");
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
      for (const m of src.matchAll(/\bh-\[(\d+)px\]/g)) {
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
console.log("This proves the ABSENCE of six specific mistakes. It does not prove");
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

console.log(
  `\n${fileCount} files scanned · ${skipped} class list${skipped === 1 ? "" : "s"} could not be read statically and were SKIPPED, not passed`,
);
for (const w of warnings) console.log(`  ! ${w}`);
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
