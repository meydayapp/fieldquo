// app/co/[token]/ChangeOrderApproval.js
//
// The addendum, as the homeowner reads and signs it. Fed by
// GET /api/public/change-orders/[token]; the signature goes to POST on the
// same route with a name, a drawn mark and consent — never an amount.
//
// Everything on the page is the company's: their logo, their brand colour
// through lib/documents/theme.js (measured, not guessed — contractors pick
// yellow and mid-grey), their phone on the "Ask a question" link. Nothing says
// FieldQuo. Words come from lib/i18n/clientDocCopy.js in the quote's language.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Loader2, MessageCircleQuestion } from "lucide-react";
import SignaturePad from "@/app/components/SignaturePad";
import { documentTheme, fillPair, ruleColor, washPair } from "@/lib/documents/theme";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { jsonBody } from "@/lib/jsonBody";

const APPROVE_GREEN = "#15803d";

export default function ChangeOrderApproval({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sigName, setSigName] = useState("");
  const [sigDataUrl, setSigDataUrl] = useState("");
  const [sigConsent, setSigConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const copyFor = (d) => clientDocCopy(d?.language || "en").changeOrder;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/change-orders/${token}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "not_found");
      setData(d);
    } catch (err) {
      setLoadError(err.message || "not_found");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve() {
    setSubmitting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/public/change-orders/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ signature: { name: sigName, dataUrl: sigDataUrl, consent: sigConsent } }, "signature"),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        // A 409 carries the row's state: it was approved in another tab, or
        // withdrawn. Re-read and show that, rather than an error on a page
        // whose facts have changed.
        if (res.status === 409) {
          await load();
          return;
        }
        throw new Error(d?.error || "");
      }
      setData(d);
    } catch (err) {
      setActionError(err.message || copyFor(data).signFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-black/10 rounded w-1/2" />
          <div className="h-64 bg-black/10 rounded-2xl" />
        </div>
      </Shell>
    );
  }

  if (!data) {
    const copy = clientDocCopy("en").changeOrder;
    return (
      <Shell>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-[#2d2520]">{copy.notFound}</p>
          <p className="text-sm text-[#2d2520]/60 mt-2">{copy.notFoundBody}</p>
          {loadError && loadError !== "not_found" && <p className="text-xs text-[#2d2520]/40 mt-3">{loadError}</p>}
        </div>
      </Shell>
    );
  }

  const c = data.company || {};
  const co = data.changeOrder;
  const copy = copyFor(data);
  const { money, date } = documentFormatters(data.language, c.currency);
  const theme = documentTheme(c);
  const fill = fillPair(theme);
  const rule = ruleColor(theme);
  const wash = washPair(theme);
  const m = data.money;
  const signed = (v) => `${Number(v) > 0 ? "+ " : ""}${money(v)}`;
  const days = Number.isInteger(co.scheduleDeltaDays) && co.scheduleDeltaDays !== 0 ? copy.days(co.scheduleDeltaDays) : null;
  const finishBefore = data.schedule?.finishBefore ? date(data.schedule.finishBefore) : null;
  const finishAfter = data.schedule?.finishAfter ? date(data.schedule.finishAfter) : null;
  const approved = co.status === "approved";
  const withdrawn = co.status === "rejected";
  const open = co.status === "waiting_client";
  const canSign = sigName.trim().length > 0 && Boolean(sigDataUrl) && sigConsent;
  const pct = m?.taxKnown && m.taxRate ? `${Math.round(m.taxRate * 10000) / 100}%` : null;

  return (
    <Shell>
      <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex h-1.5">
          <div className="flex-[2]" style={{ backgroundColor: rule }} />
          <div className="flex-1" style={{ backgroundColor: theme.accentSoft }} />
        </div>

        <div className="px-5 sm:px-7 pt-5 pb-4 border-b border-black/5">
          <div className="flex items-start justify-between gap-x-4 gap-y-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 basis-[58%] grow">
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logoUrl} alt={c.name} className="h-11 w-auto max-w-[180px] object-contain" />
              ) : (
                <div className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: fill.bg, color: fill.fg }}>
                  <Building2 size={20} />
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-[#2d2520] truncate">{c.name}</div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="text-xs text-[#2d2520]/55 hover:text-[#2d2520]">
                    {c.phone}
                  </a>
                )}
              </div>
            </div>
            <div className="text-right ml-auto shrink-0">
              <div className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: theme.accentText }}>
                {copy.kicker}
              </div>
              <div className="font-bold text-[#2d2520]">{co.label}</div>
              {data.quote?.quoteNumber && <div className="text-xs text-[#2d2520]/55">{copy.toQuote(data.quote.quoteNumber)}</div>}
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-7 py-5">
          <p className="text-[12.5px] text-[#2d2520]/60">
            {[copy.forClient(data.client?.name || ""), data.client?.address, date(co.createdAt)].filter(Boolean).join(" · ")}
          </p>
          <h1 className="text-lg font-semibold text-[#2d2520] mt-1.5 mb-3">{co.description}</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {co.originalLine && (
              <div className="border border-black/10 rounded-xl p-3">
                <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase text-[#2d2520]/45">{copy.originalLine}</div>
                <p className="text-sm text-[#2d2520] mt-1">{co.originalLine.description}</p>
                {co.originalLine.amount != null && (
                  <p className="text-sm text-[#2d2520]/60 tabular-nums mt-0.5">{money(co.originalLine.amount)}</p>
                )}
              </div>
            )}
            <div className="rounded-xl p-3" style={{ backgroundColor: wash.bg, border: `1px solid ${rule}` }}>
              <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color: wash.accent }}>
                {copy.theChange}
              </div>
              {co.bodyHtml ? (
                // Sanitised server-side by lib/jobs/changeOrderAddendum.js —
                // a closed allow-list of inline formatting and lists, every
                // attribute dropped except a safe href.
                <div
                  className="text-sm mt-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:underline"
                  style={{ color: wash.ink }}
                  dangerouslySetInnerHTML={{ __html: co.bodyHtml }}
                />
              ) : (
                <p className="text-sm mt-1" style={{ color: wash.ink }}>
                  {co.description}
                </p>
              )}
              <p className="text-sm font-bold tabular-nums mt-1" style={{ color: wash.ink }}>
                {signed(co.priceDelta)}
              </p>
            </div>
          </div>

          {co.photos?.length > 0 && (
            <div className={`mt-3 grid gap-2 ${co.photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {co.photos.map((url, i) => (
                <figure key={url} className="relative rounded-xl overflow-hidden bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-40 object-cover" />
                  {i === 0 && (
                    <figcaption className="absolute left-2 bottom-2 text-[10px] font-bold tracking-wider uppercase bg-white/90 text-[#2d2520] px-1.5 py-0.5 rounded">
                      {copy.photo(date(co.createdAt))}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}

          {m && (
            <div className="mt-4 text-sm">
              <Row label={copy.quoteTotalAsApproved(data.quote?.acceptedAt ? date(data.quote.acceptedAt) : "")} value={money(m.quoteTotal)} />
              {m.priorApproved !== 0 && <Row label={copy.priorChanges} value={signed(m.priorApproved)} />}
              <Row label={copy.thisChange} value={signed(m.change)} />
              {m.taxKnown && m.tax !== 0 && <Row label={copy.taxOnChange(pct || "")} value={signed(m.tax)} />}
              {!m.taxKnown && <p className="text-xs text-[#2d2520]/55 py-1">{copy.taxUnknown}</p>}
              <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 mt-1.5" style={{ backgroundColor: fill.bg, color: fill.fg }}>
                <span className="text-[11px] font-bold tracking-[0.1em] uppercase">{copy.newTotal}</span>
                <span className="text-base font-extrabold tabular-nums">{money(m.newTotal)}</span>
              </div>
              <div className="flex items-start justify-between gap-3 py-2 mt-1.5">
                <span className="text-[#2d2520]/60">{copy.schedule}</span>
                <span className="text-right text-[#2d2520]">
                  {days && finishBefore && finishAfter
                    ? copy.finishMoves(finishBefore, finishAfter, days)
                    : days
                      ? copy.finishMovesBy(days)
                      : copy.scheduleUnchanged}
                </span>
              </div>
            </div>
          )}

          {approved && (
            <Settled tone="green" title={copy.approvedTitle} body={`${copy.approvedBody(c.name)}${co.signedAt ? ` ${copy.approvedOn(date(co.signedAt))}` : ""}`} />
          )}
          {withdrawn && <Settled tone="muted" title={copy.withdrawnTitle} body={copy.withdrawnBody(c.name)} />}
          {!approved && !withdrawn && !open && <Settled tone="muted" title={copy.notFound} body={copy.notFoundBody} />}

          {open && (
            <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: wash.bg, border: `1px solid ${theme.border}` }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#2d2520] mb-1">{clientDocCopy(data.language).yourFullName}</label>
                  <input
                    value={sigName}
                    onChange={(e) => setSigName(e.target.value)}
                    placeholder={clientDocCopy(data.language).typeYourName}
                    className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-[#2d2520]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#2d2520] mb-1">{clientDocCopy(data.language).signature}</label>
                  <SignaturePad onChange={setSigDataUrl} height={90} />
                </div>
              </div>
              <label className="flex items-start gap-2 mt-3 text-xs text-[#2d2520]/85">
                <input type="checkbox" checked={sigConsent} onChange={(e) => setSigConsent(e.target.checked)} className="mt-0.5" />
                <span>
                  {copy.consent(money(m ? m.changeWithTax : co.priceDelta), money(m ? m.newTotal : co.priceDelta))}
                  {days ? copy.consentSchedule(days) : ""}
                </span>
              </label>
              {actionError && <p className="text-sm text-red-700 mt-2">{actionError}</p>}
              <div className="flex gap-2.5 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={approve}
                  disabled={submitting || !canSign}
                  className="inline-flex items-center gap-2 px-6 py-3 min-h-11 rounded-full text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: APPROVE_GREEN }}
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  {copy.approveAndSign}
                </button>
                {/* "Ask a question" is a real action: it opens the phone dialler
                    (or mail) to the company. A button that opened a form
                    nothing reads would be the dead control AGENTS.md is swept
                    for. */}
                {(c.phone || c.email) && (
                  <a
                    href={c.phone ? `tel:${c.phone}` : `mailto:${c.email}`}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-11 rounded-full text-sm font-semibold border border-black/15 text-[#2d2520]"
                  >
                    <MessageCircleQuestion size={15} />
                    {copy.askQuestion}
                  </a>
                )}
              </div>
            </div>
          )}

          <p className="text-[11.5px] text-[#2d2520]/50 mt-4">{copy.footer(c.name, c.phone)}</p>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-dvh bg-[#f5f2ec] py-8 sm:py-14 px-4">
      <div className="max-w-xl mx-auto">{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-black/5">
      <span className="text-[#2d2520]/60">{label}</span>
      <span className="tabular-nums text-[#2d2520]">{value}</span>
    </div>
  );
}

function Settled({ tone, title, body }) {
  const green = tone === "green";
  return (
    <div className={`mt-4 rounded-xl p-4 border ${green ? "bg-green-50 border-green-200" : "bg-black/[0.03] border-black/10"}`}>
      <p className={`font-semibold ${green ? "text-green-800" : "text-[#2d2520]"}`}>{title}</p>
      <p className={`text-sm mt-1 ${green ? "text-green-800/80" : "text-[#2d2520]/65"}`}>{body}</p>
    </div>
  );
}
