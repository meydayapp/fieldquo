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
//
// ── Tags are a second, unrelated axis ────────────────────────────────────
//
// Below the stage select, a photo can also carry company-defined tags —
// "sanding", "priming", "top coat" — created on the Job photo tags settings
// screen (lib/gallery/tags.js). These are pure decoration: toggling one never
// touches `stage`, never affects featuring, and a tag literally named "Issue"
// would behave exactly like one named "Sanding" — the privacy rule above is
// entirely about the `stage` dropdown, and tags have no way to reach it. A
// retired tag can still show up here, already checked, on whatever photo it
// was on before it was retired — it just won't be offered as a NEW choice.

import { useEffect, useState, useCallback } from "react";
import { Star, ImageIcon, Loader2, AlertTriangle, MessageCircle, PenLine, Settings2 } from "lucide-react";
import Link from "next/link";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel } from "@/app/providers/PermissionProvider";
import MediaUploader from "@/app/components/MediaUploader";
import JobPhotoComments from "@/app/components/jobs/JobPhotoComments";
import PhotoAnnotatorLoader from "@/app/components/photoAnnotator/PhotoAnnotatorLoader";
import { displayPhotoUrl, isAnnotated } from "@/lib/jobs/photoAnnotation";


export default function JobPhotoCurator({ jobId }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [commentingOn, setCommentingOn] = useState(null); // a photo object, or null

  // The photo currently open in the full-screen markup editor, or null. Kept
  // as the whole photo object (not just an id) so PhotoAnnotatorEditor mounts
  // with its annotationJson/annotationWidth/annotationHeight already in hand.
  const [annotating, setAnnotating] = useState(null);

  // Featuring, re-staging, marking up AND changing tags are all curation
  // decisions — PATCH /api/jobs/[id]/photos requires jobs:view_create_edit
  // for every one of them, tagIds included (see the route's own comment on
  // why one level check covers the whole PATCH body). Rendering any of those
  // controls for someone holding only view_only (Crew, Estimator) is the
  // dead-button failure this panel was already found to have on its UPLOAD
  // control: a tap that always 403s.
  //
  // Annotation and tags were each built in a parallel worktree that did not
  // know about this gate, so both arrived ungated. Both write through that
  // same PATCH, so both belong behind the same check — commenting does NOT,
  // since that is its own route a crew member is meant to reach.
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
  const tags = data?.tags || [];

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
    <>
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <ImageIcon size={15} /> Job photos ({photos.length})
        </h2>
        <span className="text-xs text-muted-foreground">
          {featuredCount} on your website
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-1">
        Tap the star to show a photo on your website. Start + finish of a job
        become a before/after.
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        <Link href="/app/settings/job-photo-tags" className="inline-flex items-center gap-1 underline hover:no-underline">
          <Settings2 size={11} /> {t("app.jobPhotoTags.manage")}
        </Link>
      </p>

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              stages={stages}
              tags={tags}
              busy={busy === p.id}
              canCurate={canCurate}
              t={t}
              onFeature={() => patch(p.id, { featured: !p.featured })}
              onStage={(stage) => patch(p.id, { stage })}
              onComment={() => setCommentingOn(p)}
              onAnnotate={() => setAnnotating(p)}
              onRemoveMarkup={() => patch(p.id, { clearAnnotation: true })}
              onTags={(tagIds) => patch(p.id, { tagIds })}
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

    {/* Full-screen, mounted only while open — PhotoAnnotatorLoader is the
        ssr:false boundary (see its own header); nothing in this component
        or its parents ever touches "fabric" directly. */}
    {annotating && (
      <PhotoAnnotatorLoader
        photo={annotating}
        jobId={jobId}
        onCancel={() => setAnnotating(null)}
        onDone={async () => {
          setAnnotating(null);
          // Re-read rather than splicing the PATCH response into local
          // state — the same reasoning the upload handler above already
          // follows: the server decided flattenedUrl/annotationUpdatedAt,
          // and the next page load should show exactly what this shows now.
          await load();
        }}
      />
    )}
    </>
  );
}

function PhotoCard({ photo, stages, tags, busy, canCurate, t, onFeature, onStage, onComment, onAnnotate, onRemoveMarkup, onTags }) {
  const isIssue = photo.stage === "issue";
  const annotated = isAnnotated(photo);
  const stageLabel = stages.find((s) => s.key === photo.stage)?.label || photo.stage;

  const photoTagIds = new Set((photo.tags || []).map((tg) => tg.id));
  // Offer every ACTIVE company tag, plus whatever this specific photo already
  // carries even if that tag has since been retired — a retired tag doesn't
  // disappear off a photo that's already wearing it, it just stops being
  // offered as a fresh choice elsewhere. See lib/gallery/tags.js.
  const pickable = [
    ...tags,
    ...(photo.tags || []).filter((tg) => !tags.some((a) => a.id === tg.id)),
  ];

  function toggleTag(tagId) {
    const next = photoTagIds.has(tagId)
      ? [...photoTagIds].filter((id) => id !== tagId)
      : [...photoTagIds, tagId];
    onTags(next);
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      <div className="relative aspect-square bg-muted">
        {/* Shows the FLATTENED preview when one exists (displayPhotoUrl falls
            back to the untouched original otherwise) — the same URL choice
            the public gallery and the photo report PDF make, so what staff
            see here is what a client or a report will actually show. The
            original itself is never touched; see docs/PHOTO-ANNOTATION.md. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={displayPhotoUrl(photo)} alt={photo.caption || ""} className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={onComment}
          title={t("app.jobPhotoComments.open", "Comments")}
          className="absolute top-1.5 left-1.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/40 text-white"
        >
          <MessageCircle size={14} />
        </button>

        {/* Both of these write through PATCH, which stays at
            jobs:view_create_edit — so both are gated. Offering a control that
            always 403s for Crew is the failure this panel already had once. */}
        {canCurate && (
          <button
            type="button"
            disabled={busy}
            onClick={onAnnotate}
            title={t("app.photoAnnotator.openEditor", "Add markup")}
            className="absolute top-1.5 left-1.5 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm bg-black/40 text-white disabled:opacity-50"
          >
            <PenLine size={14} />
          </button>
        )}
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
      <div className="p-1.5 space-y-1.5">
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
        {canCurate && annotated && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemoveMarkup}
            className="w-full text-[10px] font-semibold text-muted-foreground hover:text-red-600 disabled:opacity-50 text-left"
          >
            {t("app.photoAnnotator.markedUp", "Marked up")} · {t("app.photoAnnotator.removeMarkup", "Remove")}
          </button>
        )}

        {/* Tags write through the SAME PATCH as stage/feature/annotation
            above, gated at jobs:view_create_edit — an ungated toggle here
            would be the identical dead-button 403 those already were, so a
            non-curator gets a plain read-only list of whatever's already on
            the photo (parallel to the stage <p> above) instead of a control
            that always fails. */}
        {canCurate ? (
          pickable.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {pickable.map((tg) => {
                const on = photoTagIds.has(tg.id);
                const retired = tg.active === false;
                return (
                  <button
                    key={tg.id}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleTag(tg.id)}
                    title={retired ? t("app.jobPhotoTags.retiredSuffix", { name: tg.name }) : tg.name}
                    className={`text-[10px] leading-none px-1.5 py-1 rounded-full border disabled:opacity-50 ${
                      on ? "text-white border-transparent" : "border-border text-muted-foreground"
                    } ${retired ? "italic" : ""}`}
                    style={on ? { backgroundColor: tg.color || "#52525b" } : undefined}
                  >
                    {tg.name}
                  </button>
                );
              })}
            </div>
          )
        ) : (
          (photo.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {photo.tags.map((tg) => (
                <span
                  key={tg.id}
                  title={tg.name}
                  className="text-[10px] leading-none px-1.5 py-1 rounded-full border border-transparent text-white"
                  style={{ backgroundColor: tg.color || "#52525b" }}
                >
                  {tg.name}
                </span>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
