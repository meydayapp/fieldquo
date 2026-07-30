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

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Users,
  Package,
  ListPlus,
  CreditCard,
  Receipt,
  Wallet,
  Gift,
  Megaphone,
  Droplet,
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

const GROUPS = [
  {
    label: "Account",
    items: [
      { label: "Account & Billing", href: "/app/settings/account-billing", icon: CreditCard },
      { label: "Refer & Earn", href: "/app/settings/refer", icon: Gift },
      { label: "Product Updates", href: "/app/settings/product-updates", icon: Megaphone },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Company Settings", href: "/app/settings/company", icon: Building2 },
      { label: "Branding", href: "/app/settings/branding", icon: Palette },
      { label: "Language", href: "/app/settings/language", icon: Languages },
    ],
  },
  {
    label: "Team & scheduling",
    items: [
      { label: "Manage Team", href: "/app/settings/team", icon: Users },
      { label: "Availability", href: "/app/settings/availability", icon: Clock },
      { label: "Time Off Policies", href: "/app/settings/leave", icon: CalendarClock },
      { label: "Booking Page", href: "/app/settings/booking-page", icon: CalendarDays },
      { label: "Work Areas", href: "/app/settings/work-areas", icon: Map },
    ],
  },
  {
    label: "Services & pricing",
    items: [
      { label: "Products & Services", href: "/app/settings/products", icon: Package },
      { label: "Services & Pricing", href: "/app/settings/services", icon: Tags },
      { label: "Materials", href: "/app/settings/materials", icon: Boxes },
      { label: "Material Costs", href: "/app/settings/material-costs", icon: Droplet },
      { label: "Overhead", href: "/app/settings/overhead", icon: TrendingUp },
      { label: "Payroll", href: "/app/settings/payroll", icon: Wallet },
      { label: "Custom Fields", href: "/app/settings/custom-fields", icon: ListPlus },
    ],
  },
  {
    label: "Documents & messaging",
    items: [
      { label: "Email Templates", href: "/app/settings/email-templates", icon: Mail },
      { label: "PDF Templates", href: "/app/settings/templates", icon: FileText },
      { label: "Email Domain", href: "/app/settings/email-domain", icon: AtSign },
      { label: "Translations", href: "/app/settings/translations", icon: Globe },
      { label: "Follow-ups", href: "/app/settings/follow-ups", icon: Clock },
      { label: "Notifications", href: "/app/settings/notifications", icon: Bell },
      { label: "Checklists", href: "/app/settings/checklists", icon: ListChecks },
    ],
  },
  {
    label: "Getting paid",
    items: [
      { label: "Payments", href: "/app/settings/payments", icon: Receipt },
      { label: "Expense Tracking", href: "/app/settings/expense-tracking", icon: Wallet },
    ],
  },
  {
    label: "Client-facing",
    items: [
      { label: "Your website", href: "/app/settings/website", icon: Globe },
      { label: "Instant Quotes", href: "/app/settings/instant-quotes", icon: Zap },
      { label: "Share your links", href: "/app/settings/lead-form", icon: ClipboardList },
    ],
  },
  {
    label: "Records",
    items: [{ label: "Activity Log", href: "/app/activity", icon: Activity }],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

export default function SettingsSidebar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

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
  const current = ALL_ITEMS.filter((i) => isActive(i.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];

  function renderItem(item, { onNavigate } = {}) {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium ${
          active ? "bg-inverted text-inverted-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  const nav = (onNavigate) => (
    <nav className="space-y-5">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => renderItem(item, { onNavigate }))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* ── Mobile: a bar that says where you are, and opens the list ── */}
      {/* top-14, not top-0: AdminSidebar's mobile bar is h-14 and sticks above
          this one. At top-0 the two would occupy the same 56px and this bar
          would be hidden behind it. */}
      <div className="lg:hidden sticky top-14 z-30 bg-card/95 backdrop-blur border-b border-border">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className="w-full flex items-center gap-2 px-4 py-3 text-left"
        >
          <SettingsIcon size={16} className="shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground truncate">
            {current?.label || "Settings"}
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
          <div className="absolute inset-x-0 bottom-0 top-14 bg-card rounded-t-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="font-bold text-foreground">Settings</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close settings menu"
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
        <h1 className="px-3 text-lg font-bold text-foreground mb-4">Settings</h1>
        {nav()}
      </aside>
    </>
  );
}
