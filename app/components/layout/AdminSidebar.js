// app/components/layout/AdminSidebar.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { useTranslation } from "@/app/hooks/useTranslation";
import TrialBadge from "@/app/components/layout/TrialBadge";
import {
  Home,
  Plus,
  Calendar,
  Users,
  ClipboardList,
  FileText,
  Briefcase,
  Receipt,
  Megaphone,
  Headset,
  BadgeCheck,
  Clock,
  CalendarClock,
  Wallet,
  Gift,
  Sparkles,
  Compass,
  UserCog,
  ListTodo,
  CreditCard,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import Logo from "@/app/components/Logo";

// Grouped, not flat.
//
// Eleven items in one list is past the point where anyone scans — you read it
// top to bottom every time, which is slower than it looks when you do it fifty
// times a day. Four short groups can be scanned by shape.
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
const NAV_GROUPS = [
  {
    key: "app.nav.group.work",
    items: [
      { key: "app.nav.requests", href: "/app/leads", icon: ClipboardList, tour: "nav-requests" },
      { key: "app.nav.quotes", href: "/app/quotes", icon: FileText, tour: "nav-quotes" },
      { key: "app.nav.estimateReviews", href: "/app/estimate-reviews", icon: BadgeCheck, tour: "nav-estimate-reviews" },
      { key: "app.nav.jobs", href: "/app/jobs", icon: Briefcase },
      { key: "app.nav.invoices", href: "/app/invoices", icon: Receipt },
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
      // ── HR in one place ─────────────────────────────────────────────────
      //
      // "Manage Team" lived ONLY under Settings, so hiring someone meant
      // hunting through a 31-item settings list while Timesheets and Time Off
      // sat right here. Employee records, their hours and their leave are one
      // job; splitting them across two menus is why people ask where things are.
      { key: "app.nav.team", href: "/app/settings/team", icon: UserCog },
      { key: "app.nav.teamSchedule", href: "/app/schedule", icon: Calendar },
      { key: "app.nav.timesheets", href: "/app/settings/team/timesheets", icon: Clock },
      // Top-level, not buried in settings: everyone uses it, not just admins.
      { key: "app.nav.timeOff", href: "/app/time-off", icon: CalendarClock },
    ],
  },
  {
    key: "app.nav.group.money",
    items: [
      { key: "app.nav.payroll", href: "/app/payroll", icon: Wallet },
      { key: "app.nav.expenses", href: "/app/settings/expense-tracking", icon: Wallet },
      { key: "app.nav.insights", href: "/app/analytics/benchmark", icon: Compass },
    ],
  },
  {
    key: "app.nav.group.grow",
    items: [
      { key: "app.nav.marketing", href: "/app/marketing", icon: Megaphone },
      { key: "app.nav.receptionist", href: "/app/receptionist", icon: Headset },
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

export default function AdminSidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

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
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        <Icon size={18} className="shrink-0" />
        {showLabel && <span className="truncate">{t(item.key)}</span>}
      </Link>
    );
  }

  function SidebarContent({ forceExpanded = false }) {
    const showLabel = forceExpanded || !collapsed;

    return (
      <div className="flex flex-col h-full">
        {/* Logo -> Dashboard/Home */}
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
          {/* onDark composes the icon with live text rather than the flat
              artwork — the wordmark's navy would disappear against navy
              chrome. Collapsed shows the icon alone. */}
          {showLabel ? (
            <Logo variant="horizontal" href="/app" height={26} onDark priority />
          ) : (
            <Logo variant="icon" href="/app" height={26} priority />
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={t("app.sidebar.closeMenu")}
            className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Home */}
          <NavLink
            item={{ key: "app.nav.home", href: "/app", icon: Home }}
            forceExpanded={forceExpanded}
          />

          {/* + Quick add */}
          <div className="relative" ref={forceExpanded ? null : quickAddRef}>
            <button
              type="button"
              onClick={() => setQuickAddOpen((v) => !v)}
              title={showLabel ? undefined : t("app.quickAdd.title")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium border border-dashed border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground ${
                showLabel ? "" : "justify-center"
              }`}
            >
              <Plus size={18} className="shrink-0" />
              {showLabel && <span>{t("app.quickAdd.title")}</span>}
            </button>

            {quickAddOpen && (
              <div
                className={`absolute z-50 top-0 ${
                  showLabel ? "left-full ml-2" : "left-full ml-2"
                } w-52 bg-card rounded-xl shadow-lg border border-border p-2`}
              >
                {QUICK_ADD_ITEMS.map((item) => {
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

          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="pt-3 first:pt-1">
              {/* Headings only when the rail is expanded. Collapsed, the
                  groups still read as groups because of the gap between
                  them — a heading squeezed into 76px would be truncated
                  noise. */}
              {showLabel && (
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                  {t(group.key)}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    forceExpanded={forceExpanded}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          {/* Its own slot, above the divider. FieldQuo AI is a different mode
              of using the app rather than another section of it, and it's the
              feature most worth people noticing. */}
          <NavLink
            item={{ key: "app.nav.ai", href: "/app/copilot", icon: Sparkles, tour: "nav-ai" }}
            forceExpanded={forceExpanded}
          />

          {/* Theme control. Lives here rather than in the marketing header
              because /app and /platform are the only themeable surfaces —
              offering the choice on a page that can't honour it is worse than
              not offering it. Hidden when the rail is collapsed; the segmented
              control needs its three targets to be legible. */}
          {showLabel && (
            <div className="px-3 pb-3 flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/60">Appearance</span>
              <ThemeToggle compact />
            </div>
          )}

          {/* Profile + trial countdown */}
          {session?.user && (
            <Link
              href="/app/settings/account-billing"
              title={showLabel ? undefined : session.user.name}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-sidebar-accent ${
                showLabel ? "" : "justify-center"
              }`}
            >
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
            </Link>
          )}
          {showLabel ? <TrialBadge /> : <TrialBadge collapsed />}

          {BOTTOM_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              forceExpanded={forceExpanded}
            />
          ))}

          <button
            onClick={handleLogout}
            title={showLabel ? undefined : t("app.nav.logOut")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground ${
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
            className={`hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground ${
              showLabel ? "" : "justify-center"
            }`}
          >
            {collapsed ? (
              <ChevronRight size={18} className="shrink-0" />
            ) : (
              <>
                <ChevronLeft size={18} className="shrink-0" />
                <span>Collapse</span>
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
      <div className="lg:hidden sticky top-0 z-40 h-14 flex items-center gap-2 px-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={t("app.sidebar.openMenu")}
          aria-expanded={mobileOpen}
          // 44px minimum: below that a target is genuinely hard to hit on a
          // phone, and this is the button every navigation goes through.
          className="p-2.5 -m-0.5 rounded-lg hover:bg-sidebar-accent"
        >
          <Menu size={20} />
        </button>
        <Logo variant="horizontal" href="/app" height={22} onDark priority />
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
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground shadow-xl flex flex-col">
            <SidebarContent forceExpanded />
          </aside>
        </div>
      )}
    </>
  );
}
