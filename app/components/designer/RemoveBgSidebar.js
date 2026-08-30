"use client";

// app/components/designer/RemoveBgSidebar.js
//
// Restored per the owner's 2026-08-30 correction: the first pass dropped
// this alongside ai-sidebar as "paywalled AI with no backend", and that call
// needed surfacing before dropping it, not after — noted, and fixed here.
//
// It has to exist, but it can't be free and can't be silent: removing a
// background is an AI image EDIT, the same cost class as generation, billed
// per call at any real vendor. So this is gated on the SAME
// `image_generation` spend kind AiSidebar.js uses (no separate price
// invented) via lib/designer/aiImageAdapter.js, POSTed through
// app/api/designer/remove-bg/route.js. Same status-before-click pattern as
// AiSidebar: the button renders disabled with the reason rather than
// clicking through to a refusal.
import { useState } from "react";
import { AlertTriangle, Loader } from "lucide-react";

import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";
import {
  useAiImageStatus,
  centsToDollars,
  disabledReasonText,
} from "@/app/components/designer/hooks/useAiImageStatus";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function RemoveBgSidebar({ editor, activeTool, onChangeActiveTool }) {
  const active = activeTool === "remove-bg";
  const { status, loading } = useAiImageStatus(active);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedObject = editor?.selectedObjects[0];
  // fabric's own field for "the <img> element this fabric.Image was built
  // from" — same lookup the source clone used. There is no public fabric API
  // for "give me back the URL", only the DOM element it loaded.
  const imageSrc = selectedObject?._originalElement?.currentSrc;

  const onClose = () => onChangeActiveTool("select");

  const onClick = async () => {
    if (!status?.allowed || !imageSrc) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/designer/remove-bg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSrc }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't remove that background.");
        return;
      }
      editor?.addImage(data.url);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        active ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="Background removal"
        description={
          status?.priceCents
            ? `Remove background from image using AI — ${centsToDollars(status.priceCents)} each`
            : "Remove background from image using AI"
        }
      />
      {!imageSrc && (
        <div className="flex flex-1 flex-col items-center justify-center gap-y-4">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Feature not available for this object</p>
        </div>
      )}
      {imageSrc && loading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {imageSrc && !loading && (
        <div className="overflow-y-auto">
          <div className="space-y-4 p-4">
            <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc} alt="Selected" className="h-full w-full object-cover" />
            </div>
            {!status?.allowed && (
              <p className="text-xs text-muted-foreground">{disabledReasonText(status)}</p>
            )}
            <Button
              disabled={!status?.allowed || submitting}
              onClick={onClick}
              className="w-full"
            >
              {submitting ? "Removing…" : "Remove background"}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      )}
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
