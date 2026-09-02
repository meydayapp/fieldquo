// lib/sales/payouts.js
//
// Closing a week's commission into a batch a human pays.
//
// ══ No money moves from this build, deliberately ═══════════════════════════
//
// A batch closes to `ready`, is exported, and is marked `paid` by a person.
// Paying reps automatically is a separate decision with its own compliance
// surface — payroll, withholding, cross-border transfer to a rep in Kyiv — and
// nothing in the brief requires it on day one. Building the transfer now would
// mean guessing at all three.
//
// ══ The total is re-summed at payment time, never trusted from the close ═══
//
// SalesPayoutBatch.totalCentsAtClose exists and is deliberately NOT what
// anyone pays from. It is a record of what was owed at the moment the batch
// closed, useful for spotting a discrepancy, and a discrepancy is exactly the
// thing worth spotting: a reversal landing after the close SHOULD change what
// is paid.
//
// That is the same argument lib/voice/credits.js makes for summing a balance
// rather than storing it, and the same one lib/migrations/state.js makes for
// re-reading permission inside the write rather than trusting the request that
// asked for it.
import { db } from "@/lib/db";
import { balanceCents } from "./commission";

/**
 * The UTC week containing `now`, Monday to Monday.
 *
 * UTC because a rep in Kyiv and an owner in Gatineau otherwise disagree about
 * which week a Sunday-evening signup belongs to, and a payout boundary that
 * moves depending on who is looking at it is not a boundary. Monday-based to
 * match bucketSignups in lib/sales/repStats.js — two week definitions in one
 * product is how a rep's dashboard and their payslip stop agreeing.
 */
export function weekBounds(now = new Date()) {
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(day);
  start.setUTCDate(start.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

/** The week BEFORE the one containing `now` — the one that is safe to close. */
export function previousWeekBounds(now = new Date()) {
  const { start } = weekBounds(now);
  const end = start;
  const prev = new Date(start);
  prev.setUTCDate(prev.getUTCDate() - 7);
  return { start: prev, end };
}

/**
 * Which entries belong in a batch for this window.
 *
 * Pure, over already-loaded rows, so the boundary cases can be executed
 * rather than reasoned about: an entry at exactly the start instant, one at
 * exactly the end instant, one already in another batch, and a negative
 * reversal.
 *
 * Half-open [start, end) — an entry at exactly `end` belongs to the NEXT week,
 * or the same entry lands in two batches and gets paid twice.
 */
export function entriesForWindow(entries, start, end) {
  const rows = Array.isArray(entries) ? entries : [];
  return rows.filter((e) => {
    if (!e || e.payoutBatchId) return false;
    const at = e.occurredAt instanceof Date ? e.occurredAt : new Date(e.occurredAt);
    if (Number.isNaN(at.getTime())) return false;
    return at >= start && at < end;
  });
}

/**
 * What a closed batch is worth right now.
 *
 * Deliberately takes entries rather than a batch id: the caller has just read
 * them, and re-reading here would open a window where the number reported
 * differs from the number acted on.
 */
export function batchTotalCents(entries) {
  return balanceCents(entries);
}

/**
 * Close last week for one rep.
 *
 * Idempotent on (salesRepId, periodStart), which is a unique index — so two
 * runs of the closing cron cannot produce two batches for one week, and the
 * DATABASE enforces that rather than a read-then-write anybody can race.
 *
 * A rep with nothing to pay gets NO batch. An empty batch is a row that says
 * "we paid you nothing this week", which is noise on a payout screen and
 * indistinguishable from a bug when someone is looking for a missing payment.
 */
export async function closeWeekForRep({ salesRepId, start, end, prisma = db }) {
  if (!salesRepId || !start || !end) return null;

  const entries = await prisma.salesCommissionEntry.findMany({
    where: { salesRepId, payoutBatchId: null },
    select: { id: true, amountCents: true, occurredAt: true, payoutBatchId: true },
  });

  const inWindow = entriesForWindow(entries, start, end);
  if (!inWindow.length) return null;

  const total = batchTotalCents(inWindow);

  // A week whose reversals outweigh its earnings nets negative. The batch is
  // still created rather than skipped: the debt is real, it carries into what
  // is paid next, and hiding it would make a rep's statement stop reconciling.
  try {
    return await prisma.$transaction(async (tx) => {
      const batch = await tx.salesPayoutBatch.create({
        data: {
          salesRepId,
          periodStart: start,
          periodEnd: end,
          status: "ready",
          totalCentsAtClose: total,
        },
      });

      // Claim the entries INTO the batch, and only entries still unclaimed —
      // so a concurrent close cannot move an entry that another batch already
      // took. The count is checked, not assumed.
      const claimed = await tx.salesCommissionEntry.updateMany({
        where: { id: { in: inWindow.map((e) => e.id) }, payoutBatchId: null },
        data: { payoutBatchId: batch.id },
      });

      if (claimed.count !== inWindow.length) {
        // Something else took an entry mid-flight. Roll back rather than
        // publish a batch whose total does not match its contents — a payout
        // that disagrees with its own line items is worse than a late one.
        throw new Error(
          `payout batch would be inconsistent: expected ${inWindow.length} entries, claimed ${claimed.count}`,
        );
      }

      return batch;
    });
  } catch (err) {
    // P2002 on (salesRepId, periodStart): this week is already closed. That is
    // a duplicate run, not a failure.
    if (err?.code === "P2002") {
      return prisma.salesPayoutBatch.findFirst({
        where: { salesRepId, periodStart: start },
      });
    }
    throw err;
  }
}

/**
 * What to actually pay a `ready` batch, re-summed from its own rows.
 *
 * NOT totalCentsAtClose. If a reversal landed after the close, this is smaller,
 * and that difference is the whole reason the figure is recomputed.
 */
export async function payableTotalFor(batchId, prisma = db) {
  if (!batchId) return { cents: 0, entryCount: 0, driftedFromClose: false };
  const [batch, entries] = await Promise.all([
    prisma.salesPayoutBatch.findUnique({
      where: { id: batchId },
      select: { totalCentsAtClose: true },
    }),
    prisma.salesCommissionEntry.findMany({
      where: { payoutBatchId: batchId },
      select: { amountCents: true },
    }),
  ]);
  const cents = balanceCents(entries);
  return {
    cents,
    entryCount: entries.length,
    // Surfaced rather than silently reconciled: a human should see that the
    // number moved and why, not discover it by arithmetic.
    driftedFromClose: Boolean(batch) && cents !== batch.totalCentsAtClose,
  };
}
