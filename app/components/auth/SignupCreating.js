"use client";

// app/components/auth/SignupCreating.js
//
// The screen between "Start my free trial" and the dashboard. It replaces the
// "Setting up..." label on a disabled button, which was all a new owner saw
// while their company was created and seeded (the owner, 2026-09-25: "if
// something needs time because of seeding etc., make sure we have a loading
// progression bar").
//
// Presentational only. The stages, their statuses and the outcome come from
// lib/signup/creatingProgress.js's run, which moves a stage to "done" only
// when the server reported it done — so the bar here is completed stages over
// total stages and has no other input. No timer advances it; the one timer
// on this page (navigateSlowMs) only offers a link by hand.
//
// Accessibility: the bar is role="progressbar" with its value and a spoken
// "3 of 7 steps", the current step is announced through a polite live region,
// a problem is role="alert", and the bar's slide and the spinner both stop
// under prefers-reduced-motion. FieldQuo's own page, so FieldQuo's tokens —
// the white-label rule is for the contractor's clients' surfaces.

import { AlertCircle, Check, Circle, Loader2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { PRIMARY_BUTTON } from "@/app/components/auth/fieldStyles";
import { currentStage, progressOf } from "@/lib/signup/creatingProgress";

/** The words for one stage. Exported for the check. */
export function stageLabel(t, stage) {
  switch (stage?.kind) {
    case "company":
      return t("app.signup.progress.company", "Creating your company");
    case "services":
      return stage.label
        ? t("app.signup.progress.services", "Adding your services for {trade}", { trade: stage.label })
        : t("app.signup.progress.servicesNoTrade", "Adding your services");
    case "checklists":
      return t("app.signup.progress.checklists", "Setting up your checklists and maintenance plans");
    case "templates":
      return t("app.signup.progress.templates", "Setting up your email templates and follow-ups");
    case "dashboard":
      return t("app.signup.progress.dashboard", "Preparing your dashboard");
    default:
      return t("app.signup.progress.servicesNoTrade", "Adding your services");
  }
}

/** The sentence under a stopped run. Exported for the check. */
export function problemText(t, problem, stages) {
  if (!problem) return "";
  if (problem.stage === "company") {
    if (problem.outcome === "timeout") {
      return t(
        "app.signup.progress.timeoutCompany",
        "This is taking longer than it should. Your business may already have been created — Retry picks up where it stopped and never creates a second one.",
      );
    }
    if (problem.message) return problem.message;
    return problem.companyUnknown
      ? t(
          "app.signup.progress.networkCompany",
          "We lost the connection while creating your business. Retry picks up where it stopped and never creates a second one.",
        )
      : t("app.signup.progress.failedCompany", "We couldn't create your business.");
  }
  if (problem.outcome === "timeout") {
    return t(
      "app.signup.progress.timeoutSetup",
      "This is taking longer than it should. Your business is created — Retry finishes the steps that are left.",
    );
  }
  const failed = (stages || []).find((s) => s.key === problem.stage) || null;
  return t(
    "app.signup.progress.failedStage",
    "“{step}” didn't finish. Your business is created — Retry finishes the steps that are left, or carry on and add them later from Settings.",
    { step: failed ? stageLabel(t, failed) : stageLabel(t, { kind: "services" }) },
  );
}

function StageIcon({ status }) {
  if (status === "done") return <Check size={16} className="text-foreground" aria-hidden="true" />;
  if (status === "active") {
    return <Loader2 size={16} className="text-foreground animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  }
  if (status === "failed") return <AlertCircle size={16} className="text-red-600 dark:text-red-400" aria-hidden="true" />;
  return <Circle size={16} className="text-muted-foreground" aria-hidden="true" />;
}

/**
 * @param stages          lib/signup/creatingProgress.js stages
 * @param companyName     the name typed on the business step
 * @param problem         null while running or done; the run's result when it
 *                        stopped ({ outcome, stage, message, companyCreated })
 * @param running         a run is in flight (Retry is disabled meanwhile)
 * @param slowNavigation  the browser was sent to the app and is still here
 * @param appUrl          where the dashboard is, for the by-hand link
 * @param onRetry         re-run from the first stage not done
 * @param onBack          back to the form (only while no company exists)
 * @param onContinue      go to the dashboard with a stage unfinished
 */
export default function SignupCreating({
  stages = [],
  companyName = "",
  problem = null,
  running = false,
  slowNavigation = false,
  appUrl = "/app?welcome=true",
  onRetry,
  onBack,
  onContinue,
}) {
  const { t } = useTranslation();
  const { done, total, percent } = progressOf(stages);
  const now = currentStage(stages);
  const count = t("app.signup.progress.count", "{done} of {total} steps done", { done, total });
  const companyCreated = Boolean(problem?.companyCreated) || stages.some((s) => s.key === "company" && s.status === "done");

  return (
    <section
      className="bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8"
      aria-labelledby="signup-creating-title"
      aria-busy={running ? "true" : "false"}
    >
      <h2 id="signup-creating-title" className="text-lg font-semibold text-foreground">
        {companyName
          ? t("app.signup.progress.title", "Setting up {company}", { company: companyName })
          : t("app.signup.progress.titlePlain", "Setting up your business")}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        {t("app.signup.progress.subtitle", "This usually takes a few seconds. Please keep this page open.")}
      </p>

      <div className="mt-5">
        <div
          role="progressbar"
          aria-labelledby="signup-creating-title"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={count}
          className="h-2 w-full rounded-full bg-muted overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-inverted transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">{count}</p>
      </div>

      <ol className="mt-5 space-y-2.5">
        {stages.map((s) => (
          <li
            key={s.key}
            data-status={s.status}
            className={`flex items-start gap-3 text-sm ${
              s.status === "pending" ? "text-muted-foreground" : "text-foreground"
            } ${s.status === "active" ? "font-medium" : ""}`}
          >
            <span className="mt-0.5 shrink-0">
              <StageIcon status={s.status} />
            </span>
            <span className="min-w-0 break-words">{stageLabel(t, s)}</span>
          </li>
        ))}
      </ol>

      {/* What a screen reader hears as the run moves: the step now under way. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {problem ? "" : now ? t("app.signup.progress.now", "Now: {step}", { step: stageLabel(t, now) }) : ""}
      </p>

      {problem && (
        <div role="alert" className="mt-5 rounded-lg border border-border bg-muted px-4 py-3">
          <p className="text-sm text-foreground">{problemText(t, problem, stages)}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={running}
            className={`${PRIMARY_BUTTON} mt-4`}
          >
            {t("app.signup.progress.retry", "Retry")}
          </button>
          {companyCreated ? (
            <button
              type="button"
              onClick={onContinue}
              disabled={running}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {t("app.signup.progress.continue", "Go to my dashboard anyway")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onBack}
              disabled={running}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              ← {t("app.signup.progress.back", "Back to the form")}
            </button>
          )}
        </div>
      )}

      {slowNavigation && !problem && (
        <p className="mt-5 text-sm text-muted-foreground">
          {t("app.signup.progress.slow", "Still here?")}{" "}
          <a href={appUrl} className="font-medium text-foreground underline underline-offset-2">
            {t("app.signup.progress.openDashboard", "Open your dashboard")}
          </a>
        </p>
      )}
    </section>
  );
}
