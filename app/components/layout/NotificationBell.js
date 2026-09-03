// app/components/layout/NotificationBell.js
"use client";

// The bell, the unread count, and the feed itself.
//
// ── Where it lives, and why not in a page ──────────────────────────────────
//
// Mounted inside AdminSidebar — in the `lg:hidden` mobile top bar and in the
// desktop rail's own header — so it is on EVERY /app screen rather than being
// one more destination a contractor has to remember. The audit worried a bell
// placed only in the sidebar's mobile bar would vanish on detail screens
// because app/components/mobile/AppBar.js "replaces" it; that is not true today
// — AppBar has no callers anywhere in the codebase (grepped), so AdminSidebar's
// bar renders on every /app page below `lg`.
//
// ── Polling, and why not a socket ──────────────────────────────────────────
//
// Vercel serverless has no persistent process to hold a WebSocket, and SSE
// holds a function invocation open for its whole duration — billed wall-clock,
// for a back office where staff leave a tab open all day.
//
// So: a poll, in JenniferPanel.js's shape (a `cancelled` flag, `clearInterval`
// on cleanup) and GATED the way that panel's is, because an interval nobody
// needs is the expensive half. Two gates:
//
//   * The FIRST count costs no request at all. It is seeded from
//     /api/ui-state, which the app shell already calls on every load — the
//     precedent that route's own header sets ("a second endpoint would be a
//     second round trip on every page").
//   * The interval only runs while the tab is visible, and stops when it is
//     hidden. A phone in a pocket is the common state of this app, and polling
//     from it spends a contractor's data for a number nobody is looking at.
//
// 60s, not JenniferPanel's 5s. That panel is polling for a human colleague
// typing a reply; this is polling for something that happens a handful of times
// a day.
//
// ── No channel toggle is offered, deliberately ─────────────────────────────
//
// v1 delivers in-app and nothing else. There is no service worker, no
// `web-push` dependency and no VAPID key in the whole product, and iOS Safari
// can only subscribe to push from a web app added to the Home Screen — which
// this product never prompts for, so for an iPhone user on the default setup
// push cannot arrive at all. Not degraded: impossible. Offering a "Push
// notifications" switch would be a control that appears to work and doesn't,
// with the dead control being the permission prompt itself. So there is no
// switch here. Company-level email alerts keep their existing home at
// /app/settings/notifications.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import { noteKeysFor } from "@/lib/notifications/render";

const POLL_MS = 60000;

/** Money, only ever rendered from the `amount` the SERVER decided to send. */
function formatAmount(amount, currency) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)}`;
  }
}

export default function NotificationBell({ className = "" }) {
  const { t } = useTranslation();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = never loaded
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);

  // ── Seed from the shell's existing call ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/ui-state")
      .then((data) => {
        if (!cancelled) setUnread(Number(data?.notifications?.unread) || 0);
      })
      // Silent: the bell is chrome. A count that fails to load renders as "no
      // unread", which is what the badge shows anyway when there are none.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // ── The gated poll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;

    let cancelled = false;
    let id = null;

    const tick = async () => {
      // The panel does its own, richer fetch while it is open; a count poll
      // underneath it would be a second request for a number the list already
      // carries.
      if (document.hidden || open) return;
      try {
        const data = await fetchJson("/api/notifications?count=1");
        if (!cancelled) setUnread(Number(data?.unread) || 0);
      } catch {
        // Swallowed on purpose. A dropped poll on a bad connection in a
        // driveway must not put an error toast over the screen somebody is
        // working on; the next tick corrects it.
      }
    };

    const start = () => {
      if (id) return;
      id = setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (!id) return;
      clearInterval(id);
      id = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Catch up immediately on return, then resume. Waiting a full minute
        // after unlocking a phone is the moment the count is most wrong.
        tick();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson("/api/notifications?limit=20");
      setItems(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnread(Number(data?.unread) || 0);
    } catch (err) {
      // Named, not swallowed: the panel is open because somebody asked for it,
      // and an empty list that is really a failed request is the "empty vs
      // error" confusion this codebase has a check script about.
      setError(err?.message || t("app.notif.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Close on an outside click. Escape too — the panel covers the screen on a
  // phone and a hardware keyboard is not the only way people back out.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markAll() {
    // Optimistic, then corrected from the server's own count — the response
    // carries the real remaining number, so a concurrent arrival is not lost.
    try {
      const data = await fetchJson("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // `all: true` means "mine". There is deliberately no recipient in this
        // body — see the header of app/api/notifications/read/route.js.
        body: JSON.stringify({ all: true }),
      });
      setUnread(Number(data?.unread) || 0);
      setItems((prev) =>
        Array.isArray(prev)
          ? prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
          : prev,
      );
    } catch (err) {
      setError(err?.message || t("app.notif.markFailed"));
    }
  }

  async function markOne(id) {
    try {
      const data = await fetchJson("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setUnread(Number(data?.unread) || 0);
      setItems((prev) =>
        Array.isArray(prev)
          ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
          : prev,
      );
    } catch {
      // Not surfaced: the navigation the tap also triggers is the thing the
      // person wanted, and a toast over the page they just opened helps nobody.
    }
  }

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          unread > 0
            ? t("app.notif.openWithCount", { count: unread })
            : t("app.notif.open")
        }
        // 44px, the same floor AdminSidebar's own hamburger sets and for the
        // same reason: this is a control people hit one-handed on a phone.
        className="relative flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell size={20} />
        {unread > 0 && (
          // The one accent pair check-sidebar.mjs already proves clears the
          // 4.5:1 text floor against this rail in both themes. A plain red dot
          // with a number on it would be a new, unmeasured pairing.
          <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-sidebar-primary px-1 text-center text-[10px] font-bold leading-[18px] text-sidebar-primary-foreground">
            {badge}
          </span>
        )}
      </button>

      {open && (
        // ── 375px first ────────────────────────────────────────────────────
        //
        // On a phone this is a full-width sheet pinned under the bar
        // (`fixed inset-x-2`), not a dropdown hanging off a 44px button — a
        // 320px popover anchored to the right edge of a narrow bar is how a
        // feed ends up 200px wide with every line wrapped twice. Above `sm` it
        // becomes an ordinary anchored panel.
        //
        // max-h with overflow-y-auto rather than a fixed height: the list is
        // between zero and twenty rows and a fixed-height box is either mostly
        // empty or clipped.
        <div
          className="fixed inset-x-2 top-16 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-background text-foreground shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]"
          role="dialog"
          aria-label={t("app.notif.title")}
        >
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-3">
            <h2 className="text-sm font-semibold">{t("app.notif.title")}</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Check size={14} />
                {t("app.notif.markAllRead")}
              </button>
            )}
          </div>

          {loading && items === null && (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              {t("app.notif.loading")}
            </div>
          )}

          {/* Error and empty are different states and say different things —
              "nothing has happened" and "we could not find out" must never
              render the same box. */}
          {error && (
            <div className="px-4 py-6 text-sm text-destructive">{error}</div>
          )}

          {!error && items?.length === 0 && (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              {t("app.notif.empty")}
            </div>
          )}

          {!error &&
            items?.map((n) => (
              <NotificationRow key={n.id} n={n} t={t} onOpen={() => markOne(n.id)} />
            ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ n, t, onOpen }) {
  const money = formatAmount(n.amount, n.currency);
  // The sentence is assembled HERE, from this reader's own catalogue, because
  // the stored row holds a type and parameters rather than English prose. See
  // the comment on NotificationEvent in prisma/schema.prisma.
  const text = t(`app.notif.type.${n.type}`, n.params || {});
  // The declared params the sentence itself does not interpolate — a refund vs
  // a chargeback, whether a balance is still owing, whether a leave request is
  // waiting on somebody. Resolved from keys here rather than composed on the
  // server, so this line is in the reader's language too. Every param a type
  // declares is either in `text` above or in this line; the check script
  // asserts it, so a param can never be stored and rendered by nothing.
  const note = noteKeysFor(n).map((k) => t(k)).join(" · ");

  const body = (
    <>
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          n.readAt ? "bg-transparent" : "bg-primary"
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${n.readAt ? "text-muted-foreground" : "font-medium"}`}>
          {text}
        </span>
        {/* Money is rendered only when the SERVER sent a figure. A reader
            without showPricing never receives one — the amount is withheld at
            fan-out and again at read, so there is nothing here to redact. */}
        {money && (
          <span className="mt-0.5 block text-sm font-semibold tabular-nums">{money}</span>
        )}
        {note && <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {new Date(n.createdAt).toLocaleString()}
        </span>
      </span>
    </>
  );

  const rowClass =
    "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/50";

  // A row with no destination is text, never a link that goes nowhere.
  if (!n.href) {
    return (
      <button type="button" onClick={onOpen} className={rowClass}>
        {body}
      </button>
    );
  }
  return (
    <Link href={n.href} onClick={onOpen} className={rowClass}>
      {body}
    </Link>
  );
}
