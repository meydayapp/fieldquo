"use client";

// Instant payout — Settings → Payments.
//
// Everything on this card is Stripe's answer relayed by
// /api/stripe/connect/instant-payout: gross, net, the destination card, and
// whether a payout is possible at all. The button sends NO amount (the route
// pays out Stripe's own net_available), is disabled while a request is in
// flight, and re-reads the balance afterwards so the card shows what is left
// rather than what it showed before.
//
// The "add a debit card" link goes through the existing Express login-link
// route rather than a hardcoded Stripe address, for the reason
// scripts/check-stripe-identity.mjs enforces: this page carries no Stripe
// URL a contractor could be misdirected to.

import { useCallback, useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS } from "@/lib/stripe/instantPayoutRules";

const REASONS_WITH_CARD_LINK = new Set(["no_external_account", "no_instant_destination"]);

export default function InstantPayoutCard({ connected, onOpenDashboard, openingDashboard }) {
  const { t } = useTranslation();
  const { money, formatDateTime } = useCompanyPreferences();
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setState(await fetchJson("/api/stripe/connect/instant-payout"));
    } catch (err) {
      setError(err.message || t("app.setPayments.statusError"));
    }
  }, [t]);

  useEffect(() => {
    if (connected) load();
  }, [connected, load]);

  if (!connected) return null;

  async function handlePayout() {
    if (sending) return;
    setError("");
    setSent(false);
    setSending(true);
    try {
      await fetchJson("/api/stripe/connect/instant-payout", { method: "POST" });
      setSent(true);
    } catch (err) {
      setError(err.message || t("app.setPayments.instantError"));
    } finally {
      setSending(false);
      await load();
    }
  }

  const reasonText = (reason, s) =>
    t(`app.setPayments.instantReason.${reason}`, {
      days: INSTANT_PAYOUT_MIN_ACCOUNT_AGE_DAYS,
      age: s?.accountAgeDays ?? "—",
    });

  return (
    <div data-tour="payments-instant" className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start gap-3">
        <Zap size={22} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground">{t("app.setPayments.instantTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("app.setPayments.instantIntro", { rate: state?.expectedRate || "1%" })}
          </p>

          {error && (
            <div className="mt-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {sent && (
            <p className="mt-3 text-sm text-green-700 dark:text-green-400">
              {t("app.setPayments.instantDone")}
            </p>
          )}

          {state && !state.eligible && state.reason && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">{reasonText(state.reason, state)}</p>
              {REASONS_WITH_CARD_LINK.has(state.reason) && (
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  disabled={openingDashboard}
                  className="mt-3 flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold hover:bg-muted disabled:opacity-60"
                >
                  {t("app.setPayments.instantAddCard")}
                </button>
              )}
            </div>
          )}

          {state?.eligible && (
            <>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.setPayments.instantAvailable")}
                  </dt>
                  <dd className="mt-1 tabular-nums text-foreground">{money(state.grossCents / 100)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.setPayments.instantFee")}
                  </dt>
                  <dd className="mt-1 tabular-nums text-foreground">
                    {t("app.setPayments.instantFeeReported", {
                      fee: money(state.feeCents / 100),
                      percent: state.feePercent ?? "—",
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("app.setPayments.instantNet")}
                  </dt>
                  <dd className="mt-1 tabular-nums font-semibold text-foreground">
                    {money(state.netCents / 100)}
                  </dd>
                </div>
              </dl>
              {state.destination && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("app.setPayments.instantDestination", {
                    kind: t(`app.setPayments.instantKind.${state.destination.kind || "card"}`),
                    last4: state.destination.last4 || "—",
                  })}
                </p>
              )}
              <button
                type="button"
                onClick={handlePayout}
                disabled={sending}
                className="mt-4 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {sending
                  ? t("app.setPayments.instantWorking")
                  : t("app.setPayments.instantButton", { amount: money(state.netCents / 100) })}
              </button>
            </>
          )}

          {state?.recent?.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("app.setPayments.instantRecent")}
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {state.recent.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span>{formatDateTime(r.createdAt)}</span>
                    <span className="tabular-nums">{money(r.netCents / 100)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
