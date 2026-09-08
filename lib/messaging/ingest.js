// lib/messaging/ingest.js
//
// A verified webhook event -> rows. The tenant-boundary file of this feature.
//
// ══ Three rules, and each one is a real attack or a real bug ═══════════════
//
// 1. THE COMPANY IS NEVER READ FROM THE PAYLOAD. It is resolved by looking up
//    Meta's `entry.id` (the Page) against our own MessagingChannel rows —
//    lib/messaging/channels.js's channelForExternalId. A body naming a
//    companyId, or a channelId, or anything else, is ignored entirely. A
//    forged POST for a Page FieldQuo does not hold writes nothing at all.
//
// 2. EVERY WRITE IS IDEMPOTENT ON META'S OWN ID. Meta re-delivers a webhook
//    after a timeout, a 500, or a slow response — several times, for hours.
//    A message is upserted on @@unique([threadId, externalId]) and a thread on
//    @@unique([channelId, externalThreadId]), so a re-delivery updates the row
//    it already wrote instead of posting the homeowner's question twice.
//
// 3. THE UNREAD COUNT IS DERIVED FROM THE WRITE, NOT INCREMENTED BLINDLY. A
//    re-delivery that bumped `unread` would leave a permanently unclearable
//    badge on the inbox — the same "a control that lies" failure in a smaller
//    shape. The increment happens only when the upsert actually created a row.

import { db } from "@/lib/db";
import { channelForExternalId } from "./channels";

/**
 * @param {object} event  one parsed event from lib/messaging/envelope.js
 * @returns {Promise<{ handled: boolean, reason?: string, created?: boolean,
 *                     threadId?: string, companyId?: string }>}
 *
 * Never throws for an unknown Page: an unrecognised entry.id is the normal
 * state of a shared webhook URL (Meta delivers every subscribed app event to
 * it), and a throw there would turn routine noise into an error page Meta
 * reads as a failed delivery and retries forever.
 */
export async function ingestEvent(event) {
  const channel = await channelForExternalId(event?.platform, event?.pageExternalId);
  if (!channel) return { handled: false, reason: "unknown_page" };
  if (channel.disconnectedAt) {
    // The contractor disconnected this Page. Their conversations are kept
    // (see the schema) but new messages are not filed into an inbox they
    // asked us to stop watching.
    return { handled: false, reason: "channel_disconnected" };
  }

  const companyId = channel.companyId;

  if (event.kind === "delivery" || event.kind === "read") {
    return markWatermark({ channel, event, companyId });
  }

  if (event.kind !== "message") return { handled: false, reason: "unsupported_kind" };

  const sentAt = event.sentAt instanceof Date ? event.sentAt : new Date();

  // The thread first, so the message has somewhere to go. `create` carries
  // companyId from the CHANNEL row — the only place it can legitimately come
  // from — and `update` deliberately does not touch companyId at all: a thread
  // cannot change tenants, and an update path that could set it would be a way
  // to move a conversation between companies with a crafted webhook.
  const thread = await db.messageThread.upsert({
    where: {
      channelId_externalThreadId: {
        channelId: channel.id,
        externalThreadId: event.threadExternalId,
      },
    },
    create: {
      companyId,
      channelId: channel.id,
      externalThreadId: event.threadExternalId,
      participantExternalId: event.participantExternalId,
      participantName: event.participantName || null,
      lastMessageAt: sentAt,
      // Zero, deliberately, even for an inbound message. The counter is moved
      // exactly once, below, by the branch that knows whether the MESSAGE was
      // actually new — setting it here as well double-counted the first
      // message of every conversation, so a brand-new thread showed "2".
      unread: 0,
      status: "open",
    },
    update: {
      // lastMessageAt is deliberately NOT set here. Meta can deliver an old
      // message late (a retry of yesterday's), and writing it unconditionally
      // would drop a live conversation down the inbox — or worse, drag a dead
      // one to the top. It is moved below, once, and only forward.
      participantName: event.participantName || undefined,
    },
  });

  // The message. `skipDuplicates` semantics via upsert: a re-delivery updates
  // the same row, so the body corrects itself if Meta amends it and nothing is
  // ever inserted twice.
  const existing = await db.message.findUnique({
    where: { threadId_externalId: { threadId: thread.id, externalId: event.externalId } },
    select: { id: true },
  });

  await db.message.upsert({
    where: { threadId_externalId: { threadId: thread.id, externalId: event.externalId } },
    create: {
      threadId: thread.id,
      direction: event.direction,
      externalId: event.externalId,
      body: event.body || "",
      attachments: event.attachments || undefined,
      sentAt,
    },
    update: {
      body: event.body || "",
      attachments: event.attachments || undefined,
    },
  });

  const created = !existing;

  // Rule 3: the counters move only for a genuinely new message, and
  // lastMessageAt only ever moves forward.
  if (created) {
    await db.messageThread.update({
      where: { id: thread.id },
      data: {
        ...(sentAt > thread.lastMessageAt ? { lastMessageAt: sentAt } : {}),
        ...(event.direction === "in"
          ? { unread: { increment: 1 } }
          : // An outbound echo means somebody answered — from FieldQuo, from
            // Meta's inbox, or from a phone. Either way this conversation is
            // no longer waiting on us, so the badge clears.
            { unread: 0 }),
        // A closed thread that gets a new message is open again. Leaving it
        // closed would hide a live enquiry behind a filter nobody remembers
        // setting.
        ...(event.direction === "in" ? { status: "open" } : {}),
      },
    });
  }

  return { handled: true, created, threadId: thread.id, companyId };
}

/**
 * Delivery and read receipts. Meta reports these as a WATERMARK — "everything
 * up to this timestamp" — not per message, so this stamps every outbound
 * message at or before it that has not been stamped already.
 *
 * Scoped to the thread the receipt names, and the thread is found through the
 * channel, so a receipt cannot reach another tenant's messages.
 */
async function markWatermark({ channel, event, companyId }) {
  if (!(event.watermark instanceof Date)) return { handled: false, reason: "no_watermark" };

  const thread = await db.messageThread.findUnique({
    where: {
      channelId_externalThreadId: {
        channelId: channel.id,
        externalThreadId: event.threadExternalId,
      },
    },
    select: { id: true },
  });
  if (!thread) return { handled: false, reason: "unknown_thread" };

  const field = event.kind === "read" ? "readAt" : "deliveredAt";
  await db.message.updateMany({
    where: {
      threadId: thread.id,
      direction: "out",
      sentAt: { lte: event.watermark },
      [field]: null,
    },
    data: { [field]: event.watermark },
  });

  return { handled: true, created: false, threadId: thread.id, companyId };
}

/**
 * The whole envelope, in order. Returns a summary rather than throwing on the
 * first bad event: Meta batches several events into one POST, and one
 * unrecognised entry must not discard the four beside it.
 */
export async function ingestEvents(events) {
  const summary = { handled: 0, created: 0, skipped: 0, reasons: {} };
  for (const event of events) {
    // Deliberately sequential. The events in one delivery are usually the SAME
    // conversation in order, and running them in parallel makes two upserts
    // race for one thread row — Postgres resolves that as a unique-violation
    // throw, not as a merge.
    const result = await ingestEvent(event).catch((err) => ({
      handled: false,
      reason: `error:${err?.message || "unknown"}`,
    }));
    if (result.handled) {
      summary.handled++;
      if (result.created) summary.created++;
    } else {
      summary.skipped++;
      summary.reasons[result.reason] = (summary.reasons[result.reason] || 0) + 1;
    }
  }
  return summary;
}
