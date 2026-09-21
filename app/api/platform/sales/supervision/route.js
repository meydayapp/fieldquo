// app/api/platform/sales/supervision/route.js
//
// A superadmin acts on a rep's live call: start listening, whispering or
// barging; switch between those; take the call; leave. And the board asks
// what state a call is in.
//
// ══ Superadmin only, on every action, checked here ════════════════════════
//
// The platform-token check in middleware.js is not enough: this hangs up
// legs and puts a stranger on a live call. `admin.role !== "superadmin"`
// is tested directly, following /api/platform/sales/floor and its reason
// (PLATFORM_PERMISSIONS has no sales permission; adding one would imply a
// scoping concept the map does not have). The model is OMniLeads'
// InteraccionDeSupervisorSobreAgenteView (api_app/views/supervisor.py
// 275–305): one POST, one action word, a profile check, a refusal in words.
//
// ══ The server decides the mode; the browser only connects ════════════════
//
// `start` writes supervisedBy + supervisionKind on the row FIRST, under a
// conditional update that fails if somebody else holds the lock, and only
// then tells the browser to connect. The bridge (app/api/rep-dial/bridge)
// reads the mode off the row when the supervisor's leg arrives. There is no
// request shape that puts a browser into a room the row does not name it
// on, and no parameter that chooses a mode.
//
// ══ Every action is a SalesCallEvent and a platform audit row ═════════════
//
// Who, what, which attempt, when — and on the closing edge, how long.
// SalesCallEvent is the call's own log (what the transcript reviewer and
// the hold-time report read); PlatformAuditLog is where every act by
// FieldQuo staff already lives, and "what did the platform do to this
// rep's call" must be one search there.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { recordError } from "@/lib/platform/errorLog";
import {
  EV_SUPERVISION_END,
  SUP_TAKE,
  changeSupervisionPlan,
  endSupervisionPlan,
  eventForKind,
  startSupervisionPlan,
  takePlan,
} from "@/lib/sales/calls/supervision";
import { applyTakeActions, hangupLeg, updateParticipant } from "@/lib/sales/calls/supervisionRest";
import {
  claimSupervision,
  loadSupervisionSettings,
  recordCallEvent,
  supervisionAttempt,
  writeAttempt,
} from "@/lib/sales/calls/supervisionStore";

const ACTIONS = ["start", "mode", "take", "leave"];
const bad = (error, status = 400, extra = {}) => NextResponse.json({ error, ...extra }, { status });

async function gate(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { admin: null, refusal: bad("Unauthorized", 401) };
  if (admin.role !== "superadmin") return { admin: null, refusal: bad("Only superadmins can supervise calls.", 403) };
  return { admin, refusal: null };
}

async function audit(adminId, action, details) {
  await db.platformAuditLog.create({ data: { platformAdminId: adminId, action, details } }).catch(() => {});
}

/** What the board's live bar polls: the row's supervision columns, as facts. */
function stateOf(attempt, adminId) {
  if (!attempt) return null;
  return {
    attemptId: attempt.id,
    salesRepId: attempt.salesRepId,
    ended: Boolean(attempt.endedAt),
    conference: Boolean(attempt.conferenceName),
    held: Boolean(attempt.heldAt),
    heldAt: attempt.heldAt ? new Date(attempt.heldAt).toISOString() : null,
    supervisedBy: attempt.supervisedBy,
    mine: Boolean(attempt.supervisedBy && attempt.supervisedBy === adminId),
    kind: attempt.supervisionKind,
    joined: Boolean(attempt.supervisorCallSid),
    since: attempt.supervisedAt ? new Date(attempt.supervisedAt).toISOString() : null,
    supervisionSeconds: attempt.supervisionSeconds,
  };
}

export async function GET(request) {
  const { admin, refusal } = await gate(request);
  if (refusal) return refusal;
  const attemptId = new URL(request.url).searchParams.get("attemptId");
  if (!attemptId) return bad("Which call?");
  const attempt = await supervisionAttempt(attemptId);
  if (!attempt) return bad("No such call.", 404);
  return NextResponse.json({ state: stateOf(attempt, admin.id), serverNow: new Date().toISOString() });
}

export async function POST(request) {
  const { admin, refusal } = await gate(request);
  if (refusal) return refusal;

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action)) return bad(`Unknown action. This route does ${ACTIONS.join(", ")}.`);
  const attemptId = typeof body.attemptId === "string" ? body.attemptId.trim() : "";
  if (!attemptId) return bad("Which call?");
  const kind = typeof body.kind === "string" ? body.kind : null;
  const now = new Date();

  // Read fresh, every time. A screen fifteen seconds old is a courtesy.
  const attempt = await supervisionAttempt(attemptId);
  if (!attempt) return bad("That call is not on the board any more.", 404);

  if (action === "start") {
    const settings = await loadSupervisionSettings();
    const plan = startSupervisionPlan({ attempt, adminId: admin.id, kind, settings, now });
    if (!plan.ok) return bad(plan.reason, 409, { code: plan.code });
    // Take starts as a barge: the leg joins audibly, and the browser posts
    // `take` once the bridge has recorded the supervisor's CallSid. Writing
    // "take" now would make participantLeavePlan keep a room the rep left
    // before the supervisor ever arrived.
    const lock = kind === SUP_TAKE ? { ...plan.lock, supervisionKind: "barge" } : plan.lock;
    const claimed = await claimSupervision({ attemptId, adminId: admin.id, lock });
    if (!claimed.claimed) {
      return bad("Somebody else is already on this call. One supervisor at a time.", 409, { code: "taken" });
    }
    await recordCallEvent({ attemptId, event: eventForKind(lock.supervisionKind), platformAdminId: admin.id, at: now, detail: { requested: kind } });
    await audit(admin.id, `sales_call_${lock.supervisionKind}`, { attemptId, salesRepId: attempt.salesRepId, requested: kind });
    const fresh = await supervisionAttempt(attemptId);
    return NextResponse.json({ ok: true, state: stateOf(fresh, admin.id), serverNow: now.toISOString() });
  }

  if (action === "mode") {
    const plan = changeSupervisionPlan({ attempt, adminId: admin.id, kind });
    if (!plan.ok) return bad(plan.reason, 409, { code: plan.code });
    if (plan.update) {
      const r = await updateParticipant({ attempt, callSid: attempt.supervisorCallSid, update: plan.update });
      if (!r.ok) {
        await recordError({ area: "sales_dial", code: "supervision_mode_failed", message: `Attempt ${attemptId}: could not switch supervision to ${kind}: ${r.error}` }).catch(() => {});
        return bad(`The carrier refused the change: ${r.error}`, 502);
      }
      await writeAttempt({ attemptId, data: { supervisionKind: kind } });
      await recordCallEvent({ attemptId, event: plan.event, platformAdminId: admin.id, at: now });
      await audit(admin.id, `sales_call_${kind}`, { attemptId, salesRepId: attempt.salesRepId, from: attempt.supervisionKind });
    }
    const fresh = await supervisionAttempt(attemptId);
    return NextResponse.json({ ok: true, state: stateOf(fresh, admin.id), serverNow: now.toISOString() });
  }

  if (action === "take") {
    const plan = takePlan({ attempt, adminId: admin.id });
    if (!plan.ok) return bad(plan.reason, 409, { code: plan.code });
    const applied = await applyTakeActions({
      actions: plan.actions,
      attempt,
      mark: async (k) => {
        await writeAttempt({ attemptId, data: { supervisionKind: k } });
      },
    });
    await recordCallEvent({ attemptId, event: eventForKind(SUP_TAKE), platformAdminId: admin.id, at: now, detail: applied.ok ? null : { failed: applied.failed } });
    await audit(admin.id, "sales_call_take", { attemptId, salesRepId: attempt.salesRepId, ok: applied.ok });
    if (!applied.ok) {
      await recordError({
        area: "sales_dial",
        code: "supervision_take_failed",
        message: `Attempt ${attemptId}: take could not ${applied.failed.map((f) => f.action.type).join(", ")}: ${applied.failed.map((f) => f.error).join("; ")}`,
      }).catch(() => {});
      return bad(`Could not take the call: ${applied.failed.map((f) => f.error).join("; ")}`, 502);
    }
    const fresh = await supervisionAttempt(attemptId);
    return NextResponse.json({ ok: true, state: stateOf(fresh, admin.id), serverNow: now.toISOString() });
  }

  // leave
  if (attempt.supervisedBy !== admin.id) return bad("You are not on this call.", 409, { code: "not_yours" });
  const hung = await hangupLeg(attempt.supervisorCallSid);
  if (!hung.ok) {
    await recordError({ area: "sales_dial", code: "supervision_leave_failed", message: `Attempt ${attemptId}: the supervisor's leg could not be hung up: ${hung.error}` }).catch(() => {});
  }
  // The conference callback's participant-leave will also try to close the
  // stint; both are idempotent on a row whose lock is already released.
  const end = endSupervisionPlan({ attempt, now });
  if (end.changed) {
    await writeAttempt({ attemptId, data: end.data });
    await recordCallEvent({ attemptId, event: EV_SUPERVISION_END, platformAdminId: admin.id, seconds: end.seconds, at: now, detail: { reason: "leave", kind: attempt.supervisionKind } });
    await audit(admin.id, "sales_call_supervision_ended", { attemptId, salesRepId: attempt.salesRepId, seconds: end.seconds, kind: attempt.supervisionKind });
  }
  const fresh = await supervisionAttempt(attemptId);
  return NextResponse.json({ ok: true, state: stateOf(fresh, admin.id), serverNow: now.toISOString() });
}
