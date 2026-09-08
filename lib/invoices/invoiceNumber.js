// lib/invoices/invoiceNumber.js
//
// What an invoice is called, decided in one place.
//
// ── Why an invoice borrows its quote's number ──────────────────────────────
//
// Q-2026-0008 became INV-2026-0014, and nothing on either document said they
// were the same job. Reconciling a quote to the invoice it turned into meant
// opening both. When an invoice comes from a quote there is exactly one of
// each, so the sequence can be shared and the pair reads at a glance:
//
//   Q-2026-0008  →  INV-2026-0008
//
// The prefix still distinguishes them, which is what the owner asked for.
//
// ── Where that does NOT apply ──────────────────────────────────────────────
//
// An invoice raised without a quote has no number to borrow and keeps the
// running sequence.
//
// A revised invoice is NOT a new number. `parentInvoiceId` in the schema is
// versioning — v2 of an invoice keeps its number, which is why nothing here
// allocates for it. There is no split-invoice/deposit model to number; stage
// payments are a payment schedule on one invoice, not several invoices.
//
// ── The gap this creates, stated rather than discovered later ──────────────
//
// Mirroring quote numbers means the invoice sequence has holes in it: quotes
// that were never accepted leave their number unused. Canada does not require
// gapless invoice numbering (CRA asks only that each invoice be uniquely
// identifiable). Some EU member states DO require an unbroken sequence for VAT.
// A company billing under those rules should keep the plain sequence, and that
// is what `preferQuoteNumber: false` is for — there is no UI for it yet, and
// this comment is the reason to build one before selling into the EU.
//
// ── Collisions ─────────────────────────────────────────────────────────────
//
// invoiceNumber has no unique constraint, and the old "last invoice by
// createdAt" lookup could hand out the same number twice — two invoices raised
// in the same second, or any invoice whose number did not sort by creation
// time. Every allocation here checks the number is actually free and counts up
// until it is, so a borrowed number that collides degrades to the sequence
// instead of duplicating.

const QUOTE_NUMBER = /^Q-(\d{4})-(\d+)$/;
const INVOICE_SEQ = /-(\d+)$/;

/**
 * The invoice number a quote implies, or null when its number isn't one we
 * recognise (imported quotes, hand-typed references).
 */
export function invoiceNumberFromQuote(quoteNumber) {
  const m = QUOTE_NUMBER.exec(String(quoteNumber || "").trim());
  return m ? `INV-${m[1]}-${m[2]}` : null;
}

/**
 * The next number in the plain sequence. Kept exported under its old name so
 * the callers that only ever wanted "one more than the last" are unchanged.
 */
export function getNextInvoiceNumber(lastNumber, year = new Date().getFullYear()) {
  if (!lastNumber) return `INV-${year}-0001`;
  const match = INVOICE_SEQ.exec(String(lastNumber));
  const nextSeq = match ? String(Number(match[1]) + 1).padStart(4, "0") : "0001";
  return `INV-${year}-${nextSeq}`;
}

/**
 * Allocate a number for a new invoice, checking it is free.
 *
 * @param {object} tx      a Prisma client or transaction
 * @param {object} p
 * @param {string} p.companyId
 * @param {string|null} [p.quoteNumber]  the quote this invoice bills, if any
 * @param {boolean} [p.preferQuoteNumber=true] see the EU note above
 */
export async function allocateInvoiceNumber(
  tx,
  { companyId, quoteNumber = null, preferQuoteNumber = true },
) {
  const taken = new Set(
    (
      await tx.invoice.findMany({
        where: { companyId },
        select: { invoiceNumber: true },
      })
    ).map((r) => r.invoiceNumber),
  );

  if (preferQuoteNumber && quoteNumber) {
    const mirrored = invoiceNumberFromQuote(quoteNumber);
    if (mirrored && !taken.has(mirrored)) return mirrored;
  }

  // The sequence. Highest number actually issued, not the most recently
  // created — those are not the same thing once numbers are also borrowed,
  // and using creation order is how the old code could repeat one.
  const year = new Date().getFullYear();
  let highest = 0;
  for (const n of taken) {
    const m = INVOICE_SEQ.exec(String(n));
    if (m) highest = Math.max(highest, Number(m[1]) || 0);
  }
  let seq = highest + 1;
  for (let guard = 0; guard < 10000; guard++) {
    const candidate = `INV-${year}-${String(seq).padStart(4, "0")}`;
    if (!taken.has(candidate)) return candidate;
    seq++;
  }
  // Unreachable short of 10,000 consecutive collisions; throwing beats
  // returning a number we know is taken.
  throw new Error("Could not allocate a free invoice number");
}

// ── The historical series ──────────────────────────────────────────────────
//
// A past job entered after the fact (POST /api/jobs/import) bills as
// INV-<job year>-H0001, mirroring its quote's Q-<year>-H0001 the same way a
// live pair mirrors — see lib/quotes/quoteNumber.js for why the series is
// separate. INVOICE_SEQ above does not match "-H0001" (no digit follows the
// hyphen), so a historical number never raises the live sequence's `highest`;
// it only ever sits in `taken`, which is exactly the one role it should play.

const HISTORICAL_INVOICE = /^INV-(\d{4})-H(\d+)$/;
const HISTORICAL_QUOTE = /^Q-(\d{4})-H(\d+)$/;
const LIVE_INVOICE = /^INV-(\d{4})-(\d{4})$/;

/**
 * Pure: the historical invoice number for a past job. Mirrors the quote's
 * historical number when the quote has one and the mirror is free; otherwise
 * the next free number in the year's historical series.
 */
export function nextHistoricalInvoiceNumber(takenNumbers, year, quoteNumber = null) {
  const taken = new Set((takenNumbers || []).map((n) => String(n)));
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1970 || y > 9999) {
    throw new Error(`nextHistoricalInvoiceNumber: "${year}" is not a year`);
  }
  const q = HISTORICAL_QUOTE.exec(String(quoteNumber || "").trim());
  if (q) {
    const mirrored = `INV-${q[1]}-H${q[2]}`;
    if (!taken.has(mirrored)) return mirrored;
  }
  let highest = 0;
  for (const n of taken) {
    const m = HISTORICAL_INVOICE.exec(n);
    if (m && Number(m[1]) === y) highest = Math.max(highest, Number(m[2]) || 0);
  }
  let seq = highest + 1;
  for (let guard = 0; guard < 10000; guard++) {
    const candidate = `INV-${y}-H${String(seq).padStart(4, "0")}`;
    if (!taken.has(candidate)) return candidate;
    seq++;
  }
  throw new Error("Could not allocate a free historical invoice number");
}

/**
 * Is this a number the LIVE allocator could hand out in `year`? Same rule and
 * same reason as looksLikeLiveQuoteNumber in lib/quotes/quoteNumber.js.
 */
export function looksLikeLiveInvoiceNumber(value, year = new Date().getFullYear()) {
  const m = LIVE_INVOICE.exec(String(value || "").trim());
  return Boolean(m) && Number(m[1]) === Number(year);
}

/** Allocate a historical invoice number, checked free against the whole table. */
export async function allocateHistoricalInvoiceNumber(tx, { companyId, year, quoteNumber = null }) {
  const taken = (
    await tx.invoice.findMany({ where: { companyId }, select: { invoiceNumber: true } })
  ).map((r) => r.invoiceNumber);
  return nextHistoricalInvoiceNumber(taken, year, quoteNumber);
}
