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
 * ── The numbers, measured rather than remembered ───────────────────────────
 *
 * Twilio's published Canadian long-code pricing, checked 26/08/2026 at
 * https://www.twilio.com/en-us/sms/pricing/ca — USD, and the tenant base is
 * Canadian, so Canada is the country that decides whether these rates hold:
 *
 *   inbound  SMS   $0.0083 per SEGMENT   + carrier fee $0      = 0.83¢
 *   inbound  MMS   $0.0165 per message   + carrier fee $0      = 1.65¢
 *   outbound SMS   $0.0083 per segment   + carrier fee         = 1.47¢–1.70¢
 *
 * Canada's carrier-fee table is the part worth knowing: the fees are charged on
 * OUTBOUND only — the inbound columns are blank for every carrier — so the two
 * things a crew member does (send a text, send a photo) cost us the base rate
 * flat, while the courtesy reply we send back costs nearly twice its base once
 * Bell or Rogers take their cut. Against 2¢ and 5¢:
 *
 *   inbound  SMS segment   2¢ against 0.83¢   ≈ 59% margin
 *   inbound  MMS photo     5¢ against 1.65¢   ≈ 67% margin
 *   outbound SMS reply     2¢ against ~1.6¢   ≈ 15–26% margin
 *
 * The reply is the thin one, and deliberately the one withheld first when
 * credit runs out — see the asymmetry above. It was chosen for a product reason
 * and the margin arithmetic happens to agree.
 *
 * Not included: the number rental (US$1.15/month for a Canadian long code) and
 * the Cloudinary storage a re-hosted photo occupies. A company sending nothing
 * still costs the rental, so the floor is a monthly loss of about a dollar per
 * idle crew line — bounded, and the same shape as an idle voice number.
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
/**
 * How many characters a plain-ASCII text fits before the carrier splits it —
 * and therefore before it becomes two charges here.
 *
 * Exported because the SCREEN has to say it. "2¢ a text" is true of a short
 * text and false of a long one, and the contractor only found that out on the
 * statement; the rate line now reads "2¢ per 160 characters" and takes the
 * number from this constant rather than from a copywriter's memory.
 * check:crew-inbox asserts the two cannot drift apart.
 */
export const SMS_SEGMENT_CHARS = 160;

export function segmentsFor(text) {
  const body = String(text || "");
  if (!body.length) return 0;
  // Anything outside ASCII forces UCS-2. An approximation of GSM-7 rather than
  // the exact alphabet, and deliberately the pessimistic direction: over-count a
  // segment and we charge a cent too much once, under-count and every emoji
  // reply is billed short forever.
  const unicode = /[^\u0000-\u007F]/.test(body);
  const single = unicode ? 70 : SMS_SEGMENT_CHARS;
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
export async function chargeInboundCrewMessage({
  companyId,
  messageId,
  hasMedia,
  segments,
  from = null,
}) {
  const cents = costForMessage({ hasMedia, segments });
  if (!companyId || !messageId || cents <= 0) return null;
  return debitCredit({
    companyId,
    cents,
    kind: "crew_text",
    ref: `crew_in:${messageId}`,
    note: crewChargeNote({ direction: "in", hasMedia, segments, party: from }),
  });
}

/**
 * The line a contractor reads on their statement.
 *
 * ══ Why the arithmetic is spelled out ══════════════════════════════════════
 *
 * The old note said "Crew text received @ 2¢" against a row that had taken 6¢,
 * because a three-segment text is billed three times and the note only ever
 * printed the unit rate. A statement whose description contradicts its own
 * amount is worse than a bare one: it reads as an error, and an error a
 * contractor cannot resolve is the short road to a card dispute over $11 of
 * credit. So the note carries the multiplier that produced the number —
 * "3 × 2¢" — and the row's own amount can be checked against it by eye.
 *
 * ── And why the sender's number is on it ───────────────────────────────────
 *
 * Reconciling means matching a charge to a thing that happened. The crew inbox
 * lists messages by who sent them and when; the ledger listed 40 identical
 * lines. The last four digits are enough to pair the two without putting a full
 * mobile number on a billing statement that gets forwarded to bookkeepers.
 */
export function crewChargeNote({ direction, hasMedia = false, segments = 1, party = null }) {
  const tail = String(party || "").replace(/\D/g, "").slice(-4);
  const who = tail ? ` ·${tail}` : "";
  if (hasMedia) return `Crew photo received${who} — ${CREW_MMS_CENTS}¢`;
  const n = Math.min(10, Math.max(1, Math.ceil(Number(segments) || 1)));
  // A one-segment message says the plain price; only a split message needs the
  // multiplier explained, and putting "1 × 2¢" on every ordinary line is noise
  // that trains people to stop reading the column.
  const price = n > 1 ? `${n} × ${CREW_SMS_CENTS}¢` : `${CREW_SMS_CENTS}¢`;
  const verb = direction === "out" ? "Crew reply sent" : "Crew text received";
  return `${verb}${who} — ${price}`;
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
export async function chargeOutboundCrewReply({ companyId, sid, body, to = null }) {
  const segments = segmentsFor(body);
  const cents = costForMessage({ hasMedia: false, segments });
  if (!companyId || !sid || cents <= 0) return null;
  return debitCredit({
    companyId,
    cents,
    kind: "crew_text",
    ref: `crew_out:${sid}`,
    note: crewChargeNote({ direction: "out", segments, party: to }),
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
