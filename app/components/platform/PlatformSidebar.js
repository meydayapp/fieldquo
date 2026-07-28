// app/components/platform/PlatformSidebar.js
//
// Nav for the internal console. Hides itself on /platform/login so the
// sign-in screen isn't wrapped in chrome for a session that doesn't exist yet.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Tags,
  ScrollText,
  MessageSquare,
  BarChart3,
  LogOut,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";

const ITEMS = [
  { label: "Dashboard", href: "/platform", icon: LayoutDashboard, exact: true },
  { label: "Companies", href: "/platform/companies", icon: Building2 },
  { label: "Plans", href: "/platform/billing/plans", icon: CreditCard },
  {
    label: "Subscriptions",
    href: "/platform/billing/subscriptions",
    icon: BarChart3,
  },
  { label: "Feedback", href: "/platform/feedback", icon: MessageSquare },
  { label: "Reports", href: "/platform/reports", icon: FileSpreadsheet },
  {
    label: "Service categories",
    href: "/platform/service-categories",
    icon: Tags,
  },
  { label: "Audit log", href: "/platform/audit-log", icon: ScrollText },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/platform/login") return null;

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  async function signOut() {
    await fetch("/api/platform/auth/logout", { method: "POST" });
    window.location.href = "/platform/login";
  }

  return (
    <aside className="w-60 shrink-0 bg-[#1A1917] text-gray-300 min-h-screen px-3 py-6 flex flex-col">
      <div className="px-3 mb-6 flex items-center gap-2">
        <ShieldCheck size={16} className="text-[#bd9d60]" />
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#bd9d60]">
          Platform
        </span>
      </div>

      <nav className="space-y-1 flex-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                isActive(item)
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </aside>
  );
}
