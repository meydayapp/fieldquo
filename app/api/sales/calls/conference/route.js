// app/api/sales/calls/conference/route.js
//
// The rep's side of a conference-mode call: put the prospect on hold, take
// them off it, and ask what else is true about the call right now — held
// since when, and whether a supervisor is on it.
//
// ══ Hold is the prospect's participant, not the rep's microphone ══════════
//
// The OMniLeads console holds by SIP re-INVITE from the agent's phone
// (phoneJsSip.js 262–270, `session.hold()`), which is the only lever a SIP
// softphone has. Twilio's lever is per-participant: `Hold=true` on the
// PROSPECT's participant plays them music and takes them out of the mix,
// so the rep's microphone is off the call without the rep having to press
// Mute — and a Mute they forget to undo is not a way to come back. Resume
// is `Hold=false`. Both edges are SalesCallEvent rows with a time
// (ApiEventoHold, api_app/views/agente.py 610–640), and the closing edge
// adds the seconds to SalesCallAttempt.holdSeconds — the column
// lib/sales/calls/reporting.js measuredDurations has read since the table
// landed and nothing wrote until now.
//
// ══ Scoped to the rep on the call, decided by supervision.js ══════════════
//
// holdPlan refuses a call that is not this rep's, not in a conference (a
// plain `<Dial>` bridge has no hold; the route says so rather than muting
// and calling it hold), not yet connected, already in the state asked for,
// or taken by a supervisor. The participant update is conditional on the
// plan, and the plan is pure so the check script drives every refusal.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { recordError } from "@/lib/platform/errorLog";
import { holdPlan, repNotice } from "@/lib/sales/calls/supervision";
import { updateParticipant } from "@/lib/sales/calls/supervisionRest";
import {
  loadSupervisionSettings,
  recordCallEvent,
  supervisionAttempt,
  writeAttempt,
} from "@/lib/sales/calls/supervisionStore";

const bad = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });

/** What the rep's strip draws. Nothing here ever reaches the prospect. */
async function stateFor(attempt, settings) {
  let supervisorName = null;
  if (attempt?.supervisedBy) {
    const admin = await db.platformAdmin.findUnique({ where: { id: attempt.supervisedBy }, select: { email: true } }).catch(() => null);
    // The console has no display name; the local part of the email is the
    // name the floor already knows them by.
    supervisorName = admin?.email ? admin.email.split("@")[0] : null;
  }
  return {
    attemptId: attempt.id,
    conference: Boolean(attempt.conferenceName),
    canHold: Boolean(attempt.conferenceName) && attempt.kind !== "internal",
    held: Boolean(attempt.heldAt),
    heldAt: attempt.heldAt ? new Date(attempt.heldAt).toISOString() : null,
    holdSeconds: Number.isFinite(attempt.holdSeconds) ? attempt.holdSeconds : 0,
    taken: attempt.supervisionKind === "take" && Boolean(attempt.supervisedBy),
    supervision: repNotice({ attempt, settings, supervisorName }),
  };
}

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId) return bad("Which call?");
  const attempt = await supervisionAttempt(attemptId);
  // Scoped in words rather than by a 403 that confirms the row exists.
  if (!attempt || attempt.salesRepId !== rep.id) return bad("No such call.", 404);
  const settings = await loadSupervisionSettings();
  return NextResponse.json({ state: await stateFor(attempt, settings), serverNow: new Date().toISOString() });
}

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");
  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "hold" && action !== "unhold") return bad("Unknown action. This route does hold, unhold.");
  const attemptId = typeof body.attemptId === "string" ? body.attemptId.trim() : "";
  if (!attemptId) return bad("Which call?");

  const now = new Date();
  const [attempt, settings] = await Promise.all([supervisionAttempt(attemptId), loadSupervisionSettings()]);
  if (!attempt || attempt.salesRepId !== rep.id) return bad("No such call.", 404);

  const plan = holdPlan({ attempt, repId: rep.id, hold: action === "hold", settings, now });
  if (!plan.ok) return bad(plan.reason, 409, { code: plan.code });

  const r = await updateParticipant({ attempt, callSid: attempt.providerCallSid, update: plan.participant });
  if (!r.ok) {
    await recordError({ area: "sales_dial", code: "hold_failed", message: `Attempt ${attemptId}: ${action} refused by the carrier: ${r.error}` }).catch(() => {});
    return bad(action === "hold" ? "They could not be put on hold. You are still connected." : "They could not be taken off hold. Try again.", 502);
  }
  await writeAttempt({ attemptId, data: plan.data });
  await recordCallEvent({ attemptId, event: plan.event, salesRepId: rep.id, seconds: plan.seconds, at: now });

  const fresh = await supervisionAttempt(attemptId);
  return NextResponse.json({ ok: true, state: await stateFor(fresh, settings), serverNow: now.toISOString() });
}
