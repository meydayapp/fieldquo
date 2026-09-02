// lib/voice/drainOutbound.js
//
// Placing the outbound calls that are due — once each, whoever is running.
//
// ══ The defect this closes ═════════════════════════════════════════════════
//
// This loop lived in app/api/cron/voice-outbound/route.js and had no claim at
// all. It SELECTed `status: "queued"`, handed each row to placeQueuedCall, and
// wrote the outcome back afterwards. Between the select and the write the row
// still said `queued`, so a second overlapping invocation — a retried cron
// delivery, a manual trigger, two regions — selected the same rows and dialled
// the same numbers again. Not a duplicated database write: a second real phone
// call, billed, to a real person, about a quote they have already been rung
// about. The only thing bounding it was the schedule.
//
// `VoiceCallTask.status` already documented `queued → calling → ...` and
// enqueueOutbound already counted `calling` as live, so the claim state existed
// in the schema and in the de-dupe and was simply never entered. It is entered
// here.
//
// ══ Claim, act, release — and the two ways that goes wrong ═════════════════
//
// The claim is a guarded `updateMany` whose `where` names the state we read, the
// same compare-and-set app/api/cron/grace-warning/route.js uses on
// `graceWarnedAt` and lib/voice/autoTopup.js uses on `chargeInFlightAt`. Two
// racers cannot both match it; the loser gets `count === 0` and moves on.
//
//   the run dies holding the claim   the row would say `calling` for ever and
//                                    nobody would ever call this customer. So a
//                                    claim older than OUTBOUND_STALE_CLAIM_
//                                    MINUTES is reclaimable, exactly as an
//                                    auto-top-up claim is.
//
//   the reclaim dials it again       the expensive one, and the reason autoTopup
//                                    reuses its attempt token. Retell has no
//                                    idempotency key to reuse (see
//                                    findPlacedCallForTask), so the reclaim
//                                    proves it instead: it asks the provider
//                                    whether a call carrying this task's id
//                                    already exists, adopts it if so, and dials
//                                    only when the answer is a clear no. An
//                                    unreadable provider is not a no.
//
// ══ Nothing is dropped ═════════════════════════════════════════════════════
//
// Every path out of the loop either writes a terminal status, returns the row
// to `queued` with a reason, or is counted and logged. A task that cannot be
// resolved after MAX_ATTEMPTS is marked `failed` with the reason in `lastError`
// rather than left circling — a queue that silently retries for ever is the
// same silence this file exists to remove.
//
// ══ Why it is not in the route ═════════════════════════════════════════════
//
// Same argument as lib/voice/reconcileCalls.js: this decides whether a phone
// rings, so it is worth EXECUTING against a fake database in
// scripts/check-voice-task-claim.mjs rather than reading. Every collaborator is
// injectable for that reason and production passes none of them.
import { db as realDb } from "@/lib/db";
import { placeQueuedCall as realPlaceQueuedCall, findPlacedCallForTask as realFind } from "./outboundCall";
import { recordError as realRecordError } from "@/lib/platform/errorLog";

/** area on PlatformErrorLog, so the read matches the write. */
export const OUTBOUND_AREA = "voice_outbound";

// A no-answer is not retried automatically — the schema note on VoiceCallTask
// says why (a fourth voicemail is a nuisance, not a follow-up). These attempts
// are for TRANSIENT failures: the provider refused, a details lookup raced.
export const MAX_ATTEMPTS = 3;

/** Rows per run. See the route header on why the batch is small and frequent. */
export const BATCH = 25;

/**
 * How long a claim is believed before the task is treated as abandoned.
 *
 * Ten minutes, matching AUTO_TOPUP_STALE_CLAIM_MINUTES and for the same reason:
 * far longer than the work it guards (a create-phone-call round trip is seconds,
 * and the 15s Retell timeout caps it), short enough that a serverless
 * invocation killed mid-flight costs one cron cycle rather than a customer never
 * being rung. What it must never be is shorter than the work it guards: a
 * window that expires while a dial is still in progress reclaims a LIVE claim,
 * and that is the one outcome worse than a wedged row.
 */
export const OUTBOUND_STALE_CLAIM_MINUTES = 10;

const HOUR = 60 * 60 * 1000;

/** When to look again after a "not yet". */
export function holdUntil(reason, now) {
  // Low credit or a half-finished setup: a couple of hours is enough for a
  // top-up or for someone to finish wiring voice up. Outside calling hours is
  // handled by mayCall's own window; a 2-hour nudge lands back inside it.
  return new Date(now.getTime() + 2 * HOUR);
}

/**
 * Place every call that is due, and recover every claim that died.
 *
 * @returns a tally. `placed` is calls actually dialled by THIS run; `adopted`
 *          is calls a dead run had already dialled and this run only recorded —
 *          the number that would have been a second phone call before this file
 *          existed.
 */
export async function drainOutboundQueue(opts = {}) {
  const db = opts.db || realDb;
  const place = opts.placeQueuedCall || realPlaceQueuedCall;
  const findPlaced = opts.findPlacedCallForTask || realFind;
  const log = opts.recordError || realRecordError;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const batch = Number.isFinite(opts.batch) ? opts.batch : BATCH;

  const staleBefore = new Date(now.getTime() - OUTBOUND_STALE_CLAIM_MINUTES * 60_000);

  // Two queries rather than one nested OR, because they are two different
  // questions with two different claim rules below and reading them apart is
  // what keeps the rules apart.
  const due = await db.voiceCallTask.findMany({
    where: { status: "queued", notBefore: { lte: now } },
    orderBy: { notBefore: "asc" },
    take: batch,
  });

  // Claims nobody released. `lastTriedAt` IS the claim stamp — it is set on
  // every claim, including the ones that turn out to be holds, so "when did
  // somebody last take responsibility for dialling this" and "when did we last
  // try" are the same fact and there is no second column pretending otherwise.
  //
  // A null stamp is included and treated as stale: `lte` in SQL excludes NULL,
  // so a `calling` row that somehow acquired no stamp would be invisible here
  // for ever — the exact wedge this query exists to prevent.
  const abandoned = await db.voiceCallTask.findMany({
    where: {
      status: "calling",
      OR: [{ lastTriedAt: { lte: staleBefore } }, { lastTriedAt: null }],
    },
    orderBy: { lastTriedAt: "asc" },
    take: batch,
  });

  const tally = {
    considered: due.length + abandoned.length,
    placed: 0,
    adopted: 0,
    held: 0,
    skipped: 0,
    failed: 0,
    // Somebody else got the row between our read and our claim. Not an error —
    // it is the mechanism working.
    raced: 0,
    // A stale claim we could not check with the provider, so we did NOT dial.
    unverified: 0,
    // We finished the work and the row had moved on under us. Loud, because if
    // a call was placed this is where its id would otherwise be lost.
    lostClaim: 0,
  };

  for (const task of [...due, ...abandoned]) {
    const reclaim = task.status === "calling";

    // ── The claim ─────────────────────────────────────────────────────────
    //
    // `where` names the exact state that was read. A fresh task must still be
    // `queued`; a stale one must still be `calling` AND still carry the same
    // claim stamp, so two drainers that both saw the same abandoned row cannot
    // both take it over.
    const claim = await db.voiceCallTask.updateMany({
      where: reclaim
        ? { id: task.id, status: "calling", lastTriedAt: task.lastTriedAt }
        : { id: task.id, status: "queued" },
      data: { status: "calling", lastTriedAt: now },
    });
    if (claim.count !== 1) {
      tally.raced++;
      continue;
    }

    /**
     * Write the outcome, but only if we still hold the claim.
     *
     * Guarded on the stamp we just wrote, so a run that overran its own stale
     * window cannot stamp a verdict on top of the run that took over from it —
     * which would resurrect a task somebody else is mid-dial on.
     */
    const release = async (data, note) => {
      const wrote = await db.voiceCallTask.updateMany({
        where: { id: task.id, status: "calling", lastTriedAt: now },
        data,
      });
      if (wrote.count === 1) return true;
      tally.lostClaim++;
      await log({
        area: OUTBOUND_AREA,
        code: "claim_lost",
        companyId: task.companyId,
        message:
          `Outbound task ${task.id} was taken over by another run before its outcome ` +
          `could be written${note ? ` (${note})` : ""}. Nothing was lost at the provider; ` +
          `the call, if one was placed, is on the task that reclaimed it.`,
        detail: { taskId: task.id, purpose: task.purpose, ...data },
      }).catch(() => {});
      return false;
    };

    // ── A reclaim proves nothing was dialled BEFORE it dials ──────────────
    if (reclaim) {
      let already;
      try {
        already = await findPlaced(task, { now });
      } catch (err) {
        // Cannot see, so cannot dial. Counted as an attempt so an
        // indefinitely-unreadable provider ends in a recorded failure rather
        // than an eternal loop.
        const attempts = (task.attempts || 0) + 1;
        const reason =
          `Couldn't check with the phone provider whether this call had already been ` +
          `placed (${err?.message || "unreachable"}), so it was not dialled again.`;
        if (attempts >= MAX_ATTEMPTS) {
          await release({ status: "failed", attempts, lastError: reason }, "unverifiable");
          tally.failed++;
        } else {
          // Left `calling` on purpose: it goes stale again in ten minutes and
          // gets another look. Returning it to `queued` would hand it to the
          // fresh path, which does not check the provider at all.
          await release({ attempts, lastError: reason }, "unverifiable");
          tally.unverified++;
        }
        continue;
      }

      if (already?.call_id) {
        // The dead run dialled and never got to say so. This is the double call
        // that did not happen.
        await release(
          { status: "done", providerCallId: already.call_id, lastError: null },
          "adopted",
        );
        tally.adopted++;
        await log({
          area: OUTBOUND_AREA,
          code: "claim_recovered",
          companyId: task.companyId,
          message:
            `Outbound task ${task.id} was already dialled as call ${already.call_id} by a run ` +
            `that died before recording it. Adopted rather than dialled again.`,
          detail: { taskId: task.id, providerCallId: already.call_id, purpose: task.purpose },
        }).catch(() => {});
        continue;
      }
      // A clear "no call exists" — fall through and dial for real.
    }

    let verdict;
    try {
      verdict = await place(task, { now });
    } catch (err) {
      // An unexpected throw is transient by assumption — count it as an attempt
      // and let the backoff/give-up logic below handle it, rather than losing
      // the task or hammering the provider. placeQueuedCall does not throw after
      // the phone is ringing (see the note there), so this is always a call that
      // was never made.
      verdict = { placed: false, reason: err.message || "Unexpected error." };
    }

    if (verdict.placed) {
      await release(
        { status: "done", providerCallId: verdict.providerCallId, lastError: null },
        "placed",
      );
      tally.placed++;
      continue;
    }

    if (verdict.terminal) {
      // Correct refusal (opted out, no consent, no number). Not a failure —
      // recorded as skipped with the reason so it's explainable, not retried.
      await release({ status: "skipped", lastError: verdict.reason }, "skipped");
      tally.skipped++;
      continue;
    }

    if (verdict.retryLater) {
      // Not yet — hold it, and DON'T count it as an attempt. Outside hours or a
      // temporary setup gap must not burn the retry budget. Back to `queued`,
      // because the claim is over: nothing was dialled and nothing is in flight.
      await release(
        {
          status: "queued",
          notBefore: holdUntil(verdict.reason, now),
          lastError: verdict.reason,
        },
        "held",
      );
      tally.held++;
      continue;
    }

    // A real, transient failure. Count it; give up after MAX_ATTEMPTS so a
    // permanently-refusing provider doesn't retry forever.
    const attempts = (task.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await release({ status: "failed", attempts, lastError: verdict.reason }, "failed");
      tally.failed++;
    } else {
      await release(
        {
          status: "queued",
          attempts,
          lastError: verdict.reason,
          notBefore: new Date(now.getTime() + 6 * HOUR),
        },
        "retry",
      );
      tally.held++;
    }
  }

  return tally;
}
