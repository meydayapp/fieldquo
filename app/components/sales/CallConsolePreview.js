// app/components/sales/CallConsolePreview.js
//
// A picture of the call console, shown where the console will be.
//
// ══ Why this is a picture and NOT a greyed-out console ════════════════════
//
// The owner opened an empty queue and said he should still see the console,
// "maybe in a greyed out". The need is right and the empty region was a real
// failure: a rep who has never had a prospect open has no idea the product can
// place a call, time it, mute it and take the write-up — the whole console is
// invisible until the moment they need it.
//
// But a greyed-out console is the one thing AGENTS.md opens by forbidding. A
// disabled Call button looks like a control having a bad day, so a rep presses
// it, presses it again, and concludes the product is broken — which is worse
// than the empty space it replaced, because the empty space at least did not
// lie about what it was.
//
// So this is neither. It is an EXAMPLE, labelled as one, built out of `div`s:
// there is not a single `button`, `input`, `select` or link in it, so there is
// nothing to press, nothing focusable, and nothing for a screen reader to
// announce as a control. `aria-hidden` and `pointer-events-none` say the same
// thing twice, the way the impersonation gate is written twice — hiding a
// control is not the same as there being no control, and here there is
// genuinely no control.
//
// The distinction a rep has to be able to make in one glance is "this is what
// it looks like when somebody is open" versus "this is broken". The caption
// carries that, the sample business name is obviously not a real prospect, and
// the whole block is dashed and dimmed the way every other `unknown` box on
// this surface is.
//
// ══ Kept honest ══════════════════════════════════════════════════════════
//
// The shapes are copied from CallPanel and they will drift. That is acceptable
// for a caption'd example in a way it would never be for a control — the worst
// case is a picture that is a version behind, not a button that does nothing.
// scripts/check-sales-lead-dial.mjs asserts the inertness, which is the part
// that must not drift.
"use client";

import { CalendarPlus, Mic, Phone, PhoneOff } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/** A button's shape, with nothing behind it. Never a `button` element. */
function Shape({ children, className = "" }) {
  return (
    <div
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold ${className}`}
    >
      {children}
    </div>
  );
}

export default function CallConsolePreview() {
  const { t } = useTranslation();
  const business = t("app.salesCall.previewBusiness");
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/60 p-3 space-y-3">
      {/* The caption and the closing sentence pass their English through as
          t()'s explicit fallback rather than relying on the catalogue alone.
          scripts/check-sales-lead-dial.mjs reads this file's RAW source for
          both sentences — they are what stops a picture of a Call button
          reading as a fault, and that assertion has to keep meaning something
          after the words moved into the catalogue. */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("app.salesCall.previewCaption", "An example — not a live call")}
      </p>

      {/* aria-hidden AND pointer-events-none AND no interactive elements. The
          picture is decorative; the sentence below it is what a screen reader
          should read. */}
      <div aria-hidden="true" className="pointer-events-none select-none opacity-60 space-y-3">
        {/* Who you would be on. */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{business}</p>
            <p className="text-xs text-muted-foreground tabular-nums">+1 613 555 0142</p>
          </div>
          <Shape className="bg-primary text-primary-foreground w-full">
            <Phone size={16} /> {t("app.salesCall.callName", { name: business })}
          </Shape>
          <Shape className="w-full border border-border text-foreground">
            <CalendarPlus size={16} /> {t("app.salesCall.scheduleCallback")}
          </Shape>
        </div>

        {/* While you are talking. */}
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              {t("app.salesCall.previewOnCall")}
            </p>
            <p className="text-xl font-mono tabular-nums text-emerald-900 dark:text-emerald-100">
              2:14
            </p>
          </div>
          <div className="flex gap-2">
            <Shape className="border border-emerald-400 text-emerald-900 dark:text-emerald-100 flex-1">
              <Mic size={16} /> {t("app.salesCall.mute")}
            </Shape>
            <Shape className="bg-red-600 text-white flex-1">
              <PhoneOff size={16} /> {t("app.salesCall.hangUp")}
            </Shape>
          </div>
        </div>

        {/* And what you owe afterwards. */}
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {t("app.salesCall.whatHappened")}
          </p>
          {/* An example of a disposition, not a disposition. The real list is
              the server's, and its VALUES are enum codes — nothing here is
              sent anywhere, so the words may be read in the rep's language. */}
          <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-h-[44px] text-sm text-muted-foreground flex items-center">
            {t("app.salesCall.previewDisposition")}
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground">
            {t("app.salesCall.previewNote")}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground break-words">
        {t(
          "app.salesCall.previewFooter",
          "That is the console, drawn here so you can see it before you need it. It appears in this same spot, live, the moment you have somebody open — nothing above is pressable, and nothing is switched off.",
        )}
      </p>
    </div>
  );
}
