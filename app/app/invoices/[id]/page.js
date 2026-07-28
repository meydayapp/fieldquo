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

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-700",
  paid: "bg-green-50 text-green-700",
  overdue: "bg-red-50 text-red-700",
};

export default function InvoiceDetailPage() {
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

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then(setInvoice)
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(status) {
    setActionLoading(true);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setInvoice(await res.json());
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
      setError(data.error || "Could not record payment");
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
      if (!res.ok) throw new Error(data?.error || "Could not send the request");
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
    }
    setDownloadingPdf(false);
  }

  async function handleDelete() {
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/app/invoices");
  }

  if (loading)
    return (
      <div className="p-6 max-w-4xl mx-auto animate-pulse h-96 bg-gray-200 rounded-xl" />
    );
  if (!invoice)
    return (
      <div className="p-6 max-w-4xl mx-auto text-sm text-gray-500">
        Invoice not found.
      </div>
    );

  const amountPaid = Number(invoice.amountPaid || 0);
  const amountDue = Number(invoice.amountDue ?? invoice.total);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-10">
      <Link
        href="/app/invoices"
        className="flex items-center gap-1 text-sm text-gray-500"
      >
        <ArrowLeft size={14} /> Back to Invoices
      </Link>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {requested && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <div className="flex items-start gap-2">
            <Check size={16} className="shrink-0 mt-0.5" />
            <div>
              Payment request sent to <strong>{requested.to}</strong> for $
              {Number(requested.balance).toFixed(2)}.
              {/* The email still goes out — the client just can't pay through
                  it. Better they hear from you than get a dead button. */}
              {requested.onlinePaymentsEnabled === false && (
                <div className="mt-1 text-amber-800">
                  Stripe isn&apos;t connected yet, so the email asks them to
                  contact you instead of offering a card payment. Finish setup
                  in Settings → Payments.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoiceNumber}
            </h1>
            <span
              className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[invoice.status]}`}
            >
              {invoice.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{invoice.client?.name}</p>
        </div>

        <div className="flex gap-2">
          {invoice.status === "draft" && (
            <button
              onClick={() => updateStatus("sent")}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              <Send size={14} /> Send
            </button>
          )}
          {invoice.status !== "paid" && (
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
            >
              <DollarSign size={14} /> Record Payment
            </button>
          )}
          {/* Only meaningful once the invoice has left the office and there's
              still something owing on it. */}
          {invoice.status !== "draft" && amountDue > 0.005 && (
            <button
              onClick={handleRequestPayment}
              disabled={requesting}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              {requesting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              Request Payment
            </button>
          )}
          {["draft", "sent"].includes(invoice.status) && (
            <Link
              href={`/app/invoices/${id}/edit`}
              className="border border-gray-300 px-4 py-2 rounded-full text-sm font-semibold"
            >
              Edit
            </Link>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="border border-gray-300 text-gray-700 p-2 rounded-full disabled:opacity-60"
          >
            <Download size={16} />
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="border border-gray-300 text-gray-500 p-2 rounded-full"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        <div>
          {(invoice.lineItems || []).map((item, i) => (
            <div
              key={i}
              className="flex justify-between text-sm text-gray-700 py-1"
            >
              <span>
                {item.description} {item.quantity > 1 && `× ${item.quantity}`}
              </span>
              <span>${Number(item.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {invoice.notes && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Notes</h3>
            <p className="text-sm text-gray-600">{invoice.notes}</p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax</span>
            <span>${Number(invoice.tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 text-base">
            <span>Total</span>
            <span>${Number(invoice.total).toFixed(2)}</span>
          </div>
          {amountPaid > 0 && (
            <>
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>-${amountPaid.toFixed(2)}</span>
              </div>
              <div
                className={`flex justify-between font-semibold text-base ${amountDue > 0 ? "text-red-600" : "text-green-600"}`}
              >
                <span>Balance Due</span>
                <span>${amountDue.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {invoice.payments?.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Payment History
            </h3>
            <div className="space-y-1">
              {invoice.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between text-sm text-gray-600"
                >
                  <span>
                    {new Date(p.date).toLocaleDateString()} —{" "}
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
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h2 className="font-semibold mb-4">Record Payment</h2>
            <form onSubmit={handleAddPayment} className="space-y-3">
              <input
                required
                type="number"
                step="0.01"
                placeholder={`Amount (up to $${amountDue.toFixed(2)})`}
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
                className="w-full border rounded px-3 py-2 text-sm bg-white"
              >
                <option value="cash">Cash</option>
                <option value="e_transfer">E-Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
              <input
                placeholder="Notes (optional)"
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
                  className="flex-1 border border-gray-300 py-2 rounded-full text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gray-900 text-white py-2 rounded-full text-sm font-semibold"
                >
                  Record
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
        title="Delete Invoice"
        message="This invoice and its payment records will be permanently removed."
        itemName={invoice.invoiceNumber}
      />
    </div>
  );
}
