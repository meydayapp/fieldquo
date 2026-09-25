// lib/invoices/builderRequest.js
//
// The bodies the invoice builder posts — POST /api/invoices on a create, PATCH
// /api/invoices/[id] on an edit, and the offline queue's payload — as pure
// functions of the screen's state. lib/quotes/builderRequest.js's twin.
//
// ── Why it exists ───────────────────────────────────────────────────────────
//
// The invoice screens moved from two standalone forms (app/app/invoices/new,
// app/app/invoices/[id]/edit — kept, reachable behind ?layout=classic) onto
// the document-shaped builder. The promise that makes that safe is that
// nothing about what reaches the API changed, and scripts/check-invoice-
// builder.mjs checks the promise with bytes: a fixture state through these
// functions and through a transcript of the two inline literals they
// replaced, and the md5s must match. Key ORDER is part of the shape.
//
// ── What is new, and how it stays out of the hash ───────────────────────────
//
// A create may now carry a `discount` — the old form had no box for one,
// the route has always stored the field. It is added only when non-zero, so
// an invoice raised the way the old form raised it produces the old body to
// the byte. Nothing else is new: the labour block is still ids and a rate
// key, the cost block is still inputs only, the money figures are still the
// screen's (which the route recomputes when it changes the lines).
//
// Non-negotiable #5 holds as it did on the old forms: the browser sends the
// totals it showed, the server derives them itself wherever it changes the
// lines (offline replay, the labour line), and the cost block carries crew,
// materials and an overhead percentage — never a margin.

/**
 * POST /api/invoices — the new form's literal, in its order.
 *
 * @param p.lineItems  the rows as typed (the old form posted them verbatim,
 *                     blank rows included — the route stores what it is sent)
 * @param p.labour     { timeEntryIds, rateKey } or null
 * @param p.taxRate    the percentage the screen showed, sent only WITH the
 *                     labour block (the route re-derives the tax from it)
 * @param p.costing    the cost block, or null to say nothing about costing
 * @param p.discount   optional; omitted from the body when not above zero
 */
export function invoiceCreateBody({
  clientId,
  jobId,
  labour,
  taxRate,
  lineItems,
  subtotal,
  tax,
  taxEnabled,
  total,
  notes,
  clientPhotos,
  dueDate,
  status,
  costing,
  discount,
}) {
  const disc = Number(discount);
  return {
    clientId,
    ...(jobId ? { jobId } : {}),
    ...(labour ? { labour, taxRatePct: taxEnabled ? taxRate : 0 } : {}),
    lineItems,
    subtotal,
    ...(Number.isFinite(disc) && disc > 0 ? { discount: disc } : {}),
    tax,
    taxEnabled,
    total,
    notes,
    clientPhotos,
    dueDate: dueDate || null,
    status,
    ...(costing ? { costing } : {}),
  };
}

/**
 * PATCH /api/invoices/[id] — the edit form's literal, in its order.
 *
 * Lines are filtered to the described ones and coerced, exactly as the form
 * did: a blank row is not a line, and a half-typed rate must not reach the
 * column as NaN. Everything else on the row (a text block's kind and body,
 * a unit, a unitCost, the legacy `name`/`unitPrice` keys an older invoice
 * still carries) rides through untouched.
 *
 * @param p.isDraft       a draft is edited in place; anything else mints a new
 *                        version and carries the reason
 */
export function invoicePatchBody({
  lineItems,
  subtotal,
  discount,
  tax,
  taxEnabled,
  total,
  dueDate,
  notes,
  clientPhotos,
  costing,
  isDraft,
  changeReason,
}) {
  const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
  return {
    lineItems: (Array.isArray(lineItems) ? lineItems : [])
      .filter((li) => String(li?.description || "").trim())
      .map((li) => ({
        ...li,
        quantity: num(li.quantity) || 1,
        rate: num(li.rate),
        amount: num(li.amount),
      })),
    subtotal,
    discount: num(discount),
    tax,
    taxEnabled,
    total,
    dueDate: dueDate || undefined,
    notes,
    clientPhotos,
    ...(costing ? { costing } : {}),
    ...(isDraft ? {} : { changeReason: String(changeReason || "").trim() }),
  };
}

/**
 * The offline queue's payload (app/components/offline/OfflineShell.js
 * enqueue("invoice", …)) — no money at all; lib/offline/queue.js
 * invoiceBodyFrom turns it into the POST at replay and the route derives the
 * totals. Transcribed from the new form's queueOffline, in its order.
 */
export function invoiceOfflinePayload({
  clientId,
  clientName,
  jobId,
  lineItems,
  labour,
  taxEnabled,
  notes,
  dueDate,
  language,
  send,
  clientPhotos,
  photoKeys,
}) {
  return {
    clientId,
    clientName,
    jobId: jobId || null,
    lineItems: (Array.isArray(lineItems) ? lineItems : []).filter((li) => String(li?.description || "").trim()),
    labour,
    taxEnabled,
    notes,
    dueDate: dueDate || null,
    language,
    send,
    clientPhotos,
    photoKeys,
  };
}
