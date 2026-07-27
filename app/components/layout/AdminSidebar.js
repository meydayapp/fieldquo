// app/components/layout/AdminSidebar.js
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
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
  Clock,
  Wallet,
  Gift,
  Sparkles,
  Compass,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

// Main nav, in the order they should render below the "+" quick-add button.
const NAV_ITEMS = [
  { label: "Calendar", href: "/app/appointments", icon: Calendar },
  { label: "Clients", href: "/app/clients", icon: Users },
  { label: "Requests", href: "/app/leads", icon: ClipboardList },
  { label: "Quotes", href: "/app/quotes", icon: FileText },
  { label: "Jobs", href: "/app/jobs", icon: Briefcase },
  { label: "Invoices", href: "/app/invoices", icon: Receipt },
  { label: "Marketing", href: "/app/marketing", icon: Megaphone },
  { label: "Receptionist", href: "/app/receptionist", icon: Headset },
  { label: "Timesheets", href: "/app/settings/team/timesheets", icon: Clock },
  { label: "Expenses", href: "/app/settings/expense-tracking", icon: Wallet },
  { label: "Refer & Earn", href: "/app/settings/refer", icon: Gift },
];

// The floating "+" popup — quick-create shortcuts.
const QUICK_ADD_ITEMS = [
  { label: "Client", href: "/app/clients", icon: Users },
  { label: "Request", href: "/app/leads", icon: ClipboardList },
  { label: "Quote", href: "/app/quotes/new", icon: FileText },
  { label: "Job", href: "/app/jobs", icon: Briefcase },
  { label: "Invoice", href: "/app/invoices/new", icon: Receipt },
];

// Bottom-of-sidebar items, above Log Out.
const BOTTOM_ITEMS = [
  { label: "AI Assist", href: "/app/copilot", icon: Sparkles },
  { label: "Optimize Guide", href: "/app/analytics/benchmark", icon: Compass },
  { label: "Plan", href: "/app/settings/account-billing", icon: CreditCard },
  { label: "Settings", href: "/app/settings", icon: Settings },
];

export default function AdminSidebar() {
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
        title={showLabel ? undefined : item.label}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          showLabel ? "" : "justify-center"
        } ${
          active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        <Icon size={18} className="shrink-0" />
        {showLabel && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  function SidebarContent({ forceExpanded = false }) {
    const showLabel = forceExpanded || !collapsed;

    return (
      <div className="flex flex-col h-full">
        {/* Logo -> Dashboard/Home */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
          <Link
            href="/app"
            className="text-lg font-bold text-gray-900 truncate"
          >
            {showLabel ? "FieldQuo" : "FQ"}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Home */}
          <NavLink
            item={{ label: "Home", href: "/app", icon: Home }}
            forceExpanded={forceExpanded}
          />

          {/* + Quick add */}
          <div className="relative" ref={forceExpanded ? null : quickAddRef}>
            <button
              type="button"
              onClick={() => setQuickAddOpen((v) => !v)}
              title={showLabel ? undefined : "New"}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-600 hover:bg-gray-100 ${
                showLabel ? "" : "justify-center"
              }`}
            >
              <Plus size={18} className="shrink-0" />
              {showLabel && <span>New</span>}
            </button>

            {quickAddOpen && (
              <div
                className={`absolute z-50 top-0 ${
                  showLabel ? "left-full ml-2" : "left-full ml-2"
                } w-52 bg-white rounded-xl shadow-lg border border-gray-100 p-2`}
              >
                {QUICK_ADD_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setQuickAddOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Icon size={16} className="shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              forceExpanded={forceExpanded}
            />
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100 space-y-1">
          {/* Profile + trial countdown */}
          {session?.user && (
            <Link
              href="/app/settings/account-billing"
              title={showLabel ? undefined : session.user.name}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-100 ${
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
                <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {(session.user.name || session.user.email || "?")
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("")}
                </div>
              )}
              {showLabel && (
                <span className="text-sm font-medium text-gray-900 truncate">
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
            title={showLabel ? undefined : "Log Out"}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 ${
              showLabel ? "" : "justify-center"
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {showLabel && "Log Out"}
          </button>

          {/* Expand / contract toggle — desktop only */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden lg:flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600 ${
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
      {/* Mobile hamburger trigger — sidebar is drawer-only on small screens */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="lg:hidden fixed top-4 left-4 z-40 p-2.5 rounded-full bg-white border border-gray-200 shadow-sm text-gray-700"
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0 flex-col transition-all duration-200 ${
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
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
            <SidebarContent forceExpanded />
          </aside>
        </div>
      )}
    </>
  );
}
