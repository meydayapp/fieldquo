// scripts/check-app-guide-screens.mjs
//
//   node scripts/check-app-guide-screens.mjs
//
// The sales guide's "Every screen" chapter walks the two sidebars in the
// order the product draws them, from docs/screens/app-guide/harness/
// screens.js. That list is a hand copy of the rows in AdminSidebar.js and
// SettingsSidebar.js, and a hand copy drifts: a row added to the product
// and not to the list is a screen the guide never shows, and a reordered
// group is a guide that walks the menu in an order the customer's screen
// does not. So the rows are parsed out of the two components here and
// compared, key for key and in order, with the list.
//
// Parsed the way scripts/check-sidebar.mjs parses them — from the `key:
// "app.nav.x", href: "..."` literals — rather than imported, because the
// components are client modules that pull in lucide and Next.
import { readFileSync } from "node:fs";
import { SCREENS } from "../docs/screens/app-guide/harness/screens.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const rows = (src, prefix) =>
  [...src.matchAll(new RegExp(`key: "(${prefix}\\.[A-Za-z]+)", href: "([^"]+)"`, "g"))].map((m) => ({ key: m[1], href: m[2] }));

const admin = read("app/components/layout/AdminSidebar.js");
const settings = read("app/components/layout/SettingsSidebar.js");

// The main rail as drawn: Home, AI, the groups, then the bottom rows. The
// component declares HOME_ITEM and AI_ITEM after the groups and renders them
// first; QUICK_ADD_ITEMS are a popup, not rows.
const groupsSrc = admin.slice(admin.indexOf("const NAV_GROUPS"), admin.indexOf("const QUICK_ADD_ITEMS"));
const bottomSrc = admin.slice(admin.indexOf("const BOTTOM_ITEMS"), admin.indexOf("const HOME_ITEM"));
const homeAi = admin.slice(admin.indexOf("const HOME_ITEM"), admin.indexOf("const SEARCH_CORPUS"));
const rail = [...rows(homeAi, "app\\.nav"), ...rows(groupsSrc, "app\\.nav"), ...rows(bottomSrc, "app\\.nav")];
const settingsRows = rows(settings.slice(settings.indexOf("const GROUPS")), "app\\.settings");

const expected = [...rail, ...settingsRows];
// The Settings row's href is /app/settings, which redirects to Company;
// the guide photographs where the click lands, so its row says so.
const listed = SCREENS.filter((s) => !s.chapter).map((s) => ({ key: s.nav, href: s.slug === "settings" ? "/app/settings" : s.href }));

let fail = 0;
const t = (name, ok, detail = "") => { if (!ok) fail++; console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };
t(`the guide lists ${expected.length} rows and the sidebars draw ${expected.length}`, listed.length === expected.length, `guide=${listed.length}`);
const n = Math.min(listed.length, expected.length);
for (let i = 0; i < n; i++) {
  const a = expected[i], b = listed[i];
  t(`row ${String(i + 1).padStart(2, "0")} ${a.key} → ${a.href}`, a.key === b.key && a.href === b.href, a.key === b.key && a.href === b.href ? "" : `guide has ${b.key} → ${b.href}`);
}
for (const extra of expected.slice(n)) t(`sidebar row ${extra.key} is in the guide`, false, "missing from screens.js");
for (const extra of listed.slice(n)) t(`guide row ${extra.key} is in a sidebar`, false, "not in either component");
console.log(fail ? `\n${fail} failure(s)` : "\nall rows match, in order");
process.exit(fail ? 1 : 0);
