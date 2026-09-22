// lib/quotes/textBlockSeed.js
//
// Give a painting company its nine starter blocks, once.
//
// Runs on the FIRST READ of the library rather than at signup: the table did
// not exist when today's companies signed up, and a company's trade is set
// after the account is. Idempotent by construction — a company that already
// has any block (seeded or their own) is left alone, and every seeded row
// carries its seedKey so a second pass with the same keys is a no-op even if
// two library reads race: the unique-ish guard is the count query inside the
// same call, and the worst race outcome is a duplicate a person can delete,
// never a lost block.
//
// Not every company: only one with a painting trade switched on, because the
// blocks are painting prose. A plumber's library opens empty, which is what we
// have written for plumbers.

import { seedRowsFor, PAINTING_CATEGORY_KEYS } from "@/lib/quotes/textBlockDefaults";

/**
 * @returns {Promise<number>} rows inserted (0 when nothing was needed)
 */
export async function seedTextBlocksIfEmpty(db, companyId) {
  const existing = await db.quoteTextBlock.count({ where: { companyId } });
  if (existing > 0) return 0;

  const [company, painting] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } }),
    db.companyServiceCategory.count({
      where: {
        companyId,
        enabled: true,
        category: { key: { in: [...PAINTING_CATEGORY_KEYS] } },
      },
    }),
  ]);
  if (!company || painting === 0) return 0;

  const rows = seedRowsFor(companyId, company.defaultLanguage || "en");
  const result = await db.quoteTextBlock.createMany({ data: rows });
  return result.count;
}
