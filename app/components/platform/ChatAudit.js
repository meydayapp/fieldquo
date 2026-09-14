"use client";

// app/components/platform/ChatAudit.js
//
// "All conversations (audit)" — the owner reading every staff room,
// including the direct messages they are not in. Read-only, and the
// participants are told.
//
// ══ No composer, by construction ══════════════════════════════════════════
//
// This screen imports the chat kit's layout, list and thread and NOT its
// Composer; there is no send function and no route to send to
// (app/api/platform/chat/audit/* has no POST). scripts/check-staff-chat.mjs
// greps this file for `<Composer` and `staffApi.send` and fails if either
// appears. Hiding a box is not read-only; not having one is.
//
// ══ The banner is not decoration ══════════════════════════════════════════
//
// "Read-only audit view — participants are told you looked" is the contract
// with the people in the room, stated to the person reading it. Every open
// writes a PlatformAuditLog row and posts a system line into the room
// (lib/staff/auditRules.js), and the screen says so before the first message
// is shown, so the owner never reads a DM believing it was quiet.
//
// English only, like the rest of /platform.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Loader2, Lock, RefreshCw, Search } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { layoutThread } from "@/lib/chat/threadLayout";
import { ChatLayout, PANE_LIST, PANE_THREAD, RoomList, Thread, initialsOf } from "@/app/components/chat";

const KIND_LABEL = { direct: "DM", team: "Team", group: "Group" };
const KIND_ORDER = ["direct", "group", "team"];
const GROUP_TITLE = { direct: "Direct messages", group: "Groups", team: "Team channels" };

/** The relative "3 min ago" the list shows beside a room. */
function ago(value, now = new Date()) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(s, "second");
  if (abs < 3600) return rtf.format(Math.trunc(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.trunc(s / 3600), "hour");
  return rtf.format(Math.trunc(s / 86400), "day");
}

function KindChip({ kind, isPrivate }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" data-kind-chip={kind}>
      {isPrivate ? <Lock size={10} aria-hidden="true" /> : null}
      {KIND_LABEL[kind] || kind}
    </span>
  );
}

export default function ChatAudit() {
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadError, setThreadError] = useState("");
  const [older, setOlder] = useState(false);
  const [pane, setPane] = useState(PANE_LIST);
  const [collapsed, setCollapsed] = useState([]);

  const loadRooms = useCallback(async () => {
    try {
      const next = await fetchJson("/api/platform/chat/audit/rooms");
      setRooms(next.rooms || []);
      setError("");
    } catch (err) {
      setError(err.message || "Couldn't load the conversations.");
    }
  }, []);

  const loadThread = useCallback(async (id) => {
    try {
      const next = await fetchJson(`/api/platform/chat/audit/rooms/${encodeURIComponent(id)}/messages`);
      setThread(next);
      setThreadError("");
    } catch (err) {
      setThreadError(err.message || "Couldn't open that conversation.");
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!openId) return;
    setThread(null);
    loadThread(openId);
  }, [openId, loadThread]);

  // Page backwards. The route records this call too (as a continuation of
  // the same look) — see lib/staff/auditRules.js.
  const loadOlder = useCallback(async () => {
    if (!openId || !thread?.oldestAt || older) return;
    setOlder(true);
    try {
      const next = await fetchJson(
        `/api/platform/chat/audit/rooms/${encodeURIComponent(openId)}/messages?before=${encodeURIComponent(thread.oldestAt)}`,
      );
      setThread((cur) => ({
        ...next,
        messages: [...(next.messages || []), ...(cur?.messages || [])],
        audited: cur?.audited || next.audited,
      }));
    } catch (err) {
      setThreadError(err.message || "Couldn't load older messages.");
    } finally {
      setOlder(false);
    }
  }, [openId, thread, older]);

  const groups = useMemo(() => {
    if (!rooms) return [];
    const q = query.trim().toLowerCase();
    const buckets = { direct: [], group: [], team: [] };
    for (const r of rooms) {
      const hay = [r.title, ...(r.participants || []).map((p) => `${p.name} ${p.email || ""}`)].join(" ").toLowerCase();
      if (q && !hay.includes(q)) continue;
      const names = (r.participants || []).map((p) => p.name).join(", ");
      buckets[KIND_ORDER.includes(r.kind) ? r.kind : "group"].push({
        id: r.id,
        raw: r,
        title: (
          <span className="inline-flex items-center gap-1.5">
            <KindChip kind={r.kind} isPrivate={r.private} />
            <span className="truncate">{r.title}</span>
          </span>
        ),
        subtitle: r.kind === "direct" ? `${r.memberCount} people` : names || `${r.memberCount} members`,
        time: r.lastMessageAt,
        unread: 0,
        initials: r.kind === "direct" ? initialsOf(r.participants?.[0]?.name || r.title) : "#",
        tone: r.kind === "direct" ? "them" : "muted",
        badges: r.messageCount != null ? <span className="text-[11px] tabular-nums text-muted-foreground">{r.messageCount}</span> : null,
      });
    }
    return KIND_ORDER.filter((k) => buckets[k].length).map((k) => ({ key: k, title: GROUP_TITLE[k], rooms: buckets[k] }));
  }, [rooms, query]);

  const rows = useMemo(() => {
    if (!thread) return [];
    return layoutThread(
      (thread.messages || []).map((m) => ({
        id: m.id,
        direction: "in",
        mine: false,
        body: m.body,
        at: m.at,
        kind: m.kind === "system" ? "system" : "message",
        who: m.who,
        meta: m.meta,
      })),
      { lastReadAt: null },
    );
  }, [thread]);

  const renderSystem = useCallback((item) => item.body, []);

  if (error && !rooms) return <p className="text-sm text-red-700 dark:text-red-300">{error}</p>;
  if (!rooms) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading…
      </p>
    );
  }

  const list = (
    <RoomList
      groups={groups}
      selectedId={openId}
      onSelect={(row) => {
        setOpenId(row.id);
        setPane(PANE_THREAD);
      }}
      collapsed={collapsed}
      onToggleGroup={(key) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))}
      ariaLabel="All conversations"
      header={
        <div className="space-y-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">All conversations</h2>
            <button
              type="button"
              onClick={loadRooms}
              aria-label="Reload"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RefreshCw size={14} aria-hidden="true" />
            </button>
          </div>
          <label className="relative block">
            <span className="sr-only">Search conversations</span>
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by room or person"
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-card py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      }
      empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">No conversations yet.</p>}
    />
  );

  const room = thread?.room || rooms.find((r) => r.id === openId) || null;
  const threadNode = !openId ? (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">
        Pick a conversation. Opening one is recorded in the audit log and announced in the room.
      </p>
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
            {room ? <KindChip kind={room.kind} isPrivate={room.private} /> : null}
            <span className="truncate">{room?.title || ""}</span>
          </h2>
          {room ? (
            <p className="truncate text-xs text-muted-foreground">
              {(room.participants || []).map((p) => p.name).join(", ")}
              {room.lastMessageAt ? ` · last message ${ago(room.lastMessageAt)}` : ""}
            </p>
          ) : null}
        </div>
      </header>

      {/* The contract, stated. */}
      <div
        className="flex items-start gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        role="status"
        data-audit-banner
      >
        <Eye size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">Read-only audit view — participants are told you looked.</span>{" "}
          {thread?.audited?.announced
            ? "A line saying you viewed this conversation was just posted into the room, and the audit log has the entry."
            : thread?.audited
              ? "This continues a look the room was already told about; the audit log has the entry."
              : "Opening a conversation posts a line into the room and writes an audit-log entry."}
        </p>
      </div>

      {threadError ? <p className="px-3 py-2 text-sm text-red-700 dark:text-red-300">{threadError}</p> : null}

      {thread?.hasMore ? (
        <div className="border-b border-border px-3 py-1.5 text-center">
          <button
            type="button"
            onClick={loadOlder}
            disabled={older}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {older ? <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            Load older messages
          </button>
        </div>
      ) : null}

      <Thread
        rows={rows}
        them={room?.title || ""}
        loading={!thread && !threadError}
        renderSystem={renderSystem}
        initialsFor={(m) => initialsOf(m.who || room?.title)}
        ariaLabel={room?.title || "Conversation"}
        empty={<p className="py-10 text-center text-sm text-muted-foreground">Nothing has been said here.</p>}
      />
    </>
  );

  return (
    <div data-chat-audit>
      <ChatLayout list={list} thread={threadNode} pane={pane} context={null} onCloseContext={() => setPane(PANE_THREAD)} height="h-[calc(100vh-12rem)]" />
    </div>
  );
}
