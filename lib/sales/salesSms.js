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
import { salesSmsReadiness } from "./salesSmsRules";
import { windowPolicyForProspect } from "./windowOverrides";
import { isSalesSmsTimeZone } from "./smsWindow";
import { checkSuppression, sourceProviderForContact, suppress } from "./suppression";
import { ALL_CHANNELS, normalisePhone } from "./suppressionRules";
import { replySmsBody } from "./salesSmsRules";

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
  const zone = resolveLeadTimeZone(lead);
  const [fromNumber, suppression, windowPolicy] = await Promise.all([
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
    // Stated by a rep, else derived from the province the way the call path
    // does — lib/sales/leadTimeZone.js says why one rule and not two.
    leadTimeZone: zone.timeZone,
    leadTimeZoneSource: zone.source,
    leadTimeZoneCandidates: zone.candidates,
    suppression,
    now,
    windowPolicy,
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
  const fromE164 = normalisePhone(from);
  const match = fromE164
    ? await db.salesLead
        .findFirst({
          // The rep who most recently texted this number owns the reply. Not
          // the lead's own salesRepId alone: two reps can hold leads for one
          // business, and the answer belongs to whoever asked the question.
          where: { phone: { not: null } },
          select: { id: true, salesRepId: true, phone: true },
          orderBy: { updatedAt: "desc" },
        })
        .catch(() => null)
    : null;
  const lead =
    match && normalisePhone(match.phone) === fromE164 ? match : null;
  const lastOut = fromE164
    ? await db.salesSmsMessage
        .findFirst({
          where: { toE164: fromE164, direction: "out" },
          orderBy: { sentAt: "desc" },
          select: { salesRepId: true, leadId: true, lead: { select: { businessName: true, contactName: true } } },
        })
        .catch(() => null)
    : null;

  const ownerRepId = lastOut?.salesRepId || lead?.salesRepId || null;
  await db.salesSmsMessage
    .create({
      data: {
        direction: "in",
        salesRepId: ownerRepId,
        leadId: lastOut?.leadId || lead?.id || null,
        fromE164: fromE164 || String(from || "").slice(0, 20),
        toE164: number,
        body: String(body ?? "").slice(0, 2000),
      },
    })
    .then(() => {
      // The push copy, to the ONE rep the reply belongs to — the same
      // ownership the row above records, so a rep is never told about a
      // conversation the screen would not show them. Fire-and-forget
      // (lib/notify/push.js); the record is the create above. The body is
      // the first line, cut short: a lock screen is a public place.
      if (ownerRepId && classifyInboundSms(body) !== "opt_out") {
        const who = lastOut?.lead?.businessName || lastOut?.lead?.contactName || fromE164 || String(from || "");
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

  if (classifyInboundSms(body) !== "opt_out") {
    // Still "handled" — it reached us and it is now on record. The action name
    // says what was done ABOUT it, which for an ordinary reply is nothing.
    return { handled: true, action: "stored" };
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
  const rows = await client.salesSmsMessage.findMany({
    where: { salesRepId },
    orderBy: { sentAt: "desc" },
    take: 500,
    select: {
      id: true, direction: true, fromE164: true, toE164: true,
      body: true, sentAt: true, leadId: true,
      // The NAME, so a conversation list can say "Loop INC" rather than
      // "+18192387263". The thread screen already resolves one and the list
      // did not, which is most of why the list did not read as a messaging
      // app: a phone number is an address, not a person.
      lead: { select: { businessName: true, contactName: true } },
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
        name: m.lead?.businessName || m.lead?.contactName || null,
        count: 0,
        unanswered: false,
        // The instant they last wrote, which is what decides whether a
        // conversation the rep filed as done has come back to life.
        lastInboundAt: null,
        // Inbound rows after the rep last looked. Null until counted.
        unread: readStates ? 0 : null,
        readState: readStates ? readStates.get(other) || null : null,
      });
    }
    const t = threads.get(other);
    t.count += 1;
    if (m.direction === "in") {
      // Rows arrive newest first, so the first inbound seen is the latest.
      if (!t.lastInboundAt) t.lastInboundAt = m.sentAt;
      if (readStates) {
        const readAt = t.readState?.readAt ? new Date(t.readState.readAt).getTime() : null;
        if (readAt === null || new Date(m.sentAt).getTime() > readAt) t.unread += 1;
      }
    }
    if (!t.leadId && m.leadId) t.leadId = m.leadId;
    // A later row may carry the lead the newest one lacked — an inbound reply
    // often has no leadId while the outbound that started it does.
    if (!t.name && (m.lead?.businessName || m.lead?.contactName)) {
      t.name = m.lead.businessName || m.lead.contactName;
    }
  }

  // "They wrote last" is the only status worth carrying into a list: it is the
  // one that means somebody is waiting on this rep.
  for (const t of threads.values()) t.unanswered = t.lastDirection === "in";

  return [...threads.values()].slice(0, limit);
}

/** One conversation, oldest first, so it reads like a conversation. */
export async function salesThread({ salesRepId, withE164, client = db } = {}) {
  const other = normalisePhone(withE164);
  if (!other) return [];
  return client.salesSmsMessage.findMany({
    where: {
      salesRepId,
      OR: [{ toE164: other }, { fromE164: other }],
    },
    orderBy: { sentAt: "asc" },
    select: { id: true, direction: true, body: true, sentAt: true, fromE164: true, toE164: true },
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
 * What it adds: the rep must already be IN this conversation. A free-text send
 * to an arbitrary number would be a cold-contact path with none of the
 * first-contact rules attached to it — no signup link, no lead, no record of
 * where the number came from.
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

  const result = await send({ to: status.to, from: status.from, body });
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

  return { ok: true, messageId: message.id, to: status.to, body, sentAt: message.sentAt };
}
