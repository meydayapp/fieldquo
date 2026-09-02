// app/sales/threads/[id]/page.js
//
// One conversation, and the box to answer it.
//
// ══ Every message body is rendered as TEXT ═════════════════════════════════
//
// An inbound body is written by a stranger and arrives through a mail provider.
// It is stored as text (parseInboundEmail strips markup out of an html-only
// message on the way in) and it is rendered inside a `whitespace-pre-wrap`
// element — never with dangerouslySetInnerHTML. That is the whole defence, and
// it is deliberately boring: a prospect who replies with a <script> tag gets a
// prospect who appears to have typed a <script> tag.
//
// `params` is a Promise in Next 16 — read with `use()`.
"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Loader2, Send } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import OutreachNotice from "../../leads/OutreachNotice";

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SalesThreadPage({ params }) {
  const { id } = use(params);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson(`/api/sales/threads/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function reply(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/sales/threads/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ body: message }, "reply"),
      });
      setMessage("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const thread = data?.thread;
  const outreach = data?.outreach;
  const optedOut = data?.optedOut;

  if (!thread) {
    return (
      <div className="space-y-4">
        <Link href="/sales/threads" className="text-sm text-muted-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> Conversations
        </Link>
        {error ? (
          <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
            {error}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        )}
      </div>
    );
  }

  const canReply = Boolean(outreach?.canSend) && !optedOut;

  return (
    <div className="space-y-6">
      <Link href="/sales/threads" className="text-sm text-muted-foreground flex items-center gap-1">
        <ArrowLeft size={14} /> Conversations
      </Link>

      <div>
        <h1 className="text-xl font-bold text-foreground">{thread.subject}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <Link href={`/sales/leads/${thread.lead.id}`} className="underline">
            {thread.lead.businessName}
          </Link>
          {thread.lead.email ? ` · ${thread.lead.email}` : ""}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border p-4 ${
              m.direction === "in"
                ? "border-border bg-card"
                : "border-border bg-muted/40"
            }`}
          >
            <p className="text-xs text-muted-foreground mb-2">
              {m.direction === "in" ? "From" : "To"}{" "}
              {m.direction === "in" ? m.fromAddress : m.toAddress} · {when(m.sentAt)}
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {m.body}
            </p>
          </div>
        ))}
      </div>

      <OutreachNotice outreach={outreach} />

      {optedOut && (
        <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 flex items-start gap-2 text-sm">
          <Ban size={16} className="mt-0.5 text-red-700 dark:text-red-300 shrink-0" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200">
              They asked not to be emailed again.
            </p>
            <p className="text-red-800 dark:text-red-300/90">
              Replying by email is switched off for this prospect, here and on
              the server.
            </p>
          </div>
        </div>
      )}

      {canReply && (
        <form onSubmit={reply} className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold text-foreground">Reply</div>
          <textarea
            required
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your reply…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="text-sm font-semibold px-3 py-2 rounded-lg bg-inverted text-inverted-foreground flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send reply
          </button>
        </form>
      )}
    </div>
  );
}
