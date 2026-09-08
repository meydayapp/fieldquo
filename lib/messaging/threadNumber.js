// lib/messaging/threadNumber.js
//
// "Have a look at conversation 41."
//
// Chatwoot's `display_id`: a small per-account number a person can say out
// loud. A cuid cannot be said out loud, and two people in a van cannot agree
// about which enquiry they mean without one.
//
// ══ Why this reuses the quote allocator's approach and not a sequence ══════
//
// lib/quotes/quoteNumber.js already mints per-company numbers by reading the
// company's highest and adding one, and lib/invoices/invoiceNumber.js does the
// same. A Postgres sequence would be per-DATABASE, so company A's second
// conversation would be number 8 because four other tenants wrote in first —
// which is the whole reason those two files do it this way.
//
// ══ Why allocation is separate from the webhook's critical path ════════════
//
// The number is stamped in a SECOND, guarded write, after the thread row
// exists — never as part of the upsert that stores the homeowner's message.
// Two reasons:
//
//   1. Two webhooks for two different homeowners can create two threads at the
//      same instant, both read "highest is 40", and both try 41. One of them
//      hits @@unique([companyId, threadNumber]) and throws. If that throw were
//      inside the upsert, the losing message would be LOST — an enquiry
//      discarded to protect a display number, which is exactly the wrong way
//      round.
//   2. The retry can therefore afford to give up. A thread with a null number
//      shows no number, which is honest; a thread with a number another
//      conversation already answers to is worse than no number at all.

/** Pure: the next number, given the highest one a company already holds. */
export function nextThreadNumber(highest) {
  const n = Number(highest);
  return Number.isInteger(n) && n > 0 ? n + 1 : 1;
}

/**
 * Pure: the highest number in a set of rows, ignoring the unnumbered.
 *
 * Takes rows rather than doing the query so the arithmetic is executable, and
 * because the query below deliberately reads every row (see the note there).
 */
export function highestThreadNumber(rows = []) {
  let highest = 0;
  for (const row of rows) {
    const n = Number(row?.threadNumber);
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return highest;
}

/**
 * Stamp a number onto a thread that has none. Best effort, by design.
 *
 * Returns the number written, or null when it could not get one — which the
 * caller must treat as "this thread has no number", never as an error worth
 * failing a webhook over.
 *
 * The read is a findMany of the company's numbers rather than an ordered
 * findFirst, matching allocateHistoricalQuoteNumber: the set is small (one row
 * per conversation the company has ever had) and it keeps this executable
 * against the check script's database stub, which models uniqueness and upsert
 * honestly but does not order.
 *
 * The write is guarded on `threadNumber: null` in the WHERE, not in an `if`
 * above it — the stale-write rule this repo already enforces elsewhere. Two
 * allocators racing on the SAME thread cannot both stamp it.
 */
export async function allocateThreadNumber(db, { companyId, threadId, attempts = 3 }) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const taken = await db.messageThread
      .findMany({ where: { companyId }, select: { threadNumber: true } })
      .catch(() => null);
    if (!taken) return null;

    const candidate = nextThreadNumber(highestThreadNumber(taken));
    try {
      const result = await db.messageThread.updateMany({
        where: { id: threadId, companyId, threadNumber: null },
        data: { threadNumber: candidate },
      });
      // count 0 means somebody else numbered it first. Not a failure — the
      // thread has a number, just not this one.
      return result?.count ? candidate : null;
    } catch {
      // P2002: another company thread took `candidate` between the read and
      // the write. Read again and try the next one.
      continue;
    }
  }
  return null;
}
