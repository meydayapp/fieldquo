// lib/sales/resendInboundDoor.js
//
// One `email.received` event, end to end: claim it, fetch the message, file
// it through the same function every other door uses, make its attachments
// durable, and put a copy in front of the rep.
//
// ══ Why the copy is not optional ═══════════════════════════════════════════
//
// With SALES_REPLY_DOMAIN set, a prospect's reply is addressed to
// `<rep>+fqs…@reply.example.com` and goes to Resend — NOT to the rep's
// mailbox. The old design (docs/SALES-OUTREACH.md §5) had the mailbox as the
// place a human reads the mail and FieldQuo as the copy; this door inverts
// that, and the forward below is what makes it honest. A reply that FieldQuo
// files and nobody reads is a reply the rep never answers.
//
// So the forward happens on every outcome a human should see: filed, and
// also no_token / unknown_token / ambiguous_sender — a prospect who wrote to
// a rep's reply address is a prospect who wrote to the rep, whatever
// happened to our routing label. It is skipped for own_outbound (the rep's own message) and
// duplicate (FieldQuo already holds it, and the receipt ledger below is what
// keeps a redelivery from reaching here at all).
//
// ══ Every dependency is a parameter ════════════════════════════════════════
//
// The database, the two Resend Receiving calls, the byte download, the
// Cloudinary upload, the outbound send, the clock. lib/sales/outreachInbound.js
// takes its db the same way and says why: the rules here — a redelivered event
// forwards nothing, a token in the From files nowhere, a message whose forward
// failed is still filed — are properties of a sequence of calls, and reading
// them proves nothing. scripts/check-resend-inbound.mjs runs this function
// against fakes. The route supplies the real ones and nothing else.

import { bareAddress, isPlausibleEmail, sanitiseHeaderText } from "./outreach";
import { ingestInboundEmail } from "./inboundEmail";
import {
  attachmentsNote,
  forwardBodies,
  forwardHeaderLine,
  isResendEmailId,
  readReceivedEvent,
  receivedEmailToContract,
  replyDomainLocalPart,
} from "./resendInbound";
import { rehostInboundAttachments } from "./inboundAttachments";

/**
 * A receipt left in "processing" this long is a crash, not a colleague. A
 * redelivery after it is allowed to take over; before it, the redelivery is
 * the ordinary duplicate it almost always is.
 */
export const PROCESSING_STALE_MS = 10 * 60 * 1000;

/** Outcomes that put a copy in the rep's mailbox. */
const FORWARDED_OUTCOMES = new Set(["filed", "no_token", "unknown_token", "ambiguous_sender"]);

/**
 * @param event  the parsed webhook body, already signature-verified
 * @param deps   {
 *   db, getReceivedEmail, listReceivedAttachments, sendEmail, platformFrom,
 *   replyDomain, recordError, fetchImpl, uploadImpl, now
 * }
 * @returns { status, body } for the route to answer with
 */
export async function processReceivedEvent(event, deps) {
  const {
    db,
    getReceivedEmail,
    listReceivedAttachments,
    sendEmail,
    platformFrom,
    replyDomain,
    recordError = async () => {},
    fetchImpl = fetch,
    uploadImpl,
    now = () => Date.now(),
  } = deps;

  const read = readReceivedEvent(event);
  if (!read.ok) return { status: 200, body: { ignored: true, reason: read.reason } };
  if (!isResendEmailId(read.emailId)) {
    return { status: 200, body: { ignored: true, reason: "bad_email_id" } };
  }

  // ── Claim ───────────────────────────────────────────────────────────────
  //
  // The unique constraint on resendEmailId is the idempotency: the second
  // delivery of one event hits it and is answered `duplicate` before a
  // single fetch or send. A receipt that ended in "error", or one abandoned
  // mid-flight, is retaken instead — that redelivery is Resend doing its job.
  let receipt;
  try {
    receipt = await db.salesInboundReceipt.create({
      data: { resendEmailId: read.emailId, messageId: read.messageId, outcome: "processing" },
    });
  } catch (err) {
    if (err?.code !== "P2002") throw err;
    const existing = await db.salesInboundReceipt.findUnique({
      where: { resendEmailId: read.emailId },
    });
    const abandoned =
      existing?.outcome === "processing" &&
      now() - new Date(existing.updatedAt || existing.createdAt).getTime() > PROCESSING_STALE_MS;
    if (!existing || (existing.outcome !== "error" && !abandoned)) {
      return {
        status: 200,
        body: { filed: false, reason: "duplicate", receiptId: existing?.id || null, forwarded: false },
      };
    }
    receipt = await db.salesInboundReceipt.update({
      where: { id: existing.id },
      data: { outcome: "processing", forwardError: null },
    });
  }

  const fail = async (message) => {
    await db.salesInboundReceipt
      .update({ where: { id: receipt.id }, data: { outcome: "error", forwardError: message } })
      .catch(() => {});
    await recordError({
      area: "sales_inbound",
      code: "resend_door_failed",
      message: `Handling a received sales email failed: ${message}`,
      detail: { resendEmailId: read.emailId },
    }).catch(() => {});
    // 500 so Resend redelivers; the receipt is marked so the redelivery is
    // let through.
    return { status: 500, body: { filed: false, reason: "error", error: "Couldn't handle that message." } };
  };

  // ── The message itself ──────────────────────────────────────────────────
  let email;
  try {
    email = await getReceivedEmail(read.emailId);
  } catch (err) {
    return fail(`fetching the message from Resend: ${err?.message || "unknown error"}`);
  }

  const contract = receivedEmailToContract(email, read);
  const ingest = await ingestInboundEmail(db, contract, { source: "resend", recordError, replyDomain, ...(deps.notify ? { notify: deps.notify } : {}) });
  const result = ingest.body;
  if (ingest.status >= 500) return fail(result?.error || "filing failed");

  // ── Attachments ─────────────────────────────────────────────────────────
  //
  // Only when the message filed or is about to be forwarded: an own_outbound
  // echo's attachments are the rep's own, and a duplicate's are already
  // stored.
  let carried = [];
  let notCarried = [];
  const meta = Array.isArray(email?.attachments) && email.attachments.length
    ? email.attachments
    : read.attachments;
  const wantsAttachments = meta.length > 0 && (result.filed || FORWARDED_OUTCOMES.has(result.reason));

  if (wantsAttachments) {
    let listed = null;
    try {
      listed = await listReceivedAttachments(read.emailId);
    } catch (err) {
      await recordError({
        area: "sales_inbound",
        code: "attachments_unlisted",
        message: `Couldn't list attachments on a received sales email: ${err?.message || "unknown"}`,
        detail: { resendEmailId: read.emailId },
      }).catch(() => {});
    }
    const rehosted = await rehostInboundAttachments({
      // The webhook's metadata has names and types but no download URLs;
      // passing it when the list call failed records every file as
      // "couldn't be stored" BY NAME rather than pretending nothing was sent.
      listed: listed || meta,
      folder: `sales-inbound/${result.threadId || "unfiled"}`,
      fetchImpl,
      ...(uploadImpl ? { uploadImpl } : {}),
    });
    carried = rehosted.carried;
    notCarried = rehosted.notCarried;
    if (result.filed && result.messageId) {
      await db.salesMessage
        .update({ where: { id: result.messageId }, data: { attachments: rehosted.stored } })
        .catch(async (err) => {
          await recordError({
            area: "sales_inbound",
            code: "attachments_unsaved",
            message: `Attachments were re-hosted but could not be written to the message: ${err?.message || "unknown"}`,
            detail: { resendEmailId: read.emailId, salesMessageId: result.messageId },
          }).catch(() => {});
        });
    }
  }

  // ── The copy to the rep ─────────────────────────────────────────────────
  let forwardedTo = null;
  let forwardProviderId = null;
  let forwardError = null;
  let prospectLabel = null;

  if (result.filed || FORWARDED_OUTCOMES.has(result.reason)) {
    const target = await repMailboxFor(db, { result, to: contract.to, replyDomain });
    forwardedTo = target.mailbox;
    prospectLabel = target.prospect;

    if (!forwardedTo) {
      forwardError = target.reason;
    } else {
      const prospectAddress = bareAddress(contract.from);
      const line = forwardHeaderLine({
        filed: result.filed,
        reason: result.reason,
        prospect: prospectLabel || prospectAddress,
        attachmentsNote: attachmentsNote(notCarried, {
          where: result.filed ? "in FieldQuo on the thread" : "in Resend's Receiving inbox",
        }),
      });
      const bodies = forwardBodies({ headerLine: line, text: contract.text, html: contract.html });
      const sent = await sendEmail({
        from: platformFrom,
        to: forwardedTo,
        subject: sanitiseHeaderText(contract.subject, 500) || "(no subject)",
        text: bodies.text,
        html: bodies.html,
        // A reply from the mailbox goes to the prospect, not back to us.
        ...(isPlausibleEmail(prospectAddress) ? { replyTo: prospectAddress } : {}),
        ...(carried.length ? { attachments: carried } : {}),
      });
      if (sent?.id) forwardProviderId = sent.id;
      else if (sent?.skipped) forwardError = "RESEND_API_KEY is unset, so nothing can be forwarded.";
      else forwardError = typeof sent?.error === "string" ? sent.error : sent?.error?.message || "Resend refused the forward.";
    }

    if (forwardError) {
      // The one failure that leaves a human without the mail. Recorded with
      // the Resend id so it can be found in Resend's own Receiving inbox.
      await recordError({
        area: "sales_inbound",
        code: "forward_failed",
        message: `A received sales email could not be forwarded to the rep's mailbox: ${forwardError}`,
        detail: {
          resendEmailId: read.emailId,
          outcome: result.filed ? "filed" : result.reason,
          threadId: result.threadId || null,
          to: forwardedTo,
        },
      }).catch(() => {});
    }
  }

  // ── Record ──────────────────────────────────────────────────────────────
  await db.salesInboundReceipt.update({
    where: { id: receipt.id },
    data: {
      outcome: result.filed ? "filed" : result.reason || "error",
      threadId: result.threadId || null,
      salesMessageId: result.messageId || null,
      forwardedTo,
      forwardProviderId,
      forwardError,
    },
  });
  if (result.filed && result.messageId && forwardProviderId) {
    await db.salesMessage.update({
      where: { id: result.messageId },
      data: { forwardProviderId },
    });
  }

  return {
    status: 200,
    body: {
      ...result,
      forwarded: Boolean(forwardProviderId),
      forwardedTo,
      ...(forwardError ? { forwardError } : {}),
      attachmentsStored: wantsAttachments ? meta.length : 0,
    },
  };
}

/**
 * Whose mailbox gets the copy.
 *
 * Filed: the thread's rep, by the thread the TOKEN chose. Unfiled: the local
 * part of the reply address, matched against our own SalesRep rows —
 * lib/sales/resendInbound.js's replyDomainLocalPart explains why that can
 * choose a mailbox of ours and nothing else. Never the sender.
 *
 * @returns { mailbox, prospect, reason }
 */
async function repMailboxFor(db, { result, to, replyDomain }) {
  if (result.filed && result.threadId) {
    const thread = await db.salesThread.findUnique({
      where: { id: result.threadId },
      select: {
        salesRep: { select: { workEmail: true, active: true } },
        lead: { select: { businessName: true, contactName: true, email: true } },
      },
    });
    const mailbox = String(thread?.salesRep?.workEmail || "").trim().toLowerCase();
    const prospect =
      [thread?.lead?.contactName, thread?.lead?.businessName].filter(Boolean).join(" · ") ||
      thread?.lead?.email ||
      null;
    if (!mailbox) return { mailbox: null, prospect, reason: "The thread's rep has no work mailbox." };
    if (thread?.salesRep?.active === false) {
      return { mailbox: null, prospect, reason: "The thread's rep is deactivated." };
    }
    return { mailbox, prospect, reason: null };
  }

  const local = replyDomainLocalPart(to, replyDomain);
  if (!local) {
    return { mailbox: null, prospect: null, reason: "No address at the reply domain was among the recipients." };
  }
  const rep = await db.salesRep.findFirst({
    where: { workEmail: { startsWith: `${local}@`, mode: "insensitive" }, active: true },
    select: { workEmail: true },
  });
  const mailbox = String(rep?.workEmail || "").trim().toLowerCase();
  if (!mailbox) {
    return { mailbox: null, prospect: null, reason: `No active rep has a work mailbox named "${local}".` };
  }
  return { mailbox, prospect: null, reason: null };
}
