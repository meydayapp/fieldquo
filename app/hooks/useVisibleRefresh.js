"use client";
// app/hooks/useVisibleRefresh.js
//
// Call `refresh` every `intervalMs` while the tab is visible, and once more
// the moment it becomes visible again.
//
// The same shape as app/sales/messages/useThreadRefresh.js, lifted out of the
// sales portal because the day board on /app/scheduler needs it too: the
// owner's rule is that a lunch punched on the time clock changes the board's
// colour "in real time", and a board that only notices on reload is not that.
// That file stays where it is — scripts/check-sales-messages.mjs pins it to
// one thread — and this one carries no key, so it is the generic form.
//
// ── Why it stops when the tab is hidden ────────────────────────────────────
//
// A dispatch board left open in a background tab all day is a GET every
// thirty seconds against a database that scales to zero and bills by the
// minute. A hidden tab is not being read; it re-reads the moment it is shown
// again, which is also the moment its colours could be stale.
import { useEffect, useRef } from "react";

/**
 * @param enabled     false stops the timer entirely (a view that does not
 *                    need it, or a load that already failed)
 * @param intervalMs  how often, while visible
 * @param refresh     what to call. Read through a ref so a new closure per
 *                    render does not reset the timer.
 */
export function useVisibleRefresh(enabled, intervalMs, refresh) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    const tick = () => {
      if (document.visibilityState === "visible") latest.current?.();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, intervalMs]);
}
