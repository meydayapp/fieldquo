// app/api/cron/messaging-media/route.js
//
// Fetching the picture a homeowner sent.
//
// ══ Why a cron, and not something cleverer ═════════════════════════════════
//
// This repo schedules deferred work exactly one way: a route under
// app/api/cron/, listed in vercel.json, authenticated with requireCronSecret.
// Twenty-four of them. /api/cron/messaging-snooze's header makes the argument
// in full and it applies unchanged here — a job queue, a `waitUntil`, a
// setTimeout or a "fetch it when somebody opens the thread" hack would each be
// a SECOND mechanism for one problem, and the second mechanism is the one
// nobody monitors. The alternatives were considered specifically:
//
//   waitUntil in the webhook    would tie Meta's retry clock to Cloudinary's
//                               latency after all, which is the entire reason
//                               the fetch is out of band.
//   fetch on read               the thread route would do multi-megabyte
//                               downloads inside a GET a contractor is
//                               waiting on, and a thread nobody opens would
//                               keep its media id until the id expired.
//   a queue table               a Message row with mediaPending true IS the
//                               queue, indexed, self-clearing, and impossible
//                               to get out of step with the work.
//
// ══ Why every minute ═══════════════════════════════════════════════════════
//
// Because a photo is the thing a contractor is actively waiting on — "here's
// the room" is the start of a conversation, not a background chore — and a
// fifteen-minute wait would make the bubble's honest "still arriving" state
// the normal experience rather than a brief one. /api/cron/sales-pipeline
// already runs on `* * * * *`, so this is the existing floor rather than a new
// one. It is also cheap when there is nothing to do: one indexed query
// returning no rows.
//
// ══ Why it is safe to run forever ══════════════════════════════════════════
//
// The query is the guard, exactly as the snooze cron's is. `mediaPending: true`
// is DERIVED from the attachments by one predicate
// (lib/messaging/attachments.js's hasFetchableMedia), and every pass rewrites
// it from the result — so a message whose media landed, or whose fetch has
// failed its last permitted attempt, stops being selected. No dedupe table,
// because the state IS the dedupe.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { fetchMessageMedia } from "@/lib/messaging/mediaFetch";

// A ceiling, not a target. These are multi-megabyte downloads on a function
// with a fixed memory ceiling and a wall clock, so a burst is spread over
// several ticks rather than risking one request timing out and NONE of the
// photos landing — the same trade /api/cron/messaging-snooze makes, with a
// much smaller number because each item here costs real bytes.
const MAX_PER_RUN = 25;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const due = await db.message.findMany({
    where: { mediaPending: true },
    // Oldest first: whoever has been staring at "still arriving" longest gets
    // served first. The @@index([mediaPending, sentAt]) exists for this.
    orderBy: { sentAt: "asc" },
    take: MAX_PER_RUN,
    select: {
      id: true,
      attachments: true,
      thread: {
        select: {
          companyId: true,
          // The whole channel row, token and all — the WhatsApp half of the
          // fetch needs the credential, and this is the one query that can
          // reach it without a second round trip per message.
          channel: true,
        },
      },
    },
  });

  let fetched = 0;
  let failed = 0;
  const errors = [];

  for (const message of due) {
    const channel = message.thread?.channel || null;
    const companyId = message.thread?.companyId || null;

    if (!companyId) {
      // A message with no thread is not a state this schema allows (the
      // relation is required), so this can only be a read that raced a
      // cascade delete. Clearing the flag stops the row being selected
      // forever; there is nothing left to fetch it for.
      await db.message
        .update({ where: { id: message.id }, data: { mediaPending: false } })
        .catch(() => null);
      continue;
    }

    try {
      const result = await fetchMessageMedia({
        attachments: message.attachments,
        channel,
        companyId,
      });
      await db.message.update({
        where: { id: message.id },
        // Both written together, in one update, from one computation. A run
        // that stored the new URLs and left the flag alone would re-download
        // the same photo every minute; one that cleared the flag without
        // storing them would lose it.
        data: { attachments: result.attachments, mediaPending: result.pending },
      });
      fetched += result.fetched;
      failed += result.failed;
    } catch (err) {
      // One message's failure must not stop the other twenty-four. The row
      // keeps mediaPending true, so the next tick tries again until the
      // attempt ceiling in lib/messaging/attachments.js stops it.
      errors.push({ messageId: message.id, error: err?.message || "unknown" });
    }
  }

  return NextResponse.json({
    ok: true,
    // `due`, `fetched` and `failed` reported separately: one number would hide
    // the difference between "nothing was waiting" and "everything failed",
    // and those need opposite responses from whoever reads the cron log.
    due: due.length,
    fetched,
    failed,
    errored: errors.length,
    ...(errors.length ? { errors: errors.slice(0, 10) } : {}),
  });
}
