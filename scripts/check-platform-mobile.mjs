// scripts/check-platform-mobile.mjs
//
//   npm run check:platform-mobile
//
// The platform console on a phone, executed: every /platform route rendered
// at 375×812 in headless Chrome through docs/screens/platform-mobile/harness
// (the real pages inside the real layout, against fixtures), the DOM measured
// by the same audit.js that produced the frames in docs/screens/platform-
// mobile/, and five things asserted per route.
//
// ══ What this is for ══════════════════════════════════════════════════════
//
// The owner, 2026-09-13: "take a look at the platform because it is not
// mobile friendly". What that meant, measured (docs/screens/platform-mobile/
// before/audit.json): a 240px rail that never collapsed, leaving <main>
// 135px on a 375px phone; tables of ten columns with no scroll container,
// so the page scrolled sideways; primary buttons at 36 and 40px. Each is a
// number, and each is the kind that comes back with the next page somebody
// adds — which is why this is a check and not a screenshot.
//
// ══ Why it drives a browser ═══════════════════════════════════════════════
//
// Every other check in this repo reads source or renders through
// react-dom/server. Neither can answer "does this element leave the
// viewport": overflow is a layout fact, and layout needs the stylesheet
// applied to a box of a given width. So this one launches Chrome (the one on
// this Mac, or CHROME_PATH), which no other check does, and fails loudly
// rather than skipping when it cannot find one — a check that passes because
// it could not run is the dead button AGENTS.md's first rule is about.
//
// ══ The five assertions, per route at 375 ═════════════════════════════════
//
//   1. the page does not scroll sideways: scrollWidth ≤ 375, and no element
//      outside a horizontal scroll container leaves the viewport;
//   2. every <table> is inside an overflow-x scroll container that itself
//      fits the viewport (a table wider than the phone is expected — a
//      payouts ledger is a table — a page that scrolls because of it is not);
//   3. the primary actions are ≥ 44px: submit buttons, filled buttons, and
//      the nav's own open/close;
//   4. the harness answered every request the page made (a page rendering
//      an error state would pass 1–3 trivially);
//   5. on the dashboard: the drawer opens through [data-tour-open=
//      "platform-nav"] and closes through [data-tour-close="platform-nav"],
//      and the desktop rail is not painted at this width.
//
// And once, before any of that: every app/platform/**/page.js has a row in
// the harness's pages.js, so a route added to the console without a fixture
// fails by name instead of going unaudited.
//
// Runs in ~2 minutes. `npm run check:platform-mobile -- /platform,/platform/growth`
// (or CHECK_PLATFORM_MOBILE_ROUTES=… — documented in docs/VERCEL.md as
// local-only, because check-env-docs.mjs lists every process.env read)
// narrows it to those routes while working on one screen.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HARNESS = path.join(ROOT, "docs/screens/platform-mobile/harness");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks += 1;
  if (pass) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}\n`);

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every /platform route is in the harness");
// ═══════════════════════════════════════════════════════════════════════════

// The pages git knows about. Tracked, not merely on disk: this tree is
// shared with other sessions, and a page another agent is still writing
// (untracked, its API route half-built) is not a page this check can
// render yet. The moment it is committed it is counted, and fails here by
// name until pages.js and a fixture carry it.
let pageFiles;
try {
  pageFiles = execSync("git ls-files app/platform", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((f) => f.endsWith("/page.js"))
    .map((f) => f.replace(/^app\/platform\/?/, "").replace(/\/?page\.js$/, ""));
} catch {
  pageFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (e.name === "page.js") pageFiles.push(rel.replace(/^app\/platform\/?/, "").replace(/\/?page\.js$/, ""));
    }
  })("app/platform");
}

const pagesSource = read("docs/screens/platform-mobile/harness/pages.js");
const ids = Object.fromEntries([...read("docs/screens/platform-mobile/harness/fixtures/ids.js").matchAll(/export const (\w+) = "([^"]+)"/g)].map((m) => [m[1], m[2]]));
const rows = [...pagesSource.matchAll(/^\s+(?:"([^"]+)"|\[`([^`]+)`\]): \{ render([^\n]*)$/gm)].map((m) => ({
  route: (m[1] || m[2]).replace(/\$\{(\w+)\}/g, (_, k) => ids[k]),
  file: (m[3].match(/file: "([^"]+)"/) || [])[1] || (m[1] || "").replace(/^\/platform\/?/, ""),
}));
const covered = new Set(rows.map((r) => r.file));
for (const f of pageFiles) ok(`app/platform/${f || "(root)"}/page.js has a harness route`, covered.has(f));
ok("…and the harness names no page that does not exist", rows.every((r) => pageFiles.includes(r.file)), rows.filter((r) => !pageFiles.includes(r.file)).map((r) => r.file).join(" "));

const allRoutes = rows.map((r) => r.route);
const only = process.env.CHECK_PLATFORM_MOBILE_ROUTES || process.argv.slice(2).find((arg) => arg.startsWith("/platform"));
const routes = only ? only.split(",") : allRoutes;

// ═══════════════════════════════════════════════════════════════════════════
section("2. Build the harness");
// ═══════════════════════════════════════════════════════════════════════════

const { launch, findChrome } = await import(path.join(HARNESS, "cdp.mjs"));
const chromePath = findChrome();
ok("a Chrome binary is available (CHROME_PATH to point elsewhere)", Boolean(chromePath), "no Chrome found — this check cannot measure layout without one");
if (!chromePath) {
  console.log(`\n${checks} checks, ${failures} failure(s).`);
  process.exit(1);
}

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "fq-platform-mobile-"));
try {
  execSync(`sh ${HARNESS}/build.sh`, { cwd: ROOT, env: { ...process.env, OUT }, stdio: "pipe" });
  ok("esbuild bundled every page and Tailwind compiled", fs.existsSync(path.join(OUT, "platform.js")) && fs.existsSync(path.join(OUT, "app.css")));
} catch (err) {
  ok("esbuild bundled every page and Tailwind compiled", false, String(err.stderr || err.message).slice(0, 600));
  console.log(`\n${checks} checks, ${failures} failure(s).`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every route at 375×812");
// ═══════════════════════════════════════════════════════════════════════════

const auditSource = read("docs/screens/platform-mobile/harness/audit.js").replace(/^export /m, "");
const chrome = await launch({ chromePath });
await chrome.emulate({ width: 375, height: 812, scale: 1, mobile: true });
const url = (route, extra = "") => `file://${OUT}/platform.html?path=${encodeURIComponent(route)}${extra}`;

for (const route of routes) {
  const { sceneError } = await chrome.open(url(route));
  const a = await chrome.eval(`(${auditSource})(375)`);
  // React's key warning is noise here; a thrown render is not.
  a.consoleErrors = chrome.consoleErrors.filter((e) => !/unique "key"/.test(e));
  const tablesOut = a.tables.filter((t) => !(t.inScroller && t.scrollerFits));
  const detail = [];
  if (a.docW > 376) detail.push(`scrollWidth ${a.docW}`);
  for (const o of a.overflow.slice(0, 3)) detail.push(`<${o.tag}> "${o.text.slice(0, 40)}" x=${o.x} w=${o.w}`);
  ok(`${route}: does not scroll sideways`, a.docW <= 376 && a.overflow.length === 0, detail.join("; "));
  ok(`${route}: every table (${a.tables.length}) is in a scroll container that fits`, tablesOut.length === 0, tablesOut.map((t) => `"${t.caption}" w=${t.width} inScroller=${t.inScroller} fits=${t.scrollerFits}`).join("; "));
  ok(`${route}: primary actions are ≥ 44px`, a.tapPrimary.length === 0, a.tapPrimary.slice(0, 4).map((t) => `"${t.text.slice(0, 30)}" ${t.w}×${t.h}`).join("; "));
  // The login screen is sixty characters of text; every other route is
  // thousands. The floor is there to catch a page that rendered an error
  // card or a spinner and nothing else.
  ok(`${route}: rendered against answered fixtures`, !sceneError && a.unanswered.length === 0 && a.consoleErrors.length === 0 && a.textLength > (route === "/platform/login" ? 40 : 200), sceneError || a.unanswered.join(" ") || a.consoleErrors[0]?.slice(0, 200) || `text ${a.textLength}`);
  ok(`${route}: the desktop rail is not painted`, !a.railVisible, "[data-platform-rail] has a box at 375");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The drawer opens and closes");
// ═══════════════════════════════════════════════════════════════════════════

{
  const { sceneError } = await chrome.open(url("/platform", "&scene=drawer"));
  ok("the drawer opens through [data-tour-open=platform-nav]", !sceneError, sceneError || "");
  const drawer = await chrome.eval(`(() => { const d = document.querySelector('[data-platform-drawer]'); if (!d) return null; const r = d.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), rows: d.querySelectorAll('a[href^="/platform"]').length, close: Boolean(d.querySelector('[data-tour-close="platform-nav"]')) }; })()`);
  ok("…is a panel narrower than the phone, full height", Boolean(drawer) && drawer.w < 375 && drawer.h >= 800, JSON.stringify(drawer));
  ok("…carries every rail row", Boolean(drawer) && drawer.rows >= 50, `rows=${drawer?.rows}`);
  ok("…and a close button the tour can press", Boolean(drawer?.close));
  const closed = await chrome.eval(`(async () => { document.querySelector('[data-tour-close="platform-nav"]').click(); await new Promise((r) => setTimeout(r, 300)); return !document.querySelector('[data-platform-drawer]'); })()`);
  ok("…which closes it", closed === true);
  const a = await chrome.eval(`(${auditSource})(375)`);
  const openBtn = await chrome.eval(`(() => { const b = document.querySelector('[data-tour-open="platform-nav"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()`);
  ok("the open button is a 44px target", Boolean(openBtn) && openBtn.w >= 44 && openBtn.h >= 44, JSON.stringify(openBtn));
  ok("the top bar is sticky and in flow (main starts below it)", a.mainRect && a.mainRect.y >= 50 && a.mainRect.x === 0, JSON.stringify(a.mainRect));
}

await chrome.close();
fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
