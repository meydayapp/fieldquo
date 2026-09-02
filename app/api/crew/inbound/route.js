// app/api/crew/inbound/route.js
//
// A crew member texted the company's crew line. Twilio posts here.
//
// ── Public, so the signature is the gate ───────────────────────────────────
//
// Twilio posts with no session. `validateRequest` checks the X-Twilio-Signature
// HMAC against the exact URL and body — the same standard the voice webhook
// uses — so a stranger who finds this endpoint can't inject a photo into a
// company's job. Rejected outright when the auth token isn't set: unverified-
// because-unconfigured is how a staging slip becomes a public write endpoint.
//
// Note the auth TOKEN specifically. An API key can send messages and manage
// numbers but cannot verify a signature, so a deployment with keys and no token
// is fully able to text you and completely unable to hear you answer. The setup
// screen says so in those words; see lib/crew/capability.js.
//
// ── Which company ──────────────────────────────────────────────────────────
//
// Resolved from the number that was TEXTED (the `To`), matched against
// CrewInboxNumber — a table whose `e164` is unique, so one number resolves to at
// most one tenant, always. Nothing in the body is trusted to name a tenant, and
// the SENDER is never a tenant key: see the long note on tenantKeyFromInbound
// for why "one shared number, look up the crew member" is both undecidable
// (Worker.phone isn't unique) and unauthenticated (`From` is forgeable).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleCrewMessage } from "@/lib/crew/inbox";
import { crewInboxCapability } from "@/lib/crew/capability";
import { tenantKeyFromInbound, collectMediaUrls, pointFromInbound } from "@/lib/crew/inboundParse";
import { sendSms } from "@/lib/sms/twilioClient";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { crewSpendFor, chargeOutboundCrewReply, disconnectForNonPayment } from "@/lib/crew/messaging";
import { recordError } from "@/lib/platform/errorLog";

/**
 * An empty 200.
 *
 * Every answer this endpoint gives Twilio is an empty TwiML document — it never
 * puts a reply in the response body. The reply goes out over the REST API
 * instead, because a TwiML `<Message>` returns no message SID and no delivery
 * result, and the ledger will not bill for a send it cannot verify. See
 * settleCrewSpend.
 */
function twiml() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}

/**
 * Send the reply if it's covered, and close the tap if the overdraft is spent.
 *
 * ══ Why the reply goes out over REST rather than as TwiML ══════════════════
 *
 * A `<Message>` in the webhook response is simpler and costs the same to send —
 * and returns no message SID and no send result. There would be nothing to key
 * idempotency on and no evidence the text ever left, so billing for it would be
 * billing on a delivery we cannot verify. The voice ledger refuses to do that
 * (see reconcileCalls: an unknown duration is flagged, not guessed at), and the
 * same discipline applies to a message. So: send it, get a SID back, charge that
 * SID, and answer Twilio with an empty TwiML.
 */
async function settleCrewSpend({ line, to, from, reply }) {
  const spend = await crewSpendFor(line.companyId, reply);

  if (reply) {
    if (spend.canReply) {
      // To the crew member who texted, FROM the crew line they texted.
      // `from` here is a CREW member (staff), not a client — not gated by
      // lib/sms/optOut.js's maySms(), which is the client opt-out list.
      // companyId is what makes a demo tenant's reply simulated rather than
      // sent (lib/sms/demoSms.js). The ledger charge below still runs on the
      // simulated SID, deliberately: a demo of crew texting that showed no
      // per-message cost would demonstrate a product FieldQuo does not sell.
      const sent = await sendSms({ to: from, from: to, body: reply, companyId: line.companyId }).catch(() => null);
      if (sent?.success && sent.sid) {
        await chargeOutboundCrewReply({
          companyId: line.companyId,
          sid: sent.sid,
          body: reply,
          to: from,
        });
      }
    } else {
      // Withheld, and recorded — a reply that silently stops arriving reads as
      // the feature breaking again, which is the confusion this whole change
      // exists to end. The office inbox still shows the message.
      await recordError({
        area: "crew_inbox",
        message: "Crew reply withheld — no credit",
        companyId: line.companyId,
        detail: { balanceCents: spend.balanceCents, neededCents: spend.replyCents },
      }).catch(() => {});
    }
  }

  // Enforcement at the PROVIDER, the same rule the voice side follows when it
  // detaches an agent from an unfunded number. Past the overdraft floor Twilio
  // stops delivering — which stops charging us — and the setup screen shows the
  // line as disconnected with the reason, ready to reconnect after a top-up.
  if (!spend.canReceive) {
    await disconnectForNonPayment({ companyId: line.companyId, line }).catch(() => {});
    await recordError({
      area: "crew_inbox",
      message: "Crew line disconnected — overdraft floor reached",
      companyId: line.companyId,
      detail: { balanceCents: spend.balanceCents },
    }).catch(() => {});
  }
}

export async function POST(request) {
  // ── Verify ────────────────────────────────────────────────────────────────
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = tenantKeyFromInbound(params);
  const from = params.From;
  if (!to || !from) return twiml();

  // ── The company that owns the texted number ───────────────────────────────
  //
  // The crew LINE, not the voice number. Those are two different numbers from
  // two different providers, and the version of this that looked up
  // VoicePhoneNumber is why nothing ever arrived: that number is bought from
  // Retell, lives in Retell's telephony account, and Twilio has no reason to
  // post about it — nor anywhere to post to, since nothing ever set its
  // messaging webhook.
  const line = await db.crewInboxNumber.findUnique({
    where: { e164: to },
    select: {
      id: true,
      companyId: true,
      provider: true,
      providerId: true,
      expiresAt: true,
      connectedAt: true,
      webhookUrl: true,
      company: { select: { crewInboxEnabled: true } },
    },
  });

  // The same verdict the setup screen renders, from the same function — so a
  // screen that says "your crew can text this number" and a webhook that files
  // the result cannot disagree about whether the line is live. `webhookUrl` is
  // deliberately not compared here: Twilio reaching us at all is better proof of
  // delivery than our stored copy of the URL, and dropping a real crew photo
  // over a stale string would be the worse error.
  const capability = crewInboxCapability({ line, signatureConfigured: true });

  if (!line || !capability.ready || !line.company?.crewInboxEnabled) {
    // Not a crew line, the loan lapsed, or the feature's off. Silent 200 —
    // Twilio shouldn't retry, and there's nothing to say to a stranger.
    return twiml();
  }

  // Media: Twilio sends NumMedia + MediaUrl0..N. Bounded and host-checked in
  // collectMediaUrls — the re-host step fetches these WITH our Twilio
  // credentials attached, so a URL naming any other host is a credential leak
  // rather than a broken image.
  const { urls: mediaUrls, rejected } = collectMediaUrls(params);
  if (rejected.length) {
    // Logged, never silently dropped: a Twilio region we haven't listed shows up
    // here as a pattern, and a probe shows up here as an attack.
    await recordError({
      area: "crew_inbox",
      message: `Refused ${rejected.length} media URL(s) from a non-Twilio host`,
      companyId: line.companyId,
      detail: { hosts: rejected.map((u) => { try { return new URL(u).hostname; } catch { return "unparseable"; } }) },
    }).catch(() => {});
  }

  // Some carriers/clients include Latitude/Longitude on an MMS; usually absent
  // (WhatsApp strips it), which is exactly why attribution never depends on it.
  const point = pointFromInbound(params);

  try {
    const { reply } = await handleCrewMessage({
      companyId: line.companyId,
      fromPhone: from,
      body: params.Body || "",
      mediaUrls,
      point,
      // What the carrier says it charged us for. Capped and sanity-checked
      // downstream — a forged NumSegments must not invent a charge.
      segments: Number(params.NumSegments) || 1,
    });

    // ── Paying for the reply, and for the line ────────────────────────────
    //
    // The message above is filed either way: it is already paid for, and
    // dropping a site photo to save money that has already left is the one
    // trade nobody would choose. The REPLY is different — it hasn't been sent
    // yet, so it is the cost still in our hands, and it is the courteous half
    // rather than the useful half.
    await settleCrewSpend({ line, to, from, reply });
    return twiml();
  } catch (err) {
    await recordError({
      area: "crew_inbox",
      message: `Crew inbound failed: ${err.message}`,
      companyId: line.companyId,
      detail: { to, numMedia: mediaUrls.length },
    }).catch(() => {});
    // 200 with no reply — a failure here must not make Twilio retry the same
    // photo into a duplicate file. The error is logged for a human.
    return twiml();
  }
}
