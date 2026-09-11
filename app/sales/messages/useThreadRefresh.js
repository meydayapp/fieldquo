"use client";
// app/sales/messages/useThreadRefresh.js
//
// Re-read the open conversation every so often while the tab is visible.
//
// ══ Why this is a separate file from page.js ══════════════════════════════
//
// page.js promises, in its header and in scripts/check-sales-messages.mjs,
// that it sets no interval and no timeout: nothing on that screen may send
// on its own, and the cheapest way to prove it is that the file has no
// timer at all. A chat client that never notices a reply until the rep
// presses something is not a chat client, though — so the ONE timer lives
// here, does exactly one thing, and is pinned by the same check to that one
// thing: it calls the caller's `refresh`, which GETs. This file never
// imports fetchJson and never names a route.
//
// ══ Why it stops when the tab is hidden ═══════════════════════════════════
//
// Fifty reps with the texts screen open in a background tab all day is
// fifty GETs every twenty seconds against a database that scales to zero
// and bills by the minute. A hidden tab is not being read; it re-reads the
// moment it is shown again.
import { useEffect, useRef } from "react";

/** Twenty seconds: quicker than a rep switching tabs, slower than a poll. */
export const THREAD_REFRESH_MS = 20 * 1000;

/**
 * @param key      the open thread's id; nothing runs while it is empty
 * @param refresh  called on each tick and on the tab becoming visible.
 *                 Read through a ref so a new closure per render does not
 *                 reset the timer.
 */
export function useThreadRefresh(key, refresh) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!key || typeof document === "undefined") return undefined;
    const tick = () => {
      if (document.visibilityState === "visible") latest.current?.();
    };
    const timer = setInterval(tick, THREAD_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [key]);
}
