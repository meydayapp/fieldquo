"use client";

// app/components/subcontractors/RecordPaymentForm.js
//
// Write down money that already left: cash, e-transfer or cheque paid to a
// sub. Used from the sub's own page (any payment) and from the job's
// "Subs on this job" panel (a payment against one assignment).
//
// The method list is OUTBOUND_PAYMENT_METHODS, not the whole PaymentMethod
// enum: the server refuses `stripe`, `visit_credit`, `card_elsewhere` and
// `shop` because they mean money coming IN, and a picker must not offer a
// choice whose POST answers 400.

import { useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { OUTBOUND_PAYMENT_METHODS } from "@/lib/subcontractors/payload";
import { paymentMethodLabel } from "@/lib/payments/methodLabels";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10 min-h-[44px]";

/**
 * @param subcontractorId    whose payment
 * @param jobSubcontractorId the assignment it settles (optional)
 * @param remaining          what is still owed on that assignment, to prefill
 * @param onSaved            handed the response body
 */
export default function RecordPaymentForm({ subcontractorId, jobSubcontractorId = null, remaining = null, onSaved, onCancel }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const methodLabel = (m) => t(`app.subcontractors.method.${m}`, paymentMethodLabel(m));
  const [amount, setAmount] = useState(remaining != null && remaining > 0 ? String(remaining) : "");
  const [method, setMethod] = useState("e_transfer");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(t("app.subcontractors.amountRequired", "Enter the amount paid."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/subcontractors/${subcontractorId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, method, date, notes, jobSubcontractorId }),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.subcontractors.paymentFailed", "Couldn't record that payment."));
        setError(message || t("app.subcontractors.paymentFailed", "Couldn't record that payment."));
        return;
      }
      onSaved?.(await res.json());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t("app.subcontractors.recordPayment", "Record a payment")}</h3>
      {remaining != null && (
        <p className="text-xs text-muted-foreground">
          {remaining > 0
            ? t("app.subcontractors.stillOwed", "{amount} still owed on this job.", { amount: money(remaining) })
            : t("app.subcontractors.nothingOwed", "Nothing is owed on this job — a further payment will show as an overpayment.")}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-xs text-muted-foreground">
          {t("app.subcontractors.amount", "Amount")}
          <input className={`${inputClass} mt-1`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="block text-xs text-muted-foreground">
          {t("app.subcontractors.method", "Paid by")}
          <select className={`${inputClass} mt-1`} value={method} onChange={(e) => setMethod(e.target.value)}>
            {OUTBOUND_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {methodLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          {t("app.subcontractors.paidOn", "Paid on")}
          <input type="date" className={`${inputClass} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>
      <input
        className={inputClass}
        placeholder={t("app.subcontractors.paymentNotes", "Cheque number, invoice reference… (optional)")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {t("app.subcontractors.paymentHint", "This writes the payment and an expense against the job in one step. It records money that already left — it doesn't send any.")}
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">
          {saving ? t("app.subcontractors.saving", "Saving…") : t("app.subcontractors.recordPayment", "Record a payment")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold text-foreground">
            {t("app.subcontractors.cancel", "Cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
