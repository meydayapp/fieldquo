// app/components/marketing/PricingCard.js
"use client";

import { CheckCircle2 } from "lucide-react";
import { calculatePricing } from "@/lib/pricing";

function money(value) {
  const number = Number(value || 0);

  if (Number.isNaN(number)) {
    return "0";
  }

  return number.toLocaleString("en-CA", {
    maximumFractionDigits: 0,
  });
}

export default function PricingCard({ tier, plan, selected, onSelect }) {
  const isDbPlan = Boolean(plan);

  const label = isDbPlan ? plan.name : tier.label;
  const employeeCount = isDbPlan ? plan.maxUsers : tier.employeeCount;

  const calculated = calculatePricing(employeeCount || 1);

  const trialTotal = isDbPlan ? 1 : calculated.trialTotal;
  const monthlyTotal = isDbPlan
    ? Number(plan.priceMonthly || 0)
    : calculated.monthlyTotal;

  const perLicense =
    employeeCount > 0 ? Math.round(monthlyTotal / employeeCount) : monthlyTotal;

  const popular = !isDbPlan && tier.popular;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left border rounded-2xl p-6 flex flex-col relative bg-white
        transition-all duration-150 ease-out
        hover:scale-[1.03] hover:shadow-lg
        active:scale-[0.99]
        ${
          selected
            ? "border-gray-900 shadow-md ring-2 ring-gray-900 scale-[1.02] bg-gray-50"
            : "border-gray-200 hover:border-gray-300"
        }`}
    >
      {popular && (
        <span className="absolute -top-3 left-6 bg-gray-900 text-white text-xs font-semibold px-3 py-1 rounded-full">
          Most Popular
        </span>
      )}

      {selected && (
        <span className="absolute -top-3 right-6 bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 size={12} /> Selected
        </span>
      )}

      <h3 className="text-lg font-semibold text-gray-900">{label}</h3>

      <div className="mt-3">
        <div className="text-sm text-gray-500">First month</div>

        <div className="text-2xl font-bold text-gray-900">
          ${money(trialTotal)}
        </div>
      </div>

      <div className="mt-2 text-sm text-gray-600">
        Then{" "}
        <span className="font-semibold text-gray-900">
          ${money(monthlyTotal)}/mo
        </span>{" "}
        {employeeCount ? `($${money(perLicense)}/license)` : ""}
      </div>

      <ul className="mt-4 space-y-2 flex-1">
        <li className="flex items-center gap-2 text-sm text-gray-700">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          {employeeCount || "Unlimited"} employee account
          {employeeCount !== 1 ? "s" : ""}
        </li>

        {employeeCount > 1 && (
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />1
            master account + {employeeCount - 1} RBAC seats
          </li>
        )}

        <li className="flex items-center gap-2 text-sm text-gray-700">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          Full access — quotes, invoicing, scheduling, analytics
        </li>

        {isDbPlan && plan.maxQuotesPerMonth && (
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            Up to {plan.maxQuotesPerMonth} quotes per month
          </li>
        )}

        {isDbPlan && plan.aiCopilotEnabled && (
          <li className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            AI copilot included
          </li>
        )}
      </ul>
    </button>
  );
}
