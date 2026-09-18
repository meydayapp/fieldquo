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
// The sidebar's foot is "Calls today N" — dials this rep placed since their
// local day started (no ceiling: the owner removed the 250 on 2026-09-14) —
// and a motto. The number comes from /api/sales/badges, the one request this
// chrome makes for its digits; a count that could not be read is null there
// and draws nothing here.
//
// Breakpoint: lg, not md. The amendment said "md+", but the mobile bar,
// the drawer, the tour, --fq-tab-bar-height and four check scripts all switch
// at lg, and a sidebar at md beside a bottom bar that hides at lg would show
// both between 768 and 1023px. One constant; flip it in one place if the
// owner wants tablets on the sidebar.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import IncomingCallDock from "@/app/components/sales/IncomingCallDock";
import { RepPresenceProvider, RepStatusPicker } from "@/app/components/sales/RepStatus";
import AvailableReminder from "@/app/components/sales/AvailableReminder";
import { clearReminderDismissed } from "@/lib/sales/availableReminder";
import SalesMobileTabBar from "@/app/components/sales/SalesMobileTabBar";
import SalesTour from "@/app/components/sales/SalesTour";
import { fetchJson } from "@/lib/fetchJson";
import { UnloggedCallsGate } from "@/app/components/sales/UnloggedCalls";
import ToastLayer from "@/app/components/ToastLayer";
import { notify } from "@/lib/notify/browser";
import { onBadgesChanged } from "@/lib/chat/badges";
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
  PencilLine,
  PhoneCall,
  Search,
  Settings,
  Sun,
  Users,
  UsersRound,
  Voicemail,
  Wallet,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { AGENCY_TEAM_HREF, portalTabsFor } from "@/lib/sales/portalTabs";

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
  "/sales/settings": Settings,
  // The agency's row — the literal, equal to lib/sales/portalTabs.js's
  // AGENCY_TEAM_HREF (scripts/check-sales-agency.mjs holds the two together),
  // so scripts/check-sales-home.mjs can see the screen is reachable from here.
  "/sales/agency": Building2,
};

/** Which badge each row wears, by href → field of /api/sales/badges. */
const TAB_BADGES = {
  "/sales/queue": "unlogged",
  "/sales/messages": "texts",
  "/sales/team": "team",
  "/sales/voicemail": "voicemail",
};

/**
 * A SECOND digit on a row: drafts waiting for the rep to press Send, on
 * Texts. Its own map and its own look (outlined, with a pencil) rather than
 * added into `texts`: an unread reply and an unsent draft are different
 * calls on the rep's attention — one is a contractor waiting, the other is
 * the engine waiting — and one number for both would say neither. The
 * field is lib/sales/checkin/waiting.js's count, the same one the Today
 * card and the texts banner show.
 */
const TAB_DRAFT_BADGES = {
  "/sales/messages": "drafts",
};

const COLLAPSE_KEY = "fq-sales-sidebar-collapsed";

/** How often the badges are re-read while the tab is VISIBLE. 10s, down
 *  from 60 on 2026-09-14: the Team badge is how a rep learns a direct
 *  message landed while they were on another screen, and a minute is long
 *  enough for the person who wrote it to think they were ignored. It is one
 *  small request; the interval is cleared outright while the tab is hidden
 *  (not merely skipped), and the badges are re-read the instant the tab is
 *  focused or becomes visible again — and the instant a chat screen says
 *  a room was opened or written to (lib/chat/badges.js). */
const BADGE_POLL_MS = 10 * 1000;

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

  // ── Sign out, after the calls with no outcome ─────────────────────────
  //
  // A rep who pressed "write it up later" three times today is asked once,
  // here, before they go: the list, two minutes, and a button that signs
  // out anyway. Not a wall — the cron logs whatever is left as the line's
  // verdict at day end (app/api/cron/sales-queue-release). The count is
  // asked fresh rather than read off the badge, which can be ten seconds
  // stale, and a failed count signs out rather than trapping the rep.
  const [unloggedGate, setUnloggedGate] = useState(null);
  async function signOutNow() {
    await fetch("/api/sales/auth/logout", { method: "POST" });
    // The "You're shown as Off" reminder is dismissed per browser session;
    // a sign-out ends the session it was dismissed in, whatever the tab's
    // storage thinks (lib/sales/availableReminder.js).
    clearReminderDismissed();
    window.location.href = "/sales/login";
  }
  async function signOut() {
    let count = 0;
    try {
      const body = await fetchJson("/api/sales/calls/unlogged");
      count = Number.isFinite(body?.count) ? body.count : 0;
    } catch {
      count = 0;
    }
    if (count > 0) {
      setUnloggedGate({ count });
      return;
    }
    await signOutNow();
  }

  // ── The sidebar's own state: folded or not, and its digits ─────────────
  //
  // `collapsed` is remembered per browser, the way /app's rail remembers
  // itself. `badges` is /api/sales/badges' answer — re-asked on every
  // navigation and, since 2026-09-12, once a minute while the tab is
  // visible: the texts badge is how the portal learns a contractor wrote
  // back, and a number that only moved on navigation could not tell a rep
  // sitting on one screen. Null fields draw nothing.
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
  // The unread-texts count the last read saw (null until one has), and the
  // current t for the poll below — which is bound once per pathname, not
  // once per language.
  const textsSeen = useRef(null);
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (chromeless) return undefined;
    let cancelled = false;
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      zone = "";
    }
    const read = () =>
      fetch(`/api/sales/badges${zone ? `?timeZone=${encodeURIComponent(zone)}` : ""}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (cancelled || !body) return;
          setBadges(body);
          // ── The in-tab half of browser notifications: texts ──────────
          //
          // The badge is the one number this chrome already reads, and a
          // count that ROSE since the last read is a contractor writing
          // back. Told through notify(): a toast on a focused tab, a
          // system notification on a background one (lib/notify/
          // browser.js). Only from the second read on, so a reload does
          // not announce a backlog the badge already shows. The server's
          // push for the same text names the sender; this one cannot
          // (a count is all the badge route returns) and says how many.
          const texts = Number.isFinite(body.texts) ? body.texts : null;
          if (texts !== null && textsSeen.current !== null && texts > textsSeen.current) {
            notify({
              title: tRef.current("app.notify.newTexts.title", { count: texts }),
              tag: "sales-texts",
              url: "/sales/messages",
            });
          }
          if (texts !== null) textsSeen.current = texts;
        })
        .catch(() => {
          /* the digits are chrome; a failed read draws none, never a wrong one */
        });
    read();
    // Then every BADGE_POLL_MS while the tab is visible. The interval is
    // STOPPED while the tab is hidden rather than ticking and skipping — a
    // phone in a pocket should not wake a timer for three digits nobody is
    // looking at — and restarted, with an immediate read, when the tab is
    // shown or focused again, so the digits are right the moment the rep
    // looks rather than up to ten seconds later.
    let id = null;
    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const start = () => {
      if (id !== null) return;
      id = setInterval(read, BADGE_POLL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        read();
        start();
      }
    };
    const onFocus = () => {
      read();
      start();
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    // And the moment a chat screen says the digits moved — a room opened,
    // a message sent — rather than up to ten seconds later. The Team badge
    // that stayed lit over an open room was the owner's report; this is the
    // half of the fix on this side of the event (lib/chat/badges.js).
    const offBadges = onBadgesChanged(read);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      offBadges();
    };
  }, [chromeless, pathname]);

  if (chromeless) {
    return (
      <div className="min-h-screen bg-muted">
        {children}
        {/* The sign-in and invite screens report failures through the same
            showError() as the rest of the portal; without a layer here a
            wrong password would fail silently. "bare", not "sales": the
            sales surface class declares the tab bar's footprint below lg,
            and these two screens have no bar to clear. */}
        <ToastLayer surface="bare" />
      </div>
    );
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
  // 400px. Since 2026-09-18 it has NO cap either, for the queue's reason
  // below: a rep on a 1600px screen had the thread — the pane with the
  // composer in it — squeezed to ~300px inside a centred band, with dead
  // space either side. The thread takes what the sidebar leaves, and the
  // contact bar gives way below 1400px (ChatLayout contextColumnFrom).
  //
  // /sales/queue has NO cap since 2026-09-14. The owner, on a 2000px screen:
  // the console sat in a centred 1080px band with dead space either side,
  // and the tabbed card — the thing holding the script, the research and
  // the notes — was the narrowest element on the page, its tab strip
  // scrolling. A cap is right for prose; a working surface with a fixed
  // 360px dialler beside one flexible card wants every pixel the sidebar
  // leaves, and the card takes all of it (flex-1 min-w-0 in the page).
  const container = `${
    pathname.startsWith("/sales/queue") || pathname.startsWith("/sales/messages") ? "max-w-none" : "max-w-5xl"
  } mx-auto px-4 sm:px-6`;

  // ── The one list of what the portal has ─────────────────────────────────
  //
  // Mapped twice — the desktop row below, and SalesMobileTabBar's bar and
  // drawer — and declared once. Twelve check scripts parse this literal for
  // the href/label pairs, which is why it stays an array literal in this file
  // rather than moving to a module: it is the single source of "what the
  // portal HAS", and everything that names a tab is checked against it.
  const allTabs = [
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
    // Everything about the rep that is not money: the portal's language,
    // the languages they sell in, browser notifications, their profile.
    // Split out of Pay on the owner's instruction ("Pay and languages
    // should not be in the same page"), and last for the same reason Pay
    // is near the end — set once, changed rarely.
    { href: "/sales/settings", label: t("app.salesPortal.navSettings") },
  ];
  // ── The agency tier changes two rows, and only after /api/sales/me ──
  //
  // A call-centre agency's employee has no Pay row: their commission is paid
  // to the agency, and the routes behind the screen refuse them
  // (lib/sales/agency.js). The agency account gets a My team row the twelve
  // check scripts that parse the literal above never see — it is built from
  // a constant, on purpose, because it exists for one kind of account and a
  // tour step pointing at a row most reps do not have would ring nothing.
  // Until `me` has answered, the list is the ordinary one; a rep's rail must
  // not flicker a row in and out on every load.
  const tabs = portalTabsFor(allTabs, me, {
    teamLabel: t("app.salesPortal.navAgencyTeam"),
  });

  // The count alone. It was "24 / 250" over a progress bar until the owner
  // removed the daily ceiling (2026-09-14); a bar filling towards a number
  // that stops nothing would be a limit drawn where none exists.
  const callsToday = Number.isFinite(badges?.callsToday) ? badges.callsToday : null;

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
            const draftField = TAB_DRAFT_BADGES[tab.href];
            const draftBadge = draftField && Number.isFinite(badges?.[draftField]) && badges[draftField] > 0 ? badges[draftField] : null;
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
                {/* Drafts waiting to be sent: outlined, with the pencil, so
                    it cannot be read as unread replies. Folded, it sits on
                    the icon's other corner. */}
                {draftBadge !== null ? (
                  <span
                    className={`inline-flex items-center justify-center gap-0.5 rounded-full min-w-[20px] h-5 px-1.5 text-[11px] font-bold tabular-nums border ${
                      active
                        ? "border-sidebar-primary-foreground text-sidebar-primary-foreground"
                        : "border-sidebar-primary text-sidebar-primary"
                    } ${collapsed ? "absolute -bottom-0.5 -right-0.5 bg-sidebar" : ""}`}
                    data-sales-badge={draftField}
                    aria-label={t("app.salesPortal.badgeDrafts", { count: draftBadge })}
                    title={t("app.salesPortal.badgeDrafts", { count: draftBadge })}
                  >
                    <PencilLine size={10} aria-hidden="true" />
                    {draftBadge > 99 ? "99+" : draftBadge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* ── The foot: calls today, and the motto ─────────────────────── */}
        <div className="border-t border-sidebar-border p-3 space-y-2" data-sales-calls-today>
          {callsToday !== null ? (
            <>
              <div className={`flex items-baseline gap-2 ${collapsed ? "flex-col items-center gap-0" : "justify-between"}`}>
                {!collapsed ? (
                  <span className="text-xs text-sidebar-muted-foreground">{t("app.salesPortal.callsToday")}</span>
                ) : null}
                <span className="text-sm font-semibold tabular-nums" title={collapsed ? t("app.salesPortal.callsToday") : undefined}>
                  {callsToday}
                </span>
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
        {/* ── Test account ─────────────────────────────────────────────
            One thin line on every screen, for a rep whose SalesRep.testAccount
            a superadmin set: their dials are not held to the calling window
            and are counted nowhere. Persistent, not dismissable, and drawn
            from /api/sales/me's fresh read — a rep should never discover
            from a stat that their morning did not count. Between the chrome
            and <main>, so it is in normal flow under both top bars. */}
        {me?.testAccount === true ? (
          <div
            role="status"
            data-test-account-banner
            className="border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 sm:px-6 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 text-center"
          >
            {t("app.salesPortal.testAccountBanner")}
          </div>
        ) : null}
        <UnloggedCallsGate
          open={Boolean(unloggedGate)}
          count={unloggedGate?.count ?? null}
          onClose={() => setUnloggedGate(null)}
          onProceed={signOutNow}
          proceedLabel={t("app.salesCall.unlogged.signOutAnyway")}
          onAllDone={() => setUnloggedGate(null)}
        />
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
      {/* "You're shown as Off" — the reminder a rep who signed in without
          pressing Available sees once per session, with Go available and OK
          (app/components/sales/AvailableReminder.js). Mounted here, under the
          provider, so it reads the same presence object the picker and the
          dock do, and hides itself the moment either reports a call. */}
      <AvailableReminder />
      {/* Mounted beside the drawer, and below it: the tour needs the rows above
          to point at, so it belongs to the chrome rather than to any one
          screen, and a rep should be able to follow it from wherever they are.
          Deliberately AFTER the call drawer in the tree and at a lower
          z-index — a contractor ringing back outranks a walkthrough. Nothing
          renders here for a rep who dismissed it, and nothing renders on
          /sales/login or /sales/invite, which return above this. */}
      <SalesTour />
      {/* The toast layer — the queue's top-up notice, every showError() on
          this surface (which reached nobody before 2026-09-12: nothing was
          mounted to listen), and the in-tab half of browser notifications.
          A portal at document.body, above the call dock and the tour's pill,
          which used to cover the queue's own toast. */}
      <ToastLayer surface="sales" />
    </div>
    </ConsoleSlotsProvider>
    </SalesSearchProvider>
    </RepPresenceProvider>
  );
}
