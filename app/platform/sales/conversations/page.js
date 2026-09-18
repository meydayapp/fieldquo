"use client";

// app/platform/sales/conversations/page.js
//
// A rep's texts and emails with prospects, read by the owner.
//
// ══ A surveillance surface, and it says so ═════════════════════════════════
//
// Superadmin-only ("chat:audit" — lib/platform/permissions.js), read-only,
// and recorded: opening a thread writes a PlatformAuditLog row, and the rep
// then sees "Reviewed by the owner on <date>" on that thread in their own
// portal (lib/sales/conversationAudit.js). The notice at the top says all of
// that to the person reading, the way /platform/sales/notes does.
//
// ══ Mirrors the rep's screens, with the rep's own renderer ═════════════════
//
// The list is the chat kit's RoomList — Texts and Email threads as two
// groups, the way the rep's own Conversations screen groups its rooms — and
// the messages are drawn by app/sales/messages/MessageThread.js, the SAME
// presentational component the rep's email thread renders with. Not forked:
// a thread that looked different here from what the rep sees would be a
// second opinion about what was said.
//
// ══ No composer, by construction ══════════════════════════════════════════
//
// There is no send box and no route to send to. The owner reads; a reply
// to a prospect goes through the rep and every gate the rep's send has.
//
// English only, like the rest of /platform.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Loader2, Mail, MessageSquareText, Search } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";
import MessageThread from "@/app/sales/messages/MessageThread";
import { ChatLayout, PANE_LIST, PANE_THREAD, RoomList, initialsOf } from "@/app/components/chat";
import UnownedTexts from "@/app/components/platform/sales/UnownedTexts";

const NOTICE = {
  headline: "The owner can read any rep's conversations with prospects here. Reps are told.",
  detail:
    "Read-only: nothing here can send, edit or delete. Opening a thread writes an audit-log entry, and the rep sees " +
    "“Reviewed by the owner on <date>” on that thread in their own portal. Superadmins only — not admin, not support. " +
    "The one write is filing a text nobody could be matched to, below, which is audited under your name.",
};

function prettyE164(e164) {
  const d = String(e164 || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return e164 || "";
}

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function ConversationsScreen() {
  const [repId, setRepId] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null); // { kind, id }
  const [thread, setThread] = useState(null);
  const [threadError, setThreadError] = useState("");
  const [pane, setPane] = useState(PANE_LIST);
  const [collapsed, setCollapsed] = useState([]);

  // ?repId= from the rep card's "Conversations" link, read once on arrival.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wanted = new URLSearchParams(window.location.search).get("repId");
    if (wanted) setRepId(wanted);
  }, []);

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    if (repId) params.set("repId", repId);
    if (query.trim()) params.set("q", query.trim());
    try {
      setData(await fetchJson(`/api/platform/sales/conversations?${params}`));
    } catch (err) {
      setError(err.message || "Couldn't load the conversations.");
    }
  }, [repId, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    setThread(null);
    setThreadError("");
    const url =
      open.kind === "sms"
        ? `/api/platform/sales/conversations/sms/${encodeURIComponent(open.id)}?repId=${encodeURIComponent(repId)}`
        : `/api/platform/sales/conversations/email/${encodeURIComponent(open.id)}`;
    let alive = true;
    fetchJson(url)
      .then((next) => alive && setThread(next))
      .catch((err) => alive && setThreadError(err.message || "Couldn't open that conversation."));
    return () => {
      alive = false;
    };
  }, [open, repId]);

  const groups = useMemo(() => {
    if (!data?.rep) return [];
    const texts = (data.sms || []).map((c) => ({
      id: `sms:${c.e164}`,
      raw: { kind: "sms", id: c.e164 },
      title: c.name || prettyE164(c.e164),
      subtitle: c.lastBody ? `${c.lastDirection === "out" ? `${data.rep.name || "Rep"}:` : ""} ${c.lastBody}`.trim() : "",
      time: c.lastAt,
      unread: 0,
      initials: initialsOf(c.name || prettyE164(c.e164)),
      tone: "them",
      badges: <span className="text-[11px] tabular-nums text-muted-foreground">{c.count}</span>,
    }));
    const emails = (data.email || []).map((t) => ({
      id: `email:${t.id}`,
      raw: { kind: "email", id: t.id },
      title: t.lead?.businessName || t.subject,
      subtitle: t.subject,
      time: t.lastAt,
      unread: 0,
      initials: initialsOf(t.lead?.businessName || t.subject),
      tone: "muted",
      badges: <span className="text-[11px] tabular-nums text-muted-foreground">{t.count}</span>,
    }));
    const out = [];
    if (texts.length) out.push({ key: "sms", title: "Texts", rooms: texts });
    if (emails.length) out.push({ key: "email", title: "Email threads", rooms: emails });
    return out;
  }, [data]);

  const selectedId = open ? `${open.kind}:${open.id}` : null;

  const list = (
    <RoomList
      groups={groups}
      selectedId={selectedId}
      onSelect={(row) => {
        setOpen(row.raw);
        setPane(PANE_THREAD);
      }}
      collapsed={collapsed}
      onToggleGroup={(key) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))}
      ariaLabel="Rep conversations"
      header={
        <div className="space-y-2 border-b border-border px-3 py-2">
          <label className="block">
            <span className="sr-only">Rep</span>
            <select
              value={repId}
              onChange={(e) => {
                setRepId(e.target.value);
                setOpen(null);
                setThread(null);
              }}
              className="w-full min-h-[40px] rounded-lg border border-border bg-card px-2 text-sm text-foreground"
              data-rep-picker
            >
              <option value="">Choose a rep…</option>
              {(data?.reps || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || r.email}
                  {r.active && !r.endedAt ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <label className="relative block">
            <span className="sr-only">Search</span>
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Business, number or subject"
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-card py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      }
      empty={
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {data?.rep ? "No conversations for this rep." : "Choose a rep to see their texts and email threads."}
        </p>
      }
    />
  );

  const them = thread
    ? thread.kind === "sms"
      ? thread.lead?.businessName || thread.lead?.contactName || prettyE164(thread.with)
      : thread.lead?.contactName || thread.lead?.businessName || "Prospect"
    : "";

  const threadNode = !open ? (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">Pick a conversation. Opening one is recorded, and the rep is told.</p>
    </div>
  ) : (
    <>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setPane(PANE_LIST)}
          aria-label="Back"
          className="md:hidden -ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            {open.kind === "sms" ? <MessageSquareText size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" /> : <Mail size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />}
            <span className="truncate">{thread ? (thread.kind === "sms" ? them : thread.thread?.subject) : "…"}</span>
          </h2>
          {thread ? (
            <p className="truncate text-xs text-muted-foreground">
              {thread.rep?.name || thread.rep?.email}
              {thread.kind === "sms" ? ` ↔ ${prettyE164(thread.with)}` : ` ↔ ${thread.lead?.email || them}`}
            </p>
          ) : null}
        </div>
      </header>

      <div
        className="flex items-start gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        role="status"
        data-audit-banner
      >
        <Eye size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">Read-only audit view — the rep is told you looked.</span>{" "}
          {thread?.audited?.at ? `Recorded ${when(thread.audited.at)}.` : "Opening a thread writes an audit-log entry."}
        </p>
      </div>

      {threadError ? <p className="px-3 py-2 text-sm text-red-700 dark:text-red-300">{threadError}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!thread && !threadError ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading…
          </p>
        ) : thread ? (
          // The rep's own renderer. `direction: "out"` rows are the REP's
          // words and MessageThread labels them "You" — that "You" is the rep,
          // not the owner reading; the header above names whose thread it is.
          <MessageThread messages={thread.messages || []} them={them} />
        ) : null}
      </div>
    </>
  );

  return (
    <div className="space-y-4" data-rep-conversations>
      <div className="rounded-lg border border-border bg-card p-3 sm:p-4 text-sm">
        <div className="flex items-start gap-2">
          <Eye size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{NOTICE.headline}</p>
            <p className="mt-1 text-muted-foreground">{NOTICE.detail}</p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-amber-700 dark:text-amber-300">{error}</p>
      ) : null}

      {/* Rung (d) of lib/sales/smsAttribution.js: the texts no rule could
          file. Here and nowhere else — never in a rep's list. Filing one
          reloads the rep's conversations so it appears under them. */}
      <UnownedTexts onAssigned={() => load()} />

      <ChatLayout list={list} thread={threadNode} pane={pane} context={null} onCloseContext={() => setPane(PANE_THREAD)} height="h-[calc(100vh-16rem)]" />
    </div>
  );
}

export default function PlatformRepConversationsPage() {
  const { status, error, can } = usePlatformAdmin();
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquareText size={18} className="text-muted-foreground shrink-0" />
        <h1 className="text-lg font-semibold text-foreground">Rep conversations</h1>
      </div>
      <PlatformWriteGate
        status={status}
        allowed={can("chat:audit")}
        error={error}
        action="Reading a rep's conversations with prospects"
        who="The owner (superadmin) only"
      >
        <ConversationsScreen />
      </PlatformWriteGate>
    </div>
  );
}
