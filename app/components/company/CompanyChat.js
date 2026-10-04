"use client";

// app/components/company/CompanyChat.js
//
// A contractor company's own crew chat, on the shared chat kit.
//
// ══ What it is ════════════════════════════════════════════════════════════
//
// Five kinds of room (lib/company/chat/rules.js):
//
//   #general   everybody on the roster — derived, nobody leaves it
//   job rooms  the crew booked on a job's visits and the office — derived
//              from the schedule, kept in step on every job and visit write
//   DMs        two people
//   channels   places the OFFICE makes (#estimating, #crew-north,
//              #announcements): public or private, optionally office-only
//              posting, optionally everyone included
//   groups     conversations ANYBODY starts from New message by picking two
//              or more people; no maximum size
//
// Until 2026-10-04 this file said "nobody makes a group, nobody adds or
// removes anybody, because a hand-kept list drifts from the schedule". That
// stays true of #general and job rooms, which are still derived. The owner
// reversed it for everything else: channels and groups are hand-made and
// hand-kept, every change is a system line in the room and a row in the
// activity log, and the server decides every one of them again.
//
// It is NOT app/components/staff/StaffChat.js with the names changed. That
// component is FieldQuo's own staff talking to each other across two portals
// and two identity tables; this is one company talking to itself. What the
// two share — the layout, the list, the thread, the composer, the day and
// unread dividers, the channel-name rule — they share by rendering the same
// kit and importing the same helper. What they do not share (who is in a
// room, what an @ can name, what a system row says) is decided here.
//
// ══ Every id the browser sends is re-checked by the server ════════════════
//
// Pick somebody and the server resolves the id against the caller's own
// company roster again. Open a room and the server checks the caller's
// company AND their membership — a private channel is a 404 to anybody not
// in it. `room.can` (the server's answer for THIS viewer) decides which
// controls are DRAWN; it is never what decides whether a write happens.
//
// ══ Read-only support sessions ════════════════════════════════════════════
//
// A platform admin looking at a customer's account sees every room; the
// composer is replaced by one sentence saying why they cannot post, and no
// create / join / settings control is drawn. The server refuses the write
// anyway (twice — the method gate and the store).
//
// ══ Refresh ═══════════════════════════════════════════════════════════════
//
// No new vendor (plan §7): the open room is read every 4 seconds as a DELTA
// (?after= the last message on screen — a quiet room's poll is an empty
// list), backing off to 15 seconds after two minutes with nothing new and
// nothing typed; the list every 15 seconds; both at once when the tab comes
// back. Push carries the out-of-tab half.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BellOff, Briefcase, Hash, Loader2, Pencil, Plus, Search, Settings, Star, Users } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { usesCrewShell } from "@/lib/nav/crewShell";
import { notify } from "@/lib/notify/browser";
import { chatApi } from "@/lib/company/chat/client";
import { groupOf, groupOrderFor, mayMentionEveryone, FOLDED_GROUPS } from "@/lib/company/chat/rules";
import { mentionsEveryone } from "@/lib/staff/mentions";
import { layoutThread } from "@/lib/chat/threadLayout";
import { announceBadgesChanged } from "@/lib/chat/badges";
import {
  ChatLayout,
  PANE_LIST,
  PANE_THREAD,
  PANE_CONTEXT,
  RoomList,
  Thread,
  Composer,
  Avatar,
  initialsOf,
} from "@/app/components/chat";
import { personLine, useSay } from "./chat/parts";
import { NewMessageModal, NewChannelModal, BrowseChannelsModal, AddPeopleModal, SeenByModal, ChannelGlyph } from "./chat/ChatDialogs";
import RoomSettings from "./chat/RoomSettings";

const LIST_POLL_MS = 15000;
const ROOM_POLL_FAST_MS = 4000;
const ROOM_POLL_SLOW_MS = 15000;
/** Two minutes with nothing new and nothing typed → the slow poll. */
const ROOM_IDLE_MS = 2 * 60 * 1000;
/** A delta this long means the room moved faster than the poll: re-read it whole. */
const DELTA_LIMIT = 500;

/** A room's printed name: "#general" translated, "#estimating", a job's title, a person, a group. */
function useRoomName() {
  const { t } = useTranslation();
  return useCallback(
    (room) => {
      if (!room) return "";
      if (room.kind === "general") return `#${t("app.companyChat.general")}`;
      if (room.kind === "channel") return `#${room.title || ""}`;
      if (room.kind === "job") return room.title || t("app.companyChat.untitledJob");
      if (room.kind === "group") {
        if (room.titleMissing || !room.title) return t("app.companyChat.untitledGroup");
        return room.titleExtra > 0 ? `${room.title} ${t("app.companyChat.groupMore", { count: room.titleExtra })}` : room.title;
      }
      return room.titleMissing || !room.title ? t("app.companyChat.someoneWhoLeft") : room.title;
    },
    [t],
  );
}

/** The words a system line says, from its meta, in the reader's language. */
function useSystemLine() {
  const { t } = useTranslation();
  return useCallback(
    (m) => {
      const meta = m?.meta || null;
      const who = m?.who || t("app.companyChat.someoneWhoLeft");
      if (!meta || typeof meta.system !== "string") return m?.body || "";
      const names = Array.isArray(meta.names) ? meta.names.filter(Boolean).join(", ") : "";
      switch (meta.system) {
        case "created":
          return t("app.companyChat.system.created", { name: who, channel: meta.name || "" });
        case "created_group":
          return t("app.companyChat.system.createdGroup", { name: who });
        case "joined":
          return t("app.companyChat.system.joined", { name: who });
        case "left":
          return t("app.companyChat.system.left", { name: who });
        case "added":
          return meta.more > 0
            ? t("app.companyChat.system.addedMore", { name: who, names, count: meta.more })
            : t("app.companyChat.system.added", { name: who, names });
        case "removed":
          return t("app.companyChat.system.removed", { name: who, names });
        case "renamed":
          return meta.to
            ? t("app.companyChat.system.renamed", { name: who, to: meta.channel ? `#${meta.to}` : meta.to })
            : t("app.companyChat.system.unnamed", { name: who });
        case "topic":
          return meta.to ? t("app.companyChat.system.topic", { name: who, to: meta.to }) : t("app.companyChat.system.topicCleared", { name: who });
        case "policy":
          return meta.to === "office" ? t("app.companyChat.system.policyOffice", { name: who }) : t("app.companyChat.system.policyEveryone", { name: who });
        case "visibility":
          return meta.to === "private" ? t("app.companyChat.system.visibilityPrivate", { name: who }) : t("app.companyChat.system.visibilityPublic", { name: who });
        case "autojoin":
          return meta.to ? t("app.companyChat.system.autojoinOn", { name: who }) : t("app.companyChat.system.autojoinOff", { name: who });
        case "archived":
          return t("app.companyChat.system.archived", { name: who });
        case "unarchived":
          return t("app.companyChat.system.unarchived", { name: who });
        default:
          return m?.body || "";
      }
    },
    [t],
  );
}

// ── The mention popup over the composer ────────────────────────────────────

/** The "@que" being typed at the END of the text, or null. */
function mentionTokenAt(text) {
  const m = /(^|\s)@([^\s@]*)$/.exec(String(text || ""));
  return m ? { start: text.length - m[2].length - 1, query: m[2] } : null;
}

function MentionPopup({ rows, loading, cursor, onHover, onPick }) {
  const { t } = useTranslation();
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
        <p className="px-3 py-3 text-sm text-muted-foreground">{loading ? t("app.chat.loading") : t("app.companyChat.mentionEmpty")}</p>
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
              <span className="block truncate text-xs text-muted-foreground">{personLine(t, m)}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

/** Merge a delta read into the thread on screen: new messages appended once each, the room's columns replaced. */
function mergeDelta(prev, next) {
  if (!prev || prev.id !== next.id) return next;
  const have = new Set((prev.messages || []).map((m) => m.id));
  const added = (next.messages || []).filter((m) => !have.has(m.id));
  return {
    ...prev,
    ...next,
    members: prev.members,
    membersTruncated: prev.membersTruncated,
    messages: added.length ? [...prev.messages, ...added] : prev.messages,
  };
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param heading   the list's title
 * @param initialRoomId  a room to open on first paint (from ?room=, the
 *                  URL a push notification lands on)
 * @param initialWithId  a MEMBER to open the direct room with on arrival
 *                  (from ?with=, the "Message {name}" button on
 *                  /app/me/team). Opened through the same openDirect the
 *                  New message picker uses, so who may message whom stays
 *                  the server's one rule, re-checked against the roster.
 * @param initialMessageId  a MESSAGE to open the chat at (from ?message=,
 *                  the bell's "Ana mentioned you" row). The server says
 *                  which room it is in, and only if the reader can still
 *                  read that room.
 * @param height    the frame's height class — the page knows what chrome
 *                  sits above it; this component does not
 */
export default function CompanyChat({ heading = "Chat", initialRoomId = null, initialWithId = null, initialMessageId = null, height = "h-[calc(100vh-9rem)]" }) {
  const { t } = useTranslation();
  const roomName = useRoomName();
  const systemLine = useSystemLine();
  const say = useSay();
  const caller = usePermissions();
  const flags = useFeatureFlags();
  // The crew's big rows (lib/nav/crewShell.js: exactly the people who get
  // the crew bar on a phone).
  const large = usesCrewShell(caller, flags);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(initialRoomId || null);
  const [room, setRoom] = useState(null);
  const [roomError, setRoomError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pane, setPane] = useState(initialRoomId ? PANE_THREAD : PANE_LIST);
  const [context, setContext] = useState(null); // "settings" | null
  const [modal, setModal] = useState(null); // "message" | "channel" | "browse" | "add" | { seen: messageId } | null
  const [collapsed, setCollapsed] = useState([...FOLDED_GROUPS]);
  const [actionError, setActionError] = useState("");
  const [peopleKey, setPeopleKey] = useState(0);
  const [focusMessageId, setFocusMessageId] = useState(null);
  const lastSeenRef = useRef(null);
  const roomRef = useRef(null);
  roomRef.current = room;
  const lastActivity = useRef(Date.now());

  const roomNameRef = useRef(roomName);
  roomNameRef.current = roomName;
  const tRef = useRef(t);
  tRef.current = t;

  // ── The in-tab half of notifications ──────────────────────────────────
  //
  // A room whose `unread` ROSE since the last list read, in a room the
  // reader hears every message of (a DM, a group, or anything set to "every
  // message") and has not muted — told through notify(): a toast while
  // this tab is focused, a system notification when the chat is in a
  // background tab (lib/notify/browser.js). Same tag as the server's push
  // for the room, so a person with both sees each event once.
  //
  // MENTIONS are not toasted here any more: since 2026-10-04 a mention is
  // a row in the notification bell (lib/notifications catalog
  // "chat.mention"), and the bell announces its own new rows in-tab
  // (app/components/layout/NotificationBell.js). Toasting it here too would
  // be the double ping.
  const seen = useRef(null);
  const announce = useCallback((next) => {
    const rooms = Array.isArray(next?.rooms) ? next.rooms : [];
    const prev = seen.current;
    const now = new Map(rooms.map((r) => [r.id, Number(r.unread) || 0]));
    if (prev) {
      for (const r of rooms) {
        if (r.muted || r.notifyLevel !== "all") continue;
        if ((now.get(r.id) || 0) <= (prev.get(r.id) || 0)) continue;
        const name = roomNameRef.current(r);
        notify({
          title:
            r.kind === "dm"
              ? tRef.current("app.notify.newMessage.title", { name })
              : tRef.current("app.notify.roomMessage.title", { name: r.lastWho || name, room: name }),
          body: r.lastBody || "",
          tag: `company-chat:${r.id}`,
          url: `/app/chat?room=${encodeURIComponent(r.id)}`,
        });
      }
    }
    seen.current = now;
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────
  const loadList = useCallback(
    async ({ sync = false } = {}) => {
      try {
        const next = await chatApi.list({ sync });
        announce(next);
        setData(next);
        setError("");
      } catch (err) {
        // Named, not swallowed: an empty screen and a broken screen look
        // identical and mean opposite things.
        setError(say(err, "app.companyChat.loadError"));
      }
    },
    [announce, say],
  );

  const loadRoom = useCallback(
    async (id) => {
      try {
        const next = await chatApi.room(id);
        // The unread line is drawn against where they had read up to when
        // they OPENED the room, not against the last poll.
        lastSeenRef.current = next.lastSeenAt || null;
        setRoom(next);
        setRoomError("");
        return true;
      } catch (err) {
        setRoomError(say(err, "app.companyChat.roomLoadError"));
        return false;
      }
    },
    [say],
  );

  // The delta: only what is new since the last message on screen.
  const pollRoom = useCallback(
    async (id) => {
      const current = roomRef.current;
      if (!current || current.id !== id) return loadRoom(id);
      const last = current.messages?.length ? current.messages[current.messages.length - 1].at : null;
      const after = last || new Date(0).toISOString();
      try {
        const next = await chatApi.room(id, { after });
        if ((next.messages || []).length >= DELTA_LIMIT) return loadRoom(id);
        if ((next.messages || []).length) lastActivity.current = Date.now();
        setRoom((prev) => mergeDelta(prev, next));
        setRoomError("");
        return (next.messages || []).length > 0;
      } catch (err) {
        setRoomError(say(err, "app.companyChat.roomLoadError"));
        return false;
      }
    },
    [loadRoom, say],
  );

  // ── After anything that marked a room seen ─────────────────────────────
  //
  // The server stamps lastSeenAt inside the room GET, but the list polls
  // every fifteen seconds, so a room plainly open on screen kept its badge
  // in the list for up to a poll. Re-read the list now, and announce it
  // (lib/chat/badges.js) for any chrome that draws a digit.
  const afterSeen = useCallback(() => {
    loadList();
    announceBadgesChanged();
  }, [loadList]);

  // The first read seeds #general, the job rooms and the auto-join
  // channels; the polls after it only read.
  useEffect(() => {
    loadList({ sync: true });
  }, [loadList]);

  useEffect(() => {
    if (!openId) return;
    setRoom(null);
    lastActivity.current = Date.now();
    loadRoom(openId).then((ok) => {
      if (ok) afterSeen();
    });
  }, [openId, loadRoom, afterSeen]);

  // The list, every 15 seconds while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadList();
    }, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [loadList]);

  // The open room: every 4 seconds while something is happening, every 15
  // once it has been quiet for two minutes. A chat that only updates on
  // reload is a mailbox.
  useEffect(() => {
    if (!openId) return undefined;
    let timer = null;
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      if (typeof document === "undefined" || !document.hidden) {
        const fresh = await pollRoom(openId);
        if (fresh) afterSeen();
      }
      if (!alive) return;
      const idle = Date.now() - lastActivity.current > ROOM_IDLE_MS;
      timer = setTimeout(tick, idle ? ROOM_POLL_SLOW_MS : ROOM_POLL_FAST_MS);
    };
    timer = setTimeout(tick, ROOM_POLL_FAST_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [openId, pollRoom, afterSeen]);

  // Coming back to the tab. The polls skip while the tab is hidden, so a
  // room left open overnight has not been marked seen since the tab went to
  // the background; whoever returns to it is looking at every message in
  // it, and the list must say so now, not after the next tick. The room GET
  // is what marks it seen, so it goes first and the list follows it.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const wake = () => {
      if (document.hidden) return;
      lastActivity.current = Date.now();
      if (openId) {
        pollRoom(openId).then(() => {
          loadList({ sync: true });
          announceBadgesChanged();
        });
      } else {
        loadList({ sync: true });
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [openId, pollRoom, loadList]);

  // Typing is activity: keep the fast poll while somebody is writing.
  useEffect(() => {
    if (text) lastActivity.current = Date.now();
  }, [text]);

  // ── The list, grouped ──────────────────────────────────────────────────
  const readOnly = Boolean(data?.me?.readOnly);
  const canCreateChannel = Boolean(data?.me?.canCreateChannel) && !readOnly;
  const joinable = useMemo(() => (Array.isArray(data?.joinable) ? data.joinable : []), [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const order = groupOrderFor(data.me?.role);
    const buckets = Object.fromEntries(order.map((k) => [k, []]));
    for (const r of data.rooms || []) {
      const g = groupOf(r, { unreadOnTop: true });
      if (!buckets[g]) continue;
      const name = roomName(r);
      const preview = r.lastBody
        ? `${r.lastWasMine ? t("app.companyChat.youPrefix") : r.lastWho ? `${r.lastWho}:` : ""} ${r.lastBody}`.trim()
        : r.kind === "dm" || r.kind === "group"
          ? t("app.companyChat.noMessages")
          : r.kind === "job"
            ? t("app.companyChat.jobRoomHint", { count: r.memberCount })
            : r.kind === "channel"
              ? r.topic || (r.postingPolicy === "office" ? t("app.companyChat.officeOnlyNote") : t("app.companyChat.noMessages"))
              : t("app.companyChat.generalHint");
      const glyph =
        r.kind === "general" ? (
          <Hash size={large ? 18 : 15} aria-hidden="true" />
        ) : r.kind === "channel" ? (
          <ChannelGlyph room={r} size={large ? 18 : 15} />
        ) : r.kind === "group" ? (
          <Users size={large ? 18 : 15} aria-hidden="true" />
        ) : (
          initialsOf(name)
        );
      buckets[g].push({
        id: r.id,
        raw: r,
        title: name,
        subtitle: preview,
        time: r.lastAt,
        unread: r.unread,
        muted: r.muted,
        initials: glyph,
        tone: r.kind === "dm" ? "them" : "muted",
        channel: r.kind === "job" ? "team" : null,
        channelLabel: r.kind === "job" ? t("app.companyChat.group.job") : r.private ? t("app.companyChat.private") : "",
        badges: (
          <>
            {r.muted ? (
              <span className="text-muted-foreground" title={t("app.companyChat.muted")} data-muted-icon>
                <BellOff size={13} aria-hidden="true" />
                <span className="sr-only">{t("app.companyChat.muted")}</span>
              </span>
            ) : null}
            {r.mentions > 0 && r.notifyLevel !== "none" ? (
              <span
                className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums"
                data-mention-badge
              >
                <span aria-hidden="true">@{r.mentions}</span>
                <span className="sr-only">{t("app.companyChat.mentionCountSr", { count: r.mentions })}</span>
              </span>
            ) : null}
          </>
        ),
      });
    }
    // #general first among the channels — the one everybody has.
    if (buckets.channel) buckets.channel.sort((a, b) => (a.raw.kind === "general" ? -1 : b.raw.kind === "general" ? 1 : 0));
    const groupTitle = (k) => (k === "job" && !data.me?.office ? t("app.companyChat.group.myJobs") : t(`app.companyChat.group.${k}`));
    return order
      .map((k) => {
        const g = { key: k, title: groupTitle(k), rooms: buckets[k] };
        if (k === "channel") {
          // The section is always drawn for somebody who can add to it or
          // browse it, so the "+" and Browse channels are never stranded.
          g.alwaysShow = canCreateChannel || (!readOnly && joinable.length > 0);
          if (canCreateChannel) {
            g.action = (
              <button
                type="button"
                onClick={() => setModal("channel")}
                aria-label={t("app.companyChat.addChannel")}
                title={t("app.companyChat.addChannel")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-foreground hover:bg-muted lg:h-7 lg:w-7"
                data-add-channel
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            );
          }
          if (!readOnly && (joinable.length > 0 || canCreateChannel)) {
            g.footer = (
              <button
                type="button"
                onClick={() => setModal("browse")}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-muted/60 min-h-[44px]"
                data-browse-channels
              >
                <Search size={14} aria-hidden="true" />
                {joinable.length ? t("app.companyChat.browseMore", { count: joinable.length }) : t("app.companyChat.browseChannels")}
              </button>
            );
          }
        }
        return g;
      })
      .filter((g) => g.rooms.length || g.alwaysShow);
  }, [data, t, roomName, large, canCreateChannel, readOnly, joinable]);

  const selectRoom = useCallback((row) => {
    setActionError("");
    setContext(null);
    setOpenId(row.id);
    setPane(PANE_THREAD);
  }, []);

  /** Open a room the server just made or joined, and refresh the list. */
  const openMade = useCallback(
    async (roomId) => {
      setModal(null);
      setActionError("");
      await loadList();
      setContext(null);
      if (roomId === openId) await loadRoom(roomId);
      setOpenId(roomId);
      setPane(PANE_THREAD);
    },
    [loadList, loadRoom, openId],
  );

  // ── Sending ────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || !openId || sending) return;
    setSending(true);
    setActionError("");
    try {
      await chatApi.send(openId, body);
      setText("");
      lastActivity.current = Date.now();
      // The delta brings the message back with its id and time — no
      // second copy drawn ahead of the server's.
      await pollRoom(openId);
      // Saying something is seeing it: the list and the digit follow.
      afterSeen();
    } catch (err) {
      setActionError(say(err, "app.companyChat.refusal.notSent"));
    } finally {
      setSending(false);
    }
  }, [text, openId, sending, pollRoom, afterSeen, say]);

  // ── @ popup ────────────────────────────────────────────────────────────
  //
  // The members the thread carried — or, in a room bigger than the thread
  // carries (MEMBER_INLINE_MAX), the server's search over its members, so a
  // 2,000-person group can still @ anybody in it.
  const token = useMemo(() => mentionTokenAt(text), [text]);
  const [mentionCursor, setMentionCursor] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(null);
  const mentionOpen = Boolean(token) && room?.kind !== "dm" && mentionDismissed !== token?.start;
  const [remoteMentions, setRemoteMentions] = useState({ q: null, rows: [], loading: false });
  useEffect(() => {
    if (!mentionOpen || !room?.membersTruncated) return undefined;
    const q = token.query;
    let alive = true;
    setRemoteMentions((s) => ({ ...s, loading: true }));
    const id = setTimeout(() => {
      chatApi
        .members(room.id, { q })
        .then((d) => alive && setRemoteMentions({ q, rows: (d.members || []).filter((m) => !m.isYou), loading: false }))
        .catch(() => alive && setRemoteMentions({ q, rows: [], loading: false }));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [mentionOpen, room?.membersTruncated, room?.id, token?.query]);
  const mentionRows = useMemo(() => {
    if (!mentionOpen) return [];
    if (room?.membersTruncated) return remoteMentions.rows.slice(0, 8);
    const q = token.query.toLowerCase();
    return (room?.members || [])
      .filter((m) => !m.isYou)
      .filter((m) => !q || (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionOpen, token, room, remoteMentions]);
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
      // Text only — the kit tints a row that names the reader from the flag
      // (Thread.js `mentionsMe`). A node here drew "[object Object]".
      body: m.body,
      mentionsMe: Boolean(m.mentionsMe),
      at: m.at,
      kind: m.kind === "system" ? "system" : "message",
      who: m.who || t("app.companyChat.someoneWhoLeft"),
      meta: m.meta,
    }));
    return layoutThread(items, { lastReadAt: lastSeenRef.current });
  }, [room, t]);

  // ── "Seen by" ──────────────────────────────────────────────────────────
  //
  // Under the reader's OWN last message: "Seen by 3" (a DM: "Seen"), and the
  // list on tap. Any earlier message of theirs has "Seen by" in its hover
  // bar. Room members only — `room.seen` is null for anybody else, and the
  // route behind the list says 404 to them.
  const isMember = Boolean(room?.mine);
  const renderFooter = useCallback(
    (m) => {
      if (!room?.seen || !m.mine || m.id !== room.seen.messageId || m.kind !== "message") return null;
      const n = Number(room.seen.count) || 0;
      if (n <= 0) return null;
      return (
        <button
          type="button"
          onClick={() => setModal({ seen: m.id })}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          data-seen-by={n}
        >
          {room.kind === "dm" ? t("app.companyChat.seen") : t("app.companyChat.seenBy", { count: n })}
        </button>
      );
    },
    [room, t],
  );
  const hoverActions = useCallback(
    (m) =>
      isMember && m.mine && m.kind === "message" && m.id ? (
        <button
          type="button"
          onClick={() => setModal({ seen: m.id })}
          className="min-h-[28px] rounded px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          data-seen-action
        >
          {t("app.companyChat.seenByAction")}
        </button>
      ) : null,
    [isMember, t],
  );

  // ── Starting conversations ─────────────────────────────────────────────
  const startDirect = useCallback(
    async (person) => {
      setActionError("");
      try {
        const res = await chatApi.openDirect(person.id);
        setModal(null);
        await loadList();
        setOpenId(res.roomId);
        setPane(PANE_THREAD);
        return res.roomId;
      } catch (err) {
        setActionError(say(err, "app.companyChat.roomLoadError"));
        return null;
      }
    },
    [loadList, say],
  );

  // ── ?with=<memberId>: arrive IN the conversation ──────────────────────
  //
  // "Message Ana" on the team directory used to land on the list, a search
  // and a tap short of what the button said. Opened once, after the first
  // list read; a read-only support session opens nothing (the server would
  // refuse the write, and the list is what it came to read). The URL then
  // becomes ?room=, so a reload reopens this room instead of re-running the
  // open after the person has moved on to another.
  const openedWith = useRef(false);
  useEffect(() => {
    if (!initialWithId || openedWith.current || !data) return;
    openedWith.current = true;
    if (data.me?.readOnly) return;
    startDirect({ id: initialWithId }).then((roomId) => {
      if (roomId && typeof window !== "undefined") {
        window.history.replaceState(null, "", `${window.location.pathname}?room=${encodeURIComponent(roomId)}`);
      }
    });
  }, [initialWithId, data, startDirect]);

  // ── ?message=<id>: the bell's mention row lands AT the message ─────────
  const openedMessage = useRef(false);
  useEffect(() => {
    if (!initialMessageId || openedMessage.current || !data) return;
    openedMessage.current = true;
    chatApi
      .locate(initialMessageId)
      .then((res) => {
        setFocusMessageId(res.messageId);
        setOpenId(res.roomId);
        setPane(PANE_THREAD);
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `${window.location.pathname}?room=${encodeURIComponent(res.roomId)}`);
        }
      })
      .catch(() => setActionError(tRef.current("app.companyChat.messageNotFound")));
  }, [initialMessageId, data]);

  // Scroll the landed-on message into view once its room has drawn.
  useEffect(() => {
    if (!focusMessageId || !room || typeof document === "undefined") return;
    const el = document.querySelector(`[data-message-id="${CSS.escape(focusMessageId)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.setAttribute("data-focused", "true");
    setFocusMessageId(null);
  }, [focusMessageId, room]);

  // After a settings change: the room and the list both.
  const refreshAfterChange = useCallback(async () => {
    if (openId) await loadRoom(openId);
    await loadList();
    announceBadgesChanged();
  }, [openId, loadRoom, loadList]);

  // The viewer left or hid the room: close it.
  const closeGone = useCallback(async () => {
    setContext(null);
    setOpenId(null);
    setRoom(null);
    setPane(PANE_LIST);
    await loadList();
    announceBadgesChanged();
  }, [loadList]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (error && !data) return <p className="text-sm text-muted-foreground">{error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.chat.loading")}
      </p>
    );
  }

  // Typed "@everyone" without the office's say: the server will post it as
  // words and tell nobody (rules.js mayMentionEveryone), so the composer
  // says that BEFORE they send rather than letting them think the whole
  // crew was pinged. Same detector the server parses with.
  const everyoneIsText = Boolean(room) && room.kind !== "dm" && !mayMentionEveryone(data.me) && mentionsEveryone(text);
  const title = room ? roomName(room) : "";
  const subtitle = room
    ? room.kind === "dm"
      ? t("app.companyChat.directHint")
      : room.kind === "group"
        ? t("app.companyChat.groupHint")
        : room.kind === "channel"
          ? room.topic || (room.private ? t("app.companyChat.channelHintPrivate") : t("app.companyChat.channelHintPublic"))
          : room.kind === "job"
            ? room.active
              ? t("app.companyChat.jobHint")
              : t("app.companyChat.finishedJobHint")
            : t("app.companyChat.generalHint")
    : "";

  const openSettings = () => {
    setContext((c) => (c === "settings" ? null : "settings"));
    setPane(PANE_CONTEXT);
  };

  const list = (
    <RoomList
      groups={groups}
      selectedId={openId}
      onSelect={selectRoom}
      collapsed={collapsed}
      large={large}
      onToggleGroup={(key) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))}
      ariaLabel={heading}
      header={
        <div className="border-b border-border">
          <div className="relative flex items-center gap-2 px-3 py-2">
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{heading}</h1>
            {!readOnly && !large ? (
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
          {/* The crew's one big button: pick one person for a DM, two or
              more for a group. No "+ Channel" — that is the office's. */}
          {!readOnly && large ? (
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => setModal("message")}
                data-new-button
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Pencil size={18} aria-hidden="true" /> {t("app.companyChat.newMessage")}
              </button>
            </div>
          ) : null}
        </div>
      }
      empty={<p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("app.companyChat.emptyList")}</p>}
    />
  );

  const can = room?.can || {};
  const composerNote = readOnly
    ? { key: "app.companyChat.readOnlyNote", data: "data-read-only-note" }
    : room && !can.post
      ? room.archived || can.postRefusal === "archived"
        ? { key: "app.companyChat.archivedNote", data: "data-archived-note" }
        : can.postRefusal === "office_only"
          ? { key: "app.companyChat.officeOnlyNote", data: "data-office-only-note" }
          : { key: "app.companyChat.readOnlyNote", data: "data-read-only-note" }
      : null;

  const thread = !openId ? (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{t("app.companyChat.intro")}</p>
      {/* A refused ?with= or ?message= open has no composer to carry its error. */}
      {actionError ? (
        <p className="mt-3 max-w-sm text-sm text-red-700 dark:text-red-300" data-action-error>
          {actionError}
        </p>
      ) : null}
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
            {room?.kind === "channel" ? <ChannelGlyph room={room} size={13} className="shrink-0 text-muted-foreground" /> : null}
            {room?.kind === "group" ? <Users size={13} aria-hidden="true" className="shrink-0 text-muted-foreground" /> : null}
            {/* The channel's # is the glyph's; the name follows it bare. */}
            <span className="truncate">{room?.kind === "channel" ? room.title : title}</span>
            {room?.private ? <span className="sr-only">{t("app.companyChat.private")}</span> : null}
            {room?.mine?.starred ? <Star size={12} aria-hidden="true" className="shrink-0 fill-current text-muted-foreground" /> : null}
            {room?.mine?.muted ? (
              <span className="shrink-0 text-muted-foreground" title={t("app.companyChat.muted")}>
                <BellOff size={12} aria-hidden="true" />
                <span className="sr-only">{t("app.companyChat.muted")}</span>
              </span>
            ) : null}
          </h2>
          {room ? <p className="truncate text-xs text-muted-foreground">{room.archived ? t("app.companyChat.archivedNote") : subtitle}</p> : null}
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
            onClick={openSettings}
            aria-pressed={context === "settings"}
            data-members-button
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Users size={14} aria-hidden="true" />
            {t("app.companyChat.memberCount", { count: room.memberCount })}
          </button>
        ) : null}
        {room && can.settings ? (
          <button
            type="button"
            onClick={openSettings}
            aria-label={t("app.companyChat.settings")}
            title={t("app.companyChat.settings")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-foreground hover:bg-muted"
            data-settings-button
          >
            <Settings size={15} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {roomError ? <p className="px-3 py-2 text-sm text-red-700 dark:text-red-300">{roomError}</p> : null}

      <Thread
        rows={rows}
        them={title}
        loading={!room && !roomError}
        initialsFor={(m) => initialsOf(m.who || title)}
        renderSystem={systemLine}
        renderFooter={renderFooter}
        hoverActions={hoverActions}
        ariaLabel={title}
      />

      {composerNote ? (
        <p className="border-t border-border px-3 py-3 text-sm text-muted-foreground" {...{ [composerNote.data]: true }}>
          {t(composerNote.key)}
        </p>
      ) : (
        <div className="relative" onKeyDownCapture={onComposerKeyDownCapture}>
          {mentionOpen ? (
            <MentionPopup rows={mentionRows} loading={Boolean(room?.membersTruncated && remoteMentions.loading)} cursor={mentionCursor} onHover={setMentionCursor} onPick={insertMention} />
          ) : null}
          <Composer
            value={text}
            onChange={setText}
            onSend={send}
            busy={sending}
            disabled={!room}
            placeholder={t("app.companyChat.composerPlaceholder", { name: title })}
            maxLength={4000}
            hint={
              actionError ? (
                <span className="text-red-700 dark:text-red-300">{actionError}</span>
              ) : everyoneIsText ? (
                <span data-everyone-hint>{t("app.companyChat.everyoneOfficeOnly")}</span>
              ) : null
            }
          />
        </div>
      )}
    </>
  );

  const seenId = modal && typeof modal === "object" ? modal.seen : null;

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
          context === "settings" && openId && room ? (
            <RoomSettings
              room={room}
              roomName={title}
              peopleKey={peopleKey}
              onClose={() => {
                setContext(null);
                setPane(PANE_THREAD);
              }}
              onChanged={refreshAfterChange}
              onGone={closeGone}
              onAddPeople={() => setModal("add")}
            />
          ) : null
        }
      />

      {modal === "message" ? <NewMessageModal me={data.me} onClose={() => setModal(null)} onOpened={openMade} /> : null}
      {modal === "channel" && canCreateChannel ? <NewChannelModal me={data.me} onClose={() => setModal(null)} onOpened={openMade} /> : null}
      {modal === "browse" ? (
        <BrowseChannelsModal
          joinable={joinable}
          canCreate={canCreateChannel}
          onClose={() => setModal(null)}
          onJoined={openMade}
          onCreate={() => setModal("channel")}
        />
      ) : null}
      {modal === "add" && room ? (
        <AddPeopleModal
          roomId={room.id}
          me={data.me}
          inIds={room.membersTruncated ? [] : (room.members || []).map((m) => m.id)}
          onClose={() => setModal(null)}
          onAdded={async () => {
            setModal(null);
            setPeopleKey((k) => k + 1);
            await refreshAfterChange();
          }}
        />
      ) : null}
      {seenId && room ? <SeenByModal roomId={room.id} messageId={seenId} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
