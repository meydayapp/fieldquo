// app/components/dashboard/panels/StripeConnectPanel.js
//
// "Connect Stripe to accept client payments", in the home page's dialog.
//
// This is the step that cannot finish in a dialog: Stripe's hosted Connect
// onboarding takes the whole browser. So the dialog says so, in one sentence
// above the card, and the card is the SAME four-state card Settings >
// Payments draws (app/app/settings/payments/StripeConnectCard.js) run by the
// same hook (useStripeConnect) — with one difference the hook is told about:
// `returnTo: "home"`, so Stripe sends the browser back to the dashboard the
// reader left, where the page re-reads the checklist (app/app/page.js reads
// `?connected=true`) and the row ticks itself.
//
// No disconnect here. That is a page's decision with a confirm behind it,
// and this dialog is for a company that has not connected yet.
"use client";

import { useEffect } from "react";
import useStripeConnect from "@/app/app/settings/payments/useStripeConnect";
import StripeConnectCard, { connectState } from "@/app/app/settings/payments/StripeConnectCard";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function StripeConnectPanel({ onChanged }) {
  const { t } = useTranslation();
  const {
    company,
    status,
    loading,
    rechecking,
    connecting,
    openingDashboard,
    error,
    recheck,
    handleConnect,
    handleManageInStripe,
  } = useStripeConnect({ returnTo: "home" });

  // "Already done" pressed and Stripe says yes: the checklist should hear.
  const { active } = connectState(status, company);
  useEffect(() => {
    if (active) onChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "app.stepDialog.leavesForStripe",
          "This step opens Stripe in this window; you'll come back here after.",
        )}
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse h-32 bg-accent rounded-xl" aria-busy="true" />
      ) : (
        <StripeConnectCard
          status={status}
          company={company}
          connecting={connecting}
          rechecking={rechecking}
          openingDashboard={openingDashboard}
          onConnect={handleConnect}
          onRecheck={recheck}
          onManage={handleManageInStripe}
        />
      )}
    </div>
  );
}
