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

import { useState } from "react";
import {
  AlertTriangle, Check, Clock, EyeOff, MessageSquare, StickyNote,
  Paperclip, Film, Mic, FileText, Loader2, X,
} from "lucide-react";
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
import { attachmentTypeKey } from "@/lib/messaging/attachments";

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
export function Bubble({ message, bubbles, note, onRetryAttachment, t }) {
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
          {/* The pictures themselves, not a count of them. This used to render
              "1 attachment" for a homeowner's photo of their kitchen, which is
              the most-used half of a messaging channel described rather than
              shown. See Attachments below for the four states. */}
          <Attachments message={message} onRetry={onRetryAttachment} t={t} />
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
 * The pictures on one message.
 *
 * ══ Why this is one renderer for three platforms ═══════════════════════════
 *
 * Because a photo of a kitchen is a photo of a kitchen. WhatsApp hands the
 * webhook a media id with no bytes; Messenger and Instagram hand it a signed
 * CDN link that expires. Both are re-hosted to Cloudinary out of band
 * (lib/messaging/mediaFetch.js), and by the time anything reaches here the
 * only question left is which of four STATES an entry is in — never which
 * network it came from. A renderer that asked the platform would have three
 * paths and two of them untested.
 *
 * ══ The four states, and why none of them is "nothing" ═════════════════════
 *
 *   ready        the picture. Tappable, opens full size in a new tab.
 *   pending      "still arriving". NOT an <img> with a null src, which renders
 *                as a broken-image glyph and reads as a photo we lost — and
 *                NOT silence, which reads as a message that had no photo.
 *   failed       the reason, in full, and a way to try again. A photo that
 *                silently vanished is the failure this repo cares most about,
 *                so the one thing this must never do is stop mentioning it.
 *   unavailable  a location share, a Messenger "fallback": named, with no
 *                Retry, because a retry for something that was never
 *                fetchable is a dead control.
 *
 * ══ Colour ═════════════════════════════════════════════════════════════════
 *
 * Everything here inherits `currentColor` from the bubble. An outbound bubble
 * is painted in two hex values the SERVER measured against the company's brand
 * colour (lib/messaging/bubbleTheme.js); dropping a theme token like
 * `text-muted-foreground` onto it would put an unmeasured pair on a surface
 * whose whole point is that its pair was measured. Nothing below introduces a
 * colour, and the opacity that used to dim the old "1 attachment" line is gone
 * — this is the substance of the message now, not a footnote to it.
 */
export function Attachments({ message, onRetry, t }) {
  const list = Array.isArray(message?.attachments) ? message.attachments : [];
  if (!list.length) return null;
  return (
    <span className="mt-2 block space-y-1.5">
      {list.map((attachment, i) => (
        <AttachmentItem
          key={`${message.id}:${attachment.index ?? i}`}
          messageId={message.id}
          attachment={attachment}
          onRetry={onRetry}
          t={t}
        />
      ))}
    </span>
  );
}

/** The glyph for a kind of file. An icon AND the word, for the same reason
 *  PlatformBadge draws both: two grey glyphs are not a distinction. */
function AttachmentIcon({ type, size = 14 }) {
  const Glyph =
    type === "video" ? Film : type === "audio" ? Mic : type === "document" ? FileText : Paperclip;
  return <Glyph size={size} className="shrink-0" aria-hidden="true" />;
}

function AttachmentItem({ messageId, attachment, onRetry, t }) {
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState("");

  const typeLabel = t(attachmentTypeKey(attachment.type));
  // The filename when there is one, the kind when there is not. Never a
  // Cloudinary id: a row reading "kx91v2zt" tells a contractor nothing.
  const label = attachment.filename || typeLabel;

  if (attachment.state === "ready" && attachment.type === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        // A 44px minimum even though the thumbnail is far taller: the rule is
        // about the TARGET, and a one-line landscape crop on a narrow phone
        // can fall under it.
        className="block min-h-[44px] overflow-hidden rounded-lg"
        aria-label={t("app.messages.media.open", { name: label })}
      >
        {/* max-h rather than a fixed box: a portrait phone photo and a
            landscape one both have to fit a bubble that is at most 85% of a
            375px screen, and object-cover on a fixed height would crop the
            thing the homeowner was pointing at. */}
        <img
          src={attachment.url}
          alt={label}
          className="max-h-64 w-auto max-w-full rounded-lg"
        />
      </a>
    );
  }

  if (attachment.state === "ready") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-[44px] items-center gap-2 rounded-lg border border-current px-2.5 py-2 text-xs font-medium"
      >
        <AttachmentIcon type={attachment.type} />
        <span className="truncate">{label}</span>
      </a>
    );
  }

  if (attachment.state === "pending") {
    return (
      // Said out loud, with a moving spinner, because the honest answer here
      // is "not yet" and the alternatives are both lies: a broken image says
      // it is gone, and silence says it never existed.
      <span className="flex items-center gap-2 rounded-lg border border-current px-2.5 py-2 text-xs">
        <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden="true" />
        <span className="truncate">{t("app.messages.media.pending", { kind: typeLabel })}</span>
      </span>
    );
  }

  if (attachment.state === "failed") {
    return (
      <span className="block rounded-lg border border-current px-2.5 py-2 text-xs">
        <span className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">{t("app.messages.media.failed", { kind: typeLabel })}</span>
        </span>
        {/* Meta's own words, in full. A contractor who cannot see WHY has no
            way to tell "the file expired" from "the number needs
            reconnecting" — the same argument the failed-bubble reason makes. */}
        {attachment.error && <span className="mt-1 block">{attachment.error}</span>}
        {retryError && <span className="mt-1 block font-medium">{retryError}</span>}
        <button
          type="button"
          disabled={busy || !onRetry}
          onClick={async () => {
            setBusy(true);
            setRetryError("");
            try {
              const failure = await onRetry?.(messageId, attachment.index);
              // The verdict, on the bubble that asked for it. A Retry whose
              // result the person who pressed it never sees is the dead
              // control in its quietest form.
              if (failure) setRetryError(failure);
            } finally {
              setBusy(false);
            }
          }}
          className="mt-1.5 inline-flex min-h-[44px] items-center gap-1.5 font-semibold underline disabled:opacity-60"
        >
          {busy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
          {busy ? t("app.messages.media.retrying") : t("app.messages.media.retry")}
        </button>
      </span>
    );
  }

  // unavailable — named, and offered nothing, because there is nothing to
  // offer. A location share and a Messenger "fallback" both land here.
  return (
    <span className="flex items-center gap-2 rounded-lg border border-current px-2.5 py-2 text-xs">
      <AttachmentIcon type={attachment.type} />
      <span className="truncate">{t("app.messages.media.unavailable", { kind: typeLabel })}</span>
    </span>
  );
}

/**
 * The attach control, and what is waiting to go with the next message.
 *
 * ══ Why it is only on a WhatsApp thread ════════════════════════════════════
 *
 * Because that is the only platform this build can actually send a file on —
 * lib/messaging/send.js refuses `media` on Facebook and Instagram BY NAME, and
 * a paperclip that produced "this conversation is on Facebook" after a
 * contractor had picked a photo and watched it upload is the control that
 * appears to work. The refusal in the send path is the guard that survives;
 * this is the courtesy that stops anybody meeting it.
 *
 * The file is uploaded the moment it is picked, not at Send: a driveway
 * connection takes real seconds, and a Send button that silently blocked on an
 * upload would look frozen. What is drawn here is the state of that upload,
 * with the server's own refusal on it when it fails.
 */
export function AttachControl({ supported, pending, uploading, errorText, onPick, onClear, accept, disabled, t }) {
  if (!supported) return null;

  if (pending) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-2 text-xs text-foreground">
        <AttachmentIcon type={pending.type} />
        <span className="min-w-0 flex-1 truncate">{pending.name}</span>
        <button
          type="button"
          onClick={onClear}
          aria-label={t("app.messages.media.remove")}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-card"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <label
        className={
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground " +
          (disabled || uploading ? "opacity-50" : "cursor-pointer hover:bg-muted")
        }
      >
        {uploading ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <Paperclip size={15} aria-hidden="true" />
        )}
        {uploading ? t("app.messages.media.attaching") : t("app.messages.media.attach")}
        <input
          type="file"
          className="sr-only"
          // The types WhatsApp will actually take, from the one table that
          // knows them — a picker offering a format the send refuses is the
          // dead control with a file dialog in front of it.
          accept={accept}
          disabled={disabled || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so picking the SAME file twice still fires a change
            // event — otherwise a contractor who dismissed an error and
            // re-picked the photo would get nothing at all.
            e.target.value = "";
            if (file) onPick(file);
          }}
        />
      </label>
      {errorText && (
        // The server's sentence, naming WhatsApp's real limit. Not "upload
        // failed" — the point of reading Meta's published table is to be able
        // to say "pictures up to 5 MB" instead.
        <p className="mt-1 text-xs text-destructive">{errorText}</p>
      )}
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

/**
 * WhatsApp's 24-hour customer service window, said out loud.
 *
 * ── Why this is a banner and not only a disabled box ──────────────────────
 *
 * Because it is the one blocker on this screen that is NOT FieldQuo's fault,
 * NOT Meta's approval, and NOT permanent — it is a clock, it closes on its own,
 * and it reopens the moment the customer writes again. A greyed-out composer
 * with "cannot send" on it would read as the feature being broken. What a
 * contractor needs is the rule, the time, and the way through.
 *
 * Three states, and all three are drawn:
 *
 *   closing soon  open, under an hour left. A warning, not a block — the state
 *                 in which a contractor most needs to be told BEFORE they
 *                 start typing a long answer.
 *   closed        24 hours have passed. Free text is refused; a template is
 *                 offered.
 *   never opened  this person has never written. Same refusal, different
 *                 sentence, because "wait for them to reply" is not the advice
 *                 in a conversation that has not started.
 *
 * `notice` comes from the SERVER (lib/messaging/serviceWindow.js, through the
 * thread route) rather than being computed here from a timestamp. The browser
 * computing it would be a second answer, in a second clock, and the one that
 * disagrees with the refusal the send is about to get.
 */
export function ServiceWindowNotice({ notice, t }) {
  if (!notice) return null;
  const key = notice.blockKey || notice.warnKey;
  if (!key) return null;

  const blocked = Boolean(notice.blockKey);
  return (
    <p
      // Neither tone uses colour alone to carry the difference: the icon and
      // the words say it, and the border does the quiet half. A contractor in
      // a van in sunlight is the reader here.
      className={
        "mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs " +
        (blocked
          ? "border-destructive bg-card text-foreground"
          : "border-border bg-muted text-muted-foreground")
      }
    >
      {blocked ? (
        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <Clock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      {/* No parameters. `closingSoon` only ever fires with under an hour left
          (serviceWindowNotice sets it at hours < 1), so "less than an hour" is
          the whole sentence — a "{hours} hours left" that could only ever say
          "0" would be worse than the words. */}
      <span>{t(key)}</span>
    </p>
  );
}

/**
 * Pick one of the templates Meta approved, and fill it in.
 *
 * Shown only when the window is closed, because that is the only time it is
 * the answer. An always-visible template picker would invite a contractor to
 * send a pre-approved marketing message into a live conversation, which is
 * both worse writing and, for a MARKETING template, a charge.
 *
 * A company with a connected number and NO approved templates gets a sentence
 * saying so, not an empty select. An empty control with nothing in it is the
 * dead control AGENTS.md's first rule forbids, and here the honest version
 * ("you have no approved templates yet") is also the actionable one.
 */
export function TemplatePicker({ templates, value, onPick, params, onParam, t }) {
  const list = Array.isArray(templates) ? templates : [];
  if (!list.length) {
    return (
      <p className="mb-2 text-xs text-muted-foreground">{t("app.messages.template.none")}</p>
    );
  }

  const chosen = list.find((x) => x.id === value) || null;

  return (
    <div className="mb-2 space-y-2">
      <label className="block text-xs">
        <span className="text-muted-foreground">{t("app.messages.template.label")}</span>
        <select
          value={value || ""}
          onChange={(e) => onPick(e.target.value || null)}
          // text-base, not text-sm: anything smaller makes iOS Safari zoom the
          // page the moment the select is focused.
          className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-card px-2 text-base text-foreground"
        >
          <option value="">{t("app.messages.template.choose")}</option>
          {list.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} ({x.language})
            </option>
          ))}
        </select>
      </label>

      {chosen && (
        <>
          {/* The APPROVED body, shown before it is sent. A picker listing names
              alone asks a contractor to send a message they cannot read. */}
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground">
            {chosen.body}
          </p>
          {Array.from({ length: chosen.variableCount }, (_, i) => (
            <label key={i} className="block text-xs">
              <span className="text-muted-foreground">
                {t("app.messages.template.value", { number: i + 1 })}
              </span>
              <input
                type="text"
                value={params[i] || ""}
                onChange={(e) => onParam(i, e.target.value)}
                className="mt-1 block min-h-[44px] w-full rounded-lg border border-border bg-background px-2 text-base text-foreground"
              />
            </label>
          ))}
        </>
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
