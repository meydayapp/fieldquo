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
//
// ══ Two audiences, two sentences, one verdict ══════════════════════════════
//
// `message` is what a CONTRACTOR reads. `opsMessage` is what FIELDQUO reads on
// /platform/crew-lines. They describe the same `reason` and can never disagree,
// because there is one branch producing both.
//
// The split exists because the contractor-facing half was narrating our
// infrastructure at somebody who cannot act on it. The owner opened
// /app/crew-inbox and was told his deployment was missing TWILIO_AUTH_TOKEN —
// an env var on a Vercel project he has no login for, on an account he does not
// hold, describing a webhook he must never be pointed at. FieldQuo holds the
// Twilio account and lends the number, exactly as it holds the Retell account
// and provisions the voice line; no tenant screen shows a Retell agent id, and
// no tenant screen shows a Twilio webhook either.
//
// What the contractor gets instead is the true and useful half: whether crew
// texting works for them, and whose problem it is when it doesn't. "FieldQuo is
// setting it up" is not a euphemism — it is literally accurate, and it is the
// only sentence of the two that a contractor can do anything with (namely,
// nothing, which is the correct action).

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
 * @returns {{ ready: boolean, reason: string, messageKey: string, message: string,
 *             opsMessage: string }}
 *          `messageKey`/`message` are the same shape as the `readiness` the
 *          voice switches use, so the tenant screen renders it the same way.
 *          `opsMessage` is FieldQuo's own diagnosis and is rendered ONLY on
 *          /platform — see the note above, and check:crew-inbox, which fails if
 *          a tenant-facing message ever names an env var or an endpoint again.
 */
export function crewInboxCapability({
  line = null,
  signatureConfigured = true,
  expectedWebhookUrl = null,
  now = new Date(),
} = {}) {
  // Checked before anything about the line, because it is true of the whole
  // deployment and no amount of clicking on any screen can fix it — least of all
  // the contractor's. The env var is named in `opsMessage`, where the person who
  // reads it is the person who can set it.
  if (!signatureConfigured) {
    return {
      ready: false,
      reason: "not_configured",
      messageKey: "app.crewSetup.ready.unavailable",
      message:
        "Crew texting isn't available on your account yet — FieldQuo is still " +
        "getting it set up. There's nothing for you to do; it'll appear here " +
        "when it's ready.",
      opsMessage:
        "TWILIO_AUTH_TOKEN isn't set on this deployment, so /api/crew/inbound " +
        "refuses every inbound message with a 401. Every tenant is blocked, not " +
        "just this one. Set it in Vercel and redeploy.",
    };
  }

  if (!line) {
    return {
      ready: false,
      reason: "no_line",
      messageKey: "app.crewSetup.ready.noLine",
      message: "Your crew don't have a number to text yet.",
      opsMessage:
        "This company holds no CrewInboxNumber. Lend it one from the numbers " +
        "the Twilio account owns, or buy one.",
    };
  }

  if (!SMS_CAPABLE_PROVIDERS.has(line.provider || "")) {
    return {
      ready: false,
      reason: "provider_no_sms",
      messageKey: "app.crewSetup.ready.voiceOnly",
      message:
        "That line can answer calls but can't receive texts. The crew inbox needs a texting number.",
      opsMessage: `The row's provider is "${line.provider || "unset"}", which has no verified path into /api/crew/inbound. Only Twilio does.`,
    };
  }

  if (line.expiresAt && new Date(line.expiresAt).getTime() <= now.getTime()) {
    return {
      ready: false,
      reason: "expired",
      messageKey: "app.crewSetup.ready.expired",
      message: "Your loan of the shared test line has ended. Claim it again to keep testing.",
      opsMessage:
        "The shared-line loan lapsed. The number is free for the next company to claim.",
    };
  }

  if (!line.connectedAt || !line.webhookUrl) {
    return {
      ready: false,
      reason: "not_connected",
      messageKey: "app.crewSetup.ready.notConnected",
      // Deliberately says nothing about webhooks. The contractor's half of this
      // is one button; the half that mentions Twilio is FieldQuo's.
      message: "Your crew's number isn't switched on yet. Turn it on and they can start texting.",
      opsMessage:
        "The row is claimed but its smsUrl was never pointed here — a claim that " +
        "half-failed. Pressing the tenant's button retries it.",
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
        "Your crew's number needs reconnecting before their texts reach you again.",
      opsMessage: `Webhook drift: the row's smsUrl is ${line.webhookUrl}, this deployment expects ${expectedWebhookUrl}. Their crew's photos are landing in the other deployment's database.`,
    };
  }

  return {
    ready: true,
    reason: "ready",
    messageKey: "app.crewSetup.ready.ready",
    message: "Your crew can text this number now.",
    opsMessage: "Claimed, SMS-capable, and pointed at this deployment.",
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
