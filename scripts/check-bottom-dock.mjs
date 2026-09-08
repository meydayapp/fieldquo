// scripts/check-bottom-dock.mjs
//
//   npm run check:dock
//
// The regression guard for the owner's 2026-09-08 complaint: "the 'Chat
// with Jennifer' button typically sits right on top of the Save button."
//
// Everything pinned to the bottom of the /app viewport — the mobile tab bar,
// a page's Save / Send bar, the floating launchers, the error toast — now
// positions itself from two CSS variables (app/globals.css, "bottom dock")
// and one hook (app/hooks/useBottomDock.js). This script proves that nothing
// has quietly gone back to positioning itself from the viewport corner.
//
// ══ WHAT IT PROVES ═══════════════════════════════════════════════════════
//
//   1. Every sticky/fixed bottom element in app/app and app/components is
//      either a registered dock (imports useBottomDock, attaches the ref,
//      sits at bottom: var(--fq-tab-bar-height)) or is on the allow-list
//      below WITH a reason. A new Save bar that does neither fails.
//   2. The launchers and the toast read BOTH variables.
//   3. Jennifer and Help occupy disjoint vertical spans — computed from
//      their class lists, not compared as strings. Two circles that differ
//      by four pixels would pass a string comparison and still overlap.
//   4. The variables are declared where the comments say they are, the
//      /app shell carries the class that sets the tab-bar term, and <main>
//      pads by both.
//   5. The tab bar's row height is written once. The literal
//      `4rem+env(safe-area-inset-bottom)` — which used to be copied into
//      eight class lists — no longer appears in source.
//
// ══ WHAT IT CANNOT ═══════════════════════════════════════════════════════
//
// It reads class strings. It does not render anything, so it cannot see a
// bar whose height the hook measures wrong, a launcher hidden by a modal at
// the wrong z-index, or a class list assembled at run time from a value
// this script cannot read. Those are COUNTED and reported, not passed.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
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
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
// The allow-list — every entry carries the reason it is not a dock
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bottom-pinned elements that are deliberately NOT docks. A match here is a
 * prefix on the repo-relative path, and the reason is printed with every
 * skip so nobody has to open this file to learn why something was excused.
 */
const ALLOWED = [
  {
    path: "app/components/layout/MobileTabBar.js",
    reason: "IS the tab bar — it defines --fq-tab-bar-height rather than reading it",
  },
  {
    path: "app/components/jennifer/JenniferPanel.js",
    reason: "the launcher and the panel; checked below for reading both variables",
  },
  {
    path: "app/components/HelpButton.js",
    reason: "a launcher; checked below for reading both variables and for clearing Jennifer",
  },
  {
    path: "app/components/ErrorToast.js",
    reason: "the toast; checked below for reading both variables",
  },
  {
    path: "app/app/settings/team/page.js",
    reason:
      "a modal footer (sticky bottom-0 inside a z-50 overlay) — the launchers are z-30, so the overlay covers them",
  },
  {
    path: "app/components/designer/",
    reason:
      "the design editor's own bottom tool bar and sheets, mounted inside PhotoAnnotatorEditor's fixed inset-0 z-50 overlay, above the launchers",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The text of a `className={…}` expression: every string and template
 * literal inside it, joined. `cn("fixed …", open && "…")` and
 * `` `fixed … ${open ? "hidden" : "flex"}` `` both resolve to something
 * greppable. Returns null when the expression carries no literal at all
 * (`className={classes}`), which is the one shape nothing here can read.
 */
function literalText(expr) {
  const parts = [];
  for (const m of expr.matchAll(/"([^"\\]*)"|'([^'\\]*)'|`([^`]*)`/g)) {
    parts.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return parts.length ? parts.join(" ") : null;
}

/** The `{…}` starting at `start` (which must be `{`), brace-matched. */
function braced(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start + 1, i);
  }
  return text.slice(start + 1);
}

/**
 * Every element in a file with its OPENING TAG and resolved class text, so a
 * `ref=` can be checked on the same element as its `fixed bottom-…`.
 *
 * `=>` inside an attribute (`onClick={() => …}`) is not the end of the tag;
 * the first version of this scanner stopped there and reported the Jennifer
 * launcher — the one element the whole check exists for — as absent.
 */
function classLists(src) {
  const out = [];
  for (const m of src.matchAll(/<([a-zA-Z][\w.]*)\b((?:=>|[^>])*?)>/gs)) {
    const attrs = m[2];
    const at = attrs.search(/\bclassName=/);
    if (at < 0) continue;
    const valueStart = at + "className=".length;
    let cls;
    if (attrs[valueStart] === '"') {
      cls = attrs.slice(valueStart + 1, attrs.indexOf('"', valueStart + 1));
    } else if (attrs[valueStart] === "{") {
      cls = literalText(braced(attrs, valueStart));
      if (cls === null) {
        // A className held entirely in a variable is unreadable here.
        // Counted, never passed.
        skipped++;
        continue;
      }
    } else {
      continue;
    }
    out.push({ tag: m[1], attrs, cls, index: m.index });
  }
  // A class list kept in a module-level constant and spread onto an element
  // later. Treated as an element of its own so a bar declared that way still
  // has to be a dock; the ref check reads the file rather than the tag.
  for (const m of src.matchAll(/const\s+[A-Z_][A-Z0-9_]*\s*=\s*("([^"\\]*)"|`([^`]*)`)/g)) {
    out.push({ tag: "const", attrs: src, cls: m[2] ?? m[3] ?? "", index: m.index });
  }
  return out;
}

/** Is this class list pinned to the bottom edge of something? */
function isBottomPinned(cls) {
  if (!/\b(fixed|sticky)\b/.test(cls)) return false;
  // bottom-0, bottom-4, bottom-[...], bottom-(...), with or without a
  // breakpoint prefix. inset-0 / inset-x-0 alone do not pin to the bottom;
  // inset-0 is a full-screen overlay and is not a dock.
  return /(?:^|\s)(?:[a-z]+:)?bottom-(?:\d|\[|\()/.test(cls);
}

/** Rem offset of the launcher above the dock: the `+Nrem)` in its calc. */
function launcherGapRem(cls) {
  const m = cls.match(/bottom-\[calc\(var\(--fq-tab-bar-height\)\+var\(--fq-dock-height\)\+([\d.]+)rem\)\]/);
  return m ? Number(m[1]) : null;
}

/** Height in rem from h-N (N × 0.25rem). */
function heightRem(cls) {
  const m = cls.match(/(?:^|\s)h-(\d+(?:\.\d+)?)(?:\s|$)/);
  return m ? Number(m[1]) / 4 : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Every bottom-pinned element is a dock or is excused
// ═══════════════════════════════════════════════════════════════════════════

section("Every sticky/fixed bottom element in app/app and app/components");

const files = [...walk(join(ROOT, "app/app")), ...walk(join(ROOT, "app/components"))];
const docks = [];
const excused = [];

for (const abs of files) {
  const rel = relative(ROOT, abs);
  const src = stripComments(readFileSync(abs, "utf8"));
  const pinned = classLists(src).filter((c) => isBottomPinned(c.cls));
  if (pinned.length === 0) continue;

  const allow = ALLOWED.find((a) => rel.startsWith(a.path));
  if (allow) {
    excused.push(`${rel} — ${allow.reason}`);
    continue;
  }

  const importsHook = /from\s+["']@\/app\/hooks\/useBottomDock["']/.test(src);
  const callsHook = /useBottomDock\(\)/.test(src);
  ok(`${rel} imports useBottomDock`, importsHook, "— a Save bar the launchers cannot see");
  ok(`${rel} calls useBottomDock()`, callsHook);

  for (const el of pinned) {
    const line = src.slice(0, el.index).split("\n").length;
    const where = `${rel}:${line}`;
    ok(
      `${where} sits at bottom: var(--fq-tab-bar-height)`,
      /(?:^|\s)bottom-\[var\(--fq-tab-bar-height\)\]/.test(el.cls),
      `— found: ${el.cls.match(/(?:[a-z]+:)?bottom-\S+/g)?.join(" ")}`,
    );
    ok(`${where} attaches the dock ref`, /\bref=\{dockRef\}/.test(el.attrs));
    // A bar has to have a solid background: the hook only lifts things
    // ABOVE the bar, so the page still scrolls beneath it.
    ok(`${where} has a background`, /\bbg-card\b/.test(el.cls));
    docks.push(where);
  }
}

console.log(`  ${docks.length} dock(s): ${docks.join(", ")}`);
for (const e of excused) console.log(`  · excused: ${e}`);
ok("at least the four known docks are registered", docks.length >= 4, `— found ${docks.length}`);

// The allow-list must not rot: an entry whose file has no bottom-pinned
// element any more is reported. It does not fail the run — those files
// belong to other people — but it must not be silent.
for (const a of ALLOWED) {
  const hit = excused.some((e) => e.startsWith(a.path));
  if (!hit) console.log(`  · stale allow-list entry (nothing pinned there now): ${a.path}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Launchers and the toast read both variables
// ═══════════════════════════════════════════════════════════════════════════

section("Launchers and toast ride above the dock");

const jennifer = stripComments(read("app/components/jennifer/JenniferPanel.js"));
const help = stripComments(read("app/components/HelpButton.js"));
const toast = stripComments(read("app/components/ErrorToast.js"));

const BOTH = /bottom-\[calc\(var\(--fq-tab-bar-height\)\+var\(--fq-dock-height\)\+[\d.]+rem\)\]/;
ok("JenniferPanel launcher reads --fq-tab-bar-height + --fq-dock-height", BOTH.test(jennifer));
ok("HelpButton reads --fq-tab-bar-height + --fq-dock-height", BOTH.test(help));
ok("ErrorToast reads --fq-tab-bar-height + --fq-dock-height", BOTH.test(toast));

// No launcher may sit ABOVE a modal: modals here are z-50 (BottomSheet,
// settings/team, SendConfirmModal…). z-30 clears page content and nothing
// else.
const jenniferLauncher = classLists(jennifer).find((c) => c.tag === "button" && /\bfixed\b/.test(c.cls));
const helpLauncher = classLists(help).find((c) => c.tag === "button" && /\bfixed\b/.test(c.cls));
ok("Jennifer launcher found", Boolean(jenniferLauncher));
ok("Help launcher found", Boolean(helpLauncher));
ok("Jennifer launcher is z-30, under every z-50 modal", /\bz-30\b/.test(jenniferLauncher?.cls || ""));
ok("Help launcher is z-30, under every z-50 modal", /\bz-30\b/.test(helpLauncher?.cls || ""));
ok(
  "no launcher went back to a hard-coded corner (lg:bottom-N)",
  !/\blg:bottom-\d/.test(jenniferLauncher?.cls || "") && !/\blg:bottom-\d/.test(helpLauncher?.cls || ""),
);

// ═══════════════════════════════════════════════════════════════════════════
// 3. Jennifer and Help do not overlap — geometry, not string inequality
// ═══════════════════════════════════════════════════════════════════════════

section("Jennifer and Help occupy disjoint vertical spans");

{
  const jGap = launcherGapRem(jenniferLauncher?.cls || "");
  const jH = heightRem(jenniferLauncher?.cls || "");
  const hGap = launcherGapRem(helpLauncher?.cls || "");
  const hH = heightRem(helpLauncher?.cls || "");
  ok("Jennifer's gap and height are readable", jGap !== null && jH !== null, `— gap ${jGap} h ${jH}`);
  ok("Help's gap and height are readable", hGap !== null && hH !== null, `— gap ${hGap} h ${hH}`);
  if (jGap !== null && jH !== null && hGap !== null && hH !== null) {
    // Both are measured from the same baseline (tab bar + dock), so the
    // variables cancel and rem arithmetic is exact.
    const jTop = jGap + jH;
    const hBottom = hGap;
    const clearance = hBottom - jTop;
    ok(
      `Help starts above Jennifer's top edge (${hBottom}rem vs ${jTop}rem, clearance ${clearance.toFixed(2)}rem)`,
      clearance >= 0.5,
      "— they overlap or nearly touch",
    );
  }
  const jRight = (jenniferLauncher?.cls || "").match(/(?:^|\s)right-(\S+)/)?.[1];
  const hRight = (helpLauncher?.cls || "").match(/(?:^|\s)right-(\S+)/)?.[1];
  ok(`the two are not at the same corner offsets (right-${jRight} vs right-${hRight}, different bottoms)`,
    Boolean(jRight) && Boolean(hRight) && (jGap !== hGap || jRight !== hRight));
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. The variables exist where the comments say, and the shell uses them
// ═══════════════════════════════════════════════════════════════════════════

section("Declarations and the /app shell");

const css = read("app/globals.css");
ok("globals.css declares --fq-tab-bar-row", /--fq-tab-bar-row:\s*[\d.]+rem;/.test(css));
ok("globals.css declares --fq-tab-bar-height (default 0)", /--fq-tab-bar-height:\s*0px;/.test(css));
ok("globals.css declares --fq-dock-height (default 0)", /--fq-dock-height:\s*0px;/.test(css));
ok(
  ".fq-app-shell sets the tab-bar term from the row plus the safe area",
  /\.fq-app-shell\s*\{\s*--fq-tab-bar-height:\s*calc\(var\(--fq-tab-bar-row\)\s*\+\s*env\(safe-area-inset-bottom\)\);/.test(css),
);
ok(
  ".fq-app-shell zeroes it at lg (64rem)",
  /@media \(min-width: 64rem\)\s*\{\s*\.fq-app-shell\s*\{\s*--fq-tab-bar-height:\s*0px;/.test(css),
);

const layout = stripComments(read("app/app/layout.js"));
ok("app/app/layout.js wraps the shell in .fq-app-shell", /className="[^"]*\bfq-app-shell\b/.test(layout));
ok(
  "<main> pads by tab bar + dock",
  /<main className="[^"]*pb-\[calc\(var\(--fq-tab-bar-height\)\+var\(--fq-dock-height\)\)\]/.test(layout),
);

const tabBar = stripComments(read("app/components/layout/MobileTabBar.js"));
ok("MobileTabBar's row height comes from --fq-tab-bar-row", /h-\[var\(--fq-tab-bar-row\)\]/.test(tabBar));
ok("MobileTabBar hides at lg, the breakpoint the CSS zeroes the variable at", /\blg:hidden\b/.test(tabBar));

const hook = read("app/hooks/useBottomDock.js");
ok("the hook writes --fq-dock-height", /DOCK_HEIGHT_VAR = "--fq-dock-height"/.test(hook));
ok("the hook removes the property when no dock is mounted", /removeProperty\(DOCK_HEIGHT_VAR\)/.test(hook));
ok("the hook observes size changes", /new ResizeObserver\(/.test(hook));

// ═══════════════════════════════════════════════════════════════════════════
// 5. The tab bar's footprint is written once
// ═══════════════════════════════════════════════════════════════════════════

section("No second copy of the tab bar's footprint");

{
  const copies = [];
  for (const abs of walk(join(ROOT, "app"))) {
    const src = stripComments(readFileSync(abs, "utf8"));
    if (/4rem\s*\+\s*env\(safe-area-inset-bottom\)/.test(src)) copies.push(relative(ROOT, abs));
  }
  ok("no source file hard-codes 4rem+env(safe-area-inset-bottom)", copies.length === 0, `— ${copies.join(", ")}`);
  const pads = [];
  for (const where of ["app/app/settings/links/page.js", "app/app/settings/availability/page.js", "app/app/invoices/new/page.js", "app/components/quotes/builder/QuoteBuilder.js"]) {
    const src = stripComments(read(where));
    if (/\bpb-2[48]\b/.test(src)) pads.push(where);
  }
  ok("dock pages no longer guess their own bottom padding (pb-24/pb-28)", pads.length === 0, `— ${pads.join(", ")}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Verdict
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n${pass} passed, ${failures.length} failed, ${skipped} element(s) with className held in a variable — unreadable here, not checked`);
if (failures.length > 0) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
