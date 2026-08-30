"use client";

// app/components/designer/ImageSidebar.js
//
// Ported from `components/image-sidebar.tsx`, but rewired rather than
// copied: the source had two image sources — uploadthing's UploadButton and
// an Unsplash stock-photo browser (useGetImages) — and AGENTS.md says drop
// both. Dropping them without replacing the upload path would leave "Image"
// in the left rail opening a panel that can't put anything on the canvas,
// which is the exact dead-control failure AGENTS.md warns about.
//
// So this uses FieldQuo's own upload path instead: MediaUploader
// (app/components/MediaUploader.js) posting to the already-authenticated,
// Cloudinary-backed /api/upload route (see that route's own comment on why
// it's signed server-side, not an unsigned preset). Nothing new was built
// server-side — both pieces already existed and are reused as-is.
//
// Each successful upload is added to the canvas immediately; MediaUploader's
// own thumbnail grid (with per-item remove) then serves as this session's
// upload history, matching what the "Upload Image" button visually promises.
import { useState } from "react";

import MediaUploader from "@/app/components/MediaUploader";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function ImageSidebar({ editor, activeTool, onChangeActiveTool }) {
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
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        activeTool === "images" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Images" description="Upload images to add to your canvas" />
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
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
