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

  // Recompute totals the way the builder does (app/app/quotes/new): subtotal is
  // the sum of group subtotals, tax is subtotal × the company rate when tax is
  // on, and any existing discount is preserved. Recomputed from the groups, not
  // nudged from the stored subtotal, so it self-heals if that column had drifted.
  const existingGroups = Array.isArray(targetQuote.scopeGroups) ? targetQuote.scopeGroups : [];
  const existingSubtotal = existingGroups.reduce((s, g) => s + Number(g.subtotal || 0), 0);
  const newSubtotal = Math.round((existingSubtotal + priceDollars) * 100) / 100;
  const taxRate = Number(targetCompany?.taxRate || 0);
  const tax = targetQuote.taxEnabled ? Math.round(newSubtotal * (taxRate / 100) * 100) / 100 : 0;
  const discount = Number(targetQuote.discount || 0);
  const total = Math.round((newSubtotal + tax - discount) * 100) / 100;
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
        data: { subtotal: newSubtotal, tax, total },
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

      return { import: imp, group, clientPrice: priceDollars, targetTotal: total };
    });
  } catch (err) {
    // Unique (targetQuoteId, sourceQuoteId) — this source is already on that
    // quote. Friendlier than a raw Prisma P2002.
    if (err?.code === "P2002")
      throw new ImportError("You've already added this quote to that project.", 409);
    throw err;
  }
}

export { ImportError };
