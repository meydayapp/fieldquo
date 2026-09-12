"use client";

// app/components/company/CompanyChat.js
//
// A contractor company's own crew chat, on the shared chat kit.
//
// ══ What it is, and what it is not ════════════════════════════════════════
//
// #general for everybody on the roster, one room per active job for the crew
// booked on it and the office, and direct messages between two people. The
// rooms are DERIVED from the roster and the schedule (lib/company/chat/
// rules.js): nobody makes a group, nobody adds or removes anybody, because a
// hand-kept list drifts from the schedule the first week. So this screen has
// a New message button and no New group; a Members bar that lists and
// explains and offers no control it could not honour.
//
// It is NOT app/components/staff/StaffChat.js with the names changed. That
// component is FieldQuo's own staff talking to each other across two portals
// and two identity tables; this is one company talking to itself. What the
// two share — the layout, the list, the thread, the composer, the day and
// unread dividers — they share by rendering the same kit, which is the
// point of the kit. What they do not share (who is in a room, what an @ can
// name, what a system row says) is decided here.
//
// ══ Every id the browser sends is re-checked by the server ════════════════
//
// Pick somebody from the directory and the server resolves the id against
// the caller's own company roster again. Open a room and the server checks
// the caller's company AND their membership. This screen never decides who
// exists, and never decides what company anything belongs to.
//
// ══ Read-only support sessions ════════════════════════════════════════════
//
// A platform admin looking at a customer's account sees every room and the
// composer is replaced by one sentence saying why they cannot post. The
// server refuses the write anyway (twice — the method gate and the store);
// the sentence is so the screen does not look broken.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Briefcase, Hash, Loader2, Pencil, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { errorText } from "@/lib/fetchJson";
import { notify } from "@/lib/notify/browser";
import { chatApi, CHAT_REFUSAL_KEYS } from "@/lib/company/chat/client";
import { groupOf, GROUP_ORDER } from "@/lib/company/chat/rules";
import { layoutThread } from "@/lib/chat/threadLayout";
import {
  ChatLayout,
  PANE_LIST,
  PANE_THREAD,
  PANE_CONTEXT,
  RoomList,
  Thread,
  Composer,
  ContextBar,
  Avatar,
  initialsOf,
} from "@/app/components/chat";

const POLL_MS = 15000;
const FINISHED = "finished";

/** The catalogue key for a role label beside a name. */
const LABEL_KEYS = {
  owner: "app.companyChat.label.owner",
  admin: "app.companyChat.label.admin",
  supervisor: "app.companyChat.label.supervisor",
  employee: "app.companyChat.label.employee",
};

/** A room's printed name: "#general" translated, a job's title, a person. */
function useRoomName() {
  const { t } = useTranslation();
  return useCallback(
    (room) => {
      if (!room) return "";
      if (room.kind === "general") return `#${t("app.companyChat.general")}`;
      if (room.kind === "job") return room.title || t("app.companyChat.untitledJob");
      return room.titleMissing || !room.title ? t("app.companyChat.someoneWhoLeft") : room.title;
    },
    [t],
  );
}

/**
 * The directory, searchable, single-select. One picker for New message —
 * the only place a person is chosen on this screen.
 */
function PeoplePicker({ people, loading, error, query, onQuery, onPick, excludeId = null }) {
  const { t } = useTranslation();
  const rows = (people || []).filter((p) => p.id !== excludeId);
  return (
    <div className="space-y-2" data-people-picker>
      <label className="relative block">
        <span className="sr-only">{t("app.companyChat.searchPeople")}</span>
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("app.companyChat.searchPeople")}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border" role="listbox">
        {loading && !people ? (
          <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
          </li>
        ) : rows.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {query ? t("app.companyChat.noPeople") : t("app.companyChat.directoryEmpty")}
          </li>
        ) : (
          rows.map((p) => (
            <li key={p.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={false}
                data-person={p.id}
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left min-h-[48px] hover:bg-muted/60"
              >
                <Avatar initials={initialsOf(p.name || p.email || "?")} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{p.name || p.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t(LABEL_KEYS[p.label] || LABEL_KEYS.employee)}
                    {p.email && p.email !== p.name ? ` · ${p.email}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** A modal frame. The kit has none; this screen needs one. */
function Modal({ title, onClose, children }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-card shadow-xl sm:max-w-md sm:rounded-2xl"
        data-chat-modal
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("app.chat.close")} className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

/** Reads the directory once per open, filtered client-side as they type. */
function useDirectory(open) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    chatApi
      .directory()
      .then((d) => alive && setPeople(d.people || []))
      .catch((err) => alive && setError(errorText(tRef.current, err, CHAT_REFUSAL_KEYS)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!people || !q) return people;
    return people.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q));
  }, [people, query]);
  return { people: filtered, loading, error, query, setQuery };
}

// ── The mention popup over the composer ────────────────────────────────────

/** The "@que" being typed at the END of the text, or null. */
function mentionTokenAt(text) {
  const m = /(^|\s)@([^\s@]*)$/.exec(String(text || ""));
  return m ? { start: text.length - m[2].length - 1, query: m[2] } : null;
}

function MentionPopup({ members, query, cursor, onHover, onPick }) {
  const { t } = useTranslation();
  const q = query.toLowerCase();
  const rows = members.filter((m) => !q || (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)).slice(0, 8);
  return (
    <div
      role="listbox"
      aria-label={t("app.companyChat.mentionTitle")}
      data-mention-popup
      className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>@ {t("app.companyChat.mentionTitle")}</span>
        <span className="normal-case tracking-normal font-normal">{t("app.companyChat.mentionKeys")}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{t("app.companyChat.mentionEmpty")}</p>
      ) : (
        rows.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="option"
            aria-selected={i === cursor}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(m)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i === cursor ? "bg-muted" : "hover:bg-muted/60"}`}
          >
            <Avatar initials={initialsOf(m.name || m.email || "?")} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{m.name || m.email}</span>
              <span className="block truncate text-xs text-muted-foreground">{t(LABEL_KEYS[m.label] || LABEL_KEYS.employee)}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param heading   the list's title
 * @param initialRoomId  a room to open on first paint (from ?room=, the
 *                  URL a push notification lands on)
 * @param height    the frame's height class — the page knows what chrome
 *                  sits above it; this component does not
 */
export default function CompanyChat({ heading = "Chat", initialRoomId = null, height = "h-[calc(100vh-9rem)]" }) {
  const { t } = useTranslation();
  const roomName = useRoomName();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(initialRoomId || null);
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pane, setPane] = useState(initialRoomId ? PANE_THREAD : PANE_LIST);
  const [context, setContext] = useState(null); // "members" | null
  const [modal, setModal] = useState(null); // "message" | null
  const [collapsed, setCollapsed] = useState([FINISHED]);
  const [actionError, setActionError] = useState("");
  const lastSeenRef = useRef(null);

  // Through a ref, so the loaders below do not re-create on every render
  // and re-fire the effects that call them.
  const tRef = useRef(t);
  tRef.current = t;
  const say = useCallback((err, fallbackKey) => errorText(tRef.current, err, CHAT_REFUSAL_KEYS) || tRef.current(fallbackKey), []);
  const roomNameRef = useRef(roomName);
  roomNameRef.current = roomName;

  // ── The in-tab half of notifications: @mentions and DMs ───────────────
  //
  // A room whose `mentions` count ROSE since the last list read means
  // somebody said this person's name; a DM whose `unread` rose means the
  // other person wrote. Told through notify() — a toast while this tab is
  // focused, a system notification when the chat is in a background tab
  // (lib/notify/browser.js). Only from the second read on, so opening the
  // screen does not replay the backlog; the badge on the row is that. Same
  // tag as the server's push for the room, so a person with both sees each
  // event once.
  const seen = useRef(null);
  const announce = useCallback((next) => {
    const rooms = Array.isArray(next?.rooms) ? next.rooms : [];
    const prev = seen.current;
    const now = new Map(rooms.map((r) => [r.id, { mentions: Number(r.mentions) || 0, unread: Number(r.unread) || 0 }]));
    if (prev) {
      for (const r of rooms) {
        const before = prev.get(r.id) || { mentions: 0, unread: 0 };
        const after = now.get(r.id);
        const name = roomNameRef.current(r);
        if (after.mentions > before.mentions) {
          notify({
            title: tRef.current("app.notify.mention.title", { name: r.lastWho || name, room: name }),
            body: r.lastBody || "",
            tag: `company-chat:${r.id}`,
            url: `/app/chat?room=${encodeURIComponent(r.id)}`,
          });
        } else if (r.kind === "dm" && after.unread > before.unread) {
          notify({
            title: tRef.current("app.notify.newMessage.title", { name }),
            body: r.lastBody || "",
            tag: `company-chat:${r.id}`,
            url: `/app/chat?room=${encodeURIComponent(r.id)}`,
          });
        }
      }
    }
    seen.current = now;
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const next = await chatApi.list();
      announce(next);
      setData(next);
      setError("");
    } catch (err) {
      // Named, not swallowed: an empty screen and a broken screen look
      // identical and mean opposite things.
      setError(say(err, "app.companyChat.loadError"));
    }
  }, [announce, say]);

  const loadRoom = useCallback(
    async (id, { keepSeen = false } = {}) => {
      try {
        const next = await chatApi.room(id);
        // The unread line is drawn against where they had read up to when
        // they OPENED the room, not against the last poll.
        if (!keepSeen) lastSeenRef.current = next.lastSeenAt || null;
        setRoom(next);
        setRoomError("");
      } catch (err) {
        setRoomError(say(err, "app.companyChat.roomLoadError"));
      }
    },
    [say],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!openId) return;
    setRoom(null);
    loadRoom(openId);
  }, [openId, loadRoom]);

  // Polling, while the tab is visible. A chat that only updates on reload is
  // a mailbox.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadList();
      if (openId) loadRoom(openId, { keepSeen: true });
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [loadList, loadRoom, openId]);

  // ── The list, grouped ──────────────────────────────────────────────────
  const groups = useMemo(() => {
    if (!data) return [];
    const buckets = { unread: [], general: [], job: [], direct: [], finished: [] };
    for (const r of data.rooms || []) {
      const g = groupOf(r, { unreadOnTop: true });
      if (!buckets[g]) continue;
      const name = roomName(r);
      const preview = r.lastBody
        ? `${r.lastWasMine ? t("app.companyChat.youPrefix") : r.lastWho ? `${r.lastWho}:` : ""} ${r.lastBody}`.trim()
        : r.kind === "dm"
          ? t("app.companyChat.noMessages")
          : r.kind === "job"
            ? t("app.companyChat.jobRoomHint", { count: r.memberCount })
            : t("app.companyChat.generalHint");
      buckets[g].push({
        id: r.id,
        raw: r,
        title: name,
        subtitle: preview,
        time: r.lastAt,
        unread: r.unread,
        initials: r.kind === "dm" ? initialsOf(name) : r.kind === "job" ? initialsOf(name) : "#",
        tone: r.kind === "dm" ? "them" : "muted",
        channel: r.kind === "job" ? "team" : null,
        channelLabel: r.kind === "job" ? t("app.companyChat.group.job") : "",
        badges:
          r.mentions > 0 ? (
            <span
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums"
              data-mention-badge
            >
              <span aria-hidden="true">@{r.mentions}</span>
              <span className="sr-only">{t("app.companyChat.mentionCountSr", { count: r.mentions })}</span>
            </span>
          ) : null,
      });
    }
    return GROUP_ORDER.filter((k) => buckets[k].length).map((k) => ({
      key: k,
      title: t(`app.companyChat.group.${k}`),
      rooms: buckets[k],
    }));
  }, [data, t, roomName]);

  const selectRoom = useCallback((row) => {
    setActionError("");
    setOpenId(row.id);
    setPane(PANE_THREAD);
  }, []);

  // ── Sending ────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || !openId || sending) return;
    setSending(true);
    setActionError("");
    try {
      await chatApi.send(openId, body);
      setText("");
      lastSeenRef.current = new Date().toISOString();
      await loadRoom(openId, { keepSeen: true });
      loadList();
    } catch (err) {
      setActionError(say(err, "app.companyChat.refusal.notSent"));
    } finally {
      setSending(false);
    }
  }, [text, openId, sending, loadRoom, loadList, say]);

  // ── @ popup ────────────────────────────────────────────────────────────
  const token = useMemo(() => mentionTokenAt(text), [text]);
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(null);
  const mentionable = useMemo(() => (room?.members || []).filter((m) => !m.isYou), [room]);
  const mentionOpen = Boolean(token) && room?.kind !== "dm" && mentionDismissed !== token?.start;
  const mentionRows = useMemo(() => {
    if (!mentionOpen) return [];
    const q = token.query.toLowerCase();
    return mentionable.filter((m) => !q || (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)).slice(0, 8);
  }, [mentionOpen, token, mentionable]);
  useEffect(() => setMentionCursor(0), [token?.query]);

  const insertMention = useCallback(
    (m) => {
      if (!token) return;
      setText(`${text.slice(0, token.start)}@${m.name || m.email} `);
      setMentionDismissed(null);
    },
    [token, text],
  );

  // Capture-phase, so the kit's own Enter-sends handler never sees a key the
  // popup consumed.
  const onComposerKeyDownCapture = (e) => {
    if (!mentionOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setMentionCursor((c) => (mentionRows.length ? (c + 1) % mentionRows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setMentionCursor((c) => (mentionRows.length ? (c - 1 + mentionRows.length) % mentionRows.length : 0));
    } else if ((e.key === "Tab" || e.key === "Enter") && mentionRows.length) {
      e.preventDefault();
      e.stopPropagation();
      insertMention(mentionRows[mentionCursor] || mentionRows[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setMentionDismissed(token.start);
    }
  };

  // ── The thread rows ────────────────────────────────────────────────────
  const rows = useMemo(() => {
    if (!room) return [];
    const items = (room.messages || []).map((m) => ({
      id: m.id,
      direction: m.direction,
      mine: m.direction === "out",
      body: m.mentionsMe ? (
        <span className="-mx-1 block rounded bg-amber-100 px-1 dark:bg-amber-950/40" data-mentions-me>
          {m.body}
        </span>
      ) : (
        m.body
      ),
      at: m.at,
      kind: m.kind === "system" ? "system" : "message",
      who: m.who || t("app.companyChat.someoneWhoLeft"),
      meta: m.meta,
    }));
    return layoutThread(items, { lastReadAt: lastSeenRef.current });
  }, [room, t]);

  const startDirect = useCallback(
    async (person) => {
      setActionError("");
      try {
        const res = await chatApi.openDirect(person.id);
        setModal(null);
        await loadList();
        setOpenId(res.roomId);
        setPane(PANE_THREAD);
      } catch (err) {
        setActionError(say(err, "app.companyChat.roomLoadError"));
      }
    },
    [loadList, say],
  );

  // ── Render ─────────────────────────────────────────────────────────────
  if (error && !data) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
      </p>
    );
  }

  const readOnly = Boolean(data.me?.readOnly);
  const title = room ? roomName(room) : "";
  const subtitle = room
    ? room.kind === "dm"
      ? t("app.companyChat.directHint")
      : room.kind === "job"
        ? room.active
          ? t("app.companyChat.jobHint")
          : t("app.companyChat.finishedJobHint")
        : t("app.companyChat.generalHint")
    : "";

  const list = (
    <RoomList
      groups={groups}
      selectedId={openId}
      onSelect={selectRoom}
      collapsed={collapsed}
      onToggleGroup={(key) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))}
      ariaLabel={heading}
      header={
        <div className="relative flex items-center gap-2 border-b border-border px-3 py-2">
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{heading}</h1>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setModal("message")}
              data-new-button
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Pencil size={14} aria-hidden="true" /> {t("app.companyChat.newMessage")}
            </button>
          ) : null}
        </div>
      }
      empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("app.companyChat.emptyList")}</p>}
    />
  );

  const thread = !openId ? (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{t("app.companyChat.intro")}</p>
    </div>
  ) : (
    <>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setPane(PANE_LIST)}
          aria-label={t("app.companyChat.back")}
          className="md:hidden -ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            {room?.kind === "job" ? <Briefcase size={13} aria-hidden="true" className="shrink-0 text-muted-foreground" /> : null}
            {room?.kind === "general" ? <Hash size={13} aria-hidden="true" className="shrink-0 text-muted-foreground" /> : null}
            <span className="truncate">{title}</span>
          </h2>
          {room ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {room?.kind === "job" && room.jobId ? (
          <Link
            href={`/app/jobs/${encodeURIComponent(room.jobId)}`}
            className="hidden sm:inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
            data-open-job
          >
            <Briefcase size={14} aria-hidden="true" />
            {t("app.companyChat.openJob")}
          </Link>
        ) : null}
        {room ? (
          <button
            type="button"
            onClick={() => {
              setContext((c) => (c === "members" ? null : "members"));
              setPane(PANE_CONTEXT);
            }}
            aria-pressed={context === "members"}
            data-members-button
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Users size={14} aria-hidden="true" />
            {t("app.companyChat.memberCount", { count: room.memberCount })}
          </button>
        ) : null}
      </header>

      {roomError ? <p className="px-3 py-2 text-sm text-red-700 dark:text-red-300">{roomError}</p> : null}

      <Thread
        rows={rows}
        them={title}
        loading={!room && !roomError}
        initialsFor={(m) => initialsOf(m.who || title)}
        ariaLabel={title}
      />

      {readOnly ? (
        <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground" data-read-only-note>
          {t("app.companyChat.readOnlyNote")}
        </p>
      ) : (
        <div className="relative" onKeyDownCapture={onComposerKeyDownCapture}>
          {mentionOpen ? (
            <MentionPopup members={mentionable} query={token.query} cursor={mentionCursor} onHover={setMentionCursor} onPick={insertMention} />
          ) : null}
          <Composer
            value={text}
            onChange={setText}
            onSend={send}
            busy={sending}
            disabled={!room}
            placeholder={t("app.companyChat.composerPlaceholder", { name: title })}
            maxLength={4000}
            hint={actionError ? <span className="text-red-700 dark:text-red-300">{actionError}</span> : null}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-3" data-company-chat>
      <ChatLayout
        list={list}
        thread={thread}
        pane={pane}
        onCloseContext={() => {
          setContext(null);
          setPane(PANE_THREAD);
        }}
        height={height}
        context={
          context === "members" && openId ? (
            <MembersBar
              roomId={openId}
              onClose={() => {
                setContext(null);
                setPane(PANE_THREAD);
              }}
            />
          ) : null
        }
      />

      {modal === "message" ? (
        <NewMessageModal me={data.me} onClose={() => setModal(null)} onPick={startDirect} />
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The members bar — a list and an explanation, no controls
// ═══════════════════════════════════════════════════════════════════════════

function MembersBar({ roomId, onClose }) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setInfo(null);
    chatApi
      .members(roomId)
      .then((next) => alive && setInfo(next))
      .catch((err) => alive && setError(errorText(tRef.current, err, CHAT_REFUSAL_KEYS)));
    return () => {
      alive = false;
    };
  }, [roomId]);

  const explain = info?.room
    ? info.room.kind === "general"
      ? t("app.companyChat.membersGeneral")
      : info.room.kind === "job"
        ? t("app.companyChat.membersJob")
        : t("app.companyChat.membersDirect")
    : "";

  return (
    <ContextBar
      title={t("app.companyChat.members")}
      subtitle={info ? t("app.companyChat.memberCount", { count: info.members.length }) : null}
      onClose={onClose}
    >
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      {!info && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
        </p>
      ) : null}
      {info ? (
        <>
          <ul className="divide-y divide-border/60" data-members-list>
            {info.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2" data-member={m.id}>
                <Avatar initials={initialsOf(m.name || m.email || "?")} size="sm" tone={m.isYou ? "us" : "them"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <span className="truncate">{m.name || m.email || t("app.companyChat.someoneWhoLeft")}</span>
                    {m.isYou ? <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{t("app.companyChat.you")}</span> : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.departed ? t("app.companyChat.departed") : t(LABEL_KEYS[m.label] || LABEL_KEYS.employee)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground" data-members-explain>
            {explain}
          </p>
          {info.room?.kind === "job" && info.room.jobId ? (
            <Link href={`/app/jobs/${encodeURIComponent(info.room.jobId)}`} className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline">
              <Briefcase size={14} aria-hidden="true" /> {t("app.companyChat.openJob")}
            </Link>
          ) : null}
        </>
      ) : null}
    </ContextBar>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// New message
// ═══════════════════════════════════════════════════════════════════════════

function NewMessageModal({ me, onClose, onPick }) {
  const { t } = useTranslation();
  const dir = useDirectory(true);
  return (
    <Modal title={t("app.companyChat.newMessage")} onClose={onClose}>
      <PeoplePicker people={dir.people} loading={dir.loading} error={dir.error} query={dir.query} onQuery={dir.setQuery} onPick={onPick} excludeId={me?.id || null} />
    </Modal>
  );
}
