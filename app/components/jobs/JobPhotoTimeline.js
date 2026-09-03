"use client";

// app/components/jobs/JobPhotoTimeline.js
//
// The job's own photo record — every photo filed against it, in the order
// the work happened, including the ones nobody starred for the website.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// lib/gallery/albums.js already knows how to turn a pile of JobPhoto rows into
// a dated, stage-grouped story — beforeAfterPairs and albums do exactly that.
// Until now the only thing that ever called them was the public marketing
// site. A contractor could star a photo onto their own homepage but could not
// see their own job's photos as a record, which is backwards: CompanyCam's own
// pitch is that a contractor loses a dispute not for lack of doing the work
// but for lack of being able to SHOW it, and the one place that showing
// matters most — the job itself — had no view of it at all.
//
// stageTimeline() in albums.js is the office-facing twin of albums(): same
// stage ordering, but deliberately UNFILTERED, because the "issue" photos this
// file's public functions exclude on purpose are exactly the evidence a
// contractor reaches for first — pre-existing damage, a condition found once
// something was opened up.
//
// ── Read-only ────────────────────────────────────────────────────────────
//
// Starring for the website and re-staging a guess stay on JobPhotoCurator,
// which already owns those actions and their permission checks. This panel
// only reads — the one thing it can DO is generate the PDF record, which is
// its own, separately-gated route.
import { useEffect, useState, useCallback, useMemo } from "react";
import { Clock, Loader2, FileDown, AlertTriangle } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import { stageTimeline } from "@/lib/gallery/albums";
import { filterByTag } from "@/lib/gallery/tags";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function JobPhotoTimeline({ jobId, jobTitle }) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [tagFilter, setTagFilter] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/photos`);
    if (!res.ok) {
      await reportResponseError(res, "Couldn't load this job's photo record.");
      return;
    }
    const data = await res.json();
    setPhotos(Array.isArray(data.photos) ? data.photos : []);
  }, [jobId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Filter options come from tags actually WORN by a photo on this job — not
  // the company's active-tag picker list — so a retired tag still shows up
  // here if a photo on this job carries it. Filtering must not go blind the
  // moment a tag is retired; it just stops being offered on the CURATOR's
  // picker for new photos (see JobPhotoCurator.js).
  //
  // This sits ABOVE the `loading` early return on purpose. It used to sit
  // below it, which meant the first render (photos still null, loading true)
  // returned before reaching this hook and the second render called it —
  // one more hook than the render before, i.e. React error #310, which took
  // the whole job page down behind the error boundary. `photos` is null until
  // the fetch lands, so the `|| []` guard is what makes hoisting it safe.
  const tagOptions = useMemo(() => {
    const byId = new Map();
    for (const p of photos || []) {
      for (const tg of p.tags || []) {
        if (!byId.has(tg.id)) byId.set(tg.id, tg);
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [photos]);

  async function downloadReport() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/photo-report/pdf`, {
        method: "POST",
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't build the photo report.");
        return;
      }
      // Same pattern as the invoice PDF download: fetch the bytes, hand the
      // browser a blob URL, click a throwaway link, then release the URL —
      // there is no server-rendered page for this to redirect to.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (jobTitle || "job").replace(/[^\w\- ]+/g, "").trim() || "job";
      a.download = `${safeTitle}-photo-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-5 bg-accent rounded w-1/3" />
      </div>
    );
  }

  const total = (photos || []).length;

  const filteredPhotos = filterByTag(photos || [], tagFilter);
  const visiblePhotos = tagFilter ? filteredPhotos : photos || [];
  const groups = stageTimeline(visiblePhotos);

  return (
    <section data-tour="job-photos" className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Clock size={15} /> Photo record ({total})
        </h2>
        <button
          type="button"
          onClick={downloadReport}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <FileDown size={13} />
          )}
          Download photo report
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Every photo filed against this job, dated and grouped by stage — the
        record you'd hand a client, an insurer, or your own future self if this
        job is ever disputed. Includes issue photos, which never appear on your
        public website.
      </p>

      {tagOptions.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <label htmlFor="job-photo-tag-filter" className="text-[11px] font-medium text-muted-foreground">
            {t("app.jobPhotoTags.filterLabel")}
          </label>
          <select
            id="job-photo-tag-filter"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="text-xs bg-transparent text-foreground border border-border rounded px-1.5 py-1"
          >
            <option value="">{t("app.jobPhotoTags.filterAll")}</option>
            {tagOptions.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.active === false ? t("app.jobPhotoTags.retiredSuffix", { name: tg.name }) : tg.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {total === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing filed yet. Add photos below, or text them to your crew line.
        </p>
      ) : visiblePhotos.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("app.jobPhotoTags.none")}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.stage}>
              <div className="flex items-center gap-1.5 mb-2">
                {g.stage === "issue" && (
                  <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                )}
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </h3>
                <span className="text-[11px] text-muted-foreground/70">
                  {g.photos.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {g.photos.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border overflow-hidden bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.caption || g.label}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(p.createdAt)}
                      </p>
                      {p.caption && (
                        <p className="text-[11px] text-foreground truncate" title={p.caption}>
                          {p.caption}
                        </p>
                      )}
                      {p.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.tags.map((tg) => (
                            <span
                              key={tg.id}
                              title={tg.active === false ? t("app.jobPhotoTags.retiredSuffix", { name: tg.name }) : tg.name}
                              className={`text-[9px] leading-none px-1.5 py-0.5 rounded-full text-white ${tg.active === false ? "italic" : ""}`}
                              style={{ backgroundColor: tg.color || "#52525b" }}
                            >
                              {tg.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
