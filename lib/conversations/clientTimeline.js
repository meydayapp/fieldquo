// lib/conversations/clientTimeline.js
//
// One timeline of everything said with a client, across every channel — the
// "Conversation" section on the client page and the job page (owner,
// 2026-10-05: "unify conversations across channels in jobs when clients
// match").
//
// ══ No second conversation store ═══════════════════════════════════════════
//
// Nothing here writes a message or copies one. Every entry is READ from the
// table that already holds it, and links back to it:
//
//   MessageThread → Message    Facebook, Instagram, WhatsApp, SMS (shared line
//                              and a brought business number), website chat,
//                              and filed email (Gmail / Outlook / IMAP —
//                              lib/mailbox/file.js files a matched email AS a
//                              Message on a platform "email" thread). Calls on
//                              a brought number are `call` activity rows on
//                              the caller's SMS thread
//                              (lib/businessNumber/conversation.js).
//   SentEmail                  every document email since 2026-10-05 —
//                              quote, follow-up, invoice, deposit request,
//                              reminder, receipt, signed copy — with its text
//                              kept (lib/email/sentEmailHistory.js); the entry
//                              carries `emailId` for "View email".
//   ActivityLog                quote.sent / quote.followed_up / invoice.sent
//                              from BEFORE the text was kept: who, when, to
//                              whom, and `kept: false`. A log row a kept send
//                              wrote (metadata.sentEmailId) is skipped — the
//                              SentEmail row is that send.
//   SmsDelivery                the automatic texts (confirmations, reminders,
//                              "on my way") — purpose and fate, no body.
//   VoiceCall                  the AI receptionist's calls: summary and
//                              transcript.
//   ClientTicket(+Message)     the client portal's requests and the replies.
//
// Private notes are excluded (they were never said WITH the client), and so
// are activity rows other than calls (who assigned what is the inbox's
// business, not the client's story).
//
// ══ One matching rule ══════════════════════════════════════════════════════
//
// A thread belongs to this client when:
//
//   linked    a person (or an existing matcher) set MessageThread.clientId to
//             this client — or filed the thread to one of this client's jobs
//             or quotes, or the thread's lead became this client's quote. A
//             thread whose clientId names ANOTHER client is never shown here:
//             a person's link always stands.
//   matched   its phone (normalised E.164) or email (lower-cased) is this
//             client's, decided by lib/leads/identityMatch.js — the matcher
//             the Facebook leads and the website chat (lib/aiEmployee/
//             webChatMatch.js) already use — against every client of the SAME
//             company that shares the identifier. Exactly one client must
//             win. A phone two clients share, or a family landline whose
//             names disagree, is…
//   possible  shown in a strip for a person to confirm ("Link") or refuse
//             ("Not this client"). Never folded into the timeline.
//
// "Not this client" writes a ThreadClientMatch row with status "undone" —
// the same row, and the same reading of it, as webChatMatch's undo — and a
// pair with one is never matched to this client again. A linked webChatMatch
// row whose thread somebody unlinked by hand reads as rejected too, exactly
// as webChatMatch reads it.
//
// The match is computed when the timeline is READ and never written by the
// read: a GET that linked conversations would be a support session (read-only
// by non-negotiable #2) changing a customer's inbox. Linking for good is a
// person pressing "Link" (PATCH /api/messaging/threads/[id], the inbox's own
// linking route).
//
// ══ A job's timeline ═══════════════════════════════════════════════════════
//
// The client's messages, narrowed to the job's window when the client has more
// than one job: from the job's quote's creation (the job's own creation when it
// has no quote) to its completion + 30 days (open-ended while it is not
// complete). Messages on a thread filed to this job or its quote, tickets on
// it and its own documents are always included, whatever their date. "All of
// this client's messages" lifts the window.
//
// A MESSAGE tagged with a job (Message.jobId — lib/conversations/autoLink.js,
// or a person's "Which job?") is placed by its tag: always on its own job's
// timeline, whatever its date, and never on another job's narrowed one.
//
// ══ Tenant fence ═══════════════════════════════════════════════════════════
//
// Every query names companyId, and the client, the threads and every
// candidate client are re-checked against it in JS — the matcher itself drops
// another company's row even if a query returned it. Messages are read only
// through threads that passed that check. scripts/check-unified-conversations
// .mjs runs this file against a fake database holding two companies and
// mutation-tests the fence.

import { matchLeadIdentity } from "@/lib/leads/identityMatch";
import { CLIENT_MATCH_SELECT } from "@/lib/contacts/matchContact";
import { normalisePhone, normaliseEmail } from "@/lib/sales/suppressionRules";
import { publicAttachments } from "@/lib/messaging/attachments";
import { activityLabel } from "@/lib/messaging/activity";
import { composerBlock } from "@/lib/messaging/composerState";
import { serviceWindowNotice } from "@/lib/messaging/serviceWindow";
import { MESSAGING_PLATFORMS } from "@/lib/messaging/platforms";
import { isGoogleEmail, SUPPORT_VIEW_EMAIL_TEXT, supportViewEmailSubject } from "@/lib/mailbox/supportView";
import { transcriptTurns } from "@/lib/voice/transcript";
import { SENT_EMAIL_HISTORY_SINCE } from "@/lib/email/sentEmailHistory";

/** Every channel a timeline entry can carry. The filter chips are these. */
export const TIMELINE_CHANNELS = Object.freeze([...MESSAGING_PLATFORMS, "call", "portal"]);

/** The platforms whose thread IS a phone number (participantExternalId). */
export const PHONE_PLATFORMS = Object.freeze(["sms", "whatsapp"]);

/** The platform whose thread IS an email address. */
export const EMAIL_PLATFORMS = Object.freeze(["email"]);

/**
 * Where a person's reply can go from the timeline: every messaging platform,
 * through the inbox's own reply route. Listed rather than "all of
 * MESSAGING_PLATFORMS" so a seventh platform has to be added here on purpose.
 */
export const REPLY_PLATFORMS = Object.freeze(["facebook", "instagram", "whatsapp", "sms", "email", "web"]);

/** FieldQuo's own channels and email: no Meta approval stands in their way. */
const NO_META_BLOCK = new Set(["sms", "email", "web"]);

/** The document emails the activity log records. */
export const DOCUMENT_ACTIONS = Object.freeze(["quote.sent", "quote.followed_up", "invoice.sent"]);

/** "Completion + 30 days" — the owner's default. */
export const JOB_WINDOW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export const PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;
/** Threads read per client. A client with more is a company problem, not a page one. */
export const MAX_THREADS = 300;
/** Possible matches shown at once. */
export const MAX_POSSIBLE = 10;
/** Transcript turns carried per call — the receptionist screen has the rest. */
export const MAX_TRANSCRIPT_TURNS = 40;

/** Is this a channel a chip may filter by? Anything else is "no filter". */
export function isTimelineChannel(value) {
  return typeof value === "string" && TIMELINE_CHANNELS.includes(value);
}

// ── Identity ────────────────────────────────────────────────────────────────

/**
 * The forms a phone takes as a thread's participantExternalId: E.164 for SMS
 * ("+15145550101"), digits for a WhatsApp wa_id ("15145550101"). Pure.
 */
export function phoneVariants(phone) {
  const e164 = normalisePhone(phone);
  if (!e164) return [];
  return [...new Set([e164, e164.slice(1)])];
}

/** The last ten digits — the SQL pre-filter, then E.164 decides. */
export function phoneTail(phone) {
  const e164 = normalisePhone(phone);
  if (!e164) return null;
  const digits = e164.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * What a thread says about who is on the other end. Pure.
 *
 * The phone of an SMS / WhatsApp thread and the address of an email thread
 * are the thread's own participant id; a Messenger, Instagram or web thread
 * carries neither, so its lead's (the details the homeowner typed into a
 * form or a message, captured by lib/leads/conversationLead.js) stand in.
 */
export function threadIdentity(thread, lead = null) {
  const platform = thread?.channel?.platform || thread?.platform || null;
  let phone = PHONE_PLATFORMS.includes(platform) ? normalisePhone(thread?.participantExternalId) : null;
  let email = EMAIL_PLATFORMS.includes(platform) ? normaliseEmail(thread?.participantExternalId) : null;
  if (lead) {
    phone = phone || normalisePhone(lead.phone);
    email = email || normaliseEmail(lead.email);
  }
  const name = String(thread?.participantName || lead?.name || "").trim() || null;
  return { name, phone, email };
}

/**
 * The pairs a person refused, for one thread and one client: an "undone" row,
 * or a "linked" row whose thread no longer points at the client (somebody
 * unlinked it by hand) — webChatMatch's reading, so the two never disagree.
 */
export function rejectedFor(thread, clientId, history = []) {
  return (history || []).some(
    (h) => h && h.threadId === thread?.id && h.clientId === clientId && (h.status === "undone" || (h.status === "linked" && thread?.clientId !== clientId)),
  );
}

/**
 * Does this thread belong to this client? Pure — the one rule.
 *
 * @param companyId         the tenant asking
 * @param client            CLIENT_MATCH_SELECT row
 * @param thread            { id, companyId, clientId, jobId, quoteId, leadId,
 *                            participantName, participantExternalId,
 *                            channel: { platform } }
 * @param lead              the thread's LeadRequest, or null:
 *                            { id, companyId, name, email, phone, quote: { clientId } }
 * @param candidateClients  every client of the company sharing the client's
 *                          phone or email, INCLUDING the client — the field
 *                          a match has to win outright
 * @param history           ThreadClientMatch rows for (thread, client)
 * @param jobIds, quoteIds  this client's own jobs and quotes
 *
 * @returns {{ state: "linked"|"matched"|"possible"|"other"|"none", via?, confidence?, matchedOn?, why }}
 */
export function threadVerdict({ companyId, client, thread, lead = null, candidateClients = [], history = [], jobIds = [], quoteIds = [] } = {}) {
  if (!companyId) throw new Error("threadVerdict: companyId is required — a match is always tenant-scoped");
  if (!client || client.companyId !== companyId) return { state: "none", why: "client_not_in_company" };
  if (!thread || thread.companyId !== companyId) return { state: "none", why: "thread_not_in_company" };

  // A person's link, either way, stands.
  if (thread.clientId === client.id) return { state: "linked", via: "client", why: "linked" };
  if (thread.clientId) return { state: "other", why: "linked_to_another_client" };

  // Filed to this client's own work — the inbox's job/quote links, or the
  // lead that became this client's quote.
  if (thread.jobId && jobIds.includes(thread.jobId)) return { state: "linked", via: "job", why: "filed_to_job" };
  if (thread.quoteId && quoteIds.includes(thread.quoteId)) return { state: "linked", via: "quote", why: "filed_to_quote" };
  const ownLead = lead && lead.companyId === companyId && (!thread.leadId || lead.id === thread.leadId) ? lead : null;
  if (ownLead?.quote?.clientId === client.id) return { state: "linked", via: "lead", why: "lead_became_quote" };

  // Somebody said "Not this client". Never proposed again.
  if (rejectedFor(thread, client.id, history)) return { state: "none", why: "undone" };

  const identity = threadIdentity(thread, ownLead);
  if (!identity.phone && !identity.email) return { state: "none", why: "no_contact" };

  // The competitors: the client and every other client of THIS company that
  // shares an identifier. Rejections are deliberately not passed as
  // exclusions — "not Mary" does not make a landline Mary shares with John
  // John's alone.
  const field = (candidateClients || []).filter((c) => c && c.companyId === companyId);
  if (!field.some((c) => c.id === client.id)) field.push(client);
  const m = matchLeadIdentity({ companyId, incoming: identity, clients: field });

  if (m.kind === "client" && m.id === client.id) {
    // The rule is phone or email. A name-and-address "likely" cannot arise
    // here (a thread carries no address), and is refused if it ever does.
    if (!m.matchedOn.includes("phone") && !m.matchedOn.includes("email")) return { state: "possible", confidence: m.confidence, matchedOn: m.matchedOn, why: "name_only" };
    return { state: "matched", confidence: m.confidence, matchedOn: m.matchedOn, why: m.why };
  }
  if (m.kind === "client") return { state: "other", why: "matches_another_client" };
  const maybe = (m.possible || []).find((p) => p.kind === "client" && p.id === client.id);
  if (maybe) return { state: "possible", confidence: maybe.confidence, matchedOn: maybe.reasons || [], why: m.ambiguous ? "shared_identifier" : "weak_match" };
  return { state: "none", why: "no_match" };
}

// ── The job window ──────────────────────────────────────────────────────────

/**
 * From the job's quote's creation (or the job's own, with no quote) to its
 * completion + 30 days; `to` is null while the job is not complete. Pure.
 */
export function jobWindow({ job, quoteCreatedAt = null } = {}) {
  if (!job) return null;
  const from = new Date(quoteCreatedAt || job.createdAt);
  const to = job.completedAt ? new Date(new Date(job.completedAt).getTime() + JOB_WINDOW_AFTER_MS) : null;
  return { from, to };
}

/** Inclusive at both ends. Pure. */
export function inJobWindow(at, window) {
  if (!window) return true;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return false;
  if (t < window.from.getTime()) return false;
  if (window.to && t > window.to.getTime()) return false;
  return true;
}

/**
 * Narrow to the job? Only when the job page asked AND the client has more than
 * one job — with one job, every message is about it.
 */
export function isWindowed({ scope = "job", job = null, clientJobCount = 0 } = {}) {
  return Boolean(job) && scope !== "all" && clientJobCount > 1;
}

/** Prisma range for a window, on the given column. */
function windowRange(window) {
  return window.to ? { gte: window.from, lte: window.to } : { gte: window.from };
}

// ── Paging ──────────────────────────────────────────────────────────────────

/** "2026-10-05T12:00:00.000Z|m:abc" → { t, key }, or null. */
export function parseCursor(value) {
  if (typeof value !== "string" || !value.includes("|")) return null;
  const at = value.slice(0, value.indexOf("|"));
  const key = value.slice(value.indexOf("|") + 1);
  const t = new Date(at).getTime();
  if (Number.isNaN(t) || !key) return null;
  return { t, key, at: new Date(t) };
}

export function makeCursor(entry) {
  return `${new Date(entry.at).toISOString()}|${entry.key}`;
}

const time = (e) => new Date(e.at).getTime();
/** Newest first; ties broken by key so a page boundary is stable. */
export function compareEntries(a, b) {
  return time(b) - time(a) || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0);
}

/** Strictly older than the cursor (same instant: smaller key). */
export function beforeCursor(entry, cursor) {
  if (!cursor) return true;
  const t = time(entry);
  return t < cursor.t || (t === cursor.t && entry.key < cursor.key);
}

/**
 * Merge several sources into one page. Pure.
 *
 * Each source was read newest-first, `take` rows at most, at or before the
 * cursor. A source that came back FULL may have older rows it did not return,
 * so nothing older than its oldest row can be trusted on this page — those
 * entries wait for the next one, where that source is read again from there.
 *
 * @param sources [{ entries, take }]
 * @returns {{ entries, nextCursor, hasMore }}
 */
export function mergePage(sources = [], { limit = PAGE_SIZE, cursor = null } = {}) {
  let floor = -Infinity;
  let anyFull = false;
  const all = [];
  for (const s of sources) {
    const rows = Array.isArray(s?.entries) ? s.entries : [];
    if (s && Number.isFinite(s.fetched) ? s.fetched >= s.take : rows.length >= (s?.take ?? Infinity)) {
      anyFull = true;
      const oldest = Number.isFinite(s.oldestAt) ? s.oldestAt : Math.min(...rows.map(time));
      if (Number.isFinite(oldest)) floor = Math.max(floor, oldest);
    }
    for (const e of rows) if (beforeCursor(e, cursor)) all.push(e);
  }
  all.sort(compareEntries);
  const trusted = all.filter((e) => time(e) >= floor);
  const entries = trusted.slice(0, limit);
  const hasMore = trusted.length > limit || all.length > trusted.length || anyFull;
  return { entries, nextCursor: entries.length && hasMore ? makeCursor(entries[entries.length - 1]) : null, hasMore: Boolean(entries.length && hasMore) };
}

// ── Who may see what ────────────────────────────────────────────────────────

/**
 * The four answers a timeline needs, from the graded member. Pure.
 *
 *   read      requests ≥ view_only — the inbox's own read rung
 *             (app/api/messaging/threads/route.js). A crew member at
 *             requests: none reads no client conversation through the job
 *             page either; the job page is not a side door into the inbox.
 *   contacts  clientsProperties ≥ full_view — phone numbers and addresses are
 *             client contact data (the rung app/api/mailbox/filed uses).
 *   calls     the same rung the receptionist's call list uses
 *             (lib/voice/recording.js CALL_AUDIO_LEVEL).
 *   reply     requests ≥ view_create_edit, the reply route's own rung, and
 *             never in a support session — impersonation is read-only.
 *
 * A support session reads everything the company's owner could (the
 * platform console views everything) and replies to nothing.
 */
export function timelineAccess({ member, full, hasLevel, callLevel = ["clientsProperties", "full_view"] }) {
  const support = Boolean(member?.impersonation);
  const at = (category, level) => support || Boolean(hasLevel(full, category, level));
  return {
    support,
    read: at("requests", "view_only"),
    contacts: at("clientsProperties", "full_view"),
    calls: at(callLevel[0], callLevel[1]),
    reply: !support && Boolean(hasLevel(full, "requests", "view_create_edit")),
    link: !support && Boolean(hasLevel(full, "requests", "view_create_edit")),
  };
}

/**
 * Why the reply box may not send on this platform, as the inbox's own i18n
 * key, or null. Mirrors app/app/messages/page.js: email and FieldQuo's own
 * channels never wait on Meta; Meta's wait on the connection and on the
 * 24-hour window. The demo company sends nothing.
 */
export function replyBlockKey({ platform, connection, lastInboundAt = null, now = new Date() }) {
  if (!REPLY_PLATFORMS.includes(platform)) return "app.conversation.reply.unsupported";
  if (connection?.mock) return "app.messages.compose.disabled.demo";
  if (NO_META_BLOCK.has(platform)) return null;
  const block = composerBlock(connection);
  if (block) return block;
  return serviceWindowNotice({ platform, lastInboundAt, now }).blockKey || null;
}

// ── Shaping ─────────────────────────────────────────────────────────────────

/**
 * The phone or address a thread is held under — only where it IS one (a
 * Messenger PSID or a web visitor id means nothing to a person), and only for
 * a member who may see client contact details.
 */
export function handleOf(thread, contacts = true) {
  if (!contacts || !thread?.participantExternalId) return null;
  const platform = thread.channel?.platform || thread.platform || null;
  if (PHONE_PLATFORMS.includes(platform)) return normalisePhone(thread.participantExternalId) || null;
  if (EMAIL_PLATFORMS.includes(platform)) return normaliseEmail(thread.participantExternalId) || null;
  return null;
}

const threadHref = (threadId) => `/app/messages?thread=${encodeURIComponent(threadId)}`;

/** A Message row → an entry, or null when there is nothing honest to show. */
export function messageEntry(m, thread, { support = false, contacts = true, explicit = false } = {}) {
  const platform = thread?.channel?.platform || null;
  const base = { key: `m:${m.id}`, at: m.sentAt, threadId: thread?.id || m.threadId, href: threadHref(thread?.id || m.threadId), explicit };
  if (m.direction === "activity") {
    const label = activityLabel(m.activity);
    if (!label || m.activity?.type !== "call") return null;
    return { ...base, channel: "call", kind: "call_line", direction: m.activity.direction === "out" ? "out" : "in", labelKey: label.key, labelParams: label.params };
  }
  if (m.direction !== "in" && m.direction !== "out") return null;
  const entry = {
    ...base,
    channel: platform,
    kind: "message",
    direction: m.direction,
    body: m.body || "",
    attachments: publicAttachments(m.attachments),
    failed: Boolean(m.failedReason),
    participant: thread?.participantName || null,
  };
  if (m.email) {
    entry.subject = m.email.subject || "";
    if (contacts) {
      entry.from = m.email.fromAddress || null;
      entry.to = m.email.toAddresses || null;
    }
  }
  // A FieldQuo support session never reads a Gmail message's words
  // (lib/mailbox/supportView.js) — who, when and which way stay.
  if (support && m.email && isGoogleEmail(m.email)) {
    entry.body = SUPPORT_VIEW_EMAIL_TEXT;
    entry.subject = supportViewEmailSubject(m.direction);
    entry.attachments = [];
    entry.hiddenInSupportView = true;
  }
  return entry;
}

export function callEntry(c, { contacts = true } = {}) {
  const turns = transcriptTurns(c.transcript)
    .filter((t) => t.role === "agent" || t.role === "caller")
    .slice(0, MAX_TRANSCRIPT_TURNS)
    .map((t) => ({ role: t.role, text: String(t.text || "").slice(0, 500) }));
  return {
    key: `call:${c.id}`,
    at: c.createdAt,
    channel: "call",
    kind: "voice_call",
    direction: c.direction === "outbound" ? "out" : "in",
    durationSec: c.durationSec || 0,
    summary: c.summary || null,
    transcript: turns,
    number: contacts ? (c.direction === "outbound" ? c.toE164 : c.fromE164) || null : null,
    href: "/app/receptionist",
  };
}

export function ticketEntry(t, { explicit = false } = {}) {
  return {
    key: `tk:${t.id}`,
    at: t.createdAt,
    channel: "portal",
    kind: "ticket_opened",
    direction: "in",
    subject: t.subject || "",
    body: t.body || "",
    href: `/app/tickets/${encodeURIComponent(t.id)}`,
    explicit,
  };
}

export function ticketMessageEntry(m, { explicit = false } = {}) {
  return {
    key: `tm:${m.id}`,
    at: m.createdAt,
    channel: "portal",
    kind: "ticket_message",
    direction: m.author === "member" ? "out" : "in",
    subject: m.ticket?.subject || "",
    body: m.body || "",
    author: m.author === "member" ? m.authorName || null : null,
    href: `/app/tickets/${encodeURIComponent(m.ticketId)}`,
    explicit,
  };
}

export function documentEntry(row, { numbers, contacts = true, explicit = false }) {
  const isQuote = row.entityType === "quote";
  const to = row.metadata && typeof row.metadata === "object" && typeof row.metadata.to === "string" ? row.metadata.to : null;
  return {
    key: `doc:${row.id}`,
    at: row.createdAt,
    channel: "email",
    kind: "document",
    direction: "out",
    labelKey: row.action === "quote.followed_up" ? "app.conversation.doc.quoteFollowUp" : isQuote ? "app.conversation.doc.quoteSent" : "app.conversation.doc.invoiceSent",
    labelParams: { number: numbers.get(row.entityId) || "" },
    to: contacts ? to : null,
    by: row.actorName || null,
    href: `/app/${isQuote ? "quotes" : "invoices"}/${encodeURIComponent(row.entityId)}`,
    explicit,
    // The text of this send was not kept (it predates 2026-10-05, or its copy
    // could not be written) — said, not implied by a missing link.
    emailId: null,
    kept: false,
    beforeKeeping: new Date(row.createdAt).getTime() < SENT_EMAIL_HISTORY_SINCE.getTime(),
  };
}

/** Did this log row's send keep its text? Then its SentEmail row stands for it. */
export function keptByLog(row) {
  return Boolean(row?.metadata && typeof row.metadata === "object" && typeof row.metadata.sentEmailId === "string" && row.metadata.sentEmailId);
}

const SENT_LABEL = Object.freeze({
  quote: "app.conversation.doc.quoteSent",
  quote_follow_up: "app.conversation.doc.quoteFollowUp",
  quote_signed_copy: "app.conversation.doc.quoteSignedCopy",
  invoice: "app.conversation.doc.invoiceSent",
  deposit: "app.conversation.doc.depositSent",
  reminder: "app.conversation.doc.reminderSent",
  receipt: "app.conversation.doc.receiptSent",
  job_follow_up: "app.conversation.doc.jobFollowUp",
});

/** A kept document email (SentEmail) as an entry, with its "View email". Pure. */
export function sentEmailEntry(row, { numbers, contacts = true, explicit = false }) {
  const docId = row.invoiceId || row.quoteId || null;
  const href = row.invoiceId
    ? `/app/invoices/${encodeURIComponent(row.invoiceId)}`
    : row.quoteId
      ? `/app/quotes/${encodeURIComponent(row.quoteId)}`
      : row.jobId
        ? `/app/jobs/${encodeURIComponent(row.jobId)}`
        : null;
  return {
    key: `se:${row.id}`,
    at: row.createdAt,
    channel: "email",
    kind: "document",
    direction: "out",
    labelKey: SENT_LABEL[row.kind] || "app.conversation.doc.emailSent",
    labelParams: { number: (docId && numbers.get(docId)) || "" },
    to: contacts ? row.toAddresses || null : null,
    by: row.sentByName || null,
    href,
    explicit,
    emailId: row.id,
    kept: true,
  };
}

export function textEntry(d) {
  return {
    key: `sms:${d.id}`,
    at: d.sentAt,
    channel: "sms",
    kind: "auto_text",
    direction: "out",
    purpose: d.purpose,
    status: d.status,
    errorCode: d.errorCode ?? null,
  };
}

// ── The read ────────────────────────────────────────────────────────────────

const THREAD_SELECT = Object.freeze({
  id: true,
  companyId: true,
  clientId: true,
  jobId: true,
  quoteId: true,
  leadId: true,
  participantName: true,
  participantExternalId: true,
  threadNumber: true,
  lastInboundAt: true,
  lastMessageAt: true,
  channel: { select: { platform: true, name: true } },
});

/**
 * Clients of this company whose phone, as digits, ends in `tail`. Exported
 * for lib/conversations/autoLink.js, which asks the same question on arrival.
 */
export async function clientIdsByPhoneTail(db, companyId, tail) {
  if (!tail || typeof db.$queryRaw !== "function") return [];
  // Phone columns are free text — the same digits-in-SQL pre-filter
  // lib/businessNumber/conversation.js and lib/sms/clientLine.js use; E.164
  // equality decides afterwards.
  const rows = await db.$queryRaw`SELECT id FROM "Client" WHERE "companyId" = ${companyId} AND phone IS NOT NULL AND regexp_replace(phone, '\\D', '', 'g') LIKE ${`%${tail}`} LIMIT 25`;
  return (rows || []).map((r) => r.id);
}

async function leadIdsByPhoneTail(db, companyId, tail) {
  if (!tail || typeof db.$queryRaw !== "function") return [];
  const rows = await db.$queryRaw`SELECT id FROM "LeadRequest" WHERE "companyId" = ${companyId} AND phone IS NOT NULL AND regexp_replace(phone, '\\D', '', 'g') LIKE ${`%${tail}`} LIMIT 100`;
  return (rows || []).map((r) => r.id);
}

/**
 * Which threads belong to this client, and which only might. Exported so the
 * reject route can ask the same question the timeline asks.
 */
export async function classifyClientThreads(db, { companyId, client, jobs = [], quotes = [] }) {
  const jobIds = jobs.map((j) => j.id);
  const quoteIds = quotes.map((q) => q.id);
  const email = normaliseEmail(client.email);
  const phone = normalisePhone(client.phone);
  const phones = phoneVariants(client.phone);
  const tail = phoneTail(client.phone);

  const [emailClients, phoneClientIds, phoneLeadIds] = await Promise.all([
    email ? db.client.findMany({ where: { companyId, email: { equals: email, mode: "insensitive" } }, select: { ...CLIENT_MATCH_SELECT }, take: 25 }) : [],
    clientIdsByPhoneTail(db, companyId, tail),
    leadIdsByPhoneTail(db, companyId, tail),
  ]);
  const phoneClients = phoneClientIds.length
    ? await db.client.findMany({ where: { companyId, id: { in: phoneClientIds } }, select: { ...CLIENT_MATCH_SELECT } })
    : [];
  const byId = new Map([[client.id, client]]);
  for (const c of emailClients) if (c.companyId === companyId && normaliseEmail(c.email) === email) byId.set(c.id, c);
  for (const c of phoneClients) if (c.companyId === companyId && phone && normalisePhone(c.phone) === phone) byId.set(c.id, c);
  const candidateClients = [...byId.values()];
  const sharedPhone = phone ? candidateClients.filter((c) => normalisePhone(c.phone) === phone).length > 1 : false;

  const leadOr = [{ quote: { clientId: client.id } }];
  if (email) leadOr.push({ email: { equals: email, mode: "insensitive" } });
  if (phoneLeadIds.length) leadOr.push({ id: { in: phoneLeadIds } });
  const leads = await db.leadRequest.findMany({
    where: { companyId, OR: leadOr },
    select: { id: true, companyId: true, name: true, email: true, phone: true, quote: { select: { clientId: true } } },
    take: 100,
  });
  const leadById = new Map(leads.filter((l) => l.companyId === companyId).map((l) => [l.id, l]));

  const or = [{ clientId: client.id }];
  if (jobIds.length) or.push({ clientId: null, jobId: { in: jobIds } });
  if (quoteIds.length) or.push({ clientId: null, quoteId: { in: quoteIds } });
  if (phones.length) or.push({ clientId: null, participantExternalId: { in: phones }, channel: { platform: { in: [...PHONE_PLATFORMS] } } });
  if (email) or.push({ clientId: null, participantExternalId: { equals: email, mode: "insensitive" }, channel: { platform: { in: [...EMAIL_PLATFORMS] } } });
  if (leadById.size) or.push({ clientId: null, leadId: { in: [...leadById.keys()] } });

  const threads = (
    await db.messageThread.findMany({ where: { companyId, OR: or }, orderBy: { lastMessageAt: "desc" }, take: MAX_THREADS, select: THREAD_SELECT })
  ).filter((t) => t.companyId === companyId);

  const history = threads.length
    ? await db.threadClientMatch.findMany({
        where: { companyId, clientId: client.id, threadId: { in: threads.map((t) => t.id) } },
        select: { id: true, threadId: true, clientId: true, status: true, confidence: true, matchedOn: true, createdAt: true },
      })
    : [];

  const included = [];
  const possible = [];
  for (const t of threads) {
    const lead = t.leadId ? leadById.get(t.leadId) || null : null;
    const verdict = threadVerdict({ companyId, client, thread: t, lead, candidateClients, history: history.filter((h) => h.threadId === t.id), jobIds, quoteIds });
    if (verdict.state === "linked" || verdict.state === "matched") {
      const live = history.find((h) => h.threadId === t.id && h.status === "linked" && t.clientId === client.id);
      included.push({ thread: t, verdict, matchId: live?.id || null });
    } else if (verdict.state === "possible") {
      possible.push({ thread: t, verdict });
    }
  }
  return { included, possible, candidateClients, sharedPhone, phones, email, phone };
}

/**
 * The timeline, one page.
 *
 * @param db       a Prisma client (or the check's fake)
 * @param job      { id, clientId, quoteId, createdAt, completedAt } already
 *                 read under companyId AND the member's job scope by the
 *                 route — or null on the client page
 * @param scope    "job" (default) | "all"
 * @param access   timelineAccess(...)
 * @param connection  messagingConnection(companyId), for the reply box
 */
export async function loadClientTimeline(db, {
  companyId,
  clientId,
  job = null,
  scope = "job",
  channel = null,
  cursor = null,
  limit = PAGE_SIZE,
  access = { contacts: true, calls: true, support: false, reply: false, link: false },
  connection = null,
  now = new Date(),
} = {}) {
  if (!companyId || !clientId) return null;
  const client = await db.client.findFirst({ where: { id: clientId, companyId }, select: { ...CLIENT_MATCH_SELECT } });
  if (!client || client.companyId !== companyId) return null;
  if (job && (job.clientId !== client.id)) return null;

  const take = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || PAGE_SIZE));
  const fetchTake = take + 1;
  const c = parseCursor(cursor);
  const filter = isTimelineChannel(channel) ? channel : null;

  const [jobs, quotes, invoices] = await Promise.all([
    db.job.findMany({ where: { companyId, clientId: client.id }, select: { id: true, quoteId: true, createdAt: true, completedAt: true } }),
    db.quote.findMany({ where: { companyId, clientId: client.id }, select: { id: true, quoteNumber: true, createdAt: true } }),
    db.invoice.findMany({ where: { companyId, clientId: client.id }, select: { id: true, invoiceNumber: true, jobId: true, quoteId: true } }),
  ]);

  const { included, possible, sharedPhone, phones } = await classifyClientThreads(db, { companyId, client, jobs, quotes });

  // ── The window ───────────────────────────────────────────────────────────
  const windowed = isWindowed({ scope, job, clientJobCount: jobs.length });
  const quoteCreatedAt = job?.quoteId ? quotes.find((q) => q.id === job.quoteId)?.createdAt || null : null;
  const window = job ? jobWindow({ job, quoteCreatedAt }) : null;
  const isJobThread = (t) => Boolean(job) && (t.jobId === job.id || (job.quoteId && t.quoteId === job.quoteId));
  const jobInvoiceIds = job ? invoices.filter((i) => i.jobId === job.id || (job.quoteId && i.quoteId === job.quoteId)).map((i) => i.id) : [];
  const jobDocIds = job ? [...(job.quoteId ? [job.quoteId] : []), ...jobInvoiceIds] : [];

  /** AND clauses for one source: the cursor and, when windowed, the window or the explicit tie. */
  const timeAnd = (column, explicitWhere) => {
    const and = [];
    if (c) and.push({ [column]: { lte: c.at } });
    if (windowed) and.push(explicitWhere ? { OR: [explicitWhere, { [column]: windowRange(window) }] } : { [column]: windowRange(window) });
    return and;
  };

  const sources = [];
  const threadById = new Map(included.map((i) => [i.thread.id, i.thread]));
  const explicitThreadIds = included.filter((i) => isJobThread(i.thread)).map((i) => i.thread.id);
  // A message's own job tag (Message.jobId) places it: on this job always,
  // on another job's narrowed timeline never.
  const messageExplicit = job
    ? { OR: [...(explicitThreadIds.length ? [{ threadId: { in: explicitThreadIds } }] : []), { jobId: job.id }] }
    : null;

  // ── Messages, every platform ─────────────────────────────────────────────
  const msgThreads = included.filter((i) => {
    const p = i.thread.channel?.platform;
    if (!filter || filter === "call") return true;
    return p === filter;
  });
  if (msgThreads.length && filter !== "portal") {
    const callRow = { direction: "activity", activity: { path: ["type"], equals: "call" } };
    const kinds = filter === "call" ? [callRow] : filter ? [{ direction: { in: ["in", "out"] } }] : [{ direction: { in: ["in", "out"] } }, callRow];
    const and = timeAnd("sentAt", messageExplicit);
    if (windowed) and.push({ OR: [{ jobId: null }, { jobId: job.id }] });
    const rows = await db.message.findMany({
      where: {
        threadId: { in: msgThreads.map((i) => i.thread.id) },
        private: false,
        OR: kinds,
        AND: and,
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: fetchTake,
      select: {
        id: true,
        threadId: true,
        direction: true,
        body: true,
        sentAt: true,
        attachments: true,
        failedReason: true,
        activity: true,
        jobId: true,
        email: {
          select: {
            subject: true,
            fromAddress: true,
            toAddresses: true,
            sentVia: true,
            ...(access.support ? { mailboxId: true, mailbox: { select: { provider: true } } } : {}),
          },
        },
      },
    });
    const entries = [];
    for (const m of rows) {
      const t = threadById.get(m.threadId);
      if (!t) continue; // never a row from a thread that did not pass the fence
      const e = messageEntry(m, t, { support: access.support, contacts: access.contacts, explicit: isJobThread(t) || (Boolean(job) && m.jobId === job.id) });
      if (e) entries.push(e);
    }
    sources.push({ entries, take: fetchTake, fetched: rows.length, oldestAt: rows.length ? Math.min(...rows.map((r) => new Date(r.sentAt).getTime())) : NaN });
  }

  // ── The receptionist's calls ─────────────────────────────────────────────
  if (access.calls && (!filter || filter === "call")) {
    const callOr = [{ clientId: client.id }];
    // An unlinked call by the caller's number only when exactly one client
    // has that number — the same "ambiguous is never linked" rule.
    if (phones.length && !sharedPhone) callOr.push({ clientId: null, OR: [{ fromE164: { in: phones } }, { toE164: { in: phones } }] });
    const rows = await db.voiceCall.findMany({
      where: { companyId, archivedAt: null, OR: callOr, AND: timeAnd("createdAt", null) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fetchTake,
      select: { id: true, companyId: true, direction: true, fromE164: true, toE164: true, createdAt: true, durationSec: true, summary: true, transcript: true },
    });
    const own = rows.filter((r) => r.companyId === companyId);
    sources.push({ entries: own.map((r) => callEntry(r, { contacts: access.contacts })), take: fetchTake, fetched: rows.length, oldestAt: rows.length ? Math.min(...rows.map((r) => new Date(r.createdAt).getTime())) : NaN });
  }

  // ── The client portal ────────────────────────────────────────────────────
  if (!filter || filter === "portal") {
    const ticketExplicit = job ? { OR: [{ jobId: job.id }, ...(job.quoteId ? [{ quoteId: job.quoteId }] : [])] } : null;
    const [tickets, ticketMessages] = await Promise.all([
      db.clientTicket.findMany({
        where: { companyId, clientId: client.id, AND: timeAnd("createdAt", ticketExplicit) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: fetchTake,
        select: { id: true, companyId: true, subject: true, body: true, createdAt: true, jobId: true, quoteId: true },
      }),
      db.clientTicketMessage.findMany({
        where: { ticket: { companyId, clientId: client.id }, AND: timeAnd("createdAt", ticketExplicit ? { ticket: ticketExplicit } : null) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: fetchTake,
        select: { id: true, ticketId: true, author: true, authorName: true, body: true, createdAt: true, ticket: { select: { companyId: true, subject: true, jobId: true, quoteId: true } } },
      }),
    ]);
    const ticketIsJob = (t) => Boolean(job) && (t?.jobId === job.id || (job.quoteId && t?.quoteId === job.quoteId));
    sources.push({ entries: tickets.filter((t) => t.companyId === companyId).map((t) => ticketEntry(t, { explicit: ticketIsJob(t) })), take: fetchTake, fetched: tickets.length, oldestAt: tickets.length ? Math.min(...tickets.map((r) => new Date(r.createdAt).getTime())) : NaN });
    sources.push({ entries: ticketMessages.filter((m) => m.ticket?.companyId === companyId).map((m) => ticketMessageEntry(m, { explicit: ticketIsJob(m.ticket) })), take: fetchTake, fetched: ticketMessages.length, oldestAt: ticketMessages.length ? Math.min(...ticketMessages.map((r) => new Date(r.createdAt).getTime())) : NaN });
  }

  // ── The quote and invoice emails ─────────────────────────────────────────
  const numbers = new Map([...quotes.map((q) => [q.id, q.quoteNumber]), ...invoices.map((i) => [i.id, i.invoiceNumber])]);
  if ((!filter || filter === "email") && (quotes.length || invoices.length)) {
    const docOr = [];
    if (quotes.length) docOr.push({ entityType: "quote", entityId: { in: quotes.map((q) => q.id) } });
    if (invoices.length) docOr.push({ entityType: "invoice", entityId: { in: invoices.map((i) => i.id) } });
    const rows = await db.activityLog.findMany({
      where: { companyId, action: { in: [...DOCUMENT_ACTIONS] }, OR: docOr, AND: timeAnd("createdAt", jobDocIds.length ? { entityId: { in: jobDocIds } } : null) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fetchTake,
      select: { id: true, companyId: true, action: true, entityType: true, entityId: true, actorName: true, metadata: true, createdAt: true },
    });
    // A log row a kept send wrote is that send's SentEmail row below — listed
    // once, there, with its "View email".
    sources.push({ entries: rows.filter((r) => r.companyId === companyId && !keptByLog(r)).map((r) => documentEntry(r, { numbers, contacts: access.contacts, explicit: jobDocIds.includes(r.entityId) })), take: fetchTake, fetched: rows.length, oldestAt: rows.length ? Math.min(...rows.map((r) => new Date(r.createdAt).getTime())) : NaN });
  }

  // ── The document emails whose text was kept (since 2026-10-05) ───────────
  if ((!filter || filter === "email") && db.sentEmail?.findMany) {
    const sentExplicit = job
      ? { OR: [{ jobId: job.id }, ...(jobDocIds.length ? [{ quoteId: { in: jobDocIds } }, { invoiceId: { in: jobDocIds } }] : [])] }
      : null;
    const rows = await db.sentEmail.findMany({
      where: { companyId, clientId: client.id, AND: timeAnd("createdAt", sentExplicit) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fetchTake,
      select: { id: true, companyId: true, clientId: true, kind: true, jobId: true, quoteId: true, invoiceId: true, toAddresses: true, sentByName: true, createdAt: true },
    });
    const isJobSend = (r) => Boolean(job) && (r.jobId === job.id || jobDocIds.includes(r.quoteId) || jobDocIds.includes(r.invoiceId));
    sources.push({ entries: rows.filter((r) => r.companyId === companyId && r.clientId === client.id).map((r) => sentEmailEntry(r, { numbers, contacts: access.contacts, explicit: isJobSend(r) })), take: fetchTake, fetched: rows.length, oldestAt: rows.length ? Math.min(...rows.map((r) => new Date(r.createdAt).getTime())) : NaN });
  }

  // ── The automatic texts ──────────────────────────────────────────────────
  if (!filter || filter === "sms") {
    const rows = await db.smsDelivery.findMany({
      // thread_reply is a reply already on the SMS thread above; listing its
      // receipt too would show one text twice.
      where: { companyId, clientId: client.id, purpose: { not: "thread_reply" }, AND: timeAnd("sentAt", null) },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      take: fetchTake,
      select: { id: true, companyId: true, purpose: true, status: true, errorCode: true, sentAt: true },
    });
    sources.push({ entries: rows.filter((r) => r.companyId === companyId).map(textEntry), take: fetchTake, fetched: rows.length, oldestAt: rows.length ? Math.min(...rows.map((r) => new Date(r.sentAt).getTime())) : NaN });
  }

  const page = mergePage(sources, { limit: take, cursor: c });

  // ── The reply box: the newest inbound message's channel ──────────────────
  let reply = null;
  if (!c) {
    const replyThreads = included
      .map((i) => i.thread)
      // A messaging chip picks the reply channel; the call and portal chips
      // are not channels a reply can go out on, so they leave it alone.
      .filter((t) => REPLY_PLATFORMS.includes(t.channel?.platform) && (!filter || !REPLY_PLATFORMS.includes(filter) || t.channel?.platform === filter));
    if (replyThreads.length) {
      const newest = await db.message.findFirst({
        where: { threadId: { in: replyThreads.map((t) => t.id) }, direction: "in" },
        orderBy: { sentAt: "desc" },
        select: { threadId: true, sentAt: true },
      });
      const t = newest ? threadById.get(newest.threadId) : null;
      if (t) {
        const platform = t.channel.platform;
        reply = {
          threadId: t.id,
          platform,
          participantName: t.participantName || null,
          lastInboundAt: t.lastInboundAt || newest.sentAt,
          blockKey: access.reply ? replyBlockKey({ platform, connection, lastInboundAt: t.lastInboundAt || newest.sentAt, now }) : null,
          href: threadHref(t.id),
        };
      }
    }
  }

  // ── Which chips have anything behind them (first page only) ──────────────
  let channels = null;
  if (!c) {
    const present = new Set(included.map((i) => i.thread.channel?.platform).filter(Boolean));
    const [calls, tickets, docs, texts] = await Promise.all([
      access.calls ? db.voiceCall.count({ where: { companyId, archivedAt: null, clientId: client.id } }) : 0,
      db.clientTicket.count({ where: { companyId, clientId: client.id } }),
      (quotes.length || invoices.length
        ? db.activityLog.count({ where: { companyId, action: { in: [...DOCUMENT_ACTIONS] }, entityId: { in: [...quotes.map((q) => q.id), ...invoices.map((i) => i.id)] } } })
        : Promise.resolve(0)
      ).then(async (n) => n + (db.sentEmail?.count ? await db.sentEmail.count({ where: { companyId, clientId: client.id } }) : 0)),
      db.smsDelivery.count({ where: { companyId, clientId: client.id, purpose: { not: "thread_reply" } } }),
    ]);
    if (calls) present.add("call");
    if (tickets) present.add("portal");
    if (docs) present.add("email");
    if (texts) present.add("sms");
    // A call on a brought business number is a `call` row on the caller's SMS
    // thread — counted, not assumed from the thread existing.
    const smsThreadIds = included.filter((i) => i.thread.channel?.platform === "sms").map((i) => i.thread.id);
    if (!present.has("call") && smsThreadIds.length) {
      const callRows = await db.message.count({ where: { threadId: { in: smsThreadIds }, direction: "activity", activity: { path: ["type"], equals: "call" } } });
      if (callRows) present.add("call");
    }
    channels = TIMELINE_CHANNELS.filter((ch) => present.has(ch));
  }

  return {
    client: { id: client.id, name: client.name },
    window: job
      ? { windowed, scope: windowed ? "job" : "all", jobCount: jobs.length, from: window?.from || null, to: window?.to || null }
      : null,
    entries: page.entries,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    channels,
    sources: !c
      ? included.map((i) => ({
          threadId: i.thread.id,
          platform: i.thread.channel?.platform || null,
          participantName: i.thread.participantName || null,
          handle: handleOf(i.thread, access.contacts),
          state: i.verdict.state,
          via: i.verdict.via || null,
          matchedOn: i.verdict.matchedOn || [],
          matchId: i.matchId,
          href: threadHref(i.thread.id),
        }))
      : null,
    possible: !c
      ? possible.slice(0, MAX_POSSIBLE).map((p) => ({
          threadId: p.thread.id,
          platform: p.thread.channel?.platform || null,
          participantName: p.thread.participantName || null,
          handle: handleOf(p.thread, access.contacts),
          lastMessageAt: p.thread.lastMessageAt || null,
          matchedOn: p.verdict.matchedOn || [],
          why: p.verdict.why,
          href: threadHref(p.thread.id),
        }))
      : null,
    reply,
    can: { reply: Boolean(access.reply), link: Boolean(access.link) },
  };
}
