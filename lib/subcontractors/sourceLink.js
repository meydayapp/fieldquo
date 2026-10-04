// lib/subcontractors/sourceLink.js
//
// The live link between a subcontractor's FieldQuo quote and the general
// contractor's job it was imported into — what happens AFTER the import
// (lib/quotes/importQuote.js), in the order the owner laid it out on
// 2026-09-29:
//
//   1. The GC's own client accepts → the GC's quote becomes a job →
//      adoptImportsOnJob(): the sender is found (or added) on the GC's
//      subcontractor list and put on that job, ADOPTING the import's
//      materialised expense so job costing counts the cost exactly once
//      (lib/subcontractors/money.js explains the two roads and why).
//   2. The sub changes the price through their own change-order flow, sent to
//      the GC, who approves and signs on the same screen their own clients
//      use. ONLY an approved AND signed change order moves the GC's side, and
//      it REPLACES the figure (snapshot + every signed delta), never adds to
//      whatever the row said last — so a retried request, or the same
//      signature arriving twice, cannot count a change twice.
//   3. The sub invoices the GC → a SubcontractorBill copy lands on the GC's
//      job. The cost stays the APPROVED figure; a bill that matches it is the
//      same number, and one that doesn't is flagged, never silently adopted.
//
// ══ The tenant boundary ════════════════════════════════════════════════════
//
// Every read of the sub's tenant here goes through the QuoteImport row — the
// one record both companies share, created by the GC holding the sub's quote
// link. What crosses to the GC is exactly what the sub SENT the GC: the
// quote's price (already the import snapshot), the change orders the GC
// itself signed (their deltas only), and the invoices addressed to the GC
// (number, total, date). Never the sub's other change orders' text, never
// their costs, never another client's anything. And every WRITE lands in the
// GC's tenant, scoped by the import's targetCompanyId — nothing here writes
// to the sub's rows.
//
// The GC's price to THEIR client is not touched by any of it. A sub's
// +$250 change order moves the GC's cost to $3,250; the GC's quote to the
// homeowner stays $3,600 until the GC decides otherwise.
//
// ══ Best effort ════════════════════════════════════════════════════════════
//
// Every DB entry point is called after the thing that matters has committed
// (the job exists, the signature is recorded, the invoice was sent) and must
// never fail it. They log and return.
//
// No import of @/lib/db: callers pass `db`, so scripts/check-subcontractors.mjs
// runs every branch against an in-memory stand-in.

import { SUBCONTRACT_IMPORT_EXPENSE_CATEGORY } from "@/lib/subcontractors/money";
import {
  PROFILE_COMPANY_SELECT,
  ROSTER_FILL_SELECT,
  documentProfileOf,
  profileFillPatch,
} from "@/lib/subcontractors/profileFill";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const cents = (v) => Math.round(num(v) * 100);
const round2 = (v) => cents(v) / 100;

// The label performImport falls back to when the GC typed none. It names no
// trade, so it is not written into Subcontractor.trade — "Subcontracted work"
// as a trade would be a word nobody chose.
const DEFAULT_IMPORT_LABEL = "Subcontracted work";

// ── Pure ────────────────────────────────────────────────────────────────────

/**
 * Did the CLIENT approve and sign this change order? Both halves: a change
 * order a staff member marked approved without a signature (the old "the
 * client agreed on the phone" path) is the sub's own record, not the GC's
 * agreement, and must not move the GC's cost.
 */
export function isSignedApproval(co) {
  if (!co || co.status !== "approved") return false;
  const sig = co.signature;
  return Boolean(sig && typeof sig === "object" && typeof sig.name === "string" && sig.name.trim());
}

/**
 * The approved subcontract figure: what the GC booked (the import snapshot)
 * plus every change order the GC signed. Recomputed from scratch every time —
 * the property that makes the sync idempotent.
 */
export function approvedSubcontractTotal({ snapshotAmount, changeOrders } = {}) {
  let total = cents(snapshotAmount);
  for (const co of Array.isArray(changeOrders) ? changeOrders : []) {
    if (!isSignedApproval(co)) continue;
    total += cents(co.priceDelta);
  }
  return total / 100;
}

/**
 * What the GC has actually RECEIVED of one of the sub's invoices: the highest
 * version that was sent. Amending a sent invoice writes a new version row
 * (lib/invoices/lifecycle.js); a draft amendment the GC never got is not a
 * bill. Null when nothing of it was ever sent.
 *
 * @param root { id, invoiceNumber, total, version, sentAt, versions: [...] }
 */
export function latestSentVersion(root) {
  if (!root) return null;
  const all = [root, ...(Array.isArray(root.versions) ? root.versions : [])];
  const sent = all.filter((v) => v && v.sentAt);
  if (!sent.length) return null;
  sent.sort((a, b) => num(b.version) - num(a.version));
  const top = sent[0];
  return {
    sourceInvoiceId: root.id,
    invoiceNumber: String(top.invoiceNumber || root.invoiceNumber || ""),
    total: round2(top.total),
    version: Math.max(1, Math.trunc(num(top.version)) || 1),
    sentAt: top.sentAt ? new Date(top.sentAt) : null,
  };
}

/**
 * The GC-side verdict on the sub's bills against the approved figure.
 *
 *   none     — nothing billed yet
 *   matches  — billed total equals the approved total, to the cent
 *   differs  — it doesn't; the job says so ("Invoice $X differs from approved
 *              $Y") and the cost stays the approved figure
 *
 * Compared in cents: 3250.1 + 0.2 is not 3250.3 in floating point.
 */
export function subcontractBillState({ agreedAmount, bills } = {}) {
  const list = Array.isArray(bills) ? bills : [];
  const approved = round2(agreedAmount);
  if (!list.length) return { state: "none", billed: 0, approved, count: 0 };
  const billedCents = list.reduce((s, b) => s + cents(b.total), 0);
  const billed = billedCents / 100;
  return {
    state: billedCents === cents(approved) ? "matches" : "differs",
    billed,
    approved,
    count: list.length,
  };
}

// ── The sub's side, read through the import ─────────────────────────────────

/**
 * The sub's jobs for the imported quote, their change orders, and the
 * invoices they sent for that work. Always scoped to the SOURCE company named
 * on the import — a job id or quote id alone never reaches across tenants.
 */
async function loadSourceSide(db, { sourceQuoteId, sourceCompanyId }) {
  const jobs = await db.job.findMany({
    where: { quoteId: sourceQuoteId, companyId: sourceCompanyId },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const changeOrders = jobIds.length
    ? await db.changeOrder.findMany({
        where: { jobId: { in: jobIds } },
        select: { status: true, priceDelta: true, signature: true },
      })
    : [];
  const invoices = await db.invoice.findMany({
    where: {
      companyId: sourceCompanyId,
      parentInvoiceId: null,
      OR: [{ quoteId: sourceQuoteId }, ...(jobIds.length ? [{ jobId: { in: jobIds } }] : [])],
    },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      version: true,
      sentAt: true,
      versions: { select: { invoiceNumber: true, total: true, version: true, sentAt: true } },
    },
  });
  return { jobIds, changeOrders, invoices };
}

/**
 * Bring every GC-side row that hangs off imports of this source quote into
 * line: JobSubcontractor.agreedAmount = the approved total, the import's
 * materialised expense = the same figure, and one SubcontractorBill per
 * invoice the sub sent. Idempotent — run it twice, get the same rows.
 *
 * @returns {{ imports: number, rowsUpdated: number, bills: number }}
 */
export async function syncFromSourceQuote(db, { sourceQuoteId, sourceCompanyId }) {
  const out = { imports: 0, rowsUpdated: 0, bills: 0 };
  if (!sourceQuoteId || !sourceCompanyId) return out;
  try {
    const imports = await db.quoteImport.findMany({
      where: { sourceQuoteId, sourceCompanyId },
      select: { id: true, snapshotAmount: true, targetCompanyId: true, expenseId: true },
    });
    if (!imports.length) return out;
    out.imports = imports.length;

    const source = await loadSourceSide(db, { sourceQuoteId, sourceCompanyId });
    const sentBills = source.invoices.map(latestSentVersion).filter(Boolean);

    for (const imp of imports) {
      const approved = approvedSubcontractTotal({
        snapshotAmount: imp.snapshotAmount,
        changeOrders: source.changeOrders,
      });

      // The GC's rows only: targetCompanyId is on the import, and the row's
      // own companyId must agree with it.
      const rows = await db.jobSubcontractor.findMany({
        where: { companyId: imp.targetCompanyId, quoteImportId: imp.id },
        select: { id: true, agreedAmount: true },
      });
      for (const row of rows) {
        if (cents(row.agreedAmount) !== cents(approved)) {
          await db.jobSubcontractor.update({ where: { id: row.id }, data: { agreedAmount: approved } });
          out.rowsUpdated++;
        }
        for (const bill of sentBills) {
          await db.subcontractorBill.upsert({
            where: {
              jobSubcontractorId_sourceInvoiceId: { jobSubcontractorId: row.id, sourceInvoiceId: bill.sourceInvoiceId },
            },
            create: {
              companyId: imp.targetCompanyId,
              jobSubcontractorId: row.id,
              sourceCompanyId,
              sourceInvoiceId: bill.sourceInvoiceId,
              invoiceNumber: bill.invoiceNumber,
              total: bill.total,
              version: bill.version,
              sentAt: bill.sentAt,
            },
            update: {
              invoiceNumber: bill.invoiceNumber,
              total: bill.total,
              version: bill.version,
              sentAt: bill.sentAt,
            },
          });
          out.bills++;
        }
      }

      // The other road (money.js): an import nobody adopted still counts
      // through its expense, so that figure follows the approval too. By id
      // AND the GC's company AND the import category — never another row.
      if (imp.expenseId) {
        await db.expense.updateMany({
          where: { id: imp.expenseId, companyId: imp.targetCompanyId, category: SUBCONTRACT_IMPORT_EXPENSE_CATEGORY },
          data: { amount: approved },
        });
      }
    }
  } catch (err) {
    console.error("[subcontractors/sourceLink] sync", sourceQuoteId, err?.message);
  }
  return out;
}

/**
 * The sub's job changed (a change order was signed, or a signed one was
 * taken back). Resolves the job's quote and syncs. Safe for any job — a job
 * whose quote was never imported anywhere finds no imports and stops.
 */
export async function syncForSourceJob(db, { jobId }) {
  if (!jobId) return null;
  try {
    const job = await db.job.findUnique({ where: { id: jobId }, select: { quoteId: true, companyId: true } });
    if (!job?.quoteId) return null;
    return await syncFromSourceQuote(db, { sourceQuoteId: job.quoteId, sourceCompanyId: job.companyId });
  } catch (err) {
    console.error("[subcontractors/sourceLink] job", jobId, err?.message);
    return null;
  }
}

/**
 * The sub sent an invoice. Its quote is the invoice's own quoteId, or the
 * quote of the job it was raised on.
 */
export async function syncForSourceInvoice(db, { invoiceId }) {
  if (!invoiceId) return null;
  try {
    const inv = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: { companyId: true, quoteId: true, jobId: true, parentInvoiceId: true },
    });
    if (!inv) return null;
    let quoteId = inv.quoteId;
    if (!quoteId && inv.parentInvoiceId) {
      const root = await db.invoice.findUnique({ where: { id: inv.parentInvoiceId }, select: { quoteId: true, jobId: true } });
      quoteId = root?.quoteId || null;
      if (!quoteId && root?.jobId) inv.jobId = root.jobId;
    }
    if (!quoteId && inv.jobId) {
      const job = await db.job.findFirst({ where: { id: inv.jobId, companyId: inv.companyId }, select: { quoteId: true } });
      quoteId = job?.quoteId || null;
    }
    if (!quoteId) return null;
    return await syncFromSourceQuote(db, { sourceQuoteId: quoteId, sourceCompanyId: inv.companyId });
  } catch (err) {
    console.error("[subcontractors/sourceLink] invoice", invoiceId, err?.message);
    return null;
  }
}

// ── The GC's side: acceptance ───────────────────────────────────────────────

/**
 * The GC's quote became a job: put every sender whose quote was imported onto
 * it. For each import on the quote:
 *
 *   · the sub is the GC's Subcontractor linked to the source company, or a new
 *     one made from what the sub's own documents show — the business name,
 *     email, phone and address their quotes print (lib/subcontractors/
 *     profileFill.js; owner, 2026-10-03). An entry the GC already had gets
 *     its BLANKS filled the same way and nothing it holds overwritten.
 *     Nothing else of the other tenant is copied: no person's name (no
 *     FieldQuo document prints one — profileFill.js explains), no account
 *     data;
 *   · a JobSubcontractor, `agreed` at the approved figure, ADOPTING the
 *     import — quoteImportId set, so costing drops the import's expense and
 *     counts this row instead. Once, not twice.
 *
 * Idempotent per (job, import): a retried acceptance or a second caller finds
 * the row and moves on. The check-then-create runs under a transaction-scoped
 * advisory lock on (GC company, source company), which also stops two imports
 * from the same sub racing to create two roster entries.
 *
 * Must run AFTER materializeImportedCosts, so the expense it adopts exists.
 *
 * @returns {{ adopted: number, subsCreated: number }}
 */
export async function adoptImportsOnJob(db, { quoteId, jobId, companyId }) {
  const out = { adopted: 0, subsCreated: 0 };
  if (!quoteId || !jobId || !companyId) return out;
  let imports = [];
  try {
    imports = await db.quoteImport.findMany({
      where: { targetQuoteId: quoteId, targetCompanyId: companyId },
      select: {
        id: true,
        label: true,
        snapshotAmount: true,
        sourceQuoteId: true,
        sourceCompanyId: true,
        sourceCompany: { select: PROFILE_COMPANY_SELECT },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    console.error("[subcontractors/sourceLink] adopt: load imports", quoteId, err?.message);
    return out;
  }

  // lib/jobs/createJob.js can be handed a TRANSACTION client (a job made
  // inside an invoice's transaction), which has no $transaction of its own —
  // there the work already runs in one, and the advisory lock below holds
  // until that outer transaction ends.
  const inTransaction = (fn) => (typeof db.$transaction === "function" ? db.$transaction(fn) : fn(db));

  for (const imp of imports) {
    try {
      const source = await loadSourceSide(db, { sourceQuoteId: imp.sourceQuoteId, sourceCompanyId: imp.sourceCompanyId });
      const approved = approvedSubcontractTotal({ snapshotAmount: imp.snapshotAmount, changeOrders: source.changeOrders });

      const result = await inTransaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sub-adopt:${companyId}:${imp.sourceCompanyId}`}))`;

        const existing = await tx.jobSubcontractor.findFirst({
          where: { jobId, companyId, quoteImportId: imp.id },
          select: { id: true },
        });
        if (existing) return { adopted: false, created: false };

        const profile = documentProfileOf(imp.sourceCompany);
        let sub = await tx.subcontractor.findFirst({
          where: { companyId, linkedCompanyId: imp.sourceCompanyId },
          select: ROSTER_FILL_SELECT,
          orderBy: { createdAt: "asc" },
        });
        let created = false;
        if (!sub) {
          const label = String(imp.label || "").trim();
          sub = await tx.subcontractor.create({
            data: {
              companyId,
              name: String(profile.name || label || "Subcontractor").slice(0, 160),
              trade: label && label !== DEFAULT_IMPORT_LABEL ? label.slice(0, 80) : null,
              ...profileFillPatch(null, profile).data,
              linkedCompanyId: imp.sourceCompanyId,
            },
            select: { id: true },
          });
          created = true;
        } else {
          // Already on the GC's roster: its blanks only. A value the GC typed
          // is theirs and stays (profileFillPatch never returns a non-blank).
          const { data } = profileFillPatch(sub, profile);
          if (Object.keys(data).length) {
            await tx.subcontractor.update({ where: { id: sub.id }, data, select: { id: true } });
          }
        }

        await tx.jobSubcontractor.create({
          data: {
            companyId,
            jobId,
            subcontractorId: sub.id,
            description: imp.label || null,
            agreedAmount: approved,
            // The GC's own client said yes to the price this cost is part of:
            // it is a liability now, which is what `agreed` means to costing.
            status: "agreed",
            quoteImportId: imp.id,
          },
        });
        return { adopted: true, created };
      });
      if (result.adopted) out.adopted++;
      if (result.created) out.subsCreated++;
    } catch (err) {
      console.error("[subcontractors/sourceLink] adopt import", imp.id, err?.message);
    }
  }

  // Anything the sub already did before this job existed — a change order
  // the GC signed, an invoice they sent — lands now rather than waiting for
  // the next event.
  const seen = new Set();
  for (const imp of imports) {
    const key = `${imp.sourceCompanyId}:${imp.sourceQuoteId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await syncFromSourceQuote(db, { sourceQuoteId: imp.sourceQuoteId, sourceCompanyId: imp.sourceCompanyId });
  }
  return out;
}
