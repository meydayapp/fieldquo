"use client";
// app/hooks/useChatUnread.js
//
// The Chat tab's digit: { unread, mentions } from GET /api/chat/unread, or
// null while unknown.
//
// ══ One poll for the whole chrome ═════════════════════════════════════════
//
// The phone tab bar, the /app/me tab bar, the rail and the crew's big Chat
// button can all be mounted at once (each hides itself by breakpoint, not
// by unmounting). Three components polling the same route is three reads
// against a database that bills by the minute, so the poll lives at module
// level: the first subscriber starts it, the last one stops it, and every
// subscriber is handed the same answer.
//
// ══ When it reads ═════════════════════════════════════════════════════════
//
// Once a minute while the tab is visible — NotificationBell's cadence, for
// the same reason it gives — and at once when the tab comes back, and at
// once when a chat screen announces it moved lastSeenAt (lib/chat/badges.js),
// so opening a room clears the tab's digit now rather than a minute later.
//
// A failed read publishes null — no digit — rather than keeping the last
// number: a count the screen could not confirm is not shown as if it were
// current. The tab itself still works; it is the room list on /app/chat
// that is the record.
import { useEffect, useState } from "react";
import { chatApi } from "@/lib/company/chat/client";
import { onBadgesChanged } from "@/lib/chat/badges";

const POLL_MS = 60000;

let current = null;
const listeners = new Set();
let stopPoll = null;
let inflight = false;
let again = false;

function publish(value) {
  current = value;
  for (const fn of listeners) fn(value);
}

async function read() {
  if (typeof document !== "undefined" && document.hidden) return;
  // An announcement that lands mid-read must not be lost: read once more
  // after, so a room opened during a slow poll still clears the digit.
  if (inflight) {
    again = true;
    return;
  }
  inflight = true;
  try {
    const d = await chatApi.unread();
    publish({ unread: Math.max(0, Number(d?.unread) || 0), mentions: Math.max(0, Number(d?.mentions) || 0) });
  } catch {
    publish(null);
  } finally {
    inflight = false;
    if (again) {
      again = false;
      void read();
    }
  }
}

function startPoll() {
  void read();
  const timer = setInterval(read, POLL_MS);
  const offBadges = onBadgesChanged(read);
  const wake = () => {
    if (!document.hidden) void read();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  return () => {
    clearInterval(timer);
    offBadges();
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("focus", wake);
  };
}

/**
 * @param enabled  false when the caller draws no Chat entry (team_chat off,
 *                 or a bar without the tab) — it then neither subscribes nor
 *                 starts the poll, and gets null.
 */
export function useChatUnread(enabled = true) {
  const [value, setValue] = useState(current);
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    listeners.add(setValue);
    setValue(current);
    if (listeners.size === 1) stopPoll = startPoll();
    return () => {
      listeners.delete(setValue);
      if (listeners.size === 0 && stopPoll) {
        stopPoll();
        stopPoll = null;
      }
    };
  }, [enabled]);
  return enabled ? value : null;
}
