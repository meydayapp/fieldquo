"use client";

// app/components/designer/AiSidebar.js
//
// AI image generation — restored per the owner's 2026-08-30 correction, and
// the ONE premium piece of this port: every other editor feature is free.
// Gated on the `image_generation` spend kind + the "marketing_designer"
// feature key via lib/designer/aiImageAdapter.js (POSTed through
// app/api/designer/generate/route.js). Same TODO seam as RemoveBgSidebar —
// the vendor call itself lands in a sibling worktree's lib/ai/images.js.
//
// The source clone's ai-sidebar.tsx called useGenerateImage() + usePaywall()
// straight into a mutation with no visible price and a boolean "blocked".
// This version fetches useAiImageStatus() BEFORE rendering the button live,
// so a company that can't afford it — or whose deployment hasn't wired the
// vendor yet — sees a disabled control with the specific reason, never a
// button that looks clickable and fails after the fact.
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
import { Textarea } from "@/components/ui/textarea";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function AiSidebar({ editor, activeTool, onChangeActiveTool }) {
  const active = activeTool === "ai";
  const { status, loading } = useAiImageStatus(active);

  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onClose = () => onChangeActiveTool("select");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!status?.allowed) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/designer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't generate that image.");
        return;
      }
      editor?.addImage(data.url);
      setValue("");
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
        title="AI"
        description={
          status?.priceCents
            ? `Generate an image using AI — ${centsToDollars(status.priceCents)} each`
            : "Generate an image using AI"
        }
      />
      <div className="overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && !status?.allowed && (
          <div className="flex flex-col items-center gap-y-3 p-4 text-center">
            <AlertTriangle className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{disabledReasonText(status)}</p>
          </div>
        )}
        {!loading && (
          <form onSubmit={onSubmit} className="space-y-6 p-4">
            <Textarea
              disabled={!status?.allowed || submitting}
              placeholder="An astronaut riding a horse on mars, hd, dramatic lighting"
              rows={10}
              required
              minLength={3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button disabled={!status?.allowed || submitting} type="submit" className="w-full">
              {submitting ? "Generating…" : "Generate"}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>
        )}
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
