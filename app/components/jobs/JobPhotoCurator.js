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
import { Star, ImageIcon, Loader2, AlertTriangle } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

export default function JobPhotoCurator({ jobId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

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
  if (!photos.length) return null; // nothing filed yet — no empty box

  const featuredCount = photos.filter((p) => p.featured).length;

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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p) => (
          <PhotoCard
            key={p.id}
            photo={p}
            stages={stages}
            busy={busy === p.id}
            onFeature={() => patch(p.id, { featured: !p.featured })}
            onStage={(stage) => patch(p.id, { stage })}
          />
        ))}
      </div>
    </section>
  );
}

function PhotoCard({ photo, stages, busy, onFeature, onStage }) {
  const isIssue = photo.stage === "issue";
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-background">
      <div className="relative aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" />
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
      </div>
      <div className="p-1.5">
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
      </div>
    </div>
  );
}
