"use client";

// app/components/designer/ImageSidebar.js
//
// Ported from `components/image-sidebar.tsx`, rewired rather than copied for
// the Upload tab, and the Unsplash tab RESTORED per the owner's 2026-08-30
// correction — every editor feature in the ported clone exists in FieldQuo
// except AI image generation, and stock photos are not that.
//
// Upload: FieldQuo's own upload path — MediaUploader
// (app/components/MediaUploader.js) posting to the already-authenticated,
// Cloudinary-backed /api/upload route — instead of the source's uploadthing.
// Each successful upload is added to the canvas immediately; MediaUploader's
// own thumbnail grid (with per-item remove) then serves as this session's
// upload history, matching what the "Upload Image" button visually promises.
//
// Stock photos: app/api/designer/unsplash proxies Unsplash server-side (see
// that route and lib/designer/unsplash.js for why — the key never reaches
// the browser). Three states, not two: no key configured, key configured but
// the provider didn't answer, and a normal empty result — collapsing any of
// these into "no images found" tells a contractor to do something ("search
// again") that won't fix an operator problem or a network blip.
//
// Job photos: the tab that makes the AI context bridge (lib/marketing/
// jobPhotoContext.js, PublishModal.js's "Generate with AI" button) actually
// reachable. Before this existed, there was no way to get an EXISTING
// JobPhoto's URL onto the canvas at all — Upload posts a fresh file to
// Cloudinary and Stock proxies Unsplash, neither of which ever produces a
// URL that matches a JobPhoto row, so the caption generator would always
// find nothing to ground itself in no matter how good the job's own record
// was. Reuses GET /api/jobs/[id]/photos — the exact same endpoint
// JobPhotoCurator.js already calls — rather than a second "list this job's
// photos" implementation.
//
// An "issue"-tagged photo is filtered out of this picker entirely, not
// merely left clickable — the same rule PATCH /api/jobs/[id]/photos already
// enforces for featuring one on the public site ("An issue photo can't be
// featured on your website"), applied here for the same reason: an issue
// photo is an office record, never a thing that reaches a marketing asset.
// lib/ai/marketingCopy.js's own pipeline drops one even if it somehow
// arrived on the canvas some other way, but this is the point where
// offering it in the first place is the wrong thing to do.
import { useEffect, useState } from "react";
import { AlertTriangle, Loader, Settings2 } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import MediaUploader from "@/app/components/MediaUploader";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function ImageSidebar({ editor, activeTool, onChangeActiveTool }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("upload");
  const [uploaded, setUploaded] = useState([]);

  const onClose = () => onChangeActiveTool("select");

  const onUploaderChange = (next) => {
    // MediaUploader appends newly-finished uploads to the end of the array
    // it hands back; anything past the length we already had is new this
    // call, and goes straight onto the canvas.
    const added = next.slice(uploaded.length);
    setUploaded(next);
    added.forEach((item) => {
      if (item.kind === "photo") editor?.addImage(item.url);
    });
  };

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        activeTool === "images" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Images" description="Upload or find an image for your canvas" />
      <div className="flex border-b p-2 gap-x-1">
        <Button
          size="sm"
          variant={tab === "upload" ? "secondary" : "ghost"}
          className="flex-1"
          onClick={() => setTab("upload")}
        >
          Upload
        </Button>
        <Button
          size="sm"
          variant={tab === "stock" ? "secondary" : "ghost"}
          className="flex-1"
          onClick={() => setTab("stock")}
        >
          Stock photos
        </Button>
        <Button
          size="sm"
          variant={tab === "jobPhotos" ? "secondary" : "ghost"}
          className="flex-1"
          onClick={() => setTab("jobPhotos")}
        >
          {t("app.marketingDesigner.imageSidebar.jobPhotosTab")}
        </Button>
      </div>
      {tab === "upload" && (
        <div className="overflow-y-auto">
          <div className="p-4">
            <MediaUploader
              uploadUrl="/api/upload"
              value={uploaded}
              onChange={onUploaderChange}
              max={20}
              label="Upload image"
              hint="JPG, PNG, WEBP, GIF or SVG — added to the canvas as soon as it's uploaded."
            />
          </div>
        </div>
      )}
      {tab === "stock" && <StockPhotoTab editor={editor} />}
      {tab === "jobPhotos" && <JobPhotoTab editor={editor} />}
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}

function StockPhotoTab({ editor }) {
  const [state, setState] = useState({ status: "loading", images: [] });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/designer/unsplash")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.reason === "not_configured") {
          setState({ status: "not_configured", images: [] });
        } else if (data.reason === "unavailable") {
          setState({ status: "unavailable", images: [] });
        } else {
          setState({ status: "ready", images: Array.isArray(data.images) ? data.images : [] });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", images: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // "The stock library isn't set up on this deployment" — an operator
  // statement, not a search-result statement. See the route's own comment.
  if (state.status === "not_configured") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-y-3 p-4 text-center">
        <Settings2 className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">Stock photos aren&apos;t set up</p>
        <p className="text-xs text-muted-foreground">
          This deployment hasn&apos;t configured a stock-photo library yet. Ask FieldQuo to add
          an Unsplash key, or upload your own images instead.
        </p>
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-y-3 p-4 text-center">
        <AlertTriangle className="size-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Couldn&apos;t reach the stock-photo library right now. Try again in a moment.
        </p>
      </div>
    );
  }

  if (state.images.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-xs text-muted-foreground">No stock photos found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      <div className="grid grid-cols-2 gap-4 p-4">
        {state.images.map((image) => (
          <button
            key={image.id}
            onClick={() => editor?.addImage(image.fullUrl)}
            className="group relative h-[100px] w-full overflow-hidden rounded-sm border bg-muted transition hover:opacity-75"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.thumbUrl}
              alt={image.altDescription}
              className="h-full w-full object-cover"
            />
            {image.photographerUrl && (
              <a
                href={image.photographerUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-0 left-0 w-full truncate bg-black/50 p-1 text-left text-[10px] text-white opacity-0 transition hover:underline group-hover:opacity-100"
              >
                {image.photographerName}
              </a>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function JobPhotoTab({ editor }) {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState(null); // null = loading
  const [jobId, setJobId] = useState("");
  const [photos, setPhotos] = useState(null); // null = not loaded / loading

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setJobs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!jobId) {
      setPhotos(null);
      return;
    }
    let cancelled = false;
    setPhotos(null);
    fetch(`/api/jobs/${jobId}/photos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.photos) ? data.photos : [];
        // Never offered as a pickable image — an issue photo is an office
        // record. See this file's module doc.
        setPhotos(rows.filter((p) => p.stage !== "issue"));
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (jobs === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="p-4 pb-2">
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
        >
          <option value="">{t("app.marketingDesigner.imageSidebar.chooseJob")}</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        {jobs.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("app.marketingDesigner.imageSidebar.noJobs")}
          </p>
        )}
      </div>

      {!jobId && jobs.length > 0 && (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            {t("app.marketingDesigner.imageSidebar.pickJobHint")}
          </p>
        </div>
      )}

      {jobId && photos === null && (
        <div className="flex flex-1 items-center justify-center">
          <Loader className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {jobId && photos !== null && photos.length === 0 && (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            {t("app.marketingDesigner.imageSidebar.noJobPhotos")}
          </p>
        </div>
      )}

      {jobId && photos !== null && photos.length > 0 && (
        <div className="overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 p-4 pt-2">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => editor?.addImage(p.url)}
                title={p.caption || ""}
                className="group relative h-[100px] w-full overflow-hidden rounded-sm border border-border bg-muted transition hover:opacity-75"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || ""} className="h-full w-full object-cover" />
                {/* The tag — the whole reason this tab exists instead of just
                    pointing someone at Upload: it's what lets "Generate with
                    AI" later tell a start photo from a finish one. */}
                <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {p.stage}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
