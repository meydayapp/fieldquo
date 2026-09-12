// scripts/check-sales-mobile.mjs
//
//   npm run check:sales-mobile
//
// The sales portal on a phone, and the tour that walks it: asserted by
// rendering the bar, executing the split, and opening every page the tour
// points at.
//
// ══ What this is for ══════════════════════════════════════════════════════
//
// Two asks from the owner, verbatim: "it is also not mobile friendly not like
// /app", and "the tour should be pinned to each section and component". Both
// are the kind of thing that looks finished in a screenshot and rots quietly:
// a tab bar that still renders after its fifth entry was removed from the
// shell, a tour step whose data-tour target was refactored away, a drawer row
// the tour cannot reach because nobody told it how to open the drawer. Each of
// those is a control that appears to work and doesn't — AGENTS.md's leading
// rule — and each is caught below by reading the thing rather than the
// promise.
//
// ══ Executed where it can be, read where it must be ═══════════════════════
//
// Section 1 RENDERS app/components/sales/SalesMobileTabBar.js through
// react-dom/server at three routes and counts what came out. Section 2 runs
// lib/sales/portalTabs.js against the shell's real list and against garbage.
// Sections 3–5 read source with comments stripped — the pages are client
// components whose data fetches cannot run here, so "does the page render the
// attribute the step names" is answered by opening the file — and section 6
// reads the shell and the stylesheet for the one padding rule every screen
// inherits.
//
// Run (esbuild first — the bar is JSX and imports next/navigation, which
// throws outside a Next request without the stub):
//   npx esbuild scripts/check-sales-mobile.mjs --bundle --platform=node \
//     --format=cjs --jsx=automatic --loader:.js=jsx --alias:@=. \
//     --alias:next/navigation=./scripts/stub-next-navigation.js \
//     --outfile=.sales-mobile.cjs && node .sales-mobile.cjs
//
// Judged by exit code. Every assertion goes through ok(); the process exits 1
// if any failed.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LanguageProvider } from "@/app/providers/LanguageProvider";
import SalesMobileTabBar from "@/app/components/sales/SalesMobileTabBar";
import {
  TAB_BAR_HREFS,
  SALES_NAV_OPEN,
  SALES_NAV_CLOSE,
  isActiveTab,
  isTabBarHref,
  splitPortalTabs,
} from "@/lib/sales/portalTabs";
import { SALES_TOUR_STEPS } from "@/app/sales/tourSteps";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { LANGUAGES } from "@/app/i18n/languages";

// process.cwd(), not import.meta.url: esbuild's cjs output has no
// import.meta, and this runs from the repo root like check:auth-pages does.
const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Source with its comments stripped — the prose in this repo quotes the code. */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

// ── The shell's own tab list, parsed the way check-sales-tour.mjs parses it ──
//
// SalesShell is a client component that calls hooks in its render; it cannot
// be imported here. The literal is the single source of what the portal HAS.
const shellCode = decomment(read("app/sales/SalesShell.js"));
const shellTabs = [
  ...shellCode.matchAll(/\{\s*href:\s*"([^"]+)"\s*,\s*label:\s*(?:t\("([^"]+)"\)|"([^"]+)")\s*\}/g),
].map((m) => ({ href: m[1], labelKey: m[2] || null, labelLiteral: m[3] || null }));

// The fixture the bar is rendered with: the shell's real hrefs, with labels
// resolved from the English catalogue the way SalesShell's t() would.
const fixtureTabs = shellTabs.map((tb) => ({
  href: tb.href,
  label: tb.labelKey ? APP_MESSAGES.en[tb.labelKey] : tb.labelLiteral,
}));

// ═══════════════════════════════════════════════════════════════════════════
section("1. The bar, rendered");
// ═══════════════════════════════════════════════════════════════════════════

ok("the shell's tab list was parsed", shellTabs.length >= 10, shellTabs.length);
ok("…and every label resolved", fixtureTabs.every((t) => typeof t.label === "string" && t.label), fixtureTabs);

/** Render the bar at a route, in a language. */
function renderBar(pathname, { language = "en", name = "Ada Lovelace" } = {}) {
  globalThis.__stubPathname = pathname;
  try {
    return renderToStaticMarkup(
      createElement(
        LanguageProvider,
        { initialLanguage: language, fromAccount: true },
        createElement(SalesMobileTabBar, { tabs: fixtureTabs, name, onSignOut: () => {} }),
      ),
    );
  } finally {
    delete globalThis.__stubPathname;
  }
}

let html = "";
try {
  html = renderBar("/sales/queue");
} catch (err) {
  failures.push(`the tab bar threw while rendering — ${err.message}`);
  console.log(`  FAIL the tab bar threw while rendering — ${err.message}`);
}

{
  // The bottom bar and what is on it.
  const bar = html.match(/<nav[^>]*data-sales-tabbar[^>]*>([\s\S]*?)<\/nav>/);
  ok("the bottom bar renders", Boolean(bar));
  const barHtml = bar ? bar[0] : "";
  const barLinks = [...barHtml.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  ok("…with exactly five tabs", barLinks.length === 5, barLinks);
  ok("…which are TAB_BAR_HREFS, in order", JSON.stringify(barLinks) === JSON.stringify([...TAB_BAR_HREFS]), barLinks);
  ok(
    "…each carrying the tour's anchor on the href",
    TAB_BAR_HREFS.every((h) => new RegExp(`data-sales-tour="${h.replace(/\//g, "\\/")}"`).test(barHtml)),
  );
  ok("…each a 44px target", (barHtml.match(/min-h-\[44px\]/g) || []).length >= 5);
  // Every tab's label is on the bar — a bar that renders five icons and no
  // words teaches nothing.
  for (const h of TAB_BAR_HREFS) {
    const label = fixtureTabs.find((t) => t.href === h)?.label;
    ok(`…and says "${label}"`, Boolean(label) && barHtml.includes(label));
  }

  // The active tab, at three routes. /sales is exact, the rest are prefixes.
  const activeAt = (pathname) => {
    const h = renderBar(pathname);
    const b = h.match(/<nav[^>]*data-sales-tabbar[^>]*>([\s\S]*?)<\/nav>/)?.[0] || "";
    return [...b.matchAll(/<a\b[^>]*aria-current="page"[^>]*href="([^"]+)"|<a\b[^>]*href="([^"]+)"[^>]*aria-current="page"/g)].map(
      (m) => m[1] || m[2],
    );
  };
  ok('at /sales/queue the active tab is Queue, and only Queue', JSON.stringify(activeAt("/sales/queue")) === '["/sales/queue"]', activeAt("/sales/queue"));
  ok('at /sales/leads/abc the active tab is Leads (prefix)', JSON.stringify(activeAt("/sales/leads/abc")) === '["/sales/leads"]', activeAt("/sales/leads/abc"));
  ok('at /sales the active tab is Today, and only Today (exact)', JSON.stringify(activeAt("/sales")) === '["/sales"]', activeAt("/sales"));
  ok("at /sales/voicemail no bar tab is active — it is a drawer screen", activeAt("/sales/voicemail").length === 0, activeAt("/sales/voicemail"));

  // Hidden from lg up, fixed to the bottom below it, and padded for the home
  // indicator BELOW its row rather than inside it.
  const barTag = barHtml.match(/<nav[^>]*>/)?.[0] || "";
  ok("the bar is hidden from lg up", /\blg:hidden\b/.test(barTag));
  ok("…fixed to the bottom edge", /\bfixed\b/.test(barTag) && /\bbottom-0\b/.test(barTag));
  ok("…and pads for the bottom safe area", /pb-\[env\(safe-area-inset-bottom\)\]/.test(barTag));
  ok("…with its row height from the one declaration in globals.css", /h-\[var\(--fq-tab-bar-row\)\]/.test(barHtml));
  ok("…on the card surface, not the navy sidebar", /\bbg-card/.test(barTag) && !/bg-sidebar/.test(barTag));

  // The top bar and its hamburger.
  const top = html.match(/<div[^>]*data-sales-topbar[^>]*>[\s\S]*?<\/div>\s*<\/div>/)?.[0] || "";
  const topTag = top.match(/<div[^>]*>/)?.[0] || "";
  ok("the top bar renders", top.length > 0);
  ok("…sticky, hidden from lg up", /\bsticky\b/.test(topTag) && /\blg:hidden\b/.test(topTag));
  ok("…and pads for the top safe area", /pt-\[env\(safe-area-inset-top\)\]/.test(topTag));
  const burger = top.match(/<button[^>]*data-tour-open="sales-nav"[^>]*>/)?.[0] || "";
  ok("…with a hamburger the tour can find", burger.length > 0);
  ok("…that is a 44px target", /min-h-\[44px\]/.test(burger) && /min-w-\[44px\]/.test(burger));
  ok("…labelled for a screen reader", /aria-label="Open menu"/.test(burger), burger);
  ok("…and says whether the drawer is open", /aria-expanded="false"/.test(burger));
  ok("…and the wordmark links to Today", /<a[^>]*href="\/sales"[^>]*>[\s\S]*?Sales portal/i.test(top) || /href="\/sales"/.test(top));

  // The drawer is closed on a fresh render, so its rows are asserted from
  // source in section 3 and its contents from the split in section 2. What a
  // fresh render must NOT contain is a second copy of the nine.
  ok("the drawer starts closed", !/data-tour-close="sales-nav"/.test(html));

  // In French, the chrome's own strings follow the provider.
  const fr = renderBar("/sales", { language: "fr" });
  ok("the hamburger's label is French under a French provider", /aria-label="Ouvrir le menu"/.test(fr));
  ok("…and the sign-in name is not printed while the drawer is closed", !/Ada Lovelace/.test(fr));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The split, executed against the real list and against garbage");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("TAB_BAR_HREFS is five", TAB_BAR_HREFS.length === 5, TAB_BAR_HREFS);
  ok("…every one of them is a tab the shell has", TAB_BAR_HREFS.every((h) => shellTabs.some((t) => t.href === h)), {
    bar: TAB_BAR_HREFS,
    shell: shellTabs.map((t) => t.href),
  });
  // The five are the shell's first five — its order is the stated one, and
  // this is what stops a later hand from promoting Pay because it felt useful.
  ok(
    "…and they are the shell's FIRST five, in the shell's order",
    JSON.stringify(shellTabs.slice(0, 5).map((t) => t.href)) === JSON.stringify([...TAB_BAR_HREFS]),
    shellTabs.slice(0, 5).map((t) => t.href),
  );

  const { bar, drawer } = splitPortalTabs(fixtureTabs);
  ok("the split puts five on the bar", bar.length === 5);
  ok("…and everything else in the drawer", drawer.length === fixtureTabs.length - 5, drawer.length);
  ok(
    "…with nothing dropped and nothing twice",
    new Set([...bar, ...drawer].map((t) => t.href)).size === fixtureTabs.length,
  );
  ok("…and the drawer keeps the shell's order", (() => {
    const order = fixtureTabs.filter((t) => !isTabBarHref(t.href)).map((t) => t.href);
    return JSON.stringify(drawer.map((t) => t.href)) === JSON.stringify(order);
  })());
  ok("Pay is in the drawer, not on the bar — the shell says it is visited once", drawer.some((t) => t.href === "/sales/pay") && !bar.some((t) => t.href === "/sales/pay"));

  // Hostile input. The shell must not throw because a tab was mis-typed.
  for (const [label, input] of [
    ["null", null],
    ["undefined", undefined],
    ["a string", "tabs"],
    ["a number", 7],
    ["an array of junk", [null, 3, "x", {}, { href: 9 }]],
  ]) {
    let out;
    try {
      out = splitPortalTabs(input);
    } catch (err) {
      out = err;
    }
    ok(`splitPortalTabs(${label}) returns empty lists rather than throwing`, out && Array.isArray(out.bar) && out.bar.length === 0 && out.drawer.length === 0, String(out));
  }
  ok("a partial list yields a partial bar, in bar order", (() => {
    const { bar: b } = splitPortalTabs([{ href: "/sales/leads", label: "L" }, { href: "/sales", label: "T" }]);
    return b.map((t) => t.href).join(",") === "/sales,/sales/leads";
  })());

  ok("isActiveTab: /sales is exact", isActiveTab("/sales", "/sales") && !isActiveTab("/sales/queue", "/sales"));
  ok("isActiveTab: the rest are prefixes", isActiveTab("/sales/leads/abc", "/sales/leads") && !isActiveTab("/sales/lead", "/sales/leads/"));
  ok("isActiveTab: garbage is false, not a throw", !isActiveTab(null, "/sales") && !isActiveTab("/sales", undefined));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The drawer holds the rest, and the tour knows how to open it");
// ═══════════════════════════════════════════════════════════════════════════

{
  const src = decomment(read("app/components/sales/SalesMobileTabBar.js"));
  ok("the bar imports the split rather than naming tabs", /splitPortalTabs/.test(src) && !/"\/sales\/pay"/.test(src));
  ok("the drawer rows carry the tour anchor", /drawer\.map\([\s\S]*?data-sales-tour=\{tab\.href\}/.test(src));
  ok("the drawer's close button is what the tour clicks", /data-tour-close="sales-nav"/.test(src));
  ok("…and the open button is what the tour clicks first", /data-tour-open="sales-nav"/.test(src));
  ok("the two selectors in portalTabs.js name those attributes", SALES_NAV_OPEN === "[data-tour-open='sales-nav']" && SALES_NAV_CLOSE === "[data-tour-close='sales-nav']");
  ok("the drawer closes on navigation", /useEffect\(\(\) => \{\s*setOpen\(false\);\s*\}, \[pathname\]\)/.test(src));
  ok("the drawer sits above both bars", /fixed inset-0 z-50/.test(src));
  ok("…and pads for both safe areas", /pt-\[env\(safe-area-inset-top\)\] pb-\[env\(safe-area-inset-bottom\)\]/.test(src));
  ok("the drawer carries the sign-out, wired to the shell's own handler", /onClick=\{onSignOut\}/.test(src));
  ok("the shell hands it the same list the desktop row maps", /<SalesMobileTabBar tabs=\{tabs\} name=\{me\?\.name \|\| null\} onSignOut=\{signOut\}/.test(shellCode));
  // Found in the browser, not by reading: mounted after <main>, the sticky
  // top bar rendered at the FOOT of the document (y=2336 on an 844px phone).
  ok("…mounted before <main>, so the sticky top bar is at the top", shellCode.indexOf("<SalesMobileTabBar") < shellCode.indexOf("<main"));
  // The desktop nav is a sidebar column now (2026-09-11), still hidden
  // below lg where the bar and the drawer carry the same list.
  ok("…and the desktop nav is hidden below lg", /<nav className="hidden lg:flex flex-col/.test(shellCode));
  ok("…and the desktop header too", /<header className="hidden lg:block/.test(shellCode));
  // Nothing new to translate: the bar reuses the shell's tab labels and three
  // keys the /app chrome already carries in all nine languages.
  const keys = [...src.matchAll(/\bt\("(app\.[A-Za-z0-9.]+)"/g)].map((m) => m[1]);
  ok("the bar asks for at least the menu and portal-title keys", keys.includes("app.sidebar.openMenu") && keys.includes("app.sidebar.closeMenu") && keys.includes("app.salesPortal.title"));
  const missing = [];
  for (const key of new Set(keys)) {
    for (const l of LANGUAGES.map((x) => x.code)) if (APP_MESSAGES[l]?.[key] === undefined) missing.push(`${key} (${l})`);
  }
  ok("every key the bar asks for exists in all nine languages", missing.length === 0, missing);
  ok("no bare English text node in the bar", (decomment(src).match(/>\s*([A-Za-z][A-Za-z ,.'’!?-]{2,})\s*</g) || []).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Every tour step's target is rendered on the page it names");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner's ask, verbatim: "pinned to each section and component". A step
// whose selector matches nothing rings nothing, which the panel survives
// quietly — so the source is opened here instead. `route` is the href the step
// links; the files are what that route renders, including the components a
// page mounts, since the attribute may sit inside one.

const PAGE_FILES = {
  // RepStatus.js is the status picker SalesShell mounts on every /sales
  // screen (header from lg up, drawer below). It is listed under Today
  // because that is the route its tour step names — see tourSteps.js.
  "/sales": ["app/sales/page.js", "app/components/sales/RepStatus.js"],
  "/sales/queue": ["app/sales/queue/page.js", "app/components/sales/DialRegion.js", "app/components/sales/QueueLeadEditor.js", "app/components/sales/AutodialControl.js"],
  "/sales/playbook": ["app/sales/playbook/page.js", "app/sales/playbook/PlaybookView.js"],
  "/sales/leads": ["app/sales/leads/page.js"],
  "/sales/threads": ["app/sales/threads/page.js"],
  "/sales/messages": ["app/sales/messages/page.js"],
  "/sales/team": ["app/sales/team/page.js"],
  "/sales/notes": ["app/sales/notes/page.js"],
  "/sales/calendar": ["app/sales/calendar/page.js"],
  "/sales/companies": ["app/sales/companies/page.js"],
  "/sales/demo": ["app/sales/demo/page.js"],
  "/sales/support": ["app/sales/support/page.js"],
  "/sales/voicemail": ["app/sales/voicemail/page.js"],
  "/sales/pay": ["app/sales/pay/page.js"],
  "/sales/settings": ["app/sales/settings/page.js"],
};

// The two steps with no target, by name. A third one is a decision that has
// to be written down here, with its reason, not a step that quietly lost its
// anchor.
const NO_TARGET_BY_DESIGN = {
  inbound: "IncomingCallDock mounts nothing until a call is ringing",
  transfer: "TransferControl exists only inside a live call",
};

{
  for (const href of shellTabs.map((t) => t.href)) {
    ok(`${href} has page files listed here`, Array.isArray(PAGE_FILES[href]) && PAGE_FILES[href].every((f) => existsSync(join(ROOT, f))), PAGE_FILES[href]);
  }
  for (const step of SALES_TOUR_STEPS) {
    ok(`step "${step.key}" declares a target (a selector or an explicit null)`, "target" in step && (step.target === null || typeof step.target === "string"), step.target);
    if (step.target === null) {
      ok(`…and "${step.key}" is one of the two allowed to have none`, step.key in NO_TARGET_BY_DESIGN, Object.keys(NO_TARGET_BY_DESIGN));
      continue;
    }
    const m = /^\[data-tour="([a-z0-9-]+)"\]$/.exec(step.target);
    ok(`…and "${step.key}"'s target is a data-tour selector`, Boolean(m), step.target);
    if (!m) continue;
    const slug = m[1];
    const files = PAGE_FILES[step.href] || [];
    const found = files.filter((f) => new RegExp(`data-tour="${slug}"`).test(decomment(read(f))));
    ok(`…and data-tour="${slug}" is rendered by ${step.href}`, found.length > 0, files);
  }
  for (const key of Object.keys(NO_TARGET_BY_DESIGN)) {
    ok(`the no-target exemption for "${key}" still names a real step with target: null`, SALES_TOUR_STEPS.some((s) => s.key === key && s.target === null));
  }
  // The reasons behind the two exemptions are facts about the components, and
  // facts drift. The dock returns null while nothing is happening.
  const dock = decomment(read("app/components/sales/IncomingCallDock.js"));
  // `mounted` is the drawer's slide state: true only from a ring until the
  // slide up has finished. Idle — no ring, no call, no error — is still null.
  ok("IncomingCallDock still mounts nothing while idle", /if \(!mounted && !live && !error && !audioWarning\) return null;/.test(dock));

  // A slug nothing points at is dead decoration. Every data-tour="sales-…"
  // in the portal must be some step's target.
  const targets = new Set(SALES_TOUR_STEPS.map((s) => s.target).filter(Boolean));
  const stray = [];
  for (const files of Object.values(PAGE_FILES)) {
    for (const f of files) {
      for (const mm of decomment(read(f)).matchAll(/data-tour="(sales-[a-z0-9-]+)"/g)) {
        if (!targets.has(`[data-tour="${mm[1]}"]`)) stray.push(`${f}: ${mm[1]}`);
      }
    }
  }
  ok("no page carries a sales-* data-tour that no step points at", stray.length === 0, stray);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Drawer-only steps say how to open the drawer; bar steps do not");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const step of SALES_TOUR_STEPS) {
    if (isTabBarHref(step.href)) {
      ok(`"${step.key}" (${step.href}) is a bar tab and needs no openWith`, step.openWith === undefined && step.closeWith === undefined);
    } else {
      ok(`"${step.key}" (${step.href}) is a drawer row and opens the drawer first`, step.openWith === SALES_NAV_OPEN && step.closeWith === SALES_NAV_CLOSE, { openWith: step.openWith, closeWith: step.closeWith });
    }
  }
  const tour = decomment(read("app/components/sales/SalesTour.js"));
  ok("the tour rings the target before the tab", /if \(step\.target\) \{\s*const el = visibleTarget\(step\.target\);\s*if \(el\) return el;/.test(tour));
  ok("…then whichever copy of the tab is on screen", /visibleTarget\(`\[data-sales-tour="\$\{step\.href\}"\]`\)/.test(tour));
  ok("…and clicks openWith when neither is", /if \(!el && current\.openWith\)[\s\S]*?opener\.click\(\);/.test(tour));
  ok("…then waits for the row rather than checking one frame", /waitForTarget\(`\[data-sales-tour="\$\{current\.href\}"\]`\)/.test(tour));
  ok("…and puts the drawer back on the way out", /if \(openedDrawer\.current\) \{[\s\S]*?visibleTarget\(current\.closeWith\)\?\.click\(\);/.test(tour));
  ok("…only when the tour opened it", /openedDrawer\.current = true;/.test(tour));
  ok("the card sits above the drawer", /fixed z-\[60\] rounded-xl/.test(tour));
  ok("…and the ring does too", /border-white z-\[60\]/.test(tour));
  ok("…and the incoming-call dock above both", /z-\[70\]/.test(decomment(read("app/components/sales/IncomingCallDock.js"))));
  ok("the card's viewport stops at the tab bar", /window\.innerHeight - tabBarHeight\(\)/.test(tour));
  ok("…measured from the bar itself", /querySelector\("\[data-sales-tabbar\]"\)/.test(tour));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Every screen clears the bar");
// ═══════════════════════════════════════════════════════════════════════════
//
// One rule on the shell's <main>, the way app/app/layout.js does it, rather
// than a class on every page root: the copy that rots is the one nobody
// looks at, and fourteen copies of a padding class are fourteen chances. What
// is asserted per page is the converse — that no page escapes the rule by
// pinning something to the bottom itself.

{
  const css = read("app/globals.css");
  ok(
    ".fq-sales-shell sets the tab-bar term from the row plus the safe area",
    /\.fq-sales-shell\s*\{\s*--fq-tab-bar-height:\s*calc\(var\(--fq-tab-bar-row\)\s*\+\s*env\(safe-area-inset-bottom\)\);/.test(css),
  );
  ok(".fq-sales-shell zeroes it at lg (64rem)", /@media \(min-width: 64rem\)\s*\{\s*\.fq-sales-shell\s*\{\s*--fq-tab-bar-height:\s*0px;/.test(css));
  ok("the shell wraps the portal in .fq-sales-shell", /className="min-h-screen bg-muted fq-sales-shell(?: [^"]*)?"/.test(shellCode));
  ok(
    "the shell's <main> reserves the bar's height below its content",
    /<main\s+className=\{`\$\{container\} w-full pt-6 sm:pt-8 pb-\[calc\(var\(--fq-tab-bar-height\)\+1\.5rem\)\] sm:pb-\[calc\(var\(--fq-tab-bar-height\)\+2rem\)\]`\}/.test(shellCode),
  );
  ok("the tour's launcher rides above the bar", /bottom-\[calc\(var\(--fq-tab-bar-height\)\+1rem\)\] left-4/.test(decomment(read("app/components/sales/SalesTour.js"))));
  // The incoming call is a drawer from the TOP now (2026-09-11) — under
  // the top bar from lg, at the top edge below it — so it never meets the
  // bottom bar at all. What is held onto: it is fixed, full width, and
  // slides on transform, never pushing the page.
  ok("the incoming-call drawer is fixed at the top, under the lg top bar", /fixed inset-x-0 top-0 lg:top-\[61px\]/.test(decomment(read("app/components/sales/IncomingCallDock.js"))));
  ok("…and slides on a transform, with reduced motion honoured", /-translate-y-full/.test(decomment(read("app/components/sales/IncomingCallDock.js"))) && /motion-reduce:transition-none/.test(decomment(read("app/components/sales/IncomingCallDock.js"))));

  // Every page under app/sales renders inside that <main>, except the two the
  // shell is chromeless for. None of them may pin its own element to the
  // bottom of the viewport without reading the variable — that element would
  // sit under the bar.
  const chromeless = new Set(["app/sales/login/page.js", "app/sales/invite/[token]/page.js"]);
  const pages = Object.values(PAGE_FILES).flat().filter((f) => f.startsWith("app/sales/") && !chromeless.has(f));
  ok("there are portal pages to walk", pages.length >= 14, pages.length);
  for (const f of pages) {
    const src = decomment(read(f));
    const pinned = [...src.matchAll(/className="[^"]*\b(?:fixed|sticky)\b[^"]*\bbottom-(?!\[calc\(var\(--fq-tab-bar-height\))[^\s"]*[^"]*"/g)].map((m) => m[0].slice(0, 80));
    ok(`${f} pins nothing to the bottom edge under the bar`, pinned.length === 0, pinned);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-mobile is a script", typeof pkg.scripts?.["check:sales-mobile"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:sales-mobile"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
