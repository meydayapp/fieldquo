// lib/sales/outreachInbound.js
//
// Filing a reply against the thread it belongs to.
//
// ══ The token is the only key ══════════════════════════════════════════════
//
// app/api/crew/inbound/route.js already argued this for SMS and the argument
// carries over without modification: the SENDER is never the key. A prospect
// replies from their phone, or their assistant answers, or the address is an
// alias for a shared inbox — all three are the same person continuing the same
// conversation, and all three arrive as somebody else. Worse, `From` is
// forgeable, so keying on it would let anyone who learns a prospect's address
// write into a rep's thread.
//
// So: SalesThread.replyToken, which is @unique, resolves to at most one thread,
// always. Nothing else in the payload is trusted to name one.
//
// The one place the sender is looked at is the echo check below — and it can
// only ever DISCARD a message, never select a thread. That distinction is the
// whole reason it is safe.

import { bareAddress, detectOptOut, leadOptedOut } from "./outreach";

// ══ Why `db` is a parameter and not an import ══════════════════════════════
//
// lib/marketing/unsubscribe.js already does this — ensureSubscriber(db, {...})
// — and for the same reason. The rules in this file are the ones most worth
// executing against hostile input: a message with no token, a token no thread
// has, our own sent copy coming back, the same message delivered twice. All of
// them are properties of a QUERY plus a decision, so asserting them by reading
// the source proves nothing. Taking the client as an argument lets
// scripts/check-sales-outreach.mjs run the real function against a fake client
// with no loader hooks and no database, and costs the two routes one import
// they already have.

/**
 * Has this prospect replied asking to be left alone?
 *
 * Asked fresh, in the request that is about to send — never carried over from
 * the screen that rendered the compose box. An opt-out that arrived while the
 * rep was typing has to win, and the rule that a check runs on rows read in the
 * same request as the action is the one lib/migrations/state.js's canWrite()
 * already establishes for the other place FieldQuo staff may write.
 *
 * Scoped by salesRepId as well as leadId: this is reached from a send path, and
 * every query on that path carries the boundary rather than assuming an earlier
 * one held.
 */
export async function leadIsOptedOut(db, salesRepId, leadId) {
  const inbound = await db.salesMessage.findMany({
    where: {
      direction: "in",
      thread: { leadId, salesRepId },
    },
    select: { direction: true, body: true },
  });
  // leadOptedOut rather than a second call to detectOptOut: the screen and the
  // send path must reach their verdict through the same function, or the day
  // the rule changes is the day they start disagreeing about one lead.
  return leadOptedOut(inbound);
}

/**
 * File one parsed inbound email.
 *
 * @param parsed  the output of parseInboundEmail()
 * @returns { filed: boolean, reason?, threadId?, messageId?, optOut? }
 *
 * Every "not filed" answer is a REASON, not an exception. A mail forwarder is
 * not a caller that can read a stack trace: it needs a 2xx it will not retry
 * and a body a human can read when they go looking for why a reply never
 * appeared. The route turns these into exactly that.
 */
export async function fileInboundMessage(db, parsed) {
  if (!parsed?.token) return { filed: false, reason: "no_token" };

  const thread = await db.salesThread.findUnique({
    where: { replyToken: parsed.token },
    select: {
      id: true,
      leadId: true,
      salesRepId: true,
      subject: true,
      salesRep: { select: { email: true } },
    },
  });

  if (!thread) return { filed: false, reason: "unknown_token" };

  // ── The echo check ───────────────────────────────────────────────────────
  //
  // A mailbox rule that forwards "everything" forwards the rep's own sent items
  // too, and those carry the same token — they are our own message coming back.
  // Filing them would double every outbound message and, worse, record the
  // rep's own footer (which contains the word "unsubscribe") as an inbound
  // opt-out, silently closing the compose box on a lead who never asked.
  //
  // Note what this is and is not: the thread was already chosen, by token. This
  // only decides whether to keep the message. A forged `From` here can throw
  // away a copy of a message the sender was already able to see; it cannot
  // reach another rep's thread.
  const sender = bareAddress(parsed.fromAddress);
  if (sender && sender === String(thread.salesRep?.email || "").toLowerCase()) {
    return { filed: false, reason: "own_outbound", threadId: thread.id };
  }

  // Idempotency, best-effort. SalesMessage.providerId is not @unique — a
  // Message-ID is the provider's string, not ours, and a unique index on a
  // nullable column that inbound mail may omit would refuse the second inbound
  // message that arrived without one. So: a lookup rather than a constraint,
  // which closes the ordinary case (a forwarder retrying) and admits it does
  // not close a true simultaneous double-post.
  if (parsed.providerId) {
    const already = await db.salesMessage.findFirst({
      where: {
        threadId: thread.id,
        direction: "in",
        providerId: parsed.providerId,
      },
      select: { id: true },
    });
    if (already) {
      return {
        filed: false,
        reason: "duplicate",
        threadId: thread.id,
        messageId: already.id,
      };
    }
  }

  const sentAt = parsed.sentAt || new Date();

  const message = await db.$transaction(async (tx) => {
    const created = await tx.salesMessage.create({
      data: {
        threadId: thread.id,
        direction: "in",
        fromAddress: parsed.fromAddress || "unknown",
        // What the message was addressed TO, kept verbatim. It is the plus-tagged
        // address in "plus" mode, which is the evidence of how it was routed.
        toAddress: parsed.toAddress || "",
        subject: parsed.subject || thread.subject,
        body: parsed.body || "",
        providerId: parsed.providerId,
        sentAt,
      },
    });

    // lastMessageAt only moves FORWARD. A forwarder replaying a week-old
    // message must not drag a live conversation back down the rep's list.
    await tx.salesThread.updateMany({
      where: { id: thread.id, lastMessageAt: { lt: sentAt } },
      data: { lastMessageAt: sentAt },
    });

    return created;
  });

  return {
    filed: true,
    threadId: thread.id,
    leadId: thread.leadId,
    messageId: message.id,
    // Reported back so the forwarder's operator (and the log) can see that an
    // opt-out landed. The durable record is the message itself — leadOptedOut()
    // recomputes this from the rows on every screen and every send.
    optOut: detectOptOut(parsed.body),
  };
}
