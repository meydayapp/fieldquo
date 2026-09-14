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

// The effects table's fields plus the stored suggestion, which the
// "suggested" trade source reads. Not added to DECISION_FIELDS: reviewDecide
// and the single-row screen have no use for it.
const SELECT_COLUMNS = Prisma.join(
  [...Object.keys(DECISION_FIELDS), "suggestedTradeKeys"].map((c) => Prisma.raw(`"${c}"`)),
  ", ",
);

/**
 * Where a bulk accept's trade comes from.
 *
 *   given       the request's one tradeKey, for every row. The filter mode
 *               ("RBQ · Laval · toiture") and the per-trade cards.
 *   current     each row's own tradeKey — the By-suggestion "agree" card,
 *               whose rows already carry a trade the name confirms.
 *   suggested   each row's first suggestedTradeKeys entry — the "mixed"
 *               card, where the primary is null under the shop word and the
 *               name's trade sits first in the list.
 *
 * A row whose source yields no catalogue trade is SKIPPED, not defaulted:
 * decisionEffects refuses it and the count mismatch rolls the write back,
 * which is the right answer to "the data moved since the screen loaded".
 */
export const TRADE_SOURCES = Object.freeze(["given", "current", "suggested"]);

export function tradeKeyFor(row, tradeSource, given) {
  if (tradeSource === "current") return row.tradeKey || null;
  if (tradeSource === "suggested") return Array.isArray(row.suggestedTradeKeys) ? row.suggestedTradeKeys[0] || null : null;
  return given;
}

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
export async function bulkReview({ db, filter, decision, tradeKey = null, tradeSource = "given", expectedCount, adminId, now = new Date() }) {
  if (!db) throw new Error("bulkReview: db is required");
  if (decision !== "accept" && decision !== "reject") throw new Error("bulkReview: decision must be accept or reject");
  if (!TRADE_SOURCES.includes(tradeSource)) throw new Error(`bulkReview: tradeSource must be one of ${TRADE_SOURCES.join(", ")}`);

  // Flagged duplicates are never written in bulk, whatever the filter said.
  // "Same business or not" is a different question from "which trade", and
  // an accept clears the flag — so a name-based batch must not be the thing
  // that answers it (suggestedGroupSql keeps the same rule for the cards).
  // Forced into the WHERE here, and re-applied on the rows read below, for
  // the reason the untouchable guard is in two places: the selection is not
  // the write guard.
  const where = reviewWhereSql({ ...filter, dups: "hide" }, { now });
  const excluded = new Set(Array.isArray(filter?.excludeIds) ? filter.excludeIds : []);
  const selected = await db.$queryRaw`SELECT ${SELECT_COLUMNS} FROM "Prospect" WHERE ${where}`;
  // The reviewer's unticked rows and any flagged duplicate, dropped again
  // from whatever the SELECT returned — the WHERE carries both, and this
  // makes the write not depend on it.
  const rows = (Array.isArray(selected) ? selected : []).filter((r) => !excluded.has(r.id) && !r.possibleDuplicateOfId);
  const count = rows.length;

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
  // claimable statuses alone — AND by the trade written, since "current"
  // and "suggested" vary it per row. Same status, same trade, same data.
  const effects = [];
  const groups = new Map(); // key: `${status}|${tradeKey}` → { status, ids, data }
  for (const row of rows) {
    const rowTrade = decision === "accept" ? tradeKeyFor(row, tradeSource, tradeKey) : null;
    const e = decisionEffects(row, decision, { tradeKey: rowTrade, now });
    if (!e.ok) continue;
    effects.push({ id: row.id, campaignId: row.campaignId, counters: e.counters, correction: e.correction, status: row.status });
    const key = `${row.status}|${rowTrade || ""}`;
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
            excluded: excluded.size,
            decision,
            tradeKey: decision === "accept" && tradeSource === "given" ? tradeKey : null,
            tradeSource: decision === "accept" ? tradeSource : null,
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
