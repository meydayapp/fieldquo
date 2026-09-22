// app/components/layout/MobileTabBar.js
"use client";

// The native-app navigation model for phones: a bottom tab bar, shown below
// `lg` where TopBar's 52px bar + the drawer (the web pattern) stand in for
// the rail. Above `lg` this renders nothing — AdminSidebar's real rail takes
// over there.
//
// ── Which five, and why ─────────────────────────────────────────────────
//
// AdminSidebar's own comment on NAV_GROUPS names the order work actually
// moves: "Leads -> Quotes -> Jobs -> Invoices". AGENTS.md's pipeline
// diagram (Lead -> Quote -> Job -> Invoice -> Payment) says the same thing.
// Both are the authoritative answer to "what does a contractor reach for
// most" — not a guess made here. Those four are also the one part of the
// menu that is NEVER feature-gated (see lib/features/registry.js — none of
// them own a FEATURES entry), so they degrade to a permission check alone
// and never disappear because a company's plan doesn't include them.
//
// The fifth is Chat — the crew's own screen, see the note on TAB_ITEMS.
//
// Home is deliberately NOT a tab: the phone's top bar (TopBar.js) links the
// logo to /app, so Home stays one tap away without spending a slot on a
// destination that already has one.
//
// The last slot is "More". It used to open the ENTIRE rail as a left drawer
// over this bar — forty rows behind a scroll, in a 320px panel, with the
// tab bar covered — by clicking the hamburger's DOM node, because the
// drawer's state was private to AdminSidebar. Since 2026-09-21 it opens the
// More sheet (MoreMenu.js): search first, the same grouped tiles as
// /app/more, the account rows at the end, and this bar still visible under
// it. The state is shared through NavShellProvider (NavShell.js), so no DOM
// hack; the hamburger keeps its data-tour-open hook for the walkthrough.
//
// Create is the floating + above this bar (CreateMenu.js's CreateFab),
// mounted by TopBar so there is one per shell.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, Briefcase, Receipt, MessagesSquare, LayoutGrid } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { filterNavItems } from "@/lib/features/nav";
import { filterNavItemsByPermission } from "@/lib/permissions/nav";
import { isMePath } from "@/lib/me/tabs";
import { MeTabBar } from "@/app/components/me/MeShell";
import { useNavShell } from "@/app/components/layout/NavShell";

// Same i18n keys AdminSidebar's own NAV_GROUPS rows use for these four
// destinations — not new strings, so there is nothing to translate twice and
// nothing that can drift from what the drawer calls the same page.
//
// Chat is the fifth, and it is the one a CREW member keeps. The four pipeline
// tabs are gated on the document ladders (lib/permissions/nav.js), and the
// Crew preset sits at `none` on every one of them — so for the person in the
// van the bar used to hold nothing but More. Chat has no NAV_REQUIREMENTS
// entry on purpose: everyone on the roster is in #general and in the rooms
// of the jobs they are booked on, and the chat is the crew's own screen.
// Same shell, same kit, same drawer for everything else. It is feature-gated
// (team_chat) like every other row, through the same filterNavItems below.
export const TAB_ITEMS = [
  { key: "app.nav.requests", href: "/app/leads", icon: ClipboardList },
  { key: "app.nav.quotes", href: "/app/quotes", icon: FileText },
  { key: "app.nav.jobs", href: "/app/jobs", icon: Briefcase },
  { key: "app.nav.invoices", href: "/app/invoices", icon: Receipt },
  { key: "app.nav.chat", href: "/app/chat", icon: MessagesSquare },
];

/** Mirrors AdminSidebar's own `isActive`: /app is exact, everything else is a prefix. */
function isActive(pathname, href) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

export default function MobileTabBar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const shell = useNavShell();

  // Same two-filter pipeline AdminSidebar runs on NAV_GROUPS, in the same
  // order (feature flags first, then the permission grid) and via the exact
  // same shared helpers — not a second, hand-rolled gate that could disagree
  // with the one the drawer enforces. See the long comment on that pipeline
  // in AdminSidebar.js for why the two filters stay separate.
  const featureFlags = useFeatureFlags();
  const caller = usePermissions();
  const tabs = filterNavItemsByPermission(
    filterNavItems(TAB_ITEMS, featureFlags),
    caller,
  );

  // ── The employee home's bar ─────────────────────────────────────────────
  //
  // On any /app/me screen the five tabs are the employee home's (Home ·
  // Schedule · Earnings · Messages · More, or the manager set — lib/me/
  // tabs.js), so the bar a person is standing on is the bar of the screen
  // they are on. And for the person in the van it is the bar EVERYWHERE:
  // when the pipeline gating above leaves nothing but Chat standing — the
  // Crew preset sits at `none` on all four document ladders — the old bar
  // was Chat + More, the docs/MOBILE-TABBAR.md edge case. That person's
  // product is their next shift, their hours and their crew, and those are
  // the tabs they get. One bar at a time: MeTabBar carries the same chrome
  // and the same row height <main> reserves, so nothing else changes.
  if (isMePath(pathname) || tabs.filter((t) => t.href !== "/app/chat").length === 0) {
    return <MeTabBar />;
  }

  return (
    // The bottom padding below carries the safe-area inset as extra space BELOW
    // fixed-height row of buttons, rather than being squeezed inside it — see
    // the matching bottom padding on <main> in app/app/layout.js, which
    // has to reserve the identical two numbers or content sits under this bar.
    //
    // Depends on <html> having `viewport-fit=cover` for env() to resolve to
    // anything but 0 — a parallel change is adding that to the root layout;
    // see docs/MOBILE-TABBAR.md.
    //
    // z-40 matches AdminSidebar's own sticky top bar (same layer, mobile
    // chrome above page content); the mobile drawer it opens is z-50, so this
    // never sits above that overlay.
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)]"
    >
      {/* Fixed content height (not just "auto"), and taken from the ONE
          declaration of it — --fq-tab-bar-row in app/globals.css — so the
          <main> padding, every page's Save bar and the floating launchers
          reserve exactly this row plus the safe-area inset without a second
          written copy of "4rem" that can drift. See the "bottom dock"
          section there. */}
      <div className="h-[var(--fq-tab-bar-row)] flex items-stretch justify-center">
        {tabs.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // flex-1 fills the bar evenly regardless of how many tabs
              // gating left standing; max-w keeps a single surviving tab (a
              // Crew grid with `none` on all four categories hides every one
              // of them) from stretching into one giant button — see
              // docs/MOBILE-TABBAR.md for that edge case.
              //
              // active:* is the CSS pseudo-class (press feedback) — unrelated
              // to the `active` JS boolean above that decides the current tab.
              // A phone has no hover state, so this is the only visible
              // response to a touch; there is no hover-only styling here.
              className="flex-1 max-w-[7rem] min-w-0 flex items-center justify-center active:bg-sidebar-accent/50 transition-colors"
            >
              <span
                // The active pill: icon and label share ONE fill so they read
                // as a single accent, not two separately-colored pieces. Same
                // pairing AdminSidebar's own "rail selected row" uses for its
                // active state (bg-sidebar-primary / text-sidebar-primary-
                // foreground) — check-sidebar.mjs already proves that exact
                // pair clears the 4.5:1 text floor in both themes, which a
                // plain accent-coloured label on the bar's navy background
                // does not (measured ~3.9:1 — see docs/MOBILE-TABBAR.md).
                className={`flex flex-col items-center gap-[3px] rounded-[10px] px-2 py-[5px] min-h-[44px] min-w-[44px] justify-center ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-muted-foreground"
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className="text-[10px] font-semibold leading-none truncate max-w-[4.25rem]">
                  {t(item.key)}
                </span>
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => shell.toggle("more")}
          aria-label={t("app.nav.more")}
          aria-expanded={shell.isOpen("more")}
          data-more-tab
          className="flex-1 max-w-[7rem] min-w-0 flex items-center justify-center active:bg-sidebar-accent/50 transition-colors"
        >
          <span
            className={`flex flex-col items-center gap-[3px] rounded-[10px] px-2 py-[5px] min-h-[44px] min-w-[44px] justify-center ${
              shell.isOpen("more") || pathname.startsWith("/app/more")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-muted-foreground"
            }`}
          >
            <LayoutGrid size={20} className="shrink-0" />
            <span className="text-[10px] font-semibold leading-none truncate max-w-[4.25rem]">
              {t("app.nav.more")}
            </span>
          </span>
        </button>
      </div>
    </nav>
  );
}
