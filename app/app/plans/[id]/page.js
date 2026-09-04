"use client";

// app/app/plans/[id]/page.js
//
// One service plan: what was sold, what has been billed, how it collects, and
// the two controls that change any of that — ask the client for a payment
// method, and cancel.
//
// ── Both controls do the thing ──────────────────────────────────────────────
//
// "Ask for a payment method" sends a real email with a real link to a real
// Stripe-hosted setup flow, and the panel afterwards reports what the client has
// actually done — agreed and saved a card, agreed and abandoned the form, or not
// opened it at all. It never renders "automatic" as a settled fact because
// somebody ticked a radio button on the create form.
//
// "Cancel plan" stops future occurrences, revokes the authorisation and detaches
// the payment method at Stripe. The confirmation says all three, and the result
// reports whether the detach succeeded.

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CreditCard, FileText, AlertTriangle, Send, Ban, CheckCircle2,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { moneyFormatter } from "@/lib/format/money";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";

const OCCURRENCE_STYLES = {
  paid: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  charging: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  invoiced: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  failed: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  pending: "bg-muted text-muted-foreground",
};

export default function ServicePlanPage() {
  const { t, language } = useTranslation();
  // The currency comes from the same provider the dates already did. This page
  // was reading formatDate from here and STILL fetching business-info of its
  // own for the currency — and that fetch's failure was swallowed, which meant
  // a euro company saw its plan prices in dollars whenever the settings call
  // was refused. The provider is seeded server-side, so the first paint is
  // already correct.
  const { formatDate, currency } = useCompanyPreferences();
  const { id } = useParams();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const money = moneyFormatter(currency, language);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await fetchJson(`/api/service-plans/${id}`));
      setError("");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const askForMethod = async () => {
    setBusy("ask");
    setError("");
    setNotice("");
    try {
      const res = await fetchJson(`/api/service-plans/${id}/authorise`, { method: "POST" });
      setNotice(t("app.plans.askSent", { email: res.to }));
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy("");
  };

  const removeMethod = async () => {
    setBusy("remove");
    setError("");
    setNotice("");
    try {
      const res = await fetchJson(`/api/service-plans/${id}/authorise`, { method: "DELETE" });
      setNotice(
        res.paymentMethodRemoved
          ? t("app.plans.methodRemovedOk")
          : t("app.plans.methodRemovedPartial"),
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy("");
  };

  const cancelPlan = async () => {
    setBusy("cancel");
    setError("");
    setNotice("");
    try {
      const res = await fetchJson(`/api/service-plans/${id}/cancel`, { method: "POST" });
      setConfirmCancel(false);
      // The plan IS stopped either way — that half never depended on Stripe.
      // The distinction is whether the saved card was also detached, and a
      // failure there is reported rather than smoothed over: somebody should be
      // able to see that an instrument is still sitting on the customer record.
      const strandedMethod =
        res.paymentMethodRemoved === false &&
        res.paymentMethodRemovalReason &&
        res.paymentMethodRemovalReason !== "no_payment_method";
      setNotice(
        strandedMethod ? t("app.plans.cancelledPartial") : t("app.plans.cancelledOk"),
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy("");
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="h-24 bg-accent rounded-xl" />
          <div className="h-40 bg-accent rounded-xl" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error || t("app.load.notFound")}
        </p>
      </div>
    );
  }

  // The automatic-collection panel. Every branch says something true; there is
  // no state that renders an empty box.
  const auto = plan.automatic;
  const autoState = !auto.requested
    ? "invoice"
    : auto.blockedReason === null
      ? "live"
      : auto.blockedReason;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/app/plans"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> {t("app.plans.back")}
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{plan.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plan.client?.name} · {plan.serviceName} · {t(`app.plans.freq.${plan.frequency}`)}
          </p>
        </div>
        {plan.status === "active" && (
          <button
            onClick={() => setConfirmCancel(true)}
            className="flex items-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
          >
            <Ban size={16} /> {t("app.plans.cancel")}
          </button>
        )}
      </div>

      {notice && (
        <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 rounded-lg px-3 py-2">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* ── What was sold ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 grid sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("app.plans.perVisitLabel")}</p>
          <p className="text-lg font-semibold text-foreground">
            {money(plan.perOccurrence.total)}
          </p>
          {plan.discountPct > 0 && (
            <p className="text-xs text-green-700 dark:text-green-300">
              {t("app.plans.discountApplied", {
                pct: plan.discountPct,
                amount: money(plan.perOccurrence.discount),
              })}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("app.plans.termLabel")}</p>
          {plan.term ? (
            <>
              <p className="text-lg font-semibold text-foreground">{money(plan.term.total)}</p>
              <p className="text-xs text-muted-foreground">
                {t("app.plans.termVisits", { count: plan.term.occurrences })}
              </p>
            </>
          ) : (
            // Open-ended: there IS no term total, and saying so beats a zero.
            <p className="text-sm text-muted-foreground mt-1">{t("app.plans.openEnded")}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("app.plans.nextLabel")}</p>
          <p className="text-lg font-semibold text-foreground">
            {plan.nextDueDate ? formatDate(plan.nextDueDate) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {plan.blockedReason
              ? t(`app.plans.blocked.${plan.blockedReason}`)
              : t("app.plans.nextScheduled")}
          </p>
        </div>
      </div>

      {/* ── How it collects ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {autoState === "live" ? <CreditCard size={16} /> : <FileText size={16} />}
          {t("app.plans.collectionTitle")}
        </h2>

        {autoState === "invoice" && (
          <p className="text-sm text-muted-foreground">{t("app.plans.stateInvoice")}</p>
        )}
        {autoState === "live" && (
          <p className="text-sm text-foreground flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
            {t("app.plans.stateLive", {
              method: [auto.method?.brand, auto.method?.last4].filter(Boolean).join(" ····"),
              date: auto.acceptedAt ? formatDate(auto.acceptedAt) : "",
            })}
          </p>
        )}
        {(autoState === "no_consent" ||
          autoState === "awaiting_payment_method" ||
          autoState === "revoked") && (
          <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {t(`app.plans.state.${autoState}`)}
          </p>
        )}

        {plan.status === "active" && (
          <div className="flex gap-2 flex-wrap pt-1">
            {autoState !== "live" && (
              <button
                onClick={askForMethod}
                disabled={busy === "ask"}
                className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
              >
                <Send size={15} />
                {busy === "ask"
                  ? t("app.plans.asking")
                  : autoState === "invoice"
                    ? t("app.plans.askFirst")
                    : t("app.plans.askAgain")}
              </button>
            )}
            {autoState === "live" && (
              <button
                onClick={removeMethod}
                disabled={busy === "remove"}
                className="border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
              >
                {busy === "remove" ? t("app.plans.removing") : t("app.plans.removeMethod")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── What has actually been billed ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t("app.plans.historyTitle")}
        </h2>
        {plan.occurrences.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("app.plans.historyEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {plan.occurrences.map((o) => (
              <li key={o.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-foreground">
                    {formatDate(o.dueDate)} · {money(o.total)}
                  </p>
                  {o.chargeFailureMessage && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      {o.chargeFailureMessage}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${OCCURRENCE_STYLES[o.status] || "bg-muted text-muted-foreground"}`}
                  >
                    {t(`app.plans.occ.${o.status}`)}
                  </span>
                  {o.invoiceId && (
                    <Link
                      href={`/app/invoices/${o.invoiceId}`}
                      className="text-sm text-muted-foreground underline"
                    >
                      {t("app.plans.viewInvoice")}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("app.plans.cancelTitle")}
            </h3>
            {/* Says all three consequences, because all three happen. */}
            <p className="text-sm text-muted-foreground">{t("app.plans.cancelBody")}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmCancel(false)}
                className="px-4 py-2 rounded-full text-sm border border-border text-foreground"
              >
                {t("app.plans.keep")}
              </button>
              <button
                onClick={cancelPlan}
                disabled={busy === "cancel"}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-red-600 text-white disabled:opacity-50"
              >
                {busy === "cancel" ? t("app.plans.cancelling") : t("app.plans.cancelConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {plan.status !== "active" && (
        <p className="text-sm text-muted-foreground">
          {t(`app.plans.closedNote.${plan.status}`)}
        </p>
      )}
    </div>
  );
}
