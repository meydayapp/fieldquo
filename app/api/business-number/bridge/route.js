// app/api/business-number/bridge/route.js
//
// Twilio's half of the call button (app/api/calls/bridge places leg one).
//
//   ?stage=prompt   the member's phone answered → "Calling Maria. Press 1."
//   ?stage=connect  they pressed 1 → dial the client, caller ID = the business number
//   ?stage=done     the client leg ended → the call goes on the conversation
//
// The URL carries ids only (company, member, record kind and id). Twilio's
// signature covers the query string, so they cannot be altered in flight —
// and the phone is still re-read from the record here, scoped to that
// company, and the call's own From must BE that company's live business
// number. A forged or replayed URL against another company's line fails the
// last test before anything is dialled.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTwilioWebhook } from "@/lib/sms/verifyTwilioWebhook";
import { getAppOrigin } from "@/lib/appUrl";
import { bridgeCheck } from "@/lib/businessNumber/bridge";
import { bridgePromptTwiml, bridgeConnectTwiml, hangupTwiml } from "@/lib/businessNumber/twiml";
import { fileCallOnThread } from "@/lib/businessNumber/conversation";

const xml = (body) => new NextResponse(body, { headers: { "Content-Type": "text/xml" } });

export async function POST(request) {
  const { ok, params } = await verifyTwilioWebhook(request);
  if (!ok) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const q = url.searchParams;
  const stage = q.get("stage");
  const companyId = q.get("c");
  const memberId = q.get("m");
  const kind = q.get("k");
  const id = q.get("r");
  if (!companyId || !memberId || !kind || !id) return xml(hangupTwiml());

  const check = await bridgeCheck({ companyId, memberId, kind, id }).catch(() => null);
  // Leg one goes FROM the business number, so the call's From must be this
  // company's live line. Anything else is not a call this route placed.
  if (!check?.line || check.line.e164 !== (params.From || params.Caller)) return xml(hangupTwiml());

  const pass = new URLSearchParams({ c: companyId, m: memberId, k: kind, r: id }).toString();
  const base = `${getAppOrigin(request)}/api/business-number/bridge`;
  const company = await db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } }).catch(() => null);
  const language = company?.defaultLanguage || "en";

  if (stage === "prompt") {
    // Re-asked at the moment of dialling: the hours rule is about when the
    // client's phone rings, not when the button was pressed.
    if (!check.verdict.allowed) return xml(hangupTwiml());
    const first = String(check.target?.name || "").trim().split(/\s+/)[0] || null;
    return xml(bridgePromptTwiml({ clientLabel: first, connectUrl: `${base}?stage=connect&${pass}`, language }));
  }

  if (stage === "connect") {
    if (!check.verdict.allowed) return xml(hangupTwiml());
    return xml(
      bridgeConnectTwiml({
        digits: params.Digits,
        clientE164: check.target.phone,
        businessE164: check.line.e164,
        doneUrl: `${base}?stage=done&${pass}`,
      }),
    );
  }

  if (stage === "done") {
    const member = await db.member.findFirst({ where: { id: memberId, companyId }, select: { user: { select: { name: true } } } }).catch(() => null);
    const answered = params.DialCallStatus === "completed";
    if (params.CallSid && check.target?.phone) {
      await fileCallOnThread(db, {
        companyId,
        phone: check.target.phone,
        callSid: params.CallSid,
        activity: {
          direction: "out",
          outcome: answered ? "answered" : "no_answer",
          durationSec: answered ? Number(params.DialCallDuration) || 0 : 0,
          by: member?.user?.name || null,
          party: check.target.phone,
        },
      }).catch(() => null);
    }
    return xml(hangupTwiml());
  }

  return xml(hangupTwiml());
}
