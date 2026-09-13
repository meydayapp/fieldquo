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
import { publishedRates, publishedSurcharges, feeBreakdown } from "@/lib/stripe/processingFee";

// The example every contractor sees: a mid-sized job, paid by card.
const EXAMPLE_CENTS = 226_000;

export default function ProcessingFeesCard({ currency, offerFinancing, connected, bankDebit }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const rates = publishedRates(currency);
  const example = feeBreakdown({
    amountCents: EXAMPLE_CENTS,
    currency: String(currency || "cad").toLowerCase(),
    method: "card",
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
      {offerFinancing && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("app.setPayments.feesAffirmNote")}
        </p>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">{t("app.setPayments.feesRefundNote")}</p>
    </div>
  );
}
