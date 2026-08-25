"use client";

// app/app/plans/page.js
//
// Recurring work sold as a package: spring + fall gutter cleaning, seasonal
// lawn care, a quarterly maintenance visit.
//
// Every row says how it gets paid, in words. A plan set to charge automatically
// that has no mandate yet says so on the row — not with a blank, not with a
// hopeful "Automatic" badge. That distinction is the whole feature: asking for
// automatic payment is a request, having the client's authorisation is a
// capability, and a screen that shows them as the same thing is how a
// contractor comes to believe money is arriving when it isn't.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CalendarSync, Plus, ArrowRight, CreditCard, FileText, AlertTriangle } from "lucide-react";
import { fetchArray } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { useTranslation } from "@/app/hooks/useTranslation";
import { moneyFormatter } from "@/lib/format/money";

const STATUS_STYLES = {
  active: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  completed: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function ServicePlansPage() {
  const { t, language } = useTranslation();
  const [company, setCompany] = useState(null);
  // The COMPANY's billing currency, the READER's locale — see lib/format/money.js.
  const money = moneyFormatter(company?.currency, language);
  // null until the server answers — see lib/loadState.js.
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray("/api/service-plans");
    if (result.aborted) return;
    if (result.ok) setPlans(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/settings/business-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCompany(d))
      .catch(() => {});
  }, [load]);

  // The one sentence per row that says how this plan actually collects. Every
  // branch names a real state; there is no fallthrough that renders nothing.
  const collection = (plan) => {
    if (!plan.automatic.requested) {
      return { icon: FileText, text: t("app.plans.collectInvoice"), warn: false };
    }
    switch (plan.automatic.blockedReason) {
      case null:
        return {
          icon: CreditCard,
          text: t("app.plans.collectAuto", {
            method: [plan.automatic.method?.brand, plan.automatic.method?.last4]
              .filter(Boolean)
              .join(" ····"),
          }),
          warn: false,
        };
      case "no_consent":
        return { icon: AlertTriangle, text: t("app.plans.awaitingConsent"), warn: true };
      case "awaiting_payment_method":
        return { icon: AlertTriangle, text: t("app.plans.awaitingMethod"), warn: true };
      case "revoked":
        return { icon: AlertTriangle, text: t("app.plans.methodRemoved"), warn: true };
      default:
        return { icon: FileText, text: t("app.plans.collectInvoice"), warn: false };
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.plans.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.plans.subtitle")}</p>
        </div>
        <Link
          href="/app/plans/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> {t("app.plans.new")}
        </Link>
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={plans !== null && plans.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <CalendarSync size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">{t("app.plans.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {t("app.plans.emptyBody")}
            </p>
          </div>
        }
      >
        <div className="space-y-3">
          {(plans ?? []).map((plan) => {
            const how = collection(plan);
            const Icon = how.icon;
            return (
              <Link
                key={plan.id}
                href={`/app/plans/${plan.id}`}
                className="block bg-card border border-border rounded-xl p-4 hover:border-inverted transition-colors"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{plan.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[plan.status] || "bg-muted text-muted-foreground"}`}
                      >
                        {t(`app.plans.status.${plan.status}`)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.client?.name} · {t(`app.plans.freq.${plan.frequency}`)} ·{" "}
                      {money(plan.perOccurrence.total)} {t("app.plans.perVisit")}
                    </p>
                    <p
                      className={`text-sm mt-1 flex items-center gap-1.5 ${
                        how.warn ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                      }`}
                    >
                      <Icon size={14} /> {how.text}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {/* An open-ended plan has no term total, and the screen says
                        the cadence instead of inventing one — see termTotals. */}
                    {plan.term ? (
                      <p className="text-sm font-semibold text-foreground">
                        {money(plan.term.total)}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("app.plans.openEnded")}</p>
                    )}
                    {plan.discountPct > 0 && (
                      <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                        {t("app.plans.discountBadge", { pct: plan.discountPct })}
                      </p>
                    )}
                    <ArrowRight size={16} className="inline-block mt-2 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </ListState>
    </div>
  );
}
