// app/api/sales/calls/state/route.js
//
// What the rep is doing right now, for the portal chrome.
//
// ══ Why a second, smaller GET ═════════════════════════════════════════════
//
// GET /api/sales/calls is the call console's load: today's attempts, today's
// activity rows, the per-rep stats, the caller-id pool and the browser-dial
// readiness, every time. That is right for a screen that is about to dial. The
// status picker is not a screen — it is in the header of every /sales page,
// and app/components/sales/RepStatus.js mounts it once in SalesShell and
// re-reads it after each change. Paying the console's load on every portal
// page for one presence row would be the wrong price, so this route answers
// the one question: the open activity row, the vocabulary the picker renders
// from, and the autodial switch.
//
// Reads only. Every transition still goes through POST /api/sales/calls
// `action: "state"`, the ONE write path lib/sales/calls/store.js's
// setRepState() sits behind — two routes that could open an activity row
// would be two places for the close-then-open transaction to drift. The
// keepalive is POST /api/sales/presence, which beats and may CLOSE a row
// but never opens one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { callStoreState, presenceFor } from "@/lib/sales/calls/store";
import { loadFloorSettings } from "@/lib/sales/calls/floorSettingsStore";
import {
  HEARTBEAT_SECONDS,
  PAUSE_REASONS,
  PAUSE_REASON_ORDER,
  PRESENCE_OFF_MINUTES,
  REP_STATES,
  STATE_ORDER,
  STATUS_CHOICES,
} from "@/lib/sales/calls/agentState";

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const now = new Date();
  const store = callStoreState();
  // The SAME derivation the floor board draws (store.js presenceFor →
  // agentState.js livePresence): the keepalive, the last call, the open
  // row and the write-up window. This request is itself a keepalive — the
  // gate stamps lastSeenAt — so a rep reading their own header is present
  // by definition, and the derivation says Available unless a call, the
  // window or their own hand says otherwise.
  const settings = await loadFloorSettings();
  const [rows, repRow] = await Promise.all([
    store.ready ? presenceFor([rep.id], { now, settings }).catch(() => null) : null,
    db.salesRep.findUnique({ where: { id: rep.id }, select: { autodial: true } }),
  ]);

  return NextResponse.json({
    store,
    presence: rows?.[0]?.presence || null,
    states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
    pauseReasons: PAUSE_REASON_ORDER.map((code) => PAUSE_REASONS[code]),
    statusChoices: STATUS_CHOICES,
    heartbeatSeconds: HEARTBEAT_SECONDS,
    offAfterMinutes: PRESENCE_OFF_MINUTES,
    afterCallSeconds: settings.afterCallSeconds,
    requireWriteUp: settings.requireWriteUp,
    autodial: repRow?.autodial === true,
    serverNow: now.toISOString(),
  });
}
