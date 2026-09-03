// lib/sales/outreachSender.js
//
// Sending as the rep, and keeping the copy.
//
// ══ The From address is not free, and this file is where that bites ════════
//
// The owner's instruction is that a rep's outreach goes out FROM their own real
// mailbox — name@fieldquo.com — so that a reply reaches them personally and the
// prospect is talking to a person rather than to a product. That is the right
// product decision and it collides with a hard vendor constraint:
//
//   Resend will only send from a domain VERIFIED on the Resend account.
//
// lib/email/resend.js's header says it in the same words, and
// lib/email/platformSender.js exists because of the neighbouring version of
// this problem. The important detail is that platformSender does NOT establish
// that the rep's domain is sendable, because it deliberately prefers a `send.`
// / `mail.` SUBDOMAIN when one is verified — reputation isolation for
// transactional mail. So a deployment can be perfectly healthy, sending every
// quote from quotes@send.fieldquo.com, while `emilio@fieldquo.com` remains an
// address Resend refuses outright.
//
// This file therefore asks Resend the question directly, per rep, and answers
// it in the readiness object rather than at the moment of a failed send. It
// never falls back to the platform sender: a sales email that silently arrives
// from quotes@send.fieldquo.com instead of from the rep is the "control that
// appears to work and doesn't" that AGENTS.md is written against — the rep
// would see "sent", and the reply would go somewhere they never look.
//
// ══ Nothing here sends by itself ═══════════════════════════════════════════
//
// There is no cron, no queue, no drip. deliverOutreach() is called by exactly
// two routes, both POSTs, both triggered by a rep pressing a button on a
// message they typed. Automatic outreach is a different product with a
// different consent posture, and it is not this one.

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { listDomains } from "@/lib/email/resendDomains";
import { recordError } from "@/lib/platform/errorLog";
import {
  buildOutboundEmail,
  emailDomain,
  newReplyToken,
  replyToAddress,
  sanitiseHeaderText,
  statusAfterSend,
} from "./outreach";
import { outreachReadiness } from "./outreachReadiness";
import { checkSuppression } from "./suppression";

/** The addressing mode, or undefined. No default — see replyToAddress. */
export function replyAddressingMode() {
  return process.env.SALES_REPLY_ADDRESSING;
}

/** FieldQuo's own mailing address, for the CASL footer. No default, ever.
 *
 *  The value moved to lib/legal/mailingAddress.js and this re-exports it, so
 *  every caller here is unchanged. It had to move because a second commercial
 *  message needs the same address and is sent by a cron — and no cron may
 *  import from lib/sales/outreach* (scripts/check-sales-outreach.mjs section
 *  10). Re-exported rather than copied: two readings of one legal requirement
 *  is how one of them comes to ship without a footer. */
import { mailingAddress } from "@/lib/legal/mailingAddress";
export { mailingAddress };

// Same TTL and same reasoning as platformSender's cache: a rep sending a
// handful of emails in a sitting should not re-ask Resend for each one, and ten
// minutes is short enough that verifying a domain takes effect without a
// redeploy.
const DOMAIN_TTL_MS = 10 * 60 * 1000;
let domainCache = { value: null, at: 0 };

export function invalidateSalesSenderCache() {
  domainCache = { value: null, at: 0 };
}

/**
 * The domains FieldQuo may send from: verified on the Resend account, and NOT
 * claimed by any tenant.
 *
 * The exclusion is platformSender's rule, applied for the same reason —
 * Resend has no tenant concept, so every company that verifies its own domain
 * lands in one flat list, and sending FieldQuo's own sales mail from a
 * customer's domain would be both wrong and a small scandal.
 *
 * @returns a lowercase Set, or null when Resend could not be asked. Null is a
 *          third answer on purpose: "we don't know" must not read as "no".
 */
async function sendableDomains() {
  if (domainCache.value && Date.now() - domainCache.at < DOMAIN_TTL_MS) {
    return domainCache.value;
  }
  if (!process.env.RESEND_API_KEY) return new Set();

  try {
    const domains = await listDomains();
    const verified = domains.filter((d) => d.status === "verified");
    const claimed = verified.length
      ? await db.company.findMany({
          where: { emailDomainId: { in: verified.map((d) => d.id) } },
          select: { emailDomainId: true },
        })
      : [];
    const claimedIds = new Set(claimed.map((c) => c.emailDomainId));

    const ours = new Set(
      verified
        .filter((d) => !claimedIds.has(d.id))
        .map((d) => String(d.name || "").toLowerCase()),
    );
    domainCache = { value: ours, at: Date.now() };
    return ours;
  } catch (err) {
    console.error("[sales] couldn't ask Resend which domains are verified:", err?.message);
    return null;
  }
}

/**
 * Can Resend send as this address?
 *
 * @returns true / false / null (unknown — Resend could not be reached)
 */
export async function senderDomainVerified(repEmail) {
  const domain = emailDomain(repEmail);
  if (!domain) return false;
  const ours = await sendableDomains();
  if (ours === null) return null;
  return ours.has(domain);
}

/**
 * The address a rep's outreach goes out from, and the one a reply comes back
 * to. Their WORK mailbox, never their sign-in address.
 *
 * ══ This was the gap, and it was a silent one ═════════════════════════════
 *
 * SalesRep.workEmail exists precisely so that these two are different columns,
 * and its schema comment states the rule in full: "There is deliberately no
 * fallback to `email`. A missing work mailbox must block sending and say so,
 * because the alternative — quietly sending from the login address — is a send
 * that reads as successful while the reply goes somewhere nobody is watching."
 *
 * This file was doing exactly that. It read `rep.email` — the address the rep
 * signs in with, which SalesRep's own comment notes "may be personal or
 * pre-existing" — so a rep whose login was a personal Gmail would have sent
 * cold outreach from it and collected the replies there. workEmail had no
 * writer in the console and no reader on this path, which is AGENTS.md failure
 * class 1 in both directions.
 *
 * A helper rather than four inlined `rep.workEmail`s: this is one decision, and
 * the failure mode of getting it wrong in one of four places is invisible.
 */
export function repSendingAddress(rep) {
  return String(rep?.workEmail || "").trim().toLowerCase() || null;
}

/** The full readiness verdict for one rep. Re-read at every request. */
export async function outreachStatus(rep) {
  const sending = repSendingAddress(rep);
  return outreachReadiness({
    repEmail: sending,
    // Skipped entirely when there is no mailbox: asking Resend whether it can
    // send as `null` would spend a round trip to answer a question the missing
    // mailbox has already settled, and `false` from that call would then report
    // an unverified domain over the real blocker.
    senderDomainVerified: sending ? await senderDomainVerified(sending) : false,
    replyAddressing: replyAddressingMode(),
    mailingAddress: mailingAddress(),
    inboundSecretSet: Boolean(process.env.SALES_INBOUND_SECRET),
  });
}

/**
 * Send one message as the rep, and record it — in that order.
 *
 * ══ Why the thread is created AFTER the send, not before ═══════════════════
 *
 * The reply token has to be in the Reply-To of the message we are about to
 * send, so the obvious shape is: create the thread, read its token, send. That
 * leaves an empty thread behind every failed send — a conversation in the rep's
 * list that never happened. Deleting it afterwards is worse (this codebase does
 * not delete history to tidy up), so the token is minted first, in memory, and
 * the thread and its first message are written together only once Resend has
 * accepted the message and given us an id.
 *
 * The same rule governs the reply path: a SalesMessage is written if and only
 * if the provider accepted it. A row saying "sent" for mail that never left is
 * exactly the class of bug AGENTS.md opens with — three Send buttons that set a
 * status and emailed nobody.
 *
 * @param thread  an existing SalesThread to reply into, or null to start one.
 * @returns { ok: true, threadId, messageId } | { ok: false, status, error }
 */
export async function deliverOutreach({ rep, lead, thread, subject, body }) {
  if (!lead?.email) {
    return { ok: false, status: 400, error: "This lead has no email address." };
  }

  // ── FieldQuo's own do-not-contact list, read here and nowhere earlier ────
  //
  // The route already asked before it got here, and that is not enough. This
  // is the LAST statement before a message leaves the building, and it is the
  // only place where "was this person suppressed" and "did we send" cannot
  // have drifted apart — an opt-out that landed while the rep was typing, or
  // while the route was doing its other four queries, has to win. Same
  // discipline as lib/migrations/state.js's canWrite(), applied to the same
  // kind of write: one a human triggered, against a rule that can change
  // underneath them.
  //
  // Placed above the readiness check on purpose. Readiness is about whether
  // FieldQuo's mail is configured; this is about whether we are allowed to
  // write to this person at all, and reporting "your domain isn't verified"
  // to someone trying to email a suppressed prospect answers the wrong
  // question.
  //
  // The domain is derived from the address by suppressionLookupKeys, so a
  // suppressed company blocks every mailbox at it without the caller
  // remembering to ask.
  const suppression = await checkSuppression(db, {
    email: lead.email,
    phone: lead.phone,
    channel: "email",
  });
  if (suppression.suppressed) {
    return { ok: false, status: 409, error: suppression.reason, suppressed: true, optedOut: true };
  }

  // Re-checked here, not trusted from the screen that rendered the compose box
  // — the same discipline lib/migrations/state.js's canWrite() applies to a
  // superadmin's write: the check runs in the request that performs the action.
  const readiness = await outreachStatus(rep);
  if (!readiness.canSend) {
    return {
      ok: false,
      status: 409,
      error: readiness.blockers[0].title,
      blockers: readiness.blockers,
    };
  }

  // Everything below addresses the mail from the rep's WORK mailbox. Built
  // once, here, rather than read off `rep` four more times — readiness has
  // already refused the request if there isn't one, so this is non-null by the
  // time anything uses it.
  const sendingAddress = repSendingAddress(rep);
  const sender = { ...rep, email: sendingAddress };

  const replyToken = thread?.replyToken || newReplyToken();
  const replyTo = replyToAddress(sendingAddress, replyToken, readiness.replyAddressing);
  if (!replyTo) {
    return {
      ok: false,
      status: 409,
      error:
        `A reply address couldn't be built from ${sendingAddress}. A mailbox whose ` +
        `name already contains a "+" can't carry a sub-address; set ` +
        `SALES_REPLY_ADDRESSING to "plain" for this deployment.`,
    };
  }

  let email;
  try {
    email = buildOutboundEmail({
      // The CASL footer prints the rep's address — see caslFooterLines — and
      // it has to be the one a prospect can actually write to, which is the
      // work mailbox and not the login.
      rep: sender,
      subject: thread ? thread.subject : subject,
      body,
      replyToken,
      mailingAddress: mailingAddress(),
    });
  } catch (err) {
    return { ok: false, status: 400, error: err.message };
  }

  // A reply keeps the thread's subject, prefixed once. Re: Re: Re: is what a
  // thread looks like when nobody owns the subject line.
  const subjectLine = thread
    ? /^re:/i.test(email.subject)
      ? email.subject
      : `Re: ${email.subject}`
    : email.subject;

  // No companyId: this is FieldQuo writing to a prospect on its own behalf, not
  // mail sent for a tenant. That is also why the FieldQuo name in the footer is
  // correct rather than a white-label leak — see AGENTS.md, whose white-label
  // rule is about what a CONTRACTOR's client sees.
  const result = await sendEmail({
    to: lead.email,
    subject: subjectLine,
    html: email.html,
    text: email.text,
    from: `${sanitiseHeaderText(rep.name, 120)} <${sendingAddress}>`,
    replyTo,
  });

  if (result?.skipped) {
    return {
      ok: false,
      status: 503,
      error:
        "Email isn't configured on this deployment (RESEND_API_KEY is unset), " +
        "so nothing was sent and nothing was filed.",
    };
  }

  if (result?.error || !result?.id) {
    // sendEmail has already recorded the provider's own error durably; this
    // adds the sales context that error log has no way to know.
    await recordError({
      area: "sales_outreach",
      code: "send_failed",
      message: `Outreach to ${lead.email} was not sent`,
      detail: { leadId: lead.id, salesRepId: rep.id, from: sendingAddress },
    }).catch(() => {});
    return {
      ok: false,
      status: 502,
      error:
        typeof result?.error === "string"
          ? result.error
          : result?.error?.message ||
            "The email provider refused the message. Nothing was sent.",
    };
  }

  const sentAt = new Date();

  const written = await db.$transaction(async (tx) => {
    const targetThread =
      thread ||
      (await tx.salesThread.create({
        data: {
          salesRepId: rep.id,
          leadId: lead.id,
          subject: email.subject,
          replyToken,
          lastMessageAt: sentAt,
        },
      }));

    const message = await tx.salesMessage.create({
      data: {
        threadId: targetThread.id,
        direction: "out",
        // What actually went out in the From header, not who the rep is. A
        // stored copy that disagrees with the delivered message is worse than
        // no copy: it is the record somebody consults when a prospect asks who
        // wrote to them.
        fromAddress: sendingAddress,
        toAddress: lead.email,
        subject: subjectLine,
        body: email.text,
        providerId: result.id,
        sentAt,
      },
    });

    if (thread) {
      await tx.salesThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: sentAt },
      });
    }

    const nextStatus = statusAfterSend(lead.status);
    if (nextStatus !== lead.status) {
      await tx.salesLead.update({
        where: { id: lead.id },
        data: { status: nextStatus },
      });
    }

    return { threadId: targetThread.id, messageId: message.id };
  });

  return { ok: true, ...written };
}
