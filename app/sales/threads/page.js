// app/sales/threads/page.js
//
// The rep's email, as an inbox — the mailbox the owner connected for them,
// read and answered from here.
//
// ══ Three panes, ours; the craft, Zero's ══════════════════════════════════
//
// The owner: "the UI should be closer to Zero's, and I do like how we still
// have that side pane with the company's information, history and other
// exchanged info." So the shape is the one /sales/messages already has —
// conversations down the left, the thread in the middle, the contact on the
// right, all from app/components/chat — and what is taken from Zero
// (docs/sales-intel/ZERO-STUDY.md) is the inbox craft: unread rows bold with
// the time in colour, the row's labels, only the latest message open with
// the earlier ones folded to a line, quoted text behind a disclosure, the
// reply box pinned under the thread, j/k/Enter/r/a/f/c/e/u/`/`, search
// across subject, body and name, and a draft kept while the rep types.
//
// ══ Every fact on the screen is the server's ══════════════════════════════
//
// Unread, the labels, the recipient set, whether the box may send, whether
// the mailbox is connected — all arrive with the rows
// (app/api/sales/threads, lib/sales/emailInbox.js, lib/sales/outreachReadiness.js).
// This file draws them. The one thing it writes on its own is the read
// marker, and it writes that by asking the server (PATCH read: true) after
// the thread has rendered, so the marker moves only when a person looked.
//
// ══ Two sections, because the mailbox is the rep's whole mailbox ══════════
//
// "Your leads" first — threads matched to one of the rep's leads — then
// "Everything else": the colleague, the supplier, the newsletter. A thread
// moves up the moment a lead with that address exists (the sync re-matches).
//
// ══ Bodies are text ═══════════════════════════════════════════════════════
//
// An inbound body is written by a stranger and arrives through a mail
// server. It is stored as text and rendered inside a `whitespace-pre-wrap`
// element — never with dangerouslySetInnerHTML. A prospect who replies with
// a <script> tag gets a prospect who appears to have typed a <script> tag.
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  ExternalLink,
  Forward,
  Keyboard,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PencilLine,
  Reply,
  ReplyAll,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { jsonBody } from "@/lib/jsonBody";
import { useTranslation } from "@/app/hooks/useTranslation";
import { ChatLayout, RoomList, ContextBar, PANE_LIST, PANE_THREAD, PANE_CONTEXT, CONTEXT_COLUMN_MIN_WIDTH, initialsOf, roomTimeLabel } from "@/app/components/chat";
import { LEAD_STATUS_LABELS } from "@/lib/sales/outreachPipeline";
import { CallHistoryStrip } from "@/app/components/sales/CallHistory";
import ReviewedByOwner from "@/app/components/sales/ReviewedByOwner";
import OutreachNotice from "../leads/OutreachNotice";
import EmailComposer from "./EmailComposer";

const FRAME_HEIGHT = "fq-sales-fill";
const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const ACTION =
  "inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[36px] whitespace-nowrap rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60";
const TAG = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";
const FOLDERS = ["inbox", "archived", "all"];

function when(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Does the viewport have room for the context bar as a column? */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${CONTEXT_COLUMN_MIN_WIDTH.wide}px)`);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

/** Is the key event happening inside something that takes typing? */
function inTypingTarget(e) {
  const el = e.target;
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function nameOf(thread, t) {
  return thread?.lead?.contactName || thread?.lead?.businessName || thread?.counterpart || t("app.salesNotes.threadThem");
}

// ═══════════════════════════════════════════════════════════════════════════
// The row's labels
// ═══════════════════════════════════════════════════════════════════════════
function LabelChips({ labels, draft, attachment, compact = false }) {
  const { t } = useTranslation();
  const chips = [];
  if (labels?.needsReply) chips.push(["needsReply", "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"]);
  if (labels?.waiting) chips.push(["waiting", "bg-muted text-muted-foreground"]);
  if (labels?.checkInDue) chips.push(["checkInDue", "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"]);
  return (
    <span className="flex shrink-0 items-center gap-1">
      {attachment ? <Paperclip size={12} aria-label={t("app.salesInbox.label.attachment")} className="text-muted-foreground" /> : null}
      {draft ? <PencilLine size={12} aria-label={t("app.salesInbox.label.draft")} className="text-amber-700 dark:text-amber-300" /> : null}
      {chips.slice(0, compact ? 1 : 3).map(([key, cls]) => (
        <span key={key} className={`${TAG} ${cls}`}>
          {t(`app.salesInbox.label.${key}`)}
        </span>
      ))}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// One message in the thread
// ═══════════════════════════════════════════════════════════════════════════
function Message({ message, expanded, onToggle, onReply, onForward, them }) {
  const { t } = useTranslation();
  const [showQuoted, setShowQuoted] = useState(false);
  const mine = message.direction === "out";
  const who = mine ? t("app.salesInbox.message.you") : message.fromAddress || them;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-baseline gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted/60"
      >
        <span className={`truncate text-sm ${mine ? "text-muted-foreground" : "font-medium text-foreground"}`}>{who}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{message.visible?.split("\n")[0] || ""}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{roomTimeLabel(message.sentAt, t)}</span>
      </button>
    );
  }

  return (
    <article className="rounded-lg border border-border bg-card" data-message-direction={message.direction}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-3 py-2">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className={`block truncate text-sm ${mine ? "text-muted-foreground" : "font-semibold text-foreground"}`}>{who}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {t("app.salesInbox.message.to")} {message.toAddress}
            {message.ccAddresses ? ` · ${t("app.salesInbox.message.cc")} ${message.ccAddresses}` : ""}
          </span>
        </button>
        <time dateTime={new Date(message.sentAt).toISOString()} className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {when(message.sentAt)}
        </time>
        <span className="flex shrink-0 gap-1">
          <button type="button" onClick={() => onReply(message, "reply")} className={ACTION} title={t("app.salesInbox.compose.reply")}>
            <Reply size={13} aria-hidden="true" /> {t("app.salesInbox.compose.reply")}
          </button>
          <button type="button" onClick={() => onForward(message)} className={ACTION} title={t("app.salesInbox.compose.forward")}>
            <Forward size={13} aria-hidden="true" /> {t("app.salesInbox.compose.forward")}
          </button>
        </span>
      </header>
      <div className="px-3 py-3 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {message.visible}
        {message.quoted ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowQuoted((v) => !v)}
              aria-expanded={showQuoted}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {showQuoted ? t("app.salesInbox.message.hideQuoted") : t("app.salesInbox.message.showQuoted")}
            </button>
            {showQuoted ? (
              <blockquote className="mt-2 border-l-2 border-border pl-3 text-muted-foreground whitespace-pre-wrap">{message.quoted}</blockquote>
            ) : null}
          </div>
        ) : null}
      </div>
      {message.attachments?.length ? (
        <ul className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
          {message.attachments.map((a) => (
            <li key={`${a.index}-${a.filename}`}>
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer" className={`${TAG} border border-border text-foreground hover:bg-muted`}>
                  <Paperclip size={11} aria-hidden="true" /> {a.filename}
                </a>
              ) : (
                <span className={`${TAG} border border-dashed border-border text-muted-foreground`}>
                  <Paperclip size={11} aria-hidden="true" /> {t("app.salesInbox.message.attachmentUnavailable", { name: a.filename })}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The company pane — the same tabs the Texts screen draws
// ═══════════════════════════════════════════════════════════════════════════
function Field({ label, children, mono = false }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`text-sm text-foreground break-words ${mono ? "tabular-nums" : ""}`}>{children}</dd>
    </div>
  );
}

function ContactDetails({ detail }) {
  const { t } = useTranslation();
  const thread = detail?.thread;
  const lead = thread?.lead;
  const prospect = lead?.prospect;
  return (
    <div className="space-y-4">
      {!lead ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">{t("app.salesInbox.thread.notALead")}</p>
      ) : null}
      <dl className="space-y-3">
        <Field label={t("app.salesText.fieldBusiness")}>{lead?.businessName || null}</Field>
        <Field label={t("app.salesText.fieldContactName")}>{lead?.contactName || null}</Field>
        <Field label={t("app.salesText.fieldEmail")}>{lead?.email || thread?.counterpart || null}</Field>
        <Field label={t("app.salesText.fieldNumber")} mono>
          {lead?.phone || null}
        </Field>
        <Field label={t("app.salesText.fieldTrade")}>{prospect?.tradeKey || null}</Field>
        <Field label={t("app.salesText.fieldPlace")}>{[prospect?.city || null, lead?.province || prospect?.province || null].filter(Boolean).join(", ") || null}</Field>
        <Field label={t("app.salesText.fieldTimeZone")}>{lead?.timeZone || null}</Field>
        <Field label={t("app.salesText.fieldLeadStage")}>
          {lead?.status ? t(`app.salesLeads.status.${lead.status}`, LEAD_STATUS_LABELS[lead.status] || lead.status) : null}
        </Field>
      </dl>
      {lead?.id ? <CallHistoryStrip leadId={lead.id} limit={3} /> : null}
      <div className="flex flex-col gap-2">
        {lead ? (
          <Link href={`/sales/leads/${lead.id}`} className={`${BTN} border border-border text-foreground w-full`}>
            <ExternalLink size={15} aria-hidden="true" /> {t("app.salesText.actionOpenLead")}
          </Link>
        ) : null}
        {lead?.phone ? (
          <Link href={`/sales/messages?leadId=${encodeURIComponent(lead.id)}`} className={`${BTN} border border-border text-foreground w-full`}>
            {t("app.salesInbox.thread.openTexts")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ContactHistory({ detail }) {
  const { t } = useTranslation();
  const calls = detail?.calls || [];
  const threads = detail?.otherThreads || [];
  const checkIns = detail?.checkIns || [];
  const outcome = (c) =>
    c.disposition ? t(`app.salesCall.disposition.${c.disposition}.label`, c.disposition) : c.answered ? t("app.salesText.callAnswered") : t("app.salesText.callNoOutcome");
  const Section = ({ title, children }) => (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
  const None = () => <p className="text-xs text-muted-foreground">{t("app.salesText.historyNone")}</p>;
  return (
    <div className="space-y-4">
      <Section title={t("app.salesText.historyCalls")}>
        {!calls.length ? <None /> : (
          <ul className="space-y-1">
            {calls.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {c.direction === "in" ? t("app.salesText.callInbound") : t("app.salesText.callOutbound")} · {outcome(c)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{when(c.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("app.salesText.historyEmailThreads")}>
        {!threads.length ? <None /> : (
          <ul className="space-y-1">
            {threads.map((th) => (
              <li key={th.id} className="text-sm">
                <Link href={`/sales/threads?open=${encodeURIComponent(th.id)}`} className="underline text-foreground break-words">
                  {th.subject}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">{when(th.lastMessageAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("app.salesText.historyCheckIns")}>
        {!checkIns.length ? <None /> : (
          <ul className="space-y-1">
            {checkIns.map((c) => (
              <li key={c.id} className="text-sm text-foreground">
                {t("app.salesText.draftBadge")}
                {c.scheduledFor ? ` · ${when(c.scheduledFor)}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// New email — pick one of your leads
// ═══════════════════════════════════════════════════════════════════════════
function LeadPicker({ onPick, onClose }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    // Any address on the lead counts — its own, the prospect's, or one the rep
    // added on the card. A lead reachable only at an address she found
    // herself used to be missing from this list entirely, and the email she
    // then wrote from her phone landed in "Everything else".
    fetchJson("/api/sales/leads")
      .then((d) => setLeads((d.leads || []).filter((l) => (l.emails || []).length || l.email)))
      .catch((err) => setError(err.message));
  }, []);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const matches = (l) => !term || [l.businessName, l.contactName, l.email, ...(l.emails || [])].some((v) => String(v || "").toLowerCase().includes(term));
    // An address typed in full puts the lead it belongs to first — "About:"
    // pre-selected by the address, the rest of the list still there under it.
    const exact = (l) => (l.emails || []).includes(term) || String(l.email || "").toLowerCase() === term;
    return (leads || []).filter(matches).sort((a, b) => Number(exact(b)) - Number(exact(a))).slice(0, 50);
  }, [leads, q]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{t("app.salesInbox.picker.title")}</h2>
        <button type="button" onClick={onClose} aria-label={t("app.chat.close")} className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="p-3">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("app.salesInbox.picker.search")}
          aria-label={t("app.salesInbox.picker.search")}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      {error ? <p className="px-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {leads === null && !error ? (
          <li className="px-2 py-2 text-sm text-muted-foreground">{t("app.salesNotes.loading")}</li>
        ) : shown.length === 0 ? (
          <li className="px-2 py-2 text-sm text-muted-foreground">{t("app.salesInbox.picker.none")}</li>
        ) : (
          shown.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => onPick(l)} className="flex w-full flex-col items-start rounded-lg px-2 py-2 text-left hover:bg-muted">
                <span className="text-sm font-medium text-foreground">{l.businessName}</span>
                <span className="text-xs text-muted-foreground">{[l.contactName, ...(l.emails?.length ? l.emails : [l.email])].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Keyboard shortcuts — the sheet behind `?`
// ═══════════════════════════════════════════════════════════════════════════
const KEYS = [
  ["j / k", "next"],
  ["Enter", "open"],
  ["r", "reply"],
  ["a", "replyAll"],
  ["f", "forward"],
  ["c", "compose"],
  ["/", "search"],
  ["e", "archive"],
  ["u", "unread"],
  ["Ctrl+Enter", "send"],
  ["Esc", "close"],
];
function KeysSheet({ onClose }) {
  const { t } = useTranslation();
  return (
    <div role="dialog" aria-modal="true" aria-label={t("app.salesInbox.keys.title")} className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{t("app.salesInbox.keys.title")}</h2>
          <button type="button" onClick={onClose} aria-label={t("app.chat.close")} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {KEYS.map(([key, label]) => (
            <div key={key} className="contents">
              <dt><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{key}</kbd></dt>
              <dd className="text-foreground">{t(`app.salesInbox.keys.${label}`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The screen
// ═══════════════════════════════════════════════════════════════════════════
function SalesInboxScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const wide = useWide();

  const openParam = params.get("open") || null;
  const composeLeadParam = params.get("compose") || null;

  const [folder, setFolder] = useState(FOLDERS.includes(params.get("folder")) ? params.get("folder") : "inbox");
  const [q, setQ] = useState(params.get("q") || "");
  const [list, setList] = useState(null);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState(openParam);
  const [focusId, setFocusId] = useState(openParam);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [pane, setPane] = useState(openParam || composeLeadParam ? PANE_THREAD : PANE_LIST);
  const [showContext, setShowContext] = useState(true);
  const [contextTab, setContextTab] = useState("details");
  // The reply box: { kind, quoted } or null. Opened by r/a/f or a button.
  const [composer, setComposer] = useState(null);
  // New email: the lead chosen, or "pick" while the picker is up.
  const [composeLead, setComposeLead] = useState(null);
  const [picking, setPicking] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const searchRef = useRef(null);
  const threadScrollRef = useRef(null);

  // ── The list ────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListError("");
    try {
      const data = await fetchJson(`/api/sales/threads?folder=${encodeURIComponent(folder)}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`);
      setList(data);
    } catch (err) {
      setListError(err.message);
    }
  }, [folder, q]);

  useEffect(() => {
    const handle = setTimeout(loadList, q ? 250 : 0);
    return () => clearTimeout(handle);
  }, [loadList, q]);

  // Re-read while the tab is visible: a minute is the sync's own cadence.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") loadList();
    };
    const id = setInterval(tick, 60 * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [loadList]);

  // ── The thread ──────────────────────────────────────────────────────────
  const loadDetail = useCallback(async (id) => {
    setDetailError("");
    try {
      const data = await fetchJson(`/api/sales/threads/${encodeURIComponent(id)}`);
      setDetail(data);
      // Only the latest message open; the rest fold to a line.
      const last = data.thread?.messages?.[data.thread.messages.length - 1];
      setExpanded(new Set(last ? [last.id] : []));
      setComposer(null);
      return data;
    } catch (err) {
      setDetailError(err.message);
      return null;
    }
  }, []);

  const markRead = useCallback(
    async (id) => {
      try {
        await fetchJson(`/api/sales/threads/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: jsonBody({ read: true }, "read") });
        setList((prev) =>
          prev ? { ...prev, threads: prev.threads.map((th) => (th.id === id ? { ...th, labels: { ...th.labels, unread: false } } : th)) } : prev,
        );
      } catch {
        /* the marker is a courtesy; the next open tries again */
      }
    },
    [],
  );

  const open = useCallback(
    async (id) => {
      setSelectedId(id);
      setFocusId(id);
      setComposeLead(null);
      setPicking(false);
      setPane(PANE_THREAD);
      const url = new URL(window.location.href);
      url.searchParams.set("open", id);
      url.searchParams.delete("compose");
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
      const data = await loadDetail(id);
      if (data?.thread?.labels?.unread) await markRead(id);
    },
    [router, loadDetail, markRead],
  );

  useEffect(() => {
    if (openParam && openParam !== detail?.thread?.id) {
      setSelectedId(openParam);
      loadDetail(openParam).then((data) => {
        if (data?.thread?.labels?.unread) markRead(openParam);
      });
    }
    // The URL is the source on first render only; open() keeps it in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openParam]);

  useEffect(() => {
    if (!composeLeadParam) return;
    fetchJson(`/api/sales/leads/${encodeURIComponent(composeLeadParam)}`)
      .then((d) => {
        const lead = d.lead || d;
        if (lead?.id) {
          setComposeLead(lead);
          setSelectedId(null);
          setDetail(null);
          setPane(PANE_THREAD);
        }
      })
      .catch((err) => setDetailError(err.message));
  }, [composeLeadParam]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const rows = list?.threads || [];
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const patch = useCallback(
    async (id, data) => {
      try {
        await fetchJson(`/api/sales/threads/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: jsonBody(data, "thread") });
        await loadList();
        if (detail?.thread?.id === id) await loadDetail(id);
      } catch (err) {
        setDetailError(err.message);
      }
    },
    [loadList, loadDetail, detail],
  );

  const archive = useCallback(
    async (id) => {
      const at = visibleIds.indexOf(id);
      await patch(id, { archived: folder !== "archived" });
      if (folder !== "all") {
        const next = visibleIds[at + 1] || visibleIds[at - 1] || null;
        if (next && next !== id) open(next);
        else {
          setSelectedId(null);
          setDetail(null);
          setPane(PANE_LIST);
        }
      }
    },
    [visibleIds, patch, folder, open],
  );

  const startReply = useCallback(
    (message, kind) => {
      if (!detail?.thread) return;
      setComposer({ kind, quoted: message || detail.thread.messages[detail.thread.messages.length - 1] || null });
      setTimeout(() => threadScrollRef.current?.scrollTo({ top: threadScrollRef.current.scrollHeight }), 0);
    },
    [detail],
  );

  const startCompose = useCallback(() => {
    setPicking(true);
    setComposeLead(null);
    setPane(PANE_THREAD);
  }, []);

  // ── Keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (keysOpen) {
        if (e.key === "Escape") setKeysOpen(false);
        return;
      }
      if (inTypingTarget(e)) {
        if (e.key === "Escape" && e.target === searchRef.current) searchRef.current.blur();
        return;
      }
      const at = focusId ? visibleIds.indexOf(focusId) : -1;
      switch (e.key) {
        case "j":
        case "ArrowDown": {
          const next = visibleIds[Math.min(visibleIds.length - 1, at + 1)];
          if (next) {
            e.preventDefault();
            open(next);
          }
          break;
        }
        case "k":
        case "ArrowUp": {
          const prev = visibleIds[Math.max(0, at - 1)];
          if (prev) {
            e.preventDefault();
            open(prev);
          }
          break;
        }
        case "Enter":
          if (focusId) open(focusId);
          break;
        case "r":
          if (detail?.thread) startReply(null, "reply");
          break;
        case "a":
          if (detail?.thread) startReply(null, "replyAll");
          break;
        case "f":
          if (detail?.thread) startReply(null, "forward");
          break;
        case "c":
          e.preventDefault();
          startCompose();
          break;
        case "/":
          e.preventDefault();
          searchRef.current?.focus();
          break;
        case "e":
          if (selectedId) archive(selectedId);
          break;
        case "u":
          if (selectedId) patch(selectedId, { read: false });
          break;
        case "?":
          setKeysOpen(true);
          break;
        case "Escape":
          if (composer) setComposer(null);
          else if (picking) setPicking(false);
          else if (pane !== PANE_LIST) setPane(PANE_LIST);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keysOpen, focusId, visibleIds, open, detail, startReply, startCompose, selectedId, archive, patch, composer, picking, pane]);

  // ── The list pane ───────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const room = (th) => ({
      id: th.id,
      title: th.lead?.contactName || th.lead?.businessName || th.counterpart || t("app.salesNotes.threadThem"),
      // Two lines under the name, the way Zero draws a row: the subject,
      // then the last message's first words. Each line truncates on its own.
      subtitle: (
        <span className="block min-w-0">
          <span className="block truncate">{th.subject}</span>
          {th.last?.snippet ? <span className="block truncate text-muted-foreground/80">{th.last.snippet}</span> : null}
        </span>
      ),
      time: th.lastMessageAt,
      unread: th.labels?.unread ? 1 : 0,
      initials: initialsOf(th.lead?.contactName || th.lead?.businessName || th.counterpart || "?"),
      tone: "them",
      badges: <LabelChips labels={th.labels} draft={Boolean(th.draftId)} attachment={th.last?.hasAttachments} compact />,
    });
    const leads = rows.filter((r) => r.section === "leads").map(room);
    const other = rows.filter((r) => r.section !== "leads").map(room);
    return [
      { key: "leads", title: t("app.salesInbox.section.leads"), rooms: leads, unread: leads.filter((r) => r.unread).length },
      { key: "other", title: t("app.salesInbox.section.other"), rooms: other, unread: other.filter((r) => r.unread).length },
    ];
  }, [rows, t]);

  const mailbox = list?.mailbox;
  const listHeader = (
    <div className="border-b border-border px-3 pb-2 pt-3" data-tour="sales-conversations">
      <div className="flex items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-foreground flex items-center gap-2">
          <Mail size={17} className="text-muted-foreground" aria-hidden="true" />
          {t("app.salesNotes.threadsHeading")}
          {Number.isFinite(list?.unread) && list.unread > 0 ? <span className="rounded-full bg-primary/10 px-2 text-xs text-primary">{list.unread}</span> : null}
        </h1>
        <button type="button" onClick={startCompose} className={`${ACTION} bg-inverted text-inverted-foreground border-transparent`}>
          <PencilLine size={13} aria-hidden="true" /> {t("app.salesInbox.newEmail")}
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-2">
        <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("app.salesInbox.search.placeholder")}
          aria-label={t("app.salesInbox.search.placeholder")}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
        {q ? (
          <button type="button" onClick={() => setQ("")} aria-label={t("app.chat.close")} className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-foreground">
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
      </label>
      <div className="mt-2 flex items-center gap-1">
        <div role="tablist" className="flex min-w-0 flex-1 gap-1">
        {FOLDERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={folder === f}
            onClick={() => setFolder(f)}
            className={`rounded-full px-2.5 py-1 text-xs ${folder === f ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t(`app.salesInbox.folder.${f}`)}
          </button>
        ))}
        </div>
        <button type="button" onClick={() => setKeysOpen(true)} aria-label={t("app.salesInbox.keys.title")} title={t("app.salesInbox.keys.title")} className="hidden h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:grid">
          <Keyboard size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const listEmpty = (
    <div className="px-4 py-6 text-sm text-muted-foreground">
      {listError ? (
        <span className="text-red-700 dark:text-red-300">{listError}</span>
      ) : list === null ? (
        <span className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.salesNotes.loading")}
        </span>
      ) : q.trim() ? (
        t("app.salesInbox.emptySearch", { q: q.trim() })
      ) : mailbox && !mailbox.connected ? (
        <span>
          <span className="block font-medium text-foreground">{t("app.salesInbox.notConnected.title")}</span>
          <span className="block mt-1">
            {mailbox.address ? t("app.salesInbox.notConnected.body", { address: mailbox.address }) : t("app.salesInbox.notConnected.noAddress")}
          </span>
        </span>
      ) : (
        t("app.salesInbox.empty")
      )}
    </div>
  );

  const listPane = (
    <RoomList
      header={listHeader}
      groups={groups}
      selectedId={selectedId}
      focusedId={focusId}
      onFocusItem={setFocusId}
      onSelect={(room) => open(room.id)}
      empty={listEmpty}
      ariaLabel={t("app.salesNotes.threadsHeading")}
    />
  );

  // ── The thread pane ─────────────────────────────────────────────────────
  const thread = detail?.thread;
  const outreach = detail?.outreach || list?.outreach;
  const optedOut = Boolean(detail?.optedOut);
  const optedOutReason = detail?.optedOutReasonKey
    ? t(detail.optedOutReasonKey, { ...(detail.optedOutReasonParams || {}), date: detail.optedOutReasonParams?.date || t("app.salesSuppression.dateNotRecorded") })
    : detail?.optedOutReason;
  const canReply = Boolean(outreach?.canSend) && !optedOut;
  const them = nameOf(thread, t);

  const mobileBack = (
    <button type="button" onClick={() => setPane(PANE_LIST)} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden" aria-label={t("app.salesInbox.thread.back")}>
      <ArrowLeft size={16} aria-hidden="true" />
    </button>
  );

  let threadPane;
  if (picking) {
    threadPane = (
      <LeadPicker
        onClose={() => setPicking(false)}
        onPick={(lead) => {
          setPicking(false);
          setComposeLead(lead);
          setSelectedId(null);
          setDetail(null);
        }}
      />
    );
  } else if (composeLead) {
    // The lead's addresses in the order the server gives them (its own first,
    // then the prospect's, then the card's). The first is the To; the rest are
    // offered as chips. A lead opened from ?compose= carries only `email`.
    const composeAddresses = (composeLead.emails?.length ? composeLead.emails : [composeLead.email]).filter(Boolean);
    threadPane = (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          {mobileBack}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">{t("app.salesInbox.compose.newTo", { name: composeLead.businessName })}</h2>
            <p className="truncate text-xs text-muted-foreground">{composeAddresses.join(" · ")}</p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <OutreachNotice outreach={outreach} />
        </div>
        {outreach?.canSend ? (
          <EmailComposer
            kind="new"
            leadId={composeLead.id}
            recipients={composeAddresses.map((address, i) => ({ address, source: i === 0 && composeLead.email ? "lead" : "contact" }))}
            initialTo={composeAddresses.slice(0, 1)}
            from={outreach?.from}
            onClose={() => {
              setComposeLead(null);
              setPane(PANE_LIST);
            }}
            onSent={async (result) => {
              setComposeLead(null);
              await loadList();
              if (result?.threadId) open(result.threadId);
            }}
          />
        ) : null}
      </div>
    );
  } else if (!selectedId) {
    threadPane = (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <Mail size={28} className="text-muted-foreground/60" aria-hidden="true" />
        {mailbox && !mailbox.connected ? (
          <>
            <p className="font-medium text-foreground">{t("app.salesInbox.notConnected.title")}</p>
            <p>{mailbox.address ? t("app.salesInbox.notConnected.body", { address: mailbox.address }) : t("app.salesInbox.notConnected.noAddress")}</p>
          </>
        ) : (
          <p>{t("app.salesInbox.thread.pickOne")}</p>
        )}
      </div>
    );
  } else if (!thread) {
    threadPane = (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        {detailError ? <span className="text-red-700 dark:text-red-300">{detailError}</span> : (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("app.salesNotes.loading")}
          </span>
        )}
      </div>
    );
  } else {
    const messages = thread.messages || [];
    const folded = messages.filter((m) => !expanded.has(m.id)).length;
    const lastMessage = messages[messages.length - 1] || null;
    const existingDraft = (detail.drafts || []).find((d) => d.kind === (composer?.kind || "reply")) || null;
    const replyAll = detail.replyAll || { to: [], cc: [] };
    const defaultTo = thread.lead?.email ? [thread.lead.email] : thread.counterpart ? [thread.counterpart] : [];
    threadPane = (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-start gap-2 border-b border-border px-3 py-2">
          {mobileBack}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">{thread.subject}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {thread.lead ? (
                <Link href={`/sales/leads/${thread.lead.id}`} className="underline">{thread.lead.businessName}</Link>
              ) : (
                t("app.salesInbox.thread.withAddress", { address: thread.counterpart || "" })
              )}
              {thread.lead?.email ? ` · ${thread.lead.email}` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <LabelChips labels={thread.labels} draft={(detail.drafts || []).length > 0} attachment={false} />
              {thread.labels?.stage ? (
                <span className={`${TAG} border border-border text-muted-foreground`}>
                  {t(`app.salesLeads.status.${thread.labels.stage}`, LEAD_STATUS_LABELS[thread.labels.stage] || thread.labels.stage)}
                </span>
              ) : null}
            </div>
            <ReviewedByOwner review={detail.reviewedByOwner} className="mt-1" />
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <button type="button" onClick={() => archive(thread.id)} className={ACTION} title={thread.archivedAt ? t("app.salesInbox.thread.unarchive") : t("app.salesInbox.thread.archive")}>
              {thread.archivedAt ? <ArchiveRestore size={13} aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}
              <span className="hidden lg:inline">{thread.archivedAt ? t("app.salesInbox.thread.unarchive") : t("app.salesInbox.thread.archive")}</span>
            </button>
            <button type="button" onClick={() => patch(thread.id, { read: false })} className={ACTION} title={t("app.salesInbox.thread.markUnread")}>
              <MailOpen size={13} aria-hidden="true" />
              <span className="hidden lg:inline">{t("app.salesInbox.thread.markUnread")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (wide) setShowContext((v) => !v);
                else setPane(PANE_CONTEXT);
              }}
              className={ACTION}
              aria-pressed={wide ? showContext : undefined}
              title={t("app.salesInbox.thread.contact")}
            >
              <UserRound size={13} aria-hidden="true" />
              <span className="hidden lg:inline">{t("app.salesInbox.thread.contact")}</span>
            </button>
          </div>
        </header>

        <div ref={threadScrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {folded > 1 ? (
            <button type="button" onClick={() => setExpanded(new Set(messages.map((m) => m.id)))} className="w-full rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              {t("app.salesInbox.message.earlier", { count: folded })}
            </button>
          ) : null}
          {messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              them={them}
              expanded={expanded.has(m.id) || (folded <= 1)}
              onToggle={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(m.id)) next.delete(m.id);
                  else next.add(m.id);
                  return next;
                })
              }
              onReply={(msg, kind) => startReply(msg, kind)}
              onForward={(msg) => startReply(msg, "forward")}
            />
          ))}
          {detailError ? <p className="text-sm text-red-700 dark:text-red-300">{detailError}</p> : null}
          {!composer ? (
            <>
              <OutreachNotice outreach={outreach} />
              {optedOut ? (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40 flex items-start gap-2">
                  <Ban size={16} className="mt-0.5 shrink-0 text-red-700 dark:text-red-300" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-200">{t("app.salesNotes.optedOutHeadline")}</p>
                    {optedOutReason ? <p className="text-red-800 dark:text-red-300/90">{optedOutReason}</p> : null}
                    <p className="text-red-800 dark:text-red-300/90">{t("app.salesNotes.optedOutServerRefusal")}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {canReply && !composer ? (
          <div className="flex flex-wrap gap-2 border-t border-border p-2">
            <button type="button" onClick={() => startReply(null, "reply")} className={ACTION}>
              <Reply size={13} aria-hidden="true" /> {t("app.salesInbox.compose.reply")}
            </button>
            {replyAll.cc.length || replyAll.to.length > 1 ? (
              <button type="button" onClick={() => startReply(null, "replyAll")} className={ACTION}>
                <ReplyAll size={13} aria-hidden="true" /> {t("app.salesInbox.compose.replyAll")}
              </button>
            ) : null}
            {lastMessage ? (
              <button type="button" onClick={() => startReply(lastMessage, "forward")} className={ACTION}>
                <Forward size={13} aria-hidden="true" /> {t("app.salesInbox.compose.forward")}
              </button>
            ) : null}
            {(detail.drafts || []).length ? (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300">
                <PencilLine size={12} aria-hidden="true" /> {t("app.salesInbox.label.draft")}
              </span>
            ) : null}
          </div>
        ) : null}

        {canReply && composer ? (
          <EmailComposer
            key={`${thread.id}:${composer.kind}:${composer.quoted?.id || ""}`}
            kind={composer.kind}
            leadId={thread.lead?.id || null}
            threadId={thread.id}
            quoted={composer.quoted}
            recipients={detail.recipients || []}
            initialTo={composer.kind === "forward" ? [] : composer.kind === "replyAll" ? (replyAll.to.length ? replyAll.to : defaultTo) : composer.quoted?.direction === "in" ? [composer.quoted.fromAddress?.match(/<([^>]+)>/)?.[1] || composer.quoted.fromAddress] : defaultTo}
            initialCc={composer.kind === "replyAll" ? replyAll.cc : []}
            attachable={detail.attachable || []}
            from={outreach?.from}
            draft={existingDraft}
            onClose={() => setComposer(null)}
            onSent={async () => {
              setComposer(null);
              await loadDetail(thread.id);
              await loadList();
            }}
          />
        ) : null}
      </div>
    );
  }

  // ── The company pane ────────────────────────────────────────────────────
  const contextPane =
    thread && (wide ? showContext : true) ? (
      <ContextBar
        title={them}
        subtitle={thread.lead?.email || thread.counterpart || ""}
        onClose={() => {
          setShowContext(false);
          setPane(PANE_THREAD);
        }}
        tabs={[
          { key: "details", label: t("app.salesText.tabDetails") },
          { key: "history", label: t("app.salesText.tabHistory") },
        ]}
        activeTab={contextTab}
        onTab={setContextTab}
      >
        {contextTab === "details" ? <ContactDetails detail={detail} /> : <ContactHistory detail={detail} />}
      </ContextBar>
    ) : null;

  return (
    <div className="relative" data-sales-inbox>
      <ChatLayout height={FRAME_HEIGHT} contextColumnFrom="wide" pane={pane} onCloseContext={() => setPane(PANE_THREAD)} list={listPane} thread={threadPane} context={contextPane} />
      {keysOpen ? <KeysSheet onClose={() => setKeysOpen(false)} /> : null}
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary above it — app/sales/layout.js
 * is force-dynamic so it is never crossed in production, but Next 16 refuses
 * the build without it.
 */
export default function SalesThreadsPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" /> {t("app.salesNotes.loading")}
        </p>
      }
    >
      <SalesInboxScreen />
    </Suspense>
  );
}
