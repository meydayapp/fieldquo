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
import { resolveServiceContent } from "@/lib/documents/serviceContent";

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
          createdAt: true,
          scopeGroups: {
            include: { category: { select: { key: true, label: true } } },
            orderBy: { sortOrder: "asc" },
          },
          // The options the client CHOSE — what and where, never the amount.
          addOns: {
            where: { selected: true },
            select: { description: true, detail: true, areaLabel: true },
            orderBy: { sortOrder: "asc" },
          },
          // An hours figure, not money: the quote's own labour estimate, used
          // when the areas themselves carry none (lib/workOrder/build.js).
          costing: { select: { labourHours: true } },
        },
      },
      visits: {
        select: { id: true, scheduledAt: true, status: true, notes: true, assignedTo: { select: { name: true } } },
        orderBy: { scheduledAt: "asc" },
      },
      // The buy list, without a single cost column — what to bring.
      materials: {
        where: { excludedAt: null },
        select: { name: true, qty: true, unit: true, group: true, purchasedAt: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      // The people on its published shifts are on the job too — the same two
      // facts assignedJobWhere opens the job for.
      shifts: {
        where: { published: true, workerId: { not: null } },
        select: { worker: { select: { name: true } } },
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
        // rates for the hours; the rest is the company's own wording of
        // "what's included", which the client's quote printed.
        select: {
          categoryId: true,
          rates: true,
          accentColor: true,
          includedItems: true,
          processSteps: true,
          scopeDescription: true,
          translations: true,
        },
      })
    : [];
  const ratesById = new Map(settings.map((s) => [s.categoryId, s.rates]));
  const settingsById = new Map(settings.map((s) => [s.categoryId, s]));

  // "What's included", per trade, exactly as the client's quote printed it:
  // the QUOTE's language (non-negotiable #6), the company's own wording over
  // the catalogue, the quote's own age deciding which paragraph applied.
  const includedByGroup = new Map();
  for (const g of job.quote?.scopeGroups || []) {
    try {
      const content = resolveServiceContent(
        g.category?.key,
        settingsById.get(g.categoryId) || null,
        g.takeoff,
        job.quote?.language || "en",
        g.intakeValues,
        job.quote?.createdAt,
      );
      includedByGroup.set(g.id, Array.isArray(content?.included) ? content.included : []);
    } catch {
      includedByGroup.set(g.id, []);
    }
  }

  const model = buildWorkOrderModel({
    job,
    client: redactClient(member, job.client),
    ratesById,
    tasks: job.tasks,
    crew: [...new Set([
      ...job.visits.map((v) => v.assignedTo?.name),
      ...(job.shifts || []).map((sh) => sh.worker?.name),
    ].filter(Boolean))],
    clockedHours: job.timeEntries.reduce((s, e) => s + num(e.hours), 0),
    // The office keeps hidden items in the model (flagged) so it can unhide
    // them; the crew's copy drops them. Same level the PATCH asks for.
    forOffice: hasLevel(member, "jobs", "view_create_edit"),
    includedByGroup,
    addOns: job.quote?.addOns || [],
    materials: job.materials || [],
    visits: job.visits,
    quotedHours: num(job.quote?.costing?.labourHours),
  });

  return { model, job, company: job.company };
}
