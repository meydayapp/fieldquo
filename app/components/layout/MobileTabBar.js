// app/components/layout/MobileTabBar.js
"use client";

// The native-app navigation model for phones: a bottom tab bar, shown below
// `lg` where TopBar's 52px bar + the drawer (the web pattern) stand in for
// the rail. Above `lg` this renders nothing — AdminSidebar's real rail takes
// over there.
//
// ── Which tabs ──────────────────────────────────────────────────────────
//
// Per role since 2026-10-03 — lib/nav/phoneBar.js holds the four sets and
// why. What follows is the reasoning for the OWNER's bar, the office set.
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
// Since 2026-10-03 the Time clock is the first tab on every bar, the
// owner's included ("everyone should have a clock, even the boss"), and
// Invoices gave up its slot for it — the one of the four most often reached
// from another (its job, the +, a payment notification). lib/nav/phoneBar.js
// says why for every set. Somebody whose clock is switched off gets the bar
// as it was, Invoices and all.
//
// Chat is on every bar — see the note on TAB_ITEMS.
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
import {
  ClipboardList,
  FileText,
  Briefcase,
  Receipt,
  MessagesSquare,
  LayoutGrid,
  Clock,
  MapPin,
  Calendar,
  CalendarClock,
  Users,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { isMePath } from "@/lib/me/tabs";
import { PHONE_BARS, phoneBarFor, phoneMoreActive, phoneTabActive } from "@/lib/nav/phoneBar";
import { MeTabBar } from "@/app/components/me/MeShell";
import { useNavShell } from "@/app/components/layout/NavShell";

// lib/nav/phoneBar.js names icons; this maps them. One table of rows, one of
// pictures, so the decision stays pure and executable by the check.
const ICONS = {
  leads: ClipboardList,
  quotes: FileText,
  jobs: Briefcase,
  invoices: Receipt,
  chat: MessagesSquare,
  clock: Clock,
  today: MapPin,
  calendar: Calendar,
  schedule: CalendarClock,
  team: Users,
};

// The owner's bar, with its icons — what the More sheet used to subtract
// from the rail before the bar became per-role (MoreMenu.js now subtracts the
// caller's OWN bar). Kept exported because it is still the office set, and
// the same i18n keys AdminSidebar's NAV_GROUPS rows use for these
// destinations: nothing to translate twice, nothing that can drift from what
// the drawer calls the same page.
//
// Chat is on every set. It has no NAV_REQUIREMENTS
// entry on purpose: everyone on the roster is in #general and in the rooms of
// the jobs they are booked on. It is feature-gated (team_chat) like every
// other row, through the same filter as the rest (lib/nav/phoneBar.js).
export const TAB_ITEMS = PHONE_BARS.office.map((row) => ({ ...row, icon: ICONS[row.icon] }));

export default function MobileTabBar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const shell = useNavShell();
  const featureFlags = useFeatureFlags();
  const caller = usePermissions();

  // ── Which bar (2026-10-03) ──────────────────────────────────────────────
  //
  // The caller's ROLE bar — lib/nav/phoneBar.js decides the set (office,
  // crew, estimator, dispatch) and runs the rail's own two filters over it
  // (feature flags, then the permission grid, via the same shared helpers),
  // so a tab is never a link to a refusal. One bar per person, the same on
  // every screen: the owner asked for the menu to be "simple and easy to
  // access", and a bar that rearranges itself as you move is neither.
  //
  // The one exception is the employee home (/app/me and the screens under
  // it) for everybody who is NOT crew: a section with its own five tabs (Home ·
  // Clock · Schedule · Messages · More, or the manager set — lib/me/tabs.js),
  // reached from More › My home, and the bar there is that section's, so
  // earnings, requests and availability stay a tap apart. Crew live on those
  // screens, so for them the crew bar IS the section's bar — its More is
  // /app/me/more.
  const bar = phoneBarFor(caller, featureFlags);
  if (isMePath(pathname) && bar.set !== "crew") {
    return <MeTabBar />;
  }
  const moreIsPage = bar.more?.kind === "page";
  const moreActive = phoneMoreActive(bar.more, pathname, shell.isOpen("more"));
  const tabs = bar.tabs.map((row) => ({ ...row, Icon: ICONS[row.icon] || LayoutGrid }));

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
          const active = phoneTabActive(item, pathname);
          const Icon = item.Icon;
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
                  {t(item.label || item.key)}
                </span>
              </span>
            </Link>
          );
        })}

        {/* More. The sheet for office, estimator and dispatch; the crew's
            own More PAGE (/app/me/more) for crew — see lib/nav/phoneBar.js.
            Same chrome either way, so the slot never changes shape. */}
        {moreIsPage ? (
          <Link
            href={bar.more.href}
            aria-current={moreActive ? "page" : undefined}
            data-more-tab
            className="flex-1 max-w-[7rem] min-w-0 flex items-center justify-center active:bg-sidebar-accent/50 transition-colors"
          >
            <span
              className={`flex flex-col items-center gap-[3px] rounded-[10px] px-2 py-[5px] min-h-[44px] min-w-[44px] justify-center ${
                moreActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-muted-foreground"
              }`}
            >
              <LayoutGrid size={20} className="shrink-0" />
              <span className="text-[10px] font-semibold leading-none truncate max-w-[4.25rem]">
                {t("app.nav.more")}
              </span>
            </span>
          </Link>
        ) : (
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
                moreActive
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
        )}
      </div>
    </nav>
  );
}
