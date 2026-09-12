// app/components/sales/DialerPad.js
//
// The number field and the keypad on the console's Dialer card.
//
// ══ What it is, and what it is not ════════════════════════════════════════
//
// The owner: "what if they need to type a phone number to reach the owner".
// So the field is editable and there is a 3×4 keypad under it, like the
// dialler in the reference he sent. What this component does NOT do is dial.
// It has no `tel:`, no Twilio, no request of its own. It holds a string and
// reports presses; the queue console decides what a typed number means:
//
//   * one of the record's stored numbers → dialled by its id, as before;
//   * anything else → saved on the CURRENT record first, through the same
//     route as "they gave us another number" (same normalisation, same
//     refusals), then dialled by the id that came back — through the same
//     gate as any stored number. Never a free-floating number.
//
// While a call is up the same keys send DTMF (the console feature-detects
// `sendDigits` on the live call); otherwise they type. One keypad, two
// meanings, and the console — not this file — knows which applies.
//
// The record's stored numbers are not listed here: the Company and Contact
// cards carry a Dial button beside each number, which pastes it into this
// display and presses Call. The keypad is for a number the rep is told.
"use client";

import { Delete, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { cleanDialInput, typedToE164 } from "@/lib/sales/typedNumber";

// Re-exported so the console imports its pre-check from the pad it belongs
// to; the module itself lives in lib so a check can run it under node.
export { typedToE164, cleanDialInput };

/** The twelve keys, in phone order. Letters are the ones a keypad carries. */
export const DIAL_KEYS = Object.freeze([
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["*", ""],
  ["0", "+"],
  ["#", ""],
]);

/**
 * @param value        the field's text
 * @param onChange     the field was typed into or cleared
 * @param onKey        a keypad key was pressed: ("5"). The console appends it
 *                     or sends it as DTMF — this file does not know which.
 * @param liveCall     true while a call is up — the keys are labelled as tones
 * @param disabled     do-not-contact: nothing here should invite a dial
 * @param error        the reason the last press was refused, under the field
 */
export default function DialerPad({
  value = "",
  onChange,
  onKey,
  liveCall = false,
  disabled = false,
  error = "",
  // One quiet line under the display when the number is not one the
  // record holds — the console composes it; this file prints it.
  typedNote = "",
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3" data-dialer-pad>
      {/* The display: the number in large type, × to clear. An input, so a
          rep can also type into it; styled as a phone's display. */}
      <label className="relative block">
        <span className="sr-only">{t("app.salesQueue.dialingLabel")}</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(cleanDialInput(e.target.value))}
          placeholder={t("app.salesQueue.dialFieldPlaceholder")}
          aria-label={t("app.salesQueue.dialingLabel")}
          aria-invalid={error ? "true" : undefined}
          className={`w-full rounded-xl border bg-muted px-4 pr-12 min-h-[64px] text-2xl font-semibold tabular-nums text-center text-foreground disabled:opacity-60 ${
            error ? "border-red-400" : "border-border"
          }`}
          data-dial-field
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange?.("")}
            aria-label={t("app.salesQueue.dialFieldClear")}
            title={t("app.salesQueue.dialFieldClear")}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground hover:bg-card"
            data-dial-clear
          >
            <X size={20} aria-hidden="true" />
          </button>
        ) : null}
      </label>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-300 break-words" role="alert" data-dial-error>
          {error}
        </p>
      ) : null}
      {typedNote ? (
        <p className="text-xs text-muted-foreground break-words" data-typed-note>{typedNote}</p>
      ) : null}

      {/* The keypad: twelve round keys, a phone's layout. */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 justify-items-center px-2" role="group" aria-label={liveCall ? t("app.salesQueue.keypadTonesAria") : t("app.salesQueue.keypadAria")} data-dial-keypad={liveCall ? "dtmf" : "type"}>
        {DIAL_KEYS.map(([key, letters]) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onKey?.(key)}
            className="flex flex-col items-center justify-center h-16 w-16 min-h-[44px] rounded-full border border-border bg-card hover:bg-muted active:bg-muted text-foreground disabled:opacity-60"
            data-dial-key={key}
          >
            <span className="text-2xl font-semibold leading-6">{key}</span>
            {letters ? <span className="text-[10px] leading-3 tracking-[0.14em] text-muted-foreground">{letters}</span> : null}
          </button>
        ))}
      </div>
      {liveCall ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Delete size={12} aria-hidden="true" /> {t("app.salesQueue.keypadTonesNote")}
        </p>
      ) : null}
    </div>
  );
}
