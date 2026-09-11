// app/sales/support/page.js
//
// A rep escalates a technical problem to FieldQuo tech support, and watches
// what happens to it.
//
// ══ Why the second half is not optional ════════════════════════════════════
//
// The owner asked for a channel a rep can escalate INTO. A form that posts and
// says "thanks" would satisfy that sentence and fail the product: the rep is
// standing in front of a contractor who wants to know when their invoice email
// will work, and "I sent it somewhere" is not an answer. So the list, the
// status, the thread and the reply box are on the same screen as the form.
//
// ══ Nothing here is offered that the server would refuse ═══════════════════
//
// The company picker is filled from /api/sales/companies — the rep's own book,
// the same predicate the write re-checks — so a rep can never pick a company
// the POST would answer 404 about. And the picker says so when the book is
// empty rather than rendering a form that cannot succeed.
//
// ══ The rep's language, and the ticket's is not the same question ══════════
//
// The screen follows the rep's chosen language, as the shell around it always
// did — a half-translated portal was the inconsistency, not a translated
// screen. What does NOT follow it is the ticket itself: the subject and body
// are the rep's own words, sent onward to FieldQuo staff exactly as typed, and
// the sentence under a ticket saying where it landed (`statusLine`) is written
// by the route, which is the only thing that knows a ticket landed on nobody.
// Neither is translated here, and translating either would put a different
// sentence in front of the rep than the one support is reading.
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, LifeBuoy, Loader2, Send } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from "@/lib/support/escalation";
import {
  listSupportTickets,
  raiseSupportTicket,
  replyToSupportTicket,
} from "@/lib/support/repClient";

const STATUS_STYLE = {
  open: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300",
  in_progress: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  resolved: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300",
};

// ── Enum value → key, rather than a key built by string concatenation ──────
//
// STATUS_LABELS/PRIORITY_LABELS in lib/support/escalation.js stay the source of
// truth for WHICH statuses exist and remain the fallback, so a status this map
// has never heard of still renders its own name instead of a blank badge. The
// maps are explicit because the catalogue is looked up by whole key: a
// `app.salesPlay.supportStatus.${value}` built at run time resolves nothing.
const STATUS_KEYS = {
  open: "app.salesPlay.supportStatusOpen",
  in_progress: "app.salesPlay.supportStatusInProgress",
  resolved: "app.salesPlay.supportStatusResolved",
};

// The same three statuses mid-sentence ("Nothing raised with the status …"),
// where English wants them lower-case and German does not. Lower-casing a
// translated label with toLowerCase() is what produced that bug elsewhere.
const STATUS_INLINE_KEYS = {
  open: "app.salesPlay.supportStatusOpenInline",
  in_progress: "app.salesPlay.supportStatusInProgressInline",
  resolved: "app.salesPlay.supportStatusResolvedInline",
};

// ── Why the two loaders store a sentinel instead of a sentence ────────────
//
// A failed request with no message from the server is still a failure, and the
// truthiness of `bookFailed` / `listFailed` is what decides the failure block
// renders at all — so it cannot become "". Putting t() inside the loaders would
// instead put `t` in their dependency arrays, and loadTickets clears the list
// before refetching: changing language would blank the tickets and show a
// spinner. So the loaders record THAT it failed and the wording is chosen at
// render.
const GENERIC_FAILURE = "__generic_failure__";

const PRIORITY_KEYS = {
  low: "app.salesPlay.supportPriorityLow",
  normal: "app.salesPlay.supportPriorityNormal",
  high: "app.salesPlay.supportPriorityHigh",
  urgent: "app.salesPlay.supportPriorityUrgent",
};

function fmt(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function SalesSupportInner() {
  const { t } = useTranslation();
  const [book, setBook] = useState(null);
  const [bookFailed, setBookFailed] = useState("");
  const [data, setData] = useState(null);
  const [listFailed, setListFailed] = useState("");
  const [filter, setFilter] = useState("");

  // ── Prefilled from wherever the rep pressed "raise a ticket" ──────────
  //
  // A rep hears a problem on a call about ONE lead. Before this, the escalate
  // link landed them on a blank form and they had to remember the company's
  // name and find it in a list while the contractor was still talking — the
  // form worked, and asked the rep to carry the context by hand.
  //
  // The id is only a PREFILL of the picker. It grants nothing: the route
  // re-reads the attribution in the request that writes, so a companyId typed
  // into the address bar for somebody else's company is refused there, exactly
  // as it was before this existed.
  const params = useSearchParams();
  const [companyId, setCompanyId] = useState(params.get("companyId") || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState("");

  const loadBook = useCallback(async () => {
    setBookFailed("");
    try {
      const res = await fetchJson("/api/sales/companies");
      setBook(res.companies || []);
    } catch (err) {
      // An empty picker on a failed fetch would read as "you have no
      // companies", which is a different and much more discouraging fact.
      setBook(null);
      setBookFailed(err.message || GENERIC_FAILURE);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setListFailed("");
    setData(null);
    try {
      setData(await listSupportTickets(filter ? { status: filter } : {}));
    } catch (err) {
      setListFailed(err.message || GENERIC_FAILURE);
    }
  }, [filter]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setFormError("");
    setNotice("");
    try {
      const res = await raiseSupportTicket({ companyId, subject, body, priority });
      // The server's own sentence about where it landed, including the honest
      // one when no superadmin account was available to take it. It is not
      // translated: it is the same sentence support is reading.
      setNotice(res.ticket?.statusLine || t("app.salesPlay.supportRaised"));
      setSubject("");
      setBody("");
      setPriority("normal");
      setOpenId(res.ticket?.id || null);
      await loadTickets();
    } catch (err) {
      setFormError(err.message || t("app.salesPlay.supportSendFailed"));
    } finally {
      setSending(false);
    }
  }

  async function sendReply(ticketId) {
    setReplying(true);
    setReplyError("");
    try {
      await replyToSupportTicket(ticketId, reply);
      setReply("");
      await loadTickets();
    } catch (err) {
      setReplyError(err.message || t("app.salesPlay.supportReplyFailed"));
    } finally {
      setReplying(false);
    }
  }

  const noBook = Array.isArray(book) && book.length === 0;
  const statusLabel = (value) =>
    STATUS_KEYS[value] ? t(STATUS_KEYS[value]) : STATUS_LABELS[value] || value;
  const priorityLabel = (value) =>
    PRIORITY_KEYS[value] ? t(PRIORITY_KEYS[value]) : PRIORITY_LABELS[value] || value;

  return (
    <div className="space-y-6" data-tour="sales-support">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("app.salesPlay.supportTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.salesPlay.supportIntro")}</p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-4">
        {bookFailed ? (
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              {t("app.salesPlay.supportBookFailed")}{" "}
              {bookFailed === GENERIC_FAILURE ? t("app.salesPlay.supportBookLoadFailed") : bookFailed}{" "}
              <button
                type="button"
                onClick={loadBook}
                // A retry inside a sentence still has to be tappable: 44px is
                // the floor check:mobile enforces, and py-1 keeps it reading as
                // part of the sentence rather than becoming a block button.
                className="min-h-[44px] py-1 font-semibold text-foreground underline underline-offset-2"
              >
                {t("app.salesPlay.supportRetry")}
              </button>
            </span>
          </div>
        ) : noBook ? (
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <LifeBuoy size={16} className="shrink-0 mt-0.5" />
            <span>{t("app.salesPlay.supportNoBook")}</span>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="support-company" className="block text-sm font-medium text-foreground mb-1">
                {t("app.salesPlay.supportCompanyLabel")}
              </label>
              <select
                id="support-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">{t("app.salesPlay.supportChoose")}</option>
                {(book || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isDemo ? ` ${t("app.salesPlay.supportDemoTag")}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="support-subject" className="block text-sm font-medium text-foreground mb-1">
                {t("app.salesPlay.supportSubjectLabel")}
              </label>
              <input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={140}
                placeholder={t("app.salesPlay.supportSubjectPlaceholder")}
                className="w-full min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </div>

            <div>
              <label htmlFor="support-body" className="block text-sm font-medium text-foreground mb-1">
                {t("app.salesPlay.supportBodyLabel")}
              </label>
              <textarea
                id="support-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={5}
                placeholder={t("app.salesPlay.supportBodyPlaceholder")}
                className="w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground"
              />
            </div>

            <div>
              <label htmlFor="support-priority" className="block text-sm font-medium text-foreground mb-1">
                {t("app.salesPlay.supportPriorityLabel")}
              </label>
              <select
                id="support-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                {SUPPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div
                role="alert"
                className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> {formError}
              </div>
            )}
            {notice && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-2"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {t("app.salesPlay.supportSubmit")}
            </button>
          </>
        )}
      </form>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { value: "", label: t("app.salesPlay.supportFilterAll") },
          ...SUPPORT_STATUSES.map((v) => ({ value: v, label: statusLabel(v) })),
        ].map(
          (f) => (
            <button
              key={f.value || "all"}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium border ${
                filter === f.value
                  ? "bg-inverted text-inverted-foreground border-inverted"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
              {f.value && data?.counts?.[f.value] > 0 && (
                <span className="opacity-70"> {data.counts[f.value]}</span>
              )}
            </button>
          ),
        )}
      </div>

      {listFailed ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <AlertCircle size={24} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("app.salesPlay.supportListFailed")}{" "}
            {listFailed === GENERIC_FAILURE
              ? t("app.salesPlay.supportTicketsLoadFailed")
              : listFailed}
          </p>
          <button
            onClick={loadTickets}
            className="mt-3 min-h-[44px] px-4 text-sm font-semibold text-foreground underline underline-offset-2"
          >
            {t("app.salesPlay.supportRetry")}
          </button>
        </div>
      ) : !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 size={16} className="animate-spin" /> {t("app.salesPlay.supportLoading")}
        </div>
      ) : !data.tickets?.length ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <LifeBuoy size={24} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            {/* Two whole sentences rather than one with a hole in it: the
                status word sits mid-sentence, where English wants it lower
                case and German does not, so it comes from its own key rather
                than from toLowerCase() on a translated label. */}
            {filter && STATUS_INLINE_KEYS[filter]
              ? t("app.salesPlay.supportNothingRaisedWithStatus", {
                  status: t(STATUS_INLINE_KEYS[filter]),
                })
              : t("app.salesPlay.supportNothingRaisedYet")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* `ticket`, not `t` — the file calls t() for translation and a
              shadow here is the exact bug check:t-shadow exists for. */}
          {data.tickets.map((ticket) => {
            const isOpen = openId === ticket.id;
            return (
              <div key={ticket.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    setOpenId(isOpen ? null : ticket.id);
                    setReply("");
                    setReplyError("");
                  }}
                  className="w-full text-left p-4 space-y-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[ticket.status] || "bg-muted text-muted-foreground"}`}
                    >
                      {statusLabel(ticket.status)}
                    </span>
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {priorityLabel(ticket.priority)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground break-words">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.company?.name} · {fmt(ticket.createdAt)}
                  </p>
                  {/* The server's sentence, not a locally invented one — it is
                      the only place that knows a ticket landed on nobody, and
                      it is the same sentence FieldQuo support is reading. */}
                  <p className="text-xs text-muted-foreground">{ticket.statusLine}</p>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 space-y-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {ticket.body}
                    </p>
                    {ticket.notes?.map((n) => (
                      <div key={n.id} className="rounded-lg bg-muted p-3 text-sm">
                        <p className="text-xs text-muted-foreground mb-1">
                          {n.authorLabel} · {fmt(n.createdAt)}
                        </p>
                        <p className="text-foreground whitespace-pre-wrap break-words">{n.body}</p>
                      </div>
                    ))}

                    {replyError && (
                      <div role="alert" className="text-sm text-red-700 dark:text-red-300">
                        {replyError}
                      </div>
                    )}
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={3}
                      placeholder={t("app.salesPlay.supportReplyPlaceholder")}
                      className="w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground"
                    />
                    <button
                      onClick={() => sendReply(ticket.id)}
                      disabled={replying || !reply.trim()}
                      className="min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {t("app.salesPlay.supportSendReply")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary above it, the same way
 * app/sales/queue/page.js wraps its own.
 */
export default function SalesSupportPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> {t("app.salesPlay.supportOpening")}
        </div>
      }
    >
      <SalesSupportInner />
    </Suspense>
  );
}
