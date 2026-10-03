// app/api/business-number/call-status/route.js
//
// Twilio's after-the-fact reports for calls on a business number.
//
//   (no kind)        an inbound call ended (the number's statusCallback). The
//                    BACKSTOP that files a call nobody else filed as missed,
//                    and the meter for a call that was forwarded.
//   ?kind=voicemail  a voicemail recording is ready — its SID goes onto the
//                    call's line in the conversation, for the player.
//   ?kind=bridge     the call button's first leg ended — metered.
//
// Signature-verified like every Twilio webhook here. The company is resolved
// from the business number on the call (To for inbound, From for a bridge —
// both are the business number), never from the request's own claims.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { broughtNumberByE164 } from "@/lib/businessNumber/store";
import { fileCallOnThread, meterCall } from "@/lib/businessNumber/conversation";

const ok = () => new NextResponse("", { status: 204 });

/** The call's own line in the conversation, found by its SID inside this company. */
async function callRow(companyId, callSid) {
  return db.message.findFirst({
    where: { externalId: `call:${callSid}`, thread: { companyId } },
    select: { id: true, activity: true },
  });
}

export async function POST(request) {
  const { ok: signed, params } = await verifyTwilioWebhook(request);
  if (!signed) return new NextResponse("Forbidden", { status: 403 });
  const kind = new URL(request.url).searchParams.get("kind") || "inbound";
  const callSid = params.CallSid || null;
  if (!callSid) return ok();

  if (kind === "voicemail") {
    const line = await broughtNumberByE164(params.To || params.Called).catch(() => null);
    if (!line || params.RecordingStatus !== "completed" || !params.RecordingSid) return ok();
    const row = await callRow(line.companyId, callSid);
    if (row && row.activity && typeof row.activity === "object") {
      await db.message.update({
        where: { id: row.id },
        data: { activity: { ...row.activity, recordingSid: String(params.RecordingSid).slice(0, 64) } },
      });
    }
    return ok();
  }

  if (kind === "bridge") {
    const line = await broughtNumberByE164(params.From || params.Caller).catch(() => null);
    if (!line || params.CallStatus !== "completed") return ok();
    const row = await callRow(line.companyId, callSid);
    // Only a bridge that reached the client is a call to charge for — the
    // contractor declining their own ring is not.
    if (row?.activity?.outcome === "answered") {
      await meterCall({ companyId: line.companyId, callSid, seconds: Number(params.CallDuration) || 0, direction: "out", party: row.activity.party || null }).catch(() => null);
    }
    return ok();
  }

  // ── An inbound call ended ────────────────────────────────────────────────
  const line = await broughtNumberByE164(params.To || params.Called).catch(() => null);
  if (!line || !["completed", "no-answer", "busy", "canceled", "failed"].includes(params.CallStatus)) return ok();
  // The backstop. Keyed on the CallSid, so a call already filed by the voice
  // route is a no-op here.
  await fileCallOnThread(db, {
    companyId: line.companyId,
    phone: params.From || params.Caller,
    callSid,
    activity: { direction: "in", outcome: "missed", durationSec: 0 },
  }).catch(() => null);

  // Forwarded minutes cost two legs; a voicemail or a missed call is one
  // inbound leg and is not charged.
  const row = await callRow(line.companyId, callSid);
  const outcome = row?.activity?.outcome;
  if (outcome === "answered" || outcome === "receptionist") {
    await meterCall({ companyId: line.companyId, callSid, seconds: Number(params.CallDuration) || 0, direction: "in", party: params.From }).catch(() => null);
  }
  return ok();
}
