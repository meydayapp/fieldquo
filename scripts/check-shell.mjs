// scripts/check-shell.mjs
//
//   npm run check:shell
//
// The 2026-09-21 shell reorganisation, held to the owner's words:
//
//   "FieldQuo is very heavy on the side menus and settings menu" — so the
//   rail holds at most SEVENTEEN top-level rows (Jobber's count, measured in
//   docs/research/jobber-ui-study.md), in named groups, with the rest under
//   More.
//
//   "Now we shouldn't lose any of our great features — the AI review, agents,
//   scheduling, dispatching, etc." — so (a) every destination the rail and
//   the settings list carried BEFORE the change is still reachable within
//   two taps, on desktop and on a phone, proved by walking the nav data, not
//   by reading it; (b) a named list of FLAGSHIP rows is top-level and visible
//   without opening More; (c) the trade gate hides ONLY rows tied to a trade
//   the company has not enabled — never an AI, scheduling, dispatch, money
//   or people row.
//
// Also: the settings index lists every settings page; no href in any list
// is a dead link; every new label exists in all nine catalogues; every row
// is found by typing its own label into the global search's corpus; the
// records search asks the caller's grid per type.
//
// ── Why the rows are parsed and the rules are executed ──────────────────────
//
// The rows are parsed out of AdminSidebar.js and SettingsSidebar.js the way
// check-sidebar.mjs parses them (they are "use client" modules full of lucide
// and JSX). The RULES — trade gating, label matching, permission gating,
// which record types a member may search — are imported and run against
// those rows and against hostile grids. A restatement of a rule agrees with
// the component on the day it is written and silently stops agreeing later.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filterGroups } from "../app/components/layout/navDisclosure.js";
import {
  ROW_TRADE_GATE,
  NAV_ROW_TRADE_GATE,
  SETTINGS_ROW_TRADE_GATE,
  filterNavGroupsByTrade,
  filterSettingsGroupsByTrade,
} from "../lib/settings/tradeGateNav.js";
import { navRowAllowed, NAV_REQUIREMENTS } from "../lib/permissions/nav.js";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "../lib/permissions.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { normaliseQuery, searchableTypes } from "../app/api/search/route.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

// ── Parsing (the same shape check-sidebar.mjs uses) ─────────────────────────

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
function parseGroups(src, decl, prefix) {
  const block = sliceArray(src, decl);
  const headers = [...block.matchAll(new RegExp(`key:\\s*"(${prefix}[^"]+)"\\s*,\\s*(pinned:\\s*true\\s*,\\s*)?items:\\s*\\[`, "g"))];
  const groups = [];
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
function parseItems(src, decl) {
  return [...sliceArray(src, decl).matchAll(/\{ key: "(app\.[^"]+)", href: "([^"]+)"/g)].map((m) => ({ key: m[1], href: m[2] }));
}
function parseOne(src, name) {
  const m = src.match(new RegExp(`const ${name} = \\{ key: "(app\\.[^"]+)", href: "([^"]+)"`));
  return m ? { key: m[1], href: m[2] } : null;
}

const adminSrc = read("app/components/layout/AdminSidebar.js");
const settingsSrc = read("app/components/layout/SettingsSidebar.js");
const tabSrc = read("app/components/layout/MobileTabBar.js");
const moreSrc = read("app/components/layout/MoreMenu.js");

const NAV = parseGroups(adminSrc, "export const NAV_GROUPS = [", "app\\.nav\\.group\\.");
const MORE = parseGroups(adminSrc, "export const MORE_GROUPS = [", "app\\.nav\\.group\\.");
const BOTTOM = parseItems(adminSrc, "export const BOTTOM_ITEMS = [");
const QUICK = parseItems(adminSrc, "export const QUICK_ADD_ITEMS = [");
const HOME = parseOne(adminSrc, "HOME_ITEM");
const MORE_ROW = parseOne(adminSrc, "MORE_ITEM");
const SETTINGS = parseGroups(settingsSrc, "export const GROUPS = [", "app\\.settings\\.group\\.");
const TABS = parseItems(tabSrc, "export const TAB_ITEMS = [");

const railRows = [HOME, ...NAV.flatMap((g) => g.items)];
const moreRows = MORE.flatMap((g) => g.items);
const settingsRows = SETTINGS.flatMap((g) => g.items);
const en = APP_MESSAGES.en;
const label = (key) => en[key] || key;

section("Parsed the shell");
ok("Home, More, the rail groups, the More groups, the account rows, the tabs and the settings groups all parsed",
  HOME && MORE_ROW && NAV.length >= 4 && MORE.length >= 3 && BOTTOM.length === 3 && TABS.length === 5 && SETTINGS.length === 8,
  `rail ${NAV.length} groups / ${railRows.length} rows · More ${MORE.length} groups / ${moreRows.length} rows · settings ${SETTINGS.length} groups / ${settingsRows.length} rows`);

// ── 1. At most seventeen top-level rows, in named groups ───────────────────

section("1. The rail: at most seventeen top-level rows");
const CEILING = 17;
ok(`Home + the rail groups hold ≤ ${CEILING} rows`, railRows.length <= CEILING, `${railRows.length}`);
ok("every rail group is translated in English and French",
  NAV.every((g) => en[g.key] && APP_MESSAGES.fr[g.key]), NAV.map((g) => g.key).join(" "));
ok("the rail's More row exists and points at /app/more", MORE_ROW?.href === "/app/more" && exists("app/app/more/page.js"));
ok("no row is both a rail row and a More row",
  !moreRows.some((m) => railRows.some((r) => r.href === m.href)));

// ── 2. The flagships are top-level ─────────────────────────────────────────
//
// The owner's list — "the AI review, agents, scheduling, dispatching, etc."
// — read against the rail's own rows, plus the /app sidebar's top group as
// it stood before the change (Leads · Quotes · Quote reviews · Jobs ·
// Invoices · Calendar).
section("2. Flagship rows are top-level, visible without More");
const FLAGSHIP = {
  "app.nav.requests": "leads / requests",
  "app.nav.quotes": "quotes",
  "app.nav.estimateReviews": "the AI quote review",
  "app.nav.jobs": "jobs",
  "app.nav.invoices": "invoices",
  "app.nav.calendar": "schedule and bookings",
  "app.nav.scheduler": "dispatch (the shift board)",
  "app.nav.clients": "clients",
  "app.nav.chat": "the crew's chat",
  "app.nav.messages": "the inbox (Facebook / Instagram messages)",
  "app.nav.receptionist": "the AI front desk",
  "app.nav.ai": "the estimator's assistant (FieldQuo AI)",
  "app.nav.aiTeam": "the AI team view",
  "app.nav.insights": "reports",
};
for (const [key, what] of Object.entries(FLAGSHIP)) {
  ok(`${what} (${key}) is a rail row`, railRows.some((r) => r.key === key));
}
ok("every flagship's group is drawn (no flagship hides behind a folded group on a first visit)",
  adminSrc.includes("const DEFAULT_OPEN = NAV_GROUPS.map((g) => g.key)"));
// Work and AI stay pinned. Since 2026-09-24 People and Grow hold tour rows
// too (Assign shifts, Marketing, Receptionist) WITHOUT being pinned — the tour
// unfolds them through the header's data-tour-open hook, and check:sidebar
// proves every such step names that opener. So this asserts the two groups
// by name rather than "every group with a tour row is pinned".
ok("the AI group and Work are pinned (tour anchors nav-ai / nav-requests / nav-quotes / nav-estimate-reviews)",
  ["app.nav.group.work", "app.nav.group.ai"].every((k) => NAV.find((g) => g.key === k)?.pinned === true));

// ── 3. Nothing lost: every old destination, two taps away ──────────────────
//
// The rail and the settings list as they stood on origin/main the morning of
// 2026-09-21 (AdminSidebar.js NAV_GROUPS + HOME + AI + BOTTOM_ITEMS, and
// SettingsSidebar.js GROUPS), by href. Kept as a literal list on purpose:
// the whole point is to compare against what EXISTED, and the old file is
// gone from the tree.
section("3. Every destination that existed before is still reachable in two taps");
const OLD_RAIL = [
  ["/app", "Home"], ["/app/copilot", "FieldQuo AI"],
  ["/app/leads", "Work › Leads"], ["/app/quotes", "Work › Quotes"], ["/app/estimate-reviews", "Work › Quote reviews"],
  ["/app/jobs", "Work › Jobs"], ["/app/invoices", "Work › Invoices"], ["/app/plans", "Work › Service Plans"],
  ["/app/appointments", "Work › Calendar"], ["/app/tasks", "Work › To-do"],
  ["/app/me", "People › My home"], ["/app/clients", "People › Clients"], ["/app/equipment", "People › Client equipment"],
  ["/app/chat", "People › Chat"], ["/app/settings/team", "People › Your team"], ["/app/subcontractors", "People › Subcontractors"],
  ["/app/scheduler", "People › Assign shifts"], ["/app/me/schedule", "People › My schedule"], ["/app/schedule", "People › Team calendar"],
  ["/app/clock", "People › Time clock"], ["/app/settings/team/timesheets", "People › Timesheets"], ["/app/daily-sheets", "People › Daily sheets"],
  ["/app/time-off", "People › Time Off"], ["/app/safety", "People › Safety"], ["/app/log", "People › Log book"],
  ["/app/payroll", "Money › Payroll"], ["/app/settings/expense-tracking", "Money › Expenses"], ["/app/purchasing", "Money › Purchasing"], ["/app/fleet", "Money › Vehicles"],
  ["/app/analytics/benchmark", "Insights › Insights"], ["/app/analytics/kpis", "Insights › KPIs"],
  ["/app/marketing", "Grow › Marketing"], ["/app/marketing/designer", "Grow › Designer"], ["/app/funnels", "Grow › Funnels"],
  ["/app/receptionist", "Grow › Receptionist"], ["/app/crew-inbox", "Grow › Crew inbox"], ["/app/messages", "Grow › Messages"],
  ["/app/settings/refer", "Grow › Refer & Earn"], ["/app/influencer", "Grow › Influencer"],
  ["/app/help", "Help"], ["/app/settings/account-billing", "Plan"], ["/app/settings", "Settings"],
];
const OLD_SETTINGS = [
  "/app/settings/account-billing", "/app/settings/refer", "/app/settings/migration", "/app/settings/product-updates",
  "/app/settings/company", "/app/settings/branding", "/app/settings/language", "/app/activity",
  "/app/settings/team", "/app/settings/availability", "/app/settings/my-calendar", "/app/settings/leave", "/app/settings/policies",
  "/app/settings/booking-page", "/app/settings/work-areas", "/app/settings/field-work",
  "/app/settings/products", "/app/settings/services", "/app/settings/material-costs", "/app/settings/cabinet-rates",
  "/app/settings/overhead", "/app/settings/custom-fields",
  "/app/settings/quote-email", "/app/settings/email-templates", "/app/settings/templates", "/app/settings/translations",
  "/app/settings/checklists", "/app/settings/job-photo-tags",
  "/app/settings/messages", "/app/settings/follow-ups", "/app/settings/notifications", "/app/settings/email-domain",
  "/app/settings/payments", "/app/settings/meta-ads", "/app/settings/expense-tracking", "/app/settings/ai-credit", "/app/settings/payroll",
  "/app/settings/website", "/app/settings/instant-quotes", "/app/settings/lead-form", "/app/settings/links",
  "/app/settings/voice", "/app/settings/ai-employee", "/app/settings/reviews",
];

// Where a destination lives now, and how many taps it is.
//
// Desktop: a rail row is one click. A More row is More, then the row. An
// account row is the avatar, then the row. A settings row is Settings (the
// rail's foot slides the list, all groups open on a first visit), then the
// row — or Settings (the index), then the card's row: two either way.
//
// Phone: a tab is one tap. Everything else is More, then the row — the
// sheet holds the rail rows that are not tabs, the More groups, the settings
// groups and the account rows (PhoneMenuTiles in MoreMenu.js). The hamburger
// drawer is a second two-tap route to every rail row.
const settingsOpenByDefault = settingsSrc.includes("const DEFAULT_OPEN = GROUPS.map((g) => g.key)") && settingsSrc.includes("defaultOpenKeys: DEFAULT_OPEN");
const sheetHoldsRail = moreSrc.includes("PHONE_MENU_GROUPS") && moreSrc.includes("NAV_GROUPS.flatMap((g) => g.items)") && moreSrc.includes("!TAB_HREFS.has(i.href)");
// The sheet draws the mockup's rows (s3, 2026-09-22): one row per More
// group and per settings group, every page of the group as a link in the
// row's caption — so the tell is the group map plus the item links in it.
const sheetHoldsMore = moreSrc.includes("const more = useNavGroups(MORE_GROUPS);") && moreSrc.includes("{more.map((group) => {") && /group\.items\.map\(\(item, i\) => \(\s*<span key=\{item\.href\}>[\s\S]*?<Link href=\{item\.href\}/.test(moreSrc);
const sheetHoldsSettings = moreSrc.includes("useSettingsGroups()") && moreSrc.includes("{settings.map((group, i) => (") && /group\.items\.map\(\(item, j\) => \(\s*<span key=\{item\.href\}>[\s\S]*?<Link href=\{item\.href\}/.test(moreSrc);
const sheetHoldsAccount = moreSrc.includes("<AccountMenu onNavigate={shell.close} tone=\"sheet\" />");
ok("the settings list slides in with every group open on a first visit", settingsOpenByDefault);
ok("the phone sheet holds the rail rows that are not tabs", sheetHoldsRail);
ok("the phone sheet holds the More groups", sheetHoldsMore);
ok("the phone sheet holds the settings groups", sheetHoldsSettings);
ok("the phone sheet ends with the account rows", sheetHoldsAccount);

function whereNow(href) {
  if (railRows.some((r) => r.href === href)) {
    const g = NAV.find((g) => g.items.some((i) => i.href === href));
    return { where: g ? `rail › ${label(g.key)}` : "rail › Home", desktop: 1, phone: TABS.some((t) => t.href === href) ? 1 : 2 };
  }
  const mg = MORE.find((g) => g.items.some((i) => i.href === href));
  if (mg) return { where: `More › ${label(mg.key)}`, desktop: 2, phone: sheetHoldsMore ? 2 : Infinity };
  if (BOTTOM.some((b) => b.href === href)) return { where: "avatar menu", desktop: 2, phone: sheetHoldsAccount ? 2 : Infinity };
  const sg = SETTINGS.find((g) => g.items.some((i) => i.href === href));
  if (sg) return { where: `Settings › ${label(sg.key)}`, desktop: settingsOpenByDefault ? 2 : 3, phone: sheetHoldsSettings ? 2 : Infinity };
  return null;
}

const table = [];
let lost = 0;
for (const [href, was] of OLD_RAIL) {
  const now = whereNow(href);
  if (!now) lost++;
  table.push({ was, href, now: now ? now.where : "LOST", desktop: now?.desktop ?? "—", phone: now?.phone ?? "—" });
}
for (const href of OLD_SETTINGS) {
  const now = whereNow(href);
  if (!now) lost++;
  table.push({ was: `Settings › ${href.replace("/app/settings/", "").replace("/app/", "")}`, href, now: now ? now.where : "LOST", desktop: now?.desktop ?? "—", phone: now?.phone ?? "—" });
}
ok(`every one of the ${OLD_RAIL.length} old rail destinations still has a row`, table.slice(0, OLD_RAIL.length).every((r) => r.now !== "LOST"),
  table.slice(0, OLD_RAIL.length).filter((r) => r.now === "LOST").map((r) => r.href).join(", "));
ok(`every one of the ${OLD_SETTINGS.length} old settings destinations still has a row`, table.slice(OLD_RAIL.length).every((r) => r.now !== "LOST"),
  table.slice(OLD_RAIL.length).filter((r) => r.now === "LOST").map((r) => r.href).join(", "));
ok("every old destination is ≤ 2 clicks on desktop", table.every((r) => r.desktop <= 2),
  table.filter((r) => !(r.desktop <= 2)).map((r) => `${r.href}:${r.desktop}`).join(", "));
ok("every old destination is ≤ 2 taps on a phone", table.every((r) => r.phone <= 2),
  table.filter((r) => !(r.phone <= 2)).map((r) => `${r.href}:${r.phone}`).join(", "));
const newRows = [...railRows, ...moreRows, ...BOTTOM].filter((r) => !OLD_RAIL.some(([h]) => h === r.href) && !OLD_SETTINGS.includes(r.href));
ok("no rail/More/account row points somewhere that was not a destination before (the change adds rows for nothing new)",
  newRows.every((r) => r.href === "/app/more"), newRows.map((r) => r.href).join(", "));

// ── 4. The trade gate hides only trade rows ────────────────────────────────
section("4. The trade gate hides only rows tied to a trade");
const NEVER_GATED = [
  ...Object.keys(FLAGSHIP),
  "app.nav.home", "app.nav.payroll", "app.nav.expenses", "app.nav.purchasing", "app.nav.kpis",
  "app.nav.team", "app.nav.teamSchedule", "app.nav.mySchedule", "app.nav.clock", "app.nav.timesheets",
  "app.nav.timeOff", "app.nav.safety", "app.nav.log", "app.nav.myHome", "app.nav.dailySheets",
  "app.settings.aiEmployee", "app.settings.voice", "app.settings.payroll", "app.settings.payments", "app.settings.team",
  "app.settings.availability", "app.settings.bookingPage",
];
ok("no AI, scheduling, dispatch, money or people row is in the trade-gate table",
  NEVER_GATED.every((k) => !(k in ROW_TRADE_GATE)), NEVER_GATED.filter((k) => k in ROW_TRADE_GATE).join(", "));
ok("every trade-gated key is a real row somewhere",
  Object.keys(ROW_TRADE_GATE).every((k) => [...railRows, ...moreRows, ...settingsRows].some((r) => r.key === k)));
const NO_TRADES = { cabinetRates: false, materialCosts: false };
const ALL_TRADES = { cabinetRates: true, materialCosts: true };
const railNoTrades = filterNavGroupsByTrade([{ key: "h", items: [HOME] }, ...NAV, ...MORE], NO_TRADES).flatMap((g) => g.items);
ok("a company selling no gated trade keeps every rail and More row",
  railNoTrades.length === railRows.length + moreRows.length && Object.keys(NAV_ROW_TRADE_GATE).length === 0,
  `${railNoTrades.length}/${railRows.length + moreRows.length}; NAV_ROW_TRADE_GATE = ${JSON.stringify(NAV_ROW_TRADE_GATE)}`);
const settingsNoTrades = filterSettingsGroupsByTrade(SETTINGS, NO_TRADES).flatMap((g) => g.items);
const hidden = settingsRows.filter((r) => !settingsNoTrades.some((s) => s.key === r.key)).map((r) => r.key).sort();
ok("…and loses exactly the settings rows the table names",
  JSON.stringify(hidden) === JSON.stringify(Object.keys(SETTINGS_ROW_TRADE_GATE).sort()), hidden.join(", "));
ok("a company selling every gated trade sees everything",
  filterSettingsGroupsByTrade(SETTINGS, ALL_TRADES).flatMap((g) => g.items).length === settingsRows.length);
ok("an unresolved gate hides nothing (fail-open, like the other two filters)",
  filterSettingsGroupsByTrade(SETTINGS, null).flatMap((g) => g.items).length === settingsRows.length &&
    filterNavGroupsByTrade(NAV, undefined).flatMap((g) => g.items).length === NAV.flatMap((g) => g.items).length);
ok("hostile input: a non-array is an empty list, an item-less group is dropped",
  filterNavGroupsByTrade(null, ALL_TRADES).length === 0 && filterNavGroupsByTrade([{ key: "x" }], ALL_TRADES).length === 0);

// ── 5. The settings index lists every settings page ────────────────────────
section("5. The settings index and the slide panel draw the same rows");
const indexSrc = read("app/app/settings/page.js");
ok("/app/settings is a page, not a redirect", !/^\s*redirect\(/m.test(indexSrc) && !indexSrc.includes('from "next/navigation"') && indexSrc.includes("useSettingsGroups()"));
ok("the index renders every row of every group it is given", indexSrc.includes("group.items.map((item) =>") && indexSrc.includes("filtered.map((group) =>"));
ok("the index has the search box first", indexSrc.includes("<NavFilter") && indexSrc.includes("app.settings.searchExample"));
ok("every settings group has a card description in all nine languages",
  SETTINGS.every((g) => Object.values(APP_MESSAGES).every((d) => d[`app.settings.groupHint.${g.key.split(".").pop()}`])));
ok("the slide panel and the index read ONE hook (useSettingsGroups), so a hidden row is hidden in both",
  settingsSrc.includes("export function useSettingsGroups") && (settingsSrc.match(/useSettingsGroups\(\)/g) || []).length >= 2 && indexSrc.includes("useSettingsGroups()"));
ok("trade-gated rows are drawn dashed on the index (the mockup's legend)",
  indexSrc.includes("SETTINGS_ROW_TRADE_GATE") && indexSrc.includes("border-dashed"));
ok("there is no second sidebar under /app/settings",
  !read("app/app/settings/layout.js").includes("SettingsSidebar ") && !settingsSrc.includes("export default function SettingsSidebar"));
ok("the settings layout mounts the phone's section strip", read("app/app/settings/layout.js").includes("<SettingsPhoneNav />"));
ok("the rail slides the settings list over itself and keeps Settings lit while the URL is under /app/settings",
  adminSrc.includes("<SettingsPanel") && adminSrc.includes("-translate-x-full") && adminSrc.includes('aria-current={inSettings ? "page" : undefined}'));
ok("the slide respects prefers-reduced-motion", (adminSrc.match(/motion-reduce:transition-none/g) || []).length >= 2);
ok("the list that slid away is inert (no tab stops, not in the accessibility tree)", adminSrc.includes("inert={slid}") && adminSrc.includes("inert={!slid}"));

// ── 6. No dead link ────────────────────────────────────────────────────────
section("6. No dead link");
const everyRow = [...railRows, MORE_ROW, ...moreRows, ...BOTTOM, ...QUICK, ...settingsRows, ...TABS];
const dead = everyRow.filter((r) => !exists(`app${r.href}/page.js`));
ok("every href in every list resolves to a page.js", dead.length === 0, dead.map((r) => `${r.key} → ${r.href}`).join(", "));
ok("/api/search exists for the records half of the palette", exists("app/api/search/route.js"));

// ── 7. i18n ────────────────────────────────────────────────────────────────
section("7. Every new label, in all nine languages");
const NEW_KEYS = [
  "app.nav.aiTeam", "app.nav.group.ai", "app.nav.group.moreWork", "app.nav.group.moreCrew", "app.nav.group.moreMoney",
  "app.nav.group.morePartners", "app.nav.group.account", "app.nav.mainMenu", "app.more.kicker", "app.more.empty",
  "app.search.title", "app.search.placeholder", "app.search.placeholderShort", "app.search.hint", "app.search.pages",
  "app.search.records", "app.search.searching", "app.search.noRecords", "app.search.error", "app.search.keyMove",
  "app.search.keyOpen", "app.search.keyClose", "app.topbar.youAreHere", "app.topbar.account",
  "app.settings.backToMenu", "app.settings.allSettings", "app.settings.indexHint", "app.settings.searchExample",
  ...MORE.map((g) => `app.nav.groupHint.${g.key.split(".").pop()}`),
];
const langs = Object.keys(APP_MESSAGES);
ok(`the catalogue has nine languages`, langs.length === 9, langs.join(" "));
for (const lang of langs) {
  const missing = NEW_KEYS.filter((k) => !APP_MESSAGES[lang][k]);
  ok(`${lang}: every shell label present`, missing.length === 0, missing.join(" "));
}
ok("every rail, More, account and settings row label is translated in every language",
  langs.every((l) => everyRow.every((r) => APP_MESSAGES[l][r.key])));
ok("app.search.noRecords carries the {query} placeholder in every language",
  langs.every((l) => APP_MESSAGES[l]["app.search.noRecords"].includes("{query}")));

// ── 8. Search reaches every row by its own label ───────────────────────────
section("8. The global search's menu corpus reaches every row");
const CORPUS = [{ ...NAV[0], items: [HOME, ...NAV[0].items] }, ...NAV.slice(1), ...MORE, { key: "app.nav.group.account", items: BOTTOM }];
const unfound = [...railRows, ...moreRows, ...BOTTOM].filter((r) => !filterGroups(CORPUS, label(r.key), label).some((g) => g.items.some((i) => i.href === r.href)));
ok("every rail, More and account row is found by typing its own English label", unfound.length === 0, unfound.map((r) => r.key).join(" "));
const unfoundSettings = settingsRows.filter((r) => !filterGroups(SETTINGS, label(r.key), label).some((g) => g.items.some((i) => i.href === r.href)));
ok("every settings row is found by typing its own English label", unfoundSettings.length === 0, unfoundSettings.map((r) => r.key).join(" "));
for (const lang of ["fr", "es"]) {
  const l = (k) => APP_MESSAGES[lang][k] || k;
  const miss = [...railRows, ...moreRows].filter((r) => !filterGroups(CORPUS, l(r.key), l).some((g) => g.items.some((i) => i.href === r.href)));
  ok(`…and by its own ${lang} label`, miss.length === 0, miss.map((r) => r.key).join(" "));
}
ok("the corpus the component searches is built from the same three lists",
  adminSrc.includes("export const SEARCH_CORPUS = [") && adminSrc.includes("...MORE_GROUPS,") && adminSrc.includes("[...BOTTOM_ITEMS]"));
const gs = read("app/components/layout/GlobalSearch.js");
ok("`/` opens the palette only when nothing is taking text",
  gs.includes('e.key !== "/"') && gs.includes("typingSomewhere()") && gs.includes("isContentEditable"));
ok("the palette walks its rows with the arrows and closes on Escape",
  gs.includes('e.key === "ArrowDown"') && gs.includes('e.key === "Escape"') && gs.includes('e.key === "Enter"'));
ok("the records empty state is honest — only after the request came back",
  gs.includes('recordsState === "done" && records.length === 0') && gs.includes('recordsState === "error"'));

// ── 9. The records search asks the grid per type ──────────────────────────
section("9. /api/search asks the caller's grid per type and returns no money");
const owner = { role: "owner", permissions: null };
const crew = { role: PRESET_TO_ROLE.worker, permissions: PERMISSION_PRESETS.worker.values };
const employee = { role: "employee", permissions: { jobs: "view_only", quotes: "none", invoices: "none", clientsProperties: "name_address_only" } };
ok("owner may search all four types", Object.values(searchableTypes(owner)).every(Boolean));
ok("a Crew member (quotes/invoices none, jobs view_only) searches jobs and names, not quotes or invoices",
  !searchableTypes(crew).quote && searchableTypes(crew).job && !searchableTypes(crew).invoice && searchableTypes(crew).client);
ok("a grid with jobs:view_only and quotes:none searches jobs, not quotes", searchableTypes(employee).job && !searchableTypes(employee).quote);
ok("null member searches nothing", Object.values(searchableTypes(null)).every((v) => v === false));
ok("the query is trimmed, collapsed and capped; one character is no query",
  normaliseQuery("  a ") === null && normaliseQuery("  Rive   Nord ") === "Rive Nord" && normaliseQuery("x".repeat(500)).length === 80 && normaliseQuery(null) === null);
const routeSrc = read("app/api/search/route.js");
ok("the route never selects a total", !/total|subtotal|amount/i.test(routeSrc.replace(/\/\/.*$/gm, "")));
ok("every query is company-scoped and bounded", (routeSrc.match(/companyId,/g) || []).length === 4 && (routeSrc.match(/take: PER_TYPE/g) || []).length === 4);

// ── 10. Permission gating of the new rail row ─────────────────────────────
section("10. The AI team row is gated like the settings row it opens");
ok("app.nav.aiTeam has a NAV_REQUIREMENTS rule", Boolean(NAV_REQUIREMENTS["app.nav.aiTeam"]));
ok("owner, admin and supervisor see it", ["owner", "admin", "supervisor"].every((role) => navRowAllowed("app.nav.aiTeam", { role, permissions: null })));
ok("an employee does not", !navRowAllowed("app.nav.aiTeam", { role: "employee", permissions: null }));

// ── 11. Keyboard ───────────────────────────────────────────────────────────
section("11. Keyboard");
ok("the rail, the settings panel, the More tiles and the settings index walk their rows with the arrows",
  ["app/components/layout/AdminSidebar.js", "app/components/layout/SettingsSidebar.js", "app/components/layout/MoreMenu.js", "app/app/settings/page.js"]
    .every((f) => read(f).includes("useRovingRows()") && read(f).includes("data-nav-row")));
ok("the sheets close on Escape",
  ["app/components/layout/MoreMenu.js", "app/components/layout/CreateMenu.js", "app/components/layout/TopBar.js", "app/components/layout/NavDrawer.js"]
    .every((f) => read(f).includes('"Escape"')));

// ── The table, for the report ──────────────────────────────────────────────
section("Where every old row lives now (desktop clicks / phone taps)");
for (const r of table) console.log(`  ${r.was.padEnd(34)} ${r.now.padEnd(30)} ${String(r.desktop)}/${String(r.phone)}  ${r.href}`);
console.log(`\n  rail rows: 42 → ${railRows.length} (+ More, + Settings at the foot) · More rows: ${moreRows.length} · settings rows: ${settingsRows.length}`);

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
