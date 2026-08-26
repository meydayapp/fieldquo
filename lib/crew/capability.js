// lib/crew/capability.js
//
// Can a text sent to this company's crew line actually ARRIVE?
//
// ══ Why this file had to exist ═════════════════════════════════════════════
//
// The crew inbox shipped as a switch over a webhook that nothing fed. The owner
// turned it on, texted his number all evening, and nothing ever came back —
// because nothing was ever going to.
//
// `/api/crew/inbound` is written for TWILIO: it validates `X-Twilio-Signature`
// and reads Twilio's `To`/`From`/`Body`/`NumMedia`/`MediaUrlN` form fields. But
// the number the settings screen offered was a VoicePhoneNumber, bought through
// RETELL (`buyNumber` → `/create-phone-number`). That number lives in Retell's
// telephony account; FieldQuo's own Twilio account has never heard of it, and
// nothing in this repo points a Twilio messaging webhook anywhere — no `smsUrl`,
// no `incomingPhoneNumbers` call, no messaging service. Two halves that could
// not touch, with a toggle across the gap.
//
// ── Retell is not a substitute, and it's worth writing down why ────────────
//
// Retell does have an inbound webhook that covers SMS, so "receive from Retell
// instead" looks like the cheap repair. It isn't:
//
//   * That webhook fires BEFORE the message exists and carries `from_number`,
//     `to_number` and `agent_id` only — no body, no MMS media. Its job is to
//     route or reject, not to deliver. The crew's photo is precisely the part
//     it does not send.
//   * Actual delivery goes to a Retell CHAT agent attached to the number, which
//     is a different integration from anything built here.
//   * Retell SMS is gated on A2P 10DLC: US numbers only, toll-free excluded,
//     two to three weeks of manual review, a per-number monthly fee. This
//     product defaults `country` to CA and ships Quebec area codes in its own
//     fixtures, so for a Canadian tenant the answer is not "slow", it's "no".
//
// And on a `forwarded` setup it is worse still: the number on the van belongs to
// the contractor's own carrier, and carrier forwarding forwards CALLS, never
// texts. A crew member texting the number they already know reaches nobody at
// all, whatever we do at our end.
//
// So the crew line is a separate number from a separate provider — see
// CrewInboxNumber — and this function is the one place that says whether the one
// a company holds can actually receive anything.
//
// ══ One verdict, three readers ═════════════════════════════════════════════
//
// The setup screen (what to render), the claim route (whether to promise
// anything) and the inbound webhook (whether to file) all call this. A screen
// and a gate computing the same answer from the same code cannot drift into the
// state that caused all this: a switch that saved happily and a webhook that
// could never fire.

/**
 * Providers whose inbound SMS reaches `/api/crew/inbound`.
 *
 * Only Twilio, because only Twilio's message webhook posts the body and the
 * media, and only Twilio's signature is what that route verifies. Adding a name
 * here without also giving that provider a verified path into the route would
 * re-create the original bug one layer down.
 */
export const SMS_CAPABLE_PROVIDERS = new Set(["twilio"]);

/**
 * @param {object|null} line   a CrewInboxNumber row, or null
 * @param {boolean} signatureConfigured  is TWILIO_AUTH_TOKEN set on this
 *        deployment? The inbound route refuses everything without it —
 *        unverified-because-unconfigured is how a staging slip becomes a public
 *        write endpoint — so a deployment missing it cannot run the feature.
 *        This is the sentence that would have saved the owner an afternoon.
 * @param {string} expectedWebhookUrl  where this deployment's inbound endpoint
 *        lives. Passed in rather than derived, because "the origin" differs
 *        between production and a preview build and the whole point of checking
 *        is to catch the case where they disagree.
 * @param {Date} now
 *
 * @returns {{ ready: boolean, reason: string, messageKey: string, message: string }}
 *          Same shape as the `readiness` the voice switches use, so the screen
 *          renders it the same way.
 */
export function crewInboxCapability({
  line = null,
  signatureConfigured = true,
  expectedWebhookUrl = null,
  now = new Date(),
} = {}) {
  // Checked before anything about the line, because it is true of the whole
  // deployment and no amount of clicking on the setup screen can fix it. Naming
  // the env var is deliberate: the person who reads this message is the person
  // who can set it.
  if (!signatureConfigured) {
    return {
      ready: false,
      reason: "not_configured",
      messageKey: "app.crewSetup.ready.notConfigured",
      message:
        "This deployment can't verify incoming texts yet — TWILIO_AUTH_TOKEN isn't set. " +
        "Until it is, every text sent to the crew line is refused at the door.",
    };
  }

  if (!line) {
    return {
      ready: false,
      reason: "no_line",
      messageKey: "app.crewSetup.ready.noLine",
      message: "Your crew don't have a number to text yet.",
    };
  }

  if (!SMS_CAPABLE_PROVIDERS.has(line.provider || "")) {
    return {
      ready: false,
      reason: "provider_no_sms",
      messageKey: "app.crewSetup.ready.voiceOnly",
      message:
        "That line can answer calls but can't receive texts. The crew inbox needs a texting number.",
    };
  }

  if (line.expiresAt && new Date(line.expiresAt).getTime() <= now.getTime()) {
    return {
      ready: false,
      reason: "expired",
      messageKey: "app.crewSetup.ready.expired",
      message: "Your loan of the shared test line has ended. Claim it again to keep testing.",
    };
  }

  if (!line.connectedAt || !line.webhookUrl) {
    return {
      ready: false,
      reason: "not_connected",
      messageKey: "app.crewSetup.ready.notConnected",
      message: "The number is yours, but its texting webhook hasn't been pointed at FieldQuo yet.",
    };
  }

  // Drift. The row says connected; it says connected TO SOMEWHERE ELSE. A
  // preview deployment claiming the shared line repoints it at the branch build,
  // and without this the production tenant keeps a green tick while their crew's
  // photos land in a preview database.
  if (expectedWebhookUrl && line.webhookUrl !== expectedWebhookUrl) {
    return {
      ready: false,
      reason: "webhook_elsewhere",
      messageKey: "app.crewSetup.ready.elsewhere",
      message:
        "This number's texts are being delivered to a different FieldQuo deployment. " +
        "Reconnect it here to bring them back.",
    };
  }

  return {
    ready: true,
    reason: "ready",
    messageKey: "app.crewSetup.ready.ready",
    message: "Your crew can text this number now.",
  };
}

/** Is the inbound signature check able to run at all? Never returns the token. */
export function crewSignatureConfigured() {
  return Boolean(process.env.TWILIO_AUTH_TOKEN);
}

/**
 * The platform's own Twilio number, offered as a shared test line.
 *
 * Same number `sendSms` falls back to for outbound. Safe to lend because
 * CrewInboxNumber.e164 is unique: while one company holds it, the inbound
 * webhook resolving `To` can only land on that tenant, and a second claim is a
 * database constraint violation rather than a race.
 */
export function sharedTestLineE164() {
  return process.env.TWILIO_PHONE_NUMBER || null;
}
