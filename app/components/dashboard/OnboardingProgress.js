// app/components/dashboard/OnboardingProgress.js
"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, UserPlus } from "lucide-react";
import CircularProgress from "./CircularProgress";
import AddEmployeeModal from "@/app/components/team/AddEmployeeModal";
import { useTranslation } from "@/app/hooks/useTranslation";

// This card used to carry a "Not registered" button beside the tax step, and a
// dismissTaxRegistration() posting to POST /api/onboarding-status. Neither ever
// ran: the button was gated on `step.dismissible`, and lib/onboarding.js sets
// that to false — deliberately, because the answer belongs in Settings beside
// the field it is about, where it is recorded as a statement instead of waved
// away. Both are gone, along with the endpoint they called. The two steps that
// can stop applying (tax registration, and "invite your team" for a one-person
// shop) do so by not being in `status.steps` at all, so this component's whole
// job is to render what the server sent.
export default function OnboardingProgress({ status, onEmployeeAdded }) {
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const { t } = useTranslation();

  if (!status?.steps?.length || status.complete) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-4">
        <CircularProgress percent={status.percent} />
        <div>
          <h2 className="font-semibold text-foreground">
            Finish setting up FieldQuo
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {status.plan
              ? `${status.plan.name} — ${status.seatsUsed}/${status.plan.maxUsers} licenses in use`
              : "A few steps left before you're fully up and running."}
          </p>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {status.steps.map((step) => {
          if (step.key === "team") {
            return (
              <div
                key={step.key}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-muted"
              >
                <div className="flex items-center gap-3">
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
                    {step.label}
                  </span>
                </div>
                {!step.done && status.seatsRemaining !== 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddEmployee(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-foreground border border-border rounded-full px-3 py-1.5 shrink-0"
                  >
                    <UserPlus size={13} /> Add Employee
                  </button>
                )}
              </div>
            );
          }

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
                {step.label}
              </span>
            </Link>
          );
        })}
      </div>

      {showAddEmployee && (
        <AddEmployeeModal
          onClose={() => setShowAddEmployee(false)}
          onAdded={() => {
            setShowAddEmployee(false);
            onEmployeeAdded?.();
          }}
        />
      )}
    </div>
  );
}
