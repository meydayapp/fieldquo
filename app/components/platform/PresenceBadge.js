// app/components/platform/PresenceBadge.js
//
// The "Online now / Active 2 h ago / Signed in Sep 24" pill on the platform
// console's company list and company page, and the poll that keeps it true.
//
// The words come from lib/platform/companyPresence.js presenceBadge(), which
// is pure and tested; this file only draws them. Two tones, the sales reps
// page's two (presenceSentence): emerald for the one state that means a
// person is there right now, the console's ordinary muted pill for the rest.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { skewCorrectedNow } from "@/lib/platform/companyPresence";

const TONE = {
  // The same emerald pair the console's "active" status pill already uses.
  live: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  muted: "bg-muted text-muted-foreground border-border",
};

export default function PresenceBadge({ badge, size = "sm" }) {
  if (!badge) return null;
  const pad = size === "lg" ? "px-2.5 py-1" : "px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${pad} rounded-full border whitespace-nowrap ${TONE[badge.tone] || TONE.muted}`}
      title={badge.title}
    >
      {badge.tone === "live" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
      ) : null}
      {badge.text}
    </span>
  );
}

/** How often an open, visible console page re-reads presence. */
export const PRESENCE_POLL_MS = 60 * 1000;

/**
 * Fetch `url` now and every PRESENCE_POLL_MS while the page is visible, and
 * once more the moment it becomes visible again. Returns the last good body,
 * a skew-corrected `now` to render it against, and the last error (null once
 * a later poll succeeds).
 *
 * `now` ticks with each poll AND every 30 s between them, so "Online now"
 * turns into "Active 6 min ago" on an open screen without waiting for new
 * data — the badge ages the way the stamp does.
 */
export function usePresencePoll(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Couldn't load who is signed in.");
      const received = Date.now();
      offsetRef.current = skewCorrectedNow(json?.serverNow, received, received).getTime() - received;
      setData(json);
      setError("");
      setNow(new Date(Date.now() + offsetRef.current));
    } catch (err) {
      // Keep the last good answer on screen, and say it is stale.
      setError(err?.message || "Couldn't load who is signed in.");
    }
  }, [url]);

  useEffect(() => {
    load();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, PRESENCE_POLL_MS);
    const tick = setInterval(() => setNow(new Date(Date.now() + offsetRef.current)), 30 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  return { data, error, now, reload: load };
}
