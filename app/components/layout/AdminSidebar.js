// app/components/layout/AdminSidebar.js
"use client";

import { useState, useEffect, useMemo, createElement } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useImpersonation } from "@/app/hooks/useImpersonation";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import TrialBadge from "@/app/components/layout/TrialBadge";
import NavDrawer from "@/app/components/layout/NavDrawer";
import {
  Plus,
  MessageSquare,
  MessageCircle,
  Home,
  Filter,
  Calendar,
  Users,
  ClipboardList,
  FileText,
  Briefcase,
  Receipt,
  Megaphone,
  Palette,
  Headset,
  BadgeCheck,
  Clock,
  CalendarClock,
  CalendarDays,
  CalendarSync,
  Wallet,
  Gift,
  Handshake,
  Sparkles,
  Bot,
  Compass,
  Gauge,
  Eye,
  UserCog,
  ShieldAlert,
  BookOpen,
  ListTodo,
  ShoppingCart,
  Truck,
  HardHat,
  ShieldCheck,
  CreditCard,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Search,
  X,
  MessagesSquare,
} from "lucide-react";
import Logo from "@/app/components/Logo";
import { activeGroupKey, isGroupOpen } from "@/app/components/layout/navDisclosure";
import { useGroupDisclosure } from "@/app/components/layout/NavFilter";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { filterNavGroups, filterNavItems } from "@/lib/features/nav";
import {
  filterNavGroupsByPermission,
  filterNavItemsByPermission,
} from "@/lib/permissions/nav";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useTradeGate } from "@/app/providers/TradeGateProvider";
import { filterNavGroupsByTrade } from "@/lib/settings/tradeGateNav";
import FeatureRowBadge from "@/app/components/layout/FeatureRowBadge";
import { useNavShell, isSettingsPath } from "@/app/components/layout/NavShell";
import { SettingsPanel } from "@/app/components/layout/SettingsSidebar";
import { useRovingRows } from "@/app/components/layout/rovingRows";

// ── Seventeen rows, four groups, and a More ─────────────────────────────────
//
// This rail held forty destinations in five folding groups. In an 860px-tall
// window it showed Home, the eight Work rows and the first row of People
// before it scrolled; the rest of the product was below the fold or behind a
// fold. The 2026-09-21 study of Jobber (docs/research/jobber-ui-study.md)
// measured theirs at seventeen rows, no headings, one submenu — and the
// owner's verdict was "FieldQuo is very heavy on the side menus". So this is
// a REORGANISATION, not a cut: every destination that existed still exists,
// and the owner's own list of what must stay first-class — the AI review,
// the AI employees, schedule and dispatch, quotes, jobs, invoices, clients,
// leads, the inbox, reports — is what the seventeen are. Everything else is
// one click away under More (/app/more, and the phone's bottom sheet), and
// scripts/check-shell.mjs proves two things about that every build: the
// flagship rows are top-level, and every old row is still reachable in two
// taps.
//
// The order inside "Work" is the order work actually moves:
//
//   Leads -> Quotes -> Quote reviews -> Jobs -> Invoices
//
// A lead becomes a quote, a reviewed quote goes out, an accepted quote
// becomes a job, a finished job becomes an invoice. Calendar sits at the end
// of Work because it's where scheduled jobs land, not where work starts.
//
// ── Which rows are "trade" rows ─────────────────────────────────────────────
//
// Owner, same day: "anything not needed for a roofer that a painter or an
// HVAC guy needs is not shown — although every button we have is good for
// all trades, maybe just reorganisation." So the default is SHOW. A row is
// removed only when companyTradeGate() proves the company cannot use it —
// the same gate that already hides Cabinet Rates and Material Costs in
// Settings (NAV_ROW_TRADE_GATE beside SETTINGS_ROW_TRADE_GATE in
// lib/settings/tradeGateNav.js). Feature flags (lib/features/nav.js) and the
// permission grid (lib/permissions/nav.js) keep doing what they do; the
// trade gate is a third filter, not a replacement for either.
//
// ── Collapsible, with two groups deliberately not ───────────────────────────
//
// The groups fold and remember it. "Work" and "AI" do NOT fold, for a
// concrete reason rather than a taste one: app/components/tours.js points
// the first-run walkthrough at [data-tour='nav-requests'], 'nav-quotes',
// 'nav-estimate-reviews' and 'nav-ai', and OnboardingTour requires a target
// that measures non-zero. A collapsed group unmounts its items, so a folded
// Work is a walkthrough that silently never starts. `pinned` is that rule,
// made explicit and enforced: check:sidebar fails if any group holding a
// `tour` item is foldable.
export const NAV_GROUPS = [
  {
    key: "app.nav.group.work",
    pinned: true,
    items: [
      { key: "app.nav.requests", href: "/app/leads", icon: ClipboardList, tour: "nav-requests", helpArticle: "requests" },
      { key: "app.nav.quotes", href: "/app/quotes", icon: FileText, tour: "nav-quotes", helpArticle: "quotes" },
      // The AI review of a quote before it goes out — the owner named it
      // first among the things the shell must not bury.
      { key: "app.nav.estimateReviews", href: "/app/estimate-reviews", icon: BadgeCheck, tour: "nav-estimate-reviews", helpArticle: "estimate-reviews" },
      { key: "app.nav.jobs", href: "/app/jobs", icon: Briefcase, helpArticle: "jobs" },
      { key: "app.nav.invoices", href: "/app/invoices", icon: Receipt, helpArticle: "invoices" },
      // Appointments and bookings — the schedule half of "schedule and
      // dispatch". The dispatch half (Assign shifts) is under People, because
      // it is about who, not when.
      { key: "app.nav.calendar", href: "/app/appointments", icon: Calendar, helpArticle: "calendar" },
    ],
  },
  {
    key: "app.nav.group.people",
    items: [
      { key: "app.nav.clients", href: "/app/clients", icon: Users, helpArticle: "clients" },
      // The company talking to itself: #general, a room per active job,
      // direct messages. No NAV_REQUIREMENTS entry on purpose — everyone on
      // the roster is in #general, so a Crew member with `none` on every
      // document ladder still gets this row, and it is the one row they are
      // certain to keep. It is also the phone's fifth tab.
      { key: "app.nav.chat", href: "/app/chat", icon: MessagesSquare, helpArticle: "chat" },
      // The dispatch board: who is on which site, when. Top-level on the
      // owner's word ("scheduling, dispatching"); the person's OWN schedule
      // and the team calendar VIEW of the same shifts are under More.
      { key: "app.nav.scheduler", href: "/app/scheduler", icon: CalendarClock, helpArticle: "scheduler" },
    ],
  },
  // Money RUNS money (payroll moves it); Insights READS it back. They share a
  // shelf here because at seventeen rows a one-row "Insights" group would be
  // the owner's own "a group with one item is usually a group that should
  // not exist". KPIs, Expenses, Purchasing and Vehicles are under More.
  {
    key: "app.nav.group.money",
    items: [
      { key: "app.nav.payroll", href: "/app/payroll", icon: Wallet, helpArticle: "payroll" },
      { key: "app.nav.insights", href: "/app/analytics/benchmark", icon: Compass, helpArticle: "insights" },
    ],
  },
  {
    key: "app.nav.group.grow",
    items: [
      { key: "app.nav.marketing", href: "/app/marketing", icon: Megaphone, helpArticle: "marketing" },
      // Facebook Page and Instagram business messages — a stranger who found
      // the company, i.e. a lead. The crew inbox (work coming in FROM the
      // van) is under More; the crew's own chat is under People.
      { key: "app.nav.messages", href: "/app/messages", icon: MessageCircle, helpArticle: "messages" },
      // The phone front desk — one of the AI employees, filed under Grow
      // because a stranger meets it, beside the inbox that stranger writes to.
      { key: "app.nav.receptionist", href: "/app/receptionist", icon: Headset, helpArticle: "receptionist" },
    ],
  },
  // The AI employees, as their own shelf. FieldQuo AI is the estimator's
  // assistant (answers about the company's own numbers); AI team is where
  // the employees are hired, given a face and a channel, and where their
  // proposals wait for a yes. Pinned: `nav-ai` is a tour anchor.
  {
    key: "app.nav.group.ai",
    pinned: true,
    items: [
      { key: "app.nav.ai", href: "/app/copilot", icon: Sparkles, tour: "nav-ai", helpArticle: "ai" },
      // A settings page with a rail row, the way Your team always was: the
      // AI team is something the owner opens weekly, not something set up
      // once. Gated in lib/permissions/nav.js on the same roles its
      // SETTINGS_ROW_CAPABILITY (user:manage) resolves to.
      { key: "app.nav.aiTeam", href: "/app/settings/ai-employee", icon: Bot, helpArticle: "settings-ai-employee" },
    ],
  },
];

// ── Everything else: one click away, grouped the same way ───────────────────
//
// Rendered by /app/more (a grid of tiles, one per group), by the phone's More
// sheet, and by the rail's own search. Same three filters as the rail, same
// trade gate. Nothing here was removed from the product — the rows below
// are exactly the rows the rail used to carry, minus the seventeen above.
export const MORE_GROUPS = [
  {
    key: "app.nav.group.moreWork",
    items: [
      // Recurring work sold as a package — a standing instruction to raise
      // an invoice.
      { key: "app.nav.plans", href: "/app/plans", icon: CalendarSync, helpArticle: "plans" },
      // What clients raised from their portal — repairs, warranty claims,
      // questions, reschedules, visits to book. Reached from here, from the
      // notification a new one raises, and from the count on a client's page.
      { key: "app.nav.clientTickets", href: "/app/tickets", icon: LifeBuoy, helpArticle: "the-client-portal-as-a-client" },
      // /app/tasks existed, worked, and was once reachable from NOTHING; it
      // stays a row so that never happens again.
      { key: "app.nav.tasks", href: "/app/tasks", icon: ListTodo, helpArticle: "tasks" },
      { key: "app.nav.funnels", href: "/app/funnels", icon: Filter, helpArticle: "funnels" },
      { key: "app.nav.crewInbox", href: "/app/crew-inbox", icon: MessageSquare, helpArticle: "crew-inbox" },
      // The multi-ratio ad canvas editor — its own row, not folded into the
      // Marketing hub, because it is a different verb (design one asset in
      // five sizes vs. run a campaign) and the reachability check needs its
      // own href to prove it reachable.
      { key: "app.nav.marketingDesigner", href: "/app/marketing/designer", icon: Palette, helpArticle: "marketing-designer" },
    ],
  },
  {
    key: "app.nav.group.moreCrew",
    items: [
      // The employee home — on a phone it is the bottom bar itself
      // (lib/me/tabs.js). No NAV_REQUIREMENTS entry: there is no level at
      // which a person has no home.
      { key: "app.nav.myHome", href: "/app/me", icon: Home, helpArticle: "my-home" },
      // The roster. Also in the avatar menu and on the settings index's Team
      // card — two taps from anywhere, which is the check's rule.
      { key: "app.nav.team", href: "/app/settings/team", icon: UserCog, helpArticle: "team" },
      { key: "app.nav.teamSchedule", href: "/app/schedule", icon: Calendar, helpArticle: "team-schedule" },
      { key: "app.nav.mySchedule", href: "/app/me/schedule", icon: CalendarDays, helpArticle: "my-schedule" },
      { key: "app.nav.clock", href: "/app/clock", icon: Clock, helpArticle: "clock" },
      { key: "app.nav.timesheets", href: "/app/settings/team/timesheets", icon: Clock, helpArticle: "timesheets" },
      { key: "app.nav.dailySheets", href: "/app/daily-sheets", icon: ClipboardList, helpArticle: "daily-sheets" },
      { key: "app.nav.timeOff", href: "/app/time-off", icon: CalendarClock, helpArticle: "time-off" },
      // report_own is the floor, not `none`, so this row shows for a Crew
      // member too — see lib/permissions.js's "safety" category.
      { key: "app.nav.safety", href: "/app/safety", icon: ShieldAlert, helpArticle: "safety" },
      { key: "app.nav.log", href: "/app/log", icon: BookOpen, helpArticle: "manager-log" },
    ],
  },
  {
    key: "app.nav.group.moreMoney",
    items: [
      { key: "app.nav.expenses", href: "/app/settings/expense-tracking", icon: Wallet, helpArticle: "expenses" },
      { key: "app.nav.purchasing", href: "/app/purchasing", icon: ShoppingCart, helpArticle: "purchasing" },
      // The contractor's own vans (`Asset`) — deliberately NOT beside Client
      // equipment, which is the customer's furnace.
      { key: "app.nav.fleet", href: "/app/fleet", icon: Truck, helpArticle: "fleet" },
      { key: "app.nav.kpis", href: "/app/analytics/kpis", icon: Gauge, helpArticle: "kpis" },
    ],
  },
  {
    key: "app.nav.group.morePartners",
    items: [
      { key: "app.nav.clientEquipment", href: "/app/equipment", icon: ShieldCheck, helpArticle: "client-equipment" },
      { key: "app.nav.subcontractors", href: "/app/subcontractors", icon: HardHat, helpArticle: "subcontractors" },
      { key: "app.nav.refer", href: "/app/settings/refer", icon: Gift, helpArticle: "refer" },
      // Only for a company enrolled in the influencer programme — filtered
      // out on the shell's own `isInfluencer` (resolved server-side by
      // AppLayout), not by a fetch.
      { key: "app.nav.influencer", href: "/app/influencer", icon: Handshake, helpArticle: "influencer" },
    ],
  },
];

/** Rows that exist only for an enrolled influencer company. */
const INFLUENCER_ONLY = new Set(["app.nav.influencer"]);
export function dropInfluencerRows(groups, isInfluencer) {
  if (isInfluencer) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !INFLUENCER_ONLY.has(i.key)) }))
    .filter((g) => g.items.length > 0);
}

// The Create menu — top bar on desktop, floating + on a phone (CreateMenu.js).
export const QUICK_ADD_ITEMS = [
  { key: "app.quickAdd.client", href: "/app/clients", icon: Users },
  { key: "app.quickAdd.request", href: "/app/leads", icon: ClipboardList },
  { key: "app.quickAdd.quote", href: "/app/quotes/new", icon: FileText },
  { key: "app.quickAdd.job", href: "/app/jobs", icon: Briefcase },
  { key: "app.quickAdd.invoice", href: "/app/invoices/new", icon: Receipt },
];

// Account rows. They used to sit in the scrolling rail; they now live in the
// avatar menu (TopBar.js) and at the end of the phone's More sheet. Settings
// ALSO keeps a row at the foot of the rail — it is the one of these somebody
// reaches for daily, and it is where the rail slides into its settings list.
export const BOTTOM_ITEMS = [
  { key: "app.nav.help", href: "/app/help", icon: LifeBuoy, helpArticle: "help" },
  { key: "app.nav.plan", href: "/app/settings/account-billing", icon: CreditCard, helpArticle: "plan" },
  { key: "app.nav.settings", href: "/app/settings", icon: Settings, tour: "nav-settings", helpArticle: "settings" },
];

export const HOME_ITEM = { key: "app.nav.home", href: "/app", icon: Home, helpArticle: "home" };
export const MORE_ITEM = { key: "app.nav.more", href: "/app/more", icon: LayoutGrid, helpArticle: "home" };
/** The AI row, for the help centre's list — the same object the AI group holds. */
export const AI_ITEM = NAV_GROUPS.find((g) => g.key === "app.nav.group.ai").items[0];

// What global search (and the phone sheet's box) covers on the menu side:
// every rail row, every More row, Home and the account rows. Home rides in
// the first group so the corpus has no one-row group; a menu search that
// quietly can't reach a third of the menu is worse than no search box.
export const SEARCH_CORPUS = [
  { ...NAV_GROUPS[0], items: [HOME_ITEM, ...NAV_GROUPS[0].items] },
  ...NAV_GROUPS.slice(1),
  ...MORE_GROUPS,
  { key: "app.nav.group.account", items: [...BOTTOM_ITEMS] },
];

/**
 * The rail's groups after the three cosmetic filters, in the order they
 * always apply: feature flags, then the permission grid, then the trade
 * gate. Exported so the More page, the phone sheet, the top bar's search and
 * the check script all read ONE pipeline rather than four restatements.
 */
export function useNavGroups(groups) {
  const featureFlags = useFeatureFlags();
  const caller = usePermissions();
  const tradeGate = useTradeGate();
  const { isInfluencer } = useCompanyPreferences();
  return useMemo(
    () =>
      filterNavGroupsByTrade(
        filterNavGroupsByPermission(
          dropInfluencerRows(filterNavGroups(groups, featureFlags), isInfluencer),
          caller,
        ),
        tradeGate,
      ),
    [groups, featureFlags, caller, tradeGate, isInfluencer],
  );
}

/** Flat lists (Create, the account rows) through the same two gates the rail applies to them. */
export function useNavItems(items) {
  const featureFlags = useFeatureFlags();
  const caller = usePermissions();
  return useMemo(
    () => filterNavItemsByPermission(filterNavItems(items, featureFlags), caller),
    [items, featureFlags, caller],
  );
}

// Everything is open on a first visit; folding is something the user CHOOSES
// once they know where things live. (This was once "open Work, fold the
// rest", and the owner went looking for the crew messaging agent and couldn't
// find it in the menu because Grow was folded. Folding solves "this rail is
// long" for someone who knows what's on it; it does not solve discovery.)
const DEFAULT_OPEN = NAV_GROUPS.map((g) => g.key);
const DISCLOSURE_KEY = "fq-nav-groups";

export default function AdminSidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  // Null unless this is a support session — see the identity row below.
  const impersonation = useImpersonation();
  const shell = useNavShell();
  // Owner/admin only — the same set Account & Billing itself enforces.
  const [canOpenBilling, setCanOpenBilling] = useState(false);
  useEffect(() => {
    fetch("/api/settings/members/self/role")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanOpenBilling(["owner", "admin"].includes(d?.yourRole)))
      .catch(() => {});
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const mobileOpen = shell.isOpen("drawer");
  const setMobileOpen = (v) => (v ? shell.open("drawer") : shell.close());

  const featureFlags = useFeatureFlags();
  const navGroups = useNavGroups(NAV_GROUPS);
  const moreGroups = useNavGroups(MORE_GROUPS);
  const bottomItems = useNavItems(BOTTOM_ITEMS);
  const settingsItem = bottomItems.find((i) => i.key === "app.nav.settings") || null;
  const moreCount = moreGroups.reduce((n, g) => n + g.items.length, 0);

  // Persist the expanded/contracted preference across visits.
  useEffect(() => {
    const stored = window.localStorage.getItem("fq-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fq-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // ── The settings slide ────────────────────────────────────────────────────
  //
  // Roofr's mechanic (docs/research/roofr-ui-study.md §2.2): clicking
  // Settings does not swap the rail for a second sidebar; a second list
  // slides over the same column, and "Back" slides it out. The URL does not
  // change on Back. What Roofr gets wrong — and this deliberately does not —
  // is the highlight: after Back, their main list shows no active row. Here
  // the Settings row at the foot stays lit while the URL is under
  // /app/settings, so "where am I" is always answered.
  //
  // Whether the panel is showing lives in NavShellProvider, which opens it
  // when the route ENTERS settings (a deep link included, on the first
  // paint) and closes it when the route leaves. Inside settings it is the
  // user's: Back keeps the main list until they open Settings again.
  const inSettings = isSettingsPath(pathname);

  async function handleLogout() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login");
          router.refresh();
        },
      },
    });
  }

  const isActive = (href) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const activeKey = activeGroupKey(navGroups, pathname, isActive);
  const { openKeys, toggle } = useGroupDisclosure({
    storageKey: DISCLOSURE_KEY,
    defaultOpenKeys: DEFAULT_OPEN,
    activeKey,
  });

  // Arrow keys walk the rows; Home/End jump. The list is the one thing on
  // the page a keyboard user tabs into fifty times a day, and forty Tab
  // presses to reach Settings was the complaint.
  const onRowsKeyDown = useRovingRows();

  // The row itself is a module-level component (RailLink, below): a function
  // declared in THIS body would get a new identity every render, and React
  // would unmount and remount every row on every render — which is how the
  // search box once lost focus after each keystroke (check-sidebar-focus).
  // `row()` is CALLED and returns the element; it is not itself a component,
  // so nothing remounts.
  const row = (item, { forceExpanded = false, onNavigate, trailing = null } = {}) => (
    <RailLink
      key={item.href}
      item={item}
      showLabel={forceExpanded || !collapsed}
      active={isActive(item.href)}
      label={t(item.key)}
      featureFlags={featureFlags}
      onNavigate={onNavigate}
      trailing={trailing}
    />
  );

  function mainList({ forceExpanded }) {
    const showLabel = forceExpanded || !collapsed;
    return (
      <nav
        className="flex-1 min-h-0 px-2.5 py-1 space-y-0.5 overflow-y-auto"
        aria-label={t("app.nav.mainMenu")}
        onKeyDown={onRowsKeyDown}
      >
        {row(HOME_ITEM, { forceExpanded })}

        {navGroups.map((group) => {
          const open = isGroupOpen({
            group,
            openKeys,
            searching: false,
            railCollapsed: !showLabel,
          });
          return (
            <div key={group.key} className="pt-2 first:pt-1">
              {/* Headings only when the rail is expanded. Collapsed, the
                  groups still read as groups because of the gap between
                  them — a heading squeezed into 76px would be truncated
                  noise, and there is nothing to toggle. */}
              {showLabel &&
                (group.pinned ? (
                  <div className="px-2 pt-1 pb-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground">
                    {t(group.key)}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(group.key)}
                    aria-expanded={open}
                    data-nav-row
                    className="w-full flex items-center gap-1.5 px-2 pt-1 pb-[3px] rounded-lg text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  >
                    <span className="truncate">{t(group.key)}</span>
                    <ChevronDown
                      size={13}
                      className={`ml-auto shrink-0 transition-transform motion-reduce:transition-none ${
                        open ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                ))}
              {open && (
                <div className="space-y-0.5">
                  {group.items.map((item) => row(item, { forceExpanded }))}
                </div>
              )}
            </div>
          );
        })}

        {/* More — the rest of the product, one click away. The count is the
            number of rows this member would actually see there, after the
            same three filters, so it is never "27" over an empty page. */}
        {moreCount > 0 && (
          <div className="pt-2">
            {row(MORE_ITEM, {
              forceExpanded,
              trailing: (
                <span className="ml-auto text-[10px] font-bold rounded-full px-[7px] py-px bg-sidebar-accent text-sidebar-accent-foreground">
                  {moreCount}
                </span>
              ),
            })}
          </div>
        )}
      </nav>
    );
  }

  function sidebarContent({ forceExpanded = false }) {
    const showLabel = forceExpanded || !collapsed;
    const slid = shell.settingsPanel && showLabel;

    return (
      <div className="flex flex-col h-full">
        {/* Logo -> Dashboard/Home. Collapsed shows the icon alone. onDark
            composes the icon with live text — the wordmark's navy would
            disappear against navy chrome. */}
        <div
          className={`py-3 border-b border-sidebar-border flex ${
            showLabel
              ? "px-5 flex-row items-center justify-between"
              : "px-2 flex-col items-center gap-2"
          }`}
        >
          {showLabel ? (
            <Logo variant="horizontal" href="/app" height={26} onDark priority />
          ) : (
            <Logo variant="icon" href="/app" height={26} priority />
          )}
          {/* Expand / contract lives in the foot now (mockup s1: a
              "Collapse" row under the trial line) — see the foot below. */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t("app.sidebar.closeMenu")}
            // How the tour puts the drawer back when it finishes.
            data-tour-close="nav"
            className="lg:hidden text-sidebar-muted-foreground hover:text-sidebar-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search — opens the global palette (TopBar.js's box, `/` from
            anywhere). Not a second filter over the menu: the palette's
            corpus IS the menu, plus settings, plus records. In 76px there is
            no room for a box, and the icon in the top bar is one click away.
            Hidden from xl up, where the top bar draws the wide box itself —
            two search boxes 60px apart was the settings sidebar's old wart,
            and the 48px go to the rows: with it, the AI group sat below the
            fold of an 860px window. */}
        {/* ── Create, then Search — the mockup's two rows under the logo ──
            (`.mk-s .rail .create` / `.rail .search`). Create is the brand
            fill at radius 8 and opens the same quick-add menu the top bar's
            button and the phone's floating + open (CreateMenu.js, one
            overlay). Search is the translucent pill with the `/` key. Both
            only while expanded and on the main list — in 76px there is no
            room for either, and the top bar has both one click away. */}
        {showLabel && !slid && (
          <div className="px-2.5 pt-2.5 space-y-1.5">
            <button
              type="button"
              onClick={() => shell.toggle("create")}
              aria-haspopup="menu"
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-semibold bg-sidebar-primary text-sidebar-primary-foreground hover:brightness-105"
              data-rail-create
            >
              <Plus size={16} strokeWidth={2.4} className="shrink-0" />
              <span className="truncate">{t("app.quickAdd.title")}</span>
            </button>
            <button
              type="button"
              onClick={() => shell.open("search")}
              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-white/[0.12] text-sidebar-muted-foreground hover:text-sidebar-foreground"
              data-rail-search
            >
              <Search size={13} className="shrink-0" />
              <span className="truncate">{t("app.search.placeholderShort")}</span>
              <kbd className="ml-auto text-[11px] font-mono border border-white/25 rounded px-[5px]">/</kbd>
            </button>
          </div>
        )}

        {/* ── The two lists, one column ────────────────────────────────────
            The main list stays mounted underneath; the settings list is
            positioned over it and slides in from the right. overflow-hidden
            on the wrapper is what makes it a slide and not a pop. Reduced
            motion gets an instant swap (motion-reduce:transition-none). */}
        <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
          <div
            className={`flex-1 min-h-0 flex flex-col transition-transform duration-300 motion-reduce:transition-none ${
              slid ? "-translate-x-full" : "translate-x-0"
            }`}
            aria-hidden={slid || undefined}
            // A translated-away list must not keep tab stops: `inert` takes it
            // out of the tab order and the accessibility tree together.
            inert={slid}
          >
            {mainList({ forceExpanded })}
          </div>
          {showLabel && (
            <div
              className={`absolute inset-0 flex flex-col transition-transform duration-300 motion-reduce:transition-none ${
                slid ? "translate-x-0" : "translate-x-full"
              }`}
              aria-hidden={!slid || undefined}
              inert={!slid}
              data-settings-panel={slid ? "open" : "closed"}
            >
              <SettingsPanel
                onBack={() => shell.setSettingsPanel(false)}
                onNavigate={forceExpanded ? () => setMobileOpen(false) : undefined}
              />
            </div>
          )}
        </div>

        {/* Pinned footer — Settings (the slide's handle), the trial badge,
            Collapse. On the phone drawer the identity chip and Log Out ride
            here too, because the phone has no avatar menu in its bar. */}
        <div className="px-2.5 py-2 border-t border-sidebar-border space-y-0.5">
          {settingsItem && (
            <Link
              href={settingsItem.href}
              onClick={(e) => {
                // Already under settings: the row is the slide's handle, not
                // a navigation — clicking it re-opens the list without
                // bouncing to the index.
                if (inSettings && showLabel) {
                  e.preventDefault();
                  shell.setSettingsPanel(true);
                } else if (forceExpanded) {
                  setMobileOpen(false);
                }
              }}
              title={showLabel ? undefined : t(settingsItem.key)}
              data-tour="nav-settings"
              data-nav-row
              aria-current={inSettings ? "page" : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${
                showLabel ? "" : "justify-center"
              } ${
                inSettings
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                  : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Settings size={16} className="shrink-0" />
              {showLabel && <span className="truncate">{t(settingsItem.key)}</span>}
              {showLabel && <ChevronRight size={14} className="ml-auto shrink-0" />}
            </Link>
          )}

          {/* ── Whose account is this? Phone drawer only; the desktop has the
              avatar menu in the top bar (TopBar.js), which carries the same
              identity block, the same impersonation chip and Log Out. */}
          {forceExpanded && (
            <>
              {impersonation ? (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-500/15">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-[#2d2520] flex items-center justify-center text-xs font-semibold shrink-0">
                    <Eye size={14} />
                  </div>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-sidebar-foreground truncate">
                      {impersonation.adminEmail || t("app.nav.support", "Support")}
                    </span>
                    <span className="block text-[11px] text-sidebar-muted-foreground truncate">
                      {t("app.nav.viewingCompany", "viewing {company}", {
                        company: impersonation.companyName,
                      })}
                    </span>
                  </span>
                </div>
              ) : session?.user && (
                // Links to Account & Billing, which only an owner or admin can
                // open. Non-billing roles get the same chip without the link.
                createElement(
                  canOpenBilling ? Link : "div",
                  {
                    ...(canOpenBilling ? { href: "/app/settings/account-billing", onClick: () => setMobileOpen(false) } : {}),
                    className: `flex items-center gap-2.5 px-3 py-2 rounded-lg ${
                      canOpenBilling ? "hover:bg-sidebar-accent" : ""
                    }`,
                  },
                  <>
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt={session.user.name || "Profile"}
                        className="w-7 h-7 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                        {initials(session.user.name || session.user.email)}
                      </div>
                    )}
                    <span className="text-sm font-medium text-sidebar-foreground truncate">
                      {session.user.name}
                    </span>
                  </>,
                )
              )}
            </>
          )}

          {showLabel ? <TrialBadge /> : <TrialBadge collapsed />}

          {forceExpanded && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut size={18} className="shrink-0" />
              {t("app.nav.logOut")}
            </button>
          )}

          {/* The trial line and the Collapse row close the rail, as the
              mockup's foot does (`.rail .foot`, `.rail .trial`). Collapse is
              a row so it reads like the rest; collapsed, it is the chevron
              alone and expands. Desktop only — the drawer has an X. */}
          {!forceExpanded && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? t("app.sidebar.expand") : t("app.sidebar.collapse")}
              title={collapsed ? t("app.sidebar.expand") : t("app.sidebar.collapse")}
              data-rail-toggle
              className={`hidden lg:flex w-full items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                showLabel ? "" : "justify-center"
              }`}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              {showLabel && <span className="truncate">{t("app.sidebar.collapse")}</span>}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar. Brand chrome, not another white panel: --sidebar is
          navy by default; the foreground token is contrast-picked. The top bar
          (TopBar.js) is the other half of the desktop chrome. */}
      <aside
        className={`hidden lg:flex shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 flex-col transition-all duration-200 motion-reduce:transition-none ${
          collapsed ? "w-[64px]" : "w-[232px]"
        }`}
        data-rail={collapsed ? "collapsed" : "expanded"}
      >
        {sidebarContent({ forceExpanded: false })}
      </aside>

      {/* Mobile drawer — the shared slide-over; the rows inside are this
          rail's own. Opened by the hamburger in TopBar.js (and by the tour,
          through the same data-tour-open hook that button carries). */}
      <NavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} label={t("app.sidebar.openMenu")}>
        {sidebarContent({ forceExpanded: true })}
      </NavDrawer>
    </>
  );
}

/** One rail row. Module-level on purpose — see the note beside row() above. */
function RailLink({ item, showLabel, active, label, featureFlags, onNavigate, trailing }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={showLabel ? undefined : label}
      // Anchor for the first-run walkthrough (app/components/tours.js). Only
      // set on the handful of items the welcome tour points at.
      data-tour={item.tour}
      data-nav-row
      aria-current={active ? "page" : undefined}
      // py-2, not py-2.5: eighteen rows plus five headings have to share an
      // 860px window with the logo, the search and the foot. At 40px a row the
      // AI group sat below the fold on a laptop; at 36px it is the More row
      // that just clears it. Still 36px tall — over the 44px touch floor only
      // matters on the phone drawer, whose rows are the same component with
      // more room and no such squeeze (see the drawer's own padding).
      // The mockup's row: 13px / 500, 7px 10px, radius 8, a 16px icon at a
      // 10px gap (`.mk-s .rail .r`) — the rail reads as one quiet list
      // with one orange row, not as a column of buttons.
      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-colors ${
        showLabel ? "" : "justify-center"
      } ${
        active
          // Orange marks the active item. It's the one place the accent
          // earns its loudness — you should be able to see where you are
          // from across a workshop.
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
          // Hover pairs the accent FILL with the accent FOREGROUND — the pair
          // the tokens promise (scripts/check-sidebar.mjs measures it).
          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <Icon size={16} className="shrink-0" />
      {showLabel && <span className="truncate">{label}</span>}
      {/* Renders nothing unless the row's feature is in preview or locked.
          A row that is going to refuse should say so BEFORE the click. */}
      {showLabel && <FeatureRowBadge navKey={item.key} flags={featureFlags} tone="rail" />}
      {showLabel && trailing}
    </Link>
  );
}

/** "Marc Tremblay" → "MT"; an email → its first letter. */
export function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
