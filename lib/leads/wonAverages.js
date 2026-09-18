// lib/leads/wonAverages.js
//
// The one database read behind lib/leads/potentialValue.js: this company's
// won quotes for the services its open leads are asking about, reduced to a
// mean per service category.
//
// Scoped to `companyId` on the query itself, not filtered afterwards — the
// average a lead is priced from must be this company's own history and
// nothing else (AGENTS.md non-negotiable #8). Only the categories the current
// board actually needs are asked for, so a company with years of history
// pays for one bounded query per board load rather than a scan of every
// accepted quote it ever wrote.

import { averageWonByCategory } from "@/lib/leads/potentialValue";

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} companyId
 * @param {string[]} categoryIds  ServiceCategory ids the leads reference
 * @returns {Promise<Record<string, { amount: number, count: number, label?: string }>>}
 */
export async function loadWonAverages(db, companyId, categoryIds) {
  const ids = [...new Set((categoryIds || []).filter((id) => typeof id === "string" && id))];
  if (!companyId || ids.length === 0) return {};

  const categories = await db.serviceCategory.findMany({
    where: { id: { in: ids } },
    select: { id: true, key: true, label: true },
  });
  if (categories.length === 0) return {};
  const keys = categories.map((c) => c.key);

  const wonQuotes = await db.quote.findMany({
    where: {
      companyId,
      status: "accepted",
      OR: [
        { scopeGroups: { some: { categoryId: { in: ids } } } },
        // Quotes that predate scope groups carry the trade on quoteType only.
        { quoteType: { in: keys } },
      ],
    },
    select: {
      total: true,
      acceptedTotal: true,
      quoteType: true,
      scopeGroups: { select: { categoryId: true } },
    },
  });

  return averageWonByCategory(wonQuotes, categories);
}
