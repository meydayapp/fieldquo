"use client";

// The rates a contractor pays on each client payment, said out loud BEFORE
// they connect — a contractor comparing FieldQuo to Jobber is used to seeing
// "2.9% + 30¢" on the page that asks for their bank details, and hiding it
// until the first payout is the kind of surprise that ends a trial.
//
// The figures come from lib/stripe/processingFee.js — the SAME constants the
// charge creators use — so this card cannot drift from what is actually
// deducted. The worked example runs the real function on a real amount for
// the same reason.

import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import {
  publishedRates,
  publishedSurcharges,
  feeBreakdown,
  financingFeeExample,
} from "@/lib/stripe/processingFee";

// The example every contractor sees: a mid-sized job, paid by card.
const EXAMPLE_CENTS = 226_000;
// The pay-over-time side-by-side: a round $1,000, card vs pay over time.
const FINANCING_EXAMPLE_CENTS = 100_000;
// Klarna's merchant rules on Stripe — "You can't impose fees or higher
// prices for Klarna purchases".
const KLARNA_RULES_URL = "https://docs.stripe.com/payments/klarna/compliance";

export default function ProcessingFeesCard({ currency, offerFinancing, connected, bankDebit }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const rates = publishedRates(currency);
  const example = feeBreakdown({
    amountCents: EXAMPLE_CENTS,
    currency: String(currency || "cad").toLowerCase(),
    method: "card",
  });
  // Pay over time, on a round $1,000 (the owner's example) — null when the
  // company's currency has no pay-over-time rate, and then nothing renders.
  const financingExample = financingFeeExample({
    amountCents: FINANCING_EXAMPLE_CENTS,
    currency: String(currency || "cad").toLowerCase(),
  });

  return (
    <div data-tour="payments-fees" className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-semibold text-foreground">{t("app.setPayments.feesTitle")}</h2>
      <p className="text-sm text-muted-foreground mt-1">{t("app.setPayments.feesIntro")}</p>

      <dl className="mt-4 divide-y divide-border">
        {rates.map((r) => (
          <div key={r.method} className="flex items-center justify-between py-2.5 text-sm">
            <dt className="text-foreground">{t(`app.setPayments.feeMethod.${r.method}`)}</dt>
            <dd className="tabular-nums font-medium text-foreground">{r.formula}</dd>
          </div>
        ))}
        {/* Stripe's two card surcharges, listed as Stripe publishes them —
            unknown until the card is charged, passed through at cost when
            they apply (lib/stripe/paymentIntentFee.js trues the fee up). */}
        {publishedSurcharges().map((x) => (
          <div key={x.kind} className="flex items-center justify-between py-2.5 text-sm">
            <dt className="text-muted-foreground">{t(`app.setPayments.surcharge.${x.kind}`)}</dt>
            <dd className="tabular-nums text-muted-foreground">{x.formula}</dd>
          </div>
        ))}
      </dl>
      {/* Which ways a client can actually pay an invoice today — read from
          Stripe's capability answer (status.bankDebit), so this sentence
          and the portal's buttons cannot disagree. */}
      {connected && (
        <p className="mt-3 text-sm text-foreground">
          {bankDebit
            ? t("app.setPayments.bankDebitOn", {
                method: t(`app.setPayments.bankDebitMethod.${bankDebit}`),
              })
            : t("app.setPayments.bankDebitOff")}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{t("app.setPayments.surchargeNote")}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{t("app.setPayments.accountFeesNote")}</p>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("app.setPayments.feesExample", {
          amount: money(EXAMPLE_CENTS / 100),
          fee: money(example.feeCents / 100),
          net: money(example.netCents / 100),
        })}
      </p>
      {/* Pay over time: WHO pays and HOW MUCH, as ONE number like the card
          (owner, 2026-10-09: a flat 6.5% + 30¢ to the company — never
          "5.99% to Stripe + 0.51% to FieldQuo"). Shown wherever the company
          could offer it — its currency has the rate — not only once the
          switch is on: the fee is part of deciding whether to switch it on.
          Every figure comes from lib/stripe/processingFee.js
          (FINANCING_RATE, financingFeeExample — the same functions
          settlement charges with), side by side with the card on one
          amount. Replaces the one-line "Affirm fee is passed through" note,
          which named neither the payer nor the amount. */}
      {financingExample && (
        <div data-financing-fees className="mt-4 rounded-lg border border-border px-3.5 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              {t("app.setPayments.feesFinancingLabel", { providers: financingExample.providers.join(" / ") })}
            </span>
            <span className="tabular-nums font-medium text-foreground">{financingExample.overTime.formula}</span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("app.setPayments.feesFinancingWho")}</p>
          <p className="mt-1.5 text-xs text-muted-foreground" data-financing-example>
            {t("app.setPayments.feesFinancingExample", {
              amount: money(financingExample.amountCents / 100),
              cardNet: money(financingExample.card.netCents / 100),
              overTimeNet: money(financingExample.overTime.netCents / 100),
            })}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("app.setPayments.feesFinancingNoPassOn")}{" "}
            <a
              href={KLARNA_RULES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {t("app.setPayments.feesFinancingRulesLink")}
            </a>
          </p>
          {!offerFinancing && (
            <p className="mt-1.5 text-xs text-muted-foreground">{t("app.setPayments.feesFinancingOff")}</p>
          )}
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">{t("app.setPayments.feesRefundNote")}</p>
    </div>
  );
}
