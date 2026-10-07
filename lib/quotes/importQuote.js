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
import { SUBCONTRACT_IMPORT_EXPENSE_CATEGORY } from "@/lib/subcontractors/money";
import {
  NO_LINE,
  comparisonKey,
  importPlacement,
  isLiveChangeOrder,
  changeOrderDraftFromImport,
  scrubCompanyName,
} from "@/lib/quotes/importOptions";
import { changeOrderLabel } from "@/lib/jobs/changeOrderAddendum";

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

// The sub's own line descriptions can carry their company name ("Sparky
// Electric — panel upgrade"), and an itemised import copies descriptions onto
// the GC's client-facing quote. Scrubbed on the way in, so the homeowner never
// reads who the sub is (lib/quotes/importOptions.js scrubCompanyName).
function flattenSourceLines(sourceQuote, sourceCompanyName = null) {
  const groups = Array.isArray(sourceQuote.scopeGroups) ? sourceQuote.scopeGroups : [];
  let lines = [];
  for (const g of groups) {
    if (Array.isArray(g.lineItems)) lines.push(...g.lineItems);
  }
  if (!lines.length && Array.isArray(sourceQuote.lineItems)) lines = sourceQuote.lineItems;
  return lines
    .filter(Boolean)
    .map((li) => ({
      description: scrubCompanyName(String(li.description ?? "Item"), sourceCompanyName) || "Item",
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
function buildGroupLines({ display, sourceQuote, priceDollars, groupLineId, sourceCompanyName = null }) {
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

  const src = flattenSourceLines(sourceQuote, sourceCompanyName);
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
 * Add the scope group an import puts on an OPEN quote. Shared by the import
 * itself and by "Use this one" on a held option, so a price chosen later
 * lands on the quote exactly as one added straight away would.
 */
async function addImportGroup(tx, { member, quoteId, sortOrder, label, display, sourceQuote, sourceCompanyName, priceDollars }) {
  const category = await ensureSubcontractorCategory(tx, member.companyId);
  const lineItems = buildGroupLines({
    display,
    sourceQuote: sourceQuote || { scopeGroups: [] },
    priceDollars,
    groupLineId: randomUUID(),
    sourceCompanyName,
  });
  return tx.quoteScopeGroup.create({
    data: { quoteId, categoryId: category.id, label, lineItems, subtotal: priceDollars, sortOrder },
  });
}

/**
 * The change order a sub's price becomes on a quote the client has ALREADY
 * signed. The signed quote is not touched — not a line, not a total, not its
 * signature hash. What changes is a new ChangeOrder row: `pending`, at
 * snapshot × (1 + markup) worked out from the stored import
 * (lib/quotes/importOptions.js changeOrderDraftFromImport), carrying the
 * import's id so approval can book the sub's cost to the job and a decline
 * leaves the import as an unused option. Sent to the client from the change
 * orders list like any other.
 *
 * Refuses when a live change order on the job already carries a price for
 * the same trade: two electricians on two change orders would put the same
 * work in front of the client twice. Withdraw the first, or hold the second
 * as an option and compare.
 *
 * `tx` must be a transaction; the job row is locked so CO numbering cannot
 * collide with a change order logged by hand at the same moment — the same
 * lock POST /api/jobs/[id]/change-orders takes.
 */
export async function raiseChangeOrderFromImport(tx, { member, imp, jobId, sourceQuote = null, sourceCompanyName = null }) {
  if (!imp || !jobId) throw new ImportError("That quote has no job to add extra work to.", 400);
  await tx.$queryRaw`SELECT id FROM "Job" WHERE id = ${jobId} FOR UPDATE`;
  const existing = await tx.changeOrder.findMany({
    where: { jobId },
    select: { id: true, seq: true, createdAt: true, status: true, quoteImportId: true },
  });

  const mine = existing.find((co) => co.quoteImportId === imp.id && isLiveChangeOrder(co));
  if (mine) {
    throw new ImportError(`That price is already on change order ${changeOrderLabel(mine, existing)}.`, 409);
  }
  const liveIds = existing.filter((co) => co.quoteImportId && isLiveChangeOrder(co)).map((co) => co.quoteImportId);
  if (liveIds.length) {
    const others = await tx.quoteImport.findMany({ where: { id: { in: liveIds } }, select: { id: true, label: true } });
    const key = comparisonKey(imp.label);
    const clash = others.find((o) => o.id !== imp.id && comparisonKey(o.label) === key);
    if (clash) {
      const co = existing.find((c) => c.quoteImportId === clash.id && isLiveChangeOrder(c));
      throw new ImportError(
        `Change order ${changeOrderLabel(co, existing)} already carries a price for ${imp.label || "this work"}. Withdraw it first, or keep this one as an option to compare.`,
        409,
      );
    }
  }

  const draft = changeOrderDraftFromImport({ imp, sourceQuote, sourceCompanyName });
  if (!draft) throw new ImportError("That quote doesn't have an amount to add.", 400);

  return tx.changeOrder.create({
    data: {
      jobId,
      seq: existing.length + 1,
      description: draft.description,
      bodyHtml: draft.bodyHtml,
      priceDelta: draft.priceDelta,
      photos: [],
      // Not agreed by anyone yet. The client's signature on /co/<token> is
      // the approval; nothing reaches the contract value, the plan, job
      // costing or an invoice before it.
      status: "pending",
      quoteImportId: imp.id,
      createdById: member?.userId ?? null,
    },
  });
}

/**
 * Import `sourceQuote` into `targetQuote` as a marked-up subcontractor cost.
 *
 * Both quotes must be fully loaded (with scopeGroups; an accepted target also
 * with `jobs: [{ id }]`, oldest first). `member` is the authenticated viewer;
 * `targetCompany` supplies the tax rate. Runs in one transaction so a
 * half-written group can never leave the quote's stored total disagreeing
 * with its line items.
 *
 * Where it lands depends on the quote:
 *
 *   open (draft / sent)  a line on the quote, as it always did — or, with
 *                        `asOption`, held beside other bids for the same
 *                        trade and on no client document until the GC picks
 *                        it (placeImportOption).
 *   accepted, with a job the signed quote is NOT edited. The import is held,
 *                        and a PENDING change order to the client carries it
 *                        (raiseChangeOrderFromImport) — or, with `asOption`,
 *                        it is only held, to compare first.
 *   anything else        refused: a declined quote has no client to ask.
 *
 * Returns { import, group, changeOrder, placement, clientPrice, targetTotal }.
 * targetTotal is null whenever the quote's total did not move.
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
  asOption = false,
  // The GC's own roster row the price came from, when the caller knows it —
  // a price request does (lib/subRequests/server.js landRequestedQuote).
  // Stored so the compare and adoption find the right sub without matching
  // on the sub's company. Never from a request body.
  subcontractorId = null,
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

  // A decided quote is a record of what was agreed; bolting a new cost line
  // onto it would rewrite history the same way editing a sent PDF would. An
  // ACCEPTED one still has a client to ask, though — the extra work goes to
  // them as a change order, beside the signed quote rather than inside it.
  const open = ["draft", "sent"].includes(targetQuote.status);
  const accepted = targetQuote.status === "accepted";
  if (!open && !accepted)
    throw new ImportError("That quote is already decided — add the cost to an open quote instead.", 400);
  const jobId = accepted ? targetQuote.jobs?.[0]?.id || null : null;
  if (accepted && !jobId)
    throw new ImportError("That quote was approved but has no job yet — create its job first, then add the extra work.", 400);

  const snapshot = sourceCostAmount(sourceQuote);
  if (!(snapshot > 0))
    throw new ImportError("That quote doesn't have an amount to import yet.", 400);

  const pct = clampMarkup(markupPercent);
  const priceDollars = clientPrice(snapshot, pct);
  const sourceCompanyName = sourceQuote.company?.name ?? null;
  // NEVER the subcontractor's company name — that becomes the scope-group label
  // and renders on the homeowner-facing quote/PDF, which would break white-label
  // (the client must not see who the sub is). A label the GC typed that
  // happens to name the sub is scrubbed too; nothing left falls back to a
  // neutral trade label.
  const tradeLabel = scrubCompanyName(String(label || "").slice(0, 120), sourceCompanyName) || "Subcontracted work";
  const displayMode = display === "itemized" ? "itemized" : "blended";
  const importRow = (extra) => ({
    sourceQuoteId: sourceQuote.id,
    sourceCompanyId: sourceQuote.companyId,
    targetQuoteId: targetQuote.id,
    targetCompanyId: targetQuote.companyId,
    snapshotAmount: snapshot,
    markupPercent: pct,
    display: displayMode,
    label: tradeLabel,
    createdById: member.userId ?? null,
    ...(subcontractorId ? { subcontractorId } : {}),
    ...extra,
  });

  try {
    // ── Held: an option, or the change order a signed quote needs ─────────
    if (accepted || asOption === true) {
      return await db.$transaction(async (tx) => {
        const imp = await tx.quoteImport.create({
          data: importRow({ targetLineId: NO_LINE, placement: "option" }),
        });
        let changeOrder = null;
        if (accepted && asOption !== true) {
          changeOrder = await raiseChangeOrderFromImport(tx, { member, imp, jobId, sourceQuote, sourceCompanyName });
        }
        return {
          import: imp,
          group: null,
          changeOrder,
          placement: changeOrder ? "change_order" : "option",
          clientPrice: priceDollars,
          targetTotal: null,
        };
      });
    }

    // ── On the open quote, as a line ──────────────────────────────────────
    // Recompute from the existing groups plus the one we're adding — self-heals
    // if the stored subtotal had drifted, and shares the exact maths the remove
    // path uses.
    const existingGroups = Array.isArray(targetQuote.scopeGroups) ? targetQuote.scopeGroups : [];
    const totals = recomputeQuoteTotals({
      scopeGroups: [...existingGroups, { subtotal: priceDollars }],
      taxEnabled: targetQuote.taxEnabled,
      taxRate: targetCompany?.taxRate,
      discount: targetQuote.discount,
    });
    const sortOrder = existingGroups.length;

    return await db.$transaction(async (tx) => {
      const group = await addImportGroup(tx, {
        member,
        quoteId: targetQuote.id,
        sortOrder,
        label: tradeLabel,
        display: displayMode,
        sourceQuote,
        sourceCompanyName,
        priceDollars,
      });

      await tx.quote.update({
        where: { id: targetQuote.id },
        data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
      });

      // The scope group this import created — how a later edit/removal finds
      // it again.
      const imp = await tx.quoteImport.create({
        data: importRow({ targetLineId: group.id, placement: "line" }),
      });

      return { import: imp, group, changeOrder: null, placement: "line", clientPrice: priceDollars, targetTotal: totals.total };
    });
  } catch (err) {
    // Unique (targetQuoteId, sourceQuoteId) — this source is already on that
    // quote. Friendlier than a raw Prisma P2002.
    if (err?.code === "P2002")
      throw new ImportError("You've already added this quote to that project.", 409);
    throw err;
  }
}

// What placeImportOption, updateImportMarkup and removeImport need to know
// about an import before they touch it.
const IMPORT_FOR_EDIT_SELECT = {
  id: true,
  label: true,
  display: true,
  placement: true,
  targetLineId: true,
  snapshotAmount: true,
  markupPercent: true,
  expenseId: true,
  sourceCompanyId: true,
  sourceCompany: { select: { name: true } },
  targetQuote: {
    select: {
      id: true,
      status: true,
      discount: true,
      taxEnabled: true,
      jobs: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  },
};

async function loadImportForEdit(db, { member, quoteId, importId }) {
  const imp = await db.quoteImport.findFirst({
    where: { id: importId, targetQuoteId: quoteId, targetCompanyId: member.companyId },
    select: IMPORT_FOR_EDIT_SELECT,
  });
  if (!imp) throw new ImportError("That imported cost wasn't found.", 404);
  // The change orders that could be carrying it. Only asked for a held
  // import — a line is a line whatever the job's change orders say.
  const changeOrders =
    imp.placement && imp.placement !== "line"
      ? await db.changeOrder.findMany({
          where: { quoteImportId: imp.id },
          select: { id: true, seq: true, createdAt: true, status: true, quoteImportId: true },
        })
      : [];
  return { imp, where: importPlacement(imp, changeOrders), changeOrders };
}

/**
 * "Use this one": put a held option in front of the client.
 *
 *   open quote     → it becomes the trade's line on the quote. If another
 *                    import for the same trade is the line today, that one
 *                    goes back to being an option in the same transaction —
 *                    one price per trade reaches the client, never two.
 *   accepted quote → a pending change order carries it
 *                    (raiseChangeOrderFromImport); the signed quote is not
 *                    touched.
 *
 * Every figure comes from the stored import rows. The browser names an
 * import id and nothing else.
 *
 * Returns { placement, changeOrder, swappedOut, targetTotal }.
 */
export async function placeImportOption({ db, member, quoteId, importId, targetCompany }) {
  const { imp, where } = await loadImportForEdit(db, { member, quoteId, importId });
  if (where.kind === "line") throw new ImportError("That price is already on your quote.", 409);
  if (where.kind === "change_order")
    throw new ImportError("That price is already on a change order to your client.", 409);

  const quote = imp.targetQuote;
  const open = ["draft", "sent"].includes(quote?.status);
  const accepted = quote?.status === "accepted";
  if (!open && !accepted) throw new ImportError("That quote is already decided — its costs can't change.", 400);

  // The sub's lines, for an itemised import's descriptions. Read through the
  // import row, which names its own source — never trusted from a request.
  const source = await db.quoteImport.findFirst({
    where: { id: imp.id, targetCompanyId: member.companyId },
    select: {
      sourceQuote: { select: { id: true, companyId: true, lineItems: true, scopeGroups: { select: { lineItems: true } } } },
    },
  });
  const sourceQuote = source?.sourceQuote || null;
  const sourceCompanyName = imp.sourceCompany?.name ?? null;

  if (accepted) {
    const jobId = quote.jobs?.[0]?.id || null;
    if (!jobId)
      throw new ImportError("That quote was approved but has no job yet — create its job first, then add the extra work.", 400);
    const changeOrder = await db.$transaction((tx) =>
      raiseChangeOrderFromImport(tx, { member, imp, jobId, sourceQuote, sourceCompanyName }),
    );
    return { placement: "change_order", changeOrder, swappedOut: [], targetTotal: null };
  }

  const priceDollars = clientPrice(imp.snapshotAmount, imp.markupPercent);
  if (!(priceDollars > 0)) throw new ImportError("That quote doesn't have an amount to import yet.", 400);
  const key = comparisonKey(imp.label);

  return db.$transaction(async (tx) => {
    // The trade's current line, if any, steps back to being an option.
    const lines = await tx.quoteImport.findMany({
      where: { targetQuoteId: quoteId, targetCompanyId: member.companyId, placement: "line" },
      select: { id: true, label: true, targetLineId: true, expenseId: true },
    });
    const swappedOut = [];
    for (const other of lines) {
      if (other.id === imp.id || comparisonKey(other.label) !== key) continue;
      // An open quote has no job, so nothing has been booked against the
      // line. If something somehow was, moving it would strand that cost —
      // refuse rather than guess.
      if (other.expenseId)
        throw new ImportError("The price on the quote for this trade is already booked to a job — remove it there first.", 409);
      await tx.quoteScopeGroup.deleteMany({ where: { id: other.targetLineId, quoteId } });
      await tx.quoteImport.update({ where: { id: other.id }, data: { placement: "option", targetLineId: NO_LINE } });
      swappedOut.push(other.id);
    }

    const existing = await tx.quoteScopeGroup.findMany({ where: { quoteId }, select: { subtotal: true } });
    const group = await addImportGroup(tx, {
      member,
      quoteId,
      sortOrder: existing.length,
      label: imp.label || "Subcontracted work",
      display: imp.display === "itemized" ? "itemized" : "blended",
      sourceQuote,
      sourceCompanyName,
      priceDollars,
    });
    await tx.quoteImport.update({ where: { id: imp.id }, data: { placement: "line", targetLineId: group.id } });

    const totals = recomputeQuoteTotals({
      scopeGroups: [...existing, { subtotal: priceDollars }],
      taxEnabled: quote.taxEnabled,
      taxRate: targetCompany?.taxRate,
      discount: quote.discount,
    });
    await tx.quote.update({
      where: { id: quoteId },
      data: { subtotal: totals.subtotal, tax: totals.tax, total: totals.total },
    });
    return { placement: "line", changeOrder: null, swappedOut, targetTotal: totals.total };
  });
}

/**
 * Materialise the subcontractor costs of a quote's imports into Expenses on a
 * job, so they flow into job costing and margin. Called (best-effort) when a
 * quote becomes a job. Idempotent: an import whose expenseId is already set is
 * skipped, so a retried acceptance or a re-created job can't double-count.
 * `db` may be the base client or a transaction.
 */
export async function materializeImportedCosts(db, { quoteId, jobId, companyId = null, createdById = null }) {
  if (!quoteId || !jobId) return 0;
  const imports = await db.quoteImport.findMany({
    // Scope to the owning company when known, so a job created against another
    // company's quote can never materialise expenses into that company's ledger.
    //
    // Lines only. A held option is a bid nobody chose, and one carried by a
    // change order is booked when THAT is approved
    // (lib/subcontractors/sourceLink.js syncChangeOrderImport) — counting
    // either here would put every price the GC collected onto the job's cost.
    where: {
      targetQuoteId: quoteId,
      expenseId: null,
      placement: "line",
      ...(companyId ? { targetCompanyId: companyId } : {}),
    },
    select: { id: true, targetCompanyId: true, snapshotAmount: true, label: true },
  });
  let made = 0;
  for (const imp of imports) {
    try {
      const expense = await db.expense.create({
        data: {
          companyId: companyId || imp.targetCompanyId,
          // Named in lib/subcontractors/money.js rather than typed here, because
          // job costing now decides whether to count THIS row or the
          // JobSubcontractor that adopted it by that exact string.
          category: SUBCONTRACT_IMPORT_EXPENSE_CATEGORY,
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
      // Only written when the caller sends it. A save path that doesn't know
      // about takeoffs (the importer, a status change) must not blank the
      // structured form behind a stair or countertop group.
      ...(g.takeoff !== undefined && { takeoff: g.takeoff }),
      // Same guard, same reason: the importer and a status change know nothing
      // about intake answers and must not blank the ones a quote was costed on.
      ...(g.intakeValues !== undefined && { intakeValues: g.intakeValues }),
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
//
// Lines only: a held option has no group to lose (its targetLineId is ""), and
// treating "no group" as "group deleted" would wipe every option on every save.
export async function reconcileImportsForQuote(tx, quoteId) {
  const imports = await tx.quoteImport.findMany({
    where: { targetQuoteId: quoteId, placement: "line" },
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
//
// By where the price stands (lib/quotes/importOptions.js importPlacement):
//   option        → the markup is all that moves; it is on no document yet,
//                   whatever the quote's status.
//   line          → only while the quote is open, as before.
//   change_order  → refused. The client has that figure in front of them (or
//                   signed it); a change order's price is immutable, and the
//                   way to a different one is to withdraw it.
export async function updateImportMarkup({ db, member, quoteId, importId, markupPercent, targetCompany }) {
  const { imp, where } = await loadImportForEdit(db, { member, quoteId, importId });
  if (where.kind === "change_order")
    throw new ImportError("That price is on a change order to your client — withdraw it to change the markup.", 409);

  const pct = clampMarkup(markupPercent);
  const newPrice = clientPrice(imp.snapshotAmount, pct);

  if (where.kind === "option") {
    await db.quoteImport.update({ where: { id: imp.id }, data: { markupPercent: pct } });
    return { markupPercent: pct, clientPrice: newPrice, targetTotal: null };
  }

  if (!["draft", "sent"].includes(imp.targetQuote.status))
    throw new ImportError("That quote is already decided — its costs can't change.", 400);

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
//
// A held option goes on any quote — it was never on a document, so dropping a
// losing bid changes nothing a client has read. One a live change order
// carries is refused: withdraw the change order first.
export async function removeImport({ db, member, quoteId, importId, targetCompany }) {
  const { imp, where } = await loadImportForEdit(db, { member, quoteId, importId });
  if (where.kind === "change_order")
    throw new ImportError("That price is on a change order to your client — withdraw the change order first.", 409);
  if (where.kind === "option") {
    await db.$transaction((tx) => deleteImportCascade(tx, imp));
    return { targetTotal: null };
  }
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
