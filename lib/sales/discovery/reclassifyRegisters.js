// lib/sales/discovery/reclassifyRegisters.js
//
// One-off, idempotent: re-classify the licence-register rows that were
// written as `needs_review` before the ingest learned what a licence means.
//
// ══ What it does, row by row ═══════════════════════════════════════════════
//
// For every prospect whose `sourceProvider` is a contractor-licence register
// (lib/sales/discovery/licenceRegisters.js) and whose status is still
// `needs_review`:
//
//   classification → contractor
//   reason         → "Holds a contractor licence (<register>)." — the same
//                    sentence planIngest now writes at ingest
//   status         → discovered
//
// and the campaign's counters move so funnelProblems() stays clean:
//
//   tradeKey null     needsReviewCount −1, unmappedCount +1, bankedCount +1
//                     — it is now a BANKED contractor, in no queue, and it
//                     appears in the Review folder under "No trade"
//   tradeKey set      needsReviewCount −1, acceptedCount +1, and readyCount /
//                     noWebsiteCount +1 where the row qualifies — it is now
//                     an accepted contractor with the trade its licence
//                     class named, claimable from that trade's queue
//
// Rows that are do-not-contact, or flagged as possible duplicates, are NOT
// touched: the first was decided by a human, and the second is a question the
// Review folder's duplicate bucket is for — promoting it to `discovered` would
// take it out of that bucket's `needs_review` half and put a possibly-
// redundant row in a queue.
//
// ══ Idempotent, and dry-run first ══════════════════════════════════════════
//
// The selection is `status = needs_review`, and the write sets `discovered`,
// so a second run finds nothing. `dryRun: true` reads and reports the same
// numbers and writes nothing; the route and the script both run it first.
//
// The counters are computed from the rows READ, in pages, and applied per
// campaign in the same transaction as that page's updates. Every update is
// guarded on `status: "needs_review"` and the count returned must equal the
// count planned, or the page's transaction is rolled back — a row somebody
// reviewed between the read and the write is left to the reviewer.

import { isCallReady } from "./normalise";
import { LICENCE_REGISTERS, licenceRegisterReason } from "./licenceRegisters";

const PAGE = 2000;

/**
 * Plan one page's effects without writing. Exported for the check.
 *
 * @returns {{ ids: string[], byCampaign: Map<string, object> }}
 */
export function planReclassification(rows = []) {
  const byCampaign = new Map();
  const ids = [];
  for (const row of rows) {
    if (row.status !== "needs_review" || row.doNotContactAt || row.possibleDuplicateOfId) continue;
    ids.push(row.id);
    if (!row.campaignId) continue;
    const c = byCampaign.get(row.campaignId) || {
      needsReviewCount: 0,
      unmappedCount: 0,
      bankedCount: 0,
      acceptedCount: 0,
      readyCount: 0,
      noWebsiteCount: 0,
    };
    c.needsReviewCount -= 1;
    if (row.tradeKey) {
      c.acceptedCount += 1;
      if (isCallReady(row)) c.readyCount += 1;
      if (!row.websiteUrl) c.noWebsiteCount += 1;
    } else {
      c.unmappedCount += 1;
      c.bankedCount += 1;
    }
    byCampaign.set(row.campaignId, c);
  }
  return { ids, byCampaign };
}

function increments(counters) {
  const data = {};
  for (const [k, v] of Object.entries(counters)) {
    if (!v) continue;
    data[k] = v > 0 ? { increment: v } : { decrement: -v };
  }
  return data;
}

/**
 * Run it.
 *
 * @param {{ db:object, dryRun?:boolean, now?:Date, adminId?:string|null }} args
 * @returns {{ dryRun:boolean, byProvider: Record<string,{ found:number, withTrade:number, withoutTrade:number, skipped:number }>,
 *             planned:number, updated:number, campaigns:number }}
 *          `planned` is what a real run WOULD write (or did); `updated` is
 *          what this run wrote, so a dry run reports planned > 0, updated 0.
 */
export async function reclassifyLicenceRegisterRows({ db, dryRun = true, now = new Date(), adminId = null } = {}) {
  if (!db) throw new Error("reclassifyLicenceRegisterRows: db is required");
  const providers = Object.keys(LICENCE_REGISTERS);
  const byProvider = {};
  for (const p of providers) byProvider[p] = { found: 0, withTrade: 0, withoutTrade: 0, skipped: 0 };
  let updated = 0;
  let planned = 0;
  const campaignsTouched = new Set();

  for (const provider of providers) {
    let cursor = null;
    for (;;) {
      // `id > last`, not Prisma's cursor: a real run changes the status of
      // the rows it just read, and an explicit id bound reads every row once
      // whether or not it still matches — the skipped ones are never counted
      // twice and the updated ones never re-read.
      const rows = await db.prospect.findMany({
        where: { sourceProvider: provider, status: "needs_review", ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: "asc" },
        take: PAGE,
        select: {
          id: true,
          status: true,
          tradeKey: true,
          campaignId: true,
          phoneE164: true,
          addressLine: true,
          websiteUrl: true,
          doNotContactAt: true,
          possibleDuplicateOfId: true,
        },
      });
      if (!rows.length) break;
      cursor = rows[rows.length - 1].id;

      const stats = byProvider[provider];
      const { ids, byCampaign } = planReclassification(rows);
      const plannedIds = new Set(ids);
      for (const row of rows) {
        stats.found += 1;
        if (!plannedIds.has(row.id)) stats.skipped += 1;
        else if (row.tradeKey) stats.withTrade += 1;
        else stats.withoutTrade += 1;
      }
      planned += ids.length;
      for (const id of byCampaign.keys()) campaignsTouched.add(id);
      if (dryRun || !ids.length) {
        if (rows.length < PAGE) break;
        continue;
      }

      await db.$transaction(
        async (tx) => {
          const result = await tx.prospect.updateMany({
            where: { id: { in: ids }, status: "needs_review", doNotContactAt: null, possibleDuplicateOfId: null },
            data: {
              status: "discovered",
              classification: "contractor",
              classificationReason: licenceRegisterReason(provider),
            },
          });
          if (result.count !== ids.length) {
            throw new Error(
              `reclassify: planned ${ids.length} rows and the guard matched ${result.count} — somebody reviewed one in between; run again`,
            );
          }
          for (const [campaignId, counters] of byCampaign) {
            await tx.prospectCampaign.update({ where: { id: campaignId }, data: increments(counters) });
          }
        },
        { timeout: 120000, maxWait: 10000 },
      );
      updated += ids.length;
      if (rows.length < PAGE) break;
    }
  }

  if (!dryRun && updated && adminId && typeof db.platformAuditLog?.create === "function") {
    await db.platformAuditLog.create({
      data: {
        platformAdminId: adminId,
        action: "sales_prospects_reclassified",
        details: { byProvider, updated, campaigns: campaignsTouched.size, at: now.toISOString() },
      },
    });
  }

  return { dryRun, byProvider, planned, updated, campaigns: campaignsTouched.size };
}
