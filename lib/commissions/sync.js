// lib/commissions/sync.js
//
// Loads one job's commission inputs from the database, runs the pure maths in
// ./compute.js, and brings the append-only ledger (JobCommissionEntry) into
// line with what is now earned.
//
// ══ When it runs ══════════════════════════════════════════════════════════
//
// After money moves on an invoice — every path that recomputes an invoice's
// amountPaid calls syncCommissionsForInvoice() once its own write has landed
// (the Stripe payment, refund and dispute recorders, a manual payment, a
// refund from FieldQuo, an amendment, a credit, a change-order bill). Commission
// is earned on what was COLLECTED; sending an invoice changes nothing here.
//
// It never throws into its caller. A payment is real whether or not a
// commission could be worked out, and a commission failure must not turn a
// Stripe webhook into a retried delivery. What protects the money is that the
// sync is a pure function of the current rows: a missed run is healed by the
// next one, by the "Recalculate" on the job card, and by the pay-run preview,
// which re-syncs every job whose invoices moved since it was last synced
// before it offers anyone a commission line (syncStaleCommissions below).
//
// ══ Idempotent by construction ════════════════════════════════════════════
//
// The ledger stores a running total per (invoice family, member, role). A sync
// computes the target total and writes the difference. A replayed webhook
// computes the same target and writes nothing. Two concurrent syncs both read
// seq N and both try to write seq N+1; the unique index on
// (invoiceRootId, memberId, role, seq) lets one through and the other retries,
// finds the target already reached, and writes nothing.

import { actualJobCost } from "@/lib/costing/actualJobCost";
import { loadJobSubcontracts } from "@/lib/costing/jobCostInputs";
import { effectiveWageRate } from "@/lib/payroll/buildPayRun";
import {
  computeJobCommissions,
  defaultEarners,
  ledgerDeltas,
  fromCents,
  toCents,
  paidFraction,
} from "./compute";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** The name a member is shown by — frozen onto ledger rows at write time. */
export function memberDisplayName(m) {
  return m?.user?.name || m?.user?.email || null;
}

/**
 * The job's invoice families: every invoice linked to the job, plus — for the
 * job a quote's acceptance created — the invoices raised from that quote and
 * never linked to any job. The same two answers, in the same order, as
 * lib/invoices/jobLink.js gives from the invoice's end.
 *
 * @returns the LATEST version of each family (the current document), with the
 *          ids of every version so payments can be found on any of them.
 */
export async function loadJobFamilies(db, { companyId, job }) {
  const or = [{ jobId: job.id }];
  if (job.quoteId) {
    // Only the OLDEST job on the quote owns its unlinked invoices — the one
    // resolveInvoiceJob would name. A second-phase job on the same quote must
    // not claim the first phase's invoice.
    const oldest = await db.job.findFirst({
      where: { quoteId: job.quoteId, companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (oldest?.id === job.id) or.push({ quoteId: job.quoteId, jobId: null });
  }
  const direct = await db.invoice.findMany({
    where: { companyId, OR: or },
    select: { id: true, parentInvoiceId: true },
  });
  const roots = [...new Set(direct.map((r) => r.parentInvoiceId || r.id))];
  if (!roots.length) return [];
  const rows = await db.invoice.findMany({
    where: { companyId, OR: [{ id: { in: roots } }, { parentInvoiceId: { in: roots } }] },
    select: {
      id: true,
      parentInvoiceId: true,
      version: true,
      invoiceNumber: true,
      status: true,
      total: true,
      amountPaid: true,
      discount: true,
      lineItems: true,
      historicalImportedAt: true,
    },
  });
  const byRoot = new Map();
  for (const r of rows) {
    const root = r.parentInvoiceId || r.id;
    const cur = byRoot.get(root) || { rootId: root, ids: [], latest: null };
    cur.ids.push(r.id);
    if (!cur.latest || Number(r.version || 1) > Number(cur.latest.version || 1)) cur.latest = r;
    byRoot.set(root, cur);
  }
  return [...byRoot.values()];
}

/**
 * Everything computeJobCommissions needs for one job, or null when the job is
 * not the company's or the company has commissions off.
 */
export async function loadJobCommissionInputs(db, { companyId, jobId, force = false }) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { commissionsEnabled: true, commissionsEnabledAt: true, commissionBasis: true },
  });
  if (!company || (!company.commissionsEnabled && !force)) return null;

  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: {
      id: true,
      title: true,
      quoteId: true,
      quote: { select: { assignedToId: true, createdById: true } },
      commission: { select: { id: true, earners: true } },
    },
  });
  if (!job) return null;

  const [families, members, timeRows, visitRows] = await Promise.all([
    loadJobFamilies(db, { companyId, job }),
    db.member.findMany({
      where: { companyId },
      select: {
        id: true,
        userId: true,
        active: true,
        workedByPct: true,
        soldByPct: true,
        laborCostPerHour: true,
        user: { select: { name: true, email: true } },
      },
    }),
    // Approved only — the same rule job costing and payroll keep. A pending
    // entry is a claim, and a claim does not make someone an earner.
    db.timeEntry.findMany({
      where: { jobId: job.id, status: "approved", worker: { companyId } },
      select: { hours: true, status: true, workerId: true, worker: { select: { userId: true, hourlyRate: true } } },
    }),
    db.jobVisit.findMany({
      where: { jobId: job.id, status: "completed", assignedToId: { not: null } },
      select: { assignedToId: true },
    }),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const memberByUser = new Map(members.filter((m) => m.userId).map((m) => [m.userId, m]));

  // ── Invoice families that may earn ─────────────────────────────────────
  //
  // Drafts are not documents a client has seen, and historical imports were
  // collected before the company used FieldQuo. A family whose FIRST payment
  // predates commissions being switched on earns nothing: turning the
  // feature on must not put last year's jobs on this week's pay run.
  const live = families.filter((f) => f.latest && f.latest.status !== "draft" && !f.latest.historicalImportedAt);
  const allIds = live.flatMap((f) => f.ids);
  const firstPaid = new Map();
  if (allIds.length) {
    const groups = await db.payment.groupBy({
      by: ["invoiceId"],
      where: { invoiceId: { in: allIds }, kind: { not: "refund" } },
      _min: { date: true },
    });
    const rootOf = new Map(live.flatMap((f) => f.ids.map((id) => [id, f.rootId])));
    for (const g of groups) {
      const root = rootOf.get(g.invoiceId);
      const d = g._min?.date ? new Date(g._min.date) : null;
      if (!root || !d) continue;
      const cur = firstPaid.get(root);
      if (!cur || d < cur) firstPaid.set(root, d);
    }
  }
  const enabledAt = company.commissionsEnabledAt ? new Date(company.commissionsEnabledAt) : null;
  const famInputs = live.map((f) => {
    const first = firstPaid.get(f.rootId) || null;
    return {
      rootId: f.rootId,
      invoiceId: f.latest.id,
      invoiceNumber: f.latest.invoiceNumber,
      total: num(f.latest.total),
      amountPaid: num(f.latest.amountPaid),
      discount: num(f.latest.discount),
      lineItems: f.latest.lineItems,
      eligible: !first || !enabledAt || first >= enabledAt,
      firstPaidAt: first,
    };
  });

  // ── Items on the lines ──────────────────────────────────────────────────
  const productIds = new Set();
  for (const f of famInputs) {
    for (const l of Array.isArray(f.lineItems) ? f.lineItems : []) {
      const pid = l?.productId || l?.meta?.template?.productId;
      if (typeof pid === "string" && pid) productIds.add(pid);
    }
  }
  const productRows = productIds.size
    ? await db.product.findMany({
        where: { companyId, id: { in: [...productIds] } },
        select: { id: true, name: true, commissionable: true, workedByPct: true, soldByPct: true },
      })
    : [];
  const products = new Map(productRows.map((p) => [p.id, p]));

  // ── Who earns ───────────────────────────────────────────────────────────
  const workedFound = [];
  for (const t of timeRows) {
    const m = t.worker?.userId ? memberByUser.get(t.worker.userId) : null;
    if (m) workedFound.push(m);
  }
  for (const v of visitRows) {
    const m = memberByUser.get(v.assignedToId);
    if (m) workedFound.push(m);
  }
  // The salesperson: whoever is working the quote, else whoever wrote it.
  // Null when neither — an instant estimate nobody signed in to create has no
  // seller, and nothing invents one.
  const sellerUserId = job.quote?.assignedToId || job.quote?.createdById || null;
  const seller = sellerUserId ? memberByUser.get(sellerUserId) : null;

  const stored = Array.isArray(job.commission?.earners) ? job.commission.earners : null;
  const earnerList =
    stored ??
    defaultEarners({
      worked: workedFound.map((m) => ({ memberId: m.id, workedByPct: m.workedByPct })),
      sold: seller ? [{ memberId: seller.id, soldByPct: seller.soldByPct }] : [],
    });
  const earners = earnerList.map((e) => {
    const m = memberById.get(e.memberId);
    return {
      ...e,
      name: memberDisplayName(m),
      memberPct: m ? (e.role === "sold" ? m.soldByPct : m.workedByPct) : null,
      missing: !m,
    };
  });

  // ── The job's gross cost, for the gross-profit basis ────────────────────
  //
  // The job page's own arithmetic (actualJobCost) with overhead left out on
  // purpose: GROSS profit is revenue less the cost of doing the work, and
  // overhead is the cost of being in business. Labour is approved hours at
  // the person's pay rate, falling back to their Member labour cost — the
  // same effectiveWageRate payroll uses, so an hour costs the same here as
  // on their payslip.
  let cost = null;
  let costDetail = null;
  if (company.commissionBasis === "gross_profit") {
    const [expenses, subcontracts] = await Promise.all([
      db.expense.findMany({
        where: { projectId: job.id, companyId },
        select: { id: true, category: true, amount: true },
      }),
      loadJobSubcontracts(db, { companyId, jobId: job.id }),
    ]);
    const laborCostByUser = new Map(
      members.filter((m) => m.userId && m.laborCostPerHour != null).map((m) => [m.userId, Number(m.laborCostPerHour)]),
    );
    const entries = timeRows.map((t) => ({
      hours: t.hours,
      status: t.status,
      workerId: t.workerId,
      worker: { hourlyRate: effectiveWageRate(t.worker, laborCostByUser) },
    }));
    const actual = actualJobCost(expenses, entries, { overheadPerJob: null, subcontracts });
    cost = actual.total;
    costDetail = {
      expenses: actual.expenses.total,
      labour: actual.labour.cost,
      subcontracts: actual.subcontracts?.total ?? 0,
      unratedHours: actual.labour.unratedHours,
    };
  }

  return {
    company,
    job,
    families: famInputs,
    products,
    earners,
    members,
    cost,
    costDetail,
    storedEarners: Boolean(stored),
    defaults: {
      worked: [...new Set(workedFound.map((m) => m.id))],
      sold: seller ? seller.id : null,
    },
  };
}

/** Run the maths over loaded inputs. Pure over its argument. */
export function computeFromInputs(inputs) {
  return computeJobCommissions({
    basis: inputs.company.commissionBasis,
    families: inputs.families,
    cost: inputs.cost ?? 0,
    earners: inputs.earners,
    products: inputs.products,
  });
}

/** The card's and the report's copy of the last computation. */
function summaryOf(inputs, result) {
  return {
    basis: result.basis,
    revenue: result.revenue,
    cost: result.cost,
    costDetail: inputs.costDetail,
    grossProfitRatio: result.grossProfitRatio,
    potential: fromCents(result.potentialCents),
    earned: fromCents(result.earnedCents),
    families: inputs.families.map((f) => ({
      rootId: f.rootId,
      invoiceId: f.invoiceId,
      invoiceNumber: f.invoiceNumber,
      total: f.total,
      amountPaid: f.amountPaid,
      paidFraction: paidFraction(f),
      eligible: f.eligible,
    })),
    earners: result.earners.map((e) => ({
      memberId: e.memberId,
      role: e.role,
      name: e.name,
      potential: fromCents(e.potentialCents),
      earned: fromCents(e.earnedCents),
    })),
  };
}

/**
 * Bring one job's ledger into line with what is now earned.
 *
 * @returns {{ written: number, result, inputs } | { skipped: reason }}
 */
export async function syncJobCommissions(db, { companyId, jobId, now = new Date() }, attempt = 0) {
  const inputs = await loadJobCommissionInputs(db, { companyId, jobId });
  if (!inputs) return { skipped: "off_or_missing" };
  const result = computeFromInputs(inputs);

  // Target: what each (family, member, role) has earned, in cents.
  const target = new Map();
  const detailFor = new Map();
  const famById = new Map(inputs.families.map((f) => [f.rootId, f]));
  for (const e of result.earners) {
    for (const b of e.byFamily) {
      const key = `${b.rootId}|${e.memberId}|${e.role}`;
      target.set(key, b.earnedCents);
      const fam = famById.get(b.rootId);
      detailFor.set(key, {
        basis: result.basis,
        invoiceNumber: fam?.invoiceNumber || null,
        paidFraction: fam ? Math.round(paidFraction(fam) * 10000) / 10000 : null,
        potential: fromCents(b.potentialCents),
        splitPct: e.splitPct,
        fixedAmount: e.fixedAmount,
        grossProfitRatio: result.grossProfitRatio,
      });
    }
  }

  // What the ledger holds: the latest row per key.
  const held = await db.jobCommissionEntry.findMany({
    where: { companyId, jobId },
    select: { invoiceRootId: true, memberId: true, role: true, seq: true, total: true, detail: true },
    orderBy: { seq: "asc" },
  });
  const current = new Map();
  for (const h of held) {
    current.set(`${h.invoiceRootId}|${h.memberId}|${h.role}`, {
      totalCents: toCents(h.total),
      seq: h.seq,
      paidFraction: h.detail && typeof h.detail === "object" ? h.detail.paidFraction ?? null : null,
    });
  }

  const deltas = ledgerDeltas(current, target);
  const nameOf = new Map(inputs.members.map((m) => [m.id, memberDisplayName(m)]));
  let written = 0;
  try {
    if (deltas.length) {
      await db.$transaction(
        deltas.map((d) => {
          const fam = famById.get(d.rootId);
          const had = current.get(d.key);
          // Why the figure moved, in the ledger's own words: the share of the
          // invoice collected went up (a payment) or down (a refund, a lost
          // dispute), or it did not move and something else did — a split
          // edited, a rate changed, costs arriving on a gross-profit job.
          const nowFraction = fam ? Math.round(paidFraction(fam) * 10000) / 10000 : 0;
          const wasFraction = had?.paidFraction ?? 0;
          const reason = nowFraction > wasFraction ? "payment" : nowFraction < wasFraction ? "refund" : "recalculated";
          return db.jobCommissionEntry.create({
            data: {
              companyId,
              jobId,
              invoiceRootId: d.rootId,
              memberId: d.memberId,
              memberName: nameOf.get(d.memberId) || null,
              role: d.role,
              seq: d.seq,
              amount: fromCents(d.deltaCents),
              total: fromCents(d.totalCents),
              reason,
              detail: detailFor.get(d.key) || { basis: result.basis, removed: true },
              createdAt: now,
            },
          });
        }),
      );
      written = deltas.length;
    }
  } catch (err) {
    // A concurrent sync wrote the same seq first. Re-run once from the top:
    // it will read their rows and write only what is still missing, which is
    // usually nothing.
    if (err?.code === "P2002" && attempt < 2) return syncJobCommissions(db, { companyId, jobId, now }, attempt + 1);
    throw err;
  }

  await db.jobCommission.upsert({
    where: { jobId },
    create: { companyId, jobId, basis: result.basis, summary: summaryOf(inputs, result), syncedAt: now },
    update: { basis: result.basis, summary: summaryOf(inputs, result), syncedAt: now },
  });

  return { written, result, inputs };
}

/**
 * Re-sync every job whose invoices moved since it was last synced. Run by the
 * pay-run preview before it offers commission lines, so a sync a crashed hook
 * never ran cannot leave someone short (or long) on a pay run.
 *
 * Bounded: the newest `limit` invoices with money on them since commissions
 * were switched on. A company with more than that moving between two pay runs
 * is past what this product's customers look like, and the report says so.
 */
export async function syncStaleCommissions(db, { companyId, limit = 300 }) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { commissionsEnabled: true, commissionsEnabledAt: true },
  });
  if (!company?.commissionsEnabled) return { synced: 0, truncated: false };
  const since = company.commissionsEnabledAt || new Date(0);
  const moved = await db.invoice.findMany({
    where: {
      companyId,
      updatedAt: { gte: since },
      OR: [{ amountPaid: { gt: 0 } }, { amountRefunded: { gt: 0 } }],
    },
    select: { id: true, jobId: true, quoteId: true, parentInvoiceId: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit + 1,
  });
  const truncated = moved.length > limit;
  const rows = moved.slice(0, limit);

  // Resolve each invoice to its job once; group by job, keeping the newest
  // movement, and compare with the job's last sync.
  const quoteIds = [...new Set(rows.filter((r) => !r.jobId && r.quoteId).map((r) => r.quoteId))];
  const quoteJobs = quoteIds.length
    ? await db.job.findMany({
        where: { companyId, quoteId: { in: quoteIds } },
        select: { id: true, quoteId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const firstJobForQuote = new Map();
  for (const j of quoteJobs) if (!firstJobForQuote.has(j.quoteId)) firstJobForQuote.set(j.quoteId, j.id);
  const newest = new Map();
  for (const r of rows) {
    const jobId = r.jobId || (r.quoteId ? firstJobForQuote.get(r.quoteId) : null);
    if (!jobId) continue;
    const cur = newest.get(jobId);
    if (!cur || r.updatedAt > cur) newest.set(jobId, r.updatedAt);
  }
  if (!newest.size) return { synced: 0, truncated };
  const synced = await db.jobCommission.findMany({
    where: { companyId, jobId: { in: [...newest.keys()] } },
    select: { jobId: true, syncedAt: true },
  });
  const syncedAt = new Map(synced.map((s) => [s.jobId, s.syncedAt]));
  let count = 0;
  for (const [jobId, movedAt] of newest) {
    const last = syncedAt.get(jobId);
    if (last && last >= movedAt) continue;
    try {
      await syncJobCommissions(db, { companyId, jobId });
      count += 1;
    } catch (err) {
      console.error("[commissions] stale sync failed for job", jobId, err?.message);
    }
  }
  return { synced: count, truncated };
}
