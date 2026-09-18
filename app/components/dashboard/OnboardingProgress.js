// app/components/dashboard/OnboardingProgress.js
"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import CircularProgress from "./CircularProgress";
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
// says why: it is done in place, and this card is a list of pages), and the
// popup went with it — every row here is a link, and nothing else.
export default function OnboardingProgress({ status }) {
  const { t } = useTranslation();

  if (!status?.steps?.length || status.complete) return null;

  // labelKey through t(), with the English the server sent as the fallback —
  // lib/onboarding.js runs with no reader's language and cannot translate;
  // this card can. A step with no key at all (none today) prints its label.
  const stepLabel = (step) =>
    step.labelKey ? t(step.labelKey, step.label, step.labelValues) : step.label;

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
                  <Link href={step.href} className="flex items-center gap-3 min-w-0">
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
                  </Link>
                </div>
                {!step.done && (
                  <p className="text-xs text-muted-foreground mt-1 ml-[30px]">
                    {t(step.whyKey)}
                  </p>
                )}
              </div>
            );
          }

          return (
            <Link
              key={step.key}
              href={step.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted"
            >
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}
