// app/api/rep-dial/bridge/route.js
//
// Twilio asks "what should I do with this call?" and this answers in TwiML.
//
// ══ Why it is NOT under /api/sales ════════════════════════════════════════
//
// middleware.js refuses everything under `/api/sales` that does not carry a
// rep's cookie, and scripts/check-sales-auth.mjs separately refuses any
// handler there that does not resolve a rep through a declared gate. Both are
// right and neither can be satisfied by Twilio, which posts from its own
// infrastructure with no session at all. A path beginning `/api/sales-` would
// still match that prefix, which is a trap worth naming: `"/api/sales-dial"
// .startsWith("/api/sales")` is true. Hence `/api/rep-dial`.
//
// ══ The signature IS the access control ═══════════════════════════════════
//
// Exactly as app/api/sms/inbound and app/api/crew/inbound already work, and
// through the same verifier so a fix to the URL reconstruction lands on all of
// them. Note what that requires: the account's AUTH TOKEN specifically. A
// deployment holding only API keys can mint tokens and place calls while being
// unable to verify a single webhook — see lib/sms/verifyTwilioWebhook.js.
//
// ══ THE NUMBER DIALLED COMES FROM OUR ROW, NEVER FROM THE REQUEST ═════════
//
// This is the security property of the whole feature. The browser SDK sends an
// `attemptId` and nothing else that matters; the destination is read from the
// SalesCallAttempt that /api/sales/calls already created after clearing the
// calling window, the do-not-contact flag and the per-24h cap. A client that
// sent a `To` parameter would be ignored, so a compromised or curious rep
// cannot turn FieldQuo's Twilio account into a way to ring anybody they like.
//
// ══ And the row has to be FRESH ═══════════════════════════════════════════
//
// An attempt id is not a bearer token, but it is a stable string that appears
// in a browser. Bridging one that is four hours old would place a call whose
// window was checked four hours ago — at 20:30 in Oklahoma, on a decision
// taken at 16:30. So an attempt older than BRIDGE_WINDOW_SECONDS is refused.
// A rep who lets a call sit that long presses the button again.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { getAppOrigin } from "@/lib/appUrl";
import { salesRepIdFromIdentity } from "@/lib/sales/calls/browserDial";
import { callStoreState } from "@/lib/sales/calls/store";
import { recordError } from "@/lib/platform/errorLog";

/** How long after the gate cleared a bridge may still happen. */
export const BRIDGE_WINDOW_SECONDS = 120;

/** How long to let it ring. Matches callPlan's timeout, said once per side. */
const RING_SECONDS = 30;

/**
 * TwiML that says nothing and hangs up, with the reason spoken to the REP's
 * leg only — the prospect's leg does not exist yet, so nobody else hears it.
 *
 * A refusal that returned an empty document would drop the call with the rep
 * staring at a dialer that went quiet, which is the same dead control in
 * audio. They hear why.
 */
function refuse(reason) {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: "alice" }, reason);
  twiml.hangup();
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) {
    // 403 with no body. An unsigned request is not a caller to explain
    // ourselves to, and the SMS routes answer the same way.
    return new NextResponse("Forbidden", { status: 403 });
  }

  const store = callStoreState();
  if (!store.ready) {
    return refuse("Calling is not finished being set up. Please try again later.");
  }

  const attemptId = typeof params.attemptId === "string" ? params.attemptId.trim() : "";
  const identity = salesRepIdFromIdentity(params.From || "");
  if (!attemptId || !identity) {
    return refuse("This call could not be matched to a prospect, so it was not connected.");
  }

  const attempt = await db.salesCallAttempt
    .findFirst({
      where: { id: attemptId, salesRepId: identity },
      select: { id: true, toE164: true, fromE164: true, dialledAt: true, providerCallSid: true },
    })
    .catch(() => null);

  if (!attempt) {
    // Scoped to the rep in the WHERE rather than checked after: a mismatched
    // pair matches nothing, which is the same shape every sales route uses.
    return refuse("This call could not be matched to a prospect, so it was not connected.");
  }
  if (attempt.providerCallSid) {
    return refuse("That call has already been placed.");
  }
  if (!attempt.fromE164) {
    return refuse("There is no number to call from, so this call was not connected.");
  }

  const ageMs = Date.now() - new Date(attempt.dialledAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > BRIDGE_WINDOW_SECONDS * 1000) {
    await recordError({
      area: "sales_dial",
      message: `A bridge was refused for a stale attempt (${Math.round(ageMs / 1000)}s old).`,
    }).catch(() => {});
    return refuse("This call sat too long before connecting. Press call again.");
  }

  const origin = getAppOrigin(request);
  const twiml = new twilio.twiml.VoiceResponse();
  const dial = twiml.dial({
    // A number FieldQuo owns, chosen by callPlan when the attempt was written.
    // Never taken from the request — Twilio rejects an unowned caller ID
    // anyway (21210), but the refusal should not depend on the vendor noticing.
    callerId: attempt.fromE164,
    timeout: RING_SECONDS,
    answerOnBridge: true,
    // No `record`. Recording a two-party call is consent law rather than a
    // parameter — see lib/sales/calls/browserDial.js's callPlan for the long
    // version. Its absence here is the decision, not an oversight.
  });
  dial.number(
    {
      statusCallback: `${origin}/api/rep-dial/status?attemptId=${encodeURIComponent(attempt.id)}`,
      statusCallbackMethod: "POST",
      // `initiated` is deliberately absent: it fires before anything has
      // happened and would only ever write columns we already know.
      statusCallbackEvent: ["ringing", "answered", "completed"],
    },
    attempt.toE164,
  );

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
