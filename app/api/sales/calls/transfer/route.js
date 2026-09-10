// app/api/sales/calls/transfer/route.js
//
// The rep's end of a transfer: who can I hand this to, hand it, put them
// through, never mind.
//
// ══ Every decision is somewhere else ══════════════════════════════════════
//
// lib/sales/calls/transfer.js says who is a valid target, whether a transfer
// may start, and what each event means. lib/sales/calls/transferRest.js does
// what it decided to Twilio. This file reads rows, calls the first, hands the
// answer to the second, and writes down what happened. That split is what lets
// scripts/check-call-transfer.mjs drive every branch — nobody reachable, the
// target being the transferrer, a rep who hung up mid-transfer — with no
// database, no conference and no phone.
//
// ══ THE BROWSER'S PICK IS NOT TRUSTED ═════════════════════════════════════
//
// The screen shows a list of reachable reps, and the rep presses one. That
// list is a courtesy. This route rebuilds it from presence rows read in THIS
// request and refuses a target that is not in the fresh copy — the same
// discipline app/api/sales/calls applies to the calling window, and for the
// same reason: a picker can be open for ten minutes, and the person on it can
// have gone home.
//
// What it also means is that no CallSid ever arrives from the browser. The
// caller's leg and the rep's own leg are read off the SalesCallAttempt row, so
// there is no request shape in which one rep can put another rep's call on
// hold.
//
// ══ Guard, then act, in that order ════════════════════════════════════════
//
// Every state change is a conditional update — `advanceTransfer` matches on
// the state it expects to be moving FROM — and Twilio is only touched once
// that update reports it was the writer. Twilio redelivers webhooks and a
// conference emits three join events inside a second; acting first and writing
// afterwards would let two handlers both "complete" the same transfer, and the
// second one hangs up a rep who is already talking to somebody else.
export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCallingRep } from "@/lib/sales/calls/gate";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import {
  callStoreState,
  openTransferFor,
  presenceFor,
  startTransfer,
  advanceTransfer,
  attachTransferTarget,
  transferById,
  transferStoreState,
} from "@/lib/sales/calls/store";
import {
  conferenceNameFor,
  describeTransfer,
  onCancel,
  onComplete,
  startTransferPlan,
  transferTargets,
  TRANSFER_KINDS,
  XFER_FAILED,
} from "@/lib/sales/calls/transfer";
import {
  applyTransferActions,
  dialTransferTarget,
  moveCallerToConference,
} from "@/lib/sales/calls/transferRest";

const ACTIONS = ["start", "complete", "cancel"];
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

/**
 * The reps this rep may hand a call to, from presence read now.
 *
 * `active: true` rather than every row: a rep who has left has no browser open
 * and putting their name on a transfer list is a promise the product cannot
 * keep. Presence then removes everyone whose heartbeat has gone stale, through
 * inboundDistribution's `reachable` — one opinion about availability, shared
 * with the inbound router.
 */
async function freeTargetsFor(repId) {
  const reps = await db.salesRep
    .findMany({ where: { active: true }, select: { id: true, name: true } })
    .catch(() => []);
  const presence = await presenceFor(reps.map((r) => r.id)).catch(() => null);
  return transferTargets({
    reps,
    presence,
    excludeRepId: repId,
    transferTo: normalisePhone(process.env.FIELDQUO_SALES_TRANSFER_TO),
  });
}

/** The attempt, scoped to this rep. A mismatched pair matches nothing. */
async function attemptFor(repId, attemptId) {
  if (!attemptId) return null;
  return db.salesCallAttempt
    .findFirst({
      where: { id: attemptId, salesRepId: repId },
      select: {
        id: true,
        toE164: true,
        fromE164: true,
        providerCallSid: true,
        repCallSid: true,
        endedAt: true,
      },
    })
    .catch(() => null);
}

export async function GET(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = transferStoreState();
  const attemptId = new URL(request.url).searchParams.get("attemptId");

  if (!store.ready || !callStoreState().ready) {
    // Reported rather than thrown, and the screen renders NO transfer control
    // when `ready` is false. A picker that throws on press is the dead button
    // AGENTS.md opens by forbidding; saying the table is not there is honest.
    return NextResponse.json({ ready: false, missing: store.missing, targets: [], transfer: null });
  }

  const attempt = await attemptFor(rep.id, attemptId);
  const [targets, transfer] = await Promise.all([
    freeTargetsFor(rep.id),
    attempt ? openTransferFor(attempt.id) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    ready: true,
    missing: [],
    // Whether this particular call could be transferred at all, said before
    // the rep presses anything. `transferable` false with a reason beats a
    // button that refuses.
    transferable: Boolean(attempt?.providerCallSid && attempt?.repCallSid),
    targets,
    transfer: transfer
      ? {
          id: transfer.id,
          kind: transfer.kind,
          state: transfer.state,
          toRepId: transfer.toRepId,
          toE164: transfer.toE164,
          failureReason: transfer.failureReason,
          describe: describeTransfer(transfer, {
            targetName:
              targets.find((t) => t.salesRepId === transfer.toRepId)?.name || transfer.toE164 || null,
          }),
        }
      : null,
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireCallingRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const store = transferStoreState();
  if (!store.ready || !callStoreState().ready) {
    return NextResponse.json(
      {
        error:
          "Transfers are not in this database yet. SalesCallTransfer is missing from the generated client; run `npx prisma db push`.",
        missing: store.missing,
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return bad("Expected a JSON body.");
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action)) {
    return bad(`Unknown action. This route does ${ACTIONS.join(", ")}.`);
  }

  const origin = getAppOrigin(request);

  if (action === "start") {
    const attempt = await attemptFor(rep.id, typeof body.attemptId === "string" ? body.attemptId.trim() : "");
    if (!attempt) return bad("That is not one of your calls.", 404);

    const already = await openTransferFor(attempt.id);
    if (already) {
      return bad("This call is already being transferred. Finish or cancel that one first.", 409);
    }

    const targets = await freeTargetsFor(rep.id);
    const plan = startTransferPlan({
      kind: TRANSFER_KINDS.includes(body.kind) ? body.kind : null,
      targetKey: typeof body.targetKey === "string" ? body.targetKey : null,
      targets,
      attempt,
    });
    if (!plan.ok) return bad(plan.reason, 409);

    // The id is minted here so the conference can be named from it in the same
    // write. See the note on startTransfer.
    const id = randomUUID();
    const conferenceName = conferenceNameFor(id);
    if (!conferenceName) return bad("That transfer could not be named.", 500);

    const created = await startTransfer({
      id,
      attemptId: attempt.id,
      fromRepId: rep.id,
      toRepId: plan.target.salesRepId || null,
      toE164: plan.target.kind === "number" ? plan.target.value : null,
      kind: plan.kind,
      conferenceName,
      callerCallSid: plan.callerCallSid,
      repCallSid: plan.repCallSid,
    });
    if (!created.ok) return bad(created.error, 503);

    // ── The caller moves first, and the rep follows on their own ─────────
    //
    // Redirecting the caller ends the bridge's `<Dial>`, which sends the rep's
    // leg to that Dial's `action` — /api/rep-dial/transfer?stage=rep-leg —
    // where it joins the same conference. Trying to redirect the rep's leg
    // here instead would cancel the `<Dial>` and hang the caller up.
    try {
      await moveCallerToConference({ transfer: created.transfer, origin });
    } catch (err) {
      await advanceTransfer({
        id,
        fromState: "ringing",
        toState: XFER_FAILED,
        failureReason: "the caller could not be moved into the transfer",
        endedAt: new Date(),
      });
      await recordError({
        area: "sales_dial",
        code: "transfer_move_failed",
        message: `A transfer on attempt ${attempt.id} could not move the caller: ${err?.message}`,
      }).catch(() => {});
      return bad("That call could not be moved into a transfer. You are still on with them.", 502);
    }

    try {
      const placed = await dialTransferTarget({
        transfer: created.transfer,
        target: plan.target,
        fromE164: attempt.fromE164,
        origin,
        ringSeconds: plan.ringSeconds,
      });
      if (!placed.ok) throw new Error(placed.error);
      await attachTransferTarget({ id, targetCallSid: placed.callSid });
    } catch (err) {
      // The caller is already in the conference and the rep is on their way
      // in. Nobody is dropped: the transfer is marked failed, the rep's screen
      // says so, and they are back with the caller as soon as both are off
      // hold — which the conference join events do.
      await advanceTransfer({
        id,
        fromState: "ringing",
        toState: XFER_FAILED,
        failureReason: "the transfer leg could not be placed",
        endedAt: new Date(),
      });
      await applyTransferActions({
        actions: [
          { type: "unhold", who: "rep" },
          { type: "unhold", who: "caller" },
        ],
        transfer: created.transfer,
        origin,
      }).catch(() => {});
      await recordError({
        area: "sales_dial",
        code: "transfer_dial_failed",
        message: `A transfer on attempt ${attempt.id} could not ring its target: ${err?.message}`,
      }).catch(() => {});
      return bad("That person could not be rung. You are still on with the caller.", 502);
    }

    return NextResponse.json({
      ok: true,
      transfer: {
        id,
        kind: plan.kind,
        state: "ringing",
        toRepId: plan.target.salesRepId || null,
        toE164: plan.target.kind === "number" ? plan.target.value : null,
        describe: describeTransfer(
          { id, kind: plan.kind, state: "ringing" },
          { targetName: plan.target.name || plan.target.value },
        ),
      },
    });
  }

  // complete / cancel — both act on a transfer this rep started.
  const transferId = typeof body.transferId === "string" ? body.transferId.trim() : "";
  if (!transferId) return bad("Which transfer?");
  const transfer = await transferById(transferId);
  if (!transfer || transfer.fromRepId !== rep.id) {
    return bad("That is not one of your transfers.", 404);
  }

  const result =
    action === "complete"
      ? onComplete({ transfer, byRepId: rep.id })
      : onCancel({ transfer, byRepId: rep.id });
  if (!result.ok) return bad(result.reason, 409);

  const moved = await advanceTransfer({
    id: transfer.id,
    fromState: transfer.state,
    toState: result.state,
    endedAt: new Date(),
  });
  if (!moved.applied) {
    // Somebody else got there first — the target answered, or hung up, in the
    // moment between the read and the write. Not an error to the rep; the
    // screen re-reads and shows whatever actually happened.
    return NextResponse.json({ ok: false, raced: true, state: null });
  }

  const applied = await applyTransferActions({ actions: result.actions, transfer, origin });
  if (!applied.ok) {
    await recordError({
      area: "sales_dial",
      code: "transfer_action_failed",
      message: `Transfer ${transfer.id} could not apply ${applied.failed.map((f) => f.action.type).join(", ")}: ${applied.failed.map((f) => f.error).join("; ")}`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    raced: false,
    state: result.state,
    // Said even when an action failed, because the row moved and the rep needs
    // to know which half worked. Silence here is how a rep ends up talking
    // into a conference nobody can hear.
    warning: applied.ok ? null : "Some of that did not take effect. Check you can still hear the caller.",
  });
}
