// lib/sales/messages/readState.js
//
// Where a rep got to in each text conversation — read, and filed as done.
//
// ══ The one table this file writes ════════════════════════════════════════
//
// SalesSmsThreadRead, declared below the way every rep-side write in this
// portal is declared (REP_SMS_WRITES, REP_CHECKIN_WRITES, …): so the rule is
// discoverable from the file and scripts/check-sales-messages.mjs can assert
// the route writes this model and no other. It is FieldQuo's own bookkeeping
// about FieldQuo's own rep; nothing here leaves the building or touches a
// prospect's row.
//
// ══ Why "done" is a timestamp and not a flag ══════════════════════════════
//
// A conversation is done until the other side writes again. Comparing
// `doneAt` with the thread's last inbound instant answers that without a
// second write: a reply landing after the filing un-does it on its own, and
// the list moves the thread back to "Needs a reply" the next time it is
// read. A boolean would need the inbound webhook to know about this table
// and clear it, which is one more place for the two to disagree.
import { db } from "@/lib/db";
import { normalisePhone } from "@/lib/sales/suppressionRules";

export const REP_THREAD_READ_WRITES = ["salesSmsThreadRead"];

/** `Map<e164, { readAt, doneAt }>` for every thread this rep has touched. */
export async function threadReadStates({ salesRepId, client = db } = {}) {
  const rows = await client.salesSmsThreadRead.findMany({
    where: { salesRepId },
    select: { e164: true, readAt: true, doneAt: true },
  });
  return new Map(rows.map((r) => [r.e164, { readAt: r.readAt, doneAt: r.doneAt }]));
}

/** One thread's state, or null when the rep has never opened it. */
export async function threadReadState({ salesRepId, e164, client = db } = {}) {
  const other = normalisePhone(e164);
  if (!other) return null;
  const row = await client.salesSmsThreadRead.findUnique({
    where: { salesRepId_e164: { salesRepId, e164: other } },
    select: { readAt: true, doneAt: true },
  });
  return row || null;
}

/**
 * The rep has the thread open now.
 *
 * `at` is the server's clock, never the request's: a browser with a clock
 * ten minutes fast would mark as read a message that has not arrived yet.
 */
export async function markThreadRead({ salesRepId, e164, at = new Date(), client = db } = {}) {
  const other = normalisePhone(e164);
  if (!other) return null;
  return client.salesSmsThreadRead.upsert({
    where: { salesRepId_e164: { salesRepId, e164: other } },
    create: { salesRepId, e164: other, readAt: at },
    update: { readAt: at },
    select: { readAt: true, doneAt: true },
  });
}

/**
 * File the thread as done — or take that back.
 *
 * Marking done also marks read: a rep who files a conversation has looked at
 * it, and a "Done" row with an unread badge is a contradiction.
 */
export async function markThreadDone({ salesRepId, e164, done = true, at = new Date(), client = db } = {}) {
  const other = normalisePhone(e164);
  if (!other) return null;
  return client.salesSmsThreadRead.upsert({
    where: { salesRepId_e164: { salesRepId, e164: other } },
    create: { salesRepId, e164: other, readAt: at, doneAt: done ? at : null },
    update: done ? { readAt: at, doneAt: at } : { doneAt: null },
    select: { readAt: true, doneAt: true },
  });
}

// isThreadDone lives in ./rooms.js, which is pure and safe for a client
// bundle; this file imports the database client and must not be.
export { isThreadDone } from "./rooms";
