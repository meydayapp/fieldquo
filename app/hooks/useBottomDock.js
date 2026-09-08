"use client";

// app/hooks/useBottomDock.js
//
// Tells the rest of the shell how tall this page's bottom action bar is.
//
// Every sticky Save / Send bar in /app calls this and hands the returned ref
// to its bar element. The bar's measured height is written to
// `--fq-dock-height` on <html>, which the floating launchers (Jennifer, Help),
// the error toast and the <main> padding all read — see the "bottom dock"
// section of app/globals.css for the whole rule. Nothing else writes that
// variable, and no bar positions a launcher itself.
//
// ── A callback ref, not a ref object ────────────────────────────────────────
//
// The obvious shape is `useBottomDock(ref)` with a `useEffect` that reads
// `ref.current`. It does not survive this codebase's pages: the links and
// availability screens render their bar only once data has loaded, so on the
// first effect run `ref.current` is null and nothing re-runs when the bar
// appears. A callback ref is invoked by React on the exact renders where the
// element attaches and detaches, which is the whole event of interest.
//
// ── A registry, not a single value ──────────────────────────────────────────
//
// Two docks can briefly coexist — a page bar and a bottom sheet's footer, or
// one bar unmounting on navigation while the next mounts. Writing "my height"
// on mount and "0" on unmount would let the departing bar zero out the
// arriving one. The variable is the tallest registered dock, recomputed on
// every change, and is removed outright once nothing is registered so a
// page with no bar reads the CSS default.
//
// ResizeObserver, because a bar's height is not fixed: the quote builder's
// bar grows when its status text wraps at 375px, and a "Saved" tick appears
// and disappears. A launcher positioned off a one-time measurement would sit
// on the bar again the moment it grew.

import { useCallback, useRef } from "react";

export const DOCK_HEIGHT_VAR = "--fq-dock-height";

const docks = new Map();

function publish() {
  const root = document.documentElement;
  if (docks.size === 0) {
    root.style.removeProperty(DOCK_HEIGHT_VAR);
    return;
  }
  const tallest = Math.max(...docks.values());
  root.style.setProperty(DOCK_HEIGHT_VAR, `${Math.ceil(tallest)}px`);
}

/**
 * Returns a ref callback. Attach it to the bar element that is fixed to the
 * bottom of the viewport; nothing else needs doing.
 *
 *   const dockRef = useBottomDock();
 *   <div ref={dockRef} className="fixed bottom-[var(--fq-tab-bar-height)] …">
 */
export function useBottomDock() {
  const cleanup = useRef(null);

  return useCallback((el) => {
    if (cleanup.current) {
      cleanup.current();
      cleanup.current = null;
    }
    if (!el) return;

    const measure = () => {
      docks.set(el, el.offsetHeight);
      publish();
    };
    measure();

    // Absent only in very old browsers and in test renderers; the one-time
    // measurement above is still right for a bar that never changes height.
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(el);

    cleanup.current = () => {
      observer?.disconnect();
      docks.delete(el);
      publish();
    };
  }, []);
}
