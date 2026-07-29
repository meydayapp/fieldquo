// app/components/layout/SettingsSidebar.js
//
// Secondary sidebar for /app/settings/*. Grouped by what a company is actually
// trying to DO, not by when a screen happened to get built — the old flat list
// had twenty-plus items in two buckets, which is past the point anyone scans.
//
// Groups are ordered roughly by how often they're opened: identity first, then
// the day-to-day (team/scheduling, services/pricing), then the plumbing
// (documents, money), then the client-facing surfaces, then records.
"use client";

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
  ClipboardList,
  AtSign,
  Globe,
  FileText,
  Bell,
  ListChecks,
  Languages,
  Zap,
  Activity,
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

export default function SettingsSidebar() {
  const pathname = usePathname();
  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

  function renderItem(item) {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
          active ? "bg-inverted text-inverted-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card min-h-full px-3 py-6">
      <h1 className="px-3 text-lg font-bold text-foreground mb-4">Settings</h1>
      <nav className="space-y-5">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">
              {group.label}
            </div>
            <div className="space-y-0.5">{group.items.map(renderItem)}</div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
