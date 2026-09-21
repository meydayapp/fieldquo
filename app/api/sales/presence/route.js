// app/api/sales/presence/route.js
//
// The portal's keepalive. "Still here" — and, once, "leaving".
//
// ══ Why presence needed a route of its own ═══════════════════════════════
//
// Until 2026-09-21 the board knew a rep by the last button they pressed.
// The shell beat once a minute through POST /api/sales/calls `action:
// "heartbeat"`, but only while the row said anything but offline, and the
// beat aged a row without being able to say the rep was THERE. So a rep who
// pressed Off at the end of a call and kept working was Off all afternoon;
// a rep who shut the laptop in "writing it up" was writing it up for three
// days. lib/sales/calls/agentState.js's header has the model that replaced
// it: presence is derived from this keepalive, and this route is the
// keepalive.
//
// POST { leaving?: boolean }
//
//   - stamps SalesRep.lastSeenAt through the gate's own fenced writer
//     (lib/sales/gate.js stampLastSeen — the ONE column a rep route may
//     write on their own row, argued there), and beats the open activity
//     row through store.js heartbeat(), which also closes a row the rep
//     walked away from (its header says which).
//   - `leaving: true` is the shell's last word from the last tab (pagehide
//     with no other portal tab alive — app/components/sales/presenceBeat.js)
//     and writes an `offline` row through setRepState, the same path
//     sign-out takes. It is the ONLY way besides sign-out that an offline
//     row is written; the state action refuses the word from a screen.
//
// Answers with the derived presence so the shell can draw it without a
// second read.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { stampLastSeen } from "@/lib/sales/gate";
import { callStoreState, heartbeat, presenceFor, setRepState } from "@/lib/sales/calls/store";
import { STATE_OFFLINE } from "@/lib/sales/calls/agentState";

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const now = new Date();
  const body = await request.json().catch(() => ({}));
  const leaving = body?.leaving === true;

  await stampLastSeen(rep.id, now);
  const store = callStoreState();
  let beat = { ok: false, updated: 0, closed: 0 };
  if (store.ready) {
    beat = await heartbeat(rep.id, { now }).catch(() => ({ ok: false, updated: 0, closed: 0 }));
    if (leaving) {
      // A leave from any state. Soft: a refused transition (already
      // offline) is not an error the browser can act on, it is unloading.
      await setRepState({ salesRepId: rep.id, to: STATE_OFFLINE, now }).catch(() => {});
    }
  }
  const rows = store.ready ? await presenceFor([rep.id], { now }).catch(() => null) : null;
  return NextResponse.json({
    ok: true,
    store,
    beat,
    leaving,
    presence: rows?.[0]?.presence || null,
    serverNow: now.toISOString(),
  });
}
