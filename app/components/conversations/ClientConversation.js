"use client";

// app/components/conversations/ClientConversation.js
//
// The "Conversation" section on the client page and the job page: one
// timeline of everything said with the client, every channel, newest at the
// bottom like a chat (lib/conversations/clientTimeline.js builds it).
//
// ══ Every control here goes through a route that already exists ════════════
//
//   Reply            POST /api/messaging/threads/[id]/reply — the inbox's
//                    own send, on the thread of the newest inbound message.
//                    No new sender. The box says which channel and to whom
//                    before anyone types, and draws the inbox's own reason
//                    instead of a box when the channel cannot send (Meta not
//                    approved, the 24-hour window closed, the demo company).
//   Link             PATCH /api/messaging/threads/[id] { clientId } — the
//                    inbox's linking route.
//   Not this client  POST /api/messaging/threads/[id]/client-match — the
//                    website-chat matcher's undo route, which records the
//                    refused pair so it is never matched again.
//   Load older       the timeline's own cursor.
//   View email       a document email whose text was kept opens it
//                    (SentEmailViewer → GET /api/sent-emails/[id]); one from
//                    before the text was kept says so instead of a link.
//   Retry (media)    POST /api/messaging/threads/[id]/attachments, as the
//                    inbox does.
//
// Renders NOTHING when the route refuses (403/404): a member who cannot read
// the inbox does not get an empty box saying so on every client and job. A
// support session reads and never sees a reply box or a link control
// (useViewOnly, and the route's `can` — the server refuses regardless).
//
// Phone first: every control is at least 44px tall, the channel chips scroll
// sideways in their own container, and bubbles wrap.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Phone, LifeBuoy, ExternalLink, Loader2, ChevronDown, ChevronRight, Send, AlertTriangle, Link2, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useViewOnly } from "@/app/providers/ViewOnlyProvider";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { PlatformBadge, Attachments } from "@/app/app/messages/ConversationBits";
import SmsReceiptLine from "@/app/components/sms/SmsReceiptLine";
import { callDurationLabel } from "@/lib/messaging/activity";
import SentEmailViewer from "./SentEmailViewer";

const BTN = "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60";
const BTN_PRIMARY = "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60";
const LINK = "inline-flex items-center gap-1 min-h-[44px] text-xs font-medium text-primary hover:underline";

function when(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(language || undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(value);
  }
}

function day(value, language) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(language || undefined, { dateStyle: "medium" });
  } catch {
    return String(value);
  }
}

/** The channel's name: the inbox's words for its six, ours for calls and the portal. */
function channelName(t, channel) {
  if (channel === "call") return t("app.conversation.channel.call");
  if (channel === "portal") return t("app.conversation.channel.portal");
  return t("app.messages.platform." + channel);
}

function ChannelBadge({ channel, t }) {
  if (!channel) return null;
  if (channel === "call" || channel === "portal") {
    const Icon = channel === "call" ? Phone : LifeBuoy;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Icon size={12} aria-hidden="true" />
        {channelName(t, channel)}
      </span>
    );
  }
  return <PlatformBadge platform={channel} t={t} />;
}

function sourceLabel(t, s) {
  if (s.state === "matched") {
    if (s.matchedOn.includes("email")) return t("app.conversation.sources.matchedEmail");
    return t("app.conversation.sources.matchedPhone");
  }
  if (s.via === "job") return t("app.conversation.sources.job");
  if (s.via === "quote") return t("app.conversation.sources.quote");
  if (s.via === "lead") return t("app.conversation.sources.lead");
  if (s.matchId) return t("app.conversation.sources.matchedChat");
  return t("app.conversation.sources.linked");
}

export default function ClientConversation({ clientId = null, jobId = null, onHidden = null }) {
  const { t, language } = useTranslation();
  const viewOnly = useViewOnly();
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const [channel, setChannel] = useState(null);
  const [scope, setScope] = useState("job");
  const [olderLoading, setOlderLoading] = useState(false);
  const [busy, setBusy] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [viewEmail, setViewEmail] = useState(null);

  const base = clientId
    ? `/api/clients/${encodeURIComponent(clientId)}/conversation`
    : `/api/jobs/${encodeURIComponent(jobId)}/conversation`;

  const urlFor = useCallback(
    (cursor) => {
      const q = new URLSearchParams();
      if (channel) q.set("channel", channel);
      if (jobId && scope === "all") q.set("scope", "all");
      if (cursor) q.set("cursor", cursor);
      const s = q.toString();
      return s ? `${base}?${s}` : base;
    },
    [base, channel, scope, jobId],
  );

  const load = useCallback(async () => {
    try {
      const d = await fetchJson(urlFor(null));
      setData(d);
      setEntries(d.entries || []);
      setFailed(false);
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        setHidden(true);
        // ConversationTabs drops the tab rather than drawing an empty one.
        onHidden?.();
      } else setFailed(true);
    }
  }, [urlFor, onHidden]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadOlder() {
    if (!data?.nextCursor) return;
    setOlderLoading(true);
    try {
      const d = await fetchJson(urlFor(data.nextCursor));
      setEntries((prev) => [...prev, ...(d.entries || [])]);
      setData((prev) => ({ ...prev, nextCursor: d.nextCursor, hasMore: d.hasMore }));
    } catch (err) {
      showError(err.message || t("app.conversation.loadFailed"));
    } finally {
      setOlderLoading(false);
    }
  }

  // Oldest first on screen: the newest is at the bottom, beside the reply box.
  const shown = useMemo(() => [...entries].reverse(), [entries]);

  if (hidden) return null;

  const headingId = `conversation-${clientId || jobId}`;
  const canAct = !viewOnly;
  const canReply = canAct && Boolean(data?.can?.reply);
  const canLink = canAct && Boolean(data?.can?.link);

  async function send() {
    const body = text.trim();
    if (!body || !data?.reply?.threadId) return;
    setSending(true);
    try {
      await fetchJson(`/api/messaging/threads/${encodeURIComponent(data.reply.threadId)}/reply`, { method: "POST", body: { text: body } });
      setText("");
      showToast({ message: t("app.conversation.reply.sent"), tone: "success" });
      await load();
    } catch (err) {
      // The reply route's own sentence — a refused send says why, and the row
      // it wrote (failed) shows in the timeline after the reload.
      showError(err.message || t("app.conversation.actionFailed"));
      await load();
    } finally {
      setSending(false);
    }
  }

  async function linkThread(threadId) {
    setBusy(threadId);
    try {
      await fetchJson(`/api/messaging/threads/${encodeURIComponent(threadId)}`, { method: "PATCH", body: { clientId: data.client.id } });
      showToast({ message: t("app.conversation.possible.linked"), tone: "success" });
      await load();
    } catch (err) {
      showError(err.message || t("app.conversation.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function notThisClient(threadId, matchId) {
    setBusy(threadId);
    try {
      await fetchJson(`/api/messaging/threads/${encodeURIComponent(threadId)}/client-match`, {
        method: "POST",
        body: matchId ? { action: "undo", matchId } : { action: "reject", clientId: data.client.id },
      });
      showToast({ message: t("app.conversation.possible.rejected"), tone: "success" });
      await load();
    } catch (err) {
      showError(err.message || t("app.conversation.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function retryAttachment(threadId, messageId, index) {
    try {
      await fetchJson(`/api/messaging/threads/${encodeURIComponent(threadId)}/attachments`, { method: "POST", body: { messageId, index } });
      await load();
      return null;
    } catch (err) {
      await load();
      return err.message || t("app.messages.media.retryError");
    }
  }

  const win = data?.window;
  const chips = data?.channels || [];

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3" aria-labelledby={headingId}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h2 id={headingId} className="font-semibold text-foreground text-sm flex items-center gap-2">
            <MessageSquare size={16} aria-hidden="true" />
            {t("app.conversation.title")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {jobId ? t("app.conversation.intro.job") : t("app.conversation.intro.client")}
          </p>
        </div>
        {jobId && win && win.jobCount > 1 && (
          <button
            type="button"
            className={BTN}
            aria-pressed={scope === "all"}
            onClick={() => setScope((s) => (s === "all" ? "job" : "all"))}
          >
            {scope === "all" ? t("app.conversation.scope.job") : t("app.conversation.scope.all")}
          </button>
        )}
      </div>

      {jobId && win?.windowed && (
        <p className="text-xs text-muted-foreground">
          {win.to
            ? t("app.conversation.scope.windowNote", { from: day(win.from, language), to: day(win.to, language) })
            : t("app.conversation.scope.windowNoteOpen", { from: day(win.from, language) })}
        </p>
      )}

      {chips.length > 1 && (
        <div className="-mx-1 overflow-x-auto" role="group" aria-label={t("app.conversation.filter.label")}>
          <div className="flex gap-2 px-1 pb-1">
            {[null, ...chips].map((ch) => (
              <button
                key={ch || "all"}
                type="button"
                aria-pressed={channel === ch}
                onClick={() => setChannel(ch)}
                className={`shrink-0 min-h-[44px] px-3 rounded-full text-xs font-medium border ${
                  channel === ch ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                }`}
              >
                {ch ? channelName(t, ch) : t("app.conversation.filter.all")}
              </button>
            ))}
          </div>
        </div>
      )}

      {data?.possible?.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t("app.conversation.possible.title")}</p>
          <p className="text-xs text-amber-900 dark:text-amber-200">{t("app.conversation.possible.intro")}</p>
          <ul className="space-y-2">
            {data.possible.map((p) => (
              <li key={p.threadId} className="rounded-md bg-card border border-border p-2 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <ChannelBadge channel={p.platform} t={t} />
                  <span className="font-medium text-foreground break-words">{p.participantName || p.handle || t("app.messages.unknownPerson")}</span>
                  {p.handle && p.participantName && <span className="text-xs text-muted-foreground break-all">{p.handle}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.why === "shared_identifier" ? t("app.conversation.possible.shared") : t("app.conversation.possible.weak")}
                  {p.lastMessageAt ? ` · ${when(p.lastMessageAt, language)}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href={p.href} className={BTN}>
                    <ExternalLink size={14} aria-hidden="true" />
                    {t("app.conversation.openThread")}
                  </Link>
                  {canLink && (
                    <>
                      <button type="button" className={BTN} disabled={busy === p.threadId} onClick={() => linkThread(p.threadId)}>
                        <Link2 size={14} aria-hidden="true" />
                        {t("app.conversation.possible.link")}
                      </button>
                      <button type="button" className={BTN} disabled={busy === p.threadId} onClick={() => notThisClient(p.threadId, null)}>
                        <X size={14} aria-hidden="true" />
                        {t("app.conversation.sources.notThisClient")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!data && !failed && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {t("app.conversation.loading")}
        </p>
      )}

      {failed && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={14} aria-hidden="true" />
          {t("app.conversation.loadFailed")}
          <button type="button" className={BTN} onClick={load}>
            {t("app.conversation.retry")}
          </button>
        </div>
      )}

      {data && (
        <>
          {data.hasMore && (
            <div className="flex justify-center">
              <button type="button" className={BTN} onClick={loadOlder} disabled={olderLoading}>
                {olderLoading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                {t("app.conversation.loadOlder")}
              </button>
            </div>
          )}

          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">{channel ? t("app.conversation.emptyFiltered") : t("app.conversation.empty")}</p>
          ) : (
            <ol className="space-y-3">
              {shown.map((e) => (
                <TimelineEntry key={e.key} e={e} t={t} language={language} onRetry={retryAttachment} onViewEmail={setViewEmail} />
              ))}
            </ol>
          )}

          {canReply && <ReplyBox data={data} t={t} text={text} setText={setText} sending={sending} onSend={send} />}

          {data.sources?.length > 0 && (
            <div className="border-t border-border pt-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 min-h-[44px] text-xs font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={showSources}
                onClick={() => setShowSources((v) => !v)}
              >
                {showSources ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                {t("app.conversation.sources.title", { count: data.sources.length })}
              </button>
              {showSources && (
                <ul className="space-y-2 mt-1">
                  {data.sources.map((s) => (
                    <li key={s.threadId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <ChannelBadge channel={s.platform} t={t} />
                      <span className="text-foreground break-words">{s.participantName || s.handle || t("app.messages.unknownPerson")}</span>
                      <span className="text-xs text-muted-foreground">· {sourceLabel(t, s)}</span>
                      <Link href={s.href} className={LINK}>
                        {t("app.conversation.openThread")}
                      </Link>
                      {canLink && (s.state === "matched" || s.matchId) && (
                        <button type="button" className={BTN} disabled={busy === s.threadId} onClick={() => notThisClient(s.threadId, s.matchId)}>
                          <X size={14} aria-hidden="true" />
                          {t("app.conversation.sources.notThisClient")}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
      {viewEmail ? <SentEmailViewer emailId={viewEmail} onClose={() => setViewEmail(null)} /> : null}
    </section>
  );
}

function TimelineEntry({ e, t, language, onRetry, onViewEmail }) {
  const [open, setOpen] = useState(false);
  const isSystem = e.kind === "call_line" || e.kind === "document" || e.kind === "auto_text";
  const out = e.direction === "out";

  if (isSystem) {
    return (
      <li className="flex justify-center">
        <div className="max-w-full rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground space-y-1 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <ChannelBadge channel={e.channel} t={t} />
            <span>{when(e.at, language)}</span>
          </div>
          {e.kind === "auto_text" ? (
            <SmsReceiptLine text={{ purpose: e.purpose, status: e.status, errorCode: e.errorCode }} />
          ) : (
            <p className="text-foreground break-words">
              {t(e.labelKey, e.labelParams || {})}
              {e.kind === "document" && e.to ? ` ${t("app.conversation.doc.to", { to: e.to })}` : ""}
              {e.kind === "document" && e.by ? ` · ${t("app.conversation.doc.by", { name: e.by })}` : ""}
            </p>
          )}
          {e.kind === "document" && e.kept === false ? (
            <p className="text-xs text-muted-foreground">
              {e.beforeKeeping ? t("app.conversation.doc.notKept") : t("app.emailHistory.notKeptAfter")}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-x-3">
            {e.kind === "document" && e.emailId ? (
              <button type="button" className={LINK} onClick={() => onViewEmail?.(e.emailId)}>
                {t("app.conversation.doc.viewEmail")}
              </button>
            ) : null}
            {e.href && (
              <Link href={e.href} className={LINK}>
                {e.kind === "document" ? t("app.conversation.openDocument") : t("app.conversation.openThread")}
              </Link>
            )}
          </div>
        </div>
      </li>
    );
  }

  if (e.kind === "voice_call") {
    return (
      <li className={`flex ${out ? "justify-end" : "justify-start"}`}>
        <div className="w-full max-w-[85%] rounded-lg border border-border bg-card px-3 py-2 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <ChannelBadge channel="call" t={t} />
            <span>{when(e.at, language)}</span>
          </div>
          <p className="text-sm text-foreground">
            {t(out ? "app.conversation.call.out" : "app.conversation.call.in", { duration: callDurationLabel(e.durationSec) })}
            {e.number ? <span className="text-xs text-muted-foreground"> · {e.number}</span> : null}
          </p>
          {e.summary && <p className="text-sm text-foreground whitespace-pre-wrap break-words">{e.summary}</p>}
          {e.transcript?.length > 0 && (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 min-h-[44px] text-xs font-medium text-primary"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                {open ? t("app.conversation.call.hideTranscript") : t("app.conversation.call.showTranscript")}
              </button>
              {open && (
                <ol className="space-y-1 text-xs">
                  {e.transcript.map((turn, i) => (
                    <li key={i} className="break-words">
                      <span className="font-medium text-foreground">
                        {turn.role === "agent" ? t("app.conversation.call.agent") : t("app.conversation.call.caller")}:
                      </span>{" "}
                      <span className="text-muted-foreground">{turn.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          <Link href={e.href} className={LINK}>
            {t("app.conversation.openCalls")}
          </Link>
        </div>
      </li>
    );
  }

  // A message: Facebook, Instagram, WhatsApp, SMS, website chat, email, or the
  // client portal.
  const isTicket = e.kind === "ticket_opened" || e.kind === "ticket_message";
  return (
    <li className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] min-w-0 rounded-lg px-3 py-2 space-y-1 ${
          out ? "bg-primary/10 border border-primary/20" : "bg-muted border border-border"
        } ${e.failed ? "border-red-400" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <ChannelBadge channel={e.channel} t={t} />
          <span>{when(e.at, language)}</span>
          {e.author && <span>· {e.author}</span>}
        </div>
        {isTicket && e.subject && (
          <p className="text-xs font-medium text-foreground break-words">
            {e.kind === "ticket_opened" ? t("app.conversation.ticket.opened", { subject: e.subject }) : t("app.conversation.ticket.reply", { subject: e.subject })}
          </p>
        )}
        {!isTicket && e.subject && <p className="text-xs font-medium text-foreground break-words">{e.subject}</p>}
        {e.body && <p className="text-sm text-foreground whitespace-pre-wrap break-words">{e.body}</p>}
        {e.attachments?.length > 0 && (
          <Attachments
            message={{ id: e.key.slice(2), attachments: e.attachments }}
            onRetry={(messageId, index) => onRetry(e.threadId, messageId, index)}
            t={t}
          />
        )}
        {e.failed && (
          <p className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1">
            <AlertTriangle size={12} aria-hidden="true" />
            {t("app.conversation.failed")}
          </p>
        )}
        {e.href && (
          <Link href={e.href} className={LINK}>
            {isTicket ? t("app.conversation.openTicket") : t("app.conversation.openThread")}
          </Link>
        )}
      </div>
    </li>
  );
}

function ReplyBox({ data, t, text, setText, sending, onSend }) {
  const reply = data.reply;
  if (!reply) {
    return <p className="text-xs text-muted-foreground border-t border-border pt-2">{t("app.conversation.reply.none")}</p>;
  }
  const on = reply.participantName
    ? t("app.conversation.reply.on", { channel: channelName(t, reply.platform), name: reply.participantName })
    : t("app.conversation.reply.onNoName", { channel: channelName(t, reply.platform) });
  if (reply.blockKey) {
    return (
      <div className="border-t border-border pt-2 space-y-1">
        <p className="text-xs text-muted-foreground">{on}</p>
        <p className="text-sm text-foreground">{t(reply.blockKey)}</p>
        <Link href={reply.href} className={LINK}>
          {t("app.conversation.reply.openInInbox")}
        </Link>
      </div>
    );
  }
  const inputId = `conversation-reply-${reply.threadId}`;
  return (
    <form
      className="border-t border-border pt-2 space-y-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        onSend();
      }}
    >
      <label htmlFor={inputId} className="block text-xs text-muted-foreground">
        {on}
      </label>
      <textarea
        id={inputId}
        rows={3}
        maxLength={2000}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        placeholder={t("app.conversation.reply.placeholder")}
        className="w-full border border-border rounded-lg px-3 py-2.5 text-base sm:text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={reply.href} className={LINK}>
          {t("app.conversation.reply.openInInbox")}
        </Link>
        <button type="submit" className={BTN_PRIMARY} disabled={sending || !text.trim()}>
          {sending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          {sending ? t("app.conversation.reply.sending") : t("app.conversation.reply.send")}
        </button>
      </div>
    </form>
  );
}
