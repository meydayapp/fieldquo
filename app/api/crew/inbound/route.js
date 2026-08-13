// app/api/crew/inbound/route.js
//
// A crew member texted the company's number. Twilio posts here.
//
// ── Public, so the signature is the gate ───────────────────────────────────
//
// Twilio posts with no session. `validateRequest` checks the X-Twilio-Signature
// HMAC against the exact URL and body — the same standard the voice webhook
// uses — so a stranger who finds this endpoint can't inject a photo into a
// company's job. Rejected outright when the auth token isn't set: unverified-
// because-unconfigured is how a staging slip becomes a public write endpoint.
//
// ── Which company ──────────────────────────────────────────────────────────
//
// Resolved from the number that was TEXTED (the `To`), which is ours and
// unique. Nothing in the body is trusted to name a tenant.
export const runtime = "nodejs";

import twilio from "twilio";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toE164 } from "@/lib/sms/twilioClient";
import { handleCrewMessage } from "@/lib/crew/inbox";
import { recordError } from "@/lib/platform/errorLog";

/** A TwiML reply, or an empty 200 to stay silent. */
function twiml(message) {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]),
  );
}

export async function POST(request) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  // ── Verify ────────────────────────────────────────────────────────────────
  const signature = request.headers.get("x-twilio-signature");
  const url = request.headers.get("x-forwarded-proto") && request.headers.get("host")
    ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}${new URL(request.url).pathname}`
    : request.url;

  if (!token || !signature || !twilio.validateRequest(token, signature, url, params)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const to = toE164(params.To);
  const from = params.From;
  if (!to || !from) return twiml(null);

  // The company that owns the texted number. Prefer the dedicated voice number,
  // fall back to the account SMS number.
  const number = await db.voicePhoneNumber.findFirst({
    where: { e164: to, status: "active" },
    select: { companyId: true, company: { select: { crewInboxEnabled: true } } },
  });

  if (!number || !number.company?.crewInboxEnabled) {
    // Not a crew-inbox number, or the feature's off. Silent 200 — Twilio
    // shouldn't retry, and there's nothing to say.
    return twiml(null);
  }

  // Media: Twilio sends NumMedia + MediaUrl0..N. Point: some carriers/clients
  // include Latitude/Longitude on an MMS; usually absent (WhatsApp strips it),
  // which is exactly why attribution never depends on it.
  const numMedia = Number(params.NumMedia || 0);
  const mediaUrls = [];
  for (let i = 0; i < numMedia; i++) {
    if (params[`MediaUrl${i}`]) mediaUrls.push(params[`MediaUrl${i}`]);
  }
  const lat = Number(params.Latitude);
  const lng = Number(params.Longitude);
  const point = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  try {
    const { reply } = await handleCrewMessage({
      companyId: number.companyId,
      fromPhone: from,
      body: params.Body || "",
      mediaUrls,
      point,
    });
    return twiml(reply);
  } catch (err) {
    await recordError({
      area: "crew_inbox",
      message: `Crew inbound failed: ${err.message}`,
      detail: { to, numMedia },
    }).catch(() => {});
    // 200 with no reply — a failure here must not make Twilio retry the same
    // photo into a duplicate file. The error is logged for a human.
    return twiml(null);
  }
}
