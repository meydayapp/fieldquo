// lib/sales/salesSms.js
//
// A rep texting their own signup link, and the STOP that comes back.
//
// ══ Which number this goes out from, and why not the obvious one ═══════════
//
// FieldQuo's sales operation is not a tenant. VoicePhoneNumber.companyId is a
// required FK and heldNumber() enforces one number per company, so a sales
// number put there would make the rent cron bill a non-company and make
// derivedSpend count sales traffic as tenant burn — the telephony audit's
// finding, and the reason PlatformVoiceCall exists one table along.
// PlatformSmsNumber is the only tenant-free, SMS-capable number model, so that
// is where a sales number lives.
//
// Within it, a `sales`-purpose row rather than the existing `system` one. The
// system number sends ON BEHALF OF contractors — a homeowner's STOP to it means
// "stop texting me about my kitchen quote". A sales STOP means "stop selling me
// software". Sharing one number makes the two indistinguishable at the moment
// they arrive, and honouring either as the other is wrong in both directions:
// suppressing a contractor's client because a prospect said stop, or letting a
// prospect's stop be recorded as one tenant's opt-out and ignored by every
// other rep. Same argument lib/company/businessHours.js makes about two things
// that are allowed to disagree.
//
// ══ Nothing here sends by itself ═══════════════════════════════════════════
//
// No cron, no queue, no drip. deliverSignupLinkSms() is called by exactly one
// route, a POST, triggered by a rep pressing a button. That is the owner's
// requirement and it is also what keeps the compliance posture simple: a human
// chooses each recipient and each moment, which is precisely the property the
// compliance audit relied on for cold calling ("a human dials, one at a time").
//
// ══ The list is read here, last, and read again ════════════════════════════
//
// The screen asked before it rendered the button. That is not enough, for the
// reason lib/sales/outreachSender.js gives at length: this is the last
// statement before a message leaves the building, and an opt-out that landed
// while the rep was reading the screen has to win. Same discipline as
// lib/migrations/state.js's canWrite().

import { db } from "@/lib/db";
import { sendSms, twilioConfigured } from "@/lib/sms/twilioClient";
import { classifyInboundSms } from "@/lib/sms/optOutKeywords";
import { recordError } from "@/lib/platform/errorLog";
import { signupLinkFor } from "./repStats";
import { salesSmsReadiness } from "./salesSmsRules";
import { isSalesSmsTimeZone } from "./smsWindow";
import { checkSuppression, sourceProviderForContact, suppress } from "./suppression";
import { ALL_CHANNELS, normalisePhone } from "./suppressionRules";

/** FieldQuo's own mailing address, for the CASL line. No default, ever. */
export function salesMailingAddress() {
  return process.env.SALES_MAILING_ADDRESS || "";
}

/**
 * The number FieldQuo's reps text from, or null if it holds none.
 *
 * Null rather than a throw or a fallback to the system number: "we have no
 * sales number" is a real, reportable state — it is the state this deployment
 * is in today — and the screen that has to say so needs to be able to tell it
 * apart from a failure to look. Falling back to the system number would be the
 * dangerous convenience this whole file argues against.
 *
 * Deliberately NOT cached the way lib/sms/systemNumber.js caches its answer.
 * That one is read on every outbound text a busy deployment sends; this is read
 * a few times a day, and a sixty-second window in which a rep is told there is
 * no number after a superadmin just bought one buys nothing worth having.
 */
export async function salesSmsNumber() {
  const row = await db.platformSmsNumber.findFirst({
    where: { purpose: "sales", active: true },
    orderBy: { createdAt: "asc" },
    select: { e164: true },
  });
  return row?.e164 || null;
}

/**
 * FieldQuo's do-not-contact verdict for this lead, or null when the list could
 * not be read.
 *
 * Null is a third answer on purpose, and salesSmsRules treats it as a blocker.
 * "We don't know" must never read as "not suppressed" on the channel where a
 * mistake reaches somebody's pocket.
 */
async function suppressionFor(lead) {
  try {
    // A text is a commercial electronic message under CASL exactly as an email
    // is, so the same provenance question decides it. See
    // suppressionRules.js's CONSENT section: a number obtained from a licence
    // register carries no implied consent to be texted, and the do-not-contact
    // list has nothing to say about somebody who never opted out because they
    // were never asked.
    const sourceProvider = await sourceProviderForContact(db, {
      leadId: lead?.id,
      email: lead?.email,
    });
    return await checkSuppression(db, {
      email: lead?.email,
      phone: lead?.phone,
      channel: "sms",
      sourceProvider,
    });
  } catch (err) {
    console.error("[sales sms] couldn't read the do-not-contact list:", err?.message);
    return null;
  }
}

/**
 * Everything the screen and the send route both need, from one function so
 * they cannot disagree.
 *
 * @param origin from getAppOrigin(request) — the link is built per deployment
 *               so a preview hands out a preview link.
 */
export async function salesSmsStatus({ rep, lead, origin, now = new Date() }) {
  const [fromNumber, suppression] = await Promise.all([
    salesSmsNumber().catch(() => null),
    suppressionFor(lead),
  ]);

  return salesSmsReadiness({
    repName: rep?.name,
    // Never rebuilt here. One place knows the shape of a rep's link, and a
    // second copy of `/signup?sales=` is how a rep's texted link and their
    // portal link drift into two different URLs — one of which is not
    // attributed to them.
    signupLink: signupLinkFor(origin, rep?.code),
    fromNumber,
    mailingAddress: salesMailingAddress(),
    twilioConfigured: twilioConfigured(),
    leadPhone: lead?.phone,
    leadTimeZone: lead?.timeZone,
    suppression,
    now,
  });
}

/**
 * Send one signup-link text, and keep the copy — in that order.
 *
 * The row is written if and only if Twilio accepted the message and gave us a
 * SID, matching lib/sales/outreachSender.js. A row saying "sent" for a text
 * that never left is the class of bug AGENTS.md opens with.
 *
 * @returns { ok: true, messageId, to, body } | { ok: false, status, error, blockers? }
 */
export async function deliverSignupLinkSms({ rep, lead, origin, now = new Date() }) {
  const status = await salesSmsStatus({ rep, lead, origin, now });

  if (!status.canSend) {
    // The first blocker is the headline; the whole list goes back so the screen
    // can show every missing thing at once rather than one per attempt.
    const first = status.blockers[0];
    return {
      ok: false,
      // 409 for a standing instruction or a missing prerequisite — the caller
      // is entitled to be here and the request conflicts with the world's
      // state. Same status the email path returns for the same class of
      // refusal, so the screens need no new branch.
      status: 409,
      error: first.title,
      blockers: status.blockers,
      suppressed: first.code === "suppressed",
    };
  }

  // No companyId: this is FieldQuo texting a prospect on its own behalf, not a
  // text sent for a tenant. That is also why the demo guard in
  // lib/sms/twilioClient.js does not apply — there is no tenant row to be a
  // demo — and why the FieldQuo name in the message is correct rather than a
  // white-label leak. AGENTS.md's white-label rule is about what a
  // CONTRACTOR's client sees.
  const result = await sendSms({
    to: status.to,
    from: status.from,
    body: status.body,
  }).catch((err) => ({ success: false, error: err?.message }));

  if (!result?.success || !result?.sid) {
    await recordError({
      area: "sales_sms",
      code: "send_failed",
      message: `Signup-link text to ${status.to} was not sent`,
      detail: { leadId: lead?.id, salesRepId: rep?.id, from: status.from, error: result?.error },
    }).catch(() => {});
    return {
      ok: false,
      status: 502,
      error:
        result?.error ||
        "The carrier refused the message. Nothing was sent and nothing was filed.",
    };
  }

  const message = await db.salesSmsMessage.create({
    data: {
      salesRepId: rep.id,
      leadId: lead.id,
      fromE164: status.from,
      toE164: status.to,
      body: status.body,
      providerId: result.sid,
      sentAt: now,
    },
    select: { id: true, sentAt: true },
  });

  return { ok: true, messageId: message.id, to: status.to, body: status.body, sentAt: message.sentAt };
}

/**
 * A rep states where a prospect is, so the texting window can be evaluated.
 *
 * Scoped with the rep's own id in the WHERE rather than looked up and checked
 * afterwards — the same updateMany discipline app/api/sales/leads/[id] uses,
 * for the same reason: two steps leave a window where a scoping bug lives.
 *
 * @returns true when a row was written, false when the lead is not this rep's
 *          or the zone is not one we recognise.
 */
export async function setLeadTimeZone({ repId, leadId, timeZone }) {
  if (!isSalesSmsTimeZone(timeZone)) return false;
  const { count } = await db.salesLead.updateMany({
    where: { id: leadId, salesRepId: repId },
    data: { timeZone },
  });
  return count > 0;
}

/**
 * A text arrived at FieldQuo's own sales number.
 *
 * Called from app/api/sms/inbound after that route has failed to resolve the
 * number to a tenant. Two things are true of this path and both matter:
 *
 *  - A STOP here binds FIELDQUO, not one rep's copy of a lead. So it writes to
 *    the platform-wide SalesSuppression list keyed on the phone number, which
 *    is the whole reason that list exists — lib/sales/suppression.js's header
 *    describes the bug it replaced, where an opt-out silenced one rep and left
 *    the other still dialling.
 *
 *  - It writes EVERY channel, not just SMS. That is ALL_CHANNELS' documented
 *    meaning: an unqualified "stop" is read at its widest, because
 *    over-suppression costs FieldQuo a prospect it was told to drop anyway and
 *    under-suppression is the violation.
 *
 * ══ START does NOT lift it ═════════════════════════════════════════════════
 *
 * The tenant path (lib/sms/optOut.js) reverses a STOP on a START, correctly:
 * carriers expect that on a tenant's client-facing line. This path does not,
 * and the difference is deliberate. lib/sales/suppression.js has no
 * self-service removal by design — a removal is superadmin-only with a
 * mandatory reason, because the row is the evidence behind a three-year
 * internal do-not-call obligation. A text saying START must not be able to
 * quietly erase that. An unrecognised keyword is ignored the same way the
 * tenant route ignores it: this is not an inbox.
 *
 * ══ No confirmation text ═══════════════════════════════════════════════════
 *
 * The tenant route only sends its own STOP confirmation behind
 * SMS_OPT_OUT_SEND_CONFIRMATION, because Twilio's account-level Advanced
 * Opt-Out may already be replying and two confirmations is worse than none.
 * That reasoning applies here unchanged, and the suppression — the part that
 * actually stops messages — is written either way.
 *
 * @returns { handled, action } — handled:false means the number is not
 *          FieldQuo's sales number, which is the caller's cue to do nothing.
 */
export async function handleSalesInboundSms({ to, from, body }) {
  const number = normalisePhone(to);
  if (!number) return { handled: false, action: null };

  const row = await db.platformSmsNumber.findFirst({
    where: { e164: number, purpose: "sales", active: true },
    select: { id: true },
  });
  if (!row) return { handled: false, action: null };

  if (classifyInboundSms(body) !== "opt_out") {
    return { handled: true, action: "ignored" };
  }

  const outcome = await suppress(db, {
    kind: "phone",
    value: from,
    channels: ALL_CHANNELS,
    source: "sms",
    reason: String(body || "").slice(0, 1000),
  }).catch((err) => ({ ok: false, error: err?.message }));

  if (!outcome.ok) {
    // Loud. An opt-out we received and failed to record is the one failure on
    // this path that is a regulatory problem rather than an inconvenience —
    // the same judgement app/api/sms/inbound makes about its own write.
    await recordError({
      area: "sales_sms",
      code: "opt_out_not_recorded",
      message: `A STOP to FieldQuo's sales number was NOT recorded: ${outcome.error}`,
      detail: { to: number, from },
    }).catch(() => {});
    return { handled: true, action: "failed" };
  }

  return { handled: true, action: outcome.action };
}
