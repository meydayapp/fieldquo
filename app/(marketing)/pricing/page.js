// app/(marketing)/pricing/page.js
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";

// Server component — reads live from the Plan table so this page can never drift
// from what companies actually get charged. If you add/edit a plan in /platform,
// this page reflects it on next request, no code deploy needed.
export default async function PricingPage() {
  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Every plan includes quotes, invoicing, and scheduling. Pick the plan
          that matches the size of your team.
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="text-center text-gray-500 border border-gray-200 rounded-xl p-12">
          Pricing plans are being finalized — check back shortly, or{" "}
          <Link href="/contact" className="underline">
            contact us
          </Link>{" "}
          for early access pricing.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const features = plan.features || {};
            return (
              <div
                key={plan.id}
                className="border border-gray-200 rounded-2xl p-8 flex flex-col hover:border-gray-300 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    ${Number(plan.priceMonthly).toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>

                <ul className="mt-6 space-y-2.5 flex-1">
                  {plan.maxUsers && (
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2
                        size={16}
                        className="text-green-600 shrink-0"
                      />
                      Up to {plan.maxUsers} team members
                    </li>
                  )}
                  {plan.maxQuotesPerMonth && (
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2
                        size={16}
                        className="text-green-600 shrink-0"
                      />
                      {plan.maxQuotesPerMonth} quotes/month
                    </li>
                  )}
                  {plan.aiCopilotEnabled && (
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2
                        size={16}
                        className="text-green-600 shrink-0"
                      />
                      AI business Copilot
                    </li>
                  )}
                  {Object.entries(features).map(([key, val]) =>
                    val ? (
                      <li
                        key={key}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {key.replace(/_/g, " ")}
                      </li>
                    ) : null,
                  )}
                </ul>

                <Link
                  href={`/signup?plan=${plan.id}`}
                  className="mt-8 text-center bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-gray-800"
                >
                  Start Free Trial
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
