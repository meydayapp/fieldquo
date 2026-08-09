// app/q/[token]/ContractorImportPanel.js
//
// The contractor-only affordance under a received quote. A homeowner never sees
// this (the document above stays fully white-label); it appears only when the
// viewer is a FieldQuo contractor, or when the quote was addressed to a business
// rather than an individual. That split is decided server-side in
// /api/quotes/received/[token] — see the clientIsCompany note there.
//
// What it does: lets a general contractor pull this subcontractor's quote into
// one of their OWN quotes as a marked-up cost line, in one step. The browser
// sends only the target quote, a markup percent and a display choice; every
// dollar figure is derived on the server (lib/quotes/importQuote.js). The price
// shown here is a live preview for the contractor's benefit, not what gets
// stored.
"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Check, ExternalLink } from "lucide-react";
import { formatMoney } from "@/lib/currency";

const MARKUP_PRESETS = [0, 10, 20, 30];

export default function ContractorImportPanel({ token }) {
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);

  const [targetQuoteId, setTargetQuoteId] = useState("");
  const [preset, setPreset] = useState(20);
  const [useCustom, setUseCustom] = useState(false);
  const [customMarkup, setCustomMarkup] = useState("");
  const [display, setDisplay] = useState("blended");
  const [label, setLabel] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/quotes/received/${token}`);
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data) return;
        setCtx(data);
        if (data.openQuotes?.length) setTargetQuoteId(data.openQuotes[0].id);
      } catch {
        /* a failed context load just means no panel — never break the quote */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading || !ctx || ctx.error) return null;
  // The sender viewing their own quote, or a homeowner's white-label quote —
  // show nothing at all.
  if (ctx.isOwnQuote) return null;
  // Show ONLY to a signed-in contractor whose company differs from the sender's
  // (a real import case). The old `clientIsCompany` branch treated "this quote
  // was addressed to a business" as "the viewer is a different contractor" — but
  // that business IS the recipient approving the quote, so it leaked the
  // contractor-only "Add this to one of your quotes / Create a quote first" copy
  // (and a FieldQuo recruitment pitch) onto a white-label client approval page.
  if (!ctx.canImport) return null;

  const money = (n) => formatMoney(n, ctx.currency);
  const markup = useCustom ? Math.max(0, Number(customMarkup) || 0) : preset;
  const cost = Number(ctx.amount || 0);
  const clientPrice = Math.round(cost * (1 + markup / 100) * 100) / 100;

  // ── Signed-out (or unregistered) contractor: the on-ramp ──────────────────
  if (!ctx.canImport) {
    return (
      <Frame>
        <p className="text-sm font-semibold text-[#2d2520]">
          Are you the contractor on this job?
        </p>
        <p className="text-sm text-[#2d2520]/70 mt-1">
          Add this quote to your own project in FieldQuo as a cost, mark it up,
          and it becomes a line on the quote you send your client.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <a
            href={`/signup?next=${encodeURIComponent(`/q/${token}`)}`}
            className="inline-flex items-center gap-1.5 bg-[#06356b] text-white px-5 py-2.5 rounded-full text-sm font-semibold"
          >
            Start free — first month free
          </a>
          <a
            href={`/login?next=${encodeURIComponent(`/q/${token}`)}`}
            className="inline-flex items-center gap-1.5 border border-black/15 text-[#2d2520] px-5 py-2.5 rounded-full text-sm font-semibold"
          >
            Sign in
          </a>
        </div>
        <p className="text-xs text-[#2d2520]/45 mt-3">
          Either way, we&apos;ll bring you right back here to add it.
        </p>
      </Frame>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Frame tone="ok">
        <div className="flex items-start gap-2">
          <Check size={18} className="text-green-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#2d2520]">
              Added to {done.quoteNumber || "your quote"}
            </p>
            <p className="text-sm text-[#2d2520]/70 mt-1">
              Your client price for this trade is{" "}
              <strong>{money(done.clientPrice)}</strong>
              {done.targetTotal != null && (
                <> — your quote total is now {money(done.targetTotal)}.</>
              )}{" "}
              It shows as pending until your own client approves your quote.
            </p>
            <a
              href="/app/quotes"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#06356b] mt-3"
            >
              Open your quotes <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </Frame>
    );
  }

  const noQuotes = !ctx.openQuotes?.length;

  async function submit() {
    if (!targetQuoteId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/received/${token}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetQuoteId,
          markupPercent: markup,
          display,
          label: label.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't add that cost.");
      const q = ctx.openQuotes.find((x) => x.id === targetQuoteId);
      setDone({
        targetTotal: data.targetTotal,
        clientPrice: data.import?.clientPrice ?? clientPrice,
        quoteNumber: q?.quoteNumber,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Full import panel (logged-in contractor) ──────────────────────────────
  return (
    <Frame>
      <p className="text-sm font-semibold text-[#2d2520]">
        Add this to one of your quotes
      </p>
      <p className="text-xs text-[#2d2520]/60 mt-0.5">
        {ctx.sourceCompanyName ? `${ctx.sourceCompanyName}'s ` : ""}price is{" "}
        <strong>{money(cost)}</strong> — your cost. Mark it up and it becomes a
        line on your own quote.
      </p>

      {noQuotes ? (
        <div className="mt-4 rounded-lg border border-black/10 bg-white px-4 py-3">
          <p className="text-sm text-[#2d2520]/70">
            You don&apos;t have an open quote to add it to yet.
          </p>
          <a
            href="/app/quotes/new"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#06356b] mt-2"
          >
            Create a quote first <ExternalLink size={13} />
          </a>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Which of the contractor's quotes to add it to */}
          <label className="block">
            <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
              Add to quote
            </span>
            <select
              value={targetQuoteId}
              onChange={(e) => setTargetQuoteId(e.target.value)}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
            >
              {ctx.openQuotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.quoteNumber}
                  {q.clientName ? ` — ${q.clientName}` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Markup */}
          <div>
            <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
              Your markup
            </span>
            <div className="flex flex-wrap gap-1.5">
              {MARKUP_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setUseCustom(false);
                    setPreset(p);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                    !useCustom && preset === p
                      ? "bg-[#06356b] text-white border-[#06356b]"
                      : "bg-white text-[#2d2520] border-black/15"
                  }`}
                >
                  {p}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  useCustom
                    ? "bg-[#06356b] text-white border-[#06356b]"
                    : "bg-white text-[#2d2520] border-black/15"
                }`}
              >
                Custom
              </button>
              {useCustom && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={customMarkup}
                    onChange={(e) => setCustomMarkup(e.target.value)}
                    placeholder="0"
                    className="w-20 rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-[#2d2520]/60">%</span>
                </div>
              )}
            </div>
          </div>

          {/* How it shows to the client */}
          <div>
            <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
              On your client&apos;s quote
            </span>
            <div className="flex gap-1.5">
              {[
                ["blended", "One line"],
                ["itemized", "Itemised"],
              ].map(([val, txt]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDisplay(val)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                    display === val
                      ? "bg-[#06356b] text-white border-[#06356b]"
                      : "bg-white text-[#2d2520] border-black/15"
                  }`}
                >
                  {txt}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#2d2520]/45 mt-1">
              Your client never sees the subcontractor or your markup.
            </p>
          </div>

          {/* Label */}
          <label className="block">
            <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
              Label (optional)
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Electrical"
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
            />
          </label>

          {/* Live client-price preview */}
          <div className="flex items-center justify-between rounded-lg bg-white border border-black/10 px-4 py-3">
            <div className="text-sm text-[#2d2520]/70">
              Your client price
              <span className="text-[11px] text-[#2d2520]/45 block">
                {money(cost)} + {markup}% markup
              </span>
            </div>
            <div className="text-lg font-bold tabular-nums text-[#2d2520]">
              {money(clientPrice)}
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !targetQuoteId}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#06356b] text-white px-5 py-3 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            Add to my quote
          </button>
        </div>
      )}
    </Frame>
  );
}

// A visibly SEPARATE card from the white-label document above it — this is the
// one place FieldQuo shows its own face, and only to a contractor. The little
// wordmark makes clear it isn't part of the sender's quote.
function Frame({ children, tone }) {
  return (
    <div className="max-w-2xl mx-auto mt-5">
      <div
        className={`rounded-2xl border p-5 sm:p-6 ${
          tone === "ok"
            ? "bg-green-50 border-green-200"
            : "bg-[#eef2f7] border-[#06356b]/15"
        }`}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-bold tracking-[0.15em] text-[#06356b]/70">
            FIELDQUO
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
