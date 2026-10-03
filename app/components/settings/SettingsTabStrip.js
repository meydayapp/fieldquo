// app/components/settings/SettingsTabStrip.js
//
// One row of page links across the top of a settings screen — Manage Team's
// Workers / Timesheets / Payroll / Compliance row, the HR screens' row — drawn
// exactly like the phone's section strip (SettingsPhoneNav), which uses the
// same chip class from here so the two cannot drift.
//
// Why this exists (2026-10-03): the team page drew its row as
// `flex gap-2` of `border rounded-full px-4 py-2` links. Nothing stopped a
// link shrinking, so on a phone the long labels wrapped onto two lines, and
// the flex row's default `align-items: stretch` pulled every one-line pill
// up to that height with its text pinned to the top — "too much space below
// the text". The HR row (TeamHrTabs) wrapped instead of scrolling. The owner
// pointed at Settings › Availability's strip as the one that is right, so
// that strip's chip is the one both now use: `shrink-0` + `whitespace-nowrap`
// keep each chip one line, `inline-flex items-center min-h-[44px]` centres
// the text in a 44px target, and the row scrolls sideways instead.
//
// Links, not role="tab". Each chip navigates to a different page; there is
// no tab panel on this one for it to control. Announcing "tab, 2 of 6" to a
// screen reader promises arrow-key switching and a panel that is not there.
// The current page is marked `aria-current="page"`, the same as the phone
// strip, inside a labelled <nav>.
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

// The chip. `focus-visible:outline-*` draws the global ring colour
// (globals.css sets outline-ring on everything) at a width a keyboard user
// can see; the strips pad by 4px so overflow-x-auto does not clip it.
export function settingsChipClass(active) {
  return `shrink-0 inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-3 text-xs font-semibold border focus-visible:outline-2 focus-visible:outline-offset-2 ${
    active
      ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary"
      : "text-muted-foreground border-border hover:bg-sidebar-panel-accent hover:text-foreground"
  }`;
}

// Scrolls the strip sideways — never the page — so the current chip is in
// view. A Compliance chip sitting past the right edge of a phone is a
// strip that does not say where you are. Sets scrollLeft directly rather
// than calling scrollIntoView, which would also scroll the page vertically.
export function useActiveChipInView(activeKey) {
  const ref = useRef(null);
  useEffect(() => {
    const strip = ref.current;
    const chip = strip?.querySelector('[aria-current="page"]');
    if (!strip || !chip) return;
    const s = strip.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (c.left >= s.left && c.right <= s.right) return;
    strip.scrollLeft += c.left - s.left - (s.width - c.width) / 2;
  }, [activeKey]);
  return ref;
}

/**
 * @param tabs   [{ key, href, label, attrs? }] — only the tabs this person
 *               may open; gating is the caller's, the strip draws what it is
 *               given. `attrs` carries data-* hooks through.
 * @param active the key of the page being viewed, or none on a hub page.
 * @param label  accessible name for the <nav>.
 */
export default function SettingsTabStrip({ tabs, active, label, className, ...rest }) {
  const ref = useActiveChipInView(active);
  if (!tabs.length) return null;
  return (
    <nav aria-label={label} className={className} {...rest}>
      <div ref={ref} className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 -mx-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active === tab.key ? "page" : undefined}
            className={settingsChipClass(active === tab.key)}
            {...tab.attrs}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
