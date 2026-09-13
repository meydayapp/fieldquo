// app/sales/messages/page.js
//
// The rep's texts, as a chat client — not a list with a compose box.
//
// ══ What the owner asked for, and what he kept seeing instead ═════════════
//
//   "how come my /sales/messages is not more similar to that
//    [Rocket.Chat's omnichannel agent screen] … I have told you many times
//    to look at the UI"
//
// Two attempts shipped a list of cards and, behind a click, a thread with a
// textarea under it. This one IS the client: rooms down the left in four
// groups, the conversation in the middle with day dividers, an unread line
// and sequential grouping, a composer with a `!` menu, and the contact in a
// bar on the right. Every piece is app/components/chat — the same kit the
// team chat renders — and the arithmetic behind the thread is executed by
// scripts/check-chat-kit.mjs rather than eyeballed. The rendered result is
// in docs/screens/sales-messages/, because a green build is not a screen.
//
// The three clauses the first version was built for still hold: the
// conversation reads as one (lib/sales/messages/grouping.js), check-ins sit
// in it as DRAFTS and nothing sends them (CheckInDraft.js), and the rep sets
// or changes when — or parks a new one from the header.
//
// ══ Every refusal is the SERVER's ═════════════════════════════════════════
//
// The composer does not decide whether a text may go: the suppression list
// is read fresh at the moment of the send, the texting window is judged in
// the prospect's own zone, and the mailing address CASL requires is checked
// there. This screen shows the answer it gets back — as the hint line over
// the box, as a failed row in the thread, as the red STOP tag in the header.
// A second copy of those rules here is how a reply goes out at two in the
// morning to somebody who said STOP.
//
// What the screen DOES do is stop offering a control the server would refuse:
// a suppressed conversation gets no composer and no send button, and the
// reason is printed instead. That is courtesy, not enforcement — the two
// checkins routes and the reply route each refuse it again on their own.
//
// ══ Nothing on this page sends anything on its own ═════════════════════════
//
// There is no interval, no scheduler and no effect that calls a send. Every
// path to the carrier starts with a press — Send, Enter, a draft's own
// button. scripts/check-sales-messages.mjs asserts that by scanning this
// file for a send call outside an event handler. The one timer near this
// screen is useThreadRefresh.js, which RE-READS the open thread while the
// tab is visible and is pinned by the same check to GET and nothing else.
//
// ══ Unread is the rep's, done is the rep's ════════════════════════════════
//
// Both live in SalesSmsThreadRead (lib/sales/messages/readState.js), keyed by
// rep and number, so two reps on the shared sales number do not read each
// other's threads for each other. Opening a thread records the read; the red
// line is drawn from the instant BEFORE that write, so it stays where it was
// until the rep leaves — the way every chat client does it.
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  Check,
  ExternalLink,
  LifeBuoy,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  OctagonAlert,
  Phone,
  RotateCcw,
  Search,
  ShieldOff,
  UserRound,
  X,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { raiseSupportTicket } from "@/lib/support/repClient";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  ChatLayout,
  RoomList,
  Thread,
  Composer,
  ContextBar,
  PANE_LIST,
  PANE_THREAD,
  PANE_CONTEXT,
} from "@/app/components/chat";
import { layoutThread } from "@/lib/chat/threadLayout";
import {
  GROUP_DONE,
  GROUP_DRAFTS,
  GROUP_NEEDS_REPLY,
  GROUP_ORDER,
  GROUP_WAITING,
  groupConversations,
} from "@/lib/sales/messages/rooms";
import { LEAD_STATUS_LABELS } from "@/lib/sales/outreachPipeline";
import {
  TRIAGE_KINDS,
  TRIAGE_LABEL_KEY,
  TRIAGE_ROADBLOCK,
  isTriageKind,
  triageShowsChip,
} from "@/lib/sales/messages/triage";
import { conversationInitials, sentenceAround } from "./MessageThread";
import CheckInDraft from "./CheckInDraft";
import SignupLinkSms from "../leads/SignupLinkSms";
import { useThreadRefresh } from "./useThreadRefresh";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";
// 44px below lg, 36 from lg up: the phone audit (docs/screens/sales-mobile)
// measured every one of these at 36px on a 375px phone, under the floor the
// BTN above states; the desktop keeps its density because the row it sits
// in is beside a thread there. Same rule in StaffChat.js and the queue.
const ACTION =
  "inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[36px] whitespace-nowrap rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60";
const TAG = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";

/** The frame's height: the viewport minus the shell's chrome above and below. */
const FRAME_HEIGHT =
  "h-[calc(100dvh-var(--fq-tab-bar-height)-7rem)] lg:h-[calc(100dvh-11.5rem)]";

const GROUP_TITLE_KEY = {
  [GROUP_NEEDS_REPLY]: "app.salesText.groupNeedsReply",
  [GROUP_WAITING]: "app.salesText.groupWaiting",
  [GROUP_DRAFTS]: "app.salesText.groupDrafts",
  [GROUP_DONE]: "app.salesText.groupDone",
};

function when(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function dayOf(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "9:00 PM CDT" — the boundary of the texting window, in THEIR zone. */
function zoneTime(value, timeZone) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone, timeZoneName: "short" } : {}),
    });
  } catch {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
}

/** "+1 405 555 0132" from "+14055550132" — readable, still one number. */
// ── The triage chip ───────────────────────────────────────────────────────
//
// One colour per kind, and the pairs are the portal's existing ones (the
// window tag's emerald and amber, the STOP tag's red) so no new text/ground
// pairing is introduced without lib/documents/theme.js having measured it.
// `fine` draws nothing: a chip on every ordinary reply is a list full of
// chips, and the list needs the exceptions to stand out.
const TRIAGE_CHIP_CLASS = {
  roadblock: "bg-red-600 text-white",
  question: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  positive: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  not_interested: "bg-muted text-muted-foreground",
  stop: "bg-muted text-muted-foreground",
};

/**
 * The chip: the kind, in the rep's language. Draws nothing for `fine`, for
 * a kind it does not know, and for a reply nobody has classified — an
 * unclassified reply is not "fine", it is unknown, and unknown is blank.
 */
function TriageChip({ triage, className = "" }) {
  const { t } = useTranslation();
  const kind = triage?.kind;
  if (!triageShowsChip(kind)) return null;
  return (
    <span
      className={`${TAG} ${TRIAGE_CHIP_CLASS[kind] || "bg-muted text-muted-foreground"} ${className}`}
      data-triage={kind}
      data-triage-overridden={triage?.overridden ? "true" : undefined}
      title={triage?.reason || undefined}
    >
      {kind === TRIAGE_ROADBLOCK ? <OctagonAlert size={11} aria-hidden="true" /> : null}
      {t(TRIAGE_LABEL_KEY[kind])}
    </span>
  );
}

function prettyE164(e164) {
  const s = String(e164 || "");
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(s);
  return m ? `+1 ${m[1]} ${m[2]} ${m[3]}` : s;
}

/** Does the viewport have room for the context bar as a column? */
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

// ═══════════════════════════════════════════════════════════════════════════
// Escalation — only where a ticket could actually be raised
// ═══════════════════════════════════════════════════════════════════════════
//
// decideEscalation() refuses without a company attributed to this rep, and the
// route re-reads that attribution before writing. So the control renders only
// when the thread resolved to one of the rep's own companies, and is ABSENT —
// not disabled — otherwise. A button that 404s is the dead control AGENTS.md
// opens with.
function EscalatePanel({ company }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [raised, setRaised] = useState(null);

  if (!company) return null;

  if (raised) {
    return (
      <div className={CARD}>
        <p className="text-sm font-semibold text-foreground break-words">{raised.subject}</p>
        {/* The route's own sentence. It says in words whether anybody is on it
            — `assigned: false` is a real answer, and a screen that renders
            "Open" either way is the reassuring lie this channel exists to
            stop. */}
        <p className="text-sm text-muted-foreground break-words">{raised.statusLine}</p>
        <Link href="/sales/support" className={`${BTN} border border-border text-foreground w-full`}>
          <LifeBuoy size={16} aria-hidden="true" /> {t("app.salesText.escalateFollowTicket")}
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${BTN} border border-border text-foreground w-full`}
      >
        <LifeBuoy size={16} aria-hidden="true" /> {t("app.salesText.escalateOpen")}
      </button>
    );
  }

  // Split rather than interpolated: the company's name is emphasised inside
  // the sentence, and t() stringifies its values — a <span> handed to it would
  // arrive as "[object Object]". The sentence stays one key either way.
  const [introBefore, introAfter] = sentenceAround(t("app.salesText.escalateIntro"), "{company}");

  return (
    <div className={CARD}>
      <p className="text-sm text-muted-foreground break-words">
        {introBefore}
        <span className="font-medium text-foreground">{company.name}</span>
        {introAfter}
      </p>
      <label className="block text-sm font-medium text-foreground" htmlFor="ticket-subject">
        {t("app.salesText.escalateSubjectLabel")}
      </label>
      <input
        id="ticket-subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={t("app.salesText.escalateSubjectPlaceholder")}
        className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
      />
      <label className="block text-sm font-medium text-foreground" htmlFor="ticket-body">
        {t("app.salesText.escalateBodyLabel")}
      </label>
      <textarea
        id="ticket-body"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
      />
      <label className="block text-sm font-medium text-foreground" htmlFor="ticket-priority">
        {t("app.salesText.escalatePriorityLabel")}
      </label>
      <select
        id="ticket-priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
      >
        {/* The VALUES are what the route stores; only the labels are the
            rep's language. */}
        <option value="low">{t("app.salesText.escalatePriorityLow")}</option>
        <option value="normal">{t("app.salesText.escalatePriorityNormal")}</option>
        <option value="high">{t("app.salesText.escalatePriorityHigh")}</option>
        <option value="urgent">{t("app.salesText.escalatePriorityUrgent")}</option>
      </select>

      {error ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-sm text-amber-900 dark:text-amber-200 break-words">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !subject.trim() || !body.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const { ticket } = await raiseSupportTicket({
                companyId: company.id,
                subject,
                body,
                priority,
              });
              setRaised(ticket);
            } catch (err) {
              setError(err?.message || t("app.salesText.escalateFailed"));
            } finally {
              setBusy(false);
            }
          }}
          className={`${BTN} bg-primary text-primary-foreground`}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LifeBuoy size={16} aria-hidden="true" />
          )}
          {t("app.salesText.escalateSubmit")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={`${BTN} text-muted-foreground`}>
          {t("app.salesText.cancel")}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The context bar's three tabs
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

function ContactDetails({ thread, openWith }) {
  const { t } = useTranslation();
  const lead = thread?.lead;
  const contact = thread?.contact || {};
  const zone = thread?.timeZone;
  return (
    <div className="space-y-4">
      <dl className="space-y-3">
        <Field label={t("app.salesText.fieldBusiness")}>{lead?.businessName || thread?.company?.name || null}</Field>
        <Field label={t("app.salesText.fieldContactName")}>{lead?.contactName || null}</Field>
        <Field label={t("app.salesText.fieldNumber")} mono>
          {prettyE164(openWith)}
        </Field>
        <Field label={t("app.salesText.fieldEmail")}>{lead?.email || null}</Field>
        <Field label={t("app.salesText.fieldTrade")}>{contact.trade || null}</Field>
        <Field label={t("app.salesText.fieldPlace")}>
          {[contact.city, contact.province].filter(Boolean).join(", ") || null}
        </Field>
        <Field label={t("app.salesText.fieldTimeZone")}>{zone || t("app.salesText.timeZoneUnknown")}</Field>
        <Field label={t("app.salesText.fieldLeadStage")}>
          {lead?.status ? t(`app.salesLeads.status.${lead.status}`, LEAD_STATUS_LABELS[lead.status] || lead.status) : null}
        </Field>
        <Field label={t("app.salesText.fieldLeadScore")}>
          {contact.score ? `${contact.score.value} · ${dayOf(contact.score.at)}` : null}
        </Field>
        <Field label={t("app.salesText.fieldAssignedRep")}>{contact.repName || null}</Field>
      </dl>

      <div className="flex flex-col gap-2">
        {lead ? (
          <Link href={`/sales/leads/${lead.id}`} className={`${BTN} border border-border text-foreground w-full`}>
            <ExternalLink size={15} aria-hidden="true" /> {t("app.salesText.actionOpenLead")}
          </Link>
        ) : null}
        {lead?.prospectId ? (
          <Link
            href={`/sales/queue?prospect=${encodeURIComponent(lead.prospectId)}`}
            className={`${BTN} border border-border text-foreground w-full`}
          >
            <ExternalLink size={15} aria-hidden="true" /> {t("app.salesText.openProspect")}
          </Link>
        ) : null}
        {thread?.company ? (
          <Link href="/sales/companies" className={`${BTN} border border-border text-foreground w-full`}>
            {t("app.salesText.companyIsCustomer", { company: thread.company.name })}
          </Link>
        ) : null}
      </div>

      <EscalatePanel company={thread?.company || null} />
    </div>
  );
}

function ContactChannels({ thread, openWith }) {
  const { t } = useTranslation();
  const numbers = thread?.contact?.numbers;
  const messages = thread?.messages || [];
  const calls = thread?.calls || [];
  // "Last used" per number: the newest text or call that touched it.
  const lastUsed = (e164) => {
    let latest = null;
    for (const m of messages) {
      if (m.toE164 === e164 || m.fromE164 === e164) {
        if (!latest || new Date(m.sentAt) > latest) latest = new Date(m.sentAt);
      }
    }
    for (const c of calls) {
      if (!latest || new Date(c.at) > latest) latest = new Date(c.at);
    }
    return latest;
  };
  const rows = [];
  const seen = new Set();
  const push = (e164, meta = {}) => {
    if (!e164 || seen.has(e164)) return;
    seen.add(e164);
    rows.push({ e164, ...meta });
  };
  push(openWith, { kind: "sms", label: t("app.salesText.channelThisThread") });
  for (const n of numbers || []) push(n.e164, { kind: n.kind, label: n.label, canText: n.canText, canCall: n.canCall, preferred: n.preferred });

  return (
    <div className="space-y-3">
      {numbers === null ? (
        <p className="text-xs text-muted-foreground">{t("app.salesText.numbersUnreadable")}</p>
      ) : null}
      <ul className="space-y-2">
        {rows.map((row) => {
          const used = lastUsed(row.e164);
          return (
            <li key={row.e164} className="rounded-lg border border-border p-2.5">
              <p className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground tabular-nums">{prettyE164(row.e164)}</span>
                <span className={`${TAG} bg-muted text-muted-foreground`}>SMS</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground break-words">
                {[row.label, row.kind && row.kind !== "unknown" ? row.kind : null, row.preferred ? t("app.salesText.numberPreferred") : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {used ? t("app.salesText.lastUsed", { when: when(used) }) : t("app.salesText.neverUsed")}
              </p>
            </li>
          );
        })}
        {thread?.lead?.email ? (
          <li className="rounded-lg border border-border p-2.5">
            <p className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground break-all">{thread.lead.email}</span>
              <span className={`${TAG} bg-muted text-muted-foreground`}>{t("app.salesText.channelEmail")}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {thread?.contact?.emailThreads?.[0]?.lastMessageAt
                ? t("app.salesText.lastUsed", { when: when(thread.contact.emailThreads[0].lastMessageAt) })
                : t("app.salesText.neverUsed")}
            </p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ContactHistory({ thread }) {
  const { t } = useTranslation();
  const calls = thread?.calls;
  const emailThreads = thread?.contact?.emailThreads;
  const past = thread?.contact?.pastCheckIns;
  const open = thread?.checkIns || [];
  const outcome = (c) =>
    c.disposition
      ? t(`app.salesCall.disposition.${c.disposition}.label`, c.disposition)
      : c.answered
        ? t("app.salesText.callAnswered")
        : t("app.salesText.callNoOutcome");
  const Section = ({ title, children }) => (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
  const None = () => <p className="text-xs text-muted-foreground">{t("app.salesText.historyNone")}</p>;
  const Unreadable = () => <p className="text-xs text-muted-foreground">{t("app.salesText.historyUnreadable")}</p>;
  return (
    <div className="space-y-4">
      <Section title={t("app.salesText.historyCalls")}>
        {calls === null ? <Unreadable /> : !calls?.length ? <None /> : (
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
        {emailThreads === null ? <Unreadable /> : !emailThreads?.length ? <None /> : (
          <ul className="space-y-1">
            {emailThreads.map((th) => (
              <li key={th.id} className="text-sm">
                <Link href={`/sales/threads/${th.id}`} className="underline text-foreground break-words">
                  {th.subject}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">{when(th.lastMessageAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("app.salesText.historyCheckIns")}>
        {past === null ? <Unreadable /> : !past?.length && !open.length ? <None /> : (
          <ul className="space-y-1">
            {open.map((c) => (
              <li key={c.id} className="text-sm text-foreground">
                {t("app.salesText.draftBadge")}
                {c.scheduledFor ? ` · ${when(c.scheduledFor)}` : ""}
              </li>
            ))}
            {(past || []).map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-foreground">
                  {c.status === "sent" ? t("app.salesText.checkInSent") : t("app.salesText.checkInDismissed")}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {when(c.sentAt || c.dismissedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// New message — a rep's own leads and claimed prospects, or a typed number
// ═══════════════════════════════════════════════════════════════════════════
//
// Two entry points the owner asked for. The picker searches ONLY what the
// rep holds (app/api/sales/messages/contacts scopes both queries), and
// "New text" hands a number to app/api/sales/messages/start, which decides
// everything — Canada/US only, not on the do-not-contact list, not held by
// another rep — and creates the lead when nobody holds it. This component
// shows the server's answer; it decides nothing about the number itself.
function NewMessagePicker({ onOpen, onClose }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [phone, setPhone] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [picking, setPicking] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const search = useCallback(
    async (query) => {
      setSearchError("");
      try {
        const data = await fetchJson(`/api/sales/messages/contacts?q=${encodeURIComponent(query)}`);
        setResults(data.results || []);
      } catch (err) {
        setSearchError(err?.message || t("app.salesText.newSearchFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    search(q);
  }, [q, search]);

  async function pick(entry) {
    setStartError("");
    setPicking(entry.id);
    try {
      if (entry.kind === "prospect") {
        // A prospect becomes the rep's lead through the leads route — the
        // same carry-across the queue offers, with its claim check.
        const { lead } = await fetchJson("/api/sales/leads", { method: "POST", body: { prospectId: entry.id } });
        const { with: e164 } = await fetchJson(`/api/sales/messages/contacts?leadId=${encodeURIComponent(lead.id)}`);
        if (!e164) throw new Error(t("app.salesText.newNoNumber"));
        onOpen(e164);
        return;
      }
      if (!entry.e164) throw new Error(t("app.salesText.newNoNumber"));
      onOpen(entry.e164);
    } catch (err) {
      setStartError(err?.message || t("app.salesText.newOpenFailed"));
    } finally {
      setPicking("");
    }
  }

  async function startWithNumber(event) {
    event.preventDefault();
    if (!phone.trim()) return;
    setStarting(true);
    setStartError("");
    try {
      const result = await fetchJson("/api/sales/messages/start", { method: "POST", body: { phone } });
      onOpen(result.with);
    } catch (err) {
      // The server's own sentence: which rule refused and, for a held
      // number, whose it is.
      setStartError(err?.message || t("app.salesText.newOpenFailed"));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-new-message>
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{t("app.salesText.newMessageTitle")}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("app.salesText.cancel")}
          className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── Their own leads and claimed prospects ──────────────────────── */}
        <div className="px-3 pt-3">
          <label className="sr-only" htmlFor="new-message-search">
            {t("app.salesText.newSearchLabel")}
          </label>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="new-message-search"
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("app.salesText.newSearchPlaceholder")}
              className="w-full min-h-[44px] rounded-lg border border-border bg-card pl-9 pr-3 text-base text-foreground"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("app.salesText.newSearchScope")}</p>
        </div>

        {searchError ? (
          <p className="px-3 pt-2 text-sm text-red-700 dark:text-red-300 break-words">{searchError}</p>
        ) : null}

        <ul className="divide-y divide-border/60 px-1 pt-2" data-new-message-results>
          {results === null ? (
            <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />
              {t("app.salesText.loading")}
            </li>
          ) : results.length === 0 ? (
            <li className="px-2 py-3 text-sm text-muted-foreground">{t("app.salesText.newSearchEmpty")}</li>
          ) : (
            results.map((entry) => (
              <li key={`${entry.kind}:${entry.id}`}>
                <button
                  type="button"
                  disabled={Boolean(picking)}
                  onClick={() => pick(entry)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted disabled:opacity-60 min-h-[52px]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground" aria-hidden="true">
                    {conversationInitials({ name: entry.name, e164: entry.e164 })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium text-foreground ${entry.name ? "" : "tabular-nums"}`}>
                      {entry.name || prettyE164(entry.e164)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground tabular-nums">
                      {[entry.name ? prettyE164(entry.e164) : null, entry.place].filter(Boolean).join(" · ") || t("app.salesText.newNoNumber")}
                    </span>
                  </span>
                  <span className={`${TAG} bg-muted text-muted-foreground`}>
                    {entry.kind === "lead" ? t("app.salesText.newKindLead") : t("app.salesText.newKindProspect")}
                  </span>
                  {picking === entry.id ? (
                    <Loader2 className="animate-spin motion-reduce:animate-none" size={14} aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>

        {/* ── A typed number ─────────────────────────────────────────────── */}
        <form onSubmit={startWithNumber} className="mt-3 border-t border-border px-3 py-3 space-y-2" data-new-text-form>
          <label className="block text-sm font-semibold text-foreground" htmlFor="new-text-phone">
            {t("app.salesText.newTextTitle")}
          </label>
          <p className="text-xs text-muted-foreground break-words">{t("app.salesText.newTextHelp")}</p>
          <div className="flex gap-2">
            <input
              id="new-text-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("app.salesText.newTextPlaceholder")}
              className="min-w-0 flex-1 min-h-[44px] rounded-lg border border-border bg-card px-3 text-base text-foreground tabular-nums"
            />
            <button
              type="submit"
              disabled={starting || !phone.trim()}
              className={`${BTN} bg-primary text-primary-foreground`}
            >
              {starting ? (
                <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <MessageSquarePlus size={16} aria-hidden="true" />
              )}
              {t("app.salesText.newTextSubmit")}
            </button>
          </div>
          {startError ? (
            <p className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-2.5 text-sm text-red-800 dark:text-red-200 break-words" role="alert" data-new-text-error>
              {startError}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The screen
// ═══════════════════════════════════════════════════════════════════════════

function SalesMessagesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const wide = useWide();

  const [list, setList] = useState(null);
  const [listMeta, setListMeta] = useState({ readStateError: null, draftsError: null });
  const [openWith, setOpenWith] = useState(() => params.get("thread") || params.get("with") || "");
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Rows the rep has typed that have not come back from the server yet, and
  // the ones that came back refused. Held here rather than merged into
  // `thread.messages`, so a refresh cannot resurrect a failed send as a real
  // message.
  const [inFlight, setInFlight] = useState([]);
  const [draftBusy, setDraftBusy] = useState("");
  const [draftError, setDraftError] = useState("");
  const [parking, setParking] = useState(false);
  const [parkText, setParkText] = useState("");
  const [parkWhen, setParkWhen] = useState("");
  const [pane, setPane] = useState(openWith ? PANE_THREAD : PANE_LIST);
  // The New message picker, drawn in the thread pane while it is open.
  const [composing, setComposing] = useState(false);
  const toLeadId = params.get("to") || "";
  const [showContext, setShowContext] = useState(true);
  const [contextTab, setContextTab] = useState("details");
  const [collapsed, setCollapsed] = useState([GROUP_DONE]);
  const [focusedRoom, setFocusedRoom] = useState(null);
  // "Roadblocks": the list narrowed to conversations whose latest reply the
  // triage filed as a roadblock — the ones the owner is afraid of losing.
  // A view, not a filing: nothing is written when it is toggled.
  const [roadblocksOnly, setRoadblocksOnly] = useState(() => params.get("filter") === "roadblocks");
  const [triageBusy, setTriageBusy] = useState(false);
  // The instant the rep had last looked BEFORE this opening — what the red
  // line is drawn from. Frozen per thread so the line does not vanish the
  // moment the read is recorded.
  const [openedReadAt, setOpenedReadAt] = useState(null);
  const openedFor = useRef("");
  // The draft the rep loaded into the box with Tab. Sending then sends THAT
  // draft (through its own route), rather than a plain reply that leaves the
  // draft sitting there as if it had never been used.
  const [loadedDraftId, setLoadedDraftId] = useState(null);

  const loadList = useCallback(async () => {
    setError("");
    try {
      const data = await fetchJson("/api/sales/messages");
      setList(data.conversations || []);
      setListMeta({ readStateError: data.readStateError || null, draftsError: data.draftsError || null });
    } catch (err) {
      setError(err?.message || t("app.salesText.listLoadFailed"));
    }
  }, [t]);

  const loadThread = useCallback(
    async (e164, { quiet = false } = {}) => {
      if (!quiet) setError("");
      try {
        const data = await fetchJson(`/api/sales/messages?with=${encodeURIComponent(e164)}`);
        setThread(data);
        return data;
      } catch (err) {
        if (!quiet) setError(err?.message || t("app.salesText.threadLoadFailed"));
        return null;
      }
    },
    [t],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Opening a thread: read it, remember where the rep had got to, record the
  // read. The record is FieldQuo's own bookkeeping — nothing is sent.
  useEffect(() => {
    if (!openWith) return;
    let cancelled = false;
    (async () => {
      const data = await loadThread(openWith);
      if (cancelled || !data) return;
      if (openedFor.current !== openWith) {
        openedFor.current = openWith;
        setOpenedReadAt(data.readState?.readAt || null);
      }
      try {
        await fetchJson("/api/sales/messages/read", { method: "POST", body: { with: openWith } });
        setList((rows) => (rows ? rows.map((c) => (c.e164 === openWith ? { ...c, unread: 0 } : c)) : rows));
      } catch {
        // A read marker that failed to write costs a stale badge, nothing
        // more; the thread is already on screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openWith, loadThread]);

  // A link from the lead screen: /sales/messages?to=<leadId>. Resolved to
  // the number the thread is keyed by — only for the rep's own lead.
  useEffect(() => {
    if (!toLeadId || openWith) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchJson(`/api/sales/messages/contacts?leadId=${encodeURIComponent(toLeadId)}`);
        if (cancelled) return;
        if (data.with) openThread(data.with);
        else setError(t("app.salesText.newNoNumber"));
      } catch (err) {
        if (!cancelled) setError(err?.message || t("app.salesText.newOpenFailed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toLeadId]);

  // Re-read the open thread while the tab is visible. GET only — see the
  // hook's header and the check that pins it.
  useThreadRefresh(openWith, () => {
    loadThread(openWith, { quiet: true });
  });

  // The URL carries the open thread, so a link from a lead page — or a
  // reload — lands in the conversation rather than on the list.
  useEffect(() => {
    const current = params.get("thread") || "";
    if ((openWith || "") === current) return;
    const next = new URLSearchParams(params.toString());
    if (openWith) next.set("thread", openWith);
    else next.delete("thread");
    next.delete("with");
    if (openWith) next.delete("to");
    router.replace(`/sales/messages${next.toString() ? `?${next}` : ""}`);
  }, [openWith, params, router]);

  const openThread = useCallback((e164) => {
    setOpenWith(e164);
    setThread(null);
    setInFlight([]);
    setText("");
    setLoadedDraftId(null);
    setParking(false);
    setComposing(false);
    setPane(PANE_THREAD);
  }, []);

  // ── The list, bucketed ────────────────────────────────────────────────
  const roadblockCount = useMemo(
    () => (list || []).filter((c) => c.triage?.kind === TRIAGE_ROADBLOCK).length,
    [list],
  );
  const groups = useMemo(() => {
    const buckets = groupConversations(list || []);
    // The filter narrows every bucket rather than replacing them: a
    // roadblock the rep already answered is still a roadblock, and it stays
    // under "Waiting on them" where its state is true.
    const visible = (rooms) => (roadblocksOnly ? rooms.filter((c) => c.triage?.kind === TRIAGE_ROADBLOCK) : rooms);
    return GROUP_ORDER.map((key) => ({
      key,
      title: t(GROUP_TITLE_KEY[key]),
      rooms: visible(buckets[key]).map((c) => ({
        id: c.e164,
        title: c.name || prettyE164(c.e164),
        mono: !c.name,
        // A thread that exists only as a draft never says "You: …" — nothing
        // went. A demo says it is one before anything else, so a rep cannot
        // mistake the fixture for a customer.
        subtitle: [
          c.isDemo ? t("app.salesPortal.demoBadge") : null,
          key === GROUP_DRAFTS && c.nextDraftDue
            ? t("app.salesText.draftDueSubtitle", { when: dayOf(c.nextDraftDue) })
            : c.draftOnly
              ? t("app.salesText.draftWaitingSubtitle")
              : c.lastDirection === "in"
                ? c.lastBody
                : t("app.salesText.lastFromYou", { message: c.lastBody }),
        ]
          .filter(Boolean)
          .join(" · "),
        time: c.lastAt,
        unread: c.unread ?? 0,
        channel: "sms",
        channelLabel: "SMS",
        initials: conversationInitials(c),
        // The kind of their latest reply, after the subtitle. Blank for an
        // ordinary reply and for one nobody has classified.
        badges: <TriageChip triage={c.triage} />,
      })),
    }));
  }, [list, t, roadblocksOnly]);

  // ── The thread's rows ─────────────────────────────────────────────────
  const them =
    thread?.lead?.businessName ||
    thread?.lead?.contactName ||
    thread?.company?.name ||
    thread?.draftCompany?.name ||
    prettyE164(openWith);
  const demoThread = Boolean(thread?.demo);
  const suppressed = Boolean(thread?.suppressed);
  const blockers = thread?.blockers || [];
  const smsWindow = thread?.window || null;
  const pendingDraft = (thread?.checkIns || [])[0] || null;

  const rows = useMemo(() => {
    if (!thread) return [];
    const messages = (thread.messages || []).map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      at: m.sentAt,
      kind: "message",
      status: "sent",
    }));
    const drafts = (thread.checkIns || []).map((c) => ({
      ...c,
      id: c.id,
      direction: "out",
      body: c.draftText,
      // A draft aimed at Thursday belongs at Thursday's end of the thread.
      // One with no time sits where it was written.
      at: c.scheduledFor || c.createdAt,
      kind: "draft",
    }));
    // Events, drawn as system rows: calls this rep made to this number, the
    // STOP that closed the conversation, the check-ins that went. Read only
    // — every one of them is a row somebody else's code wrote.
    const system = [];
    for (const c of thread.calls || []) {
      const outcome = c.disposition
        ? t(`app.salesCall.disposition.${c.disposition}.label`, c.disposition)
        : c.answered
          ? t("app.salesText.callAnswered")
          : t("app.salesText.callNoOutcome");
      system.push({
        id: `call:${c.id}`,
        kind: "system",
        direction: "in",
        at: c.at,
        body: c.direction === "in" ? t("app.salesText.sysInboundCall", { outcome }) : t("app.salesText.sysCalled", { outcome }),
      });
    }
    for (const s of thread.suppressions || []) {
      system.push({ id: `stop:${s.id}`, kind: "system", direction: "in", at: s.requestedAt, body: t("app.salesText.sysStop") });
    }
    for (const c of thread.contact?.pastCheckIns || []) {
      if (c.status === "sent" && c.sentAt) {
        system.push({ id: `checkin:${c.id}`, kind: "system", direction: "in", at: c.sentAt, body: t("app.salesText.sysCheckInSent") });
      }
    }
    // Not when the console has relaxed the window: the header tag says
    // "warn only" or "off" instead, and a system line saying "closed" under
    // a composer that sends would be the two disagreeing.
    if (smsWindow?.known && !smsWindow.open && !smsWindow.override && !suppressed) {
      // Undated on purpose: it is a statement about now, not an event at a
      // time, so it sorts last and gets no day heading.
      system.push({
        id: "window:closed",
        kind: "system",
        direction: "in",
        at: null,
        body: t("app.salesText.sysWindowClosed", { time: zoneTime(smsWindow.until, smsWindow.timeZone) }),
      });
    }
    return layoutThread([...messages, ...drafts, ...system, ...inFlight], { lastReadAt: openedReadAt });
  }, [thread, inFlight, openedReadAt, suppressed, smsWindow, t]);

  const canned = useMemo(
    () =>
      (thread?.canned || []).map((c) => ({
        ...c,
        title: c.titleKey ? t(c.titleKey, c.title) : c.title,
        group: c.group === "checkin" ? t("app.salesText.cannedGroupCheckIn") : t("app.salesText.cannedGroupSales"),
      })),
    [thread, t],
  );

  /** One place that talks to the check-in routes, so every path refreshes. */
  const checkInCall = useCallback(
    async (url, options, key) => {
      setDraftBusy(key);
      setDraftError("");
      try {
        await fetchJson(url, options);
        await loadThread(openWith);
        return true;
      } catch (err) {
        setDraftError(err?.message || t("app.salesText.draftActionFailed"));
        return false;
      } finally {
        setDraftBusy("");
      }
    },
    [loadThread, openWith, t],
  );

  async function send() {
    const words = text.trim();
    if (!words) return;

    // A draft loaded with Tab goes out AS that draft: its wording saved if
    // edited, then its own send route, which claims the row before anything
    // leaves so a double press cannot send it twice.
    if (loadedDraftId) {
      const draft = (thread?.checkIns || []).find((d) => d.id === loadedDraftId);
      setBusy(true);
      try {
        if (draft && draft.draftText !== words) {
          await fetchJson(`/api/sales/checkins/${loadedDraftId}`, { method: "PATCH", body: { text: words } });
        }
        await fetchJson(`/api/sales/checkins/${loadedDraftId}/send`, { method: "POST" });
        setText("");
        setLoadedDraftId(null);
        await loadThread(openWith);
        await loadList();
      } catch (err) {
        setError(err?.message || t("app.salesText.sendFailed"));
      } finally {
        setBusy(false);
      }
      return;
    }

    const tempId = `pending:${Date.now()}`;
    setBusy(true);
    setError("");
    setInFlight((rows) => [
      ...rows,
      { id: tempId, direction: "out", body: words, at: new Date(), kind: "message", status: "pending" },
    ]);
    setText("");
    try {
      const next = await fetchJson("/api/sales/messages", {
        method: "POST",
        body: { to: openWith, text: words },
      });
      // The server's list replaces the optimistic row entirely — its body
      // carries the CASL footer, which is part of what was actually sent and
      // is not what the rep typed.
      setInFlight((rows) => rows.filter((r) => r.id !== tempId));
      // `previous` rather than the one-letter name it had: this file now calls
      // t() for its copy, and a state updater called `t` shadows it.
      setThread((previous) => ({ ...previous, messages: next.messages }));
      await loadList();
    } catch (err) {
      // The server's own sentence, not a rewrite of it. It names the blocker —
      // opted out, outside their hours, no mailing address — and the fix.
      const message = err?.message || t("app.salesText.sendFailed");
      setInFlight((rows) =>
        rows.map((r) => (r.id === tempId ? { ...r, status: "failed", error: message } : r)),
      );
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function setDone(done) {
    setDraftBusy("done");
    try {
      await fetchJson("/api/sales/messages/read", { method: "POST", body: { with: openWith, done } });
      await loadThread(openWith, { quiet: true });
      await loadList();
    } catch (err) {
      setError(err?.message || t("app.salesText.draftActionFailed"));
    } finally {
      setDraftBusy("");
    }
  }

  const isDone = useMemo(() => {
    const c = (list || []).find((x) => x.e164 === openWith);
    return c ? groupConversations([c])[GROUP_DONE].length === 1 : false;
  }, [list, openWith]);

  // The rep relabels the latest reply. The server writes the rep's own row
  // and nothing else; the STOP row a keyword wrote is not this column and
  // is not touched by it.
  async function setTriage(kind) {
    if (!openWith || triageBusy) return;
    const triage = kind === "" ? null : kind;
    if (triage !== null && !isTriageKind(triage)) return;
    setTriageBusy(true);
    setError("");
    try {
      await fetchJson("/api/sales/messages/triage", { method: "POST", body: { with: openWith, triage } });
      await loadThread(openWith, { quiet: true });
      await loadList();
    } catch (err) {
      setError(err?.message || t("app.salesText.triageSaveFailed"));
    } finally {
      setTriageBusy(false);
    }
  }

  const toggleContext = () => {
    if (wide) {
      setShowContext((v) => !v);
    } else {
      setShowContext(true);
      setPane(PANE_CONTEXT);
    }
  };

  // ── The composer's hint line: the server's blocker, or the draft ────────
  const softBlocker = blockers.find((b) => b.code !== "suppressed") || null;
  const softWarning = (thread?.warnings || [])[0] || null;
  let hint = null;
  if (pendingDraft) {
    hint = (
      <span className="inline-flex items-center gap-1.5">
        <CalendarPlus size={13} aria-hidden="true" />
        {pendingDraft.scheduledFor
          ? t("app.salesText.draftDueHint", { when: dayOf(pendingDraft.scheduledFor) })
          : t("app.salesText.draftWaitingHint")}
      </span>
    );
  } else if (softBlocker) {
    hint = (
      <span className="inline-flex items-start gap-1.5 text-amber-900 dark:text-amber-200">
        <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        {/* The server's sentence: what is in the way and what fixes it. */}
        <span>
          {softBlocker.title} {softBlocker.fix}
        </span>
      </span>
    );
  } else if (softWarning) {
    // A Send that works, with the console's override said beside it — the
    // texting window is warn-only or off for this state. Same amber as a
    // blocker so it is read; the composer stays enabled because it is one.
    hint = (
      <span className="inline-flex items-start gap-1.5 text-amber-900 dark:text-amber-200" data-window-override={softWarning.code}>
        <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {softWarning.title} {softWarning.fix}
        </span>
      </span>
    );
  }

  // ── Panes ─────────────────────────────────────────────────────────────
  const listPane = (
    <RoomList
      groups={groups}
      selectedId={openWith || null}
      focusedId={focusedRoom}
      onFocusItem={setFocusedRoom}
      onSelect={(room) => openThread(room.id)}
      collapsed={collapsed}
      onToggleGroup={(key) =>
        setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))
      }
      ariaLabel={t("app.salesText.title")}
      header={
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-sm font-semibold text-foreground">{t("app.salesText.title")}</h1>
            <button
              type="button"
              onClick={() => {
                setComposing(true);
                setPane(PANE_THREAD);
              }}
              className={ACTION}
              data-new-message-button
              aria-pressed={composing}
            >
              <MessageSquarePlus size={13} aria-hidden="true" /> {t("app.salesText.newMessage")}
            </button>
          </div>
          {/* The one filter: roadblocks. A count on the button so a rep
              scanning the header knows whether to press it, and pressed
              state in aria so a screen reader knows it is a toggle. */}
          <div className="mt-2 flex items-center gap-1.5" data-triage-filter>
            <button
              type="button"
              onClick={() => setRoadblocksOnly((v) => !v)}
              aria-pressed={roadblocksOnly}
              className={`${TAG} min-h-[44px] lg:min-h-[36px] px-2.5 transition-colors motion-reduce:transition-none ${
                roadblocksOnly ? "bg-red-600 text-white" : "border border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              <OctagonAlert size={12} aria-hidden="true" />
              {t("app.salesText.filterRoadblocks")}
              {roadblockCount > 0 ? <span className="tabular-nums">{roadblockCount}</span> : null}
            </button>
            {roadblocksOnly ? (
              <button type="button" onClick={() => setRoadblocksOnly(false)} className={`${TAG} min-h-[44px] lg:min-h-[36px] px-2 text-muted-foreground hover:bg-muted`}>
                {t("app.salesText.filterAll")}
              </button>
            ) : null}
          </div>
          {listMeta.readStateError || listMeta.draftsError ? (
            // Absence of a statement is not a statement: a badge that could
            // not be counted is said to be uncounted, not shown as zero.
            <p className="mt-1 text-[11px] text-muted-foreground break-words">
              {listMeta.readStateError} {listMeta.draftsError}
            </p>
          ) : null}
        </div>
      }
      empty={
        !list ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />{" "}
            {t("app.salesText.loading")}
          </p>
        ) : roadblocksOnly && list.length ? (
          // The filter hid everything: say that, not "you have no
          // conversations", which would be false.
          <p className="px-3 py-4 text-sm text-muted-foreground break-words">{t("app.salesText.filterNoRoadblocks")}</p>
        ) : (
          // Nothing invented to fill it. A rep who has texted nobody has no
          // conversations, which is a true and ordinary state.
          <div className="space-y-3 px-3 py-4">
            <p className="text-sm text-muted-foreground break-words">{t("app.salesText.listEmpty")}</p>
            <Link href="/sales/leads" className={`${BTN} border border-border text-foreground w-full`}>
              <MessageSquare size={16} aria-hidden="true" /> {t("app.salesText.goToLeads")}
            </Link>
          </div>
        )
      }
    />
  );

  const threadPane = composing ? (
    <NewMessagePicker
      onOpen={(e164) => openThread(e164)}
      onClose={() => {
        setComposing(false);
        if (!openWith) setPane(PANE_LIST);
      }}
    />
  ) : !openWith ? (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground break-words">{t("app.salesText.listIntro")}</p>
    </div>
  ) : (
    <>
      {/* ── Header: who, the tags, the actions ──────────────────────────── */}
      <header className="border-b border-border px-3 py-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => setPane(PANE_LIST)}
            className="md:hidden -ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label={t("app.salesText.backToAll")}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">{them}</h2>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="tabular-nums">{prettyE164(openWith)}</span>
              <span className={`${TAG} bg-muted text-muted-foreground`}>SMS</span>
              {suppressed && (
                <span className={`${TAG} bg-red-600 text-white`} data-tag="stop">
                  <ShieldOff size={11} aria-hidden="true" /> STOP
                </span>
              )}
              {demoThread ? (
                <span className={`${TAG} border border-border bg-card text-muted-foreground uppercase tracking-wide`} data-tag="demo">
                  {t("app.salesPortal.demoBadge")}
                </span>
              ) : null}
              {thread?.lead?.status ? (
                <span className={`${TAG} bg-muted text-foreground`} data-tag="stage">
                  {t(`app.salesLeads.status.${thread.lead.status}`, LEAD_STATUS_LABELS[thread.lead.status] || thread.lead.status)}
                </span>
              ) : null}
              {thread?.triage ? (
                // The chip and, beside it, the dropdown that overrides it.
                // The select IS the control — a visible <select>, so a rep
                // on a phone gets the native picker — and the chip is what
                // the list shows. The reason is the model's sentence, and
                // is dropped once a rep has had the last word.
                <span className="inline-flex items-center gap-1" data-tag="triage">
                  <TriageChip triage={thread.triage} />
                  <label className="inline-flex items-center gap-1">
                    <span className="sr-only">{t("app.salesText.triageLabel")}</span>
                    <select
                      value={thread.triage.kind || ""}
                      disabled={triageBusy}
                      onChange={(e) => setTriage(e.target.value)}
                      className="h-7 max-w-[11rem] rounded-md border border-border bg-card px-1.5 text-[11px] text-foreground"
                      data-triage-select
                    >
                      <option value="">{t("app.salesText.triageUnset")}</option>
                      {TRIAGE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(TRIAGE_LABEL_KEY[k])}
                        </option>
                      ))}
                    </select>
                  </label>
                  {thread.triage.reason && !thread.triage.overridden ? (
                    <span className="max-w-[18rem] truncate text-[11px] text-muted-foreground" title={thread.triage.reason}>
                      {thread.triage.reason}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {suppressed ? null : smsWindow?.known ? (
                <span
                  className={`${TAG} ${smsWindow.open ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"}`}
                  data-tag="window"
                >
                  {smsWindow.open
                    ? t("app.salesText.windowOpenUntil", { time: zoneTime(smsWindow.until, smsWindow.timeZone) })
                    : smsWindow.override
                      ? // Shut by the clock, open by the platform console's
                        // override — said as both, never as "open".
                        t(
                          smsWindow.override === "off"
                            ? "app.salesText.windowClosedOverrideOff"
                            : "app.salesText.windowClosedOverrideWarn",
                          { time: zoneTime(smsWindow.until, smsWindow.timeZone) },
                        )
                      : t("app.salesText.windowClosedOpens", { time: zoneTime(smsWindow.until, smsWindow.timeZone) })}
                </span>
              ) : thread ? (
                <span className={`${TAG} bg-muted text-muted-foreground`} data-tag="window">
                  {t("app.salesText.timeZoneUnknown")}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {/* One row that scrolls sideways on a phone rather than wrapping to
            three: the thread is what the screen is for, and a header that
            eats a third of it is a header that has to go. */}
        <div className="mt-2 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [&>*]:shrink-0" data-thread-actions>
          {thread?.lead ? (
            // The call itself is gated by the calling rules on the lead
            // screen (salesCallReadiness, dialHref); this opens that region
            // rather than producing a tel: link that skips the gate.
            <Link href={`/sales/leads/${thread.lead.id}#lead-call`} className={ACTION}>
              <Phone size={13} aria-hidden="true" /> {t("app.salesText.actionCall")}
            </Link>
          ) : null}
          {thread?.lead ? (
            <Link href={`/sales/leads/${thread.lead.id}`} className={ACTION}>
              <ExternalLink size={13} aria-hidden="true" /> {t("app.salesText.actionOpenLead")}
            </Link>
          ) : null}
          {!suppressed && thread ? (
            <button type="button" onClick={() => setParking((v) => !v)} className={ACTION} aria-expanded={parking}>
              <CalendarPlus size={13} aria-hidden="true" /> {t("app.salesText.actionSchedule")}
            </button>
          ) : null}
          {thread ? (
            <button type="button" disabled={draftBusy === "done"} onClick={() => setDone(!isDone)} className={ACTION}>
              {isDone ? <RotateCcw size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
              {isDone ? t("app.salesText.actionReopen") : t("app.salesText.actionMarkDone")}
            </button>
          ) : null}
          <button type="button" onClick={toggleContext} className={ACTION} aria-pressed={wide ? showContext : undefined}>
            <UserRound size={13} aria-hidden="true" /> {t("app.salesText.actionContact")}
          </button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {thread?.checkInError ? (
        // Absence of a statement is not a statement: "we could not read the
        // drafts" is a different claim from "there are none", and the rep
        // gets the one that is true.
        <div className="border-b border-border bg-muted px-3 py-2 text-sm text-muted-foreground break-words">
          {thread.checkInError}
        </div>
      ) : null}

      {/* ── The conversation ────────────────────────────────────────────── */}
      <Thread
        rows={rows}
        them={them}
        meLabel={t("app.salesText.senderYou")}
        loading={!thread}
        empty={<p className="py-10 text-center text-sm text-muted-foreground">{t("app.salesText.threadEmpty")}</p>}
        onRetry={(m) => {
          // Back into the box, not straight back to the carrier. A retry
          // that re-sends on one press is how a refused message becomes
          // two sent ones once the blocker clears.
          setText(m.body);
          setInFlight((rows) => rows.filter((r) => r.id !== m.id));
        }}
        renderDraft={(d) => (
          <CheckInDraft
            draft={d}
            busy={draftBusy === d.id}
            canSend={!suppressed && !demoThread}
            onSaveText={(next) =>
              checkInCall(`/api/sales/checkins/${d.id}`, { method: "PATCH", body: { text: next } }, d.id)
            }
            onReschedule={(iso) =>
              checkInCall(`/api/sales/checkins/${d.id}`, { method: "PATCH", body: { scheduledFor: iso } }, d.id)
            }
            onDismiss={() =>
              checkInCall(`/api/sales/checkins/${d.id}`, { method: "PATCH", body: { dismiss: true } }, d.id)
            }
            onSend={async () => {
              const done = await checkInCall(`/api/sales/checkins/${d.id}/send`, { method: "POST" }, d.id);
              if (done) await loadList();
            }}
          />
        )}
      />

      {draftError ? (
        <div className="border-t border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 break-words">
          {draftError}
        </div>
      ) : null}

      {/* ── The engine's suggestion, when it has one ──────────────────── */}
      {thread?.suggestion ? (
        <div className="border-t border-border px-3">
          <CheckInDraft
            draft={thread.suggestion}
            suggestion
            busy={draftBusy === "suggestion"}
            canSend={!suppressed && !demoThread}
            onAdopt={() =>
              checkInCall("/api/sales/checkins", { method: "POST", body: { to: openWith, origin: "engine" } }, "suggestion")
            }
            onDismiss={() =>
              checkInCall(
                "/api/sales/checkins",
                { method: "POST", body: { to: openWith, origin: "engine", dismiss: true } },
                "suggestion",
              )
            }
          />
        </div>
      ) : null}

      {/* ── Suppressed: no composer at all ─────────────────────────────── */}
      {suppressed ? (
        <div className="border-t border-border bg-muted px-4 py-3 space-y-1.5" data-composer-suppressed>
          <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
            <ShieldOff size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {t("app.salesText.suppressedTitle")}
          </p>
          {blockers
            .filter((b) => b.code === "suppressed")
            .map((b) => (
              <p key={b.code} className="text-sm text-muted-foreground break-words">
                {b.title} {b.fix}
              </p>
            ))}
          <p className="text-sm text-muted-foreground break-words">{t("app.salesText.suppressedBody")}</p>
        </div>
      ) : thread && (thread.messages || []).length === 0 && demoThread ? (
        // ── The demo: nothing is ever sent from it, and the screen says so ──
        <div className="border-t border-border bg-muted px-4 py-3 text-sm text-muted-foreground break-words" data-first-contact="demo">
          {t("app.salesText.demoThreadNote")}
        </div>
      ) : thread && (thread.messages || []).length === 0 && (thread.company || thread.draftCompany) ? (
        // ── A company that signed up and was never texted ─────────────────
        //
        // The signup-link panel would hand a customer the link they already
        // used. The first text to a signed-up company is its check-in, and
        // the draft above carries its own Send — sendCheckIn() does not need
        // a prior message, deliverReplySms() applies every gate it always
        // does — so the composer's job here is to say that.
        <div className="border-t border-border bg-muted px-4 py-3 text-sm text-muted-foreground break-words" data-first-contact="signed-up">
          {t("app.salesText.firstContactSignedUp")}
        </div>
      ) : thread && (thread.messages || []).length === 0 && thread.lead ? (
        // ── An empty thread: the first text is the introduction ──────────
        //
        // The reply route refuses a first contact by design (its POST: a
        // free-text send to a number never texted is a cold-contact path
        // with none of the first-contact rules attached). So an empty
        // thread's composer IS the signup-link panel from the lead screen —
        // the same component, the same /api/sales/sms route, the same
        // refusals — and the ordinary composer appears once a text exists.
        <div className="border-t border-border" data-first-contact>
          <SignupLinkSms leadId={thread.lead.id} inThread onSent={() => loadThread(openWith, { quiet: true }).then(loadList)} />
        </div>
      ) : thread && (thread.messages || []).length === 0 ? (
        <div className="border-t border-border bg-muted px-4 py-3 text-sm text-muted-foreground break-words" data-first-contact>
          {t("app.salesText.firstContactNoLead")}
        </div>
      ) : (
        <>
          {/* ── A follow-up the rep invents from the conversation ──────── */}
          {parking ? (
            <div className="border-t border-border px-3 py-3 space-y-2" data-park-form>
              <label className="block text-sm font-medium text-foreground" htmlFor="park-text">
                {t("app.salesText.parkTextLabel")}
              </label>
              <textarea
                id="park-text"
                rows={3}
                value={parkText}
                onChange={(e) => setParkText(e.target.value)}
                placeholder={t("app.salesText.parkTextPlaceholder")}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
              />
              <label className="block text-sm font-medium text-foreground" htmlFor="park-when">
                {t("app.salesText.parkWhenLabel")}
              </label>
              <input
                id="park-when"
                type="datetime-local"
                value={parkWhen}
                onChange={(e) => setParkWhen(e.target.value)}
                className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-base bg-card text-foreground"
              />
              <p className="text-xs text-muted-foreground break-words">{t("app.salesText.parkNote")}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={draftBusy === "park" || !parkText.trim()}
                  onClick={async () => {
                    const at = parkWhen ? new Date(parkWhen) : null;
                    const done = await checkInCall(
                      "/api/sales/checkins",
                      {
                        method: "POST",
                        body: {
                          to: openWith,
                          text: parkText,
                          scheduledFor: at && !Number.isNaN(at.getTime()) ? at.toISOString() : null,
                        },
                      },
                      "park",
                    );
                    if (done) {
                      setParking(false);
                      setParkText("");
                      setParkWhen("");
                      await loadList();
                    }
                  }}
                  className={`${BTN} bg-primary text-primary-foreground`}
                >
                  {draftBusy === "park" ? (
                    <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <CalendarPlus size={16} aria-hidden="true" />
                  )}
                  {t("app.salesText.parkSubmit")}
                </button>
                <button type="button" onClick={() => setParking(false)} className={`${BTN} text-muted-foreground`}>
                  {t("app.salesText.cancel")}
                </button>
              </div>
            </div>
          ) : null}

          <Composer
            textareaId="reply"
            value={text}
            onChange={(next) => {
              setText(next);
              if (!next.trim()) setLoadedDraftId(null);
            }}
            onSend={send}
            busy={busy}
            disabled={!thread}
            hint={hint}
            onHintAccept={
              pendingDraft
                ? () => {
                    setText(pendingDraft.draftText || "");
                    setLoadedDraftId(pendingDraft.id);
                  }
                : null
            }
            canned={canned}
            maxLength={306}
            placeholder={t("app.salesText.replyPlaceholder")}
            sendLabel={loadedDraftId ? t("app.salesText.sendNow") : t("app.salesText.sendButton")}
            actions={
              !parking ? (
                <button
                  type="button"
                  onClick={() => setParking(true)}
                  className={`${ACTION} border-transparent`}
                  aria-label={t("app.salesText.parkOpen")}
                  title={t("app.salesText.parkOpen")}
                >
                  <CalendarPlus size={13} aria-hidden="true" />
                  <span className="hidden sm:inline">{t("app.salesText.parkOpen")}</span>
                </button>
              ) : null
            }
            // Said before they type it, not after it is sent. The footer is
            // not optional and it is not the rep's to remove: CASL requires
            // the sender's address and an unsubscribe in every commercial
            // message. The quoted phrase is the LITERAL text
            // lib/sales/salesSmsRules.js appends, in English, and is passed
            // in rather than translated: a rep told in Spanish that the
            // message carries a Spanish opt-out line would have been told
            // something untrue about what goes over the wire.
            footer={t("app.salesText.caslFooterNote", { optOut: "Reply STOP to opt out" })}
          />
        </>
      )}
    </>
  );

  const contextPane =
    openWith && thread && (wide ? showContext : true) ? (
      <ContextBar
        title={them}
        subtitle={prettyE164(openWith)}
        onClose={() => {
          setShowContext(false);
          setPane(PANE_THREAD);
        }}
        tabs={[
          { key: "details", label: t("app.salesText.tabDetails") },
          { key: "channels", label: t("app.salesText.tabChannels") },
          { key: "history", label: t("app.salesText.tabHistory") },
        ]}
        activeTab={contextTab}
        onTab={setContextTab}
      >
        {contextTab === "details" ? <ContactDetails thread={thread} openWith={openWith} /> : null}
        {contextTab === "channels" ? <ContactChannels thread={thread} openWith={openWith} /> : null}
        {contextTab === "history" ? <ContactHistory thread={thread} /> : null}
      </ContextBar>
    ) : null;

  return (
    <div data-tour="sales-texts">
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

/**
 * useSearchParams needs a Suspense boundary above it.
 *
 * app/sales/layout.js is force-dynamic, so nothing here prerenders and the
 * boundary is never actually crossed in production — but Next 16 refuses the
 * build without it, and a fallback that says what is happening costs one
 * element.
 */
export default function SalesMessagesPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin motion-reduce:animate-none" size={15} aria-hidden="true" />{" "}
          {t("app.salesText.loading")}
        </p>
      }
    >
      <SalesMessagesScreen />
    </Suspense>
  );
}
