// lib/jobs/photoReport.js
//
// The data behind a job's photo report PDF — grouped, dated, resized — with
// zero @react-pdf/renderer or JSX in this file, so the shape can be unit
// tested with plain node. See app/admin/lib/pdf/renderJobPhotoReportPdf.js for
// the JSX half that lays this out on a page.
//
// ── Why every photo goes through resizedUrl ─────────────────────────────────
//
// A phone photo is commonly 12–48MP. A PDF that embeds twenty of those at full
// resolution is a large, slow download for a document whose whole point is to
// be handed over quickly — to a client settling a dispute, an insurer, or the
// contractor's own inbox. lib/cloudinary.js already solved this once for the
// AI vision pipeline; this reuses the same helper rather than re-deriving a
// second resize rule that could drift from the first.
import { stageTimeline } from "@/lib/gallery/albums";
import { resizedUrl } from "@/lib/cloudinary";
import { formatAddress } from "@/lib/format/address";

// Wide enough to read clearly at the print size the report lays photos out at
// (roughly 2 inches square) and on a phone screen, far short of a full-size
// original. See the file header for why this matters.
export const REPORT_PHOTO_WIDTH = 900;

/**
 * Build the plain-data shape the PDF renderer lays out.
 *
 * Pure — no network, no database. Hand it the job, its client, and the job's
 * OWN photos, unfiltered (this is not the public gallery — see
 * lib/gallery/albums.js#stageTimeline for why "issue" photos belong here and
 * a `featured` filter does not).
 *
 * @returns {{
 *   jobTitle: string,
 *   address: string,
 *   clientName: string,
 *   groups: Array<{ stage: string, label: string, photos: Array<{ url: string, caption: string, date: (string|Date|null) }> }>,
 *   hasPhotos: boolean,
 *   photoCount: number,
 *   generatedAt: Date,
 * }}
 */
export function buildPhotoReportData({ job, client, photos, now = new Date() }) {
  const groups = stageTimeline(photos).map((g) => ({
    stage: g.stage,
    label: g.label,
    photos: g.photos.map((p) => ({
      // Resized, never the original — see REPORT_PHOTO_WIDTH above. Any URL
      // that isn't a Cloudinary /upload/ URL comes back unchanged rather than
      // mangled (resizedUrl's own guarantee), so a foreign URL still renders,
      // just uncapped.
      url: resizedUrl(p.url, { width: REPORT_PHOTO_WIDTH }),
      caption: p.caption || "",
      date: p.createdAt || null,
    })),
  }));

  return {
    jobTitle: job?.title || "Job",
    address: client ? formatAddress(client) : "",
    clientName: client?.name || "",
    groups,
    hasPhotos: groups.some((g) => g.photos.length > 0),
    photoCount: groups.reduce((n, g) => n + g.photos.length, 0),
    generatedAt: now,
  };
}
