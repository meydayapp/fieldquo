// app/q/[token]/QuoteApproval.js
//
// The client-facing quote. Two things matter here and nothing else does:
// the client can read what they're being charged for, and they can say yes.
//
// Approval is a two-step confirm rather than a bare button. This is a
// financial commitment on a page a stranger may have opened on a phone in
// bright sun; an accidental tap shouldn't create a contract.
"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2, Building2 } from "lucide-react";

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });

export default function QuoteApproval({ token }) {
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState(null); // "accepted" | "declined"
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [decided, setDecided] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/quotes/${token}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || "This link isn't valid.");
        setQuote(data);
        if (data.status !== "sent") setDecided(data.status);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(decision) {
    setSubmitting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/public/quotes/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // A 409 means someone already decided. That's not really an error from
        // the client's point of view, so reflect the settled state instead of
        // showing them a failure.
        if (res.status === 409 && data?.status) {
          setDecided(data.status);
          setConfirming(null);
          return;
        }
        throw new Error(data?.error || "Something went wrong. Try again.");
      }
      setDecided(data.status);
      setConfirming(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-black/10 rounded w-1/3" />
          <div className="h-64 bg-black/10 rounded-xl" />
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-[#2d2520]">{loadError}</p>
          <p className="text-sm text-[#2d2520]/60 mt-2">
            Get in touch with the company that sent it and they can send a fresh
            link.
          </p>
        </div>
      </Shell>
    );
  }

  const c = quote.company || {};
  const accent = c.brandColor || "#06356b";
  const expired =
    quote.validUntil && new Date(quote.validUntil) < new Date() && !decided;

  return (
    <Shell>
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
        <div
          className="px-6 sm:px-8 py-6 text-white"
          style={{ backgroundColor: "#1A1917" }}
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.logoUrl}
                  alt={c.name}
                  className="h-10 w-auto object-contain"
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: accent }}
                >
                  <Building2 size={18} className="text-[#1A1917]" />
                </div>
              )}
              <div>
                <div className="font-semibold">{c.name}</div>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    {c.phone}
                  </a>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-white/50">
                Quote
              </div>
              <div className="font-mono text-sm">{quote.quoteNumber}</div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6">
          <p className="text-sm text-[#2d2520]/60">Prepared for</p>
          <p className="text-lg font-semibold text-[#2d2520]">
            {quote.client?.name}
          </p>

          {quote.validUntil && (
            <p className="text-sm mt-2 text-[#2d2520]/60">
              Valid until{" "}
              {new Date(quote.validUntil).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>

        <div className="px-6 sm:px-8 pb-6 space-y-6">
          {quote.scopeGroups?.map((g, i) => (
            <div key={i}>
              <h2
                className="text-sm font-bold uppercase tracking-wide pb-2 mb-3 border-b"
                style={{ color: accent, borderColor: `${accent}44` }}
              >
                {g.label}
              </h2>
              <div className="space-y-2">
                {g.lineItems.map((li, j) => (
                  <div
                    key={j}
                    className="flex justify-between gap-4 text-sm text-[#2d2520]"
                  >
                    <span>
                      {li.description}
                      {Number(li.quantity) > 1 && (
                        <span className="text-[#2d2520]/50">
                          {" "}
                          × {li.quantity}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {money(li.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {quote.notes && (
            <div className="pt-4 border-t border-black/5">
              <h3 className="text-sm font-semibold text-[#2d2520] mb-1">
                Notes
              </h3>
              <p className="text-sm text-[#2d2520]/70 whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-black/5 space-y-1 text-sm">
            <Row label="Subtotal" value={quote.subtotal} />
            {quote.discount > 0 && (
              <Row label="Discount" value={-quote.discount} />
            )}
            <Row label="Tax" value={quote.tax} />
            <div className="flex justify-between pt-2 text-lg font-bold text-[#2d2520]">
              <span>Total</span>
              <span className="tabular-nums">{money(quote.total)}</span>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6 bg-[#faf8f4] border-t border-black/5">
          {decided === "accepted" ? (
            <Settled
              tone="ok"
              title="Approved — thank you"
              body={`${c.name} has been notified and will be in touch about next steps.`}
            />
          ) : decided === "declined" ? (
            <Settled
              tone="muted"
              title="Quote declined"
              body={`${c.name} has been notified. If this was a mistake, give them a call.`}
            />
          ) : expired ? (
            <Settled
              tone="muted"
              title="This quote has expired"
              body={`Contact ${c.name} for an updated price.`}
            />
          ) : confirming ? (
            <div className="text-center">
              <p className="font-semibold text-[#2d2520]">
                {confirming === "accepted"
                  ? `Approve this quote for ${money(quote.total)}?`
                  : "Decline this quote?"}
              </p>
              <p className="text-sm text-[#2d2520]/60 mt-1">
                {confirming === "accepted"
                  ? "This tells them to go ahead."
                  : "You can always ask for a revised quote."}
              </p>
              <div className="flex gap-3 justify-center mt-4 flex-wrap">
                <button
                  onClick={() => submit(confirming)}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-60"
                  style={{
                    backgroundColor:
                      confirming === "accepted" ? "#16a34a" : "#4b5563",
                  }}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  Yes, {confirming === "accepted" ? "approve" : "decline"}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={submitting}
                  className="px-6 py-3 rounded-full text-sm font-semibold border border-black/15 text-[#2d2520]"
                >
                  Go back
                </button>
              </div>
              {actionError && (
                <p className="text-sm text-red-700 mt-3">{actionError}</p>
              )}
            </div>
          ) : (
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => setConfirming("accepted")}
                className="inline-flex items-center gap-2 bg-[#16a34a] text-white px-7 py-3 rounded-full text-sm font-semibold"
              >
                <Check size={16} /> Approve this quote
              </button>
              <button
                onClick={() => setConfirming("declined")}
                className="inline-flex items-center gap-2 border border-black/15 text-[#2d2520] px-7 py-3 rounded-full text-sm font-semibold"
              >
                <X size={16} /> Decline
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[#2d2520]/40 mt-6">
        Questions? Reply to the email, or call {c.name}
        {c.phone ? ` at ${c.phone}` : ""}.
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

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-[#2d2520]/70">
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

function Settled({ tone, title, body }) {
  const ok = tone === "ok";
  return (
    <div
      className={`rounded-xl px-5 py-5 text-center border ${
        ok
          ? "bg-green-50 border-green-200"
          : "bg-white border-black/10"
      }`}
    >
      <p
        className={`font-semibold ${ok ? "text-green-800" : "text-[#2d2520]"}`}
      >
        {title}
      </p>
      <p
        className={`text-sm mt-1 ${
          ok ? "text-green-700" : "text-[#2d2520]/60"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
