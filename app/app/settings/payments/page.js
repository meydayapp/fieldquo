// app/app/settings/payments/page.js
"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

export default function PaymentsPage() {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [error, setError] = useState("");

  function loadCompany() {
    return fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then(setCompany)
      .catch(() => setError("Could not load payment settings"));
  }

  useEffect(() => {
    loadCompany().finally(() => setLoading(false));
  }, []);

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      // fetchJson rather than res.json() — see lib/fetchJson.js. This call
      // was reporting "The string did not match the expected pattern" for
      // weeks, which was Safari's JSON parser choking on a 500 HTML page
      // caused by an unset NEXT_PUBLIC_APP_URL.
      const data = await fetchJson("/api/stripe/connect", { method: "POST" });
      if (!data?.url) throw new Error("Stripe didn't return an onboarding link.");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not connect Stripe");
      setConnecting(false);
    }
  }

  async function handleManageInStripe() {
    setError("");
    setOpeningDashboard(true);
    try {
      const data = await fetchJson("/api/stripe/connect/login-link", {
        method: "POST",
      });
      if (!data?.url) throw new Error("Stripe didn't return a dashboard link.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Could not open the Stripe dashboard");
    } finally {
      setOpeningDashboard(false);
    }
  }

  async function handleDisconnect() {
    setError("");
    setDisconnecting(true);
    try {
      await fetchJson("/api/stripe/connect/disconnect", { method: "POST" });
      await loadCompany();
    } catch (err) {
      setError(err.message || "Could not disconnect Stripe");
    } finally {
      setDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 bg-accent rounded" />
          <div className="h-32 bg-accent rounded-xl" />
        </div>
      </div>
    );
  }

  const notStarted = !company?.stripeAccountId;
  const inProgress = company?.stripeAccountId && !company?.stripeChargesEnabled;
  const active = company?.stripeChargesEnabled;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect Stripe so your clients can pay invoices online, directly to
          your bank account.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-6">
        {active && (
          <div className="flex items-start gap-3">
            <CheckCircle2
              size={22}
              className="text-green-600 dark:text-green-400 shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">
                  Stripe connected
                </h2>
                <span className="text-xs bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                  Active
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Your clients can pay invoices online, and payments go directly
                to your bank account via Stripe Express.
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleManageInStripe}
                  disabled={openingDashboard}
                  className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
                >
                  <ExternalLink size={14} />
                  {openingDashboard ? "Opening..." : "Manage in Stripe"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="text-sm font-medium text-red-600 dark:text-red-400 px-4 py-2 rounded-full hover:bg-red-50 dark:bg-red-950/40"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {inProgress && (
          <div className="flex items-start gap-3">
            <AlertCircle size={22} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-foreground">
                Onboarding incomplete
              </h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                You started connecting Stripe but haven't finished — Stripe
                needs a bit more information before you can accept payments.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {connecting ? "Redirecting..." : "Finish Setup"}
              </button>
            </div>
          </div>
        )}

        {notStarted && (
          <div className="flex items-start gap-3">
            <CreditCard size={22} className="text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-foreground">Not connected yet</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Stripe handles the actual payment processing — you'll enter your
                bank details on Stripe's own secure page, not here.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {connecting ? "Redirecting..." : "Connect with Stripe"}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        FieldQuo never sees or stores your bank account details — that
        information goes directly to Stripe.
      </p>

      {showDisconnectConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDisconnectConfirm(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} className="text-amber-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground text-center">
              Disconnect Stripe?
            </h2>
            <p className="text-sm text-muted-foreground text-center mt-1.5">
              Clients won't be able to pay invoices online until you reconnect.
              This only unlinks Stripe from FieldQuo — it does not delete or
              close your actual Stripe account, and nothing about your past
              payout history changes.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
