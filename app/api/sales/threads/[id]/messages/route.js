// app/api/sales/threads/[id]/messages/route.js
//
// The rep answers — a reply, a reply-all or a forward — on one thread.
//
// A reply keeps the thread's own subject and its own reply token — the token
// is what makes the prospect's next answer land back here rather than
// starting a third conversation, so it is read from the thread and never
// regenerated. A forward keeps the token too (it is the same conversation,
// passed to somebody on the lead's record) and takes a "Fwd:" subject.
//
// ══ What the browser may say, and what it may not ═════════════════════════
//
//   body              the words the rep typed. Quoted text is NOT accepted
//                     from the browser: the message being answered or passed
//                     on is named by id (`quotedMessageId`) and quoted from
//                     OUR stored copy (lib/sales/emailQuote.js), so a reply
//                     cannot attribute to a prospect words they did not write.
//   kind              "reply" | "replyAll" | "forward"
//   to, cc            addresses — validated here against the closed set
//                     lib/sales/emailRecipients.js computes from the lead's
//                     row and the thread's messages, on rows read in THIS
//                     request. An address outside it is refused by name.
//   attachments       [{ url }] — only files already on this thread (a
//                     prospect's re-hosted attachment), matched by URL
//                     against the stored rows; anything else is dropped.
//   draftId           the draft this send came from, deleted after the send
//                     succeeds — the rep's own, or nothing is deleted.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOutreachRep } from "@/lib/sales/outreachGate";
import { deliverOutreach } from "@/lib/sales/outreachSender";
import { contactOptedOut } from "@/lib/sales/outreachInbound";
import { threadWhere } from "@/lib/sales/outreach";
import { allowedRecipients, chooseRecipients } from "@/lib/sales/emailRecipients";
import { forwardBody, prefixedSubject, replyBody } from "@/lib/sales/emailQuote";
import { discardDraft } from "@/lib/sales/emailDrafts";
import { threadAttachmentsFor } from "@/lib/sales/emailAttachments";

const KINDS = new Set(["reply", "replyAll", "forward"]);

export async function POST(request, { params }) {
  const { rep, refusal } = await requireOutreachRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });

  const thread = await db.salesThread.findFirst({
    where: threadWhere(rep.id, id),
    select: {
      id: true,
      subject: true,
      replyToken: true,
      mailboxId: true,
      counterpart: true,
      // `phone` for the same reason as the new-thread route: a phone opt-out
      // closes the email channel, and the lookup can only ask about a number
      // it was handed.
      lead: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          businessName: true,
          prospect: { select: { email: true } },
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
          attachments: true,
          messageId: true,
          references: true,
        },
      },
    },
  });
  if (!thread) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // A thread with no lead (the mailbox's "Everything else") has no lead to
  // ask about; the address itself is still checked by deliverOutreach.
  const optOut = thread.lead
    ? await contactOptedOut(db, {
        leadId: thread.lead.id,
        email: thread.lead.email,
        phone: thread.lead.phone,
        channel: "email",
      })
    : { optedOut: false };
  if (optOut.optedOut) {
    return NextResponse.json({ error: optOut.reason, optedOut: true }, { status: 409 });
  }

  const kind = KINDS.has(body.kind) ? body.kind : "reply";

  // The message being answered or forwarded: named by id, read from our rows.
  const quoted =
    typeof body.quotedMessageId === "string"
      ? thread.messages.find((m) => m.id === body.quotedMessageId) || null
      : null;
  if (kind === "forward" && !quoted) {
    return NextResponse.json({ error: "A forward needs the message to forward." }, { status: 400 });
  }

  // ── Recipients: the closed set, computed here ────────────────────────────
  const allowed = allowedRecipients({ lead: thread.lead, messages: thread.messages, rep, counterpart: thread.counterpart });
  const chosen = chooseRecipients({
    // A plain reply with no explicit To goes to the lead — or, on a thread
    // with nobody's lead, to whoever the conversation is with.
    to: body.to ?? (kind === "forward" ? [] : [thread.lead?.email || thread.counterpart]),
    cc: body.cc ?? [],
    allowed,
  });
  if (!chosen.ok) {
    return NextResponse.json(
      chosen.empty
        ? { error: "Choose at least one recipient." }
        : {
            error:
              `${chosen.refused.join(", ")} isn't on this lead's record, so nothing was sent. ` +
              `Only the lead's own address, the prospect's, people who wrote in on this thread, ` +
              `people they copied, and your own work mailbox can be addressed from here.`,
            refused: chosen.refused,
          },
      { status: 400 },
    );
  }

  const text =
    kind === "forward"
      ? forwardBody({ typed: body.body, forwardedMessage: quoted })
      : replyBody({ typed: body.body, quotedMessage: quoted });

  // The last message's ids, so the prospect's own client threads the reply
  // under it: In-Reply-To names the answered message, References carries its
  // chain plus itself. A forward starts its own chain.
  const answered = kind === "forward" ? null : quoted || [...thread.messages].reverse()[0] || null;
  const chain = answered
    ? [...String(answered.references || "").split(/\s+/).filter(Boolean), answered.messageId].filter(Boolean)
    : [];

  const result = await deliverOutreach({
    rep,
    lead: thread.lead,
    thread,
    body: text,
    to: chosen.to,
    cc: chosen.cc,
    subjectOverride: kind === "forward" ? prefixedSubject(thread.subject, "Fwd") : null,
    attachments: threadAttachmentsFor(thread.messages, body.attachments),
    inReplyTo: answered?.messageId || null,
    references: [...new Set(chain)].slice(-20),
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

  return NextResponse.json({ messageId: result.messageId, threadId: thread.id }, { status: 201 });
}
