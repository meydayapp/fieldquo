// app/api/cron/messaging-ai/route.js
//
// The turn the webhook did not live long enough to finish.
//
// ══ What was broken ════════════════════════════════════════════════════════
//
// lib/messaging/ingest.js awaits aiEmployeeOnInbound inside the Meta webhook
// request: a 2.5–6s burst debounce, a routing model call, the main model
// call, tool calls, then a Graph send. The Message row is committed before any
// of that, and the hook fires only when the upsert CREATED the row.
//
// So a function cut off mid-turn lost the reply permanently. Meta redelivers,
// the upsert finds the row, `created` is false, and the employee is never
// asked again — there was no sweeper and no queue. The homeowner got silence
// and the inbox looked like a conversation awaiting a reply that was never
// coming.
//
// ══ Why a cron ═════════════════════════════════════════════════════════════
//
// /api/cron/messaging-media's header makes this argument in full and it holds
// unchanged: this repo schedules deferred work exactly one way, and a second
// mechanism is the one nobody monitors. `aiPending` on the row IS the queue —
// indexed, self-clearing, derived from one predicate
// (lib/messaging/aiTurn.js's owesAiTurn), impossible to get out of step with
// the work.
//
// Specifically rejected, for this job:
//
//   waitUntil / after()  still bounded by the same maxDuration that killed
//                        the turn. It moves the deadline, it does not survive
//                        it, and nothing would notice when it lost.
//   Meta's own retry     already happens and is already useless: the row
//                        exists by then, so `created` is false. That is the
//                        bug, not the fix.
//   run it on thread open a reply that waits for a contractor to look is not
//                        an auto-reply.
//
// ══ Why it cannot double-reply ═════════════════════════════════════════════
//
// Three guards, in order, and each would be sufficient on its own for a
// different failure:
//
//   1. GRACE. A row is only eligible AI_TURN_GRACE_MS after it was written,
//      which is longer than any turn that is still alive. A slow webhook is
//      never raced by the sweeper.
//   2. CLAIM. The flag is cleared in a conditional updateMany before any work
//      starts, so exactly one worker proceeds per row — two overlapping ticks
//      cannot both take it.
//   3. ALREADY REPLIED. lib/aiEmployee/respond.js creates the AiEmployeeReply
//      row BEFORE it calls send() (it updates that same row with sentAt
//      afterwards). So a row for this messageId means the turn already got as
//      far as composing, and may have sent. That is the one case the first two
//      guards cannot see: killed in the gap between a successful send and
//      clearing the flag. We refuse rather than risk a homeowner receiving the
//      same reply twice.
//
// ══ Why exactly one recovery attempt ═══════════════════════════════════════
//
// The claim CLEARS the flag rather than leasing it, so a message gets the
// inline turn plus one sweep and no more. That is deliberate: an unbounded
// retry on a path whose dominant cost is model calls is an unbounded bill, and
// a reply that is four minutes late is already past the point where more
// retries help. A turn that dies twice leaves the message in the inbox for a
// person, which is the honest end state.
export const runtime = "nodejs";

// The work here is model calls, not the default's worth of request handling —
// the same reason the turn kept being killed in the webhook. Generous, because
// the alternative is losing the reply it exists to recover.
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { aiEmployeeOnInbound } from "@/lib/aiEmployee/inbound";
import { aiTurnCutoff } from "@/lib/messaging/aiTurn";

// A ceiling, not a target. Each item is a model call with a wall clock, so a
// backlog is spread over ticks rather than risking one request timing out and
// recovering NONE of them — which would be this route reproducing the bug it
// exists to fix.
const MAX_PER_RUN = 5;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const due = await db.message.findMany({
    where: { aiPending: true, createdAt: { lt: aiTurnCutoff() } },
    // Oldest first: the homeowner who has been waiting longest is answered
    // first. The @@index([aiPending, createdAt]) exists for this query.
    orderBy: { createdAt: "asc" },
    take: MAX_PER_RUN,
    select: {
      id: true,
      thread: {
        select: {
          id: true,
          companyId: true,
          channel: { select: { platform: true } },
        },
      },
    },
  });

  let recovered = 0;
  let skipped = 0;
  const reasons = [];

  for (const message of due) {
    const threadId = message.thread?.id || null;
    const companyId = message.thread?.companyId || null;

    // CLAIM first. Conditional on the flag still being true, so two ticks
    // that overlap cannot both take this row — the loser sees count 0.
    const claim = await db.message
      .updateMany({ where: { id: message.id, aiPending: true }, data: { aiPending: false } })
      .catch(() => ({ count: 0 }));
    if (claim.count !== 1) {
      skipped++;
      continue;
    }

    if (!companyId || !threadId) {
      // The relation is required by the schema, so this can only be a read
      // that raced a cascade delete. The flag is already cleared; there is
      // nothing left to answer.
      skipped++;
      continue;
    }

    // Guard 3. A reply row for this message means respond.js already composed
    // — and, because that row is written before send(), may already have sent.
    const alreadyRan = await db.aiEmployeeReply
      .count({ where: { messageId: message.id } })
      .catch(() => 1); // on a read failure, assume it ran: silence beats a double send
    if (alreadyRan > 0) {
      skipped++;
      reasons.push("already_ran");
      continue;
    }

    const result = await aiEmployeeOnInbound({
      companyId,
      threadId,
      messageId: message.id,
      platform: message.thread?.channel?.platform || null,
    }).catch((err) => ({ acted: false, reason: `error:${err?.message || "unknown"}` }));

    recovered++;
    if (result?.reason) reasons.push(result.reason);
  }

  // Logged, not returned in detail: the body is read by Vercel's cron runner,
  // which only needs to know the tick succeeded.
  if (due.length) {
    console.warn(
      `[cron/messaging-ai] due=${due.length} recovered=${recovered} skipped=${skipped} reasons=${reasons.join(",") || "none"}`,
    );
  }

  return NextResponse.json({ ok: true, due: due.length, recovered, skipped });
}
