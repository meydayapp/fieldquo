// lib/planRead/backstop.js
//
// The cron that keeps a paid drawing read moving when nobody is watching it.
//
// A read runs in slices (lib/planRead/run.js advanceRead): each slice takes a
// lease, works until its time budget is nearly spent, and lets go. Until now
// the only thing that started the next slice was the estimator's own screen —
// its 4-second poll of GET /api/plan-reads/[id]. Close the tab after pressing
// "Read the project" and a read that needed two slices stopped half-way, with
// the company's credit held against it, until somebody opened the page again.
// /api/cron/plan-reads calls this every two minutes.
//
// ══ Why this cannot double-charge ══════════════════════════════════════════
//
// It never holds, debits or charges anything. The money moves in exactly two
// places, both in run.js and both unchanged: startRead's hold (the button,
// once, behind a status claim), and advanceRead's settle (once, refunding
// under the hold's own "refund:<ref>", which the ledger keeps unique per
// company, and writing the result only while the row is still that run). All
// this does is call advanceRead on reads whose lease has lapsed — the same
// call the poll makes — and advanceRead's first act is to take the lease, so a
// slice already running (from the poll, the button, or an overlapping tick of
// this cron) makes this one return "busy" and do nothing.
//
// ══ What it picks ══════════════════════════════════════════════════════════
//
// status "reading" with no lease or a lapsed one — never a draft, a finished
// read, or one a worker holds. Oldest first, a few at a time: each slice may
// run up to advanceRead's 270-second budget, and they run side by side inside
// one invocation, so the batch is what bounds the cron's own duration, not
// the number of reads waiting. The rest are picked up two minutes later.

import { db as realDb } from "@/lib/db";
import { advanceRead as realAdvance } from "./run";

export const BACKSTOP_BATCH = 4;

/** The rows a tick should resume. Exported so the check reads the same where. */
export function stalledWhere(now) {
  return { status: "reading", OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] };
}

/**
 * @returns {{ considered: number, results: Array<{ id, state }> }}
 */
export async function resumeStalledReads({ now = new Date(), batch = BACKSTOP_BATCH } = {}, deps = {}) {
  const prisma = deps.db || realDb;
  const advance = deps.advanceRead || realAdvance;
  const rows = await prisma.planRead.findMany({
    where: stalledWhere(now),
    select: { id: true, companyId: true },
    orderBy: { updatedAt: "asc" },
    take: batch,
  });
  const results = await Promise.all(
    rows.map(async (r) => {
      try {
        // No userId: nobody pressed anything. The AiUsage rows of this slice
        // are the company's, attributed to no one, like any background work.
        const out = await advance(r.id, { companyId: r.companyId, userId: null }, deps.advanceDeps || {});
        return { id: r.id, state: out?.state || "unknown" };
      } catch (err) {
        console.error("[planRead backstop]", r.id, err?.message);
        return { id: r.id, state: "error" };
      }
    }),
  );
  return { considered: rows.length, results };
}
