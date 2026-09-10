// app/sales/messages/MessageThread.js
//
// The conversation, drawn the way a phone draws one.
//
// ══ Why this is not the <ul> it replaced ═══════════════════════════════════
//
// The old thread was a list of boxes, each with its own timestamp under it. It
// was correct and it read like a log file: four lines a rep typed in twenty
// seconds took four headers and four timestamps, and a reply from three days
// ago sat flush against one from this morning with nothing between them saying
// the day had changed.
//
// What makes a messenger a messenger is grouping — the sender named once per
// group, the timestamp belonging to the group rather than to every line, and a
// date heading where the day turns over. All of that arithmetic lives in
// lib/sales/messages/grouping.js, PURE, so it is executed by
// scripts/check-sales-messages.mjs rather than eyeballed at four messages. The
// rules are the ones every chat client has converged on; no source was copied
// from any of them.
//
// ══ Why this is a gutter and not two columns of bubbles ════════════════════
//
// The first version drew iMessage: rounded bubbles, ours pushed right, theirs
// pushed left. The owner had pointed at Rocket.Chat and asked for that, and
// bubbles are not what it does — a look at its RoomMessage variant settles it.
// Every row is LEFT ALIGNED and two columns: a fixed avatar gutter, then the
// content. The avatar, the name and the time are drawn ONLY on the first
// message of a group (`!sequential`), and on the grouped rows underneath, the
// gutter is deliberately kept — empty, or holding a status — so every line of
// a group starts at the same x.
//
// That alignment is the entire effect. Direction-aligned bubbles put the eye
// on a zig-zag; a single left column with one name at the top of each group
// puts it on the words, and a long thread stays scannable. Which matters more
// here than in a team chat: a rep is reading for what the contractor SAID, not
// for who is speaking, because there are only ever two of them.
//
// Read for its rules and its structure. No markup, class name or file was
// copied from it — it is separately licensed, and this is written in this
// codebase's own idiom.
//
// ══ Three states, and all three are real ═══════════════════════════════════
//
// SENT is a row the carrier accepted — the only kind lib/sales/salesSms.js
// writes. PENDING is the optimistic row this component holds while the request
// is in flight, and it is drawn differently because a message that has not
// left yet is not a message that has. FAILED is what pending becomes when the
// server refuses, and it carries the server's OWN sentence — the one that says
// "they opted out" or "outside their hours" — because a rewrite of it here
// would be a second opinion about a rule this screen does not own.
"use client";

import { useMemo } from "react";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { GROUPING_WINDOW_SECONDS, groupThread } from "@/lib/sales/messages/grouping";

const TIME = { hour: "numeric", minute: "2-digit" };

/**
 * Two letters for the gutter.
 *
 * Initials rather than a photograph because there is no photograph of a
 * contractor to have — and a generic silhouette in every row is a column of
 * grey circles carrying no information. "Northside Painting" gives NP, which
 * at a glance separates two businesses in a list better than the icon would.
 */
/**
 * The same two letters the thread's gutter draws, for the conversation LIST.
 *
 * Exported so the list and the thread cannot disagree about what somebody's
 * avatar says — the list used to show a raw E.164 and no avatar at all, which
 * is most of why it did not read as a messaging app.
 *
 * A conversation with no name falls back to the last two digits of the number.
 * Not "?" and not a generic glyph: the digits are the only true thing we know
 * about them, and they are enough to tell two threads apart at a glance.
 */
export function conversationInitials(conversation = {}) {
  const name = conversation.name || "";
  if (name.trim()) return initialsOf(name);
  const digits = String(conversation.e164 || "").replace(/\D/g, "");
  return digits ? digits.slice(-2) : "–";
}

function initialsOf(name) {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function timeLabel(at) {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, TIME);
}

/**
 * "Today", "Yesterday", or the date.
 *
 * Computed by comparing the divider's own day key against today's, rather than
 * by subtracting 24 hours: across a daylight-saving change a message sent 23
 * hours ago can be two calendar days back, and "Yesterday" over the wrong
 * heading is worse than a date.
 */
function dayLabel(dayKey, now = new Date()) {
  const key = (d) =>
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const today = key(now);
  const yesterday = key(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (dayKey === today) return "Today";
  if (dayKey === yesterday) return "Yesterday";
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(y === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * @param them  what to call the other side. The business name where we have
 *   one, otherwise the number — never "Prospect" or "Contact", which is a
 *   label for a person whose name we are choosing not to use.
 */
export default function MessageThread({ messages, them, onRetry = null, renderDraft = null }) {
  const rows = useMemo(
    () => groupThread(messages, { windowSeconds: GROUPING_WINDOW_SECONDS }),
    [messages],
  );

  if (!rows.length) {
    // Nothing invented to fill it. A thread with no messages is a true and
    // ordinary state and it says so in one sentence.
    return (
      <p className="text-sm text-muted-foreground break-words py-6 text-center">
        Nothing has been said yet.
      </p>
    );
  }

  return (
    // role="log" so a screen reader announces arrivals without the rep having
    // to go looking. aria-live="polite" rather than "assertive": a text is not
    // an interruption worth talking over whatever they are reading.
    <div className="space-y-1" role="log" aria-live="polite" aria-label={`Conversation with ${them}`}>
      {rows.map((row) => {
        if (row.kind === "day") {
          return (
            // Rocket.Chat's MessageDivider puts a <Bubble small secondary>
            // ON the rule rather than bare text between two hairlines — the
            // rule runs the full width and the pill sits over it. Checked
            // against MessageListItem.tsx, which is the only place that
            // renders a day divider: `<MessageDivider><Bubble small secondary>`.
            // Bare text was the closest I got by eye, and it is not the same
            // thing: the pill is what makes a date read as a marker on the
            // conversation rather than as a heading above a section.
            <div key={row.key} className="relative flex items-center justify-center pt-5 pb-3">
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
              <span className="relative rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {dayLabel(row.dayKey)}
              </span>
            </div>
          );
        }

        const m = row.item;

        // A draft is not speech. It is handed straight back to the caller,
        // which owns its controls — this component draws conversations, and a
        // send button inside the message renderer is how a draft becomes
        // indistinguishable from a message.
        if (m.kind === "draft") {
          return <div key={row.key}>{renderDraft ? renderDraft(m) : null}</div>;
        }

        const inbound = m.direction === "in";
        const failed = m.status === "failed";
        const pending = m.status === "pending";
        const who = inbound ? them : "You";

        return (
          <div
            key={row.key}
            data-own={inbound ? undefined : "true"}
            data-sequential={row.sequential ? "true" : undefined}
            className={`group flex gap-3 px-1 ${row.groupStart ? "pt-3" : "pt-0.5"} ${
              row.groupEnd ? "pb-1" : ""
            } hover:bg-muted/40 rounded-md`}
          >
            {/* ── The gutter ────────────────────────────────────────────────
                Always present, even when empty. It is what keeps every line of
                a group starting at the same x — take it away on the grouped
                rows and the text shifts left under its own heading, which is
                the one thing that makes a thread look broken. */}
            <div className="w-9 shrink-0 pt-0.5" aria-hidden="true">
              {row.showSender ? (
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                    inbound
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {initialsOf(who)}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              {/* Name and time ONCE per group, never on the lines beneath. */}
              {row.showSender ? (
                <p className="flex items-baseline gap-2 pb-0.5">
                  <span className="text-sm font-semibold text-foreground break-words">{who}</span>
                  {row.showTime && !row.undated ? (
                    <time
                      dateTime={new Date(m.at).toISOString()}
                      className="text-xs text-muted-foreground tabular-nums"
                    >
                      {timeLabel(m.at)}
                    </time>
                  ) : null}
                  {row.undated ? (
                    <span className="text-xs text-muted-foreground">time unknown</span>
                  ) : null}
                </p>
              ) : null}

              <p
                className={`whitespace-pre-wrap break-words text-sm ${
                  failed
                    ? "text-red-900 dark:text-red-200"
                    : pending
                      ? "text-muted-foreground"
                      : "text-foreground"
                }`}
              >
                {m.body}
              </p>

              {pending ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {/* motion-reduce: the spinner is the only moving thing on
                      this screen, and a rep who has asked their phone to stop
                      animating has asked for this too. */}
                  <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Sending…
                </p>
              ) : null}
            {failed ? (
              <div className="mt-1">
                <p className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300 break-words">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {/* The server's own sentence. It names the blocker and the
                      fix; a friendlier rewrite here would drop the fix. */}
                  <span>{m.error || "That did not send. Nothing went out."}</span>
                </p>
                {onRetry ? (
                  <button
                    type="button"
                    onClick={() => onRetry(m)}
                    className="mt-1 min-h-[44px] px-3 text-xs font-semibold text-red-700 dark:text-red-300 underline"
                  >
                    Put it back in the box
                  </button>
                ) : null}
              </div>
            ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The one-line "when is this aimed at" a draft shows.
 *
 * Exported from here rather than duplicated in the draft component because the
 * thread and the conversation list both show it, and two copies of a date
 * format is how one screen says "Thu 14:00" and the other "2/9, 2:00 p.m."
 */
export function scheduleLabel(at) {
  if (!at) return null;
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Clock size={12} aria-hidden="true" />
      {d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", ...TIME })}
    </span>
  );
}
