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
// ══ NO NUMBER ARRIVES FROM THE BROWSER EITHER ═════════════════════════════
//
// A phone target is a label and an opaque id on the screen. The id is
// resolved against lib/sales/transferNumbers.js's allow-list, read from the
// PlatformSetting in THIS request, and the E.164 that gets dialled is the
// list's, never the body's. `publicTarget` strips the number out of the GET
// so it does not even make the trip out. A transfer leg is an outbound call
// on FieldQuo's account; a typed destination would be toll fraud with a
// friendlier name.
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
import { agencyOf } from "@/lib/sales/agencyLabel";
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
  publicTarget,
  queueTransferActions,
  startTransferPlan,
  transferTargets,
  MOVE_REP,
  TRANSFER_KINDS,
  TRANSFER_QUEUE,
  XFER_COMPLETED,
  XFER_FAILED,
} from "@/lib/sales/calls/transfer";
import { loadTransferNumbers } from "@/lib/sales/transferNumbersStore";
import {
  applyTransferActions,
  dialTransferTarget,
  moveCallerToConference,
  moveRepToConference,
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
    .findMany({
      where: { active: true },
      select: { id: true, name: true, kind: true, engagement: true, managerId: true, manager: { select: { id: true, kind: true, name: true } } },
    })
    .catch(() => []);
  const [presence, transferNumbers] = await Promise.all([
    presenceFor(reps.map((r) => r.id)).catch(() => null),
    // The allow-list, read now. A failed read is an empty list and the
    // picker says "no phone", never a number remembered from last time.
    loadTransferNumbers(),
  ]);
  const me = reps.find((r) => r.id === repId) || null;
  // An agency employee's own agency; an agency account's own id; null for
  // FieldQuo's reps and freelancers. Teammates first — lib/sales/agencyLabel.
  const ownAgencyId = me ? (me.kind === "agency" ? me.id : agencyOf(me)?.id || null) : null;
  return transferTargets({
    reps: reps.map((r) => ({ id: r.id, name: r.name, agency: r.kind === "agency" ? { id: r.id, name: r.name } : agencyOf(r) })),
    presence,
    excludeRepId: repId,
    transferTo: normalisePhone(process.env.FIELDQUO_SALES_TRANSFER_TO),
    transferNumbers,
    // The hold queue is always a destination from here: a caller can be
    // parked on their attempt row whoever is or is not free.
    queue: true,
    ownAgencyId,
  });
}

/**
 * The name the rep's screen prints for the transfer's destination.
 *
 * A rep by name; a phone by its LABEL, looked up on the list by number and
 * never printed as the number; the queue by nothing, because
 * describeTransfer has its own words for it.
 */
function targetNameFor(transfer, targets) {
  if (!transfer) return null;
  if (transfer.toRepId) return targets.find((t) => t.salesRepId === transfer.toRepId)?.name || null;
  if (transfer.toE164) return targets.find((t) => t.kind === "number" && t.value === transfer.toE164)?.name || "a phone";
  return null;
}

/**
 * The attempt, scoped to this rep. A mismatched pair matches nothing.
 *
 * ── Two columns can name the rep, and both have to be here ──────────────
 *
 * `salesRepId` alone was the scope until inbound calls could be answered in
 * the browser, and on an inbound row it is written BEFORE anybody picks up —
 * from whoever last rang that contractor. So the rep actually holding an
 * answered callback usually failed this WHERE, and pressing transfer told them
 * it was not one of their calls.
 *
 * `answeredByRepId` is the fix and it widens nothing: it is written only by
 * /api/sales/calls/answered, only after Twilio has confirmed the leg was rung
 * at that rep's own client identity, and only while it is null. See the column
 * note in prisma/schema.prisma.
 */
async function attemptFor(repId, attemptId) {
  if (!attemptId) return null;
  return db.salesCallAttempt
    .findFirst({
      where: {
        id: attemptId,
        OR: [{ salesRepId: repId }, { answeredByRepId: repId }],
      },
      select: {
        id: true,
        toE164: true,
        fromE164: true,
        // Which leg gets redirected into the conference depends entirely on
        // this — see conferenceMoveLeg in lib/sales/calls/transfer.js.
        direction: true,
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
    // Labels and keys only. What the carrier dials stays here.
    targets: targets.map(publicTarget),
    transfer: transfer
      ? {
          id: transfer.id,
          kind: transfer.kind,
          state: transfer.state,
          toRepId: transfer.toRepId,
          // Whether it went to a phone, not which phone.
          toPhone: Boolean(transfer.toE164),
          failureReason: transfer.failureReason,
          describe: describeTransfer(transfer, { targetName: targetNameFor(transfer, targets) }),
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
      kind: TRANSFER_KINDS.includes(body.kind) || body.kind === TRANSFER_QUEUE ? body.kind : null,
      targetKey: typeof body.targetKey === "string" ? body.targetKey : null,
      targets,
      attempt,
    });
    if (!plan.ok) return bad(plan.reason, 409);

    // The id is minted here so the conference can be named from it in the same
    // write. See the note on startTransfer. A queue transfer has no
    // conference and never will, but the row keeps the column's shape — the
    // name is derived, costs nothing, and a nullable column for one kind is a
    // schema change nobody asked for.
    const id = randomUUID();
    const conferenceName = conferenceNameFor(id);
    if (!conferenceName) return bad("That transfer could not be named.", 500);

    const created = await startTransfer({
      id,
      attemptId: attempt.id,
      fromRepId: rep.id,
      toRepId: plan.target.salesRepId || null,
      // The number is the LIST's — plan.target came out of freeTargetsFor
      // above, in this request. Nothing from `body` is on this line.
      toE164: plan.target.kind === "number" ? plan.target.value : null,
      kind: plan.kind,
      conferenceName,
      callerCallSid: plan.callerCallSid,
      repCallSid: plan.repCallSid,
    });
    if (!created.ok) return bad(created.error, 503);

    // ── The queue: park the caller, release the rep, and that is the end ──
    //
    // No conference, no target leg. The caller's leg is redirected into the
    // hold queue (lib/sales/calls/queue.js) with `parked=1`, where they are
    // held, re-offered to whoever is free each round and reach the voicemail
    // if nobody comes free — the attempt row they are held on names this
    // rep, so the message is filed against them. The rep's own leg is not
    // touched here: on an outbound call the bridge's <Dial> ends the moment
    // its child is redirected and the rep arrives at ?stage=rep-leg, where
    // repLegPlan hangs them up with one sentence; on an inbound call the rep
    // is the child and ends with the <Dial>. The row goes straight to
    // `completed` — there is nobody to ring and nothing to wait for — and a
    // failure leaves the rep exactly where they were, on with the caller.
    if (plan.queue) {
      const applied = await applyTransferActions({
        actions: queueTransferActions(),
        transfer: created.transfer,
        origin,
      });
      if (!applied.ok) {
        await advanceTransfer({
          id,
          fromState: "ringing",
          toState: XFER_FAILED,
          failureReason: "the caller could not be moved into the queue",
          endedAt: new Date(),
        });
        await recordError({
          area: "sales_dial",
          code: "transfer_queue_failed",
          message: `A transfer on attempt ${attempt.id} could not park the caller: ${applied.failed.map((f) => f.error).join("; ")}`,
        }).catch(() => {});
        return bad("The caller could not be put on hold. You are still on with them.", 502);
      }
      await advanceTransfer({
        id,
        fromState: "ringing",
        toState: XFER_COMPLETED,
        answeredAt: new Date(),
        endedAt: new Date(),
      });
      return NextResponse.json({
        ok: true,
        transfer: {
          id,
          kind: TRANSFER_QUEUE,
          state: XFER_COMPLETED,
          toRepId: null,
          toPhone: false,
          describe: describeTransfer({ id, kind: TRANSFER_QUEUE, state: XFER_COMPLETED }),
        },
      });
    }

    // ── One leg is redirected and the other follows on its own ───────────
    //
    // WHICH one is not the same in both directions, and getting it backwards
    // hangs somebody up. Redirecting the CHILD of a `<Dial>` ends the Dial
    // cleanly and sends the parent to that Dial's `action`; redirecting the
    // PARENT hangs the child up. On an outbound call the rep's browser is the
    // parent, so the caller moves and the rep follows through
    // /api/rep-dial/transfer?stage=rep-leg. On an inbound call the contractor
    // is the parent, so the REP moves and the caller follows through
    // /api/rep-dial/inbound?stage=after-dial.
    //
    // The choice is `plan.moveLeg`, decided by conferenceMoveLeg in
    // lib/sales/calls/transfer.js, so a check script drives both without a
    // phone. Nothing here re-derives it from `direction`.
    try {
      if (plan.moveLeg === MOVE_REP) {
        await moveRepToConference({ transfer: created.transfer, origin });
      } else {
        await moveCallerToConference({ transfer: created.transfer, origin });
      }
    } catch (err) {
      await advanceTransfer({
        id,
        fromState: "ringing",
        toState: XFER_FAILED,
        failureReason: "the call could not be moved into the transfer",
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
        toPhone: plan.target.kind === "number",
        describe: describeTransfer(
          { id, kind: plan.kind, state: "ringing" },
          // The label, never the number — a client's `value` is an identity
          // string and a phone's is the E.164, and neither belongs on screen.
          { targetName: plan.target.name || null },
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
