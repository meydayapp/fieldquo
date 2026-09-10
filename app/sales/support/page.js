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
// ══ English, deliberately ══════════════════════════════════════════════════
//
// Same reason app/sales/notes/page.js gives: the outreach screens are English
// while the shell is translated, and a translated screen beside English ones is
// the worse inconsistency.
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, LifeBuoy, Loader2, Send } from "lucide-react";
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
      setBookFailed(err.message || "Couldn't load your companies.");
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setListFailed("");
    setData(null);
    try {
      setData(await listSupportTickets(filter ? { status: filter } : {}));
    } catch (err) {
      setListFailed(err.message || "Couldn't load your tickets.");
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
      // one when no superadmin account was available to take it.
      setNotice(res.ticket?.statusLine || "Raised with FieldQuo support.");
      setSubject("");
      setBody("");
      setPriority("normal");
      setOpenId(res.ticket?.id || null);
      await loadTickets();
    } catch (err) {
      setFormError(err.message || "That didn't go through.");
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
      setReplyError(err.message || "Couldn't send that reply.");
    } finally {
      setReplying(false);
    }
  }

  const noBook = Array.isArray(book) && book.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">FieldQuo tech support</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Something wrong at one of your companies? Send it here. It goes straight to the FieldQuo
          owner account, and you can follow it below.
        </p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 space-y-4">
        {bookFailed ? (
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Your companies could not be loaded, so there is nothing to pick yet — this is a failed
              request, not an empty book. {bookFailed}{" "}
              <button
                type="button"
                onClick={loadBook}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Try again
              </button>
            </span>
          </div>
        ) : noBook ? (
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <LifeBuoy size={16} className="shrink-0 mt-0.5" />
            <span>
              No company is attributed to you yet, so there is nothing to raise a ticket about. A
              ticket can only be about a company in your own book.
            </span>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="support-company" className="block text-sm font-medium text-foreground mb-1">
                Which company
              </label>
              <select
                id="support-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="">Choose…</option>
                {(book || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isDemo ? " (demo)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="support-subject" className="block text-sm font-medium text-foreground mb-1">
                One line
              </label>
              <input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={140}
                placeholder="Invoice emails aren't arriving"
                className="w-full min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </div>

            <div>
              <label htmlFor="support-body" className="block text-sm font-medium text-foreground mb-1">
                What happened
              </label>
              <textarea
                id="support-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={5}
                placeholder="What they did, what they expected, what they got. Dates and a quote or invoice number help."
                className="w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground"
              />
            </div>

            <div>
              <label htmlFor="support-priority" className="block text-sm font-medium text-foreground mb-1">
                How urgent
              </label>
              <select
                id="support-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              >
                {SUPPORT_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
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
              Escalate to FieldQuo
            </button>
          </>
        )}
      </form>

      <div className="flex gap-1.5 flex-wrap">
        {[{ value: "", label: "All" }, ...SUPPORT_STATUSES.map((v) => ({ value: v, label: STATUS_LABELS[v] }))].map(
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
            Your tickets could not be read — a failed request, not an empty list. {listFailed}
          </p>
          <button
            onClick={loadTickets}
            className="mt-3 min-h-[44px] px-4 text-sm font-semibold text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !data.tickets?.length ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <LifeBuoy size={24} className="text-muted-foreground mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing raised {filter ? `with the status ${STATUS_LABELS[filter].toLowerCase()}` : "yet"}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.tickets.map((t) => {
            const isOpen = openId === t.id;
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    setOpenId(isOpen ? null : t.id);
                    setReply("");
                    setReplyError("");
                  }}
                  className="w-full text-left p-4 space-y-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] || "bg-muted text-muted-foreground"}`}
                    >
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {PRIORITY_LABELS[t.priority] || t.priority}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground break-words">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.company?.name} · {fmt(t.createdAt)}
                  </p>
                  {/* The server's sentence, not a locally invented one — it is
                      the only place that knows a ticket landed on nobody. */}
                  <p className="text-xs text-muted-foreground">{t.statusLine}</p>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 space-y-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{t.body}</p>
                    {t.notes?.map((n) => (
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
                      placeholder="Reply to FieldQuo support…"
                      className="w-full rounded-lg border border-border bg-card p-3 text-sm text-foreground"
                    />
                    <button
                      onClick={() => sendReply(t.id)}
                      disabled={replying || !reply.trim()}
                      className="min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {replying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      Send reply
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
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} /> Opening support…
        </div>
      }
    >
      <SalesSupportInner />
    </Suspense>
  );
}
