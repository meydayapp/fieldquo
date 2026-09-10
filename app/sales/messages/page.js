// app/sales/messages/page.js
//
// The rep's texts: who wrote, what they said, and a reply box.
//
// ══ What this replaced ════════════════════════════════════════════════════
//
// One templated "send them your signup link" panel on a lead, and nothing at
// all in the other direction — a contractor answering "sure, call me Thursday"
// was scanned for STOP and dropped. Both halves are real now, and this is
// where a rep reads them.
//
// ══ Every refusal is the SERVER's ═════════════════════════════════════════
//
// The compose box does not decide whether a text may go: the suppression list
// is read fresh at the moment of the send, the texting window is judged in the
// prospect's own zone, and the mailing address CASL requires is checked there.
// This screen shows the answer it gets back. A second copy of those rules here
// is how a reply goes out at two in the morning to somebody who said STOP.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MessageSquare, Send } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

function when(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function SalesMessagesPage() {
  const [list, setList] = useState(null);
  const [openWith, setOpenWith] = useState("");
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setError("");
    try {
      setList((await fetchJson("/api/sales/messages")).conversations || []);
    } catch (err) {
      setError(err?.message || "Could not load your conversations.");
    }
  }, []);

  const loadThread = useCallback(async (e164) => {
    setError("");
    try {
      setThread(await fetchJson(`/api/sales/messages?with=${encodeURIComponent(e164)}`));
    } catch (err) {
      setError(err?.message || "Could not load that conversation.");
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (openWith) loadThread(openWith);
  }, [openWith, loadThread]);

  async function send() {
    setBusy(true);
    setError("");
    try {
      const next = await fetchJson("/api/sales/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: openWith, text }),
      });
      setThread((t) => ({ ...t, messages: next.messages }));
      setText("");
      await loadList();
    } catch (err) {
      // The server's own sentence, not a rewrite of it. It names the blocker —
      // opted out, outside their hours, no mailing address — and the fix.
      setError(err?.message || "That did not send.");
    } finally {
      setBusy(false);
    }
  }

  // ── One conversation ────────────────────────────────────────────────────
  if (openWith) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setOpenWith("");
            setThread(null);
          }}
          // min-h-[44px]: it is the only way back on a phone.
          className="min-h-[44px] text-sm text-muted-foreground flex items-center gap-1"
        >
          <ArrowLeft size={14} /> All conversations
        </button>

        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground break-words">
            {thread?.lead?.businessName || openWith}
          </h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {openWith}
            {thread?.lead ? (
              <>
                {" · "}
                <Link href={`/sales/leads/${thread.lead.id}`} className="underline">
                  open the lead
                </Link>
              </>
            ) : null}
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="break-words">{error}</p>
            </div>
          </div>
        ) : null}

        <div className={CARD}>
          {!thread ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={15} /> Loading…
            </p>
          ) : (
            <ul className="space-y-3">
              {thread.messages.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.direction === "in"
                      ? "bg-muted text-foreground"
                      : "ml-auto bg-primary text-primary-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-xs ${
                      m.direction === "in" ? "text-muted-foreground" : "text-primary-foreground/80"
                    }`}
                  >
                    {when(m.sentAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={CARD}>
          <label className="block text-sm font-medium text-foreground" htmlFor="reply">
            Your reply
          </label>
          <textarea
            id="reply"
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Thursday at eight works — I'll call then."
          />
          {/* Said before they type it, not after it is sent. The footer is not
              optional and it is not the rep's to remove: CASL requires the
              sender's address and an unsubscribe in every commercial message,
              and this one is arranging the sale of software. */}
          <p className="text-xs text-muted-foreground break-words">
            FieldQuo&rsquo;s address and &ldquo;Reply STOP to opt out&rdquo; are added to the end.
            That is the law, not a setting — every commercial text carries them.
          </p>
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={send}
            className={`${BTN} bg-primary text-primary-foreground w-full`}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            Send it
          </button>
        </div>
      </div>
    );
  }

  // ── The list ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Texts</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Everyone you have texted, and everyone who has written back. A conversation is with a
          person, so it is grouped by their number — one business may sit behind two leads and the
          reply belongs to the same thread either way.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {!list ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={15} /> Loading…
        </p>
      ) : list.length === 0 ? (
        // Nothing invented to fill it. A rep who has texted nobody has no
        // conversations, which is a true and ordinary state.
        <div className={CARD}>
          <p className="text-sm text-muted-foreground break-words">
            Nothing yet. The first text to a prospect goes from their lead — it carries your signup
            link and the identification a first contact needs. After that, the conversation lives
            here.
          </p>
          <Link href="/sales/leads" className={`${BTN} border border-border text-foreground w-full`}>
            <MessageSquare size={16} /> Go to my leads
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.e164}>
              <button
                type="button"
                onClick={() => setOpenWith(c.e164)}
                className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-muted"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-foreground tabular-nums">{c.e164}</span>
                  {/* The one status worth carrying into a list: somebody is
                      waiting on this rep. */}
                  {c.unanswered ? (
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      they wrote last
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{when(c.lastAt)}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground break-words line-clamp-2">
                  {c.lastBody}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
