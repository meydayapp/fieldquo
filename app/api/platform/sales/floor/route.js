// app/api/platform/sales/floor/route.js
//
// The sales floor, live: who is on a call, who is writing one up, who is
// paused and for how long — and what the day's calls actually came to.
//
// ══ Read-only, and superadmin-only ════════════════════════════════════════
//
// Behind the platform-token check in middleware.js and checked again here,
// because hiding a screen is not access control. Tighter than a plain admin
// read for the same reason /api/platform/sales/performance is: this returns
// every rep's activity, their pause reasons and what they said happened on
// each call. `admin.role !== "superadmin"` is tested directly rather than
// through a permission key, following the precedent
// app/api/platform/sales/reps/route.js sets and explains — PLATFORM_PERMISSIONS
// has no sales permission, and adding one would imply the map has a scoping
// concept it does not have.
//
// ══ The team-lead version exists now, and it is the agency's ═══════════════
//
// This header said, until 2026-09-16, that `SalesRep.managerId` had no
// writer and so a team-scoped board would show an empty team and call it a
// floor. The column's first writer is lib/sales/agency.js: a call-centre
// agency adds its own reps with itself as their manager, and
// /api/sales/agency/floor draws THIS board narrowed to that team through
// lib/sales/team.js's visibleRepIds(). The reads live in
// lib/sales/calls/floorBoard.js so the two routes cannot drift; this one
// asks with no scope and adds FieldQuo's own inbound line and number pool,
// which are nobody else's business.
//
// ══ Nothing here is invented when the tables are absent ═══════════════════
//
// The store is probed, not asserted. Without SalesCallAttempt and
// SalesRepActivity this returns `store.ready: false` and the screen says what
// is missing — a floor board full of zeroes reads as a very quiet Tuesday.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { getAppOrigin } from "@/lib/appUrl";
import { inboundCalls, salesCallerNumbers } from "@/lib/sales/calls/store";
import {
  inboundWebhookUrl,
  salesVoiceInboundState,
} from "@/lib/sales/calls/inboundRouting";
import { floorBoard } from "@/lib/sales/calls/floorBoard";
import { TEAM_LEAD_CANNOT_SEE } from "@/lib/sales/team";
import { dialModeState } from "@/lib/sales/calls/dialMode";
import { inboundHandling } from "@/lib/sales/calls/inboundMatch";
import { salesAgentRow } from "@/lib/platform/salesAgent";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only superadmins can see the sales floor" },
      { status: 403 },
    );
  }

  const now = new Date();
  const board = await floorBoard({ repIds: null, now });
  const { store, period, reps, states, pauseReasons, campaigns, anyLive, notTracked, serverNow } = board;
  const { from } = period;

  if (!store.ready) {
    return NextResponse.json({
      store,
      period,
      reps,
      states,
      pauseReasons,
      campaigns: null,
      inbound: null,
      salesVoice: null,
      inboundCalls: null,
      dialMode: dialModeState(),
      notTracked,
      teamLeadCannotSee: TEAM_LEAD_CANNOT_SEE,
      serverNow,
    });
  }

  // Read apart from the board, and by DIRECTION rather than by rep,
  // because an inbound call that matched nobody carries a null salesRepId and
  // the `salesRepId: { in: repIds }` query cannot see it. A stranger ringing
  // FieldQuo's sales line is exactly the row worth noticing, and it would have
  // been the row that silently never appeared.
  //
  // `undefined` on failure rather than [], so the screen can tell "nobody rang
  // today" from "we could not look" — the two are the same empty array and
  // different facts.
  const [agent, inbound, voiceNumbers] = await Promise.all([
    salesAgentRow().catch(() => null),
    inboundCalls({ from, to: now }).catch(() => undefined),
    salesCallerNumbers().catch(() => undefined),
  ]);

  return NextResponse.json({
    store,
    period,
    reps,
    states,
    pauseReasons,
    campaigns,
    inbound: inboundHandling({
      agentEnabled: Boolean(agent?.enabled),
      canTransfer: Boolean(process.env.FIELDQUO_SALES_TRANSFER_TO),
      anyRepLive: anyLive,
    }),
    // The OTHER inbound path, and deliberately a separate answer: `inbound`
    // above is FIELDQUO_SALES_NUMBER, the one line the Retell agent answers.
    // This is the pool of local numbers reps dial from, which has no agent on
    // it. One sentence covering both would be wrong about both.
    salesVoice: salesVoiceInboundState({
      numbers: voiceNumbers ?? [],
      lookupFailed: voiceNumbers === undefined,
      transferConfigured: Boolean(process.env.FIELDQUO_SALES_TRANSFER_TO),
      anyLive,
      webhookUrl: inboundWebhookUrl(getAppOrigin(request)),
    }),
    inboundCalls:
      inbound === undefined
        ? null
        : inbound.map((row) => ({
            id: row.id,
            at: row.dialledAt,
            fromE164: row.toE164,
            rangE164: row.fromE164,
            // Who it was filed for. Null is a real answer and renders as one:
            // a call from a number nobody has ever dialled from this line.
            repName: row.salesRep?.name || null,
            businessName: row.prospect?.businessName || null,
            matchedBy: row.matchedBy,
            disposition: row.disposition,
            providerStatus: row.providerStatus,
            talkSeconds: row.talkSeconds,
            // Null means no recording stage ran. Zero seconds means one did
            // and nobody spoke — somebody who heard the beep and thought
            // better of it, which is warmer than a missed call and colder than
            // a message. The two must not be collapsed on the way to a screen.
            voicemailUrl: row.voicemailUrl || null,
            voicemailSeconds: Number.isFinite(row.voicemailSeconds) ? row.voicemailSeconds : null,
          })),
    dialMode: dialModeState(),
    notTracked,
    teamLeadCannotSee: TEAM_LEAD_CANNOT_SEE,
    serverNow,
  });
}
