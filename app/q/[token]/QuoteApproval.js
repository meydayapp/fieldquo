// app/q/[token]/QuoteApproval.js
//
// The client-facing quote. Two things matter here and nothing else does:
// the client can read what they're being charged for, and they can say yes.
//
// Approval is a two-step confirm rather than a bare button. This is a
// financial commitment on a page a stranger may have opened on a phone in
// bright sun; an accidental tap shouldn't create a contract.
"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X, Loader2, Building2, Plus } from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import SignaturePad from "@/app/components/SignaturePad";
import { formatMoney } from "@/lib/currency";

export default function QuoteApproval({ token }) {
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState(null); // "accepted" | "declined"
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [decided, setDecided] = useState(null);

  // Ids of the optional extras ticked. Ids only — the amounts live on the
  // server and the total below is for the client's benefit, not the
  // server's. See priceWithAddOns in the API route: what gets charged is
  // recalculated there from these ids, so editing anything in this page
  // changes what you see and nothing else.
  const [picked, setPicked] = useState([]);
  const [settledTotal, setSettledTotal] = useState(null);

  // Signature (the approval). Required before "accepted" can be submitted.
  const [sigName, setSigName] = useState("");
  const [sigDataUrl, setSigDataUrl] = useState("");
  const [sigConsent, setSigConsent] = useState(false);
  const canSign = sigName.trim().length > 1 && Boolean(sigDataUrl) && sigConsent;

  // Format in the COMPANY's billing currency (falls back to CAD until loaded /
  // if unset). quote is null on the first renders, but money() is only called
  // in the loaded quote view, so the optional chain is safe.
  const money = (n) => formatMoney(n, quote?.company?.currency);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/quotes/${token}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || "This link isn't valid.");
        setQuote(data);
        if (data.status !== "sent") {
          setDecided(data.status);
          // Reopening a decided quote should show what was agreed, extras
          // included — not the figure before they were added.
          setSettledTotal(data.acceptedTotal ?? null);
          setPicked((data.addOns || []).filter((a) => a.selected).map((a) => a.id));
        }
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
        // No total is sent. Deliberate — the server prices it. On acceptance we
        // send the signature (name + drawn mark + consent); the server adds IP,
        // device, timestamp and the document hash and treats it as the approval.
        body: JSON.stringify({
          decision,
          addOnIds: decision === "accepted" ? picked : [],
          ...(decision === "accepted"
            ? { signature: { name: sigName.trim(), dataUrl: sigDataUrl, consent: sigConsent } }
            : {}),
        }),
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
      // The server's figure, not the one computed in this page. If they ever
      // disagreed, the client sees the truth here rather than discovering it
      // when the invoice lands.
      setSettledTotal(data.total ?? null);
      setConfirming(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * The figures shown on screen.
   *
   * This mirrors priceWithAddOns on the server and exists purely so the total
   * moves the instant a box is ticked — a client who has to submit to find out
   * what they'd pay won't tick anything. It is NOT what gets charged: the
   * server recalculates from its own stored prices and ignores everything this
   * page might claim. If the two ever drift, the server's number is the real
   * one and `settledTotal` overwrites this on approval.
   */
  const pricing = useMemo(() => {
    if (!quote) return { subtotal: 0, tax: 0, total: 0, extras: 0 };

    const chosen = (quote.addOns || []).filter((a) => picked.includes(a.id));
    const extras = chosen.reduce((s, a) => s + Number(a.amount || 0), 0);
    const taxableExtras = chosen
      .filter((a) => a.taxable)
      .reduce((s, a) => s + Number(a.amount || 0), 0);

    const rate = Number(quote.taxRate || 0);
    const subtotal = Number(quote.subtotal || 0) + extras;
    const tax = Number(quote.tax || 0) + taxableExtras * rate;
    const total = subtotal - Number(quote.discount || 0) + tax;

    return {
      extras,
      subtotal,
      tax,
      // After a decision, show what the server actually recorded.
      total: settledTotal ?? total,
    };
  }, [quote, picked, settledTotal]);

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
  // Measured, not assumed white. A contractor whose brand is yellow would
  // otherwise get white numerals on a yellow bubble — invisible, on the one
  // element whose whole job is being countable.
  const accentOn = readableForeground(accent);
  const expired =
    quote.validUntil && new Date(quote.validUntil) < new Date() && !decided;

  const addOns = quote.addOns || [];
  // Once decided or expired the extras are a record of what was agreed, not
  // a menu. Nothing here is a security boundary — the server refuses a second
  // decision regardless — it's just not being misleading about what's still
  // available.
  const locked = Boolean(decided) || expired;

  const toggle = (id) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <Shell>
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
        {/* The brand rule, before anything else. Same device as the PDF —
            it reads as the document being on their letterhead rather than
            having their logo pasted into a generic one. */}
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
              </div>
            </div>
            <div className="text-right shrink-0">
              <div
                className="text-lg font-bold tracking-[0.15em] leading-none"
                style={{ color: accent }}
              >
                QUOTE
              </div>
              <div className="font-mono text-sm text-[#2d2520] mt-1">
                {quote.quoteNumber}
              </div>
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
          {/* One card per service, matching the PDF exactly — a client who
              reads this page and then opens the attachment must not find two
              different documents. The per-service accent is the card's left
              border only; the page's own accent stays the company's. */}
          {quote.scopeGroups?.map((g, i) => {
            const groupAccent = g.accent || accent;
            const multi = (quote.scopeGroups || []).length > 1;

            return (
              <div
                key={i}
                className="rounded-xl overflow-hidden border border-black/10"
                style={{ borderLeft: `3px solid ${groupAccent}` }}
              >
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ backgroundColor: `${groupAccent}0f` }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {multi && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                        style={{ backgroundColor: groupAccent }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                    <h2 className="font-semibold text-[#2d2520] truncate">
                      {g.label}
                    </h2>
                  </div>
                  {g.subtotal > 0 && (
                    <span className="font-semibold tabular-nums text-[#2d2520] shrink-0">
                      {money(g.subtotal)}
                    </span>
                  )}
                </div>

                <div className="px-4 py-3">
                  <div className="space-y-1.5">
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

                  {g.included?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-[10px] font-bold tracking-wider text-[#2d2520]/40 mb-1.5">
                        WHAT&apos;S INCLUDED
                      </p>
                      <ul className="space-y-1">
                        {g.included.map((line, k) => (
                          <li
                            key={k}
                            className="text-xs text-[#2d2520]/70 flex gap-2 leading-relaxed"
                          >
                            <span
                              className="shrink-0"
                              style={{ color: groupAccent }}
                            >
                              •
                            </span>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {addOns.length > 0 && (
            <div className="pt-4 border-t border-black/5">
              <h2
                className="text-sm font-bold uppercase tracking-wide pb-2 mb-1 border-b"
                style={{ color: accent, borderColor: `${accent}44` }}
              >
                Optional extras
              </h2>
              <p className="text-xs text-[#2d2520]/50 mt-2 mb-3">
                {locked
                  ? "Chosen when this quote was approved."
                  : "Tick anything you'd like added. The total updates as you go — nothing is charged until you approve."}
              </p>

              <div className="space-y-2">
                {addOns.map((a) => {
                  const on = picked.includes(a.id);
                  // After a decision the list is a record, not a control.
                  // Unchosen extras disappear rather than sitting there
                  // implying they could still be added.
                  if (locked && !on) return null;

                  return (
                    <label
                      key={a.id}
                      className={`flex gap-3 items-start rounded-xl border px-4 py-3 transition-colors ${
                        locked ? "" : "cursor-pointer"
                      } ${
                        on
                          ? "bg-[#faf8f4] border-black/20"
                          : "bg-white border-black/10 hover:border-black/25"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={locked}
                        onChange={() => toggle(a.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-current"
                        style={{ accentColor: accent }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex justify-between gap-3">
                          <span className="text-sm font-medium text-[#2d2520]">
                            {a.description}
                          </span>
                          <span className="text-sm tabular-nums shrink-0 text-[#2d2520]">
                            {!locked && !on && (
                              <Plus
                                size={11}
                                className="inline -mt-0.5 mr-0.5 opacity-50"
                              />
                            )}
                            {money(a.amount)}
                          </span>
                        </span>
                        {a.detail && (
                          <span className="block text-xs text-[#2d2520]/60 mt-1">
                            {a.detail}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* The steps, then the company's own notes for this job. Placed
              after the total because the client's eye goes to the price
              first no matter what we do — this is the answer to the question
              that follows it. */}
          {quote.processSteps?.length > 0 && (
            <div className="pt-5 border-t border-black/5">
              <h3
                className="text-xs font-bold tracking-wider mb-3"
                style={{ color: accent }}
              >
                HOW THE WORK RUNS
              </h3>
              <ol className="space-y-0">
                {quote.processSteps.map((s, i) => {
                  const last = i === quote.processSteps.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                          style={{
                            backgroundColor: accent,
                            color: accentOn,
                          }}
                        >
                          {s.num}
                        </span>
                        {!last && (
                          <span
                            className="w-px flex-1 my-1"
                            style={{ backgroundColor: `${accent}33` }}
                          />
                        )}
                      </div>
                      <div className={last ? "pb-0" : "pb-4"}>
                        <p className="text-sm font-semibold text-[#2d2520]">
                          {s.title}
                        </p>
                        <p className="text-xs text-[#2d2520]/65 leading-relaxed mt-0.5">
                          {s.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {quote.processNotes && (
            <div
              className="rounded-lg px-4 py-3"
              style={{
                backgroundColor: `${accent}0d`,
                borderLeft: `3px solid ${accent}`,
              }}
            >
              <p className="text-sm text-[#2d2520] whitespace-pre-wrap leading-relaxed">
                {quote.processNotes}
              </p>
            </div>
          )}

          {quote.paymentTerms && (
            <div className="pt-4 border-t border-black/5">
              <h3
                className="text-xs font-bold tracking-wider mb-2.5"
                style={{ color: accent }}
              >
                PAYMENT TERMS
              </h3>
              {quote.paymentSchedule?.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {quote.paymentSchedule.map((s, i) => (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-2.5 border"
                      style={{
                        backgroundColor: `${accent}0d`,
                        borderColor: `${accent}33`,
                      }}
                    >
                      <div
                        className="text-xl font-bold leading-none"
                        style={{ color: accent }}
                      >
                        {s.pct}
                      </div>
                      <div className="text-xs font-semibold text-[#2d2520] mt-1">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#2d2520]/70">{quote.paymentTerms}</p>
              )}
            </div>
          )}

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
            <Row label="Subtotal" value={pricing.subtotal} />
            {quote.discount > 0 && (
              <Row label="Discount" value={-quote.discount} />
            )}
            <Row label="Tax" value={pricing.tax} />
            {pricing.extras > 0 && (
              <div className="flex justify-between text-[#2d2520]/70">
                <span>Includes optional extras</span>
                <span className="tabular-nums">{money(pricing.extras)}</span>
              </div>
            )}
          </div>

          {/* The headline figure in a filled band in their colour. Previously
              subtotal, tax and total sat one line apart at similar weight, so
              the eye had to read three numbers to find the one that matters —
              on the single most-looked-at line of the document. */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3.5 -mt-1"
            style={{ backgroundColor: accent, color: accentOn }}
          >
            <span className="text-sm font-bold tracking-wide">TOTAL</span>
            <span className="text-2xl font-bold tabular-nums">
              {money(pricing.total)}
            </span>
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
                  ? `Approve this quote for ${money(pricing.total)}?`
                  : "Decline this quote?"}
              </p>
              <p className="text-sm text-[#2d2520]/60 mt-1">
                {confirming === "accepted"
                  ? pricing.extras > 0
                    ? `Including ${money(pricing.extras)} of optional extras. This tells them to go ahead.`
                    : "This tells them to go ahead."
                  : "You can always ask for a revised quote."}
              </p>

              {confirming === "accepted" && (
                <div className="mt-5 text-left max-w-sm mx-auto">
                  <label className="block text-sm font-medium text-[#2d2520] mb-1">
                    Your full name
                  </label>
                  <input
                    value={sigName}
                    onChange={(e) => setSigName(e.target.value)}
                    placeholder="Type your name"
                    className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm mb-3"
                  />
                  <label className="block text-sm font-medium text-[#2d2520] mb-1">
                    Signature
                  </label>
                  <SignaturePad onChange={setSigDataUrl} />
                  <label className="flex items-start gap-2 mt-3 text-xs text-[#2d2520]/80">
                    <input
                      type="checkbox"
                      checked={sigConsent}
                      onChange={(e) => setSigConsent(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I agree that signing here is my electronic signature and
                      approves this quote for {money(pricing.total)}.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-center mt-4 flex-wrap">
                <button
                  onClick={() => submit(confirming)}
                  disabled={submitting || (confirming === "accepted" && !canSign)}
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
