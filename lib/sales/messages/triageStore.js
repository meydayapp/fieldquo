// lib/sales/messages/triageStore.js
//
// The database half of the triage list: which of a rep's threads are a
// roadblock or a question nobody has answered. The arithmetic is
// lib/sales/messages/triage.js's openTriage(), pure and executed by the
// check; this file only fetches the rows it needs and hands them over.
//
// Read by the rep console's Tasks tab (app/api/sales/queue/route.js, for the
// one number on screen), by the 07:00 UTC check-in cron's report
// (lib/sales/checkin/materialise.js, per rep), and by nothing that sends.
// There is no write in this file.
import { db } from "@/lib/db";
import { normalisePhone } from "../suppressionRules";
import { TRIAGE_OPEN, countOpenTriage, openTriage } from "./triage";

/**
 * Open roadblocks and questions for one rep, optionally for one number.
 *
 * Two reads rather than one clever one: the inbound rows that carry an open
 * kind (the index is on `[salesRepId, triage]`), then every OUTBOUND row to
 * those numbers, so openTriage() can tell whether the rep has written back
 * since. A single query joining "the latest row per thread" is the kind of
 * SQL Prisma expresses badly and a reader verifies worse.
 *
 * @returns `{ items, counts }` — items as openTriage() shapes them, newest
 *          roadblocks first; counts `{ roadblock, question }`.
 */
export async function openTriageThreads({ salesRepId, e164 = null, client = db, take = 200 } = {}) {
  if (!salesRepId) return { items: [], counts: countOpenTriage([]) };
  const other = e164 ? normalisePhone(e164) : null;
  if (e164 && !other) return { items: [], counts: countOpenTriage([]) };

  const inbound = await client.salesSmsMessage.findMany({
    where: {
      salesRepId,
      direction: "in",
      triage: { in: [...TRIAGE_OPEN] },
      ...(other ? { fromE164: other } : {}),
    },
    orderBy: { sentAt: "desc" },
    take,
    select: {
      id: true,
      direction: true,
      fromE164: true,
      toE164: true,
      body: true,
      sentAt: true,
      leadId: true,
      triage: true,
      triageReason: true,
      triagedAt: true,
      triageOverriddenById: true,
      lead: { select: { businessName: true, contactName: true } },
    },
  });
  if (!inbound.length) return { items: [], counts: countOpenTriage([]) };

  const numbers = [...new Set(inbound.map((m) => m.fromE164).filter(Boolean))];
  const outbound = await client.salesSmsMessage.findMany({
    where: { salesRepId, direction: "out", toE164: { in: numbers } },
    orderBy: { sentAt: "desc" },
    take: Math.max(take, numbers.length),
    select: { id: true, direction: true, fromE164: true, toE164: true, sentAt: true, leadId: true },
  });
  // A NEWER inbound row of the same thread that was filed fine (or not yet
  // classified) also closes the older roadblock: the chip is the latest
  // word's. Fetch those too, so a thread reads the way the list draws it.
  const laterInbound = await client.salesSmsMessage.findMany({
    where: { salesRepId, direction: "in", fromE164: { in: numbers }, id: { notIn: inbound.map((m) => m.id) } },
    orderBy: { sentAt: "desc" },
    take: Math.max(take, numbers.length),
    select: {
      id: true, direction: true, fromE164: true, toE164: true, body: true, sentAt: true, leadId: true,
      triage: true, triageReason: true, triagedAt: true, triageOverriddenById: true,
    },
  });

  const items = openTriage([...inbound, ...laterInbound, ...outbound]);
  return { items, counts: countOpenTriage(items) };
}
