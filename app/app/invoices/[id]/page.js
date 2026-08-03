// app/app/invoices/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Send,
  DollarSign,
  Download,
  Mail,
  Loader2,
  Check,
} from "lucide-react";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import { reportResponseError } from "@/lib/clientErrors";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

const STATUS_STYLES = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  paid: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  overdue: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
};

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const router = useRouter();
  const { id } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState({
    amount: "",
    method: "e_transfer",
    notes: "",
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState("");

  useEffect(() => {
    // Guard res.ok: a 404/401 returns { error }, and setting that as the invoice
    // made `if (!invoice)` pass, rendering a $NaN page instead of not-found.
    // Leave invoice null on failure so the not-found branch shows.
    fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInvoice)
      .catch(() => setInvoice(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Carried over from the new-invoice page when "Save & Send" saved the invoice
  // but the email failed — so the user learns why it's still a draft instead of
  // assuming the client got it. Mirrors the quote detail page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sendError = params.get("sendError");
    if (!sendError) return;
    setError(sendError);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  /**
   * Actually emails the invoice.
   *
   * This button used to call updateStatus("sent") — it changed a word on
   * screen and then hid itself, and no email was ever constructed. Identical
   * bug to the one quotes had. sentAt is now written only after Resend
   * accepts the message.
   */
  async function sendInvoice() {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.invoiceDetail.sendError"));
      setInvoice((inv) => ({ ...inv, ...data }));
      setJustSent(data.to);
      setTimeout(() => setJustSent(""), 6000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(status) {
    setActionLoading(true);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setInvoice(await res.json());
    } else {
      setError(
        (await res.json().catch(() => null))?.error ||
          t("app.invoiceDetail.statusUpdateError"),
      );
    }
    setActionLoading(false);
  }

  async function handleAddPayment(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: id,
        ...payment,
        amount: Number(payment.amount),
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("app.invoiceDetail.recordPaymentError"));
      return;
    }
    const refreshed = await fetch(`/api/invoices/${id}`).then((r) => r.json());
    setInvoice(refreshed);
    setShowPayment(false);
    setPayment({ amount: "", method: "e_transfer", notes: "" });
  }

  // Emails the client a link to their portal, where they can pay the balance
  // with the company's own Stripe account. Deliberately does NOT email a raw
  // Stripe Checkout URL — those expire in 24 hours and would be dead by the
  // time most people get round to paying.
  async function handleRequestPayment() {
    setRequesting(true);
    setError("");
    setRequested(null);
    try {
      const res = await fetch(`/api/invoices/${id}/request-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.invoiceDetail.requestError"));
      setRequested(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRequesting(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    const res = await fetch(`/api/invoices/${id}/pdf`, { method: "POST" });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setDownloadingPdf(false);
  }

  async function handleDelete() {
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/app/invoices"); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  if (!invoice)
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto text-sm text-muted-foreground">
        {t("app.invoiceDetail.notFound")}
      </div>
    );

  const amountPaid = Number(invoice.amountPaid || 0);
  const amountDue = Number(invoice.amountDue ?? invoice.total);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-10">
      <Link
        href="/app/invoices"
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft size={14} /> {t("app.invoiceDetail.backToInvoices")}
      </Link>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {justSent && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 flex items-center gap-2.5 text-sm text-green-800 dark:text-green-300">
          <Check size={16} className="shrink-0" />
          {t("app.invoiceDetail.emailedTo")} <span className="font-medium">{justSent}</span>.
        </div>
      )}

      {/* The email trail. Written only after Resend accepted the message, so
          "Emailed 3 July" is an event rather than the intention the old
          sentAt recorded. */}
      {invoice.sentAt && (
        <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-baseline justify-between gap-3 flex-wrap text-sm">
          <span className="font-medium text-foreground">
            {t("app.invoiceDetail.emailed")}
            {invoice.sentToEmail && (
              <span className="font-normal text-muted-foreground">
                {" "}
                → {invoice.sentToEmail}
              </span>
            )}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {new Date(invoice.sentAt).toLocaleString("en-CA", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {requested && (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-4 py-3 text-sm text-green-800 dark:text-green-300">
          <div className="flex items-start gap-2">
            <Check size={16} className="shrink-0 mt-0.5" />
            <div>
              {t("app.invoiceDetail.paymentRequestSentTo")} <strong>{requested.to}</strong> {t("app.invoiceDetail.forAmount")}
              {Number(requested.balance).toFixed(2)}.
              {/* The email still goes out — the client just can't pay through
                  it. Better they hear from you than get a dead button. */}
              {requested.onlinePaymentsEnabled === false && (
                <div className="mt-1 text-amber-800 dark:text-amber-300">
                  {t("app.invoiceDetail.stripeNotConnected")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {invoice.invoiceNumber}
            </h1>
            <span
              className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[invoice.status]}`}
            >
              {invoice.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{invoice.client?.name}</p>
        </div>

        <div className="flex gap-2">
          {/* Available while anything is still owed, not only on a draft —
              re-sending an invoice a client mislaid is routine, and the old
              button vanished the instant it was pressed. */}
          {invoice.status !== "paid" && (
            <button
              onClick={sendInvoice}
              disabled={sending}
              className="flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {sending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {invoice.sentAt ? t("app.invoiceDetail.sendAgain") : t("app.action.send")}
            </button>
          )}
          {invoice.status !== "paid" && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
            >
              <DollarSign size={14} /> {t("app.invoiceDetail.recordPayment")}
            </button>
          )}
          {/* Only meaningful once the invoice has left the office and there's
              still something owing on it. */}
          {invoice.status !== "draft" && amountDue > 0.005 && (
            <button
              onClick={handleRequestPayment}
              disabled={requesting}
              className="flex items-center gap-1.5 border border-border text-foreground px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {requesting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              {t("app.invoiceDetail.requestPayment")}
            </button>
          )}
          {["draft", "sent"].includes(invoice.status) && (
            <Link
              href={`/app/invoices/${id}/edit`}
              className="border border-border px-4 py-2 rounded-full text-sm font-semibold"
            >
              {t("app.action.edit")}
            </Link>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="border border-border text-foreground p-2 rounded-full disabled:opacity-60"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="border border-border text-muted-foreground p-2 rounded-full"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div>
          {(invoice.lineItems || []).map((item, i) => (
            <div
              key={i}
              className="flex justify-between text-sm text-foreground py-1"
            >
              <span>
                {item.description} {item.quantity > 1 && `× ${item.quantity}`}
              </span>
              <span>${Number(item.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {invoice.notes && (
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-1">{t("app.field.notes")}</h3>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        )}

        <div className="pt-4 border-t border-border space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("app.invoiceDetail.subtotal")}</span>
            <span>${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("app.invoiceDetail.tax")}</span>
            <span>${Number(invoice.tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-foreground text-base">
            <span>{t("app.invoiceDetail.total")}</span>
            <span>${Number(invoice.total).toFixed(2)}</span>
          </div>
          {amountPaid > 0 && (
            <>
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>{t("app.invoiceDetail.paid")}</span>
                <span>-${amountPaid.toFixed(2)}</span>
              </div>
              <div
                className={`flex justify-between font-semibold text-base ${amountDue > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
              >
                <span>{t("app.invoiceDetail.balanceDue")}</span>
                <span>${amountDue.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {invoice.payments?.length > 0 && (
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {t("app.invoiceDetail.paymentHistory")}
            </h3>
            <div className="space-y-1">
              {invoice.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between text-sm text-muted-foreground"
                >
                  <span>
                    {formatDate(p.date)} —{" "}
                    {p.method.replace("_", " ")}
                  </span>
                  <span>${Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-sm p-6">
            <h2 className="font-semibold mb-4">{t("app.invoiceDetail.recordPayment")}</h2>
            <form onSubmit={handleAddPayment} className="space-y-3">
              <input
                required
                type="number"
                step="0.01"
                placeholder={t("app.invoiceDetail.amountPlaceholder", { amount: amountDue.toFixed(2) })}
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <select
                value={payment.method}
                onChange={(e) =>
                  setPayment({ ...payment, method: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm bg-card"
              >
                <option value="cash">{t("app.invoiceDetail.cash")}</option>
                <option value="e_transfer">{t("app.invoiceDetail.eTransfer")}</option>
                <option value="cheque">{t("app.invoiceDetail.cheque")}</option>
              </select>
              <input
                placeholder={t("app.invoiceDetail.notesOptional")}
                value={payment.notes}
                onChange={(e) =>
                  setPayment({ ...payment, notes: e.target.value })
                }
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayment(false)}
                  className="flex-1 border border-border py-2 rounded-full text-sm font-semibold"
                >
                  {t("app.action.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold"
                >
                  {t("app.invoiceDetail.record")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t("app.invoiceDetail.deleteTitle")}
        message={t("app.invoiceDetail.deleteMessage")}
        itemName={invoice.invoiceNumber}
      />
    </div>
  );
}
