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
  exclusiveToggle,
  filterGroups,
  initialExclusiveKey,
  initialOpenKeys,
  isGroupOpen,
  visibleGroups,
  visibleItems,
} from "../app/components/layout/navDisclosure.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
// Plain data, no imports — safe under bare node (see its own header).
import { TOURS } from "../app/components/tours.js";
// The tour's undo planner — pure, no imports (see its own section).
import { tourUndoClicks } from "../lib/tours/anchor.js";

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
  ["rail More count", "--sidebar-accent-foreground", "--sidebar-accent",
    "app/components/layout/AdminSidebar.js", "bg-sidebar-accent text-sidebar-accent-foreground"],
  ["rail filter text", "--sidebar-foreground", "--sidebar-accent",
    "app/components/layout/NavFilter.js", "bg-sidebar-accent"],
  ["rail filter placeholder", "--sidebar-muted-foreground", "--sidebar-accent",
    "app/components/layout/NavFilter.js", "placeholder:text-sidebar-muted-foreground"],
  // ── the settings list, which slides INTO the rail (2026-09-21) ──
  ["settings panel idle row", "--sidebar-muted-foreground", "--sidebar",
    "app/components/layout/SettingsSidebar.js", "text-sidebar-muted-foreground"],
  ["settings panel hover row", "--sidebar-accent-foreground", "--sidebar-accent",
    "app/components/layout/SettingsSidebar.js", "hover:text-sidebar-accent-foreground"],
  ["settings panel selected row", "--sidebar-primary-foreground", "--sidebar-primary",
    "app/components/layout/SettingsSidebar.js", "bg-sidebar-primary"],
  // ── the lists that sit on a card: the settings index, the More tiles, the
  //    phone's section strip, the search palette ──
  ["panel idle row", "--muted-foreground", "--card",
    "app/app/settings/page.js", "text-muted-foreground"],
  ["panel hover row", "--foreground", "--sidebar-panel-accent",
    "app/app/settings/page.js", "hover:bg-sidebar-panel-accent"],
  ["panel hover row text", "--foreground", "--sidebar-panel-accent",
    "app/app/settings/page.js", "hover:text-foreground"],
  ["More tile idle row", "--muted-foreground", "--card",
    "app/components/layout/MoreMenu.js", "text-muted-foreground"],
  ["More tile hover row", "--foreground", "--sidebar-panel-accent",
    "app/components/layout/MoreMenu.js", "hover:bg-sidebar-panel-accent"],
  ["More tile selected row", "--sidebar-primary-foreground", "--sidebar-primary",
    "app/components/layout/MoreMenu.js", "bg-sidebar-primary"],
  // The chip class moved to SettingsTabStrip.js (2026-10-03) so Manage
  // Team's and the HR screens' in-page rows draw the same chip. The phone
  // strip sits on the card; the in-page rows sit on the page background.
  ["phone settings strip chip", "--muted-foreground", "--card",
    "app/components/settings/SettingsTabStrip.js", "text-muted-foreground border-border"],
  ["in-page settings tab chip", "--muted-foreground", "--background",
    "app/components/settings/SettingsTabStrip.js", "text-muted-foreground border-border"],
  ["settings tab chip hover", "--foreground", "--sidebar-panel-accent",
    "app/components/settings/SettingsTabStrip.js", "hover:bg-sidebar-panel-accent hover:text-foreground"],
  ["settings tab chip current", "--sidebar-primary-foreground", "--sidebar-primary",
    "app/components/settings/SettingsTabStrip.js", "bg-sidebar-primary text-sidebar-primary-foreground"],
  ["phone strip uses the shared chip", "--muted-foreground", "--card",
    "app/components/layout/SettingsSidebar.js", "settingsChipClass(active)"],
  ["search result text", "--foreground", "--card",
    "app/components/layout/GlobalSearch.js", "text-foreground"],
  ["search result highlighted", "--foreground", "--muted",
    "app/components/layout/GlobalSearch.js", "bg-muted"],
  ["search result meta on highlight", "--muted-foreground", "--muted",
    "app/components/layout/GlobalSearch.js", "text-muted-foreground"],
  ["top bar crumb", "--muted-foreground", "--card",
    "app/components/layout/TopBar.js", "text-muted-foreground"],
  ["top bar Create pill", "--inverted-foreground", "--inverted",
    "app/components/layout/CreateMenu.js", "bg-inverted text-inverted-foreground"],
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
    "app/app/settings/page.js", "hover:bg-sidebar-panel-accent"],
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
console.log(" no unmeasurable alpha text on any shell surface");
for (const file of [
  "app/components/layout/AdminSidebar.js",
  "app/components/layout/SettingsSidebar.js",
  "app/components/layout/TopBar.js",
  "app/components/layout/MoreMenu.js",
  "app/components/layout/GlobalSearch.js",
  "app/components/layout/CreateMenu.js",
  "app/components/layout/AccountMenu.js",
  "app/app/settings/page.js",
  "app/app/more/page.js",
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
// The lists on a card: the settings index and the More tiles.
const cardListCode = [
  stripComments(read("app/app/settings/page.js")),
  stripComments(read("app/components/layout/MoreMenu.js")),
].join("\n");
ok("the settings index and More tiles never paint rows with bg-inverted",
  !cardListCode.includes("bg-inverted"));
ok("the settings index and More tiles never hover with bg-muted (1.12:1)",
  !cardListCode.includes("hover:bg-muted"));

// A fill strong enough to SEE is strong enough to swallow muted text. Checking
// "is the class somewhere in the file" is not enough here — the group header
// also carries hover:text-foreground, so a row that lost its own copy still
// passed. The rule is per class string: anything that pairs muted text with the
// panel's hover fill has to raise the text with it.
const mutedOnFill = Object.entries(THEMES).map(([theme, tok]) => [
  theme,
  contrast(tok["--muted-foreground"], tok["--sidebar-panel-accent"]),
]);
const rowStrings = [...(settingsCode + cardListCode).matchAll(/"([^"\n]*)"/g)]
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
const MORE = parseGroups(adminSrc, "const MORE_GROUPS = [", "app\\.nav\\.group\\.");
const SETTINGS = parseGroups(settingsSrc, "const GROUPS = [", "app\\.settings\\.group\\.");

const en = APP_MESSAGES.en;
const label = (key) => en[key] || key;

console.log("Navigation structure\n");

// A regex that silently matched nothing would make every assertion below pass
// on an empty list. Pin the shape first.
// Seventeen rows in five groups since 2026-09-21 (the shell reorganisation);
// the rest of the rail moved to MORE_GROUPS. check-shell.mjs holds the
// ≤ 17 ceiling and the reachability proof; this pins the parse.
ok("parsed the main rail", NAV.length >= 4 && NAV.flatMap((g) => g.items).length >= 12,
  `${NAV.length} groups / ${NAV.flatMap((g) => g.items).length} items`);
ok("parsed the More groups", MORE.length >= 3 && MORE.flatMap((g) => g.items).length >= 15,
  `${MORE.length} groups / ${MORE.flatMap((g) => g.items).length} items`);
ok("parsed the settings panel",
  SETTINGS.length >= 8 && SETTINGS.flatMap((g) => g.items).length >= 30,
  `${SETTINGS.length} groups / ${SETTINGS.flatMap((g) => g.items).length} items`);

for (const [name, groups] of [["rail", NAV], ["more", MORE], ["panel", SETTINGS]]) {
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

for (const [name, groups] of [["rail", NAV], ["more", MORE], ["panel", SETTINGS]]) {
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

  // With nothing open and no query, NO group may show items — every group
  // folds since 2026-09-29 (owner: "every sidebar that has accordion") — and
  // anything hidden still has its header on screen to reopen it.
  const shownIdle = visibleItems({ groups, query: "", openKeys: CLOSED, label });
  ok(`${name}: closed groups actually hide their items (none held open)`,
    shownIdle.length === 0, `${shownIdle.length} shown`);
  const pinned = groups.filter((g) => g.pinned).map((g) => g.key);
  ok(`${name}: no group is pinned open`, pinned.length === 0, pinned.join(" "));
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
// unmounts its items. So a group holding a tour anchor is either pinned, or
// (since 2026-09-24) EVERY tour step aimed at one of its rows names the
// group's header as an opener — `[data-tour-open='nav-group-<name>']` — and
// the header renders that hook. The tour then unfolds the group itself and
// folds it back; see OnboardingTour's `owed` closers. What this still refuses
// is the original failure: a foldable group with a tour row and no way for
// the tour to open it.
const hookFor = (groupKey) => `nav-group-${groupKey.split(".").pop()}`;
const stepsByAnchor = new Map();
for (const tour of TOURS) {
  for (const step of tour.steps) {
    const anchor = /data-tour='([^']+)'/.exec(step.target || "")?.[1];
    if (!anchor) continue;
    if (!stepsByAnchor.has(anchor)) stepsByAnchor.set(anchor, []);
    stepsByAnchor.get(anchor).push({ tour: tour.key, step });
  }
}
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
for (const [name, groups] of [["rail", NAV], ["more", MORE], ["panel", SETTINGS]]) {
  const bad = [];
  for (const g of groups) {
    for (const item of g.items.filter((i) => i.tour)) {
      const opener = `[data-tour-open='${hookFor(g.key)}']`;
      for (const { tour, step } of stepsByAnchor.get(item.tour) || []) {
        if (!asList(step.openWith).includes(opener) || !asList(step.closeWith).includes(opener)) {
          bad.push(`${tour}:${item.tour} (needs ${opener})`);
        }
      }
    }
  }
  ok(`${name}: a tour row in a foldable group is opened (and closed) through its header`,
    bad.length === 0, bad.join(" "));
}
// The header really carries the hook, computed the way the check computes it.
ok("the foldable group header renders data-tour-open={groupTourHook(group.key)}",
  /data-tour-open=\{groupTourHook\(group\.key\)\}/.test(adminSrc)
    && /return `nav-group-\$\{String\(groupKey\)\.split\("\."\)\.pop\(\)\}`/.test(adminSrc));
const anchors = [...read("app/components/tours.js").matchAll(/data-tour='(nav-[^']+)'/g)]
  .map((m) => m[1]);
const rendered = new Set([...adminSrc.matchAll(/tour:\s*"([^"]+)"/g)].map((m) => m[1]));
const orphans = [...new Set(anchors)].filter((a) => !rendered.has(a));
ok("every nav anchor the tour points at is still declared in the rail",
  orphans.length === 0, orphans.join(" "));
// …and declared in NAV_GROUPS or the Settings foot, never in MORE_GROUPS: a
// More row renders on /app/more and in a sheet, not in the rail the tour
// measures.
const moreTours = MORE.flatMap((g) => g.items).filter((i) => i.tour);
ok("no tour anchor sits on a More row", moreTours.length === 0, moreTours.map((i) => i.key).join(" "));

// ── Disclosure semantics ───────────────────────────────────────────────────

const anyGroup = SETTINGS[1].key;
ok("the active group opens even when stored state says closed",
  initialOpenKeys({ defaultOpenKeys: [], overrides: { [anyGroup]: false }, active: anyGroup })
    .has(anyGroup));
ok("a stored preference survives the defaults",
  !initialOpenKeys({ defaultOpenKeys: [anyGroup], overrides: { [anyGroup]: false } }).has(anyGroup));
ok("the retired `pinned` flag no longer holds a group open",
  !isGroupOpen({ group: { key: "x", pinned: true }, openKeys: CLOSED }));
ok("a group is closed with nothing stored and no query",
  !isGroupOpen({ group: { key: "x" }, openKeys: CLOSED }));
ok("navDisclosure has no pinned branch left",
  !/\bpinned\b/.test(stripComments(read("app/components/layout/navDisclosure.js"))));

// One open at a time (owner, 2026-09-29) — the rule both sidebars now use.
const [gA, gB, gC] = SETTINGS.map((g) => g.key);
ok("exclusive: opening a group closes every other",
  [...exclusiveToggle(new Set([gA]), gB)].join() === gB);
ok("exclusive: clicking the open group closes it (nothing open)",
  exclusiveToggle(new Set([gA]), gA).size === 0);
ok("exclusive: the current page's group wins over the stored one",
  initialExclusiveKey({ defaultOpenKeys: [gA], overrides: { [gB]: true }, active: gC }) === gC);
ok("exclusive: with no current group, the last group the user opened reopens",
  initialExclusiveKey({ defaultOpenKeys: [gA], overrides: { [gA]: false, [gB]: true } }) === gB);
ok("exclusive: first visit opens exactly the first default",
  initialExclusiveKey({ defaultOpenKeys: [gA, gB], overrides: {} }) === gA);
ok("exclusive: a query still shows every group whatever is folded",
  isGroupOpen({ group: { key: gB }, openKeys: new Set([gA]), searching: true }));

// ── Every accordion sidebar is exclusive, none pinned (owner, 2026-09-29) ──
//
// "For every sidebar that has accordion": found by the hook, not by a list of
// file names, so a fourth accordion added later is held to the same rule the
// day it lands. Each useGroupDisclosure call must pass `exclusive: true`.
{
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(rel); }
      else if (/\.(js|jsx|mjs)$/.test(e.name)) files.push(rel);
    }
  };
  walk("app");
  const calls = [];
  for (const f of files) {
    const src = stripComments(read(f));
    for (const m of src.matchAll(/(?<!function )useGroupDisclosure\(\{([\s\S]*?)\}\)/g)) calls.push({ f, args: m[1] });
  }
  const callers = new Set(calls.map((c) => c.f));
  ok("found every accordion sidebar by its hook (rail, settings, /platform)",
    ["app/components/layout/AdminSidebar.js", "app/components/layout/SettingsSidebar.js", "app/components/platform/PlatformSidebar.js"]
      .every((f) => callers.has(f)), [...callers].join(" "));
  const notExclusive = calls.filter((c) => !/\bexclusive:\s*true\b/.test(c.args)).map((c) => c.f);
  ok("every useGroupDisclosure call passes exclusive: true", notExclusive.length === 0, notExclusive.join(" "));
  const platformGroups = sliceArray(read("app/components/platform/PlatformSidebar.js"), "const GROUPS = [");
  ok("no /platform group is pinned", !/\bpinned\s*:/.test(stripComments(platformGroups)));
  ok("no /app rail or settings group is pinned",
    !/\bpinned\s*:/.test(stripComments(sliceArray(adminSrc, "const NAV_GROUPS = ["))) &&
      !/\bpinned\s*:/.test(stripComments(sliceArray(settingsSrc, "const GROUPS = ["))));
}

// ── The welcome tour on a folded rail, executed ────────────────────────────
//
// Work and AI used to be pinned so the walkthrough could see their rows. Now
// the tour unfolds each row's group through its header. Run the real steps
// against the real exclusive toggle from every starting fold the reader could
// have left — each group alone, and nothing — and require (a) every grouped
// anchor is on screen when its step runs, (b) the undo puts the reader's fold
// back exactly. (b) is the case the old replay-in-reverse undo got wrong.
{
  const hookSel = (k) => `[data-tour-open='${hookFor(k)}']`;
  const keyOfHook = new Map(NAV.map((g) => [hookSel(g.key), g.key]));
  const groupOfAnchor = new Map(NAV.flatMap((g) => g.items.filter((i) => i.tour).map((i) => [i.tour, g.key])));
  const welcome = TOURS.find((t) => t.match("/app") && t.steps.some((st) => /nav-requests/.test(st.target)));
  ok("found the welcome tour", Boolean(welcome));
  const grouped = (welcome?.steps || []).filter((st) => groupOfAnchor.has(/data-tour='([^']+)'/.exec(st.target)?.[1]));
  ok("the welcome tour visits rows in every rail group that holds an anchor",
    new Set(grouped.map((st) => groupOfAnchor.get(/data-tour='([^']+)'/.exec(st.target)[1]))).size ===
      new Set(groupOfAnchor.values()).size);
  const simulate = (start) => {
    let open = new Set(start);
    const owed = [];
    let restore = null;
    const missed = [];
    for (const step of grouped) {
      const anchor = /data-tour='([^']+)'/.exec(step.target)[1];
      const seen = () => visibleItems({ groups: NAV, query: "", openKeys: open, label }).some((i) => i.tour === anchor);
      const openers = asList(step.openWith);
      const closers = asList(step.closeWith);
      for (let i = 0; i < openers.length && !seen(); i++) {
        const key = keyOfHook.get(openers[i]);
        if (!key) continue; // the drawer's hamburger: display:none on a desktop
        const toggle = closers[i] === openers[i];
        if (toggle && restore === null) restore = [...open].map(hookSel);
        open = exclusiveToggle(open, key);
        if (closers[i] && !owed.some((o) => o.selector === closers[i])) owed.push({ selector: closers[i], toggle });
      }
      if (!seen()) missed.push(anchor);
    }
    const wasOpen = new Set(open);
    for (const sel of tourUndoClicks({ owed, expandedNow: [...wasOpen].map(hookSel), restore })) {
      const key = keyOfHook.get(sel);
      if (key) open = exclusiveToggle(open, key);
    }
    return { missed, end: [...open].sort().join(), start: [...start].sort().join() };
  };
  for (const start of [[], ...NAV.map((g) => [g.key])]) {
    const r = simulate(start);
    const name = start.length ? start[0].split(".").pop() : "nothing";
    ok(`tour from a rail with ${name} open: every grouped anchor is on screen at its step`,
      r.missed.length === 0, r.missed.join(" "));
    ok(`tour from a rail with ${name} open: the reader's fold is put back`, r.end === r.start, `${r.start} -> ${r.end}`);
  }
  // Icon rail: no headers, every row drawn — the tour needs no opener at all.
  ok("tour on the icon rail: every anchor is drawn with nothing open",
    [...groupOfAnchor.keys()].every((a) =>
      visibleItems({ groups: NAV, query: "", openKeys: CLOSED, label, railCollapsed: true }).some((i) => i.tour === a)));
}

// tourUndoClicks against hostile input.
{
  const G = "[data-tour-open='nav-group-grow']";
  const P = "[data-tour-open='nav-group-people']";
  const W = "[data-tour-open='nav-group-work']";
  const X = "[data-tour-close='nav']";
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok("undo: no args, no clicks", same(tourUndoClicks(), []) && same(tourUndoClicks({ owed: null, expandedNow: null, restore: null }), []));
  ok("undo: junk entries in owed are ignored", same(tourUndoClicks({ owed: [null, {}, { selector: "" }], expandedNow: [] }), []));
  ok("undo: a group the tour opened and is open now is folded",
    same(tourUndoClicks({ owed: [{ selector: G, toggle: true }], expandedNow: [G], restore: [] }), [G]));
  ok("undo: a group the tour opened but that is already shut is NOT clicked (that would reopen it)",
    same(tourUndoClicks({ owed: [{ selector: P, toggle: true }, { selector: G, toggle: true }], expandedNow: [G], restore: [] }), [G]));
  ok("undo: the reader's own group is reopened after the fold",
    same(tourUndoClicks({ owed: [{ selector: G, toggle: true }], expandedNow: [G], restore: [W] }), [G, W]));
  ok("undo: the tour ending in the reader's own group clicks nothing",
    same(tourUndoClicks({ owed: [{ selector: W, toggle: true }], expandedNow: [W], restore: [W] }), []));
  ok("undo: the drawer closes last, after the headers inside it",
    same(tourUndoClicks({ owed: [{ selector: X, toggle: false }, { selector: G, toggle: true }], expandedNow: [G], restore: [] }), [G, X]));
  ok("undo: a duplicated owed entry is clicked once",
    same(tourUndoClicks({ owed: [{ selector: G, toggle: true }, { selector: G, toggle: true }], expandedNow: [G], restore: null }), [G]));
  ok("undo: restore null (no header clicked) never reopens anything",
    same(tourUndoClicks({ owed: [{ selector: X, toggle: false }], expandedNow: [W], restore: null }), [X]));
}

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

// The filter box exists once and is used twice: the settings list that
// slides into the rail, and the settings index. The rail's own box is the
// GLOBAL search (GlobalSearch.js) since 2026-09-21 — not a second filter over
// the menu — and its corpus is every rail row, every More row, Home and the
// account rows, so no row is out of its reach.
ok("the settings panel and the settings index use the shared filter rather than a private copy",
  settingsSrc.includes("<NavFilter") && read("app/app/settings/page.js").includes("<NavFilter"));
ok("the rail's search box opens the global palette",
  stripComments(adminSrc).includes('shell.open("search")'));
ok("the global search corpus holds every rail row, every More row, Home and the account rows",
  adminSrc.includes("SEARCH_CORPUS") && adminSrc.includes("...MORE_GROUPS") &&
    adminSrc.includes("HOME_ITEM, ...NAV_GROUPS[0].items") && adminSrc.includes("[...BOTTOM_ITEMS]"));
ok("GlobalSearch searches that corpus through the rail's own three filters",
  read("app/components/layout/GlobalSearch.js").includes("useNavGroups(SEARCH_CORPUS)"));

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

// ══ The tab bar's "More", the hamburger and the tour share one state ═══════
//
// MobileTabBar used to open AdminSidebar's drawer by clicking the hamburger's
// real DOM node (`[data-tour-open="nav"]`), because the drawer's state was
// private. Since 2026-09-21 the state lives in NavShellProvider (NavShell.js):
// the tab bar opens the More SHEET through it, the hamburger (now in
// TopBar.js) opens the DRAWER through it, and OnboardingTour still clicks the
// hamburger by attribute — so the attribute has to survive on the hamburger,
// and the tab bar must no longer depend on it.
const TAB_BAR = "app/components/layout/MobileTabBar.js";
const TOUR = "app/components/OnboardingTour.js";
const TOP_BAR = "app/components/layout/TopBar.js";
const DRAWER_HOOK = 'data-tour-open="nav"';

ok(`TopBar renders ${DRAWER_HOOK} on the hamburger`, read(TOP_BAR).includes(DRAWER_HOOK),
  "OnboardingTour clicks this node to open the drawer; without it the walkthrough opens nothing");
ok("OnboardingTour still targets it", read(TOUR).includes("data-tour-open"));
ok("MobileTabBar no longer reaches the drawer through the DOM",
  !stripComments(read(TAB_BAR)).includes("data-tour-open") && !stripComments(read(TAB_BAR)).includes("querySelector"));
ok("MobileTabBar's More opens the sheet through the shared shell state",
  /shell\.toggle\("more"\)/.test(read(TAB_BAR)) && read(TAB_BAR).includes("useNavShell"));
ok("AdminSidebar reads the drawer state from the same provider",
  adminSrc.includes("useNavShell") && adminSrc.includes('isOpen("drawer")'));
ok("the app layout mounts NavShellProvider once, above rail, top bar and tab bar",
  read("app/app/layout.js").includes("<NavShellProvider>") && read("app/app/layout.js").includes("<TopBar />"));

console.log(
  `\n${checks} checks, ${failures} failure(s)${warnings ? `, ${warnings} warning(s)` : ""}.`,
);
process.exit(failures ? 1 : 0);
