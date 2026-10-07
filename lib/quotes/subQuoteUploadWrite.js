// lib/quotes/subQuoteUploadWrite.js
//
// The writes behind an uploaded sub's quote (lib/quotes/subQuoteUpload.js):
// confirm it, put it on the quote as a line, change its markup, remove it,
// keep it honest when the quote editor drops its group, and book it to the
// job when the quote becomes one.
//
// Every one of them mirrors its QuoteImport twin in lib/quotes/importQuote.js
// — same scope-group builder, same totals maths, same "one price per trade"
// swap — because the GC sees both kinds side by side and they must behave as
// one compare. Every figure comes from the stored, CONFIRMED row
// (usableCost); the browser names an id, a markup percent and the figures
// the GC confirmed, and the client price is derived here.

import {
  ImportError,
  addImportGroup,
  recomputeQuoteTotals,
  scaleGroupLines,
  stepBackTradeLines,
} from "@/lib/quotes/importQuote";
import { comparisonKey, NO_LINE } from "@/lib/quotes/importOptions";
import { SUBCONTRACT_IMPORT_EXPENSE_CATEGORY } from "@/lib/subcontractors/money";
import {
  clientFacingLabel,
  readConfirmation,
  uploadAsSourceQuote,
  uploadClientPrice,
  usableCost,
} from "@/lib/quotes/subQuoteUpload";

const OPEN = ["draft", "sent"];

const QUOTE_SELECT = { id: true, status: true, discount: true, taxEnabled: true };

async function loadUpload(db, { member, quoteId, uploadId }) {
  const upload = await db.subQuoteUpload.findFirst({
    where: { id: uploadId, quoteId, companyId: member.companyId },
    include: { quote: { select: QUOTE_SELECT } },
  });
  if (!upload) throw new ImportError("That uploaded quote wasn't found.", 404);
  return upload;
}

async function retotal(tx, { quote, targetCompany }) {
  const groups = await tx.quoteScopeGroup.findMany({ where: { quoteId: quote.id }, select: { subtotal: true } });
  const totals = recomputeQuoteTotals({
    scopeGroups: groups,
    taxEnabled: quote.taxEnabled,
    taxRate: targetCompany?.taxRate,
    discount: quote.discount,
  });
  await tx.quote.update({
    where: { id: quote.id },
    data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
  });
  return totals.total;
}

/** Put a confirmed upload on its open quote as the trade's line. `tx` is a transaction. */
async function placeLine(tx, { member, upload, quote, targetCompany }) {
  const price = uploadClientPrice(upload);
  if (!(price > 0)) throw new ImportError("Confirm the sub's total before adding it to your quote.", 400);
  const swappedOut = await stepBackTradeLines(tx, {
    quoteId: quote.id,
    companyId: member.companyId,
    key: comparisonKey(upload.trade),
    keepUploadId: upload.id,
  });
  const existing = await tx.quoteScopeGroup.findMany({ where: { quoteId: quote.id }, select: { id: true } });
  const group = await addImportGroup(tx, {
    member,
    quoteId: quote.id,
    sortOrder: existing.length,
    label: clientFacingLabel(upload),
    display: upload.display === "itemized" ? "itemized" : "blended",
    sourceQuote: uploadAsSourceQuote(upload),
    // Scrubbed out of every line description — the homeowner never reads
    // who the sub is.
    sourceCompanyName: upload.subName || null,
    priceDollars: price,
  });
  await tx.subQuoteUpload.update({ where: { id: upload.id }, data: { placement: "line", targetLineId: group.id } });
  const targetTotal = await retotal(tx, { quote, targetCompany });
  return { swappedOut, targetTotal };
}

/**
 * The GC's Confirm. Validates the figures the GC confirmed (readConfirmation),
 * links or creates the roster row, stores them, and — if asked and the quote
 * is open — puts the price on the quote.
 *
 * A price already on the quote as a line cannot be re-confirmed with new
 * figures: the client may have it. Take it off (Remove) first.
 */
export async function confirmUpload({ db, member, quoteId, uploadId, body, targetCompany }) {
  const upload = await loadUpload(db, { member, quoteId, uploadId });
  if (upload.placement === "line")
    throw new ImportError("That price is on your quote — remove it from the quote to change its figures.", 409);
  const read = readConfirmation(body);
  if (!read.ok) {
    const err = new ImportError("Check the highlighted figure.", 400);
    err.field = read.field;
    err.code = read.code;
    throw err;
  }
  const c = read.data;
  const open = OPEN.includes(upload.quote?.status);
  if (c.placement === "line" && !open)
    throw new ImportError("That quote is already decided — keep this price to compare instead.", 400);

  return db.$transaction(async (tx) => {
    // ── The sub on the GC's own roster ──────────────────────────────────
    let subcontractorId = null;
    if (c.subcontractorId) {
      const sub = await tx.subcontractor.findFirst({
        where: { id: c.subcontractorId, companyId: member.companyId },
        select: { id: true },
      });
      if (!sub) throw new ImportError("That subcontractor isn't on your list.", 400);
      subcontractorId = sub.id;
    } else if (c.createSubcontractor) {
      const sub = await tx.subcontractor.create({
        data: { companyId: member.companyId, name: c.subName, trade: c.trade },
        select: { id: true },
      });
      subcontractorId = sub.id;
    }

    const saved = await tx.subQuoteUpload.update({
      where: { id: upload.id },
      data: {
        subName: c.subName,
        trade: c.trade,
        costAmount: c.costAmount,
        taxAmount: c.taxAmount,
        validUntil: c.validUntil,
        lines: c.lines,
        markupPercent: c.markupPercent,
        display: c.display,
        subcontractorId,
        status: "confirmed",
        confirmedAt: new Date(),
        confirmedById: member.userId ?? null,
        placement: "option",
        targetLineId: NO_LINE,
      },
    });
    if (c.placement !== "line") return { upload: saved, targetTotal: null, swappedOut: [] };
    const placed = await placeLine(tx, { member, upload: saved, quote: upload.quote, targetCompany });
    return { upload: { ...saved, placement: "line" }, ...placed };
  });
}

/** "Use this one" on a confirmed upload held as an option. Open quotes only. */
export async function placeUploadLine({ db, member, quoteId, uploadId, targetCompany }) {
  const upload = await loadUpload(db, { member, quoteId, uploadId });
  if (usableCost(upload) === null) throw new ImportError("Confirm the sub's figures first.", 400);
  if (upload.placement === "line") throw new ImportError("That price is already on your quote.", 409);
  if (!OPEN.includes(upload.quote?.status))
    throw new ImportError("That quote is already decided — its costs can't change.", 400);
  return db.$transaction((tx) => placeLine(tx, { member, upload, quote: upload.quote, targetCompany }));
}

/** The markup on a confirmed upload. A line moves the quote's total with it. */
export async function updateUploadMarkup({ db, member, quoteId, uploadId, markupPercent, targetCompany }) {
  const upload = await loadUpload(db, { member, quoteId, uploadId });
  if (usableCost(upload) === null) throw new ImportError("Confirm the sub's figures first.", 400);
  const n = Number(markupPercent);
  const pct = !Number.isFinite(n) || n < 0 ? 0 : Math.min(1000, n);
  const next = { ...upload, markupPercent: pct };
  const newPrice = uploadClientPrice(next);
  if (upload.placement !== "line") {
    await db.subQuoteUpload.update({ where: { id: upload.id }, data: { markupPercent: pct } });
    return { markupPercent: pct, clientPrice: newPrice, targetTotal: null };
  }
  if (!OPEN.includes(upload.quote?.status))
    throw new ImportError("That quote is already decided — its costs can't change.", 400);
  return db.$transaction(async (tx) => {
    const group = await tx.quoteScopeGroup.findFirst({
      where: { id: upload.targetLineId, quoteId },
      select: { subtotal: true, lineItems: true },
    });
    if (group) {
      await tx.quoteScopeGroup.update({
        where: { id: upload.targetLineId },
        data: { lineItems: scaleGroupLines(group.lineItems, Number(group.subtotal || 0), newPrice), subtotal: newPrice },
      });
    }
    await tx.subQuoteUpload.update({ where: { id: upload.id }, data: { markupPercent: pct } });
    const targetTotal = await retotal(tx, { quote: upload.quote, targetCompany });
    return { markupPercent: pct, clientPrice: newPrice, targetTotal };
  });
}

/**
 * Remove an upload. A held or unconfirmed one goes on any quote; a line only
 * while the quote is open, taking its scope group with it. An expense it was
 * booked to goes too — the same cascade an import's removal makes.
 */
export async function removeUpload({ db, member, quoteId, uploadId, targetCompany }) {
  const upload = await loadUpload(db, { member, quoteId, uploadId });
  if (upload.placement !== "line") {
    await db.subQuoteUpload.delete({ where: { id: upload.id } });
    return { targetTotal: null };
  }
  if (!OPEN.includes(upload.quote?.status))
    throw new ImportError("That quote is already decided — its costs can't change.", 400);
  return db.$transaction(async (tx) => {
    await tx.quoteScopeGroup.deleteMany({ where: { id: upload.targetLineId, quoteId } });
    if (upload.expenseId) await tx.expense.delete({ where: { id: upload.expenseId } }).catch(() => {});
    await tx.subQuoteUpload.delete({ where: { id: upload.id } });
    const targetTotal = await retotal(tx, { quote: upload.quote, targetCompany });
    return { targetTotal };
  });
}

/**
 * After the quote editor saves, an upload whose scope group is gone was
 * removed by hand: it goes back to being an option (its figures were the
 * GC's own work, so the row is kept, unlike an import's linkage), and any
 * expense it had booked goes. Lines only. `tx` may be a transaction.
 */
export async function reconcileSubUploadsForQuote(tx, quoteId) {
  const uploads = await tx.subQuoteUpload.findMany({
    where: { quoteId, placement: "line" },
    select: { id: true, targetLineId: true, expenseId: true },
  });
  if (!uploads.length) return 0;
  const groups = await tx.quoteScopeGroup.findMany({ where: { quoteId }, select: { id: true } });
  const ids = new Set(groups.map((g) => g.id));
  let moved = 0;
  for (const u of uploads) {
    if (ids.has(u.targetLineId)) continue;
    if (u.expenseId) await tx.expense.delete({ where: { id: u.expenseId } }).catch(() => {});
    await tx.subQuoteUpload.update({
      where: { id: u.id },
      data: { placement: "option", targetLineId: NO_LINE, expenseId: null },
    });
    moved++;
  }
  return moved;
}

/**
 * Book each uploaded sub's price that is a LINE on the quote to the job as a
 * subcontractor expense, once (expenseId makes it idempotent) — the same
 * category and the same rule an import's materialisation follows
 * (lib/subcontractors/money.js), so job costing counts it like one. Held
 * options are bids nobody chose and are never booked. Best-effort per row.
 */
export async function materializeUploadedSubCosts(db, { quoteId, jobId, companyId = null, createdById = null }) {
  if (!quoteId || !jobId) return 0;
  const uploads = await db.subQuoteUpload.findMany({
    where: { quoteId, placement: "line", expenseId: null, ...(companyId ? { companyId } : {}) },
    select: { id: true, companyId: true, costAmount: true, confirmedAt: true, trade: true, subName: true },
  });
  let made = 0;
  for (const u of uploads) {
    const cost = usableCost(u);
    if (cost === null) continue;
    try {
      const expense = await db.expense.create({
        data: {
          companyId: companyId || u.companyId,
          category: SUBCONTRACT_IMPORT_EXPENSE_CATEGORY,
          amount: cost,
          projectId: jobId,
          notes: `Subcontractor: ${[u.subName, u.trade].filter(Boolean).join(" — ") || "uploaded quote"}`,
          createdById,
        },
      });
      await db.subQuoteUpload.update({ where: { id: u.id }, data: { expenseId: expense.id } });
      made++;
    } catch (err) {
      console.error("[materializeUploadedSubCosts] upload", u.id, err?.message);
    }
  }
  return made;
}
