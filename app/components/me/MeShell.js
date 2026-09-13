"use client";

// app/components/me/MeShell.js
//
// The employee home's shell — the five tabs, on the phone and on the web,
// one component, one look.
//
// ── The contract ─────────────────────────────────────────────────────────────
//
//   <MeShell>{page}</MeShell>
//
// That is all a page under /app/me/* has to do. The shell reads the caller's
// permissions to pick the worker or manager tab set (lib/me/tabs.js), lights
// the tab from the pathname, and lays the page out at phone width with the
// same paddings as /app/clock so the two screens read as one product.
//
// Optional: `title` puts a heading above the page; `wide` lets a screen that
// holds a board (the manager's week) use the full width instead of the
// phone-first column.
//
// ── Where the bottom bar comes from ──────────────────────────────────────────
//
// Below `lg` the shell renders NO bar of its own. app/components/layout/
// MobileTabBar.js — mounted once by app/app/layout.js for every /app screen —
// swaps its pipeline tabs for the me tabs (MeTabBar below) whenever the
// pathname is one of these screens, or whenever the caller is a crew member
// whose pipeline tabs all gated away. Two fixed bars at the bottom of one
// viewport would be the alternative, and <main>'s padding only reserves one.
// So: the bar is the layout's, the tabs are this file's, the decision is
// lib/me/tabs.js's.
//
// From `lg` up the same five tabs are a sub-nav across the top of the page,
// inside the ordinary /app layout with the sidebar — the sidebar's "My home"
// row lands here, and the five tabs move between the screens without going
// back through the rail.
//
// ── Why `lg` and not 768 ─────────────────────────────────────────────────────
//
// The tab bar's footprint is declared ONCE, in app/globals.css
// (--fq-tab-bar-height: the row below lg, 0 from lg up), and <main> pads by
// it so the last card on a page is never under the bar. A second breakpoint
// here would either leave a 4rem gap under every me screen between 768 and
// 1024 or need that shared rule changed — and the sales shell reads the same
// variable. A tablet in portrait gets the bottom bar; that is the phone
// experience, which is the one it should get.
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  Wallet,
  MessagesSquare,
  Menu,
  Users,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { activeMeTab, meTabsFor } from "@/lib/me/tabs";

const ICONS = {
  home: Home,
  schedule: CalendarDays,
  earnings: Wallet,
  messages: MessagesSquare,
  more: Menu,
  team: Users,
};

/** The five tabs for this caller, with their icons resolved. */
export function useMeTabs() {
  const caller = usePermissions();
  const pathname = usePathname();
  const tabs = meTabsFor(caller);
  const active = activeMeTab(tabs, pathname);
  return { tabs, active };
}

/**
 * The bottom bar, below lg. Rendered by MobileTabBar, not by the shell — see
 * the header. Same chrome as the pipeline bar it replaces: the layout's
 * z-index, its blur, its safe-area padding, its 44px targets, its active
 * pill — so a person switching between the two never sees the bar change
 * shape, only its rows.
 */
export function MeTabBar() {
  const { t } = useTranslation();
  const { tabs, active } = useMeTabs();
  return (
    <nav
      data-me-tabs="bottom"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border/60 bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/65 backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="h-[var(--fq-tab-bar-row)] flex items-stretch justify-center">
        {tabs.map((tab) => {
          const Icon = ICONS[tab.icon] || Home;
          const isActive = active === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className="flex-1 max-w-[7rem] min-w-0 flex items-center justify-center active:bg-sidebar-accent/50 transition-colors"
            >
              <span
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 min-h-[44px] min-w-[44px] justify-center ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-muted-foreground"
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className="text-[10px] font-semibold leading-none truncate max-w-[4.25rem]">
                  {t(tab.key)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** The same five, as a sub-nav across the top from lg up. */
function MeTopNav() {
  const { t } = useTranslation();
  const { tabs, active } = useMeTabs();
  return (
    <nav
      data-me-tabs="top"
      aria-label={t("app.me.tab.navLabel")}
      className="hidden lg:flex items-center gap-1 border-b border-border px-4 sm:px-6 pt-3"
    >
      {tabs.map((tab) => {
        const Icon = ICONS[tab.icon] || Home;
        const isActive = active === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`-mb-px inline-flex min-h-[44px] items-center gap-2 rounded-t-lg border-b-2 px-4 text-sm font-semibold transition-colors ${
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <Icon size={16} />
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * @param {object} p
 * @param {string} [p.title]  a heading above the page, in the reader's language
 * @param {boolean} [p.wide]  full width instead of the phone-first column
 */
export default function MeShell({ children, title = null, wide = false }) {
  return (
    <div className="min-h-[60vh]" data-me-shell>
      <MeTopNav />
      <div className={`${wide ? "max-w-6xl" : "max-w-md lg:max-w-2xl"} mx-auto p-4 sm:p-6`}>
        {title ? (
          <h1 className="mb-4 text-2xl font-bold text-foreground">{title}</h1>
        ) : null}
        {children}
      </div>
    </div>
  );
}
