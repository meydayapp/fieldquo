// lib/quotes/quoteNumber.js
//
// The one place quote numbers are minted. The sequence is the server's to own —
// never generated client-side — and the format ("Q-<year>-0001") is shared by
// the manual create route, the instant-estimate draft, and lead conversion, so
// it lives here rather than in three near-identical private copies that drift.
//
// ── Two series, and why the live one must not see the other ───────────────
//
// A past job entered after the fact (POST /api/jobs/import) gets a quote too,
// so the year's overview has the same shape as the live pipeline. Its number
// comes from a SEPARATE series, "Q-<job year>-H0001", for two reasons:
//
//   1. getNextQuoteNumber reads the last run of digits and adds one. Handed
//      "Q-2024-H0003" as the company's newest row it would answer
//      "Q-2026-0004" — a number the live series issued months ago, and a 500
//      on the next "New quote" from the unique index. So every live lookup
//      below EXCLUDES historical rows (historicalImportedAt: null), and the
//      "H" is what keeps a historical number out of the live pattern even if
//      one is ever read by mistake.
//   2. The number says what the row is. A document that was never sent and
//      never will be should not read like one the company issued this year.
//
// A company typing its own old reference ("Q-2024-0012", "24-017") keeps it —
// LIVE_FORMAT_CURRENT_YEAR below is the one shape refused, because that is the
// one the live allocator will reach on its own.

export function getNextQuoteNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `Q-${year}-0001`;
  // The sequence is the LAST run of digits before an optional tier suffix:
  // "Q-2026-0014" and "Q-2026-0014-G" are both sequence 14. The first
  // version matched digits at the very end of the string, so a Good/Better/
  // Best trio's "-G" hid the sequence, this returned "0001", and every quote
  // created after a tiered one collided with the unique index — a 500 on
  // "New quote" and on lead conversion for any company that had ever quoted
  // in tiers. Found live by the 6 September QA rerun the night the first
  // trio was made.
  const match = String(lastNumber).match(/(\d+)(?:-[A-Z]+)?$/);
  const nextSeq = match ? String(Number(match[1]) + 1).padStart(4, "0") : "0001";
  return `Q-${year}-${nextSeq}`;
}

/**
 * The suffix each tier of a Good/Better/Best trio carries after the shared
 * sequence: Q-2026-0012-G / -B / -T. Distinct letters, because "better" and
 * "best" share a first letter and the first version used exactly that.
 */
export const TIER_SUFFIXES = Object.freeze({ good: "G", better: "B", best: "T" });

/**
 * The where-clause every live "what was the last quote number" lookup adds.
 *
 * One exported object rather than `historicalImportedAt: null` typed at four
 * call sites, so scripts/check-past-jobs-import.mjs can assert each site
 * spreads it — a site that forgets is the regression described in the header.
 */
export const LIVE_QUOTE_NUMBER_WHERE = Object.freeze({ historicalImportedAt: null });

// Convenience: read the company's latest quote number and return the next one.
export async function nextQuoteNumberForCompany(db, companyId) {
  const last = await db.quote.findFirst({
    where: { companyId, ...LIVE_QUOTE_NUMBER_WHERE },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true },
  });
  return getNextQuoteNumber(last?.quoteNumber);
}

// ── The historical series ──────────────────────────────────────────────────

const HISTORICAL_QUOTE = /^Q-(\d{4})-H(\d+)$/;
const LIVE_QUOTE = /^Q-(\d{4})-(\d{4})(?:-[A-Z]+)?$/;

/**
 * Pure: the next free number in the historical series for `year`, given every
 * quote number the company already holds (live, historical and hand-typed —
 * ALL of them, because the unique index does not care which series a clash
 * came from).
 */
export function nextHistoricalQuoteNumber(takenNumbers, year) {
  const taken = new Set((takenNumbers || []).map((n) => String(n)));
  const y = Number(year);
  if (!Number.isInteger(y) || y < 1970 || y > 9999) {
    throw new Error(`nextHistoricalQuoteNumber: "${year}" is not a year`);
  }
  let highest = 0;
  for (const n of taken) {
    const m = HISTORICAL_QUOTE.exec(n);
    if (m && Number(m[1]) === y) highest = Math.max(highest, Number(m[2]) || 0);
  }
  let seq = highest + 1;
  for (let guard = 0; guard < 10000; guard++) {
    const candidate = `Q-${y}-H${String(seq).padStart(4, "0")}`;
    if (!taken.has(candidate)) return candidate;
    seq++;
  }
  // Unreachable short of 10,000 consecutive collisions; throwing beats
  // returning a number we know is taken.
  throw new Error("Could not allocate a free historical quote number");
}

/**
 * Is this a number the LIVE allocator could hand out in `year`?
 *
 * Used to refuse a hand-typed historical reference that would collide with
 * the live series later: "Q-2026-0043" typed onto a past job today is the
 * number the next live quote may be given next week, and the unique index
 * would then fail the LIVE create, which is the worse of the two documents to
 * lose. A past year's number ("Q-2024-0012") is fine — the live series never
 * goes backwards.
 */
export function looksLikeLiveQuoteNumber(value, year = new Date().getFullYear()) {
  const m = LIVE_QUOTE.exec(String(value || "").trim());
  return Boolean(m) && Number(m[1]) === Number(year);
}

/**
 * Allocate a historical quote number, checked free against the company's
 * whole table. Takes a Prisma client or transaction, like
 * lib/invoices/invoiceNumber.js's allocateInvoiceNumber.
 */
export async function allocateHistoricalQuoteNumber(tx, { companyId, year }) {
  const taken = (
    await tx.quote.findMany({ where: { companyId }, select: { quoteNumber: true } })
  ).map((r) => r.quoteNumber);
  return nextHistoricalQuoteNumber(taken, year);
}
