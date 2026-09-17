// app/components/sales/OutcomeForm.js
//
// The six buttons a rep presses after a call, and the pop-up that carries
// them when a call has just ended.
//
// ══ One form, three places, one draft ═════════════════════════════════════
//
// CallPanel draws this in the Dialer column, again in the console's
// Disposition tab, and — when the carrier has reported that an ANSWERED call
// ended — in a pop-up. The draft (which button, the when, the ticks, the
// note) is CallPanel's state and is handed in; this file holds nothing. Three
// copies over one draft is what lets a rep start a note in the pop-up,
// dismiss it, and find the note still there in the Dialer column.
//
// ══ What the buttons are, and why not nine ════════════════════════════════
//
// lib/sales/calls/outcomeChoices.js — the owner's locked set: four primary,
// two under More, keys 1–4 and M. Every press folds to a real disposition
// there; nothing in this file names a code.
//
// ══ The pop-up is not a modal over a live call ════════════════════════════
//
// CallPanel's header argues against a modal during a call, and that stands.
// This sheet is opened by CallPanel only after the server has said the call
// ended and was answered (the auto-log reply — "talked" or the rep's own
// hang-up on a connected call). Never on connect, never while a call is up,
// never for a call nobody answered (those are logged by the line; the rep
// sees a strip, not a question). It does not block the portal: clicking
// outside or Esc is "later", and the form stays in the Dialer column.
"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import {
  CALL_BACK_DEFAULT_WHEN,
  CHOICE_CALL_BACK,
  CHOICE_NO_CALLBACKS,
  CHOICE_WRONG_OR_NOT_BUSINESS,
  OUTCOME_CHOICES,
  OUTCOME_NOTE_MAX,
  WHEN_IN_AN_HOUR,
  WHEN_LATER_TODAY,
  WHEN_PICK,
  WHEN_TOMORROW,
  WHICH_NOT_A_BUSINESS,
  WHICH_WRONG_NUMBER,
  choiceHintKey,
  choiceLabelKey,
} from "@/lib/sales/calls/outcomeChoices";

const BTN = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD = "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";

/** The empty draft. Exported so CallPanel resets to the same shape. */
export const EMPTY_DRAFT = Object.freeze({
  choice: "",
  more: false,
  whenKind: null,
  whenAt: "",
  notOwner: false,
  interested: false,
  which: null,
  note: "",
});

/** Has the rep started? The auto-log timer stays out once this is true. */
export function draftStarted(draft) {
  return Boolean(draft?.choice || (draft?.note && draft.note.trim()));
}

function ChoiceButton({ t, choice, selected, onPick, big }) {
  return (
    <button
      type="button"
      className={`${BTN} relative w-full text-left justify-start ${big ? "min-h-[56px]" : ""} ${
        selected
          ? "bg-primary text-primary-foreground ring-2 ring-primary"
          : "bg-card text-foreground border border-border hover:bg-muted"
      }`}
      onClick={() => onPick(choice.key)}
      aria-pressed={selected}
      data-outcome-choice={choice.key}
    >
      {choice.hotkey ? (
        <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${selected ? "bg-primary-foreground/20" : "bg-muted"}`} aria-hidden="true">
          {choice.hotkey}
        </span>
      ) : null}
      <span className="min-w-0 break-words">{t(choiceLabelKey(choice.key))}</span>
    </button>
  );
}

/**
 * @param draft     the CallPanel draft (EMPTY_DRAFT's shape).
 * @param setDraft  React setter for it.
 * @param onSave    called with no arguments; CallPanel folds and posts.
 * @param onLater   when given, a "Write it up later" button is drawn.
 * @param error     the refusal to print under the buttons, boxed, or "".
 */
export default function OutcomeForm({ t, draft, setDraft, busy, onSave, onLater = null, error = "", autoFocus = false }) {
  const patch = (p) => setDraft((d) => ({ ...d, ...p }));
  // Pressing "Call back" pre-selects a time (outcomeChoices.js
  // CALL_BACK_DEFAULT_WHEN) so Save works on the next press; any other
  // choice clears it, so a time picked for a callback is never carried
  // into an outcome the fold would silently ignore it on.
  const pick = (key) => {
    const next = key === draft.choice ? "" : key;
    patch({ choice: next, whenKind: next === CHOICE_CALL_BACK ? CALL_BACK_DEFAULT_WHEN : null });
  };
  const primary = OUTCOME_CHOICES.filter((c) => c.primary);
  const more = OUTCOME_CHOICES.filter((c) => !c.primary);
  const chosen = OUTCOME_CHOICES.find((c) => c.key === draft.choice) || null;
  const noteRequired = draft.choice === CHOICE_NO_CALLBACKS || (draft.choice === CHOICE_WRONG_OR_NOT_BUSINESS && draft.which === WHICH_NOT_A_BUSINESS);

  return (
    <div className="space-y-3" data-outcome-form>
      <div className="grid grid-cols-2 gap-2">
        {primary.map((c) => (
          <ChoiceButton key={c.key} t={t} choice={c} selected={draft.choice === c.key} onPick={pick} big />
        ))}
      </div>

      <button
        type="button"
        className="text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        onClick={() => patch({ more: !draft.more })}
        aria-expanded={draft.more}
        data-outcome-more
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[11px] font-bold mr-1.5" aria-hidden="true">M</span>
        {draft.more ? t("app.salesCall.choice.less") : t("app.salesCall.choice.more")}
      </button>
      {draft.more ? (
        <div className="grid grid-cols-1 gap-2">
          {more.map((c) => (
            <ChoiceButton key={c.key} t={t} choice={c} selected={draft.choice === c.key} onPick={pick} />
          ))}
        </div>
      ) : null}

      {/* ── The refusal, where the eyes are ───────────────────────────────
          Directly under the buttons the rep just pressed, boxed, with an
          icon, in the amber the pending panel uses. It was a line of small
          text under the note field: a rep pressed Call back, pressed Save,
          and reported that "nothing happens" — the sentence was on screen
          and not in her field of view. data-outcome-refusal is what
          scripts/check-sales-call-panel.mjs asserts on. */}
      {error ? (
        <div
          className="flex gap-2 rounded-lg border-2 border-amber-500 bg-amber-100 dark:bg-amber-900/50 dark:border-amber-500 px-3 py-2.5 text-sm font-semibold text-amber-950 dark:text-amber-50 break-words"
          role="alert"
          aria-live="assertive"
          data-outcome-refusal
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {chosen ? <p className="text-xs text-muted-foreground break-words">{t(choiceHintKey(chosen.key))}</p> : null}

      {/* "No call-backs" needs their words. Said under the button BEFORE the
          press, not only as the refusal after it. */}
      {draft.choice === CHOICE_NO_CALLBACKS && !draft.note.trim() ? (
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200 break-words" data-outcome-needs-words>
          {t("app.salesCall.choice.no_callbacks.beforePress")}
        </p>
      ) : null}

      {/* ── Call back: when, or who ─────────────────────────────────────── */}
      {draft.choice === CHOICE_CALL_BACK ? (
        <div className="space-y-2" data-outcome-callback>
          <p className="text-sm font-medium">{t("app.salesCall.choice.call_back.when")}</p>
          <div className="flex flex-wrap gap-2">
            {[WHEN_IN_AN_HOUR, WHEN_LATER_TODAY, WHEN_TOMORROW, WHEN_PICK].map((k) => (
              <button
                key={k}
                type="button"
                className={`${BTN} min-h-[40px] ${draft.whenKind === k ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}
                onClick={() => patch({ whenKind: draft.whenKind === k ? null : k })}
                aria-pressed={draft.whenKind === k}
                data-outcome-when={k}
              >
                {t(`app.salesCall.choice.call_back.${k}`)}
              </button>
            ))}
          </div>
          {draft.whenKind === WHEN_PICK ? (
            <input
              type="datetime-local"
              className={FIELD}
              value={draft.whenAt}
              onChange={(e) => patch({ whenAt: e.target.value })}
              aria-label={t("app.salesCall.callbackWhen")}
            />
          ) : null}
          {!draft.whenKind ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={draft.notOwner} onChange={(e) => patch({ notOwner: e.target.checked })} />
                {t("app.salesCall.choice.call_back.notOwner")}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={draft.interested} onChange={(e) => patch({ interested: e.target.checked })} />
                {t("app.salesCall.choice.call_back.interested")}
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Wrong number / not a business: which ─────────────────────────── */}
      {draft.choice === CHOICE_WRONG_OR_NOT_BUSINESS ? (
        <div className="flex flex-col gap-1.5 text-sm" data-outcome-which>
          {[WHICH_WRONG_NUMBER, WHICH_NOT_A_BUSINESS].map((w) => (
            <label key={w} className="inline-flex items-center gap-2">
              <input type="radio" name="outcome-which" checked={draft.which === w} onChange={() => patch({ which: w })} />
              {t(`app.salesCall.choice.wrong_or_not_business.${w}`)}
            </label>
          ))}
        </div>
      ) : null}

      {/* ── What they said ───────────────────────────────────────────────── */}
      <label className="block text-sm">
        <span>{noteRequired ? t("app.salesCall.choice.noteRequired") : t("app.salesCall.choice.noteOptional")}</span>
        <textarea
          className={FIELD}
          rows={2}
          maxLength={OUTCOME_NOTE_MAX}
          value={draft.note}
          onChange={(e) => patch({ note: e.target.value.slice(0, OUTCOME_NOTE_MAX) })}
          placeholder={t("app.salesCall.choice.notePlaceholder")}
          autoFocus={autoFocus && Boolean(draft.choice)}
          data-outcome-note
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          className={`${BTN} bg-primary text-primary-foreground flex-1`}
          disabled={!draft.choice || Boolean(busy)}
          onClick={onSave}
          data-outcome-save
        >
          {busy === "disposition" ? <Loader2 className="animate-spin" size={16} /> : null}
          {t("app.salesCall.saveOutcome")}
        </button>
        {onLater ? (
          <button type="button" className={`${BTN} border border-border bg-card text-foreground`} onClick={onLater} data-outcome-later>
            {t("app.salesCall.choice.later")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The pop-up: a centred dialog on a desktop, a bottom sheet on a phone. Keys
 * 1–4 press the primary buttons, M opens More, Esc is "later". Clicking the
 * backdrop is "later" too — this never traps the rep.
 */
export function OutcomeSheet({ t, open, onLater, children, title, body }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      // Never steal keys from a field the rep is typing in.
      const tag = e.target?.tagName;
      const typing = tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || e.target?.isContentEditable;
      if (e.key === "Escape") {
        e.preventDefault();
        onLater?.();
        return;
      }
      if (typing) return;
      const hit = OUTCOME_CHOICES.find((c) => c.hotkey === e.key);
      if (hit) {
        e.preventDefault();
        ref.current?.querySelector(`[data-outcome-choice="${hit.key}"]`)?.click();
        return;
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        ref.current?.querySelector("[data-outcome-more]")?.click();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onLater]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" data-outcome-sheet>
      {/* The backdrop is "later", not a wall. */}
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={t("app.salesCall.choice.later")} onClick={onLater} data-outcome-backdrop />
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-label={title}
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card text-foreground shadow-xl p-4 sm:p-5 space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{title}</p>
            {body ? <p className="text-xs text-muted-foreground break-words">{body}</p> : null}
          </div>
          <button type="button" className="shrink-0 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg hover:bg-muted" onClick={onLater} aria-label={t("app.salesCall.choice.later")}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
