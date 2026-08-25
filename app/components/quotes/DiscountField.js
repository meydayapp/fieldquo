// app/components/quotes/DiscountField.js
//
// "Take something off this quote", on the builder and on the editor.
//
// ── One stored representation, two ways to type it ──────────────────────────
//
// `Quote.discount` is a flat amount, and so is `Invoice.discount`; the shared
// TotalsSection prints it as `-$500.00` on the PDF, the email and the portal.
// So an amount is what this writes, always.
//
// Percent is offered because contractors say "ten percent off", not "four
// hundred and eighty-five dollars off" — but it is converted the moment it is
// typed and only the amount leaves this component. Storing a percentage would
// mean a second column and a rule about which one wins; showing a percent
// toggle that quietly saved nothing would be worse than not offering it.
//
// The consequence is stated in the hint rather than hidden: a percentage is a
// snapshot of the subtotal at the time it was entered. While this component is
// mounted it re-derives on every subtotal change, so it tracks; once saved, it
// is an amount like any other.
"use client";

import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  discountAmountFromPercent,
  discountPercentOfSubtotal,
} from "@/lib/quotes/totals";
import { formatAppMoney } from "@/lib/format/money";

export default function DiscountField({
  // The stored value: a flat amount off, pre-tax.
  value,
  onChange,
  // What the percentage is a percentage OF, and the ceiling the amount is
  // capped at. The cap is enforced again in quoteTotals() — this is the
  // explanation, not the enforcement.
  subtotal,
  currency,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("amount");
  // Kept separately from `value` so typing "1" on the way to "15" doesn't snap
  // the field to the amount 1% resolves to and lose the cursor.
  const [percentInput, setPercentInput] = useState("");

  const amount = Number(value) || 0;
  const capped = amount > Math.max(Number(subtotal) || 0, 0);

  function setPercent(raw) {
    setPercentInput(raw);
    onChange(String(discountAmountFromPercent(subtotal, raw)));
  }

  const equivalentPercent =
    mode === "amount" && amount > 0
      ? discountPercentOfSubtotal(subtotal, amount)
      : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-sm font-medium text-foreground">
          {t("app.quoteEdit.discount")}
        </label>

        {/* Two radio-ish buttons rather than a select: the choice has two
            options and a select would hide the one not chosen behind a tap. */}
        <div className="flex rounded-full border border-border overflow-hidden text-xs">
          {[
            ["amount", t("app.quoteDiscount.modeAmount")],
            ["percent", t("app.quoteDiscount.modePercent")],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
              className={`px-2.5 py-1 font-medium disabled:opacity-60 ${
                mode === key
                  ? "bg-inverted text-inverted-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "amount" ? (
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-muted"
        />
      ) : (
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          inputMode="decimal"
          disabled={disabled}
          value={percentInput}
          onChange={(e) => setPercent(e.target.value)}
          placeholder="0"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-muted"
        />
      )}

      {mode === "percent" && (
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.quoteDiscount.percentHint", {
            amount: formatAppMoney(amount, currency, "en"),
          })}
        </p>
      )}

      {mode === "amount" && equivalentPercent != null && (
        <p className="text-xs text-muted-foreground mt-1">
          {t("app.quoteDiscount.equivalentPercent", {
            percent: equivalentPercent,
          })}
        </p>
      )}

      {/* Said out loud rather than silently corrected on save. The total the
          bar shows is already the capped one, so without this line the number
          in the box and the number in the maths disagree with no explanation. */}
      {capped && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
          {t("app.quoteDiscount.cappedAtSubtotal", {
            amount: formatAppMoney(Math.max(Number(subtotal) || 0, 0), currency, "en"),
          })}
        </p>
      )}
    </div>
  );
}
