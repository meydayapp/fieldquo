// app/api/cron/voice-outbound/route.js
//
// Every 15 minutes: place the outbound calls that are due and allowed.
//
// ══ Frequent, small batches ════════════════════════════════════════════════
//
// Fifteen minutes, not hourly, because the useful window for a "confirm your
// quote" call is the same day it was approved — and because calling hours span
// a working day, a tighter cadence spreads calls out instead of firing a burst
// on the hour. A cap per run keeps one company's backlog from starving the
// rest.
//
// ══ Every gate lives in placeQueuedCall, not here ══════════════════════════
//
// Consent, calling hours, credit, a working number — all re-checked at dial
// time inside placeQueuedCall. Nothing about WHETHER to ring somebody is
// decided here.
//
// ══ And the queue mechanics live in drainOutboundQueue ═════════════════════
//
// The loop that used to sit in this file selected `queued` rows and wrote their
// outcome back afterwards, with nothing claimed in between — so two overlapping
// invocations dialled the same person twice. The claim, the stale-claim
// recovery and the outcome writing are now in lib/voice/drainOutbound.js, for
// the same reason lib/voice/reconcileCalls.js is not in its cron either: a
// decision that costs a real phone call is worth executing in a check script,
// and nothing in a route file ever is. This route is the schedule and the
// secret, and nothing else.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { drainOutboundQueue } from "@/lib/voice/drainOutbound";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const tally = await drainOutboundQueue({ now: new Date() });

  return NextResponse.json({ success: true, ...tally });
}
