// lib/jobs/photoAutofile.js
//
// The homeowner's own pictures, carried from the quote onto the job.
//
// ══ Why ════════════════════════════════════════════════════════════════════
//
// The owner: the quote's pictures "should land in the job too". A homeowner
// photographs the peeling ceiling for the estimate (Quote.clientPhotos —
// lead intake, the self-quote form and the builder's MediaUploader all write
// it); the estimator looks at them; the quote is accepted; and the crew
// opens a job whose Photos are empty until they take their own. The site AS
// QUOTED was one tab away and nothing carried it.
//
// ══ Where they land ════════════════════════════════════════════════════════
//
// JobPhoto, stage "start" — the feed's existing before/pre-work stage
// (lib/gallery/stages.js: "Before / start", order 0) that the photo report
// pairs with "finish" for a before/after. Not a new stage: the report, the
// curator and the timeline all group by the four keys that exist, and a
// fifth would be a group none of them draws.
//
// Caption "From the quote {number}" in the office's language (the same rule
// lib/tasks/autoCreate.js applies to a stored title), so the crew can tell
// the client's picture from their own progress shot without opening it.
//
// ══ What is refused ════════════════════════════════════════════════════════
//
//   • anything that is not a PHOTO — a video or a PDF in clientPhotos is a
//     JobPhoto row whose url an <img> cannot show;
//   • any url not on this deployment's own Cloudinary (isUploadedUrl — the
//     rule the documents store applies, for the reason it gives);
//   • a job that is not this quote's own job in this quote's own tenant.
//
// Idempotent on (jobId, url): a re-run, a second acceptance door, or the
// lazy backfill on first view of the job's Photos files only what is
// missing. Never deletes, never re-stages, never touches a row the crew
// made.
//
// Best-effort by the same contract as documentAutofile.js: nothing here
// throws into the acceptance. `deps` is the seam the check script uses.

import { db as realDb } from "@/lib/db";
import { normaliseMediaList } from "@/lib/media/validate";
import { isUploadedUrl } from "@/lib/jobs/documents";

/** The stage a quote's pictures file under — the feed's own "before". */
export const QUOTE_PHOTO_STAGE = "start";

const CAPTION_MAX = 200;

/**
 * Which of a quote's media entries may become job photos. Pure.
 *
 * @returns {{url: string, caption: string}[]} de-duplicated by url, in the
 *   order the quote holds them (which is the order the homeowner chose).
 */
export function quotePhotosToCarry(clientPhotos, { cloudName } = {}) {
  const seen = new Set();
  const out = [];
  for (const entry of normaliseMediaList(clientPhotos, { max: 100 })) {
    if (entry.kind !== "photo") continue;
    if (!isUploadedUrl(entry.url, { cloudName })) continue;
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    out.push({ url: entry.url, caption: entry.caption || "" });
  }
  return out;
}

/** "From the quote Q-0012 — north wall", capped to the column. Pure. */
export function quotePhotoCaption(base, original) {
  const own = String(original || "").trim();
  const text = own ? `${base} — ${own}` : base;
  return text.slice(0, CAPTION_MAX);
}

async function defaultSentence(language, key, params) {
  const { appSentence } = await import("@/lib/notify/push");
  return appSentence(language, key, params);
}

async function defaultRecordError(payload) {
  const { recordError, errorDetail } = await import("@/lib/platform/errorLog");
  const { err, ...rest } = payload;
  return recordError({ ...rest, detail: errorDetail(err, rest.detail || {}) });
}

/**
 * Carry the quote's photos onto its job.
 *
 * @returns {Promise<{filed: number, present: number, refused: string|null}>}
 *   `present` is how many of the quote's usable photos the job already had.
 */
export async function fileQuotePhotosOnJob({ quoteId, jobId }, deps = {}) {
  const db = deps.db || realDb;
  const sentence = deps.sentence || defaultSentence;
  const recordError = deps.recordError || defaultRecordError;
  const cloudName = deps.cloudName ?? process.env.CLOUDINARY_CLOUD_NAME;

  const out = { filed: 0, present: 0, refused: null };
  if (!quoteId || !jobId) {
    out.refused = "missing_ids";
    return out;
  }

  try {
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        companyId: true,
        quoteNumber: true,
        clientPhotos: true,
        company: { select: { defaultLanguage: true } },
      },
    });
    if (!quote) {
      out.refused = "no_quote";
      return out;
    }
    const job = await db.job.findFirst({
      where: { id: jobId, companyId: quote.companyId, quoteId: quote.id },
      select: { id: true },
    });
    if (!job) {
      out.refused = "job_not_for_quote";
      return out;
    }

    const wanted = quotePhotosToCarry(quote.clientPhotos, { cloudName });
    if (!wanted.length) return out;

    const base =
      (await sentence(quote.company?.defaultLanguage || "en", "app.jobPhotos.fromQuote", { number: quote.quoteNumber }).catch(() => null)) ||
      `From the quote ${quote.quoteNumber}`;

    // One transaction with the job row held, so two acceptances arriving
    // together (the client's click and a retried webhook) cannot both read
    // "missing" and both write. JobPhoto has no unique on (jobId, url) —
    // the crew may legitimately file one picture twice — so the lock is the
    // idempotency, not a constraint.
    await db.$transaction(async (tx) => {
      if (typeof tx.$queryRaw === "function") {
        await tx.$queryRaw`SELECT id FROM "Job" WHERE id = ${job.id} FOR UPDATE`;
      }
      const existing = await tx.jobPhoto.findMany({
        where: { jobId: job.id, url: { in: wanted.map((w) => w.url) } },
        select: { url: true },
      });
      const have = new Set(existing.map((r) => r.url));
      const missing = wanted.filter((w) => !have.has(w.url));
      out.present = wanted.length - missing.length;
      if (!missing.length) return;
      await tx.jobPhoto.createMany({
        data: missing.map((w, i) => ({
          companyId: quote.companyId,
          jobId: job.id,
          url: w.url,
          stage: QUOTE_PHOTO_STAGE,
          caption: quotePhotoCaption(base, w.caption),
          sortOrder: i,
        })),
      });
      out.filed = missing.length;
    });
  } catch (err) {
    await recordError({
      area: "job_documents",
      code: "quote_photos_carry_failed",
      message: `Could not carry the quote's photos onto the job: ${err?.message || "unknown"}`,
      detail: { quoteId, jobId },
      err,
    });
    out.refused = "failed";
  }
  return out;
}
