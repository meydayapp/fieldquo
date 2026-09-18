// app/api/rep-dial/recording/route.js
//
// Twilio says "the recording of that call is ready" and this files it.
//
// Under /api/rep-dial and not /api/sales for the reason the bridge route's
// header gives: Twilio has no rep cookie, and the signature is the access
// control. Same verifier as every other Twilio webhook in this repo.
//
// ══ Which row ═════════════════════════════════════════════════════════════
//
// The attempt id (or the transfer id, for a conference) is in the query
// string WE built when the <Dial> was written — see lib/sales/calls/
// recording.js — and is never read from the body. When neither is there the
// CallSid the carrier sent finds the row by either leg.
//
// ══ Then the transcript, after the reply ══════════════════════════════════
//
// Transcribing means fetching the audio, splitting it and two model calls —
// tens of seconds on a long call. Twilio waits fifteen seconds for a
// webhook and then retries, and a retry of THIS webhook would file the same
// recording twice and start a second transcription. So the reply goes out
// first and the work runs in `after()`, which Next keeps alive past the
// response. If it fails, the failure is written on the row in words
// (transcriptError) and the platform page offers "transcribe the missing
// ones" — lib/sales/calls/transcribe.js.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse, after } from "next/server";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { callStoreState, recordCallRecording } from "@/lib/sales/calls/store";
import { recordingFromWebhook } from "@/lib/sales/calls/recording";
import { transcribeAttempt } from "@/lib/sales/calls/transcribe";
import { recordError } from "@/lib/platform/errorLog";

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  const recording = recordingFromWebhook(params);
  // Not a completed recording with a sid: nothing to file, and a 4xx would
  // only make the carrier send the same body again.
  if (!recording) return new NextResponse("", { status: 204 });

  const query = new URL(request.url).searchParams;
  const attemptId = query.get("attemptId");
  const transferId = query.get("transferId");

  if (!callStoreState().ready) {
    await recordError({
      area: "sales_dial",
      code: "recording_orphaned",
      message: `A call recording (${recording.sid}) arrived before SalesCallAttempt existed. It is on the provider and not filed.`,
      detail: { recordingUrl: recording.url, attemptId, transferId },
    }).catch(() => {});
    return new NextResponse("", { status: 204 });
  }

  let filed;
  try {
    filed = await recordCallRecording({ attemptId, transferId, callSid: recording.callSid, recording });
  } catch (err) {
    await recordError({
      area: "sales_dial",
      code: "recording_write_failed",
      message: `A call recording (${recording.sid}) could not be attached: ${err?.message}`,
      detail: { recordingUrl: recording.url, attemptId, transferId, callSid: recording.callSid },
    }).catch(() => {});
    return new NextResponse("", { status: 204 });
  }

  if (!filed.ok || (filed.updated === 0 && filed.reason !== "already")) {
    // Somebody spoke on this and no row claims it. Named, not swallowed.
    await recordError({
      area: "sales_dial",
      code: "recording_orphaned",
      message: `A call recording (${recording.sid}) matched no attempt row (${filed.reason || "unknown"}). It is on the provider and not filed.`,
      detail: { recordingUrl: recording.url, attemptId, transferId, callSid: recording.callSid },
    }).catch(() => {});
    return new NextResponse("", { status: 204 });
  }

  if (filed.updated > 0 && filed.attemptId) {
    const id = filed.attemptId;
    after(async () => {
      await transcribeAttempt(id).catch(async (err) => {
        await recordError({
          area: "sales_transcript",
          code: "transcribe_threw",
          message: `Transcription of attempt ${id} threw: ${err?.message}`,
        }).catch(() => {});
      });
    });
  }

  return new NextResponse("", { status: 204 });
}
