// app/api/rep-dial/amd/route.js
//
// Twilio's answering-machine verdict for the prospect leg of a browser dial.
//
// The bridge (app/api/rep-dial/bridge) attaches `amdStatusCallback` to the
// <Number> it dials when `sales.amd.enabled` is on (lib/sales/calls/amd.js
// amdNumberAttrs). Twilio posts here once per call with AnsweredBy and
// MachineDetectionDuration — on its own request, while the rep is already
// bridged. This writes the verdict on the attempt and, when the platform
// has set a voicemail drop AND the verdict is machine_end_*, redirects the
// prospect leg to play it and hang up. A human verdict changes nothing.
//
// Under /api/rep-dial and not /api/sales for the reason the bridge's header
// gives: Twilio has no session. The signature is the access control
// (verifyTwilioWebhook), the attempt id comes from the query string WE put
// on the URL, and the CallSid in the body has to match the leg we stored —
// a verdict for some other call is dropped, not written.
//
// Answered 204 with no body, through the same acknowledged() wrapper the
// status webhook uses: a verdict that could not be written is recorded to
// /platform/errors, never turned into a 500 the carrier would retry.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { recordError } from "@/lib/platform/errorLog";
import { callStoreState } from "@/lib/sales/calls/store";
import { acknowledged, noContent } from "@/lib/sales/calls/twilioAck";
import { amdVerdictFrom, dropVoicemail, shouldDropVoicemail } from "@/lib/sales/calls/amd";
import { outcomeSettingValues } from "@/lib/sales/calls/outcomeSettingsStore";

export async function POST(request) {
  return acknowledged(() => handle(request), {
    area: "sales_dial",
    code: "amd_webhook_threw",
    what: `An answering-machine verdict for attempt ${new URL(request.url).searchParams.get("attemptId") || "(unnamed)"}`,
  });
}

async function handle(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId || !callStoreState().ready) return noContent();

  const verdict = amdVerdictFrom(params);
  if (!verdict.result) {
    await recordError({ area: "sales_dial", code: "amd_unknown_value", message: `AMD posted an AnsweredBy this build does not know for attempt ${attemptId}: ${JSON.stringify(params.AnsweredBy)}` }).catch(() => {});
    return noContent();
  }

  const now = new Date();
  // The write is scoped to the leg we placed: the sid Twilio posts must be
  // the one the status webhook stored, or — when the status callback has
  // not arrived yet — the row must have no sid at all. Either way the row
  // is the attempt WE named in the URL; a body cannot point it elsewhere.
  const res = await db.salesCallAttempt.updateMany({
    where: { id: attemptId, dialChannel: "browser", OR: [{ providerCallSid: verdict.callSid }, { providerCallSid: null }] },
    data: { amdResult: verdict.result, amdAt: now, amdMs: verdict.ms },
  });
  if (res.count !== 1) {
    await recordError({ area: "sales_dial", code: "amd_unmatched", message: `An AMD verdict (${verdict.result}) for attempt ${attemptId} matched no browser dial with call sid ${verdict.callSid || "(none)"}.` }).catch(() => {});
    return noContent();
  }

  // ── The drop, machine_end_* only ────────────────────────────────────────
  const settings = await outcomeSettingValues();
  const dropUrl = settings["sales.amd.voicemailDropUrl"];
  if (shouldDropVoicemail({ result: verdict.result, dropUrl }) && verdict.callSid) {
    const r = await dropVoicemail({ callSid: verdict.callSid, dropUrl });
    if (!r.ok) {
      await recordError({ area: "sales_dial", code: "amd_drop_failed", message: `The voicemail drop for attempt ${attemptId} could not be played: ${r.reason}` }).catch(() => {});
    }
  }
  return noContent();
}
