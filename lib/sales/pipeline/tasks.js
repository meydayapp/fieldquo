// lib/sales/pipeline/tasks.js
//
// Putting work on the queue.
//
// ══ Two steps on purpose, same as outbound calls ═══════════════════════════
//
// enqueuePipelineTask records the INTENT; the cron acts on it later. The split
// is the one lib/sales/pipeline/runner.js inherits from
// lib/voice/outboundCall.js, and for the same reason: the moment a stage
// becomes possible is almost never the moment it is sensible to spend a
// provider call on it, and every gate — budget, rate limit, robots — is
// re-checked at run time rather than enqueue time.
//
// ══ Dedupe is the unique index, not the lookup ═════════════════════════════
//
// enqueueOutbound dedupes with a findFirst. That is correct for its shape (one
// live task per company/purpose/subject, with no unique index behind it) but
// it is a read-then-write, so two callers arriving together both see nothing
// and both insert. SalesPipelineTask.idempotencyKey is @unique precisely so
// this file can do better: the findUnique below is a FAST PATH, and the P2002
// catch is the actual guarantee. Deleting the catch would restore the race.
import { db } from "@/lib/db";
import { isKnownKind } from "./kinds";

/**
 * Queue one pipeline task.
 *
 * @param idempotencyKey  Optional, and does double duty on purpose: it is both
 *        the dedupe key here and the key the handler hands its provider (see
 *        idempotencyKeyFor in schedule.js). One column, because two would let
 *        a retry dedupe against one value and the vendor against another —
 *        which is how a "deduplicated" pipeline still places two calls.
 *        Callers should build it from what makes the work unique, e.g.
 *        `crawl:${prospectId}:${new URL(url).hostname}`.
 * @param notBefore  Hold the task until then. Absent means "as soon as a
 *        runner sees it" — the column defaults to now() in the schema.
 *
 * @returns the created row, the EXISTING row when the key is already taken, or
 *          null when the kind is not a stage. Never throws on a duplicate.
 */
export async function enqueuePipelineTask(
  { kind, prospectId = null, campaignId = null, payload = null, notBefore = null, idempotencyKey = null } = {},
  { deps = {} } = {},
) {
  const prisma = deps.db || db;

  // Refused here rather than stored. enqueueOutbound's header makes the
  // argument: a task that can never run is worse than no task, because it sits
  // in the queue being counted as outstanding work for ever.
  if (!isKnownKind(kind)) return null;

  const key = idempotencyKey ? String(idempotencyKey) : null;

  if (key) {
    const existing = await prisma.salesPipelineTask.findUnique({
      where: { idempotencyKey: key },
      select: { id: true, kind: true, status: true, idempotencyKey: true },
    });
    if (existing) return existing;
  }

  const data = {
    kind,
    prospectId,
    campaignId,
    payload: payload ?? undefined,
    ...(key ? { idempotencyKey: key } : {}),
    ...(notBefore ? { notBefore } : {}),
  };

  try {
    return await prisma.salesPipelineTask.create({ data });
  } catch (err) {
    // P2002 = the unique index refused it, so a concurrent caller inserted the
    // same key between the findUnique above and this create. Their row is as
    // good as ours; hand it back rather than surfacing a crash for what is a
    // successful dedupe.
    if (err?.code === "P2002" && key) {
      const winner = await prisma.salesPipelineTask.findUnique({
        where: { idempotencyKey: key },
        select: { id: true, kind: true, status: true, idempotencyKey: true },
      });
      if (winner) return winner;
    }
    throw err;
  }
}

/**
 * Queue several stages at once, skipping the ones already queued.
 *
 * Sequential rather than Promise.all: these share one unique index, and firing
 * them together turns an ordinary dedupe into a pile of P2002s that each cost a
 * round trip to resolve. The lists here are short — one prospect's next stages.
 */
export async function enqueuePipelineTasks(specs = [], options = {}) {
  const out = [];
  for (const spec of specs) out.push(await enqueuePipelineTask(spec, options));
  return out;
}
