// app/api/business-number/voice/route.js
//
// A call to a company's PORTED business number. Twilio posts here (the
// number's voiceUrl, set by lib/businessNumber/store.js activate()).
//
//   (no stage)    ring the company's chosen phones together, caller ID passed
//                 through                        → lib/businessNumber/twiml.js
//   ?stage=after  how the ring ended: answered → done; else the receptionist
//                 (the company's existing Retell number) or voicemail
//   ?stage=done   the voicemail has been left (or not) → hang up
//
// ══ The signature is the access control ═════════════════════════════════════
//
// Same verifier as /api/sms/inbound and /api/rep-dial/*, and it covers the
// query string. The company is resolved from `To` — the number that was
// dialled — against our own rows, never from anything else in the request.
//
// ══ Every call lands in the conversation ═════════════════════════════════════
//
// The outcome is filed on the caller's SMS thread at the moment it is known
// (after the ring, after the voicemail). /api/business-number/call-status is
// the backstop: a caller who hangs up during the greeting produces no `done`,
// and that route files the call as missed — the activity row is keyed on the
// CallSid, so whichever writes first wins and nothing is filed twice.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { activeNumber } from "@/lib/voice/numbers";
import { broughtNumberByE164 } from "@/lib/businessNumber/store";
import { inboundRingTwiml, afterRingTwiml, hangupTwiml } from "@/lib/businessNumber/twiml";
import { fileCallOnThread } from "@/lib/businessNumber/conversation";

function xml(body) {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage") || "ring";
  const base = `${getAppOrigin(request)}/api/business-number/voice`;
  const to = params.To || params.Called || null;
  const from = params.From || params.Caller || null;

  const line = await broughtNumberByE164(to).catch(() => null);
  if (!line) {
    // Not a live business number (released, or a stale webhook). Say nothing
    // misleading — an empty hang-up, and a record of it.
    await recordError({ area: "business_number", code: "voice_unknown_number", message: `Call to ${to} matched no live business number` }).catch(() => {});
    return xml(hangupTwiml());
  }

  if (stage === "ring") {
    return xml(
      inboundRingTwiml({
        from,
        forwardTo: Array.isArray(line.forwardTo) ? line.forwardTo : [],
        ringSeconds: line.ringSeconds,
        afterUrl: `${base}?stage=after`,
      }),
    );
  }

  if (stage === "after") {
    const [receptionist, agent, company] = await Promise.all([
      activeNumber(line.companyId).catch(() => null),
      db.voiceAgent.findUnique({ where: { companyId: line.companyId }, select: { enabled: true } }).catch(() => null),
      db.company.findUnique({ where: { id: line.companyId }, select: { name: true, defaultLanguage: true } }).catch(() => null),
    ]);
    // A receptionist that answers: a live number AND the agent switched on.
    // The `porting` status activeNumber() also returns is a number that does
    // not ring yet, so it does not count.
    const receptionistE164 = receptionist?.status === "active" && agent?.enabled ? receptionist.e164 : null;
    const dialStatus = url.searchParams.get("skipped") ? "no-answer" : params.DialCallStatus;
    const { twiml, outcome } = afterRingTwiml({
      dialStatus,
      from,
      receptionistE164,
      fallback: line.fallback,
      companyName: company?.name,
      language: company?.defaultLanguage || "en",
      voicemailUrl: `${getAppOrigin(request)}/api/business-number/call-status?kind=voicemail`,
      doneUrl: `${base}?stage=done`,
    });
    // Answered and receptionist are final the moment they are known. A
    // voicemail is filed at `done`, when we know whether a message was left.
    if (outcome !== "voicemail" && params.CallSid) {
      await fileCallOnThread(db, {
        companyId: line.companyId,
        phone: from,
        callSid: params.CallSid,
        activity: { direction: "in", outcome, durationSec: outcome === "answered" ? Number(params.DialCallDuration) || 0 : 0 },
      }).catch((err) => recordError({ area: "business_number", code: "call_file_failed", companyId: line.companyId, message: err?.message || "filing failed" }));
    }
    return xml(twiml);
  }

  if (stage === "done") {
    const seconds = Number(params.RecordingDuration) || 0;
    if (params.CallSid) {
      await fileCallOnThread(db, {
        companyId: line.companyId,
        phone: from,
        callSid: params.CallSid,
        activity: { direction: "in", outcome: seconds >= 2 ? "voicemail" : "missed", durationSec: seconds },
      }).catch(() => null);
    }
    return xml(hangupTwiml());
  }

  return xml(hangupTwiml());
}
