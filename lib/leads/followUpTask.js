// lib/leads/followUpTask.js
//
// "I'll get in touch when I'm back" → a dated task on the office to-do list,
// and a notification on the day (app/api/cron/lead-follow-ups).
//
// ══ Why a Task, not a new model ════════════════════════════════════════════
//
// The to-do list (Task) is where the office already looks for "somebody owes
// somebody an action" — lib/tasks/autoCreate.js puts the quote-approved,
// invoice-sent and job-finished reminders there for the same reason. A second
// "follow-up" table would be a second list nobody opens. Task has no leadId,
// and none is added: the task is tied by its `sourceKey`,
// "conversation_follow_up:<threadId>:<messageId>" — unique in the schema, so a
// message re-delivered by Meta or a second capture pass can never make two —
// and the lead card finds its follow-up through the thread it came from
// (lib/leads/followUpTask.js followUpsForThreads). The client, when the thread
// already has one, is set too, so the task shows on the client's page.
//
// ══ Who it is for ══════════════════════════════════════════════════════════
//
// The lead's assignee, else the thread's assignee, else the owner — whoever
// is answering this person. Attributed (createdById, required) to the owner,
// exactly as autoCreate's machine-made tasks are.
//
// ══ One open follow-up per conversation ════════════════════════════════════
//
// A person who says "next week" on Monday and "actually after the 17th" on
// Tuesday owes ONE call. A second promise while one task is still open moves
// that task's date instead of adding a row.

import { fallbackAuthorId } from "@/lib/tasks/autoCreate";
import { appSentence } from "@/lib/notify/push";

export const FOLLOW_UP_SOURCE_PREFIX = "conversation_follow_up:";

/** The idempotency key. Pure. */
export function followUpSourceKey(threadId, messageId) {
  return `${FOLLOW_UP_SOURCE_PREFIX}${threadId}:${messageId || "thread"}`;
}

/** threadId out of a follow-up task's sourceKey, or null. Pure. */
export function threadIdOfFollowUp(sourceKey) {
  if (typeof sourceKey !== "string" || !sourceKey.startsWith(FOLLOW_UP_SOURCE_PREFIX)) return null;
  const rest = sourceKey.slice(FOLLOW_UP_SOURCE_PREFIX.length);
  const id = rest.split(":")[0];
  return id || null;
}

async function companyLanguage(prisma, companyId) {
  const row = await prisma.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } }).catch(() => null);
  return row?.defaultLanguage || "en";
}

/**
 * Create (or re-date) the follow-up for one conversation. Never throws into
 * a caller that swallowed it anyway — returns null on failure.
 *
 * @returns {{ id, dueDate, created: boolean, moved?: boolean } | null}
 */
export async function ensureFollowUpTask(prisma, { companyId, threadId, leadId = null, clientId = null, assignedToId = null, name = null, intent, now = new Date() }) {
  if (!companyId || !threadId || !intent?.due) return null;
  const sourceKey = followUpSourceKey(threadId, intent.messageId);
  const due = new Date(intent.due);

  // Already made for this very message: nothing to do.
  const same = await prisma.task.findFirst({ where: { companyId, sourceKey }, select: { id: true, dueDate: true } });
  if (same) return { id: same.id, dueDate: same.dueDate, created: false };

  // An open follow-up for this conversation from an EARLIER message: the new
  // promise moves it (and takes over its key, so this message is not seen as
  // new again on the next pass).
  const open = await prisma.task.findFirst({
    where: { companyId, sourceKey: { startsWith: `${FOLLOW_UP_SOURCE_PREFIX}${threadId}:` }, status: { in: ["open", "in_progress"] } },
    select: { id: true },
  });
  if (open) {
    await prisma.task.updateMany({ where: { id: open.id, companyId }, data: { dueDate: due, sourceKey } });
    return { id: open.id, dueDate: due, created: false, moved: true };
  }

  const ownerId = await fallbackAuthorId(companyId, prisma);
  if (!ownerId) return null;

  // The person answering this lead: the lead's assignee, else the thread's.
  let assignee = assignedToId || null;
  if (leadId) {
    const lead = await prisma.leadRequest.findFirst({ where: { id: leadId, companyId }, select: { assignedToId: true } }).catch(() => null);
    if (lead?.assignedToId) assignee = lead.assignedToId;
  }

  const language = await companyLanguage(prisma, companyId);
  const who = name || (await appSentence(language, "app.autoTask.theClient")) || "the client";
  const title = (await appSentence(language, "app.autoTask.conversationFollowUp.title", { client: who })) || `Follow up with ${who}`;
  const description =
    (await appSentence(language, intent.vague ? "app.autoTask.conversationFollowUp.descVague" : "app.autoTask.conversationFollowUp.desc", {
      client: who,
      quote: intent.quote || "",
    })) || `${who} said: “${intent.quote || ""}”`;

  try {
    const task = await prisma.task.create({
      data: {
        companyId,
        title: String(title).slice(0, 200),
        description: String(description).slice(0, 2000),
        dueDate: due,
        status: "open",
        priority: "normal",
        createdById: ownerId,
        assignedToId: assignee || ownerId,
        clientId: clientId || null,
        sourceKey,
      },
      select: { id: true, dueDate: true },
    });
    return { id: task.id, dueDate: task.dueDate, created: true };
  } catch (err) {
    // P2002: a concurrent pass made it first — the constraint is the guard.
    if (err?.code === "P2002") return { id: null, dueDate: due, created: false };
    console.error("[leads/followUpTask] create failed:", err?.message);
    return null;
  }
}

/** At most this many follow-ups are announced per cron tick. */
export const NOTIFY_PER_RUN = 200;

/**
 * The notification on the day: every open follow-up task whose due date has
 * come, announced ONCE to its assignee (NotificationEvent "lead.follow_up_due"
 * with the task's id is the record that it was). Runs on the messaging-snooze
 * cron — the same tick that brings snoozed conversations back. Per task best
 * effort; returns what it did.
 *
 * @param notify  lib/notifications/notify.js notifyEvent (a seam for the check)
 */
export async function notifyDueFollowUps(prisma, { now = new Date(), notify }) {
  const due = await prisma.task.findMany({
    where: {
      sourceKey: { startsWith: FOLLOW_UP_SOURCE_PREFIX },
      status: { in: ["open", "in_progress"] },
      dueDate: { not: null, lte: now },
    },
    select: { id: true, companyId: true, sourceKey: true, assignedToId: true, title: true },
    orderBy: { dueDate: "asc" },
    take: NOTIFY_PER_RUN,
  });
  if (!due.length) return { due: 0, sent: 0 };
  const already = await prisma.notificationEvent.findMany({
    where: { type: "lead.follow_up_due", entityId: { in: due.map((t) => t.id) } },
    select: { entityId: true },
  });
  const done = new Set(already.map((a) => a.entityId));
  let sent = 0;
  for (const t of due) {
    if (done.has(t.id)) continue;
    const threadId = threadIdOfFollowUp(t.sourceKey);
    const thread = threadId
      ? await prisma.messageThread.findFirst({ where: { id: threadId, companyId: t.companyId }, select: { participantName: true, leadId: true } }).catch(() => null)
      : null;
    const result = await Promise.resolve(
      notify({
        companyId: t.companyId,
        type: "lead.follow_up_due",
        // The event's entity is the TASK: that is what "announced once" is
        // keyed on. The row opens the leads board (catalog entityType).
        entityId: t.id,
        params: { leadName: thread?.participantName || "" },
        recipientUserIds: t.assignedToId ? [t.assignedToId] : undefined,
      }),
    ).catch(() => null);
    if (result?.created) sent++;
  }
  return { due: due.length, sent };
}

/**
 * The open follow-ups for a set of threads, keyed by thread id. One query.
 * Scoped by company.
 */
export async function followUpsForThreads(prisma, companyId, threadIds) {
  const ids = [...new Set((threadIds || []).filter((x) => typeof x === "string" && x))];
  if (!companyId || !ids.length) return new Map();
  // One condition, not one per thread: the company's open follow-ups are a
  // short list, and an OR of a few hundred prefixes on every board load is not.
  const rows = await prisma.task.findMany({
    where: {
      companyId,
      status: { in: ["open", "in_progress"] },
      sourceKey: { startsWith: FOLLOW_UP_SOURCE_PREFIX },
    },
    select: { id: true, dueDate: true, sourceKey: true, title: true, assignedToId: true },
    orderBy: { dueDate: "asc" },
    take: 2000,
  });
  const wanted = new Set(ids);
  const out = new Map();
  for (const r of rows) {
    const t = threadIdOfFollowUp(r.sourceKey);
    if (t && wanted.has(t) && !out.has(t)) out.set(t, { id: r.id, dueDate: r.dueDate, title: r.title });
  }
  return out;
}
