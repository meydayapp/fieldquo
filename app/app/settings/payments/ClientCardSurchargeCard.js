"use client";

// Settings → Payments → "Pass the card fee on to clients (credit cards only)"
// — Company.clientCardSurcharge. Off by default: the company absorbs the
// card fee, as every company did before this existed.
//
// Not to be confused with the processing-fee card above (what the contractor
// pays Stripe, and Stripe's own international/conversion surcharges) or with
// "3% off for e-transfer or cheque" (a discount, Quebec-safe) in the methods
// card: this is a fee the CLIENT pays, on credit cards only, and the two
// other settings are untouched by it.
//
// Rendered only for a Canadian company (rule 8 in
// lib/stripe/clientCardSurcharge.js: no switch at all for a US company). For
// a Quebec company, or one whose province is not on file, the card explains
// why it cannot be switched on rather than offering a switch that would be
// refused. Switching on requires the 30-day processor notice to be confirmed;
// the route records who and when.

import { useEffect, useState } from "react";
import { AlertCircle, Check, Minus, ExternalLink } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney, useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { feeBreakdown } from "@/lib/stripe/processingFee";
import {
  CLIENT_CARD_FLOWS,
  CLIENT_CARD_SURCHARGE_MAX_BPS,
  clientCardSurchargeCents,
  surchargeRatePercent,
} from "@/lib/stripe/clientCardSurcharge";

// The worked example: a $1,000 invoice paid by credit card, run through the
// SAME functions the charge uses, so the card cannot drift from what is
// actually charged and deducted.
const EXAMPLE_CENTS = 100_000;

// Sources the contractor can read themselves — each one verified 2026-10-05
// and cited in lib/stripe/clientCardSurcharge.js.
const LINKS = Object.freeze([
  { key: "cfib", href: "https://www.cfib-fcei.ca/surcharging" },
  { key: "stripe", href: "https://stripe.com/en-ca/resources/more/surcharge-fees" },
  {
    key: "cra",
    href: "https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/gi-200/application-gst-hst-credit-card-surcharges.html",
  },
]);

// Literal keys per flow, so check:translations can see each one is used.
function flowLabel(t, key) {
  switch (key) {
    case "portalInvoice":
      return t("app.setPayments.clientCardFee.flow.portalInvoice");
    case "paymentStage":
      return t("app.setPayments.clientCardFee.flow.paymentStage");
    case "officeCheckoutLink":
      return t("app.setPayments.clientCardFee.flow.officeCheckoutLink");
    case "affirm":
      return t("app.setPayments.clientCardFee.flow.affirm");
    case "bankDebit":
      return t("app.setPayments.clientCardFee.flow.bankDebit");
    case "bookingFee":
      return t("app.setPayments.clientCardFee.flow.bookingFee");
    case "servicePlan":
      return t("app.setPayments.clientCardFee.flow.servicePlan");
    default:
      return key;
  }
}

function linkLabel(t, key) {
  switch (key) {
    case "cfib":
      return t("app.setPayments.clientCardFee.link.cfib");
    case "stripe":
      return t("app.setPayments.clientCardFee.link.stripe");
    case "cra":
      return t("app.setPayments.clientCardFee.link.cra");
    default:
      return key;
  }
}

export default function ClientCardSurchargeCard({ currency }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const { formatDate } = useCompanyPreferences();
  const [state, setState] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/settings/client-card-surcharge")
      .then((d) => {
        if (!cancelled) setState(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || t("app.setPayments.clientCardFee.loadError"));
      });
    return () => {
      cancelled = true;
    };
    // Loaded once per visit to the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(enabled) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const next = await fetchJson("/api/settings/client-card-surcharge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enabled ? { enabled: true, noticeConfirmed: confirmed } : { enabled: false }),
      });
      setState(next);
      setConfirmed(false);
    } catch (err) {
      setError(err.message || t("app.setPayments.clientCardFee.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (error && !state) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }
  // A US company (or any non-Canadian one) gets no card at all — rule 8.
  if (!state || !state.shown) return null;

  const pct = surchargeRatePercent(CLIENT_CARD_SURCHARGE_MAX_BPS);
  const cur = String(currency || "cad").toLowerCase();
  const fee = clientCardSurchargeCents(EXAMPLE_CENTS, { currency: cur });
  const on = feeBreakdown({ amountCents: EXAMPLE_CENTS + fee, currency: cur, method: "card" });
  const off = feeBreakdown({ amountCents: EXAMPLE_CENTS, currency: cur, method: "card" });
  const blocked = !state.allowed
    ? state.reason === "company_quebec"
      ? t("app.setPayments.clientCardFee.blockedQuebec")
      : t("app.setPayments.clientCardFee.blockedRegion")
    : !state.formReady
      ? t("app.setPayments.clientCardFee.notReady")
      : null;

  return (
    <div data-client-card-fee-card className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-semibold text-foreground">{t("app.setPayments.clientCardFee.title")}</h2>
      <p className="text-sm text-muted-foreground mt-1">{t("app.setPayments.clientCardFee.intro", { pct })}</p>

      <p className="text-sm text-foreground mt-3" data-client-card-fee-example>
        {t("app.setPayments.clientCardFee.example", {
          base: money(EXAMPLE_CENTS / 100),
          total: money((EXAMPLE_CENTS + fee) / 100),
          fee: money(fee / 100),
          procOn: money(on.feeCents / 100),
          netOn: money(on.netCents / 100),
          netOff: money(off.netCents / 100),
        })}
      </p>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-5">
        {t("app.setPayments.clientCardFee.rulesTitle")}
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm text-foreground list-disc pl-5">
        <li>{t("app.setPayments.clientCardFee.ruleCanada")}</li>
        <li>{t("app.setPayments.clientCardFee.ruleCredit")}</li>
        <li>{t("app.setPayments.clientCardFee.ruleCap", { pct })}</li>
        <li>{t("app.setPayments.clientCardFee.ruleTax")}</li>
        <li>{t("app.setPayments.clientCardFee.ruleRefund")}</li>
      </ul>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-5">
        {t("app.setPayments.clientCardFee.whereTitle")}
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {CLIENT_CARD_FLOWS.map((flow) => (
          <li key={flow.key} data-flow={flow.key} className="flex items-start gap-2">
            {flow.surcharged ? (
              <Check size={15} className="shrink-0 mt-0.5 text-green-700 dark:text-green-400" />
            ) : (
              <Minus size={15} className="shrink-0 mt-0.5 text-muted-foreground" />
            )}
            <span className={flow.surcharged ? "text-foreground" : "text-muted-foreground"}>
              {flowLabel(t, flow.key)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm space-y-2">
        <p className="font-semibold text-foreground">{t("app.setPayments.clientCardFee.noticeTitle")}</p>
        <p className="text-muted-foreground">{t("app.setPayments.clientCardFee.noticeBody")}</p>
        <ul className="space-y-1">
          {LINKS.map((l) => (
            <li key={l.key}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline"
              >
                {linkLabel(t, l.key)} <ExternalLink size={12} />
              </a>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4" data-client-card-fee-status={state.on ? "on" : "off"}>
        {state.on ? (
          <>
            <p className="text-sm text-green-700 dark:text-green-400">
              {t("app.setPayments.clientCardFee.statusOn", {
                name: state.confirmedByName || "—",
                date: state.confirmedAt ? formatDate(new Date(state.confirmedAt)) : "—",
              })}
            </p>
            {!state.stripeConnected && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                {t("app.setPayments.clientCardFee.notConnected")}
              </p>
            )}
            <button
              type="button"
              onClick={() => save(false)}
              disabled={saving}
              className="mt-3 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {t("app.setPayments.clientCardFee.turnOff")}
            </button>
          </>
        ) : blocked ? (
          <p className="text-sm text-amber-700 dark:text-amber-400" data-client-card-fee-blocked>
            {blocked}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("app.setPayments.clientCardFee.statusOff")}</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>{t("app.setPayments.clientCardFee.confirmLabel")}</span>
            </label>
            {!state.stripeConnected && (
              <p className="text-xs text-muted-foreground mt-2">{t("app.setPayments.clientCardFee.notConnected")}</p>
            )}
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving || !confirmed}
              className="mt-3 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {t("app.setPayments.clientCardFee.turnOn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
