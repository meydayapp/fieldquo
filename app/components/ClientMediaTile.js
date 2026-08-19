"use client";

// app/components/ClientMediaTile.js
//
// One tile for one thing a client attached — a photo, a video, or a PDF plan.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// Until now every screen that showed `clientPhotos` carried its own copy of the
// same ternary: `kind === "video" ? <video> : <img>`. Three copies on the staff
// screens (quote detail, invoice detail, leads drawer) plus the uploader's own
// preview. That shape has two problems, and the second is the expensive one:
//
//   1. The copies drifted. The quote page wrapped photos in a link and the
//      invoice page did too, but the leads drawer used a different tile size and
//      showed videos as an icon rather than a player. Nobody was reading three
//      files at once to notice.
//   2. The ternary has no third branch. The moment a PDF could be attached,
//      every one of those copies would fall through to `<img src="plan.pdf">` —
//      a broken-image icon on a staff screen with no way to open the file. The
//      fix had to land in one place or it would land in none.
//
// So the branch lives here, and the pages describe layout only.
//
// ── Documents are a link, never an <img> ────────────────────────────────────
//
// A PDF tile renders a file icon and the filename, and opens in a new tab. It
// deliberately does not try to show a page-1 thumbnail: the upload path stores
// PDFs as Cloudinary `raw` (see lib/media/validate.js), which does no
// rasterising, so there is no thumbnail to show and pretending otherwise would
// be another broken image.

import { Film, FileText, ExternalLink } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * @param {object}  props
 * @param {object|string} props.media   a normalised entry ({url, kind, filename,
 *   caption}) or a bare URL string — older rows stored plain strings.
 * @param {"grid"|"thumb"} [props.variant]
 *   "grid"  — the square cards on quote/invoice detail. Videos get a real
 *             player, because that screen is where someone actually watches.
 *   "thumb" — the small squares in the leads drawer. Everything is a link with
 *             an icon; a row of autoloading players in a side panel is a
 *             bandwidth and layout problem, not a feature.
 */
export default function ClientMediaTile({ media, variant = "grid" }) {
  const { t } = useTranslation();

  const url = typeof media === "string" ? media : media?.url;
  if (!url) return null;

  // A bare string predates `kind`, so it can only be a photo.
  const kind = typeof media === "string" ? "photo" : media?.kind;
  const filename = typeof media === "string" ? "" : media?.filename || "";
  const caption = typeof media === "string" ? "" : media?.caption || "";

  const box =
    variant === "thumb"
      ? "relative block h-14 w-14 overflow-hidden rounded border border-border bg-muted"
      : "block w-full aspect-square overflow-hidden rounded-lg border border-border bg-muted";

  if (kind === "document") {
    // The label falls back to a generic noun only when there is genuinely no
    // filename — it never invents one.
    const label = filename || t("app.media.documentFallback");
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${box} group`}
        title={`${label} — ${t("app.media.opensInNewTab")}`}
      >
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center">
          <FileText
            size={variant === "thumb" ? 16 : 24}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          {variant === "grid" && (
            <>
              <span className="line-clamp-2 break-all text-[11px] leading-tight text-foreground">
                {label}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <ExternalLink size={9} aria-hidden="true" />
                {t("app.media.openPdf")}
              </span>
            </>
          )}
          {/* The thumb variant has no room for text, so the accessible name
              carries what the icon cannot. */}
          {variant === "thumb" && <span className="sr-only">{label}</span>}
        </span>
      </a>
    );
  }

  if (kind === "video") {
    if (variant === "thumb") {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={box}>
          <span className="flex h-full w-full items-center justify-center">
            <Film size={14} className="text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="sr-only">{t("app.media.videoFallback")}</span>
        </a>
      );
    }
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className={`${box} object-cover`}
      />
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={caption || t("app.quoteDetail.clientPhotoAlt")}
        className="h-full w-full object-cover"
      />
    </a>
  );
}
