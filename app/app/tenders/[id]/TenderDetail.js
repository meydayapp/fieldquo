"use client";

// app/app/tenders/[id]/TenderDetail.js
//
// One tender: how questions must be asked (first, as a banner — asking the
// wrong way can disqualify a bid), the deadlines in the buyer's zone, the
// status buttons, our bid quote, the job once won, the people, the
// requirements and the documents.
//
// Every control here calls a route that does the thing:
//   status buttons      POST /api/tenders/[id]/status  (lib/tenders/status.js)
//   Create quote        /app/quotes/new?clientId=…&tenderId=… — the ordinary
//                       quote builder, which links the new quote back
//   Link / Unlink quote POST /api/tenders/[id]/quote
//   Convert to job      POST /api/tenders/[id]/job     (lib/jobs/createJob.js)
//   Add document        uploadFile() → POST /api/tenders/[id]/documents
//   Add to my calendar  GET  /api/tenders/[id]/ics
// A control the member may not use is not drawn, rather than drawn disabled.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, MessageSquareWarning, CalendarPlus, FileText, Trash2, Upload, Briefcase, ExternalLink } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { uploadFile } from "@/lib/media/uploadClient";
import ListState from "@/app/components/ListState";
import { closingState, countdownParts, formatInZone } from "@/lib/tenders/time";
import { TENDER_DOCUMENT_KINDS, TENDER_UPLOAD_PURPOSE, OPEN_TENDER_STATUSES } from "@/lib/tenders/constants";
import { statusLabel, moveLabel, statusTone, sourceLabel, documentKindLabel, countdownText } from "../words";
import TenderForm from "../TenderForm";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10 min-h-[44px]";
const buttonClass = "min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground disabled:opacity-50";
const primaryClass = "min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50";

function Row({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-3 py-1.5">
      <dt className="text-xs text-muted-foreground sm:w-44 shrink-0">{label}</dt>
      <dd className="text-sm text-foreground break-words min-w-0">{children}</dd>
    </div>
  );
}

/** A deadline as the solicitation printed it: the instant in its zone, or the bare date. */
function deadline(date, time, instant, timeZone, language) {
  if (!date) return null;
  return time && instant ? formatInZone(instant, timeZone, language) : date;
}

/** The inputs a status move asks for, then the move itself. */
function MovePanel({ to, tender, canSeeMoney, onDone, onCancel, t }) {
  const [form, setForm] = useState({ reason: "", confirmationNumber: "", contractNumber: "", awardedValue: "", winningPrice: "", winnerName: "", debriefNotes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function go() {
    setBusy(true);
    setError("");
    const body = { status: to };
    if (["bid", "no_bid", "cancelled", "withdrawn"].includes(to)) body.reason = form.reason || null;
    if (to === "submitted") body.confirmationNumber = form.confirmationNumber || null;
    if (to === "won") {
      body.contractNumber = form.contractNumber || null;
      if (canSeeMoney) body.awardedValue = form.awardedValue || null;
    }
    if (to === "lost") {
      body.winnerName = form.winnerName || null;
      body.debriefNotes = form.debriefNotes || null;
      if (canSeeMoney) body.winningPrice = form.winningPrice || null;
    }
    try {
      const res = await fetch(`/api/tenders/${tender.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await reportResponseError(res, t("app.tenders.moveFailed", "Couldn't change the status.")));
        return;
      }
      onDone(await res.json());
    } finally {
      setBusy(false);
    }
  }

  const field = (k, label, extra = {}) => (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input className={`${inputClass} mt-1`} value={form[k]} onChange={set(k)} {...extra} />
    </label>
  );

  return (
    <div className="rounded-lg border border-border p-3 space-y-3" data-tender-move={to}>
      <p className="text-sm font-semibold text-foreground">{moveLabel(t, to)}</p>
      {["bid", "no_bid", "cancelled", "withdrawn"].includes(to) && (
        <label className="block text-xs text-muted-foreground">
          {to === "no_bid" ? t("app.tenders.move.reasonRequired", "Why not? (required)") : t("app.tenders.move.reason", "Why? (optional)")}
          <textarea className={`${inputClass} mt-1 min-h-[72px]`} value={form.reason} onChange={set("reason")} maxLength={1000} />
        </label>
      )}
      {to === "submitted" &&
        field("confirmationNumber", t("app.tenders.move.confirmation", "Portal confirmation number"), { maxLength: 120 })}
      {to === "won" && (
        <>
          {field("contractNumber", t("app.tenders.move.contractNumber", "Contract number"), { maxLength: 120 })}
          {canSeeMoney && field("awardedValue", t("app.tenders.move.awardedValue", "Contract value"), { inputMode: "decimal" })}
        </>
      )}
      {to === "lost" && (
        <>
          {canSeeMoney && field("winningPrice", t("app.tenders.move.winningPrice", "Winning price, if published"), { inputMode: "decimal" })}
          {field("winnerName", t("app.tenders.move.winner", "Who won, if known"), { maxLength: 200 })}
          <label className="block text-xs text-muted-foreground">
            {t("app.tenders.move.debrief", "Debrief notes")}
            <textarea className={`${inputClass} mt-1 min-h-[72px]`} value={form.debriefNotes} onChange={set("debriefNotes")} maxLength={5000} />
          </label>
        </>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={go} disabled={busy} className={primaryClass}>
          {busy ? t("app.tenders.saving", "Saving…") : t("app.tenders.move.confirm", "Confirm")}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass}>
          {t("app.tenders.cancel", "Cancel")}
        </button>
      </div>
    </div>
  );
}

function Documents({ tender, documents, canEdit, onChanged, t }) {
  const inputRef = useRef(null);
  const [kind, setKind] = useState("solicitation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      let entry;
      try {
        entry = await uploadFile(file, { purpose: TENDER_UPLOAD_PURPOSE });
      } catch (err) {
        setError(err?.serverMessage || err?.message || t("app.tenders.docs.uploadFailed", "Couldn't upload that file."));
        return;
      }
      const res = await fetch(`/api/tenders/${tender.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: entry.url,
          name: entry.filename || file.name,
          kind,
          mimeType: entry.mimeType || file.type || null,
          sizeBytes: entry.bytes ?? file.size,
        }),
      });
      if (!res.ok) {
        setError(await reportResponseError(res, t("app.tenders.docs.saveFailed", "The file uploaded but couldn't be filed on the tender.")));
        return;
      }
      onChanged(await res.json());
    } finally {
      setBusy(false);
    }
  }

  async function remove(doc) {
    setError("");
    const res = await fetch(`/api/tenders/${tender.id}/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await reportResponseError(res, t("app.tenders.docs.removeFailed", "Couldn't remove that document.")));
      return;
    }
    onChanged(await res.json());
  }

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3" data-tender-documents>
      <h2 className="text-sm font-semibold text-foreground">{t("app.tenders.docs.title", "Documents")}</h2>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("app.tenders.docs.empty", "No documents yet — file the solicitation, each addendum and what you submitted.")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 py-2">
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex items-center gap-2 min-h-[44px] text-sm text-foreground">
                <FileText size={14} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate">{doc.name}</span>
                  <span className="block text-xs text-muted-foreground">{documentKindLabel(t, doc.kind)}</span>
                </span>
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  aria-label={t("app.tenders.docs.remove", "Remove {name}", { name: doc.name })}
                  className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted-foreground"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select className={`${inputClass} sm:w-56`} value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("app.tenders.docs.kind", "Kind of document")}>
            {TENDER_DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {documentKindLabel(t, k)}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={`${buttonClass} inline-flex items-center gap-2 justify-center`}>
            <Upload size={14} /> {busy ? t("app.tenders.docs.uploading", "Uploading…") : t("app.tenders.docs.add", "Add a file")}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="application/pdf,.xlsx,.csv,image/*"
            onChange={pick}
            disabled={busy}
          />
        </div>
      )}
      {canEdit && <p className="text-xs text-muted-foreground">{t("app.tenders.docs.hint", "PDFs, spreadsheets (.xlsx, .csv) and photos.")}</p>}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </section>
  );
}

export default function TenderDetail({ id }) {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState("");
  const [linkQuoteId, setLinkQuoteId] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/tenders/${id}`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const tender = data?.tender;
  const caps = data?.capabilities || {};

  async function post(path, body, key) {
    setBusy(key);
    setActionError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) {
        setActionError(await reportResponseError(res, t("app.tenders.actionFailed", "That didn't work.")));
        return null;
      }
      const next = await res.json();
      setData(next);
      return next;
    } finally {
      setBusy("");
    }
  }

  const state = tender ? closingState(tender, now) : null;
  const open = tender && OPEN_TENDER_STATUSES.includes(tender.status);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <Link href="/app/tenders" className="inline-flex items-center gap-1 text-sm text-muted-foreground min-h-[44px]">
        <ArrowLeft size={14} /> {t("app.tenders.back", "Tenders")}
      </Link>

      <ListState loading={loading} errorKey={errorKey} isEmpty={false} onRetry={load}>
        {tender && editing ? (
          <TenderForm
            mode="edit"
            tender={tender}
            capabilities={caps}
            companyTimeZone={data.companyTimeZone}
            onSaved={(next) => {
              setData(next);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : tender ? (
          <div className="space-y-4">
            {/* ── Header ───────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground break-words">{tender.title}</h1>
                <p className="text-sm text-muted-foreground break-words">
                  {[tender.solicitationNumber, tender.buyerBranch].filter(Boolean).join(" · ")}
                </p>
                <p className="text-sm text-foreground mt-1">
                  {tender.client?.missing ? (
                    t("app.tenders.clientRemoved", "Client removed")
                  ) : tender.client ? (
                    <Link href={`/app/clients/${tender.client.id}`} className="underline">
                      {tender.client.name}
                    </Link>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(tender.status)}`}>{statusLabel(t, tender.status)}</span>
                {caps.canEdit && (
                  <button type="button" onClick={() => setEditing(true)} className={`${buttonClass} inline-flex items-center gap-1`}>
                    <Pencil size={14} /> {t("app.tenders.edit", "Edit")}
                  </button>
                )}
              </div>
            </div>

            {/* ── How questions must be asked — first, on purpose ─────── */}
            {tender.questionsChannel && (
              <div className="rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3" role="note" data-tender-questions-banner>
                <MessageSquareWarning size={20} className="shrink-0 text-amber-900 dark:text-amber-100 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
                    {t("app.tenders.questionsBanner", "How questions must be asked")}
                  </p>
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-50 break-words">{tender.questionsChannel}</p>
                </div>
              </div>
            )}

            {/* ── Deadlines ─────────────────────────────────────────── */}
            <section className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">{t("app.tenders.deadlines", "Deadlines")}</h2>
                <a
                  href={`/api/tenders/${tender.id}/ics?lang=${encodeURIComponent(language || "en")}`}
                  className={`${buttonClass} inline-flex items-center gap-1`}
                  data-tender-ics
                >
                  <CalendarPlus size={14} /> {t("app.tenders.addToCalendar", "Add to my calendar")}
                </a>
              </div>
              {state && open && state.state !== "closed" && (
                <p className={`text-sm font-semibold ${state.state === "today" ? "text-amber-800 dark:text-amber-200" : "text-foreground"}`}>
                  {t("app.tenders.timeLeft", "{left} left", { left: countdownText(t, countdownParts(state.msLeft)) })}
                </p>
              )}
              {state && open && state.state === "closed" && (
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">{t("app.tenders.overdue", "Closed — not marked submitted")}</p>
              )}
              <dl>
                <Row label={t("app.tenders.closing", "Closing")}>{formatInZone(tender.closingAt, tender.timeZone, language)}</Row>
                <Row label={t("app.tenders.questionsDeadline", "Questions deadline")}>
                  {deadline(tender.questionsDeadlineDate, tender.questionsDeadlineTime, tender.questionsDeadlineAt, tender.timeZone, language)}
                </Row>
                <Row label={tender.siteVisitMandatory ? t("app.tenders.siteVisitMandatory", "Site visit (mandatory)") : t("app.tenders.siteVisit", "Site visit")}>
                  {tender.siteVisitDate
                    ? [deadline(tender.siteVisitDate, tender.siteVisitTime, tender.siteVisitAt, tender.timeZone, language), tender.siteVisitLocation]
                        .filter(Boolean)
                        .join(" — ")
                    : tender.siteVisitMandatory
                      ? t("app.tenders.siteVisitNoDate", "Mandatory — date not entered yet")
                      : null}
                </Row>
                <Row label={t("app.tenders.published", "Published")}>{tender.publishedDate}</Row>
                <Row label={t("app.tenders.expectedAward", "Expected award")}>{tender.expectedAwardDate}</Row>
                <Row label={t("app.tenders.validity", "Bid valid for")}>
                  {tender.bidValidityDays ? t("app.tenders.validityDays", "{days} days after closing", { days: tender.bidValidityDays }) : null}
                </Row>
                <Row label={t("app.tenders.timeZone", "Time zone")}>{tender.timeZone.replace(/_/g, " ")}</Row>
                <Row label={t("app.tenders.source", "Published on")}>
                  {tender.sourceUrl ? (
                    <a href={tender.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                      {sourceLabel(t, tender.source)} <ExternalLink size={12} />
                    </a>
                  ) : (
                    sourceLabel(t, tender.source)
                  )}
                </Row>
              </dl>
            </section>

            {/* ── Status ────────────────────────────────────────────── */}
            <section className="bg-card border border-border rounded-xl p-4 space-y-3" data-tender-status>
              <h2 className="text-sm font-semibold text-foreground">{t("app.tenders.statusTitle", "Bid status")}</h2>
              <dl>
                <Row label={t("app.tenders.decisionReason", "Decision")}>{tender.decisionReason}</Row>
                <Row label={t("app.tenders.submittedAt", "Submitted")}>
                  {tender.submittedAt ? formatInZone(tender.submittedAt, tender.timeZone, language) : null}
                </Row>
                <Row label={t("app.tenders.confirmation", "Confirmation number")}>{tender.confirmationNumber}</Row>
                <Row label={t("app.tenders.contractNumber", "Contract number")}>{tender.contractNumber}</Row>
                {caps.canSeeMoney && <Row label={t("app.tenders.awardedValue", "Contract value")}>{tender.awardedValue != null ? money(tender.awardedValue) : null}</Row>}
                {caps.canSeeMoney && <Row label={t("app.tenders.winningPrice", "Winning price")}>{tender.winningPrice != null ? money(tender.winningPrice) : null}</Row>}
                <Row label={t("app.tenders.winner", "Winner")}>{tender.winnerName}</Row>
                <Row label={t("app.tenders.debrief", "Debrief")}>{tender.debriefNotes}</Row>
                <Row label={t("app.tenders.closedReason", "Reason")}>{tender.closedReason}</Row>
              </dl>
              {caps.canEdit && !moving && data.nextStatuses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.nextStatuses.map((s) => (
                    <button key={s} type="button" onClick={() => setMoving(s)} className={buttonClass} data-tender-next={s}>
                      {moveLabel(t, s)}
                    </button>
                  ))}
                </div>
              )}
              {moving && (
                <MovePanel
                  to={moving}
                  tender={tender}
                  canSeeMoney={!!caps.canSeeMoney}
                  t={t}
                  onCancel={() => setMoving("")}
                  onDone={(next) => {
                    setData(next);
                    setMoving("");
                  }}
                />
              )}
            </section>

            {/* ── Our bid: the quote ───────────────────────────────────── */}
            <section className="bg-card border border-border rounded-xl p-4 space-y-3" data-tender-quote>
              <h2 className="text-sm font-semibold text-foreground">{t("app.tenders.bidQuote", "Our bid")}</h2>
              {tender.quote?.missing ? (
                <p className="text-sm text-muted-foreground">{t("app.tenders.quoteRemoved", "The linked quote was removed.")}</p>
              ) : tender.quote ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/app/quotes/${tender.quote.id}`} className="text-sm text-foreground underline min-h-[44px] inline-flex items-center">
                    {t("app.tenders.quoteLine", "Quote {number}", { number: tender.quote.quoteNumber })}
                    {caps.canSeeMoney && tender.quote.total != null ? ` — ${money(tender.quote.total)}` : ""}
                  </Link>
                  {caps.canEdit && (
                    <button type="button" disabled={!!busy} onClick={() => post(`/api/tenders/${tender.id}/quote`, { quoteId: null }, "unlink")} className={buttonClass}>
                      {t("app.tenders.unlinkQuote", "Unlink")}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("app.tenders.noQuote", "No bid quote linked yet.")}</p>
              )}
              {caps.canEdit && !tender.quote && tender.client && !tender.client.missing && (
                <div className="space-y-2">
                  <Link
                    href={`/app/quotes/new?clientId=${encodeURIComponent(tender.client.id)}&tenderId=${encodeURIComponent(tender.id)}`}
                    className={`${primaryClass} inline-flex items-center`}
                    data-tender-create-quote
                  >
                    {t("app.tenders.createQuote", "Create quote for this tender")}
                  </Link>
                  {data.candidateQuotes.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select className={inputClass} value={linkQuoteId} onChange={(e) => setLinkQuoteId(e.target.value)} aria-label={t("app.tenders.pickQuote", "A quote for this buyer")}>
                        <option value="">{t("app.tenders.pickQuotePlaceholder", "Or link an existing quote for this buyer…")}</option>
                        {data.candidateQuotes.map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.quoteNumber}
                            {caps.canSeeMoney && q.total != null ? ` — ${money(q.total)}` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!linkQuoteId || !!busy}
                        onClick={async () => {
                          if (await post(`/api/tenders/${tender.id}/quote`, { quoteId: linkQuoteId }, "link")) setLinkQuoteId("");
                        }}
                        className={`${buttonClass} shrink-0`}
                      >
                        {t("app.tenders.linkQuote", "Link")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ── The job, once won ───────────────────────────────────── */}
            {tender.status === "won" && (
              <section className="bg-card border border-border rounded-xl p-4 space-y-2" data-tender-job>
                <h2 className="text-sm font-semibold text-foreground">{t("app.tenders.jobTitle", "The work")}</h2>
                {tender.job && !tender.job.missing ? (
                  <Link href={`/app/jobs/${tender.job.id}`} className="text-sm underline text-foreground inline-flex items-center gap-1 min-h-[44px]">
                    <Briefcase size={14} /> {tender.job.title}
                  </Link>
                ) : caps.canConvert ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => post(`/api/tenders/${tender.id}/job`, {}, "job")}
                    className={`${primaryClass} inline-flex items-center gap-2`}
                    data-tender-convert
                  >
                    <Briefcase size={14} /> {busy === "job" ? t("app.tenders.saving", "Saving…") : t("app.tenders.convert", "Convert to job")}
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("app.tenders.convertNoAccess", "Someone who can create jobs can convert this tender.")}</p>
                )}
              </section>
            )}

            {actionError && <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>}

            {/* ── People ────────────────────────────────────────────── */}
            {caps.canSeeContacts &&
              (tender.contractingAuthorityName || tender.contractingAuthorityEmail || tender.technicalAuthorityName || tender.technicalAuthorityEmail) && (
                <section className="bg-card border border-border rounded-xl p-4 space-y-2" data-tender-people>
                  <h2 className="text-sm font-semibold text-foreground">{t("app.tenders.form.people", "People")}</h2>
                  {[
                    ["contractingAuthority", t("app.tenders.form.contracting", "Contracting Authority")],
                    ["technicalAuthority", t("app.tenders.form.technical", "Technical / Project Authority")],
                  ].map(([prefix, label]) =>
                    tender[`${prefix}Name`] || tender[`${prefix}Email`] || tender[`${prefix}Phone`] ? (
                      <div key={prefix} className="text-sm">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-foreground break-words">{tender[`${prefix}Name`]}</p>
                        {tender[`${prefix}Email`] && (
                          <a href={`mailto:${tender[`${prefix}Email`]}`} className="block underline text-foreground break-all min-h-[44px] py-2">
                            {tender[`${prefix}Email`]}
                          </a>
                        )}
                        {tender[`${prefix}Phone`] && (
                          <a href={`tel:${tender[`${prefix}Phone`]}`} className="block underline text-foreground min-h-[44px] py-2">
                            {tender[`${prefix}Phone`]}
                          </a>
                        )}
                      </div>
                    ) : null,
                  )}
                </section>
              )}

            {/* ── Requirements and notes ───────────────────────────────── */}
            <section className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-semibold text-foreground mb-1">{t("app.tenders.form.requirements", "Requirements")}</h2>
              <dl>
                {caps.canSeeMoney && (
                  <Row label={t("app.tenders.form.estimatedValue", "Buyer's estimated value")}>
                    {tender.estimatedValue != null ? money(tender.estimatedValue) : null}
                  </Row>
                )}
                <Row label={t("app.tenders.bidSecurity", "Bid security")}>
                  {tender.bidSecurityRequired
                    ? caps.canSeeMoney && tender.bidSecurityAmount != null
                      ? t("app.tenders.bidSecurityAmountRequired", "Required — {amount}", { amount: money(tender.bidSecurityAmount) })
                      : t("app.tenders.bidSecurityRequired", "Required")
                    : t("app.tenders.bidSecurityNone", "Not required")}
                </Row>
                <Row label={t("app.tenders.form.clearance", "Security clearance required")}>{tender.securityClearance}</Row>
                <Row label={t("app.tenders.form.notes", "Notes")}>
                  {tender.notes ? <span className="whitespace-pre-wrap">{tender.notes}</span> : null}
                </Row>
              </dl>
            </section>

            <Documents tender={tender} documents={data.documents || []} canEdit={!!caps.canEdit} onChanged={setData} t={t} />
          </div>
        ) : null}
      </ListState>
    </div>
  );
}
