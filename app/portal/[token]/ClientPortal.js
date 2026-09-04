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
import { readableForeground } from "@/lib/brand/colour";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { offlinePaymentLines } from "@/lib/payments/offlinePaymentNote";
import { jsonBody } from "@/lib/jsonBody";
import {
  Loader2,
  Building2,
  CreditCard,
  FileText,
  Receipt,
  Check,
  AlertCircle,
} from "lucide-react";

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
        body: jsonBody({ invoiceId }, "payment"),
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
  // The client's language, resolved server-side (client.language → company
  // default → en), driving labels, money and dates alike.
  //
  // No documentLabels() here, unlike the invoice page: this index has no
  // document furniture on it — every string is portal chrome, which is what
  // clientDocCopy is for. The import used to be made and the result never read.
  const language = data.language || "en";
  const copy = clientDocCopy(language);
  // The company's billing currency, not a hardcoded CAD — otherwise a US client
  // saw their balance and "Pay $X" in CAD on the portal index, then the correct
  // USD after tapping into the invoice. On a payment surface that mismatch reads
  // as a bug. Only the formatting locale shifts with the language.
  const fmt = documentFormatters(language, c.currency);
  const money = fmt.money;
  const date = fmt.date;
  const accent = c.brandColor || "#06356b";
  // Measured foreground for elements ON the accent (the Pay button, the logo
  // bubble). Hardcoded dark text was unreadable on a dark brand or the default.
  const accentOn = readableForeground(accent);

  // Whether the Pay buttons on this page can do anything. Derived server-side
  // (the raw Stripe account id never crosses to a public endpoint) — see
  // app/api/portal/[token]/route.js.
  const onlinePayments = Boolean(data.onlinePayments);
  const offlineLines = offlinePaymentLines(c, copy);

  // Every invoice here has already been filtered to ISSUED ones server-side
  // (app/api/portal/[token]/route.js) — a draft never reaches this component,
  // so the balance below cannot count one. Deliberately NOT re-filtered here:
  // a second copy of that predicate is the one that rots, and the browser was
  // never the right place to decide what a client may see. If a draft ever
  // shows up in this list again, fix the query, not this file.
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
            <Building2 size={20} style={{ color: accentOn }} />
          </div>
        )}
        <div>
          <div className="font-bold text-[#2d2520]">{c.name}</div>
          <div className="text-sm text-[#2d2520]/50">
            {copy.accountFor(data.clientName)}
          </div>
        </div>
      </div>

      {justPaid && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-2 text-sm text-green-800">
          <Check size={16} className="shrink-0 mt-0.5" />
          <div>{copy.paymentReceived}</div>
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
          {copy.balanceOwing}
        </div>
        <div className="text-3xl font-bold text-[#2d2520] mt-1 tabular-nums">
          {money(balance)}
        </div>
        {balance <= 0 ? (
          <p className="text-sm text-[#2d2520]/50 mt-2">
            {copy.nothingOutstanding}
          </p>
        ) : (
          <p className="text-sm text-[#2d2520]/60 mt-2">
            {copy.acrossInvoices(unpaid.length)}
          </p>
        )}
      </div>

      {invoices.length > 0 && (
        <Section icon={Receipt} title={copy.invoicesHeading}>
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
                      ` · ${copy.paidNote(money(inv.amountPaid))}`}
                    {inv.dueDate && ` · ${copy.dueNote(date(inv.dueDate))}`}
                  </div>
                </a>

                {due > 0.005 && !onlinePayments ? (
                  // No Stripe on this company: say what to do instead, rather
                  // than a Pay button that 400s under their own logo.
                  <span className="text-xs text-[#2d2520]/60 shrink-0 text-right max-w-[15rem]">
                    {offlineLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                ) : due > 0.005 ? (
                  <button
                    onClick={() => pay(inv.id)}
                    disabled={Boolean(payingId)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 shrink-0"
                    style={{ backgroundColor: accent, color: accentOn }}
                  >
                    {payingId === inv.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CreditCard size={14} />
                    )}
                    {copy.pay(money(due))}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 shrink-0">
                    <Check size={14} /> {copy.paid}
                  </span>
                )}
              </div>
            );
          })}
        </Section>
      )}

      {data.quotes?.length > 0 && (
        <Section icon={FileText} title={copy.quotesHeading}>
          {data.quotes.map((q) => (
            // flex-wrap and gap-y, matching the invoice row above. The status
            // pill went from one word to a sentence, and on a 375px screen a
            // `shrink-0` block that wide left the quote NUMBER as the only
            // thing able to give way — so "Q-2026-0003" broke across two
            // lines. Wrapping drops the pill and the Review link onto their own
            // row instead, which is what the invoice row already does.
            <div
              key={q.id}
              className="flex items-center justify-between gap-x-4 gap-y-2 py-4 flex-wrap"
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
                <QuoteStatusPill status={q.status} copy={copy} />
                {/* Only offer the approval page when there's a decision left
                    to make and a link to make it through. min-h-11: this is a
                    link a homeowner taps on a phone, and a bare text-sm anchor
                    is a 20px target. */}
                {q.status === "sent" && q.shareToken && (
                  <a
                    href={`/q/${q.shareToken}`}
                    className="inline-flex items-center min-h-11 text-sm font-semibold underline text-[#2d2520]"
                  >
                    {copy.review}
                  </a>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}

      <p className="text-center text-xs text-[#2d2520]/40 mt-10">
        {copy.portalQuestions(c.name, c.phone, c.email)}
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-dvh bg-[#f5f2ec] py-8 sm:py-14 px-4">
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}

// ── The quote pill ─────────────────────────────────────────────────────────
//
// Two things were wrong with the `{q.status}` + `capitalize` it replaces.
//
// It printed the raw enum, so a French client's portal — translated down to
// "Réparti sur 1 facture" — listed "Accepted" under "Soumissions". The words
// now come from clientDocCopy, keyed by the enum in prisma/schema.prisma.
//
// And every pill was the same grey, so a quote still waiting on the client's
// answer looked exactly like one they had already approved. On a page whose
// whole job is "what, if anything, do I still have to do", that is the state
// that most needed to read without reading. Colour AND words, never colour
// alone: `sent` is the one asking for something and is the only warm pill.
//
// Deliberately not the brand colour. Everything else on this page is the
// company's; a status is a fact about the document, and painting "Declined" in
// the contractor's own green is how a refusal comes to look like a success.
// Same reasoning as the green "Paid" and the red error banner above.
//
// Tailwind's own -50/-200/-800 ramps, whose pairings measure 7:1 or better —
// well clear of 4.5:1, and independent of whatever the contractor picked.
const QUOTE_STATUS_TONE = {
  draft: "bg-black/5 border-black/10 text-[#2d2520]/70",
  sent: "bg-amber-50 border-amber-200 text-amber-800",
  accepted: "bg-green-50 border-green-200 text-green-800",
  declined: "bg-black/5 border-black/10 text-[#2d2520]/70",
};

function QuoteStatusPill({ status, copy }) {
  const label = copy.quoteStatus?.[status];
  // No label means an enum value this build has never heard of. Show nothing
  // rather than the raw token: "we don't know what this is" is a truthful blank,
  // and `partially_approved` in grey under a homeowner's name is not.
  // scripts/check-tenant-surfaces.mjs holds the map against the schema so this
  // branch stays unreachable.
  if (!label) return null;
  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
        QUOTE_STATUS_TONE[status] || QUOTE_STATUS_TONE.draft
      }`}
    >
      {label}
    </span>
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
