// lib/crew/messaging.js
//
// What a crew text costs, who pays for it, and what happens when nobody can.
//
// ══ The unit is a MESSAGE, and a photo is not a text ═══════════════════════
//
// The voice side bills talk time because that is what a call consumes. Texting
// consumes messages, and Twilio prices them unevenly: an inbound SMS segment is
// roughly $0.008, an inbound MMS roughly $0.01–0.02 once carrier fees are in,
// and a photo also costs us the Cloudinary storage it is re-hosted into. A flat
// per-message rate would charge a crew who send fifty photos a day the same as a
// crew who send fifty one-line updates, and lose money on exactly the customers
// who love the feature most — the same failure NUMBER_TYPES exists to prevent on
// the voice side.
//
// So: SMS and MMS are priced separately, and a long text costs per segment,
// because that is how the carrier charges us.
//
// ══ There is no model call in this feature ═════════════════════════════════
//
// Worth stating plainly, since it is called "the texting AI": attribution is
// deterministic code (lib/crew/attribution.js), not an LLM. No OpenAI tokens are
// spent, nothing goes through lib/ai/usage.js, and the cost here is entirely
// carrier. If a model is ever added to this path it must be metered through
// checkAiQuota/recordAiUsage as well, and this comment is the reminder.
//
// ══ Which way to fail, and why it isn't symmetric ══════════════════════════
//
// Refusing to RECEIVE and refusing to REPLY are different decisions:
//
//   * By the time this webhook fires, Twilio has already accepted the message
//     and already charged us. Dropping it saves nothing at all — it only
//     destroys the crew member's site photo, which is unrecoverable work
//     product. Nobody's wall stays half-painted waiting for a top-up.
//   * The REPLY has not been sent yet. It is the one cost still in our hands,
//     and it is the discretionary half — a "Filed to Sam Rivera 👍" is a
//     courtesy, and the filing already happened without it.
//
// So: receive and file ALWAYS, meter it honestly even when that takes the
// balance negative, and withhold the reply. The office inbox still shows every
// message, so nothing is hidden — the contractor sees the work and sees the
// warning.
//
// ══ But an overdraft has to have a floor ═══════════════════════════════════
//
// "Always receive" without a limit is FieldQuo paying a carrier indefinitely for
// a company that has stopped paying us. The voice side solves this at the
// PROVIDER — syncNumberAttachment detaches the agent so an unfunded number rings
// out, because hiding a control in the UI is not a spend limit. The same rule
// applies here, and the equivalent lever is the number's messaging webhook: past
// the overdraft floor the line is disconnected at Twilio, which stops both the
// delivery and the charge. It reconnects from the setup screen once there is
// credit, and the screen refuses to reconnect while there isn't.
import { db } from "@/lib/db";
import { balanceFor, debitCredit } from "@/lib/voice/credits";
import { twilioRest } from "@/lib/sms/twilioClient";

/**
 * Rates, in cents, per message.
 *
 * Read through a guard rather than trusted, for the same reason credits.js
 * guards VOICE_CENTS_PER_MINUTE: a typo in a Vercel value ("2c", an empty
 * string that survives `||`) makes the rate NaN, and a NaN rate does not fail
 * loudly — debitCredit's `Number.isFinite` check turns it into no charge at all,
 * so every crew text bills nothing while the screens keep quoting a price.
 * Silent under-charging is the failure this pattern exists to prevent.
 *
 * ── The numbers ────────────────────────────────────────────────────────────
 *
 * Carrier cost lands near 0.8¢ for an SMS segment and near 2¢ for an MMS with
 * its media. 2¢ and 5¢ hold roughly the same margin the voice rate does (35¢
 * against ~16¢), and in the terms a contractor thinks in: a crew member sending
 * twenty photos and a few notes on a busy day costs about $1.10. That is the
 * right order of magnitude against what the feature replaces, which is the owner
 * phoning three sites at the end of the day.
 *
 * The exact figures are a PRICING decision, not a technical one. They are
 * env-overridable so they can be changed without a deploy, and they are stated
 * on screen before anyone is charged.
 */
function rateFromEnv(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const CREW_SMS_CENTS = rateFromEnv(process.env.CREW_SMS_CENTS, 2);
export const CREW_MMS_CENTS = rateFromEnv(process.env.CREW_MMS_CENTS, 5);

/**
 * How far into the red a company may go before the line is cut at the provider.
 *
 * Deliberately not zero. A crew halfway through a job must not be cut off by a
 * three-cent shortfall — that is the moment the tool is doing its job — and $2
 * is roughly forty photos, which bounds FieldQuo's exposure per tenant to less
 * than one month's number rental. Past it, the tap closes at Twilio rather than
 * in a UI.
 */
export const CREW_OVERDRAFT_FLOOR_CENTS = rateFromEnv(process.env.CREW_OVERDRAFT_CENTS, 200);

/** Below this the setup screen nags — about twenty photos left. */
export const CREW_LOW_BALANCE_CENTS = CREW_MMS_CENTS * 20;

/**
 * Segments in an outbound body.
 *
 * GSM-7 fits 160 characters in one segment and 153 in each part of a
 * concatenated message; anything outside that alphabet drops to UCS-2 at 70/67.
 * Our replies contain an emoji ("Filed to … 👍") often enough that assuming
 * GSM-7 would under-count, so a non-ASCII body is measured on the UCS-2 sizes.
 */
export function segmentsFor(text) {
  const body = String(text || "");
  if (!body.length) return 0;
  // Anything outside ASCII forces UCS-2. An approximation of GSM-7 rather than
  // the exact alphabet, and deliberately the pessimistic direction: over-count a
  // segment and we charge a cent too much once, under-count and every emoji
  // reply is billed short forever.
  const unicode = /[^\u0000-\u007F]/.test(body);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  if (body.length <= single) return 1;
  return Math.ceil(body.length / multi);
}

/**
 * What one message costs.
 *
 * Media dominates: an MMS is billed once for the message however many segments
 * of text ride along with it, which is how the carrier charges and therefore how
 * we do. A text-only message is billed per segment.
 *
 * Non-finite or absurd input is a refusal, not a big number — same rule as
 * costForSeconds. A `NumSegments` of "1e400" parses to Infinity, and Infinity
 * cents is a charge of unbounded size on a prepaid balance.
 */
export function costForMessage({ hasMedia = false, segments = 1 } = {}) {
  if (hasMedia) return CREW_MMS_CENTS;
  const raw = Number(segments);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  // Ten segments is already a 1,500-character text. Beyond that the payload is
  // lying and the cap stops a forged NumSegments inventing a charge.
  const n = Math.min(10, Math.ceil(raw));
  return n * CREW_SMS_CENTS;
}

/**
 * May this company still receive, and may we still reply?
 *
 * Pure, so the asymmetry above is executable rather than described. Note that
 * `canReceive` is about whether the LINE STAYS CONNECTED, not about the message
 * in hand — that one is already paid for and is always filed.
 */
export function crewSpendVerdict({ balanceCents = 0, replyCents = CREW_SMS_CENTS } = {}) {
  const balance = Number.isFinite(Number(balanceCents)) ? Math.round(Number(balanceCents)) : 0;
  return {
    balanceCents: balance,
    // A reply is only sent when it is actually covered. Sending one that takes
    // the balance further under is spending money to say "thanks".
    canReply: balance >= replyCents,
    // The line stays up while the overdraft is inside the floor.
    canReceive: balance > -CREW_OVERDRAFT_FLOOR_CENTS,
    low: balance < CREW_LOW_BALANCE_CENTS,
    replyCents,
  };
}

/**
 * Charge for one INBOUND crew message.
 *
 * Idempotent on the stored message's own id, which is generated once per
 * delivery — so Twilio re-delivering the same webhook after a timeout charges
 * once. This is a charge for something that has definitely happened: the message
 * is in our database because the carrier handed it to us.
 */
export async function chargeInboundCrewMessage({ companyId, messageId, hasMedia, segments }) {
  const cents = costForMessage({ hasMedia, segments });
  if (!companyId || !messageId || cents <= 0) return null;
  return debitCredit({
    companyId,
    cents,
    kind: "crew_text",
    ref: `crew_in:${messageId}`,
    // The rate is recorded, not just the total — "1 photo" can't be checked
    // against a price that may have changed since.
    note: hasMedia ? `Crew photo received @ ${CREW_MMS_CENTS}¢` : `Crew text received @ ${CREW_SMS_CENTS}¢`,
  });
}

/**
 * Charge for one OUTBOUND reply.
 *
 * ══ Keyed on the provider's own SID, and only ever called after a send ═════
 *
 * This is why replies go out through the REST API rather than as a TwiML
 * `<Message>` in the webhook response. TwiML is cheaper to write and costs the
 * same to send — but it returns no message SID and no delivery result, so there
 * is nothing to key idempotency on and no evidence the message left. Billing on
 * "we put it in the response body" is billing on a delivery we cannot verify,
 * which is the one thing the voice ledger refuses to do.
 */
export async function chargeOutboundCrewReply({ companyId, sid, body }) {
  const cents = costForMessage({ hasMedia: false, segments: segmentsFor(body) });
  if (!companyId || !sid || cents <= 0) return null;
  return debitCredit({
    companyId,
    cents,
    kind: "crew_text",
    ref: `crew_out:${sid}`,
    note: `Crew reply sent @ ${CREW_SMS_CENTS}¢`,
  });
}

/** The verdict for a company, read from the shared ledger. */
export async function crewSpendFor(companyId, replyBody) {
  const balanceCents = await balanceFor(companyId);
  return crewSpendVerdict({
    balanceCents,
    replyCents: costForMessage({ segments: segmentsFor(replyBody) }) || CREW_SMS_CENTS,
  });
}

/**
 * Past the overdraft floor: stop the delivery at Twilio.
 *
 * The crew-inbox equivalent of detaching the agent from a number. The row is
 * KEPT — the company still owns its line, and the setup screen shows it as
 * disconnected with the reason — so topping up and pressing reconnect brings it
 * back rather than making them claim a number again.
 *
 * Best-effort at the provider, but the local state is written either way: a
 * Twilio we cannot reach must not leave us believing the tap is closed when it
 * isn't, so the row records what we intended and the screen re-checks Twilio for
 * what is actually true.
 */
export async function disconnectForNonPayment({ companyId, line }) {
  if (!line?.id) return false;
  if (line.providerId) {
    await twilioRest
      .incomingPhoneNumbers(line.providerId)
      .update({ smsUrl: "", smsMethod: "POST" })
      .catch(() => {});
  }
  await db.crewInboxNumber.update({
    where: { id: line.id },
    data: { webhookUrl: null, connectedAt: null },
  });
  await db.company.update({ where: { id: companyId }, data: { crewInboxEnabled: false } });
  return true;
}
