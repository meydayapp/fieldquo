// app/portal/[token]/ClientPortal.js
//
// Reads as a statement from the contractor, not as a SaaS dashboard. The
// client hired a cabinet shop, not FieldQuo, so the company's name and colour
// lead and there is no FieldQuo branding anywhere on the page.
//
// The balance owing is the first thing on screen and the pay button is next to
// it. Everything else is reference material.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Building2,
  CreditCard,
  FileText,
  Receipt,
  Check,
  AlertCircle,
} from "lucide-react";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

const date = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-CA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

export default function ClientPortal({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  useEffect(() => {
    // Stripe sends the client back here with ?paid=true. Acknowledge it, then
    // strip the parameter so a later refresh doesn't keep claiming success.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("paid") === "true") {
        setJustPaid(true);
        url.searchParams.delete("paid");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/${token}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "This link isn't valid.");
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function pay(invoiceId) {
    setPayingId(invoiceId);
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
      setPayingId("");
    }
  }

  if (loading)
    return (
      <Shell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-black/10 rounded w-1/2" />
          <div className="h-48 bg-black/10 rounded-2xl" />
        </div>
      </Shell>
    );

  if (!data)
    return (
      <Shell>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-[#2d2520]">
            {error || "This link isn't valid."}
          </p>
          <p className="text-sm text-[#2d2520]/60 mt-2">
            Get in touch with the company you're working with and they can send
            a fresh one.
          </p>
        </div>
      </Shell>
    );

  const c = data.company || {};
  const accent = c.brandColor || "#06356b";

  const invoices = data.invoices || [];
  const balance = invoices.reduce(
    (sum, inv) =>
      sum + Math.max(0, Number(inv.total || 0) - Number(inv.amountPaid || 0)),
    0,
  );
  const unpaid = invoices.filter(
    (inv) => Number(inv.total || 0) - Number(inv.amountPaid || 0) > 0.005,
  );

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-8">
        {c.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.logoUrl}
            alt={c.name}
            className="h-11 w-auto object-contain"
          />
        ) : (
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: accent }}
          >
            <Building2 size={20} className="text-[#2d2520]" />
          </div>
        )}
        <div>
          <div className="font-bold text-[#2d2520]">{c.name}</div>
          <div className="text-sm text-[#2d2520]/50">
            Account for {data.clientName}
          </div>
        </div>
      </div>

      {justPaid && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-2 text-sm text-green-800">
          <Check size={16} className="shrink-0 mt-0.5" />
          <div>
            Payment received — thank you. It can take a minute to show below.
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Balance first — it's the only thing most people open this for. */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 mb-6">
        <div className="text-xs uppercase tracking-wider text-[#2d2520]/40">
          Balance owing
        </div>
        <div className="text-3xl font-bold text-[#2d2520] mt-1 tabular-nums">
          {money(balance)}
        </div>
        {balance <= 0 ? (
          <p className="text-sm text-[#2d2520]/50 mt-2">
            Nothing outstanding. Thank you.
          </p>
        ) : (
          <p className="text-sm text-[#2d2520]/60 mt-2">
            Across {unpaid.length} invoice{unpaid.length === 1 ? "" : "s"}.
          </p>
        )}
      </div>

      {invoices.length > 0 && (
        <Section icon={Receipt} title="Invoices">
          {invoices.map((inv) => {
            const due = Math.max(
              0,
              Number(inv.total || 0) - Number(inv.amountPaid || 0),
            );
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-4 py-4 flex-wrap"
              >
                <a
                  href={`/portal/${token}/invoices/${inv.id}`}
                  className="min-w-0 group"
                >
                  <div className="font-medium text-[#2d2520] group-hover:underline">
                    {inv.invoiceNumber}
                  </div>
                  <div className="text-xs text-[#2d2520]/50 mt-0.5">
                    {money(inv.total)}
                    {Number(inv.amountPaid) > 0 &&
                      ` · ${money(inv.amountPaid)} paid`}
                    {inv.dueDate && ` · due ${date(inv.dueDate)}`}
                  </div>
                </a>

                {due > 0.005 ? (
                  <button
                    onClick={() => pay(inv.id)}
                    disabled={Boolean(payingId)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-[#2d2520] disabled:opacity-60 shrink-0"
                    style={{ backgroundColor: accent }}
                  >
                    {payingId === inv.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CreditCard size={14} />
                    )}
                    Pay {money(due)}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 shrink-0">
                    <Check size={14} /> Paid
                  </span>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {data.quotes?.length > 0 && (
        <Section icon={FileText} title="Quotes">
          {data.quotes.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <div className="font-medium text-[#2d2520]">
                  {q.quoteNumber}
                </div>
                <div className="text-xs text-[#2d2520]/50 mt-0.5">
                  {money(q.total)} · {date(q.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs px-2.5 py-1 rounded-full bg-black/5 text-[#2d2520]/70 capitalize">
                  {q.status}
                </span>
                {/* Only offer the approval page when there's a decision left
                    to make and a link to make it through. */}
                {q.status === "sent" && q.shareToken && (
                  <a
                    href={`/q/${q.shareToken}`}
                    className="text-sm font-semibold underline text-[#2d2520]"
                  >
                    Review
                  </a>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      <p className="text-center text-xs text-[#2d2520]/40 mt-10">
        Questions about any of this? Contact {c.name}
        {c.phone ? ` at ${c.phone}` : ""}
        {c.email ? ` · ${c.email}` : ""}.
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#f5f2ec] py-8 sm:py-14 px-4">
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white border border-black/10 rounded-2xl px-6 py-2 mb-6">
      <h2 className="flex items-center gap-2 font-semibold text-[#2d2520] pt-4 pb-1">
        <Icon size={16} className="text-[#2d2520]/40" />
        {title}
      </h2>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
  );
}
