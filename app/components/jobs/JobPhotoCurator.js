"use client";

// app/components/jobs/JobPhotoCurator.js
//
// The job's photos, and the one action that matters: feature the good ones so
// they appear on the website.
//
// ── Featuring is the whole point ───────────────────────────────────────────
//
// A crew photo files here private. A star lifts it onto the public gallery.
// "Issue" photos can't be starred — a shot of hidden water damage is an office
// record, and the toggle says so rather than silently doing nothing.
//
// ── Stage is editable, because the guess isn't always right ─────────────────
//
// The crew agent tags each photo start / progress / finish / issue from what
// was texted. It's usually right; when it isn't, one tap re-stages it — and
// start + finish of the same job is the before/after the site pairs up.

import { useEffect, useState, useCallback } from "react";
import { Star, ImageIcon, Loader2, AlertTriangle, MessageCircle } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import MediaUploader from "@/app/components/MediaUploader";
import JobPhotoComments from "@/app/components/jobs/JobPhotoComments";

export default function JobPhotoCurator({ jobId }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [commentingOn, setCommentingOn] = useState(null); // a photo object, or null

  // Featuring and re-staging are curation decisions — PATCH /api/jobs/[id]/
  // photos still requires jobs:view_create_edit, unchanged by this change.
  // Rendering those controls for someone who holds only view_only (Crew,
  // Estimator) would be exactly the dead-button failure this whole panel was
  // already found to have on the UPLOAD control: a tap that always 403s.
  const canCurate = useHasLevel("jobs", "view_create_edit");

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/photos`);
    if (!res.ok) {
      await reportResponseError(res, "Couldn't load the job's photos.");
      return;
    }
    setData(await res.json());
  }, [jobId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function patch(photoId, body) {
    setBusy(photoId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, ...body }),
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't update that photo.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-5 bg-accent rounded w-1/4" />
      </div>
    );
  }

  const photos = data?.photos || [];
  const stages = data?.stages || [];

  const featuredCount = photos.filter((p) => p.featured).length;

  // ── Rendered even with nothing in it ──────────────────────────────────
  //
  // This used to `return null` when a job had no photos — "nothing filed yet —
  // no empty box". Reasonable while the ONLY way a photo could arrive was a
  // crew member texting one in: an empty box you cannot fill is clutter.
  //
  // It is the wrong call now that there is an upload control, and it was
  // costing more than tidiness even before: a contractor who does not use crew
  // SMS saw no panel at all and concluded the product could not hold job
  // photos. Absent and empty are different statements, and this rendered the
  // wrong one.
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <ImageIcon size={15} /> Job photos ({photos.length})
        </h2>
        <span className="text-xs text-muted-foreground">
          {featuredCount} on your website
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Tap the star to show a photo on your website. Start + finish of a job
        become a before/after.
      </p>

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              stages={stages}
              busy={busy === p.id}
              canCurate={canCurate}
              t={t}
              onFeature={() => patch(p.id, { featured: !p.featured })}
              onStage={(stage) => patch(p.id, { stage })}
              onComment={() => setCommentingOn(p)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nothing filed yet. Add photos here, or text them to your crew line and
          they land automatically.
        </p>
      )}

      {/* ── The intake path ───────────────────────────────────────────────
          Uploads through /api/upload, exactly like a quote's client photos —
          one signed Cloudinary path shared by every surface rather than a
          second one whose rules drift. The URL then gets filed against this
          job by POST /api/jobs/[id]/photos, which is where the company scope
          and the permission level are enforced — jobs:view_only, so this
          works for Crew and Estimator too, not only view_create_edit. */}
      <div className="mt-4 pt-4 border-t border-border">
        <MediaUploader
          uploadUrl="/api/upload"
          value={[]}
          max={12}
          onChange={async (added) => {
            const usable = (added || []).filter((m) => m?.url);
            if (!usable.length) return;
            const res = await fetch(`/api/jobs/${jobId}/photos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                photos: usable.map((m) => ({ url: m.url, stage: "progress" })),
              }),
            });
            if (!res.ok) {
              await reportResponseError(res, "Couldn't file those photos against the job.");
              return;
            }
            // Re-read rather than trusting what we just sent: the server decides
            // the stage and the id, and a list built from the request would
            // disagree with the one the next page load shows.
            await load();
          }}
        />
        <p className="text-[11px] text-muted-foreground/70 mt-2">
          Filed as &ldquo;progress&rdquo; — change the stage on any photo after
          it lands.
        </p>
      </div>

      {commentingOn && (
        <JobPhotoComments
          jobId={jobId}
          photo={commentingOn}
          onClose={() => setCommentingOn(null)}
        />
      )}
    </section>
  );
}

function PhotoCard({ photo, stages, busy, canCurate, t, onFeature, onStage, onComment }) {
  const isIssue = photo.stage === "issue";
  const stageLabel = stages.find((s) => s.key === photo.stage)?.label || photo.stage;
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      <div className="relative aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" />

        <button
          type="button"
          onClick={onComment}
          title={t("app.jobPhotoComments.open", "Comments")}
          className="absolute top-1.5 left-1.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/40 text-white"
        >
          <MessageCircle size={14} />
        </button>

        {/* Featuring is a curation decision — the server still refuses this
            at jobs:view_only (PATCH stays at view_create_edit), and offering
            a star that always 403s for Crew/Estimator is the dead-control
            failure this whole panel was already found to have once, on the
            upload button. Simplest honest fix: don't render it for them. */}
        {canCurate && (
          <button
            type="button"
            disabled={busy || isIssue}
            onClick={onFeature}
            title={isIssue ? "Issue photos can't go on your website" : photo.featured ? "On your website — tap to remove" : "Show on your website"}
            className={`absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm disabled:opacity-50 ${
              photo.featured ? "bg-amber-400 text-amber-950" : "bg-black/40 text-white"
            }`}
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isIssue ? (
              <AlertTriangle size={14} />
            ) : (
              <Star size={14} fill={photo.featured ? "currentColor" : "none"} />
            )}
          </button>
        )}
      </div>
      <div className="p-1.5">
        {canCurate ? (
          <select
            value={photo.stage}
            disabled={busy}
            onChange={(e) => onStage(e.target.value)}
            className="w-full text-xs bg-transparent text-foreground border border-border rounded px-1.5 py-1"
          >
            {stages.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        ) : (
          <p className="w-full text-xs text-muted-foreground px-1.5 py-1 truncate">{stageLabel}</p>
        )}
      </div>
    </div>
  );
}
