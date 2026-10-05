"use client";

// Void a payment that was recorded BY HAND and never happened — a test, or
// money that never came in. Owner/admin only; the route
// (app/api/invoices/[id]/void-payment) is the gate, this only mirrors it.
// What a void removes, and why a card payment can never be voided, is in
// lib/payments/voidPayment.js.
//
// Two sentences the owner must read before confirming, said in the dialog
// rather than a tooltip: the invoice goes back to unpaid (and the reminders
// for unpaid invoices apply again until it is deleted), and card payments
// are not voidable here — those are refunded.

import { useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { paymentMethodLabel } from "@/lib/payments/methodLabels";
import { cleanVoidReason, VOID_REASON_MAX } from "@/lib/payments/voidPayment";

// The route's refusal codes this dialog says in the reader's language. Any
// other code falls back to the route's own sentence.
const REFUSAL_KEYS = {
  card_payment: "app.invoiceDetail.voidRefused.card_payment",
  owner_only: "app.invoiceDetail.voidRefused.owner_only",
  reason_required: "app.invoiceDetail.voidRefused.reason_required",
};

export default function VoidPaymentDialog({ invoiceId, payment, money, formatDate, onClose, onDone }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!cleanVoidReason(reason)) {
      setError(t(REFUSAL_KEYS.reason_required));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/invoices/${invoiceId}/void-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, reason }),
      });
      await onDone();
      onClose();
    } catch (err) {
      setError((err?.code && REFUSAL_KEYS[err.code] && t(REFUSAL_KEYS[err.code])) || err?.message || t("app.invoiceDetail.voidError"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="fq-dialog-card bg-card rounded-xl w-full max-w-sm p-6" role="dialog" aria-modal="true" data-void-dialog>
        <h2 className="font-semibold mb-1">{t("app.invoiceDetail.voidTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("app.invoiceDetail.voidIntro", {
            amount: money(Number(payment.amount)),
            method: paymentMethodLabel(payment.method),
            date: formatDate(payment.date),
          })}
        </p>
        {error && (
          <div className="mb-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.invoiceDetail.voidReason")}
            </span>
            <input
              required
              maxLength={VOID_REASON_MAX}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("app.invoiceDetail.voidReasonPlaceholder")}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">{t("app.invoiceDetail.voidAfter")}</p>
          <p className="text-xs text-muted-foreground" data-void-card-note>
            {t("app.invoiceDetail.voidCardNote")}
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
              className="flex-1 bg-red-600 text-white py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {busy ? t("app.invoiceDetail.voiding") : t("app.invoiceDetail.voidConfirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
