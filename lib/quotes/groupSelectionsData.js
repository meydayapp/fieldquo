// lib/quotes/groupSelectionsData.js
//
// The `data` fragment that writes a scope group's added colour rows
// (QuoteScopeGroup.selections) — shared by POST /api/quotes and
// reconcileScopeGroups (PATCH) so the two cannot store them differently.
//
//   g.selections absent  → {}  — the column is not touched. Every save path
//                                that knows nothing about colour rows (a status
//                                change, the importer, an older builder) leaves
//                                them exactly as they were.
//   rows left after cleaning → { selections: rows }
//   nothing left (incl. [])  → { selections: DbNull } — cleared to SQL NULL,
//                                never [] (see the column's comment). Prisma
//                                refuses a bare null on a Json column.
//
// Server-only (it imports the Prisma runtime); the cleaning itself is
// lib/jobs/selections.js, which the builder runs too.
import { Prisma } from "@prisma/client";
import { normaliseQuoteGroupSelections } from "@/lib/jobs/selections";

export function quoteGroupSelectionsData(g) {
  if (!g || g.selections === undefined) return {};
  const rows = normaliseQuoteGroupSelections(g.selections);
  return { selections: rows ?? Prisma.DbNull };
}
