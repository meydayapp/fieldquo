// app/api/platform/sales/supervision/token/route.js
//
// A short-lived Voice SDK credential for a SUPERADMIN's browser, so the
// floor board can put them on a call. The rep version is
// app/api/sales/calls/token; this differs in exactly two ways, both on
// purpose:
//
//   1. The identity is `supervisor:<adminId>` (lib/sales/calls/supervision.js
//      supervisorIdentity) — a different prefix from a rep's, so the bridge
//      can tell a supervisor's leg from a rep's by the From alone and never
//      mistake one for the other.
//   2. `incomingAllow` is FALSE. Nothing rings a supervisor's browser; it
//      only ever dials out, into a room the server already put their name
//      on. A token that could receive would be a second, unasked-for way
//      for a call to reach a person.
//
// The role is re-read in this request: an admin demoted at 09:00 must not
// be minting call credentials at 09:01.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import twilio from "twilio";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { TOKEN_TTL_SECONDS, TWIML_APP_ENV } from "@/lib/sales/calls/browserDial";
import { supervisorIdentity } from "@/lib/sales/calls/supervision";
import { loadSupervisionSettings } from "@/lib/sales/calls/supervisionStore";

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const settings = await loadSupervisionSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Supervision is switched off. Turn it on under Sales → Calling rules first." }, { status: 409 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const appSid = process.env.TWILIO_SALES_TWIML_APP_SID;
  const missing = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!keySid) missing.push("TWILIO_API_KEY_SID");
  if (!keySecret) missing.push("TWILIO_API_KEY_SECRET");
  if (!appSid) missing.push(TWIML_APP_ENV);
  if (missing.length) {
    return NextResponse.json({ error: `In-browser calling is not configured on this deployment. Missing: ${missing.join(", ")}.`, missing }, { status: 503 });
  }

  const identity = supervisorIdentity(admin.id);
  if (!identity) return NextResponse.json({ error: "This admin's id cannot be used as a calling identity." }, { status: 500 });

  const { AccessToken } = twilio.jwt;
  const token = new AccessToken(accountSid, keySid, keySecret, { identity, ttl: TOKEN_TTL_SECONDS });
  token.addGrant(new AccessToken.VoiceGrant({ outgoingApplicationSid: appSid, incomingAllow: false }));

  return NextResponse.json({ token: token.toJwt(), identity, expiresInSeconds: TOKEN_TTL_SECONDS, serverNow: new Date().toISOString() });
}
