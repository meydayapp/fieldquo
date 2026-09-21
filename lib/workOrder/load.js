// lib/workOrder/load.js
//
// Load everything the work order model needs, scoped to the caller.
//
// One loader for the page's API, the PDF and the print sheet, so the three
// cannot disagree about whose job it is or what is hidden. The job query
// spreads assignedJobWhere(member): a crew member asks for a job they are not
// on and gets the same "Not found" another tenant's job gets.
import { db } from "@/lib/db";
import { assignedJobWhere, redactClient, hasLevel } from "@/lib/permissions/enforce";
import { buildWorkOrderModel } from "./build";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param member  the enforceable member (loadEnforceableMember)
 * @returns {{ model, job, company } | null}
 */
export async function loadWorkOrder(jobId, member) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId: member.companyId, ...assignedJobWhere(member) },
    include: {
      client: { select: { name: true, address: true, phone: true, email: true, notes: true } },
      company: {
        select: { id: true, name: true, logoUrl: true, brandColor: true, brandColors: true, defaultLanguage: true, email: true, phone: true },
      },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          language: true,
          scopeGroups: {
            include: { category: { select: { key: true, label: true } } },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      visits: {
        select: { assignedTo: { select: { name: true } } },
      },
      timeEntries: { select: { hours: true } },
      tasks: {
        where: { sourceKey: { startsWith: `work_order:${jobId}:` } },
        select: {
          id: true,
          sourceKey: true,
          status: true,
          assignedTo: { select: { name: true } },
          photos: { select: { id: true, url: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!job) return null;

  const categoryIds = (job.quote?.scopeGroups || []).map((g) => g.categoryId).filter(Boolean);
  const settings = categoryIds.length
    ? await db.companyServiceCategory.findMany({
        where: { companyId: member.companyId, categoryId: { in: categoryIds } },
        select: { categoryId: true, rates: true },
      })
    : [];
  const ratesById = new Map(settings.map((s) => [s.categoryId, s.rates]));

  const model = buildWorkOrderModel({
    job,
    client: redactClient(member, job.client),
    ratesById,
    tasks: job.tasks,
    crew: job.visits.map((v) => v.assignedTo?.name).filter(Boolean),
    clockedHours: job.timeEntries.reduce((s, e) => s + num(e.hours), 0),
    // The office keeps hidden items in the model (flagged) so it can unhide
    // them; the crew's copy drops them. Same level the PATCH asks for.
    forOffice: hasLevel(member, "jobs", "view_create_edit"),
  });

  return { model, job, company: job.company };
}
