// lib/quotes/quoteNumber.js
//
// The one place quote numbers are minted. The sequence is the server's to own —
// never generated client-side — and the format ("Q-<year>-0001") is shared by
// the manual create route, the instant-estimate draft, and lead conversion, so
// it lives here rather than in three near-identical private copies that drift.

export function getNextQuoteNumber(lastNumber) {
  const year = new Date().getFullYear();
  if (!lastNumber) return `Q-${year}-0001`;
  const match = String(lastNumber).match(/(\d+)$/);
  const nextSeq = match ? String(Number(match[1]) + 1).padStart(4, "0") : "0001";
  return `Q-${year}-${nextSeq}`;
}

// Convenience: read the company's latest quote number and return the next one.
export async function nextQuoteNumberForCompany(db, companyId) {
  const last = await db.quote.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true },
  });
  return getNextQuoteNumber(last?.quoteNumber);
}
