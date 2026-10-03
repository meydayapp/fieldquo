// app/api/calls/bridge/route.js
//
// The "Call" button on a lead, a client and a job: FieldQuo rings the
// member's own phone, and when they press 1 it dials the client showing the
// company's BUSINESS number — never the member's cell.
//
//   GET  ?kind=lead|client|job&id=…   may this member call this record now?
//                                     The button renders only when there is a
//                                     live business number; any other reason
//                                     shows it disabled with the sentence, so
//                                     it never fails on press for a reason we
//                                     already knew.
//   POST { kind, id }                 place it
//
// ══ The number dialled comes from OUR row ═════════════════════════════════════
//
// The browser sends a kind and an id. The phone is read from that record,
// scoped to the member's company (lib/businessNumber/bridge.js) — the rule
// /api/rep-dial/bridge keeps for FieldQuo's own reps, for the same reason: a
// request that could name a number would turn the company's line into a way
// to ring anybody. Twilio's callback URLs carry ids only (no phone, no name),
// and the leg-two route re-reads the record.
//
// ══ Who may call ══════════════════════════════════════════════════════════════
//
// clientsProperties full_view — the dial that already governs client contact
// data (a crew member at name_address_only cannot see the phone, so cannot
// ring it either). Calling hours (9:00–20:00 in the client's own time zone,
// lib/voice/outbound.js CALL_WINDOW), the company's do-not-call ledger
// (CallConsent.optedOutAt) and a client's doNotContactAt are all honoured.
// Bridged calls are NOT recorded, so there is no recording disclosure to play.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { getAppOrigin } from "@/lib/appUrl";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { bridgeCheck } from "@/lib/businessNumber/bridge";
import { placeBridgeCall } from "@/lib/businessNumber/provider";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const params = new URL(request.url).searchParams;
  const { response: denied } = await levelOrRefusal(member, "clientsProperties", "full_view", "call a client");
  if (denied) return NextResponse.json({ allowed: false, show: false, reasonKey: "permission" });
  const { verdict } = await bridgeCheck({ companyId: member.companyId, memberId: member.id, kind: params.get("kind"), id: params.get("id") });
  return NextResponse.json({
    allowed: verdict.allowed,
    reasonKey: verdict.reasonKey,
    reason: verdict.reason,
    show: verdict.reasonKey !== "no_number" && verdict.reasonKey !== "not_found",
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "clientsProperties", "full_view", "call a client");
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const kind = String(body?.kind || "");
  const id = String(body?.id || "");

  const { verdict, line, memberPhone, notFound } = await bridgeCheck({ companyId: member.companyId, memberId: member.id, kind, id });
  if (!verdict.allowed) {
    return NextResponse.json({ error: verdict.reason, reasonKey: verdict.reasonKey }, { status: notFound ? 404 : 409 });
  }

  // A demo never places a real call. Its number is never `active` anyway
  // (lib/businessNumber/store.js), so this is the second lock, not the first.
  if (await isDemoCompany(member.companyId)) return NextResponse.json({ ok: true, simulated: true });

  const origin = getAppOrigin(request);
  const q = new URLSearchParams({ c: member.companyId, m: member.id, k: kind, r: id }).toString();
  try {
    const call = await placeBridgeCall({
      to: memberPhone,
      // The business number — what the client will see on leg two as well.
      from: line.e164,
      url: `${origin}/api/business-number/bridge?stage=prompt&${q}`,
      statusCallback: `${origin}/api/business-number/call-status?kind=bridge`,
    });
    return NextResponse.json({ ok: true, callSid: call.sid });
  } catch (err) {
    await recordError({ area: "business_number", code: "bridge_failed", companyId: member.companyId, message: `Call button failed: ${err?.message}` });
    return NextResponse.json({ error: "The call couldn't be started. Try again in a moment.", reasonKey: "provider" }, { status: 502 });
  }
}
