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
//
// Two things the owner named directly, both fixed here:
//
//   - The placeholder was the source clone's own sample prompt verbatim —
//     "An astronaut riding a horse on mars, hd, dramatic lighting". This
//     tool's actual audience is a painter or roofer making a Facebook ad, not
//     a stock-art hobbyist; the placeholder and the `rows` count (10, taller
//     than most phone screens have room for once a keyboard is up) are both
//     rewritten for that person.
//   - "No prompt or anything of the sort" traced to the refusal state
//     rendering the reason block ABOVE a separately-disabled form — two
//     stacked, visually unrelated things, with a barely-visible greyed-out
//     textarea easy to miss under a message that reads like the whole
//     feature is gone. The textarea and button now always render; when
//     `status.allowed` is false the reason sits INSIDE the same form, right
//     above the input it's explaining, so a company that can't afford this
//     yet still sees "here's the prompt box, here's why it's off" as one
//     panel instead of an error page hiding a dead control.
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PROMPT_EXAMPLES = [
  "a freshly painted living room, warm afternoon light",
  "a clean work truck with a ladder rack, parked on a job site",
];

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
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        active ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title="AI image"
        description={
          status?.priceCents
            ? `Generate a photo-style image for a post or ad — ${centsToDollars(status.priceCents)} each`
            : "Generate a photo-style image for a post or ad"
        }
      />
      <div className="overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && (
          <form onSubmit={onSubmit} className="space-y-4 p-4">
            {!status?.allowed && (
              <div className="flex items-start gap-2 rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{disabledReasonText(status)}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ai-image-prompt">Describe the image</Label>
              <Textarea
                id="ai-image-prompt"
                disabled={!status?.allowed || submitting}
                placeholder={`e.g. "${PROMPT_EXAMPLES[0]}" or "${PROMPT_EXAMPLES[1]}"`}
                rows={4}
                required
                minLength={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                For social posts and ads — this never appears on a quote, invoice or anything a
                client signs.
              </p>
            </div>
            <Button disabled={!status?.allowed || submitting} type="submit" className="w-full">
              {submitting ? "Generating…" : "Generate image"}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>
        )}
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
