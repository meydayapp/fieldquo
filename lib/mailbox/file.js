// lib/mailbox/file.js
//
// One matched email → one Message on the client's conversation, with its
// EmailMessage headers. The tenant-boundary file of the mailbox feature.
//
// ══ Why the conversation inbox's own tables ═══════════════════════════════
//
// A filed email is a MessageThread / Message on a platform "email"
// MessagingChannel, not a table of its own. Everything that reads a
// conversation — the inbox (/app/messages), the free hot/warm/cold score
// (lib/messaging/rescoreThread.js), the paid temperature read, the monthly
// winning-vs-lost review (lib/attribution/loadMonthlyConversations.js), the
// response-time columns — reads MessageThread → Message. An email enquiry is
// scored and reviewed exactly like a text or a chat one because it IS one to
// every one of those readers; a second table would have been a second
// conversation model every one of them had to learn.
//
// ══ The rules this file keeps (the same three as lib/messaging/ingest.js) ═
//
//  1. The company comes from the MAILBOX row, never from the message. A
//     header naming anything is data.
//  2. Every write is idempotent on the RFC Message-ID, per company, enforced
//     by EmailMessage's unique index inside the same transaction as the
//     Message — a message seen in INBOX and Sent, in two members' mailboxes,
//     or again after a UIDVALIDITY reset is stored once. Losing the race
//     rolls the whole write back.
//  3. Counters move only for a message that was genuinely new, and never for
//     BACKFILL: ninety days of history arriving on connect day is not ninety
//     days of unread messages, and it must not reopen threads or ring
//     anybody's phone.
//
// ══ What is deliberately NOT done ═════════════════════════════════════════
//
// No AI employee reply (an email is never answered automatically) and no
// push notification (the contractor's own mail app already rang). Both are
// what lib/messaging/ingest.js does for Meta's channels; neither is right
// for a mailbox the person reads anyway.

import { createHash } from "node:crypto";
import { responseStamps } from "@/lib/messaging/waiting";
import { readStatus } from "@/lib/messaging/outcomes";
import { allocateThreadNumber } from "@/lib/messaging/threadNumber";
import { rescoreThread } from "@/lib/messaging/rescoreThread";
import { writeActivity } from "@/lib/messaging/activity";
import { normaliseSubject } from "@/lib/sales/mailbox/parse";
import { formatAddressList } from "./addresses";
import { cleanHeader } from "./text";

/** A reply with no References that shares a subject and a person joins within this. */
export const SUBJECT_JOIN_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * A Message-ID for a message that arrived without one — stable across syncs
 * so the unique index still dedupes it. Derived from what the message says,
 * never random.
 */
export function syntheticMessageId({ from, date, subject, body }) {
  const h = createHash("sha256")
    .update([from || "", date ? new Date(date).toISOString() : "", subject || "", String(body || "").slice(0, 500)].join("\u0000"))
    .digest("hex")
    .slice(0, 32);
  return `fq-${h}@no-message-id.invalid`;
}

/** The Message.externalId for an email — namespaced so it never collides with a Meta id. */
export function emailExternalId(rfcMessageId) {
  return `email:${String(rfcMessageId).slice(0, 900)}`;
}

/** The MessagingChannel for one mailbox — created on connect, reused on reconnect. */
export async function channelForMailbox(db, mailbox) {
  if (mailbox.channelId) {
    const existing = await db.messagingChannel.findFirst({ where: { id: mailbox.channelId, companyId: mailbox.companyId } });
    if (existing) {
      if (existing.disconnectedAt || existing.name !== mailbox.address) {
        await db.messagingChannel.update({ where: { id: existing.id }, data: { disconnectedAt: null, status: "connected", name: mailbox.address } });
      }
      return existing;
    }
  }
  const externalId = `email:${mailbox.companyId}:${mailbox.address}`;
  const channel = await db.messagingChannel.upsert({
    where: { platform_externalId: { platform: "email", externalId } },
    // No token: the credential lives on MailboxConnection under its own key.
    // accessTokenEnc is required by the column and nothing decrypts it for
    // this platform — the same convention lib/aiEmployee/ownChannel.js uses.
    create: { companyId: mailbox.companyId, platform: "email", externalId, name: mailbox.address, accessTokenEnc: "", status: "connected" },
    update: { disconnectedAt: null, status: "connected" },
  });
  if (channel.companyId !== mailbox.companyId) throw new Error("channel belongs to another company");
  await db.mailboxConnection.update({ where: { id: mailbox.id }, data: { channelId: channel.id } });
  return channel;
}

/**
 * Which thread an email joins: its References / In-Reply-To chain first
 * (company-wide, so a reply found in another member's mailbox joins the same
 * conversation), then the same subject with the same person on this
 * company's email threads recently, else a new one.
 *
 * @returns { threadId } | { externalThreadId }
 */
export async function chooseThread(db, { companyId, normal, counterpart, now = new Date() }) {
  const chain = [normal.inReplyTo, ...(normal.references || [])].filter(Boolean);
  if (chain.length) {
    const hit = await db.emailMessage.findFirst({
      where: { companyId, rfcMessageId: { in: chain } },
      select: { message: { select: { threadId: true } } },
    });
    if (hit?.message?.threadId) return { threadId: hit.message.threadId };
  }
  const key = normaliseSubject(normal.subject);
  if (key && counterpart) {
    const since = new Date(now.getTime() - SUBJECT_JOIN_WINDOW_MS);
    const candidates = await db.emailMessage.findMany({
      where: { companyId, createdAt: { gte: since }, message: { thread: { participantExternalId: counterpart } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { subject: true, message: { select: { threadId: true } } },
    });
    const same = candidates.find((c) => normaliseSubject(c.subject) === key);
    if (same?.message?.threadId) return { threadId: same.message.threadId };
  }
  const root = (normal.references && normal.references[0]) || normal.inReplyTo || normal.rfcMessageId;
  return { externalThreadId: `email:${String(root).slice(0, 500)}` };
}

/**
 * File one message. Everything is decided before this is called — the
 * counterpart matched, the target chosen, the attachments stored.
 *
 * @param mailbox   the MailboxConnection row
 * @param channel   its MessagingChannel
 * @param normal    { rfcMessageId, inReplyTo, references[], subject, from[], to[], cc[],
 *                    date, body, direction, folder, providerRef }
 * @param match     { kind: "client"|"lead", id, name, address, displayName }
 * @param target    { jobId, quoteId } from chooseFilingTarget
 * @param attachments  the stored Message.attachments array (may be empty)
 * @param backfill  true for history pulled on connect — see rule 3
 * @returns { filed: boolean, reason?, threadId?, messageId? }
 */
export async function fileEmail(db, { mailbox, channel, normal, match, target = {}, attachments = [], backfill = false, now = new Date(), rescore = rescoreThread }) {
  const companyId = mailbox.companyId;
  const sentAt = normal.date instanceof Date && !Number.isNaN(normal.date.getTime()) && normal.date <= new Date(now.getTime() + 24 * 3600 * 1000) ? normal.date : now;
  const counterpart = match.address;
  const where = await chooseThread(db, { companyId, normal, counterpart, now });

  let thread;
  if (where.threadId) {
    thread = await db.messageThread.findFirst({ where: { id: where.threadId, companyId } });
  }
  if (!thread) {
    thread = await db.messageThread.upsert({
      where: { channelId_externalThreadId: { channelId: channel.id, externalThreadId: where.externalThreadId || `email:${normal.rfcMessageId}` } },
      create: {
        companyId,
        channelId: channel.id,
        externalThreadId: where.externalThreadId || `email:${normal.rfcMessageId}`,
        participantExternalId: counterpart,
        participantName: cleanHeader(match.name || match.displayName || counterpart, 120),
        // When the conversation STARTED, not when the sync found it. The
        // monthly review counts threads by createdAt; a 90-day backfill
        // stamped "now" would pour three months of email into this month.
        createdAt: sentAt,
        lastMessageAt: sentAt,
        unread: 0,
        status: "open",
        statusChangedAt: sentAt,
        lastInboundAt: null,
        threadNumber: null,
        clientId: match.kind === "client" ? match.id : null,
        leadId: match.kind === "lead" ? match.id : null,
        jobId: target.jobId || null,
        quoteId: target.quoteId || null,
      },
      update: {},
    });
  }

  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          threadId: thread.id,
          direction: normal.direction,
          private: false,
          externalId: emailExternalId(normal.rfcMessageId),
          body: normal.body || "",
          attachments: attachments.length ? attachments : undefined,
          mediaPending: false,
          sentAt,
        },
        select: { id: true },
      });
      await tx.emailMessage.create({
        data: {
          companyId,
          messageId: message.id,
          mailboxId: mailbox.id,
          rfcMessageId: normal.rfcMessageId,
          inReplyTo: normal.inReplyTo || null,
          references: normal.references?.length ? normal.references.join(" ").slice(0, 8000) : null,
          subject: cleanHeader(normal.subject, 500),
          fromAddress: formatAddressList(normal.from),
          toAddresses: formatAddressList(normal.to),
          ccAddresses: normal.cc?.length ? formatAddressList(normal.cc) : null,
          folder: normal.folder ? String(normal.folder).slice(0, 200) : null,
          providerRef: normal.providerRef ? String(normal.providerRef).slice(0, 200) : null,
          filedBy: "sync",
        },
      });
      return message;
    });
  } catch (err) {
    // P2002 on either unique index: somebody filed it first (a concurrent
    // sync, the other folder, another member's mailbox). Already held.
    if (err?.code === "P2002" || /Unique constraint/i.test(String(err?.message))) return { filed: false, reason: "already_held", threadId: thread.id };
    throw err;
  }

  // ── The thread's clocks, forward only ─────────────────────────────────
  const stamps = responseStamps({ thread, message: { direction: normal.direction, private: false, failedReason: null, sentAt } });
  const live = !backfill;
  const reopened = live && normal.direction === "in" && readStatus(thread.status) !== "open";
  const movesWindow = normal.direction === "in" && (!thread.lastInboundAt || sentAt > thread.lastInboundAt);
  await db.messageThread.update({
    where: { id: thread.id },
    data: {
      ...(sentAt > thread.lastMessageAt ? { lastMessageAt: sentAt } : {}),
      ...(movesWindow ? { lastInboundAt: sentAt } : {}),
      ...(live ? (normal.direction === "in" ? { unread: { increment: 1 } } : { unread: 0 }) : {}),
      ...(reopened ? { status: "open", statusChangedAt: sentAt, snoozedUntil: null } : {}),
      // Fill a blank, never overwrite: staff may have re-filed this thread.
      ...(!thread.clientId && match.kind === "client" ? { clientId: match.id } : {}),
      ...(!thread.leadId && match.kind === "lead" ? { leadId: match.id } : {}),
      ...(!thread.jobId && !thread.quoteId && (target.jobId || target.quoteId) ? { jobId: target.jobId || null, quoteId: target.quoteId || null } : {}),
      ...stamps,
    },
  });
  if (reopened) {
    await writeActivity(db, { threadId: thread.id, type: "status_changed", to: "open", at: sentAt }).catch(() => null);
  }
  if (!thread.threadNumber) await allocateThreadNumber(db, { companyId, threadId: thread.id }).catch(() => null);
  // Free, phrase-based, best effort — the same call ingest makes.
  if (rescore) await rescore({ threadId: thread.id, companyId, db }).catch(() => null);

  return { filed: true, threadId: thread.id, messageId: created.id };
}
