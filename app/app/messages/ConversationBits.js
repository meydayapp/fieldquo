"use client";

// app/app/messages/ConversationBits.js
//
// The small pieces the inbox and the conversation pane both draw: initials
// avatar, platform badge, day separator, message bubble, outcome chips.
//
// ── Why they live here and not in app/components/ ─────────────────────────
//
// scripts/check-mobile-surfaces.mjs walks `app/app` and `app/components/mobile`
// — it does NOT walk the rest of app/components. Its own header says so and
// calls it a real remaining gap. Putting a chat bubble, a 44px chip row and a
// composer button behind that gap would mean the one screen in this feature
// most likely to be read on a phone is the one part of it nothing measures.
// So they sit under app/app, where the mobile rules apply to them.

import { AlertTriangle, Check, Clock, EyeOff, MessageSquare, StickyNote } from "lucide-react";
// lucide ships NO brand marks — `Facebook` and `Instagram` do not exist in it
// and the build says so. The bio-link page already needed these two and drew
// them as inline SVG; one set of glyphs, not two that drift apart.
import { SocialGlyph } from "@/app/components/links/linkIcons";
import {
  THREAD_OUTCOMES,
  THREAD_STATUSES,
  outcomeLabelKey,
  statusLabelKey,
} from "@/lib/messaging/outcomes";
import { activityLabel } from "@/lib/messaging/activity";
import { waitedLabel, isWaiting } from "@/lib/messaging/waiting";

/** Two letters from a name, or a dash when Meta gave us none. */
export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "–";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = "md" }) {
  const box = size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      aria-hidden="true"
      className={"shrink-0 rounded-full bg-accent text-foreground font-semibold grid place-items-center " + box}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Which network this conversation came in on. An icon AND the word: two
 * companies' worth of support calls in this repo have started with somebody
 * unable to tell two grey glyphs apart.
 */
export function PlatformBadge({ platform, t }) {
  if (!platform) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <SocialGlyph platform={platform} size={12} />
      {t("app.messages.platform." + platform)}
    </span>
  );
}

/**
 * The date rule above a run of messages.
 *
 * Today and yesterday get words; anything older gets the company's own date
 * format, so this screen and every other one agree about what a date looks
 * like.
 */
export function dayLabel(value, { t, formatDate }) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const today = startOf(new Date());
  const day = startOf(d);
  if (day === today) return t("app.messages.today");
  if (day === today - 86400000) return t("app.messages.yesterday");
  return formatDate(d);
}

/** hh:mm in the reader's own locale — a bubble timestamp, not a date. */
export function clockTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * One bubble.
 *
 * Inbound uses the app's own tokens so it flips correctly in dark mode.
 * Outbound uses the two literal hex values the SERVER measured against the
 * company's brand colour (lib/messaging/bubbleTheme.js) — never a guess, and
 * never "is it dark? use white", which fails on exactly the mid-tones
 * contractors pick.
 */
export function Bubble({ message, bubbles, note, t }) {
  // The two kinds of row that are NOT a message between two people. Handled
  // first and returned early, so nothing below — the brand fill, the delivery
  // tick, the "not delivered" warning — can ever be applied to one of them.
  if (message.direction === "activity") return <ActivityLine message={message} t={t} />;
  if (message.direction === "note") return <NoteBubble message={message} note={note} t={t} />;

  const out = message.direction === "out";
  const failed = Boolean(message.failedReason);

  const style = out && !failed && bubbles?.outbound
    ? { backgroundColor: bubbles.outbound.bg, color: bubbles.outbound.fg }
    : undefined;

  // A failed reply is NOT painted in the brand colour. It never reached the
  // homeowner, and dressing it identically to the ones that did is the whole
  // "appears to work" failure in one CSS rule.
  const tone = failed
    ? "bg-card border border-destructive text-foreground"
    : out
      ? ""
      : "bg-muted text-foreground";

  return (
    <div className={out ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div
          style={style}
          className={"rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words " + tone}
        >
          {message.body || ""}
          {Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <span className="block mt-1 text-xs opacity-80">
              {t("app.messages.attachment", { count: message.attachments.length })}
            </span>
          )}
        </div>
        <div className={"mt-1 flex items-center gap-1.5 text-xs text-muted-foreground " + (out ? "justify-end" : "")}>
          <span>{clockTime(message.sentAt)}</span>
          {failed && (
            <span className="inline-flex items-center gap-1 text-destructive font-medium">
              <AlertTriangle size={11} aria-hidden="true" />
              {t("app.messages.failed")}
            </span>
          )}
          {!failed && out && message.readAt && <Check size={12} aria-hidden="true" />}
        </div>
        {failed && message.failedReason && (
          // The reason, in full, on the bubble. A contractor who cannot see WHY
          // a message did not send has no way to tell "Meta is down" from "you
          // never connected a Page".
          <p className="mt-1 text-xs text-muted-foreground">{message.failedReason}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A private note, in the thread, styled so it can never be mistaken for a
 * message that went to the homeowner.
 *
 * Four separate signals say so at once, deliberately — colour alone is not
 * enough for the one control on this screen whose failure mode is a customer
 * reading what the company thinks of them:
 *
 *   1. a fixed amber wash that derives from nothing (lib/messaging/noteTheme.js
 *      — measured, and provably never the brand colour);
 *   2. a solid left edge in the same family, so the card has an outline even
 *      where the wash is nearly the card's own colour;
 *   3. the word, in a label, in the reader's own language;
 *   4. an eye-off icon.
 *
 * The colours arrive MEASURED from the server, exactly as the outbound
 * bubble's do, so scripts/check-messaging.mjs tests the values this paints
 * rather than a copy of them.
 */
export function NoteBubble({ message, note, t }) {
  const palette = note || {};
  const style = palette.bg
    ? {
        backgroundColor: palette.bg,
        color: palette.fg,
        borderColor: palette.border,
      }
    : undefined;

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div
          style={style}
          className="rounded-2xl border-l-4 border border-transparent px-3.5 py-2 text-sm whitespace-pre-wrap break-words"
        >
          <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
            <EyeOff size={12} aria-hidden="true" />
            {t("app.messages.note.label")}
          </span>
          {message.body || ""}
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {t("app.messages.note.onlyYourTeam")} · {clockTime(message.sentAt)}
        </p>
      </div>
    </div>
  );
}

/**
 * A system line: assigned, snoozed, quote linked.
 *
 * Centred, quiet, and NOT a bubble — it is not something anybody said. This is
 * the shape Chatwoot uses and the reason is legibility: the eye skips these
 * while reading the conversation and finds them when reading the story.
 *
 * Renders NOTHING for an activity this version does not recognise. A row
 * written by a newer deploy is silent rather than guessed at — see
 * lib/messaging/activity.js.
 */
export function ActivityLine({ message, t }) {
  const label = activityLabel(message.activity);
  if (!label) return null;
  return (
    <p className="px-4 text-center text-xs text-muted-foreground">
      {t(label.key, label.params)} · {clockTime(message.sentAt)}
    </p>
  );
}

/**
 * How long somebody has been waiting, on the list row.
 *
 * The whole reason MessageThread.waitingSince is a column: this sentence has
 * to be sayable NOW, on a list of two hundred, not once a month in a report.
 *
 * Draws nothing when nobody is waiting — a null is not a zero, and "waiting
 * 0 min" on an answered conversation would train people to ignore the badge.
 */
export function WaitingBadge({ thread, t, now }) {
  if (!isWaiting(thread)) return null;
  const label = waitedLabel(thread.waitingSince, now);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      <Clock size={11} aria-hidden="true" />
      {t("app.messages.waiting.for", { duration: t(label.key, label.params) })}
    </span>
  );
}

/**
 * The status filter chips above the inbox.
 *
 * All four states plus "everything", because a filter you cannot turn off is
 * a filter that eventually hides a conversation from somebody who has
 * forgotten it is on. The selected chip is pressed, not merely coloured, so a
 * screen reader gets the same fact the eye does.
 */
export function StatusFilter({ value, onPick, counts, t }) {
  const chip = (key, label, active) => (
    <button
      key={key || "all"}
      type="button"
      aria-pressed={active}
      onClick={() => onPick(key)}
      className={
        "min-h-[44px] shrink-0 rounded-full border px-3 text-sm font-medium " +
        (active
          ? "border-transparent bg-inverted text-inverted-foreground"
          : "border-border bg-card text-foreground hover:bg-muted")
      }
    >
      {label}
      {counts && Number.isFinite(counts[key || "all"]) ? ` (${counts[key || "all"]})` : ""}
    </button>
  );

  return (
    // Scrolls sideways rather than wrapping to two rows on a phone: five chips
    // at 44px each do not fit at 375px, and a wrapped second row pushes the
    // first conversation off the screen.
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {chip(null, t("app.messages.status.all"), !value)}
      {THREAD_STATUSES.map((s) => chip(s, t(statusLabelKey(s)), value === s))}
    </div>
  );
}

/**
 * The four states, on the conversation.
 *
 * Snoozing asks for a date, and the picker will not let it be saved without
 * one — a thread parked with no return date is a lead deleted with a friendly
 * label on it. That refusal lives in the route as well
 * (app/api/messaging/threads/[id]/route.js), because hiding a control is not
 * validation.
 */
export function StatusPicker({ value, snoozedUntil, onPick, busy, t }) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{t("app.messages.status.question")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {THREAD_STATUSES.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => onPick(s)}
              className={
                "min-h-[44px] rounded-full border px-4 text-sm font-medium disabled:opacity-50 " +
                (active
                  ? "border-transparent bg-inverted text-inverted-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {t(statusLabelKey(s))}
            </button>
          );
        })}
      </div>
      {value === "snoozed" && snoozedUntil && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("app.messages.status.snoozedUntil", {
            date: new Date(snoozedUntil).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Reply, or note.
 *
 * Two tabs and not a checkbox, because a checkbox reads as an option on the
 * thing you are about to do and this is a choice between two different things.
 * The note tab carries the note's own measured colours, so the composer LOOKS
 * like what it is about to write before a single word is typed — which is the
 * moment the mistake would otherwise be made.
 */
export function ComposerTabs({ mode, onPick, note, disabledReplyKey, t }) {
  const tab = (key, label, Icon, active) => {
    const noteStyle = key === "note" && active && note?.bg
      ? { backgroundColor: note.bg, color: note.fg, borderColor: note.border }
      : undefined;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={active}
        onClick={() => onPick(key)}
        style={noteStyle}
        className={
          "min-h-[44px] inline-flex items-center gap-1.5 rounded-full border px-3 text-sm font-semibold " +
          (active
            ? key === "note"
              ? "border"
              : "border-transparent bg-inverted text-inverted-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted")
        }
      >
        <Icon size={14} aria-hidden="true" />
        {label}
      </button>
    );
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {tab("reply", t("app.messages.compose.tabReply"), MessageSquare, mode === "reply")}
      {tab("note", t("app.messages.compose.tabNote"), StickyNote, mode === "note")}
      {/* The reason the Reply side is off, printed beside the tabs rather than
          only under them — a contractor who can still write a NOTE needs to see
          that it is the reply, and only the reply, that is blocked. */}
      {mode === "reply" && disabledReplyKey && (
        <span className="text-xs text-muted-foreground">{t(disabledReplyKey)}</span>
      )}
      {mode === "note" && (
        <span className="text-xs text-muted-foreground">{t("app.messages.note.hint")}</span>
      )}
    </div>
  );
}

/** Who owns this conversation. Names come from /api/leads/assignees. */
export function AssigneePicker({ value, people, onPick, busy, t }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{t("app.messages.assignee.label")}</span>
      <select
        value={value || ""}
        disabled={busy}
        onChange={(e) => onPick(e.target.value || null)}
        // text-base, not text-sm: anything smaller makes iOS Safari zoom the
        // page the moment the select is focused.
        className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-card px-2 text-base text-foreground disabled:opacity-50"
      >
        <option value="">{t("app.messages.assignee.nobody")}</option>
        {(people || []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * "Did this become a job?" — the control the month-end review is built on.
 *
 * Chips rather than a dropdown: four options, one tap, 44px targets, and the
 * current answer visible without opening anything. The selected chip can be
 * tapped again to clear it, because an outcome set by mistake must be
 * removable — and a cleared outcome goes back to "nobody has said", never to
 * "lost".
 */
export function OutcomePicker({ value, onPick, busy, t }) {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{t("app.messages.outcome.question")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {THREAD_OUTCOMES.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => onPick(active ? null : o)}
              className={
                "min-h-[44px] rounded-full border px-4 text-sm font-medium disabled:opacity-50 " +
                (active
                  ? "border-transparent bg-inverted text-inverted-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted")
              }
            >
              {t(outcomeLabelKey(o))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
