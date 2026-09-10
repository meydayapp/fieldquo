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
            <div key={row.key} className="flex items-center gap-3 pt-4 pb-2">
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
              <span className="text-xs font-medium text-muted-foreground">{dayLabel(row.dayKey)}</span>
              <span className="h-px flex-1 bg-border" aria-hidden="true" />
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

        return (
          <div
            key={row.key}
            className={`flex flex-col ${inbound ? "items-start" : "items-end"} ${
              row.groupEnd ? "pb-2" : "pb-0.5"
            }`}
          >
            {row.showSender ? (
              <p className="px-1 pb-1 text-xs text-muted-foreground break-words">
                <span className="font-medium text-foreground">{inbound ? them : "FieldQuo sales line"}</span>
                {row.showTime && !row.undated ? (
                  <>
                    {" · "}
                    <time dateTime={new Date(m.at).toISOString()} className="tabular-nums">
                      {timeLabel(m.at)}
                    </time>
                  </>
                ) : null}
                {row.undated ? " · time unknown" : null}
              </p>
            ) : null}

            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                inbound
                  ? "bg-muted text-foreground rounded-bl-md"
                  : failed
                    ? "border border-red-400 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 rounded-br-md"
                    : "bg-primary text-primary-foreground rounded-br-md"
              } ${pending ? "opacity-70" : ""}`}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>

              {pending ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-primary-foreground/80">
                  {/* motion-reduce: the spinner is the only moving thing on
                      this screen, and a rep who has asked their phone to stop
                      animating has asked for this too. */}
                  <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Sending…
                </p>
              ) : null}
            </div>

            {failed ? (
              <div className="mt-1 max-w-[85%] text-right">
                <p className="flex items-start justify-end gap-1.5 text-xs text-red-700 dark:text-red-300 break-words">
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
