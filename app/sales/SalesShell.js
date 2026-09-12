// app/sales/SalesShell.js
//
// The portal's chrome: a wordmark, who you're signed in as, and sign out.
//
// Hides itself on the two pages reached WITHOUT a session — /sales/login and
// /sales/invite/* — exactly as PlatformSidebar early-returns on
// /platform/login. Rendering a "Signed in as …" bar above a sign-in form is a
// small lie, and the sign-out button on it would be a control with nothing to
// sign out of.
//
// Deliberately not a sidebar. A rail with a single row is the "group of one"
// the nav audit flags everywhere else — so when this file was written, with one
// screen in the portal, it said "when a second screen lands, this is where the
// rail goes".
//
// It landed: leads and conversations (docs/SALES-OUTREACH.md), then the queue,
// then notes, then the Today screen — six, then fourteen. Still tabs in the
// header rather than a sidebar from `lg` up: a rep works one screen at a time,
// and a rail costs horizontal space the queue's two-column console needs. The
// alternative — leaving the rail out — would have shipped screens with no way
// to reach them, which is the "route with no caller" failure
// scripts/check-route-callers.mjs exists for, and which
// scripts/check-sales-home.mjs now asserts for this whole surface.
//
// Below `lg` the header and the tab row are gone, and the chrome is the /app
// model instead: a sticky top bar with a menu button, a bottom tab bar with
// five screens, and a drawer with the other nine —
// app/components/sales/SalesMobileTabBar.js. The owner's words were "not
// mobile friendly, not like /app", and the specific failure was fourteen tabs
// in a three-column grid: five rows of chrome above the first word of every
// screen at 390px, and no way back to the nav without scrolling to the top.
// The list below is the ONE list; the tab bar is handed it and never names a
// tab of its own.
//
// ══ 2026-09-11: a vertical sidebar from lg up ═════════════════════════════
//
// The owner sent a reference dialler and said the portal's main menu must be
// a VERTICAL left sidebar like it — icon and label rows, the active row
// highlighted, badges on Texts, Team and Voicemail — not the horizontal
// strip above. So from lg up the chrome is now: a sidebar (~220px, collapsible
// to icons, remembered in localStorage) carrying the SAME `tabs` array below,
// a top bar with only the search box, the rep's status menu and their name,
// and the body beside them. Below lg nothing changed: SalesMobileTabBar's bar
// and drawer carry the list exactly as before.
//
// The sidebar's foot is "Calls today N / 250" — dials this rep placed since
// their local day started, against the day's ceiling
// (QUEUE_DAILY_CLAIM_CAP; the batch itself rolls in 25s) — and a motto. Both numbers come from
// /api/sales/badges, the one request this chrome makes for its digits; a
// count that could not be read is null there and draws nothing here.
//
// Breakpoint: lg, not md. The amendment said "md+", but the mobile bar,
// the drawer, the tour, --fq-tab-bar-height and four check scripts all switch
// at lg, and a sidebar at md beside a bottom bar that hides at lg would show
// both between 768 and 1023px. One constant; flip it in one place if the
// owner wants tablets on the sidebar.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import IncomingCallDock from "@/app/components/sales/IncomingCallDock";
import { RepPresenceProvider, RepStatusPicker } from "@/app/components/sales/RepStatus";
import SalesMobileTabBar from "@/app/components/sales/SalesMobileTabBar";
import SalesTour from "@/app/components/sales/SalesTour";
import { SalesSearchProvider, useSalesSearchBox } from "@/app/components/sales/SalesSearch";
import { ConsoleSlotsProvider } from "@/app/components/sales/consoleSlots";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  MonitorPlay,
  NotebookPen,
  PhoneCall,
  Search,
  Sun,
  Users,
  UsersRound,
  Voicemail,
  Wallet,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * The icon for each row, by href. A separate map rather than a field on the
 * `tabs` entries because twelve check scripts parse those entries as
 * `{ href, label }` literals — the single source of what the portal HAS —
 * and an icon field would break the parse. A tab with no icon here gets the
 * generic one; nothing is hidden by a missing icon.
 */
const TAB_ICONS = {
  "/sales": Sun,
  "/sales/queue": PhoneCall,
  "/sales/playbook": BookOpen,
  "/sales/leads": Users,
  "/sales/threads": Mail,
  "/sales/messages": MessageSquare,
  "/sales/team": UsersRound,
  "/sales/notes": NotebookPen,
  "/sales/calendar": CalendarDays,
  "/sales/companies": Building2,
  "/sales/demo": MonitorPlay,
  "/sales/support": LifeBuoy,
  "/sales/voicemail": Voicemail,
  "/sales/pay": Wallet,
};

/** Which badge each row wears, by href → field of /api/sales/badges. */
const TAB_BADGES = {
  "/sales/messages": "texts",
  "/sales/team": "team",
  "/sales/voicemail": "voicemail",
};

const COLLAPSE_KEY = "fq-sales-sidebar-collapsed";

/**
 * The top bar's search box. Drawn only while a screen has registered for
 * it — see SalesSearch.js — so it is never a box that searches nothing.
 */
function SearchBox() {
  const { query, setQuery, consumer } = useSalesSearchBox();
  const { t } = useTranslation();
  if (!consumer) return <div className="min-w-0 flex-1" />;
  return (
    <label className="relative min-w-0 flex-1 max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={consumer.placeholder || t("app.salesPortal.searchPlaceholder")}
        aria-label={consumer.placeholder || t("app.salesPortal.searchPlaceholder")}
        className="w-full min-h-[44px] rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground"
        data-sales-search
      />
    </label>
  );
}

export default function SalesShell({ children }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [me, setMe] = useState(null);

  const chromeless =
    pathname === "/sales/login" || pathname.startsWith("/sales/invite");

  const load = useCallback(async () => {
    if (chromeless) return;
    try {
      const res = await fetch("/api/sales/me");
      // A failure here is not worth an error banner: middleware has already
      // bounced anyone without a session, so the only way to get here and fail
      // is a token that expired between the page load and this fetch. The name
      // is chrome; the page below it says its own truth.
      if (res.ok) setMe(await res.json());
    } catch {
      /* leave the name off rather than showing a wrong one */
    }
  }, [chromeless]);

  useEffect(() => {
    load();
  }, [load]);

  async function signOut() {
    await fetch("/api/sales/auth/logout", { method: "POST" });
    window.location.href = "/sales/login";
  }

  // ── The sidebar's own state: folded or not, and its digits ─────────────
  //
  // `collapsed` is remembered per browser, the way /app's rail remembers
  // itself. `badges` is /api/sales/badges' answer — re-asked on every
  // navigation, never polled, so three digits of chrome cost one request per
  // screen rather than one per minute. Null fields draw nothing.
  const [collapsed, setCollapsed] = useState(false);
  const [badges, setBadges] = useState(null);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* private mode — open is the safe default */
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* nothing to remember it in; the session still works */
      }
      return !c;
    });
  }
  useEffect(() => {
    if (chromeless) return undefined;
    let cancelled = false;
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      zone = "";
    }
    fetch(`/api/sales/badges${zone ? `?timeZone=${encodeURIComponent(zone)}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setBadges(body);
      })
      .catch(() => {
        /* the digits are chrome; a failed read draws none, never a wrong one */
      });
    return () => {
      cancelled = true;
    };
  }, [chromeless, pathname]);

  if (chromeless) {
    return <div className="min-h-screen bg-muted">{children}</div>;
  }

  // ── One width for reading, a wider one for the console ────────────────────
  //
  // max-w-5xl is right for the five single-column screens: they are prose and
  // cards a rep reads top to bottom, and a 1400px line of body text is worse
  // than an 1024px one. /sales/queue is not that — it is a working surface with
  // a persistent list beside a detail pane, and squeezing both into 1024px puts
  // the pane at roughly 640px, which is narrower than the single-column screen
  // it replaced. Widened for that route only rather than everywhere, because
  // "make it all wider" would have cost the four reading screens their measure
  // to fix one console. Header, tabs and body share the constant so the three
  // stay aligned.
  //
  // /sales/messages joined the wide set when it became a three-pane chat
  // client: a 280px room list, the thread, and a 340px contact bar do not
  // fit in 1024px without the thread — the pane a rep reads — going below
  // 400px.
  const wide = pathname.startsWith("/sales/queue") || pathname.startsWith("/sales/messages");
  const container = `${wide ? "max-w-7xl" : "max-w-5xl"} mx-auto px-4 sm:px-6`;

  // ── The one list of what the portal has ─────────────────────────────────
  //
  // Mapped twice — the desktop row below, and SalesMobileTabBar's bar and
  // drawer — and declared once. Twelve check scripts parse this literal for
  // the href/label pairs, which is why it stays an array literal in this file
  // rather than moving to a module: it is the single source of "what the
  // portal HAS", and everything that names a tab is checked against it.
  const tabs = [
    // ── Every tab is a key now, and that reversed a decision ──────
    //
    // Seven of these were English LITERALS on purpose, and the reason
    // was written here at length: the screen behind each of them was
    // English, and a translated tab opening an English page is a worse
    // inconsistency than an English tab. That reasoning was correct
    // while it was true, and it stopped being true when the screens
    // were translated. The order mattered — screen first, then its tab
    // — so that at no point did a Spanish word open an English page.
    //
    // What the old arrangement actually shipped was the thing it was
    // trying to avoid: the owner opened the portal on a Spanish rep
    // account and read "Today | Cola | Playbook | Mis prospectos |
    // Conversaciones | Texts | Team | Notes", five words in one
    // language and seven in another, side by side in one row.
    //
    // The front door, and the only tab that answers "what do I do next".
    { href: "/sales", label: t("app.salesPortal.navToday") },
    // The prospecting queue, before the rep's own typed-in leads:
    // it is the screen a rep opens first in the morning, and the one
    // the whole discovery pipeline exists to fill.
    { href: "/sales/queue", label: t("app.salesPortal.navQueue") },
    // The script, the twenty objections and the five battlecards, read
    // before the call rather than only inside a claimed prospect's
    // card.
    { href: "/sales/playbook", label: t("app.salesPortal.navPlaybook") },
    { href: "/sales/leads", label: t("app.salesPortal.navLeads") },
    { href: "/sales/threads", label: t("app.salesPortal.navConversations") },
    // Texts, which are a different channel from the email threads next
    // to them: a reply to a text arrives at FieldQuo's sales number and
    // is filed by phone, not by thread token.
    { href: "/sales/messages", label: t("app.salesPortal.navTexts") },
    // FieldQuo's own team chat, and a THIRD distinct thing beside the
    // two above it: Conversations is email to a prospect, Texts is SMS
    // to a prospect, and this is the people a rep works with. Placed
    // next to them because it is the same verb — the difference is who
    // is on the other end, not what you do.
    { href: "/sales/team", label: t("app.salesPortal.navTeam") },
    // The day the notes screens were translated, which the previous
    // comment here named as the condition for this becoming a key.
    { href: "/sales/notes", label: t("app.salesPortal.navNotes") },
    // The rep's own calendar — appointments and callbacks.
    { href: "/sales/calendar", label: t("app.salesPortal.navCalendar") },
    // The attributed-companies book. It was the portal root until the
    // Today screen took that slot; it keeps its translated label
    // because the screen behind THIS one is still translated.
    { href: "/sales/companies", label: t("app.salesPortal.myCompanies") },
    // The account a rep drives in front of a prospect.
    { href: "/sales/demo", label: t("app.salesPortal.navDemo") },
    // Where a rep sends a technical problem they heard from one of
    // their contractors. Beside the companies book rather than at the
    // end: a rep opens it FROM a conversation about a company, and
    // burying it under Pay would make the channel that exists to stop
    // reports evaporating hard to find.
    { href: "/sales/support", label: t("app.salesPortal.navSupport") },
    // Messages left on the rep's own number. Before this screen the
    // only place a sales voicemail could be played was the superadmin
    // floor board, so the person the message was FOR could not hear it.
    { href: "/sales/voicemail", label: t("app.salesPortal.navVoicemail") },
    // How the rep gets paid. Last, because it is a settings screen
    // rather than a working one — visited once when they join and
    // again when their bank changes, not every morning.
    { href: "/sales/pay", label: t("app.salesPortal.navPay") },
  ];

  const callsToday = Number.isFinite(badges?.callsToday) ? badges.callsToday : null;
  const batchMax = Number.isFinite(badges?.dayCap) ? badges.dayCap : null;
  const progress =
    callsToday !== null && batchMax ? Math.max(0, Math.min(100, Math.round((callsToday / batchMax) * 100))) : 0;

  return (
    // ── Presence is held above every screen ──────────────────────────────
    //
    // RepPresenceProvider loads the rep's own status once, beats the
    // heartbeat, and hands the same object to the header picker, the drawer
    // picker, the incoming-call drawer and the queue's autodialler. It wraps
    // the chrome as well as <main> because the drawer — which reports "a
    // call is ringing" into it — is mounted here, beside the tour.
    <RepPresenceProvider>
    <SalesSearchProvider>
    <ConsoleSlotsProvider>
    {/* fq-sales-shell sets --fq-tab-bar-height for everything inside it below
        lg — the one place the bottom bar's footprint is declared, exactly as
        .fq-app-shell does for /app. See the "bottom dock" section of
        app/globals.css. The tour launcher and the incoming-call drawer read
        the same variable to sit ABOVE the bar rather than under it. */}
    <div
      className="min-h-screen bg-muted fq-sales-shell lg:flex lg:items-stretch"
      // The rail's width, for anything fixed beside it — the incoming-call
      // drawer spans the body from this edge. Read as a variable so the
      // drawer never hard-codes a width the rail can change by folding.
      style={{ "--fq-sales-rail": collapsed ? "76px" : "220px" }}
    >
      {/* ── The sidebar, from lg up ─────────────────────────────────────
          Sticky for the viewport's height so the rows and the foot stay in
          reach while a long screen scrolls. bg-sidebar is the navy the /app
          rail wears — the same product, the same rail. */}
      <aside
        data-sales-sidebar
        data-collapsed={collapsed ? "true" : "false"}
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 motion-reduce:transition-none ${
          collapsed ? "w-[76px]" : "w-[220px]"
        }`}
      >
        <div className={`flex items-center gap-2 px-3 min-h-[56px] border-b border-sidebar-border ${collapsed ? "justify-center" : "justify-between"}`}>
          {/* The wordmark. text-sidebar-primary is the brand orange on navy —
              5.4:1 — and the one place the accent sits in this rail besides
              the active row. */}
          {!collapsed ? (
            <Link href="/sales" className="flex items-center gap-2 min-w-0 min-h-[44px]">
              <BadgeDollarSign size={16} className="text-sidebar-primary shrink-0" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-primary break-words">
                {t("app.salesPortal.title")}
              </span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("app.sidebar.expand") : t("app.sidebar.collapse")}
            title={collapsed ? t("app.sidebar.expand") : t("app.sidebar.collapse")}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            data-sales-sidebar-toggle
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        {/* ── The rows, from `lg` up ──────────────────────────────────────
            Below lg the bar and drawer in SalesMobileTabBar carry every one
            of these same entries; this column is hidden there, not
            duplicated. No whitespace-nowrap and no truncate — a label that
            needs two lines gets two lines, which is legible, where a clipped
            one is not. When the rail is folded the label is gone and the
            icon's title says it. */}
        <nav className="hidden lg:flex flex-col gap-0.5 p-2 flex-1 min-h-0 overflow-y-auto">
          {tabs.map((tab) => {
            // Exact match for the portal root, prefix for the rest: /sales is a
            // prefix of every other tab, so "starts with" would light all six
            // at once and the rail would never say where you are.
            const active =
              tab.href === "/sales" ? pathname === "/sales" : pathname.startsWith(tab.href);
            const Icon = TAB_ICONS[tab.href] || BookOpen;
            const badgeField = TAB_BADGES[tab.href];
            const badge = badgeField && Number.isFinite(badges?.[badgeField]) && badges[badgeField] > 0 ? badges[badgeField] : null;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                // What the portal tour draws its ring around. Keyed on the
                // href rather than on a second slug, so there is no third
                // vocabulary to keep in step with this array — a tab that
                // moves takes its anchor with it, and a tab that is REMOVED
                // takes the anchor away, which is what makes
                // scripts/check-sales-tour.mjs's target assertion mean
                // something. See app/sales/tourSteps.js.
                data-sales-tour={tab.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? tab.label : undefined}
                className={`relative flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium border-l-2 ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? // Orange marks the active row — the one place the accent
                      // earns its loudness in this rail. Text stays the rail's
                      // white on the accent fill: --sidebar-primary-foreground
                      // is the dark ink the token pairs with it (7.9:1).
                      "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "border-transparent text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                {!collapsed ? <span className="break-words min-w-0 flex-1">{tab.label}</span> : null}
                {/* The badge: a count the server could read, above zero.
                    Folded, it sits on the icon's corner so the number is
                    still there. */}
                {badge !== null ? (
                  <span
                    className={`inline-flex items-center justify-center rounded-full min-w-[20px] h-5 px-1.5 text-[11px] font-bold tabular-nums ${
                      active ? "bg-sidebar-primary-foreground text-sidebar-primary" : "bg-sidebar-primary text-sidebar-primary-foreground"
                    } ${collapsed ? "absolute -top-0.5 -right-0.5" : ""}`}
                    data-sales-badge={badgeField}
                    aria-label={t("app.salesPortal.badgeCount", { count: badge })}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* ── The foot: calls today against the batch, and the motto ────── */}
        <div className="border-t border-sidebar-border p-3 space-y-2" data-sales-calls-today>
          {callsToday !== null ? (
            <>
              <div className={`flex items-baseline gap-2 ${collapsed ? "flex-col items-center gap-0" : "justify-between"}`}>
                {!collapsed ? (
                  <span className="text-xs text-sidebar-muted-foreground">{t("app.salesPortal.callsToday")}</span>
                ) : null}
                <span className="text-sm font-semibold tabular-nums" title={collapsed ? t("app.salesPortal.callsToday") : undefined}>
                  {batchMax ? `${callsToday} / ${batchMax}` : callsToday}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full bg-sidebar-accent overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={batchMax || 100}
                aria-valuenow={callsToday}
                aria-label={t("app.salesPortal.callsToday")}
              >
                <div className="h-full bg-sidebar-primary" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : null}
          {!collapsed ? (
            <p className="text-[11px] leading-4 text-sidebar-muted-foreground break-words">{t("app.salesPortal.motto")}</p>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 flex-1 flex flex-col">
        {/* Hidden below lg: SalesMobileTabBar draws the top bar there, with the
            same wordmark, and its drawer carries the name and the sign-out. */}
        <header className="hidden lg:block bg-card border-b border-border sticky top-0 z-30 h-[61px]">
          {/* py-2, not py-4: the sign-out button below is a 44px target, so
              the old padding would have added 24px of dead chrome to the top
              of every screen. Full width, not `container`: the bar spans the
              body beside the rail, and centring its three items over a
              narrower measure would float the search box away from the
              rail it sits beside. */}
          <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
            <SearchBox />
            <div className="flex items-center gap-3 min-w-0">
              {/* ── The status menu, from lg up ─────────────────────────────
                  Available · Break · Dinner · Meeting · Training · Off, with
                  the current state and how long, as one button that opens
                  the six. In the bar rather than on a screen because a rep
                  goes to dinner from wherever they are; the drawer carries
                  the same control below lg. See RepStatus.js. */}
              <RepStatusPicker layout="menu" />
              {me?.name && (
                <span className="text-sm text-muted-foreground break-words hidden sm:inline" data-sales-rep-name>
                  {me.name}
                </span>
              )}
              {/* min-h-[44px]: a 20px-tall text button is the one target on
                  this bar a thumb misses. Height only — no padding — so the
                  bar does not grow. */}
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] justify-center text-sm font-medium text-muted-foreground hover:text-foreground"
                aria-label={t("app.salesPortal.signOut")}
                title={t("app.salesPortal.signOut")}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>
        {/* The phone chrome: top bar, bottom bar, drawer. Renders nothing from
            lg up. Handed the same list the rail above maps over. Mounted
            BEFORE <main> because the top bar is sticky in normal flow —
            mounted after it, the bar rendered at the foot of the document,
            measured at y=2336 on a 844px phone. The bottom bar and the drawer
            are fixed, so their place in the tree does not matter. */}
        {/* drawerExtra: the same picker the bar carries from lg up, as a
            list of rows at the top of the drawer. Passed as a node so the bar
            never names a status. */}
        <SalesMobileTabBar tabs={tabs} name={me?.name || null} onSignOut={signOut} drawerExtra={<RepStatusPicker layout="list" />} />
        {/* The bottom padding reserves exactly what is pinned over the bottom
            of the viewport below lg — the tab bar's row plus the safe-area
            inset, through the variable app/globals.css declares — and only the
            ordinary page padding from lg up, where the variable is 0. Every
            screen inherits it, so no page needs its own pb-24 guess. */}
        <main
          className={`${container} w-full pt-6 sm:pt-8 pb-[calc(var(--fq-tab-bar-height)+1.5rem)] sm:pb-[calc(var(--fq-tab-bar-height)+2rem)]`}
        >
          {children}
        </main>
      </div>
      {/* Mounted once, here, so a contractor ringing back reaches the rep
          wherever they are in the portal. A listener that only existed on the
          dialler screen would ring only while somebody happened to be looking
          at it — see the component's header. */}
      <IncomingCallDock />
      {/* Mounted beside the drawer, and below it: the tour needs the rows above
          to point at, so it belongs to the chrome rather than to any one
          screen, and a rep should be able to follow it from wherever they are.
          Deliberately AFTER the call drawer in the tree and at a lower
          z-index — a contractor ringing back outranks a walkthrough. Nothing
          renders here for a rep who dismissed it, and nothing renders on
          /sales/login or /sales/invite, which return above this. */}
      <SalesTour />
    </div>
    </ConsoleSlotsProvider>
    </SalesSearchProvider>
    </RepPresenceProvider>
  );
}
