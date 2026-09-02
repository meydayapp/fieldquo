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
import { checkSuppression, suppressWithin } from "./suppression";

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
 * Has this prospect asked to be left alone — anywhere, by anyone, on any
 * channel?
 *
 * ══ What this supersedes, and why the old scoping was a bug ════════════════
 *
 * This replaces leadIsOptedOut(db, salesRepId, leadId), which asked the
 * question of ONE SalesLead's inbound messages, scoped by salesRepId. That
 * scoping is right for reading a rep's data and wrong for a compliance
 * question, and `SalesLead` has no unique constraint on email — so two reps
 * can hold the same prospect, and an opt-out silenced one rep's copy while the
 * other kept emailing. An opt-out binds FieldQuo, not a rep's copy of a row.
 * (docs/sales-intel/AUDIT-compliance.md §5.)
 *
 * ══ Two sources, and the older one is kept deliberately ════════════════════
 *
 *   1. The PLATFORM suppression list — authoritative, cross-channel,
 *      cross-rep, and what every new opt-out is written to.
 *   2. The derived per-lead signal — leadOptedOut() over inbound messages,
 *      now asked across EVERY lead sharing this address rather than one rep's.
 *
 * (2) is not redundant and is not deleted: every reply filed before the
 * suppression list existed carries a real opt-out that was never written to
 * it, and a rep whose prospect said "unsubscribe" last week must not find that
 * request forgotten because the mechanism changed. It is superseded — the list
 * is the answer, and the messages are a second reader of the same evidence
 * that can only ever add a refusal, never remove one.
 *
 * ══ Read in the request that sends ═════════════════════════════════════════
 *
 * Never carried over from the screen that rendered the compose box. An opt-out
 * that arrived while the rep was typing has to win — the rule that a check
 * runs on rows read in the same request as the action is the one
 * lib/migrations/state.js's canWrite() establishes for the other place
 * FieldQuo staff may write.
 *
 * @returns { optedOut, reason, via } — `via` is "suppression" or "reply".
 */
export async function contactOptedOut(db, { leadId, email, phone, channel = "email" } = {}) {
  const suppression = await checkSuppression(db, { email, phone, channel });
  if (suppression.suppressed) {
    return { optedOut: true, reason: suppression.reason, via: "suppression" };
  }

  // Deliberately NOT scoped by salesRepId, and matched on the address rather
  // than on the lead id. Both narrowings are what made the original wrong.
  const inbound = leadId || email
    ? await db.salesMessage.findMany({
        where: {
          direction: "in",
          thread: email
            ? { lead: { email } }
            : { leadId },
        },
        select: { direction: true, body: true },
      })
    : [];

  // leadOptedOut rather than a second call to detectOptOut: the screen and the
  // send path must reach their verdict through the same function, or the day
  // the rule changes is the day they start disagreeing about one lead.
  if (leadOptedOut(inbound)) {
    return {
      optedOut: true,
      reason:
        "This prospect replied asking not to be emailed again. That request " +
        "stands for FieldQuo, not just for one rep's copy of it.",
      via: "reply",
    };
  }

  return { optedOut: false, reason: null, via: null };
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
      // The address FieldQuo actually WROTE to. See the suppression write
      // below for why the opt-out is keyed on this and not on the reply's From.
      lead: { select: { id: true, email: true, phone: true } },
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
  const optOut = detectOptOut(parsed.body);

  const { message, suppressed } = await db.$transaction(async (tx) => {
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

    // ── The opt-out becomes FieldQuo's, here, atomically ──────────────────
    //
    // In the same transaction as the message, because the two facts have to
    // be true together: a stored reply saying "unsubscribe" with no
    // suppression behind it is an opt-out we can prove we received and did
    // not act on, which is worse evidence than not having the message.
    //
    // ══ Keyed on the address we WROTE to, never on the reply's From ═══════
    //
    // The From header is forgeable, and this is a write, not a read. Keying
    // on it would let anyone who learns a thread token suppress an arbitrary
    // address platform-wide — a competitor could quietly delete a rep's whole
    // pipeline. The lead's own email is the address FieldQuo actually sent to
    // and is not attacker-controlled, and it is also the address the request
    // is about: "stop emailing me" means stop emailing the mailbox you
    // emailed. The same reasoning the echo check above gives for why a forged
    // From may only ever DISCARD, never select.
    //
    // Every channel, not just email. A person who says stop has said stop —
    // ALL_CHANNELS in ./suppressionRules.js carries that argument.
    let wrote = null;
    if (optOut && thread.lead?.email) {
      const result = await suppressWithin(tx, {
        kind: "email",
        value: thread.lead.email,
        source: "reply",
        reason: "Replied to a sales email asking not to be contacted again.",
        salesLeadId: thread.lead.id,
        salesMessageId: created.id,
        requestedAt: sentAt,
      });
      wrote = result.ok ? result.suppression : null;
    }

    return { message: created, suppressed: wrote };
  });

  return {
    filed: true,
    threadId: thread.id,
    leadId: thread.leadId,
    messageId: message.id,
    // Reported back so the forwarder's operator (and the log) can see that an
    // opt-out landed, and whether it reached the platform list — a lead with
    // no email address on file cannot be suppressed by address, and that gap
    // is reported rather than hidden behind a bare `true`.
    optOut,
    suppressed: Boolean(suppressed),
  };
}
