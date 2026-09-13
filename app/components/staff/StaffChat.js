"use client";

// app/components/staff/StaffChat.js
//
// FieldQuo's own team chat, drawn once and rendered by both portals.
//
// ══ Why one component for /sales and /platform ════════════════════════════
//
// It is ONE set of conversations. A rep and a platform admin are in the same
// rooms saying things to each other, so two components would be two
// implementations of one screen — and the copy nobody looks at is the one that
// rots. That is the same failure that left /sales/threads drawing a mail log
// while /sales/messages next door drew a proper thread.
//
// ══ Built on the chat kit, not beside it ══════════════════════════════════
//
// app/components/chat is the client: the three-pane layout, the grouped room
// list, the thread with its day and unread dividers, the composer, the
// context bar. This file decides what goes IN them — which rooms, in which
// groups (Rocket.Chat's order: unread on top, then teams, channels, direct
// messages, and public channels the reader is not in), what a system row
// says, who an @ can name — and nothing about how a row is drawn.
//
// The one thing the kit does not have is an @ popup: its `!` popup is canned
// replies for the texting screen, which have no place here. The @ list is
// this screen's own, drawn over the kit's Composer and fed by the room's own
// members — a mention can only name somebody who is in the room, which is
// also what the server parses on write (lib/staff/mentions.js).
//
// ══ Every id the browser sends is re-checked by the server ════════════════
//
// Pick somebody from the directory and the server resolves the pair against
// the live directory again. Create a group and the server validates the name
// and the members. This screen never decides who exists.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Hash, Loader2, Lock, Pencil, Plus, Search, UserPlus, Users, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { errorText } from "@/lib/fetchJson";
import { notify } from "@/lib/notify/browser";
import { staffApi, STAFF_REFUSAL_KEYS } from "@/lib/staff/client";
import { slugify, groupOf, GROUP_ORDER } from "@/lib/staff/channels";
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
const JOINABLE = "joinable";

/** The catalogue key for a person's role label. */
const LABEL_KEYS = {
  superadmin: "app.teamChat.label.superadmin",
  staff: "app.teamChat.label.staff",
  rep: "app.teamChat.label.rep",
};

/** A relative time in the reader's language — "3 min. ago". */
function ago(language, value, now = new Date()) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(s);
  let rtf;
  try {
    rtf = new Intl.RelativeTimeFormat(language || "en", { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  if (abs < 60) return rtf.format(Math.trunc(s), "second");
  if (abs < 3600) return rtf.format(Math.trunc(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.trunc(s / 3600), "hour");
  return rtf.format(Math.trunc(s / 86400), "day");
}

/**
 * What a presence means, and what colour it is.
 *
 * Two sources, kept apart on purpose: a rep's is the floor state they
 * DECLARED (lib/sales/calls/agentState.js); an admin's is when they last had
 * this chat open. The dot is the same shape for both; the words are not.
 */
function presenceOf(p, t, language) {
  if (!p) return { tone: "bg-muted-foreground/40", label: t("app.teamChat.presence.unknown") };
  if (p.source === "chat") {
    if (p.state === "online") return { tone: "bg-emerald-500", label: t("app.teamChat.presence.online") };
    if (p.state === "away") {
      return {
        tone: "bg-amber-500",
        label: t("app.teamChat.presence.chatSeen", { when: ago(language, p.lastSeenAt) }),
      };
    }
    return { tone: "bg-muted-foreground/40", label: t("app.teamChat.presence.never") };
  }
  if (p.state === null || p.state === undefined) {
    return {
      tone: "bg-muted-foreground/40",
      label: p.lastSeenAt
        ? t("app.teamChat.presence.chatSeen", { when: ago(language, p.lastSeenAt) })
        : t("app.teamChat.presence.unknown"),
    };
  }
  if (p.stale) return { tone: "bg-muted-foreground/40 ring-2 ring-amber-400", label: t("app.teamChat.presence.stale") };
  const map = {
    available: ["bg-emerald-500", "app.teamChat.presence.available"],
    on_call: ["bg-red-500", "app.teamChat.presence.onCall"],
    after_call: ["bg-amber-500", "app.teamChat.presence.afterCall"],
    paused: ["bg-amber-500", "app.teamChat.presence.paused"],
    offline: ["bg-muted-foreground/40", "app.teamChat.presence.offline"],
  };
  const [tone, key] = map[p.state] || map.offline;
  return { tone, label: t(key) };
}

function PresenceDot({ presence, className = "" }) {
  const { t, language } = useTranslation();
  const { tone, label } = presenceOf(presence, t, language);
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone} ${className}`}
      title={label}
      aria-label={label}
      role="img"
    />
  );
}

/** "Sales rep · freelancer" — the second line under a name in a picker. */
function personMeta(p, t) {
  const parts = [t(LABEL_KEYS[p.label] || LABEL_KEYS.staff)];
  if (p.engagement === "freelancer" || p.engagement === "employee") {
    parts.push(t(`app.teamChat.engagement.${p.engagement}`));
  }
  return parts.join(" · ");
}

/**
 * The directory, searchable, single- or multi-select. Used by New message,
 * New group and Add people so the three cannot drift.
 */
function PeoplePicker({ people, loading, error, query, onQuery, selected = null, onToggle, onPick, exclude = [] }) {
  const { t, language } = useTranslation();
  const excluded = new Set(exclude.map((p) => `${p.kind}:${p.id}`));
  const rows = (people || []).filter((p) => !excluded.has(`${p.kind}:${p.id}`));
  const multi = Boolean(selected);
  return (
    <div className="space-y-2" data-people-picker>
      <label className="relative block">
        <span className="sr-only">{t("app.teamChat.searchPeople")}</span>
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("app.teamChat.searchPeople")}
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </label>
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border" role="listbox" aria-multiselectable={multi}>
        {loading && !people ? (
          <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
          </li>
        ) : rows.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {query ? t("app.teamChat.noPeople") : t("app.teamChat.directoryEmpty")}
          </li>
        ) : (
          rows.map((p) => {
            const key = `${p.kind}:${p.id}`;
            const isSelected = multi ? selected.has(key) : false;
            const pr = presenceOf(p.presence, t, language);
            return (
              <li key={key} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={multi ? isSelected : undefined}
                  data-person={key}
                  data-person-kind={p.kind}
                  onClick={() => (multi ? onToggle(p) : onPick(p))}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left min-h-[48px] ${isSelected ? "bg-muted" : "hover:bg-muted/60"}`}
                >
                  {multi ? (
                    <span
                      aria-hidden="true"
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  ) : null}
                  <span className="relative shrink-0">
                    <Avatar initials={initialsOf(p.name)} size="sm" />
                    <PresenceDot presence={p.presence} className="absolute -bottom-0.5 -right-0.5 border border-card" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {personMeta(p, t)}
                      {p.email && p.email !== p.name ? ` · ${p.email}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{pr.label}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/** A modal frame. The kit has none; this screen needs two. */
function Modal({ title, onClose, children, wide = false }) {
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
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-card shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-xl" : "sm:max-w-md"}`}
        data-staff-modal
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
    if (!open) return;
    let alive = true;
    setLoading(true);
    staffApi
      .directory()
      .then((d) => alive && setPeople(d.people || []))
      .catch((err) => alive && setError(errorText(tRef.current, err, STAFF_REFUSAL_KEYS)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!people) return people;
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q));
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
  const rows = members.filter((m) => !q || m.name.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)).slice(0, 8);
  return (
    <div
      role="listbox"
      aria-label={t("app.teamChat.mentionTitle")}
      data-mention-popup
      className="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>@ {t("app.teamChat.mentionTitle")}</span>
        <span className="normal-case tracking-normal font-normal">{t("app.teamChat.mentionKeys")}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{t("app.teamChat.mentionEmpty")}</p>
      ) : (
        rows.map((m, i) => (
          <button
            key={`${m.kind}:${m.id}`}
            type="button"
            role="option"
            aria-selected={i === cursor}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(m)}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i === cursor ? "bg-muted" : "hover:bg-muted/60"}`}
          >
            <Avatar initials={initialsOf(m.name)} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{t(LABEL_KEYS[m.kind === "rep" ? "rep" : "staff"])}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

/** The mention handle inserted for a person: the name, or an admin's local part. */
function handleFor(m) {
  if (m.kind === "user" && m.email) return m.email.split("@")[0];
  return m.name;
}

// ═══════════════════════════════════════════════════════════════════════════

export default function StaffChat({ heading = "Team" }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pane, setPane] = useState(PANE_LIST);
  const [context, setContext] = useState(null); // "members" | null
  const [modal, setModal] = useState(null); // "message" | "group" | null
  const [collapsed, setCollapsed] = useState([JOINABLE]);
  const [newMenu, setNewMenu] = useState(false);
  const [actionError, setActionError] = useState("");
  const lastSeenRef = useRef(null);

  // Through a ref, so the loaders below do not re-create on every render
  // and re-fire the effects that call them. A translator that changed
  // identity per render once made the list reload in a loop under the
  // harness; the loaders must depend on nothing that can.
  const tRef = useRef(t);
  tRef.current = t;
  const say = useCallback((err, fallbackKey) => errorText(tRef.current, err, STAFF_REFUSAL_KEYS) || tRef.current(fallbackKey), []);

  // ── The in-tab half of browser notifications: @mentions ────────────────
  //
  // A room whose `mentions` count ROSE since the last list read means
  // somebody said this person's name. Told through notify() — a toast while
  // this tab is focused, a system notification when the chat is in a
  // background tab (lib/notify/browser.js). Only from the second read on,
  // so opening the screen does not replay the backlog; the badge on the
  // row is that. Same tag as the server's push for the room, so a person
  // with both sees each mention once.
  const mentionsSeen = useRef(null);
  const announceMentions = useCallback((next) => {
    const rooms = Array.isArray(next?.rooms) ? next.rooms : [];
    const prev = mentionsSeen.current;
    const now = new Map(rooms.map((r) => [r.id, Number(r.mentions) || 0]));
    if (prev) {
      for (const r of rooms) {
        const before = prev.get(r.id) || 0;
        const after = now.get(r.id) || 0;
        if (after > before) {
          const roomName = r.kind === "direct" ? r.title : `#${r.slug || r.title}`;
          notify({
            title: tRef.current("app.notify.mention.title", { name: r.lastWho || r.title, room: roomName }),
            body: r.lastBody || "",
            tag: `staff-mention:${r.id}`,
            // The chat screen itself: the row's @ badge is where to click.
            url: window.location.pathname,
          });
        }
      }
    }
    mentionsSeen.current = now;
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    try {
      const next = await staffApi.list();
      announceMentions(next);
      setData(next);
      setError("");
    } catch (err) {
      // Named, not swallowed: an empty screen and a broken screen look
      // identical and mean opposite things.
      setError(say(err, "app.teamChat.loadError"));
    }
  }, [say]);

  const loadRoom = useCallback(
    async (id, { keepSeen = false } = {}) => {
      try {
        const next = await staffApi.room(id);
        // The unread line is drawn against where they had read up to when
        // they OPENED the room, not against the last poll — a poll while
        // they are reading must not make the line jump under them.
        if (!keepSeen) lastSeenRef.current = next.lastSeenAt || null;
        setRoom(next);
        setRoomError("");
      } catch (err) {
        setRoomError(say(err, "app.teamChat.roomLoadError"));
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
  const teamTopic = useCallback(
    (row) => (row.teamKey ? t(`app.teamChat.team.${row.teamKey}.topic`, row.topic || "") : row.topic || ""),
    [t],
  );

  const groups = useMemo(() => {
    if (!data) return [];
    const buckets = { unread: [], team: [], channel: [], direct: [] };
    for (const r of data.rooms || []) {
      const g = groupOf(r, { unreadOnTop: true });
      if (!buckets[g]) continue;
      const preview = r.lastBody
        ? `${r.lastWasMine ? t("app.teamChat.youPrefix") : r.lastWho ? `${r.lastWho}:` : ""} ${r.lastBody}`.trim()
        : r.kind === "direct"
          ? t("app.teamChat.noMessages")
          : teamTopic(r) || t("app.teamChat.noMessages");
      buckets[g].push({
        id: r.id,
        raw: r,
        title:
          r.kind === "direct" ? (
            <span className="inline-flex items-center gap-1.5">
              <PresenceDot presence={r.presence || null} />
              {r.title}
            </span>
          ) : (
            `#${r.slug || r.title}`
          ),
        subtitle: preview,
        time: r.lastAt,
        unread: r.unread,
        initials: r.kind === "direct" ? initialsOf(r.title) : "#",
        tone: r.kind === "direct" ? "them" : "muted",
        channel: r.teamKey ? "team" : null,
        channelLabel: r.teamKey ? t("app.teamChat.group.team") : "",
        badges:
          r.mentions > 0 ? (
            <span
              className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums"
              data-mention-badge
            >
              <span aria-hidden="true">@{r.mentions}</span>
              <span className="sr-only">{t("app.teamChat.mentionCountSr", { count: r.mentions })}</span>
            </span>
          ) : null,
      });
    }
    const out = GROUP_ORDER.filter((k) => buckets[k].length).map((k) => ({
      key: k,
      title: t(`app.teamChat.group.${k}`),
      rooms: buckets[k],
    }));
    const joinable = (data.joinable || []).map((r) => ({
      id: r.id,
      raw: r,
      joinable: true,
      title: `#${r.slug || r.title}`,
      subtitle: teamTopic(r) || t("app.teamChat.memberCount", { count: r.memberCount }),
      time: null,
      unread: 0,
      initials: "#",
      tone: "muted",
      channel: r.teamKey ? "team" : null,
      channelLabel: r.teamKey ? t("app.teamChat.group.team") : "",
      badges: <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-semibold text-foreground">{t("app.teamChat.join")}</span>,
    }));
    if (joinable.length) out.push({ key: JOINABLE, title: t("app.teamChat.group.joinable"), rooms: joinable });
    return out;
  }, [data, t, teamTopic]);

  const selectRoom = useCallback(
    async (row) => {
      setActionError("");
      if (row.joinable) {
        try {
          const res = await staffApi.join(row.id);
          await loadList();
          setOpenId(res.roomId);
        } catch (err) {
          setActionError(say(err, "app.teamChat.roomLoadError"));
          return;
        }
      } else {
        setOpenId(row.id);
      }
      setPane(PANE_THREAD);
    },
    [loadList, say],
  );

  // ── Sending ────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || !openId || sending) return;
    setSending(true);
    setActionError("");
    try {
      await staffApi.send(openId, body);
      setText("");
      lastSeenRef.current = new Date().toISOString();
      await loadRoom(openId, { keepSeen: true });
      // The list re-reads too, so the preview and the ordering move with the
      // message rather than on some later refresh.
      loadList();
    } catch (err) {
      setActionError(say(err, "app.teamChat.refusal.notSent"));
    } finally {
      setSending(false);
    }
  }, [text, openId, sending, loadRoom, loadList, say]);

  // ── @ popup ────────────────────────────────────────────────────────────
  const token = useMemo(() => mentionTokenAt(text), [text]);
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(null);
  const mentionable = useMemo(
    () => (room?.members || []).filter((m) => !(m.kind === data?.me?.kind && m.id === data?.me?.id)),
    [room, data],
  );
  const mentionOpen = Boolean(token) && room?.kind !== "direct" && mentionDismissed !== token?.start;
  const mentionRows = useMemo(() => {
    if (!mentionOpen) return [];
    const q = token.query.toLowerCase();
    return mentionable.filter((m) => !q || m.name.toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)).slice(0, 8);
  }, [mentionOpen, token, mentionable]);
  useEffect(() => setMentionCursor(0), [token?.query]);

  const insertMention = useCallback(
    (m) => {
      if (!token) return;
      setText(`${text.slice(0, token.start)}@${handleFor(m)} `);
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
      // A message that says the reader's name is tinted, the way Rocket.Chat
      // tints a mention row. The kit draws whatever node `body` is.
      body: m.mentionsMe ? (
        <span className="-mx-1 block rounded bg-amber-100 px-1 dark:bg-amber-950/40" data-mentions-me>
          {m.body}
        </span>
      ) : (
        m.body
      ),
      at: m.at,
      kind: m.kind === "system" ? "system" : "message",
      who: m.who,
      meta: m.meta,
    }));
    return layoutThread(items, { lastReadAt: lastSeenRef.current });
  }, [room]);

  const renderSystem = useCallback(
    (item) => {
      const meta = item.meta || {};
      const names = Array.isArray(meta.names) ? meta.names.join(", ") : "";
      const values = { who: item.who, names, to: meta.to || "", from: meta.from || "" };
      const key = meta.system ? `app.teamChat.system.${meta.system}` : null;
      return key ? t(key, item.body, values) : item.body;
    },
    [t],
  );

  // ── Actions on the open room ───────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    await loadList();
    if (openId) await loadRoom(openId, { keepSeen: true });
  }, [loadList, loadRoom, openId]);

  const startDirect = useCallback(
    async (person) => {
      setActionError("");
      try {
        const res = await staffApi.openDirect(person);
        setModal(null);
        await loadList();
        setOpenId(res.roomId);
        setPane(PANE_THREAD);
      } catch (err) {
        setActionError(say(err, "app.teamChat.roomLoadError"));
      }
    },
    [loadList, say],
  );

  // Throws on refusal so the members bar, where the button is, can say why.
  const leave = useCallback(async () => {
    if (!openId) return;
    await staffApi.leave(openId);
    setOpenId(null);
    setRoom(null);
    setContext(null);
    setPane(PANE_LIST);
    await loadList();
  }, [openId, loadList]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (error && !data) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
      </p>
    );
  }

  const title = room ? (room.kind === "direct" ? room.title : `#${room.slug || room.title}`) : "";
  const subtitle = room
    ? room.kind === "direct"
      ? t("app.teamChat.directHint")
      : teamTopic(room) || (room.private ? t("app.teamChat.privateHint") : t("app.teamChat.noTopic"))
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
          <button
            type="button"
            onClick={() => setNewMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={newMenu}
            data-new-button
            className="inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Plus size={14} aria-hidden="true" /> {t("app.teamChat.new")}
          </button>
          {newMenu ? (
            <div role="menu" className="absolute right-3 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg" data-new-menu>
              <button type="button" role="menuitem" onClick={() => { setNewMenu(false); setModal("message"); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
                <Pencil size={14} aria-hidden="true" /> {t("app.teamChat.newMessage")}
              </button>
              <button type="button" role="menuitem" onClick={() => { setNewMenu(false); setModal("group"); }} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
                <Users size={14} aria-hidden="true" /> {t("app.teamChat.newGroup")}
              </button>
            </div>
          ) : null}
        </div>
      }
      empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("app.teamChat.emptyList")}</p>}
    />
  );

  const thread = !openId ? (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{t("app.teamChat.intro")}</p>
    </div>
  ) : (
    <>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={() => setPane(PANE_LIST)}
          aria-label={t("app.teamChat.back")}
          className="md:hidden -ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            {room?.kind === "direct" ? null : room?.private ? <Lock size={13} aria-hidden="true" className="shrink-0 text-muted-foreground" /> : null}
            {room?.kind === "direct" && room?.members ? (
              <PresenceDot presence={(room.members.find((m) => !(m.kind === data.me?.kind && m.id === data.me?.id)) || {}).presence || null} />
            ) : null}
            <span className="truncate">{title}</span>
          </h2>
          {room ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {room ? (
          <button
            type="button"
            onClick={() => {
              setContext((c) => (c === "members" ? null : "members"));
              setPane(PANE_CONTEXT);
            }}
            aria-pressed={context === "members"}
            data-members-button
            className="inline-flex min-h-[44px] lg:min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Users size={14} aria-hidden="true" />
            {t("app.teamChat.memberCount", { count: room.memberCount })}
          </button>
        ) : null}
      </header>

      {roomError ? <p className="px-3 py-2 text-sm text-red-700 dark:text-red-300">{roomError}</p> : null}

      <Thread
        rows={rows}
        them={room?.title || ""}
        loading={!room && !roomError}
        renderSystem={renderSystem}
        initialsFor={(m) => initialsOf(m.who || room?.title)}
        ariaLabel={title}
      />

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
          placeholder={t("app.teamChat.composerPlaceholder", { name: title })}
          maxLength={4000}
          hint={actionError ? <span className="text-red-700 dark:text-red-300">{actionError}</span> : null}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-3" data-staff-chat>
      <ChatLayout
        list={list}
        thread={thread}
        pane={pane}
        onCloseContext={() => {
          setContext(null);
          setPane(PANE_THREAD);
        }}
        height="h-[calc(100vh-9rem)]"
        context={
          context === "members" && openId ? (
            <MembersBar
              roomId={openId}
              me={data.me}
              onClose={() => {
                setContext(null);
                setPane(PANE_THREAD);
              }}
              onChanged={refreshAll}
              onLeave={leave}
            />
          ) : null
        }
      />

      {modal === "message" ? (
        <NewMessageModal me={data.me} onClose={() => setModal(null)} onPick={startDirect} />
      ) : null}
      {modal === "group" ? (
        <NewGroupModal
          me={data.me}
          onClose={() => setModal(null)}
          onCreated={async (roomId) => {
            setModal(null);
            await loadList();
            setOpenId(roomId);
            setPane(PANE_THREAD);
          }}
        />
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The members bar
// ═══════════════════════════════════════════════════════════════════════════

function MembersBar({ roomId, me, onClose, onChanged, onLeave }) {
  const { t, language } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const dir = useDirectory(adding);

  const load = useCallback(async () => {
    try {
      const next = await staffApi.members(roomId);
      setInfo(next);
      setName(next.room?.name || "");
      setTopic(next.room?.topic || "");
      setError("");
    } catch (err) {
      setError(errorText(tRef.current, err, STAFF_REFUSAL_KEYS));
    }
  }, [roomId]);

  useEffect(() => {
    setInfo(null);
    setAdding(false);
    setEditing(false);
    setSelected(new Set());
    load();
  }, [load]);

  const remove = async (m) => {
    setBusy(true);
    try {
      await staffApi.removeMember(roomId, m);
      await load();
      onChanged();
    } catch (err) {
      setError(errorText(t, err, STAFF_REFUSAL_KEYS));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const members = [...selected].map((k) => {
        const [kind, id] = k.split(":");
        return { kind, id };
      });
      await staffApi.addMembers(roomId, members);
      setSelected(new Set());
      setAdding(false);
      await load();
      onChanged();
    } catch (err) {
      setError(errorText(t, err, STAFF_REFUSAL_KEYS));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await staffApi.update(roomId, { name: info.room?.teamKey ? undefined : name, topic });
      setEditing(false);
      await load();
      onChanged();
    } catch (err) {
      setError(errorText(t, err, STAFF_REFUSAL_KEYS));
    } finally {
      setBusy(false);
    }
  };

  const roomTitle = info?.room ? (info.room.kind === "direct" ? t("app.teamChat.members") : `#${info.room.slug || info.room.name}`) : t("app.teamChat.members");

  return (
    <ContextBar
      title={t("app.teamChat.members")}
      subtitle={info ? `${roomTitle} · ${t("app.teamChat.memberCount", { count: info.members.length })}` : null}
      onClose={onClose}
      actions={
        info?.canManage && info.room?.kind !== "direct" ? (
          <button type="button" onClick={() => setEditing((v) => !v)} aria-label={t("app.teamChat.edit")} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <Pencil size={15} aria-hidden="true" />
          </button>
        ) : null
      }
    >
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      {!info && !error ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
        </p>
      ) : null}

      {info && editing ? (
        <form
          className="mb-3 space-y-2 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          data-room-edit
        >
          {!info.room?.teamKey ? (
            <label className="block text-sm">
              <span className="text-xs font-medium text-muted-foreground">{t("app.teamChat.groupName")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground" />
              {name.trim() ? <span className="mt-1 block text-xs text-muted-foreground">{t("app.teamChat.groupSlugHint", { slug: slugify(name) })}</span> : null}
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-xs font-medium text-muted-foreground">{t("app.teamChat.groupTopic")}</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder={t("app.teamChat.groupTopicPlaceholder")} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="min-h-[44px] lg:min-h-[36px] rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">{t("app.teamChat.cancel")}</button>
            <button type="submit" disabled={busy} className="min-h-[44px] lg:min-h-[36px] rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("app.teamChat.save")}</button>
          </div>
        </form>
      ) : null}

      {info ? (
        <ul className="divide-y divide-border/60" data-members-list>
          {info.members.map((m) => {
            const pr = presenceOf(m.presence, t, language);
            return (
              <li key={`${m.kind}:${m.id}`} className="flex items-center gap-3 py-2" data-member={`${m.kind}:${m.id}`}>
                <span className="relative shrink-0">
                  <Avatar initials={initialsOf(m.name)} size="sm" tone={m.isYou ? "us" : "them"} />
                  <PresenceDot presence={m.presence} className="absolute -bottom-0.5 -right-0.5 border border-card" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <span className="truncate">{m.name}</span>
                    {m.isYou ? <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{t("app.teamChat.you")}</span> : null}
                    {m.isOwner ? <span className="shrink-0 rounded bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">{t("app.teamChat.owner")}</span> : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.departed ? t("app.teamChat.departed") : `${personMeta(m, t)} · ${pr.label}`}
                  </span>
                </span>
                {m.canRemove ? (
                  <button type="button" disabled={busy} onClick={() => remove(m)} className="shrink-0 min-h-[44px] lg:min-h-[36px] rounded-lg px-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
                    {t("app.teamChat.remove")}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {info?.canAdd ? (
        <div className="mt-3 space-y-2" data-add-people>
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted">
              <UserPlus size={14} aria-hidden="true" /> {t("app.teamChat.addPeople")}
            </button>
          ) : (
            <>
              <PeoplePicker
                people={dir.people}
                loading={dir.loading}
                error={dir.error}
                query={dir.query}
                onQuery={dir.setQuery}
                selected={selected}
                onToggle={(p) =>
                  setSelected((s) => {
                    const next = new Set(s);
                    const k = `${p.kind}:${p.id}`;
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                exclude={[...(info.members || []), me].filter(Boolean)}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t("app.teamChat.groupSelected", { count: selected.size })}</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => { setAdding(false); setSelected(new Set()); }} className="min-h-[44px] lg:min-h-[36px] rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">{t("app.teamChat.cancel")}</button>
                  <button type="button" disabled={busy || !selected.size} onClick={add} className="min-h-[44px] lg:min-h-[36px] rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{t("app.teamChat.add")}</button>
                </span>
              </div>
            </>
          )}
        </div>
      ) : null}

      {info ? (
        <div className="mt-4 border-t border-border pt-3">
          {info.canLeave ? (
            <button type="button" disabled={busy} onClick={() => onLeave().catch((err) => setError(errorText(t, err, STAFF_REFUSAL_KEYS)))} data-leave-button className="min-h-[40px] w-full rounded-lg border border-border px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
              {t("app.teamChat.leave")}
            </button>
          ) : info.room?.isDefault ? (
            <p className="text-xs text-muted-foreground">{t("app.teamChat.refusal.defaultRoom")}</p>
          ) : null}
        </div>
      ) : null}
    </ContextBar>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// New message · New group
// ═══════════════════════════════════════════════════════════════════════════

function NewMessageModal({ me, onClose, onPick }) {
  const { t } = useTranslation();
  const dir = useDirectory(true);
  return (
    <Modal title={t("app.teamChat.newMessage")} onClose={onClose}>
      <PeoplePicker people={dir.people} loading={dir.loading} error={dir.error} query={dir.query} onQuery={dir.setQuery} onPick={onPick} exclude={me ? [me] : []} />
    </Modal>
  );
}

function NewGroupModal({ me, onClose, onCreated }) {
  const { t } = useTranslation();
  const dir = useDirectory(true);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const slug = slugify(name);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const members = [...selected].map((k) => {
        const [kind, id] = k.split(":");
        return { kind, id };
      });
      const res = await staffApi.createChannel({ name, topic, isPrivate, members });
      await onCreated(res.roomId);
    } catch (err) {
      setError(errorText(t, err, STAFF_REFUSAL_KEYS));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("app.teamChat.newGroup")} onClose={onClose} wide>
      <form onSubmit={create} className="space-y-4" data-new-group-form>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.teamChat.groupName")}</span>
          <span className="relative mt-1 block">
            <Hash size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              autoFocus
              placeholder={t("app.teamChat.groupNamePlaceholder")}
              className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </span>
          {slug ? <span className="mt-1 block text-xs text-muted-foreground">{t("app.teamChat.groupSlugHint", { slug })}</span> : null}
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{t("app.teamChat.groupTopic")}</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={200}
            placeholder={t("app.teamChat.groupTopicPlaceholder")}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Lock size={13} aria-hidden="true" /> {t("app.teamChat.groupPrivate")}
            </span>
            <span className="block text-xs text-muted-foreground">{t("app.teamChat.groupPrivateHelp")}</span>
          </span>
        </label>
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            {t("app.teamChat.groupMembers")} · {t("app.teamChat.groupSelected", { count: selected.size })}
          </span>
          <div className="mt-1">
            <PeoplePicker
              people={dir.people}
              loading={dir.loading}
              error={dir.error}
              query={dir.query}
              onQuery={dir.setQuery}
              selected={selected}
              onToggle={(p) =>
                setSelected((s) => {
                  const next = new Set(s);
                  const k = `${p.kind}:${p.id}`;
                  if (next.has(k)) next.delete(k);
                  else next.add(k);
                  return next;
                })
              }
              exclude={me ? [me] : []}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-[40px] rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted">{t("app.teamChat.cancel")}</button>
          <button type="submit" disabled={busy || !slug} data-create-group className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Users size={14} aria-hidden="true" />}
            {busy ? t("app.teamChat.creating") : t("app.teamChat.createGroup")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
