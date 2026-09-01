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
// time inside placeQueuedCall. This route only decides what happens to the TASK
// afterward: done, held for later, or given up on. Keeping the phone-call
// judgement in one place is why a second caller (the receptionist page, a
// manual "call now") can reuse it without re-deriving the rules.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { placeQueuedCall } from "@/lib/voice/outboundCall";

// A no-answer is not retried automatically — the schema note on VoiceCallTask
// says why (a fourth voicemail is a nuisance, not a follow-up). These attempts
// are for TRANSIENT failures: the provider refused, a details lookup raced.
const MAX_ATTEMPTS = 3;
const BATCH = 25;
const HOUR = 60 * 60 * 1000;

/** When to look again after a "not yet". */
function holdUntil(reason, now) {
  // Low credit or a half-finished setup: a couple of hours is enough for a
  // top-up or for someone to finish wiring voice up. Outside calling hours is
  // handled by mayCall's own window; a 2-hour nudge lands back inside it.
  return new Date(now.getTime() + 2 * HOUR);
}

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();

  const due = await db.voiceCallTask.findMany({
    where: { status: "queued", notBefore: { lte: now } },
    orderBy: { notBefore: "asc" },
    take: BATCH,
  });

  let placed = 0, held = 0, skipped = 0, failed = 0;

  for (const task of due) {
    let verdict;
    try {
      verdict = await placeQueuedCall(task, { now });
    } catch (err) {
      // An unexpected throw is transient by assumption — count it as an attempt
      // and let the backoff/give-up logic below handle it, rather than losing
      // the task or hammering the provider.
      verdict = { placed: false, reason: err.message || "Unexpected error." };
    }

    if (verdict.placed) {
      await db.voiceCallTask.update({
        where: { id: task.id },
        data: { status: "done", providerCallId: verdict.providerCallId, lastTriedAt: now },
      });
      placed++;
      continue;
    }

    if (verdict.terminal) {
      // Correct refusal (opted out, no consent, no number). Not a failure —
      // recorded as skipped with the reason so it's explainable, not retried.
      await db.voiceCallTask.update({
        where: { id: task.id },
        data: { status: "skipped", lastError: verdict.reason, lastTriedAt: now },
      });
      skipped++;
      continue;
    }

    if (verdict.retryLater) {
      // Not yet — hold it, and DON'T count it as an attempt. Outside hours or a
      // temporary setup gap must not burn the retry budget.
      await db.voiceCallTask.update({
        where: { id: task.id },
        data: { notBefore: holdUntil(verdict.reason, now), lastError: verdict.reason },
      });
      held++;
      continue;
    }

    // A real, transient failure. Count it; give up after MAX_ATTEMPTS so a
    // permanently-refusing provider doesn't retry forever.
    const attempts = task.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await db.voiceCallTask.update({
        where: { id: task.id },
        data: { status: "failed", attempts, lastError: verdict.reason, lastTriedAt: now },
      });
      failed++;
    } else {
      await db.voiceCallTask.update({
        where: { id: task.id },
        data: {
          attempts,
          lastError: verdict.reason,
          lastTriedAt: now,
          notBefore: new Date(now.getTime() + 6 * HOUR),
        },
      });
      held++;
    }
  }

  return NextResponse.json({ success: true, considered: due.length, placed, held, skipped, failed });
}
