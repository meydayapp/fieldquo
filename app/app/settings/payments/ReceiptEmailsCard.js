"use client";

// app/app/settings/payments/ReceiptEmailsCard.js
//
// "Email clients a receipt automatically" — Company.emailPaymentReceipts.
//
// Written here through PATCH /api/settings/business-info and read in three
// places, each of which the switch's sentence names so it promises nothing it
// does not do:
//
//   * the Record payment dialog (app/app/invoices/[id]/page.js) ticks its
//     "Email a receipt" box by default when this is on;
//   * POST /api/payments falls back to it when a request carries no box;
//   * lib/invoices/recordStripePayment.js sends the receipt for a card,
//     Klarna, Affirm or bank payment only when it is on.
//
// Off never stops anyone pressing "Send receipt" on a payment row: that is a
// person deciding, not an automatic email.
//
// Optimistic like the Affirm switch on this page: flip first, persist, roll
// back and say so on failure — a switch that silently did not save is the
// dead control AGENTS.md is about.

import { useState } from "react";
import { Receipt } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function ReceiptEmailsCard({ company, setCompany }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Absent until the company row arrives: the switch is disabled rather than
  // showing a default that might be wrong.
  const known = typeof company?.emailPaymentReceipts === "boolean";
  const on = company?.emailPaymentReceipts === true;

  async function toggle() {
    if (saving || !known) return;
    const next = !on;
    setError("");
    setSaving(true);
    setCompany((c) => ({ ...c, emailPaymentReceipts: next }));
    try {
      await fetchJson("/api/settings/business-info", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailPaymentReceipts: next }),
      });
    } catch (err) {
      setCompany((c) => ({ ...c, emailPaymentReceipts: !next }));
      setError(err.message || t("app.setPayments.receiptsSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-receipt-emails-card className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start gap-3">
        <Receipt size={22} className="text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground">{t("app.setPayments.receiptsTitle")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("app.setPayments.receiptsIntro")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={t("app.setPayments.receiptsTitle")}
              onClick={toggle}
              disabled={saving || !known}
              className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                on ? "bg-green-600" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  on ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {on ? t("app.setPayments.receiptsOnNote") : t("app.setPayments.receiptsOffNote")}
          </p>
          {error && <p className="text-sm text-red-700 dark:text-red-300 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
