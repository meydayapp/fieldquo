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

/**
 * Most-recent, deduped, https-only job photo URLs for a company. Capped.
 */
export async function recentJobPhotos(companyId, max = 8) {
  if (!companyId) return [];
  try {
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
    const visits = await db.jobVisit.findMany({
      where: { job: { companyId }, NOT: { photos: { isEmpty: true } } },
      orderBy: { createdAt: "desc" },
      select: { photos: true, job: { select: { title: true } } },
      take: 60,
    });

    const https = (u) => typeof u === "string" && /^https?:\/\//i.test(u);
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
