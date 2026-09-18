"use client";

// app/components/sales/OutboundWriteUp.js
//
// "What happened on that call?" for an OUTBOUND call — the amber card with
// the six buttons — and the fifteen-second "logged by itself · change" strip.
//
// One renderer, four places: the queue's Dialer column, its Disposition tab
// (CallPanel draws both through one state), the pop-up after an answered
// call, and the live strip when no panel is on the screen (the rep hung up
// on the Texts page). The state behind every copy is CallSession's; nothing
// here holds a draft of its own. A second copy of this form with its own
// state would be AGENTS.md failure class 4 with a live call behind it.
import OutcomeForm from "./OutcomeForm";
import TextThemButton from "./TextThem";
import { OUTCOME_CHOICES, choiceLabelKey } from "@/lib/sales/calls/outcomeChoices";

/**
 * "You rang {number}" for a call this rep placed; "They called you back
 * from {number} at {time}" for one they received. pendingAttempt is
 * outbound-only, but the sentence is chosen by the row's direction rather
 * than by that assumption, so a row that reaches here by any other path is
 * never described as a call the rep made.
 */
export function whatHappenedBody(t, language, row) {
  if (row?.direction === "in") {
    let time = "";
    try {
      time = new Intl.DateTimeFormat(language || undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(row.dialledAt));
    } catch {
      time = String(row.dialledAt || "");
    }
    return t("app.salesCall.whatHappenedBodyInbound", { number: row.toE164, time });
  }
  return t("app.salesCall.whatHappenedBody", { number: row?.toE164 });
}

/**
 * The write-up card. `inline` marks the copy that carries the scroll ref
 * and the Text them chip — the Dialer column, or the strip; the tab's copy
 * is the same state and two presses for one thread is noise.
 */
export function OutboundWriteUpCard({ t, language, session, inline = true, flash = 0, formRef = null, extra = null }) {
  const { pending, draft, setDraft, busy, saveOutcome, later, formError } = session;
  if (!pending) return null;
  return (
    <div
      className={`rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3 ${flash ? "ring-2 ring-amber-500 animate-pulse" : ""}`}
      data-call-disposition={inline ? "dialer" : "tab"}
      ref={inline ? formRef : null}
    >
      <div>
        <p className="font-semibold text-amber-900 dark:text-amber-100">{t("app.salesCall.whatHappened")}</p>
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words">
          {pending.override
            ? t("app.salesCall.changeAutoLoggedBody", {
                outcome: t(`app.salesCall.disposition.${pending.override}.label`),
                number: pending.toE164,
              })
            : whatHappenedBody(t, language, pending)}
        </p>
      </div>

      {/* Anything the screen wants asked beside the outcome — the typed
          number question — before the six buttons, and in the inline copy
          only. */}
      {inline ? extra : null}

      {/* The six buttons, over the one shared draft. Every press folds to a
          real code in lib/sales/calls/outcomeChoices.js; this screen has no
          say in which. */}
      <OutcomeForm t={t} draft={draft} setDraft={setDraft} busy={busy} onSave={saveOutcome} onLater={pending.override ? null : later} error={formError} />

      {/* After the call, beside the write-up: the same control the Call
          button had, so "text me instead" is one press whether or not the
          rep logs it as the outcome. */}
      {inline && pending.toE164 ? (
        <TextThemButton
          e164={pending.toE164}
          leadId={pending.leadId || null}
          prospectId={pending.leadId ? null : pending.prospectId || null}
          variant="chip"
          label={t("app.salesText.textThem")}
        />
      ) : null}

      {pending.autoAsk && pending.dialChannel === "browser" ? (
        <p className="text-xs text-amber-900 dark:text-amber-200 break-words">{t("app.salesCall.autoLogPending")}</p>
      ) : null}
    </div>
  );
}

/** What the line logged by itself, with fifteen seconds to change it. */
export function AutoLoggedStrip({ t, session }) {
  const { autoLogged, changeAutoLogged } = session;
  if (!autoLogged) return null;
  return (
    <div
      className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-3"
      data-call-auto-logged={autoLogged.code}
      role="status"
    >
      <p className="break-words min-w-0">
        {t("app.salesCall.autoLoggedAs", {
          outcome: t(`app.salesCall.disposition.${autoLogged.code}.label`),
        })}
      </p>
      <button
        type="button"
        className="shrink-0 min-h-[36px] px-3 rounded-lg border border-emerald-400 font-semibold"
        onClick={changeAutoLogged}
        data-call-auto-logged-change
      >
        {t("app.salesCall.autoLoggedChange")}
      </button>
    </div>
  );
}

/**
 * The console's Disposition tab with no call to write up: say so, and list
 * what a written-up call will ask for. A blank tab reads as a broken one.
 */
export function NoCallToLog({ t }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-sm text-muted-foreground space-y-2" data-call-disposition-empty>
      <p className="font-semibold text-foreground">{t("app.salesCall.noCallToLog")}</p>
      <p className="break-words">{t("app.salesCall.noCallToLogBody")}</p>
      {/* What the buttons offer — not the line's three, which a rep never
          picks (outcomeChoices.js). */}
      <ul className="flex flex-wrap gap-1.5">
        {OUTCOME_CHOICES.map((c) => (
          <li key={c.key} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground">
            {t(choiceLabelKey(c.key))}
          </li>
        ))}
      </ul>
    </div>
  );
}
