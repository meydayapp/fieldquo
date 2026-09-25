// scripts/check-platform-console.mjs
//
// The two things the owner reported from his own screen, made impossible to
// reintroduce:
//
//   1. The platform rail was unreadable — `text-muted-foreground` (a token for
//      muted text on a LIGHT background) painted onto a hardcoded near-black.
//      He did not report it as "hard to read"; he reported that there was no
//      menu.
//   2. "1 companies on trial" was wrong, because the query keyed on
//      `onboardingStatus`, which flips to "active" at trial START.
//
//   npm run check:platform-console
//
// ── Why the ratios are computed, not listed ────────────────────────────────
//
// Same reason as scripts/check-sidebar.mjs, whose maths this deliberately
// reuses in shape: a table of expected ratios passes forever after somebody
// edits a token. Every number below comes from the hex actually in
// app/globals.css, in BOTH themes — the near-black rail hid the fact that
// `--muted-foreground` measured 2.72:1 in light mode and 8.10:1 in dark, so a
// one-theme check would have called the reported bug fixed while looking
// straight at it.
//
// ── Why the class names are grepped, and scoped ────────────────────────────
//
// Contrast maths on tokens proves nothing if the component stopped using those
// tokens, so each pairing also asserts its Tailwind class ships. The string
// rules are scoped to ONE brace-matched function (`Row`), not to the file:
// PlatformSidebar carries three hundred lines of comments that quote the
// classes they replaced, and a whole-file grep either fails on its own
// explanations or gets neutered into meaninglessness. Nothing here compares
// indexOf positions either — `indexOf(a) < indexOf(b)` is true whenever `a` is
// absent, which is a rule that passes hardest exactly when it should fail.
//
// ── Why the groups are pinned by name, and the folds are executed ──────────
//
// The owner, 2026-09-19: "the side menu seems all bunched up — it's hard to
// distinguish earnings from expenditure, and sales team, and /app, and
// FieldQuo's own." The rail was regrouped to answer that sentence — seven
// groups in a fixed order, each with a one-line description — and its
// headings now fold. Both are pinned below: the group list by name and order
// (a regroup that quietly merged Earnings back into Companies would pass a
// "has groups" check), every href that existed before the regroup present
// exactly once (a regroup is the easiest place to drop a row), and the fold
// rules RUN against the real navDisclosure.js functions through a fake
// localStorage — including the one that matters, that a stored "closed"
// never hides the route the admin is on.
//
// ── Why the trial rule is executed ─────────────────────────────────────────
//
// The classification is imported from lib/platform/trialCounting.js — the same
// module the route counts with — and run against fixtures covering every shape
// the live database actually holds. The old predicate is run against the same
// fixtures beside it, so the check does not merely assert that the new rule is
// self-consistent: it demonstrates the answer changed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// trialCounting.js reads lib/billing/access.js, which imports the database,
// so this check runs under the alias and db-stub loaders (package.json).
import {
  classifyTrial,
  isOnTrial,
} from "../lib/platform/trialCounting.js";
import {
  initialOpenKeys,
  isGroupOpen,
  readOverrides,
  visibleItems,
  writeOverrides,
} from "../app/components/layout/navDisclosure.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

// ── Colour maths (WCAG 2.1 relative luminance) ─────────────────────────────

function channels(hex) {
  const s = String(hex).trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) throw new Error(`not a 6-digit hex: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
function luminance(hex) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = channels(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const A = luminance(a);
  const B = luminance(b);
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
}
const r2 = (n) => Math.round(n * 100) / 100;

// Sanity-check the maths itself before trusting anything it says. A luminance
// function with a typo in it produces plausible numbers and passes every
// assertion below; these two are fixed points of the WCAG formula.
ok("contrast maths: black on white is 21:1", r2(contrast("#000000", "#ffffff")) === 21);
ok("contrast maths: a colour against itself is 1:1", r2(contrast("#4d6076", "#4d6076")) === 1);

// ── Tokens, parsed from globals.css ────────────────────────────────────────

function parseTokens(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`no ${selector} block in globals.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const out = {};
  for (const m of css.slice(open, close).matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const css = read("app/globals.css");
const THEMES = { light: parseTokens(css, ":root {"), dark: parseTokens(css, ".dark {") };

const TEXT_FLOOR = 4.5; // WCAG AA, body text
const GRAPHIC_FLOOR = 3.0; // WCAG AA, non-text indicators
// Same band and same reasoning as check-sidebar.mjs: under ~1.5 a hover fill
// reads as a rendering artefact, over ~2.0 it argues with the selected state.
const HOVER_MIN = 1.5;
const HOVER_MAX = 2.0;

const SIDEBAR = "app/components/platform/PlatformSidebar.js";
const SALES = "app/sales/SalesShell.js";
const LOGIN = "app/platform/login/page.js";
// The portal's phone chrome. Since 2026-09-11 SalesShell is a navy rail from
// lg up (the owner's reference dialler), and the orange wordmark and the
// active-tab accent that used to sit in its header on --card now sit in
// this file's top bar and drawer, still on --card. The pairings moved
// files; the tokens and the surface did not.
const SALES_MOBILE = "app/components/sales/SalesMobileTabBar.js";

// Every text/background pairing these two shells render, named by the tokens
// that supply each side, with the file and class that must exist for the
// pairing to be real.
const TEXT_PAIRS = [
  // ── the platform rail ──
  ["rail idle row", "--sidebar-muted-foreground", "--sidebar", SIDEBAR,
    "text-sidebar-muted-foreground"],
  ["rail group heading", "--sidebar-muted-foreground", "--sidebar", SIDEBAR,
    "text-sidebar-muted-foreground"],
  ["rail idle row on hover fill", "--sidebar-muted-foreground", "--sidebar-accent", SIDEBAR,
    "hover:bg-sidebar-accent"],
  ["rail hovered row", "--sidebar-accent-foreground", "--sidebar-accent", SIDEBAR,
    "hover:text-sidebar-accent-foreground"],
  ["rail selected row", "--sidebar-primary-foreground", "--sidebar-primary", SIDEBAR,
    "bg-sidebar-primary"],
  ["rail base text colour", "--sidebar-foreground", "--sidebar", SIDEBAR,
    "text-sidebar-foreground"],
  ["rail wordmark chip", "--sidebar-primary-foreground", "--sidebar-primary", SIDEBAR,
    "text-sidebar-primary-foreground"],
  // ── the sales portal: a card-surfaced top bar below lg, a navy rail above ──
  ["sales top-bar wordmark", "--brand-accent-text", "--card", SALES_MOBILE,
    "text-brand-accent-text"],
  ["sales rail idle row", "--sidebar-muted-foreground", "--sidebar", SALES,
    "text-sidebar-muted-foreground"],
  ["sales rail selected row", "--sidebar-primary-foreground", "--sidebar-primary", SALES,
    "bg-sidebar-primary"],
  ["sales header muted text", "--muted-foreground", "--card", SALES,
    "text-muted-foreground"],
  ["sales header hovered text", "--foreground", "--card", SALES,
    "hover:text-foreground"],
  ["sales active tab label", "--foreground", "--card", SALES, "text-foreground"],
];

// Non-text indicators: 3:1, not 4.5:1.
//
// The tab underline is the only member. It is the sole thing distinguishing the
// active tab from the other two, so it has to be seen. The rail's right border
// is deliberately NOT here: it separates two surfaces that are already distinct
// and identifies nothing on its own, so 1.4.11 does not reach it — and holding
// this rail to a floor AdminSidebar's identical `border-r border-sidebar-border`
// has never been held to would be a rule invented for one of two copies of the
// same edge. Its ratio is printed below as reference instead of asserted.
const GRAPHIC_PAIRS = [
  ["sales drawer active-row rule", "--brand-accent", "--card", SALES_MOBILE, "border-brand-accent"],
];

const HOVER_FILLS = [
  ["rail hover fill", "--sidebar-accent", "--sidebar", SIDEBAR, "hover:bg-sidebar-accent"],
];

console.log("Platform console contrast — computed from app/globals.css\n");

for (const [theme, tok] of Object.entries(THEMES)) {
  console.log(` ${theme}`);
  for (const [name, fgTok, bgTok, file, cls] of TEXT_PAIRS) {
    const fg = tok[fgTok];
    const bg = tok[bgTok];
    if (!fg || !bg) {
      ok(`${name} tokens defined`, false, `${fgTok}=${fg} ${bgTok}=${bg}`);
      continue;
    }
    const c = contrast(fg, bg);
    ok(`${name} ${fg} on ${bg}`, c >= TEXT_FLOOR, `${r2(c)}:1 (>= ${TEXT_FLOOR})`);
    ok(`  ^ ${cls} present in ${path.basename(file)}`, read(file).includes(cls));
  }
  for (const [name, fgTok, bgTok, file, cls] of GRAPHIC_PAIRS) {
    const c = contrast(tok[fgTok], tok[bgTok]);
    ok(`${name} ${tok[fgTok]} on ${tok[bgTok]}`, c >= GRAPHIC_FLOOR,
      `${r2(c)}:1 (>= ${GRAPHIC_FLOOR})`);
    ok(`  ^ ${cls} present in ${path.basename(file)}`, read(file).includes(cls));
  }
  for (const [name, fillTok, bgTok, file, cls] of HOVER_FILLS) {
    const c = contrast(tok[fillTok], tok[bgTok]);
    ok(`${name} ${tok[fillTok]} vs ${tok[bgTok]}`,
      c >= HOVER_MIN && c <= HOVER_MAX, `${r2(c)}:1 (band ${HOVER_MIN}-${HOVER_MAX})`);
    ok(`  ^ ${cls} present in ${path.basename(file)}`, read(file).includes(cls));
  }
  // idle is the bare rail, so its separation from itself is exactly 1.
  const rungs = [1, contrast(tok["--sidebar-accent"], tok["--sidebar"]),
    contrast(tok["--sidebar-primary"], tok["--sidebar"])];
  ok("rail ladder idle < hover < selected",
    rungs.every((v, i) => i === 0 || v > rungs[i - 1]), rungs.map(r2).join(" -> "));
  // Reference, not a floor — see the note on GRAPHIC_PAIRS. Printed because it
  // is genuinely low in dark mode (the rail and the page are both near-black
  // there) and somebody should see the number before deciding it is fine.
  console.log(
    `       (reference: rail edge ${r2(contrast(tok["--sidebar-border"], tok["--background"]))}:1, ` +
      `rail vs page ${r2(contrast(tok["--sidebar"], tok["--background"]))}:1)`,
  );
  console.log("");
}

// ── The specific mistake that was reported ─────────────────────────────────
//
// --muted-foreground is 4.5:1-safe on --card and --background and nowhere else.
// On the rail it measured 2.72:1 in light mode. This is the assertion that
// would have caught the original bug, stated as a rule rather than a value.
console.log(" muted-foreground is a LIGHT-surface token\n");
for (const [theme, tok] of Object.entries(THEMES)) {
  ok(`${theme}: --muted-foreground is legible on --card`,
    contrast(tok["--muted-foreground"], tok["--card"]) >= TEXT_FLOOR,
    `${r2(contrast(tok["--muted-foreground"], tok["--card"]))}:1`);
  const onRail = contrast(tok["--muted-foreground"], tok["--sidebar"]);
  console.log(
    `       (for reference: --muted-foreground on --sidebar is ${r2(onRail)}:1 in ${theme})`,
  );
}

// Comments in these files quote the classes they replaced, on purpose — the
// reasoning belongs next to the fix. So every "must not come back" grep runs on
// code only. Line comments FIRST: reversed, a `/*` sitting inside a `//` line
// opens a block that swallows the code the greps exist to inspect, and a check
// with nothing left to look at passes.
function stripComments(src) {
  return src.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * The body of one brace-matched function declaration, comments stripped.
 *
 * The parameter list is skipped by matching ITS parens first. Taking the next
 * `{` after the name instead returns the destructuring pattern — `function
 * Row({ item })` yields the eight characters `{ item }`, and every string rule
 * below then passes against a body containing nothing. That is not a
 * hypothetical: it is what this function did on its first run, and the shape
 * assertion under it is the only reason anyone noticed.
 */
function functionBody(src, decl) {
  const code = stripComments(src);
  const start = code.indexOf(decl);
  if (start < 0) throw new Error(`missing ${decl}`);
  let i = code.indexOf("(", start);
  let parens = 0;
  for (; i < code.length; i++) {
    if (code[i] === "(") parens++;
    else if (code[i] === ")" && --parens === 0) break;
  }
  const open = code.indexOf("{", i);
  if (open < 0) throw new Error(`no body for ${decl}`);
  let depth = 0;
  for (let j = open; j < code.length; j++) {
    if (code[j] === "{") depth++;
    else if (code[j] === "}" && --depth === 0) return code.slice(open, j + 1);
  }
  throw new Error(`unterminated ${decl}`);
}

const railCode = stripComments(read(SIDEBAR));
const rowBody = functionBody(read(SIDEBAR), "function Row(");

console.log("\n Rail: the classes that must not come back\n");

// A regex that matched nothing would make every rule below pass on an empty
// string. Pin the shape first.
ok("parsed the Row function body", rowBody.length > 80 && rowBody.includes("isActive("),
  `${rowBody.length} chars`);

ok("Row does not paint text with --muted-foreground",
  !rowBody.includes("muted-foreground") || rowBody.includes("sidebar-muted-foreground"),
  "text-muted-foreground on this rail measured 2.72:1 in light mode");
// Stricter, and the one that actually matters: the bare token, not the sidebar
// one whose name contains it as a substring.
ok("Row uses no bare text-muted-foreground",
  !/(^|[^-])text-muted-foreground/.test(rowBody));
ok("the whole rail file uses no bare text-muted-foreground",
  !/(^|[^-])text-muted-foreground/.test(railCode));

// Alpha over a surface yields a different ratio on every surface it lands on,
// so nothing above can assert it — and `bg-card/10` was 1.00:1 against the rail
// in dark mode, i.e. the selected row had no fill at all.
const alphaText = [...railCode.matchAll(/text-[a-z-]*foreground\/\d+/g)].map((m) => m[0]);
ok("rail has no text-*foreground/NN", alphaText.length === 0, alphaText.join(" "));
const alphaFill = [...railCode.matchAll(/\bbg-(?:card|white|black|muted)\/\d+/g)].map((m) => m[0]);
ok("rail has no alpha fills over the surface", alphaFill.length === 0, alphaFill.join(" "));

// The near-black was the email header neutral (lib/email/emailTheme.js) that
// had drifted onto a nav surface; re-solving the hover/selected ladder against
// it would have meant three unmeasured colours.
const arbitrary = [...railCode.matchAll(/(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/g)]
  .map((m) => m[0]);
ok("rail names no arbitrary hex", arbitrary.length === 0, arbitrary.join(" "));
ok("the platform sign-in page shares the rail's surface token",
  stripComments(read(LOGIN)).includes("bg-sidebar") &&
    !stripComments(read(LOGIN)).includes("bg-[#"));

// ── Hover must actually change something ───────────────────────────────────
//
// The idle row was `text-muted-foreground hover:text-muted-foreground`: a hover
// state that repainted the row its existing colour. Stated generally, because
// the next copy-paste will pick a different token.
const hoverTextRules = [...rowBody.matchAll(/hover:(text-[a-z0-9-]+)/g)].map((m) => m[1]);
ok("Row declares a hover text colour", hoverTextRules.length > 0);
const noOpHovers = hoverTextRules.filter((h) => {
  // Same class string that carries the hover rule must not already set it.
  const owning = [...rowBody.matchAll(/"([^"\n]*)"/g)]
    .map((m) => m[1])
    .filter((s) => s.includes(`hover:${h}`));
  return owning.some((s) => new RegExp(`(^|\\s)${h}(\\s|$)`).test(s));
});
ok("no hover:text-X sits on a row already painted text-X", noOpHovers.length === 0,
  noOpHovers.join(" "));

// ── Orange is a fill, not text, on a dark rail ─────────────────────────────
//
// #ff5a00 measured 5.62:1 on the old near-black and 3.88:1 on --sidebar. Moving
// the rail to navy without moving the wordmark would have traded one failing
// pairing for another, which is how this class of bug survives a fix.
for (const [theme, tok] of Object.entries(THEMES)) {
  const asText = contrast(tok["--sidebar-primary"], tok["--sidebar"]);
  const asFill = contrast(tok["--sidebar-primary-foreground"], tok["--sidebar-primary"]);
  ok(`${theme}: brand orange is used as a fill, and the fill pairing passes`,
    asFill >= TEXT_FLOOR, `${r2(asFill)}:1 on the chip vs ${r2(asText)}:1 as bare text`);
}
ok("the rail does not paint text with text-sidebar-primary",
  !/text-sidebar-primary(?![-a-z])/.test(railCode),
  "orange on --sidebar is 3.88:1 in light mode");

// ── The sales portal: a card header, then (from 2026-09-11) a navy rail ────
//
// The audit that produced this check expected SalesShell to have copied the
// sidebar's mistake. It had not: it sat on --card, where text-muted-foreground
// is the correct token. What it DID have was raw #ff5a00 as text on that
// card — 3.13:1. Then the owner asked for a vertical rail like his reference
// dialler, and the shell grew a bg-sidebar <aside> from lg up — which this
// check, still asserting "no dark surface", failed on for two days while the
// real rule it guards (no muted-on-dark) held. So the assertion is now the
// rule itself: a dark surface here must speak in the sidebar tokens, and the
// card header keeps its own. The per-string scan below is what actually
// catches a muted token on a navy string.
const salesCode = stripComments(read(SALES));
console.log("\n Sales portal header and rail\n");
ok("SalesShell's rail is on --sidebar with the sidebar's text tokens",
  /bg-sidebar text-sidebar-foreground/.test(salesCode) && /text-sidebar-muted-foreground/.test(salesCode),
  "a dark surface here must not borrow text-muted-foreground");
ok("SalesShell still uses text-muted-foreground on its card header",
  salesCode.includes("text-muted-foreground"));
ok("SalesShell names no arbitrary hex",
  !/(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/.test(salesCode),
  (salesCode.match(/(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/g) || []).join(" "));

// The general rule behind both: no muted-on-dark anywhere in the console or the
// portal. Scanned per class-list string, because a file can legitimately hold
// both a dark rail and a light card.
console.log("");
const DARK_SURFACE = /\bbg-(?:sidebar|inverted)(?![-a-z])/;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith(".js")) files.push(rel);
  }
})("app/platform");
files.push(SIDEBAR, SALES, SALES_MOBILE);
const offenders = [];
for (const file of files) {
  for (const m of stripComments(read(file)).matchAll(/"([^"\n]*)"/g)) {
    const s = m[1];
    if (DARK_SURFACE.test(s) && /(^|[^-])text-muted-foreground/.test(s)) {
      offenders.push(`${path.basename(file)}: ${s}`);
    }
  }
}
ok(`no class list pairs a dark surface with text-muted-foreground (${files.length} files)`,
  offenders.length === 0, offenders.join(" | "));


// ══════════════════════════════════════════════════════════════════════════
// The regrouped rail: seven groups, every row kept, headings that fold
// ══════════════════════════════════════════════════════════════════════════

console.log("\nThe regrouped rail — groups, rows and folds\n");

/** The `[ ... ]` literal a `const NAME = [` declaration opens, brace-matched. */
function sliceArray(src, decl) {
  const start = src.indexOf(decl);
  if (start < 0) throw new Error(`missing ${decl}`);
  const i = src.indexOf("[", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "[") depth++;
    else if (src[j] === "]" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`unterminated ${decl}`);
}

/**
 * GROUPS as the component declares them: key, label, description and the
 * leaf rows. Same brace argument as check-nav-audit.mjs — every row is one
 * flat object literal with no nested braces, so `\{[^{}]*\}` finds exactly
 * the rows and never a group wrapper. Comments are stripped first: the rows'
 * own comments quote hrefs and labels of the neighbours they moved away from.
 */
function parsePlatformGroups(src) {
  const block = sliceArray(stripComments(src), "const GROUPS = [");
  const headers = [
    ...block.matchAll(/key:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*,\s*description:\s*"([^"]*)"\s*,\s*items:\s*\[/g),
  ];
  const groups = [];
  for (let n = 0; n < headers.length; n++) {
    const from = headers[n].index + headers[n][0].length;
    const to = n + 1 < headers.length ? headers[n + 1].index : block.length;
    const items = [];
    for (const m of block.slice(from, to).matchAll(/\{[^{}]*\}/g)) {
      const text = m[0];
      const label = text.match(/label:\s*"([^"]+)"/);
      const href = text.match(/href:\s*"([^"]+)"/);
      if (!label || !href) continue;
      items.push({
        key: href[1],
        label: label[1],
        href: href[1],
        exact: /exact:\s*true/.test(text),
        badge: text.match(/badge:\s*"([^"]+)"/)?.[1] ?? null,
        title: text.match(/title:\s*"([^"]+)"/)?.[1] ?? null,
      });
    }
    groups.push({ key: headers[n][1], label: headers[n][2], description: headers[n][3], items });
  }
  return groups;
}
const railSrc = read(SIDEBAR);
const PLATFORM_GROUPS = parsePlatformGroups(railSrc);
const PLATFORM_ITEMS = PLATFORM_GROUPS.flatMap((g) => g.items);
const HOME = railSrc.match(/const HOME_ITEM = \{[^}]*href:\s*"([^"]+)"[^}]*\}/);

// A parser that silently matched nothing would make every rule below pass on
// an empty list. Pin the shape first.
ok("parsed the rail's groups", PLATFORM_GROUPS.length === 7 && PLATFORM_ITEMS.length >= 50,
  `${PLATFORM_GROUPS.length} groups / ${PLATFORM_ITEMS.length} rows`);

// ── The seven, in the owner's order, each saying what it is ────────────────
const EXPECTED_GROUPS = [
  ["earnings", "Earnings"],
  ["spending", "Spending"],
  ["companies", "Companies (/app)"],
  ["salesTeam", "Sales team"],
  ["leadData", "Lead data"],
  ["support", "Support"],
  ["own", "FieldQuo's own systems"],
];
ok("the seven groups are the owner's seven, in this order",
  JSON.stringify(PLATFORM_GROUPS.map((g) => [g.key, g.label])) === JSON.stringify(EXPECTED_GROUPS),
  PLATFORM_GROUPS.map((g) => g.label).join(" > "));
ok("Dashboard is HOME_ITEM, exact, and drawn before every group",
  Boolean(HOME) && HOME[1] === "/platform" && /exact:\s*true/.test(HOME[0]) &&
    railSrc.indexOf("<Row item={HOME_ITEM}") > 0 &&
    railSrc.indexOf("<Row item={HOME_ITEM}") < railSrc.indexOf("{GROUPS.map((group) =>"));
ok("no group is named Dashboard or Overview (a group of one is what the audit flags)",
  !PLATFORM_GROUPS.some((g) => /dashboard|overview/i.test(g.label)));
const undescribed = PLATFORM_GROUPS.filter((g) => g.description.trim().length < 20);
ok("every group carries a one-line description", undescribed.length === 0,
  undescribed.map((g) => g.key).join(" "));
ok("Earnings says money in and Spending says what FieldQuo pays — the split is stated, not implied",
  /money coming in/i.test(PLATFORM_GROUPS[0].description) && /what fieldquo pays/i.test(PLATFORM_GROUPS[1].description));
ok("the heading renders the description as its title",
  /title=\{group\.description\}/.test(stripComments(railSrc)));

// ── Every row that existed before the regroup, once, under one group ───────
//
// The href list as it stood at 8035b4ea6 (the commit before the regroup),
// Dashboard included. Not re-derived from the file: the whole point is that
// the file cannot lose a row without this list noticing. A row added later is
// appended here by the commit that adds it.
const HREFS_BEFORE_REGROUP = [
  "/platform", "/platform/ai-usage", "/platform/analytics", "/platform/audit-log",
  "/platform/billing/plans", "/platform/billing/promotions", "/platform/billing/subscriptions",
  "/platform/chat", "/platform/companies", "/platform/costs", "/platform/crew-lines",
  "/platform/data-deletion", "/platform/demo", "/platform/demo-availability", "/platform/demos",
  "/platform/errors", "/platform/features", "/platform/feedback", "/platform/growth",
  "/platform/help", "/platform/jennifer", "/platform/migrations", "/platform/promo-codes",
  "/platform/reports", "/platform/sales-agent", "/platform/sales/call-quality",
  "/platform/sales/campaigns", "/platform/sales/capabilities", "/platform/sales/confidence",
  "/platform/sales/conversations", "/platform/sales/floor", "/platform/sales/funnel",
  "/platform/sales/notes", "/platform/sales/payouts", "/platform/sales/performance",
  "/platform/sales/plans", "/platform/sales/playbooks", "/platform/sales/prospects",
  "/platform/sales/reps", "/platform/sales/retry-pool", "/platform/sales/review",
  "/platform/sales/rules", "/platform/sales/signatures", "/platform/sales/snapshots",
  "/platform/sales/windows", "/platform/service-categories", "/platform/settings",
  "/platform/signup-origins", "/platform/signups", "/platform/support", "/platform/suppressions",
  "/platform/team", "/platform/voice-economics", "/platform/voice-numbers", "/platform/voice-webhooks",
  // 2026-09-24: SMS delivery receipts (own systems, beside voice webhooks).
  "/platform/sms-health",
  // Added after the regroup, by the commit that added it (the AI payer switch).
  "/platform/ai-billing",
  // 2026-09-25: where FieldQuo must register to charge VAT/GST on its own
  // subscriptions (Earnings, beside the money it taxes).
  "/platform/billing/tax",
  // The second pass on call outcomes (6e3dfd83): sub-reason lists, the
  // callback agenda and the per-call-billed settings (Sales team, after
  // the retry pool — docs/SALES-OUTCOMES.md).
  "/platform/sales/outcomes",
];
const allHrefs = [HOME?.[1], ...PLATFORM_ITEMS.map((i) => i.href)].filter(Boolean);
const counts = new Map();
for (const h of allHrefs) counts.set(h, (counts.get(h) || 0) + 1);
const lost = HREFS_BEFORE_REGROUP.filter((h) => !counts.has(h));
const doubled = [...counts].filter(([, n]) => n > 1).map(([h]) => h);
const added = allHrefs.filter((h) => !HREFS_BEFORE_REGROUP.includes(h));
ok(`every one of the ${HREFS_BEFORE_REGROUP.length} pre-regroup hrefs is still on the rail`, lost.length === 0, lost.join(" "));
ok("no href appears twice", doubled.length === 0, doubled.join(" "));
ok("the regroup added no row (a new row is appended to HREFS_BEFORE_REGROUP by the commit that adds it)",
  added.length === 0, added.join(" "));

// ── Membership the owner named ─────────────────────────────────────────────
const groupOf = (href) => PLATFORM_GROUPS.find((g) => g.items.some((i) => i.href === href))?.key;
const MEMBERSHIP = {
  earnings: ["/platform/billing/subscriptions", "/platform/billing/plans", "/platform/billing/promotions", "/platform/promo-codes", "/platform/billing/tax", "/platform/growth", "/platform/reports"],
  spending: ["/platform/costs", "/platform/ai-usage", "/platform/ai-billing", "/platform/voice-economics", "/platform/voice-numbers", "/platform/crew-lines", "/platform/sales/payouts", "/platform/sales/plans"],
  companies: ["/platform/companies", "/platform/signups", "/platform/signup-origins", "/platform/migrations", "/platform/features", "/platform/demo", "/platform/demos", "/platform/demo-availability"],
  salesTeam: ["/platform/sales/reps", "/platform/sales/floor", "/platform/sales/performance", "/platform/sales/call-quality", "/platform/sales/funnel", "/platform/sales/notes", "/platform/sales/conversations", "/platform/sales/windows", "/platform/sales/review", "/platform/sales/retry-pool", "/platform/sales/outcomes"],
  leadData: ["/platform/sales/prospects", "/platform/sales/campaigns", "/platform/sales/snapshots", "/platform/sales/capabilities", "/platform/sales/rules", "/platform/sales/playbooks", "/platform/sales/confidence", "/platform/sales/signatures", "/platform/suppressions"],
  support: ["/platform/chat", "/platform/support", "/platform/feedback", "/platform/jennifer", "/platform/data-deletion", "/platform/errors"],
  own: ["/platform/sales-agent", "/platform/voice-webhooks", "/platform/sms-health", "/platform/analytics", "/platform/service-categories", "/platform/audit-log", "/platform/help", "/platform/team", "/platform/settings"],
};
for (const [key, hrefs] of Object.entries(MEMBERSHIP)) {
  const strays = hrefs.filter((h) => groupOf(h) !== key);
  ok(`${key}: ${hrefs.length} rows filed where the owner put them`, strays.length === 0,
    strays.map((h) => `${h} -> ${groupOf(h)}`).join(" "));
}
ok("every row is accounted for by the membership table",
  PLATFORM_ITEMS.every((i) => Object.values(MEMBERSHIP).flat().includes(i.href)),
  PLATFORM_ITEMS.filter((i) => !Object.values(MEMBERSHIP).flat().includes(i.href)).map((i) => i.href).join(" "));
ok("Costs is first in Spending", PLATFORM_GROUPS[1].items[0]?.href === "/platform/costs",
  PLATFORM_GROUPS[1].items[0]?.href);
ok("Demo accounts keeps exact (three demo rows share the /platform/demo prefix)",
  PLATFORM_ITEMS.find((i) => i.href === "/platform/demo")?.exact === true);
ok("the two badges survived the regroup on their own rows",
  PLATFORM_ITEMS.find((i) => i.href === "/platform/sales/review")?.badge === "review" &&
    PLATFORM_ITEMS.find((i) => i.href === "/platform/signup-origins")?.badge === "signups");

// ── The two phone estates, named by their vendor ───────────────────────────
//
// The owner could not find where to buy the outbound SMS number because the
// page was called "Crew lines". The label now says the vendor and the title
// says the job; the href did not move, and the page's H1 agrees.
const twilio = PLATFORM_ITEMS.find((i) => i.href === "/platform/crew-lines");
const retell = PLATFORM_ITEMS.find((i) => i.href === "/platform/voice-numbers");
ok("the Twilio row is labelled by its vendor, href unchanged", twilio?.label === "Twilio numbers", twilio?.label);
ok("…and its title says which numbers and that this is where one is bought",
  twilio?.title === "Crew inboxes, sales reps' numbers, the system outbound number — buy and audit", twilio?.title);
ok("the Retell row is labelled by its vendor, href unchanged", retell?.label === "Retell numbers (voice)", retell?.label);
ok("a row's title reaches the <Link>", /title=\{item\.title\}/.test(stripComments(railSrc)));
const crewPage = read("app/platform/crew-lines/page.js");
ok("the crew-lines page's H1 says Twilio numbers",
  /<h1[^>]*>\s*<MessageSquare[^>]*\/>\s*Twilio numbers\s*<\/h1>/.test(crewPage));
ok("…and its subtitle carries the row's title sentence",
  /Crew inboxes, sales reps&apos; numbers, the system outbound number — buy and audit\./.test(crewPage));
// Every sentence that sends the owner to the row by its label must use the
// label that is on the rail — "under Crew lines" now points at nothing.
const pointers = ["lib/sales/repAdmin.js", "lib/sales/salesSmsRules.js", "lib/sales/calls/inboundRouting.js", "app/platform/crew-lines/page.js"]
  .filter((f) => /under Crew lines|console under Crew lines/.test(stripComments(read(f))));
ok("no instruction still says 'under Crew lines'", pointers.length === 0, pointers.join(" "));

// ── Folding: the shared rules, run ─────────────────────────────────────────
//
// The rail imports the same disclosure module the /app sidebars use, so the
// rules below are the rules that ship, not a restatement.
const railCode2 = stripComments(railSrc);
ok("the rail folds on the shared disclosure module, not a private copy",
  /import \{ useGroupDisclosure \} from "@\/app\/components\/layout\/NavFilter"/.test(railCode2) &&
    /import \{ activeGroupKey, isGroupOpen \} from "@\/app\/components\/layout\/navDisclosure"/.test(railCode2));
ok("every group is open by default",
  /const DEFAULT_OPEN = GROUPS\.map\(\(g\) => g\.key\)/.test(railCode2));
ok("the group holding the route is passed as activeKey",
  /useGroupDisclosure\(\{\s*storageKey: disclosureStorageKey\(adminId\),\s*defaultOpenKeys: DEFAULT_OPEN,\s*activeKey,\s*\}\)/.test(railCode2));
ok("activeKey is found by the rows' own active rule (exact or prefix), not a bare prefix",
  /activeGroupKey\(GROUPS, pathname, \(href\) => \{\s*const item = ALL_ITEMS\.find\(\(i\) => i\.href === href\);\s*return item \? isActive\(item, pathname\) : false;/.test(railCode2));

const everyKey = PLATFORM_GROUPS.map((g) => g.key);
const ALL_CLOSED = Object.fromEntries(everyKey.map((k) => [k, false]));
const label = (k) => k;
// Every row: with every group stored closed and the row's own group active,
// the row is drawn. This is the deep-link promise, per row.
const hiddenWhenActive = PLATFORM_ITEMS.filter((item) => {
  const active = groupOf(item.href);
  const open = initialOpenKeys({ defaultOpenKeys: everyKey, overrides: ALL_CLOSED, active });
  return !visibleItems({ groups: PLATFORM_GROUPS, query: "", openKeys: open, label }).some((i) => i.href === item.href);
});
ok("a stored 'closed' never hides the route the admin is on (every row)",
  hiddenWhenActive.length === 0, hiddenWhenActive.map((i) => i.href).join(" "));
ok("with everything stored closed and nothing active, every row is hidden and every heading is still drawn",
  visibleItems({ groups: PLATFORM_GROUPS, query: "", openKeys: initialOpenKeys({ defaultOpenKeys: everyKey, overrides: ALL_CLOSED }), label }).length === 0 &&
    PLATFORM_GROUPS.every((g) => !isGroupOpen({ group: g, openKeys: new Set() })));
ok("a fold on one group leaves the other six open",
  (() => {
    const open = initialOpenKeys({ defaultOpenKeys: everyKey, overrides: { spending: false } });
    return !open.has("spending") && everyKey.filter((k) => k !== "spending").every((k) => open.has(k));
  })());

// Round trip through a fake localStorage — the value the rail writes is the
// value it reads back, and a storage that throws costs nothing but memory.
{
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
  };
  const KEY = "fq-platform-groups:admin_1";
  writeOverrides(KEY, { spending: false, leadData: false });
  const back = readOverrides(KEY);
  ok("fold state round-trips through storage", JSON.stringify(back) === JSON.stringify({ spending: false, leadData: false }), JSON.stringify(back));
  ok("…under a per-admin key (two admins on one machine do not share folds)", store.has(KEY) && !store.has("fq-platform-groups"));
  const open = initialOpenKeys({ defaultOpenKeys: everyKey, overrides: back, active: "spending" });
  ok("…and the round-tripped 'closed' still yields to the active group",
    open.has("spending") && !open.has("leadData") && open.has("earnings"));
  store.set(KEY, "{not json");
  ok("a hand-edited value falls back to everything open", JSON.stringify(readOverrides(KEY)) === "{}");
  globalThis.window = {
    localStorage: {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
    },
  };
  let threw = false;
  try {
    writeOverrides(KEY, { spending: false });
    if (JSON.stringify(readOverrides(KEY)) !== "{}") threw = true;
  } catch {
    threw = true;
  }
  ok("a storage that refuses is a storage that remembers nothing — never a throw", !threw);
  delete globalThis.window;
}
// The rail's OWN two storage touches (the remembered admin id) are wrapped too.
{
  const helpers = railCode2.slice(railCode2.indexOf("function readRememberedAdminId"), railCode2.indexOf("export function disclosureStorageKey"));
  const touches = (helpers.match(/window\.localStorage/g) || []).length;
  const tries = (helpers.match(/try \{/g) || []).length;
  ok("every localStorage read and write in the rail sits inside try/catch",
    touches === 2 && tries === 2 && (railCode2.match(/window\.localStorage/g) || []).length === 2,
    `${touches} touches, ${tries} try blocks`);
  ok("the storage key carries the admin id once it is known",
    /return adminId \? `\$\{DISCLOSURE_KEY_PREFIX\}:\$\{adminId\}` : DISCLOSURE_KEY_PREFIX;/.test(railCode2) &&
      /fetch\("\/api\/platform\/me"\)/.test(railCode2));
}

// ── The heading: a real button, keyboard-operable, in the rail's tokens ────
const headingBody = functionBody(railSrc, "function GroupHeading(");
ok("parsed the GroupHeading body", headingBody.length > 200 && headingBody.includes("aria-expanded"), `${headingBody.length} chars`);
ok("the heading is a <button type=\"button\">", /<button\s+type="button"/.test(headingBody));
ok("…with aria-expanded bound to the fold state", /aria-expanded=\{open\}/.test(headingBody));
ok("…and aria-controls naming the rows it folds",
  /aria-controls=\{`platform-group-\$\{group\.key\}`\}/.test(headingBody) &&
    /id=\{`platform-group-\$\{group\.key\}`\}/.test(railCode2));
ok("…the chevron is hidden from assistive tech", /<ChevronDown[^>]*aria-hidden="true"/.test(headingBody));
ok("the heading paints with the rail's idle and hover tokens (measured above in both themes)",
  headingBody.includes("text-sidebar-muted-foreground") &&
    headingBody.includes("hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"));
ok("the heading uses no bare text-muted-foreground", !/(^|[^-])text-muted-foreground/.test(headingBody));
ok("a folded group's badge count moves onto its heading rather than vanishing",
  /foldedBadge > 0 \? <CountPill count=\{foldedBadge\}/.test(headingBody) &&
    /const foldedBadge = open\s*\?\s*0/.test(railCode2));
// Declared inside the component, Row and GroupHeading would be a new function
// identity per render: React remounts them, and a keyboard user's focus falls
// off the heading the moment they press it (check-sidebar-focus.mjs names the
// same fault on AdminSidebar).
const componentAt = railCode2.indexOf("export default function PlatformSidebar()");
ok("Row and GroupHeading are declared at module level, not inside the render body",
  railCode2.indexOf("function Row(") < componentAt && railCode2.indexOf("function GroupHeading(") < componentAt && componentAt > 0);
ok("the drawer folds the same groups (one railContent for both)",
  railCode2.includes("railContent({ inDrawer: true })") &&
    railCode2.indexOf("function railContent(") < railCode2.indexOf("{GROUPS.map((group) =>") &&
    (railCode2.match(/\{GROUPS\.map\(\(group\) =>/g) || []).length === 1);

// ══════════════════════════════════════════════════════════════════════════
// Trial classification, executed
// ══════════════════════════════════════════════════════════════════════════

console.log("\n\"On trial\" — the rule, run against fixtures\n");

const NOW = new Date("2026-09-02T12:00:00Z");
const FUTURE = new Date("2026-09-25T00:00:00Z");
const PAST = new Date("2026-07-01T00:00:00Z");

// Every shape the live database actually holds. The names are the states, not
// the expected answers, so a fixture cannot be renamed into agreement.
const FIXTURES = [
  {
    name: "pending, no subscription, trial still running",
    company: { isDemo: false, onboardingStatus: "pending", trialEndsAt: FUTURE, subscription: null },
    expect: "awaiting_checkout",
  },
  {
    name: "active, subscription trialing (the one the old query missed)",
    company: { isDemo: false, onboardingStatus: "active", trialEndsAt: FUTURE,
      subscription: { status: "trialing" } },
    expect: "trialing_subscription",
  },
  {
    name: "active, subscription trialing, trialEndsAt already past (lapsed, still trialing in Stripe)",
    company: { isDemo: false, onboardingStatus: "active", trialEndsAt: PAST,
      subscription: { status: "trialing" } },
    expect: "trialing_subscription",
  },
  {
    name: "active and paying, but trialEndsAt was never cleared",
    company: { isDemo: false, onboardingStatus: "active", trialEndsAt: FUTURE,
      subscription: { status: "active" } },
    expect: null,
  },
  {
    name: "active, subscription active, trial expired",
    company: { isDemo: false, onboardingStatus: "active", trialEndsAt: PAST,
      subscription: { status: "active" } },
    expect: null,
  },
  {
    name: "pending, no subscription, trial expired (signed up and never finished)",
    company: { isDemo: false, onboardingStatus: "pending", trialEndsAt: PAST, subscription: null },
    expect: null,
  },
  {
    name: "no subscription and no trialEndsAt at all",
    company: { isDemo: false, onboardingStatus: "pending", trialEndsAt: null, subscription: null },
    expect: null,
  },
  {
    name: "churned, subscription canceled",
    company: { isDemo: false, onboardingStatus: "churned", trialEndsAt: PAST,
      subscription: { status: "canceled" } },
    expect: null,
  },
  {
    name: "demo company with a trialing subscription",
    company: { isDemo: true, onboardingStatus: "active", trialEndsAt: FUTURE,
      subscription: { status: "trialing" } },
    expect: null,
  },
  {
    name: "demo company, no subscription, trial running",
    company: { isDemo: true, onboardingStatus: "pending", trialEndsAt: FUTURE, subscription: null },
    expect: null,
  },
];

for (const f of FIXTURES) {
  const got = classifyTrial(f.company, NOW);
  ok(`${f.name} -> ${f.expect === null ? "not on trial" : f.expect}`, got === f.expect,
    got === f.expect ? "" : `got ${got}`);
}

ok("isOnTrial agrees with classifyTrial on every fixture",
  FIXTURES.every((f) => isOnTrial(f.company, NOW) === (f.expect !== null)));

// A query that forgot to load the relation must not be read as "no
// subscription" and fall through to the trialEndsAt branch — that would count
// every paying customer with a stale trialEndsAt as a trial.
//
// Asserted on the MESSAGE, not merely that something threw. Deleting the guard
// still throws — a TypeError, from reading `.status` off undefined one line
// later — so `catch {}` alone passes against a version with no guard at all.
// Mutation testing is the only reason that is known: the first draft of this
// check caught nineteen of twenty deliberate breakages and let that one through.
let thrown = null;
try {
  classifyTrial({ isDemo: false, trialEndsAt: FUTURE }, NOW);
} catch (err) {
  thrown = err;
}
ok("an unloaded subscription relation is rejected by name, not by TypeError",
  thrown !== null && !(thrown instanceof TypeError) &&
    /not selected/.test(String(thrown.message)),
  thrown === null ? "nothing threw" : `${thrown.constructor.name}: ${thrown.message}`);

// ── The answer changed ─────────────────────────────────────────────────────
//
// Running the old predicate beside the new one is the point: without it this
// file only proves the new rule agrees with itself.
const oldPredicate = (c, now) =>
  !c.isDemo && c.onboardingStatus === "pending" && c.trialEndsAt && new Date(c.trialEndsAt) >= now;

const oldCount = FIXTURES.filter((f) => oldPredicate(f.company, NOW)).length;
const newCount = FIXTURES.filter((f) => isOnTrial(f.company, NOW)).length;
const expectedNew = FIXTURES.filter((f) => f.expect !== null).length;
ok("the old onboardingStatus rule undercounts these fixtures", oldCount < newCount,
  `old ${oldCount}, new ${newCount}`);
ok("the new rule counts exactly the fixtures declared on trial", newCount === expectedNew,
  `${newCount}/${expectedNew}`);
ok("the old rule misses every company that reached checkout while still trialing",
  FIXTURES.filter((f) => f.expect === "trialing_subscription" && !f.company.isDemo)
    .every((f) => !oldPredicate(f.company, NOW)));

// The two branches must stay disjoint, or the route's "total = a + b" is wrong.
const branchA = FIXTURES.filter((f) => classifyTrial(f.company, NOW) === "trialing_subscription");
const branchB = FIXTURES.filter((f) => classifyTrial(f.company, NOW) === "awaiting_checkout");
ok("the two trial branches are disjoint and sum to the total",
  branchA.length + branchB.length === newCount,
  `${branchA.length} + ${branchB.length} = ${newCount}`);

// ── The route and the screen actually use it ───────────────────────────────
//
// Since 2026-09-25 the route counts nothing with a where-clause of its own:
// every company number is a bucket length from lib/platform/trialCounting.js
// loadSubscriberBook. The bucket rule itself — every bucket, hostile
// fixtures, every screen — is scripts/check-platform-buckets.mjs; what is
// pinned here is that the dashboard's trial number is the book's.

const routeSrc = read("app/api/platform/analytics/overview/route.js");
const routeCode = stripComments(routeSrc);
const pageCode = stripComments(read("app/platform/page.js"));

console.log("");
ok("the overview route imports the shared rule",
  routeCode.includes("@/lib/platform/trialCounting"));
ok("the route counts from the classified book, not an inline copy",
  routeCode.includes("loadSubscriberBook(db, { now })"));
ok("no onboardingStatus survives in the route's trial counting",
  !/onboardingStatus:\s*"pending"/.test(routeCode));
ok("trialCompanies is the book's trialing total, both kinds",
  /trialCompanies:\s*tally\.trialing\.total/.test(routeCode));
ok("the breakdown ships with the total, split by plan chosen / no plan yet",
  /trialBreakdown:\s*\{\s*withPlan:\s*tally\.trialing\.withPlan,\s*noPlan:\s*tally\.trialing\.noPlan/.test(routeCode));

// Failure class #1: written and never read. activeCompanies was returned by
// this route and consumed by nothing — and by the reasoning above its name was
// a claim the query could not support, since a trialing company is
// onboardingStatus "active" too.
ok("activeCompanies is gone rather than left dead and wrong",
  !routeCode.includes("activeCompanies"));
ok("the screen reads the breakdown the route now writes",
  pageCode.includes("trialBreakdown"));
ok("the banner no longer says 'companies on trial' over a narrower number",
  !pageCode.includes("companies on trial"));
// The tile was "Trialing subscriptions" — Stripe's trialing rows, 2 — while
// five companies were trialing (owner, 2026-09-25: "I think we have 4").
// It counts COMPANIES in a free month now, both kinds, from the same tally
// as the banner.
ok("the Trialing tile counts companies in a free month, not subscription rows",
  /label="Trialing"\s*\n\s*value=\{count\(data\.trialCompanies\)\}/.test(pageCode) &&
    !pageCode.includes('label="Trialing subscriptions"') && !/label="In trial"/.test(pageCode));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
