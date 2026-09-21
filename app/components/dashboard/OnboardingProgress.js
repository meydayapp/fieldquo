// app/components/dashboard/OnboardingProgress.js
"use client";

import { useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import CircularProgress from "./CircularProgress";
import useStepDialog from "@/app/components/dashboard/useStepDialog";
import { hasStepPanel } from "@/app/components/dashboard/stepPanels";
import { useTranslation } from "@/app/hooks/useTranslation";

// This card used to carry a "Not registered" button beside the tax step, and a
// dismissTaxRegistration() posting to POST /api/onboarding-status. Neither ever
// ran: the button was gated on `step.dismissible`, and lib/onboarding.js sets
// that to false — deliberately, because the answer belongs in Settings beside
// the field it is about, where it is recorded as a statement instead of waved
// away. Both are gone, along with the endpoint they called. The one step that
// can stop applying (tax registration) does so by not being in `status.steps`
// at all, so this component's whole job is to render what the server sent.
//
// It also used to host the Add Employee popup beside an "Invite your team"
// row. That row is on the "Additional set-up steps" card now (lib/setupSteps.js
// says why: it is done in place), and the popup went with it.
//
// ══ Rows open in place now (2026-09-21) ═══════════════════════════════════
//
// The owner: "Can a pop window be used instead of redirecting a company to
// the missing onboarding steps? So they don't necessarily navigate outside of
// the home page and get lost in the weeds." So each row opens its step in a
// dialog on this page — the SAME form the settings page renders, see
// app/components/dashboard/stepPanels.js — and on save this card re-reads
// /api/onboarding-status through `onRefresh`, the row ticks, and the next
// unfinished step is offered (useStepDialog.js). The settings page is one
// link away inside every dialog, and the deep links from emails to
// /app/settings/... are untouched.
//
// `canOpenInPlace` is the same gate the set-up card draws behind (can(role,
// "user:manage")). For anyone else — a crew member who sees this card while
// the owner is still setting up — every save inside a dialog would be
// refused, so the row stays what it was: a link to the page, which says why.
// The Stripe step hands the browser to Stripe from inside its dialog and
// comes back here; the payments page still works exactly as before.
export default function OnboardingProgress({ status, onRefresh, canOpenInPlace = false }) {
  const { t } = useTranslation();

  // labelKey through t(), with the English the server sent as the fallback —
  // lib/onboarding.js runs with no reader's language and cannot translate;
  // this card can. A step with no key at all (none today) prints its label.
  const stepLabel = (step) =>
    step.labelKey ? t(step.labelKey, step.label, step.labelValues) : step.label;

  // The tax row's label names the registration the company's country does.
  const rowLabel = (step) =>
    step.key === "tax_registration"
      ? t("app.onboarding.taxRegLabel", { name: t(step.nameKey) })
      : stepLabel(step);

  // Re-read, then hand back what is still to do so the next offer is chosen
  // from the fresh list. `onRefresh` resolves to the status (or null).
  const refresh = useCallback(async () => {
    const fresh = await onRefresh?.();
    return (fresh?.steps || []).filter((s) => !s.done);
  }, [onRefresh]);

  const { open, dialog, nextStrip } = useStepDialog({
    id: "onboarding",
    refresh,
    labelOf: rowLabel,
    hrefOf: (step) => step.href,
  });

  if (!status?.steps?.length || status.complete) return null;

  // A row is a button that opens the dialog, or the link it always was. A
  // function, not a component defined in render: a component created on
  // every render is a new type each time, and React would remount every row.
  const opensInPlace = (step) => canOpenInPlace && !step.done && hasStepPanel(step.key);
  const row = (step, className, children) =>
    opensInPlace(step) ? (
      <button
        key={step.key}
        type="button"
        onClick={() => open(step)}
        className={`${className} text-left w-full`}
      >
        {children}
      </button>
    ) : (
      <Link key={step.key} href={step.href} className={className}>
        {children}
      </Link>
    );

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-4">
        <CircularProgress percent={status.percent} />
        <div>
          <h2 className="font-semibold text-foreground">
            {t("app.onboarding.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("app.onboarding.stepsLeft")}
          </p>
        </div>
      </div>

      {nextStrip && <div className="mt-4">{nextStrip}</div>}

      <div className="space-y-2 mt-4">
        {status.steps.map((step) => {
          // Tax registration. Two things this row does that the others don't:
          // it names the registration the way the contractor's own country
          // names it, and it says in one sentence why a client wants to see it.
          if (step.key === "tax_registration") {
            const name = t(step.nameKey);
            return (
              <div
                key={step.key}
                className="px-3 py-2.5 rounded-lg hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-3">
                  {row(
                    step,
                    "flex items-center gap-3 min-w-0 min-h-9",
                    <>
                      {step.done ? (
                        <CheckCircle2
                          size={18}
                          className="text-green-600 dark:text-green-400 shrink-0"
                        />
                      ) : (
                        <Circle size={18} className="text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={`text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}
                      >
                        {t("app.onboarding.taxRegLabel", { name })}
                      </span>
                    </>,
                  )}
                </div>
                {!step.done && (
                  <p className="text-xs text-muted-foreground mt-1 ml-[30px]">
                    {t(step.whyKey)}
                  </p>
                )}
              </div>
            );
          }

          return row(
            step,
            "flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted min-h-11",
            <>
              {step.done ? (
                <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0" />
              ) : (
                <Circle size={18} className="text-muted-foreground shrink-0" />
              )}
              <span
                className={`text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}
              >
                {stepLabel(step)}
              </span>
            </>,
          );
        })}
      </div>

      {dialog}
    </div>
  );
}
