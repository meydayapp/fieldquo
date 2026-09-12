// lib/sales/discovery/reviewBulk.js
//
// The writer behind "Assign trade X to N rows" and "Reject all matching".
//
// Split from the route so a check can drive it with a fake client: the
// selection is a raw query (`$queryRaw` over reviewWhereSql), the writes are
// Prisma calls, and the property worth proving — a claimed or do-not-contact
// row is never written even when the selection contains one — lives in the
// where clauses of the writes, which a fake client can record and a check can
// read. app/api/platform/sales/review/bulk/route.js's header says the rest.

import { Prisma } from "@prisma/client";
import {
  DECISION_FIELDS,
  countersByCampaign,
  counterUpdates,
  decisionEffects,
  reviewWhereSql,
  untouchableGuardWhere,
} from "./reviewFolder";

/** ids per updateMany / createMany. Under Postgres's parameter ceiling with room. */
export const BULK_CHUNK = 2000;

/** How far the live count may drift from what the confirmation showed. */
export const BULK_DRIFT_ALLOWED = 0.02;

const SELECT_COLUMNS = Prisma.join(
  Object.keys(DECISION_FIELDS).map((c) => Prisma.raw(`"${c}"`)),
  ", ",
);

function chunks(list, size = BULK_CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * @param {{ db:object, filter:object, decision:"accept"|"reject", tradeKey?:string|null,
 *           expectedCount:number, adminId:string, now?:Date }} args
 * @returns {Promise<{ ok:true, count:number, byStatus:object, campaigns:number, sample:string[] }
 *                  | { ok:false, error:string, count:number }>}
 */
export async function bulkReview({ db, filter, decision, tradeKey = null, expectedCount, adminId, now = new Date() }) {
  if (!db) throw new Error("bulkReview: db is required");
  if (decision !== "accept" && decision !== "reject") throw new Error("bulkReview: decision must be accept or reject");

  const where = reviewWhereSql(filter, { now });
  const rows = await db.$queryRaw`SELECT ${SELECT_COLUMNS} FROM "Prospect" WHERE ${where}`;
  const count = Array.isArray(rows) ? rows.length : 0;

  // The confirmation showed a number. If reality has moved past what a
  // person could have meant, stop and say so — a bulk assign is not the
  // place to discover that a colleague's import landed a minute ago.
  const drift = Math.abs(count - expectedCount);
  if (drift > Math.max(1, Math.ceil(expectedCount * BULK_DRIFT_ALLOWED))) {
    return {
      ok: false,
      count,
      error: `The folder now holds ${count} matching rows, not ${expectedCount}. Reload and confirm again.`,
    };
  }
  if (!count) return { ok: true, count: 0, byStatus: {}, campaigns: 0, sample: [] };

  // Effects per row, from the row as read. Grouped by the status the write
  // is guarded on — accept moves needs_review to discovered and leaves the
  // claimable statuses alone, so two data shapes, two groups.
  const effects = [];
  const groups = new Map(); // key: `${status}` → { status, ids, data }
  for (const row of rows) {
    const e = decisionEffects(row, decision, { tradeKey, now });
    if (!e.ok) continue;
    effects.push({ id: row.id, campaignId: row.campaignId, counters: e.counters, correction: e.correction, status: row.status });
    const key = row.status;
    if (!groups.has(key)) groups.set(key, { status: row.status, ids: [], data: e.data });
    groups.get(key).ids.push(row.id);
  }
  const planned = effects.length;
  const byCampaign = countersByCampaign(effects);
  const sample = rows.slice(0, 3).map((r) => r.businessName).filter(Boolean);

  await db.$transaction(
    async (tx) => {
      let written = 0;
      for (const group of groups.values()) {
        for (const ids of chunks(group.ids)) {
          // The untouchable guard AGAIN, on the write itself: the selection
          // above excluded claimed and do-not-contact rows, and this makes
          // the write not depend on that. Guarded on the status read, so a
          // row reviewed in between is skipped and the count mismatch below
          // rolls everything back.
          const result = await tx.prospect.updateMany({
            where: { id: { in: ids }, status: group.status, ...untouchableGuardWhere(now) },
            data: group.data,
          });
          written += result.count;
        }
      }
      if (written !== planned) {
        throw new Error(`bulkReview: planned ${planned} rows and ${written} matched at write time — reload and try again`);
      }

      for (const batch of chunks(effects.filter((e) => e.correction))) {
        await tx.prospectCorrection.createMany({
          data: batch.map((e) => ({ prospectId: e.id, correctedByAdminId: adminId, ...e.correction })),
        });
      }

      for (const [campaignId, counters] of byCampaign) {
        const data = counterUpdates(counters);
        if (Object.keys(data).length) await tx.prospectCampaign.update({ where: { id: campaignId }, data });
      }

      await tx.platformAuditLog.create({
        data: {
          platformAdminId: adminId,
          action: "sales_prospects_bulk_reviewed",
          details: {
            surface: "review_folder",
            filter,
            decision,
            tradeKey: decision === "accept" ? tradeKey : null,
            count: planned,
            sample,
            campaigns: byCampaign.size,
          },
        },
      });
    },
    { timeout: 240000, maxWait: 10000 },
  );

  const byStatus = {};
  for (const group of groups.values()) byStatus[group.status] = group.ids.length;
  return { ok: true, count: planned, byStatus, campaigns: byCampaign.size, sample };
}
