// lib/sales/payoutAdmin.js
//
// What the platform console reads about payouts — the reads behind
// /platform/sales/payouts and the Payments section of a rep's card on
// /platform/sales/reps. One loader, because the two screens must show the
// same figure for the same batch, and two loaders is how they stop doing so.
//
// ══ Who may look ══════════════════════════════════════════════════════════
//
// Superadmin and admin can VIEW: what FieldQuo owes its reps is an operating
// figure an admin is allowed to read. Only a superadmin can MARK PAID — that
// is money leaving, and lib/sales/payoutProof.js re-checks the role itself.
// Support sees none of it: a rep's pay names the rep.
//
// ══ Every amount is re-summed ═════════════════════════════════════════════
//
// batchView sums the batch's own rows. It does not read totalCentsAtClose,
// for lib/sales/payouts.js's reason: that column "is deliberately NOT what
// anyone pays from". It is carried beside the sum so the screen can say the
// number MOVED since the close, which is the discrepancy the column exists
// to expose.
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { balanceCents } from "./commission";
import { hasProof, proofViewFor } from "./payoutProof";
import { owedSnapshot, periodTable } from "./payoutLedger";

/** Roles that may read the payout screens. Marking paid is narrower. */
export const PAYOUT_VIEW_ROLES = ["superadmin", "admin"];

export function canViewPayouts(role) {
  return PAYOUT_VIEW_ROLES.includes(role);
}

/**
 * The gate the two read routes share. Returns the admin, or the refusal to
 * answer with — 401 for no session, 403 for a role below admin.
 */
export async function payoutViewerOrRefusal(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { admin: null, refusal: { status: 401, body: { error: "Unauthorized" } } };
  if (!canViewPayouts(admin.role)) {
    return {
      admin: null,
      refusal: { status: 403, body: { error: "Only superadmins and admins can read sales payouts" } },
    };
  }
  return { admin, refusal: null };
}

const BATCH_SELECT = {
  id: true,
  salesRepId: true,
  periodStart: true,
  periodEnd: true,
  status: true,
  paidAt: true,
  totalCentsAtClose: true,
  proofUrl: true,
  proofFilename: true,
  paymentReference: true,
  paidVia: true,
  paymentNote: true,
  createdAt: true,
};

const ENTRY_SELECT = {
  id: true,
  salesRepId: true,
  amountCents: true,
  occurredAt: true,
  payoutBatchId: true,
};

/** One batch as the console shows it: its rows summed now, plus the proof. */
export function batchView(batch, entries, repName = null) {
  const lines = (Array.isArray(entries) ? entries : []).filter((e) => e.payoutBatchId === batch.id);
  const cents = balanceCents(lines);
  const closed = Number(batch.totalCentsAtClose) || 0;
  return {
    id: batch.id,
    salesRepId: batch.salesRepId,
    repName,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    status: batch.status,
    paidAt: batch.paidAt || null,
    cents,
    closedCents: closed,
    movedSinceClose: cents !== closed,
    entryCount: lines.length,
    hasProof: hasProof(batch),
    ...proofViewFor(batch),
  };
}

/** Everything the payouts screen needs, in one read. */
export async function payoutsOverview({ period = "week", now = new Date(), prisma = db } = {}) {
  const [reps, entries, batches] = await Promise.all([
    prisma.salesRep.findMany({
      select: { id: true, name: true, active: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.salesCommissionEntry.findMany({ select: ENTRY_SELECT }),
    prisma.salesPayoutBatch.findMany({ select: BATCH_SELECT, orderBy: { periodStart: "desc" } }),
  ]);
  const names = new Map(reps.map((r) => [r.id, r.name]));
  return {
    snapshot: owedSnapshot({ entries, batches, period, now }),
    table: periodTable({ reps, entries, batches, period, now }),
    batches: batches.map((b) => batchView(b, entries, names.get(b.salesRepId) || null)),
  };
}

/**
 * One rep's batches, newest first — scoped by salesRepId in the QUERY, not
 * by filtering a wider read afterwards, so the check script can assert the
 * where clause the way check-public-payload asserts a select.
 */
export async function repPayouts({ salesRepId, prisma = db } = {}) {
  if (!salesRepId) return { batches: [], accruingCents: 0 };
  const [entries, batches] = await Promise.all([
    prisma.salesCommissionEntry.findMany({ where: { salesRepId }, select: ENTRY_SELECT }),
    prisma.salesPayoutBatch.findMany({
      where: { salesRepId },
      select: BATCH_SELECT,
      orderBy: { periodStart: "desc" },
    }),
  ]);
  return {
    batches: batches.map((b) => batchView(b, entries)),
    accruingCents: balanceCents(entries.filter((e) => !e.payoutBatchId)),
  };
}

/**
 * The three per-rep figures on the accordion header: this week (unbatched),
 * owed (closed, not paid), paid (all time). From rows the caller already
 * read for every rep at once — one query for the whole team, not one per
 * card.
 */
export function repMoney(entries, batches) {
  const byBatch = new Map((Array.isArray(batches) ? batches : []).map((b) => [b.id, b]));
  const rows = Array.isArray(entries) ? entries : [];
  const statusOf = (e) => (e.payoutBatchId ? byBatch.get(e.payoutBatchId)?.status || "open" : null);
  return {
    thisWeekCents: balanceCents(rows.filter((e) => !e.payoutBatchId)),
    owedCents: balanceCents(rows.filter((e) => statusOf(e) === "ready")),
    paidCents: balanceCents(rows.filter((e) => statusOf(e) === "paid")),
  };
}
