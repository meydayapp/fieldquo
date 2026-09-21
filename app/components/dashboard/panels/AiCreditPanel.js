// app/components/dashboard/panels/AiCreditPanel.js
//
// "Add AI credits", in the home page's dialog. The card is
// app/app/settings/ai-credit/AiCreditCard.js — the same balance, the same
// top-up buttons, the same POST Settings > AI credit renders — behind the
// same read.
//
// Buying credit hands the browser to Stripe Checkout, and Checkout comes
// back to the AI credit PAGE, not here: that page is where the payment is
// confirmed against Stripe before a balance is shown (its own `?aitopup=`
// effect), and the honest thing is to say so above the buttons rather than
// teach the dashboard a second copy of that confirmation. The set-up row
// leaves the card by itself on the next visit home, because the snapshot
// reads the balance (lib/setupStepsSnapshot.js).
//
// The bundle plans are not here. They are a monthly subscription with a
// cancel path of their own, on the page; the step is "add AI credits", and
// one top-up is that.
"use client";

import { useEffect, useState } from "react";
import AiCreditCard from "@/app/app/settings/ai-credit/AiCreditCard";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";

export default function AiCreditPanel() {
  const { t } = useTranslation();
  const [ai, setAi] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/settings/ai/credit")
      .then((data) => {
        if (!cancelled) setAi(data?.ai || null);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err?.message || t("app.setAiCredit.loadError", "Couldn't load AI credit."));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {loadError}
      </div>
    );
  }

  if (!ai) {
    return <div className="animate-pulse h-40 bg-accent rounded-xl" aria-busy="true" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "app.stepDialog.leavesForCheckout",
          "Buying credit opens Stripe Checkout in this window; you'll come back to the AI credit page with the payment confirmed.",
        )}
      </p>
      <AiCreditCard ai={ai} />
    </div>
  );
}
