// app/app/settings/voice/AnswerSwitch.js
//
// The receptionist's on/off switch, and the status bar that carries it.
//
// ── Why these left page.js ─────────────────────────────────────────────────
//
// Two reasons, and the second is the real one.
//
// The switch renders in two places now — the status bar at the top of the page
// and step 4, where the explanation lives — and two copies of a control whose
// disabled rule is `busy || (!enabled && !canEnable)` is the copy-that-rots
// failure by construction: the copy nobody looks at is the one still letting
// people press it after the rule moves.
//
// And a 3,500-line page.js could not be render-tested at the component level at
// all. Everything in it was a private function of one module whose default
// export fetches on mount, so the only way to exercise the switch was to click
// it. Here it is three props and a handler, and scripts/check-voice-answer.mjs
// renders every state it can be in — including the one that matters most, a
// company that is NOT set up yet and must not be offered a switch that does
// nothing.
"use client";

import { Headset, Loader2 } from "lucide-react";

/**
 * The one control this whole page exists to reach: does the phone answer?
 *
 * ── Why it is a component and not two buttons ──────────────────────────────
 *
 * It renders twice — in the status bar at the top of the page and in step 4,
 * where the explanation lives. Two copies of a button whose disabled rule is
 * `busy || (!enabled && !canEnable)` is precisely the copy-that-rots failure:
 * the copy nobody looks at is the one that keeps letting people press it after
 * the rule changes. One component, so the two cannot disagree about whether
 * the phone is answering or whether it may be switched.
 *
 * ── Why it renders twice at all ────────────────────────────────────────────
 *
 * The page is a seven-step setup, numbered, and the order is right for setting
 * up. It is wrong for everyone after that: this switch sat below three
 * configuration cards, so an owner who wanted to know whether an AI was
 * currently picking up their business line had to scroll past the greeting
 * editor to find out, and an owner who wanted it OFF NOW had to scroll there
 * to do it. Summary before detail; the detail keeps its place.
 *
 * `compact` is the status-bar size. Same element, same handler, same disabled
 * rule — only the padding differs.
 */
export function AnswerSwitch({ enabled, canEnable, busy, t, onToggle, compact = false }) {
  return (
    <button
      type="button"
      disabled={busy || (!enabled && !canEnable)}
      onClick={onToggle}
      // aria-pressed, not just colour: the label already says which state it is
      // in, and this says it to a screen reader as a toggle rather than as two
      // unrelated buttons that happen to swap text.
      aria-pressed={enabled}
      className={`inline-flex items-center gap-2 rounded-full font-bold disabled:opacity-40 ${
        compact ? "px-4 py-2 text-xs" : "px-6 py-3 text-sm"
      } ${enabled ? "bg-emerald-600 text-white" : "bg-inverted text-inverted-foreground"}`}
    >
      {busy ? (
        <Loader2 size={compact ? 14 : 16} className="animate-spin" />
      ) : (
        <Headset size={compact ? 14 : 16} />
      )}
      {enabled
        ? t("app.setVoice.answerOn", "It's answering — turn off")
        : t("app.setVoice.answerOff", "Start answering calls")}
    </button>
  );
}

/**
 * Is the phone answering, right now — above everything else on the page.
 *
 * ── State in form, not only in colour ──────────────────────────────────────
 *
 * The dot is emerald / muted / amber, and that is the SECOND signal, never the
 * only one: the button beside it says "It's answering — turn off" or "Start
 * answering calls" in words, and when neither is possible the bar carries the
 * server's own sentence naming the one thing still missing. A contractor who
 * cannot distinguish the dots reads exactly the same answer.
 *
 * ── No button when there is nothing to press ───────────────────────────────
 *
 * Not set up yet means no switch at all here, only the reason. A disabled
 * toggle in a status bar reads as "it's off" when the truth is "it can't be
 * turned on yet", and those are different problems with different fixes. The
 * step-4 card still shows the disabled control in its setup context, where the
 * hint above it explains what is missing.
 *
 * ── Sticky from lg only ────────────────────────────────────────────────────
 *
 * Below lg there are already two stacked sticky bars above this — AdminSidebar
 * at top-0 h-14 and SettingsSidebar at top-14, whose height is a chip scroller
 * and not fixed. A third would need an offset that no single number can be
 * right about, so on a phone this simply sits first in the page instead. It is
 * still the first thing read, which was the actual complaint.
 */
export function VoiceStatusBar({ enabled, canEnable, number, readyMessage, busy, t, onToggle }) {
  const dot = enabled
    ? "bg-emerald-500"
    : canEnable
      ? "bg-muted-foreground"
      : "bg-amber-500";

  return (
    <div className="lg:sticky lg:top-0 z-20 -mx-4 sm:-mx-6 lg:mx-0 px-4 sm:px-6 lg:px-4 py-3 bg-card/95 supports-[backdrop-filter]:bg-card/80 backdrop-blur-xl border-y lg:border lg:rounded-xl border-border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
        {number && (
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {number.display}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {canEnable || enabled ? (
            <AnswerSwitch
              enabled={enabled}
              canEnable={canEnable}
              busy={busy}
              t={t}
              onToggle={onToggle}
              compact
            />
          ) : (
            <span className="text-xs text-muted-foreground">{readyMessage}</span>
          )}
        </div>
      </div>
    </div>
  );
}
