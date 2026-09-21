// app/api/sales/calls/outside/route.js
//
// The two dials that are not a prospect: a colleague's browser, and a
// typed number with no record behind it. Its own route rather than two
// more branches of /api/sales/calls, because that route's dial branch is
// the one every calling-window check reads in source order (scripts/
// check-sales-test-line.mjs, check-sales-calling-window.mjs), and neither
// of these calls is judged the way a prospect dial is.
//
// ══ A colleague's browser ═════════════════════════════════════════════════
//
// OMniLeads' "llamar a otro agente" (phoneJsController.js 241–256,
// Grupo.call_another_agent). Browser to browser, no PSTN leg, no calling
// window — there is no prospect to protect and no law on ringing a
// co-worker. Refused without the per-rep privilege, for yourself, and for
// a colleague who is not reachable right now by the same rule the transfer
// picker uses (lib/sales/calls/inboundDistribution.js reachable). Kind
// "internal": the bridge dials `<Client>` and no count reads it as a
// prospect dial.
//
// ══ A typed number outside the queue ══════════════════════════════════════
//
// OMniLeads' "llamada fuera de campaña" (Grupo.call_off_camp). Refused
// without the per-rep privilege, which is OFF by default: a dial on
// FieldQuo's account to a phone no record vouches for is the toll-fraud
// shape lib/sales/transferNumbers.js describes, and the privilege is the
// owner saying this rep may. What still binds, exactly as for a prospect:
// our own numbers, the suppression list, the calling window for the state
// the rep SAYS the phone rings in (nothing infers a state from an area
// code — callingRules.js has no permissive default), and the 24-hour cap
// on the number. Kind "off_campaign": recorded like any call, attributed
// to nobody in the pool, never counted as reach, written up like any call.
//
// ══ Never over a live call ════════════════════════════════════════════════
//
// The same liveCallFor refusal the prospect dial makes, read fresh here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { salesCallReadiness, CALL_ALLOWED, normaliseCountry, normaliseSubdivision } from "@/lib/sales/callingRules";
import { windowPolicyForProspect } from "@/lib/sales/windowOverrides";
import { isTestLine } from "@/lib/sales/testLines";
import { loadTestLines } from "@/lib/sales/testLinesStore";
import {
  CallStoreUnavailable,
  attemptsLast24h,
  callStoreState,
  liveCallFor,
  ownNumbers,
  presenceFor,
  recordDial,
  recordInternalDial,
  salesCallerNumberRows,
  setRepState,
} from "@/lib/sales/calls/store";
import { ALREADY_ON_A_CALL } from "@/lib/sales/calls/liveCall";
import { STATE_ON_CALL } from "@/lib/sales/calls/agentState";
import { firstSuppression } from "@/lib/sales/suppression";
import { callPlan } from "@/lib/sales/calls/browserDial";
import { agencyLineHoldersFor } from "@/lib/sales/calls/callerLine";
import { KIND_OFF_CAMPAIGN, internalCallPlan, offCampaignPlan } from "@/lib/sales/calls/supervision";
import { reachable, presenceOf } from "@/lib/sales/calls/inboundDistribution";

const bad = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");
  if (body.channel !== "browser") return bad("These calls can only be placed from the browser.", 409);

  const store = callStoreState();
  if (!store.ready) {
    return NextResponse.json({ error: new CallStoreUnavailable(store.missing).message, missing: store.missing }, { status: 503 });
  }
  const now = new Date();

  const live = await liveCallFor(rep.id, { now });
  if (live) {
    return NextResponse.json({ error: "You're on a call. Hang up before you dial the next one.", code: ALREADY_ON_A_CALL, liveCall: live }, { status: 409 });
  }

  // ── A colleague ─────────────────────────────────────────────────────────
  const internalToRepId = typeof body.internalToRepId === "string" ? body.internalToRepId.trim() : "";
  if (internalToRepId) {
    const [colleague, presence] = await Promise.all([
      db.salesRep.findUnique({ where: { id: internalToRepId }, select: { id: true, name: true, active: true } }).catch(() => null),
      presenceFor([internalToRepId], { now }).catch(() => null),
    ]);
    const row = Array.isArray(presence) ? presence.find((p) => p?.salesRepId === internalToRepId) : null;
    const plan = internalCallPlan({ rep, colleague, reachable: Boolean(row) && reachable(presenceOf(row), now) });
    if (!plan.ok) return bad(plan.reason, plan.code === "not_allowed" ? 403 : 409, { code: plan.code });
    const recorded = await recordInternalDial({ salesRepId: rep.id, internalToRepId, now });
    if (!recorded.ok) return bad(recorded.error, 409);
    await setRepState({ salesRepId: rep.id, to: STATE_ON_CALL, callAttemptId: recorded.attempt.id, now }).catch(() => {});
    return NextResponse.json({
      ok: true,
      attemptId: recorded.attempt.id,
      channel: "browser",
      kind: "internal",
      internal: { salesRepId: colleague.id, name: colleague.name },
      callerId: null,
      to: null,
      serverNow: now.toISOString(),
    });
  }

  // ── A number outside the queue ──────────────────────────────────────────
  const offCampaign = body.offCampaign && typeof body.offCampaign === "object" ? body.offCampaign : null;
  if (!offCampaign) return bad("Say who to call: a colleague (internalToRepId) or a number (offCampaign).");

  const ours = await ownNumbers().catch(() => []);
  const country = normaliseCountry(offCampaign.country);
  const province = normaliseSubdivision(offCampaign.province);
  const plan = offCampaignPlan({ rep, typed: offCampaign.e164, country, province, ownNumbers: ours });
  if (!plan.ok) return bad(plan.reason, plan.code === "not_allowed" ? 403 : 409, { code: plan.code });

  // The suppression list binds a typed number exactly as it binds a listed
  // one — lib/sales/suppression.js, fail-closed on a lookup that throws.
  const suppression = await firstSuppression(db, { channel: "phone", phones: [plan.e164] });
  if (suppression?.suppressed) {
    return NextResponse.json(
      { error: suppression.reason || "They asked us to stop contacting them.", suppressed: true, optedOut: true, lift: "Only a superadmin can lift a do-not-contact, and it needs a written reason." },
      { status: 409 },
    );
  }

  const testLines = await loadTestLines();
  const testAccount = rep.testAccount === true;
  const attempts24h = await attemptsLast24h(plan.e164, { now });
  const readiness = salesCallReadiness({
    prospect: { country, province },
    timeZone: null,
    attemptsLast24h: attempts24h,
    now,
    windowPolicy: await windowPolicyForProspect({ country, province }, { now }),
    testLine: isTestLine(plan.e164, testLines),
    testAccount,
  });
  if (readiness.decision !== CALL_ALLOWED) {
    return NextResponse.json({ error: "This call is not allowed right now.", compliance: readiness }, { status: 409 });
  }

  const [callerNumbers, agencyIds] = await Promise.all([salesCallerNumberRows(), agencyLineHoldersFor(rep.id).catch(() => [])]);
  const planned = callPlan({ toE164: plan.e164, readiness, callerNumbers, salesRepId: rep.id, agencyRepIds: agencyIds, ownNumbers: ours });
  if (!planned.ok) return bad(planned.reason, 409);

  const recorded = await recordDial({
    salesRepId: rep.id,
    prospectId: null,
    leadId: null,
    toE164: plan.e164,
    fromE164: planned.callerId,
    callerIdRule: planned.callerIdRule,
    dialChannel: "browser",
    dialSource: "manual",
    readiness,
    kind: KIND_OFF_CAMPAIGN,
    now,
  });
  if (!recorded.ok) return bad(recorded.error, 409);
  await setRepState({ salesRepId: rep.id, to: STATE_ON_CALL, callAttemptId: recorded.attempt.id, now }).catch(() => {});

  return NextResponse.json({
    ok: true,
    attemptId: recorded.attempt.id,
    channel: "browser",
    kind: "off_campaign",
    callerId: planned.callerId,
    callerIdRule: planned.callerIdRule,
    to: plan.e164,
    typedNotSaved: true,
    askToSave: false,
    compliance: readiness,
    attemptsLast24h: attempts24h,
    serverNow: now.toISOString(),
  });
}
