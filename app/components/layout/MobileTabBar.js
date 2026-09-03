// app/components/layout/MobileTabBar.js
"use client";

// The native-app navigation model for phones: a bottom tab bar, shown below
// `lg` where AdminSidebar's sticky top bar + full-screen drawer (the web
// pattern) currently stands in for it. Above `lg` this renders nothing —
// AdminSidebar's real rail takes over there.
//
// ── Which four, and why ─────────────────────────────────────────────────
//
// AdminSidebar's own comment on NAV_GROUPS names the order work actually
// moves: "Requests -> Quotes -> Jobs -> Invoices". AGENTS.md's pipeline
// diagram (Lead -> Quote -> Job -> Invoice -> Payment) says the same thing.
// Both are the authoritative answer to "what does a contractor reach for
// most" — not a guess made here. Those four are also the one part of the
// menu that is NEVER feature-gated (see lib/features/registry.js — none of
// them own a FEATURES entry), so they degrade to a permission check alone
// and never disappear because a company's plan doesn't include them.
//
// Home is deliberately NOT a tab: the mobile top bar AdminSidebar already
// renders (the sticky bar with the logo, still visible below `lg`) links the
// logo to /app, so Home stays one tap away without spending a fifth slot on
// a destination that already has one.
//
// The fifth slot is "More", which opens the SAME drawer AdminSidebar
// contains everything else in — not a second menu. See openAdminDrawer below
// for how, given this file may not edit AdminSidebar.js.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, Briefcase, Receipt, Menu } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { filterNavItems } from "@/lib/features/nav";
import { filterNavItemsByPermission } from "@/lib/permissions/nav";

// Same i18n keys AdminSidebar's own NAV_GROUPS rows use for these four
// destinations — not new strings, so there is nothing to translate twice and
// nothing that can drift from what the drawer calls the same page.
const TAB_ITEMS = [
  { key: "app.nav.requests", href: "/app/leads", icon: ClipboardList },
  { key: "app.nav.quotes", href: "/app/quotes", icon: FileText },
  { key: "app.nav.jobs", href: "/app/jobs", icon: Briefcase },
  { key: "app.nav.invoices", href: "/app/invoices", icon: Receipt },
];

/**
 * Opens AdminSidebar's mobile drawer from outside it.
 *
 * `mobileOpen` is local state inside AdminSidebar with no exported setter, no
 * context, no event bus — and this file may not edit that component to add
 * one. This is not the first place in the codebase to hit that wall:
 * app/components/OnboardingTour.js already opens the same drawer from outside
 * AdminSidebar, for the exact same reason (the welcome tour has to point at
 * rows that live inside it), by clicking the real DOM node AdminSidebar
 * renders for its own hamburger button — `[data-tour-open="nav"]` — rather
 * than reimplementing the toggle. That button click runs AdminSidebar's own
 * `setMobileOpen(true)`, so this is the SAME open, not a second one. Reusing
 * a pattern the codebase already ships (and that OnboardingTour's tour steps
 * exercise on every first-run walkthrough) rather than inventing a new way to
 * reach the same piece of state.
 *
 * A cleaner fix — lifting `mobileOpen` to a shared context AdminSidebar and
 * this component both read — is the better long-term shape; see
 * docs/MOBILE-TABBAR.md for why that was not done here (it requires editing
 * AdminSidebar.js, which is out of scope for this change).
 */
function openAdminDrawer() {
  if (typeof document === "undefined") return;
  const trigger = document.querySelector('[data-tour-open="nav"]');
  if (trigger instanceof HTMLElement) trigger.click();
}

/** Mirrors AdminSidebar's own `isActive`: /app is exact, everything else is a prefix. */
function isActive(pathname, href) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

export default function MobileTabBar() {
  const { t } = useTranslation();
  const pathname = usePathname();

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
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border/60 bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/65 backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)]"
    >
      {/* Fixed content height (not just "auto"), so app/app/layout.js has an
          exact number to reserve on <main> instead of guessing at one that
          drifts the moment padding here changes. */}
      <div className="h-16 flex items-stretch justify-center">
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
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 min-h-[44px] min-w-[44px] justify-center ${
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
          onClick={openAdminDrawer}
          aria-label={t("app.nav.more")}
          className="flex-1 max-w-[7rem] min-w-0 flex items-center justify-center active:bg-sidebar-accent/50 transition-colors"
        >
          <span className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 min-h-[44px] min-w-[44px] justify-center text-sidebar-muted-foreground">
            <Menu size={20} className="shrink-0" />
            <span className="text-[10px] font-semibold leading-none truncate max-w-[4.25rem]">
              {t("app.nav.more")}
            </span>
          </span>
        </button>
      </div>
    </nav>
  );
}
