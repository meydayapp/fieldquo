// app/components/dashboard/SetupSteps.js
"use client";

// The set-up checklist — "Additional set-up steps", rebuilt on 2026-09-29 as
// a checklist ordered by what the company said matters (Company.signupPriority
// and signupFocus, through orderSetupSteps in lib/dashboard/focus.js).
//
// Every row here is one the server measured as NOT done and the company has
// NOT hidden (lib/setupSteps.js). There is no tick state: a step the database
// says is done is simply absent, which is the owner's ask ("removed, not
// checked") and the honest rendering — a ticked row would be a claim this
// component could not verify on its own. Progress is the bar and the "9 of
// 15 done" line, both from setupProgress; the rows never draw a tick.
//
// The redesign (owner, 2026-09-29): a progress bar, the time each step takes,
// ONE next step drawn larger with its own button — the first remaining step
// in the company's order — and a small moment when a step or the whole list
// is finished. Ordering is a permutation: no step is added, dropped or
// re-measured, and "Done, hide" is untouched.
//
// Collapsed by default once fewer than three remain: a card with one line in
// it, open all day on the dashboard, is a nag; three or more is a list worth
// seeing. The next step stays visible either way — the collapse hides the
// rest of the list, not the one thing the card is for.
//
// One row — "Invite your team" — is done in place. It came here from the
// onboarding card at the owner's ask ("it can be marked as done without
// leaving the window"), and the quick Add Employee popup came with it: the
// row carries a button that opens the popup, and when the popup reports an
// addition the list is re-read from the server rather than the row being
// struck off locally. The rule is "removed when the database says so", and
// a refetch is how this card asks the database; a local splice would be the
// card deciding for itself.
//
// Since 2026-09-21 every other row is done in place too — the owner: "Same
// for the additional steps." Each opens its step in a dialog on this page,
// rendering the SAME editor its settings page renders (app/components/
// dashboard/stepPanels.js), and a change inside it re-reads this list the
// same way the popup does, so the row leaves when the server says so and
// the next one is offered (useStepDialog.js). The row keeps its link to the
// page beside the dialog's own "Open in settings", and the "Done, hide"
// button is untouched.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Sparkles, UserPlus } from "lucide-react";
import { CARD } from "@/app/components/dashboard/surface";
import AddEmployeeModal from "@/app/components/team/AddEmployeeModal";
import useStepDialog from "@/app/components/dashboard/useStepDialog";
import { hasStepPanel } from "@/app/components/dashboard/stepPanels";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { remainingSteps, setupProgress } from "@/lib/setupSteps";
import { orderSetupSteps } from "@/lib/dashboard/focus";
import StepEstimate from "@/app/components/dashboard/StepEstimate";

const COLLAPSE_BELOW = 3;

/** The one step the card can finish itself, through the popup. */
const INLINE_ADD_EMPLOYEE_KEY = "team";

// ══ Progress, hidden kept apart from done (2026-09-24) ═════════════════════
//
// "(4 left)" said what remained and nothing about what had been achieved, so
// the header also says "9 of 15 done · 2 hidden" (setupProgress in
// lib/setupSteps.js). Hidden is its own count and never part of "done": the
// "Done, hide" button records a preference, the database is what records a
// thing done, and this card promised in its header comment never to claim
// what it cannot verify. The bar is drawn from the same `done / total`.
//
// Each row also carries its time estimate (`minutes` on the step), and the
// header adds them up for what is left — a range, because each step is one.

/** "About 12–40 min left" — the remaining steps' estimates summed, or null. */
function minutesLeft(steps) {
  let low = 0;
  let high = 0;
  for (const s of steps || []) {
    const [a, b] = Array.isArray(s.minutes) ? s.minutes.map(Number) : [];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b < a) continue;
    low += a;
    high += b;
  }
  return high > 0 ? [low, high] : null;
}

export default function SetupSteps({ footer = null, priority = null, focus = null }) {
  const { t } = useTranslation();
  const [steps, setSteps] = useState(null);
  const [progress, setProgress] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [hiding, setHiding] = useState("");
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  // The success moment: the step the database just stopped listing because
  // it is DONE (not hidden), and whether that emptied the list. Only set
  // from a re-read in this session, so a company that finished weeks ago is
  // not congratulated on every load.
  const [finished, setFinished] = useState(null);
  const [allDone, setAllDone] = useState(false);
  const choice = useRef({ priority, focus });
  const stepsRef = useRef(null);
  useEffect(() => {
    choice.current = { priority, focus };
  }, [priority, focus]);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  /** Notice what a re-read took off the list because it is now done. */
  const noticeFinished = useCallback((before, data) => {
    if (!Array.isArray(before) || !before.length) return;
    const all = Array.isArray(data?.steps) ? data.steps : [];
    const gone = before.find((b) => all.some((s) => s.key === b.key && s.done === true));
    if (gone) setFinished(all.find((s) => s.key === gone.key) || gone);
    if (remainingSteps(all).length === 0 && gone) setAllDone(true);
  }, []);

  const load = useCallback((isCancelled = () => false) => {
    return fetch("/api/setup-steps", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.reason || data.error || "Could not load set-up steps");
        }
        return data;
      })
      .then((data) => {
        if (isCancelled()) return;
        const remaining = remainingSteps(data?.steps);
        noticeFinished(stepsRef.current, data);
        setSteps(remaining);
        setProgress(setupProgress(data?.steps));
        setOpen((prev) => (prev === null ? remaining.length >= COLLAPSE_BELOW : prev));
      })
      .catch((err) => {
        if (isCancelled()) return;
        console.error(err);
        setError(err.message);
      });
  }, [noticeFinished]);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  // In the company's order: what serves their focus first (lib/dashboard/
  // focus.js). The same order feeds the dialog's "Next:" offer below, so the
  // step it suggests is the one this card highlights.
  const ordered = useMemo(() => orderSetupSteps(steps || [], { priority, focus }), [steps, priority, focus]);

  // The dialog's "what's next" needs the list AS RE-READ (see
  // useStepDialog.js), so the refresh resolves to the fresh remaining rows —
  // ordered the same way the card draws them.
  const [remainingRef, setRemainingRef] = useState([]);
  useEffect(() => {
    if (steps) setRemainingRef(steps);
  }, [steps]);
  const refresh = useCallback(async () => {
    const data = await fetch("/api/setup-steps", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    if (!data) return orderSetupSteps(remainingRef, choice.current);
    const remaining = remainingSteps(data?.steps);
    noticeFinished(remainingRef, data);
    setSteps(remaining);
    setProgress(setupProgress(data?.steps));
    return orderSetupSteps(remaining, choice.current);
  }, [remainingRef, noticeFinished]);

  const { open: openStep, dialog, nextStrip } = useStepDialog({
    id: "setup",
    refresh,
    labelOf: (step) => t(step.titleKey, step.title, step.titleParams || undefined),
    hrefOf: (step) => step.href,
  });

  // Clear the finished-step line after a moment; the all-done card stays
  // until the page is left.
  useEffect(() => {
    if (!finished || allDone) return undefined;
    const timer = setTimeout(() => setFinished(null), 8000);
    return () => clearTimeout(timer);
  }, [finished, allDone]);

  async function hide(key) {
    setHiding(key);
    try {
      const res = await fetch("/api/setup-steps/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setup.hideFailed", "Could not hide that step."));
        return;
      }
      setSteps((prev) => (prev || []).filter((s) => s.key !== key));
      setProgress((p) => (p ? { ...p, hidden: p.hidden + 1 } : p));
    } finally {
      setHiding("");
    }
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-4 py-3">
        {t("app.setup.unavailable", "Set-up steps unavailable:")} {error}
      </div>
    );
  }

  // The whole list just emptied because the last step got DONE — the one
  // time this card says so. Rendered from a re-read in this session only.
  if (steps && steps.length === 0 && allDone) {
    return (
      <section className={`${CARD} flex items-start gap-3 px-5 py-4`} role="status" data-tour="setup-steps">
        <Sparkles size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-foreground" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{t("app.setup.allDone", "You're all set up.")}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("app.setup.allDoneBody", "Every set-up step is finished. Nice work — FieldQuo is ready for your next job.")}
          </p>
        </div>
      </section>
    );
  }

  if (!steps || steps.length === 0) return null;

  const isOpen = open === true;
  const next = ordered[0];
  const rest = ordered.slice(1);
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const left = minutesLeft(ordered);

  /** One row's controls: the estimate, the page link, the popup, the hide. */
  const controls = (step) => (
    <>
      <StepEstimate minutes={step.minutes} variant="side" />
      <Link
        href={step.href}
        aria-label={`${t(step.titleKey, step.title, step.titleParams || undefined)} — ${t("app.stepDialog.openInSettings", "Open in settings")}`}
        className="shrink-0 flex items-center justify-center min-h-9 min-w-9 text-muted-foreground hover:text-foreground"
      >
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
      {step.key === INLINE_ADD_EMPLOYEE_KEY && (
        <button
          type="button"
          onClick={() => setShowAddEmployee(true)}
          className="flex items-center gap-1 shrink-0 text-xs font-semibold text-foreground border border-border rounded-full px-3 min-h-9"
        >
          <UserPlus size={13} aria-hidden="true" /> {t("app.onboarding.addEmployee", "Add Employee")}
        </button>
      )}
      <button
        type="button"
        onClick={() => hide(step.key)}
        disabled={hiding === step.key}
        className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground border border-foreground/20 rounded-full px-3 min-h-9 disabled:opacity-60"
      >
        {t("app.setup.hide", "Done, hide")}
      </button>
    </>
  );

  /** A step's title: a button into its dialog where one exists, else text. */
  const title = (step, big = false) => {
    const words = (
      <>
        <span className={`max-w-full ${big ? "text-base font-semibold" : "truncate"}`}>{step.label}</span>
        <StepEstimate minutes={step.minutes} variant="below" />
      </>
    );
    const cls = `flex flex-col justify-center min-w-0 flex-1 py-2 text-sm font-medium text-foreground min-h-9 text-left`;
    return hasStepPanel(step.key) ? (
      <button type="button" onClick={() => openStep(step)} className={cls}>
        {words}
      </button>
    ) : (
      <span className={cls}>{words}</span>
    );
  };

  const labelled = (step) => ({ ...step, label: t(step.titleKey, step.title, step.titleParams || undefined) });
  const nextStep = next ? labelled(next) : null;

  return (
    <section className={CARD} data-tour="setup-steps" aria-labelledby="setup-steps-title">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="setup-steps-title" className="font-semibold text-foreground">
              {t("app.setup.checklistTitle", "Your set-up checklist")}{" "}
              <span className="text-muted-foreground font-normal">({t("app.setup.left", "{n} left", { n: steps.length })})</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {priority
                ? t("app.setup.orderedIntro", "Ordered by what you told us matters most. Each step disappears once it's done — or hide it yourself.")
                : t("app.setup.intro", "Each of these disappears on its own once it's done — or hide it yourself.")}
            </p>
          </div>
        </div>
        {progress && progress.total > 0 && (
          <div className="mt-3">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-label={t("app.setup.progress", "{done} of {total} done", { done: progress.done, total: progress.total })}
              className="h-2 w-full bg-muted border border-foreground/10"
            >
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs font-semibold text-foreground tabular-nums" data-setup-progress>
              {t("app.setup.progress", "{done} of {total} done", { done: progress.done, total: progress.total })}
              {progress.hidden > 0 && (
                <span className="font-normal text-muted-foreground">
                  {" · "}
                  {t("app.setup.hiddenCount", "{n} hidden", { n: progress.hidden })}
                </span>
              )}
              {left && (
                <span className="font-normal text-muted-foreground">
                  {" · "}
                  {t("app.setup.timeLeft", "about {min}–{max} min left", { min: left[0], max: left[1] })}
                </span>
              )}
            </p>
          </div>
        )}
        {finished && !allDone && (
          <p role="status" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Sparkles size={14} aria-hidden="true" />
            {t("app.setup.justDone", "Done: {step}. Nice work.", { step: t(finished.titleKey, finished.title, finished.titleParams || undefined) })}
          </p>
        )}
      </div>

      {nextStrip && <div className="px-5 pb-3">{nextStrip}</div>}

      {/* ── The one next step ───────────────────────────────────────────── */}
      {nextStep && (
        <div className="border-t border-foreground/15 bg-muted/60 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("app.setup.nextStep", "Next step")}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {title(nextStep, true)}
            {hasStepPanel(nextStep.key) && (
              <button
                type="button"
                onClick={() => openStep(next)}
                className="shrink-0 min-h-10 rounded-full bg-inverted px-5 text-sm font-semibold text-inverted-foreground"
              >
                {t("app.setup.start", "Start")}
              </button>
            )}
            {controls(next)}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={isOpen}
            aria-controls="setup-steps-list"
            className="flex w-full items-center justify-between gap-3 border-t border-foreground/15 px-5 py-3 text-left text-sm font-semibold text-foreground min-h-11"
          >
            {isOpen
              ? t("app.setup.hideRest", "Hide the other steps")
              : t("app.setup.showRest", "Show the other {n} steps", { n: rest.length })}
            <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && (
            <ul id="setup-steps-list" className="border-t border-foreground/15">
              {rest.map((step) => (
                <li key={step.key} className="flex items-center justify-between gap-3 px-5 py-2 border-b border-foreground/10 last:border-b-0">
                  {title(labelled(step))}
                  {controls(step)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {footer && <div className="px-5 py-4 border-t border-foreground/15">{footer}</div>}
      {showAddEmployee && (
        <AddEmployeeModal
          onClose={() => setShowAddEmployee(false)}
          onAdded={() => {
            setShowAddEmployee(false);
            load();
          }}
        />
      )}
      {dialog}
    </section>
  );
}
