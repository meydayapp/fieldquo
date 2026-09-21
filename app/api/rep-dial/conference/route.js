// app/api/rep-dial/conference/route.js
//
// Twilio reports on a per-attempt conference — somebody joined, somebody
// left, the room ended — and this keeps the row honest.
//
// Under /api/rep-dial and not /api/sales for the reason every sibling gives:
// Twilio posts with no rep cookie, and the signature is the access control
// (lib/sms/verifyTwilioWebhook.js, the account AUTH TOKEN specifically).
//
// ══ What each event does ══════════════════════════════════════════════════
//
//   participant-join    the room's SID is written on the row the first time
//                       it is seen — every later REST action keys on it
//                       (lib/sales/calls/supervisionRest.js roomRef).
//   participant-leave   the REP left and the call was not taken → the room
//                       is ended, so the prospect is not left with hold
//                       music or a silent listener. The SUPERVISOR left →
//                       their stint is closed and the lock released. The
//                       prospect leaving ends the room by itself
//                       (endConferenceOnExit on their participant).
//   conference-end      an open hold and an open supervision are closed
//                       with their seconds, so no row says "held since
//                       14:02" at midnight. lib/sales/calls/supervision.js
//                       conferenceEndPlan decides; this applies.
//
// A notification, so the answer is an empty 204 through twilioAck.js —
// never a 500, never a body on a 204.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { acknowledged, noContent } from "@/lib/sales/calls/twilioAck";
import { recordError } from "@/lib/platform/errorLog";
import {
  EV_SUPERVISION_END,
  conferenceEndPlan,
  endSupervisionPlan,
  participantLeavePlan,
} from "@/lib/sales/calls/supervision";
import { endConference } from "@/lib/sales/calls/supervisionRest";
import {
  recordCallEvent,
  recordConferenceSid,
  supervisionAttempt,
  writeAttempt,
} from "@/lib/sales/calls/supervisionStore";

export async function POST(request) {
  return acknowledged(() => handle(request), {
    area: "sales_dial",
    code: "conference_webhook_threw",
    what: `A conference event for attempt ${new URL(request.url).searchParams.get("attemptId") || "(unnamed)"}`,
  });
}

async function handle(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  // From the query string we put on the callback URL, never from the body.
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId) return noContent();

  const event = typeof params.StatusCallbackEvent === "string" ? params.StatusCallbackEvent : "";
  const conferenceSid = typeof params.ConferenceSid === "string" ? params.ConferenceSid : null;
  const callSid = typeof params.CallSid === "string" ? params.CallSid : null;
  const now = new Date();

  if (conferenceSid) await recordConferenceSid({ attemptId, conferenceSid }).catch(() => {});

  const attempt = await supervisionAttempt(attemptId);
  if (!attempt) return noContent();

  if (event === "participant-leave") {
    const plan = participantLeavePlan({ attempt, callSid });
    if (plan.supervisorLeft) {
      const end = endSupervisionPlan({ attempt, now });
      if (end.changed) {
        await writeAttempt({ attemptId, data: end.data }).catch(() => {});
        await recordCallEvent({
          attemptId,
          event: EV_SUPERVISION_END,
          platformAdminId: attempt.supervisedBy,
          seconds: end.seconds,
          detail: { reason: "left", kind: attempt.supervisionKind },
          at: now,
        });
      }
    }
    if (plan.endConference) {
      const ended = await endConference(attempt);
      if (!ended.ok) {
        await recordError({
          area: "sales_dial",
          code: "conference_end_failed",
          message: `The rep left attempt ${attemptId}'s conference and the room could not be ended: ${ended.error}. The prospect may be alone in it.`,
        }).catch(() => {});
      }
    }
    return noContent();
  }

  if (event === "conference-end") {
    const plan = conferenceEndPlan({ attempt, now });
    if (plan.data) await writeAttempt({ attemptId, data: plan.data }).catch(() => {});
    for (const e of plan.events) await recordCallEvent({ attemptId, at: now, ...e });
    return noContent();
  }

  return noContent();
}
