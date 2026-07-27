// app/app/settings/account-billing/page.js
"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";

function money(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

function daysLeft(date) {
  if (!date) return null;
  return Math.max(
    0,
    Math.ceil((new Date(date).getTime() - Date.now()) / 86400000),
  );
}

export default function AccountBillingPage() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyPlanId, setBusyPlanId] = useState(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  function load() {
    return Promise.all([
      fetch("/api/settings/subscription").then((r) => r.json()),
      fetch("/api/settings/plans").then((r) => (r.ok ? r.json() : [])),
    ]).then(([sub, planList]) => {
      setSubscription(sub);
      setPlans(Array.isArray(planList) ? planList : []);
    });
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(planId) {
    setError("");
    setBusyPlanId(planId);
    try {
      const res = await fetch("/api/platform/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBusyPlanId(null);
    }
  }

  async function handleManageBilling() {
    setError("");
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/platform/billing/portal", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Could not open billing portal");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setOpeningPortal(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/platform/billing/cancel", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-56 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const isTrialing = subscription?.status === "trialing";
  const trialDays = isTrialing ? daysLeft(subscription.trialEndsAt) : null;
  const currentPlanId = subscription?.plan?.id;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account & Billing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your plan, seats, and payment details.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Current plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                {subscription?.plan?.name || "No active plan"}
              </h2>
              {subscription?.status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    isTrialing
                      ? "bg-amber-50 text-amber-700"
                      : subscription.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {subscription.status}
                </span>
              )}
            </div>
            {subscription?.plan && (
              <p className="text-sm text-gray-500 mt-1">
                {money(subscription.plan.priceMonthly)}/month
                {subscription.plan.maxUsers
                  ? ` · up to ${subscription.plan.maxUsers} users`
                  : ""}
              </p>
            )}
            {isTrialing && trialDays !== null && (
              <p className="text-sm text-amber-700 mt-2 font-medium">
                Trial ends in {trialDays} day{trialDays === 1 ? "" : "s"}
              </p>
            )}
            {!isTrialing && subscription?.currentPeriodEnd && (
              <p className="text-xs text-gray-400 mt-2">
                Next billing date{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={handleManageBilling}
            disabled={openingPortal}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
          >
            <ExternalLink size={14} />
            {openingPortal ? "Opening..." : "Manage billing & payment method"}
          </button>
          {subscription?.status && subscription.status !== "canceled" && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-sm font-medium text-red-600 px-4 py-2 rounded-full hover:bg-red-50"
            >
              Cancel plan
            </button>
          )}
        </div>
      </div>

      {/* Available plans */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Plans</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div
                key={plan.id}
                className={`border rounded-xl p-4 ${
                  isCurrent ? "border-gray-900" : "border-gray-200"
                }`}
              >
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {money(plan.priceMonthly)}
                  <span className="text-sm font-normal text-gray-400">/mo</span>
                </p>
                {plan.maxUsers && (
                  <p className="text-xs text-gray-500 mt-1">
                    Up to {plan.maxUsers} users
                  </p>
                )}
                {plan.aiCopilotEnabled && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    AI Copilot included
                  </p>
                )}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || busyPlanId === plan.id}
                  className={`w-full mt-3 py-2 rounded-full text-sm font-semibold disabled:opacity-60 ${
                    isCurrent
                      ? "bg-gray-100 text-gray-500"
                      : "bg-gray-900 text-white"
                  }`}
                >
                  {isCurrent
                    ? "Current plan"
                    : busyPlanId === plan.id
                      ? "Redirecting..."
                      : "Choose plan"}
                </button>
              </div>
            );
          })}
          {plans.length === 0 && (
            <p className="text-sm text-gray-400 col-span-3">
              No plans configured yet.
            </p>
          )}
        </div>
      </div>

      {showCancelConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCancelConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} className="text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 text-center">
              Cancel your plan?
            </h2>
            <p className="text-sm text-gray-500 text-center mt-1.5">
              You'll keep access until the end of your current billing period,
              then your account will be downgraded.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-semibold"
              >
                Keep plan
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Cancel plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
