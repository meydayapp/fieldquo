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
import {
  readableForeground,
  accessiblePair,
  ensureContrast,
} from "@/lib/brand/colour";
import SignaturePad from "@/app/components/SignaturePad";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { monthlyPayment } from "@/lib/financing/monthlyEstimate";
import { jsonBody } from "@/lib/jsonBody";
import { visibleLineItems } from "@/lib/quotes/scopeGroupDisplay";

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
  const canSign =
    sigName.trim().length > 1 && Boolean(sigDataUrl) && sigConsent;

  // The language is resolved server-side (quote.language → client.language →
  // company default → en), so it matches the PDF and the covering email the
  // client already received. Labels, dates and money all follow from it.
  const language = quote?.language || "en";
  const labels = documentLabels(language);
  const copy = clientDocCopy(language);
  // Currency stays the COMPANY's billing currency (falls back to CAD until
  // loaded / if unset); only the formatting locale shifts with the language.
  // quote is null on the first renders, but money()/date() are only called in
  // the loaded quote view, so the optional chain is safe.
  const fmt = documentFormatters(language, quote?.company?.currency);
  const money = fmt.money;
  // Built against fmt.locale, not hand-concatenated with "%": French writes
  // "9,9 %" and the space and comma are both part of being readable to the
  // person deciding. Falls back to the bare number if Intl refuses the locale.
  const percent = (pct) => {
    try {
      return new Intl.NumberFormat(fmt.locale, {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(Number(pct) / 100);
    } catch {
      return `${pct}%`;
    }
  };

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
          setPicked(
            (data.addOns || []).filter((a) => a.selected).map((a) => a.id),
          );
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
        body: jsonBody({
          decision,
          addOnIds: decision === "accepted" ? picked : [],
          ...(decision === "accepted"
            ? {
                signature: {
                  name: sigName.trim(),
                  dataUrl: sigDataUrl,
                  consent: sigConsent,
                },
              }
            : {}),
        }, "approval"),
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
        throw new Error(data?.error || copy.genericError);
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

  /**
   * The monthly instalment shown under the total, or null.
   *
   * Recomputed in the page for the same reason the total is: it has to move the
   * instant an extra is ticked, and an instalment frozen at the pre-extras
   * figure would be a wrong number sitting directly under a right one.
   *
   * `monthlyPayment` is the same pure function the check script exercises, and
   * it is reached only through `quote.financing.terms` — which the server sends
   * as null unless the COMPANY typed both a rate and a term. There is no default
   * APR and no default term anywhere behind this, so "no terms" renders no
   * figure rather than a plausible-looking guess.
   */
  const instalment = useMemo(() => {
    const terms = quote?.financing?.terms;
    if (!terms) return null;
    const monthly = monthlyPayment({
      principal: pricing.total,
      aprPct: terms.aprPct,
      termMonths: terms.termMonths,
    });
    return monthly === null ? null : { monthly, ...terms };
  }, [quote, pricing.total]);

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
  // The financing panel's heading sits on a 5%-alpha accent wash over white.
  // #f2f2f2 is the darkest that wash can composite to (a pure-black accent), so
  // measuring against it guarantees the real pairing is at least this readable.
  const financingInk = ensureContrast(accent, "#f2f2f2", 4.5);
  const expired =
    quote.validUntil && new Date(quote.validUntil) < new Date() && !decided;

  const addOns = quote.addOns || [];
  // Resolved server-side from the largest scope group; [] for a trade that has
  // no jargon worth explaining, and the panel then does not render at all.
  const glossary = quote.glossary || [];
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
                className="text-lg font-bold tracking-[0.15em] leading-none uppercase"
                style={{ color: accent }}
              >
                {labels.quote}
              </div>
              <div className="font-mono text-sm text-[#2d2520] mt-1">
                {quote.quoteNumber}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-6">
          <p className="text-sm text-[#2d2520]/60">{labels.preparedFor}</p>
          <p className="text-lg font-semibold text-[#2d2520]">
            {quote.client?.name}
          </p>

          {quote.validUntil && (
            <p className="text-sm mt-2 text-[#2d2520]/60">
              {labels.validUntil} {fmt.date(quote.validUntil)}
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
            // The "01" badge sits ON the group's colour, and those colours are
            // deliberately desaturated mid-tones (serviceContent.js), which is
            // the one case where no foreground clears 4.5:1 — the clay reaches
            // 4.36 against white and the ochre 4.39 against ink. So the badge
            // fill nudges instead of the text, exactly as fillPair does for the
            // document. The card's left border and wash keep the untouched
            // colour, so the section still reads as that trade.
            const badge = accessiblePair(groupAccent);

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
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: badge.bg, color: badge.fg }}
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
                  {/* The scope paragraph, above the prices — the same place
                      the PDF puts it, so the page and the attachment stay one
                      document. /80 rather than the /70 the bullets use: this
                      is the sentence the whole card depends on, and it clears
                      4.5:1 composited over white where /70 does not. */}
                  {g.description && (
                    <p className="mb-3 border-b border-black/5 pb-3 text-xs leading-relaxed text-[#2d2520]/80">
                      {g.description}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    {/* Not g.lineItems directly — a blended subcontractor
                        import's one line repeats the card head above word
                        for word, dollar for dollar. See
                        lib/quotes/scopeGroupDisplay.js. */}
                    {visibleLineItems(g).map((li, j) => (
                      <div key={j}>
                        <div className="flex justify-between gap-4 text-sm text-[#2d2520]">
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
                        {/* The scope under the name, same as the PDF — this
                            page and the printed quote are the same document
                            and a client who opens both must not find one of
                            them explaining more than the other.

                            whitespace-pre-line: an estimator who typed a list
                            of steps on separate lines gets a list, not one
                            run-on paragraph. */}
                        {li.detail ? (
                          <p className="mt-0.5 pl-2 pr-12 text-xs leading-relaxed text-[#2d2520]/70 whitespace-pre-line">
                            {li.detail}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {g.included?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-[10px] font-bold tracking-wider text-[#2d2520]/40 mb-1.5 uppercase">
                        {copy.whatsIncluded}
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

                  {/* Said before the work starts rather than on day three. The
                      unknowns a roof (or a foundation, or a rewire) genuinely
                      has are the questions this client is about to ask anyway;
                      answering them here is what a second opinion reads like. */}
                  {g.mayChange?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-black/5">
                      <p className="text-[10px] font-bold tracking-wider text-[#2d2520]/40 mb-1.5 uppercase">
                        {copy.whatCouldChange}
                      </p>
                      <dl className="space-y-1.5">
                        {g.mayChange.map((entry, k) => (
                          <div key={k}>
                            <dt className="text-xs font-semibold text-[#2d2520]/80">
                              {entry.title}
                            </dt>
                            <dd className="text-xs leading-relaxed text-[#2d2520]/70">
                              {entry.body}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {glossary.length > 0 && (
            <div className="rounded-xl border border-black/5 bg-black/[0.02] px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#2d2520]/40">
                {copy.termsExplained}
              </p>
              <dl className="space-y-1.5">
                {glossary.map((entry, k) => (
                  <div key={k} className="sm:flex sm:gap-3">
                    <dt className="text-xs font-semibold text-[#2d2520]/80 sm:w-32 sm:shrink-0">
                      {entry.term}
                    </dt>
                    <dd className="text-xs leading-relaxed text-[#2d2520]/70">
                      {entry.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {addOns.length > 0 && (
            <div className="pt-4 border-t border-black/5">
              <h2
                className="text-sm font-bold uppercase tracking-wide pb-2 mb-1 border-b"
                style={{ color: accent, borderColor: `${accent}44` }}
              >
                {copy.optionalExtras}
              </h2>
              <p className="text-xs text-[#2d2520]/50 mt-2 mb-3">
                {locked ? copy.extrasChosen : copy.extrasTickHint}
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
                className="text-xs font-bold tracking-wider mb-3 uppercase"
                style={{ color: accent }}
              >
                {copy.howTheWorkRuns}
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
                          {/* "When do I get my house back" is what a client
                              scans a process list for. Beside the step, not
                              buried in the sentence — and simply absent for a
                              trade whose content does not state one. */}
                          {s.timeline && (
                            <span className="ml-2 text-xs font-normal text-[#2d2520]/45">
                              {s.timeline}
                            </span>
                          )}
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
                className="text-xs font-bold tracking-wider mb-2.5 uppercase"
                style={{ color: accent }}
              >
                {copy.paymentTerms}
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
                <p className="text-sm text-[#2d2520]/70">
                  {quote.paymentTerms}
                </p>
              )}
            </div>
          )}

          {quote.notes && (
            <div className="pt-4 border-t border-black/5">
              <h3 className="text-sm font-semibold text-[#2d2520] mb-1">
                {labels.notes}
              </h3>
              <p className="text-sm text-[#2d2520]/70 whitespace-pre-wrap">
                {quote.notes}
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-black/5 space-y-1 text-sm">
            <Row
              label={labels.subtotal}
              value={pricing.subtotal}
              money={money}
            />
            {quote.discount > 0 && (
              <Row
                label={labels.discount}
                value={-quote.discount}
                money={money}
              />
            )}
            {/* ── Not always a number ────────────────────────────────────
                A money row reading "$0.00" says tax was worked out and came to
                nothing. Q-2026-0011 said that here on $5,250 of Ontario work
                with tax switched on. `taxKind` comes from the server (see
                lib/tax/documentTax.js) and is overridden the moment a taxable
                extra is ticked, because then a real figure exists. */}
            {pricing.tax !== 0 || quote.taxKind === "charged" ? (
              <Row label={labels.tax} value={pricing.tax} money={money} />
            ) : (
              <div className="flex justify-between text-[#2d2520]/70">
                <span>{labels.tax}</span>
                <span>
                  {quote.taxKind === "unresolved"
                    ? labels.taxUnresolved
                    : labels.taxNone}
                </span>
              </div>
            )}
            {pricing.extras > 0 && (
              <div className="flex justify-between text-[#2d2520]/70">
                <span>{copy.includesOptionalExtras}</span>
                <span className="tabular-nums">{money(pricing.extras)}</span>
              </div>
            )}
            {/* The rate came from the contractor's own province, not this
                homeowner's — because we have no address for them. They are the
                one person who can correct it, and an Ottawa contractor quoting
                a Gatineau kitchen is 2% under. */}
            {quote.taxAssumedRegion && (
              <p className="text-xs text-[#2d2520]/55 leading-snug pt-1">
                {labels.taxAssumedNote.replace(
                  "{region}",
                  quote.taxAssumedRegion,
                )}
              </p>
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
            <span className="text-sm font-bold tracking-wide uppercase">
              {labels.total}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {money(pricing.total)}
            </span>
          </div>

          {/* ── Financing ──────────────────────────────────────────────────
              Directly under the total, because "can I afford this" is the
              question the total just provoked.

              The monthly figure appears ONLY when the company stated its own
              APR and term; otherwise this is the company's own "ask us"
              sentence and nothing numeric. FieldQuo has no default rate to
              fall back on, deliberately — see lib/financing/monthlyEstimate.js.

              And where a real lender quotes its own terms, that wins: the
              provider link goes to them, and at Stripe Checkout Affirm renders
              its own figure. This panel is the contractor's illustration
              before any of that, and says so. */}
          {quote.financing && (
            <div
              className="rounded-xl border px-4 py-3.5"
              style={{
                borderColor: `${accent}33`,
                backgroundColor: `${accent}0d`,
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                // Measured against the darkest this 5%-alpha wash can composite
                // to (#f2f2f2, the black-accent case), so the real background is
                // never darker than what was checked. A contractor whose brand
                // is pale yellow otherwise gets a heading nobody can read.
                style={{ color: financingInk }}
              >
                {/* "Pay monthly" is a promise the heading can only make when
                    there IS a monthly figure under it. With no stated terms the
                    panel is just "financing exists, ask us", and it says that. */}
                {instalment ? copy.financingHeading : copy.financingAvailable}
              </p>

              {quote.financing.note && (
                <p className="text-sm text-[#2d2520]/80 mt-1.5 leading-relaxed">
                  {quote.financing.note}
                </p>
              )}

              {instalment && (
                <div className="mt-2.5">
                  <p className="text-xl font-bold text-[#2d2520] tabular-nums leading-tight">
                    {copy.financingMonthly(money(instalment.monthly))}
                  </p>
                  <p className="text-xs text-[#2d2520]/70 mt-0.5">
                    {copy.financingTermsLine(
                      instalment.termMonths,
                      percent(instalment.aprPct),
                    )}
                  </p>
                  <p className="text-xs text-[#2d2520]/60 mt-2 leading-relaxed">
                    {copy.financingEstimateNote(c.name)}
                  </p>
                </div>
              )}

              {quote.financing.url && (
                <a
                  href={quote.financing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 px-4 py-2 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: accent, color: accentOn }}
                >
                  {copy.financingCta}
                </a>
              )}
            </div>
          )}
        </div>

        <div className="px-6 sm:px-8 py-6 bg-[#faf8f4] border-t border-black/5">
          {decided === "accepted" ? (
            <Settled
              tone="ok"
              title={copy.approvedTitle}
              body={copy.approvedBody(c.name)}
            />
          ) : decided === "declined" ? (
            <Settled
              tone="muted"
              title={copy.declinedTitle}
              body={copy.declinedBody(c.name)}
            />
          ) : expired ? (
            <Settled
              tone="muted"
              title={copy.expiredTitle}
              body={copy.expiredBody(c.name)}
            />
          ) : confirming ? (
            <div className="text-center">
              <p className="font-semibold text-[#2d2520]">
                {confirming === "accepted"
                  ? copy.approveConfirm(money(pricing.total))
                  : copy.declineConfirm}
              </p>
              <p className="text-sm text-[#2d2520]/60 mt-1">
                {confirming === "accepted"
                  ? pricing.extras > 0
                    ? copy.approveSubExtras(money(pricing.extras))
                    : copy.approveSubPlain
                  : copy.declineSub}
              </p>

              {confirming === "accepted" && (
                <div className="mt-5 text-left max-w-sm mx-auto">
                  <label className="block text-sm font-medium text-[#2d2520] mb-1">
                    {copy.yourFullName}
                  </label>
                  <input
                    value={sigName}
                    onChange={(e) => setSigName(e.target.value)}
                    placeholder={copy.typeYourName}
                    className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm mb-3"
                  />
                  <label className="block text-sm font-medium text-[#2d2520] mb-1">
                    {copy.signature}
                  </label>
                  <SignaturePad onChange={setSigDataUrl} />
                  <label className="flex items-start gap-2 mt-3 text-xs text-[#2d2520]/80">
                    <input
                      type="checkbox"
                      checked={sigConsent}
                      onChange={(e) => setSigConsent(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{copy.signatureConsent(money(pricing.total))}</span>
                  </label>
                </div>
              )}

              <div className="flex gap-3 justify-center mt-4 flex-wrap">
                <button
                  onClick={() => submit(confirming)}
                  disabled={
                    submitting || (confirming === "accepted" && !canSign)
                  }
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white disabled:opacity-60"
                  style={{
                    backgroundColor:
                      confirming === "accepted" ? "#16a34a" : "#4b5563",
                  }}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  {confirming === "accepted"
                    ? copy.yesApprove
                    : copy.yesDecline}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  disabled={submitting}
                  className="px-6 py-3 rounded-full text-sm font-semibold border border-black/15 text-[#2d2520]"
                >
                  {copy.goBack}
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
                <Check size={16} /> {copy.approveThisQuote}
              </button>
              <button
                onClick={() => setConfirming("declined")}
                className="inline-flex items-center gap-2 border border-black/15 text-[#2d2520] px-7 py-3 rounded-full text-sm font-semibold"
              >
                <X size={16} /> {copy.decline}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[#2d2520]/40 mt-6">
        {copy.quoteQuestions(c.name, c.phone)}
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

// `money` is component-scoped (it carries the quote's currency AND the reader's
// locale), so this module-level helper takes it as a prop rather than
// referencing a `money` that isn't in scope — which would crash the whole page.
function Row({ label, value, money }) {
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
        ok ? "bg-green-50 border-green-200" : "bg-white border-black/10"
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
