// app/app/quotes/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Send, RefreshCw, Pencil, Link2 } from "lucide-react";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import { reportResponseError } from "@/lib/clientErrors";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-green-50 text-green-700",
  declined: "bg-red-50 text-red-700",
};

export default function QuoteDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/quotes/${id}`)
      .then((r) => r.json())
      .then(setQuote)
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(status) {
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setQuote(await res.json());
    } else {
      // Marking a quote sent or accepted is a status change the whole
      // pipeline depends on. Failing at it silently means the board is wrong
      // and nobody knows why.
      setError(
        (await res.json().catch(() => null))?.error ||
          "Couldn't update the quote's status.",
      );
    }
    setActionLoading(false);
  }

  async function handleConvert() {
    setError("");
    setActionLoading(true);
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not convert to invoice");
      return;
    }
    router.push(`/app/invoices/${data.id}`);
  }

  async function handleDelete() {
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/app/quotes"); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
  }

  if (loading)
    return (
      <div className="p-6 max-w-4xl mx-auto animate-pulse h-96 bg-gray-200 rounded-xl" />
    );
  if (!quote)
    return (
      <div className="p-6 max-w-4xl mx-auto text-sm text-gray-500">
        Quote not found.
      </div>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-10">
      <Link
        href="/app/quotes"
        className="flex items-center gap-1 text-sm text-gray-500"
      >
        <ArrowLeft size={14} /> Back to Quotes
      </Link>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {quote.quoteNumber}
            </h1>
            <span
              className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[quote.status]}`}
            >
              {quote.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{quote.client?.name}</p>
        </div>

        <div className="flex gap-2">
          {quote.status === "draft" && (
            <button
              onClick={() => updateStatus("sent")}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              <Send size={14} /> Send
            </button>
          )}
          {["sent", "draft"].includes(quote.status) && (
            <Link
              href={`/app/quote-approval/${id}`}
              className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold"
            >
              <Link2 size={14} /> Get approved
            </Link>
          )}
          {quote.status === "accepted" && !quote.invoices?.length && (
            <button
              onClick={handleConvert}
              disabled={actionLoading}
              className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            >
              <RefreshCw size={14} /> Convert to Invoice
            </button>
          )}
          <Link
            href={`/app/quotes/${id}/edit`}
            className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-semibold"
          >
            <Pencil size={14} /> Edit
          </Link>
          <button
            onClick={() => setShowDelete(true)}
            className="border border-gray-300 text-gray-500 p-2 rounded-full"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {quote.invoices?.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-800">
          Already converted to invoice{" "}
          <Link
            href={`/app/invoices/${quote.invoices[0].id}`}
            className="underline font-medium"
          >
            {quote.invoices[0].invoiceNumber}
          </Link>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
        {quote.scopeGroups?.map((group) => (
          <div key={group.id}>
            <h3 className="font-semibold text-gray-900 mb-2">{group.label}</h3>
            <div className="space-y-1">
              {(group.lineItems || []).map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm text-gray-700"
                >
                  <span>
                    {item.description}{" "}
                    {item.quantity > 1 && `× ${item.quantity}`}
                  </span>
                  <span>${Number(item.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {quote.notes && (
          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Notes</h3>
            <p className="text-sm text-gray-600">{quote.notes}</p>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${Number(quote.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax</span>
            <span>${Number(quote.tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 text-base">
            <span>Total</span>
            <span>${Number(quote.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Quote"
        message="This quote and its line items will be permanently removed."
        itemName={quote.quoteNumber}
      />
    </div>
  );
}
