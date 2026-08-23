// app/components/dashboard/OnboardingProgress.js
"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, UserPlus } from "lucide-react";
import CircularProgress from "./CircularProgress";
import AddEmployeeModal from "@/app/components/team/AddEmployeeModal";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";

export default function OnboardingProgress({
  status,
  onEmployeeAdded,
  onStatusChange,
}) {
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const { t } = useTranslation();

  // The server decides whether the step may go; this only asks. On failure the
  // step stays visible and the error surfaces — a dismiss button that appears
  // to work and leaves the step there next reload is exactly the failure this
  // codebase keeps getting swept for.
  async function dismissTaxRegistration() {
    setDismissing(true);
    try {
      const res = await fetch("/api/onboarding-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismiss: "tax_registration" }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.onboarding.taxRegSkipFailed"));
        return;
      }
      onStatusChange?.(await res.json());
    } catch {
      // Network-level failure — there is no Response to read a message off.
      showError(t("app.onboarding.taxRegSkipFailed"));
    } finally {
      setDismissing(false);
    }
  }

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
                  {!step.done && step.dismissible && (
                    <button
                      type="button"
                      onClick={dismissTaxRegistration}
                      disabled={dismissing}
                      title={t("app.onboarding.taxRegSkipTitle")}
                      className="text-xs font-semibold text-muted-foreground border border-border rounded-full px-3 py-1.5 shrink-0 hover:bg-muted disabled:opacity-50"
                    >
                      {t("app.onboarding.taxRegSkip")}
                    </button>
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
