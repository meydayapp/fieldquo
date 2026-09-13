"use client";

// Refund a client from one payment row — full or partial, with a reason.
// Owner/admin or a custom-access member with the `payments` toggle; the
// route (app/api/invoices/[id]/refund) is the gate, this only mirrors it.
//
// requestId is minted once, when the dialog opens: the Stripe refund is
// keyed on it, so a double-click or a retried submit returns the first
// refund instead of making a second (lib/invoices/refund.js).
//
// The one sentence a contractor must read before confirming a card or bank
// refund: Stripe does not return its processing fee on a refund, and neither
// does FieldQuo — the contractor bears it. Said in the dialog, not a tooltip.

import { useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { refundableCents } from "@/lib/invoices/refund";

export default function RefundDialog({ invoiceId, payment, refundRows, money, onClose, onDone }) {
  const { t } = useTranslation();
  const requestId = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    [],
  );
  const limitCents = refundableCents(payment, refundRows);
  const viaStripe = Boolean(payment.stripePaymentIntentId);
  const [amount, setAmount] = useState((limitCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/invoices/${invoiceId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          amount: Number(amount),
          reason,
          method: viaStripe ? "stripe" : "manual",
          requestId,
        }),
      });
      await onDone();
      onClose();
    } catch (err) {
      setError(err.message || t("app.invoiceDetail.refundError"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-sm p-6">
        <h2 className="font-semibold mb-1">{t("app.invoiceDetail.refundTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("app.invoiceDetail.refundIntro", { amount: money(limitCents / 100) })}
        </p>
        {error && (
          <div className="mb-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.invoiceDetail.refundAmount")}
            </span>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              max={(limitCents / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.invoiceDetail.refundReason")}
            </span>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("app.invoiceDetail.refundReasonPlaceholder")}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </label>
          <p data-refund-note={viaStripe ? "stripe" : "manual"} className="text-xs text-muted-foreground">
            {viaStripe ? t("app.invoiceDetail.refundStripeNote") : t("app.invoiceDetail.refundManualNote")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 border border-border py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {t("app.action.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {busy ? t("app.invoiceDetail.refunding") : t("app.invoiceDetail.refundConfirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
