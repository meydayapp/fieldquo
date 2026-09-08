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
  MessageCircle, Search, ChevronLeft, Send, Loader2, BarChart3, Link2, StickyNote,
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
  Avatar, PlatformBadge, Bubble, OutcomePicker, StatusFilter, StatusPicker,
  WaitingBadge, ComposerTabs, AssigneePicker, ServiceWindowNotice, TemplatePicker,
  dayLabel,
} from "./ConversationBits";

export default function MessagesPage() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();

  // null, never []. An outage that rendered as "you have no conversations"
  // would tell a contractor their enquiries had vanished — see ListState.
  const [threads, setThreads] = useState(null);
  const [connection, setConnection] = useState(null);
  const [bubbles, setBubbles] = useState(null);
  // The private note's measured palette, from the same response as the
  // bubbles' — see lib/messaging/noteTheme.js for why it takes no company.
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [query, setQuery] = useState("");
  // null = every state. The server filters, so this is a request rather than a
  // client-side hide: a chip that only hid rows the browser already had would
  // stop matching the moment the list is longer than one page.
  const [statusFilter, setStatusFilter] = useState(null);
  // The company's people, for the assignee picker. Reuses the endpoint the
  // leads board already has — same `requests: view_only` gate as this screen,
  // same id-and-name-only payload — rather than a second one that would drift.
  const [people, setPeople] = useState([]);

  // The clock the "waiting 4 h" badge is measured against. Ticked once a
  // minute rather than read at render: a tab left open on a phone in a van
  // would otherwise still say "waiting 20 min" three hours later, which is the
  // same class of lie as a stale total — a number that was true once.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const [activeId, setActiveId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadErrorKey, setThreadErrorKey] = useState("");

  const load = useCallback(async (q, status) => {
    setLoading(true);
    setErrorKey("");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    const suffix = params.toString() ? "?" + params.toString() : "";
    const result = await fetchList("/api/messaging/threads" + suffix);
    if (result.aborted) return;
    if (result.ok) {
      setThreads(result.data?.threads || []);
      setConnection(result.data?.connection || null);
      setBubbles(result.data?.bubbles || null);
      setNote(result.data?.note || null);
    } else {
      setErrorKey(result.errorKey);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load("", null);
  }, [load]);

  useEffect(() => {
    // A failure here leaves the assignee list empty, which renders as "nobody"
    // and no names — honest, and not worth an error banner over the inbox
    // itself. The picker is disabled by its own emptiness, not by a lie.
    fetch("/api/leads/assignees")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setPeople(Array.isArray(rows) ? rows : []))
      .catch(() => setPeople([]));
  }, []);

  // Debounced search. The server does the filtering (it can search message
  // bodies, which the browser never has), so this is a request, not a filter.
  // The status chip goes through the same request for the same reason.
  useEffect(() => {
    const id = setTimeout(() => load(query.trim(), statusFilter), 250);
    return () => clearTimeout(id);
  }, [query, statusFilter, load]);

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

          {/* The four states, as chips. Filtering happens on the server — see
              load() — so a chip means the same thing on row one and row 300. */}
          <div className="mt-3">
            <StatusFilter value={statusFilter} onPick={setStatusFilter} t={t} />
          </div>

          <div className="mt-3">
            <ListState
              loading={loading}
              errorKey={errorKey}
              onRetry={() => load(query.trim(), statusFilter)}
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
                    {query || statusFilter
                      ? t("app.messages.noMatches")
                      : t("app.messages.empty")}
                  </p>
                  {!query && !statusFilter && (
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
                            {/* The number a person says out loud. Absent when
                                the row never got one — never invented, because
                                two conversations answering to "41" is worse
                                than one answering to nothing. */}
                            {Number.isFinite(row.threadNumber) && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {t("app.messages.threadNumber", { number: row.threadNumber })}
                              </span>
                            )}
                            {row.unread > 0 && (
                              <span className="ml-auto shrink-0 rounded-full bg-inverted px-2 py-0.5 text-xs font-bold text-inverted-foreground">
                                {row.unread}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{row.preview}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <PlatformBadge platform={row.platform} t={t} />
                            {/* The whole reason waitingSince is a column: this
                                sentence, here, on a list of two hundred —
                                rather than in a report once a month. */}
                            <WaitingBadge thread={row} t={t} now={now} />
                            {row.status && row.status !== "open" && (
                              <span className="text-xs text-muted-foreground">
                                {t("app.messages.status." + row.status)}
                              </span>
                            )}
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
              note={note}
              people={people}
              blockKey={blockKey}
              connection={connection}
              onChanged={async () => {
                await openThread(activeId);
                await load(query.trim(), statusFilter);
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
  thread, loading, errorKey, onRetry, onBack, bubbles, note, people, blockKey,
  connection, onChanged, t, formatDate,
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  // "reply" or "note". Two different destinations, two different routes, and
  // the composer is dressed as whichever one it is about to write to.
  const [mode, setMode] = useState("reply");
  // The snooze deadline, held here until it is valid. Nothing is saved without
  // one — see the route, which refuses the same thing for the same reason.
  const [snoozeAt, setSnoozeAt] = useState("");
  const [askingSnooze, setAskingSnooze] = useState(false);
  // The WhatsApp template a contractor picked once the 24-hour window closed,
  // and its fill-in values. Held here rather than in the picker so that
  // switching threads clears them — a value typed for one homeowner must not
  // survive into a message to another.
  const [templateId, setTemplateId] = useState(null);
  const [templateParams, setTemplateParams] = useState([]);
  const endRef = useRef(null);

  // Every thread starts with nothing chosen. Without this a template picked on
  // a closed WhatsApp thread would still be selected when a Facebook thread is
  // opened next, and the first Send would post a templateId the server would
  // reject — a confusing refusal caused entirely by a stale piece of state.
  useEffect(() => {
    setTemplateId(null);
    setTemplateParams([]);
  }, [thread?.id]);

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
    // A template send carries no typed body — the words are the approved ones
    // and the server fills them in from ITS row, never from the browser.
    if (!body && !sendingTemplate) return;
    setSending(true);
    try {
      // TWO ROUTES, chosen here, and the note one does not import the send
      // path at all — see its header. A single endpoint with a `private` flag
      // would put a colleague's opinion of a customer one inverted boolean
      // away from that customer's inbox.
      const url =
        mode === "note"
          ? "/api/messaging/threads/" + thread.id + "/note"
          : "/api/messaging/threads/" + thread.id + "/reply";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sendingTemplate
            // The id and the values ONLY. No body, no name, no language: the
            // server looks the template up in its own rows, which is what stops
            // an approved template being used as an envelope for arbitrary
            // text. Same rule as add-on pricing (AGENTS.md non-negotiable #5).
            ? { kind: "template", templateId, params: templateParams }
            : { text: body },
        ),
      });
      if (!res.ok) {
        // The server's own sentence — "no Page is connected", "that Page needs
        // reconnecting" — not a generic failure. It also WROTE the attempt, so
        // reloading shows the failed bubble beneath.
        await reportResponseError(
          res,
          mode === "note" ? t("app.messages.note.error") : t("app.messages.compose.error"),
        );
        await onChanged?.();
        return;
      }
      setText("");
      setTemplateId(null);
      setTemplateParams([]);
      await onChanged?.();
    } finally {
      setSending(false);
    }
  }

  /** One PATCH for every judgement on this thread, with the server's sentence
   *  on a refusal. `field` only names which message to show. */
  async function patchThread(payload, errorKeyName = "app.messages.outcome.saveError") {
    setSavingOutcome(true);
    try {
      const res = await fetch("/api/messaging/threads/" + thread.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        await reportResponseError(res, t(errorKeyName));
        return false;
      }
      await onChanged?.();
      return true;
    } finally {
      setSavingOutcome(false);
    }
  }

  const setOutcome = (outcome) => patchThread({ outcome });

  function pickStatus(status) {
    // Snoozing is the one state that needs a second answer. The date field is
    // revealed rather than the status being written with a made-up deadline —
    // "parked until sometime" is how a lead disappears.
    if (status === "snoozed") {
      setAskingSnooze(true);
      return;
    }
    setAskingSnooze(false);
    patchThread({ status }, "app.messages.status.saveError");
  }

  async function confirmSnooze() {
    if (!snoozeAt) return;
    const saved = await patchThread(
      { status: "snoozed", snoozedUntil: new Date(snoozeAt).toISOString() },
      "app.messages.status.saveError",
    );
    if (saved) {
      setAskingSnooze(false);
      setSnoozeAt("");
    }
  }

  const messages = thread?.messages || [];
  // The Reply side is blocked (Meta has not approved Page messaging), the Note
  // side is not: a note goes nowhere near Meta. This is the one control on the
  // screen a real contractor can use today, and gating it behind the same
  // blocker would have been an accident rather than a decision.
  // ── Three reasons the Reply side can be off, and they stack ────────────
  //
  // `blockKey` is the connection ("Meta has not approved us yet"). The window
  // is a fourth, separate, and TEMPORARY one, and it is the only one with a
  // way through — so it does not merely disable the box, it swaps it for the
  // template picker.
  const windowNotice = thread?.serviceWindow || null;
  const windowClosed = Boolean(windowNotice?.blockKey);
  const composerBlocked = mode === "reply" && (Boolean(blockKey) || windowClosed);
  // What Send is about to do. A template only, and only on the Reply side:
  // a note goes nowhere near Meta and has no window.
  const sendingTemplate = mode === "reply" && windowClosed && Boolean(templateId);
  // A demo's threads are computed rather than stored, so nothing typed into
  // either side would survive a refresh. Said on the tab, not discovered.
  const demoBlocked = Boolean(connection?.mock);

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
            {Number.isFinite(thread?.threadNumber) && (
              <span className="ml-2 font-normal text-xs text-muted-foreground">
                {t("app.messages.threadNumber", { number: thread.threadNumber })}
              </span>
            )}
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
                  {/* One component for all four kinds — a reply, a message, a
                      private note and a system line — because they are one
                      column, in order, and that ordering is the whole point. */}
                  <Bubble message={m} bubbles={bubbles} note={note} t={t} />
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
        <div className="space-y-4 border-t border-border p-3">
          <OutcomePicker
            value={thread.outcome}
            onPick={setOutcome}
            busy={savingOutcome || connection?.mock}
            t={t}
          />

          {/* ── Where it sits, and who has it ─────────────────────────────
              The two questions the outcome control could never answer: an
              outcome is what a conversation TURNED OUT to be, and these are
              what is happening with it now. Deliberately the same shape of
              control — chips, 44px, current answer visible — so nobody has to
              learn a second idiom halfway down one panel. */}
          <StatusPicker
            value={thread.status}
            snoozedUntil={thread.snoozedUntil}
            onPick={pickStatus}
            busy={savingOutcome || connection?.mock}
            t={t}
          />
          {askingSnooze && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="block text-xs">
                <span className="text-muted-foreground">{t("app.messages.status.snoozeWhen")}</span>
                <input
                  type="datetime-local"
                  value={snoozeAt}
                  onChange={(e) => setSnoozeAt(e.target.value)}
                  className="mt-1 block min-h-[44px] rounded-lg border border-border bg-background px-2 text-base text-foreground"
                />
              </label>
              <button
                type="button"
                onClick={confirmSnooze}
                // Disabled until there IS a date. The route refuses the same
                // thing; hiding the control is not validation, so both exist.
                disabled={!snoozeAt || savingOutcome || connection?.mock}
                className="min-h-[44px] rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground disabled:opacity-40"
              >
                {t("app.messages.status.snoozeConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setAskingSnooze(false)}
                className="min-h-[44px] rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground"
              >
                {t("app.messages.status.snoozeCancel")}
              </button>
            </div>
          )}

          <AssigneePicker
            value={thread.assignedToId}
            people={people}
            onPick={(id) => patchThread({ assignedToId: id }, "app.messages.assignee.saveError")}
            busy={savingOutcome || connection?.mock}
            t={t}
          />

          {(thread.clientId || thread.jobId || thread.leadId || thread.quoteId) && (
            <p className="text-xs text-muted-foreground">{t("app.messages.link.linked")}</p>
          )}
        </div>
      )}

      {/* ── The composer ─────────────────────────────────────────────────
          Disabled WITH THE REASON ON IT, never hidden. A missing box makes a
          contractor think the feature is broken; a disabled box that says
          "FieldQuo is waiting on Meta's approval for Page messaging" tells
          them the truth and that there is nothing for them to do. */}
      <div className="border-t border-border p-3">
        {/* Reply, or note. The reason the Reply side is off travels WITH the
            tabs, so somebody who can still write a note can see that it is
            only the reply that is blocked. */}
        <ComposerTabs
          mode={mode}
          onPick={setMode}
          note={note}
          disabledReplyKey={blockKey}
          t={t}
        />
        {demoBlocked && (
          <p className="mb-2 text-xs text-muted-foreground">{t("app.messages.compose.disabled.demo")}</p>
        )}
        {/* The window, said out loud — including while it is still OPEN and
            about to close, which is the moment it is worth knowing. Only on
            the Reply side: a private note has no window. */}
        {mode === "reply" && <ServiceWindowNotice notice={windowNotice} t={t} />}
        {/* The way through, offered exactly when it is the answer. */}
        {mode === "reply" && windowClosed && !blockKey && (
          <TemplatePicker
            templates={thread?.templates}
            value={templateId}
            onPick={(id) => {
              setTemplateId(id);
              setTemplateParams([]);
            }}
            params={templateParams}
            onParam={(i, v) =>
              setTemplateParams((prev) => {
                const next = [...prev];
                next[i] = v;
                return next;
              })
            }
            t={t}
          />
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            // A closed window disables the TYPING box, not the Send button:
            // Send stays alive to post the chosen template. Two different
            // conditions, deliberately, because they are two different
            // controls doing two different things.
            disabled={composerBlocked || demoBlocked || sending}
            rows={1}
            // The box is dressed as what it is about to write, before a word
            // is typed — the moment the mistake would otherwise be made.
            style={
              mode === "note" && note?.bg
                ? { backgroundColor: note.bg, color: note.fg, borderColor: note.border }
                : undefined
            }
            placeholder={
              mode === "note"
                ? t("app.messages.note.placeholder")
                : t("app.messages.compose.placeholder")
            }
            aria-label={
              mode === "note"
                ? t("app.messages.note.placeholder")
                : t("app.messages.compose.placeholder")
            }
            className="min-h-[44px] flex-1 resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-base text-foreground disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={
              demoBlocked ||
              sending ||
              (sendingTemplate
                ? false
                : composerBlocked || !text.trim())
            }
            className="min-h-[44px] inline-flex items-center gap-2 rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground disabled:opacity-40"
          >
            {sending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : mode === "note" ? (
              <StickyNote size={15} aria-hidden="true" />
            ) : (
              <Send size={15} aria-hidden="true" />
            )}
            {mode === "note"
              ? t("app.messages.note.save")
              : sendingTemplate
                ? t("app.messages.template.send")
                : t("app.messages.compose.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
