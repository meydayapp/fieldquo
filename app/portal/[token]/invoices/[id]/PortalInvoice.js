// app/portal/[token]/invoices/[id]/PortalInvoice.js
//
// Reads from the existing GET /api/portal/[token], which already returns every
// invoice for this client, and picks one out — rather than adding a
// per-invoice public endpoint.
//
// That's the safer shape: there is exactly one place where a portal token is
// turned into a set of records, so there's exactly one place to get the
// tenant scoping wrong. A second endpoint taking both a token and an invoice
// id would need its own "does this invoice belong to this token" check, which
// is precisely the check that gets forgotten.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, Check, AlertCircle } from "lucide-react";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

const date = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

export default function PortalInvoice({ token, invoiceId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/${token}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(d?.error || "This link isn't valid.");
        setData(d);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function pay() {
    setPaying(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.checkoutUrl) {
        throw new Error(d?.error || "Couldn't start the payment.");
      }
      window.location.href = d.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  if (loading)
    return (
      <Shell token={token}>
        <div className="animate-pulse h-64 bg-black/10 rounded-2xl" />
      </Shell>
    );

  const invoice = data?.invoices?.find((i) => i.id === invoiceId);

  if (!invoice)
    return (
      <Shell token={token}>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="font-semibold text-[#2d2520]">
            {error || "That invoice isn't on your account."}
          </p>
        </div>
      </Shell>
    );

  const c = data.company || {};
  const accent = c.brandColor || "#bd9d60";
  const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const due = Math.max(
    0,
    Number(invoice.total || 0) - Number(invoice.amountPaid || 0),
  );

  return (
    <Shell token={token}>
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-black/5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#2d2520]/40">
              Invoice
            </div>
            <div className="text-lg font-bold text-[#2d2520]">
              {invoice.invoiceNumber}
            </div>
            {invoice.dueDate && (
              <div className="text-sm text-[#2d2520]/60 mt-1">
                Due {date(invoice.dueDate)}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-[#2d2520]/40">
              {due > 0.005 ? "Amount due" : "Total"}
            </div>
            <div className="text-2xl font-bold text-[#2d2520] tabular-nums">
              {money(due > 0.005 ? due : invoice.total)}
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {items.length === 0 ? (
            <p className="text-sm text-[#2d2520]/50">
              No itemised breakdown on this invoice.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((li, i) => (
                <div
                  key={i}
                  className="flex justify-between gap-4 text-sm text-[#2d2520]"
                >
                  <span>
                    {li.description}
                    {Number(li.quantity) > 1 && (
                      <span className="text-[#2d2520]/50"> × {li.quantity}</span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {money(li.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {invoice.notes && (
            <div className="mt-5 pt-4 border-t border-black/5">
              <h3 className="text-sm font-semibold text-[#2d2520] mb-1">
                Notes
              </h3>
              <p className="text-sm text-[#2d2520]/70 whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-black/5 space-y-1 text-sm">
            <Row label="Subtotal" value={invoice.subtotal} />
            {Number(invoice.discount) > 0 && (
              <Row label="Discount" value={-Number(invoice.discount)} />
            )}
            <Row label="Tax" value={invoice.tax} />
            <div className="flex justify-between pt-1 font-semibold text-[#2d2520]">
              <span>Total</span>
              <span className="tabular-nums">{money(invoice.total)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <>
                <Row label="Paid" value={-Number(invoice.amountPaid)} />
                <div className="flex justify-between pt-1 font-bold text-[#2d2520] text-base">
                  <span>Balance</span>
                  <span className="tabular-nums">{money(due)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-5 bg-[#faf8f4] border-t border-black/5">
          {error && (
            <div className="mb-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {due > 0.005 ? (
            <button
              onClick={pay}
              disabled={paying}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold text-[#2d2520] disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {paying ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CreditCard size={15} />
              )}
              Pay {money(due)}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700">
              <Check size={16} /> Paid in full — thank you
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ token, children }) {
  return (
    <div className="min-h-screen bg-[#f5f2ec] py-8 sm:py-14 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/portal/${token}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#2d2520]/60 hover:text-[#2d2520] mb-5"
        >
          <ArrowLeft size={14} /> Back to your account
        </Link>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-[#2d2520]/70">
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}
