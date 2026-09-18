// app/api/sales/threads/route.js
//
// Every conversation this rep has, and the one place a new one starts.
//
// ══ Nothing here sends without a person pressing send ══════════════════════
//
// POST is called by exactly one thing: the compose form on the lead screen,
// after the rep has typed a subject and a message. There is no cron behind it,
// no sequence, no "send to all". Automatic outreach is a different product with
// a different consent posture, and the brief for this one was explicit that a
// rep emailing a real prospect is intended and must not be blocked — which is a
// reason to make the send deliberate, not a reason to make it easy to trigger
// by accident.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { deliverOutreach, outreachStatus } from "@/lib/sales/outreachSender";
import { contactOptedOut } from "@/lib/sales/outreachInbound";
import { leadWhere, threadListWhere } from "@/lib/sales/outreach";
import { folderOf, folderWhere, searchWhere, snippetOf, threadLabels } from "@/lib/sales/emailInbox";
import { allowedRecipients, chooseRecipients } from "@/lib/sales/emailRecipients";
import { discardDraft, listDrafts } from "@/lib/sales/emailDrafts";
import { mailboxState, publicMailboxFor } from "@/lib/sales/mailbox/store";

/** The most rows one read returns. A floor's inbox, not a mailbox's. */
const PAGE = 200;

/**
 * The inbox: `?folder=inbox|archived|all` (inbox by default), `?q=` across
 * subject, bodies, the lead's names and address. Each row carries what a
 * list row draws — the labels lib/sales/emailInbox.js derives, the last
 * message's snippet and direction, whether a draft is waiting on it — so the
 * list is one request, never one per row.
 */
export async function GET(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const folder = folderOf(url.searchParams.get("folder"));
  const search = searchWhere(url.searchParams.get("q"));

  // The rep scope first, the folder and the search narrowing it.
  const where = { ...folderWhere(threadListWhere(rep.id), folder), ...(search || {}) };

  const rows = await db.salesThread.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: PAGE,
    select: {
      id: true,
      subject: true,
      lastMessageAt: true,
      lastInboundAt: true,
      readAt: true,
      archivedAt: true,
      counterpart: true,
      lead: { select: { id: true, businessName: true, contactName: true, email: true, status: true } },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { direction: true, sentAt: true, body: true, fromAddress: true, attachments: true },
      },
      _count: { select: { messages: true } },
    },
  });

  const leadIds = [...new Set(rows.map((r) => r.lead?.id).filter(Boolean))];
  const [openCheckIns, drafts] = await Promise.all([
    leadIds.length
      ? db.salesCheckIn.findMany({
          where: { salesRepId: rep.id, leadId: { in: leadIds }, status: "draft" },
          select: { leadId: true },
        })
      : [],
    listDrafts(db, rep.id, { threadIds: rows.map((r) => r.id) }),
  ]);
  const checkInByLead = new Set(openCheckIns.map((c) => c.leadId));
  const draftByThread = new Map();
  for (const d of drafts) if (d.threadId && !draftByThread.has(d.threadId)) draftByThread.set(d.threadId, d.id);

  const threads = rows.map((row) => {
    const last = row.messages[0] || null;
    const labels = threadLabels(row, { checkIn: checkInByLead.has(row.lead?.id) ? true : null });
    return {
      id: row.id,
      subject: row.subject,
      lastMessageAt: row.lastMessageAt,
      lastInboundAt: row.lastInboundAt,
      readAt: row.readAt,
      archivedAt: row.archivedAt,
      lead: row.lead,
      counterpart: row.counterpart,
      // The inbox's two sections: a rep's leads first, then everything else
      // the mailbox holds — a colleague, a supplier, a newsletter.
      section: row.lead ? "leads" : "other",
      messageCount: row._count?.messages ?? 0,
      last: last
        ? {
            direction: last.direction,
            sentAt: last.sentAt,
            fromAddress: last.fromAddress,
            snippet: snippetOf(last.body),
            hasAttachments: Array.isArray(last.attachments) && last.attachments.length > 0,
          }
        : null,
      labels,
      draftId: draftByThread.get(row.id) || null,
      // Kept for the two older readers of this route (the lead screen's
      // thread list and check-sales-home): the last message under the old
      // name and the count under the old key.
      messages: row.messages.map((m) => ({ direction: m.direction, sentAt: m.sentAt, body: m.body })),
      _count: row._count,
    };
  });

  return NextResponse.json({
    threads,
    folder,
    unread: threads.filter((t) => t.labels.unread && !t.archivedAt).length,
    outreach: await outreachStatus(rep),
    mailbox: mailboxState(await publicMailboxFor(db, rep.id)),
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  // `phone` is selected even though this is the email path: a prospect who
  // said "stop" on the phone has stopped the email too, and the suppression
  // lookup can only ask about a number it was given. Leaving it out was the
  // gap that would have made a phone opt-out invisible to the mail path.
  const lead = await db.salesLead.findFirst({
    where: leadWhere(rep.id, body.leadId),
    select: {
      id: true,
      email: true,
      phone: true,
      status: true,
      businessName: true,
      prospect: { select: { email: true } },
      // A second address the rep saved on the lead — part of the closed set.
      contactEmails: { select: { email: true } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Asked here so the rep gets the reason on the screen they are looking at.
  // deliverOutreach asks again immediately before the send — see its header
  // for why the second ask is the one that counts.
  const optOut = await contactOptedOut(db, {
    leadId: lead.id,
    email: lead.email,
    phone: lead.phone,
    channel: "email",
  });
  if (optOut.optedOut) {
    return NextResponse.json({ error: optOut.reason, optedOut: true }, { status: 409 });
  }

  // A first message has no thread yet, so the closed recipient set is the
  // lead's own addresses and the rep's mailbox. With no `to` at all it goes
  // to the lead, as the lead screen has always sent.
  const allowed = allowedRecipients({ lead, messages: [], rep });
  const chosen = chooseRecipients({ to: body.to ?? [lead.email], cc: body.cc ?? [], allowed });
  if (!chosen.ok) {
    return NextResponse.json(
      chosen.empty
        ? { error: "Choose at least one recipient." }
        : { error: `${chosen.refused.join(", ")} isn't on this lead's record, so nothing was sent.`, refused: chosen.refused },
      { status: 400 },
    );
  }

  const result = await deliverOutreach({
    rep,
    lead,
    thread: null,
    subject: body.subject,
    body: body.body,
    to: chosen.to,
    cc: chosen.cc,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers },
      { status: result.status },
    );
  }

  if (typeof body.draftId === "string" && body.draftId) {
    await discardDraft(db, rep.id, body.draftId).catch(() => false);
  }

  return NextResponse.json(
    { threadId: result.threadId, messageId: result.messageId },
    { status: 201 },
  );
}
