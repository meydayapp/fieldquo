// lib/sales/discovery/suggestTradesAiApproval.js
//
// The owner's yes to the paid pass, stored, so a cron can run it unattended
// and stop on its own.
//
// ══ Why an approval and not a button ═══════════════════════════════════════
//
// The owner approved Phase 2 ("yes… ≈ $6.86") on 2026-09-13. Two facts made
// the button the wrong shape: the local .env has no OPENAI_API_KEY (the key
// is Sensitive in Vercel — AGENTS.md), so the run has to happen on Vercel;
// and the button runs one four-minute slice per press, which for 1,538 calls
// is twenty presses. So the yes is a ROW, the sales-pipeline cron reads it
// every minute and does up to ~3 minutes of batches, and the row clears
// itself when the rows run out or the cap is hit — saying which.
//
// ══ Where it lives ═════════════════════════════════════════════════════════
//
// `PlatformAiBudget`, scope "job", scopeId TRADE_SUGGEST_AI_JOB. Not a new
// table: an approval to spend up to N on X is exactly what a budget row is,
// and that table was built to stop an unattended model loop (its schema
// comment). `active` is the approval; `approvedAt` / `approvedBy` / `note` are
// the three columns added for it. `limitMicros` is the CAP — $10 against a
// $6.86 estimate, the honest guard against a mis-estimate — and the spend it
// is checked against is summed from PlatformAiUsage for the area from
// `approvedAt`, never read off `cachedSpentMicros` (which is refreshed for
// the console only, the table's own rule).
//
// ══ What one slice does ════════════════════════════════════════════════════
//
//   1. no active job row → nothing, and says so;
//   2. spent ≥ cap → clear ("budget"), nothing sent;
//   3. run suggestTradesAi with the time left and the MONEY left, so a slice
//      cannot overshoot the cap by more than one batch;
//   4. re-sum the ledger, refresh the cache, and clear when the rows are done
//      or the cap is reached — one audit row per slice either way.
//
// Two approvals in a row re-stamp `approvedAt`, so the second sums only its
// own spend. Clearing never deletes: the row stays with its note.
//
// ══ One slice at a time ════════════════════════════════════════════════════
//
// Measured in the first twenty minutes of the real pass: the cron fires
// every minute, a slice runs three, so three slices overlapped — each began
// at the top of the same selection (a row is excluded only once its answer
// is WRITTEN, and a call takes forty seconds) and 58 calls answered 2,100
// rows. The same hundred names, asked three times, at three times the cost:
// $17 to finish against a $10 cap. So a slice first CLAIMS the job row —
// `sliceLeaseUntil` set to now + its deadline + a minute, guarded on the
// lease being null or past, the way runner.js claims a task — and a tick
// that finds the lease held does nothing and says so. A slice that dies
// leaves a lease that expires on its own.
//
// ══ Where the record of a cron slice lives ═════════════════════════════════
//
// `PlatformAuditLog.platformAdminId` is NOT NULL — the table records what a
// PERSON did — so an unattended slice (adminId null) cannot write there and
// does not try; the same line reclassifyRegisters.js draws. Its record is
// the ledger (one PlatformAiUsage row per model call, area
// TRADE_SUGGESTION_AI_AREA, with the row count in `meta`), the budget row's
// `cachedSpentMicros` / `cachedAt` refreshed after every slice, and the note
// when it clears. A slice a superadmin triggered from the button audits as
// them. `sliceAudit()` below is the one place that decides.

import { recordPlatformAiUsage } from "@/lib/ai/platformUsage";
import { formatCost } from "@/lib/ai/usage";
import { TRADE_SUGGESTION_AI_AREA, estimateAiCost, suggestTradesAi } from "./suggestTradesAi";

export const TRADE_SUGGEST_AI_JOB = "trade_suggest_ai";
export const JOB_SCOPE = "job";

/** The cap: $10.00. The estimate was $6.86; the cap is not the estimate. */
export const TRADE_SUGGEST_AI_CAP_MICROS = 10_000_000;

/** Why an approval was cleared. A closed vocabulary, for the note and the audit row. */
export const CLEAR_REASONS = Object.freeze({
  done: "every row has been asked",
  budget: "the budget cap was reached",
  stopped: "stopped by a superadmin",
});

const where = { scope_scopeId: { scope: JOB_SCOPE, scopeId: TRADE_SUGGEST_AI_JOB } };

/** How long past its deadline a slice may hold the job before a tick reclaims it. */
export const LEASE_MARGIN_MS = 60_000;

async function sliceAudit(db, adminId, action, details) {
  if (!adminId) return null;
  return db.platformAuditLog.create({ data: { platformAdminId: adminId, action, details } });
}

/** Spend under this approval, from the ledger. */
export async function spentSinceApproval(db, approvedAt) {
  if (!approvedAt) return 0;
  const sum = await db.platformAiUsage.aggregate({
    where: { area: TRADE_SUGGESTION_AI_AREA, createdAt: { gte: approvedAt } },
    _sum: { costMicros: true },
  });
  return Number(sum?._sum?.costMicros) || 0;
}

/**
 * The approval, in one shape whether or not a row exists.
 *
 * @returns {Promise<{ approved:boolean, approvedAt:Date|null, approvedBy:string|null, limitMicros:number,
 *                     spentMicros:number, remainingMicros:number, note:string|null }>}
 */
export async function loadTradeSuggestAiApproval(db) {
  const row = await db.platformAiBudget.findUnique({ where });
  const approvedAt = row?.approvedAt ? new Date(row.approvedAt) : null;
  const limitMicros = Number(row?.limitMicros) || 0;
  const spentMicros = row?.active ? await spentSinceApproval(db, approvedAt) : Number(row?.cachedSpentMicros) || 0;
  return {
    approved: Boolean(row?.active),
    approvedAt,
    approvedBy: row?.approvedBy || null,
    limitMicros,
    spentMicros,
    remainingMicros: Math.max(0, limitMicros - spentMicros),
    note: row?.note || null,
  };
}

/**
 * Say yes. Upserts the job row active with a fresh `approvedAt`, the cap,
 * who, and what was known; one audit row.
 */
export async function approveTradeSuggestAi(db, { approvedBy, budgetMicros = TRADE_SUGGEST_AI_CAP_MICROS, adminId = null, now = new Date() } = {}) {
  const by = String(approvedBy || "").trim();
  if (!by) throw new Error("approveTradeSuggestAi: approvedBy is required — an approval names who said yes");
  const cap = Math.max(0, Math.floor(Number(budgetMicros) || 0));
  if (!cap) throw new Error("approveTradeSuggestAi: a zero budget is not an approval");
  const estimate = await estimateAiCost({ db, now });
  const note = `approved ${now.toISOString()} by ${by} · ${estimate.rows.toLocaleString()} rows remained · estimate ${estimate.priced ? formatCost(estimate.costMicros) : "unpriced"} · cap ${formatCost(cap)}`;
  const row = await db.platformAiBudget.upsert({
    where,
    create: { scope: JOB_SCOPE, scopeId: TRADE_SUGGEST_AI_JOB, limitMicros: cap, active: true, approvedAt: now, approvedBy: by, note, cachedSpentMicros: 0, cachedAt: now },
    update: { limitMicros: cap, active: true, approvedAt: now, approvedBy: by, note, cachedSpentMicros: 0, cachedAt: now },
  });
  await sliceAudit(db, adminId, "sales_trade_suggestions_ai_approval", { kind: "approved", approvedBy: by, capMicros: cap, remainingAtApproval: estimate.rows, estimateMicros: estimate.costMicros, model: estimate.model });
  return { row, estimate };
}

/** Withdraw or finish the approval. The row stays; the note says why. */
export async function clearTradeSuggestAiApproval(db, { reason, spentMicros = null, remaining = null, adminId = null, now = new Date() } = {}) {
  if (!CLEAR_REASONS[reason]) throw new Error(`clearTradeSuggestAiApproval: "${reason}" is not a reason`);
  const row = await db.platformAiBudget.findUnique({ where });
  if (!row) return null;
  const spent = spentMicros ?? (await spentSinceApproval(db, row.approvedAt));
  const note = `${row.note || ""} · cleared ${now.toISOString()}: ${CLEAR_REASONS[reason]} (spent ${formatCost(spent)}${remaining !== null ? `, ${Number(remaining).toLocaleString()} rows left` : ""})`;
  const updated = await db.platformAiBudget.update({
    where,
    data: { active: false, note, cachedSpentMicros: spent, cachedAt: now },
  });
  await sliceAudit(db, adminId, "sales_trade_suggestions_ai_approval", { kind: "cleared", reason, spentMicros: spent, remaining });
  return updated;
}

/**
 * One unattended slice. Safe to call every minute.
 *
 * @param {{ db:object, deadlineMs:number, now?:Date, trigger?:string, adminId?:string|null, run?:Function }} args
 *        `run` defaults to suggestTradesAi; injectable so the check can drive
 *        the gate without a model.
 * @returns {Promise<{ ran:boolean, skipped?:string, cleared?:string|null, spentMicros?:number, limitMicros?:number, result?:object }>}
 */
export async function runTradeSuggestAiSlice({ db, deadlineMs, now = new Date(), trigger = "cron", adminId = null, run = suggestTradesAi } = {}) {
  if (!db) throw new Error("runTradeSuggestAiSlice: db is required");
  const approval = await loadTradeSuggestAiApproval(db);
  if (!approval.approved) return { ran: false, skipped: "no approval" };
  if (approval.remainingMicros <= 0) {
    await clearTradeSuggestAiApproval(db, { reason: "budget", spentMicros: approval.spentMicros, adminId, now });
    return { ran: false, skipped: "budget spent", cleared: "budget", spentMicros: approval.spentMicros, limitMicros: approval.limitMicros };
  }
  if (!(deadlineMs > 0)) return { ran: false, skipped: "no time left in this invocation" };

  // The claim. A guarded updateMany, never read-then-write: two ticks that
  // both read "no lease" would both run, which is the overlap this exists
  // to stop.
  const leaseUntil = new Date(now.getTime() + deadlineMs + LEASE_MARGIN_MS);
  const claimed = await db.platformAiBudget.updateMany({
    where: { scope: JOB_SCOPE, scopeId: TRADE_SUGGEST_AI_JOB, active: true, OR: [{ sliceLeaseUntil: null }, { sliceLeaseUntil: { lt: now } }] },
    data: { sliceLeaseUntil: leaseUntil },
  });
  if (claimed.count !== 1) return { ran: false, skipped: "another slice holds the job" };

  let result;
  try {
    result = await run({ db, deadlineMs, budgetMicros: approval.remainingMicros, now, recordUsage: recordPlatformAiUsage });
  } finally {
    // Released whatever happened; a throw still propagates to the caller's
    // try/catch, and the next tick may run rather than wait out the lease.
    await db.platformAiBudget.updateMany({ where: { scope: JOB_SCOPE, scopeId: TRADE_SUGGEST_AI_JOB }, data: { sliceLeaseUntil: null } });
  }

  const spentMicros = await spentSinceApproval(db, approval.approvedAt);
  await db.platformAiBudget.update({ where, data: { cachedSpentMicros: spentMicros, cachedAt: now } });

  let cleared = null;
  if (result.remaining === 0 && !result.stopped) cleared = "done";
  else if (spentMicros >= approval.limitMicros || result.stopped === "job_budget") cleared = "budget";
  if (cleared) await clearTradeSuggestAiApproval(db, { reason: cleared, spentMicros, remaining: result.remaining, adminId, now });

  await sliceAudit(db, adminId, "sales_trade_suggestions_ai", {
        trigger,
        model: result.model,
        considered: result.considered,
        written: result.written,
        unknown: result.unknown,
        notContractor: result.notContractor,
        byTrade: result.byTrade,
        batches: result.batches,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        costMicros: result.costMicros,
        spentUnderApprovalMicros: spentMicros,
        capMicros: approval.limitMicros,
        stopped: result.stopped,
        remaining: result.remaining,
        cleared,
        seconds: result.seconds,
  });
  return { ran: true, cleared, spentMicros, limitMicros: approval.limitMicros, result };
}
