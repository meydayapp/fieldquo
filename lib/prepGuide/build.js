// lib/prepGuide/build.js
//
// From a job to the data the guide is rendered from — one shape, read by the
// PDF, the email and the job page alike, so the three cannot disagree about
// which trades, which language or which documents.
//
// ── Which trades a job is for ───────────────────────────────────────────────
//
// A Job carries no category of its own; its trades are its quote's scope
// groups (Job.quoteId → Quote.scopeGroups → ServiceCategory.key), the same
// link the quote document renders from. A job whose quote has no groups falls
// back to Quote.quoteType, which single-trade quotes set to a category key,
// and a job with neither gets one generic section. Never zero sections: a
// guide with nothing in it is a control that appears to work.
//
// ── Which language ──────────────────────────────────────────────────────────
//
// The quote's fixed language first, then the client's, then the company's —
// resolveClientLanguage, the one rule every send path uses. The guide body is
// then rendered in guideLanguage(that), which is that language when the body
// exists in it and English otherwise, with the frame staying in the client's.
//
// ── Which documents ─────────────────────────────────────────────────────────
//
// ServiceDocument rows for this company that are either company-level
// (categoryId null) or for one of the job's categories, and either for any
// language (language null) or for this one. Ordered as the office ordered
// them. Each is checked with isUploadedUrl again at read time — the write
// path already refused anything else, but a URL that leaves the building in
// a client's email is worth checking twice.

import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { categoryLabel } from "@/lib/i18n/translateContent";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { isUploadedUrl } from "@/lib/jobs/documents";
import { SENDER_SELECT } from "@/lib/email/resend";
import { resolvePrepGuide } from "@/lib/prepGuide/resolve";
import { guideLanguage } from "@/lib/prepGuide/content";
import { prepGuideCopy } from "@/lib/prepGuide/copy";

/** The Company columns the guide needs: identity, brand, sender, the rule. */
export const PREP_GUIDE_COMPANY_SELECT = {
  id: true,
  ...SENDER_SELECT,
  phone: true,
  website: true,
  logoUrl: true,
  brandColor: true,
  defaultLanguage: true,
  currency: true,
  prepGuideLeadDays: true,
  taxIdName: true,
  taxIdNumber: true,
};

const CATEGORY_SELECT = (companyId) => ({
  id: true,
  key: true,
  label: true,
  labelTranslations: true,
  companySettings: {
    where: { companyId },
    select: {
      accentColor: true,
      includedItems: true,
      processSteps: true,
      scopeDescription: true,
      translations: true,
      prepGuide: true,
    },
  },
});

/**
 * Everything the guide needs, in one read. Null when the job is not this
 * company's.
 */
export async function loadPrepGuideJob(db, { jobId, companyId }) {
  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: {
      id: true,
      companyId: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      archivedAt: true,
      historicalImportedAt: true,
      prepGuideSentAt: true,
      prepGuideSuppressedAt: true,
      siteAddress: true,
      client: { select: { id: true, name: true, email: true, language: true } },
      company: { select: PREP_GUIDE_COMPANY_SELECT },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          language: true,
          quoteType: true,
          scopeGroups: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, label: true, categoryId: true, category: { select: CATEGORY_SELECT(companyId) } },
          },
        },
      },
    },
  });
  if (!job) return null;

  // A single-trade quote with no groups still names its trade.
  let categories = job.quote?.scopeGroups?.map((g) => g.category).filter(Boolean) || [];
  if (!categories.length && job.quote?.quoteType) {
    const fallback = await db.serviceCategory.findUnique({
      where: { key: job.quote.quoteType },
      select: CATEGORY_SELECT(companyId),
    });
    if (fallback) categories = [fallback];
  }
  // One row per category, even when a quote has two groups of the same trade
  // (two rooms of interior painting are one preparation list).
  const seen = new Set();
  categories = categories.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  const documents = await db.serviceDocument.findMany({
    where: {
      companyId,
      OR: [{ categoryId: null }, { categoryId: { in: categories.map((c) => c.id) } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, url: true, sizeBytes: true, mimeType: true, language: true, categoryId: true },
  });

  return { job, categories, documents };
}

/**
 * Pure: the render data. `loaded` is what loadPrepGuideJob returned.
 */
export function buildPrepGuide(loaded, { cloudName } = {}) {
  const { job, categories, documents } = loaded;
  const company = job.company;
  const client = job.client;

  const language = resolveClientLanguage({ document: job.quote, client, company });
  const bodyLanguage = guideLanguage(language);
  const copy = prepGuideCopy(language);
  const { date } = documentFormatters(language, company.currency);

  const sections = (categories.length ? categories : [null]).map((category) => {
    const override = category?.companySettings?.[0] || null;
    const guide = resolvePrepGuide(category?.key || null, override, language);
    // The process steps are the quote's own — read, never restated, so the
    // guide and the quote describe one sequence. resolveServiceContent
    // already applies the company's override and withholds unfilled lines.
    const content = resolveServiceContent(category?.key || null, override, undefined, language);
    return {
      categoryId: category?.id || null,
      categoryKey: category?.key || null,
      label: category ? categoryLabel(category, language, "en") : "",
      guide,
      steps: content.steps,
    };
  });

  const docs = documents
    .filter((d) => !d.language || d.language === language)
    .filter((d) => isUploadedUrl(d.url, { cloudName }))
    .map((d) => ({ id: d.id, title: d.title, url: d.url, sizeBytes: d.sizeBytes ?? null, mimeType: d.mimeType || null }));

  return {
    language,
    bodyLanguage,
    copy,
    company,
    client,
    job: { id: job.id, title: job.title, startDate: job.startDate, siteAddress: job.siteAddress || "" },
    startDateText: job.startDate ? date(job.startDate) : "",
    clientFirstName: String(client?.name || "").trim().split(/\s+/)[0] || "",
    sections,
    documents: docs,
  };
}
