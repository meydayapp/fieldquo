// app/app/settings/payments/useStripeConnect.js
//
// The Stripe Connect state of Settings > Payments — what Stripe says about
// the account, and the three things a contractor can do about it (start or
// finish onboarding, re-check, open the Express dashboard) — as a hook,
// because the home page's "Connect Stripe to accept client payments" dialog
// runs the same flow (app/components/dashboard/stepPanels.js). One hook, not
// a second copy of loadStatus and handleConnect: the dialog asks Stripe the
// same question and starts the same hosted flow, so it cannot drift into
// telling a connected company it is not connected.
//
// `returnTo` is where Stripe sends the browser back to. The page passes
// nothing and comes back to itself; the dialog passes "home" so the reader
// lands on the dashboard they left, where the checklist re-reads itself. It
// is a NAME, not a URL — the route maps it to one of two paths it owns, so
// a browser can never hand Stripe an address of its choosing.
"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function useStripeConnect({ returnTo } = {}) {
  const { t } = useTranslation();
  const [company, setCompany] = useState(null);
  // What Stripe itself says, as opposed to what our database last heard. See
  // the comment on loadStatus below — these disagreeing is the normal case,
  // not the exception.
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [error, setError] = useState("");

  // fetchJson, not `fetch().then(r => r.json())`. Unguarded, a 403 or 500 body
  // is `{ error: "…" }` — an object, so `setCompany` succeeded, and every read
  // off it (`company.stripeAccountId`, `company.offerFinancing`) came back
  // undefined. The page then drew "Not connected to Stripe" with a Connect
  // button, to a company that has been taking card payments for a year, with
  // no error anywhere on screen.
  function loadCompany() {
    return fetchJson("/api/settings/business-info")
      .then(setCompany)
      .catch((err) => setError(err.message || t("app.setPayments.loadError")));
  }

  /**
   * Ask Stripe directly.
   *
   * The company row's stripeChargesEnabled is only ever written by the
   * account.updated webhook. If that webhook isn't wired up — no Connect
   * endpoint, wrong secret, or an endpoint not listening for events on
   * connected accounts — the column stays false permanently even though
   * Stripe has approved the account. The page then tells the user to finish
   * something they already finished, and no amount of clicking "Finish Setup"
   * can ever clear it.
   *
   * So the badge is driven by this call, and the webhook is just the
   * background path for when nobody has the page open.
   */
  async function loadStatus() {
    try {
      setStatus(await fetchJson("/api/stripe/connect/status"));
    } catch (err) {
      setError(err.message || t("app.setPayments.statusError"));
    }
  }

  async function recheck() {
    setError("");
    setRechecking(true);
    await Promise.all([loadStatus(), loadCompany()]);
    setRechecking(false);
  }

  useEffect(() => {
    Promise.all([loadCompany(), loadStatus()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coming back from Stripe's hosted flow. The account was almost certainly
  // updated seconds ago, and the webhook may not have landed yet — so check
  // rather than render whatever the database happened to hold. The parameter
  // is then stripped so a refresh doesn't repeat it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.get("connected")) return;

    loadStatus();
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setError("");
    setConnecting(true);
    try {
      // fetchJson rather than res.json() — see lib/fetchJson.js. This call
      // was reporting "The string did not match the expected pattern" for
      // weeks, which was Safari's JSON parser choking on a 500 HTML page
      // caused by an unset NEXT_PUBLIC_APP_URL.
      const data = await fetchJson("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(returnTo ? { returnTo } : {}),
      });
      if (!data?.url) throw new Error(t("app.setPayments.noOnboardingLink"));
      window.location.href = data.url;
    } catch (err) {
      // FieldQuo's own Stripe setup is unfinished (the route says which):
      // say so in the contractor's words, and that nothing else is blocked.
      if (err?.data?.platformSetup) {
        setError(t("app.setPayments.platformSetup"));
      } else {
        setError(err.message || t("app.setPayments.connectError"));
      }
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
      if (!data?.url) throw new Error(t("app.setPayments.noDashboardLink"));
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || t("app.setPayments.dashboardError"));
    } finally {
      setOpeningDashboard(false);
    }
  }

  return {
    company,
    setCompany,
    status,
    loading,
    rechecking,
    connecting,
    openingDashboard,
    error,
    setError,
    loadCompany,
    loadStatus,
    recheck,
    handleConnect,
    handleManageInStripe,
  };
}
