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
import { COMPANY, MEMBER, CREW_MEMBER, CREW, DISPATCHER, DISPATCHER_MEMBER, OWNER, FEATURE_FLAGS } from "./fixtures/company.js";
import { PUBLIC_PROPS } from "./fixtures/public.js";
import { documentTheme } from "@/lib/documents/theme";

const params = new URLSearchParams(window.location.search);
const slug = params.get("page") || "home";
const lang = params.get("lang") || "en";
const screen = SCREENS.find((s) => s.slug === slug);
if (!screen) throw new Error(`unknown screen "${slug}"`);
const VIEWERS = { crew: [CREW, CREW_MEMBER], dispatcher: [DISPATCHER, DISPATCHER_MEMBER] };
if (screen.member && !VIEWERS[screen.member]) throw new Error(`unknown member "${screen.member}"`);
const [user, member] = VIEWERS[screen.member] || [OWNER, MEMBER];
// A public row is a stranger: no session for the auth stub to report.
window.__harness = { href: screen.href, slug, lang, params: screen.params || {}, user: screen.mode === "public" ? null : user };
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
// `props` is either the component's props themselves ({ token }) or the
// name of a builder in fixtures/public.js for the pages whose props the
// server would have computed from the database.
const pageProps = typeof screen.props === "string" ? PUBLIC_PROPS[screen.props]?.({ lang, screen }) : screen.props;
if (typeof screen.props === "string" && !pageProps) throw new Error(`no fixtures/public.js props builder "${screen.props}"`);

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
            <PermissionProvider role={member.role} permissions={member.permissions}>
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

// A client-facing route: app/layout.js's pair and nothing else. The
// language is the one the client's document carries in the fixture, which
// public.js keeps equal to ?lang so the French figure shows the French client's
// page — the covering email and the page agree, as they must (AGENTS.md #6).
// What the route's page.js puts around the component, where it puts
// anything: the booking page paints the document paper to the bottom of the
// window (its comment says why); the website paints white in the brand ink.
// The other client pages mount their component bare, and so do their rows.
const WRAPS = {
  bookingPage: (children) => <div className="min-h-dvh" style={{ backgroundColor: documentTheme(COMPANY).page }}>{children}</div>,
  sitePage: (children) => <div style={{ backgroundColor: "#ffffff", color: documentTheme(COMPANY).ink }}>{children}</div>,
};
function PublicShell({ children }) {
  const wrap = screen.wrap ? WRAPS[screen.wrap] : null;
  if (screen.wrap && !wrap) throw new Error(`unknown wrap "${screen.wrap}"`);
  return (
    <ThemeProvider><LanguageProvider initialLanguage={lang} fromAccount>{wrap ? wrap(children) : children}</LanguageProvider></ThemeProvider>
  );
}

function SettingsShell({ children }) {
  return (
    <SettingsAccessProvider access={{ role: member.role, impersonation: false }}>
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
  if (screen.mode === "public") return <PublicShell><Page {...(pageProps || {})} /></PublicShell>;
  const body = screen.settings ? <SettingsShell><Page {...(pageProps || {})} /></SettingsShell> : <Page {...(pageProps || {})} />;
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
// The button carrying a fixture string (an event type's name, a trade's
// label, a funnel step's button text) — never an interface string, which
// changes with ?lang.
const clickButton = async (text, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    const el = [...document.querySelectorAll("button")].find((b) => b.textContent.includes(text));
    if (el) { el.click(); return el; }
    await wait(100);
  }
  throw new Error(`scene: no button containing "${text}"`);
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
  if (scene === "booking-pick") {
    // The booking page opens on the menu of event types; the figure is the
    // calendar a person reaches by picking the consultation.
    await clickButton("Kitchen design consultation");
    await wait(900);
    // …and Thursday the 17th, so the times the fixture offers are on screen.
    const day17 = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "17" && !b.disabled);
    if (!day17) throw new Error("scene: no day 17 in the calendar");
    day17.click();
    await wait(500);
    return;
  }
  if (scene === "booking-pick-paid") {
    await clickButton("Measurement visit");
    await wait(900);
    const day17 = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "17" && !b.disabled);
    if (!day17) throw new Error("scene: no day 17 in the calendar");
    day17.click();
    await wait(500);
    return;
  }
  if (scene === "booking-details-visit" || scene === "booking-details-call") {
    // The consultation, then the mode (the fixture company offers a visit
    // and a call, so the picker renders), then the first open day and its
    // first time — which lands on step 3, the details form, where the
    // required field for the mode and the sentence under Book are.
    await clickButton("Kitchen design consultation");
    await wait(600);
    const picker = await until("[data-booking-modes]");
    const wanted = scene.endsWith("call") ? "call" : "visit";
    const chip = [...picker.querySelectorAll("button")][wanted === "call" ? 1 : 0];
    if (!chip) throw new Error("scene: no mode chip");
    chip.click();
    await wait(600);
    const day17 = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "17" && !b.disabled);
    if (!day17) throw new Error("scene: no day 17 in the calendar");
    day17.click();
    await wait(500);
    const time = [...document.querySelectorAll("button")].find((b) => /^\d{1,2}:\d{2}/.test(b.textContent.trim()) && !b.disabled);
    if (!time) throw new Error("scene: no time button");
    time.click();
    await wait(500);
    // A name and an email, so the only thing holding Book back is the
    // mode's own field — the point of the frame.
    const inputs = [...document.querySelectorAll("input")];
    const setValue = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const name = inputs.find((i) => i.autofocus || i.required);
    if (name) setValue(name, "Sophie Tremblay");
    const email = inputs.find((i) => i.type === "email");
    if (email) setValue(email, "sophie@example.com");
    await wait(300);
    window.scrollTo(0, 0);
    return;
  }
  if (scene === "instant-pick") {
    // The estimator opens with nothing picked ("Pick a service"); picking a
    // trade is the first thing anyone does, and it reveals the intake.
    await clickButton("Cabinet refinishing");
    await wait(400);
    return;
  }
  if (scene === "kpis-cash") {
    // The Cash section has no anchor of its own; it is the section before
    // the one the tour marks as "not tracked". Scrolled to the top of the
    // frame, the way a person reading down the page would have it.
    const cash = (await until('[data-tour="kpis-not-tracked"]')).previousElementSibling;
    if (!cash) throw new Error("scene: no section before kpis-not-tracked");
    window.scrollTo(0, cash.getBoundingClientRect().top + window.scrollY - 16);
    await wait(300);
    return;
  }
  if (scene === "scroll-totals") {
    // The builder's terms card — expiry, discount, tax, the total — with the
    // fixed action bar under it: the frame that shows whether the bar's
    // buttons and its own total share the width, or cover each other.
    const el = await until("#quote-valid-until");
    const card = el.closest(".rounded-xl") || el;
    window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 16);
    await wait(300);
    return;
  }
  if (scene === "ai-team-flow") {
    // "How your AI team works" — the routing picture on the AI employee
    // settings page (app/components/aiEmployee/TeamFlow.js): channels, the
    // front desk, one card per employee with its tool chips, the gate and
    // the person. Photographed on its own because it sits under the team
    // list, below the fold at both widths.
    const el = await until("#team-flow");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16);
    await wait(300);
    return;
  }
  if (scene === "scroll-offered") {
    // The "Offered" list at the foot of the editor — the client-tickable
    // extras, pre-filled from the catalogue (lib/quotes/offeredAddOns.js).
    const el = await until("[data-offered-section]");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16);
    await wait(300);
    return;
  }
  if (scene === "scroll-materials") {
    const el = await until("#job-materials");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16);
    await wait(300);
    return;
  }
  if (scene === "purchasing-requests") {
    // The Requests tab — the fourth on the Purchasing page.
    const tab = [...document.querySelectorAll('main [role="tab"]')].at(-1);
    if (!tab) throw new Error("scene: no purchasing tabs");
    tab.click();
    await until("main ul li, main form");
    await wait(400);
    return;
  }
  if (scene === "scroll-visits") {
    const el = await until('[data-tour="job-visits"]');
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16);
    await wait(300);
    return;
  }
  if (scene === "invoice-chase") {
    // The Request payment button is the one in the command strip carrying
    // the mail icon (app/app/invoices/[id]/page.js setShowChase).
    (await until("main button svg.lucide-mail")).closest("button").click();
    await until("main textarea, main input[type=text], .fixed textarea");
    await wait(300);
    return;
  }
  if (scene === "client-edit") {
    // The Edit button beside the client's name opens the edit sheet.
    (await until("main button svg.lucide-pencil, main button svg.lucide-edit, main button svg.lucide-square-pen")).closest("button").click();
    await until("main form, .fixed form, .fixed input");
    await wait(400);
    return;
  }
  if (scene === "appointment-new") {
    (await until('[data-tour="appts-new"]')).click();
    await until("main form, .fixed form, .fixed input");
    await wait(400);
    return;
  }
  if (scene === "safety-report") {
    // The Report button opens the incident form in place (app/app/safety/
    // page.js setShowForm) — the only button in the page header.
    (await until("main h1 ~ * button, main .flex.items-start.justify-between button")).click();
    await until("main form, main textarea");
    await wait(300);
    return;
  }
  if (scene === "takeoff-measure") {
    // The roofing and gutter cards: type the house's address and press
    // "Measure from satellite"; the fixture answers with the measurement and
    // the still (fixtures/takeoffs.js), and the frame is the card after it.
    const input = document.querySelector("[data-takeoff-frame] input[placeholder]");
    if (!input) throw new Error("scene: no address input on the takeoff card");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "42 Windermere Dr, Kanata, ON K2K 1S8");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(100);
    const btn = [...document.querySelectorAll("[data-takeoff-frame] button")].find((b) => /sat.l+ite/i.test(b.textContent));
    if (!btn) throw new Error("scene: no measure button on the takeoff card");
    btn.click();
    await wait(1200);
    return;
  }
  if (scene === "funnel-start") {
    await clickButton("Start");
    await wait(400);
    return;
  }
  if (scene === "quote-presentation") {
    // The quote page's Email / Presentation strip: open the Presentation tab
    // (app/app/quotes/[id]/PresentationPanel.js).
    const tab = await until('[role="tab"]:nth-of-type(2)');
    tab.click();
    await until("input[type=number]");
    await wait(400);
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
