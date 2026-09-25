// app/api/sms/status/route.js
//
// Twilio's statusCallback for every text FieldQuo sends — the URL
// lib/sms/twilioClient.js's sendSms() passes as `statusCallback`, carrying the
// SmsDelivery row's opaque id as `?d=`. Twilio posts here each time the text
// moves: queued → sent → delivered, or → undelivered/failed with an ErrorCode
// (30034 = the carrier dropped it because the sending number isn't registered
// for A2P 10DLC).
//
// Public, no session: the X-Twilio-Signature IS the access control, verified
// by the same lib/sms/verifyTwilioWebhook.js the inbound routes use — and
// because Twilio signs the full URL, `?d=` is covered by it too.
//
// Always answers 2xx to a verified request, including one that changed
// nothing. Twilio retries on non-2xx, and a duplicate or out-of-order status
// is not an error: lib/sms/deliveryStore.js applyStatus ignores anything that
// is not a forward move, which is what makes a retry harmless.
//
// This route is not the only way a status arrives. A callback that is never
// sent (no reachable origin), misrouted, or refused below is caught by
// /api/cron/sms-delivery-reconcile, which asks Twilio directly — and
// /platform/sms-health counts which of the two did the work, so a broken
// webhook shows up as a number instead of as silence.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { applyStatus } from "@/lib/sms/deliveryStore";

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const d = new URL(request.url).searchParams.get("d");
  // MessageStatus/MessageSid are current; SmsStatus/SmsSid are the legacy
  // names Twilio still sends alongside them.
  const sid = params.MessageSid || params.SmsSid || null;
  const status = params.MessageStatus || params.SmsStatus || null;
  if (!sid || !status) return new NextResponse(null, { status: 204 });

  await applyStatus({
    id: d || null,
    sid,
    status,
    errorCode: params.ErrorCode || null,
    source: "callback",
  }).catch((err) => {
    // Logged and answered 204 anyway: a Neon cold start here would otherwise
    // make Twilio retry into the same cold start, and the reconcile cron
    // settles the row within the hour regardless.
    console.error("[sms/status] couldn't apply the status:", err?.message);
  });

  return new NextResponse(null, { status: 204 });
}
