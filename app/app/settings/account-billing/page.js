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
        <div className="h-8 w-56 bg-accent rounded" />
        <div className="h-40 bg-accent rounded-xl" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  const isTrialing = subscription?.status === "trialing";
  const trialDays = isTrialing ? daysLeft(subscription.trialEndsAt) : null;
  const currentPlanId = subscription?.plan?.id;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account & Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your plan, seats, and payment details.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Current plan */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {subscription?.plan?.name || "No active plan"}
              </h2>
              {subscription?.status && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    isTrialing
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                      : subscription.status === "active"
                        ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {subscription.status}
                </span>
              )}
            </div>
            {subscription?.plan && (
              <p className="text-sm text-muted-foreground mt-1">
                {money(subscription.plan.priceMonthly)}/month
                {subscription.plan.maxUsers
                  ? ` · up to ${subscription.plan.maxUsers} users`
                  : ""}
              </p>
            )}
            {isTrialing && trialDays !== null && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 font-medium">
                Trial ends in {trialDays} day{trialDays === 1 ? "" : "s"}
              </p>
            )}
            {!isTrialing && subscription?.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground mt-2">
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
            className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            <ExternalLink size={14} />
            {openingPortal ? "Opening..." : "Manage billing & payment method"}
          </button>
          {subscription?.status && subscription.status !== "canceled" && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-sm font-medium text-red-600 dark:text-red-400 px-4 py-2 rounded-full hover:bg-red-50 dark:bg-red-950/40"
            >
              Cancel plan
            </button>
          )}
        </div>
      </div>

      {/* Available plans */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Plans</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div
                key={plan.id}
                className={`border rounded-xl p-4 ${
                  isCurrent ? "border-inverted" : "border-border"
                }`}
              >
                <h3 className="font-semibold text-foreground">{plan.name}</h3>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {money(plan.priceMonthly)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                {plan.maxUsers && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Up to {plan.maxUsers} users
                  </p>
                )}
                {plan.aiCopilotEnabled && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    FieldQuo AI included
                  </p>
                )}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || busyPlanId === plan.id}
                  className={`w-full mt-3 py-2 rounded-full text-sm font-semibold disabled:opacity-60 ${
                    isCurrent
                      ? "bg-muted text-muted-foreground"
                      : "bg-inverted text-inverted-foreground"
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
            <p className="text-sm text-muted-foreground col-span-3">
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
            className="bg-card rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} className="text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground text-center">
              Cancel your plan?
            </h2>
            <p className="text-sm text-muted-foreground text-center mt-1.5">
              You'll keep access until the end of your current billing period,
              then your account will be downgraded.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
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
