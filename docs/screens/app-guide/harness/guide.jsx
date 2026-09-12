// docs/screens/app-guide/harness/guide.jsx
//
// The /app back office, one screen at a time, for the sales guide's "Every
// screen" chapter. ?page=<slug> picks a row of screens.js, ?lang=en|fr|es
// picks the interface language, and the page is the REAL page module
// rendered inside the REAL shell — AdminSidebar, the providers app/app/
// layout.js mounts, and for /app/settings/* the SettingsSidebar too —
// with window.fetch answered from fixtures/ instead of a server.
//
// ── Language is the app's own provider, not a stubbed t() ─────────────────
//
// Earlier harnesses swapped @/app/hooks/useTranslation for a stub that read
// ?lang. This one wraps the tree in LanguageProvider with
// initialLanguage + fromAccount, which is exactly what AppLayout does for a
// member who chose French in Settings, so the real hook resolves the real
// catalogue. A word that prints in English here is a word that prints in
// English for a French contractor — which is the point of photographing it.
//
// ── The shell is composed here, not imported ───────────────────────────────
//
// app/app/layout.js is a server component: it reads headers(), asks the
// database who is signed in, and only then renders the client tree. The
// client tree is what this reproduces, provider for provider, in the same
// nesting. AppTours and JenniferPanel are left out on purpose — a first-run
// walkthrough overlay and a support drawer are not the screen the caption
// describes.
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import AdminSidebar from "@/app/components/layout/AdminSidebar";
import MobileTabBar from "@/app/components/layout/MobileTabBar";
import SettingsSidebar from "@/app/components/layout/SettingsSidebar";
import { SettingsDrillDownProvider, SettingsBackBar } from "@/app/components/settings/SettingsDrillDown";
import ToastLayer from "@/app/components/ToastLayer";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { FeatureProvider } from "@/app/providers/FeatureProvider";
import { PermissionProvider } from "@/app/providers/PermissionProvider";
import { SettingsAccessProvider } from "@/app/providers/SettingsAccessProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { SCREENS } from "./screens.js";
import { PAGES } from "./pages.gen.jsx";
import { installFetch } from "./fixtures/api.js";
import { COMPANY, MEMBER, FEATURE_FLAGS } from "./fixtures/company.js";

const params = new URLSearchParams(window.location.search);
const slug = params.get("page") || "home";
const lang = params.get("lang") || "en";
const screen = SCREENS.find((s) => s.slug === slug);
if (!screen) throw new Error(`unknown screen "${slug}"`);
window.__harness = { href: screen.href, slug, lang };
// The real LanguageProvider prefers a stored choice over a guess; the
// account's stated choice (fromAccount) beats storage, but clear it anyway so
// a previous run's language can never leak into this frame.
try { window.localStorage.clear(); } catch {}
try { window.sessionStorage.clear(); } catch {}
document.documentElement.lang = lang;

// The clock is the fixture's. "3 days ago" on a card is computed from
// Date.now() by the real components, so the frame is pinned to the same
// Monday the fixture data was written around — and re-running the capture
// next month produces the same picture.
{
  const RealDate = Date;
  const FIXED = RealDate.parse("2026-09-14T13:00:00-04:00");
  class FixedDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(FIXED); }
    static now() { return FIXED; }
  }
  window.Date = FixedDate;
}

installFetch({ screen, lang });

const Page = PAGES[screen.page];
if (!Page) throw new Error(`no page module bundled for ${screen.page}`);

function Shell({ children }) {
  return (
    // The root layout's pair, then the /app shell's own — the same nesting
    // app/layout.js and app/app/layout.js produce, so ToastLayer (outside the
    // inner LanguageProvider) still finds one.
    <ThemeProvider><LanguageProvider initialLanguage={lang} fromAccount>
    <div className="min-h-screen bg-background fq-app-shell">
      <LanguageProvider initialLanguage={lang} fromAccount>
        <CompanyPreferencesProvider initialCurrency={COMPANY.currency}>
          <FeatureProvider flags={FEATURE_FLAGS}>
            <PermissionProvider role={MEMBER.role} permissions={MEMBER.permissions}>
              <div className="lg:flex">
                <AdminSidebar />
                <main className="flex-1 min-w-0 pb-[calc(var(--fq-tab-bar-height)+var(--fq-dock-height))]">
                  {children}
                </main>
                <MobileTabBar />
              </div>
            </PermissionProvider>
          </FeatureProvider>
        </CompanyPreferencesProvider>
      </LanguageProvider>
      <ToastLayer surface="app" />
    </div>
    </LanguageProvider></ThemeProvider>
  );
}

function SettingsShell({ children }) {
  return (
    <SettingsAccessProvider access={{ role: MEMBER.role, impersonation: false }}>
      <SettingsDrillDownProvider>
        <div className="lg:flex min-h-screen">
          <SettingsSidebar tradeGate={COMPANY.tradeGate} />
          <main className="flex-1 min-w-0">
            <SettingsBackBar />
            {children}
          </main>
        </div>
      </SettingsDrillDownProvider>
    </SettingsAccessProvider>
  );
}

function App() {
  useEffect(() => {
    // Settled when no fetch has been in flight for a while — the pages load
    // in waves (list, then business-info, then a summary), so a fixed delay
    // either waits too long or photographs a spinner.
    // performance.now(), not Date.now(): the clock below is pinned.
    let last = performance.now();
    const seen = () => (last = performance.now());
    window.__onFetch = seen;
    const started = performance.now();
    const tick = setInterval(() => {
      const quiet = performance.now() - last;
      const inflight = window.__inflight || 0;
      if ((inflight === 0 && quiet > 700) || performance.now() - started > 7000) {
        clearInterval(tick);
        // The rail is taller than the frame: bring the row being
        // photographed into view, the way a person who just clicked it
        // would have it. The sidebar's own scroll container, not the page.
        const active = document.querySelector(`aside a[href="${screen.href}"], nav a[href="${screen.href}"]`);
        active?.scrollIntoView({ block: "center" });
        window.scrollTo(0, 0);
        runScene(screen.scene)
          .catch((err) => document.documentElement.setAttribute("data-scene-error", String(err?.message || err)))
          .then(() => document.documentElement.setAttribute("data-harness-done", "1"));
      }
    }, 100);
    return () => clearInterval(tick);
  }, []);
  const body = screen.settings ? <SettingsShell><Page /></SettingsShell> : <Page />;
  return <Shell>{body}</Shell>;
}

// ── Scenes: the real controls, clicked in order ───────────────────────────
//
// A few figures are a page in a STATE — the access editor open on a member,
// say — and the state is reached by operating the shipped controls exactly
// as a hand would, never by rendering the inner component on its own.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
const setSelect = (el, value) => {
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
};
async function runScene(scene) {
  if (!scene) return;
  if (scene === "access-editor") {
    // Manage Team: the access dropdown on Samuel Roy (an Estimator) set to
    // "Custom…", which opens the grid — app/app/settings/team/page.js
    // applyChoice → openAccess.
    const selects = [...document.querySelectorAll("main select")];
    const row = selects.find((sel) => [...sel.options].some((o) => o.value === "__custom__") && sel.closest("li, tr, div")?.textContent?.includes("Samuel Roy"));
    if (!row) throw new Error("scene: no access select for Samuel Roy");
    setSelect(row, "__custom__");
    await until("main input[type=checkbox], main button");
    await wait(400);
    return;
  }
  if (scene === "messages-open") {
    // The inbox opens a thread from ?conversation=, which the harness's
    // navigation stub does not carry; click the first row, as a person does.
    (await until("[data-room-list] [data-room-id]")).click();
    await until("[data-chat-scroller]");
    await wait(500);
    return;
  }
  if (scene === "chat-open") {
    (await until('[data-room-id="j1"]')).click();
    await until("[data-chat-scroller]");
    await wait(500);
    return;
  }
  throw new Error(`scene: unknown "${scene}"`);
}

window.addEventListener("error", (e) => {
  document.documentElement.setAttribute("data-scene-error", String(e.message || e.error));
});
window.addEventListener("unhandledrejection", (e) => {
  console.warn("[harness] unhandled rejection", e.reason);
});

createRoot(document.getElementById("root")).render(<App />);
