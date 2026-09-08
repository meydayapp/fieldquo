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

import { AlertTriangle, Check } from "lucide-react";
// lucide ships NO brand marks — `Facebook` and `Instagram` do not exist in it
// and the build says so. The bio-link page already needed these two and drew
// them as inline SVG; one set of glyphs, not two that drift apart.
import { SocialGlyph } from "@/app/components/links/linkIcons";
import { THREAD_OUTCOMES, outcomeLabelKey } from "@/lib/messaging/outcomes";

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
export function Bubble({ message, bubbles, t }) {
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
