"use client";

// app/components/designer/StrokeWidthSidebar.js
// Ported from `components/stroke-width-sidebar.tsx`, using this port's own
// Slider (components/ui/slider.jsx, built on @base-ui/react/slider).
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";

import { STROKE_DASH_ARRAY, STROKE_WIDTH } from "@/lib/designer/constants";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function StrokeWidthSidebar({ editor, activeTool, onChangeActiveTool }) {
  const widthValue = editor?.getActiveStrokeWidth() || STROKE_WIDTH;
  const typeValue = editor?.getActiveStrokeDashArray() || STROKE_DASH_ARRAY;

  const onClose = () => onChangeActiveTool("select");
  const onChangeStrokeWidth = (value) => editor?.changeStrokeWidth(value);
  const onChangeStrokeType = (value) => editor?.changeStrokeDashArray(value);

  return (
    <aside
      className={cn(
        "relative z-[40] flex h-full w-[360px] flex-col border-r bg-card",
        activeTool === "stroke-width" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader title="Stroke options" description="Modify the stroke of your element" />
      <div className="overflow-y-auto">
        <div className="space-y-4 border-b p-4">
          <Label className="text-sm">Stroke width</Label>
          <Slider
            value={[widthValue]}
            onValueChange={(values) => onChangeStrokeWidth(values[0])}
          />
        </div>
        <div className="space-y-4 border-b p-4">
          <Label className="text-sm">Stroke type</Label>
          <Button
            onClick={() => onChangeStrokeType([])}
            variant="secondary"
            size="lg"
            className={cn(
              "h-16 w-full justify-start text-left",
              JSON.stringify(typeValue) === `[]` && "border-2 border-primary",
            )}
            style={{ padding: "8px 16px" }}
          >
            <div className="w-full rounded-full border-4 border-foreground" />
          </Button>
          <Button
            onClick={() => onChangeStrokeType([5, 5])}
            variant="secondary"
            size="lg"
            className={cn(
              "h-16 w-full justify-start text-left",
              JSON.stringify(typeValue) === `[5,5]` && "border-2 border-primary",
            )}
            style={{ padding: "8px 16px" }}
          >
            <div className="w-full rounded-full border-4 border-dashed border-foreground" />
          </Button>
        </div>
      </div>
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
