"use client";

// app/components/sales/SalesMobileTabBar.js
//
// The portal on a phone: a sticky top bar, a bottom tab bar with the five
// screens a rep lives in, and a drawer holding the other nine. Renders
// nothing from `lg` up — SalesShell's own header and tab row take over there.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The owner: "it is also not mobile friendly, not like /app". /app below `lg`
// is app/components/layout/MobileTabBar.js (the bar) plus AdminSidebar's
// sticky top bar and full-screen drawer. The portal had fourteen tabs in a
// three-column grid under the header, which at 390px is five rows of chrome
// before the first word of the screen, and no way to reach a tab without
// scrolling back to the top. This is the /app model, transplanted: the tab bar
// stays under the thumb on every screen, and the drawer holds the rest.
//
// The model is copied; the code is not. MobileTabBar reads its four from a
// feature-and-permission pipeline the portal does not have, and paints with
// the navy sidebar tokens the portal must NOT use — app/sales/layout.js's
// header explains why the portal is deliberately plain, and
// scripts/check-platform-console.mjs asserts SalesShell paints no dark
// surface. So this bar is on --card, with the same three measured tokens the
// shell's header already uses on that surface.
//
// ══ One list, not two ═════════════════════════════════════════════════════
//
// `tabs` comes in from SalesShell — the SAME array the desktop row maps over,
// with the labels already resolved through t(). This file never names a tab.
// lib/sales/portalTabs.js decides which five go on the bar; the rest go in
// the drawer in the shell's order. A tab added to the shell appears in the
// drawer with no change here, and a tab removed from the shell leaves both.
//
// ══ The drawer opens from three places, through one node ══════════════════
//
// The top bar's menu button, the tour (when a step points at a drawer row),
// and nothing else. The tour does not get a setter or a context: it clicks the
// button carrying data-tour-open="sales-nav", exactly as the contractor app's
// tour clicks AdminSidebar's `[data-tour-open="nav"]` — one open, not two.
// See lib/tours/anchor.js and app/sales/tourSteps.js.
//
// ══ Safe areas ════════════════════════════════════════════════════════════
//
// The bottom bar pads by env(safe-area-inset-bottom) BELOW its fixed-height
// row, the top bar by env(safe-area-inset-top) above its row, and the row
// heights come from app/globals.css's --fq-tab-bar-row so SalesShell's <main>
// reserves exactly the same numbers. Both env() values are 0 in an ordinary
// browser tab and become real on an iPhone with the page installed to the
// home screen; app/layout.js's viewport export (`viewportFit: "cover"`) is
// what makes them non-zero. There is no `html.native-app` class anywhere in
// this codebase — nothing stamps one — so nothing here keys off it. Padding
// on env() alone is correct in both cases and needs no flag.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BookOpen,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  PhoneOutgoing,
  Users,
  X,
} from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { isActiveTab, splitPortalTabs } from "@/lib/sales/portalTabs";

// One icon per bar slot, keyed by href so a tab's icon travels with its route.
// A drawer row has no icon — it is a list of words, like the desktop row.
const ICONS = {
  "/sales": ListTodo,
  "/sales/queue": PhoneOutgoing,
  "/sales/playbook": BookOpen,
  "/sales/leads": Users,
  "/sales/threads": Mail,
};

/**
 * @param tabs      `[{ href, label }]`, labels already translated — SalesShell's
 *                  own list, passed down rather than re-declared.
 * @param name      who is signed in, or null while /api/sales/me is in flight.
 * @param onSignOut SalesShell's sign-out, so the drawer's button is the same
 *                  control as the header's, not a second implementation.
 */
export default function SalesMobileTabBar({ tabs, name = null, onSignOut }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { bar, drawer } = splitPortalTabs(tabs);

  // Close the drawer whenever the route changes — a rep who tapped a row is
  // now looking at that screen, and a drawer still covering it would need a
  // second tap for nothing. Same effect AdminSidebar runs on pathname.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Top bar ────────────────────────────────────────────────────────
          Sticky and in normal flow, not floating: a floating button sits on
          the page's own <h1>, which is the bug AdminSidebar's top bar records.
          z-40 matches the bottom bar; the drawer below is z-50 so it covers
          both. h-14 is the row; the safe-area inset is padding ABOVE it. */}
      <div
        data-sales-topbar
        className="lg:hidden sticky top-0 z-40 pt-[env(safe-area-inset-top)] border-b border-border bg-card/85 supports-[backdrop-filter]:bg-card/70 backdrop-blur-xl"
      >
        <div className="h-14 flex items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("app.sidebar.openMenu")}
            aria-expanded={open}
            data-tour-open="sales-nav"
            // 44px: this is the button every drawer screen is reached through.
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 rounded-lg text-foreground hover:bg-muted"
          >
            <Menu size={20} />
          </button>
          {/* The wordmark links to Today, the way /app's logo links to /app —
              so the front door is one tap from any screen even though the bar
              below also carries it. */}
          <Link
            href="/sales"
            className="inline-flex items-center gap-2 min-h-[44px] min-w-0"
          >
            <BadgeDollarSign size={16} className="text-brand-accent-text shrink-0" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent-text">
              {t("app.salesPortal.title")}
            </span>
          </Link>
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────────────────
          Fixed, full width, one row of --fq-tab-bar-row plus the safe-area
          inset as padding BELOW it. SalesShell's <main> reserves the same two
          numbers through --fq-tab-bar-height (set by .fq-sales-shell in
          app/globals.css), so the last line of every screen clears the bar. */}
      <nav
        data-sales-tabbar
        aria-label={t("app.salesPortal.title")}
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/85 supports-[backdrop-filter]:bg-card/70 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="h-[var(--fq-tab-bar-row)] flex items-stretch justify-center">
          {bar.map((tab) => {
            const active = isActiveTab(pathname, tab.href);
            const Icon = ICONS[tab.href] || ListTodo;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                // The same anchor the desktop row carries, so the tour's
                // visibleTarget() finds whichever copy is on screen — this
                // one below lg, the header tab above it.
                data-sales-tour={tab.href}
                // flex-1 fills the bar evenly; max-w keeps five from
                // stretching into five giant buttons on a tablet held wide.
                className="flex-1 max-w-[7rem] min-w-0 flex items-center justify-center active:bg-muted transition-colors"
              >
                <span
                  // text-brand-accent-text is the darkened orange
                  // globals.css defines for text on --card (5.09:1 light,
                  // 6.49:1 dark); text-muted-foreground measures 6.46:1 /
                  // 7.78:1 there. Both numbers are the header's, on the
                  // same surface. Raw orange would be 3.13:1 and fail.
                  className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 min-h-[44px] min-w-[44px] justify-center ${
                    active
                      ? "text-brand-accent-text bg-brand-accent/10"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon size={20} className="shrink-0" />
                  {/* No truncate: a label that needs two lines gets two,
                      which is legible where a clipped one is not — the same
                      rule the desktop row states. leading-tight keeps two
                      lines inside the 4rem row. */}
                  <span className="text-[10px] font-semibold leading-tight text-center break-words max-w-[4.5rem]">
                    {tab.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Drawer ─────────────────────────────────────────────────────────
          Everything the bar does not carry, in the shell's order, plus who is
          signed in and the way out. z-50: above both bars. The tour's card is
          z-[60] so it can sit beside a row in here; IncomingCallDock is
          z-[70] so a contractor ringing back still covers everything. */}
      {open ? (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 h-full w-[min(20rem,86vw)] max-w-[86vw] bg-card text-foreground shadow-2xl flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
            aria-label={t("app.salesPortal.title")}
          >
            <div className="h-14 flex items-center justify-between gap-2 px-3 border-b border-border">
              <span className="inline-flex items-center gap-2 min-w-0">
                <BadgeDollarSign size={16} className="text-brand-accent-text shrink-0" />
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent-text">
                  {t("app.salesPortal.title")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("app.sidebar.closeMenu")}
                // How the tour puts the drawer back when it moves on.
                data-tour-close="sales-nav"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-2">
              {drawer.map((tab) => {
                const active = isActiveTab(pathname, tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    data-sales-tour={tab.href}
                    className={`flex items-center min-h-[44px] px-4 py-2 text-sm font-medium border-l-2 ${
                      active
                        ? "border-brand-accent text-foreground bg-muted"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border px-4 py-3 space-y-2">
              {name ? (
                <p className="text-sm text-muted-foreground break-words">
                  {t("app.salesPortal.signedInAs", { name })}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <LogOut size={14} />
                {t("app.salesPortal.signOut")}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
