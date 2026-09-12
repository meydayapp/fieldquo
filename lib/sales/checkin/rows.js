// lib/sales/checkin/rows.js
//
// The one INSERT into SalesCheckIn, shared by the thread's create route
// (store.js) and the backlog (materialise.js).
//
// Its own module, with no send path in it, because the backlog runs from a
// cron and scripts/check-sales-messages.mjs asserts that no cron reaches the
// module holding the send. Two copies of "insert, and on P2002 hand back the
// row that already exists" would be the copy that rots — one of them would
// eventually treat the unique index firing as an error the rep sees.
//
// Nothing here decides anything. The caller has already decided the words,
// the moment and the key; this writes them down once.

/**
 * @returns `{ checkIn, existed }` — `existed` true when the dedupe key was
 *   already taken and the row returned is the one that took it. A duplicate
 *   key is the index doing its job, not a failure: two tabs, two cron ticks
 *   or a backfill re-run must produce one row, quietly.
 */
export async function insertDraftRow(client, data) {
  try {
    const checkIn = await client.salesCheckIn.create({ data });
    return { checkIn, existed: false };
  } catch (err) {
    if (err?.code === "P2002" && data?.dedupeKey && data?.salesRepId) {
      const existing = await client.salesCheckIn.findFirst({
        where: { salesRepId: data.salesRepId, dedupeKey: data.dedupeKey },
      });
      if (existing) return { checkIn: existing, existed: true };
    }
    throw err;
  }
}
