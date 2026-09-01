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
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  Check,
  AlertCircle,
  Building2,
} from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { offlinePaymentLines } from "@/lib/payments/offlinePaymentNote";
import { taxIdLine } from "@/lib/documents/taxId";
import { jsonBody } from "@/lib/jsonBody";

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
        body: jsonBody({ invoiceId }, "payment"),
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

  // The client's language, resolved server-side and shared by the whole portal.
  // Derived before the not-found branch so even that message lands translated.
  const language = data?.language || "en";
  const labels = documentLabels(language);
  const copy = clientDocCopy(language);
  const fmt = documentFormatters(language, data?.company?.currency);
  const money = fmt.money;
  const date = fmt.date;

  if (!invoice)
    return (
      <Shell token={token} backLabel={copy.backToAccount}>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="font-semibold text-[#2d2520]">
            {error || copy.invoiceNotFound}
          </p>
        </div>
      </Shell>
    );

  const c = data.company || {};
  const accent = c.brandColor || "#06356b";
  // Measured, not assumed white — see the quote page for why.
  const accentOn = readableForeground(accent);
  const items = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const due = Math.max(
    0,
    Number(invoice.total || 0) - Number(invoice.amountPaid || 0),
  );
  const overdue =
    invoice.dueDate && due > 0.005 && new Date(invoice.dueDate) < new Date();
  // Same flag the portal index reads — the company may never have finished
  // connecting Stripe, in which case there is no card to take and the button
  // below would only 400.
  const onlinePayments = Boolean(data.onlinePayments);

  return (
    <Shell token={token} backLabel={copy.backToAccount}>
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
        {/* Same brand rule as the quote page. A client who approved a quote
            and then lands here should recognise it as the same company —
            previously these two pages shared no visual language at all. */}
        <div className="flex h-1.5">
          <div className="flex-[2]" style={{ backgroundColor: accent }} />
          <div className="flex-1" style={{ backgroundColor: `${accent}99` }} />
        </div>

        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-black/5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.logoUrl}
                  alt={c.name}
                  className="h-11 w-auto max-w-[180px] object-contain"
                />
              ) : (
                <div
                  className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: accent, color: accentOn }}
                >
                  <Building2 size={20} />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-[#2d2520] truncate">
                  {c.name}
                </div>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="text-xs text-[#2d2520]/55 hover:text-[#2d2520]"
                  >
                    {c.phone}
                  </a>
                )}
                {/* The registration number, where the contractor has one. This
                    is the invoice a client actually pays from, so it needs the
                    same line the PDF carries — without it a GST/HST-registered
                    contractor's client cannot claim the tax back. Renders
                    nothing at all when they are not registered. */}
                {taxIdLine(c) && (
                  <div className="text-xs text-[#2d2520]/55">{taxIdLine(c)}</div>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className="text-lg font-bold tracking-[0.15em] leading-none uppercase"
                style={{ color: accent }}
              >
                {labels.invoice}
              </div>
              <div className="font-mono text-sm text-[#2d2520] mt-1">
                {invoice.invoiceNumber}
              </div>
              {invoice.dueDate && (
                <div
                  className={`text-xs mt-1 ${overdue ? "text-red-700" : "text-[#2d2520]/55"}`}
                >
                  {overdue ? copy.wasDue : copy.due} {date(invoice.dueDate)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5">
          {items.length === 0 ? (
            <p className="text-sm text-[#2d2520]/50">
              {copy.noItemisedBreakdown}
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
                {labels.notes}
              </h3>
              <p className="text-sm text-[#2d2520]/70 whitespace-pre-wrap">
                {invoice.notes}
              </p>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-black/5 space-y-1 text-sm">
            <Row label={labels.subtotal} value={invoice.subtotal} money={money} />
            {Number(invoice.discount) > 0 && (
              <Row label={labels.discount} value={-Number(invoice.discount)} money={money} />
            )}
            {/* Not always a number — see lib/tax/documentTax.js. An invoice
                is the harder of the two documents to get wrong: this is what
                the household actually owes, and what the company remits
                against. `taxKind` is resolved server-side in
                app/api/portal/[token]/route.js. */}
            {invoice.taxKind && invoice.taxKind !== "charged" ? (
              <div className="flex justify-between text-[#2d2520]/70">
                <span>{labels.tax}</span>
                <span>
                  {invoice.taxKind === "unresolved"
                    ? labels.taxUnresolved
                    : labels.taxNone}
                </span>
              </div>
            ) : (
              <Row label={labels.tax} value={invoice.tax} money={money} />
            )}
            <div className="flex justify-between pt-1 font-semibold text-[#2d2520]">
              <span>{labels.total}</span>
              <span className="tabular-nums">{money(invoice.total)}</span>
            </div>
            {Number(invoice.amountPaid) > 0 && (
              <Row label={copy.paid} value={-Number(invoice.amountPaid)} money={money} />
            )}
            {/* The rate came from the contractor's province rather than this
                household's, because we hold no address for them. */}
            {invoice.taxAssumedRegion && (
              <p className="text-xs text-[#2d2520]/55 leading-snug pt-1">
                {labels.taxAssumedNote.replace(
                  "{region}",
                  invoice.taxAssumedRegion,
                )}
              </p>
            )}
          </div>

          {/* The one figure that matters, in their colour — same treatment as
              the quote's total. Reading three similar numbers to find the one
              you owe is the opposite of helpful on a payment page. */}
          <div
            className="mt-4 flex items-center justify-between rounded-xl px-4 py-3.5"
            style={{ backgroundColor: accent, color: accentOn }}
          >
            <span className="text-sm font-bold tracking-wide uppercase">
              {due > 0.005 ? labels.balanceDue : copy.paidInFull}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {money(due > 0.005 ? due : invoice.total)}
            </span>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5 bg-[#faf8f4] border-t border-black/5">
          {error && (
            <div className="mb-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {due > 0.005 && !onlinePayments ? (
            // The balance still shows above — what changes is that we don't
            // offer a card we can't charge. Same words the invoice email sent.
            <div className="text-center text-sm text-[#2d2520]/60 space-y-1">
              {offlinePaymentLines(c, copy).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : due > 0.005 ? (
            <button
              onClick={pay}
              disabled={paying}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: accent, color: accentOn }}
            >
              {paying ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CreditCard size={15} />
              )}
              {copy.pay(money(due))}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-green-700">
              <Check size={16} /> {copy.paidInFullThanks}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ token, children, backLabel = "Back to your account" }) {
  return (
    <div className="min-h-dvh bg-[#f5f2ec] py-8 sm:py-14 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/portal/${token}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#2d2520]/60 hover:text-[#2d2520] mb-5"
        >
          <ArrowLeft size={14} /> {backLabel}
        </Link>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, money }) {
  return (
    <div className="flex justify-between text-[#2d2520]/70">
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}
