"use client";
// app/components/chat/Thread.js
//
// The middle pane: the conversation, drawn the way a chat client draws one.
//
// ══ Two columns, left aligned, one name per group ═════════════════════════
//
// Rocket.Chat's RoomMessage variant: every row is a fixed avatar gutter and
// then the content; avatar, name and time appear only on the first row of a
// group (`!sequential`); grouped rows keep the gutter — empty, or showing the
// time on hover — so every line of a group starts at the same x. Bubbles
// pushed left and right were tried first and rejected: they put the eye on a
// zig-zag, and a rep is reading for what was SAID.
//
// The arithmetic — which rows group, where the day turns, where the unread
// line sits — is lib/chat/threadLayout.js, pure, executed by
// scripts/check-chat-kit.mjs. This file only draws what it is handed.
//
// ══ Scroll behaviour ══════════════════════════════════════════════════════
//
// Pinned to the bottom while the reader is at the bottom; left alone while
// they have scrolled up to read, with a "New messages ↓" pill when something
// arrives underneath them — the rule every chat client converged on, and the
// one thing that stops a thread jumping out from under a rep mid-sentence.
// A sticky date bubble at the top of the scroll area names the day of the
// rows under the reader's eye, so a long thread scrolled to the middle still
// says when.
//
// Read for its rules and its structure. No markup, class name or file was
// copied from Rocket.Chat, which is separately licensed.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { ROW_DAY, ROW_UNREAD, dayLabelKind } from "@/lib/chat/threadLayout";
import Avatar, { initialsOf } from "./Avatar";

const TIME = { hour: "numeric", minute: "2-digit" };

function timeLabel(at) {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, TIME);
}

/** The words on a day divider, from the decision threadLayout made. */
export function dayLabel(dayKey, t, now = new Date()) {
  const kind = dayLabelKind(dayKey, { now });
  if (kind.kind === "today") return t("app.chat.today");
  if (kind.kind === "yesterday") return t("app.chat.yesterday");
  if (!kind.date) return String(dayKey || "");
  return kind.date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(kind.sameYear ? {} : { year: "numeric" }),
  });
}

/** The pill on the rule. Exported so a sticky copy and the inline one match. */
export function DayBubble({ children, className = "" }) {
  return (
    <span
      className={`rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * @param rows        layoutThread() output
 * @param them        what to call the other side — a name or a number, never
 *                    "Contact"
 * @param meLabel     what to call the reader's own side (defaults to "You")
 * @param renderDraft(item)   a draft row is handed straight back; the caller
 *                    owns its controls
 * @param renderSystem(item)  optional: a custom system row. The default
 *                    draws `item.body` in italics with its time.
 * @param renderBody(item)    optional: a custom BODY for a message row —
 *                    the text plus whatever rode with it (a photo, a voice
 *                    note, a private-note wash). The gutter, the sender
 *                    line, the pending / failed states and the hover
 *                    toolbar are still the kit's; only the words' box is
 *                    the caller's. Returning null falls back to the default.
 * @param hoverActions(item)  optional: a node for the hover toolbar on a
 *                    message row (copy, retry, …)
 * @param onRetry(item)  for failed rows — puts the words back in the box
 * @param initialsFor(item)  optional: initials for an inbound row (a room
 *                    with many authors); defaults to `them`
 * @param empty       node for a thread with nothing in it
 * @param loading     draw a spinner instead of rows
 */
export default function Thread({
  rows,
  them,
  meLabel = null,
  renderDraft = null,
  renderSystem = null,
  renderBody = null,
  hoverActions = null,
  onRetry = null,
  initialsFor = null,
  empty = null,
  loading = false,
  ariaLabel = "",
  className = "",
}) {
  const { t } = useTranslation();
  const scroller = useRef(null);
  const [atBottom, setAtBottom] = useState(true);
  const [pendingBelow, setPendingBelow] = useState(false);
  const [stickyDay, setStickyDay] = useState("");
  const lastCount = useRef(0);
  // A ref beside the state: the layout effect below runs before the state
  // from the last scroll event has settled, and pinning decisions made on a
  // stale "at bottom" are how a thread jumps out from under a reader.
  const atBottomRef = useRef(true);
  const me = meLabel || t("app.chat.you");

  const dayKeys = useMemo(() => rows.filter((r) => r.kind === ROW_DAY).map((r) => r.dayKey), [rows]);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    const bottom = gap < 24;
    atBottomRef.current = bottom;
    setAtBottom(bottom);
    if (bottom) setPendingBelow(false);

    // The sticky bubble names the last day divider that has scrolled past
    // the top edge. Nothing to show while the first divider is still on
    // screen — the inline pill is right there.
    let label = "";
    const dividers = el.querySelectorAll("[data-day-key]");
    for (const d of dividers) {
      if (d.offsetTop - el.scrollTop <= 8) label = d.getAttribute("data-day-label") || "";
      else break;
    }
    const first = dividers[0];
    if (first && first.offsetTop - el.scrollTop > -4) label = "";
    setStickyDay(label);
  }, []);

  const scrollToBottom = useCallback((behavior = "auto") => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // New rows: stay pinned if the reader was at the bottom, otherwise leave
  // them where they are and offer the pill. useLayoutEffect so the pin
  // happens before paint — a visible jump is the thing being avoided.
  useLayoutEffect(() => {
    const count = rows.length;
    const previous = lastCount.current;
    lastCount.current = count;
    if (count <= previous) return;
    // First paint of a thread lands at the bottom, where the newest row is;
    // after that, only a reader who is already there gets moved.
    if (previous === 0 || atBottomRef.current) {
      scrollToBottom("auto");
    } else {
      setPendingBelow(true);
    }
    measure();
  }, [rows.length, scrollToBottom, measure]);

  useEffect(() => {
    measure();
  }, [rows, measure]);

  if (loading) {
    return (
      <div className={`flex flex-1 items-center justify-center p-6 ${className}`}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />
          {t("app.chat.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative flex min-h-0 flex-1 flex-col ${className}`} data-chat-thread>
      {/* ── Sticky day bubble ─────────────────────────────────────────────── */}
      {stickyDay ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center" aria-hidden="true">
          <DayBubble>{stickyDay}</DayBubble>
        </div>
      ) : null}

      <div
        ref={scroller}
        onScroll={measure}
        role="log"
        aria-live="polite"
        aria-label={ariaLabel || t("app.chat.conversationWith", { them })}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        data-chat-scroller
      >
        {!rows.length ? (
          empty || <p className="py-10 text-center text-sm text-muted-foreground">{t("app.chat.emptyThread")}</p>
        ) : (
          rows.map((row) => {
            if (row.kind === ROW_DAY) {
              const label = dayLabel(row.dayKey, t);
              return (
                <div
                  key={row.key}
                  data-day-key={row.dayKey}
                  data-day-label={label}
                  className="relative flex items-center justify-center pt-5 pb-3"
                >
                  <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
                  <DayBubble className="relative">{label}</DayBubble>
                </div>
              );
            }

            if (row.kind === ROW_UNREAD) {
              // Rocket.Chat's MessageDivider with an `unreadLabel`: the rule
              // itself turns red and the label sits at its right end. Red
              // rather than the brand colour because it must read as a
              // marker, not as a heading, whatever the brand is.
              return (
                <div key={row.key} data-unread-divider className="flex items-center gap-2 py-2" role="separator">
                  <span className="h-px flex-1 bg-red-500" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                    {t("app.chat.unreadDivider")}
                  </span>
                </div>
              );
            }

            const m = row.item;

            if (m.kind === "draft") {
              return <div key={row.key}>{renderDraft ? renderDraft(m) : null}</div>;
            }

            if (row.system) {
              return (
                <div key={row.key} data-system-row className="flex gap-3 px-1 pt-2 pb-1">
                  <div className="w-9 shrink-0" aria-hidden="true" />
                  <p className="min-w-0 flex-1 text-xs italic text-muted-foreground break-words">
                    {renderSystem ? renderSystem(m) : m.body}
                    {m.at ? (
                      <>
                        {" "}
                        <time dateTime={new Date(m.at).toISOString()} className="not-italic tabular-nums">
                          {timeLabel(m.at)}
                        </time>
                      </>
                    ) : null}
                  </p>
                </div>
              );
            }

            const inbound = m.direction === "in" && !m.mine;
            const failed = m.status === "failed";
            const pending = m.status === "pending";
            const who = inbound ? m.who || them : m.who || me;
            const initials = inbound ? (initialsFor ? initialsFor(m) : initialsOf(who)) : initialsOf(who);
            const actions = hoverActions ? hoverActions(m) : null;

            return (
              <div
                key={row.key}
                data-own={inbound ? undefined : "true"}
                data-sequential={row.sequential ? "true" : undefined}
                data-unread={row.unread ? "true" : undefined}
                className={`group relative flex gap-3 rounded-md px-1 ${row.groupStart ? "pt-3" : "pt-0.5"} ${
                  row.groupEnd ? "pb-1" : ""
                } hover:bg-muted/40`}
              >
                {/* ── The gutter: avatar on the first row, the time on hover
                    for the rest. Always present so every line of a group
                    starts at the same x. */}
                <div className="w-9 shrink-0 pt-0.5 text-right" aria-hidden="true">
                  {row.showSender ? (
                    <Avatar initials={initials} tone={inbound ? "them" : "us"} />
                  ) : !row.undated ? (
                    <span className="hidden group-hover:inline text-[10px] leading-6 text-muted-foreground tabular-nums">
                      {timeLabel(m.at)}
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  {row.showSender ? (
                    <p className="flex items-baseline gap-2 pb-0.5">
                      <span className="text-sm font-semibold text-foreground break-words">{who}</span>
                      {row.showTime && !row.undated ? (
                        <time dateTime={new Date(m.at).toISOString()} className="text-xs text-muted-foreground tabular-nums">
                          {timeLabel(m.at)}
                        </time>
                      ) : null}
                      {row.undated ? (
                        <span className="text-xs text-muted-foreground">{t("app.chat.timeUnknown")}</span>
                      ) : null}
                    </p>
                  ) : null}

                  {(renderBody ? renderBody(m) : null) ?? (
                    <p
                      className={`whitespace-pre-wrap break-words text-sm ${
                        failed ? "text-red-900 dark:text-red-200" : pending ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {m.body}
                    </p>
                  )}

                  {pending ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      {t("app.chat.sending")}
                    </p>
                  ) : null}

                  {failed ? (
                    <div className="mt-1">
                      <p className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300 break-words">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {/* The server's own sentence. It names the blocker
                            and the fix; a friendlier rewrite would drop the
                            fix. */}
                        <span>{m.error || t("app.chat.sendFailed")}</span>
                      </p>
                      {onRetry ? (
                        <button
                          type="button"
                          onClick={() => onRetry(m)}
                          className="mt-1 min-h-[44px] px-3 text-xs font-semibold text-red-700 dark:text-red-300 underline"
                        >
                          {t("app.chat.retry")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* ── Hover toolbar slot ───────────────────────────────── */}
                {actions ? (
                  <div
                    data-hover-toolbar
                    className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border border-border bg-card p-0.5 shadow-sm group-hover:flex group-focus-within:flex"
                  >
                    {actions}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* ── "New messages" pill, only while scrolled up ─────────────────── */}
      {pendingBelow && !atBottom ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="pointer-events-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-md motion-reduce:transition-none"
            data-new-messages-pill
          >
            <ArrowDown size={14} aria-hidden="true" />
            {t("app.chat.newMessages")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
