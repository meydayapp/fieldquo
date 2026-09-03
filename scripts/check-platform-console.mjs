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
import {
  awaitingCheckoutWhere,
  classifyTrial,
  isOnTrial,
  trialCompanyWhere,
  trialingSubscriptionWhere,
} from "../lib/platform/trialCounting.js";

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
  // ── the sales portal header, which sits on a card, NOT on a dark rail ──
  ["sales header wordmark", "--brand-accent-text", "--card", SALES,
    "text-brand-accent-text"],
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
  ["sales active tab underline", "--brand-accent", "--card", SALES, "border-brand-accent"],
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

// ── The sales portal is a header on a card, not a rail ─────────────────────
//
// The audit that produced this task expected SalesShell to have copied the
// sidebar's mistake. It had not: it sits on --card, where
// text-muted-foreground is the correct token and measures 6.46:1. What it DID
// have was raw #ff5a00 as text on that card — 3.13:1. Both facts are asserted
// so neither can be quietly reversed.
const salesCode = stripComments(read(SALES));
console.log("\n Sales portal header\n");
ok("SalesShell paints no dark surface", !/bg-(?:sidebar|inverted)\b/.test(salesCode),
  "if it ever does, its muted text needs the sidebar tokens instead");
ok("SalesShell still uses text-muted-foreground on its card",
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
files.push(SIDEBAR, SALES);
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

// ── The Prisma clauses and the predicate describe the same rule ────────────

console.log("\n The query and the predicate agree\n");

const a = trialingSubscriptionWhere();
const b = awaitingCheckoutWhere(NOW);
const both = trialCompanyWhere(NOW);
ok("trialingSubscriptionWhere filters on the subscription's status",
  a.subscription?.status === "trialing", JSON.stringify(a));
ok("awaitingCheckoutWhere requires the ABSENCE of a subscription",
  b.subscription?.is === null && b.trialEndsAt?.gte === NOW, JSON.stringify(b));
ok("trialCompanyWhere is exactly the two branches",
  Array.isArray(both.OR) && both.OR.length === 2 &&
    JSON.stringify(both.OR[0]) === JSON.stringify(a) &&
    JSON.stringify(both.OR[1]) === JSON.stringify(b));
ok("neither clause mentions onboardingStatus",
  !JSON.stringify(both).includes("onboardingStatus"));
// The disjointness the route's arithmetic rests on, asserted structurally too:
// one branch demands a subscription, the other its absence.
ok("branch A demands a subscription and branch B demands none",
  a.subscription?.is !== null && b.subscription?.is === null);

// ── The route and the screen actually use it ───────────────────────────────

const routeSrc = read("app/api/platform/analytics/overview/route.js");
const routeCode = stripComments(routeSrc);
const pageCode = stripComments(read("app/platform/page.js"));

console.log("");
ok("the overview route imports the shared rule",
  routeCode.includes("@/lib/platform/trialCounting"));
ok("the route counts with the shared clauses, not an inline copy",
  routeCode.includes("trialingSubscriptionWhere()") &&
    routeCode.includes("awaitingCheckoutWhere(now)"));
ok("no onboardingStatus survives in the route's trial counting",
  !/onboardingStatus:\s*"pending"/.test(routeCode));
ok("the route still excludes demo companies from both trial counts",
  (routeCode.match(/\.\.\.NOT_DEMO,\s*\.\.\.(?:trialingSubscriptionWhere|awaitingCheckoutWhere)/g)
    || []).length === 2);
ok("trialCompanies is the sum of the two branches",
  /trialCompanies:\s*trialingSubscriptionCompanies\s*\+\s*awaitingCheckoutCompanies/
    .test(routeCode));
ok("the breakdown ships with the total", routeCode.includes("trialBreakdown"));

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
ok("the subscription tile says it counts subscriptions",
  pageCode.includes("Trialing subscriptions") && !/label="In trial"/.test(pageCode));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
