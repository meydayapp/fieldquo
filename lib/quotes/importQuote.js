// lib/quotes/importQuote.js
//
// Server-side writer for pulling another FieldQuo company's quote INTO the
// viewer's own quote as a marked-up cost line (the GC ↔ subcontractor flow).
// The browser never computes or sends any money figure: it posts the source
// token, a markup percent and a display choice, and everything monetary is
// derived here from the stored source quote. See lib/quotes/importedStatus.js
// for the pricing maths and the two role-scoped views.

import { randomUUID } from "node:crypto";
import { clientPrice } from "@/lib/quotes/importedStatus";

class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Markup is a percent the GC marks costs UP by. Clamped, not trusted: a stray
// huge value would put an absurd number on a client-facing quote, and a
// negative one is meaningless here (you don't mark a subcontractor cost down to
// quote your own client). 0 is allowed — passing a cost straight through is a
// legitimate choice.
function clampMarkup(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1000, n);
}

// The price the sub is charging the GC — the GC's cost. Prefer what the sub's
// client (the GC) actually accepted over the originally-quoted figure, so a
// renegotiated price is the one that gets imported.
export function sourceCostAmount(sourceQuote) {
  return Number(sourceQuote.acceptedTotal ?? sourceQuote.total ?? 0);
}

// Find-or-create the company's own "Subcontractors" quote category. A scope
// group needs a category (categoryId is required), but an imported trade rarely
// maps onto one of the GC's own service categories — so imports live under a
// dedicated custom category rather than being forced under, say, "Painting".
// Deterministic key keyed on the company id makes this idempotent without a
// find-then-create race.
export async function ensureSubcontractorCategory(tx, companyId) {
  const key = `custom_subs_${companyId}`;
  return tx.serviceCategory.upsert({
    where: { key },
    update: {},
    create: {
      key,
      label: "Subcontractors",
      companyId,
      isSystem: false,
      sortOrder: 999,
    },
  });
}

function flattenSourceLines(sourceQuote) {
  const groups = Array.isArray(sourceQuote.scopeGroups) ? sourceQuote.scopeGroups : [];
  let lines = [];
  for (const g of groups) {
    if (Array.isArray(g.lineItems)) lines.push(...g.lineItems);
  }
  if (!lines.length && Array.isArray(sourceQuote.lineItems)) lines = sourceQuote.lineItems;
  return lines
    .filter(Boolean)
    .map((li) => ({
      description: String(li.description ?? "Item"),
      quantity: Number(li.quantity) || 1,
      amount: Number(li.amount) || 0,
    }));
}

// Build the line items for the scope group we're about to add to the GC's quote.
//
//  • blended  → one line for the whole trade at the client price. The homeowner
//               sees "Electrical — $5,040" and nothing about who did it.
//  • itemized → the sub's line DESCRIPTIONS, each amount scaled up so the group
//               still totals the client price. Descriptions are work items and
//               fine to show; the raw sub prices are NOT shown — scaling is what
//               keeps the GC's margin invisible to the homeowner.
//
// Either way the group subtotal equals the client price to the penny (the last
// itemized line absorbs any rounding drift), so nothing downstream sees a total
// that doesn't add up.
function buildGroupLines({ display, sourceQuote, priceDollars, groupLineId }) {
  if (display !== "itemized") {
    return [
      {
        id: groupLineId,
        description: "Subcontracted work",
        quantity: 1,
        rate: priceDollars,
        amount: priceDollars,
      },
    ];
  }

  const src = flattenSourceLines(sourceQuote);
  const rawSum = src.reduce((s, l) => s + l.amount, 0);
  if (!src.length || rawSum <= 0) {
    // Nothing itemisable — fall back to a single blended line rather than
    // emit an empty group.
    return [
      { id: groupLineId, description: "Subcontracted work", quantity: 1, rate: priceDollars, amount: priceDollars },
    ];
  }

  const factor = priceDollars / rawSum;
  let acc = 0;
  const scaled = src.map((l, i) => {
    const amount = Math.round(l.amount * factor * 100) / 100;
    acc += amount;
    const qty = l.quantity > 1 ? l.quantity : 1;
    return {
      id: i === 0 ? groupLineId : randomUUID(),
      description: l.description,
      quantity: qty,
      rate: Math.round((amount / qty) * 100) / 100,
      amount,
    };
  });
  // Push per-line rounding drift onto the last line so the group sums exactly.
  const drift = Math.round((priceDollars - acc) * 100) / 100;
  if (drift !== 0) {
    const last = scaled[scaled.length - 1];
    last.amount = Math.round((last.amount + drift) * 100) / 100;
    last.rate = last.quantity > 1 ? Math.round((last.amount / last.quantity) * 100) / 100 : last.amount;
  }
  return scaled;
}

// Recompute a quote's money from its scope groups, the builder's way: subtotal
// is the sum of group subtotals, tax is subtotal × rate when tax is on, and any
// discount is preserved. One helper so the import writer and the remove path
// can never compute totals two different ways.
export function recomputeQuoteTotals({ scopeGroups, taxEnabled, taxRate, discount }) {
  const groups = Array.isArray(scopeGroups) ? scopeGroups : [];
  const subtotal = Math.round(groups.reduce((s, g) => s + Number(g.subtotal || 0), 0) * 100) / 100;
  const tax = taxEnabled ? Math.round(subtotal * ((Number(taxRate) || 0) / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal + tax - (Number(discount) || 0)) * 100) / 100;
  return { subtotal, tax, total };
}

/**
 * Import `sourceQuote` into `targetQuote` as a marked-up subcontractor cost.
 *
 * Both quotes must be fully loaded (with scopeGroups). `member` is the
 * authenticated viewer; `targetCompany` supplies the tax rate. Runs in one
 * transaction so a half-written group can never leave the quote's stored total
 * disagreeing with its line items.
 *
 * Returns { import, group, clientPrice, targetTotal }.
 */
export async function performImport({
  db,
  member,
  sourceQuote,
  targetQuote,
  targetCompany,
  markupPercent,
  display,
  label,
}) {
  if (!sourceQuote) throw new ImportError("That quote link isn't valid.", 404);
  if (!targetQuote) throw new ImportError("Pick one of your quotes to add it to.", 400);

  // You can't import your own quote, and you can only import into a quote you
  // own. Both are ownership boundaries, enforced here rather than assumed from
  // the UI.
  if (sourceQuote.companyId === member.companyId)
    throw new ImportError("This is your own quote — nothing to import.", 400);
  if (targetQuote.companyId !== member.companyId)
    throw new ImportError("You can only add costs to your own quotes.", 403);

  // A decided quote is a record of what was agreed; bolting a new cost line onto
  // an accepted/declined quote would rewrite history the same way editing a sent
  // PDF would. Only open quotes can receive imports.
  if (!["draft", "sent"].includes(targetQuote.status))
    throw new ImportError("That quote is already decided — add the cost to an open quote instead.", 400);

  const snapshot = sourceCostAmount(sourceQuote);
  if (!(snapshot > 0))
    throw new ImportError("That quote doesn't have an amount to import yet.", 400);

  const pct = clampMarkup(markupPercent);
  const priceDollars = clientPrice(snapshot, pct);
  const groupLineId = randomUUID();
  const tradeLabel = String(label || sourceQuote.company?.name || "Subcontractor").slice(0, 120);
  const displayMode = display === "itemized" ? "itemized" : "blended";

  const lineItems = buildGroupLines({ display: displayMode, sourceQuote, priceDollars, groupLineId });

  // Recompute from the existing groups plus the one we're adding — self-heals if
  // the stored subtotal had drifted, and shares the exact maths the remove path
  // uses.
  const existingGroups = Array.isArray(targetQuote.scopeGroups) ? targetQuote.scopeGroups : [];
  const totals = recomputeQuoteTotals({
    scopeGroups: [...existingGroups, { subtotal: priceDollars }],
    taxEnabled: targetQuote.taxEnabled,
    taxRate: targetCompany?.taxRate,
    discount: targetQuote.discount,
  });
  const sortOrder = existingGroups.length;

  try {
    return await db.$transaction(async (tx) => {
      const category = await ensureSubcontractorCategory(tx, member.companyId);

      const group = await tx.quoteScopeGroup.create({
        data: {
          quoteId: targetQuote.id,
          categoryId: category.id,
          label: tradeLabel,
          lineItems,
          subtotal: priceDollars,
          sortOrder,
        },
      });

      await tx.quote.update({
        where: { id: targetQuote.id },
        data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
      });

      const imp = await tx.quoteImport.create({
        data: {
          sourceQuoteId: sourceQuote.id,
          sourceCompanyId: sourceQuote.companyId,
          targetQuoteId: targetQuote.id,
          targetCompanyId: targetQuote.companyId,
          // The scope group this import created — how a later edit/removal finds
          // it again.
          targetLineId: group.id,
          snapshotAmount: snapshot,
          markupPercent: pct,
          display: displayMode,
          label: tradeLabel,
          createdById: member.userId ?? null,
        },
      });

      return { import: imp, group, clientPrice: priceDollars, targetTotal: totals.total };
    });
  } catch (err) {
    // Unique (targetQuoteId, sourceQuoteId) — this source is already on that
    // quote. Friendlier than a raw Prisma P2002.
    if (err?.code === "P2002")
      throw new ImportError("You've already added this quote to that project.", 409);
    throw err;
  }
}

/**
 * Materialise the subcontractor costs of a quote's imports into Expenses on a
 * job, so they flow into job costing and margin. Called (best-effort) when a
 * quote becomes a job. Idempotent: an import whose expenseId is already set is
 * skipped, so a retried acceptance or a re-created job can't double-count.
 * `db` may be the base client or a transaction.
 */
export async function materializeImportedCosts(db, { quoteId, jobId, createdById = null }) {
  if (!quoteId || !jobId) return 0;
  const imports = await db.quoteImport.findMany({
    where: { targetQuoteId: quoteId, expenseId: null },
    select: { id: true, targetCompanyId: true, snapshotAmount: true, label: true },
  });
  let made = 0;
  for (const imp of imports) {
    try {
      const expense = await db.expense.create({
        data: {
          companyId: imp.targetCompanyId,
          category: "Subcontractor",
          amount: imp.snapshotAmount,
          projectId: jobId, // Expense.projectId IS the job id — see expenses route
          notes: imp.label ? `Subcontractor: ${imp.label}` : "Subcontracted work",
          createdById,
        },
      });
      await db.quoteImport.update({
        where: { id: imp.id },
        data: { expenseId: expense.id },
      });
      made++;
    } catch (err) {
      // Best-effort: a costing hiccup must never fail job creation.
      console.error("[materializeImportedCosts] import", imp.id, err?.message);
    }
  }
  return made;
}

// Delete an import row and, if it had materialised into an Expense, that too.
// Shared by the remove path and the editor reconcile so cleanup is identical.
async function deleteImportCascade(tx, imp) {
  if (imp.expenseId) {
    await tx.expense.delete({ where: { id: imp.expenseId } }).catch(() => {});
  }
  await tx.quoteImport.delete({ where: { id: imp.id } });
}

// Id-preserving replacement for the old deleteMany+create on a quote's scope
// groups. Groups keep their ids across an editor save, which is what keeps a
// QuoteImport's targetLineId pointing at the right group — regenerating ids
// every save silently orphaned the import's Remove control. Updates are scoped
// to the quote so a foreign group id in the payload can't touch another quote.
export async function reconcileScopeGroups(tx, quoteId, incoming) {
  const groups = Array.isArray(incoming) ? incoming : [];
  const keepIds = groups.filter((g) => g.id).map((g) => g.id);
  await tx.quoteScopeGroup.deleteMany({
    where: { quoteId, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
  });
  for (const [i, g] of groups.entries()) {
    const data = {
      categoryId: g.categoryId,
      label: g.label || null,
      lineItems: g.lineItems || null,
      subtotal: g.subtotal || 0,
      sortOrder: i,
    };
    if (g.id) {
      const res = await tx.quoteScopeGroup.updateMany({
        where: { id: g.id, quoteId },
        data,
      });
      // A foreign or stale id updates nothing — treat it as a new group rather
      // than dropping the data.
      if (res.count === 0) await tx.quoteScopeGroup.create({ data: { quoteId, ...data } });
    } else {
      await tx.quoteScopeGroup.create({ data: { quoteId, ...data } });
    }
  }
}

// After a quote's groups change, drop any import whose scope group is gone — the
// GC removed it through the editor, so the linkage (and its expense) shouldn't
// linger and the sub should stop seeing "imported". `tx` may be a transaction.
export async function reconcileImportsForQuote(tx, quoteId) {
  const imports = await tx.quoteImport.findMany({
    where: { targetQuoteId: quoteId },
    select: { id: true, targetLineId: true, expenseId: true },
  });
  if (!imports.length) return 0;
  const existing = await tx.quoteScopeGroup.findMany({
    where: { quoteId },
    select: { id: true },
  });
  const groupIds = new Set(existing.map((g) => g.id));
  let removed = 0;
  for (const imp of imports) {
    if (!groupIds.has(imp.targetLineId)) {
      await deleteImportCascade(tx, imp);
      removed++;
    }
  }
  return removed;
}

// Rescale a group's existing line items from one total to another, preserving
// descriptions and structure. Used when the markup changes: the received cost
// is fixed, but the client price moves, so the lines move proportionally. The
// last line absorbs rounding so the group still totals to the penny.
function scaleGroupLines(lineItems, oldPrice, newPrice) {
  const lines = Array.isArray(lineItems) ? lineItems : [];
  if (!lines.length) return lines;
  const factor = oldPrice > 0 ? newPrice / oldPrice : 0;
  let acc = 0;
  const scaled = lines.map((li) => {
    const qty = Number(li.quantity) > 1 ? Number(li.quantity) : 1;
    const amount = Math.round(Number(li.amount || 0) * factor * 100) / 100;
    acc += amount;
    return { ...li, quantity: qty, amount, rate: Math.round((amount / qty) * 100) / 100 };
  });
  const drift = Math.round((newPrice - acc) * 100) / 100;
  if (drift !== 0) {
    const last = scaled[scaled.length - 1];
    last.amount = Math.round((last.amount + drift) * 100) / 100;
    last.rate = last.quantity > 1 ? Math.round((last.amount / last.quantity) * 100) / 100 : last.amount;
  }
  return scaled;
}

/**
 * Change the markup on an imported cost. The subcontractor's price (the GC's
 * cost) is fixed — it's the quote they received — but the markup is the GC's own
 * lever for profit and overhead, so it stays editable. Rescales the scope
 * group's lines to the new client price and recomputes the quote total. Does NOT
 * touch the materialised Expense: the cost didn't change, only the markup.
 */
export async function updateImportMarkup({ db, member, quoteId, importId, markupPercent, targetCompany }) {
  const imp = await db.quoteImport.findFirst({
    where: { id: importId, targetQuoteId: quoteId, targetCompanyId: member.companyId },
    select: {
      id: true,
      targetLineId: true,
      snapshotAmount: true,
      targetQuote: { select: { status: true, discount: true, taxEnabled: true } },
    },
  });
  if (!imp) throw new ImportError("That imported cost wasn't found.", 404);
  if (!["draft", "sent"].includes(imp.targetQuote.status))
    throw new ImportError("That quote is already decided — its costs can't change.", 400);

  const pct = clampMarkup(markupPercent);
  const newPrice = clientPrice(imp.snapshotAmount, pct);

  return db.$transaction(async (tx) => {
    const group = await tx.quoteScopeGroup.findFirst({
      where: { id: imp.targetLineId, quoteId },
      select: { subtotal: true, lineItems: true },
    });
    if (group) {
      const newLines = scaleGroupLines(group.lineItems, Number(group.subtotal || 0), newPrice);
      await tx.quoteScopeGroup.update({
        where: { id: imp.targetLineId },
        data: { lineItems: newLines, subtotal: newPrice },
      });
    }
    const allGroups = await tx.quoteScopeGroup.findMany({
      where: { quoteId },
      select: { subtotal: true },
    });
    const totals = recomputeQuoteTotals({
      scopeGroups: allGroups,
      taxEnabled: imp.targetQuote.taxEnabled,
      taxRate: targetCompany?.taxRate,
      discount: imp.targetQuote.discount,
    });
    await tx.quote.update({
      where: { id: quoteId },
      data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
    });
    await tx.quoteImport.update({ where: { id: imp.id }, data: { markupPercent: pct } });
    return { markupPercent: pct, clientPrice: newPrice, targetTotal: totals.total };
  });
}

/**
 * Remove an imported cost from the viewer's quote — the exact inverse of
 * performImport: delete the scope group it created, recompute totals from what's
 * left, and delete the linkage row so the sub stops seeing "selected". Used to
 * drop a losing bid and, by re-importing, swap in the one the GC actually wants.
 */
export async function removeImport({ db, member, quoteId, importId, targetCompany }) {
  const imp = await db.quoteImport.findFirst({
    where: { id: importId, targetQuoteId: quoteId, targetCompanyId: member.companyId },
    select: {
      id: true,
      targetLineId: true,
      expenseId: true,
      targetQuote: { select: { status: true, discount: true, taxEnabled: true } },
    },
  });
  if (!imp) throw new ImportError("That imported cost wasn't found.", 404);
  if (!["draft", "sent"].includes(imp.targetQuote.status))
    throw new ImportError("That quote is already decided — its costs can't change.", 400);

  return db.$transaction(async (tx) => {
    // targetLineId holds the scope group's id. deleteMany (not delete) so a
    // group already gone by hand doesn't throw — the goal is "not there".
    await tx.quoteScopeGroup.deleteMany({ where: { id: imp.targetLineId, quoteId } });

    const remaining = await tx.quoteScopeGroup.findMany({
      where: { quoteId },
      select: { subtotal: true },
    });
    const totals = recomputeQuoteTotals({
      scopeGroups: remaining,
      taxEnabled: imp.targetQuote.taxEnabled,
      taxRate: targetCompany?.taxRate,
      discount: imp.targetQuote.discount,
    });
    await tx.quote.update({
      where: { id: quoteId },
      data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
    });
    // Drops the row and its materialised expense (if any) together.
    await deleteImportCascade(tx, imp);
    return { targetTotal: totals.total };
  });
}

export { ImportError };
