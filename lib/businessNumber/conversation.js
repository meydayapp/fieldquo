// lib/businessNumber/conversation.js
//
// Every text and call on a brought number, in the conversation history, on
// the right client / lead / job — through the inbox that already exists.
//
// ══ No second inbox ══════════════════════════════════════════════════════════
//
// A text to a brought number arrives at /api/sms/inbound, which resolves it to
// the company through Company.smsFromNumber (lib/sms/clientLine.js — the
// "dedicated" case) and files it through lib/aiEmployee/smsChannel.js onto the
// company's "sms" MessagingChannel, exactly like a text to the shared line.
// What a dedicated line adds, and what this file holds:
//
//   1. LINKING. A shared-line text only ever comes from a phone the company
//      already has on a client record. A dedicated line hears from strangers.
//      linkThreadByPhone() fills a blank clientId / leadId / jobId on the
//      thread from the company's own rows — one unambiguous match or nothing,
//      never an overwrite — choosing the job by the same rule email filing
//      uses (lib/mailbox/filingTarget.js chooseFilingTarget), so a text that
//      names a quote number files against that quote's job.
//   2. A NEW PERSON → A LEAD, by the social-leads rules
//      (lib/leads/conversationLead.js), which the ingest now runs for a
//      dedicated-line SMS thread as it does for Meta threads. Nothing about
//      those rules changes: no lead from "hi", none from spam, none that
//      overwrites a person's edit.
//   3. CALLS. fileCallOnThread() writes a `call` activity row on the
//      caller's own SMS thread — creating the thread if this is the first
//      contact — so a missed call, a voicemail and the texts around them read
//      as one conversation.
//   4. METERING. Texts and call minutes on a brought number are charged to the
//      phone balance, per lib/businessNumber/costs.js, idempotent on the
//      provider's own ids.

import { db } from "@/lib/db";
import { ownChannelFor } from "@/lib/aiEmployee/ownChannel";
import { writeActivity, buildActivity, activityRowData } from "@/lib/messaging/activity";
import { allocateThreadNumber } from "@/lib/messaging/threadNumber";
import { pushInboundMessage } from "@/lib/messaging/pushInbound";
import { chooseFilingTarget } from "@/lib/mailbox/filingTarget";

const digits10 = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};

/**
 * Which of the company's own records this phone belongs to. PURE.
 *
 * One client, or one open lead, or nothing. Two clients sharing a phone (a
 * couple entered twice, a landlord and a tenant) is AMBIGUOUS and links to
 * neither — filing one person's texts under another's record is the failure
 * the conversation-attribution check exists to stop.
 */
export function matchPhone({ phone, clients = [], leads = [] } = {}) {
  const key = digits10(phone);
  if (!key) return { kind: "none" };
  const cs = clients.filter((c) => digits10(c?.phone) === key);
  if (cs.length === 1) return { kind: "client", id: cs[0].id, name: cs[0].name || null };
  if (cs.length > 1) return { kind: "ambiguous" };
  const ls = leads.filter((l) => digits10(l?.phone) === key);
  if (ls.length === 1) return { kind: "lead", id: ls[0].id, name: ls[0].name || null };
  if (ls.length > 1) return { kind: "ambiguous" };
  return { kind: "none" };
}

/**
 * Fill the thread's blank links from the company's own records. Never
 * overwrites a link a person set. Company-scoped on every read and write.
 */
export async function linkThreadByPhone(prisma = db, { companyId, threadId, phone, body = "" }) {
  const key = digits10(phone);
  if (!companyId || !threadId || !key) return { linked: false };
  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, companyId },
    select: { id: true, clientId: true, leadId: true, jobId: true, quoteId: true },
  });
  if (!thread) return { linked: false };
  if (thread.clientId && thread.leadId && thread.jobId) return { linked: false };

  // The digits are matched in SQL for the same reason lib/sms/clientLine.js
  // gives: phone columns are free text, and pulling every row to compare in
  // JS is a table scan per text.
  const like = `%${key}`;
  const [clients, leads] = await Promise.all([
    prisma.$queryRaw`SELECT id, name, phone FROM "Client" WHERE "companyId" = ${companyId} AND phone IS NOT NULL AND regexp_replace(phone, '\\D', '', 'g') LIKE ${like} LIMIT 5`,
    prisma.$queryRaw`SELECT id, name, phone FROM "LeadRequest" WHERE "companyId" = ${companyId} AND status IN ('new','contacted') AND phone IS NOT NULL AND regexp_replace(phone, '\\D', '', 'g') LIKE ${like} LIMIT 5`,
  ]);
  const match = matchPhone({ phone, clients: clients || [], leads: leads || [] });
  if (match.kind !== "client" && match.kind !== "lead") return { linked: false, match: match.kind };

  let target = { jobId: null, quoteId: null };
  if (match.kind === "client" && !thread.jobId && !thread.quoteId) {
    const [quotes, invoices, jobs] = await Promise.all([
      prisma.quote.findMany({ where: { companyId, clientId: match.id }, select: { id: true, quoteNumber: true, status: true, archivedAt: true, createdAt: true } }),
      prisma.invoice.findMany({ where: { companyId, clientId: match.id }, select: { id: true, invoiceNumber: true, quoteId: true, jobId: true } }),
      prisma.job.findMany({ where: { companyId, clientId: match.id }, select: { id: true, quoteId: true, status: true, createdAt: true, updatedAt: true } }),
    ]);
    target = chooseFilingTarget({ subject: "", body, quotes, invoices, jobs });
  }

  const data = {
    ...(!thread.clientId && match.kind === "client" ? { clientId: match.id } : {}),
    ...(!thread.leadId && match.kind === "lead" ? { leadId: match.id } : {}),
    ...(!thread.jobId && !thread.quoteId && (target.jobId || target.quoteId) ? { jobId: target.jobId || null, quoteId: target.quoteId || null } : {}),
  };
  if (!Object.keys(data).length) return { linked: false, match: match.kind };
  await prisma.messageThread.updateMany({ where: { id: thread.id, companyId }, data });
  for (const kind of ["client", "lead", "job", "quote"]) {
    if (data[`${kind}Id`]) await writeActivity(prisma, { threadId: thread.id, type: "linked", kind }).catch(() => null);
  }
  return { linked: true, match: match.kind, data };
}

/**
 * Put a call on the caller's SMS thread. Idempotent on the call's own SID —
 * the activity row's externalId is `call:<CallSid>`, and the thread's unique
 * (threadId, externalId) refuses a second one when Twilio retries.
 *
 * @param phone     the OTHER party (the caller, or the client a member rang)
 * @param activity  { direction, outcome, durationSec, by }
 */
export async function fileCallOnThread(prisma = db, { companyId, phone, callSid, activity, at = new Date() }) {
  if (!companyId || !phone || !callSid) return { filed: false };
  const channel = await ownChannelFor(companyId, "sms", prisma);
  if (!channel) return { filed: false };
  const thread = await prisma.messageThread.upsert({
    where: { channelId_externalThreadId: { channelId: channel.id, externalThreadId: phone } },
    create: {
      companyId,
      channelId: channel.id,
      externalThreadId: phone,
      participantExternalId: phone,
      lastMessageAt: at,
      unread: 0,
      status: "open",
      statusChangedAt: at,
      lastInboundAt: null,
      threadNumber: null,
    },
    update: {},
  });
  // The call's own SID is the row's externalId, so the thread's unique
  // (threadId, externalId) makes a retried webhook a no-op rather than a
  // second line — decided by the database, not by a read-then-write race.
  const data = activityRowData({ threadId: thread.id, activity: buildActivity("call", activity), at });
  if (!data) return { filed: false };
  try {
    await prisma.message.create({ data: { ...data, externalId: `call:${callSid}` } });
  } catch (err) {
    if (err?.code === "P2002") return { filed: false, duplicate: true, threadId: thread.id };
    throw err;
  }
  const missed = activity.direction === "in" && activity.outcome !== "answered";
  await prisma.messageThread.update({
    where: { id: thread.id },
    data: {
      ...(at > thread.lastMessageAt ? { lastMessageAt: at } : {}),
      // A missed call is somebody waiting on the company, the same as an
      // unanswered text: it raises the unread count. An answered call does not.
      ...(missed ? { unread: { increment: 1 } } : {}),
    },
  });
  if (!thread.threadNumber) await allocateThreadNumber(prisma, { companyId, threadId: thread.id }).catch(() => null);
  await linkThreadByPhone(prisma, { companyId, threadId: thread.id, phone }).catch(() => null);
  if (missed) {
    void pushInboundMessage({
      companyId,
      threadId: thread.id,
      participantName: thread.participantName || null,
      body: activity.outcome === "voicemail" ? "Voicemail" : "Missed call",
    });
  }
  return { filed: true, threadId: thread.id };
}

// Metering lives in ./meter.js — see its header for why it is a separate file.
export { meterText, meterCall } from "./meter";
