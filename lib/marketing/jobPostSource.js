// lib/marketing/jobPostSource.js
//
// What a job-photo post is built OUT OF: which two photos, and the company
// facts that go on the footer. The thin database wrapper for
// lib/marketing/jobPost.js's pure composition, split the same way
// lib/marketing/jobPhotoContext.js splits itself and for the same reason —
// choosePhotos() is where a photo is picked to appear in public under the
// contractor's name, which is a correctness question worth executing against
// hostile input (scripts/check-job-post.mjs) rather than only reading.
//
// ── The issue rule, in a second place, deliberately ────────────────────────
//
// jobPhotoContext.js already drops an "issue"-tagged photo before anything
// reaches a MODEL. That is not the same boundary as this one: this decides
// what reaches the CANVAS, and therefore the post. A photo of water damage
// behind a cabinet must not be published even by a path that never asks the
// model anything at all — which is exactly the AI-is-down fallback path this
// file's whole design leans on. So the filter is applied here too, on the
// query, and the duplication is the point rather than an oversight.
//
// ── Why not lib/gallery/albums.js's beforeAfterPairs() ─────────────────────
//
// It is the right rule and the wrong gate. Its publishable() requires
// `featured: true`, because it is choosing what a WEBSITE shows without
// anybody asking — a photo is private there until the owner promotes it. Here
// a person has opened the designer and named one specific job; requiring a
// featuring step first would make the feature yield nothing for almost every
// company. The half that IS the rule — earliest start beside latest finish,
// and nothing at all unless both exist — is reproduced exactly, and the
// comment on it in albums.js is the reasoning for this one too.
import { db } from "@/lib/db";
import { isUploadedUrl } from "@/lib/jobs/documents";

/**
 * Choose the photos for a post from one job's rows.
 *
 * @param {Array<{url: string, stage: string, createdAt: Date|string}>} rows
 *   JobPhoto rows for ONE job, already company-scoped by the caller.
 * @returns {{photos: Array<{url: string, role: "before"|"after"|"single"}>,
 *            beforeAfter: boolean, excludedIssue: number}}
 *
 * A pair when the crew tagged both ends; otherwise the single most recent
 * publishable photo, labelled "single" so composeJobPost() knows not to put a
 * lone "AFTER" pill on it. Empty when the job has no publishable photo, which
 * the caller refuses on rather than composing an empty post.
 */
export function choosePhotos(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(
    (r) => r && typeof r.url === "string" && r.url,
  );

  const issues = list.filter((r) => r.stage === "issue");
  const usable = list.filter((r) => r.stage !== "issue");

  const time = (r) => {
    const t = new Date(r?.createdAt).getTime();
    // A row with no usable timestamp sorts LAST rather than to 1970 — an
    // unparseable date must not win "earliest start" and become the before
    // photo on the strength of being broken.
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  };
  const byOldest = (a, b) => time(a) - time(b);

  const starts = usable.filter((r) => r.stage === "start").sort(byOldest);
  const finishes = usable.filter((r) => r.stage === "finish").sort(byOldest);

  if (starts.length && finishes.length) {
    return {
      // Earliest start, latest finish — the widest honest contrast for the
      // job, the same choice lib/gallery/albums.js makes.
      photos: [
        { url: starts[0].url, role: "before" },
        { url: finishes[finishes.length - 1].url, role: "after" },
      ],
      beforeAfter: true,
      excludedIssue: issues.length,
    };
  }

  // No pair. The most recent finish shot if there is one, else the most
  // recent photo of any stage — never two arbitrary photos side by side,
  // which is a before/after the viewer will read as one whether or not it
  // was labelled.
  const newest = (finishes.length ? finishes : usable).slice().sort(byOldest).pop();
  return {
    photos: newest ? [{ url: newest.url, role: "single" }] : [],
    beforeAfter: false,
    excludedIssue: issues.length,
  };
}

/**
 * Jobs this company could make a post out of, newest first.
 *
 * Job.title is returned HERE and nowhere downstream. It embeds a client's name
 * (lib/jobs/createJobFromQuote.js builds it that way), which is exactly why
 * jobPhotoContext.js excludes it from everything sent to a model — but this
 * list is rendered in /app, the contractor's own back office, to the staff who
 * booked the job. Withholding their own customer's name from them would be
 * privacy theatre; the boundary that matters is the vendor, and it is enforced
 * where the vendor call is made.
 */
export async function listPostableJobs(companyId, { take = 40 } = {}) {
  const jobs = await db.job.findMany({
    where: {
      companyId,
      galleryPhotos: { some: { stage: { not: "issue" } } },
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      galleryPhotos: {
        where: { stage: { not: "issue" } },
        select: { url: true, stage: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return jobs
    .map((job) => {
      const chosen = choosePhotos(job.galleryPhotos);
      return {
        id: job.id,
        title: job.title,
        updatedAt: job.updatedAt,
        photoCount: job.galleryPhotos.length,
        beforeAfter: chosen.beforeAfter,
        // The chosen photos themselves, so the picker can show the contractor
        // what they are about to get rather than a job name and a promise.
        preview: chosen.photos.map((p) => p.url),
      };
    })
    .filter((j) => j.preview.length > 0);
}

/**
 * Everything the composition needs for one post.
 *
 * @param {Object} args
 * @param {string} args.companyId
 * @param {string} [args.jobId]  the job to build from.
 * @param {string[]} [args.photoUrls]  photos the contractor attached by hand
 *   instead of, or as well as, the job's own. Kept only when they came out of
 *   THIS deployment's uploader — see isUploadedUrl(). Two reasons, and the
 *   second is the one that matters: a foreign URL would be fetched by the
 *   server (lib/ai/images.js) and re-served inside the contractor's own post,
 *   and lib/media/cloudinaryUrl.js's filledUrl() cannot pin the delivered size
 *   of an image it doesn't host, which is what the composed document's
 *   width/height depend on being true.
 * @returns {Promise<{
 *   photos: Array<{url: string, role: string}>,
 *   beforeAfter: boolean,
 *   jobId: string|null,
 *   company: {name: string, brandColor: string|null, city: string|null, province: string|null, defaultLanguage: string},
 *   trades: string[],
 * }|null>} null when the company row is missing — never a fabricated company.
 */
export async function loadJobPostSource({ companyId, jobId = null, photoUrls = [] }) {
  const attached = (Array.isArray(photoUrls) ? photoUrls : []).filter((u) =>
    isUploadedUrl(u, { cloudName: process.env.CLOUDINARY_CLOUD_NAME }),
  );

  const [company, trades, jobPhotos] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      // defaultLanguage: the BEFORE/AFTER pills are baked into the layout at
      // composition time, so they have to be written in the company's own
      // language then — not translated at render time. Non-negotiable #6
      // applied to a post: a document keeps the language it was created in.
      select: { name: true, brandColor: true, city: true, province: true, defaultLanguage: true },
    }),
    db.companyServiceCategory.findMany({
      where: { companyId, enabled: true },
      select: { category: { select: { label: true } } },
      orderBy: { createdAt: "asc" },
    }),
    jobId
      ? db.jobPhoto.findMany({
          // companyId AND jobId. jobId alone would read another tenant's job
          // from a guessed id — lib/tenant/ownedIds.js's convention, applied
          // on the query rather than by checking the rows afterwards.
          where: { companyId, jobId },
          // `url`, never `flattenedUrl`. displayPhotoUrl() prefers the
          // ANNOTATED variant, which is the office's copy with arrows and
          // circles drawn on it to flag something — the last thing that should
          // go out as marketing. The unmarked original is the photograph.
          select: { url: true, stage: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  if (!company) return null;

  const chosen = choosePhotos(jobPhotos);

  // An attachment WINS over the job's own photos when one was supplied: the
  // contractor picked it on the screen a moment ago, and silently preferring
  // what the crew happened to tag would be the control that appears to work.
  // One attachment reads as the single shot; two as a before/after in the
  // order they were attached, which is the order they appear on the screen
  // that sent them.
  const photos = attached.length
    ? attached
        .slice(0, 2)
        .map((url, i) => ({ url, role: attached.length === 2 ? (i === 0 ? "before" : "after") : "single" }))
    : chosen.photos;

  return {
    photos,
    beforeAfter: attached.length === 2 || (!attached.length && chosen.beforeAfter),
    jobId: jobId || null,
    company,
    trades: trades.map((t) => t.category?.label).filter(Boolean),
  };
}
