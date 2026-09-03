// app/api/sales/calls/token/route.js
//
// A short-lived credential that lets ONE rep's browser place calls FieldQuo
// pays for.
//
// ══ This is a credential endpoint. Treat it like one ══════════════════════
//
// A Twilio access token is not a session hint. Whoever holds it can open a
// WebRTC connection to FieldQuo's TwiML application and place calls billed to
// FieldQuo's account, from FieldQuo's numbers, until it expires. Three
// properties hold that in:
//
//   1. The identity is taken from the GATE, never from the request body.
//      There is no `salesRepId` parameter to pass, so there is no shape of
//      request that mints a token for somebody else. This is the single most
//      important line in the file.
//   2. Ten minutes (TOKEN_TTL_SECONDS). Long enough to cover a call already in
//      progress; short enough that one lifted from a console tab is dead
//      before it is useful.
//   3. The rep row is re-read in this request. A rep deactivated at 09:00 must
//      not be minting call credentials at 09:01, which is exactly what a
//      twelve-hour portal token would otherwise allow.
//
// ══ An API KEY is required here, and the auth token cannot stand in ═══════
//
// lib/sms/twilioClient.js's twilioConfigured() accepts either credential
// style, and its header explains why: sending SMS works with both. Minting an
// access token does not — it is signed with an API key secret and carries the
// key's SID in its header. A deployment with only TWILIO_AUTH_TOKEN can send
// texts, buy numbers and verify inbound webhooks while being completely unable
// to place a browser call. So this route checks for the key pair specifically
// and says which variable is missing, rather than reporting a generic
// "Twilio is not configured" that is untrue in three other senses.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { repIdentity, TOKEN_TTL_SECONDS, TWIML_APP_ENV } from "@/lib/sales/calls/browserDial";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const appSid = process.env.TWILIO_SALES_TWIML_APP_SID;

  const missing = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!keySid) missing.push("TWILIO_API_KEY_SID");
  if (!keySecret) missing.push("TWILIO_API_KEY_SECRET");
  if (!appSid) missing.push(TWIML_APP_ENV);
  if (missing.length > 0) {
    // 503, not 500: nothing is broken, something was never set. The variable
    // names are in the body because the person reading this response is a
    // superadmin looking at a readiness screen, not a prospect.
    return NextResponse.json(
      {
        error:
          `In-browser calling is not configured on this deployment. Missing: ${missing.join(", ")}. ` +
          "An access token is signed with an API key secret — the account auth token cannot stand in.",
        missing,
      },
      { status: 503 },
    );
  }

  // From the gate. Not from the body, and there is no body parameter that
  // could reach it.
  const identity = repIdentity(rep.id);
  if (!identity) {
    return bad("This rep's id cannot be used as a calling identity.", 500);
  }

  const { AccessToken } = twilio.jwt;
  const token = new AccessToken(accountSid, keySid, keySecret, {
    identity,
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant(
    new AccessToken.VoiceGrant({
      outgoingApplicationSid: appSid,
      // Inbound to the browser is OFF. A rep's laptop is not a phone number,
      // and an inbound-enabled identity is a second, unasked-for way for a
      // call to reach a rep — FieldQuo's own line answers inbound, through the
      // agent, and that is the one door. Turning this on later is a deliberate
      // change with its own routing decision behind it.
      incomingAllow: false,
    }),
  );

  return NextResponse.json({
    token: token.toJwt(),
    identity,
    expiresInSeconds: TOKEN_TTL_SECONDS,
    // So the client can schedule its own refresh against the SERVER's clock
    // rather than a laptop's, the same reason the queue screen takes an offset.
    serverNow: new Date().toISOString(),
  });
}
