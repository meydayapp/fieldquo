"use client";

// app/app/messages/page.js
//
// Facebook Page, Instagram and WhatsApp business messages, answered here — on
// the shared chat kit, so this screen, /sales/messages and the team chat are
// one UI drawn three times rather than three UIs that drift.
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
// waiting on, and links to the screen where the Page gets connected. The one
// exception is a DEMO company, where the mock is decided by
// lib/messaging/channels.js reading Company.isDemo from the database — the
// same single gate lib/social/metaConnection.js uses, for the same reason.
//
// ══ Never a personal inbox ═════════════════════════════════════════════════
//
// Page and Instagram BUSINESS conversations only. That is all the permissions
// this feature will ever request, and there is no code path to anything else.
//
// ══ Layout ════════════════════════════════════════════════════════════════
//
// Three panes on the kit's ChatLayout — the room list, the thread, the
// context bar — from `lg` up; two from `md`; one at a time below it, with a
// back arrow, and the context bar as a sheet over the thread. The composer
// is the last child of the thread's flex column rather than a fixed bar —
// deliberately: a `fixed bottom-…` composer would have to register with
// useBottomDock and would fight the mobile tab bar and the keyboard on the
// one screen where the keyboard is open most of the time.
//
// ══ What each pane is backed by ════════════════════════════════════════════
//
//   list     GET /api/messaging/threads (q, platform) → lib/messaging/rooms.js
//            buckets the rows into Needs a reply · Waiting on them · Snoozed ·
//            Done, executed by scripts/check-app-messages-kit.mjs.
//   thread   GET /api/messaging/threads/[id] → messageItem() per row →
//            lib/chat/threadLayout.js lays out day dividers, the unread line
//            (from the unread COUNT, captured before the read is recorded)
//            and sequential grouping. Activity rows are system rows; a
//            private note is its own kind, painted in its measured wash.
//   composer POST …/reply (text, template, media, location) or …/note —
//            the two routes the old composer used, unchanged, with the
//            server's own refusal shown under the box.
//   context  the same thread: details, the outcome control and its
//            meanings, the activity history and the review month.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MessageCircle, Search, ArrowLeft, Loader2, BarChart3, Link2, Check, RotateCcw,
  ExternalLink, UserRound, ChevronDown, Info, RefreshCw, AlertTriangle,
} from "lucide-react";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import {
  ChatLayout,
  RoomList,
  Thread,
  Composer,
  ContextBar,
  Avatar,
  initialsOf,
  PANE_LIST,
  PANE_THREAD,
  PANE_CONTEXT,
} from "@/app/components/chat";
import { layoutThread } from "@/lib/chat/threadLayout";
import { THREAD_OUTCOMES, outcomeLabelKey } from "@/lib/messaging/outcomes";
import { MESSAGING_PLATFORMS, platformLabelKey } from "@/lib/messaging/platforms";
import { activityLabel } from "@/lib/messaging/activity";
import {
  GROUP_ORDER,
  GROUP_DONE,
  groupThreads,
  groupTitleKey,
  messageItem,
  lastReadInstant,
} from "@/lib/messaging/rooms";
// lucide ships no brand marks; the bio-link page already draws these three.
import { SocialGlyph } from "@/app/components/links/linkIcons";
// Hot / warm / cold, and the reasons behind it. The chip rides on the inbox
// row; the panel sits on the Outcome tab, above the outcome control, because
// "is this person going to buy" is the question you ask BEFORE you record what
// happened.
import ConversationTemperature, { TemperatureChip } from "@/app/components/messaging/ConversationTemperature";
// Why the composer is off, and what the empty inbox says — ONE decision, pure,
// and executed by scripts/check-messaging.mjs. See that file's header for why
// it does not live in this component.
import { composerBlock, connectionBlurb } from "@/lib/messaging/composerState";
// Where the Page gets connected. One constant shared with the connect and
// callback routes, so the card below cannot point at a screen that moved.
import { SOCIAL_SETTINGS_PATH } from "@/lib/social/settingsPath";
// The one table that knows what WhatsApp will accept, and Meta's own size
// limits with it. Read here so the file picker offers exactly what the send
// path takes — a picker that offers more is a control that appears to work.
//
// From whatsappMediaLimits.js and NOT whatsappMedia.js: this file is "use
// client", and the send module imports lib/messaging/channels.js for the
// token, which imports "@/lib/db". Reaching for one pure function through it
// would pull Prisma into the browser bundle — the split lib/media/
// cloudinaryUrl.js documents, for the same reason.
import {
  classifyWhatsAppOutboundMedia,
  WHATSAPP_MEDIA_ACCEPT,
} from "@/lib/messaging/whatsappMediaLimits";
import {
  PlatformBadge, Attachments, NoteBody, OutcomePicker, StatusPicker, WaitingBadge,
  ComposerTabs, AssigneePicker, ServiceWindowNotice, TemplatePicker, AttachControl,
} from "./ConversationBits";

const ACTION =
  "inline-flex items-center gap-1.5 min-h-[36px] whitespace-nowrap rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60";
const TAG = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
const CHIP =
  "min-h-[36px] shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium";

/** The frame's height: the viewport minus the shell's chrome above and below
 *  — the sticky top bar and this page's own header below `lg`, the page
 *  header alone from `lg` up where the sidebar is a column. */
const FRAME_HEIGHT =
  "h-[calc(100dvh-var(--fq-tab-bar-height)-8.5rem)] sm:h-[calc(100dvh-var(--fq-tab-bar-height)-10rem)] lg:h-[calc(100dvh-8.5rem)]";

/** Does the viewport have room for the context bar as a column? Same hook
 *  as /sales/messages: false until measured, so the server and the first
 *  client paint agree. */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

/**
 * useSearchParams needs a Suspense boundary above it — Next 16 refuses the
 * build without one. The fallback says what is happening.
 */
export default function MessagesPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />{" "}
          {t("app.chat.loading")}
        </p>
      }
    >
      <MessagesScreen />
    </Suspense>
  );
}

function MessagesScreen() {
  const { t } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const router = useRouter();
  const params = useSearchParams();
  // The rung every write on this screen sits at — the outcome, the status,
  // the assignee, a reply, a note. The routes refuse anyone below it; this
  // is what stops a member who may only LOOK at requests from meeting a 403
  // behind a control that appeared to work. An unresolved provider falls
  // open, as everywhere else, because the server still refuses.
  const canEdit = useHasLevel("requests", "view_create_edit");

  // null, never []. An outage that rendered as "you have no conversations"
  // would tell a contractor their enquiries had vanished.
  const [threads, setThreads] = useState(null);
  const [connection, setConnection] = useState(null);
  // The private note's measured palette — see lib/messaging/noteTheme.js for
  // why it takes no company.
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [query, setQuery] = useState("");
  // null = every channel. The server filters, so this is a request rather
  // than a client-side hide: a chip that only hid rows the browser already
  // had would stop matching the moment the list is longer than one page.
  const [platformFilter, setPlatformFilter] = useState(null);
  // The company's people, for the assignee picker. Reuses the endpoint the
  // leads board already has — same `requests: view_only` gate as this screen,
  // same id-and-name-only payload — rather than a second one that would drift.
  const [people, setPeople] = useState([]);

  // The clock the "waiting 4 h" badge is measured against. Ticked once a
  // minute rather than read at render: a tab left open on a phone in a van
  // would otherwise still say "waiting 20 min" three hours later.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ?conversation=<id> (and the older ?thread=<id> the monthly review links
  // with) — the deep link. Read once at mount; written back below whenever
  // the open thread changes, so a reload lands in the conversation.
  const wanted = params.get("conversation") || params.get("thread") || "";
  const [activeId, setActiveId] = useState(wanted || null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadErrorKey, setThreadErrorKey] = useState("");
  const [pane, setPane] = useState(wanted ? PANE_THREAD : PANE_LIST);
  const [showContext, setShowContext] = useState(true);
  const [contextTab, setContextTab] = useState("details");
  const [collapsed, setCollapsed] = useState([GROUP_DONE]);
  const [focusedRoom, setFocusedRoom] = useState(null);
  // The instant the reader had last looked BEFORE this opening — what the
  // red line is drawn from. Frozen per thread so the line does not vanish
  // the moment the read is recorded. The thread stores a COUNT, not an
  // instant; lib/messaging/rooms.js turns one into the other.
  const [openedReadAt, setOpenedReadAt] = useState(null);
  const openedFor = useRef("");

  const load = useCallback(async (q, platform) => {
    setLoading(true);
    setErrorKey("");
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (platform) search.set("platform", platform);
    const suffix = search.toString() ? "?" + search.toString() : "";
    const result = await fetchList("/api/messaging/threads" + suffix);
    if (result.aborted) return;
    if (result.ok) {
      setThreads(result.data?.threads || []);
      setConnection(result.data?.connection || null);
      setNote(result.data?.note || null);
    } else {
      setErrorKey(result.errorKey);
    }
    setLoading(false);
  }, []);

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
  // The channel chip goes through the same request for the same reason. This
  // effect also runs the first load, with an empty query.
  useEffect(() => {
    const id = setTimeout(() => load(query.trim(), platformFilter), 250);
    return () => clearTimeout(id);
  }, [query, platformFilter, load]);

  const loadThread = useCallback(async (id, { quiet = false } = {}) => {
    if (!quiet) {
      setThread(null);
      setThreadErrorKey("");
      setThreadLoading(true);
    }
    const result = await fetchList("/api/messaging/threads/" + encodeURIComponent(id));
    if (result.aborted) return null;
    if (result.ok) {
      const data = result.data?.thread || null;
      setThread(data);
      setThreadLoading(false);
      return data;
    }
    if (!quiet) setThreadErrorKey(result.errorKey);
    setThreadLoading(false);
    return null;
  }, []);

  // Opening a thread: read it, remember where the reader had got to, record
  // the read. Marking read is a WRITE, so it goes through the same PATCH
  // everything else does rather than a second endpoint. A demo's threads are
  // computed, not stored, so nothing is written for one.
  useEffect(() => {
    if (!activeId) return undefined;
    let cancelled = false;
    (async () => {
      const data = await loadThread(activeId);
      if (cancelled || !data) return;
      if (openedFor.current !== activeId) {
        openedFor.current = activeId;
        setOpenedReadAt(lastReadInstant(data.messages, data.unread));
      }
      if (!data.unread || String(data.id).startsWith("demo_")) return;
      fetch("/api/messaging/threads/" + encodeURIComponent(activeId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      })
        .then((res) => {
          if (!res.ok) return;
          setThreads((rows) => (rows ? rows.map((r) => (r.id === activeId ? { ...r, unread: 0 } : r)) : rows));
        })
        // A failed "mark read" is not worth a message on screen: the badge
        // stays up, which is the honest outcome, and the next open tries again.
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, loadThread]);

  // The URL carries the open thread, so a link from the review — or a reload
  // — lands in the conversation rather than on the list.
  useEffect(() => {
    const current = params.get("conversation") || params.get("thread") || "";
    if ((activeId || "") === current) return;
    const next = new URLSearchParams(params.toString());
    next.delete("thread");
    if (activeId) next.set("conversation", activeId);
    else next.delete("conversation");
    router.replace(`/app/messages${next.toString() ? `?${next}` : ""}`);
  }, [activeId, params, router]);

  const openThread = useCallback((id) => {
    setActiveId(id);
    setPane(PANE_THREAD);
  }, []);

  /** Reload the open thread and the list — after every write. */
  const refresh = useCallback(async () => {
    if (activeId) await loadThread(activeId, { quiet: true });
    await load(query.trim(), platformFilter);
  }, [activeId, loadThread, load, query, platformFilter]);

  const blockKey = composerBlock(connection);
  const blurbKey = connectionBlurb(connection);
  const isDemo = Boolean(connection?.mock);

  // ── The list, bucketed ────────────────────────────────────────────────
  const groups = useMemo(() => {
    const buckets = groupThreads(threads || []);
    return GROUP_ORDER.map((key) => ({
      key,
      title: t(groupTitleKey(key)),
      rooms: buckets[key].map((row) => ({
        id: row.id,
        title: row.participantName || t("app.messages.unknownPerson"),
        subtitle:
          row.lastDirection === "out"
            ? t("app.messages.lastFromYou", { message: row.preview || "" })
            : row.preview || "",
        time: row.lastMessageAt,
        unread: row.unread ?? 0,
        // A brand mark in the avatar's corner, not one of the kit's three
        // glyphs. The accessible name is the platform's own word.
        channelLabel: row.platform ? t(platformLabelKey(row.platform)) : "",
        channelBadge: row.platform ? <SocialGlyph platform={row.platform} size={10} /> : null,
        initials: initialsOf(row.participantName || "?"),
        badges: <RowBadges row={row} now={now} t={t} />,
      })),
    }));
  }, [threads, now, t]);

  // ── The thread's rows ─────────────────────────────────────────────────
  const them = thread?.participantName || t("app.messages.unknownPerson");
  const windowNotice = thread?.serviceWindow || null;
  const windowClosed = Boolean(windowNotice?.blockKey);

  const rows = useMemo(() => {
    if (!thread) return [];
    const items = [];
    for (const m of thread.messages || []) {
      const item = messageItem(m);
      if (!item) continue;
      if (item.kind === "system") {
        // The sentence, in the reader's language, from the structured row.
        // An activity this version does not recognise renders as NOTHING
        // rather than as a guess — see lib/messaging/activity.js.
        const sentence = activitySentence(item.activity, t);
        if (!sentence) continue;
        items.push({ ...item, body: sentence });
        continue;
      }
      items.push(item);
    }
    if (windowClosed) {
      // WhatsApp's 24-hour window, closed, as a row in the story — undated on
      // purpose: it is a statement about now, not an event at a time, so it
      // sorts last and gets no day heading. Only where the send path enforces
      // a window (lib/messaging/platforms.js: WhatsApp); nothing is invented
      // for Facebook or Instagram, whose window Meta enforces on its own side.
      items.push({ id: "window:closed", kind: "system", direction: "in", at: null, body: t(windowNotice.blockKey) });
    }
    return layoutThread(items, { lastReadAt: openedReadAt });
  }, [thread, openedReadAt, windowClosed, windowNotice, t]);

  /** One PATCH for every judgement on this thread, with the server's sentence on a refusal. */
  const [saving, setSaving] = useState(false);
  const patchThread = useCallback(
    async (payload, errorKeyName = "app.messages.outcome.saveError") => {
      if (!thread?.id) return false;
      setSaving(true);
      try {
        const res = await fetch("/api/messaging/threads/" + encodeURIComponent(thread.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          await reportResponseError(res, t(errorKeyName));
          return false;
        }
        await refresh();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [thread?.id, refresh, t],
  );
  const setOutcome = (outcome) => patchThread({ outcome });
  const busy = saving || isDemo || !canEdit;

  const wide = useWide();
  const toggleContext = () => {
    if (wide) setShowContext((v) => !v);
    else setPane((p) => (p === PANE_CONTEXT ? PANE_THREAD : PANE_CONTEXT));
  };

  // ── Panes ─────────────────────────────────────────────────────────────
  const listPane = (
    <RoomList
      groups={groups}
      selectedId={activeId}
      focusedId={focusedRoom}
      onFocusItem={setFocusedRoom}
      onSelect={(room) => openThread(room.id)}
      collapsed={collapsed}
      onToggleGroup={(key) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))}
      ariaLabel={t("app.nav.messages")}
      header={
        <div className="border-b border-border px-3 py-2.5 space-y-2">
          <label className="relative block">
            <span className="sr-only">{t("app.messages.search")}</span>
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            {/* text-base, not text-sm: anything smaller makes iOS Safari zoom
                the page on focus, and this screen is read on a phone. */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("app.messages.search")}
              className="min-h-[40px] w-full rounded-lg border border-border bg-background pl-9 pr-3 text-base text-foreground"
              data-inbox-search
            />
          </label>
          {/* The channel chips. They scroll sideways INSIDE this row rather
              than wrapping — four chips do not fit at 280px, and a wrapped
              second row pushes the first conversation off the screen. The
              page itself never scrolls sideways. */}
          <div
            role="group"
            aria-label={t("app.messages.channelFilter")}
            className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5"
            data-channel-filter
          >
            {[null, ...MESSAGING_PLATFORMS].map((platform) => {
              const active = platformFilter === platform;
              return (
                <button
                  key={platform || "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPlatformFilter(platform)}
                  className={`${CHIP} ${
                    active
                      ? "border-transparent bg-inverted text-inverted-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {platform ? (
                    <span className="inline-flex items-center gap-1">
                      <SocialGlyph platform={platform} size={11} />
                      {t(platformLabelKey(platform))}
                    </span>
                  ) : (
                    t("app.messages.channel.all")
                  )}
                </button>
              );
            })}
          </div>
          {errorKey && threads ? (
            // A refetch that failed with a list already on screen: the stale
            // list stays, and the failure is said rather than hidden.
            <p className="text-[11px] text-destructive break-words">
              {t(errorKey)}{" "}
              <button type="button" onClick={() => load(query.trim(), platformFilter)} className="underline">
                {t("app.load.retry")}
              </button>
            </p>
          ) : null}
        </div>
      }
      empty={
        loading && !threads ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />{" "}
            {t("app.chat.loading")}
          </p>
        ) : errorKey && !threads ? (
          <div className="space-y-2 px-3 py-4">
            <p className="text-sm font-medium text-foreground">{t("app.load.title")}</p>
            <p className="text-xs text-muted-foreground break-words">{t(errorKey)}</p>
            <button
              type="button"
              onClick={() => load(query.trim(), platformFilter)}
              className={`${ACTION} min-h-[44px]`}
            >
              <RefreshCw size={13} aria-hidden="true" /> {t("app.load.retry")}
            </button>
          </div>
        ) : (
          <div className="px-3 py-4 text-center">
            <MessageCircle size={20} aria-hidden="true" className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {query || platformFilter ? t("app.messages.noMatches") : t("app.messages.empty")}
            </p>
            {!query && !platformFilter && !blurbKey && (
              <p className="mt-1 text-xs text-muted-foreground">{t("app.messages.emptyHint")}</p>
            )}
          </div>
        )
      }
    />
  );

  const threadPane = !activeId ? (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      {/* "Choose a conversation" over an inbox that cannot have one is a
          sentence about a control that does not exist yet; the blocked
          state repeats why instead. */}
      <p className="max-w-sm text-sm text-muted-foreground break-words">
        {blurbKey && threads && !threads.length ? t(blurbKey) : t("app.messages.pickOne")}
      </p>
    </div>
  ) : (
    <>
      {/* ── Header: who, the tags, the actions ──────────────────────────── */}
      <header className="border-b border-border px-3 py-2" data-thread-header>
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setPane(PANE_LIST)}
            className="md:hidden -ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label={t("app.messages.back")}
            data-back-button
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <Avatar
            initials={initialsOf(them)}
            channelLabel={thread?.platform ? t(platformLabelKey(thread.platform)) : ""}
            badge={thread?.platform ? <SocialGlyph platform={thread.platform} size={10} /> : null}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {them}
              {/* The number a person says out loud. Absent when the row never
                  got one — never invented, because two conversations answering
                  to "41" is worse than one answering to nothing. */}
              {Number.isFinite(thread?.threadNumber) && (
                <span className="ml-2 font-normal text-xs text-muted-foreground">
                  {t("app.messages.threadNumber", { n: thread.threadNumber })}
                </span>
              )}
            </h2>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <PlatformBadge platform={thread?.platform} t={t} />
              {thread ? (
                <OutcomeChip value={thread.outcome} onPick={setOutcome} busy={busy} t={t} />
              ) : null}
              {thread ? <WaitingBadge thread={thread} t={t} now={now} /> : null}
              {isDemo && (
                <span className={`${TAG} bg-muted text-muted-foreground`} data-tag="demo">
                  {t("app.messages.demoBadge")}
                </span>
              )}
            </p>
          </div>
        </div>
        {/* One row that scrolls sideways on a phone rather than wrapping to
            three: the thread is what the screen is for, and a header that
            eats a third of it is a header that has to go. */}
        {thread ? (
          <div className="mt-2 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [&>*]:shrink-0" data-thread-actions>
            {thread.clientId ? (
              <Link href={`/app/clients/${encodeURIComponent(thread.clientId)}`} className={ACTION}>
                <ExternalLink size={13} aria-hidden="true" /> {t("app.messages.action.openClient")}
              </Link>
            ) : null}
            {thread.leadId ? (
              <Link href={`/app/leads?lead=${encodeURIComponent(thread.leadId)}`} className={ACTION}>
                <ExternalLink size={13} aria-hidden="true" /> {t("app.messages.action.openLead")}
              </Link>
            ) : null}
            {thread.jobId ? (
              <Link href={`/app/jobs/${encodeURIComponent(thread.jobId)}`} className={ACTION}>
                <ExternalLink size={13} aria-hidden="true" /> {t("app.messages.action.openJob")}
              </Link>
            ) : null}
            {thread.quoteId ? (
              <Link href={`/app/quotes/${encodeURIComponent(thread.quoteId)}`} className={ACTION}>
                <ExternalLink size={13} aria-hidden="true" /> {t("app.messages.action.openQuote")}
              </Link>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  patchThread({ status: thread.status === "resolved" ? "open" : "resolved" }, "app.messages.status.saveError")
                }
                className={ACTION}
                data-mark-done
              >
                {thread.status === "resolved" ? (
                  <RotateCcw size={13} aria-hidden="true" />
                ) : (
                  <Check size={13} aria-hidden="true" />
                )}
                {thread.status === "resolved" ? t("app.messages.action.reopen") : t("app.messages.action.markDone")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleContext}
              className={ACTION}
              aria-pressed={wide ? showContext : undefined}
              data-details-button
            >
              <UserRound size={13} aria-hidden="true" /> {t("app.messages.action.details")}
            </button>
          </div>
        ) : null}
      </header>

      {threadErrorKey ? (
        <div className="border-b border-border bg-muted px-3 py-2 text-sm">
          <p className="text-foreground break-words">{t(threadErrorKey)}</p>
          <button type="button" onClick={() => loadThread(activeId)} className={`${ACTION} mt-2 min-h-[44px]`}>
            <RefreshCw size={13} aria-hidden="true" /> {t("app.load.retry")}
          </button>
        </div>
      ) : null}

      {/* ── The conversation ────────────────────────────────────────────── */}
      <Thread
        rows={rows}
        them={them}
        loading={threadLoading && !thread}
        empty={<p className="py-10 text-center text-sm text-muted-foreground">{t("app.messages.noMessages")}</p>}
        renderBody={(m) => (
          <MessageBody
            item={m}
            note={note}
            thread={thread}
            isDemo={isDemo}
            onRetryAttachment={(messageId, index) => retryAttachment(thread, messageId, index, refresh, t)}
            onAddClient={(contact) => addContactAsClient(thread, contact, refresh, t)}
            onSaveAddress={(clientId, address) => saveLocationAsAddress(clientId, address, t)}
            t={t}
          />
        )}
      />

      {thread ? (
        <ComposerArea
          thread={thread}
          note={note}
          blockKey={blockKey}
          isDemo={isDemo}
          canEdit={canEdit}
          windowNotice={windowNotice}
          windowClosed={windowClosed}
          onChanged={refresh}
          t={t}
        />
      ) : null}
    </>
  );

  const contextPane =
    activeId && thread && (wide ? showContext : true) ? (
      <ContextBar
        title={them}
        subtitle={thread.platform ? t(platformLabelKey(thread.platform)) : null}
        onClose={() => {
          setShowContext(false);
          setPane(PANE_THREAD);
        }}
        tabs={[
          { key: "details", label: t("app.messages.tab.details") },
          { key: "outcome", label: t("app.messages.tab.outcome") },
          { key: "history", label: t("app.messages.tab.history") },
        ]}
        activeTab={contextTab}
        onTab={setContextTab}
      >
        {contextTab === "details" ? (
          <ContextDetails
            thread={thread}
            people={people}
            busy={busy}
            canEdit={canEdit}
            onPatch={patchThread}
            formatDate={formatDate}
            t={t}
          />
        ) : null}
        {contextTab === "outcome" ? (
          <ContextOutcome thread={thread} isDemo={isDemo} busy={busy} onPick={setOutcome} t={t} />
        ) : null}
        {contextTab === "history" ? <ContextHistory thread={thread} formatDate={formatDate} t={t} /> : null}
      </ContextBar>
    ) : null;

  return (
    <div className="p-4 sm:p-6" data-tour="messages-inbox">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <MessageCircle size={20} aria-hidden="true" /> {t("app.nav.messages")}
          </h1>
          {/* The subtitle is for a screen with room; on a phone the frame
              below is what the screen is for, and three lines of chrome
              above it push the first conversation under the fold. */}
          <p className="hidden sm:block text-xs text-muted-foreground">{t("app.messages.subtitle")}</p>
        </div>
        <Link
          href="/app/messages/review"
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground hover:bg-muted"
          data-review-link
        >
          <BarChart3 size={15} aria-hidden="true" />
          {t("app.messages.reviewLink")}
        </Link>
      </div>

      {/* The connection state, said once, above everything. It is the answer
          to "why is this empty", with the way there on it, and it is not
          repeated inside the composer's own disabled note — that one says
          what you cannot do, this one says why. */}
      {blurbKey && (
        <div
          className="mb-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4"
          data-connect-card
        >
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Link2 size={15} aria-hidden="true" /> {t("app.messages.connect.title")}
          </h2>
          <p className="text-sm text-foreground mt-2">{t(blurbKey)}</p>
          {/* The way there, on the card that says what is missing. A card
              that names a button on another screen without linking to it
              sends a contractor hunting through settings — the owner found
              exactly that on the live inbox. FieldQuo's own misconfiguration
              (`not_configured`) gets no link: there is nothing on that
              screen a contractor can do about it. */}
          {connection?.reason === "awaiting_meta_approval" && (
            <p className="text-sm text-muted-foreground mt-2">{t("app.messages.connect.awaitingApprovalLink")}</p>
          )}
          {connection?.reason !== "not_configured" && (
            <Link
              href={SOCIAL_SETTINGS_PATH}
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-inverted px-4 text-sm font-bold text-inverted-foreground"
              data-connect-link
            >
              <Link2 size={15} aria-hidden="true" />
              {connection?.reason === "needs_reauth"
                ? t("app.messages.connect.reconnect")
                : t("app.messages.connect.openSettings")}
            </Link>
          )}
        </div>
      )}

      <ChatLayout
        height={FRAME_HEIGHT}
        pane={pane}
        onCloseContext={() => setPane(PANE_THREAD)}
        list={listPane}
        thread={threadPane}
        context={contextPane}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// An activity row, as a sentence
// ═══════════════════════════════════════════════════════════════════════════

/**
 * lib/messaging/activity.js hands back a key and RAW parameters — the
 * outcome as "won", the link kind as "quote" — because it is pure and cannot
 * translate. The words for those two go in here, so "Marked won by Dave"
 * never reads "Marked won" in French with an English "won" in the middle.
 * Null for an activity this version does not recognise: silent, not guessed.
 */
function activitySentence(activity, t) {
  const label = activityLabel(activity);
  if (!label) return null;
  const params = { ...label.params };
  if (params.outcome) params.outcome = t(outcomeLabelKey(params.outcome));
  if (params.kind) params.kind = t(`app.messages.activity.kind.${params.kind}`);
  return t(label.key, params);
}

// ═══════════════════════════════════════════════════════════════════════════
// The list row's badges
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What rides on a row after the preview: the conversation number, how long
 * they have been waiting, the temperature chip, and a failed last reply.
 * Every one draws nothing when it has nothing to say.
 */
function RowBadges({ row, now, t }) {
  return (
    <>
      {/* The whole reason waitingSince is a column: this sentence, here, on
          a list of two hundred — rather than in a report once a month. */}
      <WaitingBadge thread={row} t={t} now={now} />
      {/* An annotation, never a filter. A conversation that scored cold sits
          in this list exactly where it would have without a score. */}
      <TemperatureChip temperature={row.temperature} score={row.score} t={t} />
      {row.lastFailed && (
        // Surfaced on the list, not only inside the thread: a reply that
        // never reached the homeowner is the thing a contractor most needs
        // to see without opening anything. An icon with the word for a
        // screen reader — the row is 280px wide and the preview has to
        // survive.
        <span className="shrink-0 text-destructive" title={t("app.messages.failed")}>
          <AlertTriangle size={12} aria-hidden="true" />
          <span className="sr-only">{t("app.messages.failed")}</span>
        </span>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The outcome chip — the control, on the thread header
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "Did this become a job?" as a chip with a menu: the current answer visible
 * without opening anything, the four outcomes and "Open" (clear) one tap
 * away. The same PATCH the Outcome tab's picker uses, so the two cannot
 * disagree. Disabled — never hidden — for a member who may not judge it, so
 * the answer is still readable.
 */
function OutcomeChip({ value, onPick, busy, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = value ? t(outcomeLabelKey(value)) : t("app.messages.outcome.open");
  const tone = value === "won"
    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
    : value
      ? "bg-muted text-foreground"
      : "bg-muted text-muted-foreground";

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("app.messages.outcome.setOutcome")}
        className={`${TAG} min-h-[28px] ${tone} disabled:opacity-60`}
        data-outcome-chip
        data-outcome={value || "open"}
      >
        {label}
        <ChevronDown size={11} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          data-outcome-menu
          className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {THREAD_OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              role="menuitemradio"
              aria-checked={value === o}
              onClick={() => {
                setOpen(false);
                onPick(o);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm min-h-[40px] ${
                value === o ? "bg-muted font-semibold" : "hover:bg-muted/60"
              }`}
            >
              <span>{t(outcomeLabelKey(o))}</span>
              {value === o ? <Check size={13} aria-hidden="true" /> : null}
            </button>
          ))}
          {/* Back to "nobody has said" — never to "lost". An outcome set by
              mistake must be removable, and the review counts a cleared one
              as unjudged. */}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!value}
            onClick={() => {
              setOpen(false);
              onPick(null);
            }}
            className={`mt-1 flex w-full items-center justify-between gap-2 rounded-md border-t border-border px-2.5 py-2 text-left text-sm min-h-[40px] ${
              !value ? "bg-muted font-semibold" : "hover:bg-muted/60"
            }`}
          >
            <span>{t("app.messages.outcome.open")}</span>
            {!value ? <Check size={13} aria-hidden="true" /> : null}
          </button>
        </div>
      ) : null}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// What goes inside a kit row
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The words' box of one row: the text, and whatever rode with it.
 *
 * A private note is painted in its measured wash (NoteBody). A message is
 * its text plus every attachment, drawn rather than counted — see
 * ConversationBits' Attachments for the eight kinds and four states. The
 * kit draws everything around this: gutter, avatar, name, time, the failed
 * state with Meta's own sentence.
 */
function MessageBody({ item, note, thread, isDemo, onRetryAttachment, onAddClient, onSaveAddress, t }) {
  if (item.kind === "note") return <NoteBody message={item} note={note} t={t} />;
  // What a card in the thread may DO, and whether this member may do it.
  // Both booleans come from the server (the thread route's canEditClients),
  // because the routes behind these buttons refuse anyone else and a button
  // that 403s is a dead control wearing a permission check.
  const media = {
    canEditClients: Boolean(thread?.canEditClients) && !isDemo,
    client: thread?.client || null,
    onAddClient,
    onSaveAddress,
  };
  const failed = item.status === "failed";
  return (
    <div className={`text-sm ${failed ? "text-red-900 dark:text-red-200" : "text-foreground"}`}>
      {item.body ? <p className="whitespace-pre-wrap break-words">{item.body}</p> : null}
      <Attachments message={item} onRetry={onRetryAttachment} media={media} t={t} />
    </div>
  );
}

/**
 * "That photo didn't arrive. Try again."
 *
 * Returns the failure SENTENCE (or null on success) rather than showing a
 * banner, so the answer lands on the bubble that asked — see
 * ConversationBits' AttachmentItem.
 */
async function retryAttachment(thread, messageId, index, refresh, t) {
  const res = await fetch("/api/messaging/threads/" + encodeURIComponent(thread.id) + "/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, index }),
  });
  // Reloaded either way: a failed retry still bumped the attempt count and
  // may have replaced the reason, and the card should show what is now true.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    await refresh();
    return data.error || t("app.messages.media.retryError");
  }
  await refresh();
  return null;
}

/**
 * "Add this contact card as a client."
 *
 * Two EXISTING routes, not a new one: /api/clients creates the row behind
 * its own `clientsProperties: full_edit` gate, and the thread PATCH links it
 * behind the `requests` gate the outcome control already uses. A third
 * endpoint that did both would be a second place that creates a client, and
 * the copy is the one that stops recording an activity entry.
 *
 * The link is best-effort and deliberately does NOT overwrite an existing
 * one: a conversation already tied to a client must not be silently
 * re-pointed at the plumber whose card they forwarded.
 */
async function addContactAsClient(thread, contact, refresh, t) {
  const phone = contact?.phones?.[0]?.phone || null;
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: contact?.name, phone, notes: contact?.org || undefined }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return data.error || t("app.messages.media.clientAddError");
  }
  const created = await res.json().catch(() => null);
  if (created?.id && !thread?.clientId) {
    await fetch("/api/messaging/threads/" + encodeURIComponent(thread.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: created.id }),
    }).catch(() => {});
  }
  await refresh();
  return null;
}

/**
 * "Save this pin as the client's address."
 *
 * PATCH /api/clients/[id], the same route the clients screen edits through,
 * behind the same `clientsProperties: full_edit` gate — which is why the
 * button is only drawn when the server said this member has it.
 */
async function saveLocationAsAddress(clientId, address, t) {
  const res = await fetch("/api/clients/" + clientId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return data.error || t("app.messages.media.addressError");
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// The composer
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reply or note, on the kit's Composer, with everything the send path can
 * take: free text, an approved WhatsApp template once the window has closed,
 * a photo / clip / document with an optional caption, the company's own pin.
 *
 * Disabled WITH THE REASON ON IT, never hidden. A missing box makes a
 * contractor think the feature is broken; a disabled box that says "FieldQuo
 * is waiting on Meta's approval for Page messaging" tells them the truth and
 * that there is nothing for them to do. The Note side is not gated by the
 * connection: a note goes nowhere near Meta.
 */
function ComposerArea({ thread, note, blockKey, isDemo, canEdit, windowNotice, windowClosed, onChanged, t }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  // "reply" or "note". Two different destinations, two different routes, and
  // the composer is dressed as whichever one it is about to write to.
  const [mode, setMode] = useState("reply");
  // The WhatsApp template a contractor picked once the 24-hour window closed,
  // and its fill-in values. Held here rather than in the picker so that
  // switching threads clears them — a value typed for one homeowner must not
  // survive into a message to another.
  const [templateId, setTemplateId] = useState(null);
  const [templateParams, setTemplateParams] = useState([]);
  // The file waiting to go with the next message: what /api/upload gave back,
  // plus the name to show. Uploaded on PICK rather than on Send — a driveway
  // connection takes real seconds and a Send button blocking on an upload
  // looks frozen.
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState("");
  // Is the company's own pin attached to the next message? A boolean and not
  // an object, deliberately: the coordinates never travel through the browser
  // (see the reply route), so the only thing state holds here is the INTENT.
  const [pinAttached, setPinAttached] = useState(false);

  // Every thread starts with nothing chosen. Without this a template picked on
  // a closed WhatsApp thread would still be selected when a Facebook thread is
  // opened next, and the first Send would post a templateId the server would
  // reject. The attachment is cleared for a sharper version of the same
  // reason: a photo picked for one homeowner must never be sitting in the
  // composer when a different conversation is opened.
  useEffect(() => {
    setTemplateId(null);
    setTemplateParams([]);
    setAttachment(null);
    setAttachError("");
    setPinAttached(false);
    setSendError("");
    setText("");
  }, [thread?.id]);

  // ── Three reasons the Reply side can be off, and they stack ────────────
  //
  // `blockKey` is the connection ("Meta has not approved us yet"). The window
  // is a separate, TEMPORARY one, and it is the only one with a way through —
  // so it does not merely disable the box, it swaps it for the template
  // picker. A demo's threads are computed rather than stored, so nothing
  // typed into either side would survive a refresh; said on the tab, not
  // discovered.
  const composerBlocked = mode === "reply" && (Boolean(blockKey) || windowClosed);
  const demoBlocked = isDemo;
  // What Send is about to do. A template only, and only on the Reply side.
  const sendingTemplate = mode === "reply" && windowClosed && Boolean(templateId);
  // ── Where the paperclip appears, and where it must not ─────────────────
  //
  // WhatsApp only, on the Reply side, with the composer actually usable.
  // lib/messaging/send.js refuses `media` on Facebook and Instagram BY NAME —
  // that refusal is the guard; this is what stops anybody meeting it after
  // uploading a photo. A note has no attachment either: a note never leaves
  // the building, and a picture attached to one would go nowhere.
  const mediaSupported =
    mode === "reply" &&
    thread?.platform === "whatsapp" &&
    !composerBlocked &&
    !demoBlocked;
  const sendingMedia = mediaSupported && Boolean(attachment);
  // The company's own pin, and only when the SERVER said there is one. A
  // company whose address was typed rather than picked from the autocomplete
  // has no coordinates, Meta requires them, and a "Send our address" button
  // that could only ever fail is the dead control this repo keeps finding.
  const companyLocation = mediaSupported ? thread?.companyLocation || null : null;
  const sendingLocation = Boolean(companyLocation) && pinAttached;
  // A template send needs no typed words, and neither does a picture — the
  // caption is optional — nor a pin. Everything else needs something in the
  // box.
  const allowEmpty = sendingTemplate || sendingMedia || sendingLocation;

  /**
   * Pick a file, check it against WhatsApp's own table, upload it.
   *
   * The check runs HERE as well as on the server, and the server's is the one
   * that decides. This one exists so a contractor holding a .mov or a 40 MB
   * photo is told which limit they hit BEFORE watching an upload bar fill on a
   * driveway connection.
   */
  async function pickAttachment(file) {
    setAttachError("");
    const verdict = classifyWhatsAppOutboundMedia(file);
    if (!verdict.ok) {
      setAttachError(verdict.message);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Widens the DOCUMENT allowlist from PDF-only to the eight formats
      // WhatsApp itself accepts, at WhatsApp's own ceiling. An opt-in rather
      // than a default — see MESSAGING_DOCUMENT_TYPES.
      form.append("purpose", "messaging");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAttachError(data.error || t("app.messages.media.uploadError"));
        return;
      }
      const data = await res.json();
      setAttachment({
        url: data.url,
        publicId: data.publicId,
        name: file.name || "",
        mimeType: verdict.mimeType,
        type: verdict.type,
      });
      // One Send button, two mutually exclusive message kinds at Meta.
      setPinAttached(false);
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const body = text.trim();
    if (!body && !allowEmpty) return;
    setSending(true);
    setSendError("");
    try {
      // TWO ROUTES, chosen here, and the note one does not import the send
      // path at all — see its header. A single endpoint with a `private` flag
      // would put a colleague's opinion of a customer one inverted boolean
      // away from that customer's inbox.
      const url =
        mode === "note"
          ? "/api/messaging/threads/" + encodeURIComponent(thread.id) + "/note"
          : "/api/messaging/threads/" + encodeURIComponent(thread.id) + "/reply";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sendingTemplate
            // The id and the values ONLY. No body, no name, no language: the
            // server looks the template up in its own rows, which is what
            // stops an approved template being used as an envelope for
            // arbitrary text. Same rule as add-on pricing (AGENTS.md #5).
            ? { kind: "template", templateId, params: templateParams }
            : sendingLocation
              // The INTENT and nothing else. No coordinates, no address: the
              // server reads this company's own row at the moment of sending.
              ? { kind: "location" }
              : sendingMedia
                // The URL and the public_id of an upload this company already
                // made — never bytes, and never a file the browser describes.
                ? {
                    kind: "media",
                    mediaUrl: attachment.url,
                    mediaPublicId: attachment.publicId,
                    mediaFilename: attachment.name,
                    mediaMimeType: attachment.mimeType,
                    text: body,
                  }
                : { text: body },
        ),
      });
      if (!res.ok) {
        // The server's own sentence — "no Page is connected", "that Page
        // needs reconnecting" — under the box, not a generic failure. It also
        // WROTE the attempt, so reloading shows the failed row above.
        await reportResponseError(
          res,
          setSendError,
          mode === "note" ? t("app.messages.note.error") : t("app.messages.compose.error"),
        );
        await onChanged?.();
        return;
      }
      setText("");
      setTemplateId(null);
      setTemplateParams([]);
      // Cleared only on a real send. A refusal above returns before this, so
      // a photo that did not go is still attached and can be tried again once
      // the reason is dealt with.
      setAttachment(null);
      setAttachError("");
      setPinAttached(false);
      await onChanged?.();
    } finally {
      setSending(false);
    }
  }

  // The window, said out loud — including while it is still OPEN and about
  // to close, which is the moment it is worth knowing. Only on the Reply
  // side: a private note has no window.
  const windowHint =
    mode === "reply" && windowNotice && (windowNotice.blockKey || windowNotice.warnKey) ? (
      <ServiceWindowNotice notice={windowNotice} t={t} />
    ) : null;
  // The demo reason already rides beside the Reply tab (ComposerTabs prints
  // `disabledReplyKey`); it is repeated here only on the Note side, where
  // the tabs print the note hint instead and the box would otherwise be off
  // with no sentence on it.
  const hint = demoBlocked ? (
    mode === "note" ? <span>{t("app.messages.compose.disabled.demo")}</span> : null
  ) : !canEdit ? (
    <span>{t("app.messages.compose.disabled.readOnly")}</span>
  ) : (
    windowHint
  );

  return (
    <div data-composer-area>
      <div className="border-t border-border px-3 pt-2" data-composer-extras>
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
        {/* The paperclip, and whatever is waiting to go with the next
            message. Above the box rather than inside it: at 375px an icon
            inside a one-line textarea competes with Send for the same thumb. */}
        <AttachControl
          supported={mediaSupported}
          pending={attachment}
          uploading={uploading}
          errorText={attachError}
          onPick={pickAttachment}
          onClear={() => {
            setAttachment(null);
            setAttachError("");
          }}
          accept={WHATSAPP_MEDIA_ACCEPT}
          disabled={sending}
          location={companyLocation}
          sendingLocation={sendingLocation}
          onPickLocation={() => {
            setPinAttached(true);
            // A pin and a file are two different messages at Meta, and there
            // is one Send button. Attaching one clears the other.
            setAttachment(null);
            setAttachError("");
          }}
          onClearLocation={() => setPinAttached(false)}
          t={t}
        />
      </div>
      <Composer
        textareaId="messages-reply"
        value={text}
        onChange={setText}
        onSend={send}
        busy={sending || uploading}
        // Off entirely for a demo, for a read-only member, and when the
        // connection blocks a reply nothing else could carry.
        disabled={demoBlocked || !canEdit || (composerBlocked && !allowEmpty)}
        // The TYPING box alone: a closed window disables the words, not the
        // Send button, which stays alive to post the chosen template. A pin
        // disables it too, and this is not a style choice: WhatsApp's
        // location message has NO caption field, and a box that accepted
        // words the send would silently drop is the control that appears to
        // work — so it is off, and the placeholder says why.
        inputDisabled={composerBlocked || sendingLocation}
        allowEmpty={allowEmpty}
        hint={hint}
        // The box is dressed as what it is about to write, before a word is
        // typed — the moment the mistake would otherwise be made.
        textareaStyle={
          mode === "note" && note?.bg
            ? { backgroundColor: note.bg, color: note.fg, borderColor: note.border }
            : undefined
        }
        placeholder={
          mode === "note"
            ? t("app.messages.note.placeholder")
            : sendingLocation
              ? t("app.messages.media.locationNoCaption")
              : sendingMedia
                // The box becomes a caption box the moment a file is attached,
                // because that is what it now is.
                ? t("app.messages.media.captionPlaceholder")
                : t("app.messages.compose.placeholder")
        }
        sendLabel={
          mode === "note"
            ? t("app.messages.note.save")
            : sendingTemplate
              ? t("app.messages.template.send")
              : t("app.messages.compose.send")
        }
        footer={
          sendError ? (
            <span className="text-destructive" data-send-error>
              {sendError}
            </span>
          ) : mode === "note" ? (
            t("app.messages.note.onlyYourTeam")
          ) : null
        }
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The context bar's three tabs
// ═══════════════════════════════════════════════════════════════════════════

const DL_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function ContextDetails({ thread, people, busy, canEdit, onPatch, formatDate, t }) {
  const firstContact = thread.firstInboundAt || thread.createdAt || null;
  const links = [
    thread.clientId
      ? { key: "client", href: `/app/clients/${encodeURIComponent(thread.clientId)}`, label: t("app.messages.action.openClient"), name: thread.client?.name || null }
      : null,
    thread.leadId ? { key: "lead", href: `/app/leads?lead=${encodeURIComponent(thread.leadId)}`, label: t("app.messages.action.openLead") } : null,
    thread.jobId ? { key: "job", href: `/app/jobs/${encodeURIComponent(thread.jobId)}`, label: t("app.messages.action.openJob") } : null,
    thread.quoteId ? { key: "quote", href: `/app/quotes/${encodeURIComponent(thread.quoteId)}`, label: t("app.messages.action.openQuote") } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4" data-context-details>
      <dl className="space-y-3">
        <div>
          <dt className={DL_LABEL}>{t("app.messages.details.name")}</dt>
          <dd className="text-sm text-foreground break-words">{thread.participantName || t("app.messages.unknownPerson")}</dd>
        </div>
        <div>
          <dt className={DL_LABEL}>{t("app.messages.details.channel")}</dt>
          <dd className="text-sm text-foreground">
            <PlatformBadge platform={thread.platform} t={t} />
            {thread.channelName ? <span className="ml-1 text-xs text-muted-foreground">· {thread.channelName}</span> : null}
          </dd>
        </div>
        {/* No profile link, on purpose: Messenger and Instagram hand a Page a
            page-scoped id, not a username, and there is no public URL to
            build from one. A link that opened nothing would be the dead
            control this repo keeps finding. */}
        {firstContact ? (
          <div>
            <dt className={DL_LABEL}>{t("app.messages.details.firstContact")}</dt>
            <dd className="text-sm text-foreground tabular-nums">{formatDate(new Date(firstContact))}</dd>
          </div>
        ) : null}
        {Number.isFinite(thread.threadNumber) ? (
          <div>
            <dt className={DL_LABEL}>{t("app.messages.details.number")}</dt>
            <dd className="text-sm text-foreground tabular-nums">{t("app.messages.threadNumber", { n: thread.threadNumber })}</dd>
          </div>
        ) : null}
        <div>
          <dt className={DL_LABEL}>{t("app.messages.details.linked")}</dt>
          <dd className="text-sm text-foreground">
            {links.length ? (
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l.key}>
                    <Link href={l.href} className="inline-flex min-h-[36px] items-center gap-1.5 underline">
                      <ExternalLink size={12} aria-hidden="true" />
                      {l.label}
                      {l.name ? <span className="text-muted-foreground">· {l.name}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground">{t("app.messages.details.notLinked")}</span>
            )}
          </dd>
        </div>
      </dl>

      {/* ── Where it sits, and who has it ─────────────────────────────────
          The two questions the outcome control could never answer: an
          outcome is what a conversation TURNED OUT to be, and these are
          what is happening with it now. */}
      {canEdit ? (
        <StatusControl thread={thread} busy={busy} onPatch={onPatch} t={t} />
      ) : (
        <div>
          <p className={DL_LABEL}>{t("app.messages.status.question")}</p>
          <p className="mt-1 text-sm text-foreground">{t(`app.messages.status.${thread.status}`)}</p>
        </div>
      )}
      {canEdit ? (
        <AssigneePicker
          value={thread.assignedToId}
          people={people}
          onPick={(id) => onPatch({ assignedToId: id }, "app.messages.assignee.saveError")}
          busy={busy}
          t={t}
        />
      ) : null}
    </div>
  );
}

/**
 * The four states, and the snooze that has to come back. Snoozing is the one
 * state that needs a second answer: the date field is revealed rather than
 * the status being written with a made-up deadline — "parked until sometime"
 * is how a lead disappears. The route refuses the same thing.
 */
function StatusControl({ thread, busy, onPatch, t }) {
  const [askingSnooze, setAskingSnooze] = useState(false);
  const [snoozeAt, setSnoozeAt] = useState("");
  useEffect(() => {
    setAskingSnooze(false);
    setSnoozeAt("");
  }, [thread.id]);

  function pickStatus(status) {
    if (status === "snoozed") {
      setAskingSnooze(true);
      return;
    }
    setAskingSnooze(false);
    onPatch({ status }, "app.messages.status.saveError");
  }

  async function confirmSnooze() {
    if (!snoozeAt) return;
    const saved = await onPatch(
      { status: "snoozed", snoozedUntil: new Date(snoozeAt).toISOString() },
      "app.messages.status.saveError",
    );
    if (saved) {
      setAskingSnooze(false);
      setSnoozeAt("");
    }
  }

  return (
    <div className="space-y-2">
      <StatusPicker value={thread.status} snoozedUntil={thread.snoozedUntil} onPick={pickStatus} busy={busy} t={t} />
      {askingSnooze && (
        <div className="flex flex-wrap items-end gap-2" data-snooze-form>
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
            disabled={!snoozeAt || busy}
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
    </div>
  );
}

/**
 * The Outcome tab: what the conversation says about itself, then the
 * judgement. Temperature above the outcome, on purpose — the outcome is
 * recorded after the fact; the temperature is the question being asked while
 * the conversation is still live, and it is the one a contractor can act on.
 * Under the control, what each answer means, so "No reply" and "Not a job"
 * are not guessed at.
 */
function ContextOutcome({ thread, isDemo, busy, onPick, t }) {
  return (
    <div className="space-y-4" data-context-outcome>
      <ConversationTemperature
        threadId={thread.id}
        isDemo={isDemo}
        // Rescored when a message goes out or the outcome moves: the stored
        // columns have changed and a stale panel beside a fresh thread is two
        // answers to one question.
        refreshKey={(thread.messages || []).length + String(thread.outcome || "")}
      />
      <OutcomePicker value={thread.outcome} onPick={onPick} busy={busy} t={t} />
      <dl className="space-y-1.5 text-xs" data-outcome-meanings>
        {[...THREAD_OUTCOMES, "open"].map((o) => (
          <div key={o} className="flex gap-2">
            <dt className="w-20 shrink-0 font-semibold text-foreground">
              {o === "open" ? t("app.messages.outcome.open") : t(outcomeLabelKey(o))}
            </dt>
            <dd className="text-muted-foreground break-words">{t(`app.messages.outcome.meaning.${o}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The History tab: every activity row on this conversation — the outcome
 * changes, the status moves, who took it, what was linked — in order, from
 * the same rows the thread draws as system lines; and the month-end review
 * this conversation counts in, which is the month it STARTED (that is how
 * lib/messaging/monthlyReview.js files it).
 */
function ContextHistory({ thread, formatDate, t }) {
  const events = (thread.messages || [])
    .filter((m) => m.direction === "activity")
    .map((m) => ({ id: m.id, at: m.sentAt, sentence: activitySentence(m.activity, t) }))
    .filter((e) => e.sentence);
  const started = thread.firstInboundAt || thread.createdAt || null;
  const startedAt = started ? new Date(started) : null;
  const month = startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : null;
  const monthLabel = month
    ? month.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const reviewHref = month
    ? `/app/messages/review?year=${month.getUTCFullYear()}&month=${month.getUTCMonth() + 1}`
    : "/app/messages/review";

  return (
    <div className="space-y-4" data-context-history>
      {events.length ? (
        <ol className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="text-foreground break-words">{e.sentence}</p>
              {e.at ? (
                <time dateTime={new Date(e.at).toISOString()} className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(new Date(e.at))}{" "}
                  {new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </time>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground break-words">{t("app.messages.history.empty")}</p>
      )}
      <div className="rounded-lg border border-border p-3">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground break-words">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          {monthLabel
            ? t("app.messages.history.reviewMonth", { month: monthLabel })
            : t("app.messages.history.reviewMonthUnknown")}
        </p>
        <Link href={reviewHref} className={`${ACTION} mt-2 min-h-[44px]`}>
          <BarChart3 size={13} aria-hidden="true" /> {t("app.messages.history.openReview")}
        </Link>
      </div>
    </div>
  );
}
