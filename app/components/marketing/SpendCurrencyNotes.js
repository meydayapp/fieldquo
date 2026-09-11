// app/components/marketing/SpendCurrencyNotes.js
//
// The words under a marketing-spend figure that includes rows converted from
// another currency — shared by the Spend page and the KPI page's business-
// costs tile so the two cannot describe the same total differently. The
// numbers come from lib/analytics/spendCurrency.js; this file only says them.
"use client";

/**
 * Why an amount is NOT in a figure, in the reader's language — keyed on the
 * code lib/analytics/spendCurrency.js sends beside fx.js's English sentence,
 * so a French screen does not print an English refusal in a French frame.
 * Used by the Spend page and the KPI page, which print the same sentence.
 */
export function excludedSentence(t, x, amountText) {
  if (x.reasonCode === "stale_rate") {
    return t("app.marketingSpend.excludedStale", { amount: amountText, days: x.rateAgeDays, window: x.windowDays });
  }
  if (x.reasonCode === "no_rate") {
    return t("app.marketingSpend.excludedNoRate", { amount: amountText, currency: x.currency });
  }
  return t("app.marketingSpend.excludedOther", { amount: amountText, reason: x.reason });
}

/**
 * The sentences under a figure that includes converted rows: one per foreign
 * currency that converted ("includes US$821.50 converted at the pinned rate
 * (14 days old)"), one per currency the rate refused, with the amount left
 * out and fx.js's own reason. Shared by the blended card and the by-channel
 * table so the two cannot describe the same total differently.
 */
export function CurrencyNotes({ totals, t }) {
  const conversions = totals?.currencyConversions || [];
  const excluded = totals?.excluded || [];
  if (!conversions.length && !excluded.length) return null;
  return (
    <div className="space-y-1">
      {conversions.map((c) => (
        <p key={c.currency} className="text-[11px] text-muted-foreground">
          {t("app.marketingSpend.approxNote", {
            amount: new Intl.NumberFormat(undefined, { style: "currency", currency: c.currency }).format(c.amount),
            days: c.rateAgeDays,
          })}
        </p>
      ))}
      {excluded.map((x) => (
        <p key={x.currency} className="text-[11px] text-amber-700 dark:text-amber-400">
          {excludedSentence(t, x, new Intl.NumberFormat(undefined, { style: "currency", currency: x.currency }).format(x.amount))}
        </p>
      ))}
    </div>
  );
}
