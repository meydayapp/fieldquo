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
//
// ── 2026-09-02: adopting the shared top-up dialog ──────────────────────────
//
// The same dead end AiSidebar.js's header describes was here too, from the
// same hook and the same endpoint. It is fixed the same way — by adopting
// app/components/ai/AiCreditTopupDialog.js rather than by growing a second
// copy of the flow, which is the one that would rot.
//
// The one honest difference: there is nothing to restore. AiSidebar can put a
// typed prompt back; this panel's input is a SELECTION on a fabric canvas, and
// a selection does not survive a page load. So `capturePending` is omitted and
// the trip back reopens the panel with its own "Select a photo first" state —
// true, and better than landing on a closed toolbar with no sign that anything
// happened. Faking a restored selection would be the dishonest version.
//
// ── 2026-09-03: the refusal looks like the other one now ───────────────────
//
// The approved redesign's remaining point was about SHAPE, not wording: a
// reason floating above a separately-disabled control reads as "the feature is
// gone", and one block containing both reads as "here is the control, here is
// why it is off". AiSidebar.js was fixed; this panel kept the loose shape and
// was the copy nobody looked at. Both now render the same bordered block with
// the same warning mark, and both take their money sentence from the same
// catalogue strings the top-up dialog uses.
import { useCallback, useState } from "react";
import { AlertTriangle, Loader } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";
import {
  useAiImageStatus,
  centsToDollars,
  disabledReasonText,
} from "@/app/components/designer/hooks/useAiImageStatus";
import {
  AiCreditTopupDialog,
  useAiCreditTopup,
} from "@/app/components/ai/AiCreditTopupDialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function RemoveBgSidebar({ editor, activeTool, onChangeActiveTool }) {
  const { t } = useTranslation();
  const active = activeTool === "remove-bg";
  const { status, loading, refresh } = useAiImageStatus(active);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onResume = useCallback(() => onChangeActiveTool("remove-bg"), [onChangeActiveTool]);
  const topup = useAiCreditTopup({
    pendingKey: "designer.removeBg",
    onResume,
    onCredited: refresh,
  });

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
        // Same 402 contract as /api/designer/generate — see AiSidebar.js.
        if (res.status === 402 && data?.topup) {
          topup.open(data);
          return;
        }
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
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
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
        <div className="flex flex-1 flex-col items-center justify-center gap-y-2 p-4 text-center">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">Select a photo first</p>
          <p className="text-xs text-muted-foreground">
            Tap a photo on the canvas, then come back here to remove its background.
          </p>
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
              <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
                {/* The same block AiSidebar.js renders, deliberately identical:
                    a bordered panel carrying the warning mark, the sentence and
                    the way out, sitting directly above the button it explains.
                    This panel used to render the reason as a bare line of grey
                    text with nothing tying it to the disabled button below —
                    the "two unrelated things" shape the AI panel was fixed out
                    of and this one was left in. Two copies of one refusal that
                    look different is how a person learns the second one means
                    something else. */}
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{disabledReasonText(status, t)}</span>
                </div>
                {/* Only where money is the problem — `topup` is null on every
                    other refusal, because buying credit fixes none of them. */}
                {status?.topup && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 w-full"
                    onClick={() => topup.open(status)}
                  >
                    {t("app.aiTopup.buyCredit", "Add AI credit")}
                  </Button>
                )}
              </div>
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
      <AiCreditTopupDialog {...topup.dialogProps} />
    </aside>
  );
}
