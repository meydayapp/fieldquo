// lib/sales/outreachSender.js
//
// Sending as the rep, and keeping the copy.
//
// ══ Through the rep's own mailbox, since 2026-09-18 ═══════════════════════
//
// The owner's instruction has always been that a rep's outreach goes out
// FROM their own real mailbox — name@fieldquo.com — so that a reply reaches
// them personally and the prospect is talking to a person rather than to a
// product. The first version honoured the From and sent through Resend,
// which collided with a vendor constraint (Resend sends only from a domain
// verified on its account) and, worse, meant the reply went to a mailbox
// the portal could not read. The owner then bought each rep a Namecheap
// Private Email inbox and decided the portal should be a second window
// onto it. So this file now sends through THAT mailbox's SMTP
// (lib/sales/mailbox/send.js), appends the copy to its Sent folder so the
// rep's phone shows it, and records the SalesMessage with the Message-ID it
// minted — which is how the next sync recognises the appended copy as ours.
//
// Resend is not used for anything the rep sends. It keeps every PLATFORM
// send (a quote, a company invite, the digest), which are not this file's.
//
// ══ Nothing here sends by itself ═══════════════════════════════════════════
//
// There is no cron, no queue, no drip. deliverOutreach() is called by three
// routes, all POSTs, all triggered by a rep pressing a button on a message
// they typed (or an invite they chose to send). Automatic outreach is a
// different product with a different consent posture, and it is not this one.

import { after } from "next/server";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { buildOutboundEmail, newReplyToken, sanitiseHeaderText, statusAfterSend } from "./outreach";
import { outreachReadiness } from "./outreachReadiness";
import { checkSuppression, sourceProviderForContact } from "./suppression";
import { sendFromMailbox } from "./mailbox/send";
import { MAILBOX_PUBLIC_SELECT } from "./mailbox/store";
import { repPublicName } from "./repIdentity";

/** The addressing mode, or undefined — read by the dormant Resend door only. */
export function replyAddressingMode() {
  return process.env.SALES_REPLY_ADDRESSING;
}

/**
 * The domain Resend receives replies at, or undefined. Read by
 * app/api/webhooks/resend-inbound — the door that stays for a deployment
 * that cannot connect a mailbox (docs/SALES-OUTREACH.md §5b). Not consulted
 * by anything a rep sends.
 */
export function replyDomain() {
  const value = String(process.env.SALES_REPLY_DOMAIN || "").trim().toLowerCase();
  return value || undefined;
}

/** FieldQuo's own mailing address, for the CASL footer. No default, ever.
 *
 *  The value lives in lib/legal/mailingAddress.js and this re-exports it, so
 *  every caller here is unchanged. Two readings of one legal requirement is
 *  how one of them comes to ship without a footer. */
import { mailingAddress } from "@/lib/legal/mailingAddress";
export { mailingAddress };

/**
 * The address a rep's outreach goes out from, and the one a reply comes back
 * to. Their WORK mailbox, never their sign-in address.
 *
 * SalesRep.workEmail exists precisely so that these two are different
 * columns, and its schema comment states the rule in full: "There is
 * deliberately no fallback to `email`. A missing work mailbox must block
 * sending and say so, because the alternative — quietly sending from the
 * login address — is a send that reads as successful while the reply goes
 * somewhere nobody is watching." A helper rather than four inlined
 * `rep.workEmail`s: this is one decision.
 */
export function repSendingAddress(rep) {
  return String(rep?.workEmail || "").trim().toLowerCase() || null;
}

/**
 * The full readiness verdict for one rep. Re-read at every request: the
 * mailbox row is read here, fresh, never remembered from a screen.
 */
export async function outreachStatus(rep) {
  const mailbox = rep?.id
    ? await db.salesMailbox.findUnique({ where: { salesRepId: rep.id }, select: MAILBOX_PUBLIC_SELECT })
    : null;
  return outreachReadiness({
    repEmail: repSendingAddress(rep),
    mailbox,
    mailingAddress: mailingAddress(),
  });
}

/**
 * Send one message as the rep, and record it — in that order.
 *
 * ══ Why the thread is created AFTER the send, not before ═══════════════════
 *
 * The obvious shape is: create the thread, send, done. That leaves an empty
 * thread behind every failed send — a conversation in the rep's list that
 * never happened. Deleting it afterwards is worse (this codebase does not
 * delete history to tidy up), so the thread and its first message are
 * written together only once the mailbox's SMTP has accepted the message.
 *
 * The same rule governs the reply path: a SalesMessage is written if and only
 * if the server accepted it. A row saying "sent" for mail that never left is
 * exactly the class of bug AGENTS.md opens with.
 *
 * @param thread       an existing SalesThread to reply into, or null to start one.
 * @param to, cc       recipients the ROUTE validated against the closed set
 *                     (lib/sales/emailRecipients.js). Absent → the lead's address.
 * @param subjectOverride  a forward's "Fwd: …"; otherwise the thread's subject.
 * @param inReplyTo, references  the answered message's ids, so the prospect's
 *                     client threads the reply under the right message.
 * @param attachments  nodemailer attachments [{ filename, content (base64) |
 *                     path (URL) }].
 * @param build        optional: `(replyToken) => ({ subject, html, text })`.
 *                     The intro email (lib/sales/outreach/introEmail.js) is
 *                     a designed message with buttons and a screenshot, not
 *                     a rep's paragraphs, so it builds its own parts — but
 *                     it goes through THIS function, not around it, because
 *                     everything above the build (the suppression list, the
 *                     readiness check) and everything below it (the thread,
 *                     the message row, the Sent copy) is the rule and not
 *                     the template. The token is handed in so the built
 *                     email can print the "Ref:" line a reply files by.
 * @returns { ok: true, threadId, messageId, appendError? } | { ok: false, status, error }
 */
export async function deliverOutreach({
  rep,
  lead,
  thread,
  subject,
  body,
  attachments = [],
  to = null,
  cc = [],
  subjectOverride = null,
  inReplyTo = null,
  references = [],
  build = null,
}) {
  const recipients = Array.isArray(to) && to.length ? to : lead?.email ? [lead.email] : [];
  if (!recipients.length) {
    return { ok: false, status: 400, error: "This lead has no email address." };
  }

  // ── FieldQuo's own do-not-contact list, read here and nowhere earlier ────
  //
  // The route already asked before it got here, and that is not enough. This
  // is the LAST statement before a message leaves the building, and it is the
  // only place where "was this person suppressed" and "did we send" cannot
  // have drifted apart. Same discipline as lib/migrations/state.js's
  // canWrite(). Placed above the readiness check on purpose: reporting "your
  // mailbox isn't connected" to someone trying to email a suppressed prospect
  // answers the wrong question. The provenance is resolved here too — an
  // address from a licence register carries no CASL consent
  // (lib/sales/suppressionRules.js), and a route that remembered to look it
  // up is a route the next one forgets.
  if (lead?.id || lead?.email) {
    const sourceProvider = await sourceProviderForContact(db, { leadId: lead?.id, email: lead?.email });
    const suppression = await checkSuppression(db, {
      email: lead?.email,
      phone: lead?.phone,
      channel: "email",
      sourceProvider,
    });
    if (suppression.suppressed) {
      return { ok: false, status: 409, error: suppression.reason, suppressed: true, optedOut: true };
    }
  }

  // Re-checked here, not trusted from the screen that rendered the compose
  // box — the check runs in the request that performs the action.
  const readiness = await outreachStatus(rep);
  if (!readiness.canSend) {
    return { ok: false, status: 409, error: readiness.blockers[0].title, blockers: readiness.blockers };
  }

  const sendingAddress = repSendingAddress(rep);
  const sender = { ...rep, email: sendingAddress };
  const replyToken = thread?.replyToken || newReplyToken();

  let email;
  try {
    email = typeof build === "function" ? build(replyToken) : buildOutboundEmail({
      // The CASL footer prints the rep's address — see caslFooterLines — and
      // it has to be the one a prospect can actually write to, which is the
      // work mailbox and not the login.
      rep: sender,
      subject: subjectOverride || (thread ? thread.subject : subject),
      body,
      replyToken,
      mailingAddress: mailingAddress(),
    });
  } catch (err) {
    return { ok: false, status: 400, error: err.message };
  }

  // A reply keeps the thread's subject, prefixed once. Re: Re: Re: is what a
  // thread looks like when nobody owns the subject line.
  const subjectLine =
    thread && !subjectOverride
      ? /^re:/i.test(email.subject)
        ? email.subject
        : `Re: ${email.subject}`
      : email.subject;

  // The full row, with the secret, read in the request that uses it and
  // handed to the one function that opens it. Never returned.
  const mailbox = await db.salesMailbox.findUnique({ where: { salesRepId: rep.id } });
  const ccList = Array.isArray(cc) ? cc.filter(Boolean) : [];

  // The Sent copy is placed after the response (lib/sales/mailbox/send.js
  // says why); `pendingAppend` is run from `after()` once the row exists so
  // the uid lands on it.
  let pendingAppend = null;
  const sent = await sendFromMailbox(
    mailbox,
    {
      // The work name (or first name) — what the prospect heard on the
      // phone — never the rep's full real name. lib/sales/repIdentity.js.
      from: { name: sanitiseHeaderText(repPublicName(rep), 120), address: sendingAddress },
      to: recipients,
      cc: ccList,
      subject: subjectLine,
      text: email.text,
      html: email.html,
      attachments,
      inReplyTo,
      references,
    },
    { appendLater: (fn) => { pendingAppend = fn; } },
  );

  if (!sent.ok) {
    await recordError({
      area: "sales_outreach",
      code: "send_failed",
      message: `Outreach to ${recipients.join(", ")} was not sent: ${sent.error}`,
      detail: { leadId: lead?.id || null, salesRepId: rep.id, from: sendingAddress },
    }).catch(() => {});
    return { ok: false, status: 502, error: sent.error };
  }

  const sentAt = new Date();

  const written = await db.$transaction(async (tx) => {
    const targetThread =
      thread ||
      (await tx.salesThread.create({
        data: {
          salesRepId: rep.id,
          leadId: lead?.id || null,
          mailboxId: mailbox.id,
          counterpart: recipients[0],
          subject: email.subject,
          replyToken,
          lastMessageAt: sentAt,
        },
      }));

    const message = await tx.salesMessage.create({
      data: {
        threadId: targetThread.id,
        direction: "out",
        // What actually went out in the From header, not who the rep is.
        fromAddress: sendingAddress,
        toAddress: recipients.join(", "),
        ccAddresses: ccList.length ? ccList.join(", ") : null,
        subject: subjectLine,
        body: email.text,
        messageId: sent.messageId,
        inReplyTo: inReplyTo || null,
        references: Array.isArray(references) && references.length ? references.join(" ") : null,
        imapFolder: sent.imapFolder,
        imapUid: sent.imapUid,
        seen: true,
        sentAt,
      },
    });

    if (thread) {
      await tx.salesThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: sentAt, ...(thread.mailboxId ? {} : { mailboxId: mailbox.id }) },
      });
    }

    if (lead?.id && lead?.status) {
      const nextStatus = statusAfterSend(lead.status);
      if (nextStatus !== lead.status) {
        await tx.salesLead.update({ where: { id: lead.id }, data: { status: nextStatus } });
      }
    }

    return { threadId: targetThread.id, messageId: message.id };
  });

  if (pendingAppend) {
    const salesMessageId = written.messageId;
    after(async () => {
      const r = await pendingAppend();
      if (r?.ok && r.imapUid !== null) {
        await db.salesMessage.update({ where: { id: salesMessageId }, data: { imapUid: r.imapUid, imapFolder: r.imapFolder } }).catch(() => {});
      } else if (r?.appendError) {
        await recordError({
          area: "sales_outreach",
          code: "sent_copy_not_placed",
          message: r.appendError,
          detail: { salesRepId: rep.id, threadId: written.threadId, salesMessageId },
        }).catch(() => {});
      }
    });
  }

  if (sent.appendError) {
    // The message left; only the copy in Sent did not land. Worth a row in
    // the error log — a rep's phone that does not show a sent message is a
    // rep who sends it twice — and worth telling the caller, never a failure.
    await recordError({
      area: "sales_outreach",
      code: "sent_copy_not_appended",
      message: sent.appendError,
      detail: { salesRepId: rep.id, threadId: written.threadId, salesMessageId: written.messageId },
    }).catch(() => {});
  }

  return { ok: true, ...written, appendError: sent.appendError || null };
}
