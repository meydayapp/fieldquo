"use client";

// app/app/messages/page.js
//
// Facebook Page and Instagram business messages, answered here.
//
// ══ What is real and what is blocked ═══════════════════════════════════════
//
// Everything on this screen is real: the list, the conversation, the outcome
// control, the search, the monthly review behind it. What is blocked is the
// CONNECTION — Meta has not approved `pages_messaging` for this app yet (see
// lib/meta/client.js's META_MESSAGING_SCOPE), so for every real company today
// there is no Page and no messages.
//
// That state is stated, not disguised. No sample conversations are invented
// for a real company: the empty screen says what is missing and who it is
// waiting on. The one exception is a DEMO company, where the mock is decided
// by lib/messaging/channels.js reading Company.isDemo from the database — the
// same single gate lib/social/metaConnection.js uses, for the same reason.
//
// ══ Never a personal inbox ═════════════════════════════════════════════════
//
// Page and Instagram BUSINESS conversations only. That is all the permissions
// this feature will ever request, and there is no code path to anything else.
//
// ══ Layout ════════════════════════════════════════════════════════════════
//
// Two panes above `md`, one pane with a back arrow below it. The composer is
// the last child of a flex column rather than a fixed bar — deliberately: a
// `fixed bottom-…` composer would have to register with useBottomDock and
// would fight the mobile tab bar and the keyboard on the one screen where the
// keyboard is open most of the time.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MessageCircle, Search, ChevronLeft, Send, Loader2, BarChart3, Link2,
} from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { outcomeLabelKey } from "@/lib/messaging/outcomes";
// Why the composer is off, and what the empty inbox says — ONE decision, pure,
// and executed by scripts/check-messaging.mjs. See that file's header for why
// it does not live in this component.
import { composerBlock, connectionBlurb } from "@/lib/messaging/composerState";
import {
  Avatar, PlatformBadge, Bubble, OutcomePicker, dayLabel,
} from "./ConversationBits";

export default function MessagesPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();

  // null, never []. An outage that rendered as "you have no conversations"
  // would tell a contractor their enquiries had vanished — see ListState.
  const [threads, setThreads] = useState(null);
  const [connection, setConnection] = useState(null);
  const [bubbles, setBubbles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [query, setQuery] = useState("");

  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadErrorKey, setThreadErrorKey] = useState("");

  const load = useCallback(async (q) => {
    setLoading(true);
    setErrorKey("");
    const suffix = q ? "?q=" + encodeURIComponent(q) : "";
    const result = await fetchList("/api/messaging/threads" + suffix);
    if (result.aborted) return;
    if (result.ok) {
      setThreads(result.data?.threads || []);
      setConnection(result.data?.connection || null);
      setBubbles(result.data?.bubbles || null);
    } else {
      setErrorKey(result.errorKey);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  // Debounced search. The server does the filtering (it can search message
  // bodies, which the browser never has), so this is a request, not a filter.
  useEffect(() => {
    const id = setTimeout(() => load(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query, load]);

  const openThread = useCallback(async (id) => {
    setActiveId(id);
    setThread(null);
    setThreadErrorKey("");
    setThreadLoading(true);
    const result = await fetchList("/api/messaging/threads/" + id);
    if (result.aborted) return;
    if (result.ok) setThread(result.data?.thread || null);
    else setThreadErrorKey(result.errorKey);
    setThreadLoading(false);
  }, []);

  // ?thread=<id> — how the monthly review opens a conversation. Run once, and
  // only when nothing is open, so it cannot yank the pane back to the review's
  // choice while somebody is reading a different thread.
  const searchParams = useSearchParams();
  const wanted = searchParams.get("thread");
  const openedFromUrl = useRef(false);
  useEffect(() => {
    if (!wanted || openedFromUrl.current) return;
    openedFromUrl.current = true;
    openThread(wanted);
  }, [wanted, openThread]);

  const list = threads || [];
  const blockKey = composerBlock(connection);
  const blurbKey = connectionBlurb(connection);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[12rem]">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle size={22} aria-hidden="true" /> {t("app.nav.messages")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app.messages.subtitle")}</p>
        </div>
        <Link
          href="/app/messages/review"
          className="min-h-[44px] inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <BarChart3 size={15} aria-hidden="true" />
          {t("app.messages.reviewLink")}
        </Link>
      </div>

      {/* The connection state, said once, above everything. It is the answer to
          "why is this empty", and it is not repeated inside the composer's own
          disabled note — that one says what you cannot do, this one says why. */}
      {blurbKey && (
        <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Link2 size={15} aria-hidden="true" /> {t("app.messages.connect.title")}
          </h2>
          <p className="text-sm text-foreground mt-2">{t(blurbKey)}</p>
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-[20rem_1fr]">
        {/* ── Thread list ─────────────────────────────────────────────── */}
        <div className={activeId ? "hidden md:block" : "block"}>
          <label className="relative block">
            <span className="sr-only">{t("app.messages.search")}</span>
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            {/* text-base, not text-sm: anything smaller makes iOS Safari zoom
                the page on focus, and this screen is read on a phone. */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("app.messages.search")}
              className="min-h-[44px] w-full rounded-full border border-border bg-background pl-9 pr-3 text-base text-foreground"
            />
          </label>

          <div className="mt-3">
            <ListState
              loading={loading}
              errorKey={errorKey}
              onRetry={() => load(query.trim())}
              isEmpty={list.length === 0}
              skeleton={
                <div className="space-y-2 animate-pulse">
                  <div className="h-16 bg-accent rounded-xl" />
                  <div className="h-16 bg-accent rounded-xl" />
                  <div className="h-16 bg-accent rounded-xl" />
                </div>
              }
              empty={
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <MessageCircle size={20} aria-hidden="true" className="mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground mt-3">
                    {query ? t("app.messages.noMatches") : t("app.messages.empty")}
                  </p>
                  {!query && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("app.messages.emptyHint")}
                    </p>
                  )}
                </div>
              }
            >
              <ul className="space-y-1">
                {list.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openThread(row.id)}
                      aria-current={row.id === activeId ? "true" : undefined}
                      className={
                        "min-h-[44px] w-full rounded-xl border px-3 py-3 text-left " +
                        (row.id === activeId
                          ? "border-border bg-muted"
                          : "border-transparent hover:bg-muted")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={row.participantName} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate font-semibold text-foreground text-sm">
                              {row.participantName || t("app.messages.unknownPerson")}
                            </span>
                            {row.unread > 0 && (
                              <span className="ml-auto shrink-0 rounded-full bg-inverted px-2 py-0.5 text-xs font-bold text-inverted-foreground">
                                {row.unread}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{row.preview}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <PlatformBadge platform={row.platform} t={t} />
                            {row.outcome && (
                              <span className="text-xs text-muted-foreground">
                                {t(outcomeLabelKey(row.outcome))}
                              </span>
                            )}
                            {row.lastFailed && (
                              <span className="text-xs font-medium text-destructive">
                                {t("app.messages.failed")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </ListState>
          </div>
        </div>

        {/* ── Conversation ────────────────────────────────────────────── */}
        <div className={activeId ? "block" : "hidden md:block"}>
          {!activeId && (
            <div className="hidden md:grid h-full min-h-[20rem] place-items-center rounded-xl border border-border bg-card">
              <p className="text-sm text-muted-foreground">{t("app.messages.pickOne")}</p>
            </div>
          )}
          {activeId && (
            <Conversation
              thread={thread}
              loading={threadLoading}
              errorKey={threadErrorKey}
              onRetry={() => openThread(activeId)}
              onBack={() => {
                setActiveId(null);
                setThread(null);
              }}
              bubbles={bubbles}
              blockKey={blockKey}
              connection={connection}
              onChanged={async () => {
                await openThread(activeId);
                await load(query.trim());
              }}
              t={t}
              formatDate={formatDate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Conversation({
  thread, loading, errorKey, onRetry, onBack, bubbles, blockKey, connection,
  onChanged, t, formatDate,
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  // Marking read is a side effect of opening, and it is a WRITE, so it goes
  // through the same PATCH everything else does rather than a second endpoint.
  useEffect(() => {
    if (!thread?.id || !thread.unread || String(thread.id).startsWith("demo_")) return;
    fetch("/api/messaging/threads/" + thread.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
      // A failed "mark read" is not worth a message on screen: the badge stays
      // up, which is the honest outcome, and the next open tries again.
    }).catch(() => {});
  }, [thread?.id, thread?.unread]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await fetch("/api/messaging/threads/" + thread.id + "/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      if (!res.ok) {
        // The server's own sentence — "no Page is connected", "that Page needs
        // reconnecting" — not a generic failure. It also WROTE the attempt, so
        // reloading shows the failed bubble beneath.
        await reportResponseError(res, t("app.messages.compose.error"));
        await onChanged?.();
        return;
      }
      setText("");
      await onChanged?.();
    } finally {
      setSending(false);
    }
  }

  async function setOutcome(outcome) {
    setSavingOutcome(true);
    try {
      const res = await fetch("/api/messaging/threads/" + thread.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.messages.outcome.saveError"));
        return;
      }
      await onChanged?.();
    } finally {
      setSavingOutcome(false);
    }
  }

  const messages = thread?.messages || [];

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] md:hidden inline-flex items-center gap-1 rounded-full px-2 text-sm text-foreground hover:bg-muted"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          {t("app.messages.back")}
        </button>
        <Avatar name={thread?.participantName} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {thread?.participantName || t("app.messages.unknownPerson")}
          </p>
          <PlatformBadge platform={thread?.platform} t={t} />
        </div>
        {connection?.mock && (
          <span className="ml-auto rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            {t("app.messages.demoBadge")}
          </span>
        )}
      </div>

      <div className="min-h-[16rem] max-h-[60vh] overflow-y-auto p-4">
        <ListState
          loading={loading}
          errorKey={errorKey}
          onRetry={onRetry}
          isEmpty={!loading && !errorKey && messages.length === 0}
          skeleton={
            <div className="space-y-3 animate-pulse">
              <div className="h-10 w-2/3 rounded-2xl bg-accent" />
              <div className="h-10 w-1/2 rounded-2xl bg-accent ml-auto" />
            </div>
          }
          empty={<p className="text-sm text-muted-foreground">{t("app.messages.noMessages")}</p>}
        >
          <div className="space-y-3">
            {messages.map((m, i) => {
              const label = dayLabel(m.sentAt, { t, formatDate });
              const prev = i > 0 ? dayLabel(messages[i - 1].sentAt, { t, formatDate }) : null;
              return (
                <div key={m.id} className="space-y-3">
                  {label !== prev && (
                    <p className="text-center text-xs font-medium text-muted-foreground">{label}</p>
                  )}
                  <Bubble message={m} bubbles={bubbles} t={t} />
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </ListState>
      </div>

      {/* ── The outcome control ───────────────────────────────────────────
          On the conversation, not buried in the review: it is answered while
          the conversation is in front of you, which is the only time anyone
          knows the answer. */}
      {thread && (
        <div className="border-t border-border p-3">
          <OutcomePicker
            value={thread.outcome}
            onPick={setOutcome}
            busy={savingOutcome || connection?.mock}
            t={t}
          />
          {(thread.clientId || thread.jobId || thread.leadId || thread.quoteId) && (
            <p className="mt-2 text-xs text-muted-foreground">{t("app.messages.link.linked")}</p>
          )}
        </div>
      )}

      {/* ── The composer ─────────────────────────────────────────────────
          Disabled WITH THE REASON ON IT, never hidden. A missing box makes a
          contractor think the feature is broken; a disabled box that says
          "FieldQuo is waiting on Meta's approval for Page messaging" tells
          them the truth and that there is nothing for them to do. */}
      <div className="border-t border-border p-3">
        {blockKey && (
          <p className="mb-2 text-xs text-muted-foreground">{t(blockKey)}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={Boolean(blockKey) || sending}
            rows={1}
            placeholder={t("app.messages.compose.placeholder")}
            aria-label={t("app.messages.compose.placeholder")}
            className="min-h-[44px] flex-1 resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-base text-foreground disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={Boolean(blockKey) || sending || !text.trim()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground disabled:opacity-40"
          >
            {sending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={15} aria-hidden="true" />
            )}
            {t("app.messages.compose.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
