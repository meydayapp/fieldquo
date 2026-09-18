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
import { callerLinks, consoleHref, leadHref, newLeadHref, holdsLiveClaim } from "@/lib/sales/calls/callerLinks";
import { matchInboundCaller } from "@/lib/sales/calls/inboundMatch";

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
  // The container moved to app/components/layout/NavDrawer.js with the
  // platform console's phone chrome (2026-09-13) — one slide-over for the
  // three sidebars. The two properties below are still asserted, on the file
  // that now carries them, plus that this bar renders THAT drawer with the
  // safe-area padding switched on.
  const drawer = decomment(read("app/components/layout/NavDrawer.js"));
  ok("the bar renders the shared NavDrawer, with safe areas", /<NavDrawer[\s\S]{0,240}?\bsafeArea\b/.test(src));
  ok("the drawer sits above both bars", /fixed inset-0 z-50/.test(drawer));
  ok("…and pads for both safe areas", /pt-\[env\(safe-area-inset-top\)\] pb-\[env\(safe-area-inset-bottom\)\]/.test(drawer));
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
  // Idle — no ring, no call, no error, no write-up waiting after a call —
  // is still null. (Until 2026-09-17 the first term was `mounted`, the
  // drawer's slide state; the ring is an alert dialog now, with no slide,
  // so `incoming` itself is the term.)
  ok("IncomingCallDock still mounts nothing while idle", /if \(!incoming && !live && !error && !audioWarning && !writeUp\) return null;/.test(dock));

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
  ok("…and the incoming-call dialog above both, its in-call strip too", /zClass="z-\[80\]"/.test(decomment(read("app/components/sales/IncomingCallDock.js"))) && /z-\[70\]/.test(decomment(read("app/components/sales/IncomingCallDock.js"))));
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
    /<main\s+ref=\{mainRef\}\s+className=\{`\$\{container\} w-full pt-6 sm:pt-8 pb-\[calc\(var\(--fq-tab-bar-height\)\+1\.5rem\)\] sm:pb-\[calc\(var\(--fq-tab-bar-height\)\+2rem\)\]`\}/.test(shellCode),
  );
  ok("the tour's launcher rides above the bar", /bottom-\[calc\(var\(--fq-tab-bar-height\)\+1rem\)\] left-4/.test(decomment(read("app/components/sales/SalesTour.js"))));
  // The incoming call is an ALERT DIALOG since 2026-09-17 (the owner rang
  // his own number back and never saw a way to pick up under the 2026-09-11
  // top drawer): centred over a scrim through app/components/AlertDialog.js,
  // a full-width card inside 16px gutters on a phone, Pick up focused,
  // Escape and the scrim inert — so it never meets the bottom bar either.
  // The live call with no Dialer card to draw into, and the write-up after
  // it, are still a fixed strip under the lg top bar, never pushing the page.
  {
    const dockSrc = decomment(read("app/components/sales/IncomingCallDock.js"));
    const dialog = decomment(read("app/components/AlertDialog.js"));
    const ringJsx = dockSrc.slice(dockSrc.indexOf("<AlertDialog"), dockSrc.indexOf("</AlertDialog>"));
    ok("the ring is drawn through the shared AlertDialog, role=alertdialog, labelled and described, Pick up focused first", /<AlertDialog\s+open=\{ringing\}\s+role="alertdialog"/.test(dockSrc) && /labelledBy="fq-incoming-call-title"/.test(dockSrc) && /id="fq-incoming-call-title"/.test(dockSrc) && /describedBy="fq-incoming-call-caller"/.test(dockSrc) && /id="fq-incoming-call-caller"/.test(dockSrc) && /initialFocusRef=\{pickUpRef\}/.test(dockSrc) && /ref=\{pickUpRef\}[\s\S]*?data-incoming-pick-up/.test(dockSrc));
    ok("…with no onEscape and no onScrim — a ring cannot be dismissed by accident", ringJsx.length > 0 && !/onEscape=/.test(ringJsx) && !/onScrim=/.test(ringJsx));
    ok("…and the primitive's defaults are the safe direction: Escape and the scrim do nothing unless told", /escapeRef\.current\?\.\(\);/.test(dialog) && /onScrim \? \(/.test(dialog) && /aria-hidden="true"/.test(dialog));
    ok("…centred at every width, inside the wrapper's 16px gutters, a full-width card", /placement="center"/.test(dockSrc) && /items-center justify-center/.test(dialog) && /p-4/.test(dialog) && /relative w-full sm:max-w-md/.test(dialog));
    ok("…Pick up and Decline are ≥ 44px and carry hooks", /min-h-\[52px\][^"]*"\s*data-incoming-pick-up/.test(dockSrc) && /min-h-\[52px\][^"]*"\s*data-incoming-decline/.test(dockSrc));
    ok("…with a ring clock in the catalogue's words", /data-incoming-ring-clock/.test(dockSrc) && /app\.salesDial\.ringingFor/.test(dockSrc));
    ok("the live call with no card, and the write-up, are a fixed strip under the lg top bar", /data-incoming-live-strip/.test(dockSrc) && (dockSrc.match(/fixed inset-x-0 top-0 lg:top-\[var\(--fq-top-bar,61px\)\]/g) || []).length >= 2);
    ok("…and no slide is left over", !/-translate-y-full|SLIDE_MS|setMounted\(/.test(dockSrc));
  }

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
section("6b. Where the ring dialog may send the rep — callerLinks(), executed");

// The owner's addition to the dialog (2026-09-17): "Open the company" and
// "Notes" beside Pick up / Decline, "Save as a new lead" for a number that
// matched nobody, no link at all for a business another rep holds. Decided
// server-side in lib/sales/calls/callerLinks.js from the rows the caller
// route read; every case that matters is run here rather than reasoned
// about.
{
  const ME = "rep_me";
  const OTHER = "rep_other";
  const now = new Date("2026-09-17T23:00:00Z");
  const soon = new Date(now.getTime() + 3600e3).toISOString();
  const ago = new Date(now.getTime() - 3600e3).toISOString();
  const run = ({ prospects = [], leads = [], from = "+19185550123", repId = ME } = {}) =>
    callerLinks({ match: matchInboundCaller({ fromE164: from, prospects, leads }), prospects, leads, repId, now });

  const held = { id: "p1", businessName: "Bright Current", assignedRepId: ME, mergedIntoId: null, claimExpiresAt: soon, city: "Tulsa", province: "OK" };
  let out = run({ prospects: [held] });
  ok("the rep's own live claim → the console card and its Notes tab, with the city", out.open?.kind === "console" && out.open.href === "/sales/queue?prospectId=p1" && out.notes?.href === "/sales/queue?prospectId=p1&tab=notes" && out.save === null && out.city === "Tulsa" && out.province === "OK", out);
  ok("…a claim with no expiry is live too", run({ prospects: [{ ...held, claimExpiresAt: null }] }).open?.kind === "console");
  ok("a claim that LAPSED an hour ago → no console link (the queue would not load it)", run({ prospects: [{ ...held, claimExpiresAt: ago }] }).open === null);
  ok("a prospect merged into a survivor → no link", run({ prospects: [{ ...held, mergedIntoId: "p0" }] }).open === null);
  out = run({ prospects: [{ ...held, assignedRepId: OTHER }] });
  ok("a business ANOTHER rep holds → the city, and no link of any kind", out.open === null && out.notes === null && out.save === null && out.city === "Tulsa", out);
  ok("…even when that other rep's claim has lapsed — it is still not this rep's", run({ prospects: [{ ...held, assignedRepId: OTHER, claimExpiresAt: ago }] }).open === null);
  out = run({ prospects: [{ ...held, assignedRepId: OTHER }], leads: [{ id: "l1", businessName: "Bright Current", salesRepId: ME, prospectId: "p1", province: "OK" }] });
  ok("…but this rep's OWN lead on that number → the lead page and its notes block", out.open?.kind === "lead" && out.open.href === "/sales/leads/l1" && out.notes?.href === "/sales/leads/l1#lead-notes", out);
  out = run({ prospects: [{ ...held, assignedRepId: null, claimExpiresAt: null }] });
  ok("an unclaimed prospect with no lead of the rep's → nothing (the console lists own claims only)", out.open === null && out.notes === null && out.save === null);

  out = run({ leads: [{ id: "l2", businessName: "Typed In Ltd", salesRepId: ME, prospectId: null, province: "NY" }] });
  ok("a lead the rep typed in → the lead page, its province", out.open?.kind === "lead" && out.open.href === "/sales/leads/l2" && out.notes?.href === "/sales/leads/l2#lead-notes" && out.province === "NY" && out.city === null, out);
  ok("somebody else's lead → no link", run({ leads: [{ id: "l3", businessName: "Theirs", salesRepId: OTHER, prospectId: null }] }).open === null);
  ok("two reps' leads on one number (ambiguous) → nothing", (() => { const o = run({ leads: [{ id: "l4", salesRepId: ME }, { id: "l5", salesRepId: OTHER }] }); return o.open === null && o.save === null; })());
  ok("two prospects on one number (ambiguous) → nothing, not the first one", (() => { const o = run({ prospects: [held, { ...held, id: "p2" }] }); return o.open === null && o.notes === null && o.save === null; })());

  out = run({});
  ok("a number that matched NOBODY → the new-lead form with the number filled in, nothing else", out.open === null && out.notes === null && out.save?.href === "/sales/leads?new=1&phone=%2B19185550123", out);
  out = run({ from: "" });
  ok("a WITHHELD number (unknown, not none) → no save link: nothing to fill in", out.save === null && out.open === null);
  ok("a number the normaliser cannot read → nothing", run({ from: "not a number" }).save === null);
  ok("no rep → nothing, whatever matched", callerLinks({ match: matchInboundCaller({ fromE164: "+19185550123", prospects: [held] }), prospects: [held], repId: null, now }).open === null);
  ok("no match at all → nothing, not a throw", (() => { try { const o = callerLinks({ match: null, repId: ME }); return o.open === null && o.save === null; } catch { return false; } })());
  ok("hostile rows (nulls, strings, missing ids) never throw", (() => {
    try {
      callerLinks({ match: matchInboundCaller({ fromE164: "+19185550123", prospects: [null, "x", {}], leads: [null, 3] }), prospects: [null, "x", {}], leads: [null, 3], repId: ME, now });
      callerLinks({ match: { outcome: "prospect", prospectId: "p1" }, prospects: "nope", leads: undefined, repId: ME, now });
      return true;
    } catch { return false; }
  })());
  ok("holdsLiveClaim reads an unparseable expiry as live rather than throwing", holdsLiveClaim({ assignedRepId: ME, claimExpiresAt: "garbage" }, ME, now) === true);
  ok("the hrefs are built by one helper each, and the id is URL-encoded", consoleHref("a b", "notes") === "/sales/queue?prospectId=a+b&tab=notes" && leadHref("a/b", "lead-notes") === "/sales/leads/a%2Fb#lead-notes" && newLeadHref("+1 2") === "/sales/leads?new=1&phone=%2B1+2");

  // The route returns what the pure function decided — never an id the
  // browser could turn into a link by itself.
  const route = decomment(read("app/api/sales/calls/caller/route.js"));
  ok("the caller route selects the claim's three terms and the place, and answers with callerLinks()", /mergedIntoId: true, claimExpiresAt: true, city: true, province: true/.test(route) && /callerLinks\(\{ match, prospects, leads, repId: rep\.id, now: new Date\(\) \}\)/.test(route) && /open, notes, save/.test(route));
  ok("…and never returns prospectId or salesLeadId bare", !/prospectId: match|salesLeadId: match|match\.prospectId|match\.salesLeadId/.test(route.slice(route.indexOf("NextResponse.json({ outcome"))));

  // The dialog and the strip draw only hrefs they were given.
  const dock = decomment(read("app/components/sales/IncomingCallDock.js"));
  ok("the dialog draws Open the company / Notes / Save as a new lead from the server's hrefs, each behind a hook", /who\.open\?\.href \?/.test(dock) && /who\.notes\?\.href \?/.test(dock) && /who\.save\?\.href \?/.test(dock) && /data-incoming-open-company=\{who\.open\.kind\}/.test(dock) && /data-incoming-notes/.test(dock) && /data-incoming-save-lead/.test(dock));
  ok("…never composing an href from an id", !/\/sales\/queue\?prospectId=\$\{|\/sales\/leads\/\$\{/.test(dock));
  ok("…in the dialog AND in the live controls (the strip and the Dialer slot)", (dock.match(/\{callerLinks\}/g) || []).length === 2 && /data-inbound-live[\s\S]*?\{callerLinks\}/.test(dock) && /data-incoming-context[\s\S]*?\{callerLinks\}/.test(dock));
  ok("…the city on the context line, and \"Not one of your leads\" only on none", /placeText, holderText/.test(dock) && /who\?\.outcome === "none"/.test(dock) && /app\.salesDial\.callerNotALead/.test(dock));
  ok("…links are ≥ 44px targets", /min-h-\[44px\][^"]*text-brand-accent-text/.test(dock));

  // The pages behind the hrefs.
  const queue = decomment(read("app/sales/queue/page.js"));
  ok("the console reads ?tab= (only a PANEL_TABS key) and opens on it over the autodial default", /PANEL_TABS\.some\(\(entry\) => entry\.key === params\.get\("tab"\)\)/.test(queue) && /setTab\(tabParam \|\| \(auto\.switchOn \? "disposition" : "script"\)\)/.test(queue));
  const leadPage = decomment(read("app/sales/leads/[id]/page.js"));
  ok("the lead page's notes block carries id=\"lead-notes\"", /id="lead-notes"/.test(leadPage));
  const leadsPage = decomment(read("app/sales/leads/page.js"));
  ok("the leads screen opens the add form with the number from ?new=1&phone=", /sp\.get\("new"\) !== "1"\) return;/.test(leadsPage) && /phone: phone \|\| prev\.phone/.test(leadsPage) && /setAdding\(true\)/.test(leadsPage));

  for (const key of ["app.salesDial.callerOpenCompany", "app.salesDial.callerNotes", "app.salesDial.callerNotALead", "app.salesDial.callerSaveAsLead", "app.salesDial.ringingFor"]) {
    ok(key + " in every catalogue language", LANGUAGES.every((l) => typeof APP_MESSAGES[l.code]?.[key] === "string" && APP_MESSAGES[l.code][key].trim().length > 0));
  }
  const shoot = read("docs/screens/sales-mobile/harness/shoot.mjs");
  ok("the mobile shooter frames the three cases", /"today-incoming-call"/.test(shoot) && /"today-incoming-call-held"/.test(shoot) && /"today-incoming-call-unknown"/.test(shoot));
}

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
