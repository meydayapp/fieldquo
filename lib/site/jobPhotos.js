// lib/site/jobPhotos.js
//
// Turn the photos crews already take on the job into a website portfolio.
//
// JobVisit.photos is the before/after imagery captured on real visits. It has
// always existed and never reached the marketing site — the single biggest
// untapped visual lever for a contractor's page. This pulls the most recent of
// them so a gallery can auto-fill with genuine work instead of sitting empty or
// waiting for a manual re-upload.
//
// Only used as a FALLBACK: a gallery the company has curated (uploaded its own
// images to) always wins. This fills the gap, it doesn't override a choice.

import { db } from "@/lib/db";
import { beforeAfterPairs } from "@/lib/gallery/albums";
import { displayPhotoUrl } from "@/lib/jobs/photoAnnotation";

const https = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

/**
 * The company's FEATURED gallery photos, if it has curated any.
 *
 * Once an owner features photos, those — and only those — are the public
 * gallery: a job photo is private until they promote it, and "issue" shots are
 * excluded outright. Returns [] when nothing is featured, so the callers below
 * can fall back to the zero-effort raw feed for a company that hasn't curated
 * yet. See lib/gallery/.
 */
async function featuredUrls(companyId, max) {
  const rows = await db.jobPhoto.findMany({
    where: { companyId, featured: true, stage: { not: "issue" } },
    orderBy: { createdAt: "desc" },
    // flattenedUrl alongside url — displayPhotoUrl() below picks the
    // annotated preview when one exists. The stage: { not: "issue" } filter
    // a few lines up is what actually keeps an issue photo's markup off this
    // public path; this select doesn't change what's reachable, only what's
    // shown for a photo that was already going to be public.
    select: { url: true, flattenedUrl: true },
    take: max,
  });
  return rows.map((r) => displayPhotoUrl(r)).filter(https);
}

/**
 * Most-recent, deduped, https-only job photo URLs for a company. Capped.
 *
 * Featured photos win when they exist; otherwise the raw JobVisit feed fills an
 * empty gallery with genuine work rather than nothing.
 */
export async function recentJobPhotos(companyId, max = 8) {
  if (!companyId) return [];
  try {
    // Curated wins. Only if the company has featured nothing do we auto-fill
    // from the raw feed below.
    const featured = await featuredUrls(companyId, max);
    if (featured.length) return featured;

    const visits = await db.jobVisit.findMany({
      where: { job: { companyId }, NOT: { photos: { isEmpty: true } } },
      orderBy: { createdAt: "desc" },
      select: { photos: true },
      take: 40,
    });

    const seen = new Set();
    const out = [];
    for (const v of visits) {
      for (const url of v.photos || []) {
        // Same guard the block sanitiser uses — only real remote images, never
        // a data:/javascript: URL that slipped into the array somehow.
        if (typeof url === "string" && /^https?:\/\//i.test(url) && !seen.has(url)) {
          seen.add(url);
          out.push(url);
          if (out.length >= max) return out;
        }
      }
    }
    return out;
  } catch (err) {
    // A photo fallback must never take down the page. Empty = the gallery just
    // doesn't render (it already hides when it has no images).
    console.error("[site] recentJobPhotos failed:", err?.message);
    return [];
  }
}

/**
 * Candidate before/after PAIRS from real job visits.
 *
 * ── Why pairing is conservative ─────────────────────────────────────────────
 *
 * `JobVisit.photos` is a flat array with no "before"/"after" flag on it. Nothing
 * in the schema says which is which, so any pairing is an inference — and the
 * cost of getting it backwards is a public page claiming a finished kitchen was
 * the "before". That is worse than having no slider.
 *
 * So the inference is deliberately narrow and stated:
 *
 *   • Only visits with EXACTLY TWO photos are paired. Two photos on one visit is
 *     overwhelmingly "I shot it before I started and again when I finished".
 *     A visit with five photos is a progress log, and guessing which two of the
 *     five are the endpoints is not something to do on a customer's website.
 *   • Order within the visit is taken as chronological, which is the order the
 *     crew uploaded them.
 *   • The company can always fix or replace a pair in the editor. This produces
 *     a first draft, not a claim.
 *
 * @returns [{ before, after, caption, jobTitle }]
 */
export async function jobPhotoPairs(companyId, max = 6) {
  if (!companyId) return [];
  try {
    // Real before/after from featured stages: a job's featured "start" beside
    // its featured "finish". Far better than guessing that any visit with two
    // photos is a pair — and it's the owner's curated choice.
    const featured = await db.jobPhoto.findMany({
      where: { companyId, featured: true },
      orderBy: { createdAt: "asc" },
      select: {
        url: true, flattenedUrl: true, stage: true, featured: true, createdAt: true,
        jobId: true, job: { select: { title: true } },
      },
      take: 200,
    });
    if (featured.length) {
      const pairs = beforeAfterPairs(
        featured.map((p) => ({ ...p, jobTitle: p.job?.title || null })),
      );
      if (pairs.length) {
        return pairs.slice(0, max).map((p) => ({
          // displayPhotoUrl() — the annotated preview when one exists, the
          // original otherwise. beforeAfterPairs() already dropped anything
          // staged "issue" (via albums.js#publishable, independently of the
          // `stage: { not: "issue" }` clause featuredUrls() above uses), so
          // there is no annotated issue photo left in `pairs` to leak here.
          before: displayPhotoUrl(p.before).slice(0, 1000),
          after: displayPhotoUrl(p.after).slice(0, 1000),
          caption: p.jobTitle ? String(p.jobTitle).slice(0, 200) : "",
        }));
      }
    }

    // Legacy fallback: no featured stages yet, so fall back to the old
    // "a visit with exactly two photos is a before/after" heuristic.
    const visits = await db.jobVisit.findMany({
      where: { job: { companyId }, NOT: { photos: { isEmpty: true } } },
      orderBy: { createdAt: "desc" },
      select: { photos: true, job: { select: { title: true } } },
      take: 60,
    });

    const out = [];
    for (const v of visits) {
      const photos = (v.photos || []).filter(https);
      if (photos.length !== 2) continue;
      if (photos[0] === photos[1]) continue;
      out.push({
        before: photos[0].slice(0, 1000),
        after: photos[1].slice(0, 1000),
        // The job's own title, which is a real description of the work. Empty
        // rather than invented when the job has no title.
        caption: v.job?.title ? String(v.job.title).slice(0, 200) : "",
      });
      if (out.length >= max) break;
    }
    return out;
  } catch (err) {
    console.error("[site] jobPhotoPairs failed:", err?.message);
    return [];
  }
}
