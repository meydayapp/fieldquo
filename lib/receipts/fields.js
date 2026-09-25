// lib/receipts/fields.js
//
// A read receipt → the Receipt columns, and a Receipt row → what the screen
// and the scoring need. Pure; the routes do the writing.
//
// The columns are a COPY of what the extraction says, for filtering and
// sorting a list without opening JSON. The extraction itself is kept verbatim
// in Receipt.extract, and every printed figure here is the validator's
// reading of it — nothing is recomputed into a column that the paper did not
// print (a subtotal the receipt never showed stays null).
import { toCents, centsToAmount } from "./money";
import { validateReceipt } from "./validate";
import { purchaseInstant } from "./time";

/** The paper's payment line, with the last four when printed: "VISA ····1234". */
export function paymentLabel(method, last4) {
  const m = String(method || "").trim();
  const l = String(last4 || "").trim();
  if (m && l) return `${m} ····${l}`;
  if (l) return `····${l}`;
  return m || null;
}

/**
 * @param data      normalised extraction (lib/receipts/extract.js)
 * @param timezone  the company's zone, for the printed time
 */
export function receiptFieldsFromExtraction(data, timezone) {
  const v = validateReceipt(data);
  return {
    extract: data,
    vendorName: data?.merchantName || null,
    vendorAddress: data?.merchantAddress || null,
    vendorPhone: data?.merchantContact || null,
    purchasedDate: data?.transactionDateIso || null,
    purchasedAt: purchaseInstant(data?.transactionDateIso, data?.transactionTime, timezone),
    receiptNumber: data?.receiptNumber || null,
    paymentMethod: data?.paymentMethod || null,
    cardLast4: data?.cardLast4 || null,
    currency: data?.currencyCode || null,
    subtotal: centsToAmount(v.subtotalCents),
    tax: centsToAmount(v.taxCents),
    total: centsToAmount(v.totalCents),
    taxLines: Array.isArray(data?.taxLines) && data.taxLines.length ? data.taxLines : null,
  };
}

/** The shape lib/receipts/duplicates.js compares. */
export function duplicateShape(row) {
  return {
    id: row.id,
    vendorName: row.vendorName,
    receiptNumber: row.receiptNumber,
    totalCents: row.total === null || row.total === undefined ? null : toCents(String(row.total)),
    purchasedDate: row.purchasedDate,
    purchasedAt: row.purchasedAt,
  };
}

/** The receipt half of lib/receipts/suggest.js's input. */
export function suggestionReceipt(row) {
  const data = row?.extract || {};
  const v = validateReceipt(data);
  return {
    purchasedAt: row.purchasedAt,
    purchasedDate: row.purchasedDate,
    vendorName: row.vendorName,
    vendorAddress: row.vendorAddress,
    vendorCity: data.merchantCity || null,
    vendorPostalCode: data.merchantPostalCode || null,
    items: (data.items || []).map((it, i) => ({
      description: it.description,
      kind: it.kind,
      lineTotalCents: v.reconciliation.lines[i]?.lineTotalCents ?? null,
    })),
    uploaderUserId: row.createdById,
    contextJobId: row.contextJobId,
  };
}
