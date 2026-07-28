// app/components/layout/SettingsSidebar.js
//
// Secondary sidebar for /app/settings/*, in the Jobber "Business Management"
// pattern. Some links below are live today; others are placeholders for
// pages we haven't built yet (Phase 2) — see the NOT_BUILT set. They still
// render as normal links so the nav reads correctly, they just 404 until
// those pages exist.
//
// /app/settings/templates, /checklists and /notifications were previously
// left out of this nav because their page.js files were empty stubs that
// would crash on click. They render now, so they're linked below.
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
} from "lucide-react";

const TOP_ITEMS = [
  {
    label: "Account & Billing",
    href: "/app/settings/account-billing",
    icon: CreditCard,
  },
  { label: "Refer & Earn", href: "/app/settings/refer", icon: Gift },
  {
    label: "Product Updates",
    href: "/app/settings/product-updates",
    icon: Megaphone,
  },
];

const BUSINESS_ITEMS = [
  { label: "Company Settings", href: "/app/settings/company", icon: Building2 },
  // The Branding page existed but was never linked here, so the only way in
  // was typing the URL. It feeds the logo and accent colour used by every
  // email template.
  { label: "Branding", href: "/app/settings/branding", icon: Palette },
  { label: "Language", href: "/app/settings/language", icon: Globe },
  { label: "Manage Team", href: "/app/settings/team", icon: Users },
  {
    label: "Products & Services",
    href: "/app/settings/products",
    icon: Package,
  },
  {
    label: "Custom Fields",
    href: "/app/settings/custom-fields",
    icon: ListPlus,
  },
  {
    label: "Material Costs",
    href: "/app/settings/material-costs",
    icon: Droplet,
  },
  {
    label: "Email Templates",
    href: "/app/settings/email-templates",
    icon: Mail,
  },
  {
    label: "PDF Templates",
    href: "/app/settings/templates",
    icon: FileText,
  },
  {
    label: "Email Domain",
    href: "/app/settings/email-domain",
    icon: AtSign,
  },
  { label: "Follow-ups", href: "/app/settings/follow-ups", icon: Clock },
  {
    label: "Notifications",
    href: "/app/settings/notifications",
    icon: Bell,
  },
  {
    label: "Checklists",
    href: "/app/settings/checklists",
    icon: ListChecks,
  },
  { label: "Payments", href: "/app/settings/payments", icon: Receipt },
  {
    label: "Expense Tracking",
    href: "/app/settings/expense-tracking",
    icon: Wallet,
  },
  // Previously unlinked — reachable only by typing the URL.
  {
    label: "Services & Pricing",
    href: "/app/settings/services",
    icon: Tags,
  },
  { label: "Materials", href: "/app/settings/materials", icon: Boxes },
  { label: "Work Areas", href: "/app/settings/work-areas", icon: Map },
  { label: "Overhead", href: "/app/settings/overhead", icon: TrendingUp },
];

// Client-facing surfaces: the things a customer actually sees or interacts
// with. Split out of Business Management so that group doesn't become a
// dumping ground.
const CLIENT_ITEMS = [
  {
    label: "Booking Page",
    href: "/app/settings/booking-page",
    icon: CalendarDays,
  },
  { label: "Availability", href: "/app/settings/availability", icon: Clock },
  {
    label: "Lead Capture Form",
    href: "/app/settings/lead-form",
    icon: ClipboardList,
  },
];

export default function SettingsSidebar() {
  const pathname = usePathname();
  const isActive = (href) =>
    pathname === href || pathname.startsWith(href + "/");

  function renderItem(item) {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
          active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white min-h-full px-3 py-6">
      <h1 className="px-3 text-lg font-bold text-gray-900 mb-4">Settings</h1>

      <nav className="space-y-1">{TOP_ITEMS.map(renderItem)}</nav>

      <div className="mt-6 mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Business Management
      </div>
      <nav className="space-y-1">{BUSINESS_ITEMS.map(renderItem)}</nav>

      <div className="mt-6 mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Client-Facing
      </div>
      <nav className="space-y-1">{CLIENT_ITEMS.map(renderItem)}</nav>
    </aside>
  );
}
