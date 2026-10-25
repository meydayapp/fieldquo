// app/components/designer/Footer.js
// Ported near verbatim from `components/footer.tsx`. The hint labels name
// the keyboard/mouse equivalents because these three buttons were, until
// 2026-10-25, the ONLY way to move the viewport — the gestures added in
// hooks/useCanvasPanZoom.js are invisible otherwise, and a tooltip on a
// control that already does the same job is the cheapest honest place to
// put them. Shift+0/Shift+1 are quoted rather than Ctrl+0/Ctrl+1: see the
// comment in hooks/useHotkeys.js for why the Ctrl pair cannot be promised
// inside a browser tab.
import { Minimize, ZoomIn, ZoomOut } from "lucide-react";

import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 */
export function Footer({ editor }) {
  return (
    <footer className="z-[49] flex h-[52px] w-full shrink-0 flex-row-reverse items-center gap-x-1 overflow-x-auto border-t bg-card p-2 px-4">
      <Hint label="Fit to screen (Shift+0)" side="top" sideOffset={10}>
        <Button onClick={() => editor?.autoZoom()} size="icon" variant="ghost" className="h-full">
          <Minimize className="size-4" />
        </Button>
      </Hint>
      <Hint label="Zoom in (Ctrl/Alt + scroll, or Shift+1 for 100%)" side="top" sideOffset={10}>
        <Button onClick={() => editor?.zoomIn()} size="icon" variant="ghost" className="h-full">
          <ZoomIn className="size-4" />
        </Button>
      </Hint>
      <Hint label="Zoom out (Ctrl/Alt + scroll; hold space to drag the view)" side="top" sideOffset={10}>
        <Button onClick={() => editor?.zoomOut()} size="icon" variant="ghost" className="h-full">
          <ZoomOut className="size-4" />
        </Button>
      </Hint>
    </footer>
  );
}
