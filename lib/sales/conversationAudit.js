// lib/sales/conversationAudit.js
//
// The owner reading a rep's conversations with prospects — texts
// (SalesSmsMessage, grouped by the other number) and emails (SalesThread /
// SalesMessage) — from the console.
//
// ══ Read-only, superadmin-only, recorded, and the rep is told ═════════════
//
// Every read here is reached only through "chat:audit"
// (SUPERADMIN_ONLY_PERMISSIONS — lib/platform/permissions.js says why the
// owner and nobody below). Nothing in this file writes to a rep's thread:
// no send, no triage, no read marker — the rep's own screens keep their
// unread counts exactly as they were. The one write is the record of the
// look: a PlatformAuditLog row (`rep_conversation_audited`) naming the rep,
// the thread and the moment.
//
// The prospect is not a party to the console, so no line is posted INTO the
// conversation (the staff chat does that — lib/staff/auditRules.js — because
// there the participants are staff). Instead the rep sees "Reviewed by the
// owner on <date>" on that thread in their own portal, read back from the
// audit row by lastReviewOf() — the record IS the notice, so the two cannot
// disagree.
//
// ══ Reuses the rep's own readers where they are pure of side-effects ══════
//
// The text list is lib/sales/salesSms.js's salesConversations() — the same
// grouping, naming and ordering the rep's Texts screen draws — so the owner's
// list matches the rep's row for row. It is called WITHOUT readStates, so it
// counts nothing as unread and reads no marker. The thread itself is read
// directly, because salesThread() omits the lead and the owner's screen
// names the business.
import { db } from "@/lib/db";
import { salesConversations } from "@/lib/sales/salesSms";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { publicAttachments } from "@/lib/messaging/attachments";

/** The kinds a conversation can be. Spelled once; the route checks against it. */
export const CONVERSATION_KINDS = ["sms", "email"];

const REP_SELECT = { id: true, name: true, email: true, active: true, endedAt: true };

/** Case-blind "does this row match the search box". Pure; exported for the check. */
export function matchesQuery(row, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return true;
  return [row?.name, row?.e164, row?.subject, row?.lead?.businessName]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(needle));
}

/**
 * A rep's conversations, both kinds, for the picker and the two lists.
 *
 * @returns {{ rep, reps, sms: [], email: [] }} — `rep` null when no repId
 *   was given (the screen then shows the picker alone).
 */
export async function repConversations({ repId = null, q = "" } = {}) {
  const reps = await db.salesRep.findMany({ orderBy: { name: "asc" }, select: REP_SELECT });
  const rep = repId ? reps.find((r) => r.id === repId) || null : null;
  if (!rep) return { rep: null, reps, sms: [], email: [] };

  const [sms, threads] = await Promise.all([
    salesConversations({ salesRepId: rep.id, limit: 200 }),
    db.salesThread.findMany({
      where: { salesRepId: rep.id },
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      select: {
        id: true,
        subject: true,
        lastMessageAt: true,
        lead: { select: { id: true, businessName: true, contactName: true, status: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 1, select: { direction: true, sentAt: true, body: true } },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  return {
    rep,
    reps,
    sms: sms
      .filter((c) => matchesQuery(c, q))
      .map((c) => ({
        e164: c.e164,
        name: c.name || null,
        leadId: c.leadId || null,
        lastAt: c.lastAt,
        lastBody: c.lastBody,
        lastDirection: c.lastDirection,
        count: c.count,
      })),
    email: threads
      .filter((t) => matchesQuery({ subject: t.subject, lead: t.lead, name: t.lead?.businessName }, q))
      .map((t) => ({
        id: t.id,
        subject: t.subject,
        lead: t.lead,
        lastAt: t.lastMessageAt,
        lastBody: t.messages[0]?.body || null,
        lastDirection: t.messages[0]?.direction || null,
        count: t._count.messages,
      })),
  };
}

/** The audit row every read of one thread writes. */
function recordLook(viewer, details, client = db) {
  return client.platformAuditLog.create({
    data: { platformAdminId: viewer.id, action: "rep_conversation_audited", details },
    select: { id: true, createdAt: true },
  });
}

/**
 * One text conversation between a rep and a number, oldest first.
 * Returns null when the rep does not exist or has no messages with it.
 */
export async function repSmsConversation(viewer, { repId, e164 }, { client = db } = {}) {
  const other = normalisePhone(e164);
  if (!viewer?.id || !repId || !other) return null;
  const rep = await client.salesRep.findUnique({ where: { id: repId }, select: REP_SELECT });
  if (!rep) return null;

  const rows = await client.salesSmsMessage.findMany({
    where: { salesRepId: rep.id, OR: [{ toE164: other }, { fromE164: other }] },
    orderBy: { sentAt: "asc" },
    select: {
      id: true,
      direction: true,
      body: true,
      sentAt: true,
      leadId: true,
      lead: { select: { id: true, businessName: true, contactName: true, status: true } },
    },
  });
  if (!rows.length) return null;
  const lead = rows.find((m) => m.lead)?.lead || null;

  // The record first, then the words — the same order lib/staff/audit.js
  // keeps and for the same reason.
  const look = await recordLook(viewer, { repId: rep.id, kind: "sms", with: other, leadId: lead?.id || null }, client);

  return {
    kind: "sms",
    rep,
    with: other,
    lead,
    messages: rows.map((m) => ({ id: m.id, direction: m.direction, body: m.body, at: m.sentAt })),
    audited: { at: look.createdAt },
  };
}

/** One email thread, oldest first. Null when there is no such thread. */
export async function repEmailConversation(viewer, { threadId }, { client = db } = {}) {
  if (!viewer?.id || !threadId) return null;
  const thread = await client.salesThread.findUnique({
    where: { id: String(threadId) },
    select: {
      id: true,
      subject: true,
      salesRepId: true,
      salesRep: { select: REP_SELECT },
      lastMessageAt: true,
      createdAt: true,
      lead: { select: { id: true, businessName: true, contactName: true, email: true, status: true } },
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          direction: true,
          fromAddress: true,
          toAddress: true,
          subject: true,
          body: true,
          sentAt: true,
          attachments: true,
          forwardProviderId: true,
        },
      },
    },
  });
  if (!thread) return null;

  const look = await recordLook(
    viewer,
    { repId: thread.salesRepId, kind: "email", threadId: thread.id, leadId: thread.lead?.id || null },
    client,
  );

  return {
    kind: "email",
    rep: thread.salesRep,
    thread: { id: thread.id, subject: thread.subject, lastMessageAt: thread.lastMessageAt, createdAt: thread.createdAt },
    lead: thread.lead,
    // The same public shape the rep's own route serves: the fetcher-only
    // attachment fields never reach a browser, from this door either.
    messages: thread.messages.map(({ attachments, forwardProviderId, ...m }) => ({
      ...m,
      at: m.sentAt,
      attachments: publicAttachments(attachments),
      forwardedToMailbox: Boolean(forwardProviderId),
    })),
    audited: { at: look.createdAt },
  };
}

/**
 * When the owner last read this thread, for the rep's own screen.
 *
 * Read from the audit row — there is no second column to drift from it.
 * Fails soft to null: the rep's thread must not fail to load because the
 * audit log could not be read, and "not reviewed" is the safe reading of
 * "could not look".
 *
 * @param kind  "sms" with `with` (E.164), or "email" with `threadId`
 */
export async function lastReviewOf({ repId, kind, with: withE164 = null, threadId = null } = {}, { client = db } = {}) {
  if (!repId || !CONVERSATION_KINDS.includes(kind)) return null;
  const keyed =
    kind === "sms"
      ? { path: ["with"], equals: normalisePhone(withE164) || "" }
      : { path: ["threadId"], equals: String(threadId || "") };
  try {
    const row = await client.platformAuditLog.findFirst({
      where: {
        action: "rep_conversation_audited",
        AND: [
          { details: { path: ["repId"], equals: repId } },
          { details: { path: ["kind"], equals: kind } },
          { details: keyed },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, platformAdmin: { select: { email: true } } },
    });
    if (!row) return null;
    return { at: row.createdAt, by: row.platformAdmin?.email || null };
  } catch (err) {
    console.error("[conversation audit] could not read the last review:", err?.message);
    return null;
  }
}
