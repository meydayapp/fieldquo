// lib/designer/templateContext.js
//
// Loads everything lib/designer/templateFill.js needs to turn a template into
// ONE company's post — and nothing from any other company. Every query is
// scoped on companyId in its WHERE clause (lib/tenant/ownedIds.js's
// convention), including the job whose photos fill the slots: a jobId from
// the browser is only ever a filter on this company's own jobs.
import { db } from "@/lib/db";
import { isUploadedUrl } from "@/lib/jobs/documents";
import { serviceAreaSentence } from "@/lib/company/serviceArea";
import { listPostableJobs } from "@/lib/marketing/jobPostSource";
import { assignPhotos, companyTokens, pickReview, templatePalette } from "@/lib/designer/templateFill";

const COMPANY_SELECT = {
  name: true,
  phone: true,
  website: true,
  city: true,
  country: true,
  brandColor: true,
  logoUrl: true,
  defaultLanguage: true,
  serviceRadiusKm: true,
  servicePostalPrefixes: true,
  latitude: true,
  longitude: true,
};

/**
 * @param {string} companyId
 * @param {{photos?: boolean, jobId?: string|null}} [opts]
 *   photos: false for a sidebar preview — the slots stay placeholders, which
 *   is also what makes forty previews one cheap request.
 * @returns {Promise<object|null>} a templateFill ctx, or null when the
 *   company row is missing (never a fabricated company).
 */
export async function loadTemplateContext(companyId, { photos = false, jobId = null } = {}) {
  const [company, services, testimonials, googleReviews] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: COMPANY_SELECT }),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { label: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Only reviews the company approved for publication — the same rows its
    // own website prints (Testimonial.approved).
    db.testimonial.findMany({
      where: { companyId, approved: true },
      select: { quote: true, authorName: true, rating: true },
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),
    // Google's words only where the company chose to show them, unaltered and
    // marked as Google's (see the GoogleReview model's header).
    db.googleReview.findMany({
      where: { companyId, showOnSite: true },
      select: { comment: true, reviewerName: true, starRating: true },
      orderBy: { reviewCreateTime: "desc" },
      take: 20,
    }),
  ]);
  if (!company) return null;

  const language = company.defaultLanguage || "en";
  const areas = serviceAreaSentence(
    { ...company, latitude: company.latitude == null ? null : Number(company.latitude), longitude: company.longitude == null ? null : Number(company.longitude) },
    language,
  );

  let photoMap = {};
  let usedJobId = null;
  if (photos) {
    let targetJobId = typeof jobId === "string" && jobId ? jobId : null;
    if (!targetJobId) {
      // The most recent job with a tagged before/after pair; failing that,
      // the most recent job with any publishable photo.
      const jobs = await listPostableJobs(companyId, { take: 20 });
      targetJobId = (jobs.find((j) => j.beforeAfter) || jobs[0])?.id || null;
    }
    if (targetJobId) {
      const rows = await db.jobPhoto.findMany({
        // companyId AND jobId — a guessed id from another tenant matches nothing.
        where: { companyId, jobId: targetJobId },
        // The unmarked original, never the annotated copy — jobPostSource.js's rule.
        select: { url: true, stage: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      photoMap = assignPhotos(rows.filter((r) => isUploadedUrl(r.url, { cloudName })));
      usedJobId = Object.keys(photoMap).length ? targetJobId : null;
    }
  }

  return {
    language,
    palette: templatePalette(company),
    tokens: companyTokens({
      company,
      services: services.map((s) => s.category?.label).filter(Boolean),
      areas,
    }),
    review: pickReview({ testimonials, googleReviews }),
    photos: photoMap,
    logoUrl: isUploadedUrl(company.logoUrl, { cloudName: process.env.CLOUDINARY_CLOUD_NAME }) ? company.logoUrl : null,
    jobId: usedJobId,
  };
}
