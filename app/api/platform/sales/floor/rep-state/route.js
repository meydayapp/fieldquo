// app/api/platform/sales/floor/rep-state/route.js
//
// A supervisor's hand on a rep's state: Pause (reason "supervision"), Make
// available, Sign out — the three buttons on a /platform/sales/floor card.
//
// ══ The model, read in place ══════════════════════════════════════════════
//
// OMniLeads services/asterisk/supervisor_activity.py
// ejecutar_accion_sobre_agente (78–100): AGENTPAUSE writes the reserved
// pause id '00' "Supervision" and notifies the agent, AGENTUNPAUSE unpauses,
// AGENTLOGOUT calls force_logout + logout_agent + the presence log-out. The
// same three here, each an activity-ledger row attributed to the admin
// (SalesRepActivity.setByAdminId), each audit-logged, and the rep's own
// header shows what happened on its next keepalive: "A supervisor paused
// you" from the row, "A supervisor signed you out" from the gate refusing
// the token (lib/sales/auth.js sessionSuperseded) — at which point the
// portal stops beating and tears its Twilio Device down.
//
// ══ Superadmin only, and it says so ═══════════════════════════════════════
//
// This is the one platform route that changes what a rep's screen does. It
// sits behind superadminOrRefusal — not a plain admin read, not a
// permission key (PLATFORM_PERMISSIONS has no sales scope, and adding one
// would imply the map has a scoping concept it does not) — and every
// action is refused for a rep who is not active. The write path is the ONE
// setRepState; nothing here opens a row of its own.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { STATE_AVAILABLE, STATE_PAUSED } from "@/lib/sales/calls/agentState";
import { callStoreState, presenceFor, setRepState } from "@/lib/sales/calls/store";
import { endSessionByAdmin } from "@/lib/sales/sessionWrite";
import { SUPERVISOR_ACTIONS } from "@/lib/sales/calls/supervisorActions";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const repId = typeof body?.repId === "string" ? body.repId.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";
  if (!repId || !SUPERVISOR_ACTIONS.includes(action)) {
    return bad(`Send { repId, action } with action one of ${SUPERVISOR_ACTIONS.join(", ")}.`);
  }
  const store = callStoreState();
  if (!store.ready) return bad("The presence tables are not in the database yet.", 503);

  const rep = await db.salesRep.findUnique({ where: { id: repId }, select: { id: true, name: true, active: true } });
  if (!rep || !rep.active) return bad("That rep is not on the floor.", 404);

  const now = new Date();
  let result;
  if (action === "pause") {
    result = await setRepState({ salesRepId: repId, to: STATE_PAUSED, pauseReason: "supervision", setByAdminId: admin.id, now });
  } else if (action === "available") {
    result = await setRepState({ salesRepId: repId, to: STATE_AVAILABLE, setByAdminId: admin.id, now });
  } else {
    const ended = await endSessionByAdmin({ salesRepId: repId, adminId: admin.id, now });
    result = ended.ok ? { ok: true, error: null } : { ok: false, error: ended.error };
  }
  // A refused transition (already paused by supervision, already available)
  // is a sentence, not a 500 — the board prints it under the buttons.
  if (!result.ok) return bad(result.error || "That state change was refused.", 409);

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: `sales_rep_state_${action}`,
      details: { salesRepId: repId, repName: rep.name, at: now.toISOString() },
    },
  });

  const rows = await presenceFor([repId], { now }).catch(() => null);
  return NextResponse.json({ ok: true, action, presence: rows?.[0]?.presence || null, serverNow: now.toISOString() });
}
