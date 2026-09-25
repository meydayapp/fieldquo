// lib/receipts/duplicates.js
//
// Has this receipt already been captured?
//
// ══ Warn, never remove ═════════════════════════════════════════════════════
//
// The same receipt gets photographed twice all the time — once at the till,
// once by the office from the pile on the dashboard. Booking it twice
// overstates the job's cost and nothing downstream would ever notice: the
// second row looks exactly like a second purchase. So a likely duplicate is
// SHOWN, with the reason, and the person decides. Nothing here deletes,
// merges or voids anything — voiding is a person's tap, and even then the row
// stays (the Receipt model's own header).
//
// ══ What counts ════════════════════════════════════════════════════════════
//
//   same_number     the same printed receipt number at the same store. The
//                   strongest: tills do not reuse numbers within a store.
//   same_moment     same store, same total, and printed times within
//                   DUPLICATE_MINUTES — two tills do not ring the same total
//                   for the same shop in the same few minutes by chance.
//   same_day_total  same store, same total, same day, and at least one of
//                   them printed no time. Weaker, and said to be weaker.
//
// Store names are compared loosely ("HOME DEPOT #7011" = "The Home Depot").
//
// Pure. scripts/check-receipt-books.mjs attacks it.

/** How close two printed times must be to be "the same moment", minutes. */
export const DUPLICATE_MINUTES = 5;

/** A store name reduced to what identifies the store. */
export function storeKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/#\s*\d+/g, " ")
    .replace(/\b(the|inc|ltd|llc|store|corp|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function numberKey(n) {
  return String(n || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sameStore(a, b) {
  const ka = storeKey(a);
  const kb = storeKey(b);
  if (!ka || !kb) return false;
  return ka === kb || (ka.length >= 5 && kb.includes(ka)) || (kb.length >= 5 && ka.includes(kb));
}

/**
 * @param receipt  { id, vendorName, receiptNumber, totalCents, purchasedDate, purchasedAt }
 * @param others   the same shape, for this company's other non-void receipts
 * @returns [{ id, reason }] — strongest first, at most 3
 */
export function findDuplicates(receipt, others = []) {
  if (!receipt) return [];
  const out = [];
  const at = receipt.purchasedAt ? new Date(receipt.purchasedAt) : null;
  for (const other of Array.isArray(others) ? others : []) {
    if (!other || other.id === receipt.id) continue;
    if (!sameStore(receipt.vendorName, other.vendorName)) continue;

    const num = numberKey(receipt.receiptNumber);
    if (num.length >= 3 && num === numberKey(other.receiptNumber)) {
      out.push({ id: other.id, reason: "same_number", rank: 0 });
      continue;
    }

    const sameTotal =
      Number.isInteger(receipt.totalCents) && receipt.totalCents === other.totalCents;
    if (!sameTotal) continue;

    const otherAt = other.purchasedAt ? new Date(other.purchasedAt) : null;
    if (at && otherAt && Number.isFinite(at.getTime()) && Number.isFinite(otherAt.getTime())) {
      if (Math.abs(at - otherAt) <= DUPLICATE_MINUTES * 60 * 1000) {
        out.push({ id: other.id, reason: "same_moment", rank: 1 });
      }
      continue;
    }
    if (receipt.purchasedDate && receipt.purchasedDate === other.purchasedDate) {
      out.push({ id: other.id, reason: "same_day_total", rank: 2 });
    }
  }
  return out
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map(({ id, reason }) => ({ id, reason }));
}
