// app/api/cron/messaging-snooze/route.js
//
// Bringing a snoozed conversation back.
//
// ══ Why this route is the feature, not an accessory to it ══════════════════
//
// "Snoozed" is the state a contractor actually lives in — "park this until
// Monday, I'll price it when I've seen the site" — and a Snooze button with
// nothing behind it is not a slower version of the feature, it is a lead
// deleted with a friendly label on the delete. That is precisely the shape
// AGENTS.md's first rule names: a control that appears to work. So the button
// and this file shipped together, and scripts/check-messaging.mjs asserts that
// a snoozed thread whose time has passed actually comes back.
//
// ══ Why here and not a second scheduler ════════════════════════════════════
//
// This repo already schedules deferred work exactly one way: a route under
// app/api/cron/, listed in vercel.json, authenticated with requireCronSecret.
// Twenty-three of them. A job queue, a setTimeout, or a "check on read" hack
// would each be a second mechanism for one problem, and the second mechanism
// is the one nobody monitors.
//
// ══ Why it is safe to run every fifteen minutes forever ════════════════════
//
// The query is the guard. `status: "snoozed"` AND `snoozedUntil <= now` is
// self-clearing: waking a thread sets its status to "open" and nulls the
// deadline, so the same row cannot be woken twice, and a double delivery from
// Vercel finds nothing the second time. No dedupe table, because the state IS
// the dedupe — the same reasoning the stale-write guard elsewhere in this repo
// uses for putting the condition in the WHERE rather than in an `if` above it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { writeActivity } from "@/lib/messaging/activity";
import { rescoreThread } from "@/lib/messaging/rescoreThread";
import { SILENCE_DAYS } from "@/lib/messaging/conversationSignals";

// A ceiling, not a target. If a very large tenant somehow parks thousands of
// conversations on the same morning, this wakes the oldest 500 and the next
// tick takes the rest — rather than one request timing out and NONE of them
// coming back, which is the failure that loses the leads.
const MAX_PER_RUN = 500;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();

  // Read the ids first so each wake can carry its own activity line. A single
  // updateMany would be one query, and would leave no record in the threads
  // themselves that the snooze had returned — which is the only place anybody
  // would look to find out whether it did.
  const due = await db.messageThread.findMany({
    where: { status: "snoozed", snoozedUntil: { not: null, lte: now } },
    orderBy: { snoozedUntil: "asc" },
    take: MAX_PER_RUN,
    select: { id: true, companyId: true },
  });

  let woken = 0;
  const failed = [];

  for (const thread of due) {
    try {
      await db.$transaction(async (tx) => {
        // The condition is repeated in the WHERE, not trusted from the read
        // above: between the findMany and here, somebody may have replied to
        // the thread (which un-snoozes it) or moved it themselves. `count: 0`
        // then means "already handled", which is a success, not an error.
        const result = await tx.messageThread.updateMany({
          where: { id: thread.id, status: "snoozed", snoozedUntil: { not: null, lte: now } },
          data: { status: "open", snoozedUntil: null, statusChangedAt: now },
        });
        if (!result.count) return;
        // No actor. A machine brought this back, and activityLabel renders
        // that as its own sentence rather than attributing it to a colleague
        // who was not involved.
        await writeActivity(tx, { threadId: thread.id, type: "unsnoozed", at: now });
        woken++;
      });
    } catch (err) {
      // One tenant's failure must not stop the other 499 waking up. Recorded
      // and reported in the response so a failing run is visible in the cron
      // log rather than being a quietly smaller number.
      failed.push({ threadId: thread.id, error: err?.message || "unknown" });
    }
  }

  // ══ Second pass: the conversations that went quiet ═══════════════════════
  //
  // "Silence after a quote, with a follow-up nobody answered" is the strongest
  // cold signal in the twenty real conversations this scorer was built from —
  // and it is the ONE signal that is not caused by anybody sending a message.
  // Nothing arrives to trigger a rescore, by definition. A score that could
  // only notice silence when the silence ended would never notice it.
  //
  // So it is measured here, where time passing is the event. It rides on this
  // cron rather than a new one for the reason the header above already gives:
  // a second scheduler is the one nobody monitors.
  //
  // FREE — phrase lists and arithmetic. No model is called on this path, ever;
  // the paid reading is bought on the thread, by a person, one at a time.
  const quietSince = new Date(now.getTime() - SILENCE_DAYS * 86400000);
  const rescoreWindow = new Date(now.getTime() - 90 * 86400000);
  const quiet = await db.messageThread
    .findMany({
      where: {
        // They wrote, and then stopped. A thread with no inbound at all has no
        // silence to measure — nobody asked us anything.
        lastInboundAt: { not: null, lte: quietSince },
        // Still live enough to matter. A conversation nobody has touched in
        // three months is history, and rescoring history every fifteen minutes
        // forever is how a cron becomes a bill.
        lastMessageAt: { gte: rescoreWindow },
        // Somebody already decided what this was. Their verdict is the answer.
        outcome: null,
        // Self-limiting, the same way the snooze query above is: a thread that
        // has already gone cold is not picked up again, so the steady state of
        // this pass is the handful that just went quiet.
        OR: [{ temperature: null }, { temperature: { not: "cold" } }],
      },
      orderBy: { lastInboundAt: "asc" },
      take: MAX_PER_RUN,
      select: { id: true, companyId: true },
    })
    .catch(() => []);

  let rescored = 0;
  for (const thread of quiet) {
    // Best effort per thread, like the wake loop above: one tenant's bad row
    // must not stop the rest being scored.
    const result = await rescoreThread({ threadId: thread.id, companyId: thread.companyId, now })
      .catch(() => null);
    if (result) rescored++;
  }

  return NextResponse.json({
    ok: true,
    // `due` and `woken` deliberately reported separately: they differ when a
    // thread was handled between the read and the write, and a single number
    // would hide that rather than explain it.
    due: due.length,
    woken,
    failed: failed.length,
    // The second pass reports its own two numbers for the same reason: a run
    // that looked at forty quiet threads and scored none of them is a broken
    // run, and one number would read as a quiet week.
    quiet: quiet.length,
    rescored,
    ...(failed.length ? { failures: failed.slice(0, 10) } : {}),
  });
}
