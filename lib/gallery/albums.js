// lib/gallery/albums.js
//
// Turning a pile of job photos into what a website shows — and, since
// stageTimeline below, into what the OFFICE sees of its own job.
//
// ══ Three views ═════════════════════════════════════════════════════════
//
//   beforeAfterPairs   a job's "before" (start) beside its "after" (finish).
//                      The single most persuasive thing a finish trade can put
//                      on a page — but only when BOTH exist, because a lone
//                      "after" is just a photo and a before/after with no before
//                      is a broken promise.
//   albums             everything else, grouped by job, newest job first, so a
//                      visitor scrolls recent work rather than a flat wall.
//   stageTimeline       the odd one out, and deliberately so — see its own
//                      comment below.
//
// beforeAfterPairs, albums and galleryStrip publish nothing that wasn't
// featured, and exclude "issue" photos from every public view — a shot of
// hidden water damage is an office record, never marketing. stageTimeline is
// the one function in this file that does NOT apply that filter, because it
// isn't building a public view at all.
//
// Pure. Hand it plain photo rows; it decides what the gallery renders.
import { STAGES, STAGE_KEYS } from "./stages";

/** Public-safe photos: featured, with a URL, and never an "issue" shot. */
function publishable(photos) {
  return (Array.isArray(photos) ? photos : []).filter(
    (p) => p && p.featured && p.url && p.stage !== "issue",
  );
}

/** Group an array by a key function into a Map, preserving insertion order. */
function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

/**
 * Before/after pairs — one per job that has both a featured start and a
 * featured finish.
 *
 * @returns [{ jobId, jobTitle, before, after }]  where before/after are the
 *          chosen photos. A job with only one side yields nothing here (its
 *          photos still appear in `albums`), because a before/after that's
 *          missing a side is worse than none.
 */
export function beforeAfterPairs(photos) {
  const byJob = groupBy(publishable(photos).filter((p) => p.jobId), (p) => p.jobId);
  const pairs = [];

  for (const [jobId, group] of byJob) {
    // Earliest featured start, latest featured finish — the widest, most honest
    // contrast for that job.
    const starts = group.filter((p) => p.stage === "start").sort(byCreatedAsc);
    const finishes = group.filter((p) => p.stage === "finish").sort(byCreatedAsc);
    if (!starts.length || !finishes.length) continue;

    pairs.push({
      jobId,
      jobTitle: group[0].jobTitle || null,
      before: starts[0],
      after: finishes[finishes.length - 1],
    });
  }
  return pairs;
}

/**
 * Albums — featured photos grouped by job, newest job first, each job's photos
 * in stage order (start → progress → finish) then oldest-first within a stage.
 *
 * @returns [{ jobId, jobTitle, photos: [...] }]
 */
export function albums(photos) {
  const byJob = groupBy(publishable(photos), (p) => p.jobId || "_ungrouped");

  const out = [];
  for (const [jobId, group] of byJob) {
    const ordered = [...group].sort((a, b) => {
      const sa = STAGES[a.stage]?.order ?? 1;
      const sb = STAGES[b.stage]?.order ?? 1;
      if (sa !== sb) return sa - sb;
      if (a.sortOrder !== b.sortOrder) return (a.sortOrder || 0) - (b.sortOrder || 0);
      return byCreatedAsc(a, b);
    });
    out.push({
      jobId: jobId === "_ungrouped" ? null : jobId,
      jobTitle: group[0].jobTitle || null,
      photos: ordered,
    });
  }

  // Newest job first — by the most recent photo in each group.
  out.sort((a, b) => latestTime(b.photos) - latestTime(a.photos));
  return out;
}

/**
 * A flat, capped list for a simple grid gallery block — featured photos,
 * newest first, before/after pairs kept adjacent so the grid tells a story.
 *
 * @param photos
 * @param {number} limit  hard cap; the block that shows a dozen shouldn't try
 *                        to render five hundred.
 */
export function galleryStrip(photos, limit = 24) {
  const pub = publishable(photos).slice().sort(byCreatedDesc);
  return pub.slice(0, Math.max(0, limit));
}

/** Whether there's anything to show — so a page can hide an empty gallery. */
export function hasGallery(photos) {
  return publishable(photos).length > 0;
}

/**
 * A job's OWN photos, grouped for the office rather than for a visitor.
 *
 * ══ Why this is not `albums` with the filter removed ═══════════════════════
 *
 * Every other function in this file answers "what can a stranger see" —
 * featured only, never an issue shot. This answers a different question,
 * "what does the crew have on record for this job", and the honest answer to
 * that question is EVERYTHING: the photo nobody starred, and especially the
 * issue photo that this file otherwise never lets out. A contractor fighting
 * a claim that pre-existing water damage was their fault needs the shot they
 * never intended to publish more than the one they did — excluding it here
 * would recreate, for the one audience that actually needs the office record,
 * the exact gap this was built to close.
 *
 * So: no `publishable()` filter, on purpose. The caller (the job page, and the
 * photo report PDF) is already scoped to one company's one job before this
 * ever sees the rows — see app/api/jobs/[id]/photos/route.js — which is the
 * access control. This function only orders what it's handed.
 *
 * @returns [{ stage, label, photos }]  one group per stage that has at least
 *          one photo, in the stage order start → progress → finish → issue,
 *          each group's photos oldest-first — the order a dispute gets walked
 *          through out loud: this is what it looked like, this is what
 *          happened, this is how it was left.
 */
export function stageTimeline(photos) {
  const list = (Array.isArray(photos) ? photos : []).filter((p) => p && p.url);
  // An unrecognised stage buckets into "progress" rather than being dropped —
  // same fallback normaliseStage() uses, so a row from before a stage rename
  // still shows up somewhere instead of silently vanishing from its own job's
  // record.
  const byStage = groupBy(list, (p) => (STAGES[p.stage] ? p.stage : "progress"));

  const out = [];
  for (const key of STAGE_KEYS) {
    const group = byStage.get(key);
    if (!group || !group.length) continue;
    out.push({
      stage: key,
      label: STAGES[key].label,
      photos: [...group].sort(byCreatedAsc),
    });
  }
  return out;
}

function ts(p) {
  const t = p?.createdAt ? new Date(p.createdAt).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}
function byCreatedAsc(a, b) { return ts(a) - ts(b); }
function byCreatedDesc(a, b) { return ts(b) - ts(a); }
function latestTime(photos) { return Math.max(0, ...photos.map(ts)); }
