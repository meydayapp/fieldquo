// app/platform/jennifer/page.js
//
// The operator side of the escalation handoff. A conversation lands here the
// moment app/api/jennifer/route.js flips it to "escalated" — see that file's
// header for the unresolved → escalated → resolved lifecycle, and
// lib/ai/jennifer/conversations.js for why Jennifer stops answering in a
// conversation once it's here.
//
// Reply here reaches the contractor's own panel by POLLING — there is no
// push mechanism in this stack (see app/api/jennifer/route.js's "Reactivity"
// section) — so a reply typed here becomes visible to them within one poll
// interval, not instantly. That's said plainly in this screen too, not just
// documented in a comment nobody using it will read.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, AlertCircle, Send, CheckCircle2 } from "lucide-react";

const STATUSES = [
  { value: "escalated", label: "Needs a reply" },
  { value: "unresolved", label: "With Jennifer" },
  { value: "resolved", label: "Resolved" },
];

/**
 * The same words the filter buttons use, for the open conversation.
 *
 * The detail pane printed `conversation.status` raw — "escalated" — while the
 * button one row up, already highlighted, said "Needs a reply". Two vocabularies
 * for one value on a screen somebody opens with a contractor waiting, which is
 * the exact shape fixed on the money screens last pass. An unknown value says
 * it is unknown rather than being tidied into a word.
 */
function statusLabel(status) {
  const known = STATUSES.find((s) => s.value === status);
  if (known) return known.label;
  return status ? `Unrecognised status: ${status}` : "No status";
}

function ageInDays(d) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

function roleLabel(role) {
  if (role === "operator") return "You (FieldQuo)";
  if (role === "assistant") return "Jennifer";
  return "Contractor";
}

export default function PlatformJenniferPage() {
  const [status, setStatus] = useState("escalated");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status });
      const res = await fetch(`/api/platform/jennifer/conversations?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Request failed (${res.status}).`);
      setData(await res.json());
    } catch (err) {
      // "Nothing here." is a claim that no contractor is waiting on a reply.
      // It used to be printed under the banner saying the list failed to load.
      setData(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Its own error, not the page banner. A failed detail load left
  // `conversation` null with `detailLoading` false, and null IS the loading
  // state in the pane below — so the reading pane sat on "Loading…" for ever,
  // with a red line at the top of the page that read as being about the list.
  // Three states in the pane now, and a retry inside it.
  const [detailError, setDetailError] = useState("");

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const res = await fetch(`/api/platform/jennifer/conversations/${id}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Couldn't load conversation.");
      const body = await res.json();
      setConversation(body.conversation);
    } catch (err) {
      setConversation(null);
      setDetailError(err.message || "Couldn't load that conversation.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function submitReply(resolveToo) {
    if (!selectedId || sending) return;
    if (!reply.trim() && !resolveToo) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/jennifer/conversations/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: reply.trim() || undefined, resolve: Boolean(resolveToo) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Couldn't send.");
      const body = await res.json();
      setConversation(body.conversation);
      setReply("");
      loadList();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Jennifer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conversations Jennifer handed off rather than answered — money moving, a
          data-deletion request, a legal/privacy request. A reply here reaches the
          contractor's own panel the next time it polls, not instantly.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              setStatus(s.value);
              setSelectedId(null);
              setConversation(null);
              setDetailError("");
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium border ${
              status === s.value
                ? "bg-inverted text-inverted-foreground border-inverted"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s.label}
            {data?.counts?.[s.value] > 0 && ` ${data.counts[s.value]}`}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : !data ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <AlertCircle size={28} className="text-muted-foreground mx-auto" />
              <p className="mt-3 text-sm text-muted-foreground">
                This list could not be read. Somebody may well be waiting on a
                reply — nothing has been resolved or removed.
              </p>
              <button
                onClick={loadList}
                className="mt-3 text-sm font-semibold text-foreground underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : !data.rows?.length ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <MessageCircle size={28} className="text-muted-foreground mx-auto" />
              <p className="mt-3 text-sm text-muted-foreground">Nothing here.</p>
            </div>
          ) : (
            data.rows.map((row) => {
              const days = ageInDays(row.updatedAt);
              const stale = status === "escalated" && days >= 1;
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`block w-full text-left bg-card border rounded-xl p-4 hover:bg-muted ${
                    selectedId === row.id ? "border-inverted" : stale ? "border-amber-300" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">{row.companyName}</span>
                    <span className={`text-xs shrink-0 ${stale ? "text-amber-700 dark:text-amber-300 font-medium" : "text-muted-foreground"}`}>
                      {days === 0 ? "today" : `${days}d ago`}
                    </span>
                  </div>
                  {row.escalationReason && (
                    <p className="mt-1 text-xs text-muted-foreground">{row.escalationReason}</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground truncate">{row.preview}</p>
                </button>
              );
            })
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 min-h-[24rem]">
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">Select a conversation to read it.</p>
          ) : detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : detailError || !conversation ? (
            <div className="text-sm space-y-2">
              <p className="flex items-start gap-2 text-red-700 dark:text-red-300">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                {detailError || "That conversation could not be read."}
              </p>
              <button
                onClick={() => loadDetail(selectedId)}
                className="text-sm font-semibold text-foreground underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <Link
                    href={`/platform/companies/${conversation.companyId}`}
                    className="font-semibold text-foreground underline hover:no-underline"
                  >
                    {conversation.companyName}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {statusLabel(conversation.status)}
                    {conversation.escalationReason ? ` — ${conversation.escalationReason}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-3">
                {conversation.messages.map((m) => (
                  <div key={m.id} className={m.role === "operator" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.role === "operator"
                          ? "bg-inverted text-inverted-foreground"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-wide opacity-70 mb-1">{roleLabel(m.role)}</p>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply to the contractor…"
                  rows={3}
                  disabled={conversation.status === "resolved"}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 disabled:opacity-60"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => submitReply(false)}
                    disabled={sending || !reply.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-inverted px-3 py-2 text-sm font-semibold text-inverted-foreground disabled:opacity-60"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => submitReply(true)}
                    disabled={sending || conversation.status === "resolved"}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    <CheckCircle2 size={14} />
                    {reply.trim() ? "Reply & resolve" : "Mark resolved"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
