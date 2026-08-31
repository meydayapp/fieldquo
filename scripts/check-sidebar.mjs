// scripts/check-sidebar.mjs
//
// The two sidebars: colour ladder, legibility, and the promise that folding a
// group never strands a page.
//
//   npm run check:sidebar
//
// ── Why the numbers are computed, not listed ────────────────────────────────
//
// Every ratio below is derived from the hex actually in app/globals.css. A
// table of expected ratios would pass forever after someone edited a token,
// which is the exact failure AGENTS.md calls "contrast assumed rather than
// measured". Change a token and this recomputes; break the floor and it fails.
//
// ── Why the class names are grepped ─────────────────────────────────────────
//
// Contrast maths on tokens proves nothing if the component stopped using those
// tokens. So each declared pairing also asserts its Tailwind class is present
// in the file that is supposed to render it. That closes the loop between "the
// palette is sound" and "the palette is what ships".
//
// ── Why disclosure is exercised, not described ──────────────────────────────
//
// The reachability rules are imported from app/components/layout/navDisclosure.js
// — the same module both sidebars render from — and the group definitions are
// parsed out of the components themselves. Nothing here is a second copy of the
// nav that could quietly stop matching the first.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterGroups,
  initialOpenKeys,
  isGroupOpen,
  visibleGroups,
  visibleItems,
} from "../app/components/layout/navDisclosure.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
let warnings = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
// For a state that is not broken but is a trap for whoever reads it next.
function warn(name, clean, detail = "") {
  checks++;
  if (!clean) warnings++;
  console.log(`  ${clean ? "ok  " : "WARN"} ${name}${detail ? `  ${detail}` : ""}`);
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

// ── Tokens, straight out of globals.css ────────────────────────────────────
//
// Parsed rather than duplicated: the stylesheet is the source of truth, and a
// copy here would be one more thing to keep in step.

function parseTokens(css, selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`no ${selector} block in globals.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  const body = css.slice(open, close);
  const out = {};
  for (const m of body.matchAll(/(--[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const css = read("app/globals.css");
const THEMES = { light: parseTokens(css, ":root {"), dark: parseTokens(css, ".dark {") };

// Floors. 4.5:1 is WCAG AA for body text. The hover band is a design decision:
// under ~1.5 a fill reads as a rendering artefact rather than a shape (the old
// #0d4a90 measured 1.39:1 and was the "barely visible" complaint), over ~2.0 it
// starts competing with the selected state it is supposed to sit below.
const TEXT_FLOOR = 4.5;
const HOVER_MIN = 1.5;
const HOVER_MAX = 2.0;

// Every text/background pairing the two sidebars render, named by the token
// that supplies each side, plus the file and Tailwind class that must exist for
// the pairing to be real.
const TEXT_PAIRS = [
  // ── the navy rail ──
  ["rail idle row", "--sidebar-muted-foreground", "--sidebar",
    "app/components/layout/AdminSidebar.js", "text-sidebar-muted-foreground"],
  ["rail idle row on hover fill", "--sidebar-muted-foreground", "--sidebar-accent",
    "app/components/layout/AdminSidebar.js", "hover:bg-sidebar-accent"],
  ["rail hover row", "--sidebar-accent-foreground", "--sidebar-accent",
    "app/components/layout/AdminSidebar.js", "hover:text-sidebar-accent-foreground"],
  ["rail selected row", "--sidebar-primary-foreground", "--sidebar-primary",
    "app/components/layout/AdminSidebar.js", "bg-sidebar-primary"],
  ["rail strong text", "--sidebar-foreground", "--sidebar",
    "app/components/layout/AdminSidebar.js", "text-sidebar-foreground"],
  ["rail filter text", "--sidebar-foreground", "--sidebar-accent",
    "app/components/layout/NavFilter.js", "bg-sidebar-accent"],
  ["rail filter placeholder", "--sidebar-muted-foreground", "--sidebar-accent",
    "app/components/layout/NavFilter.js", "placeholder:text-sidebar-muted-foreground"],
  // ── the settings panel, which sits on a card ──
  ["panel idle row", "--muted-foreground", "--card",
    "app/components/layout/SettingsSidebar.js", "text-muted-foreground"],
  ["panel hover row", "--foreground", "--sidebar-panel-accent",
    "app/components/layout/SettingsSidebar.js", "hover:bg-sidebar-panel-accent"],
  ["panel hover row text", "--foreground", "--sidebar-panel-accent",
    "app/components/layout/SettingsSidebar.js", "hover:text-foreground"],
  ["panel selected row", "--sidebar-primary-foreground", "--sidebar-primary",
    "app/components/layout/SettingsSidebar.js", "bg-sidebar-primary"],
  ["panel filter text", "--foreground", "--background",
    "app/components/layout/NavFilter.js", "bg-background"],
  ["panel filter placeholder", "--muted-foreground", "--background",
    "app/components/layout/NavFilter.js", "placeholder:text-muted-foreground"],
];

// fill, its own background, and the file/class that paints it.
const HOVER_FILLS = [
  ["rail hover fill", "--sidebar-accent", "--sidebar",
    "app/components/layout/AdminSidebar.js", "hover:bg-sidebar-accent"],
  ["panel hover fill", "--sidebar-panel-accent", "--card",
    "app/components/layout/SettingsSidebar.js", "hover:bg-sidebar-panel-accent"],
];

const LADDERS = [
  ["rail", "--sidebar", "--sidebar-accent", "--sidebar-primary"],
  ["panel", "--card", "--sidebar-panel-accent", "--sidebar-primary"],
];

console.log("Sidebar contrast — computed from app/globals.css\n");

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

  for (const [name, fillTok, bgTok, file, cls] of HOVER_FILLS) {
    const c = contrast(tok[fillTok], tok[bgTok]);
    ok(`${name} ${tok[fillTok]} vs ${tok[bgTok]}`,
      c >= HOVER_MIN && c <= HOVER_MAX, `${r2(c)}:1 (band ${HOVER_MIN}-${HOVER_MAX})`);
    ok(`  ^ ${cls} present in ${path.basename(file)}`, read(file).includes(cls));
  }

  // idle is the bare surface, so its separation from itself is exactly 1.
  for (const [name, bgTok, hoverTok, selTok] of LADDERS) {
    const rungs = [1, contrast(tok[hoverTok], tok[bgTok]), contrast(tok[selTok], tok[bgTok])];
    const rising = rungs.every((v, i) => i === 0 || v > rungs[i - 1]);
    ok(`${name} ladder idle < hover < selected`, rising, rungs.map(r2).join(" -> "));
  }
  console.log("");
}

// Comments in these files quote the classes they replaced, by design — the
// reasoning is worth keeping next to the fix. So the "must not come back"
// greps run on code only, or every explanation would fail its own check.
// Line comments go FIRST. Reversed, the `/*` inside SettingsSidebar's own
// header line — "Secondary sidebar for /app/settings/*." — opens a block that
// runs to the first `*/` four hundred lines later, silently deleting the code
// every grep below is meant to inspect. That mistake makes checks pass by
// having nothing left to look at, which is worse than failing.
function stripComments(src) {
  return src.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, " ");
}

// Alpha over a surface yields a different ratio on every surface it lands on,
// so nothing above could assert it. These were the unmeasurable classes that
// produced the 3.22:1 group headings; they must not come back.
console.log(" no unmeasurable alpha text on either sidebar");
for (const file of [
  "app/components/layout/AdminSidebar.js",
  "app/components/layout/SettingsSidebar.js",
]) {
  const code = stripComments(read(file));
  const alpha = [...code.matchAll(/text-(?:sidebar-)?(?:muted-)?foreground\/\d+/g)].map((m) => m[0]);
  ok(`${path.basename(file)} has no text-*foreground/NN`, alpha.length === 0, alpha.join(" "));
}
// --inverted is a BUTTON token; in dark mode it is 1.57:1 against the card, so
// a nav row painted with it is a selected state weaker than its own hover.
const settingsCode = stripComments(read("app/components/layout/SettingsSidebar.js"));
ok("SettingsSidebar no longer paints active rows with bg-inverted",
  !settingsCode.includes("bg-inverted"));
ok("SettingsSidebar no longer hovers with bg-muted (1.12:1)",
  !settingsCode.includes("hover:bg-muted"));

// A fill strong enough to SEE is strong enough to swallow muted text. Checking
// "is the class somewhere in the file" is not enough here — the group header
// also carries hover:text-foreground, so a row that lost its own copy still
// passed. The rule is per class string: anything that pairs muted text with the
// panel's hover fill has to raise the text with it.
const mutedOnFill = Object.entries(THEMES).map(([theme, tok]) => [
  theme,
  contrast(tok["--muted-foreground"], tok["--sidebar-panel-accent"]),
]);
const rowStrings = [...settingsCode.matchAll(/"([^"\n]*)"/g)]
  .map((m) => m[1])
  .filter((s) => s.includes("text-muted-foreground") && s.includes("hover:bg-sidebar-panel-accent"));
const unlifted = rowStrings.filter((s) => !s.includes("hover:text-foreground"));
ok("panel: every muted row that gains a hover fill also lifts its text",
  rowStrings.length > 0 && unlifted.length === 0,
  `${rowStrings.length} such row(s); muted-on-fill would be ` +
    mutedOnFill.map(([t, c]) => `${t} ${r2(c)}:1`).join(", "));
console.log("");

// ── Navigation structure, parsed from the components ───────────────────────

function sliceArray(src, decl) {
  const start = src.indexOf(decl);
  if (start < 0) throw new Error(`missing ${decl}`);
  let i = src.indexOf("[", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "[") depth++;
    else if (src[j] === "]" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`unterminated ${decl}`);
}

/** Groups exactly as the component declares them: key, pinned, items. */
function parseGroups(src, decl, groupKeyPrefix) {
  const block = sliceArray(src, decl);
  const groups = [];
  const headers = [
    ...block.matchAll(
      new RegExp(`key:\\s*"(${groupKeyPrefix}[^"]+)"\\s*,\\s*(pinned:\\s*true\\s*,\\s*)?items:\\s*\\[`, "g"),
    ),
  ];
  for (let n = 0; n < headers.length; n++) {
    const from = headers[n].index + headers[n][0].length;
    const to = n + 1 < headers.length ? headers[n + 1].index : block.length;
    const items = [];
    for (const line of block.slice(from, to).split("\n")) {
      const key = line.match(/key:\s*"(app\.[^"]+)"/);
      const href = line.match(/href:\s*"([^"]+)"/);
      if (!key || !href) continue;
      const tour = line.match(/tour:\s*"([^"]+)"/);
      items.push({ key: key[1], href: href[1], ...(tour ? { tour: tour[1] } : {}) });
    }
    groups.push({ key: headers[n][1], pinned: Boolean(headers[n][2]), items });
  }
  return groups;
}

const adminSrc = read("app/components/layout/AdminSidebar.js");
const settingsSrc = read("app/components/layout/SettingsSidebar.js");
const NAV = parseGroups(adminSrc, "const NAV_GROUPS = [", "app\\.nav\\.group\\.");
const SETTINGS = parseGroups(settingsSrc, "const GROUPS = [", "app\\.settings\\.group\\.");

const en = APP_MESSAGES.en;
const label = (key) => en[key] || key;

console.log("Navigation structure\n");

// A regex that silently matched nothing would make every assertion below pass
// on an empty list. Pin the shape first.
ok("parsed the main rail", NAV.length >= 4 && NAV.flatMap((g) => g.items).length >= 20,
  `${NAV.length} groups / ${NAV.flatMap((g) => g.items).length} items`);
ok("parsed the settings panel",
  SETTINGS.length >= 8 && SETTINGS.flatMap((g) => g.items).length >= 30,
  `${SETTINGS.length} groups / ${SETTINGS.flatMap((g) => g.items).length} items`);

for (const [name, groups] of [["rail", NAV], ["panel", SETTINGS]]) {
  const items = groups.flatMap((g) => g.items);
  const missing = items.filter((i) => !en[i.key]);
  ok(`${name}: every item label is translated`, missing.length === 0,
    missing.map((i) => i.key).join(" "));
  const missingGroup = groups.filter((g) => !en[g.key]);
  ok(`${name}: every group label is translated`, missingGroup.length === 0,
    missingGroup.map((g) => g.key).join(" "));
}

// ── Reachability: collapsing must never be the only thing between a user and
// a page. Asserted against the real navDisclosure rules, per item.

const CLOSED = new Set(); // the worst case: nothing open

for (const [name, groups] of [["rail", NAV], ["panel", SETTINGS]]) {
  const items = groups.flatMap((g) => g.items);

  const unreachableBySearch = items.filter((item) => {
    const found = filterGroups(groups, label(item.key), label);
    return !found.some((g) => g.items.some((i) => i.href === item.href));
  });
  ok(`${name}: every item is found by typing its own label`,
    unreachableBySearch.length === 0, unreachableBySearch.map((i) => i.key).join(" "));

  const headers = visibleGroups({ groups, query: "", label });
  ok(`${name}: every group header renders with nothing open`,
    headers.length === groups.length, `${headers.length}/${groups.length}`);

  const whenSearching = items.filter((item) => {
    const shown = visibleItems({ groups, query: label(item.key), openKeys: CLOSED, label });
    return !shown.some((i) => i.href === item.href);
  });
  ok(`${name}: a query overrides every collapsed group`,
    whenSearching.length === 0, whenSearching.map((i) => i.key).join(" "));

  // With nothing open and no query, only pinned groups may show items — and
  // anything hidden must still have its header on screen to reopen it.
  const shownIdle = visibleItems({ groups, query: "", openKeys: CLOSED, label });
  const pinnedItems = groups.filter((g) => g.pinned).flatMap((g) => g.items);
  ok(`${name}: closed groups actually hide their items`,
    shownIdle.length === pinnedItems.length, `${shownIdle.length} shown, ${pinnedItems.length} pinned`);
}

// The icon rail has no headers to click, so it must ignore disclosure entirely
// — otherwise a collapsed rail plus a collapsed group hides a page with no
// control anywhere on screen to bring it back.
const railAll = visibleItems({
  groups: NAV, query: "", openKeys: CLOSED, label, railCollapsed: true,
});
ok("rail: the 76px icon rail shows every item regardless of disclosure",
  railAll.length === NAV.flatMap((g) => g.items).length,
  `${railAll.length}/${NAV.flatMap((g) => g.items).length}`);

// ── The tour coupling, made enforceable ────────────────────────────────────
//
// OnboardingTour needs a target that measures non-zero, and a collapsed group
// unmounts its items. Any group holding a tour anchor must therefore be pinned.
for (const [name, groups] of [["rail", NAV], ["panel", SETTINGS]]) {
  const bad = groups.filter((g) => g.items.some((i) => i.tour) && !g.pinned);
  ok(`${name}: groups holding a data-tour anchor are pinned`, bad.length === 0,
    bad.map((g) => g.key).join(" "));
}
const anchors = [...read("app/components/tours.js").matchAll(/data-tour='(nav-[^']+)'/g)]
  .map((m) => m[1]);
const rendered = new Set([...adminSrc.matchAll(/tour:\s*"([^"]+)"/g)].map((m) => m[1]));
const orphans = [...new Set(anchors)].filter((a) => !rendered.has(a));
ok("every nav anchor the tour points at is still declared in the rail",
  orphans.length === 0, orphans.join(" "));

// ── Disclosure semantics ───────────────────────────────────────────────────

const anyGroup = SETTINGS[1].key;
ok("the active group opens even when stored state says closed",
  initialOpenKeys({ defaultOpenKeys: [], overrides: { [anyGroup]: false }, active: anyGroup })
    .has(anyGroup));
ok("a stored preference survives the defaults",
  !initialOpenKeys({ defaultOpenKeys: [anyGroup], overrides: { [anyGroup]: false } }).has(anyGroup));
ok("a pinned group is open with nothing stored and no query",
  isGroupOpen({ group: { key: "x", pinned: true }, openKeys: CLOSED }));
ok("an unpinned group is closed with nothing stored and no query",
  !isGroupOpen({ group: { key: "x" }, openKeys: CLOSED }));

// Disclosure is a browser preference, not a record. A schema field would have
// to be read, written and migrated per device for no gain — and a nav that
// waits on a fetch to know what to draw flickers on every load.
ok("both sidebars name a distinct localStorage key",
  adminSrc.includes('"fq-nav-groups"') && settingsSrc.includes('"fq-settings-groups"'));
ok("disclosure persists through localStorage only",
  read("app/components/layout/navDisclosure.js").includes("window.localStorage"));
ok("disclosure adds no schema field",
  !/groupsOpen|sidebarGroups|navDisclosure/i.test(read("prisma/schema.prisma")));
ok("disclosure costs no network round trip",
  !stripComments(read("app/components/layout/NavFilter.js")).includes("fetch("));

// The filter box exists once and is used twice.
ok("both sidebars use the shared filter rather than a private copy",
  adminSrc.includes("<NavFilter") && settingsSrc.includes("<NavFilter"));
ok("the main rail can search the items its own groups do not hold",
  adminSrc.includes("SEARCH_CORPUS") && adminSrc.includes("BOTTOM_ITEMS]"));

// ── The dark wordmark: constant and filesystem must agree ──────────────────
//
// Presence is decided at module level so there is never a runtime 404 or a
// broken-image flash. That only stays honest if nobody can drop the file in and
// forget to wire it, or wire it and forget the file.
// Three states, and the middle one is the trap. A file carrying the dark name
// that is byte-for-byte the LIGHT artwork is not a dark asset — wiring it puts
// the navy wordmark on navy chrome, i.e. an invisible logo, which is the exact
// failure the composed onDark fallback exists to prevent. A placeholder copy
// must fail loudly rather than be mistaken for the real thing.
const DARK_LOGO = "public/logo/FieldQuo_logo_horizontal_outlined_dark.png";
const LIGHT_LOGO = "public/logo/FieldQuo_logo_horizontal_outlined.png";
const logoSrc = read("app/components/Logo.js");
const declared = logoSrc.match(/const DARK_HORIZONTAL\s*=\s*(null|\{)/);
const onDisk = fs.existsSync(path.join(ROOT, DARK_LOGO));
const isCopy =
  onDisk &&
  fs.readFileSync(path.join(ROOT, DARK_LOGO)).equals(fs.readFileSync(path.join(ROOT, LIGHT_LOGO)));

ok("Logo declares DARK_HORIZONTAL", Boolean(declared));
ok("the expected dark-asset path is named in Logo.js",
  logoSrc.includes("FieldQuo_logo_horizontal_outlined_dark.png"));
// A warning, not a failure: with DARK_HORIZONTAL null the fallback is correct
// and nothing on screen is wrong. What it IS is a trap — the next person sees
// the filename, assumes artwork, and wires it. Wiring it stays a hard failure
// below, so the trap cannot actually spring.
warn(`${DARK_LOGO} is not a renamed copy of the light artwork`, !isCopy,
  isCopy
    ? "byte-identical to the light wordmark; its ink is navy, so it would be\n       invisible on the navy rail. Delete it, or replace it with real\n       light-ink artwork and set DARK_HORIZONTAL."
    : "");

if (declared) {
  const isNull = declared[1] === "null";
  const usable = onDisk && !isCopy;
  ok(
    isNull
      ? "no usable dark wordmark, so the composed onDark fallback is used"
      : "DARK_HORIZONTAL is wired to real artwork on disk",
    isNull ? !usable : usable,
    isNull && usable
      ? `${DARK_LOGO} is usable — set DARK_HORIZONTAL to its measured dimensions`
      : !isNull && !usable
        ? `DARK_HORIZONTAL points at ${DARK_LOGO}, which is missing or a copy`
        : "",
  );
}

// ══ The tab bar's "More" reaches the drawer through the DOM ════════════════
//
// MobileTabBar cannot call AdminSidebar's `setMobileOpen` — it is local state
// with no exported setter and no context. So "More" clicks the real hamburger
// node by attribute, which is not invented: app/components/OnboardingTour.js
// already opens the same drawer the same way, because the welcome tour has to
// point at rows living inside it.
//
// The cost of that choice is a SILENT failure. openAdminDrawer() does nothing
// at all if the node is gone — `if (trigger instanceof HTMLElement)` and no
// else — so renaming or dropping the attribute leaves a "More" button that
// looks fine and opens nothing. Two consumers now depend on a string in a
// third file, and nothing else in the repo would notice.
//
// Asserted here rather than in a new check script because the check:all chain
// is being edited by several agents at once and a new entry would conflict;
// this file already parses AdminSidebar, so it is the right home anyway.
const TAB_BAR = "app/components/layout/MobileTabBar.js";
const TOUR = "app/components/OnboardingTour.js";
const DRAWER_HOOK = 'data-tour-open="nav"';

const sidebarSrc = read("app/components/layout/AdminSidebar.js");
ok(
  `AdminSidebar still renders ${DRAWER_HOOK} on its hamburger`,
  sidebarSrc.includes(DRAWER_HOOK),
  sidebarSrc.includes(DRAWER_HOOK)
    ? ""
    : "MobileTabBar's More button and OnboardingTour both click this node to open\n       the drawer. Without it both fail silently — the button opens nothing.",
);
ok(
  "MobileTabBar targets that same attribute",
  read(TAB_BAR).includes(DRAWER_HOOK),
  read(TAB_BAR).includes(DRAWER_HOOK)
    ? ""
    : "the tab bar's More button no longer matches the node AdminSidebar renders",
);
ok(
  "OnboardingTour targets it too, so the two agree",
  read(TOUR).includes("data-tour-open"),
  read(TOUR).includes("data-tour-open")
    ? ""
    : "the tour opened the drawer this way first; if it has moved on, MobileTabBar\n       is now the only caller and this coupling should be reconsidered",
);

console.log(
  `\n${checks} checks, ${failures} failure(s)${warnings ? `, ${warnings} warning(s)` : ""}.`,
);
process.exit(failures ? 1 : 0);
