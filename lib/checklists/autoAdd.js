// lib/checklists/autoAdd.js
//
// Attaches a company's auto-add checklists to a job the moment it exists.
//
// ── Which trades a job is for ──────────────────────────────────────────────
//
// The same answer lib/prepGuide/build.js gives: the quote's scope groups'
// categories, else Quote.quoteType (which single-trade quotes set to a
// category key). A job with neither gets nothing — attaching a list by guess
// would put steps on a work order nobody chose.
//
// ── Only on a job that has no checklist yet ────────────────────────────────
//
// Best-effort and one-shot: a job that already carries items (someone added
// a list by hand in the second between create and this) is left alone, and a
// failure never fails the job — the lists can be added from the job page.

import { itemsFromTemplate } from "@/lib/checklists/typedItems";

export async function attachAutoChecklists(db, { jobId, companyId, quoteId }) {
  if (!jobId || !companyId || !quoteId) return { attached: 0 };

  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId },
    select: {
      quoteType: true,
      scopeGroups: { select: { category: { select: { key: true } } } },
    },
  });
  if (!quote) return { attached: 0 };

  const keys = new Set(
    (quote.scopeGroups || []).map((g) => g.category?.key).filter(Boolean),
  );
  if (!keys.size && quote.quoteType) keys.add(quote.quoteType);
  if (!keys.size) return { attached: 0 };

  const templates = await db.jobChecklistTemplate.findMany({
    where: { companyId, autoAddFor: { hasSome: [...keys] } },
    orderBy: { createdAt: "asc" },
  });
  if (!templates.length) return { attached: 0 };

  const [job, company] = await Promise.all([
    db.job.findFirst({ where: { id: jobId, companyId }, select: { checklistItems: true } }),
    db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } }),
  ]);
  if (!job) return { attached: 0 };
  if (Array.isArray(job.checklistItems) && job.checklistItems.length) return { attached: 0 };

  // The crew's working language is the company's, not the client's — the
  // client never reads this list.
  const lang = company?.defaultLanguage || "en";
  const items = templates.flatMap((tpl) => itemsFromTemplate(tpl, lang));
  if (!items.length) return { attached: 0 };

  await db.job.update({ where: { id: jobId }, data: { checklistItems: items } });
  return { attached: templates.length };
}
