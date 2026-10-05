// lib/conversations/autoLink.js
//
// A conversation linked to its client — and each message to its job — as it
// arrives (owner, 2026-10-05):
//
//   "Yes, and it should be linked to the job as well. However, contractors
//    may text you about multiple jobs, so if it understands that it is a
//    contractor and not a homeowner, it might ask which job it is. That could
//    also be somewhat linked based on timestamp — unless you are doing
//    multiple jobs for the same contractor during the same period, which
//    could happen."
//
// ══ The client: exactly one, or nobody ═════════════════════════════════════
//
// A text / WhatsApp thread IS a phone number, an email thread IS an address;
// a Facebook or Instagram thread carries neither, so the details its lead
// captured (lib/leads/conversationLead.js) stand in — threadIdentity(), the
// same reading the client page's Conversation timeline makes
// (lib/conversations/clientTimeline.js). The thread is linked when that phone
// (E.164) or that email (lower-cased) belongs to EXACTLY ONE client of the
// same company:
//
//   one client        → MessageThread.clientId, written only while it is
//                       null (a person's link always stands), and a
//                       ThreadClientMatch row saying why — so "Not this
//                       client" (POST /api/messaging/threads/[id]/
//                       client-match) undoes it in Messages AND on the client
//                       page, the website chat's undo, unchanged.
//   two or more       → nothing. The client page shows the thread as a
//                       "possible" match for a person to Link or refuse.
//   an undone pair    → never again — the same reading webChatMatch and the
//                       timeline make (rejectedFor): an "undone" row, or a
//                       "linked" row whose thread somebody unlinked by hand.
//   another company   → cannot happen: every client read names companyId and
//                       every row is re-checked in JS.
//
// Identifier-exact, deliberately NOT lib/leads/identityMatch.js's
// "names disagree → possible": a WhatsApp profile name ("Mike 🔨") disagrees
// with "Michael Tremblay" on the client record nearly every time, and the
// owner's rule is the number, not the name.
//
// The website chat stays webChatMatch's (it reads what a visitor TYPED, with
// its own switch and its own privacy note to the assistant); this file never
// links a "web" thread.
//
// ══ The job: per message ═══════════════════════════════════════════════════
//
// Message.jobId, not MessageThread.jobId: a general contractor's ONE text
// thread spans every job you do for them, so the thread cannot say which job
// a given text was about. Inbound messages only (a reply is about whatever
// the person was answering). Of the client's ACTIVE jobs at the message's
// time — unscheduled, scheduled, in progress, or completed within 30 days;
// never cancelled or archived; never a job whose quote (or, with none, the
// job itself) did not exist yet:
//
//   a homeowner with one active job          → that job ("auto_only_job")
//   one active job whose visit days or       → that job ("auto_date")
//   schedule window contain the message's
//   day (the company's calendar day)
//   anything else — several jobs, none       → left for a person: the message
//   containing the day, two overlapping;       carries a one-tap "Which job?"
//   a CONTRACTOR (Client.type "company")       in Messages
//   whose one job's window misses the day
//
// A contractor is never tagged by "only one job" alone — the owner's rule:
// they text about the next job before it exists.
//
// "unscheduled" counts as active: it is an accepted quote waiting for a date,
// and "when can you start?" is about exactly that job.
//
// ══ The switch ═════════════════════════════════════════════════════════════
//
// Company.autoLinkConversations (Settings → Client messages, default on).
// Off: nothing here writes anything. The "Which job?" picker keeps working —
// a person choosing is not automatic.
//
// ══ Never in the way ═══════════════════════════════════════════════════════
//
// Called after the message is safely stored (lib/messaging/ingest.js,
// lib/mailbox/file.js). Every exported writer catches its own failure: a
// conversation must never be lost because a link could not be made.

import { normalisePhone, normaliseEmail } from "@/lib/sales/suppressionRules";
import { CLIENT_MATCH_SELECT } from "@/lib/contacts/matchContact";
import { writeActivity } from "@/lib/messaging/activity";
import { visitDay } from "@/lib/jobs/visitDates";
import { threadIdentity, rejectedFor, phoneTail, clientIdsByPhoneTail, JOB_WINDOW_AFTER_MS } from "./clientTimeline";

/** The platforms this file links. "web" is lib/aiEmployee/webChatMatch.js's. */
export const AUTO_LINK_PLATFORMS = Object.freeze(["sms", "whatsapp", "email", "facebook", "instagram"]);

/** Statuses that make a job "active". Completed counts for 30 days (below). */
export const ACTIVE_JOB_STATUSES = Object.freeze(["unscheduled", "scheduled", "in_progress"]);

/** Who decided a message's job. */
export const JOB_LINKED_BY = Object.freeze({ ONLY_JOB: "auto_only_job", DATE: "auto_date", PERSON: "person" });

const CANCELLED_VISIT = new Set(["cancelled", "canceled"]);

/** A client that is a company — a general contractor, a property manager. */
export function isContractorClient(client) {
  return client?.type === "company";
}

// ── The client ──────────────────────────────────────────────────────────────

/**
 * Which of these clients own this phone / email. PURE.
 *
 * @returns {{ kind: "client", clientId, matchedOn } | { kind: "ambiguous", clientIds } | { kind: "none" }}
 */
export function exactClientMatch({ companyId, identity = {}, clients = [] } = {}) {
  const phone = identity.phone ? normalisePhone(identity.phone) : null;
  const email = identity.email ? normaliseEmail(identity.email) : null;
  if (!phone && !email) return { kind: "none" };
  const hits = new Map();
  for (const c of clients || []) {
    if (!c || c.companyId !== companyId) continue; // the fence, again
    const on = [];
    if (phone && normalisePhone(c.phone) === phone) on.push("phone");
    if (email && normaliseEmail(c.email) === email) on.push("email");
    if (on.length) hits.set(c.id, on);
  }
  if (hits.size === 1) {
    const [[clientId, matchedOn]] = [...hits.entries()];
    return { kind: "client", clientId, matchedOn };
  }
  if (hits.size > 1) return { kind: "ambiguous", clientIds: [...hits.keys()] };
  return { kind: "none" };
}

/**
 * Should this thread be linked, and to whom? PURE.
 *
 * @param thread   { id, companyId, clientId, leadId, participantName,
 *                   participantExternalId, channel: { platform } }
 * @param lead     the thread's LeadRequest or null: { id, companyId, name, email, phone }
 * @param clients  every client of the company sharing the thread's phone or email
 * @param history  ThreadClientMatch rows for this thread
 * @returns {{ link: true, clientId, matchedOn, why } | { link: false, why, clientIds? }}
 */
export function decideThreadClient({ companyId, thread, lead = null, clients = [], history = [] } = {}) {
  if (!companyId) throw new Error("decideThreadClient: companyId is required — a link is always tenant-scoped");
  if (!thread || thread.companyId !== companyId) return { link: false, why: "thread_not_in_company" };
  if (thread.clientId) return { link: false, why: "already_linked" };
  const platform = thread.channel?.platform || thread.platform || null;
  if (!AUTO_LINK_PLATFORMS.includes(platform)) return { link: false, why: "not_eligible" };
  const ownLead = lead && lead.companyId === companyId && (!thread.leadId || lead.id === thread.leadId) ? lead : null;
  const identity = threadIdentity(thread, ownLead);
  if (!identity.phone && !identity.email) return { link: false, why: "no_contact" };
  const m = exactClientMatch({ companyId, identity, clients });
  if (m.kind === "ambiguous") return { link: false, why: "ambiguous", clientIds: m.clientIds };
  if (m.kind !== "client") return { link: false, why: "no_match" };
  // Somebody said "Not this client" — or unlinked it by hand. Never again,
  // and never a fall-through to somebody else: "not Mary" does not make a
  // landline Mary shares with John John's.
  if (rejectedFor(thread, m.clientId, history)) return { link: false, why: "undone" };
  return { link: true, clientId: m.clientId, matchedOn: m.matchedOn, why: "exact_identifier" };
}

/** The sentence a ThreadClientMatch row keeps. English: it is a record, not a label. */
export function linkWhy(matchedOn = []) {
  const on = matchedOn.includes("phone") && matchedOn.includes("email") ? "phone number and email" : matchedOn.includes("email") ? "email address" : "phone number";
  return `Linked automatically: the conversation's ${on} belongs to this client and to no other client.`;
}

// ── The job ─────────────────────────────────────────────────────────────────

const ms = (v) => (v == null ? NaN : new Date(v).getTime());

/**
 * The client's jobs that were active when the message was sent. PURE.
 *
 * @param jobs [{ id, status, archivedAt, createdAt, completedAt, quote: { createdAt } }]
 */
export function activeJobsAt(jobs = [], at) {
  const t = ms(at);
  if (Number.isNaN(t)) return [];
  return (jobs || []).filter((j) => {
    if (!j || j.archivedAt) return false;
    // Not yet a job then — the same opening the timeline's job window uses:
    // the quote's creation, or the job's own when it has no quote.
    const opened = ms(j.quote?.createdAt ?? j.createdAt);
    if (!Number.isNaN(opened) && t < opened) return false;
    if (ACTIVE_JOB_STATUSES.includes(j.status)) return true;
    if (j.status === "completed") {
      const done = ms(j.completedAt);
      return !Number.isNaN(done) && t <= done + JOB_WINDOW_AFTER_MS;
    }
    return false;
  });
}

/**
 * Does the job's schedule contain the message's day? PURE.
 *
 * Days are the company's calendar days, compared at UTC midnight — the shape
 * Job.startDate / endDate are stored in (lib/jobs/visitDates.js). A visit
 * that is not cancelled contains its own day; the job's start→end contains
 * every day between (a start with no end is that one day, or — on a
 * recurring job, which has no last visit — every day from it).
 */
export function jobContains(job, at, timeZone) {
  const day = visitDay(at, timeZone);
  if (!day) return false;
  const d = day.getTime();
  for (const v of job?.visits || []) {
    if (!v || CANCELLED_VISIT.has(v.status)) continue;
    const vd = visitDay(v.scheduledAt, timeZone);
    if (vd && vd.getTime() === d) return true;
  }
  const start = ms(job?.startDate);
  if (Number.isNaN(start)) return false;
  const end = job?.endDate ? ms(job.endDate) : job?.recurring ? Infinity : start;
  return d >= start && d <= end;
}

/**
 * Which job is this message about? PURE.
 *
 * @returns {{ kind: "link", jobId, rule } | { kind: "ask", why, jobIds } | { kind: "none", why }}
 */
export function decideMessageJob({ client, jobs = [], at, timeZone = "UTC" } = {}) {
  const active = activeJobsAt(jobs, at);
  if (!active.length) return { kind: "none", why: "no_active_job" };
  if (!isContractorClient(client) && active.length === 1) {
    return { kind: "link", jobId: active[0].id, rule: JOB_LINKED_BY.ONLY_JOB };
  }
  const containing = active.filter((j) => jobContains(j, at, timeZone));
  if (containing.length === 1) return { kind: "link", jobId: containing[0].id, rule: JOB_LINKED_BY.DATE };
  return { kind: "ask", why: containing.length > 1 ? "overlapping" : isContractorClient(client) && active.length === 1 ? "contractor_outside_window" : "several_jobs", jobIds: active.map((j) => j.id) };
}

/** The job columns every decision reads. */
export const JOB_DECISION_SELECT = Object.freeze({
  id: true,
  title: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  completedAt: true,
  startDate: true,
  endDate: true,
  recurring: true,
  quote: { select: { createdAt: true, quoteNumber: true } },
  visits: { select: { scheduledAt: true, status: true } },
});

// ── Reads ───────────────────────────────────────────────────────────────────

/** Is automatic linking on for this company? A failed read is "off" — never a guess that writes. */
export async function autoLinkEnabled(db, companyId) {
  try {
    const row = await db.company.findFirst({ where: { id: companyId }, select: { autoLinkConversations: true } });
    if (!row) return false;
    return row.autoLinkConversations !== false;
  } catch {
    return false;
  }
}

async function companyTimeZone(db, companyId) {
  try {
    const row = await db.company.findFirst({ where: { id: companyId }, select: { timezone: true } });
    return row?.timezone || "UTC";
  } catch {
    return "UTC";
  }
}

const THREAD_SELECT = Object.freeze({
  id: true,
  companyId: true,
  clientId: true,
  leadId: true,
  participantName: true,
  participantExternalId: true,
  channel: { select: { platform: true } },
});

/** Every client of this company holding the identity's phone or email. */
export async function clientsHolding(db, companyId, identity) {
  const email = identity.email ? normaliseEmail(identity.email) : null;
  const tail = identity.phone ? phoneTail(identity.phone) : null;
  const [byEmail, phoneIds] = await Promise.all([
    email ? db.client.findMany({ where: { companyId, email: { equals: email, mode: "insensitive" } }, select: { ...CLIENT_MATCH_SELECT, type: true }, take: 25 }) : [],
    tail ? clientIdsByPhoneTail(db, companyId, tail) : [],
  ]);
  const byPhone = phoneIds.length ? await db.client.findMany({ where: { companyId, id: { in: phoneIds } }, select: { ...CLIENT_MATCH_SELECT, type: true } }) : [];
  const out = new Map();
  for (const c of [...byEmail, ...byPhone]) if (c && c.companyId === companyId) out.set(c.id, c);
  return [...out.values()];
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * Link one thread to its client if exactly one client owns its phone/email.
 * `dryRun` decides without writing (the backfill's report).
 *
 * @returns {{ linked: boolean, clientId?, matchId?, reason }}
 */
export async function autoLinkThreadClient(db, { companyId, threadId, dryRun = false, now = new Date() } = {}) {
  if (!db || !companyId || !threadId) return { linked: false, reason: "no_thread" };
  const thread = await db.messageThread.findFirst({ where: { id: threadId, companyId }, select: THREAD_SELECT });
  if (!thread || thread.companyId !== companyId) return { linked: false, reason: "no_thread" };
  if (thread.clientId) return { linked: false, reason: "already_linked", clientId: thread.clientId };
  if (!AUTO_LINK_PLATFORMS.includes(thread.channel?.platform)) return { linked: false, reason: "not_eligible" };

  const lead = thread.leadId
    ? await db.leadRequest.findFirst({ where: { id: thread.leadId, companyId }, select: { id: true, companyId: true, name: true, email: true, phone: true } })
    : null;
  const identity = threadIdentity(thread, lead && lead.companyId === companyId ? lead : null);
  if (!identity.phone && !identity.email) return { linked: false, reason: "no_contact" };

  const [clients, history] = await Promise.all([
    clientsHolding(db, companyId, identity),
    db.threadClientMatch.findMany({ where: { companyId, threadId: thread.id }, select: { id: true, threadId: true, clientId: true, status: true } }),
  ]);
  const decision = decideThreadClient({ companyId, thread, lead, clients, history });
  if (!decision.link) return { linked: false, reason: decision.why };
  if (dryRun) return { linked: false, wouldLink: true, clientId: decision.clientId, reason: "dry_run" };

  // Only while nobody has linked it — a person's choice always stands, and
  // two deliveries racing link once.
  const pointed = await db.messageThread.updateMany({ where: { id: thread.id, companyId, clientId: null }, data: { clientId: decision.clientId } });
  if (!pointed?.count) return { linked: false, reason: "already_linked" };
  const row = await db.threadClientMatch.create({
    data: {
      companyId,
      threadId: thread.id,
      clientId: decision.clientId,
      confidence: "certain",
      matchedOn: decision.matchedOn,
      why: linkWhy(decision.matchedOn),
      status: "linked",
      createdAt: now,
    },
    select: { id: true },
  });
  // "Client linked", with nobody's name — a machine did it.
  await writeActivity(db, { threadId: thread.id, type: "linked", kind: "client", at: now }).catch(() => null);
  return { linked: true, clientId: decision.clientId, matchId: row?.id || null, reason: "linked" };
}

/**
 * Read what the job decision needs for one client: the client, its jobs, the
 * company's calendar. Fenced on companyId twice (query and JS).
 */
export async function loadJobContext(db, { companyId, clientId }) {
  const client = await db.client.findFirst({ where: { id: clientId, companyId }, select: { id: true, companyId: true, type: true } });
  if (!client || client.companyId !== companyId) return null;
  const [jobs, timeZone] = await Promise.all([
    db.job.findMany({ where: { companyId, clientId: client.id, archivedAt: null, status: { not: "cancelled" } }, select: { ...JOB_DECISION_SELECT, companyId: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    companyTimeZone(db, companyId),
  ]);
  return { client, jobs: jobs.filter((j) => !j.companyId || j.companyId === companyId), timeZone };
}

/**
 * Tag one inbound message with its job when the rule can tell. Never
 * overwrites: only a message nobody has decided (jobId and jobLinkedBy both
 * null) is written.
 *
 * @param assumeClientId  the backfill's dry run: the client a link WOULD make
 * @returns {{ tagged: boolean, jobId?, rule?, decision }}
 */
export async function autoTagMessageJob(db, { companyId, threadId, messageId, dryRun = false, assumeClientId = null, context = null } = {}) {
  if (!db || !companyId || !messageId) return { tagged: false, reason: "no_message" };
  const message = await db.message.findFirst({
    where: { id: messageId, ...(threadId ? { threadId } : {}), thread: { companyId } },
    select: { id: true, threadId: true, direction: true, private: true, sentAt: true, jobId: true, jobLinkedBy: true, thread: { select: { companyId: true, clientId: true } } },
  });
  if (!message || message.thread?.companyId !== companyId) return { tagged: false, reason: "no_message" };
  if (message.direction !== "in" || message.private) return { tagged: false, reason: "not_inbound" };
  if (message.jobId || message.jobLinkedBy) return { tagged: false, reason: "decided" };
  const clientId = message.thread.clientId || assumeClientId;
  if (!clientId) return { tagged: false, reason: "no_client" };
  const ctx = context && context.client?.id === clientId ? context : await loadJobContext(db, { companyId, clientId });
  if (!ctx) return { tagged: false, reason: "no_client" };
  const decision = decideMessageJob({ client: ctx.client, jobs: ctx.jobs, at: message.sentAt, timeZone: ctx.timeZone });
  if (decision.kind !== "link") return { tagged: false, reason: decision.kind, decision };
  if (dryRun) return { tagged: false, wouldTag: true, jobId: decision.jobId, rule: decision.rule, decision };
  const res = await db.message.updateMany({
    where: { id: message.id, threadId: message.threadId, jobId: null, jobLinkedBy: null },
    data: { jobId: decision.jobId, jobLinkedBy: decision.rule },
  });
  return { tagged: Boolean(res?.count), jobId: decision.jobId, rule: decision.rule, decision };
}

/**
 * The hook a newly stored inbound message calls. Reads the switch once, links
 * the thread's client if it can, then tags the message's job. Never throws.
 */
export async function autoLinkOnArrival(db, { companyId, threadId, messageId, now = new Date() } = {}) {
  try {
    if (!db?.company || !companyId || !threadId) return { ran: false, reason: "no_thread" };
    if (!(await autoLinkEnabled(db, companyId))) return { ran: false, reason: "switched_off" };
    const client = await autoLinkThreadClient(db, { companyId, threadId, now }).catch((err) => {
      console.error("[autoLink] client link failed:", err?.message);
      return { linked: false, reason: "error" };
    });
    const job = messageId
      ? await autoTagMessageJob(db, { companyId, threadId, messageId }).catch((err) => {
          console.error("[autoLink] job tag failed:", err?.message);
          return { tagged: false, reason: "error" };
        })
      : null;
    return { ran: true, client, job };
  } catch (err) {
    console.error("[autoLink] failed:", err?.message);
    return { ran: false, reason: "error" };
  }
}

/**
 * Is this (thread, client) pair one a person refused? For the other matchers
 * that fill a blank clientId (lib/businessNumber/conversation.js,
 * lib/mailbox/file.js), so none of them re-links an undone pair.
 */
export async function pairRefused(db, { companyId, threadId, clientId }) {
  if (!db?.threadClientMatch?.findFirst || !companyId || !threadId || !clientId) return false;
  try {
    const row = await db.threadClientMatch.findFirst({ where: { companyId, threadId, clientId, status: "undone" }, select: { id: true } });
    return Boolean(row);
  } catch {
    // Unknown is refused: filling a link we cannot check is the guess this
    // whole file exists to avoid.
    return true;
  }
}

/**
 * Record a link another matcher just made (a brought number's, a filed
 * email's), so "Not this client" can undo it. Best effort.
 */
export async function recordAutoLink(db, { companyId, threadId, clientId, matchedOn = [], why = null, now = new Date() }) {
  if (!db?.threadClientMatch?.create) return null;
  try {
    return await db.threadClientMatch.create({
      data: { companyId, threadId, clientId, confidence: "certain", matchedOn, why: why || linkWhy(matchedOn), status: "linked", createdAt: now },
      select: { id: true },
    });
  } catch (err) {
    console.error("[autoLink] couldn't record a link:", err?.message);
    return null;
  }
}

// ── The one-time backfill ───────────────────────────────────────────────────

/**
 * Link every eligible unlinked thread of one company, and tag every
 * undecided inbound message on a client's thread. `apply: false` (the
 * default) writes nothing and reports what it WOULD do.
 *
 * Bounded: `threadLimit` threads and `messageLimit` messages per run, newest
 * first; run it again to continue (it only ever touches undecided rows).
 */
export async function backfillCompany(db, { companyId, apply = false, threadLimit = 5000, messageLimit = 20000, now = new Date() } = {}) {
  const report = {
    companyId,
    apply,
    switchedOff: false,
    threads: { scanned: 0, linked: 0, ambiguous: 0, undone: 0, noMatch: 0, noContact: 0 },
    messages: { scanned: 0, onlyJob: 0, byDate: 0, ask: 0, noActiveJob: 0 },
  };
  if (!(await autoLinkEnabled(db, companyId))) {
    report.switchedOff = true;
    return report;
  }
  const threads = await db.messageThread.findMany({
    where: { companyId, clientId: null, channel: { platform: { in: [...AUTO_LINK_PLATFORMS] } } },
    orderBy: { lastMessageAt: "desc" },
    take: threadLimit,
    select: { id: true },
  });
  const wouldLink = new Map();
  for (const t of threads) {
    report.threads.scanned += 1;
    const r = await autoLinkThreadClient(db, { companyId, threadId: t.id, dryRun: !apply, now }).catch(() => ({ reason: "error" }));
    if (r.linked || r.wouldLink) {
      report.threads.linked += 1;
      wouldLink.set(t.id, r.clientId);
    } else if (r.reason === "ambiguous") report.threads.ambiguous += 1;
    else if (r.reason === "undone") report.threads.undone += 1;
    else if (r.reason === "no_contact") report.threads.noContact += 1;
    else report.threads.noMatch += 1;
  }

  const linkedThreadIds = apply ? [] : [...wouldLink.keys()];
  const messages = await db.message.findMany({
    where: {
      direction: "in",
      private: false,
      jobId: null,
      jobLinkedBy: null,
      thread: { companyId, OR: [{ clientId: { not: null } }, ...(linkedThreadIds.length ? [{ id: { in: linkedThreadIds } }] : [])] },
    },
    orderBy: { sentAt: "desc" },
    take: messageLimit,
    select: { id: true, threadId: true, thread: { select: { clientId: true } } },
  });
  const contexts = new Map();
  for (const m of messages) {
    report.messages.scanned += 1;
    const clientId = m.thread?.clientId || wouldLink.get(m.threadId) || null;
    if (!clientId) continue;
    if (!contexts.has(clientId)) contexts.set(clientId, await loadJobContext(db, { companyId, clientId }).catch(() => null));
    const r = await autoTagMessageJob(db, { companyId, threadId: m.threadId, messageId: m.id, dryRun: !apply, assumeClientId: clientId, context: contexts.get(clientId) }).catch(() => ({ reason: "error" }));
    const rule = r.rule || r.decision?.rule;
    if (r.tagged || r.wouldTag) {
      if (rule === JOB_LINKED_BY.DATE) report.messages.byDate += 1;
      else report.messages.onlyJob += 1;
    } else if (r.reason === "ask") report.messages.ask += 1;
    else if (r.reason === "none") report.messages.noActiveJob += 1;
  }
  return report;
}
