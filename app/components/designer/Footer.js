// app/components/designer/Footer.js
// Ported near verbatim from `components/footer.tsx`.
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
      <Hint label="Reset" side="top" sideOffset={10}>
        <Button onClick={() => editor?.autoZoom()} size="icon" variant="ghost" className="h-full">
          <Minimize className="size-4" />
        </Button>
      </Hint>
      <Hint label="Zoom in" side="top" sideOffset={10}>
        <Button onClick={() => editor?.zoomIn()} size="icon" variant="ghost" className="h-full">
          <ZoomIn className="size-4" />
        </Button>
      </Hint>
      <Hint label="Zoom out" side="top" sideOffset={10}>
        <Button onClick={() => editor?.zoomOut()} size="icon" variant="ghost" className="h-full">
          <ZoomOut className="size-4" />
        </Button>
      </Hint>
    </footer>
  );
}
