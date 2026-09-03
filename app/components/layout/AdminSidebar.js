// app/components/layout/AdminSidebar.js
"use client";

import { useState, useEffect, useMemo, useRef, createElement } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useImpersonation } from "@/app/hooks/useImpersonation";
import { useTranslation } from "@/app/hooks/useTranslation";
import TrialBadge from "@/app/components/layout/TrialBadge";
import {
  MessageSquare,
  Home,
  Plus,
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
  CalendarSync,
  Wallet,
  Gift,
  Sparkles,
  Compass,
  Gauge,
  Eye,
  UserCog,
  ShieldAlert,
  ListTodo,
  ShoppingCart,
  Truck,
  ShieldCheck,
  CreditCard,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import Logo from "@/app/components/Logo";
import { NavFilter, NavEmptyState, useGroupDisclosure } from "@/app/components/layout/NavFilter";
import { activeGroupKey, isGroupOpen, visibleGroups } from "@/app/components/layout/navDisclosure";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { filterNavGroups, filterNavItems } from "@/lib/features/nav";
import {
  filterNavGroupsByPermission,
  filterNavItemsByPermission,
} from "@/lib/permissions/nav";
import { usePermissions } from "@/app/providers/PermissionProvider";
import FeatureRowBadge from "@/app/components/layout/FeatureRowBadge";
import NotificationBell from "@/app/components/layout/NotificationBell";

// Grouped, not flat.
//
// Eleven items in one list is past the point where anyone scans — you read it
// top to bottom every time, which is slower than it looks when you do it fifty
// times a day. Five short groups can be scanned by shape.
//
// The order inside "Work" is the order work actually moves:
//
//   Requests -> Quotes -> Jobs -> Invoices
//
// A request becomes a quote, an accepted quote becomes a job, a finished job
// becomes an invoice. The old list opened with Calendar and buried Requests in
// third — which is neither the pipeline order nor the order anyone thinks in.
// Calendar sits at the end of Work because it's where scheduled jobs land, not
// where work starts.
//
// Timesheets and Expenses moved OUT of the nav and into Money; they were
// pointing at /app/settings/* URLs anyway, which is a decent sign they were
// never top-level concerns.
//
// ── Five groups, not four: Insights split out of Money ─────────────────────
//
// Money used to hold Payroll, Expenses, Insights and KPIs together, on the
// theory that they're all "money screens". That conflated RUNNING money
// (payroll, expenses — actions that move it) with READING money back
// (Insights, KPIs — reports that change nothing). AGENTS.md already draws
// this line for the whole product: "Analytics reads the whole thing. Settings
// configures it." Insights is the reading half, so it gets its own shelf
// between Money and Grow — after the operational groups a contractor works
// in daily, before the group about finding new work. See the comment on that
// group below for why it holds only two rows despite six analytics pages
// existing.
//
// ── Collapsible, with one group deliberately not ────────────────────────────
//
// Twenty-four items is too many to scan even in five groups, so the groups
// fold and remember it. "Work" does NOT fold, for a concrete reason rather
// than a taste one: app/components/tours.js points the first-run walkthrough
// at [data-tour='nav-requests'], 'nav-quotes' and 'nav-estimate-reviews', and
// OnboardingTour requires a target that measures non-zero. A collapsed group
// unmounts its items, so a folded Work is a walkthrough that silently never
// starts. Work is also the pipeline the product exists to serve — the one
// group nobody wants folded anyway.
//
// `pinned` is that rule, made explicit and enforced: check:sidebar fails if any
// group holding a `tour` item is foldable, so moving Requests elsewhere breaks
// a check instead of breaking the tour.
const NAV_GROUPS = [
  {
    key: "app.nav.group.work",
    pinned: true,
    items: [
      { key: "app.nav.requests", href: "/app/leads", icon: ClipboardList, tour: "nav-requests" },
      { key: "app.nav.quotes", href: "/app/quotes", icon: FileText, tour: "nav-quotes" },
      { key: "app.nav.estimateReviews", href: "/app/estimate-reviews", icon: BadgeCheck, tour: "nav-estimate-reviews" },
      { key: "app.nav.jobs", href: "/app/jobs", icon: Briefcase },
      { key: "app.nav.invoices", href: "/app/invoices", icon: Receipt },
      // Recurring work sold as a package. Sits after Invoices because that is
      // what it produces — a plan is a standing instruction to raise one.
      { key: "app.nav.plans", href: "/app/plans", icon: CalendarSync },
      { key: "app.nav.calendar", href: "/app/appointments", icon: Calendar },
      // /app/tasks existed, worked, and was reachable from NOTHING — no nav
      // entry and no link from any page. 380 lines of working to-do list that
      // only somebody typing the URL could find.
      { key: "app.nav.tasks", href: "/app/tasks", icon: ListTodo },
    ],
  },
  {
    key: "app.nav.group.people",
    items: [
      { key: "app.nav.clients", href: "/app/clients", icon: Users },
      // The CUSTOMER's kit — their furnace, their panel — and whose warranty
      // is about to run out. Next to Clients because that is what it is a fact
      // about, and deliberately NOT next to Vehicles below: the contractor's
      // own van is `Asset` and a different subject entirely. The two labels
      // ("Client equipment" / "Vehicles") say which is which without needing
      // the group headings to do it.
      { key: "app.nav.clientEquipment", href: "/app/equipment", icon: ShieldCheck },
      // ── HR in one place ─────────────────────────────────────────────────
      //
      // "Manage Team" lived ONLY under Settings, so hiring someone meant
      // hunting through a 31-item settings list while Timesheets and Time Off
      // sat right here. Employee records, their hours and their leave are one
      // job; splitting them across two menus is why people ask where things are.
      { key: "app.nav.team", href: "/app/settings/team", icon: UserCog },
      { key: "app.nav.scheduler", href: "/app/scheduler", icon: CalendarClock },
      { key: "app.nav.teamSchedule", href: "/app/schedule", icon: Calendar },
      { key: "app.nav.clock", href: "/app/clock", icon: Clock },
      { key: "app.nav.timesheets", href: "/app/settings/team/timesheets", icon: Clock },
      // Top-level, not buried in settings: everyone uses it, not just admins.
      { key: "app.nav.timeOff", href: "/app/time-off", icon: CalendarClock },
      // Same shelf as the rest of the crew's own records — a near-miss is
      // worth logging exactly as fast as clocking in. See lib/permissions.js's
      // "safety" category for who this hides from (report_own is the floor,
      // not `none`, so this row shows for a Crew member too).
      { key: "app.nav.safety", href: "/app/safety", icon: ShieldAlert },
    ],
  },
  {
    key: "app.nav.group.money",
    items: [
      { key: "app.nav.payroll", href: "/app/payroll", icon: Wallet },
      { key: "app.nav.expenses", href: "/app/settings/expense-tracking", icon: Wallet },
      // Suppliers, purchase orders and stock. In Money rather than Work
      // because buying is spending — it is gated on the same `expenses`
      // ladder as the row above it, and a contractor looking for "what did we
      // spend at Northline this year" looks here, not in the job pipeline.
      { key: "app.nav.purchasing", href: "/app/purchasing", icon: ShoppingCart },
      // The vans. In Money for the same reason Purchasing is: a vehicle is an
      // `Asset` whose depreciation already sits in this group's cost basis
      // (the register lives inside Settings → Overhead, which the construction
      // audit called out as a discoverability problem), and the audience for
      // "insurance lapses Thursday" is the same person who reads Expenses.
      // Gated on the same `user:manage` its API requires, so the row and the
      // endpoint never disagree about who gets in.
      { key: "app.nav.fleet", href: "/app/fleet", icon: Truck },
    ],
  },
  // Insights used to live inside Money, and that was a mislabel rather than a
  // simplification: Payroll and Expenses are things you RUN — money moves
  // because you clicked something. Insights and KPIs are things you READ — a
  // lens over quotes, jobs and invoices that changes nothing by itself.
  // AGENTS.md draws the same line: "Analytics reads the whole thing. Settings
  // configures it." Money runs the pipeline; this group reads it back.
  //
  // Only two rows here on purpose. /app/analytics/benchmark is a hub, not
  // just a benchmark screen — it links out to digest, statements, win-loss
  // and estimate-accuracy (see the comments on those four pages, which used
  // to be reachable from NOTHING). Giving each of those six screens its own
  // sidebar row would be the "nine items, split it" problem in reverse: a
  // seventh nav row for what is genuinely one destination with a fan-out menu
  // inside it. KPIs gets its own row anyway, on the same reasoning that put
  // it here in the first place — it's the one insights screen that was
  // built and then unreachable ("the /app/tasks failure again"), and a
  // dashboard nobody can find stays unfound one click deeper into a hub.
  {
    key: "app.nav.group.insights",
    items: [
      { key: "app.nav.insights", href: "/app/analytics/benchmark", icon: Compass },
      { key: "app.nav.kpis", href: "/app/analytics/kpis", icon: Gauge },
    ],
  },
  // Marketing Designer (the ad-creative canvas editor, marketing_designer in
  // lib/features/registry.js) sits here, directly after "app.nav.marketing" —
  // it's a tool FOR marketing campaigns, not a separate concern.
  //
  // This comment used to say the designer "has no route yet" and that there was
  // "nothing to add until that lands". It landed, the row directly below was
  // added, and the comment was left behind contradicting the line under it. A
  // wrong comment is worse than none: the next person reads it and goes looking
  // for work that is already done. AGENTS.md asks for the comment to be fixed
  // too, so it is.
  {
    key: "app.nav.group.grow",
    items: [
      { key: "app.nav.marketing", href: "/app/marketing", icon: Megaphone },
      // The multi-ratio ad canvas editor — its own row, not folded into the
      // Marketing hub link above, because it is a different verb (design one
      // asset in five sizes vs. run a campaign) and the check-sidebar.mjs
      // "every item is found by typing its own label" rule needs its own
      // href to prove reachable.
      { key: "app.nav.marketingDesigner", href: "/app/marketing/designer", icon: Palette },
      { key: "app.nav.funnels", href: "/app/funnels", icon: Filter },
      { key: "app.nav.receptionist", href: "/app/receptionist", icon: Headset },
      { key: "app.nav.crewInbox", href: "/app/crew-inbox", icon: MessageSquare },
      { key: "app.nav.refer", href: "/app/settings/refer", icon: Gift },
    ],
  },
];

// The floating "+" popup — quick-create shortcuts.
const QUICK_ADD_ITEMS = [
  { key: "app.quickAdd.client", href: "/app/clients", icon: Users },
  { key: "app.quickAdd.request", href: "/app/leads", icon: ClipboardList },
  { key: "app.quickAdd.quote", href: "/app/quotes/new", icon: FileText },
  { key: "app.quickAdd.job", href: "/app/jobs", icon: Briefcase },
  { key: "app.quickAdd.invoice", href: "/app/invoices/new", icon: Receipt },
];

// Bottom-of-sidebar items, above Log Out.
const BOTTOM_ITEMS = [
  { key: "app.nav.help", href: "/app/help", icon: LifeBuoy },
  { key: "app.nav.plan", href: "/app/settings/account-billing", icon: CreditCard },
  { key: "app.nav.settings", href: "/app/settings", icon: Settings, tour: "nav-settings" },
];

const HOME_ITEM = { key: "app.nav.home", href: "/app", icon: Home };
const AI_ITEM = { key: "app.nav.ai", href: "/app/copilot", icon: Sparkles, tour: "nav-ai" };

// What the filter box searches. Home and the bottom section are pulled in so
// typing "settings" finds Settings — a menu search that quietly can't reach a
// third of the menu is worse than no search box. They render in their own
// fixed slots when the box is empty, so this grouping exists only while
// searching.
const SEARCH_CORPUS = [
  ...NAV_GROUPS,
  { key: "app.nav.group.more", items: [HOME_ITEM, AI_ITEM, ...BOTTOM_ITEMS] },
];

// Everything is open on a first visit, and folding is something the user
// CHOOSES once they know where things live.
//
// This started as `["app.nav.group.work"]` — open Work, fold the rest — on the
// reasoning that opening everything makes the accordion decorative. That was
// wrong, and it was caught within the hour: the owner went looking for the crew
// messaging agent and couldn't find it in the menu, because it sits under Grow
// and Grow was folded. Three quarters of the product had been hidden from
// anyone who hadn't already learned the layout.
//
// Folding solves "this rail is long" for someone who knows what's on it. It
// does not solve discovery, and using it as the default trades a scanning
// problem for a much worse one — a feature that may as well not be built. The
// user's own folds still persist; only the first visit changed back.
const DEFAULT_OPEN = NAV_GROUPS.map((g) => g.key);
const DISCLOSURE_KEY = "fq-nav-groups";

export default function AdminSidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  // Null unless this is a support session — see the identity row below.
  const impersonation = useImpersonation();
  // Owner/admin only — the same set Account & Billing itself enforces.
  const [canOpenBilling, setCanOpenBilling] = useState(false);
  useEffect(() => {
    fetch("/api/settings/members/self/role")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCanOpenBilling(["owner", "admin"].includes(d?.yourRole)))
      .catch(() => {});
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Feature availability, resolved server-side by AppLayout so the first paint
  // is already correct. Cosmetics only — a row removed here is a row whose page
  // and API were already refusing, see lib/features/nav.js. Null (no provider,
  // or a lookup that failed) leaves the menu exactly as declared above.
  const featureFlags = useFeatureFlags();
  // Two independent filters, applied in sequence and NOT merged into one pass.
  //
  // They answer different questions and can disagree: a feature can be hidden
  // for the whole company while an owner would otherwise have every
  // permission, and a screen can be perfectly available while THIS member has
  // no business on it. Collapsing them into a single predicate would make the
  // reason a row vanished unrecoverable the next time someone asks why.
  const caller = usePermissions();
  const navGroups = useMemo(
    () => filterNavGroupsByPermission(filterNavGroups(NAV_GROUPS, featureFlags), caller),
    [featureFlags, caller],
  );
  const bottomItems = useMemo(
    () => filterNavItemsByPermission(filterNavItems(BOTTOM_ITEMS, featureFlags), caller),
    [featureFlags, caller],
  );
  // Filtered too, or typing "receptionist" would surface a hidden feature by
  // name in the search results — the leak the nav filter closes, reopened by
  // the search box.
  const searchCorpus = useMemo(
    // Filtered by permission too, or typing "payroll" would name a screen the
    // member cannot open — reopening by search the leak the nav filter closes.
    () => filterNavGroupsByPermission(filterNavGroups(SEARCH_CORPUS, featureFlags), caller),
    [featureFlags, caller],
  );
  // filterNavItemsByPermission, not just filterNavItems. This list ran through
  // the FEATURE-FLAG filter alone, so "app.quickAdd.quote" — which has been in
  // NAV_REQUIREMENTS since that file was written, with a comment explaining
  // that composing a whole quote and losing it to a 403 "costs the person
  // their work" — was defined and never applied. QA found all five entries
  // offered to a Worker whose API refuses every one.
  const quickAddItems = useMemo(
    () =>
      filterNavItemsByPermission(
        filterNavItems(QUICK_ADD_ITEMS, featureFlags),
        caller,
      ),
    [featureFlags, caller],
  );
  const showAiItem = useMemo(
    () => filterNavItems([AI_ITEM], featureFlags).length > 0,
    [featureFlags],
  );

  const quickAddRef = useRef(null);

  // Persist the expanded/contracted preference across visits.
  useEffect(() => {
    const stored = window.localStorage.getItem("fq-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fq-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Close the quick-add popup on outside click.
  useEffect(() => {
    function handleClick(e) {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target)) {
        setQuickAddOpen(false);
      }
    }
    if (quickAddOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [quickAddOpen]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Was: a raw fetch("/api/auth/sign-out"). That hits the same route
  // better-auth's own client calls, but bypasses better-auth's client-side
  // session store — useSession() elsewhere in the tree (MarketingHeader,
  // this component's own avatar row) doesn't get told the session is gone,
  // so it keeps rendering the cached "logged in" state until something
  // forces a real re-fetch. Using signOut() from lib/auth-client updates
  // that store directly, and we don't navigate until its callback confirms
  // the server has actually cleared the session cookie — no race between
  // "redirect fired" and "cookie actually cleared."
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

  // Clear the filter on navigation — a stale query left over the rail hides
  // most of the menu on the page you just arrived at.
  useEffect(() => {
    setQuery("");
  }, [pathname]);

  const activeKey = activeGroupKey(navGroups, pathname, isActive);
  const { openKeys, toggle } = useGroupDisclosure({
    storageKey: DISCLOSURE_KEY,
    defaultOpenKeys: DEFAULT_OPEN,
    activeKey,
  });

  const searching = query.trim().length > 0;
  const label = (key) => t(key);
  const searchGroups = visibleGroups({ groups: searchCorpus, query, label });

  function NavLink({ item, onNavigate, forceExpanded }) {
    const showLabel = forceExpanded || !collapsed;
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        title={showLabel ? undefined : t(item.key)}
        // Anchor for the first-run walkthrough (app/components/tours.js). Only
        // set on the handful of items the welcome tour points at.
        data-tour={item.tour}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          showLabel ? "" : "justify-center"
        } ${
          active
            // Orange marks the active item. It's the one place the accent
            // earns its loudness — you should be able to see where you are
            // from across a workshop.
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
            // Hover pairs the accent FILL with the accent FOREGROUND. It used
            // to pair bg-sidebar-accent with text-sidebar-foreground — two
            // tokens with no contract between them. Under the old brand
            // theming that mismatch was the bug the owner reported: a lime or
            // blue company got --sidebar-accent as a near-white wash while
            // --sidebar-foreground stayed white, so hovering a row erased its
            // label. The pair is now the one the tokens promise.
            : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon size={18} className="shrink-0" />
        {showLabel && <span className="truncate">{t(item.key)}</span>}
        {/* Renders nothing unless the row's feature is in preview or locked.
            A row that is going to refuse should say so BEFORE the click. */}
        {showLabel && <FeatureRowBadge navKey={item.key} flags={featureFlags} tone="rail" />}
      </Link>
    );
  }

  function sidebarContent({ forceExpanded = false }) {
    const showLabel = forceExpanded || !collapsed;

    return (
      <div className="flex flex-col h-full">
        {/* Logo -> Dashboard/Home */}
        {/* Stacks when the rail is collapsed. The rail is w-[76px] there, and a
            26px logo beside a 44px bell inside px-5 comes to 124px — the bell
            would hang off the edge or squash the logo. Dropping the bell
            instead was the other option and it is worse: a collapsed rail is
            the state somebody leaves the app in all day, and an unread count
            you cannot see is the whole feature switched off by a layout. */}
        <div
          className={`py-5 border-b border-sidebar-border flex ${
            showLabel
              ? "px-5 flex-row items-center justify-between"
              : "px-2 flex-col items-center gap-2"
          }`}
        >
          {/* onDark composes the icon with live text rather than the flat
              artwork — the wordmark's navy would disappear against navy
              chrome. Collapsed shows the icon alone. */}
          {showLabel ? (
            <Logo variant="horizontal" href="/app" height={26} onDark priority />
          ) : (
            <Logo variant="icon" href="/app" height={26} priority />
          )}
          {/* Desktop only. Below `lg` this rail is a drawer you have to open,
              and the bell lives in the sticky top bar instead — see the mount
              down there. Rendering both would put two bells on one phone
              screen the moment the drawer opened. */}
          <div className="hidden lg:block">
            <NotificationBell />
          </div>
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

        {/* Create — pinned ABOVE the scroll area. Two reasons: its flyout is
            absolutely positioned to the side, and inside the nav's overflow-y-auto
            that also clips horizontally, so the popup rendered off-screen and the
            button looked dead. And starting a quote / job / invoice is the main
            reason people reach for the sidebar, so it earns a solid primary
            button rather than a dashed afterthought.

            Hidden entirely when the caller can create NOTHING — a Worker on
            view-only across the board now filters every entry out, and a
            primary button that opens an empty menu is a worse control than no
            button. */}
        {quickAddItems.length > 0 && (
        <div className="px-3 pt-3">
          <div className="relative" ref={forceExpanded ? null : quickAddRef}>
            <button
              type="button"
              onClick={() => setQuickAddOpen((v) => !v)}
              title={showLabel ? undefined : t("app.quickAdd.title")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-sidebar-primary text-sidebar-primary-foreground hover:brightness-110 ${
                showLabel ? "" : "justify-center"
              }`}
            >
              <Plus size={18} className="shrink-0" />
              {showLabel && <span>{t("app.quickAdd.title")}</span>}
            </button>

            {quickAddOpen && (
              <div className="absolute z-50 top-0 left-full ml-2 w-52 bg-card rounded-xl shadow-lg border border-border p-2">
                {quickAddItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setQuickAddOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted"
                    >
                      <Icon size={16} className="shrink-0" />
                      {t(item.key)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        )}

        {/* min-h-0 lets this flex child actually shrink so overflow-y-auto
            scrolls it — without it the nav keeps its full content height, the
            column overflows, and the fixed bottom section (AI, profile, help,
            logout) rides up over it. That overlap was the "two sidebars" feel. */}
        {/* Filter — expanded rail only. In 76px there is no room for an input
            and no need for one: the collapsed rail ignores disclosure and
            shows every icon, so nothing is hidden there to search for. */}
        {showLabel && (
          <div className="px-3 pt-3">
            <NavFilter
              value={query}
              onChange={setQuery}
              placeholder={t("app.nav.search")}
              tone="rail"
            />
          </div>
        )}

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
          {searching && showLabel ? (
            // Searching replaces the whole menu with matches — including Home
            // and the bottom section, which is why they're in SEARCH_CORPUS.
            // Leaving them pinned below a "nothing matches" message would be a
            // straight contradiction on screen.
            <>
              {searchGroups.map((group) => (
                <div key={group.key} className="pt-3 first:pt-1">
                  <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground">
                    {t(group.key)}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavLink key={item.href} item={item} forceExpanded={forceExpanded} />
                    ))}
                  </div>
                </div>
              ))}
              {searchGroups.length === 0 && (
                <NavEmptyState
                  tone="rail"
                  message={t("app.nav.noMatches", { query })}
                  clearLabel={t("app.action.clear")}
                  onClear={() => setQuery("")}
                />
              )}
            </>
          ) : (
            <>
              <NavLink item={HOME_ITEM} forceExpanded={forceExpanded} />

              {navGroups.map((group) => {
                const open = isGroupOpen({
                  group,
                  openKeys,
                  searching: false,
                  railCollapsed: !showLabel,
                });
                return (
                  <div key={group.key} className="pt-3 first:pt-1">
                    {/* Headings only when the rail is expanded. Collapsed, the
                        groups still read as groups because of the gap between
                        them — a heading squeezed into 76px would be truncated
                        noise, and there is nothing to toggle. */}
                    {showLabel &&
                      (group.pinned ? (
                        <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground">
                          {t(group.key)}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(group.key)}
                          aria-expanded={open}
                          className="w-full flex items-center gap-1.5 px-3 py-1 mb-1 rounded-lg text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                        >
                          <span className="truncate">{t(group.key)}</span>
                          <ChevronDown
                            size={13}
                            className={`ml-auto shrink-0 transition-transform ${
                              open ? "" : "-rotate-90"
                            }`}
                          />
                        </button>
                      ))}
                    {open && (
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <NavLink key={item.href} item={item} forceExpanded={forceExpanded} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Secondary — AI, help, plan, settings, appearance. Kept INSIDE
                  the scroll area rather than pinned, so the drawer's fixed
                  footer stays small. Pinning all of this is what made the bottom
                  section eat half the mobile screen. FieldQuo AI still leads it
                  (its own slot above a divider) — the feature most worth
                  noticing. */}
              <div className="pt-4 mt-3 border-t border-sidebar-border space-y-1">
                {showAiItem && <NavLink item={AI_ITEM} forceExpanded={forceExpanded} />}
                {bottomItems.map((item) => (
                  <NavLink key={item.href} item={item} forceExpanded={forceExpanded} />
                ))}
                {/* Theme control — /app and /platform are the only themeable
                    surfaces, so it lives here rather than the marketing header.
                    Hidden collapsed; the segmented control needs its targets
                    legible. */}
                {showLabel && (
                  <div className="px-3 pt-2 flex items-center justify-between">
                    <span className="text-xs text-sidebar-muted-foreground">
                      {t("app.nav.appearance")}
                    </span>
                    <ThemeToggle compact />
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Pinned footer — deliberately minimal (who am I + trial + get out), so
            it never dominates the drawer on a phone. Everything else scrolls. */}
        <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
          {/* Profile + trial countdown */}
          {/* ── Whose account is this? ──────────────────────────────────
              During a support session the Better Auth session still belongs to
              whoever is signed in on this browser, so this row showed THEIR
              name while the page rendered a customer's data. QA saw "jonny"
              the whole time they were inside another company.
              The support admin's own email replaces it, with the company named
              underneath — so the answer to "whose account am I in" is on
              screen, not only in a banner at the top that scrolls away. */}
          {impersonation ? (
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-500/15 ${showLabel ? "" : "justify-center"}`}>
              <div className="w-7 h-7 rounded-full bg-amber-500 text-[#2d2520] flex items-center justify-center text-xs font-semibold shrink-0">
                <Eye size={14} />
              </div>
              {showLabel && (
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
              )}
            </div>
          ) : session?.user && (
            // Links to Account & Billing, which only an owner or admin can
            // open — a Manager clicking their own name landed on "Not
            // available to your account". Non-billing roles get the same chip
            // without the link rather than a different destination: there is no
            // profile page to send them to, and inventing one here would be
            // scope this doesn't have.
            // `as` picks Link or a plain div — one copy of the chip's markup
            // rather than two branches that drift apart.
            createElement(
              canOpenBilling ? Link : "div",
              {
                ...(canOpenBilling
                  ? { href: "/app/settings/account-billing" }
                  : {}),
                title: showLabel ? undefined : session.user.name,
                className: `flex items-center gap-2.5 px-3 py-2 rounded-lg ${
                  canOpenBilling ? "hover:bg-sidebar-accent" : ""
                } ${showLabel ? "" : "justify-center"}`,
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
                  {(session.user.name || session.user.email || "?")
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("")}
                </div>
              )}
              {showLabel && (
                <span className="text-sm font-medium text-sidebar-foreground truncate">
                  {session.user.name}
                </span>
              )}
              </>,
            )
          )}
          {showLabel ? <TrialBadge /> : <TrialBadge collapsed />}

          <button
            onClick={handleLogout}
            title={showLabel ? undefined : t("app.nav.logOut")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              showLabel ? "" : "justify-center"
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {showLabel && t("app.nav.logOut")}
          </button>

          {/* Expand / contract toggle — desktop only */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? t("app.sidebar.expand") : t("app.sidebar.collapse")}
            className={`hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              showLabel ? "" : "justify-center"
            }`}
          >
            {collapsed ? (
              <ChevronRight size={18} className="shrink-0" />
            ) : (
              <>
                <ChevronLeft size={18} className="shrink-0" />
                <span>{t("app.sidebar.collapse")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile top bar ──────────────────────────────────────────────────
          This was a floating `fixed top-4 left-4` button. Pages start their
          content at p-6, so on every phone the page's own <h1> rendered
          UNDERNEATH the button — the first thing you read on any screen had a
          hamburger sitting on it.

          A bar in normal flow takes its own space instead of stealing the
          page's. It's sticky so navigation stays reachable while scrolling,
          which a floating button over content never quite managed. */}
      {/* h-14 is load-bearing, not decorative: SettingsSidebar's own mobile bar
          sticks at top-14 so the two stack instead of overlapping. Changing this
          height means changing that offset. */}
      <div className="lg:hidden sticky top-0 z-40 h-14 flex items-center gap-2 px-3 text-sidebar-foreground border-b border-sidebar-border/60 bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/65 backdrop-blur-xl backdrop-saturate-150">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t("app.sidebar.openMenu")}
          // The walkthrough points at nav items that live inside this drawer.
          // It opens the drawer by clicking THIS, named explicitly rather than
          // guessed at — see app/components/OnboardingTour.js.
          data-tour-open="nav"
          aria-expanded={mobileOpen}
          // 44px minimum: below that a target is genuinely hard to hit on a
          // phone, and this is the button every navigation goes through.
          className="p-2.5 -m-0.5 rounded-lg hover:bg-sidebar-accent"
        >
          <Menu size={20} />
        </button>
        <Logo variant="horizontal" href="/app" height={22} onDark priority />
        {/* Pushed to the right edge, and NOT inside the drawer: a bell you have
            to open a menu to see is a bell that never gets looked at. This bar
            renders on every /app screen below `lg` (AdminSidebar is mounted by
            the layout, and app/components/mobile/AppBar.js — which the audit
            expected to replace it on detail screens — has no callers anywhere
            in the codebase), so the count is visible from a quote, a job and an
            invoice as well as from a list. */}
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        // Brand chrome, not another white panel. --sidebar is navy by
        // default and becomes the company's colour under white-label; the
        // foreground token is contrast-picked, so it stays readable whatever
        // they choose.
        className={`hidden lg:flex shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 flex-col transition-all duration-200 ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {sidebarContent({ forceExpanded: false })}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[min(20rem,86vw)] max-w-[86vw] bg-sidebar text-sidebar-foreground shadow-2xl flex flex-col">
            {sidebarContent({ forceExpanded: true })}
          </aside>
        </div>
      )}
    </>
  );
}
