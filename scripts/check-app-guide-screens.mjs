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

// The rail as drawn since 2026-09-21: Home, the seventeen (NAV_GROUPS), the
// More row, the More groups (MORE_GROUPS — tiled on /app/more and in the
// phone sheet, in declaration order), then the account rows (BOTTOM_ITEMS:
// the avatar menu, with Settings also at the rail's foot). The component
// declares HOME_ITEM / MORE_ITEM after the groups and renders Home first;
// QUICK_ADD_ITEMS are the Create menu, not rows.
const navSrc = admin.slice(admin.indexOf("const NAV_GROUPS"), admin.indexOf("const MORE_GROUPS"));
const moreSrc = admin.slice(admin.indexOf("const MORE_GROUPS"), admin.indexOf("const INFLUENCER_ONLY"));
const bottomSrc = admin.slice(admin.indexOf("const BOTTOM_ITEMS"), admin.indexOf("const HOME_ITEM"));
const homeMore = admin.slice(admin.indexOf("const HOME_ITEM"), admin.indexOf("const AI_ITEM"));
const [home, more] = rows(homeMore, "app\\.nav");
const rail = [home, ...rows(navSrc, "app\\.nav"), more, ...rows(moreSrc, "app\\.nav"), ...rows(bottomSrc, "app\\.nav")];
const settingsRows = rows(settings.slice(settings.indexOf("const GROUPS")), "app\\.settings");

const expected = [...rail, ...settingsRows];
const listed = SCREENS.filter((s) => !s.chapter).map((s) => ({ key: s.nav, href: s.href }));

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
