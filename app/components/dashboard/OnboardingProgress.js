// app/components/dashboard/OnboardingProgress.js
"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, UserPlus } from "lucide-react";
import CircularProgress from "./CircularProgress";
import AddEmployeeModal from "@/app/components/team/AddEmployeeModal";

export default function OnboardingProgress({ status, onEmployeeAdded }) {
  const [showAddEmployee, setShowAddEmployee] = useState(false);

  if (!status?.steps?.length || status.complete) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <CircularProgress percent={status.percent} />
        <div>
          <h2 className="font-semibold text-gray-900">
            Finish setting up FieldQuo
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
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
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {step.done ? (
                    <CheckCircle2
                      size={18}
                      className="text-green-600 shrink-0"
                    />
                  ) : (
                    <Circle size={18} className="text-gray-300 shrink-0" />
                  )}
                  <span
                    className={`text-sm ${step.done ? "text-gray-400 line-through" : "text-gray-900 font-medium"}`}
                  >
                    {step.label}
                  </span>
                </div>
                {!step.done && status.seatsRemaining !== 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddEmployee(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-900 border border-gray-300 rounded-full px-3 py-1.5 shrink-0"
                  >
                    <UserPlus size={13} /> Add Employee
                  </button>
                )}
              </div>
            );
          }

          return (
            <Link
              key={step.key}
              href={step.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50"
            >
              {step.done ? (
                <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              ) : (
                <Circle size={18} className="text-gray-300 shrink-0" />
              )}
              <span
                className={`text-sm ${step.done ? "text-gray-400 line-through" : "text-gray-900 font-medium"}`}
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
