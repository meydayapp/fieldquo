// scripts/check-nav-audit.mjs
//
//   npm run check:nav-audit
//
// The regression guard for the nav-reorganisation audit (docs/NAV-AUDIT.md).
// check-sidebar.mjs already proves contrast, disclosure and translation
// coverage for the two /app sidebars. This file proves the five things THAT
// audit's brief asked for, none of which check-sidebar.mjs touches:
//
//   1. every nav href resolves to a page.js that actually exists on disk —
//      a renamed route with a stale nav row is a link to a 404.
//   2. every nav i18n key has BOTH an English and a French string — a key
//      that resolves in one and falls back to the key itself in the other
//      prints "app.nav.foo" on screen, which check-translations.mjs catches
//      globally but this pins down for nav specifically, per the brief.
//   3. the permission maps (NAV_REQUIREMENTS, SETTINGS_ROW_CAPABILITY) name
//      only keys that still exist in a sidebar. check-settings-access.mjs
//      already proves the forward direction (every visible row has a rule);
//      this is the reverse — a rule for a row that no longer exists is a gate
//      enforcing nothing, and nobody would notice because nothing renders it.
//   4. no declared group — in any of the three sidebars, PlatformSidebar
//      included — is empty. A header with nothing under it is the trace a
//      lost row leaves behind.
//   5. every page.js under app/app/ is reachable from a sidebar row, or is
//      named — WITH A REASON — in DRILL_INS below. A page that stops being
//      linked from anywhere and isn't a declared drill-in fails the build
//      instead of quietly joining app/app/tasks's old company (see
//      AGENTS.md: "reachable from NOTHING" is a documented failure class
//      here, not a hypothetical one).
//
// Mutation-tested — see the session's final report for which break each
// assertion was confirmed to catch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { NAV_REQUIREMENTS } from "../lib/permissions/nav.js";
import {
  SETTINGS_ROW_CAPABILITY,
  SETTINGS_SIDEBAR_CHROME_KEYS,
} from "../lib/permissions/settingsAccess.js";

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

// ── Parsing helpers ──────────────────────────────────────────────────────
//
// Braces, not a JS parser: every item in all three sidebars is written as a
// single flat object literal with no nested braces (`{ key: "...", href:
// "...", icon: Foo }`), so a leaf-object regex finds exactly the items and
// never a group wrapper — a group's own object contains an `items: [ {...},
// {...} ]` array, which has braces inside it, so `[^{}]*` cannot match the
// wrapper as a whole. That's what makes this safe without a real parser.

function sliceArray(src, decl) {
  const start = src.indexOf(decl);
  if (start < 0) throw new Error(`missing ${decl} in ${decl}`);
  const i = src.indexOf("[", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "[") depth++;
    else if (src[j] === "]" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`unterminated ${decl}`);
}

/** Every leaf `{ key|label: "...", href: "...", ... }` in a block. */
function leafItems(block) {
  const out = [];
  for (const m of block.matchAll(/\{[^{}]*\}/g)) {
    const text = m[0];
    const keyM = text.match(/(?:key|label):\s*"([^"]+)"/);
    const hrefM = text.match(/href:\s*"([^"]+)"/);
    if (keyM && hrefM) out.push({ key: keyM[1], href: hrefM[1] });
  }
  return out;
}

/** Every `{ key|label: "...", ..., items: [ ... ] }` group, with its items. */
function groups(block, prop = "key") {
  const headers = [
    ...block.matchAll(new RegExp(`${prop}:\\s*"([^"]+)"\\s*,\\s*(?:pinned:\\s*true\\s*,\\s*)?items:\\s*\\[`, "g")),
  ];
  const out = [];
  for (let n = 0; n < headers.length; n++) {
    const from = headers[n].index + headers[n][0].length;
    const to = n + 1 < headers.length ? headers[n + 1].index : block.length;
    out.push({ key: headers[n][1], items: leafItems(block.slice(from, to)) });
  }
  return out;
}

// ── Read all three sidebars ─────────────────────────────────────────────

const adminSrc = read("app/components/layout/AdminSidebar.js");
const settingsSrc = read("app/components/layout/SettingsSidebar.js");
const platformSrc = read("app/components/platform/PlatformSidebar.js");

const adminGroups = groups(sliceArray(adminSrc, "const NAV_GROUPS = ["));
const settingsGroups = groups(sliceArray(settingsSrc, "const GROUPS = ["));
const platformGroups = groups(sliceArray(platformSrc, "const GROUPS = ["), "label");

const adminExtra = [
  ...leafItems(sliceArray(adminSrc, "const QUICK_ADD_ITEMS = [")),
  ...leafItems(sliceArray(adminSrc, "const BOTTOM_ITEMS = [")),
  ...leafItems(`[${adminSrc.match(/const HOME_ITEM = (\{[^{}]*\});/)?.[1] ?? ""}]`),
  ...leafItems(`[${adminSrc.match(/const AI_ITEM = (\{[^{}]*\});/)?.[1] ?? ""}]`),
];
const platformHome = leafItems(`[${platformSrc.match(/const HOME_ITEM = (\{[^{}]*\});/)?.[1] ?? ""}]`);

const adminItems = [...adminGroups.flatMap((g) => g.items), ...adminExtra];
const settingsItems = settingsGroups.flatMap((g) => g.items);
const platformItems = [...platformGroups.flatMap((g) => g.items), ...platformHome];

console.log("Nav audit — docs/NAV-AUDIT.md's regression guard\n");

// ── 1. Every href resolves to a real page.js ────────────────────────────

console.log("Every nav href resolves to a page on disk\n");
for (const [name, items] of [
  ["rail", adminItems],
  ["settings panel", settingsItems],
  ["platform console", platformItems],
]) {
  const missing = items.filter((i) => !exists(`app${i.href}/page.js`));
  ok(`${name}: every href has a page.js`, missing.length === 0,
    missing.map((i) => `${i.key} -> ${i.href}`).join(", "));
}

// ── 2. Every nav key has EN and FR ──────────────────────────────────────
//
// Platform is excluded on purpose: its rows are plain English strings, not
// i18n keys — the console is FieldQuo-staff-only and was never translated,
// same reasoning app/i18n/appMessages.js states for why the /app catalogue
// itself stops at English and French rather than all six languages.

console.log("\nEvery /app and /settings nav key is translated EN + FR\n");
for (const [name, items] of [
  ["rail", adminItems],
  ["settings panel", settingsItems],
]) {
  const missingEn = items.filter((i) => !(i.key in APP_MESSAGES.en));
  const missingFr = items.filter((i) => !(i.key in APP_MESSAGES.fr));
  ok(`${name}: every item has an English string`, missingEn.length === 0,
    missingEn.map((i) => i.key).join(", "));
  ok(`${name}: every item has a French string`, missingFr.length === 0,
    missingFr.map((i) => i.key).join(", "));
}
for (const [name, groupList] of [
  ["rail", adminGroups],
  ["settings panel", settingsGroups],
]) {
  const missingEn = groupList.filter((g) => !(g.key in APP_MESSAGES.en));
  const missingFr = groupList.filter((g) => !(g.key in APP_MESSAGES.fr));
  ok(`${name}: every group heading has an English string`, missingEn.length === 0,
    missingEn.map((g) => g.key).join(", "));
  ok(`${name}: every group heading has a French string`, missingFr.length === 0,
    missingFr.map((g) => g.key).join(", "));
}

// ── 3. Permission maps name only keys that still exist ──────────────────
//
// The reverse of what check-settings-access.mjs already proves. A stale
// entry here isn't a false positive that over-hides — it's a rule that
// silently enforces nothing, because the row it names was renamed or
// removed out from under it.

console.log("\nPermission maps reference only rows that still exist\n");
{
  const railKeys = new Set(adminItems.map((i) => i.key));
  const stale = Object.keys(NAV_REQUIREMENTS).filter((k) => !railKeys.has(k));
  ok("NAV_REQUIREMENTS: every key still names a real rail row", stale.length === 0,
    stale.join(", "));
}
{
  const settingsKeys = new Set(settingsItems.map((i) => i.key));
  const stale = Object.keys(SETTINGS_ROW_CAPABILITY).filter(
    (k) => !settingsKeys.has(k) && !SETTINGS_SIDEBAR_CHROME_KEYS.includes(k),
  );
  ok("SETTINGS_ROW_CAPABILITY: every key still names a real settings row",
    stale.length === 0, stale.join(", "));
}

// ── 4. No declared group is empty ───────────────────────────────────────

console.log("\nNo declared group is empty\n");
for (const [name, groupList] of [
  ["rail", adminGroups],
  ["settings panel", settingsGroups],
  ["platform console", platformGroups],
]) {
  const empty = groupList.filter((g) => g.items.length === 0);
  ok(`${name}: every group has at least one item`, empty.length === 0,
    empty.map((g) => g.key).join(", "));
}

// ── 5. Every app/app page is reachable, or excused with a reason ────────
//
// DRILL_INS are pages reached by a button on another page rather than by a
// sidebar row — a client's own detail view, an "Edit" or "New" workflow
// step, a hub page's own in-content links. Each entry's value is the reason,
// not decoration: it's what a reviewer reads to judge whether "unreachable
// from the nav" is actually true of a route with no sidebar row.
const DRILL_INS = {
  "/app/clients/[id]": "client detail — opened from the clients list and from every other page that names a client",
  "/app/clients/import": "opened from the Clients list page's own Import button",
  "/app/clients/new": "opened from the Clients list page's own New client button",
  "/app/funnels/[id]": "funnel builder — opened from the Funnels list",
  "/app/invoices/[id]": "invoice document — opened from the invoices list, dashboard, clients, jobs",
  "/app/invoices/[id]/edit": "opened from the invoice detail page's own Edit button",
  "/app/jobs/[id]": "job detail — opened from clients, quotes, invoices, appointments",
  "/app/jobs/[id]/edit": "opened from the job detail page's own Edit button",
  "/app/jobs/[id]/visits/new": "opened from the job detail page's own Add visit button",
  "/app/jobs/new": "opened from the Jobs list, a client's own page, and Quick Add",
  "/app/leads/import": "opened from the Leads list page's own Import button",
  "/app/marketing/[id]": "campaign detail — opened from the Marketing list",
  "/app/marketing/subscribers": "opened from the Marketing list and from a campaign's own detail view",
  "/app/payroll/[id]": "one pay run — opened from the Payroll list",
  "/app/plans/[id]": "one plan — opened from the Plans list",
  "/app/plans/new": "opened from the Plans list page's own New button",
  "/app/quote-approval/[id]": "opened from a quote's own detail page",
  "/app/quotes/[id]": "quote document — opened from the quotes list, clients, leads, dashboard",
  "/app/quotes/[id]/edit": "opened from the quote detail page's own Edit button",
  "/app/quotes/[id]/kitchen": "kitchen designer — opened from the quote detail page",
  "/app/settings/email-templates/[id]": "opened from the Email Templates list",
  "/app/settings/product-updates/[slug]": "opened from the Product Updates list",
  "/app/settings/team/new": "opened from the Manage Team page's own Invite button",
  "/app/settings/team/payroll": "a Manage Team tab — per-employee pay rates, not the company-wide payroll config at /app/settings/payroll",
  "/app/settings/team/workers": "a Manage Team tab — the roster view",
  "/app/settings/templates/[id]/edit": "opened from the PDF Templates list's own Edit button",
  "/app/analytics/digest": "linked from the Insights hub (/app/analytics/benchmark) — see the comment on that page and the Insights group rationale in AdminSidebar.js",
  "/app/analytics/statements": "linked from the Insights hub and the KPI dashboard's AR panel",
  "/app/analytics/win-loss": "linked from the Insights hub",
  "/app/analytics/estimate-accuracy": "linked from the Insights hub and the KPI dashboard",
  "/app/settings": "redirects to /app/settings/company — not a destination of its own",
};

console.log("\nEvery app/app page is reachable from the nav, or excused with a reason\n");
function walkPages(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walkPages(rel, out);
    else if (entry.name === "page.js") out.push(dir);
  }
  return out;
}
const allAppRoutes = walkPages("app/app").map((d) => d.replace(/^app/, ""));
const linkedRoutes = new Set([...adminItems, ...settingsItems].map((i) => i.href));
const unexplained = allAppRoutes.filter(
  (r) => !linkedRoutes.has(r) && !(r in DRILL_INS),
);
ok("every app/app route is either a direct nav href or a named DRILL_IN",
  unexplained.length === 0, unexplained.join(", "));

// Catches the OTHER mistake: a DRILL_INS entry for a route that no longer
// exists (renamed or deleted) is a stale exception nobody would notice,
// which is exactly the failure mode this whole check exists to prevent.
const goneDrillIns = Object.keys(DRILL_INS).filter((r) => !allAppRoutes.includes(r));
ok("every DRILL_INS entry still names a real route", goneDrillIns.length === 0,
  goneDrillIns.join(", "));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
