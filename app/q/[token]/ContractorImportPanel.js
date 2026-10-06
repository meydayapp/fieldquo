// app/q/[token]/ContractorImportPanel.js
//
// The contractor-only affordance under a received quote. A homeowner never sees
// this — the document above stays fully white-label. It appears only for a
// SIGNED-IN contractor of a different company from the sender, which is the one
// signal we can actually stand behind; `canImport` in
// /api/quotes/received/[token] is where that is decided.
//
// It used to also claim to appear "when the quote was addressed to a business".
// It did not, and could not: the guard below has always returned null first.
// See the note on that guard.
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
import { useTranslation } from "@/app/hooks/useTranslation";
import { NEW_IMPORT_TARGET as NEW_TARGET } from "@/lib/quotes/addToQuoteLink";

const MARKUP_PRESETS = [0, 10, 20, 30];

// `initialCtx`: the add-this-price page (app/q/[token]/add) has already
// fetched the context to decide what to show around this card, so it hands it
// over rather than having the same request made twice.
//
// `preferTarget`: the quote page's "Add a sub's quote" sends the contractor
// here with the quote they started from (…/add?target=<id>), so that quote is
// pre-selected when it is one of theirs that can take the price.
export default function ContractorImportPanel({ token, initialCtx = null, preferTarget = null }) {
  // The viewer here is a signed-in contractor, never the homeowner, so the
  // app catalogue (their own language) is the right one — the white-label
  // document above this card speaks the QUOTE's language, this card speaks
  // the reader's.
  const { t } = useTranslation();
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);

  const [targetQuoteId, setTargetQuoteId] = useState("");
  const [preset, setPreset] = useState(20);
  const [useCustom, setUseCustom] = useState(false);
  const [customMarkup, setCustomMarkup] = useState("");
  const [display, setDisplay] = useState("blended");
  const [label, setLabel] = useState("");
  // "Start a new quote": who it is for. The kind has NO default — a client is
  // a homeowner or a business because somebody said so (lib/quotes/importTarget.js).
  const [newClientName, setNewClientName] = useState("");
  const [newClientType, setNewClientType] = useState("");
  // Hold it beside other bids for the same trade instead of putting it in
  // front of the client now. A yes/no — the server decides what it means.
  const [asOption, setAsOption] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const adopt = (data) => {
      setCtx(data);
      const known = [...(data.openQuotes || []), ...(data.approvedQuotes || [])];
      // The quote they came from, when it can take the price; else the
      // newest open quote; else an approved one; else a new one when allowed.
      if (preferTarget && known.some((q) => q.id === preferTarget)) setTargetQuoteId(preferTarget);
      else if (data.openQuotes?.length) setTargetQuoteId(data.openQuotes[0].id);
      else if (data.approvedQuotes?.length) setTargetQuoteId(data.approvedQuotes[0].id);
      else if (data.canStartNew) setTargetQuoteId(NEW_TARGET);
    };
    if (initialCtx) {
      adopt(initialCtx);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const res = await fetch(`/api/quotes/received/${token}`);
        const data = await res.json().catch(() => null);
        if (cancelled || !res.ok || !data) return;
        adopt(data);
      } catch {
        /* a failed context load just means no panel — never break the quote */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, initialCtx, preferTarget]);

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
  //
  // ── The signed-out on-ramp is gone, not hidden ────────────────────────────
  //
  // A second `if (!ctx.canImport)` used to sit thirty lines below this one,
  // wrapping a "Are you the contractor on this job? / Start free — first month
  // free / Sign in" pitch. The guard above made it unreachable: by the time
  // control got there, canImport was true by definition. So it was thirty lines
  // of signup UI, on the highest-stakes white-label surface in the product,
  // that nobody could ever see.
  //
  // It has been deleted rather than revived, because reviving it would mean
  // undoing the guard, and the guard is the fix for a real leak: we cannot tell
  // a signed-out contractor from a homeowner, and the previous attempt at that
  // distinction (`clientIsCompany`) put a FieldQuo recruitment pitch under a
  // quote a business was reading as a customer. A pitch nobody sees and a pitch
  // shown to the wrong person are both worse than no pitch.
  if (!ctx.canImport) return null;

  const money = (n) => formatMoney(n, ctx.currency);
  const markup = useCustom ? Math.max(0, Number(customMarkup) || 0) : preset;
  const cost = Number(ctx.amount || 0);
  const clientPrice = Math.round(cost * (1 + markup / 100) * 100) / 100;

  // ── Success ───────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Frame tone="ok">
        <div className="flex items-start gap-2">
          <Check size={18} className="text-green-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#2d2520]">
              {t("app.quoteImport.addedTo", {
                quote: done.quoteNumber || t("app.quoteImport.yourQuote"),
              })}
            </p>
            {/* Three different outcomes, said as what they are: a line on the
                quote, a change order the client still has to sign, or an
                option nobody but the contractor can see yet. */}
            {done.placement === "change_order" ? (
              <p className="text-sm text-[#2d2520]/70 mt-1">
                {t("app.quoteImport.clientPriceIs", { price: money(done.clientPrice) })}{" "}
                {t("app.quoteImport.addedAsCo", {
                  quote: done.quoteNumber || t("app.quoteImport.yourQuote"),
                  co: done.changeOrderLabel || "",
                })}
              </p>
            ) : done.placement === "option" ? (
              <p className="text-sm text-[#2d2520]/70 mt-1">
                {t("app.quoteImport.addedAsOption", { quote: done.quoteNumber || t("app.quoteImport.yourQuote") })}
              </p>
            ) : (
              <p className="text-sm text-[#2d2520]/70 mt-1">
                {t("app.quoteImport.clientPriceIs", { price: money(done.clientPrice) })}
                {done.targetTotal != null && (
                  <> {t("app.quoteImport.totalNow", { total: money(done.targetTotal) })}</>
                )}{" "}
                {t("app.quoteImport.pendingUntil")}
              </p>
            )}
            <a
              href={done.quoteId ? `/app/quotes/${done.quoteId}` : "/app/quotes"}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#06356b] mt-3"
            >
              {done.quoteId
                ? t("app.quoteImport.openQuote", { quote: done.quoteNumber || t("app.quoteImport.yourQuote") })
                : t("app.quoteImport.openQuotes")}{" "}
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </Frame>
    );
  }

  const approvedQuotes = ctx.approvedQuotes || [];
  const noQuotes = !ctx.openQuotes?.length && !approvedQuotes.length && !ctx.canStartNew;
  const startingNew = targetQuoteId === NEW_TARGET;
  const newReady = !startingNew || (newClientName.trim() && newClientType);
  // An approved quote is not edited: the price goes to the client as a
  // change order to sign (or is held as an option to compare first).
  const approvedTarget = approvedQuotes.some((q) => q.id === targetQuoteId);

  async function submit() {
    if (!targetQuoteId || submitting || !newReady) return;
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
          ...(asOption && !startingNew ? { asOption: true } : {}),
          ...(startingNew ? { newClient: { name: newClientName.trim(), type: newClientType } } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || t("app.quoteImport.addError"));
      const q = [...ctx.openQuotes, ...approvedQuotes].find((x) => x.id === targetQuoteId);
      setDone({
        targetTotal: data.targetTotal,
        clientPrice: data.import?.clientPrice ?? clientPrice,
        quoteNumber: data.targetQuoteNumber || q?.quoteNumber,
        quoteId: data.targetQuoteId || null,
        placement: data.placement || "line",
        changeOrderLabel: data.changeOrder?.label || null,
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
        {t("app.quoteImport.title")}
      </p>
      <p className="text-xs text-[#2d2520]/60 mt-0.5">
        {ctx.sourceCompanyName
          ? t("app.quoteImport.introNamed", { company: ctx.sourceCompanyName, price: money(cost) })
          : t("app.quoteImport.intro", { price: money(cost) })}
      </p>

      {noQuotes ? (
        <div className="mt-4 rounded-lg border border-black/10 bg-white px-4 py-3">
          <p className="text-sm text-[#2d2520]/70">
            {t("app.quoteImport.noOpenQuote")}
          </p>
          <a
            href="/app/quotes/new"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#06356b] mt-2"
          >
            {t("app.quoteImport.createFirst")} <ExternalLink size={13} />
          </a>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Which of the contractor's quotes to add it to */}
          <label className="block">
            <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
              {t("app.quoteImport.addToQuote")}
            </span>
            <select
              value={targetQuoteId}
              onChange={(e) => setTargetQuoteId(e.target.value)}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
            >
              {approvedQuotes.length > 0 ? (
                <>
                  {ctx.openQuotes.length > 0 && (
                    <optgroup label={t("app.quoteImport.openGroup")}>
                      {ctx.openQuotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quoteNumber}
                          {q.clientName ? ` — ${q.clientName}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={t("app.quoteImport.approvedGroup")}>
                    {approvedQuotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quoteNumber}
                        {q.clientName ? ` — ${q.clientName}` : ""}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : (
                ctx.openQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quoteNumber}
                    {q.clientName ? ` — ${q.clientName}` : ""}
                  </option>
                ))
              )}
              {ctx.canStartNew && (
                <option value={NEW_TARGET}>{t("app.quoteImport.startNew")}</option>
              )}
            </select>
          </label>

          {approvedTarget && (
            <p className="text-xs text-[#2d2520]/70 -mt-2">{t("app.quoteImport.approvedHint")}</p>
          )}

          {/* Several subs quoting the same trade: hold this one to compare,
              and choose on the quote page. Not offered for a brand-new
              quote — there is nothing yet to compare it with. */}
          {!startingNew && (
            <label className="flex items-start gap-2 text-sm text-[#2d2520]">
              <input type="checkbox" checked={asOption} onChange={(e) => setAsOption(e.target.checked)} className="mt-1" />
              <span>
                {t("app.quoteImport.asOption")}
                <span className="block text-[11px] text-[#2d2520]/55">{t("app.quoteImport.asOptionHint")}</span>
              </span>
            </label>
          )}

          {/* A new quote needs a client, and the page can't know who it is. */}
          {startingNew && (
            <div className="space-y-2">
              <label className="block">
                <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
                  {t("app.quoteImport.newClientName")}
                </span>
                <input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("app.quoteImport.newClientKind")}>
                {[
                  ["individual", t("app.quoteImport.newClientHomeowner")],
                  ["company", t("app.quoteImport.newClientBusiness")],
                ].map(([val, txt]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setNewClientType(val)}
                    aria-pressed={newClientType === val}
                    className={`inline-flex items-center px-4 py-1.5 min-h-11 rounded-full text-sm font-semibold border ${
                      newClientType === val
                        ? "bg-[#06356b] text-white border-[#06356b]"
                        : "bg-white text-[#2d2520] border-black/15"
                    }`}
                  >
                    {txt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Markup */}
          <div>
            <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
              {t("app.quoteImport.yourMarkup")}
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
                  className={`inline-flex items-center px-4 py-1.5 min-h-11 rounded-full text-sm font-semibold border ${
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
                className={`inline-flex items-center px-4 py-1.5 min-h-11 rounded-full text-sm font-semibold border ${
                  useCustom
                    ? "bg-[#06356b] text-white border-[#06356b]"
                    : "bg-white text-[#2d2520] border-black/15"
                }`}
              >
                {t("app.quoteImport.custom")}
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
              {t("app.quoteImport.onClientQuote")}
            </span>
            <div className="flex gap-1.5">
              {[
                ["blended", t("app.quoteImport.oneLine")],
                ["itemized", t("app.quoteImport.itemised")],
              ].map(([val, txt]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDisplay(val)}
                  className={`inline-flex items-center px-4 py-1.5 min-h-11 rounded-full text-sm font-semibold border ${
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
              {t("app.quoteImport.neverSees")}
            </p>
          </div>

          {/* Label */}
          <label className="block">
            <span className="block text-xs font-medium text-[#2d2520]/70 mb-1">
              {t("app.quoteImport.labelOptional")}
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("app.quoteImport.labelPlaceholder")}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
            />
          </label>

          {/* Live client-price preview */}
          <div className="flex items-center justify-between rounded-lg bg-white border border-black/10 px-4 py-3">
            <div className="text-sm text-[#2d2520]/70">
              {t("app.quoteImport.yourClientPrice")}
              <span className="text-[11px] text-[#2d2520]/45 block">
                {t("app.quoteImport.priceFormula", { cost: money(cost), markup })}
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
            disabled={submitting || !targetQuoteId || !newReady}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#06356b] text-white px-5 py-3 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            {asOption && !startingNew
              ? t("app.quoteImport.submitOption")
              : approvedTarget
                ? t("app.quoteImport.submitApproved")
                : t("app.quoteImport.submit")}
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
