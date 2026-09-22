// app/components/layout/TopBar.js
//
// The top of the /app shell, at two widths, one component:
//
//   lg and up   a 52px bar on --card beside the rail: where you are (group ›
//               row), the search box (`/`), Create, the bell, the avatar
//               menu. There was no bar at all before 2026-09-21 — the bell
//               lived in the rail's header, Create was a rail button, and
//               Help / Plan / Settings / Appearance / Log Out were rail rows.
//               Jobber's 60px bar carries exactly this set; the study ranked
//               "company/account items out of the work list" and "global
//               search with /" fifth and sixth of twelve.
//
//   below lg    the 52px bar the phone always had (it was 56px, inside
//               AdminSidebar): hamburger, logo, search, bell. It is sticky so
//               navigation stays reachable while scrolling, and it takes its
//               own space in normal flow — a floating button over the page's
//               own <h1> was the shape before that.
//
// Safe-area aware: the phone bar pads the notch inset above its 52px and the
// palette/sheets it opens pad their own. `--fq-top-bar` is not declared
// anywhere else; the settings phone strip sticks at top-[52px] and would
// need changing with this height.
//
// The bell moves in unchanged (NotificationBell.js) — a bell you have to
// open a menu to see is a bell that never gets looked at. The hamburger
// keeps `data-tour-open="nav"`: that is how the first-run walkthrough opens
// the drawer to point at rows inside it (OnboardingTour.js).
"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useTranslation } from "@/app/hooks/useTranslation";
import Logo from "@/app/components/Logo";
import NotificationBell from "@/app/components/layout/NotificationBell";
import { useNavShell } from "@/app/components/layout/NavShell";
import GlobalSearch, { useSlashToSearch } from "@/app/components/layout/GlobalSearch";
import { CreateButton, CreateFab } from "@/app/components/layout/CreateMenu";
import AccountMenu, { Avatar } from "@/app/components/layout/AccountMenu";
import { MoreSheet } from "@/app/components/layout/MoreMenu";
import {
  HOME_ITEM,
  MORE_ITEM,
  NAV_GROUPS,
  MORE_GROUPS,
  BOTTOM_ITEMS,
} from "@/app/components/layout/AdminSidebar";
import { GROUPS as SETTINGS_GROUPS } from "@/app/components/layout/SettingsSidebar";

/**
 * "Group › Row" for the current path, by longest matching href across every
 * row the shell knows. Deeper pages (a quote, a job) resolve to their list's
 * row — the page's own <h1> says which one. Pure, so check-shell can run it.
 */
export function breadcrumbFor(pathname) {
  const p = String(pathname || "");
  const candidates = [
    { group: null, item: HOME_ITEM },
    { group: null, item: MORE_ITEM },
    ...NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ group: g.key, item }))),
    ...MORE_GROUPS.flatMap((g) => g.items.map((item) => ({ group: "app.nav.more", item }))),
    ...BOTTOM_ITEMS.map((item) => ({ group: null, item })),
    ...SETTINGS_GROUPS.flatMap((g) => g.items.map((item) => ({ group: "app.nav.settings", item, settingsGroup: g.key }))),
  ];
  let best = null;
  for (const c of candidates) {
    const h = c.item.href;
    const hit = h === "/app" ? p === "/app" : p === h || p.startsWith(h + "/");
    if (hit && (!best || h.length > best.item.href.length)) best = c;
  }
  return best;
}

function Crumb() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const crumb = useMemo(() => breadcrumbFor(pathname), [pathname]);
  if (!crumb) return null;
  return (
    <nav aria-label={t("app.topbar.youAreHere")} className="min-w-0 flex items-center gap-1.5 text-sm text-muted-foreground">
      {crumb.group && (
        <>
          <span className="truncate">{t(crumb.group)}</span>
          <span aria-hidden="true">›</span>
        </>
      )}
      {crumb.settingsGroup && (
        <>
          <span className="truncate">{t(crumb.settingsGroup)}</span>
          <span aria-hidden="true">›</span>
        </>
      )}
      <Link href={crumb.item.href} className="truncate font-semibold text-foreground hover:underline">
        {t(crumb.item.key)}
      </Link>
    </nav>
  );
}

function AvatarMenu() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const shell = useNavShell();
  const open = shell.isOpen("account");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && shell.close();
    const onKey = (e) => e.key === "Escape" && shell.close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, shell]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => shell.toggle("account")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("app.topbar.account")}
        data-avatar-button
        className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted"
      >
        <Avatar user={session?.user} size={30} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 w-72 z-50 bg-card rounded-xl shadow-lg border border-border p-2">
          <AccountMenu onNavigate={shell.close} tone="card" />
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const { t } = useTranslation();
  const shell = useNavShell();
  useSlashToSearch();

  return (
    <>
      {/* ── Desktop ── */}
      <header
        className="hidden lg:flex sticky top-0 z-30 h-[52px] items-center gap-3 px-4 bg-card/90 supports-[backdrop-filter]:bg-card/75 backdrop-blur-xl border-b border-border"
        data-top-bar="desktop"
      >
        <Crumb />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => shell.open("search")}
            className="hidden xl:flex w-80 items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:text-foreground"
            data-search-button
          >
            <Search size={14} className="shrink-0" />
            <span className="truncate">{t("app.search.placeholder")}</span>
            <kbd className="ml-auto text-[11px] font-mono border border-border rounded px-1.5">/</kbd>
          </button>
          <button
            type="button"
            onClick={() => shell.open("search")}
            aria-label={t("app.search.title")}
            className="xl:hidden flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Search size={20} />
          </button>
          <CreateButton />
          <NotificationBell tone="bar" />
          <AvatarMenu />
        </div>
      </header>

      {/* ── Phone ── */}
      <div
        className="lg:hidden sticky top-0 z-40 pt-[env(safe-area-inset-top)] text-sidebar-foreground border-b border-sidebar-border/60 bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/65 backdrop-blur-xl backdrop-saturate-150"
        data-top-bar="phone"
      >
        <div className="h-[52px] flex items-center gap-1 px-2">
          <button
            type="button"
            onClick={() => shell.open("drawer")}
            aria-label={t("app.sidebar.openMenu")}
            // The walkthrough points at nav items that live inside the drawer.
            // It opens the drawer by clicking THIS — see OnboardingTour.js.
            data-tour-open="nav"
            aria-expanded={shell.isOpen("drawer")}
            // 44px minimum: this is the button every navigation goes through.
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-sidebar-accent"
          >
            <Menu size={20} />
          </button>
          <Logo variant="horizontal" href="/app" height={22} onDark priority />
          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => shell.open("search")}
              aria-label={t("app.search.title")}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Search size={20} />
            </button>
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* The overlays the bar (and the tab bar, and the rail) open. Mounted
          once, here, so there is one of each per shell. */}
      <GlobalSearch />
      <MoreSheet />
      <CreateFab />
    </>
  );
}
