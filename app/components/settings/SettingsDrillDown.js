// app/components/settings/SettingsDrillDown.js
//
// "Back to Company Settings", on a settings screen you reached by drilling into
// it from another settings screen — and on no other visit to that screen.
//
// ── Why this isn't just a parent link ───────────────────────────────────────
//
// Settings is a flat list of siblings, not a tree. /app/settings/services has
// no parent: it is a sidebar destination in its own right, and it is also where
// the "Manage" link under Company Settings > Enabled quote types lands you.
// A permanent "Back to Company Settings" on it would be a lie every time
// someone opened it from the sidebar — and a lie of the specific kind AGENTS.md
// bans, because it looks like a working control and takes you somewhere you
// have never been.
//
// ── So the bar renders from two facts, not one ──────────────────────────────
//
// 1. INTENT. The link that sent you says so: `SettingsDrillLink` records
//    "from /app/settings/company to /app/settings/services, and that page is
//    called Company Settings". An ordinary <Link> records nothing, which is why
//    clicking through the sidebar leaves no bar behind — the sidebar is still
//    on screen, so a back button there would be noise, not help.
//
// 2. WHAT ACTUALLY HAPPENED. The claim is only honoured if the browser then
//    made exactly that move: previous pathname === from, current === to. A
//    reload, a bookmark, a pasted URL, the browser's own back button, or a
//    middle-click into a new tab all produce no claim, and any navigation that
//    doesn't match clears the last one. So the bar cannot survive into a visit
//    it didn't cause.
//
// The state lives in the settings LAYOUT, which App Router keeps mounted across
// navigations between settings pages. That is what makes "the previous
// pathname" knowable at all; page-level state is gone by the time the next page
// renders, and `document.referrer` doesn't change on a client-side navigation,
// so neither could answer this.
//
// A full reload drops the record on purpose. After a refresh there was no
// in-session navigation to describe, and inventing one from sessionStorage
// would put the bar back on a page the user landed on cold.
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pathnameOf, resolveArrival } from "@/lib/settings/drillDown";
import { useTranslation } from "@/app/hooks/useTranslation";

const SettingsDrillDownContext = createContext(null);

export function SettingsDrillDownProvider({ children }) {
  const pathname = usePathname();
  // The confirmed arrival: { from, to, label }, or null.
  const [arrival, setArrival] = useState(null);
  // A pending claim from a link that was just clicked. A ref, not state: it is
  // written during a click and read in the effect after the navigation, and it
  // must not cause a render of its own.
  const claimRef = useRef(null);
  const previousPathRef = useRef(pathname);

  useEffect(() => {
    const previous = previousPathRef.current;
    if (previous === pathname) return; // first mount, or a re-render
    previousPathRef.current = pathname;

    const claim = claimRef.current;
    claimRef.current = null;

    setArrival(resolveArrival({ claim, previous, current: pathname }));
  }, [pathname]);

  const claimDrillDown = useCallback((claim) => {
    claimRef.current = claim;
  }, []);

  const value = useMemo(
    () => ({
      // Re-checked against the live pathname: the effect that clears a stale
      // arrival runs after the new page has already rendered once.
      arrival: arrival && arrival.to === pathname ? arrival : null,
      claimDrillDown,
    }),
    [arrival, pathname, claimDrillDown],
  );

  return (
    <SettingsDrillDownContext.Provider value={value}>
      {children}
    </SettingsDrillDownContext.Provider>
  );
}

function useSettingsDrillDown() {
  return useContext(SettingsDrillDownContext);
}

/**
 * A link from one settings page into another, which entitles the destination
 * to a back bar naming this page.
 *
 * `fromLabel` is the name of the page holding the link — the destination has no
 * way to know what to call it, and the sidebar's own labels are being reviewed
 * separately, so the source states it.
 *
 * Outside the provider this degrades to a plain link rather than throwing.
 */
export function SettingsDrillLink({
  href,
  fromLabel,
  className,
  children,
  // Pulled out of `rest` deliberately: spread after our own handler it would
  // replace it, and the bar would never appear on any link that also wanted an
  // onClick of its own.
  onClick,
  ...rest
}) {
  const pathname = usePathname();
  const ctx = useSettingsDrillDown();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        // Modifier-clicks open a new tab: this tab doesn't navigate, so there
        // is no arrival to claim and the new tab is a cold landing.
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        ctx?.claimDrillDown({
          from: pathname,
          to: pathnameOf(href),
          label: fromLabel,
        });
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

/**
 * Rendered once, by the settings layout, above every settings page. Renders
 * nothing at all unless this visit was a confirmed drill-down.
 */
export function SettingsBackBar() {
  const { t } = useTranslation();
  const ctx = useSettingsDrillDown();
  const arrival = ctx?.arrival;

  if (!arrival) return null;

  return (
    // A full-width strip rather than something inside the page's own column:
    // settings pages centre themselves at several different max widths, and a
    // bar aligned to one of them sits visibly adrift on the others.
    <div className="border-b border-border/60 px-4 sm:px-6 py-2.5">
      <Link
        // The recorded origin, not history.back(): the label and the
        // destination are then guaranteed to be the same place, whatever else
        // has happened to the history stack since.
        href={arrival.from}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        {t("app.settings.backTo", { name: arrival.label })}
      </Link>
    </div>
  );
}
