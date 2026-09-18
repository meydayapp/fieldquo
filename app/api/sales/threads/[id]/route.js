// app/api/sales/threads/[id]/route.js
//
// One conversation, both directions, oldest first — and the two marks a rep
// can put on it (read, archived).
//
// `replyToken` and `secret`-bearing relations are not in any select. The
// token is a routing label rather than a secret, but it is also the string
// that decides which thread an inbound message joins, and no screen needs it.
//
// ══ GET reads; PATCH writes; never the other way round ════════════════════
//
// Opening a thread does not mark it read inside the GET: the screen PATCHes
// `read: true` after it has rendered, so a prefetch, a crawler on a stale
// cookie, or the check script reading the route never moves a marker the
// rep did not move. The PATCH also mirrors the read onto the mailbox server
// (\Seen), best-effort and after the row is written —
// lib/sales/mailbox/readMirror.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { outreachStatus } from "@/lib/sales/outreachSender";
import { threadWhere } from "@/lib/sales/outreach";
import { contactOptedOut } from "@/lib/sales/outreachInbound";
import { publicAttachments } from "@/lib/messaging/attachments";
import { lastReviewOf } from "@/lib/sales/conversationAudit";
import { allowedRecipients, replyAllTargets } from "@/lib/sales/emailRecipients";
import { attachableOnThread } from "@/lib/sales/emailAttachments";
import { splitQuoted } from "@/lib/sales/emailQuote";
import { listDrafts } from "@/lib/sales/emailDrafts";
import { threadLabels } from "@/lib/sales/emailInbox";
import { mirrorThreadReadToServer } from "@/lib/sales/mailbox/readMirror";

const THREAD_SELECT = {
  id: true,
  subject: true,
  lastMessageAt: true,
  lastInboundAt: true,
  readAt: true,
  archivedAt: true,
  counterpart: true,
  createdAt: true,
  lead: {
    select: {
      id: true,
      businessName: true,
      contactName: true,
      email: true,
      phone: true,
      status: true,
      province: true,
      country: true,
      timeZone: true,
      prospectId: true,
      convertedCompanyId: true,
      prospect: { select: { email: true, tradeKey: true, city: true, province: true } },
      // A second address the rep saved on the lead — part of the closed set.
      contactEmails: { select: { email: true } },
    },
  },
  messages: {
    orderBy: { sentAt: "asc" },
    select: {
      id: true,
      direction: true,
      fromAddress: true,
      toAddress: true,
      ccAddresses: true,
      subject: true,
      body: true,
      sentAt: true,
      seen: true,
      filedBy: true,
      attachments: true,
      forwardProviderId: true,
    },
  },
};

export async function GET(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;

  const thread = await db.salesThread.findFirst({ where: threadWhere(rep.id, id), select: THREAD_SELECT });
  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // The closed recipient set and the files a reply may carry, computed from
  // the rows the send route will compute them from again.
  const allowed = allowedRecipients({ lead: thread.lead, messages: thread.messages, rep, counterpart: thread.counterpart });
  const attachable = attachableOnThread(thread.messages);
  const last = thread.messages[thread.messages.length - 1] || null;

  // The same public shape the messaging inbox serves — the fetcher-only
  // fields never reach a browser — and, per message, the split between what
  // the person typed and what they quoted, so the screen can fold the quote.
  const messages = thread.messages.map(({ attachments, forwardProviderId, ...m }) => {
    const { visible, quoted } = splitQuoted(m.body);
    return {
      ...m,
      visible,
      quoted,
      attachments: publicAttachments(attachments),
      forwardedToMailbox: Boolean(forwardProviderId),
    };
  });

  const optOut = thread.lead
    ? await contactOptedOut(db, {
        leadId: thread.lead.id,
        email: thread.lead.email,
        phone: thread.lead.phone,
        channel: "email",
      })
    : { optedOut: false, reason: null, reasonKey: null, reasonParams: null };

  const [drafts, calls, otherThreads, checkIns] = await Promise.all([
    listDrafts(db, rep.id, { threadIds: [thread.id] }),
    thread.lead
      ? db.salesCallAttempt.findMany({
          where: { salesRepId: rep.id, leadId: thread.lead.id },
          orderBy: { dialledAt: "desc" },
          take: 5,
          select: { id: true, direction: true, dialledAt: true, answeredAt: true, disposition: true },
        })
      : [],
    thread.lead
      ? db.salesThread.findMany({
          where: { salesRepId: rep.id, leadId: thread.lead.id, id: { not: thread.id } },
          orderBy: { lastMessageAt: "desc" },
          take: 5,
          select: { id: true, subject: true, lastMessageAt: true },
        })
      : [],
    thread.lead
      ? db.salesCheckIn.findMany({
          where: { salesRepId: rep.id, leadId: thread.lead.id, status: "draft" },
          orderBy: { scheduledFor: "asc" },
          take: 3,
          select: { id: true, scheduledFor: true, draftText: true },
        })
      : [],
  ]);

  return NextResponse.json({
    thread: { ...thread, messages, labels: threadLabels({ ...thread, messages: last ? [last] : [] }, { checkIn: checkIns[0] || null }) },
    recipients: allowed.map(([address, meta]) => ({ address, source: meta.label })),
    replyAll: last ? replyAllTargets({ message: last, rep }) : { to: [], cc: [] },
    attachable,
    drafts,
    // The company pane's history, the same rows the Texts screen shows.
    calls: calls.map((c) => ({ id: c.id, direction: c.direction, at: c.dialledAt, answered: Boolean(c.answeredAt), disposition: c.disposition })),
    otherThreads,
    checkIns,
    // When the owner last read this thread from the console — the rep is
    // told on the thread (lib/sales/conversationAudit.js). Null when never.
    reviewedByOwner: await lastReviewOf({ repId: rep.id, kind: "email", threadId: thread.id }),
    optedOut: optOut.optedOut,
    optedOutReason: optOut.reason,
    optedOutReasonKey: optOut.reasonKey || null,
    optedOutReasonParams: optOut.reasonParams || null,
    outreach: await outreachStatus(rep),
  });
}

/**
 * { read: true|false } and/or { archived: true|false }. Anything else is
 * ignored rather than refused — a screen that sends both is one request.
 */
export async function PATCH(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const thread = await db.salesThread.findFirst({
    where: threadWhere(rep.id, id),
    select: { id: true, readAt: true, archivedAt: true, lastInboundAt: true },
  });
  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const data = {};
  const now = new Date();
  if (body.read === true) data.readAt = now;
  // "Mark unread": the marker goes back to just before the last inbound
  // message, so isUnread() is true again without inventing a message.
  if (body.read === false) data.readAt = thread.lastInboundAt ? new Date(new Date(thread.lastInboundAt).getTime() - 1) : null;
  if (body.archived === true) data.archivedAt = now;
  if (body.archived === false) data.archivedAt = null;
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Send read (true/false) or archived (true/false)." }, { status: 400 });
  }

  const updated = await db.salesThread.update({
    where: { id: thread.id },
    data,
    select: { id: true, readAt: true, archivedAt: true, lastInboundAt: true },
  });

  // The mirror onto the mailbox server, after the row is written and never
  // awaited by the screen for long: the rep pressed nothing that should
  // wait on IMAP.
  let mirrored = 0;
  if (body.read === true) {
    mirrored = await Promise.race([
      mirrorThreadReadToServer(db, thread.id).catch(() => 0),
      new Promise((resolve) => setTimeout(() => resolve(0), 8000)),
    ]);
  }

  return NextResponse.json({ thread: updated, mirrored });
}
