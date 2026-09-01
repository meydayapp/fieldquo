// lib/marketing/jobPhotoContext.js
//
// The bridge between a set of photo URLs sitting on a Marketing Designer
// canvas and what the AI is allowed to know about them: which photo is
// which (its tag), what job it came from, and — separately — what that
// job's own scope of work actually was.
//
// ── Why this is split into pure functions plus a thin db wrapper ───────────
//
// buildPhotoContext() and scopeOfWorkFacts() touch no database and take
// already-loaded rows. That's not just tidiness: this is the layer that
// decides which photos are even ALLOWED to reach a model (an "issue" photo
// never does — non-negotiable) and which job's story gets told when photos
// from more than one job land on the same canvas. Getting either wrong is a
// privacy/accuracy bug, not a formatting one, so both are executed against
// hostile input in scripts/check-designer.mjs rather than only read — the
// same reasoning lib/tasks/suggestFromJob.js's quoteIsGrounded() is held to.
//
// loadJobPhotoContext() is the only part that touches `db`, and it stays
// deliberately thin: load rows, hand them to the pure functions, return what
// they decided.
import { db } from "@/lib/db";
import { isStage, stageLabel } from "@/lib/gallery/stages";

/**
 * Decide, for a list of canvas photo URLs and the JobPhoto rows that matched
 * some of them, which photos are allowed to reach the model and what each
 * one's tag/job actually is.
 *
 * ── The rules, in the order they're applied ─────────────────────────────
 *
 * 1. A photo tagged "issue" is dropped outright — from the images sent to
 *    the vendor AND from the text describing them. Non-negotiable: an issue
 *    photo is an office record (water damage behind a cabinet, a problem to
 *    flag), never a thing that reaches a marketing asset. There is no
 *    override for this in the payload this function is handed.
 * 2. A URL that matches no JobPhoto row at all (a stock photo, a fresh
 *    upload never filed against a job) is KEPT — it's still a real photo on
 *    the canvas the contractor wants captioned — but carries no job/tag
 *    context. The model is told which photos these are so it doesn't invent
 *    a stage for them.
 * 3. When the remaining, job-linked photos span MORE than one job, only the
 *    most-represented job's photos are kept; the rest are excluded from
 *    both the images and the text. Mixing two jobs' photos into one caption
 *    is exactly the "we painted the cabinets" claim landing on a photo from
 *    the OTHER job — ties are broken by first appearance so the result is
 *    deterministic rather than depending on object key order.
 *
 * @param {string[]} urls        the canvas's photo URLs, in the order the
 *                                caller wants them considered — order is
 *                                preserved in the output.
 * @param {Array<{url:string, stage:string, caption:string|null, jobId:string|null, taskTitle?:string|null, taskComment?:string|null}>} photoRows
 *                                JobPhoto rows already loaded by the caller,
 *                                scoped to the caller's own company. Rows
 *                                whose url isn't in `urls` are ignored.
 * @returns {{
 *   images: string[],
 *   photos: Array<{url:string, tag:string|null, tagLabel:string|null, caption:string|null, relatedTask:string|null}>,
 *   jobId: string|null,
 *   beforeAfterAvailable: boolean,
 *   excludedIssue: string[],
 *   excludedOtherJob: string[],
 * }}
 */
export function buildPhotoContext(urls, photoRows) {
  const list = Array.isArray(urls) ? urls : [];
  const rows = Array.isArray(photoRows) ? photoRows : [];
  const byUrl = new Map(rows.map((r) => [r.url, r]));

  // Dedupe the input while preserving first-seen order — the same photo
  // dragged onto the canvas twice must not double-count toward "which job
  // wins" or appear twice in the images sent to the vendor.
  const seen = new Set();
  const ordered = [];
  for (const u of list) {
    if (typeof u === "string" && u && !seen.has(u)) {
      seen.add(u);
      ordered.push(u);
    }
  }

  const excludedIssue = [];
  const candidates = []; // { url, row|null }
  for (const url of ordered) {
    const row = byUrl.get(url) || null;
    if (row && row.stage === "issue") {
      excludedIssue.push(url);
      continue;
    }
    candidates.push({ url, row });
  }

  // Which job wins, when candidates span more than one. Counted only from
  // candidates that actually carry a jobId — an untagged upload has no vote.
  const counts = new Map();
  for (const { row } of candidates) {
    if (row?.jobId) counts.set(row.jobId, (counts.get(row.jobId) || 0) + 1);
  }
  let jobId = null;
  let bestCount = 0;
  for (const { row } of candidates) {
    const id = row?.jobId;
    if (!id || jobId === id) continue;
    const count = counts.get(id) || 0;
    if (count > bestCount) {
      jobId = id;
      bestCount = count;
    }
  }

  const excludedOtherJob = [];
  const photos = [];
  const images = [];
  for (const { url, row } of candidates) {
    if (row?.jobId && jobId && row.jobId !== jobId) {
      excludedOtherJob.push(url);
      continue;
    }
    const tag = row?.stage || null;
    photos.push({
      url,
      tag,
      // isStage() gates stageLabel() rather than calling it unconditionally
      // — stageLabel() itself falls back to "In progress" for ANY unknown
      // key, which would silently mislabel a company-defined custom tag
      // (docs/PHOTO-TAGS.md) as "in progress" instead of showing the tag the
      // company actually gave it. Falling back to the raw tag string here
      // instead is what "design so custom tags flow through" means in
      // practice for this bridge.
      tagLabel: tag ? (isStage(tag) ? stageLabel(tag) : tag) : null,
      caption: row?.caption || null,
      // ── The completion comment ONLY — never the task title ────────────
      //
      // Job.title is deliberately excluded from everything sent to the model,
      // because lib/jobs/createJobFromQuote.js builds it as
      // "{Type} — {ClientName} ({QuoteNumber})", so every auto-created job
      // title carries a homeowner's name. A task title is the same hazard by
      // a different door: lib/tasks/autoCreate.js creates
      // "Schedule the job for {clientName}", and a photo requirement added to
      // one of those would have handed the model exactly the name the Job.title
      // exclusion was protecting.
      //
      // The completion comment is what a crew member wrote ABOUT the photo, so
      // it is the field that was actually useful here anyway. A title is an
      // internal label; it describes the errand, not the image.
      relatedTask: row?.taskComment || null,
    });
    images.push(url);
  }

  return {
    images,
    photos,
    jobId,
    // A computed, deterministic signal rather than leaving the model to
    // infer "is this a before/after" from reading tag strings itself —
    // see the system prompt in lib/ai/marketingCopy.js for why this
    // specific fact is handed over pre-computed instead of left to
    // judgment: two photos both tagged "finish" and none tagged "start"
    // must never be described as a before/after transformation.
    beforeAfterAvailable:
      photos.some((p) => p.tag === "start") && photos.some((p) => p.tag === "finish"),
    excludedIssue,
    excludedOtherJob,
  };
}

/**
 * The job's own scope of work, stripped to what's safe and useful for a
 * caption: category names and line-item descriptions. Never a dollar
 * figure — non-negotiable #5 is written about the browser, but the same
 * instinct applies here: a marketing caption has no business knowing what
 * anything cost, and a model that saw a price could echo it.
 *
 * Mirrors lib/ai/quoteReview.js's quoteServicesContext()/`items` shape
 * rather than inventing a third one — same source data (QuoteScopeGroup),
 * same "label + line item descriptions, no amounts" contract, so a reader
 * who already knows that function recognises this one.
 *
 * @param {Array<{label:string|null, category?:{name?:string}, lineItems:unknown}>} scopeGroups
 * @returns {{ hasScope: boolean, groups: Array<{category:string, items: Array<{description:string, detail?:string}>}> }}
 */
export function scopeOfWorkFacts(scopeGroups) {
  const groups = (Array.isArray(scopeGroups) ? scopeGroups : [])
    .map((g) => {
      const items = (Array.isArray(g?.lineItems) ? g.lineItems : [])
        .filter((li) => li && typeof li.description === "string" && li.description.trim())
        .map((li) => ({
          description: li.description.trim(),
          ...(typeof li.detail === "string" && li.detail.trim()
            ? { detail: li.detail.trim() }
            : {}),
        }));
      return {
        category: g?.label || g?.category?.name || null,
        items,
      };
    })
    .filter((g) => g.category && g.items.length > 0);

  return { hasScope: groups.length > 0, groups };
}

/**
 * The async wrapper: load what's actually in the database for these URLs,
 * hand it to the pure functions above.
 *
 * Scoped to `companyId` on every query — a URL is not proof of ownership, a
 * row matching it AND this company is. A URL that happens to collide with
 * another tenant's JobPhoto (Cloudinary ids are random, so this is
 * practically unreachable, but the query costs nothing to scope correctly
 * regardless) simply won't match here and falls back to "untagged photo".
 *
 * Never selects Job.client or Job.title — the reference point for that
 * choice is lib/jobs/createJobFromQuote.js, which builds Job.title as
 * `${type}${client.name} (${quoteNumber})`. The auto-generated job TITLE
 * embeds the client's name in every single job this product creates, which
 * is a materially different risk than the scope group labels below (free
 * text a contractor typed describing a SERVICE, the same text
 * lib/ai/quoteReview.js already sends to a model today) — so title is
 * excluded outright rather than trusted the same way.
 */
export async function loadJobPhotoContext({ companyId, photoUrls }) {
  const urls = Array.isArray(photoUrls) ? photoUrls.filter((u) => typeof u === "string" && u) : [];
  if (!urls.length) {
    return {
      images: [],
      photos: [],
      jobId: null,
      beforeAfterAvailable: false,
      excludedIssue: [],
      excludedOtherJob: [],
      scope: { hasScope: false, groups: [] },
    };
  }

  const rows = await db.jobPhoto.findMany({
    where: { companyId, url: { in: urls } },
    select: {
      url: true,
      stage: true,
      caption: true,
      jobId: true,
      task: { select: { title: true, completionComment: true } },
    },
  });

  const photoRows = rows.map((r) => ({
    url: r.url,
    stage: r.stage,
    caption: r.caption,
    jobId: r.jobId,
    // Not selected: r.task.title. See relatedTask above — an auto-created
    // task title embeds the client's name. Nothing downstream may have it.
    taskTitle: null,
    taskComment: r.task?.completionComment || null,
  }));

  const context = buildPhotoContext(urls, photoRows);

  let scope = { hasScope: false, groups: [] };
  if (context.jobId) {
    const job = await db.job.findFirst({
      where: { id: context.jobId, companyId },
      select: {
        quote: {
          select: {
            scopeGroups: {
              select: {
                label: true,
                lineItems: true,
                category: { select: { name: true } },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
    scope = scopeOfWorkFacts(job?.quote?.scopeGroups);
  }

  return { ...context, scope };
}
