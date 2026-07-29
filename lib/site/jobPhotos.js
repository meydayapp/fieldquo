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
