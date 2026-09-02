// lib/photoComments/notify.js
//
// Reaching a mentioned member — the half of "@mention" that makes it more
// than a highlighted name in a text box.
//
// ══ There is no notification store to put this in ══════════════════════════
//
// This codebase has NotificationRule (a company-level on/off switch that
// gates whether an EXISTING email fires — see lib/notifications/
// invoicePaymentNotice.js) and nothing else: no Notification model, no inbox,
// no bell icon backed by a table. Checked before building anything here.
//
// JobPhotoMention (in prisma/schema.prisma) is deliberately doubling as the
// record of the mention AND the record of how it was delivered — notifiedVia,
// notifiedAt, skipReason. That is the honest minimum: a durable trail of who
// was told, when, and why not when it failed — without inventing a bell-icon
// UI over a general-purpose table nothing else in the product uses yet. If a
// real in-app notification centre gets built later, this table is exactly the
// data it would want to read; nothing here needs to be re-shaped for that.
//
// ══ Which channel actually reaches a crew member ═══════════════════════════
//
// SMS, over the company's OWN crew line — the same number a crew member
// already texts photos to (lib/crew/inbox.js), so a reply lands in a thread
// they already recognise. Deliberately gated on the company having set that
// line up (Company.crewInboxEnabled + a connected CrewInboxNumber): sending
// from the shared system number to a phone that has never had a crew-texting
// relationship with this company would be starting a NEW kind of message
// nobody opted into, on a channel this product treats as an opt-in feature
// everywhere else it appears. A company that hasn't turned crew texting on
// gets no SMS mention — the comment is still saved, and reaches them the next
// time they open the job.
//
// Every crew member's phone is Worker.phone, not Member.phone — the same
// field lib/crew/inbox.js resolveSender() matches inbound texts against, kept
// consistent here rather than inventing a second "the crew's number" source
// of truth.
//
// Billed exactly like a crew-line reply, through the SAME metering function
// (chargeOutboundCrewReply) and the SAME balance — this is an outbound crew
// text and the ledger should not need to know why it was sent.
//
// ══ Email is the fallback, not email-first ══════════════════════════════════
//
// Anyone with no reachable crew-line phone gets an email, following the exact
// "internal, staff-facing notice" convention notifyInvoicePayment already
// uses: the company's name as the display name, FieldQuo's fixed sending
// address, no white-label rule (the audience is the contractor's own team,
// not a homeowner).
//
// ══ STOP is respected, and self-mentions are never sent ════════════════════
//
// maySms() runs before every SMS attempt — a mention is not a reason to text
// someone who opted out. Self-mentions never reach this file at all:
// lib/photoComments/mentionable.js#resolveMentions drops the author's own id
// before any JobPhotoMention row is even created.
//
// ══ Detached, deliberately ═══════════════════════════════════════════════
//
// Called fire-and-forget from the comments route, same as the "on my way" SMS
// in app/api/jobs/[id]/visits/[visitId]/route.js: a Twilio or Resend outage
// must not turn an already-saved comment into a failed request. Every
// JobPhotoMention row already exists (status "none", not yet attempted)
// before this runs, so a crash here mid-loop leaves an honest, resumable
// trail rather than a silently lost mention.
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { maySms } from "@/lib/sms/optOut";
import { chargeOutboundCrewReply, crewSpendFor } from "@/lib/crew/messaging";


/** The text sent to a mentioned crew member's phone. Kept short — one SMS segment. */
export function mentionSmsBody({ companyName, authorName, where }) {
  return `${companyName}: ${authorName} mentioned you on a job photo for ${where}. Open FieldQuo to see it.`;
}

/**
 * Try the crew-line SMS channel. Returns { ok, reason? }.
 *
 * `deps` is an injection seam for the check script, matching
 * notifyInvoicePayment's own `deps.db` pattern — a pure function cannot cover
 * this (it is entirely "does the send happen and does it get billed"), so the
 * seam is how a check script executes it against a stub instead of a real
 * Twilio account and a real ledger.
 */
async function crewSmsChannel({ companyId, phone, body }, deps = {}) {
  const prisma = deps.db || db;
  const send = deps.sendSms || sendSms;
  const may = deps.maySms || maySms;
  const spendFor = deps.crewSpendFor || crewSpendFor;
  const charge = deps.chargeOutboundCrewReply || chargeOutboundCrewReply;

  const e164 = toE164(phone);
  if (!e164) return { ok: false, reason: "no_channel" };

  const line = await prisma.crewInboxNumber.findUnique({ where: { companyId } });
  if (!line?.connectedAt) return { ok: false, reason: "crew_line_not_set_up" };

  const allowed = await may({ companyId, phone: e164 });
  if (!allowed) return { ok: false, reason: "opted_out" };

  const spend = await spendFor(companyId, body);
  if (!spend.canReply) return { ok: false, reason: "insufficient_balance" };

  const result = await send({ to: e164, from: line.e164, body });
  if (!result?.success) return { ok: false, reason: "send_failed" };

  await charge({ companyId, sid: result.sid, body, to: e164 }).catch((err) => {
    console.error("[photo-mention] crew SMS metering failed:", err.message);
  });
  return { ok: true };
}

/**
 * Try the email fallback. Returns { ok, reason? }.
 *
 * The injection seam moved from a whole Resend client (`deps.resend`) to the
 * one function actually used (`deps.sendEmail`), because lib/email/resend.js is
 * now the only module allowed to construct a client — and a test that injects a
 * fake client is a test that proves a path nothing takes any more.
 */
async function emailChannel({ companyId, companyName, toEmail, subject, html }, deps = {}) {
  const mailer = deps.sendEmail || sendEmail;
  if (!toEmail) return { ok: false, reason: "no_channel" };
  try {
    const result = await mailer({
      // A demo company's mentions reach its seeded staff, whose addresses are
      // fictional — but the demo can be re-dressed and its members edited, so
      // the seam is the company rather than the address. See
      // lib/email/demoMail.js.
      companyId,
      // Same "internal, staff-facing notice" convention as
      // notifyInvoicePayment — see that file's comment for why the
      // white-label rule doesn't apply to a notice sent to the company's own
      // team.
      from: `${companyName} <notifications@fieldquo.com>`,
      to: toEmail,
      subject,
      html,
    });
    // sendEmail reports its failures rather than throwing, so the catch below
    // no longer sees them. A mention marked "delivered" on a bounced address
    // is the whole reason this function returns a verdict at all.
    if (result?.error || result?.skipped) return { ok: false, reason: "send_failed" };
    return { ok: true };
  } catch (err) {
    console.error("[photo-mention] email send failed:", err.message);
    return { ok: false, reason: "send_failed" };
  }
}

/**
 * Attempt delivery for every mention on one comment, and write back what
 * actually happened. Never throws — every failure path is recorded on the
 * row and swallowed, because this runs detached and has no caller left to
 * hand an error to.
 *
 * @param {object} p
 * @param {string} p.commentId
 * @param {string} p.photoId
 * @param {string} p.jobId
 * @param {string} p.companyId
 * @param {string} p.authorMemberId
 * @param {string[]} p.mentionMemberIds  already resolved/filtered — see
 *        resolveMentions. This does not re-validate who may be mentioned; it
 *        only decides how to reach the people already approved.
 */
export async function notifyMentions(
  { commentId, photoId, jobId, companyId, authorMemberId, mentionMemberIds },
  deps = {},
) {
  const prisma = deps.db || db;
  if (!Array.isArray(mentionMemberIds) || !mentionMemberIds.length) return;

  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId, companyId },
    select: { id: true },
  });
  // The photo was deleted (or never existed against this company) between
  // the comment landing and this running — nothing left to point a
  // notification at. The mention rows stay "none" with no reason recorded
  // beyond what's implicit in never being reached; there is no photo left to
  // check them against.
  if (!photo) return;

  const [company, job, author, members] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    prisma.job.findUnique({
      where: { id: jobId },
      select: { title: true, client: { select: { name: true } } },
    }),
    prisma.member.findUnique({
      where: { id: authorMemberId },
      select: { user: { select: { name: true } } },
    }),
    prisma.member.findMany({
      where: { id: { in: mentionMemberIds }, companyId },
      select: {
        id: true,
        user: { select: { email: true, workerProfile: { select: { phone: true } } } },
      },
    }),
  ]);

  const companyName = company?.name || "FieldQuo";
  const authorName = author?.user?.name || "Someone on your team";
  const where = job?.client?.name || job?.title || "a job";
  const smsBody = mentionSmsBody({ companyName, authorName, where });
  const subject = `${authorName} mentioned you on a job photo`;
  const html = `<p><strong>${authorName}</strong> mentioned you in a comment on a photo for <strong>${where}</strong>.</p>`;

  for (const m of members) {
    const phone = m.user?.workerProfile?.phone || null;

    let outcome = { ok: false, reason: "no_channel" };
    if (phone) {
      outcome = await crewSmsChannel({ companyId, phone, body: smsBody }, deps);
    }
    let via = outcome.ok ? "sms" : null;

    if (!outcome.ok && m.user?.email) {
      outcome = await emailChannel({ companyId, companyName, toEmail: m.user.email, subject, html }, deps);
      if (outcome.ok) via = "email";
    }

    await prisma.jobPhotoMention
      .updateMany({
        where: { commentId, memberId: m.id },
        data: {
          notifiedVia: outcome.ok ? via : "none",
          notifiedAt: outcome.ok ? new Date() : null,
          skipReason: outcome.ok ? null : outcome.reason,
        },
      })
      .catch((err) => {
        console.error("[photo-mention] couldn't record delivery outcome:", err.message);
      });
  }
}
