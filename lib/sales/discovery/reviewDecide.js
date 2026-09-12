// lib/sales/discovery/reviewDecide.js
//
// One prospect, one decision, written — the Review folder's single-row path.
//
// Split from app/api/platform/sales/review/route.js so the write shape can be
// driven against an in-memory client by scripts/check-review-folder.mjs: that
// an accept sets the trade, writes a ProspectCorrection, moves the campaign's
// counters by the effects table's deltas, audits, and queues research — and
// that a row somebody changed between the read and the write is refused
// rather than double-counted. reviewFolder.js decides WHAT happens; this file
// does it in order, in one transaction, and says what it did.

import {
  DECISION_FIELDS,
  REVIEW_DECISIONS,
  counterUpdates,
  decisionEffects,
  untouchableGuardWhere,
} from "./reviewFolder";
import { isDiscoveryTradeKey } from "./trades";
import { ensureResearchQueued } from "@/lib/sales/pipeline/research";
import { claimState } from "@/lib/sales/prospectView";

/**
 * @param {{ db:object, prospectId:string, decision:string, tradeKey?:string|null,
 *           adminId:string, now?:Date, queueResearch?:Function }} args
 *        `queueResearch` defaults to ensureResearchQueued; injectable so a
 *        check can see it called without a pipeline behind it.
 * @returns {Promise<{ ok:true, bucket:string, counters:object, research:object|null }
 *                  | { ok:false, status:number, error:string }>}
 */
export async function reviewDecide({
  db,
  prospectId,
  decision,
  tradeKey = null,
  adminId,
  now = new Date(),
  queueResearch = ensureResearchQueued,
} = {}) {
  if (!db) throw new Error("reviewDecide: db is required");
  const id = String(prospectId ?? "").trim();
  if (!id) return { ok: false, status: 400, error: "Which prospect?" };
  if (!REVIEW_DECISIONS.includes(decision)) {
    return { ok: false, status: 400, error: `A review is one of ${REVIEW_DECISIONS.join(", ")}.` };
  }
  if (decision === "accept" && !isDiscoveryTradeKey(tradeKey)) {
    return { ok: false, status: 400, error: "Accepting needs a trade from the catalogue." };
  }

  const prospect = await db.prospect.findUnique({
    where: { id },
    select: { ...DECISION_FIELDS, assignedRepId: true, claimExpiresAt: true },
  });
  if (!prospect) return { ok: false, status: 404, error: "No such prospect." };

  // A rep holds it: it is with a human already. Re-checked here, not trusted
  // from the list, which was rendered before the claim.
  const claim = claimState(prospect, { repId: null, now });
  if (claim.state === "held" || claim.state === "held_worked") {
    return { ok: false, status: 409, error: "A rep is working this prospect right now; leave it to them." };
  }

  const effects = decisionEffects(prospect, decision, { tradeKey, now });
  if (!effects.ok) return { ok: false, status: 400, error: effects.error };

  let changed = false;
  await db.$transaction(async (tx) => {
    // Guarded on the status that was read AND on the untouchable rule, so a
    // row somebody reviewed, claimed or suppressed between the read and this
    // write is left alone — and the caller is told.
    const moved = await tx.prospect.updateMany({
      where: { id: prospect.id, status: prospect.status, ...untouchableGuardWhere(now) },
      data: effects.data,
    });
    if (moved.count !== 1) {
      changed = true;
      return;
    }

    const counters = counterUpdates(effects.counters);
    if (prospect.campaignId && Object.keys(counters).length) {
      await tx.prospectCampaign.update({ where: { id: prospect.campaignId }, data: counters });
    }
    if (effects.correction) {
      await tx.prospectCorrection.create({
        data: { prospectId: prospect.id, correctedByAdminId: adminId, ...effects.correction },
      });
    }
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: adminId,
        action: "sales_prospect_reviewed",
        details: {
          surface: "review_folder",
          campaignId: prospect.campaignId,
          prospectId: prospect.id,
          businessName: prospect.businessName,
          decision,
          tradeKey: decision === "accept" ? tradeKey : null,
          bucket: effects.bucket,
          // What the classifier said, so overturned verdicts stay countable.
          machineReason: prospect.classificationReason,
        },
      },
    });
  });
  if (changed) return { ok: false, status: 409, error: "Somebody changed this row since you loaded it. Reload." };

  // ── Research the row a human just accepted ──────────────────────────────
  //
  // Outside the transaction on purpose, the same reasoning as the campaign
  // review route: the decision is written and audited whether or not the
  // queue accepts the task. Backlog lane — nobody is waiting on this row yet;
  // the claim path promotes it the moment a rep takes it.
  let research = null;
  if (effects.research) {
    try {
      research = await queueResearch({ db, prospectIds: [prospect.id], priority: "backlog", now });
    } catch (err) {
      console.error("[review] research did not queue:", err);
      research = { error: err?.message || String(err) };
    }
  }

  return { ok: true, bucket: effects.bucket, counters: effects.counters, research };
}
