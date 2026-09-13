// app/components/sales/SignupProgress.js
//
// The stepper a rep watches while the prospect signs up on the phone:
//
//   Link sent → Opened → Company details → Plan chosen → Card entered → Signed up
//
// ══ Where the facts come from ═════════════════════════════════════════════
//
// GET /api/sales/leads/[id]/signup-progress — the rep's own link to THIS
// lead, or 404 (no link texted, or not their lead; the two look the same on
// purpose — lib/sales/signupProgress.js). This component renders NOTHING on
// a 404: the lead panel and the console's current card both mount it
// unconditionally, and a rep who has not texted a link sees no empty
// stepper telling them so. The "Sign-up link sent" step on NextSteps is the
// control that gets them here.
//
// ══ The poll ══════════════════════════════════════════════════════════════
//
// Every ten seconds while mounted and the signup is not complete — the
// cadence the server hands back (`pollMs`), the way the console's window
// re-ask uses a thirty-second tick. Cleared on unmount, so a closed panel
// stops asking; stopped on completion, because a finished signup does not
// change. `stuck` and `stuckForMs` come from the SERVER's clock, so a laptop
// five minutes slow still says "3 min".
//
// ══ The talking point ═════════════════════════════════════════════════════
//
// The card step is where a signup dies, and the owner's answer to the card
// objection — "you're not charged for a month; cancel from Settings in one
// click" — is printed inline the moment the stepper is past "Opened" and
// before "Signed up", in the rep's language (nine keys), so it is on the
// screen before the rep has to reach for it.
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/** The fallback cadence when the server did not say. Matches PROGRESS_POLL_MS. */
const DEFAULT_POLL_MS = 10 * 1000;

export default function SignupProgress({ leadId, className = "" }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ progress: null, pollMs: DEFAULT_POLL_MS, missing: true, error: "" });
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    if (!leadId) {
      setState({ progress: null, pollMs: DEFAULT_POLL_MS, missing: true, error: "" });
      return undefined;
    }
    async function tick() {
      let res;
      try {
        res = await fetch(`/api/sales/leads/${encodeURIComponent(leadId)}/signup-progress`);
      } catch {
        if (alive) setState((s) => ({ ...s, error: t("app.salesSignupProgress.unreachable") }));
        return;
      }
      if (!alive) return;
      if (res.status === 404) {
        // No link texted from this lead, or not this rep's link. Nothing to draw.
        setState({ progress: null, pollMs: DEFAULT_POLL_MS, missing: true, error: "" });
        return;
      }
      const body = await res.json().catch(() => null);
      if (!alive) return;
      if (!res.ok || !body?.progress) {
        setState((s) => ({ ...s, error: body?.error || t("app.salesSignupProgress.unreachable") }));
        return;
      }
      setState({ progress: body.progress, pollMs: Number(body.pollMs) || DEFAULT_POLL_MS, missing: false, error: "" });
    }
    tick();
    return () => {
      alive = false;
    };
  }, [leadId, t]);

  // The poll: re-armed whenever the interval or the completion state
  // changes; cleared on unmount. A completed signup polls no more.
  const { progress, pollMs, missing } = state;
  const completed = Boolean(progress?.completed);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (!leadId || completed) return undefined;
    timer.current = setInterval(async () => {
      let res;
      try {
        res = await fetch(`/api/sales/leads/${encodeURIComponent(leadId)}/signup-progress`);
      } catch {
        return;
      }
      if (res.status === 404) {
        setState({ progress: null, pollMs: DEFAULT_POLL_MS, missing: true, error: "" });
        return;
      }
      const body = await res.json().catch(() => null);
      if (res.ok && body?.progress) {
        setState({ progress: body.progress, pollMs: Number(body.pollMs) || DEFAULT_POLL_MS, missing: false, error: "" });
      }
    }, pollMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [leadId, pollMs, completed]);

  if (missing || !progress) return null;

  const stuckStep = progress.stuck ? progress.steps.find((s) => s.key === progress.stuckAtKey) : null;
  const stuckMinutes = progress.stuck ? Math.max(1, Math.floor(progress.stuckForMs / 60000)) : 0;
  // Past "Opened" and not yet signed up: the card is the next thing they
  // will be asked for, and the objection is best answered before it is raised.
  const reached = progress.steps.filter((s) => s.done).length;
  const showCardPoint = !progress.completed && reached >= 2;

  return (
    <div className={`rounded-xl border border-border bg-card p-4 space-y-3 ${className}`} data-testid="signup-progress">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{t("app.salesSignupProgress.heading")}</p>
        {!progress.completed ? <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden="true" /> : null}
      </div>

      <ol className="grid gap-1.5 sm:grid-cols-3" aria-label={t("app.salesSignupProgress.heading")}>
        {progress.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm min-w-0" data-step={s.key} data-done={s.done ? "1" : "0"}>
            {s.done ? (
              <Check size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <Circle size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <span className={`truncate ${s.done ? "text-foreground" : "text-muted-foreground"} ${s.current ? "font-semibold" : ""}`}>
              {t(s.labelKey, s.label)}
            </span>
          </li>
        ))}
      </ol>

      {progress.stuck && stuckStep ? (
        <p className="text-sm text-amber-700 dark:text-amber-300 break-words" data-testid="signup-progress-stuck">
          {t("app.salesSignupProgress.stuck", { step: t(stuckStep.labelKey, stuckStep.label), minutes: stuckMinutes })}
        </p>
      ) : null}

      {progress.completed ? (
        <p className="text-sm text-foreground break-words">{t("app.salesSignupProgress.done")}</p>
      ) : null}

      {showCardPoint ? (
        <p className="text-sm text-foreground rounded-lg border border-border bg-muted p-3 break-words" data-testid="signup-progress-card-point">
          <span className="font-semibold">{t("app.salesSignupProgress.cardPointLabel")}</span>{" "}
          {t("app.salesSignupProgress.cardPoint")}
        </p>
      ) : null}

      {state.error ? <p className="text-xs text-muted-foreground">{state.error}</p> : null}
    </div>
  );
}
