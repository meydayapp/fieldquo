// lib/clients/autoMessages.js
//
// "No automatic emails or texts — send by hand only" (owner, 2026-10-13).
//
// A government buyer's tender rules say questions go through SAP Ariba and
// nowhere else; a homeowner may simply ask not to be chased. Either way the
// office still needs to send the invoice. So this is ONE switch on the client
// (Client.autoMessagesOffAt + autoMessagesOffReason) and ONE gate every
// automatic sender asks before it sends: autoMessageGate().
//
// ══ What counts as automatic ═══════════════════════════════════════════════
//
// Anything FieldQuo starts or composes without a person deciding to send THIS
// message to THIS client: a cron (follow-ups, reminders, review requests, the
// payment schedule, plan invoices, prep guides, receipt retries), a side
// effect of something else (the receipt that follows a recorded or card
// payment, the on-my-way text when a visit's status flips, the confirmation
// the office's new appointment emails), a bulk action over the client book
// (portal links, marketing campaigns), and anything a model writes (the AI
// employee's replies, the phone agent's automatic calls).
//
// What is NOT automatic, and is never asked here:
//
//   * a person pressing Send / Request payment / Send receipt / Email portal
//     link / Send for approval / Send waiver / a reply in the inbox, and the
//     "Tell the client" tick on a move or cancel (a person's per-change choice
//     with the address in front of them — the dialog starts it unticked for a
//     client with this switch on);
//   * a transactional confirmation of the CLIENT's own action: the signed copy
//     after they approve a quote, the confirmation of a booking they made, the
//     copy of a waiver they signed, their own reschedule or cancel, the login
//     link they asked for, the instant-estimate report they asked for, the
//     STOP confirmation, and the one-line "someone will reply shortly"
//     acknowledgement of a text they sent. Swallowing those would leave the
//     client unsure their own action worked, and none of them is FieldQuo
//     reaching out.
//
// scripts/check-auto-messages.mjs reads every file in app/ and lib/ that calls
// sendEmail/sendSms and fails unless it is either listed in
// AUTO_MESSAGE_SENDERS below and calls this gate, or classified there with the
// reason it is not automatic.
//
// ══ Do not contact stops these too (owner, 2026-10-14) ═════════════════════
//
// Client.doNotContactAt ("Do not contact", set from a call-back outcome —
// app/api/callbacks/entries/[id]/route.js) used to take the client off
// call-back lists, bridged calls and the bulk portal-link send, and nothing
// else: the follow-up, the reminder text and the automatic receipt still
// went. The owner's rule is that Do not contact stops everything automatic,
// so this gate now refuses for it exactly as it does for the switch, and
// records the skip with its own cause ("do_not_contact") so the client page
// can say which of the two held it back. Do not contact wins when both are
// set: it is the stronger statement, and turning the switch off must not
// read as if messages will resume while it stands.
//
// What Do not contact does NOT block here is a person pressing Send.
// Invoices may still be legally owed and a receipt may be asked for, so a
// by-hand send to a Do-not-contact client goes, with a warning beside the
// button (app/components/clients/AutoMessages.js AutoMessagesNotice). The
// bridged call and the bulk portal-link send keep refusing it as before —
// those were never this gate's. The two columns stay separate: the switch
// does not set Do not contact, and Do not contact is not written into the
// switch.
//
// ══ Recorded, honestly ═════════════════════════════════════════════════════
//
// Every refusal writes an AutoMessageSkip row — which sender, which record,
// which cause (the switch or Do not contact), the office's reason as it
// stood — upserted on (client, sender, record) so a cron that
// meets the same reminder every hour moves its date instead of piling rows up.
// The client page lists them under the switch. Each sender ALSO records the
// skip its own way where it already had one (FollowUpLog claim, the payment's
// receipt error, the AI draft's suppressedReason, the campaign's partial
// count) — the gate does not replace those, it adds the one list the office
// reads.
//
// ══ Fails closed ═══════════════════════════════════════════════════════════
//
// A gate that cannot read the client answers "not allowed" with
// `final: false` (try again later), never "allowed": a database blip is not a
// reason to email someone who asked not to be emailed. Senders that retry on
// their own (crons) simply meet the question again next run.

/**
 * Every automatic client-facing sender, by key. `file` is where it calls
 * autoMessageGate — the check reads that file for the call with this key.
 * `channel` is what the skip row says it would have been.
 */
export const AUTO_MESSAGE_SENDERS = Object.freeze({
  follow_up: { channel: "email", file: "app/api/cron/follow-ups/route.js" },
  review_request: { channel: "email", file: "app/api/cron/review-requests/route.js" },
  payment_receipt: { channel: "email", file: "lib/payments/sendReceipt.js" },
  payment_stage_request: { channel: "email", file: "lib/paymentSchedule/run.js" },
  service_plan_invoice: { channel: "email", file: "lib/servicePlans/run.js" },
  prep_guide: { channel: "email", file: "lib/prepGuide/send.js" },
  portal_link_bulk: { channel: "email", file: "lib/portal/bulkLinks.js" },
  marketing_campaign: { channel: "email", file: "app/api/marketing/campaigns/[id]/send/route.js" },
  appointment_confirmation: { channel: "email", file: "app/api/appointments/route.js" },
  appointment_reminder: { channel: "sms", file: "app/api/cron/appointment-reminders/route.js" },
  on_my_way: { channel: "sms", file: "app/api/jobs/[id]/visits/[visitId]/route.js" },
  ai_employee_reply: { channel: "message", file: "lib/aiEmployee/inbound.js" },
  voice_call: { channel: "call", file: "lib/voice/triggers.js" },
});

export const AUTO_MESSAGE_SENDER_KEYS = Object.freeze(Object.keys(AUTO_MESSAGE_SENDERS));

/** A real sender key — own property only, so "__proto__" or "toString" is not one. */
export function isAutoMessageSender(sender) {
  return typeof sender === "string" && Object.hasOwn(AUTO_MESSAGE_SENDERS, sender);
}

/** The longest reason kept. A sentence, not an essay. */
export const AUTO_MESSAGES_REASON_MAX = 300;

/** Is the switch on for this row? Pure; the page and the gate both ask it. */
export function autoMessagesOff(client) {
  return Boolean(client && client.autoMessagesOffAt);
}

/**
 * The two causes the gate refuses for, as the codes every sender passes on
 * (a payment's receiptLastError, a cron's tally, the skip row's `cause`).
 */
export const AUTO_MESSAGE_HOLD = Object.freeze({
  SWITCH: "auto_messages_off",
  DO_NOT_CONTACT: "do_not_contact",
});
const HOLD_CODES = new Set(Object.values(AUTO_MESSAGE_HOLD));

/** Was this refusal the client's own standing (either cause), not a db blip? */
export function isClientHold(reason) {
  return typeof reason === "string" && HOLD_CODES.has(reason);
}

/**
 * Why nothing automatic goes to this client, or null when it does. Pure — the
 * gate, the screens and the reports all ask this one function, so a page can
 * never promise a reminder the gate will refuse. Do not contact first: it is
 * the stronger statement, and its reason is the one the office must read.
 *
 * @returns {null | { reason: "do_not_contact"|"auto_messages_off", since: Date|string, note: string|null }}
 */
export function autoMessageHold(client) {
  if (!client || typeof client !== "object") return null;
  if (client.doNotContactAt) {
    return { reason: AUTO_MESSAGE_HOLD.DO_NOT_CONTACT, since: client.doNotContactAt, note: client.doNotContactReason || null };
  }
  if (client.autoMessagesOffAt) {
    return { reason: AUTO_MESSAGE_HOLD.SWITCH, since: client.autoMessagesOffAt, note: client.autoMessagesOffReason || null };
  }
  return null;
}

/**
 * What PATCH /api/clients/[id] writes for the switch, from what the form
 * sent. Pure.
 *
 *   autoMessagesOff: true   → on (keeps an existing date — turning it "on"
 *                             again is not a new decision)
 *   autoMessagesOff: false  → off, reason cleared
 *   anything else / absent  → the switch is not touched
 *
 * The reason is written only while on, trimmed and capped; "" clears it.
 *
 * @returns {object} Prisma `data` fragment, possibly empty
 */
export function autoMessagesUpdate(existing, body, now = new Date()) {
  const out = {};
  const want = body?.autoMessagesOff;
  const reasonGiven = typeof body?.autoMessagesOffReason === "string";
  const reason = reasonGiven ? body.autoMessagesOffReason.trim().slice(0, AUTO_MESSAGES_REASON_MAX) || null : undefined;
  if (want === true) {
    if (!existing?.autoMessagesOffAt) out.autoMessagesOffAt = now;
    if (reason !== undefined) out.autoMessagesOffReason = reason;
  } else if (want === false) {
    if (existing?.autoMessagesOffAt) out.autoMessagesOffAt = null;
    if (existing?.autoMessagesOffReason) out.autoMessagesOffReason = null;
  } else if (reason !== undefined && existing?.autoMessagesOffAt) {
    // The reason edited on its own, while the switch is already on.
    out.autoMessagesOffReason = reason;
  }
  return out;
}

function refKeyOf(ref) {
  if (!ref || typeof ref !== "object") return "";
  const type = String(ref.type || "").slice(0, 40);
  const id = String(ref.id || "").slice(0, 100);
  return type && id ? `${type}:${id}` : "";
}

/**
 * Write (or move the date on) one held-back message. Never throws: a skip
 * that could not be recorded must not turn into a send, and must not fail the
 * sender either. Returns true when the row was written.
 */
export async function recordAutoMessageSkip(db, { companyId, clientId, sender, cause = AUTO_MESSAGE_HOLD.SWITCH, ref = null, refLabel = null, reason = null, now = new Date() } = {}) {
  try {
    if (!db?.autoMessageSkip?.upsert || !companyId || !clientId || !isAutoMessageSender(sender)) return false;
    // A cause that is neither of the two is not recorded as either: the row
    // would send the office to the wrong switch.
    if (!isClientHold(cause)) return false;
    const refKey = refKeyOf(ref);
    const label = refLabel == null ? null : String(refLabel).slice(0, 200) || null;
    const why = reason == null ? null : String(reason).slice(0, AUTO_MESSAGES_REASON_MAX) || null;
    await db.autoMessageSkip.upsert({
      where: { clientId_sender_refKey: { clientId, sender, refKey } },
      create: {
        companyId,
        clientId,
        sender,
        channel: AUTO_MESSAGE_SENDERS[sender].channel,
        refKey,
        refLabel: label,
        cause,
        reason: why,
        firstSkippedAt: now,
        lastSkippedAt: now,
      },
      // The cause moves with the date: a reminder held by the switch on
      // Monday and by Do not contact on Tuesday now says Do not contact.
      update: { lastSkippedAt: now, cause, reason: why, ...(label ? { refLabel: label } : {}) },
    });
    return true;
  } catch (err) {
    console.error("[autoMessages] skip not recorded:", err?.message);
    return false;
  }
}

const GATE_SELECT = {
  id: true,
  companyId: true,
  autoMessagesOffAt: true,
  autoMessagesOffReason: true,
  doNotContactAt: true,
  doNotContactReason: true,
};

/**
 * May this automatic message go to this client? THE gate — every sender in
 * AUTO_MESSAGE_SENDERS calls it immediately before sending, and it reads the
 * client fresh every time (the switch can be turned on between a cron's
 * select and its send).
 *
 * @param companyId  the tenant sending — from the sender's own row, never a request
 * @param clientId   the client, when the sender knows it
 * @param email      for a sender that only has an address (a marketing
 *                   subscriber with no client link): any client of THIS
 *                   company with that address and the switch on, or marked
 *                   Do not contact, refuses it
 * @param sender     a key of AUTO_MESSAGE_SENDERS (a typo throws — a gate
 *                   that silently accepted an unknown sender would record
 *                   nothing and prove nothing)
 * @param ref        { type, id } of the record the message was about
 * @param refLabel   what that record is called on screen
 * @returns {Promise<{ allowed: true } | { allowed: false, reason: "do_not_contact"|"auto_messages_off"|"unreadable", final: boolean, clientId?: string, note?: string|null }>}
 */
export async function autoMessageGate(db, { companyId, clientId = null, email = null, sender, ref = null, refLabel = null, now = new Date() } = {}) {
  if (!isAutoMessageSender(sender)) throw new Error(`autoMessageGate: unknown sender "${String(sender)}"`);
  const address = typeof email === "string" ? email.trim() : "";
  // No client to honour: a lead, a subscriber who is nobody's client.
  if (!companyId || (!clientId && !address)) return { allowed: true };

  let client = null;
  try {
    if (clientId) {
      client = await db.client.findFirst({ where: { id: String(clientId), companyId }, select: GATE_SELECT });
    } else {
      // Do not contact asked first, then the switch: two clients sharing an
      // address answer with the stronger statement whichever row the
      // database would have met first.
      const byAddress = { companyId, email: { equals: address, mode: "insensitive" } };
      client =
        (await db.client.findFirst({ where: { ...byAddress, doNotContactAt: { not: null } }, select: GATE_SELECT })) ||
        (await db.client.findFirst({ where: { ...byAddress, autoMessagesOffAt: { not: null } }, select: GATE_SELECT }));
    }
  } catch (err) {
    console.error(`[autoMessages] ${sender}: client unreadable, holding the message back:`, err?.message);
    return { allowed: false, reason: "unreadable", final: false };
  }

  // Another company's id answers exactly like no client: nothing to honour,
  // and nothing about that company is read or written.
  if (!client || client.companyId !== companyId) return { allowed: true };
  const hold = autoMessageHold(client);
  if (!hold) return { allowed: true };

  await recordAutoMessageSkip(db, {
    companyId,
    clientId: client.id,
    sender,
    cause: hold.reason,
    ref,
    refLabel,
    reason: hold.note,
    now,
  });
  return { allowed: false, reason: hold.reason, final: true, clientId: client.id, note: hold.note };
}

/** The newest held-back rows for one client, for the client page. */
export async function loadAutoMessageSkips(db, { companyId, clientId, limit = 50 } = {}) {
  if (!companyId || !clientId) return [];
  const rows = await db.autoMessageSkip.findMany({
    where: { companyId, clientId },
    orderBy: { lastSkippedAt: "desc" },
    take: Math.max(1, Math.min(200, Number(limit) || 50)),
    select: { id: true, sender: true, channel: true, refKey: true, refLabel: true, cause: true, reason: true, firstSkippedAt: true, lastSkippedAt: true },
  });
  return rows;
}
