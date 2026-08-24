// app/components/layout/SettingsSidebar.js
//
// Secondary sidebar for /app/settings/*. Grouped by what a company is actually
// trying to DO, not by when a screen happened to get built — the old flat list
// had twenty-plus items in two buckets, which is past the point anyone scans.
//
// Groups are ordered roughly by how often they're opened: identity first, then
// the day-to-day (team/scheduling, services/pricing), then the plumbing
// (documents, money), then the client-facing surfaces, then records.
//
// ── Mobile ──────────────────────────────────────────────────────────────────
//
// This was `w-64 shrink-0` at every width. On a 375px phone that is 256px of
// navigation and 119px for the page, which is why every settings screen read as
// a column of crushed, wrapped text. AdminSidebar already had a drawer; this one
// never got one.
//
// So below `lg` it becomes a sticky bar showing WHERE YOU ARE plus a button that
// opens the full list as a sheet. The current page's name is on the bar because
// "Settings" alone doesn't tell you which of twenty-eight screens you're on, and
// on a phone the list that would have told you is hidden.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  MessageSquare,
  Star,
  Building2,
  Users,
  Package,
  ListPlus,
  CreditCard,
  Receipt,
  Wallet,
  Gift,
  Megaphone,
  Link2,
  Droplet,
  Ruler,
  Headset,
  Mail,
  Clock,
  Palette,
  Tags,
  Boxes,
  Map,
  TrendingUp,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  AtSign,
  Globe,
  FileText,
  Bell,
  ListChecks,
  Languages,
  Zap,
  Activity,
  Settings as SettingsIcon,
  ChevronDown,
  X,
} from "lucide-react";
import { NavFilter, NavEmptyState, useGroupDisclosure } from "@/app/components/layout/NavFilter";
import { activeGroupKey, isGroupOpen, visibleGroups } from "@/app/components/layout/navDisclosure";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { filterNavGroups } from "@/lib/features/nav";
import FeatureRowBadge from "@/app/components/layout/FeatureRowBadge";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { filterSettingsGroups } from "@/lib/permissions/settingsAccess";

const GROUPS = [
  {
    key: "app.settings.group.account",
    items: [
      { key: "app.settings.accountBilling", href: "/app/settings/account-billing", icon: CreditCard },
      { key: "app.settings.refer", href: "/app/settings/refer", icon: Gift },
      { key: "app.settings.productUpdates", href: "/app/settings/product-updates", icon: Megaphone },
    ],
  },
  {
    key: "app.settings.group.business",
    items: [
      { key: "app.settings.company", href: "/app/settings/company", icon: Building2 },
      { key: "app.settings.branding", href: "/app/settings/branding", icon: Palette },
      { key: "app.settings.language", href: "/app/settings/language", icon: Languages },
    ],
  },
  {
    key: "app.settings.group.team",
    items: [
      { key: "app.settings.team", href: "/app/settings/team", icon: Users },
      { key: "app.settings.availability", href: "/app/settings/availability", icon: Clock },
      { key: "app.settings.leave", href: "/app/settings/leave", icon: CalendarClock },
      { key: "app.settings.bookingPage", href: "/app/settings/booking-page", icon: CalendarDays },
      { key: "app.settings.workAreas", href: "/app/settings/work-areas", icon: Map },
    ],
  },
  {
    key: "app.settings.group.pricing",
    items: [
      { key: "app.settings.products", href: "/app/settings/products", icon: Package },
      { key: "app.settings.services", href: "/app/settings/services", icon: Tags },
      { key: "app.settings.materialCosts", href: "/app/settings/material-costs", icon: Droplet },
      { key: "app.settings.cabinetRates", href: "/app/settings/cabinet-rates", icon: Ruler },
      { key: "app.settings.overhead", href: "/app/settings/overhead", icon: TrendingUp },
      { key: "app.settings.payroll", href: "/app/settings/payroll", icon: Wallet },
      { key: "app.settings.customFields", href: "/app/settings/custom-fields", icon: ListPlus },
    ],
  },
  {
    key: "app.settings.group.documents",
    items: [
      { key: "app.settings.emailTemplates", href: "/app/settings/email-templates", icon: Mail },
      { key: "app.settings.pdfTemplates", href: "/app/settings/templates", icon: FileText },
      { key: "app.settings.emailDomain", href: "/app/settings/email-domain", icon: AtSign },
      { key: "app.settings.translations", href: "/app/settings/translations", icon: Globe },
      { key: "app.settings.followUps", href: "/app/settings/follow-ups", icon: Clock },
      { key: "app.settings.notifications", href: "/app/settings/notifications", icon: Bell },
      { key: "app.settings.messages", href: "/app/settings/messages", icon: MessageSquare },
      { key: "app.settings.checklists", href: "/app/settings/checklists", icon: ListChecks },
    ],
  },
  {
    key: "app.settings.group.paid",
    items: [
      { key: "app.settings.payments", href: "/app/settings/payments", icon: Receipt },
      { key: "app.settings.expenseTracking", href: "/app/settings/expense-tracking", icon: Wallet },
    ],
  },
  {
    key: "app.settings.group.clientFacing",
    items: [
      { key: "app.settings.website", href: "/app/settings/website", icon: Globe },
      { key: "app.settings.instantQuotes", href: "/app/settings/instant-quotes", icon: Zap },
      { key: "app.settings.leadForm", href: "/app/settings/lead-form", icon: ClipboardList },
      { key: "app.settings.bioLink", href: "/app/settings/links", icon: Link2 },
      { key: "app.settings.voice", href: "/app/settings/voice", icon: Headset },
      { key: "app.settings.reviews", href: "/app/settings/reviews", icon: Star },
    ],
  },
  {
    key: "app.settings.group.records",
    items: [{ key: "app.settings.activity", href: "/app/activity", icon: Activity }],
  },
];

// Nothing is open until you're in it. Thirty-five links in eight groups is the
// complaint; defaulting them all open would leave the list exactly as long as
// it is today and make the accordion decoration. Closed, /app/settings reads as
// eight category headings — a far better index than thirty-five links — and the
// group you're actually in opens itself. Nothing here anchors a tour, so unlike
// the main rail no group needs pinning.
const DISCLOSURE_KEY = "fq-settings-groups";

export default function SettingsSidebar() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

  // Same map the main rail uses, from the provider AppLayout mounts. Cosmetics:
  // the settings screens behind these rows are gated by their own FeatureGate
  // layouts whether or not this list ever hides anything.
  const featureFlags = useFeatureFlags();
  // Two filters, one after the other, answering two different questions:
  // "does this company have the feature" and "may this person use the screen".
  // They are kept separate because they fail in opposite directions — a missing
  // feature map shows everything, and so does a missing role, but conflating
  // them would make one silently stand in for the other.
  //
  // Removing a row is cosmetics, not access control. Every row this can remove
  // is refused server-side for the same member whether or not the row was
  // drawn — see SETTINGS_ROW_CAPABILITY in lib/permissions/settingsAccess.js,
  // which is the list, and the per-route notes beside each entry.
  //
  // That list is deliberately NOT restated here. It said "the four rows
  // (Account & Billing, Refer & Earn, Payroll, Booking Page)" and had grown to
  // fifteen without anyone noticing — a comment enumerating a map that lives
  // in another file is a copy, and the copy is the one that rots.
  //
  // An owner holds every capability, so this is a no-op on the owner's screen.
  const access = useSettingsAccess();
  const groups = useMemo(
    () =>
      filterSettingsGroups(
        filterNavGroups(GROUPS, featureFlags),
        access.resolved ? { role: access.role, impersonation: access.impersonation } : null,
      ),
    [featureFlags, access.resolved, access.role, access.impersonation],
  );
  // The "you are here" label on the mobile bar reads from this too — otherwise a
  // hidden feature would name itself at the top of the screen the moment someone
  // reached its URL, which is the leak the row removal exists to prevent.
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const activeKey = activeGroupKey(groups, pathname, isActive);
  const { openKeys, toggle } = useGroupDisclosure({
    storageKey: DISCLOSURE_KEY,
    defaultOpenKeys: [],
    activeKey,
  });

  // Close on navigation. Without this, tapping a link on a phone leaves the
  // sheet covering the page you just asked for.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Body scroll lock while the sheet is open — otherwise the page behind it
  // scrolls under your finger and the sheet appears to jump.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheetOpen]);

  // Longest match wins: /app/settings/team/timesheets must resolve to Manage
  // Team, not to whichever shorter prefix happens to be listed first.
  const current = allItems.filter((i) => isActive(i.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];

  function renderItem(item, { onNavigate } = {}) {
    const Icon = item.icon;
    // Only the item `current` resolved to — the longest match — is highlighted.
    // This used to call isActive() per item, which is a PREFIX test, so
    // /app/settings/team/timesheets lit up every ancestor that happened to be
    // in the list. More than one "you are here" is no "you are here".
    const active = current?.href === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            // Orange, the same as the main rail's active item, rather than the
            // bg-inverted slab this used. Two reasons. It makes "you are here"
            // one colour across both sidebars and both themes instead of navy
            // here and orange there. And --inverted is a BUTTON token: in dark
            // mode it is #0d3d78 against a #111d31 card, which is 1.57:1 — a
            // lighter, brighter blue barely distinguishable from the panel
            // behind it, and below the hover fill it is supposed to outrank.
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
            // Hover moves the TEXT as well as the fill. It was
            // `hover:bg-muted` alone at 1.12:1, so the row never visibly
            // changed; and at a fill strong enough to see, muted-foreground on
            // it measures 4.16:1 in light mode — under the floor — so the text
            // has to come up with the fill rather than be swallowed by it.
            : "text-muted-foreground hover:bg-sidebar-panel-accent hover:text-foreground"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{t(item.key)}</span>
        {/* Nothing unless the row's feature is in preview or locked. */}
        <FeatureRowBadge navKey={item.key} flags={featureFlags} tone="panel" />
      </Link>
    );
  }

  // ── Filter ────────────────────────────────────────────────────────────
  //
  // Thirty-five destinations in eight groups. The groups help, but past about
  // twenty items no amount of grouping beats typing three letters — which is
  // why every settings screen worth using has a filter box (macOS, Slack,
  // GitHub all landed on the same answer).
  //
  // It is also what makes folding the groups safe: a query overrides
  // disclosure, so every link stays one search away no matter what is closed.
  // The matching itself now lives in navDisclosure.js, shared with the main
  // rail rather than copied into it.
  const searching = query.trim().length > 0;
  const label = (key) => t(key);
  const filtered = visibleGroups({ groups, query, label });

  const nav = (onNavigate) => (
    <div className="space-y-3">
      <NavFilter
        value={query}
        onChange={setQuery}
        placeholder={t("app.settings.search")}
        tone="panel"
      />

      <nav className="space-y-2">
        {filtered.map((group) => {
          const open = isGroupOpen({ group, openKeys, searching });
          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={open}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hover:bg-sidebar-panel-accent hover:text-foreground transition-colors"
              >
                <span className="truncate">{t(group.key)}</span>
                <ChevronDown
                  size={14}
                  className={`ml-auto shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                />
              </button>
              {open && (
                <div className="space-y-0.5 pb-1">
                  {group.items.map((item) => renderItem(item, { onNavigate }))}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <NavEmptyState
            tone="panel"
            message={t("app.nav.noMatches", { query })}
            clearLabel={t("app.action.clear")}
            onClear={() => setQuery("")}
          />
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* ── Mobile: a bar that says where you are, and opens the list ── */}
      {/* top-14, not top-0: AdminSidebar's mobile bar is h-14 and sticks above
          this one. At top-0 the two would occupy the same 56px and this bar
          would be hidden behind it. */}
      <div className="lg:hidden sticky top-14 z-30 border-b border-border/60 bg-card/70 supports-[backdrop-filter]:bg-card/60 backdrop-blur-xl backdrop-saturate-150">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className="w-full flex items-center gap-2 px-4 py-3 text-left"
        >
          <SettingsIcon size={16} className="shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground truncate">
            {current ? t(current.key) : t("app.settings.title")}
          </span>
          <ChevronDown size={16} className="ml-auto shrink-0 text-muted-foreground" />
        </button>
      </div>

      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 top-14 bg-card/95 supports-[backdrop-filter]:bg-card/85 backdrop-blur-xl rounded-t-2xl flex flex-col shadow-[0_-8px_40px_rgba(0,0,0,0.18)]">
            {/* Grab handle — the modern bottom-sheet affordance. */}
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/25 shrink-0" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
              <span className="font-bold text-foreground">{t("app.settings.title")}</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={t("app.sidebar.closeMenu")}
                className="p-1.5 -mr-1.5 text-muted-foreground"
              >
                <X size={20} />
              </button>
            </div>
            {/* The sheet scrolls, not the page behind it. Twenty-eight items
                don't fit on a phone and a non-scrolling sheet would hide the
                last three groups entirely. */}
            <div className="flex-1 overflow-y-auto px-3 py-4 overscroll-contain">
              {nav(() => setSheetOpen(false))}
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop: unchanged ── */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border bg-card min-h-full px-3 py-6">
        <h1 className="px-3 text-lg font-bold text-foreground mb-4">{t("app.settings.title")}</h1>
        {nav()}
      </aside>
    </>
  );
}
