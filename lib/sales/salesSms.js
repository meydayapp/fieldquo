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

import { resolveLeadTimeZone } from "@/lib/sales/leadTimeZone";
import { db } from "@/lib/db";
import { sendSms, twilioConfigured } from "@/lib/sms/twilioClient";
import { classifyInboundSms } from "@/lib/sms/optOutKeywords";
import { recordError } from "@/lib/platform/errorLog";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { signupLinkFor } from "./repStats";
import { ensureReferralToken } from "./repLink";
import { repPublicName } from "./repIdentity";
import { ensureSignupProgress, markLinkSent } from "./signupProgress";
import { salesSmsReadiness, signupGreeting } from "./salesSmsRules";
import { windowPolicyForProspect } from "./windowOverrides";
import { isSalesSmsTimeZone } from "./smsWindow";
import { checkSuppression, sourceProviderForContact, suppress } from "./suppression";
import { ALL_CHANNELS, normalisePhone } from "./suppressionRules";
import { replySmsBody } from "./salesSmsRules";
import { triageStoredReply } from "./replyTriage";
import { threadTriage } from "./messages/triage";
import { BUSINESS_LEAD_SELECT, businessKeyOf, mergeThreadsByBusiness } from "./messages/business";
import { outboundKind } from "./messages/messageKind";
import { resolveInboundSmsAttribution, smsVisibleRepIds, SMS_MATCHED_BY_REPLY_CLAIM } from "./smsAttribution";

/**
 * Whether a call back to the sales line reaches a person: the transfer
 * target FIELDQUO_SALES_TRANSFER_TO is a +E.164 (lib/sales/calls/transfer.js
 * is what actually puts a caller through to it). Read at send time so the
 * signup text's closing sentence — "reply to this text" or "reply or call
 * this number" — is true for THIS deployment on THIS day, never a promise
 * baked in before the number was set. Nothing but a phone number counts:
 * a value that would not dial is a value that would strand a caller.
 */
export function salesCallbackReachable(env = process.env) {
  return /^\+1\d{10}$/.test(normalisePhone(env.FIELDQUO_SALES_TRANSFER_TO) || "");
}

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
export async function salesSmsStatus({ rep, lead, origin, now = new Date(), linkToken = null, purpose = "reply" }) {
  const zone = resolveLeadTimeZone(lead);
  const [fromNumber, suppression, windowPolicy, linkCode] = await Promise.all([
    salesSmsNumber().catch(() => null),
    suppressionFor(lead),
    // The console's override for the lead's state — the lead's own pair
    // first, the linked prospect's second, the same precedence the time
    // zone above and leadCallingContext() use. Read fresh here, which is
    // the last read before a text leaves, for the reason the suppression
    // list is.
    windowPolicyForProspect(
      {
        country: lead?.country || lead?.prospect?.country || null,
        province: lead?.province || lead?.prospect?.province || null,
      },
      { now },
    ),
    // The opaque token, minted on first use — never the legacy name slug
    // (lib/sales/repLink.js). A rep with no id gets null, and readiness
    // refuses a text with no link rather than sending a bare one.
    // A read that fails reads as "no link" — the no_signup_link blocker —
    // like every other read above, never as a crashed send.
    ensureReferralToken(rep).catch((err) => {
      console.error("[sales sms] couldn't read the rep's link token:", err?.message);
      return null;
    }),
  ]);

  return salesSmsReadiness({
    // The name the contractor reads — the rep's work name, or their first
    // name (lib/sales/repIdentity.js). Never rep.name, the real full name.
    repName: repPublicName(rep),
    // Never rebuilt here. One place knows the shape of a rep's link, and a
    // second copy of `/signup?sales=` is how a rep's texted link and their
    // portal link drift into two different URLs — one of which is not
    // attributed to them.
    // The per-text token rides on the link only when the send path has
    // minted one (deliverSignupLinkSms); the preview shows the bare link.
    signupLink: signupLinkFor(origin, linkCode, { linkToken }),
    fromNumber,
    mailingAddress: salesMailingAddress(),
    twilioConfigured: twilioConfigured(),
    leadPhone: lead?.phone,
    // Stated by a rep, else derived from the province the way the call path
    // does — lib/sales/leadTimeZone.js says why one rule and not two.
    leadTimeZone: zone.timeZone,
    leadTimeZoneSource: zone.source,
    leadTimeZoneCandidates: zone.candidates,
    suppression,
    now,
    windowPolicy,
    // "signup_link" is the solicited one-to-one text with no address in it;
    // everything else keeps the address blocker. salesSmsRules.js says why.
    purpose,
    greetTo: signupGreeting({ contactName: lead?.contactName, businessName: lead?.businessName }),
    callbackReachable: salesCallbackReachable(),
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
  // The progress row for THIS text — lib/sales/signupProgress.js — minted
  // before the body is built so its token is on the link that goes out. An
  // open row for the same lead is reused, so a re-sent text keeps the same
  // token and the rep's panel keeps the same stepper. Null when the table
  // is absent: the text still goes, the panel just has nothing to draw.
  const progress = await ensureSignupProgress({ client: db, leadId: lead?.id, salesRepId: rep?.id, now }).catch((err) => {
    console.error("[sales/sms] signup progress row failed; texting without a token:", err?.message || err);
    return null;
  });
  const status = await salesSmsStatus({ rep, lead, origin, now, linkToken: progress?.token || null, purpose: "signup_link" });

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
    purpose: "sales_signup_link",
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
      // Explicit, not left to the column default. The default exists so an
      // older row reads correctly; a write that relies on it is one schema
      // edit away from filing sent messages as received.
      direction: "out",
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

  // "Link sent", once, now that the carrier has accepted it. Never before:
  // a stepper's first step must not read as done for a text that never left.
  if (progress?.id) {
    await markLinkSent({ client: db, id: progress.id, now }).catch((err) => {
      console.error("[sales/sms] linkSentAt stamp failed:", err?.message || err);
    });
  }

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
 * ══ Then, after the webhook has answered: what kind of reply is it ═════════
 *
 * lib/sales/replyTriage.js classifies the stored row — roadblock, question,
 * positive, not interested, fine — so a contractor who hit a wall is not a
 * grey line in a list. It runs through `schedule`, which the webhook route
 * hands next/server's after(): Twilio gets its empty 200 first, the model
 * is asked second, and a slow vendor cannot make Twilio retry the webhook
 * and file the text twice. The default runs it in the background of the
 * same process, for a caller with no response to hurry. It never throws and
 * never touches the suppression above; a STOP is labelled "stop" by the
 * same keyword list and the do-not-contact row is written here regardless.
 *
 * @returns { handled, action, messageId } — handled:false means the number
 *          is not FieldQuo's sales number, which is the caller's cue to do
 *          nothing. messageId is the stored reply's row, or null when the
 *          store failed.
 */
export async function handleSalesInboundSms({
  to,
  from,
  body,
  schedule = (run) => {
    void Promise.resolve().then(run).catch(() => {});
  },
}) {
  const number = normalisePhone(to);
  if (!number) return { handled: false, action: null };

  const row = await db.platformSmsNumber.findFirst({
    where: { e164: number, purpose: "sales", active: true },
    select: { id: true },
  });
  if (!row) return { handled: false, action: null };

  // ── STORE IT FIRST, whatever it says ───────────────────────────────────
  //
  // This function used to check for a STOP keyword and, finding none, return
  // `action: "ignored"` — and "ignored" meant it: the message was not written
  // anywhere. A contractor answering "sure, call me Thursday" was scanned for
  // opt-out words and dropped on the floor. Nothing recorded it, no screen
  // could show it, and the rep who sent the text never learned there was an
  // answer.
  //
  // Written BEFORE the opt-out branch, and outside its success path, because
  // the evidence of what somebody sent us is worth keeping whether or not the
  // suppression that follows succeeds — and a STOP we recorded as a
  // suppression but not as a message is a regulatory record with no original.
  //
  // Matched to a rep and a lead where the phone says so, and left null where
  // it does not. Inventing a lead to hang a message on would put a business in
  // a rep's pipeline because somebody dialled a wrong number.
  //
  // ══ Whose is it — lib/sales/smsAttribution.js decides ═════════════════
  //
  // Four rungs: the number itself (the last text we sent it, a lead or a
  // prospect carrying it, a stored contact number); the LINE it arrived on
  // (the rep who last called or texted from it, and the business they rang
  // when the body names it); the line's assigned rep; nobody. That file's
  // header has the Advance Appliance text that made the second rung
  // necessary. The rule that fired is stored on the row as `matchedBy`.
  //
  // When every rung fails the row is stored with NO rep. It is then
  // NOBODY'S — it goes to the superadmin's /platform/sales/conversations
  // with an Assign control, and appears in no rep's list. It used to be
  // listed to every rep who could text, which is how a text for Favor sat in
  // Daniel's "Needs a reply". Never dropped either way: a text that reached
  // us is on record whether or not anybody can yet say whose it is.
  const fromE164 = normalisePhone(from);
  const now = new Date();
  const filed = await resolveInboundSmsAttribution({ client: db, fromE164, toE164: number, body, now }).catch((err) => {
    console.error("[sales sms] inbound attribution failed; storing unfiled:", err?.message);
    return { salesRepId: null, leadId: null, prospectId: null, matchedBy: null };
  });
  const ownerRepId = filed.salesRepId || null;
  let matchedLead = null;
  if (ownerRepId) {
    try {
      if (filed.prospectId && db.prospect) {
        matchedLead = await db.prospect.findUnique({ where: { id: filed.prospectId }, select: { businessName: true } });
      } else if (filed.leadId) {
        matchedLead = await db.salesLead.findUnique({ where: { id: filed.leadId }, select: { businessName: true, contactName: true } });
      }
    } catch {
      matchedLead = null;
    }
  }
  let storedId = null;
  await db.salesSmsMessage
    .create({
      data: {
        direction: "in",
        salesRepId: ownerRepId,
        leadId: filed.leadId || null,
        prospectId: filed.prospectId || null,
        matchedBy: ownerRepId ? filed.matchedBy || null : null,
        fromE164: fromE164 || String(from || "").slice(0, 20),
        toE164: number,
        body: String(body ?? "").slice(0, 2000),
      },
      select: { id: true },
    })
    .then((stored) => {
      storedId = stored?.id || null;
      // The push copy, to the ONE rep the reply belongs to — the same
      // ownership the row above records, so a rep is never told about a
      // conversation the screen would not show them. Fire-and-forget
      // (lib/notify/push.js); the record is the create above. The body is
      // the first line, cut short: a lock screen is a public place.
      if (ownerRepId && classifyInboundSms(body) !== "opt_out") {
        const who = matchedLead?.businessName || matchedLead?.contactName || fromE164 || String(from || "");
        void pushToReps({
          salesRepIds: [ownerRepId],
          payload: async (language) => ({
            title: await appSentence(language, "app.notify.newText.title", { from: who }),
            body: String(body ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
            tag: `sales-sms:${fromE164 || "unknown"}`,
            url: fromE164 ? `/sales/messages?with=${encodeURIComponent(fromE164)}` : "/sales/messages",
          }),
        });
      }
    })
    .catch(async (err) => {
      // Loud but not fatal: a reply we could not file is worth an error row,
      // and it must not stop the opt-out below from being honoured.
      await recordError({
        area: "sales_sms",
        code: "inbound_not_stored",
        message: `A reply to FieldQuo's sales number was not stored: ${err?.message || err}`,
        detail: { to: number, from: fromE164 },
      }).catch(() => {});
    });

  // ── Then onto the lead it is about ─────────────────────────────────────
  //
  // A row filed to a rep and a business but to no lead — the line rung's
  // answer for a prospect the rep rang and never carried across (Advance
  // Appliance, 2026-09-18) — is attached to the rep's lead for that
  // business, made from the prospect when none exists, with the sender's
  // number recorded on it: lib/sales/messages/attachThread.js says what
  // that buys (a named header, a derived clock, a reply that can go).
  // Imported here rather than at the top because that module reaches
  // leadForThread in checkin/store.js, which imports deliverReplySms from
  // this file. Fails soft: the row above is the record; this is filing.
  if (storedId && ownerRepId && !filed.leadId && fromE164) {
    try {
      const { attachThreadToLead } = await import("./messages/attachThread");
      await attachThreadToLead({ salesRepId: ownerRepId, e164: fromE164, client: db });
    } catch (err) {
      console.error("[sales sms] inbound row not attached to a lead:", err?.message);
    }
  }

  // Every stored reply, STOP included — "stop" is a label the list shows,
  // decided by the same keyword list as the suppression below and never by
  // the model. Only the row id crosses; the classifier re-reads the rest.
  if (storedId) {
    const messageId = storedId;
    try {
      schedule(() => triageStoredReply({ messageId }));
    } catch (err) {
      console.error("[sales sms] triage could not be scheduled:", err?.message);
    }
  }

  if (classifyInboundSms(body) !== "opt_out") {
    // Still "handled" — it reached us and it is now on record. The action name
    // says what was done ABOUT it, which for an ordinary reply is nothing.
    return { handled: true, action: "stored", messageId: storedId };
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
    return { handled: true, action: "failed", messageId: storedId };
  }

  return { handled: true, action: outcome.action, messageId: storedId };
}


// ═══════════════════════════════════════════════════════════════════════════
// The conversation, from the rep's side
// ═══════════════════════════════════════════════════════════════════════════
//
// A rep could text a prospect one templated signup link and had nowhere to see
// what came back — and until inbound was stored, nothing came back at all. Now
// both directions are on record, these are the two reads and the one write a
// conversation needs.
//
// ══ Scoped to the rep, and to nothing wider ═══════════════════════════════
//
// A rep sees a conversation they are part of: a message they sent, or a reply
// filed to them. NOT every message on FieldQuo's number — two reps working
// different territories off one shared line must not read each other's
// prospects, and "it is all our own number anyway" is the argument that turns
// a shared line into a shared inbox.

/**
 * Who this rep is in a conversation with, newest first.
 *
 * Grouped by the OTHER party's number rather than by lead, because a
 * conversation is with a person: one contractor may hold two lead rows, and a
 * reply belongs to the same thread either way.
 */
/**
 * @param readStates  `Map<e164, { readAt, doneAt }>` from
 *   lib/sales/messages/readState.js, or null when the table could not be
 *   read. Null makes every `unread` null too — "we could not count" is a
 *   different claim from "nothing is unread", and the list badge must not
 *   quietly show the reassuring one. AGENTS.md failure class #5.
 */
export async function salesConversations({ salesRepId, client = db, limit = 50, readStates = null } = {}) {
  const visible = await smsVisibleRepIds(salesRepId, client);
  const rows = await client.salesSmsMessage.findMany({
    // The rep's own rows — and, for an agency account, its employees'
    // (smsVisibleRepIds). NOT the floor's unowned rows: until 2026-09-18 an
    // inbound text nobody could file was listed to every rep who could
    // text, "until one of them answers and the reply claims it", and what
    // that produced was a text for Favor in Daniel's "Needs a reply". A row
    // nobody owns is the superadmin's to assign (lib/sales/smsAttribution.js
    // rung (d)); it is not everybody's.
    where: { salesRepId: { in: visible } },
    orderBy: { sentAt: "desc" },
    take: 500,
    select: {
      id: true, direction: true, fromE164: true, toE164: true,
      body: true, sentAt: true, leadId: true, salesRepId: true,
      // The NAME, so a conversation list can say "Loop INC" rather than
      // "+18192387263". The thread screen already resolves one and the list
      // did not, which is most of why the list did not read as a messaging
      // app: a phone number is an address, not a person.
      // And the business's IDENTITY — company, prospect — so two numbers of
      // one contractor fold into one conversation (messages/business.js).
      lead: { select: BUSINESS_LEAD_SELECT },
      // The prospect a text was filed to when no lead carries the business
      // (SalesSmsMessage.prospectId) — so the row can be named.
      prospectId: true,
      prospect: { select: { id: true, businessName: true } },
      // What kind of reply the latest inbound was — the chip. Read on every
      // row and decided per thread below by lib/sales/messages/triage.js.
      triage: true, triageReason: true, triagedAt: true, triageOverriddenById: true,
    },
  });

  const threads = new Map();
  for (const m of rows) {
    // The other party is the one that is not ours: on an outbound row that is
    // `to`, on an inbound row it is `from`.
    const other = m.direction === "in" ? m.fromE164 : m.toE164;
    if (!other) continue;
    if (!threads.has(other)) {
      threads.set(other, {
        e164: other,
        lastAt: m.sentAt,
        lastBody: m.body,
        lastDirection: m.direction,
        leadId: m.leadId || null,
        // Null when no lead is attached, and null is left as null — the screen
        // then shows the number, which is the only true thing we know about
        // them. Inventing a placeholder name would be worse than an address.
        name: m.lead?.businessName || m.lead?.contactName || m.prospect?.businessName || null,
        businessKey: businessKeyOf(m.lead) || (m.prospect?.id ? `prospect:${m.prospect.id}` : null),
        count: 0,
        unanswered: false,
        // True until a row of THIS rep's is seen on the number: a thread made
        // only of unowned inbound rows is the floor's, not theirs yet.
        unowned: true,
        // The instant they last wrote, which is what decides whether a
        // conversation the rep filed as done has come back to life.
        lastInboundAt: null,
        // Inbound rows after the rep last looked. Null until counted.
        unread: readStates ? 0 : null,
        readState: readStates ? readStates.get(other) || null : null,
        // The latest inbound row's kind: `{ kind, reason, overridden, open }`
        // or null when they have never written. Null kind = not classified,
        // which the screen draws as no chip — never as "fine".
        triage: null,
      });
    }
    const t = threads.get(other);
    t.count += 1;
    if (visible.includes(m.salesRepId)) t.unowned = false;
    if (m.direction === "in") {
      // Rows arrive newest first, so the first inbound seen is the latest.
      if (!t.lastInboundAt) {
        t.lastInboundAt = m.sentAt;
        const verdict = threadTriage([m]);
        t.triage = verdict
          ? { kind: verdict.kind, reason: verdict.reason, overridden: verdict.overridden, at: verdict.at, open: t.lastDirection === "in" }
          : null;
      }
      if (readStates) {
        const readAt = t.readState?.readAt ? new Date(t.readState.readAt).getTime() : null;
        if (readAt === null || new Date(m.sentAt).getTime() > readAt) t.unread += 1;
      }
    }
    if (!t.leadId && m.leadId) t.leadId = m.leadId;
    if (!t.businessKey && m.lead) t.businessKey = businessKeyOf(m.lead);
    // A later row may carry the lead the newest one lacked — an inbound reply
    // often has no leadId while the outbound that started it does.
    if (!t.name && (m.lead?.businessName || m.lead?.contactName || m.prospect?.businessName)) {
      t.name = m.lead?.businessName || m.lead?.contactName || m.prospect?.businessName;
    }
    if (!t.businessKey && m.prospect?.id) t.businessKey = `prospect:${m.prospect.id}`;
  }

  // "They wrote last" is the only status worth carrying into a list: it is the
  // one that means somebody is waiting on this rep.
  for (const t of threads.values()) t.unanswered = t.lastDirection === "in";

  // One conversation per business — the shop line, the owner's cell and the
  // number a rep was given on a call fold into one row with the numbers
  // listed inside it. messages/business.js says what "the same business" is.
  return mergeThreadsByBusiness([...threads.values()]).slice(0, limit);
}

/**
 * One conversation, oldest first, so it reads like a conversation.
 *
 * @param numbers  every number of the business (businessResolve.js
 *   resolveBusiness), so the thread is the CONVERSATION with the contractor
 *   and not with one of their phones. Defaults to `withE164` alone — the
 *   reply route asks about one number on purpose, because "have you texted
 *   THIS number before" is the first-contact rule it enforces.
 *
 * Each outbound row carries its `kind` (messages/messageKind.js) — the chip
 * that says which was the link, which the day-1 check-in and which a reply
 * the rep typed — read off the check-in draft the row was sent from.
 */
export async function salesThread({ salesRepId, withE164, numbers = null, client = db } = {}) {
  const set = [...new Set([withE164, ...(numbers || [])].map((n) => normalisePhone(n)).filter(Boolean))];
  if (!set.length) return [];
  const visible = await smsVisibleRepIds(salesRepId, client);
  const rows = await client.salesSmsMessage.findMany({
    where: {
      // The rep's rows on these numbers (an agency's team's too). Not the
      // floor's unowned rows — see salesConversations: nobody's is not
      // everybody's.
      salesRepId: { in: visible },
      OR: [{ toE164: { in: set } }, { fromE164: { in: set } }],
    },
    orderBy: { sentAt: "asc" },
    select: {
      id: true, direction: true, body: true, sentAt: true, fromE164: true, toE164: true,
      // The chip in the thread header is drawn from these, by the same pure
      // function the list uses (threadTriage), so the two cannot disagree.
      triage: true, triageReason: true, triagedAt: true, triageOverriddenById: true,
      // The draft this row was sent from, when it was — its key says which
      // touchpoint. Absent on a typed reply and on the signup link.
      checkIn: { select: { id: true, dedupeKey: true, origin: true, reasonCode: true } },
    },
  });
  return rows.map((m) => {
    const kind = outboundKind(m);
    const { checkIn, ...rest } = m;
    return {
      ...rest,
      checkInId: checkIn?.id || null,
      kind: kind?.kind || null,
      kindLabelKey: kind?.labelKey || null,
      kindParams: kind?.params || null,
    };
  });
}

/**
 * Send a rep's own words to somebody already in a conversation.
 *
 * ══ Every gate the signup-link send passes, and one more ══════════════════
 *
 * salesSmsStatus is reused whole rather than re-derived: the suppression list
 * read fresh at the moment of the send, the +1 restriction, the texting
 * window in the PROSPECT's zone, the mailing address, whether FieldQuo holds a
 * number at all. A second copy of those rules is how a reply goes out at two
 * in the morning to somebody who said STOP.
 *
 * What the ROUTE adds (app/api/sales/messages POST, not this function): the
 * number must be on a lead the rep holds, or already in a conversation with
 * them. A free-text send to an arbitrary number would be a cold-contact path
 * with no lead and no record of where the number came from. A first text to
 * a lead's number is allowed since 2026-09-18 — "text me instead" — and
 * carries the same footer every reply does, which is the identification and
 * the unsubscribe the first contact needs.
 */
export async function deliverReplySms({
  rep,
  lead,
  text,
  origin,
  now = new Date(),
  client = db,
  // Injected so scripts/check-sales-reply-send.mjs can drive THIS function over
  // a stub returning sendSms()'s real `{ success, sid }` shape. The bug this
  // parameter exists to prevent was a contract disagreement between two call
  // sites of one function, and nothing could compare them while the dependency
  // was reached for directly.
  send = sendSms,
} = {}) {
  const words = String(text ?? "").trim();
  if (!words) return { ok: false, status: 400, error: "There is nothing to send." };

  const status = await salesSmsStatus({ rep, lead, origin, now });
  if (!status.canSend) {
    const first = status.blockers[0];
    return {
      ok: false,
      status: first?.code === "suppressed" ? 409 : 409,
      error: first?.title || "This text cannot be sent.",
      suppressed: first?.code === "suppressed",
      blockers: status.blockers,
    };
  }

  let body;
  try {
    body = replySmsBody({ text: words, mailingAddress: process.env.SALES_MAILING_ADDRESS });
  } catch (err) {
    return { ok: false, status: 409, error: err?.message || "That message could not be composed." };
  }

  const result = await send({ to: status.to, from: status.from, body, purpose: "sales_reply" });
  // ── `success` and `sid`, NOT `ok` ──────────────────────────────────────
  //
  // sendSms() returns `{ success: true, sid }` or `{ success: false, error }`.
  // It has never returned `ok`. This read `!result?.ok`, which is true for
  // EVERY send, so the happy path was unreachable: Twilio delivered the text,
  // the rep was told "the provider refused it" with a 502, an error row was
  // filed, and no SalesSmsMessage was written — so the thread lost the message
  // and the rep, seeing a failure, sent it again. The contractor got it twice.
  //
  // deliverSignupLinkSms() forty lines above checks
  // `!result?.success || !result?.sid` and has always been right. Two call
  // sites of one function disagreeing about its return shape, with nothing
  // comparing them — which is why the check added alongside this drives BOTH
  // over a stub returning the real shape.
  //
  // `sid` is required as well as `success`: a success with no sid is a message
  // nothing can be looked up by afterwards, and the row's whole value is being
  // able to find it at the provider.
  if (!result?.success || !result?.sid) {
    await recordError({
      area: "sales_sms",
      code: "reply_not_sent",
      message: `A rep's reply was refused by the provider: ${result?.error || "no reason given"}`,
      detail: { to: status.to, from: status.from },
    }).catch(() => {});
    return { ok: false, status: 502, error: result?.error || "The provider refused it." };
  }

  // Written only after the provider accepted it — the same rule the signup
  // link follows, and the reason: a row saying "sent" for a text that never
  // left is the class of bug AGENTS.md opens with.
  const message = await client.salesSmsMessage.create({
    data: {
      direction: "out",
      salesRepId: rep.id,
      leadId: lead?.id || null,
      fromE164: status.from,
      toE164: status.to,
      body,
      providerId: result.sid || null,
    },
  });

  // ── The reply claims the floor's rows ──────────────────────────────────
  //
  // An inbound text from a number nobody had texted is stored with no rep
  // (handleSalesInboundSms) and listed to every rep who can text. The rep
  // who answers it owns the conversation from here: their reply is the
  // `lastOut` every later inbound row is filed against, and the earlier
  // unowned rows are attributed to them too, so the thread does not start
  // with a stranger's line that then vanishes from the other reps' lists
  // while staying unowned in theirs. Attribution only — no row is changed
  // in what it says, and a row already owned by somebody is left alone.
  // Fails soft: an unclaimed row is a lesser wrong than a reply reported as
  // unsent after the carrier accepted it.
  if (typeof client.salesSmsMessage.updateMany === "function") {
    await client.salesSmsMessage
      .updateMany({
        where: { direction: "in", salesRepId: null, fromE164: status.to },
        data: { salesRepId: rep.id, matchedBy: SMS_MATCHED_BY_REPLY_CLAIM, ...(lead?.id ? { leadId: lead.id } : {}) },
      })
      .catch((err) => console.error("[sales sms] unowned rows not claimed:", err?.message));
  }

  return { ok: true, messageId: message.id, to: status.to, body, sentAt: message.sentAt };
}
